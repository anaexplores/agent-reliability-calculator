// SELF-CHECK of the method that recovers ICC from pass^k (used for τ-bench).
// Measures: (1) whether the inverse formula recovers a known ICC on simulated beta-binomial data;
// (2) whether the pass^3/pass^4 prediction beats simple one-parameter alternatives
// (geometric, linear, independence); (3) sensitivity to rounding of published percentages;
// (4) how many measurements pass the filters.
// Input: tau2_icc.json in the current directory, written by measurement/analyze_tau2bench.mjs.
// Usage: node measurement/selfcheck_pass_k.mjs   (reads tau2_icc.json)
// Backs: docs/measurements/03_tau_bench.md (self-check section)
const comb=(n,k)=>{if(k>n||k<0)return 0;let r=1;for(let i=0;i<k;i++)r=r*(n-i)/(i+1);return r};
// exact τ-bench formula
const passHatK=(nTrials,succ,k)=>comb(succ,k)/comb(nTrials,k);
// our inverse formula
const iccFromPass=(p1,p2)=>{const r=p2/p1,s=(r-1)/(p1-r);return{s,icc:1/(s+1)}};
const predictPass=(mu,icc,k)=>{const s=(1-icc)/icc,a=mu*s;let n=1,d=1;
  for(let j=0;j<k;j++){n*=(a+j);d*=(s+j)}return n/d};
// Beta sampler via Gamma (Marsaglia-Tsang)
function gammaS(a){ if(a<1){return gammaS(a+1)*Math.pow(Math.random(),1/a)}
  const d=a-1/3,c=1/Math.sqrt(9*d);
  for(;;){let x,v;do{let u1=Math.random(),u2=Math.random();
      x=Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2);v=1+c*x}while(v<=0);
    v=v*v*v;const u=Math.random();
    if(u<1-0.0331*x*x*x*x)return d*v;
    if(Math.log(u)<0.5*x*x+d*(1-v+Math.log(v)))return d*v}}
const betaS=(a,b)=>{const g1=gammaS(a),g2=gammaS(b);return g1/(g1+g2)};

console.log('══ TEST 1: does the formula recover a GIVEN ICC? ══');
console.log('generate tasks with a known ICC, compute pass^k with the τ-bench formula, recover ICC\n');
console.log(' given ICC  | μ     | recovered     | error  | n tasks');
for(const trueIcc of [0.2,0.35,0.5,0.66,0.8]){
  for(const mu of [0.45]){
    const s=(1-trueIcc)/trueIcc, a=mu*s, b=(1-mu)*s;
    const NT=4, TASKS=20000;   // as in τ-bench: 4 trials
    let sum1=0,sum2=0;
    for(let t=0;t<TASKS;t++){
      const p=betaS(a,b);
      let succ=0; for(let i=0;i<NT;i++) if(Math.random()<p) succ++;
      sum1+=passHatK(NT,succ,1); sum2+=passHatK(NT,succ,2);
    }
    const p1=sum1/TASKS, p2=sum2/TASKS;
    const rec=iccFromPass(p1,p2);
    console.log(` ${trueIcc.toFixed(2).padStart(10)} | ${p1.toFixed(3)} | ${rec.icc.toFixed(4).padStart(13)} | ${Math.abs(rec.icc-trueIcc).toFixed(4)} | ${TASKS}`);
  }
}

console.log('\n══ TEST 2: is the pass^3/pass^4 prediction NON-TRIVIAL? ══');
console.log('compare our model with two alternative one-parameter models:\n');
const rows=JSON.parse((await import('node:fs')).readFileSync('tau2_icc.json','utf8'));
const withP3=rows.filter(r=>r.p3!=null&&r.p4!=null);
let eBeta3=[],eBeta4=[],eGeo3=[],eGeo4=[],eLin3=[],eLin4=[],eInd3=[],eInd4=[];
for(const r of withP3){
  // A) our beta-binomial (fitted on p1,p2)
  eBeta3.push(Math.abs(predictPass(r.p1,r.icc,3)-r.p3));
  eBeta4.push(Math.abs(predictPass(r.p1,r.icc,4)-r.p4));
  // B) geometric: pass^k = p1 * c^(k-1), c = p2/p1
  const c=r.p2/r.p1;
  eGeo3.push(Math.abs(r.p1*c*c-r.p3)); eGeo4.push(Math.abs(r.p1*c*c*c-r.p4));
  // C) linear extrapolation from two points
  const d=r.p2-r.p1;
  eLin3.push(Math.abs(r.p1+2*d-r.p3)); eLin4.push(Math.abs(r.p1+3*d-r.p4));
  // D) independence
  eInd3.push(Math.abs(Math.pow(r.p1,3)-r.p3)); eInd4.push(Math.abs(Math.pow(r.p1,4)-r.p4));
}
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
console.log(` n = ${withP3.length} measurements`);
console.log(' model                      | error pass^3  | error pass^4');
console.log(` ours (beta-binomial)       | ${(100*mean(eBeta3)).toFixed(2).padStart(9)} pp | ${(100*mean(eBeta4)).toFixed(2).padStart(9)} pp`);
console.log(` geometric (control)        | ${(100*mean(eGeo3)).toFixed(2).padStart(9)} pp | ${(100*mean(eGeo4)).toFixed(2).padStart(9)} pp`);
console.log(` linear (control)           | ${(100*mean(eLin3)).toFixed(2).padStart(9)} pp | ${(100*mean(eLin4)).toFixed(2).padStart(9)} pp`);
console.log(` independence               | ${(100*mean(eInd3)).toFixed(2).padStart(9)} pp | ${(100*mean(eInd4)).toFixed(2).padStart(9)} pp`);

console.log('\n══ TEST 3: sensitivity to rounding of published percentages ══');
const g={p1:.4794,p2:.3952};
console.log('add ±0.05 pp noise to pass^1 and pass^2 (rounding level), look at the spread of ICC:');
const iccs=[];
for(let i=0;i<2000;i++){
  const n1=g.p1+(Math.random()-.5)*0.001, n2=g.p2+(Math.random()-.5)*0.001;
  const v=iccFromPass(n1,n2).icc; if(v>0&&v<1) iccs.push(v);
}
iccs.sort((a,b)=>a-b);
console.log(`  base ICC=${iccFromPass(g.p1,g.p2).icc.toFixed(4)}, with noise: [${iccs[Math.floor(.025*iccs.length)].toFixed(4)}, ${iccs[Math.floor(.975*iccs.length)].toFixed(4)}]`);

console.log('\n══ TEST 4: how many measurements were dropped by filters (is it selective?) ══');
console.log(`  passed filters: ${rows.length}`);
console.log(`  of these with pass^3 and pass^4 (full check): ${withP3.length}`);
