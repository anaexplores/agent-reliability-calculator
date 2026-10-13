# RESEARCH BRIEF — Agent Chain Reliability Calculator

> Date: 2026-08-05
> Basis: our own measurements in `docs/measurements/` [code✓]

Markers: [code✓] computed by our code; [primary] primary source; [secondary] secondary source; [hyp] hypothesis; [?] unverified.

## 1. Question (falsifiable)
Can we show interactively that **the reliability ceiling of an agent chain is set by the "blind spot" (a shared error that all verifiers have in common), not by the strength of any single verifier**, so that users see it for themselves by turning the knobs?

Testable consequence: with a blind spot b>0, raising verifier recall to 1.0 does **not** lift reliability above the ceiling (1−e·b_eff)^N; increasing verifier **diversity** does.

## 2. Why it matters
An engineer's default intuition is "add more checks". Our result [code✓] says this hits a ceiling, and what helps is **decorrelation**. The tool turns this from a paper into something you can feel.

## 3. Prior tools — ✅ checked (2026-08-05)
- 🔴 Already covered: the "p^N + retries" layer — [LatentEval](https://latenteval.ai/tools/eval/cascade-reliability-calculator), [Tallyfy](https://tallyfy.com/ai-agent-reliability-math/). **We do not build another one of these.**
- 🟢 Not covered: knobs for "verifier quality (recall/FPR)", "error correlation", "verifier diversity". We found them nowhere (vendors, academia, reliability tools).
- Why the gap exists: the theory came out in July 2026 ([arXiv:2607.13918](https://arxiv.org/abs/2607.13918)); engineers have no way to get ρ from their logs (**we have ICC≈0.67 on 52,104 Terminal-Bench 2.0 runs**).

## 4. Model (ours, simple and honest)
Per step: an error occurs with probability `e = 1−p`. A fraction `b` of errors is **structurally invisible** to the verifier (the blind spot); the remaining `1−b` it catches with probability `r` (recall).

With `k` verifiers with correlation `ρ`:
```
b_eff = b^(1 + (k−1)(1−ρ))        # ρ=0 → b^k (independent); ρ=1 → b (one blind spot)
e_eff = e · [ b_eff + (1−b_eff)·(1−r)^k ]
P(chain success) = (1 − e_eff)^N
```
**Ceiling:** even at `r=1`, `e_eff = e·b_eff > 0` remains ⇒ `P ≤ (1−e·b_eff)^N`. This is the visual shock.
Also: **k†** — the verifier count after which the gain is < ε (more checks stop paying off).

## 5. Success criterion (spike)
- The user turns recall→1.0 and **sees the asymptote**; turns diversity up (ρ↓ or k↑) and the ceiling rises.
- Calculations checked with a Node smoke test [code✓].
- The model is clearly labeled as a simplification, with a link to the original source of the theory.

## 6. Implementation approach
- Vanilla JS + canvas/SVG, no backend.
- The "sliders → instant curve" pattern from the explorable explanations genre (TensorFlow Playground).

## 7. Differentiators
1. A "blind spot" knob + a horizontal asymptote — **nobody else has this**.
2. k† crossover — a closed form exists in the theory, but nobody has implemented it.
3. Our ICC curve next to the naive retry curve of existing calculators (those are systematically biased toward optimism).
4. A bridge to reliability engineering: beta-factor / common-cause failures (IEC 61508, NASA).

## 8. Spike ready [code✓] — `index.html`
Checked with a Node smoke test **before** the UI was built; then the UI formulas were checked against the spec:
| Scenario (N=20, p=0.9, b=0.2) | Success |
|---|---|
| no check | 12.2% |
| check with recall=0.9 | 56.7% |
| **perfect** check (recall=1.0) | **66.8% ← ceiling** |
| 5 checkers, **fully correlated** (ρ=1) | **66.8% — unchanged** |
| 5 checkers, **independent** (ρ=0) | **99.9%** |

Edge cases of `b_eff` are correct (ρ=0→b^k, ρ=1→b, k=1→b); values are in [0,1]; monotonic in recall — 2000 random checks passed.
**k†** works: at ρ=0, 5 checkers are enough; at ρ=0.9, more than 12 are needed (clones barely help).

## 9. Block 2 — correlated retries [code✓]
Model: **beta-binomial**. With ICC ρ: `s=(1−ρ)/ρ`, `α=μs`, `β=(1−μ)s`, `pass@k = 1 − ∏(β+j)/∏(s+j)`.

**Check against our measurement** (Terminal-Bench 2.0, 52,104 runs, groups with k=5: μ=0.4405, ICC=0.6607; recomputed on the corrected download, see `docs/DATA_PROVENANCE.md`):
| | |
|---|---|
| model predicts pass@5 | **61.5%** |
| **observed in the data** | **60.8%** ← match |
| naive model (independence) | 94.5% |

**The gap grows with the number of attempts** (μ=0.45, ICC=0.67):
| k | naive | actual | overestimate | effective attempts |
|---|---|---|---|---|
| 2 | 69.8% | 53.2% | 16.6 pp | 1.27 |
| 5 | 95.0% | 62.0% | **33.0 pp** | 1.62 |
| 20 | 100.0% | 72.2% | 27.8 pp | **2.14** |

**Twenty retries = 2.14 independent attempts.** This directly counters the retry knob in existing calculators (LatentEval, Tallyfy), which treats retries as independent and is therefore systematically optimistic by tens of points.
Edge cases checked: ρ=0 → `1−(1−μ)^k`; ρ=1 → μ; k=1 → μ; 3000 random runs within the bounds [μ,1].

## 10. Block 3 — "compute your own ICC" [code✓]
Upload a CSV/TSV → computed **in the browser**; the file is not sent anywhere. Columns are auto-detected (`task_name/task_id/instance_id/problem`, `agent/model/config/method`, `reward/success/passed/resolved/score`); outcomes are normalized (`1/0`, `true/false`, `pass/fail`, fractional score ≥0.5). The result is fed into Block 2.

**Verification [code✓]:** the same logic was run on our real file (52,104 runs; 51,741 of them in groups with k≥3; re-checked in the browser on the corrected download):
| | Block 3 (browser logic) | Independent calculation (`measurement/analyze_v4_benchmark_defects.mjs`) |
|---|---|---|
| ICC | **0.667** (shown to 3 decimals) | 0.6669 |
| μ | **39.5%** | 0.3945 |
| groups with k≥3 | 9,384 | 9,384 |
✓ Exact match. The parser is robust: CSV/TSV, true/false, pass/fail, fractional score, a clear error when columns are missing.
Quality threshold: <10 groups with ≥3 repeats → a warning instead of a number.

## Log
- 2026-08-05: brief created, prior tools checked in advance, model written down.
- 2026-08-05: model verified [code✓]; spike built (`index.html`), UI formulas checked against the spec. The main claim is visualized: verifier strength hits a ceiling, diversity raises it.
- 2026-08-05: added **Block 2 "Retries"** (beta-binomial) with a preset from our measurement; checked against real data (61.5% model vs 60.8% observed on the corrected download); checked for id collisions and correct embedding [code✓].
