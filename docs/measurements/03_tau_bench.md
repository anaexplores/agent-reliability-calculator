# RESULT — third data point: τ-bench, fresh data (August 2026) [code✓]

> Markers: [code✓] computed by our code; [primary] primary source; [secondary] secondary source; [hyp] hypothesis; [?] unverified.

> Date: 2026-08-05 · Corpus: **tau2-bench** (Sierra Research), public S3 · Code: `measurement/analyze_tau2bench.mjs` · Raw measurements: `measurement/tau2_icc.json`
> **74 measurements** (model × domain), of which **56 are fresh (2026)**; the newest are from **August 4, 2026**.

## Method: ICC recovered without downloading trajectories
τ-bench publishes `pass^k`: the share of tasks where **all** k attempts succeed (k=1..4). Under independence, `pass^k = μ^k`. Any deviation means correlation.
From pass^1 and pass^2 we recover ICC analytically (beta-binomial), then **check it against pass^3 and pass^4**. This is a genuine out-of-sample check. We did not need to download the trajectory files (175–350 MB each).

## 💥 Out-of-sample check + CONTROL MODELS (after self-check)

⚠️ **Correction of our own claim.** At first we compared only against the independence model and got "9.5 times more accurate". That is an incorrect bar: independence is a known-bad null model. We added **reasonable controls**: other one-parameter curves, calibrated the same way on pass^1 and pass^2:

| Model (all calibrated on pass^1, pass^2) | pass^3 error | pass^4 error |
|---|---|---|
| **ours (beta-binomial)** | **0.64 pp** | **1.52 pp** |
| geometric (control) | 1.56 pp | 3.18 pp |
| linear (control) | 3.33 pp | 7.99 pp |
| independence (null) | 13.96 pp | 16.17 pp |

**Honest statement: our model is 2.1 times more accurate than the closest reasonable alternative** (not 9.5 times). Against independence it is 10 times more accurate, but that is a weak bar. The advantage is real, but part of the accuracy is explained simply by the fact that any smooth decreasing curve fits 4 points fairly well.

Example (Grok 4.5, banking_knowledge): observed pass^4 = 32.0%, our model gives 32.7%, independence gives **5.3%**.

## ICC distribution: 74 measurements
```
n=74   min=0.030   Q1=0.348   median=0.529   Q3=0.618   max=0.829
```
Fresh (2026), n=56: median **0.504**.

## ⚠️ Important clarification: ICC depends on the domain
| Domain | n | Median ICC |
|---|---|---|
| airline | 15 | **0.629** |
| banking_knowledge | 28 | 0.586 |
| retail | 16 | 0.348 |
| telecom | 15 | **0.218** |

A threefold spread. **ICC is not a universal constant**; it is a property of the "domain × configuration" pair. For the calculator this means showing a range and presets, not a single number.

## Fresh models (August 4, 2026), banking_knowledge domain
| Model | pass^1 | ICC |
|---|---|---|
| Claude Fable 5 | 39.7% | **0.713** |
| Grok 4.5 | 47.9% | 0.663 |
| Claude Opus 4.8 | 39.7% | 0.648 |
| Claude Opus 5 | 48.7% | 0.618 |
| GPT-5.6-sol | 46.9% | 0.614 |
| Qwen 3.8 Max | 55.2% | 0.597 |
| Muse Spark 1.1 | 40.5% | 0.547 |
| Kimi K3 / GLM-5.2 | 37.1% | 0.492 |

Retry correlation **has not disappeared in the newest models**. It is not a defect of older systems.

## ╔══ THREE INDEPENDENT CORPORA ══╗
| Corpus | Domain | Design | Volume | ICC |
|---|---|---|---|---|
| Terminal-Bench 2.0 | terminal tasks | 109 configurations, k=5 | 52,104 runs | **0.667** |
| SWE-bench Lite | code repair | 1 configuration, k=250 | 66,483 runs | **0.574** |
| τ-bench (fresh) | customer service | 74 measurements, 4 domains, k=4 | ~10⁵ runs | **0.529** (median) |

Three domains, three designs, different years (2024 → August 2026). The medians fall in a narrow range of 0.55–0.67.

⚠️ **Second correction after self-check.** The spread of medians **between** corpora = 0.119. But the spread of ICC **within** a single corpus (τ-bench, across domains and models) = **0.799**, i.e. 7 times wider. So "reproducibility across corpora" is a weaker claim than it looks: it is the **medians** that agree, while individual values range from 0.03 to 0.83.
**Correct statement:** retry correlation is present everywhere and is typically 0.4–0.7, but the specific value is a property of the "domain × configuration" pair, not a constant. There is no universal number, and the calculator reflects this (4 presets plus a "compute your own" block).

## Limitations (honest)
- τ-bench: part of the variance comes from the **stochastic user simulator** (GPT-5.2 and others). This is environment variance, not only agent variance. This confounder was not present in the first two corpora.
- Submissions are self-reported by vendors.
- The v1.0.1 regrade (2026-07-15) changed banking_knowledge scores, so old and new scores are not fully comparable.
- Recovering ICC from two points (pass^1, pass^2) is sensitive to rounding of the published percentages. When pass^2≈pass^1 the estimate is unstable (such cases were filtered out).
- The telecom/retail domains give a noticeably lower ICC. The "≈0.6" conclusion holds for the median, but not for every case.

## 🔬 Method self-check (5 tests) [code✓]
| Test | Result |
|---|---|
| **1. Does the formula recover a KNOWN ICC?** Simulation: generate tasks with a known ICC, compute pass^k with **the exact τ-bench combinatorial formula** (`C(succ,k)/C(n,k)`, taken from the source code [primary]), recover it with our formula | ✅ error 0.002–0.005 for ICC from 0.2 to 0.8 |
| **2. Is the prediction trivial?** Comparison with geometric and linear models | ✅ but the advantage is **2.1×**, not 9.5×; the claim is corrected above |
| **3. Sensitivity to rounding** of percentages (±0.05 pp) | ✅ ICC 0.6626 → [0.6595, 0.6657], stable |
| **4. Are the filters selective?** (0 of 74 dropped by ICC, 3 without pass^3/4) | ✅ median of filtered-out 0.547 vs checked 0.529, no bias |
| **5. Agreement of the three corpora** | ✅ medians within a range of 0.119, **but** the within-corpus spread is 0.799; see the correction above |

**What was checked against the primary source:** the definition of `pass^k` was taken not from the documentation but from the code in `src/tau2/metrics/agent_metrics.py` [primary]. It is `C(success_count, k) / C(num_trials, k)`, an unbiased estimate of E[p^k]. Our initial understanding ("all k succeed") was confirmed. The applicability of the E[p^k] formula to this statistic was checked by simulation (test 1).

## Provenance
[code✓] `node measurement/analyze_tau2bench.mjs` is reproducible; data are pulled from public S3 without authentication. [primary] tau2-bench, Sierra Research; the manifest, submission.json and **the metric's source code** are primary sources.
