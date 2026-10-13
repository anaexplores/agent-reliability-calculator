// v2: bootstrap CI for ICC + observed pass@k vs the pass@k predicted under independence + blind spot.
// Corpus: Terminal-Bench 2.0 trajectories (task, agent, model, reward),
//   https://huggingface.co/datasets/yoonholee/terminalbench-trajectories (Apache-2.0).
//   The CSV is produced by measurement/fetch_terminalbench.mjs.
// Usage: node measurement/analyze_v2.mjs tb_trials.csv
// Backs: docs/measurements/01_terminal_bench.md
import fs from 'node:fs';
const FILE = process.argv[2] || 'tb_trials.csv';

function parseCSV(txt) {
  const rows = []; const lines = txt.split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    const L = lines[i]; if (!L) continue;
    const f = []; let cur = '', q = false;
    for (let c = 0; c < L.length; c++) {
      const ch = L[c];
      if (q) { if (ch === '"') { if (L[c+1] === '"') { cur += '"'; c++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === ',') { f.push(cur); cur = ''; }
      else cur += ch;
    }
    f.push(cur);
    if (f.length >= 4) rows.push({ task: f[0], agent: f[1], model: f[2], reward: Number(f[3]) });
  }
  return rows;
}
const rows = parseCSV(fs.readFileSync(FILE, 'utf8')).filter(r => r.reward === 0 || r.reward === 1);

const G = new Map();
for (const r of rows) {
  const k = `${r.task}||${r.agent}||${r.model}`;
  if (!G.has(k)) G.set(k, []);
  G.get(k).push(r.reward);
}
const gs = [...G.values()].filter(g => g.length >= 3);

function iccOf(groups) {
  let N=0,S=0; for(const g of groups){N+=g.length;S+=g.reduce((a,b)=>a+b,0);}
  const p=S/N, n=groups.length;
  let ssb=0,ssw=0,dfw=0;
  for(const g of groups){const k=g.length,m=g.reduce((a,b)=>a+b,0)/k;ssb+=k*(m-p)**2;for(const v of g)ssw+=(v-m)**2;dfw+=k-1;}
  const MSB=ssb/(n-1), MSW=ssw/dfw, kb=N/n;
  return (MSB-MSW)/(MSB+(kb-1)*MSW);
}

const icc = iccOf(gs);
// bootstrap over groups
const B = 400, boots = [];
for (let b = 0; b < B; b++) {
  const samp = new Array(gs.length);
  for (let i = 0; i < gs.length; i++) samp[i] = gs[(Math.random()*gs.length)|0];
  boots.push(iccOf(samp));
}
boots.sort((a,b)=>a-b);
const lo = boots[Math.floor(0.025*B)], hi = boots[Math.floor(0.975*B)];
console.log(`ICC (ρ) = ${icc.toFixed(4)}   95% bootstrap CI: [${lo.toFixed(4)}, ${hi.toFixed(4)}]   (B=${B}, resampling groups)`);

// ── MAIN: observed pass@k vs pass@k under independence ─────────────────────
// Use groups with exactly k=5 (the most common case).
const g5 = [...G.values()].filter(g => g.length === 5);
let n5=0, s5=0; for(const g of g5){n5+=5;s5+=g.reduce((a,b)=>a+b,0);}
const p5 = s5/n5;
let obsAtLeast1 = 0;
for (const g of g5) if (g.some(v=>v===1)) obsAtLeast1++;
const obsRate = obsAtLeast1/g5.length;
const indepRate = 1 - Math.pow(1-p5, 5);
console.log(`\n── pass@5: "at least one of 5 attempts succeeded" ──`);
console.log(`groups with k=5: ${g5.length}, mean per-attempt success p̄ = ${p5.toFixed(4)}`);
console.log(`OBSERVED  pass@5 = ${(100*obsRate).toFixed(1)}%`);
console.log(`PREDICTED under independence 1-(1-p)^5 = ${(100*indepRate).toFixed(1)}%`);
console.log(`GAP = ${(100*(indepRate-obsRate)).toFixed(1)} pp — how much independence OVERSTATES the benefit of retries`);

// what retries are actually "worth": equivalent k_eff under independence
const kEff = Math.log(1-obsRate)/Math.log(1-p5);
console.log(`5 real attempts are equivalent to ${kEff.toFixed(2)} independent attempts`);

// ── blind spot: tasks solved by no one ────────────────────────────────────
const byTask = new Map();
for (const r of rows) { if(!byTask.has(r.task)) byTask.set(r.task,[]); byTask.get(r.task).push(r.reward); }
let never=0, tasks=[...byTask.entries()];
const rates = tasks.map(([t,v])=>[t, v.reduce((a,b)=>a+b,0)/v.length, v.length]);
rates.sort((a,b)=>a[1]-b[1]);
for(const [,r] of rates) if(r===0) never++;
console.log(`\n── Blind spot (tasks NEVER solved by any agent) ──`);
console.log(`tasks: ${tasks.length}, never solved: ${never} (${(100*never/tasks.length).toFixed(1)}%)`);
console.log(`5 hardest tasks (success rate over all attempts of all agents):`);
rates.slice(0,5).forEach(([t,r,n])=>console.log(`   ${(100*r).toFixed(1).padStart(5)}%  n=${String(n).padStart(4)}  ${t}`));
console.log(`5 easiest:`);
rates.slice(-5).reverse().forEach(([t,r,n])=>console.log(`   ${(100*r).toFixed(1).padStart(5)}%  n=${String(n).padStart(4)}  ${t}`));

// ── difficulty distribution: U-shaped? ────────────────────────────────────
const bins = new Array(10).fill(0);
for(const [,r] of rates) bins[Math.min(9, Math.floor(r*10))]++;
console.log(`\n── Distribution of tasks by success rate (U shape = polarization) ──`);
bins.forEach((c,i)=>console.log(`  ${String(i*10).padStart(3)}-${String(i*10+10).padStart(3)}% : ${'█'.repeat(c)} ${c}`));
