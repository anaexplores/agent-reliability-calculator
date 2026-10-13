// v4 — fixes bugs found by an independent adversarial review:
//   (1) cluster bootstrap BY TASK (not by cell): the effective n ≈ number of tasks.
//   (2) k₀ = (N − Σkᵢ²/N)/(n−1) instead of k̄ for the unbalanced design.
// Question: how much of the observed "instability" (ICC) disappears when defective tasks are excluded.
// Corpus: Terminal-Bench 2.0 trajectories, https://huggingface.co/datasets/yoonholee/terminalbench-trajectories
//   (CSV produced by measurement/fetch_terminalbench.mjs). Exclusion list: measurement/tb21_fixed_tasks.txt
//   (the 28 tasks changed in Terminal-Bench 2.1, https://www.tbench.ai/news/terminal-bench-2-1).
// Usage: node measurement/analyze_v4_benchmark_defects.mjs tb_trials.csv measurement/tb21_fixed_tasks.txt
// Backs: docs/measurements/05_benchmark_defects_tb20_vs_21.md
import fs from 'node:fs';
const FILE = process.argv[2] || 'tb_trials.csv';
const EXCL = process.argv[3] || null;

function parseCSV(txt){const rows=[];const lines=txt.split(/\r?\n/);
 for(let i=1;i<lines.length;i++){const L=lines[i];if(!L)continue;const f=[];let cur='',q=false;
  for(let c=0;c<L.length;c++){const ch=L[c];
   if(q){if(ch==='"'){if(L[c+1]==='"'){cur+='"';c++}else q=false}else cur+=ch}
   else if(ch==='"')q=true; else if(ch===','){f.push(cur);cur=''} else cur+=ch}
  f.push(cur); if(f.length>=4)rows.push({task:f[0],agent:f[1],model:f[2],reward:Number(f[3])})}
 return rows}

const all = parseCSV(fs.readFileSync(FILE,'utf8')).filter(r=>r.reward===0||r.reward===1);

let excluded = new Set();
if (EXCL && fs.existsSync(EXCL)) {
  excluded = new Set(fs.readFileSync(EXCL,'utf8').split(/\r?\n/).map(s=>s.trim()).filter(s=>s && !s.startsWith('#')));
  console.log(`Exclusion list: ${excluded.size} tasks (from ${EXCL})`);
} else {
  console.log('No exclusion list given — computing the baseline slice only.');
}

// ── ICC with the correct k₀ ────────────────────────────────────────────────
function buildGroups(rows){
  const G=new Map();
  for(const r of rows){const k=`${r.task}||${r.agent}||${r.model}`;if(!G.has(k))G.set(k,{task:r.task,v:[]});G.get(k).v.push(r.reward)}
  return [...G.values()].filter(g=>g.v.length>=3);
}
function icc(groups){
  const n=groups.length; if(n<10) return NaN;
  let N=0,S=0,sumK2=0;
  for(const g of groups){N+=g.v.length;S+=g.v.reduce((a,b)=>a+b,0);sumK2+=g.v.length**2}
  const p=S/N;
  let ssb=0,ssw=0,dfw=0;
  for(const g of groups){const k=g.v.length,m=g.v.reduce((a,b)=>a+b,0)/k;ssb+=k*(m-p)**2;for(const v of g.v)ssw+=(v-m)**2;dfw+=k-1}
  const MSB=ssb/(n-1), MSW=ssw/dfw;
  const k0=(N-sumK2/N)/(n-1);              // ← fix: k₀, not k̄
  return (MSB-MSW)/(MSB+(k0-1)*MSW);
}
// cluster bootstrap BY TASK  ← fix of the resampling unit
function bootCI(rows, B=300){
  const byTask=new Map();
  for(const r of rows){if(!byTask.has(r.task))byTask.set(r.task,[]);byTask.get(r.task).push(r)}
  const tasks=[...byTask.values()];
  const out=[];
  for(let b=0;b<B;b++){
    const samp=[];
    for(let i=0;i<tasks.length;i++) samp.push(...tasks[(Math.random()*tasks.length)|0]);
    const v=icc(buildGroups(samp));
    if(!Number.isNaN(v)) out.push(v);
  }
  out.sort((a,b)=>a-b);
  return [out[Math.floor(0.025*out.length)], out[Math.floor(0.975*out.length)], out.length];
}

function report(label, rows){
  const g=buildGroups(rows);
  const tasks=new Set(rows.map(r=>r.task));
  let N=0,S=0; for(const x of g){N+=x.v.length;S+=x.v.reduce((a,b)=>a+b,0)}
  const val=icc(g);
  const [lo,hi,B]=bootCI(rows);
  // share of "never solved" tasks
  const byTask=new Map();
  for(const r of rows){if(!byTask.has(r.task))byTask.set(r.task,[]);byTask.get(r.task).push(r.reward)}
  let never=0; for(const [,v] of byTask) if(v.every(x=>x===0)) never++;
  // left bump: tasks with success rate <10%
  let leftBump=0; for(const [,v] of byTask){const r=v.reduce((a,b)=>a+b,0)/v.length; if(r<0.10) leftBump++}
  console.log(`\n=== ${label} ===`);
  console.log(`tasks: ${tasks.size} · cells (k≥3): ${g.length} · runs: ${N} · p̄=${(S/N).toFixed(4)}`);
  console.log(`ICC (k₀-corrected) = ${val.toFixed(4)}   95% cluster CI by task: [${lo.toFixed(4)}, ${hi.toFixed(4)}]  (B=${B})`);
  console.log(`tasks "never solved": ${never} (${(100*never/tasks.size).toFixed(1)}%)`);
  console.log(`tasks with success <10% (left bump): ${leftBump} (${(100*leftBump/tasks.size).toFixed(1)}%)`);
  return {icc:val, lo, hi, never, leftBump, tasks:tasks.size};
}

const base = report('TB 2.0 — ALL tasks', all);

if (excluded.size) {
  const kept = all.filter(r => !excluded.has(r.task));
  const cut = report(`TB 2.0 WITHOUT defective tasks (${excluded.size} excluded)`, kept);
  const d = base.icc - cut.icc;
  console.log(`\n══ EFFECT OF EXCLUDING DEFECTIVE TASKS ══`);
  console.log(`ΔICC = ${base.icc.toFixed(4)} → ${cut.icc.toFixed(4)}   (drop ${d.toFixed(4)}, ${(100*d/base.icc).toFixed(1)}% of the original)`);
  console.log(`"never solved":      ${base.never} → ${cut.never}`);
  console.log(`left bump (<10%):    ${base.leftBump} → ${cut.leftBump}`);
  console.log(`\nHYPOTHESES (fixed before the analysis):`);
  console.log(`  H0 (the metric is about agents): |ΔICC| < 0.05`);
  console.log(`  H1 (the metric is about the benchmark): ΔICC >= 0.10`);
  console.log(`  VERDICT: ${d>=0.10?'H1 — the metric substantially measured benchmark defects':(Math.abs(d)<0.05?'H0 — the effect is small, the metric is about agents':'intermediate case (0.05<=Δ<0.10) — inconclusive')}`);
  const overlap = !(cut.hi < base.lo || base.hi < cut.lo);
  console.log(`  CIs overlap: ${overlap?'YES (difference not shown)':'NO (difference is robust)'}`);
}
