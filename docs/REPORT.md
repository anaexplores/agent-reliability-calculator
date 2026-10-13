# Agent retries are correlated: a measurement across four corpora

> Report · first version 2026-08-05, updated 2026-10-12 · Every number is reproducible with the scripts in `measurement/` (`bash measurement/reproduce.sh`).
> Data is public, code is open. Per-measurement details: `docs/measurements/01–08`.

---

## Summary

The standard retry-reliability formula — `pass@k = 1 − (1−p)^k` — assumes attempts are independent. We measured retry correlation on **three independent corpora of agent runs** (different domains, different years, different experimental designs), later extended with a fourth (Terminal-Bench 2.1 / 4.0 leaderboards, 2026 models; §3.x), and find:

1. **Correlation is present everywhere.** Median ICC: 0.67, 0.57, 0.53; on 2026 models 0.59 (TB 2.1) and 0.49 (TB 4.0).
2. **The independence formula systematically overstates** the value of retries by 14–58 percentage points.
3. **The correlated model predicts out of sample** to within 0.3–1.5 pp, and is 2.1× closer than the nearest reasonable alternative.
4. **There is no universal constant:** the spread of ICC within a single corpus (0.03–0.83) is wider than the spread between corpora.

The practical consequence: fifty retries buy you the effect of three and a half independent attempts; twenty buy you a little over two.

---

## 1. The question

An agent solves a task with probability `p`. If attempts are independent, `k` retries yield `1−(1−p)^k`. That is exactly how existing agent-reliability calculators and rollout plans compute it.

Hypothesis: attempts are **not independent**, because the agent is not rolling a fresh die — it is solving the same task with the same reasoning. Then outcomes within a task are correlated, and the right model is the **beta-binomial**: each task has its own success rate `p_i`, with independent trials inside the task.

The measure is **ICC** (intraclass correlation). Under beta-binomial: `ICC = 1/(s+1)`, where `s = α+β`.

> A terminological caution: with few repeats, "correlation within a task" and "heterogeneity of task difficulty" are observationally indistinguishable (de Finetti). What we measure is **heterogeneity**, and for the practical question "what will retries buy me" the two are the same thing. We make **no** claim that attempts depend on each other causally.

## 2. Data

| Corpus | Domain | Configurations | Repeats per group | Size | Ground truth |
|---|---|---|---|---|---|
| [Terminal-Bench 2.0](https://huggingface.co/datasets/yoonholee/terminalbench-trajectories) | terminal tasks | 109 | 5 | 52,104 runs | benchmark tests |
| [SWE-bench Lite samples](https://github.com/ScalingIntelligence/swe-bench-lite-samples) | code fixing | 1 | **250** | 66,483 runs | test execution |
| [τ-bench](https://github.com/sierra-research/tau2-bench) | customer service | dozens of models | 4 | 74 measurements, through **August 2026** | database-state check |

All three are open and downloadable without authentication.

## 3. Results

### 3.1 ICC replicates
| Corpus | ICC | 95% CI |
|---|---|---|
| Terminal-Bench 2.0 | **0.667** | [0.660, 0.723] clustered by task |
| SWE-bench Lite | **0.574** | [0.508, 0.619] |
| τ-bench (median of 74 measurements) | **0.529** | Q1 0.348 – Q3 0.618 |

For comparison, the published range for FRAMES/GAIA is 0.30–0.77 ([arXiv:2512.06710](https://arxiv.org/abs/2512.06710)). Our values fall inside it.

### 3.2 Out-of-sample validation
**SWE-bench Lite** (parameters estimated independently, bootstrap over real runs):

| k | Observed | Model | Error | Independence | Error |
|---|---|---|---|---|---|
| 5 | 26.4% | **26.6%** | 0.3 pp | 54.0% | 27.6 pp |
| 20 | 37.1% | **36.5%** | 0.6 pp | 95.5% | **58.4 pp** |

*Observed values come from an unseeded bootstrap; reruns vary slightly (k=20: 36.8–37.8% observed in our reproduction runs, model error 0.3–1.3 pp).*

**τ-bench** (ICC calibrated on pass^1 and pass^2, validated on pass^3 and pass^4, n=71):

| Model | Error on pass^3 | Error on pass^4 |
|---|---|---|
| **beta-binomial (ours)** | **0.64 pp** | **1.52 pp** |
| geometric (control) | 1.56 pp | 3.18 pp |
| linear (control) | 3.33 pp | 7.99 pp |
| independence (null) | 13.96 pp | 16.17 pp |

We deliberately added **reasonable controls**: comparing only against independence would have inflated our advantage (it came out as "9.5×"). The honest figure is **2.1× closer than the nearest alternative**.

### 3.3 What retries are actually worth
| Attempts | Naive | Real | Effective |
|---|---|---|---|
| 5 | 54.0% | 26.6% | 2.0 |
| 20 | 95.5% | 36.5% | 2.9 |
| 50 | 100.0% | 42.4% | **3.5** |

*(SWE-bench Lite, μ=14.4%, ICC=0.574)*

### 3.4 Structure: the task world is bimodal
On SWE-bench Lite, **122 of 266 tasks (46%) were never solved once in 250 attempts**; none was solved every time. The distribution is sharply bimodal — 192 tasks sit in the 0–10% success bucket.

That is the mechanism: either the task is within reach of the configuration, or it isn't.

### 3.5 Fresh models don't remove the correlation
Releases of August 4, 2026 (τ-bench, banking_knowledge): Claude Fable 5 — 0.713, Grok 4.5 — 0.663, Claude Opus 4.8 — 0.648, GPT-5.6-sol — 0.614, Qwen 3.8 Max — 0.597.

### 3.x Update 2026-09-29: fourth corpus and September 2026 models
Public Terminal-Bench leaderboards publish pass@1…pass@5 over 5 attempts per task; with n = 5 these determine exactly how many tasks were solved 0…5 times (the reconstructed distributions reproduce the published pass@k to the 4th decimal). Script: `measurement/analyze_tb40.py`.

| Corpus | Submissions | Median ICC | Median single-attempt success |
|---|---|---|---|
| Terminal-Bench 2.1 (89 tasks, May–Jul 2026) | 19 | **0.59** | 76% |
| Terminal-Bench 4.0 (66 tasks, May 28 – Sep 2, 2026) | 13 | **0.49** (IQR 0.43–0.51) | 22% |

- **Claude Fable 5.1** (Sep 1, 2026): 0.51 [95% CI 0.37–0.63]. **Gemini 3.8 Flash** (Sep 2): 0.38 [0.21–0.54]. GPT-6 Astra: no public repeated-attempt data as of Sep 29, 2026.
- Same benchmark, same harness: Fable 5 → Fable 5.1 moves ICC 0.49 → 0.51 — a new generation does not remove the correlation.
- 2.1 → 4.0: the three cleanly comparable pairs (GPT-5.6 Luna/Sol/Terra, Codex, max effort on both) go 0.58→0.52, 0.60→0.48, 0.45/0.59→0.47. That the drop comes from the harder task mix is plausible but **not established** — other pairs change effort or harness at the same time.
- On τ-bench, at a fixed benchmark version and user simulator, ICC differs strongly by domain (telecom ≈0.05–0.3, retail ≈0.2–0.4, airline ≈0.5–0.65, banking ≈0.55–0.6). An earlier reading of this as "ICC falls as a domain saturates" was withdrawn after review: the version and the user simulator changed at the same point.

### 3.y Update 2026-09-30 / 2026-10-12: is the correlation an artifact of broken or hackable tasks?
- **Reward hacking** ([`07_reward_hacking.md`](measurements/07_reward_hacking.md)): removing the 33 tasks with TB 2.1 hacking labels lowers TB 2.0 ICC no more than removing 33 random tasks matched on success rate. A large contribution is ruled out (upper bound ≈ +0.026, ≈ 4% of 0.667); a small one (0.01–0.026) is not.
- **Benchmark defects on TB 4.0** ([`08_defects_and_icc_tb40.md`](measurements/08_defects_and_icc_tb40.md), 10 model × harness combinations, 3,300 public trials): excluding 30 tasks flagged as defective moves median ICC 0.522 → 0.532; difficulty-matched null interval [−0.072; +0.067], p = 0.60. A drop larger than ~0.07 is ruled out; a small effect is not.
- **Do agents differ in ICC?** On TB 2.0 (76 combinations), yes: the heterogeneity test gives p < 0.001 and stays significant on fixed tasks without the weakest combinations (p = 0.0075); most of the difference follows pass@1. On TB 4.0 (10 combinations) no difference is detected (p = 0.075). (An earlier version, computed on a corrupted download, said the differences disappeared on fixed tasks; see `docs/DATA_PROVENANCE.md`.) The direction of the ICC–pass@1 relation is robust (a stronger combination has slightly higher ICC), the magnitude is not: the slope is 0.38 on TB 4.0 and 0.23–0.43 on TB 2.0 depending on task and combination filters, so we do not state a law of the form "ICC = a + b·pass@1".

## 4. Self-checks

| Check | Result |
|---|---|
| Does the method recover a **known** ICC (simulation against τ-bench's exact formula, taken from its source) | ✅ error 0.002–0.005 for ICC 0.2–0.8 |
| Is the prediction non-trivial (control models) | ✅ but the advantage is 2.1×, not 9.5× — claim corrected |
| Sensitivity to rounding in published percentages | ✅ ICC ±0.003 |
| Are the filters selective | ✅ medians of filtered and validation subsets agree |
| Is the effect explained by corpus defects | ✅ excluding Terminal-Bench's 28 broken tasks moves ICC by 0.012 |

Additionally: **three of our six** original claims were discarded after permutation tests (notably "19 of 20 hard tasks are solved by someone", which the null model reproduces exactly). Only what survived is in this report.

## 5. Limitations

1. **ICC is not universal.** The spread within τ-bench (0.03–0.83) is wider than between corpora (0.119). Medians converge; individual values do not.
2. **Domains differ threefold:** airline 0.63, banking 0.59, retail 0.35, telecom 0.22.
3. **τ-bench:** a stochastic user simulator contributes part of the variance — environment noise, not only agent variance.
4. **SWE-bench Lite:** 2024 data, a single configuration; a low base success rate may inflate ICC through a floor effect.
5. **Terminal-Bench 2.0:** the version contained 28 defective tasks out of 89. The effect on ICC is small, but it distorts tail metrics (share of unsolvable tasks) completely.
6. We measure heterogeneity, not causal dependence between attempts (see §1).

## 6. What follows from this

**For practice:**
- Do not plan on `1−(1−p)^k` — you will be off by tens of points.
- Retrying one configuration saturates fast; **changing the configuration** works better (we separately measured about +19 pp of configuration-to-task specificity out of sample).
- A pilot of 20 retries on one task ≈ two independent attempts. Twenty different tasks once each is more informative at the same price.

**For model evaluation:** confidence intervals computed assuming independent runs are too narrow.

## 7. Relation to prior work

ICC on agent evals has been measured before ([arXiv:2512.06710](https://arxiv.org/abs/2512.06710), December 2025), including a variance decomposition we do not have. Violation of independence on SWE-bench has been shown ([arXiv:2605.08563](https://arxiv.org/abs/2605.08563), via a different mechanism — context contamination when retrying within one session; our runs are separate). The pass^k metric was introduced by τ-bench.

Nearest neighbour as of August 2026: [arXiv:2608.11977](https://arxiv.org/abs/2608.11977), «Retry, Switch, or Abstain?» (Chen et al., 12.08.2026) — BENCH2ROBUST converts failure-free tool-use benchmarks into controlled stochastic environments where an episode requires retrying, switching, or stopping. It learns a *policy* over tool failures; it does not measure correlation of attempts on a fixed task, and does not price retries. Complementary, not overlapping.

**Our contribution:** a third and fourth independent measurement point; out-of-sample validation against control models; translation into the engineering rule "what N attempts are worth"; open reproducible code.

## Appendix: reproduction
```bash
bash measurement/reproduce.sh
```
It downloads the public corpora into `data/` and runs every script; the header of `measurement/reproduce.sh` lists the individual commands per corpus.
