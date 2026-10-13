// Second independent ICC measurement — SWE-bench Lite samples corpus.
// Measures: ICC of repeated attempts on the same task (with a task-level cluster bootstrap CI),
// naive vs correlated pass@k, a check of the model against observed resampling, and the
// distribution of tasks by success rate.
// Source: ScalingIntelligence/swe-bench-lite-samples (Brown et al., "Large Language Monkeys", arXiv:2407.21787),
//   https://github.com/ScalingIntelligence/swe-bench-lite-samples (file summary.json)
// 300 tasks × ~250 runs of a single configuration (moatless-tools + DeepSeek-Coder-V2-Instruct).
// Ground truth: execution-based `resolved` (real test runs).
// Cleaner design than the Terminal-Bench 2.0 measurement: k=250 instead of k=5, one fixed configuration.
// Usage: node measurement/analyze_swebench_lite.mjs summary.json
// Backs: docs/measurements/02_swe_bench_lite.md
import fs from 'node:fs';
const FILE = process.argv[2];
const j = JSON.parse(fs.readFileSync(FILE, 'utf8'));

function collect(groupKey){
  const out=[];
  for(const [task,samples] of Object.entries(j[groupKey]||{})){
    const v=[];
    for(const k of Object.keys(samples)){
      const s=samples[k];
      if(s && typeof s.resolved==='boolean') v.push(s.resolved?1:0);
    }
    if(v.length>=3) out.push({task,v});
  }
  return out;
}
const clean = collect('instances_without_flaky_tests');
const flaky = collect('instances_with_flaky_tests');
const all   = [...clean,...flaky];

function icc(groups){
  const n=groups.length; if(n<10) return null;
  let N=0,S=0,sumK2=0;
  for(const g of groups){N+=g.v.length;S+=g.v.reduce((a,b)=>a+b,0);sumK2+=g.v.length**2}
  const mu=S/N;
  let ssb=0,ssw=0,dfw=0;
  for(const g of groups){const k=g.v.length,m=g.v.reduce((a,b)=>a+b,0)/k;
    ssb+=k*(m-mu)**2; for(const x of g.v) ssw+=(x-m)**2; dfw+=k-1}
  const MSB=ssb/(n-1), MSW=ssw/dfw, k0=(N-sumK2/N)/(n-1);
  return {icc:(MSB-MSW)/(MSB+(k0-1)*MSW), mu, N, n, k0};
}
// cluster bootstrap BY TASK
function ci(groups,B=400){
  const out=[];
  for(let b=0;b<B;b++){
    const s=new Array(groups.length);
    for(let i=0;i<groups.length;i++) s[i]=groups[(Math.random()*groups.length)|0];
    const r=icc(s); if(r) out.push(r.icc);
  }
  out.sort((a,b)=>a-b);
  return [out[Math.floor(.025*out.length)], out[Math.floor(.975*out.length)]];
}
const prodK=(x,k)=>{let r=1;for(let j2=0;j2<k;j2++)r*=(x+j2);return r};
const passAtK=(mu,rho,k)=>{
  if(k<=1)return mu;
  if(rho<=1e-6)return 1-Math.pow(1-mu,k);
  if(rho>=1-1e-6)return mu;
  const s=(1-rho)/rho,b=(1-mu)*s;
  return 1-prodK(b,k)/prodK(s,k);
};
const kEff=(mu,rho,k)=>{const o=passAtK(mu,rho,k);
  return (mu>=1-1e-9||o>=1-1e-12)?k:Math.log(1-o)/Math.log(1-mu)};
const pct=x=>(100*x).toFixed(1)+'%';

console.log('╔══ SECOND INDEPENDENT ICC MEASUREMENT ══╗');
console.log('corpus: SWE-bench Lite samples (Large Language Monkeys, arXiv:2407.21787)');
console.log('design: one configuration, ~250 repeats per task, execution-based ground truth\n');

for(const [name,G] of [['all tasks',all],['without flaky tests',clean],['flaky only',flaky]]){
  const r=icc(G); if(!r){console.log(`${name}: too little data`);continue}
  const [lo,hi]=name==='all tasks'?ci(G):[null,null];
  console.log(`── ${name} ──`);
  console.log(`  tasks: ${r.n}, runs: ${r.N}, repeats per task: ${(r.N/r.n).toFixed(0)}`);
  console.log(`  μ (success rate) = ${pct(r.mu)}`);
  console.log(`  ICC = ${r.icc.toFixed(4)}${lo!==null?`  95% CI (cluster bootstrap by task): [${lo.toFixed(4)}, ${hi.toFixed(4)}]`:''}`);
  console.log();
}

const R=icc(clean);
console.log('══ COMPARISON OF THE TWO CORPORA ══');
console.log('                        Terminal-Bench 2.0   SWE-bench Lite');
console.log(`  domain                terminal tasks       code repair`);
console.log(`  configurations        109                  1`);
console.log(`  repeats per group     5                    ~250`);
console.log(`  runs                  52,104               ${R.N}`);
console.log(`  μ                     39.7%                ${pct(R.mu)}`);
console.log(`  ICC                   0.666                ${R.icc.toFixed(3)}`);

console.log('\n══ WHAT THIS MEANS FOR RETRIES ══');
console.log(' k |  naive | actual  | overstatement | eff.attempts');
for(const k of [2,3,5,10,20,50]){
  const nv=passAtK(R.mu,0,k), rl=passAtK(R.mu,R.icc,k);
  console.log(` ${String(k).padStart(2)} | ${pct(nv).padStart(6)} | ${pct(rl).padStart(7)} | ${(100*(nv-rl)).toFixed(1).padStart(6)} pp | ${kEff(R.mu,R.icc,k).toFixed(2)}`);
}

// check the prediction against observation at real k
console.log('\n══ MODEL VS OBSERVATION (bootstrap over runs within a task) ══');
console.log('draw k random runs out of a task\'s 250, record the share of tasks with ≥1 success');
for(const k of [2,5,10,20]){
  let hit=0,tot=0;
  for(const g of clean){
    for(let rep=0;rep<40;rep++){
      let any=false;
      for(let i=0;i<k;i++) if(g.v[(Math.random()*g.v.length)|0]===1){any=true;break}
      if(any)hit++; tot++;
    }
  }
  const obs=hit/tot, pred=passAtK(R.mu,R.icc,k), naive=passAtK(R.mu,0,k);
  console.log(`  k=${String(k).padStart(2)}: observed ${pct(obs)} | model ${pct(pred)} | naive ${pct(naive)}  → model error ${(100*Math.abs(obs-pred)).toFixed(1)} pp, naive error ${(100*Math.abs(obs-naive)).toFixed(1)} pp`);
}

// task distribution
console.log('\n══ DISTRIBUTION OF TASKS BY SUCCESS RATE ══');
const bins=new Array(10).fill(0);
for(const g of clean){const r=g.v.reduce((a,b)=>a+b,0)/g.v.length; bins[Math.min(9,Math.floor(r*10))]++}
bins.forEach((c,i)=>console.log(`  ${String(i*10).padStart(3)}-${String(i*10+10).padStart(3)}% : ${'█'.repeat(Math.round(c/2))} ${c}`));
let never=0,always=0;
for(const g of clean){const s=g.v.reduce((a,b)=>a+b,0); if(s===0)never++; else if(s===g.v.length)always++}
console.log(`  tasks NEVER solved:  ${never}/${clean.length} (${(100*never/clean.length).toFixed(0)}%)`);
console.log(`  tasks ALWAYS solved: ${always}/${clean.length}`);
