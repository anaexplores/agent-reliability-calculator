// Toy Monte-Carlo (v2): where the reliability "floor" ACTUALLY comes from.
// Simulates a multi-step agent chain with verify+retry; no external data.
// Hypothesis v1 (correlation through p) did not produce a floor: retries suppress it.
// Hypothesis v2: the floor comes from a SHARED BLIND SPOT of the executor and the verifier.
//   Some errors are "invisible" (the verifier NEVER catches them because it shares the misconception).
//   Then no matter how many retries, a share b of errors gets through.
// Usage: node measurement/sim/blindspot_floor.mjs   (no input; needs Node with webcrypto)
// Backs: no single docs/measurements report; a standalone simulation behind the blind-spot model.
import { webcrypto as c } from 'node:crypto';
const U = () => { const b=new Uint32Array(1); c.getRandomValues(b); return b[0]/2**32; };

// p — per-attempt error; b — share of errors invisible to the verifier (shared blind spot)
// d — recall on VISIBLE errors; f — false positive rate; R — retries
function runStep(p,b,d,f,R){
  for(let a=0;a<=R;a++){
    if (U() < p) {                       // attempt is wrong
      const invisible = U() < b;         // error in the blind spot?
      if (invisible) return false;       // verifier will NEVER catch it → accepted
      if (U() < d && a < R) continue;    // visible error caught → retry
      return false;
    } else {
      if (U() < f && a < R) continue;    // false alarm on a correct attempt
      return true;
    }
  }
  return false;
}
function chain(N,p,b,d,f,R){ for(let i=0;i<N;i++) if(!runStep(p,b,d,f,R)) return false; return true; }
function rate(N,p,b,d,f,R,T=20000){ let ok=0; for(let t=0;t<T;t++) if(chain(N,p,b,d,f,R)) ok++; return ok/T; }
const pct = x => (100*x).toFixed(1).padStart(6)+'%';

console.log('=== A. Blind spot b: no matter how many retries, the floor remains (N=50, p=0.05, d=0.99, f=0.01) ===');
console.log('b=0 → perfect verifier. b>0 → share of errors it never sees.\n');
console.log('  b     R=1      R=3      R=10     R=50     limit (1-p*b)^N');
for(const b of [0, 0.01, 0.05, 0.20]){
  const row=[1,3,10,50].map(R=>pct(rate(50,0.05,b,0.99,0.01,R)));
  const limit = Math.pow(1-0.05*b, 50);
  console.log(`  ${String(b).padEnd(5)} ${row.join('  ')}   ${pct(limit)}`);
}

console.log('\n=== B. THRESHOLD in verifier quality (Λ≈d/f), b=0, N=50, R=5 ===');
console.log('Checking the dichotomy: Λ>1 suppresses error, Λ<=1 does not.\n');
console.log('   d     f     Λ=d/f    P(success N=50)');
for(const [d,f] of [[0.2,0.4],[0.3,0.3],[0.4,0.2],[0.6,0.1],[0.9,0.05],[0.99,0.01]]){
  const s=rate(50,0.05,0,d,f,5);
  console.log(`  ${String(d).padEnd(5)} ${String(f).padEnd(5)} ${(d/f).toFixed(2).padStart(6)}   ${pct(s)}`);
}

console.log('\n=== C. Diversity breaks the blind spot: k INDEPENDENT verifiers ===');
console.log('One verifier\'s blind spot = b. For k different verifiers the shared blind spot ≈ b^k (if independent).');
console.log('N=50, p=0.05, b=0.20, d=0.99, f=0.01, R=5:\n');
for(const k of [1,2,3]){
  const bEff=Math.pow(0.20,k);
  const s=rate(50,0.05,bEff,0.99,0.01,5);
  console.log(`  k=${k} verifiers → effective blind spot b^k=${bEff.toFixed(3)}  P(success)=${pct(s)}`);
}
console.log('\nConclusion: the floor is set NOT by the strength of a single verifier (d,f) but by DIVERSITY (independence) —');
console.log('exactly the principle "the checker must not share the producer\'s blind spot".');
