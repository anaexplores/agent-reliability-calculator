# RESULT — second independent ICC measurement [code✓]

> Date: 2026-08-05 · Corpus: **SWE-bench Lite samples** ([ScalingIntelligence/swe-bench-lite-samples](https://github.com/ScalingIntelligence/swe-bench-lite-samples), from "Large Language Monkeys", [arXiv:2407.21787](https://arxiv.org/abs/2407.21787)) [primary]
> Code: `measurement/analyze_swebench_lite.mjs`. Data: `summary.json`, public, available via git/HTTP without authentication.

Markers: [code✓] computed by our code; [primary] primary source; [secondary] secondary source; [hyp] hypothesis; [?] unverified.

## Why a second corpus
The first measurement (Terminal-Bench 2.0, ICC≈0.67) could have been a property of one benchmark. It needs a check on **a different domain, a different configuration, a different design**.

## Design — cleaner than the first
| | Terminal-Bench 2.0 | SWE-bench Lite samples |
|---|---|---|
| domain | terminal tasks | code repair (Python repositories) |
| configurations | 109 (agent × model) | **1** (moatless-tools + DeepSeek-Coder-V2) |
| repeats per group | 5 | **~250** |
| ground truth | benchmark tests | execution-based `resolved` |
| runs | 52,104 | **66,483** (without flaky) / 74,979 (all) |

With k=250 the ICC estimate is an order of magnitude more precise, and a single configuration removes the "agent quality" confounder: a group is purely a task.

## 🎯 Result: ICC replicated

| | ICC | μ (per-attempt success) |
|---|---|---|
| Terminal-Bench 2.0 | **0.667** | 39.5% |
| **SWE-bench Lite** | **0.574** [95% CI 0.508–0.619] | 14.4% |
| (published range for FRAMES/GAIA [primary, arXiv:2512.06710]) | 0.30–0.77 | — |

Two independent corpora, different domains, different configurations, k of a different order of magnitude, and **ICC in the same range**. This is no longer a property of a benchmark but a property of agent runs.

## 💥 Main point: the model predicts, the naive formula does not

Honest check: bootstrap over real runs within tasks (take random k out of 250, look at the share of tasks with ≥1 success).

| k | observed | our model | error | naive formula | naive error |
|---|---|---|---|---|---|
| 2 | 20.1% | **19.6%** | 0.5 pp | 26.7% | 6.6 pp |
| 5 | 26.4% | **26.6%** | **0.3 pp** | 54.0% | 27.6 pp |
| 10 | 32.3% | **31.7%** | 0.6 pp | 78.8% | 46.5 pp |
| 20 | 37.1% | **36.5%** | 0.6 pp | 95.5% | **58.4 pp** |

**Our model is off by 0.3–0.6 points. The naive one is off by 58 points at 20 attempts.** The model parameters (μ, ICC) are estimated independently; there is no fitting.

## What this means for retries
| Attempts | Naive | Actual | Effective |
|---|---|---|---|
| 5 | 54.0% | 26.6% | 2.00 |
| 20 | 95.5% | 36.5% | 2.93 |
| **50** | **100.0%** | **42.4%** | **3.55** |

**Fifty retries give 3.5 effective attempts.** The naive calculation promises guaranteed success; in reality it is less than half.

## Task structure: the world is binary
- **122 of 266 tasks (46%) were NEVER solved** in 250 attempts.
- **0 tasks were always solved.**
- The distribution is sharply U-shaped: 192 of 266 tasks are in the 0–10% success bin.

A task is either within reach of this configuration or it is not. This is the mechanism of the correlation, and it is now visible on two corpora.

## Limitations (honest)
- The data are from 2024, and the model is weak by current standards (μ=14.4%). A low base rate may **inflate** ICC through a "floor" effect (many tasks with zero variance).
- One configuration ⇒ "task difficulty" cannot be separated from "agent quality" (the first corpus had this separation).
- The source repository does not state a license; publishing derived data requires clearing this first.
- The flaky subset gives a lower ICC (0.486). This is expected: test noise adds within-group variance.

## Provenance
[code✓] all numbers are reproducible: `node measurement/analyze_swebench_lite.mjs summary.json`. [primary] corpus and methodology: Brown et al., arXiv:2407.21787.
