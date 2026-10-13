// v3 — follow-up to an independent adversarial review. Tests the revised claim:
// "resampling one configuration gives little; diversifying configurations gives a lot".
// Also: is the observed "polarization" reproduced by a beta-binomial with INDEPENDENT trials?
// (a check of the de Finetti counter-argument: heterogeneity of p is indistinguishable from correlation).
// Corpus: Terminal-Bench 2.0 trajectories (task, agent, model, reward),
//   https://huggingface.co/datasets/yoonholee/terminalbench-trajectories (Apache-2.0).
//   The CSV is produced by measurement/fetch_terminalbench.mjs.
// Usage: node measurement/analyze_v3_diversification.mjs tb_trials.csv
// Backs: docs/measurements/01_terminal_bench.md
import fs from 'node:fs';
const FILE = process.argv[2] || 'tb_trials.csv';
function parseCSV(txt){const rows=[];const lines=txt.split(/\r?\n/);
 for(let i=1;i<lines.length;i++){const L=lines[i];if(!L)continue;const f=[];let cur='',q=false;
  for(let c=0;c<L.length;c++){const ch=L[c];
   if(q){if(ch==='"'){if(L[c+1]==='"'){cur+='"';c++}else q=false}else cur+=ch}
   else if(ch==='"')q=true; else if(ch===','){f.push(cur);cur=''} else cur+=ch}
  f.push(cur); if(f.length>=4)rows.push({task:f[0],agent:f[1],model:f[2],reward:Number(f[3])})}
 return rows}
const rows=parseCSV(fs.readFileSync(FILE,'utf8')).filter(r=>r.reward===0||r.reward===1);

// ── 1. REVIEW CHECK: beta-binomial with INDEPENDENT trials ─────────────────
const G=new Map();
for(const r of rows){const k=`${r.task}||${r.agent}||${r.model}`;if(!G.has(k))G.set(k,[]);G.get(k).push(r.reward)}
const g5=[...G.values()].filter(g=>g.length===5);
let N=0,S=0;for(const g of g5){N+=5;S+=g.reduce((a,b)=>a+b,0)}
const mu=S/N;
// ICC on this subset
let n=g5.length,ssb=0,ssw=0;
for(const g of g5){const m=g.reduce((a,b)=>a+b,0)/5;ssb+=5*(m-mu)**2;for(const v of g)ssw+=(v-m)**2}
const MSB=ssb/(n-1),MSW=ssw/(n*4),rho=(MSB-MSW)/(MSB+4*MSW);
const ab=(1-rho)/rho, alpha=mu*ab, beta=(1-mu)*ab;
const prod=(x,k)=>{let p=1;for(let j=0;j<k;j++)p*=(x+j);return p};
const EallF=prod(beta,5)/prod(ab,5), EallS=prod(alpha,5)/prod(ab,5);
let obsF=0,obsS=0;for(const g of g5){const s=g.reduce((a,b)=>a+b,0);if(s===0)obsF++;else if(s===5)obsS++}
console.log('── CHECK OF THE REVIEW\'S COUNTER-ARGUMENT (de Finetti) ──');
console.log(`k=5 groups: ${n}, μ=${mu.toFixed(4)}, ICC=${rho.toFixed(4)} → beta(α=${alpha.toFixed(4)}, β=${beta.toFixed(4)})`);
console.log(`"all ✗": observed ${(100*obsF/n).toFixed(1)}%  beta-binomial (INDEPENDENT trials) ${(100*EallF).toFixed(1)}%`);
console.log(`"all ✓": observed ${(100*obsS/n).toFixed(1)}%  beta-binomial (INDEPENDENT trials) ${(100*EallS).toFixed(1)}%`);
console.log(`CONCLUSION: if these match, "correlation" is indistinguishable from difficulty heterogeneity. The review is right.\n`);

// ── 2. REVISED RESULT: resampling vs diversification ──────────────────────
const byTask=new Map();
for(const r of rows){if(!byTask.has(r.task))byTask.set(r.task,[]);byTask.get(r.task).push(r)}
console.log('── RESAMPLING vs DIVERSIFICATION ──');
console.log('For each task: (a) best result of a SINGLE configuration (max success rate),');
console.log('(b) whether anyone solved the task at all. Computed over "hard" tasks.\n');

let hard=[], solvedByAnyone=0, hardN=0;
for(const [task,rs] of byTask){
  const overall=rs.reduce((a,r)=>a+r.reward,0)/rs.length;
  // group by configuration
  const cfg=new Map();
  for(const r of rs){const k=`${r.agent}||${r.model}`;if(!cfg.has(k))cfg.set(k,[]);cfg.get(k).push(r.reward)}
  let bestCfg=0, anySuccess=false;
  for(const [,v] of cfg){const rate=v.reduce((a,b)=>a+b,0)/v.length; if(rate>bestCfg)bestCfg=rate; if(v.some(x=>x===1))anySuccess=true}
  if(overall<0.10){hardN++; if(anySuccess)solvedByAnyone++; hard.push([task,overall,bestCfg,cfg.size])}
}
console.log(`Hard tasks (overall success rate <10%): ${hardN}`);
console.log(`Of these, solved AT LEAST ONCE by AT LEAST ONE configuration: ${solvedByAnyone} (${(100*solvedByAnyone/hardN).toFixed(0)}%)`);
console.log(`Never solved by anyone: ${hardN-solvedByAnyone}\n`);
console.log('Hard tasks: overall success rate → best configuration:');
hard.sort((a,b)=>a[1]-b[1]).forEach(([t,o,b,c])=>
  console.log(`  overall ${(100*o).toFixed(1).padStart(5)}%  best config ${(100*b).toFixed(1).padStart(5)}%  (configurations: ${String(c).padStart(3)})  ${t}`));

// ── 3. How much the "best configuration" beats the "average" one ──────────
let sumOverall=0,sumBest=0,cnt=0;
for(const [,rs] of byTask){
  const overall=rs.reduce((a,r)=>a+r.reward,0)/rs.length;
  const cfg=new Map();
  for(const r of rs){const k=`${r.agent}||${r.model}`;if(!cfg.has(k))cfg.set(k,[]);cfg.get(k).push(r.reward)}
  let best=0;for(const [,v] of cfg){const rate=v.reduce((a,b)=>a+b,0)/v.length;if(rate>best)best=rate}
  sumOverall+=overall;sumBest+=best;cnt++;
}
console.log(`\n── Average configuration vs best (over ${cnt} tasks) ──`);
console.log(`mean success rate across all configurations: ${(100*sumOverall/cnt).toFixed(1)}%`);
console.log(`success rate of the BEST configuration per task: ${(100*sumBest/cnt).toFixed(1)}%`);
console.log(`gain from picking the right configuration: +${(100*(sumBest-sumOverall)/cnt).toFixed(1)} pp`);
