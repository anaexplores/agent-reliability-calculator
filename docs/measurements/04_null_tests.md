# RESULT — testing our own claim with null tests [code✓]

> Markers: [code✓] computed by our code; [primary] primary source; [secondary] secondary source; [hyp] hypothesis; [?] unverified.

> Date: 2026-08-05 · Data: the same 52,104 Terminal-Bench 2.0 runs. Code: `measurement/analyze_v6_null_tests.mjs` (T1, T3), `measurement/analyze_v6b_specificity.mjs` (T2 decomposition).
> Numbers recomputed on a clean download of the corpus on 2026-10-13 (see the correction note in `docs/DATA_PROVENANCE.md`).
> Motivation: an independent adversarial review showed arithmetically that "diversification ≫ resampling" could be **pure winner's curse** (a maximum over 109 configurations). The tests were proposed by that review; we ran them.

## T1 — Permutation null (shuffle outcomes across configurations within each task)

| | Observed | Null "configuration does not matter" (B=200) |
|---|---|---|
| best configuration on a task | **97.8%** | 84.6% [82.2%, 87.5%] |
| "hard tasks solved by someone" | **19/20** | **19/20 [19, 19]** |

- 🔴 **"19 of 20" is an EMPTY result.** The null reproduces it exactly. The review was entirely right; this claim is dropped.
- 🟡 **"97.8%" is about three quarters explained by chance.** The null gives 84.6%. The real remainder is ≈ **13.2 pp**, not the 39.6%→97.8% gap we had presented.

## T2 — Split-half: does the configuration choice transfer? (main test)

Configuration chosen on attempts 1–2, checked on attempts 3–5 (holdout, out-of-sample), 89 tasks. Ties on attempts 1–2 are broken at random, so the numbers are means over 200 random tie-breaks (range of single draws in brackets):

| | |
|---|---|
| A. Chosen configuration on holdout | **75.8%** [69.3; 83.1] |
| B. Mean success of **the same** configuration across all tasks | 56.8% [52.7; 60.6] |
| C. Mean success of all configurations on this task | 41.5% |

**Effect decomposition:**
- "the configuration is stronger in general" (B−C) = **+15.3 pp** [11.2; 19.1]. Trivial: this is "pick a better model"
- 💎 **"the configuration fits this particular task" (A−B) = +19.0 pp** [13.8; 25.6]. Non-trivial specificity
- full transfer (A−C) = +34.3 pp [27.8; 41.6]

*The first version of this report gave a single tie-break draw on the corrupted download: A−B = +17.5 pp. The averaged figure on clean data is +19.0 pp; every single draw stays above +13 pp.*

✅ **The specificity effect is REAL and transfers out-of-sample.** If the configuration were not task-specific, the holdout would regress to the configuration's own average level (B). Instead it stays about 19 pp above it.

## T3 — ICC without degenerate clusters
| | ICC |
|---|---|
| all tasks | 0.6669 |
| only tasks with 5% < success < 95% | **0.6434** |

🟢 The review expected a drop to 0.3–0.45. **This was not confirmed**: the drop is only 0.024. The claim "retries give little new information" is robust.

---

## What remains after all checks

| Claim | Status |
|---|---|
| ICC ≈ 0.67, retries carry little information | ✅ held up (T3), but this is a **replication** [arXiv:2512.06710], not a discovery |
| "5 attempts = 1.4 independent ones" | ✅ the arithmetic is correct, but it is a one-line consequence, not a standalone result |
| "19 of 20 hard tasks are solved by someone" | 🔴 **dropped**: the null gives the same |
| "mean 39.6% vs best 97.8%" | 🟡 **reworded**: about three quarters of the gap is winner's curse |
| **Configuration-to-task specificity** | ✅ **+19 pp out-of-sample** (single draws 14–26 pp). The only original non-trivial result |
| "31% of benchmark tasks are broken" | 🔴 not ours: from the official TB 2.1 release notes |

## Limits of the specificity result
The specificity effect is real, but it has practical limits:
- the measurement **does not transfer** to other task sets. It has to be measured on the target corpus, and most users do not have a corpus with autograders (the bottleneck is having an eval at all, not choosing a configuration);
- the result **goes stale** with each new model;
- per-query routing is already covered by routers (Not Diamond, Martian, RouteLLM, the OpenRouter auto-router), and configuration optimization by cost-aware racing and GEPA (35× fewer runs).

Related prior art on eval statistical significance: it is already a feature of Braintrust (trials + paired tests) and LangSmith (repetitions + pairwise); a free public sample-size calculator exists; and "how many runs are needed" is given as a table in [arXiv:2602.07150](https://arxiv.org/pdf/2602.07150) (ICLR 2026 Workshop).

## What this supports
A **short replication report**: an independent check of the ICC claim on a third corpus (52,104 runs, more than in both cited works) + an honest demonstration that tail metrics on TB 2.0 are driven by corpus defects + **a new piece: decomposing the configuration choice into "strength" and "specificity" with an out-of-sample check** (the cited works do not have this).

## Lesson
Twice we presented as a result something that a null model reproduces. Both times an independent adversarial review caught it, and both times the check took one evening and zero dollars. **Rule: test any claim of the form "X is better than Y" with a permutation null and an out-of-sample split-half BEFORE building anything on it.**
