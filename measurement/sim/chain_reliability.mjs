// Toy Monte-Carlo: reliability of a multi-step agent chain.
// Checks: (1) naive decay (1-p)^N; (2) verify+retry and the threshold; (3) voting floor from correlation.
// Simulation only; no external data.
// Usage: node measurement/sim/chain_reliability.mjs   (needs Node with global crypto — available in 19+)
// Backs: no single docs/measurements report; a standalone simulation behind the chain-reliability model.
import { webcrypto as c } from 'node:crypto';
const U = () => { const b=new Uint32Array(1); c.getRandomValues(b); return b[0]/2**32; };

// ── Step model with verify+retry ────────────────────────────────────────────
// p     — base error probability of an attempt
// d     — verifier recall (catches a wrong attempt)
// f     — false positive (flags a correct attempt for no reason)
// R     — retry budget per step
// pForStep() — returns p for the given attempt (overridden for correlation)
function runStep(pForStep, d, f, R) {
  for (let attempt = 0; attempt <= R; attempt++) {
    const p = pForStep();
    const wrong = U() < p;
    if (wrong) {
      // verifier catches the error with probability d → retry; otherwise the error is accepted
      if (U() < d && attempt < R) continue;
      return false; // wrong attempt accepted (or retries exhausted)
    } else {
      // correct attempt: verifier may flag it for no reason (false positive) → retry
      if (U() < f && attempt < R) continue;
      return true; // correct attempt accepted
    }
  }
  return false;
}

// Success of a chain of length N. corr: null=independent; {pHi,pLo,piHard}=hidden "difficulty" of the chain
function runChain(N, p, d, f, R, corr) {
  let hard = false, pHi=0, pLo=0;
  if (corr) { hard = U() < corr.piHard; pHi=corr.pHi; pLo=corr.pLo; }
  const pForStep = corr ? () => (hard ? pHi : pLo) : () => p;
  for (let i=0;i<N;i++) if (!runStep(pForStep, d, f, R)) return false;
  return true;
}

function successRate(N,p,d,f,R,corr,trials=20000){
  let ok=0; for(let t=0;t<trials;t++) if(runChain(N,p,d,f,R,corr)) ok++;
  return ok/trials;
}

const pct = x => (100*x).toFixed(1).padStart(5)+'%';
console.log('=== (1) Naive decay, NO verification (d=0,f=0,R=0) ===');
console.log('p=0.05 (step correct 95% of the time). Expect (1-p)^N.');
for(const N of [1,5,10,20,50]){
  const sim=successRate(N,0.05,0,0,0,null);
  const cf=Math.pow(0.95,N);
  console.log(`N=${String(N).padStart(3)}  sim=${pct(sim)}  closed-form (0.95^N)=${pct(cf)}`);
}

console.log('\n=== (2) verify+retry with INDEPENDENT errors (p=0.05, R=3) ===');
console.log('Λ≈d/f. Does correction rescue a chain of N=50?');
for(const [d,f] of [[0,0],[0.5,0.3],[0.8,0.2],[0.95,0.05],[0.99,0.01]]){
  const s=successRate(50,0.05,d,f,3,null);
  const Lam = f>0 ? (d/f).toFixed(1) : '∞';
  console.log(`d=${d} f=${f} (Λ=${Lam})  →  P(success, N=50)=${pct(s)}`);
}

console.log('\n=== (3) VOTING FLOOR: correlated error (hidden chain difficulty) ===');
console.log('Same mean p (~0.05), but 10% of chains are "hard" (p=0.35), 90% easy (p=~0.017).');
console.log('Strong verifier d=0.99,f=0.01,R=5. Retries in a hard chain are ALSO more often wrong.');
const corr={piHard:0.10, pHi:0.35, pLo:0.0167}; // mean ≈ 0.1*0.35+0.9*0.0167 ≈ 0.05
for(const N of [1,5,10,20,50]){
  const sIndep=successRate(N,0.05,0.99,0.01,5,null);
  const sCorr =successRate(N,0.05,0.99,0.01,5,corr);
  console.log(`N=${String(N).padStart(3)}  independent=${pct(sIndep)}   correlated=${pct(sCorr)}`);
}
console.log('\nIf the correlated curve hits a "floor" and is not pushed to 100%, that is the voting floor:');
console.log('hard chains are not rescued by retries, because the retries share the same difficulty.');
