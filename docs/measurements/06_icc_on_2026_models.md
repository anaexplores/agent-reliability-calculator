# Does retry correlation hold on 2026 models? (Terminal-Bench 2.1 / 4.0, τ²-bench) [code✓]

> 2026-09-29. Relevant to the calculator's ICC presets (at the time of this measurement: 0.66 / 0.57 / 0.53 / 0.22, default 0.66; recalibrated as a result, see "What this means for the calculator").
> Scripts: `measurement/analyze_tb40.py` (TB 4.0), `measurement/null_icc_vs_ceiling.py` (null model). Data: `measurement/tb40_icc.json`, `measurement/tau2_icc.json`.
> Pipeline: check our existing corpora → search for new data → compute in code → null model → independent adversarial review.

Markers: [code✓] computed by our code; [primary] primary source; [secondary] secondary source; [hyp] hypothesis; [?] unverified.

## Question and criterion
Does retry correlation stay in the 0.5–0.7 corridor on September 2026 models (GPT-6 Astra, Claude Fable 5.1)?

## Where the data is [primary, checked 2026-09-29]
- **τ²-bench:** the latest text submissions are from 2026-08-04, and all of them are already in `tau2_icc.json`. After that date only voice submissions with a single attempt appeared. The submission with the Astra backend is also k=1 and cannot be used for ICC.
- **Terminal-Bench 2.0 trajectories** (`yoonholee/terminalbench-trajectories`): frozen since 2026-03-09; we already have all 52,104 rows.
- **Terminal-Bench 4.0**, `harbor-framework/terminal-bench/leaderboard/submissions` — **a new, fourth corpus**. 66 tasks × 5 attempts; pass@1…pass@5 are published. 13 models, from Opus 4.8 (28.05) to **Fable 5.1 (01.09)** and **Gemini 3.8 Flash (02.09)**.
- **GPT-6 Astra:** no data with retries. The tbench.ai leaderboard lists it at 58.2% [secondary], but there is no JSON in the repository. It will most likely appear at the next "promotion" of the TB 4.0 leaderboard [hyp].

## Method and self-check
With n=5, the unbiased pass@1…pass@5 uniquely determine the distribution N_c: the number of tasks solved c times out of 5. This is 6 equations in 6 unknowns, solved exactly in rational numbers. **The integer solutions reproduce all published pass@k to the fourth decimal place** [code✓]. The real-valued solution deviates from the integer one by up to 0.17 — this is rounding of the published pass@k; the margin to 0.5 is large. ⚠️ The rules require "at least 5" attempts, not "exactly 5": that each task has exactly 5 trials is inferred from n_trials = 5 × 66, not checked on raw data [?]. The Fable 5.1 distribution [14, 5, 7, 7, 14, 19] matched an independent manual calculation. ICC was computed via ANOVA and via the beta-binomial method of moments; the two differ by no more than 0.005.

## Result

| Model | Date | p1 | ICC | 95% CI (bootstrap over tasks) |
|---|---|---|---|---|
| Opus 4.8 | 05-28 | 0.24 | 0.40 | 0.27–0.53 |
| Fable 5 | 06-09 | 0.45 | 0.49 | 0.36–0.61 |
| GPT-5.6 Luna | 06-26 | 0.17 | 0.52 | 0.33–0.69 |
| GPT-5.6 Sol | 06-26 | 0.37 | 0.48 | 0.36–0.60 |
| GPT-5.6 Terra | 06-26 | 0.22 | 0.47 | 0.29–0.62 |
| Sonnet 5 | 06-30 | 0.12 | 0.27 | 0.08–0.42 |
| Grok 4.5 | 07-16 | 0.12 | 0.46 | 0.22–0.63 |
| Opus 5 | 07-24 | 0.52 | 0.61 | 0.49–0.72 |
| Grok 4.6 | 08-12 | 0.20 | 0.50 | 0.35–0.63 |
| Gemini 3.7 Flash | 08-13 | 0.11 | 0.49 | 0.22–0.67 |
| GLM-5.3 | 08-14 | 0.42 | 0.64 | 0.51–0.75 |
| **Fable 5.1** | **09-01** | **0.58** | **0.51** | **0.37–0.63** |
| **Gemini 3.8 Flash** | **09-02** | **0.19** | **0.38** | **0.21–0.54** |

**TB 4.0, median over 13 models: 0.49 (IQR 0.43–0.51).**

## Verdict: 🟡 the correlation has not disappeared; on TB 4.0 the median fell below the lower bound of the corridor (0.49 < 0.5)
- **Retry correlation has not gone away on the new models.** Fable 5.1 — 0.51, Gemini 3.8 Flash — 0.38. For 12 of 13 models the interval excludes ICC=0.2 and below, i.e. independent retries. The calculator's core claim — "the formula 1−(1−p)^k overstates the benefit of retries" — holds.
- **The level is lower than in the calculator's original calibration.** TB 4.0 median = 0.49 versus 0.666 on TB 2.0 (0.667 after the 2026-10-13 data correction). The "Terminal tasks — ICC 0.66" preset was too high for current models on the current benchmark version.
- **The cause of the shift is only partly separated** (see below). Reliable: a generation change on the same benchmark does not move ICC (Fable 5 → 5.1: 0.49 → 0.51). Plausible, but [hyp]: the main shift comes from the benchmark; there are only three clean pairs, all from one family (GPT-5.6).
- **GPT-6 Astra: not checked**, no data.

## Separation: benchmark or generation? [code✓]
The same procedure was applied to the **Terminal-Bench 2.1** leaderboard (`harbor-framework/terminal-bench-2-1`, 89 tasks × 5, models from May–July 2026) — `measurement/tb21_icc.json`. One submission with an unequal number of attempts (447 trials) was skipped. Successes are computed as accuracy × n; the deviation from an integer is up to 0.26 — worse than on TB 4.0. A possible cause: trials disqualified for reward hacking (up to 40 per submission) [?].
- **TB 2.1, median over 19 submissions: 0.59** — inside the corridor.
- The same model on both versions: in 8 of 10 pairs ICC is lower on TB 4.0. ⚠️ Independent review: **in 7 of 10 pairs the effort level or the harness changes together with the benchmark** (Opus 4.8, Sonnet 5, Fable 5: high/xhigh → max; Grok 4.5: cursor-cli → grok-build). **Clean pairs** (codex, max on both sides): GPT-5.6 Luna 0.58 → 0.52, Sol 0.60 → 0.48, Terra 0.45/0.59 → 0.47 (two TB 2.1 runs disagree). Two go down, one is ambiguous. Per-attempt success meanwhile drops from 0.71–0.78 to 0.17–0.37.
- Reward-hacking disqualifications in TB 2.1 are unstable between repeated runs of the same configuration (Luna 33 versus 4, Terra 32 versus 1) — a separate source of noise in the TB 2.1 ICC.
- **Generation change on the same benchmark and harness:** Fable 5 → **Fable 5.1** (TB 4.0, claude-code, max) — **0.49 → 0.51**; Gemini 3.7 Flash → 3.8 Flash — 0.49 → 0.38 (intervals overlap).
- **Conclusion:** a new generation on the same benchmark does not change ICC [code✓, one clean pair]. That the 0.59 → 0.49 shift is an effect of a harder benchmark is consistent with the three clean GPT-5.6 pairs, but remains [hyp]: there are few pairs and all are from one family.

## Side result: ICC depends strongly on the domain (τ²-bench); "saturation" is not shown
The first version of this analysis claimed that within a domain ICC falls as the domain saturates. **The independent review found a confound, and a check confirmed it** [code✓]: in 2026-02, exactly at the point where retail drops, τ²-bench changed **both its version (0.1.3 → 1.0.1) and its user simulator (gpt-4.1 → gpt-5.2)**. The longitudinal "retail 0.53 → 0.25–0.35" therefore cannot be separated from saturation.

Within one version (1.0.1, gpt-5.2 simulator), ICC as a function of pass^1:
- **telecom:** 0.57 → 0.41; 0.85–0.87 → 0.08–0.27; ≥0.90 → 0.03–0.22. Consistent with saturation.
- **retail:** 0.20–0.39 at pass^1 0.72–0.84, no gradient.
- **airline:** grows with pass^1 (0.53 → 0.32; 0.81–0.84 → 0.53–0.67). **Against** the saturation hypothesis.
- **banking_knowledge:** 0.55–0.61, pass^1 0.22–0.40.

**What held [code✓]:** with one version and one simulator, ICC differs consistently between domains: telecom ~0.05–0.3, retail ~0.2–0.4, airline ~0.5–0.65, banking ~0.55–0.6. **What is not shown [hyp]:** that the cause is saturation. Domain properties are also possible, for example the share of fundamentally unsolvable tasks. A bimodal alternative to the null model was not tested [?].
The null model (`measurement/null_icc_vs_ceiling.py`) still stands as a check of the estimator: with a constant true ICC the estimator is not biased near the ceiling up to μ≈0.95. So the low values in telecom are not an artifact of the method.

## What this means for the calculator
Based on this measurement, the calculator was recalibrated:
1. The "Terminal tasks" preset 0.66 was refined. ICC is a property of the "model × task difficulty" pair, not of the model. The presets are now 0.59 for tasks where the agent succeeds in 70–85% of attempts (TB 2.1) and 0.49 for hard tasks, 10–50% (TB 4.0). The old 0.66 (TB 2.0) is kept as a historical reference point. ⚠️ The link between ICC level and difficulty is [hyp] (three clean pairs); the values 0.59 and 0.49 themselves are [code✓] as corpus medians.
2. The meta description range "ICC 0.53–0.67" was widened to cover four corpora: 0.49–0.67.
3. A note was added: ICC depends strongly on the task type (on τ²-bench from ~0.05 to ~0.65 within one benchmark version). The default is a reference point; it is better to measure your own ICC (the calculator has a "Measure your own ICC" block for this).

The calculator's main claim held on the fourth corpus. What was needed was a recalibration of the presets and a caveat about saturation.

## Limitations
- TB 4.0: 66 tasks, per-model CI ±0.12–0.2. 7 of 330 Fable 5.1 trials ended in an error and were counted as 0 under the leaderboard rules [secondary].
- One agent configuration per model (effort max/high, its own harness). The harness effect is not separated from the model effect.
- Harbor Hub per-trial data was not downloaded for cross-checking: the reconstruction from pass@k is mathematically exact, but a check on raw trials was not done.

## Open questions
- GPT-6 Astra: not measured yet; will be possible once a submission with retries appears in the TB 4.0 `leaderboard/submissions`.
- TB 2.1: how disqualified trials enter pass@k (deviation from an integer up to 0.26).
