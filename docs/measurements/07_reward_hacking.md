# Reward hacking as a mechanism of retry correlation

> 2026-09-30. Hypotheses and criteria were fixed before the analysis. Code: `measurement/analyze_h17_reward_hacking.py` → `measurement/h17_result.json`. Labels: `measurement/tb21_reward_hacking_tasks.csv`. Passed an independent adversarial review (its comments are addressed below).

Markers: [code✓] computed by our code; [primary] primary source; [secondary] secondary source; [hyp] hypothesis; [?] unverified.

## Verdict
**H0: not rejected [code✓].** Removing the 33 tasks with TB 2.1 hacking labels lowers the TB 2.0 ICC no more than removing 33 random tasks matched on success rate.

**Precise wording (after the review):** the labels were transferred from other models as a task property, and at this power no effect of hackable tasks beyond the null was detected. **A large contribution is ruled out**: even at the upper bound of the interval the excess over the null is ≈ +0.026, which is ≈ 4% of ICC 0.667. **A small contribution (0.01–0.026) is not ruled out.** This is not proof that hacking has no effect on the correlation at all.

## Numbers
Corpus: 89 tasks · 9,384 cells · 51,741 runs · ICC(all) = 0.6669 (numbers recomputed on a clean download of the corpus on 2026-10-13; see the correction note in `docs/DATA_PROVENANCE.md`). This matches the independent JS calculation in `05_benchmark_defects_tb20_vs_21.md` — a self-check of the formula.

| Test | Excluded | Δ ICC | 95% bootstrap | Null: median / 95th pct. | p | Outcome |
|---|---|---|---|---|---|---|
| **Main: H33** | 33 | +0.0122 | [−0.013, +0.038] | +0.012 / +0.026 | 0.48 | H0 |
| S1: labels in ≥ 2 submissions | 19 | +0.0049 | [−0.010, +0.022] | +0.001 / +0.011 | 0.27 | H0 |
| S2: without the 14 fixed tasks, null drawn from unfixed tasks | 19 | +0.0047 | [−0.021, +0.033] | +0.007 / +0.024 | 0.59 | H0 |

S3 — ICC within subsets: hackable 0.660 versus the rest 0.655; without fixed tasks — 0.647 versus 0.650.

**Side observation [code✓]:** hackable tasks are harder — mean success 0.283 versus 0.459, 19 of 33 in the two lowest quintiles. Models hack where solving honestly is hard [hyp]. The data do not support the naive mechanism "hacking → stable pass → success near 1 → correlation up".

## Review (adversarial, 2026-09-30)
- The algebra of the vector ICC, the cluster bootstrap, the null and the direction of p were checked — no bugs.
- **Power:** only Δ ≳ 0.03 can be distinguished with confidence. Hence "not rejected", not "absence shown".
- **Transfer of labels 2.1 → 2.0** is the main threat. Hackability is more likely a property of the "model × task" pair than of the task. In that case the test measures transfer noise and is partly uninformative.
- Control by success quintiles correctly removes the "hackable = hard" confounder.
- Minor: in S2 the null pool is small, sampling within quintiles is without replacement; degeneracy within quintiles was not checked.

## What this changes
- The calculator's recipes do not change. "Hardening the grader instead of retrying" is not supported by these data.
- The mechanism behind ICC ≈ 0.67 is still not explained. Hacking as a **large** contribution is ruled out (under the transfer assumption).

## Open questions
- A clean check without label transfer: fetch per-trial TB 2.1 outcomes from Harbor Hub (`trials` in the JSON contains only IDs) and compare cell ICC with and without the labels on the same runs. In the pre-fixed plan this step was conditional ("if Δ is significant"). Its value now is to remove the transfer threat, not to confirm an effect.
- Related work on the "fake difficulty" mechanism: arXiv:2609.26826 (20.09.2026) [primary, found via a literature scan] — a taxonomy of all-fail tasks in TB3.
