// Minimal test harness: runs the <script> of an index.html inside a vm with a small fake DOM.
// Usage: const {load} = require('./harness'); const page = load('/path/to/index.html');
const fs = require('fs'), vm = require('vm'), path = require('path');

function load(htmlPath) {
  const html = fs.readFileSync(htmlPath || path.join(__dirname, '..', 'index.html'), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const els = {}, attrs = {};
  for (const m of html.matchAll(/<input[^>]*type="range"[^>]*>/g)) {
    const t = m[0], g = n => { const x = t.match(new RegExp(n + '="([^"]*)"')); return x ? x[1] : undefined; };
    attrs[g('id')] = { min: +g('min'), max: +g('max'), step: g('step') === undefined ? 1 : g('step'), value: g('value') };
  }
  const mk = id => {
    const a = attrs[id], listeners = {};
    let v = a ? String(a.value) : '';
    const el = {
      id, textContent: '', innerHTML: '', listeners, files: null,
      addEventListener(t, f) { (listeners[t] = listeners[t] || []).push(f); },
      click() { (listeners.click || []).forEach(f => f({ target: el })); },
      getContext() { return new Proxy({}, { get: (t, k) => k === 'measureText' ? () => ({ width: 0 }) : () => {}, set: () => true }); },
      width: 1400, height: 700,
    };
    Object.defineProperty(el, 'value', {
      get: () => v,
      set: x => { // emulate the browser's range sanitization: clamp, then snap to step (step="any" does not snap)
        if (a) {
          let n = Number(x); if (isNaN(n)) n = 0;
          n = Math.min(a.max, Math.max(a.min, n));
          if (a.step !== 'any') n = a.min + Math.round((n - a.min) / +a.step) * +a.step;
          v = String(n);
        } else v = String(x);
      },
    });
    return el;
  };
  const document = { getElementById: id => els[id] || (els[id] = mk(id)), documentElement: {} };
  class FR {
    constructor() { FR.all.push(this); }
    readAsText(f) { this.file = f; }
    finish() { this.result = this.file.text; this.onload && this.onload(); }
  }
  FR.all = [];
  const ctx = { document, getComputedStyle: () => ({ getPropertyValue: () => '#000' }), FileReader: FR, console };
  vm.createContext(ctx);
  vm.runInContext(script, ctx, { filename: 'index.html<script>' });
  const $ = id => document.getElementById(id);
  return {
    ctx, $, FR, run: s => vm.runInContext(s, ctx),
    // import a CSV text through the file input, the way a user would
    importText(text) {
      const n = FR.all.length;
      $('csv').listeners.change[0]({ target: { files: [{ name: 'f.csv', text }] } });
      FR.all[n].finish();
    },
    out: id => $(id).textContent + '\u0001' + $(id).innerHTML,
    page() { return Object.keys(els).map(i => els[i].textContent + ' ' + els[i].innerHTML).join('\n'); },
  };
}

// CSV with `groups` tasks x `reps` repeats; gen(task, rep) -> outcome string
function csv(groups, reps, gen, head = 'task,model,success', model = 'm') {
  let s = head + '\n';
  for (let t = 0; t < groups; t++) for (let r = 0; r < reps; r++) s += `t${t},${model},${gen(t, r)}\n`;
  return s;
}
// A mixed dataset with real between-task variation
const mixed = (groups = 40, reps = 4) => csv(groups, reps, (t, r) => ((t % 2) ^ (r === 0 && t % 5 === 0 ? 1 : 0)));

module.exports = { load, csv, mixed };
