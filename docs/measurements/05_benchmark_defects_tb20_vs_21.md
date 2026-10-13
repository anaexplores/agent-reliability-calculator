# RESULT — Do instability metrics measure benchmark defects? [code✓]

> Markers: [code✓] computed by our code; [primary] primary source; [secondary] secondary source; [hyp] hypothesis; [?] unverified.

> Date: 2026-08-05 · Data: Terminal-Bench 2.0, 52,104 runs, 89 tasks. List of fixed tasks: **TB 2.1 release notes** [primary].
> Code: `measurement/analyze_v4_benchmark_defects.mjs` (cluster bootstrap over tasks + k₀), `measurement/analyze_v5_sensitivity.mjs`. List: `measurement/tb21_fixed_tasks.txt` (28 names, all 28 matched the dataset).
> Hypotheses and criteria were fixed **BEFORE** the analysis.
> Numbers recomputed on a clean download of the corpus on 2026-10-13 (see the correction note in `docs/DATA_PROVENANCE.md`).

## VERDICT: H0 — the hypothesis "the metric measures benchmark defects" was NOT confirmed for ICC

| Metric | TB 2.0 (all 89) | Without the 28 fixed (61 tasks) | Change |
|---|---|---|---|
| **ICC** | 0.6669 [0.660, 0.723] | 0.6548 [0.648, 0.710] | **−0.012 (1.8%)** |
| tasks "never solved" | 1 | **0** | −100% |
| tasks with success <10% | 20 (22.5%) | **8 (13.1%)** | **−60%** |
| p̄ (mean success) | 0.395 | 0.456 | +6.1 pp |

Prespecified thresholds: H0 if |Δ|<0.05, H1 if Δ≥0.10. Result: **Δ=0.012** → **H0**. The confidence intervals overlap completely, so a difference in ICC is not even shown.

## Nuance: different metrics behave in OPPOSITE ways
- **ICC is robust** to corpus defects. It measures the overall spread of task difficulty / agent quality, and that spread does not go away after fixing 28 tasks (the tasks still differ in difficulty).
- **Tail metrics collapse:** "unsolvable" 1→0, the left hump 20→8. Our earlier "blind spot" (2.2% as first reported; 1.1% on the corrected data) was indeed **entirely a benchmark artifact**. The independent adversarial review was right on exactly this point.

A defensible conclusion: **benchmark defects distort TAIL metrics (unsolvability, share of failing tasks) but do not distort aggregate measures of spread (ICC)**. The requirement to "audit the corpus before drawing conclusions" is justified for the former and unnecessary for the latter.

## 💥 Methodological finding (a side result, but important)
We first computed this with a **proxy**: excluding "the 28 hardest tasks" (circular selection based on our own data). Comparison:

| How the 28 tasks were selected | ΔICC |
|---|---|
| proxy "hardest" (circular) | **−0.072** |
| actual list of fixed tasks [primary] | **−0.012** |

**The circular proxy inflated the effect about 6 times** and would have led to the opposite conclusion. This is a clear demonstration of why selection "based on our own data" is not acceptable, and why it was worth finding the primary source instead of settling for a reasonable-looking approximation.

Control (from `analyze_v5`): excluding 28 **random** tasks barely changes ICC (0.663 vs 0.667). So the proxy effect was real, but specifically as an artifact of selecting on the outcome.

## Prior art / novelty
Prior-art search: **we found no work that recomputes instability metrics after excluding broken tasks**. Published 2.0↔2.1 comparisons exist, but they are per-task/per-model pass-rate deltas in the release notes themselves [primary], not stability metrics.
Independent defect audits: LessWrong "Every Benchmark is Broken" (13 confirmed problematic tasks in 2.0, Jan 2026) [primary]; Z.ai Verified (11 tasks, merged into 2.1) [primary]; Terminal Wrench (arXiv 2604.17596): >15% of terminal-benchmark verifiers can be bypassed [primary].

## Limitations (honest)
- **There is no direct 2.0 vs 2.1 comparison:** no public dump of 2.1 trajectories exists (checked); access is only per submission via Harbor Hub. We **excluded tasks within 2.0** rather than comparing versions. This is weaker: after a fix, tasks do not disappear, they change difficulty (the list includes deltas as large as −18.6%).
- Discrepancy in the list: the release notes give 28 tasks, PR #53 has 27 directories (including `pytorch-model-recovery`, which is not in the table), and the 2.1 README says "26 modified". We used the canonical 28 from the delta table. Taking the union would add another 1–3 names; this does not affect the conclusion (the effect is already an order of magnitude below the threshold).
- ICC on binary outcomes is a method-of-moments approximation; interpret it as a measure of heterogeneity, not dependence.
- The 2.0 data are a leaderboard scrape, so selection bias remains.

## What remains open
A real version comparison requires TB 2.1 runs. They would have to be collected via Harbor Hub from leaderboard entries (17 entries, May–July 2026) or run ourselves (`harbor run`). That is engineering work with a budget, not analysis of open data.

## Provenance
[code✓] all numbers are reproducible: `node measurement/analyze_v4_benchmark_defects.mjs tb_trials.csv measurement/tb21_fixed_tasks.txt`. The raw `tb_trials.csv` is not shipped; regenerate it with `measurement/fetch_terminalbench.mjs`. [primary] the task list and breakage categories come from the TB 2.1 release notes and PR #53.
