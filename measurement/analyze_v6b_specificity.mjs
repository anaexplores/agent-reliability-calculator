// v6b — split-half decomposition: is the chosen configuration task-SPECIFIC, or just stronger overall?
// For each task (configurations with >= 5 attempts, tasks with >= 10 such configurations):
//   pick the configuration with the best result on attempts 1-2 (ties broken at random),
//   A = its success on attempts 3-5 (holdout),
//   B = the same configuration's mean success across ALL tasks,
//   C = mean success of all configurations on this task, attempts 3-5.
// B − C = "the configuration is stronger in general"; A − B = configuration-to-task specificity.
// The tie-break is random, so the decomposition is averaged over REPS draws (min–max reported).
// Corpus: Terminal-Bench 2.0 trajectories, https://huggingface.co/datasets/yoonholee/terminalbench-trajectories
//   (CSV produced by measurement/fetch_terminalbench.mjs).
// Usage: node measurement/analyze_v6b_specificity.mjs tb_trials.csv [reps=200]
// Backs: docs/measurements/04_null_tests.md (T2)
import fs from 'node:fs';
const FILE = process.argv[2] || 'tb_trials.csv';
const REPS = Number(process.argv[3] || 200);
function parseCSV(txt){const rows=[];const lines=txt.split(/\r?\n/);
 for(let i=1;i<lines.length;i++){const L=lines[i];if(!L)continue;const f=[];let cur='',q=false;
  for(let c=0;c<L.length;c++){const ch=L[c];
   if(q){if(ch==='"'){if(L[c+1]==='"'){cur+='"';c++}else q=false}else cur+=ch}
   else if(ch==='"')q=true; else if(ch===','){f.push(cur);cur=''} else cur+=ch}
  f.push(cur); if(f.length>=4)rows.push({task:f[0],cfg:f[1]+'||'+f[2],reward:Number(f[3])})}
 return rows}
const rows=parseCSV(fs.readFileSync(FILE,'utf8')).filter(r=>r.reward===0||r.reward===1);
const T=new Map(); const cfgGlobal=new Map();
for(const r of rows){
  if(!T.has(r.task))T.set(r.task,new Map());
  const c=T.get(r.task); if(!c.has(r.cfg))c.set(r.cfg,[]); c.get(r.cfg).push(r.reward);
  if(!cfgGlobal.has(r.cfg))cfgGlobal.set(r.cfg,[0,0]);
  const g=cfgGlobal.get(r.cfg); g[0]+=r.reward; g[1]++;
}
const globalRate=new Map(); for(const [c,[s,n]] of cfgGlobal) globalRate.set(c, s/n);

function once(){
  let A=0, B=0, C=0, cnt=0;
  for(const [,cfgs] of T){
    const usable=[...cfgs.entries()].filter(([,v])=>v.length>=5);
    if(usable.length<10) continue;
    let best=-1, ties=[];
    for(const [cfg,v] of usable){const s=(v[0]+v[1])/2; if(s>best){best=s;ties=[[cfg,v]]} else if(s===best) ties.push([cfg,v])}
    const [cfg,v]=ties[(Math.random()*ties.length)|0];
    const hold=v.slice(2,5);
    A += hold.reduce((a,b)=>a+b,0)/hold.length;
    B += globalRate.get(cfg);
    let m=0,mn=0; for(const [,vv] of usable){const h=vv.slice(2,5); m+=h.reduce((a,b)=>a+b,0); mn+=h.length}
    C += m/mn;
    cnt++;
  }
  return {A:A/cnt, B:B/cnt, C:C/cnt, cnt};
}
const runs=[]; for(let i=0;i<REPS;i++) runs.push(once());
const stat=f=>{const xs=runs.map(f); const m=xs.reduce((a,b)=>a+b,0)/xs.length; return [m, Math.min(...xs), Math.max(...xs)]};
const pct=([m,lo,hi])=>`${(100*m).toFixed(1)}%  [${(100*lo).toFixed(1)}; ${(100*hi).toFixed(1)}]`;
const pp=([m,lo,hi])=>`${(100*m).toFixed(1)} pp  [${(100*lo).toFixed(1)}; ${(100*hi).toFixed(1)}]`;
console.log(`tasks: ${runs[0].cnt}; averaged over ${REPS} random tie-breaks (mean [min; max])`);
console.log(`A. chosen configuration, success on holdout (attempts 3-5):   ${pct(stat(r=>r.A))}`);
console.log(`B. mean success of THE SAME configuration across ALL tasks:   ${pct(stat(r=>r.B))}`);
console.log(`C. mean success of all configurations on THIS task (3-5):     ${pct(stat(r=>r.C))}`);
console.log(`\n"configuration is stronger in general" (B − C) = ${pp(stat(r=>r.B-r.C))}`);
console.log(`"configuration fits THIS task"         (A − B) = ${pp(stat(r=>r.A-r.B))}   <- specificity`);
console.log(`full transfer of the choice            (A − C) = ${pp(stat(r=>r.A-r.C))}`);
