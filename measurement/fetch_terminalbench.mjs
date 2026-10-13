// Download Terminal-Bench 2.0 trajectories (yoonholee/terminalbench-trajectories, Apache-2.0),
//   https://huggingface.co/datasets/yoonholee/terminalbench-trajectories
// Keeps ONLY: task_name, agent, model, reward. Steps/tokens are dropped on the fly.
// Source: HF datasets-server. 52,104 rows, pages of 100.
// Produces the tb_trials.csv input for the Terminal-Bench 2.0 analysis scripts
// (analyze_overdispersion, analyze_v2..v6). Failed pages are retried; exits non-zero if incomplete.
// Usage: node measurement/fetch_terminalbench.mjs tb_trials.csv   (optional env THROTTLE_MS, default 1200)
// Backs: docs/measurements/01_terminal_bench.md (and the 04/05 reports built on the same CSV)
import fs from 'node:fs';
const OUT = process.argv[2] || 'tb_trials.csv';
const BASE = 'https://datasets-server.huggingface.co/rows?dataset=yoonholee%2Fterminalbench-trajectories&config=default&split=train';
const PAGE = 100;

const sleep = ms => new Promise(s => setTimeout(s, ms));
const THROTTLE = Number(process.env.THROTTLE_MS ?? 1200); // pause between requests (HF rate limit)

async function getPage(off, tries = 6) {
  for (let t = 1; t <= tries; t++) {
    try {
      const r = await fetch(`${BASE}&offset=${off}&length=${PAGE}`);
      if (r.status === 429) { await sleep(8000 * t); throw new Error('HTTP 429'); }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      return j;
    } catch (e) {
      if (t === tries) { console.error(`FAIL offset=${off}: ${e.message}`); return null; }
      await sleep(2000 * t);
    }
  }
}

const esc = s => `"${String(s ?? '').replace(/"/g, '""')}"`;

// Pages are kept in memory (52k short rows) and written once, in dataset order. Failed pages are
// retried in later passes; the script exits with an error if any row is still missing, so a partial
// file is never mistaken for the full corpus.
const pages = new Map();
const first = await getPage(0);
const total = first?.num_rows_total ?? 0;
if (!total) { console.error('could not read the first page'); process.exit(1); }
console.log(`total rows = ${total}, throttle=${THROTTLE}ms`);
pages.set(0, first.rows);

let todo = [];
for (let off = PAGE; off < total; off += PAGE) todo.push(off);
for (let pass = 1; pass <= 5 && todo.length; pass++) {
  if (pass > 1) { console.log(`retry pass ${pass}: ${todo.length} pages`); await sleep(30000); }
  const failed = [];
  for (const off of todo) {
    await sleep(THROTTLE);
    const j = await getPage(off);
    if (!j) { failed.push(off); continue; }
    pages.set(off, j.rows);
    if ((off / PAGE) % 25 === 0) console.log(`  ${off}/${total} (${(100*off/total).toFixed(0)}%)`);
  }
  todo = failed;
}

const lines = ['task_name,agent,model,reward'];
for (const off of [...pages.keys()].sort((a, b) => a - b))
  for (const r of pages.get(off)) { const x = r.row; lines.push([esc(x.task_name), esc(x.agent), esc(x.model), x.reward].join(',')); }
const written = lines.length - 1;
if (todo.length || written !== total) {
  console.error(`INCOMPLETE: ${written}/${total} rows, ${todo.length} pages still failing; nothing written`);
  process.exit(1);
}
fs.writeFileSync(OUT, lines.join('\n') + '\n');
console.log(`DONE written=${written} -> ${OUT}`);
