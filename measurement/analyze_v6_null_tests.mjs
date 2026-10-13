// v6 — null tests of the "diversification ≫ resampling" result.
// An independent adversarial review suggested that this result could be pure winner's curse
// (a maximum over 109 configurations × Binom(5,p)) and suggested three tests:
//   T1 — permutation null (shuffle outcomes across configurations within a task)
//   T2 — SPLIT-HALF prediction (the main one: pick a config on attempts 1-2, check it on 3-5)
//   T3 — ICC without degenerate clusters
// Corpus: Terminal-Bench 2.0 trajectories, https://huggingface.co/datasets/yoonholee/terminalbench-trajectories
//   (CSV produced by measurement/fetch_terminalbench.mjs).
// Usage: node measurement/analyze_v6_null_tests.mjs tb_trials.csv
// Backs: docs/measurements/04_null_tests.md
import fs from 'node:fs';
const FILE = process.argv[2] || 'tb_trials.csv';
function parseCSV(txt){const rows=[];const lines=txt.split(/\r?\n/);
 for(let i=1;i<lines.length;i++){const L=lines[i];if(!L)continue;const f=[];let cur='',q=false;
  for(let c=0;c<L.length;c++){const ch=L[c];
   if(q){if(ch==='"'){if(L[c+1]==='"'){cur+='"';c++}else q=false}else cur+=ch}
   else if(ch==='"')q=true; else if(ch===','){f.push(cur);cur=''} else cur+=ch}
  f.push(cur); if(f.length>=4)rows.push({task:f[0],cfg:f[1]+'||'+f[2],reward:Number(f[3])})}
 return rows}
const rows=parseCSV(fs.readFileSync(FILE,'utf8')).filter(r=>r.reward===0||r.reward===1);

// structure: task -> cfg -> [outcomes in order of appearance]
const T=new Map();
for(const r of rows){
  if(!T.has(r.task))T.set(r.task,new Map());
  const c=T.get(r.task);
  if(!c.has(r.cfg))c.set(r.cfg,[]);
  c.get(r.cfg).push(r.reward);
}

// ── T1: permutation null ───────────────────────────────────────────────────
// Within a task, shuffle ALL outcomes across configurations (keeping the number of runs
// per configuration and the task's total successes) → "the configuration does not matter".
function statsOf(taskMap){
  let sumMean=0,sumBest=0,n=0,hardSolved=0,hardN=0;
  for(const [,cfgs] of taskMap){
    let all=[],best=0;
    for(const [,v] of cfgs){all.push(...v);const r=v.reduce((a,b)=>a+b,0)/v.length;if(r>best)best=r}
    const overall=all.reduce((a,b)=>a+b,0)/all.length;
    sumMean+=overall;sumBest+=best;n++;
    if(overall<0.10){hardN++;let any=false;for(const [,v] of cfgs)if(v.some(x=>x===1))any=true;if(any)hardSolved++}
  }
  return {mean:sumMean/n,best:sumBest/n,hardSolved,hardN};
}
const obs=statsOf(T);
function permuteOnce(){
  const P=new Map();
  for(const [task,cfgs] of T){
    const pool=[];const sizes=[];
    for(const [cfg,v] of cfgs){pool.push(...v);sizes.push([cfg,v.length])}
    for(let i=pool.length-1;i>0;i--){const j=(Math.random()*(i+1))|0;[pool[i],pool[j]]=[pool[j],pool[i]]}
    const m=new Map();let k=0;
    for(const [cfg,sz] of sizes){m.set(cfg,pool.slice(k,k+sz));k+=sz}
    P.set(task,m);
  }
  return statsOf(P);
}
console.log('══ T1: PERMUTATION NULL (the configuration does not matter) ══');
const B=200,nullBest=[],nullHard=[];
for(let b=0;b<B;b++){const s=permuteOnce();nullBest.push(s.best);nullHard.push(s.hardSolved)}
nullBest.sort((a,b)=>a-b);nullHard.sort((a,b)=>a-b);
const pct=x=>(100*x).toFixed(1)+'%';
console.log(`observed: average configuration ${pct(obs.mean)}, BEST ${pct(obs.best)}`);
console.log(`null (B=${B}): best ${pct(nullBest[Math.floor(0.5*B)])} [${pct(nullBest[Math.floor(0.025*B)])}, ${pct(nullBest[Math.floor(0.975*B)])}]`);
console.log(`observed: hard tasks solved by someone ${obs.hardSolved}/${obs.hardN}`);
console.log(`null: ${nullHard[Math.floor(0.5*B)]}/${obs.hardN} [${nullHard[Math.floor(0.025*B)]}, ${nullHard[Math.floor(0.975*B)]}]`);
const outside = obs.best > nullBest[Math.floor(0.975*B)];
console.log(`VERDICT T1: ${outside?'observation ABOVE the null range → effect present':'observation WITHIN the null range → effect NOT shown'}`);

// ── T2: SPLIT-HALF (main test — does the configuration choice transfer?) ───
console.log('\n══ T2: SPLIT-HALF — does the "best configuration" transfer? ══');
console.log('pick a config on attempts 1-2, check it on attempts 3-5\n');
let selHit=0,selN=0, margSum=0, randSum=0, cnt=0;
for(const [task,cfgs] of T){
  const usable=[...cfgs.entries()].filter(([,v])=>v.length>=5);
  if(usable.length<10) continue;
  // selection on the first 2 attempts
  let bestCfg=null,bestScore=-1;
  for(const [cfg,v] of usable){const s=(v[0]+v[1])/2; if(s>bestScore){bestScore=s;bestCfg=cfg}}
  // tie-break: if many have 2/2, pick a random one among them (otherwise picking the first in order = bias)
  const ties=usable.filter(([,v])=>(v[0]+v[1])/2===bestScore);
  const chosen=ties[(Math.random()*ties.length)|0];
  const holdout=chosen[1].slice(2,5);
  const selRate=holdout.reduce((a,b)=>a+b,0)/holdout.length;
  // marginal mean over all configs on attempts 3-5
  let m=0,mn=0;for(const [,v] of usable){const h=v.slice(2,5);m+=h.reduce((a,b)=>a+b,0);mn+=h.length}
  const margRate=m/mn;
  // random configuration
  const rnd=usable[(Math.random()*usable.length)|0][1].slice(2,5);
  const rndRate=rnd.reduce((a,b)=>a+b,0)/rnd.length;
  selSum(selRate,margRate,rndRate);
  function selSum(a,b,c){margSum+=b;randSum+=c;selHit+=a;cnt++}
}
console.log(`tasks in test: ${cnt}`);
console.log(`config selected on attempts 1-2, success on 3-5:      ${pct(selHit/cnt)}`);
console.log(`marginal mean of all configurations on 3-5:           ${pct(margSum/cnt)}`);
console.log(`random configuration on 3-5:                          ${pct(randSum/cnt)}`);
const lift=(selHit/cnt)-(margSum/cnt);
console.log(`\nSELECTION TRANSFER = ${(100*lift).toFixed(1)} pp above the marginal mean`);
console.log(`VERDICT T2: ${lift>0.05?'the configuration choice TRANSFERS (effect is real)':'the choice does NOT transfer or is weak → "configuration selection" does not work'}`);

// ── T3: ICC without degenerate clusters ───────────────────────────────────
console.log('\n══ T3: ICC without degenerate clusters ══');
function iccOf(groups){
  const n=groups.length; if(n<10)return NaN;
  let N=0,S=0,sumK2=0;
  for(const g of groups){N+=g.length;S+=g.reduce((a,b)=>a+b,0);sumK2+=g.length**2}
  const p=S/N;let ssb=0,ssw=0,dfw=0;
  for(const g of groups){const k=g.length,m=g.reduce((a,b)=>a+b,0)/k;ssb+=k*(m-p)**2;for(const v of g)ssw+=(v-m)**2;dfw+=k-1}
  const MSB=ssb/(n-1),MSW=ssw/dfw,k0=(N-sumK2/N)/(n-1);
  return (MSB-MSW)/(MSB+(k0-1)*MSW);
}
const allG=[],midG=[];
for(const [task,cfgs] of T){
  let all=[];for(const [,v] of cfgs)all.push(...v);
  const rate=all.reduce((a,b)=>a+b,0)/all.length;
  for(const [,v] of cfgs){ if(v.length>=3){ allG.push(v); if(rate>0.05&&rate<0.95) midG.push(v); } }
}
console.log(`ICC all tasks:                        ${iccOf(allG).toFixed(4)}  (cells ${allG.length})`);
console.log(`ICC only tasks with 5%<success<95%:   ${iccOf(midG).toFixed(4)}  (cells ${midG.length})`);
const d=iccOf(allG)-iccOf(midG);
console.log(`drop: ${d.toFixed(4)}`);
console.log(`VERDICT T3: ${iccOf(midG)<0.45?'ICC falls below 0.45 → the claim "5 attempts = 1.4 independent" needs to be rewritten':'ICC holds → the claim is robust'}`);
