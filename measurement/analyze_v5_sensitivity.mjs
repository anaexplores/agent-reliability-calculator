// v5 — sensitivity analysis: how much ICC depends on the tail of hard tasks.
// ⚠️ THIS IS NOT AN ESTIMATE of the "true ICC" (excluding tasks based on the same data is circular).
// It is a FRAGILITY check of the metric: if ICC drops sharply when a few tasks are removed,
// it rests on a small share of the corpus rather than on the general behavior of agents.
// Corpus: Terminal-Bench 2.0 trajectories, https://huggingface.co/datasets/yoonholee/terminalbench-trajectories
//   (CSV produced by measurement/fetch_terminalbench.mjs).
// Usage: node measurement/analyze_v5_sensitivity.mjs tb_trials.csv
// Backs: docs/measurements/05_benchmark_defects_tb20_vs_21.md
import fs from 'node:fs';
const FILE = process.argv[2] || 'tb_trials.csv';
function parseCSV(txt){const rows=[];const lines=txt.split(/\r?\n/);
 for(let i=1;i<lines.length;i++){const L=lines[i];if(!L)continue;const f=[];let cur='',q=false;
  for(let c=0;c<L.length;c++){const ch=L[c];
   if(q){if(ch==='"'){if(L[c+1]==='"'){cur+='"';c++}else q=false}else cur+=ch}
   else if(ch==='"')q=true; else if(ch===','){f.push(cur);cur=''} else cur+=ch}
  f.push(cur); if(f.length>=4)rows.push({task:f[0],agent:f[1],model:f[2],reward:Number(f[3])})}
 return rows}
const all=parseCSV(fs.readFileSync(FILE,'utf8')).filter(r=>r.reward===0||r.reward===1);

function buildGroups(rows){const G=new Map();
 for(const r of rows){const k=`${r.task}||${r.agent}||${r.model}`;if(!G.has(k))G.set(k,[]);G.get(k).push(r.reward)}
 return [...G.values()].filter(g=>g.length>=3)}
function icc(groups){const n=groups.length;if(n<10)return NaN;
 let N=0,S=0,sumK2=0;
 for(const g of groups){N+=g.length;S+=g.reduce((a,b)=>a+b,0);sumK2+=g.length**2}
 const p=S/N;let ssb=0,ssw=0,dfw=0;
 for(const g of groups){const k=g.length,m=g.reduce((a,b)=>a+b,0)/k;ssb+=k*(m-p)**2;for(const v of g)ssw+=(v-m)**2;dfw+=k-1}
 const MSB=ssb/(n-1),MSW=ssw/dfw,k0=(N-sumK2/N)/(n-1);
 return (MSB-MSW)/(MSB+(k0-1)*MSW)}

// rank tasks by success rate
const byTask=new Map();
for(const r of all){if(!byTask.has(r.task))byTask.set(r.task,[]);byTask.get(r.task).push(r.reward)}
const ranked=[...byTask.entries()].map(([t,v])=>[t,v.reduce((a,b)=>a+b,0)/v.length]).sort((a,b)=>a[1]-b[1]);

console.log('── SENSITIVITY OF ICC TO THE TAIL OF HARD TASKS ──');
console.log('(the hardest tasks are excluded incrementally; ⚠️ not an estimate of the truth, a fragility test)\n');
console.log(' excluded  remaining    ICC     Δ from base   p̄');
const base=icc(buildGroups(all));
for(const cut of [0,2,5,10,15,20,28]){
  const drop=new Set(ranked.slice(0,cut).map(x=>x[0]));
  const kept=all.filter(r=>!drop.has(r.task));
  const g=buildGroups(kept);
  let N=0,S=0;for(const x of g){N+=x.length;S+=x.reduce((a,b)=>a+b,0)}
  const v=icc(g);
  console.log(` ${String(cut).padStart(6)}     ${String(89-cut).padStart(6)}   ${v.toFixed(4)}   ${(v-base>=0?'+':'')}${(v-base).toFixed(4)}     ${(S/N).toFixed(3)}`);
}

// same, but excluding RANDOM tasks — control
console.log('\n── CONTROL: excluding RANDOM tasks (mean over 20 repeats) ──');
console.log(' excluded   ICC(random)     vs ICC(hard)');
for(const cut of [5,10,20,28]){
  let sum=0;
  for(let rep=0;rep<20;rep++){
    const idx=[...Array(89).keys()].sort(()=>Math.random()-0.5).slice(0,cut);
    const drop=new Set(idx.map(i=>ranked[i][0]));
    sum+=icc(buildGroups(all.filter(r=>!drop.has(r.task))));
  }
  const rnd=sum/20;
  const drop=new Set(ranked.slice(0,cut).map(x=>x[0]));
  const hard=icc(buildGroups(all.filter(r=>!drop.has(r.task))));
  console.log(` ${String(cut).padStart(6)}      ${rnd.toFixed(4)}          ${hard.toFixed(4)}  (difference ${(rnd-hard).toFixed(4)})`);
}
console.log('\nIf ICC drops when HARD tasks are removed but not when RANDOM tasks are removed,');
console.log('the metric rests on the tail of hard/defective tasks, not on the general behavior of agents.');
