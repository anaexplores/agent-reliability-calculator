// Run:  node test/calc.test.js [path/to/index.html] [--only C1,C5]
// Every case prints PASS or FAIL; exit code is the number of failures.
const fs = require('fs'), path = require('path');
const { load, csv, mixed } = require('./harness');

const args = process.argv.slice(2);
const htmlPath = path.resolve(args.find(a => !a.startsWith('--') && !/^C\d/.test(a)) || path.join(__dirname, '..', 'index.html'));
const onlyArg = args.indexOf('--only');
const only = onlyArg >= 0 ? args[onlyArg + 1].split(',') : null;
const dataDir = path.join(__dirname, '..', 'data');
const L = () => load(htmlPath);

let failures = 0;
function test(id, name, fn) {
  if (only && !only.includes(id)) return;
  try { const note = fn(); console.log(`PASS ${id} ${name}${note ? ' :: ' + note : ''}`); }
  catch (e) { failures++; console.log(`FAIL ${id} ${name} :: ${e.message}`); }
}
function ok(cond, msg) { if (!cond) throw new Error(msg); }
const parse = (A, t) => A.run('parseTable')(t);
const one = (A, v) => { const r = parse(A, `task,model,success\nt1,m1,${v}\n`); return r && r.rows && r.rows.length ? r.rows[0].ok : 'rejected'; };
const money = A => A.$('moneyTable').innerHTML + A.$('moneyOut').innerHTML;
const fresh = A => { A.run('drawMoney')(); return money(A); };

// ---------------------------------------------------------------- C1
test('C1', 'strict outcome parsing', () => {
  const A = L();
  const accept = { '1': 1, '0': 0, '1.0': 1, '0.0': 0, 'true': 1, 'false': 0, 'True': 1, 'False': 0, 'yes': 1, 'no': 0,
    'pass': 1, 'passed': 1, 'fail': 0, 'failed': 0, 'success': 1, 'resolved': 1, 'unresolved': 0, 'ok': 1, 'error': 0 };
  const bad = [];
  for (const [v, want] of Object.entries(accept)) if (one(A, v) !== want) bad.push(`${v}->${one(A, v)}`);
  for (const v of ['1garbage', '0.7x', '2', '-1', 'abc', '0.7']) if (one(A, v) !== 'rejected') bad.push(`${v} not rejected (${one(A, v)})`);
  ok(!bad.length, bad.join('; '));
});

// ---------------------------------------------------------------- C2
test('C2', 'group key has no concatenation collision', () => {
  const A = L();
  const m = [{ task: 'a b', cfg: 'c', ok: 1 }, { task: 'a b', cfg: 'c', ok: 1 }, { task: 'a', cfg: 'b c', ok: 0 }, { task: 'a', cfg: 'b c', ok: 0 }];
  for (let i = 0; i < 10; i++) for (let r = 0; r < 3; r++) m.push({ task: 'p' + i, cfg: 'q', ok: i % 2 });
  const res = A.run('iccFrom')(m);
  ok(res.groups === 10, `groups=${res.groups}, expected 10 (the two pairs have 2 repeats each and must not merge into one group of 4)`);
});

// ---------------------------------------------------------------- C3
test('C3', 'RFC 4180 parsing: multiline quoted field, doubled quotes, CRLF, BOM, quoted delimiter', () => {
  const A = L();
  const r = parse(A, 'task,note,model,success\nt1,"line one\nline two",m1,1\nt1,"say ""hi""",m1,0\nt1,"a,b",m1,1\n');
  ok(r.rows && r.rows.length === 3, 'multiline/quoted rows=' + (r.rows && r.rows.length));
  const r2 = parse(A, 'task,model,success\n"t ""x""\n1",m1,1\n"t ""x""\n1",m1,1\n"t ""x""\n1",m1,0\n');
  ok(r2.rows.length === 3 && r2.rows.every(x => x.task === 't "x"\n1'), 'task value: ' + JSON.stringify(r2.rows && r2.rows[0]));
  const base = mixed(40, 4);
  const crlf = parse(A, base.replace(/\n/g, '\r\n')), bom = parse(A, '﻿' + base);
  ok(crlf.rows.length === 160 && bom.rows.length === 160, `CRLF=${crlf.rows && crlf.rows.length} BOM=${bom.rows && bom.rows.length}`);
  ok(bom.cols.task === 'task', 'BOM leaked into header: ' + JSON.stringify(bom.cols.task));
  for (const [name, sep] of [['semicolon', ';'], ['tab', '\t']]) {
    const t = parse(A, base.replace(/,/g, sep));
    ok(t.rows && t.rows.length === 160, `${name}-separated rows=${t.rows ? t.rows.length : t.error}`);
  }
  const q = parse(A, '"task";"model";"success"\n' + 'x;"a;b";1\n'.repeat(3));
  ok(q.rows && q.rows.length === 3 && q.rows[0].cfg === 'a;b', 'quoted separator inside field: ' + JSON.stringify(q.rows));
});

// ---------------------------------------------------------------- C4
test('C4a', 'preset click recomputes the money block', () => {
  const A = L(); A.$('preset').click();
  const before = money(A); A.$('preset4').click();
  ok(money(A) !== before, 'money block unchanged after preset');
  ok(money(A) === fresh(A), 'money block differs from a fresh recompute');
});
test('C4b', 'CSV import recomputes the money block', () => {
  const A = L(); A.$('preset').click(); fresh(A);
  const before = money(A);
  A.importText(csv(40, 4, t => t % 2));       // perfectly consistent groups -> ICC 1
  ok(money(A) !== before, 'money block unchanged after import');
  ok(money(A) === fresh(A), 'money block differs from a fresh recompute');
});
test('C4c', 'stale FileReader result does not overwrite a newer file', () => {
  const A = L(); const ev = A.$('csv').listeners.change[0];
  const fileA = { text: csv(50, 4, (t, r) => (t % 3 === 0 && r === 0) ? 1 : 0) };
  const fileB = { text: csv(50, 4, () => 1).replace(/,1\n/g, (m, i) => (i % 7 === 0 ? ',0\n' : m)) };
  ev({ target: { files: [fileA] } }); ev({ target: { files: [fileB] } });
  const [rA, rB] = A.FR.all;
  rB.finish(); const afterB = A.$('cMu').textContent;
  rA.finish();
  ok(afterB !== '—', 'file B produced no result');
  ok(A.$('cMu').textContent === afterB, `after stale reader: ${A.$('cMu').textContent}, expected ${afterB}`);
});
test('C4d', 'failed import clears the previous numbers', () => {
  const A = L(); A.importText(mixed());
  ok(A.$('cMu').textContent !== '—', 'first import did not produce numbers');
  A.importText('task,model,success\nt1,m,1\nt1,m,0\n');
  const left = ['cN', 'cG', 'cMu', 'cIcc', 'cNaive', 'cReal', 'cEff'].filter(id => A.$(id).textContent !== '—');
  ok(!left.length, 'still showing old values in: ' + left.join(','));
  A.importText(mixed());
  A.importText('nothing,useful\n1,2\n');
  ok(A.$('cMu').textContent === '—', 'old mu left after missing-columns error');
});

// ---------------------------------------------------------------- C5
test('C5a', 'ICC = 1 is not truncated to 0.99', () => {
  const A = L(); const res = A.run('iccFrom')(parse(A, csv(40, 5, t => t % 2)).rows);
  ok(res.icc === 1, 'icc=' + res.icc);
});
test('C5b', 'zero variance: ICC undefined with an explicit message', () => {
  for (const v of [0, 1]) {
    const A = L(); A.importText(csv(40, 5, () => v));
    const res = A.run('iccFrom')(parse(A, csv(40, 5, () => v)).rows);
    ok(res.icc === undefined, `all-${v}: icc=${res.icc}`);
    const txt = A.out('csvOut');
    ok(/undefined/i.test(txt) && !/Correlation is low/.test(txt), `all-${v}: message was: ${A.$('csvOut').innerHTML.slice(0, 100)}`);
    ok(A.$('cIcc').textContent !== '0.000', `all-${v}: ICC cell shows ${A.$('cIcc').textContent}`);
  }
});
test('C5c', 'negative ANOVA estimate: shown raw in the explanation, forecast uses 0', () => {
  const A = L(); A.importText(csv(40, 4, (t, r) => r % 2));      // exactly 2 of 4 pass in every group -> raw = -1/3
  const txt = A.out('csvOut') + A.out('cIcc');
  ok(/-0\.333/.test(txt), 'raw value not shown: ' + A.$('csvOut').innerHTML.slice(0, 120));
  ok(/negative/i.test(txt), 'no explanation of the negative estimate');
  ok(+A.$('ICC').value === 0, 'ICC slider = ' + A.$('ICC').value);
  ok(A.$('cReal').textContent === A.$('cNaive').textContent, 'forecast not equal to the ICC=0 forecast');
});

// ---------------------------------------------------------------- C6
test('C6a', 'no NaN anywhere after importing all-fail or all-pass data', () => {
  for (const v of [0, 1]) {
    const A = L(); A.importText(csv(40, 5, () => v));
    ok(!/NaN|Infinity/.test(A.page()), `all-${v}: NaN/Infinity in page text`);
  }
});
test('C6b', 'mu = 0 gives 0% forecast and no NaN', () => {
  const A = L(); A.$('MU').value = 0; A.$('ICC').value = 50; A.run('draw2')();
  ok(A.$('rReal').textContent === '0.0%' && A.$('rNaive').textContent === '0.0%', `naive=${A.$('rNaive').textContent} real=${A.$('rReal').textContent}`);
  ok(!/NaN|Infinity/.test(A.page()), 'NaN in page text');
});
test('C6c', 'slider clamps do not distort imported values', () => {
  const bad = [];
  for (const [mu, icc] of [[0.02, 0.5], [0.99, 0.5], [0.5, 0.99], [0.3, 0.97], [0.01, 0.9], [0.5, 1], [0.449, 0.595]]) {
    const A = L(); A.run('showICC')({ icc, mu, n: 100, groups: 30, k0: 4 }, null);
    if (A.$('rReal').textContent !== A.$('cReal').textContent) bad.push(`mu=${mu} icc=${icc}: block2=${A.$('rReal').textContent} block3=${A.$('cReal').textContent}`);
  }
  ok(!bad.length, bad.join('; '));
});

// ---------------------------------------------------------------- C8
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// Independent simulation of the page model for ONE erroneous step with k verifiers at correlation rho plus one
// extra verifier. Model (index.html note): the existing group is blind with probability b_eff = b^(1+(k-1)(1-rho));
// the extra verifier is blind with probability b, independently. If both are blind the error is invisible;
// otherwise each of the k+1 verifiers catches it independently with probability r.
function simEscape(b, r, k, rho, trials, rnd) {
  const be = Math.pow(b, 1 + (k - 1) * (1 - rho)); let esc = 0;
  for (let i = 0; i < trials; i++) {
    if (rnd() < be && rnd() < b) { esc++; continue; }
    let caught = false;
    for (let j = 0; j < k + 1; j++) if (rnd() < r) { caught = true; break; }
    if (!caught) esc++;
  }
  return esc / trials;
}
const setBlock1 = (A, o) => { for (const [id, v] of Object.entries(o)) A.$(id).value = v; A.run('draw')(); A.run('drawMoney')(); };
const plusRow = A => { const m = A.$('moneyTable').innerHTML.match(/\+1 independent verifier<\/td>\s*<td[^>]*>([\d.]+)%/); ok(m, 'row "+1 independent verifier" not found'); return +m[1]; };
test('C8a', '"+1 independent verifier" follows b_eff*b and (1-r)^(k+1)', () => {
  const A = L(); const P = { N: 20, P: 90, R: 90, B: 20, K: 3, RHO: 90 };
  setBlock1(A, P);
  const p = .9, r = .9, b = .2, k = 3, rho = .9, N = 20;
  const be = Math.pow(b, 1 + (k - 1) * (1 - rho)) * b;
  const q = be + (1 - be) * Math.pow(1 - r, k + 1);
  const expected = 100 * Math.pow(1 - (1 - p) * q, N);
  const oldWay = 100 * A.run(`chain(${p},${b},${r},${k + 1},0,${N})`);
  const shown = plusRow(A);
  ok(Math.abs(shown - expected) < 0.051, `shown ${shown}%, formula ${expected.toFixed(2)}% (previous method gave ${oldWay.toFixed(2)}%)`);
  return `formula ${expected.toFixed(2)}% vs previous method ${oldWay.toFixed(2)}%`;
});
test('C8b', 'Monte Carlo agrees with the formula within 3 standard errors (2e6 trials)', () => {
  const A = L(); const rnd = mulberry32(12345), T = 2e6, out = [];
  for (const [b, r, k, rho] of [[.2, .9, 3, .9], [.2, .9, 1, 0], [.4, .6, 2, .5], [.1, .8, 5, .3]]) {
    const be = Math.pow(b, 1 + (k - 1) * (1 - rho)) * b;
    const q = be + (1 - be) * Math.pow(1 - r, k + 1);
    const sim = simEscape(b, r, k, rho, T, rnd), se = Math.sqrt(q * (1 - q) / T);
    const page = A.run('eEffPlusIndependent')(0, b, r, k, rho);          // p=0 -> e=1, so this is q itself
    ok(Math.abs(sim - q) <= 3 * se, `MC ${sim.toFixed(5)} vs formula ${q.toFixed(5)} (se ${se.toFixed(5)}) for b=${b} r=${r} k=${k} rho=${rho}`);
    ok(Math.abs(page - q) < 1e-12, `page function ${page} differs from formula ${q}`);
    out.push(`${((sim - q) / se).toFixed(2)}se`);
  }
  return 'deviations: ' + out.join(', ');
});
test('C8c', 'insight text reports the corrected gain', () => {
  const A = L(); setBlock1(A, { N: 20, P: 90, R: 100, B: 20, K: 3, RHO: 50 });
  const p = .9, r = 1, b = .2, k = 3, rho = .5, N = 20;
  const be = Math.pow(b, 1 + (k - 1) * (1 - rho));
  const cur = Math.pow(1 - (1 - p) * (be + (1 - be) * Math.pow(1 - r, k)), N);
  const be2 = be * b, plus = Math.pow(1 - (1 - p) * (be2 + (1 - be2) * Math.pow(1 - r, k + 1)), N);
  const want = `+${((plus - cur) * 100).toFixed(1)} pp`;
  ok(A.$('insight').innerHTML.includes(want), `expected "${want}" in: ${A.$('insight').innerHTML.slice(0, 260)}`);
});
test('C8d', 'row label and model note describe the calculation', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');
  ok(/\+1 independent verifier/.test(html) && /b_eff·b/.test(html), 'model note does not describe b_eff·b');
});
test('C8e', '"+1 independent verifier" reduces to the page model in its limiting cases', () => {
  const A = L(); let worst = 0;
  for (const [p, b, r, N] of [[.9, .2, .9, 20], [.7, .5, .6, 5], [.95, .05, .99, 50]]) {
    for (const rho of [0, .3, .9, 1]) {
      // k = 1: one verifier plus one independent verifier is two independent verifiers
      const d1 = Math.abs(A.run(`chainPlusIndependent(${p},${b},${r},1,${rho},${N})`) - A.run(`chain(${p},${b},${r},2,0,${N})`));
      worst = Math.max(worst, d1);
    }
    for (const k of [1, 2, 3, 5]) {
      // rho = 0: k independent verifiers plus one independent verifier is k+1 independent verifiers
      const d0 = Math.abs(A.run(`chainPlusIndependent(${p},${b},${r},${k},0,${N})`) - A.run(`chain(${p},${b},${r},${k + 1},0,${N})`));
      worst = Math.max(worst, d0);
    }
  }
  ok(worst < 1e-12, `largest difference ${worst}`);
  return `largest difference ${worst.toExponential(1)}`;
});

// ---------------------------------------------------------------- C9 (regression guards on real data; data/ is not tracked)
const dataTest = (id, file, fn) => test(id, file + ' imports', () => {
  const f = path.join(dataDir, file);
  if (!fs.existsSync(f)) return 'skipped (file not present)';
  const A = L(); A.importText(fs.readFileSync(f, 'utf8'));
  ok(!/⚠️/.test(A.$('csvOut').textContent), 'import failed: ' + A.$('csvOut').textContent.slice(0, 120));
  ok(A.$('cMu').textContent !== '—' && A.$('cIcc').textContent !== '—', 'no numbers');
  return fn ? fn(A) : `mu=${A.$('cMu').textContent} icc=${A.$('cIcc').textContent} n=${A.$('cN').textContent}`;
});
dataTest('C9a', 'tb40_trials.csv', A => { const st = A.out('csvStat').replace(/<[^>]+>/g, ' '); ok(/Skipped 18 rows/i.test(st), 'skipped counter: ' + st); return `mu=${A.$('cMu').textContent} icc=${A.$('cIcc').textContent}; ${st.slice(-160)}`; });
dataTest('C9b', 'tb_trials.csv');
dataTest('C9c', 'tb20_q5_trials.csv');
test('C9d', 'substring header matching kept; exact match has priority', () => {
  const A = L();
  const sub = parse(A, 'model_name,instance_id,is_resolved\n' + 'm,i1,1\n'.repeat(3));
  ok(sub.rows && sub.rows.length === 3, 'model_name/instance_id/is_resolved not recognised: ' + JSON.stringify(sub));
  let s = 'task_id_hash,task,model,success\n';
  for (let t = 0; t < 12; t++) for (let r = 0; r < 3; r++) s += `h${t}_${r},t${t},m,${t % 2}\n`;
  const ex = parse(A, s);
  ok(ex.cols.task === 'task', 'picked column ' + ex.cols.task + ' instead of the exact "task"');
  ok(A.run('iccFrom')(ex.rows).groups === 12, 'groups != 12');
});

// ---------------------------------------------------------------- C10
test('C10a', 'skipped rows are counted and reported, with reasons', () => {
  const A = L();
  let s = 'task,model,success\n';
  for (let t = 0; t < 12; t++) for (let r = 0; r < 4; r++) s += `t${t},m,${t % 2}\n`;
  s += 't0,m,\nt1,m,\nt2,m,maybe\nt3,m,2\n';
  A.importText(s);
  const st = A.out('csvStat').replace(/<[^>]+>/g, ' ');
  ok(/skipped 4 rows/i.test(st) && /2 empty/.test(st) && /2 unrecognized/.test(st), 'csvStat: ' + JSON.stringify(st));
  const p = parse(A, s);
  ok(p.skipped && p.skipped.total === 4, 'parseTable().skipped = ' + JSON.stringify(p.skipped));
});
test('C10b', 'timeout/crash/timed_out/errored count as failures, not as missing data', () => {
  const A = L(); const bad = [];
  for (const v of ['timeout', 'crash', 'timed_out', 'errored', 'crashed']) if (one(A, v) !== 0) bad.push(`${v}->${one(A, v)}`);
  ok(!bad.length, bad.join('; '));
});

// ---------------------------------------------------------------- C11
test('C11', 'values from the CSV never reach innerHTML unescaped', () => {
  const evil = '<img src=x onerror=alert(1)>';
  let A = L(); A.importText(`${evil},model\nt1,m\n`);
  ok(!/<img/i.test(A.$('csvOut').innerHTML + A.$('csvStat').innerHTML), 'error path: ' + A.$('csvOut').innerHTML.slice(0, 80));
  A = L(); A.importText(`task,model,${evil}success\n` + Array.from({ length: 120 }, (_, i) => `t${i % 40},m,${i % 2}`).join('\n') + '\n');
  ok(!/<img/i.test(A.$('csvOut').innerHTML + A.$('csvStat').innerHTML), 'columns line: ' + A.$('csvStat').innerHTML.slice(0, 120));
  A = L(); A.importText(`task,model,success\n${evil},m,${evil}\n`.replace(/^(.*\n)/, '$1') + `t1,m,<script>x</script>\n`);
  ok(!/<(img|script)/i.test(A.$('csvOut').innerHTML + A.$('csvStat').innerHTML), 'skip samples: ' + A.$('csvStat').innerHTML.slice(0, 160));
});

// ---------------------------------------------------------------- C12
test('C12', 'Runs counter says what is counted', () => {
  const A = L();
  let s = 'task,model,success\n'; for (let t = 0; t < 30; t++) for (let r = 0; r < 4; r++) s += `t${t},m,${r % 2}\n`;
  for (let t = 0; t < 500; t++) s += `solo${t},m,1\n`;
  A.importText(s);
  const st = A.out('csvStat').replace(/<[^>]+>/g, ' ');
  ok(/620 valid runs/.test(st) && /120 runs in 30 groups/.test(st) && /500 runs in smaller groups are ignored/.test(st), 'csvStat: ' + JSON.stringify(st));
  ok(/Runs used/.test(fs.readFileSync(htmlPath, 'utf8')), 'label not renamed');
});

// ---------------------------------------------------------------- C13
test('C13', 'model note does not claim a paper as its theoretical basis', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');
  ok(!/Theoretical basis/.test(html), '"Theoretical basis" still present');
  ok(/own simplified model/.test(html) && /Related work/.test(html), 'wording missing');
});

// ---------------------------------------------------------------- hygiene
test('H1', 'no Cyrillic in index.html', () => { ok(!/[\u0400-\u04FF]/.test(fs.readFileSync(htmlPath, 'utf8')), 'Cyrillic found'); });
test('H2', 'sanity: demo button and unchanged happy path still work', () => {
  const A = L(); A.$('demo').click();
  ok(A.$('cMu').textContent !== '—' && !/NaN/.test(A.page()), 'demo produced no numbers or NaN');
  A.importText(mixed());
  ok(+A.$('cIcc').textContent > 0.5 && /%$/.test(A.$('cMu').textContent), `icc=${A.$('cIcc').textContent}`);
});

console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);
