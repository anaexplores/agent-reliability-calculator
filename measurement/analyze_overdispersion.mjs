// Are an agent's attempts on the same task independent?
// Measures: ICC (intraclass correlation, one-way ANOVA estimator), the observed share of
// "all-or-nothing" groups vs the binomial prediction, and the effective number of
// independent attempts (Kish design effect).
// Corpus: Terminal-Bench 2.0 trajectories (task_name, agent, model, reward in {0,1}),
//   https://huggingface.co/datasets/yoonholee/terminalbench-trajectories (Apache-2.0).
//   The CSV is produced by measurement/fetch_terminalbench.mjs.
// Group = (task, agent, model) with k attempts. Under independence, successes ~ Binomial(k, p).
// Correlation => overdispersion => polarization (more "all failed" / "all passed" groups).
// Usage: node measurement/analyze_overdispersion.mjs tb_trials.csv
// Backs: docs/measurements/01_terminal_bench.md
import fs from 'node:fs';
const FILE = process.argv[2] || 'tb_trials.csv';

// ── read CSV (quoted fields) ───────────────────────────────────────────────
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
console.log(`Attempts loaded: ${rows.length}`);

// ── grouping: (task, agent, model) ─────────────────────────────────────────
const G = new Map();
for (const r of rows) {
  const k = `${r.task}||${r.agent}||${r.model}`;
  if (!G.has(k)) G.set(k, []);
  G.get(k).push(r.reward);
}
const groups = [...G.values()];
console.log(`Groups (task×agent×model): ${groups.length}`);
const sizes = {}; groups.forEach(g => sizes[g.length] = (sizes[g.length]||0)+1);
console.log('Distribution of attempts per group:', JSON.stringify(sizes));

// Keep groups with k>=3 (need ≥3 for a meaningful variance)
const gs = groups.filter(g => g.length >= 3);
const n = gs.length;
console.log(`\nGroups with k>=3: ${n}`);
if (n < 30) { console.log('Too few groups — stopping.'); process.exit(0); }

// ── overall success rate ───────────────────────────────────────────────────
let N = 0, S = 0;
for (const g of gs) { N += g.length; S += g.reduce((a,b)=>a+b,0); }
const pBar = S / N;
console.log(`Total attempts in these groups: ${N}, successes: ${S}, p̄ = ${pBar.toFixed(4)}`);

// ── ICC via ANOVA (one-way model) ──────────────────────────────────────────
// MSB — between-group, MSW — within-group
let ssb = 0, ssw = 0, dfb = n - 1, dfw = 0;
for (const g of gs) {
  const k = g.length, m = g.reduce((a,b)=>a+b,0)/k;
  ssb += k * (m - pBar) ** 2;
  for (const v of g) ssw += (v - m) ** 2;
  dfw += k - 1;
}
const MSB = ssb / dfb, MSW = ssw / dfw;
const kBar = N / n;
const ICC = (MSB - MSW) / (MSB + (kBar - 1) * MSW);
console.log(`\n── Test for violation of independence ──`);
console.log(`MSB=${MSB.toFixed(4)}  MSW=${MSW.toFixed(4)}  k̄=${kBar.toFixed(2)}`);
console.log(`ICC (ρ, intraclass correlation) = ${ICC.toFixed(4)}`);
console.log(ICC > 0 ? '→ ρ>0: attempts are NOT independent (positive correlation).' : '→ ρ≈0: attempts are close to independent.');

// ── polarization: share of "all success"/"all fail" vs binomial prediction ─
let allF = 0, allS = 0, mixed = 0, expAllF = 0, expAllS = 0;
for (const g of gs) {
  const k = g.length, s = g.reduce((a,b)=>a+b,0);
  if (s === 0) allF++; else if (s === k) allS++; else mixed++;
  expAllF += Math.pow(1 - pBar, k);   // expectation under independence
  expAllS += Math.pow(pBar, k);
}
console.log(`\n── Outcome polarization (all-or-nothing) ──`);
console.log(`                 observed   expected under independence`);
console.log(`all attempts ✗:  ${String(allF).padStart(6)}      ${expAllF.toFixed(1).padStart(8)}`);
console.log(`all attempts ✓:  ${String(allS).padStart(6)}      ${expAllS.toFixed(1).padStart(8)}`);
console.log(`mixed:           ${String(mixed).padStart(6)}      ${(n-expAllF-expAllS).toFixed(1).padStart(8)}`);
const obsAON = (allF + allS) / n, expAON = (expAllF + expAllS) / n;
console.log(`all-or-nothing share: observed ${(100*obsAON).toFixed(1)}%  vs expected ${(100*expAON).toFixed(1)}%`);

// ── practical consequence: effective number of independent attempts ────────
// Kish design effect: DEFF = 1 + (k-1)ρ ; n_eff = k / DEFF
const rho = Math.max(0, ICC);
console.log(`\n── Practical consequence (Kish design effect) ──`);
for (const k of [3, 5, 10, 20]) {
  const deff = 1 + (k - 1) * rho;
  console.log(`k=${String(k).padStart(2)} attempts → effectively ${(k/deff).toFixed(2)} independent (DEFF=${deff.toFixed(2)})`);
}

// ── floor: share of tasks where NO attempt passed (b — blind spot) ─────────
console.log(`\n── "Blind spot" estimate (tasks never solved) ──`);
const byTask = new Map();
for (const r of rows) {
  if (!byTask.has(r.task)) byTask.set(r.task, []);
  byTask.get(r.task).push(r.reward);
}
let neverSolved = 0, alwaysSolved = 0;
for (const [, v] of byTask) {
  const s = v.reduce((a,b)=>a+b,0);
  if (s === 0) neverSolved++; else if (s === v.length) alwaysSolved++;
}
console.log(`Total tasks: ${byTask.size}`);
console.log(`Not solved by ANY attempt of any agent: ${neverSolved} (${(100*neverSolved/byTask.size).toFixed(1)}%)`);
console.log(`Solved by ALL attempts of all agents:   ${alwaysSolved} (${(100*alwaysSolved/byTask.size).toFixed(1)}%)`);
console.log('\nThe share of "never solved" tasks is an empirical lower bound on the structural blind spot:');
console.log('such tasks are rescued neither by retries nor by switching the agent.');
