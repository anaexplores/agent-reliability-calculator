// Third corpus — τ-bench (tau2-bench), data up to August 2026.
// Measures: ICC per (model × domain), recovered analytically from published pass^1 and pass^2
// (beta-binomial), then CHECKED against pass^3 and pass^4 — an out-of-sample validation.
// Source: Sierra Research public S3, the submission.json of each submission:
//   https://sierra-tau-bench-public.s3.amazonaws.com/submissions/
//   manifest: https://raw.githubusercontent.com/sierra-research/tau2-bench/main/web/leaderboard/public/submissions/manifest.json
// τ-bench publishes pass^k = share of tasks where ALL k attempts succeed (k=1..4).
// Under independent attempts pass^k = μ^k. A deviation => correlation.
// Usage: node measurement/analyze_tau2bench.mjs   (no input; fetches data over the network,
//   writes tau2_icc.json to the current directory)
// Backs: docs/measurements/03_tau_bench.md
import fs from 'node:fs';

const S3='https://sierra-tau-bench-public.s3.amazonaws.com/submissions/';
const MANIFEST='https://raw.githubusercontent.com/sierra-research/tau2-bench/main/web/leaderboard/public/submissions/manifest.json';

const iccFromPass=(p1,p2)=>{const r=p2/p1, s=(r-1)/(p1-r); return {s, icc:1/(s+1)}};
const predictPass=(mu,icc,k)=>{const s=(1-icc)/icc, a=mu*s; let n=1,d=1;
  for(let j=0;j<k;j++){n*=(a+j); d*=(s+j)} return n/d};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const man=await (await fetch(MANIFEST)).json();
const all=[...(man.submissions||[]), ...(man.voice_submissions||[]), ...(man.legacy_submissions||[])];
console.log(`submissions in manifest: ${all.length}\n`);

const rows=[];
for(const id of all){
  try{
    const r=await fetch(S3+id+'/submission.json');
    if(!r.ok) continue;
    const j=await r.json();
    for(const [domain,res] of Object.entries(j.results||{})){
      if(!res||res.pass_1==null||res.pass_2==null) continue;
      const p1=res.pass_1/100, p2=res.pass_2/100;
      if(!(p1>0&&p2>0&&p2<p1)) continue;          // invalid/degenerate
      const {icc,s}=iccFromPass(p1,p2);
      if(!(icc>0&&icc<1)) continue;
      rows.push({model:j.model_name, org:j.model_organization, date:j.submission_date,
        type:j.submission_type||'?', domain, p1,p2,
        p3:res.pass_3!=null?res.pass_3/100:null, p4:res.pass_4!=null?res.pass_4/100:null,
        icc, s, sim:(j.methodology&&j.methodology.user_simulator)||'?',
        ver:(j.methodology&&j.methodology.tau2_bench_version)||'?'});
    }
    await sleep(120);
  }catch(e){}
}
console.log(`measurements collected (model × domain): ${rows.length}\n`);

// ── out-of-sample check: predict pass^3/pass^4 from the ICC fitted on pass^1,pass^2 ──
console.log('══ OUT-OF-SAMPLE CHECK (ICC fitted on pass^1, pass^2) ══');
let errM3=[],errM4=[],errN3=[],errN4=[];
for(const r of rows){
  if(r.p3!=null){errM3.push(Math.abs(predictPass(r.p1,r.icc,3)-r.p3)); errN3.push(Math.abs(Math.pow(r.p1,3)-r.p3))}
  if(r.p4!=null){errM4.push(Math.abs(predictPass(r.p1,r.icc,4)-r.p4)); errN4.push(Math.abs(Math.pow(r.p1,4)-r.p4))}
}
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:NaN;
const med=a=>{const b=[...a].sort((x,y)=>x-y);return b.length?b[Math.floor(b.length/2)]:NaN};
console.log(`  pass^3: our model  — mean error ${(100*mean(errM3)).toFixed(2)} pp (median ${(100*med(errM3)).toFixed(2)})`);
console.log(`          independence — mean error ${(100*mean(errN3)).toFixed(2)} pp (median ${(100*med(errN3)).toFixed(2)})`);
console.log(`  pass^4: our model  — mean error ${(100*mean(errM4)).toFixed(2)} pp (median ${(100*med(errM4)).toFixed(2)})`);
console.log(`          independence — mean error ${(100*mean(errN4)).toFixed(2)} pp (median ${(100*med(errN4)).toFixed(2)})`);
console.log(`  → our model is ${(mean(errN4)/mean(errM4)).toFixed(1)}× more accurate on pass^4\n`);

// ── ICC distribution ──
const iccs=rows.map(r=>r.icc).sort((a,b)=>a-b);
const q=p=>iccs[Math.floor(p*(iccs.length-1))];
console.log('══ ICC DISTRIBUTION across all models and domains ══');
console.log(`  n=${iccs.length}  min=${iccs[0].toFixed(3)}  Q1=${q(.25).toFixed(3)}  median=${q(.5).toFixed(3)}  Q3=${q(.75).toFixed(3)}  max=${iccs[iccs.length-1].toFixed(3)}`);
console.log(`  mean=${mean(iccs).toFixed(3)}`);
const bins=new Array(10).fill(0); iccs.forEach(v=>bins[Math.min(9,Math.floor(v*10))]++);
bins.forEach((c,i)=>{if(c)console.log(`   ${(i/10).toFixed(1)}–${((i+1)/10).toFixed(1)}: ${'█'.repeat(c)} ${c}`)});

// ── by domain ──
console.log('\n══ BY DOMAIN ══');
const byDom=new Map();
for(const r of rows){if(!byDom.has(r.domain))byDom.set(r.domain,[]);byDom.get(r.domain).push(r.icc)}
for(const [d,v] of [...byDom].sort((a,b)=>b[1].length-a[1].length))
  console.log(`  ${d.padEnd(20)} n=${String(v.length).padStart(3)}  median ICC=${med(v).toFixed(3)}  mean=${mean(v).toFixed(3)}`);

// ── recent (2026) ──
console.log('\n══ RECENT MEASUREMENTS (2026) ══');
const fresh=rows.filter(r=>String(r.date).startsWith('2026')).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
console.log(`  total recent: ${fresh.length}, median ICC = ${med(fresh.map(r=>r.icc)).toFixed(3)}`);
console.log('  10 most recent:');
fresh.slice(0,10).forEach(r=>console.log(
  `   ${String(r.date)}  ${String(r.model).slice(0,22).padEnd(23)} ${r.domain.padEnd(18)} pass^1=${(100*r.p1).toFixed(1).padStart(5)}%  ICC=${r.icc.toFixed(3)}`));

// ── summary of the three corpora ──
console.log('\n╔══ THREE INDEPENDENT CORPORA ══╗');
console.log('  Terminal-Bench 2.0   ICC 0.666   52,104 runs        terminal, 109 configurations, k=5');
console.log('  SWE-bench Lite       ICC 0.574   66,483 runs        code repair, 1 configuration, k=250');
console.log(`  τ-bench (recent)     ICC ${med(fresh.map(r=>r.icc)).toFixed(3)}   ${rows.length} measurements    customer service, ${byDom.size} domains, k=4`);
fs.writeFileSync('tau2_icc.json', JSON.stringify(rows,null,1));
console.log('\nraw measurements saved → tau2_icc.json');
