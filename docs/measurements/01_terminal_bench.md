# RESULT — calibration on real agent traces (after an adversarial teardown)

> Date: 2026-08-04 · Data: **Terminal-Bench 2.0 trajectories** ([HF](https://huggingface.co/datasets/yoonholee/terminalbench-trajectories), Apache-2.0), **52,104 runs**, 89 tasks, 109 configurations. Downloaded in full. Numbers recomputed on a clean download of the corpus on 2026-10-13 (see the correction note in `docs/DATA_PROVENANCE.md`).
> Code: `measurement/fetch_terminalbench.mjs`, `measurement/analyze_overdispersion.mjs`, `measurement/analyze_v2.mjs`, `measurement/analyze_v3_diversification.mjs`.
> **Status: the original claim was BROKEN by an independent adversarial review, and we re-checked it ourselves. Below is what survived.**

Markers: [code✓] computed by our code; [primary] primary source; [secondary] secondary source; [hyp] hypothesis; [?] unverified.

---

## ⛔ WHAT WAS DISCARDED (and why) — the main lesson

We claimed "agent attempts are NOT independent (ρ=0.67)". **This is the wrong framing.**

**Counterargument from an independent adversarial review (de Finetti's theorem):** with k=5 and exchangeable binary outcomes, "correlation within a cell" and "difficulty heterogeneity across cells" are **observationally indistinguishable in principle**.

**We checked this on our data [code✓]** with a beta-binomial model in which trials within a cell are **independent** and p varies between cells:
| | observed | beta-binomial with INDEPENDENT trials |
|---|---|---|
| "all 5 ✗" | 39.2% | **38.5%** |
| "all 5 ✓" | 26.6% | **27.2%** |

The match is almost exact. **Our "polarization" is fully reproduced by a model with independent attempts.** So ICC here measures *the spread of task difficulty and agent quality*, not an agent "getting stuck".

Discarded:
1. ❌ "Polarization 66.3% vs 8.4%": the null hypothesis "one p̄ for all tasks" is a straw man.
2. ❌ "pass@5 gap of 33.7 pp": same number, plus **Jensen's inequality** (the function 1−(1−p)^k is concave, so pass@k must be averaged over tasks rather than computed from p̄; the field has done this since 2021).
3. ❌ "5 attempts = 1.61 independent ones": a deterministic function of ICC and p̄, and it also conflicts with our own DEFF figure (1.36): Kish's design effect describes the precision of a mean estimate, not "at least one success".
4. ❌ Comparison with the "17.4 pp" from [arXiv:2605.08563](https://arxiv.org/abs/2605.08563): a **category error**. There, retries happen in the polluted context of a single session; here, every run is in a fresh container. The mechanism is physically different.

## ⚠️ Critical data artifact (found by the independent adversarial review, [primary])
**Terminal-Bench 2.0 contained 28 broken tasks out of 89 (31%)**: stale dependencies, insufficient resource budgets, mismatches between instructions and tests. The [TB 2.1 release notes](https://www.tbench.ai/news/terminal-bench-2-1) say directly: "After these changes, no task is unsolved in Terminal-Bench 2.1".
Consequences: our "blind spot" (1/89 never-solved tasks; first reported as 2/89 because of the data error) is **a defect of the benchmark version, not a property of the agents**; tasks with insufficient budget give systematic 0% via timeouts → they **inflate ICC**. `make-doom-for-mips` (588 runs, 0 successes) is a known verifier problem and is already solvable in 2.1.

## ⚠️ Technical bugs in our code (acknowledged)
- The bootstrap resampled **cells** (10,400), but they are nested in 89 tasks → effective n≈89. A CI of width 0.021 is **not possible**; a cluster bootstrap over tasks is needed.
- For an unbalanced design, `iccOf` needs k₀=(N−Σkᵢ²/N)/(n−1), not k̄ (the bias is conservative, but it is a bug).
- We dropped `timestamp`/`trial_id` during download → cells with k=6…24 merged **different submissions** (different scaffold versions / model snapshots under one name).

---

## ✅ WHAT SURVIVED

### 1. ICC ≈ 0.67 — as a **replication**, not a discovery
It falls within the published range ([arXiv:2512.06710](https://arxiv.org/abs/2512.06710): FRAMES 0.4955–0.7118, GAIA 0.304–0.774) [primary]. Value: a third data point on an independent corpus. **But:** that work did this 8 months earlier **and with a variance decomposition** (task vs agent), which we do not have. Our version is methodologically weaker. It needs a fixed CI and an explicit caveat: "a measure of heterogeneity, not of dependence".

### 2. 💎 THE CORRECT RESULT: diversification ≫ resampling [code✓]
This was hidden under the wrong narrative. Our data show:

| | |
|---|---|
| Hard tasks (overall success <10%) | **20** |
| Of these, solved by at least one configuration | **19 (95%)** |
| Never solved by anyone | 1 (`make-doom-for-mips`, a TB 2.0 artifact) |

**Average configuration: 39.6% success. Best configuration per task: 97.8%. Gap: +58 pp.**

Telling cases: tasks with overall success of **0.5%, 1.5%, 1.7%** each have a configuration with **100% success**. So a task that is "almost unsolvable on average" is solved reliably by the *right* agent.

**Practical takeaway:** repeating one configuration gives little; changing the configuration (model/scaffold/approach) gives a lot. This agrees both with our simulation (diversity breaks the blind spot, b^k) and with the literature (shared blind spots between models ≈60%).

⚠️ **Honest caveat:** the "best configuration" is chosen post hoc on the same data from 109 variants → **winner's curse**; the +58 pp magnitude is overstated. A proper scheme is needed (select on one half of the tasks, test on the other). The direction of the effect is robust; the magnitude is not.

---

## 🎯 The real unclaimed contribution (candidate, not done)
The independent adversarial review pointed out: **the combination of "31% of TB 2.0 tasks were broken" × "instability metrics on this corpus"**. Design: recompute ICC on TB 2.0 and TB 2.1 and show the delta. If ICC drops noticeably after the 28 tasks were fixed, this is a publishable result that is uncomfortable for the field: **instability metrics of agent evals substantially measure benchmark defects, not agent behavior**. Nobody has claimed this.
First step: restore `timestamp`/`trial_id` and redefine a cell as (task, agent, model, submission).

## Provenance
[code✓] — all numbers are reproducible with our scripts on open data. [primary] — literature and TB 2.1 release notes. Verdicts come from an independent adversarial review that did not see the computation process.
