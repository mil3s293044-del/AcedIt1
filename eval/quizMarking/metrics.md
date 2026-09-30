# The marking eval

Measures whether quiz marking agrees with a VCE assessor. Built to answer one
question that nothing else in this repo can: **did giving the marker the
examiner profile actually make it mark better, or does it just read better?**

```bash
# once, after reading the harness yourself — this approval is yours, not Claude's
npm run eval:mark -- --model claude-sonnet-5-5 --approve-harness

# thereafter
npm run eval:mark -- --model claude-sonnet-5-5 --reps 3
npm run eval:report
```

Needs `ANTHROPIC_API_KEY`. `EVAL_JUDGE_MODEL` overrides the judge
(default `claude-opus-5-5`).

---

## What it measures, and what it does not

**It evaluates the PROMPT, not the server.** The runner sends the same
`markingSystem(subject)` block and the same per-attempt prompt shape QuizPlayer
sends, straight to the API. Routing through `server.mjs` would need a running
server, a Supabase JWT, the tier gate and the chip ledger — four sources of
noise on a question about marking quality, none of them the thing that changed.

**One question per call**, where production marks a whole paper in one request.
That isolates each case so a grade belongs to one answer. The cost is that this
eval says **nothing about the cross-question `themes` array**, which only exists
on a multi-question paper. Measuring themes needs its own cases, with papers as
inputs and a gold theme list.

**The gold is convention-derived, not VCAA's.** Every case's mark follows from
the mark conventions, command-term definitions and key terminology already in
`subjectExaminerPrompts.js`. That makes the headline *agreement with the
published conventions* — which is exactly what the prompt change claims to have
improved, and is a real thing to measure — and **not** agreement with a real
assessor. Do not report it as the second thing.

Upgrading is one field per case: set `gold_source: "examiner-report"`, add
`cite`, and paste the report's own mark. `evalCases.test.mjs` enforces the cite.

---

## Metrics

Headline is `mark_exact` (the report's headline is the first `binary` metric).

| id | what it is | why it is separate |
|---|---|---|
| `mark_exact` | awarded mark equals gold | The question. |
| `mark_mae` | \|awarded − gold\|, in marks | A pass-rate cannot tell "out by one on a four-mark question" from "out by four". Lower is better. |
| `register` | judge, 0–1 over five claims | The one thing no check can see. |
| `crit_sum` | criteria worths sum to the allocation | The rubric demands it; the app reconciles against it. |
| `quote_ok` | every annotation quote appears **verbatim** | `annotate.js` matches exactly and silently drops the rest, so a paraphrase is feedback the student never receives, with nothing reporting it. Highest-value check here — invisible in production by construction. |
| `link_ok` | every annotation names a criterion in range | An unlinked annotation cannot bill a mark, so the evidence stops pointing at it. |
| `clean_silent` | a full-mark answer gets no comment and no annotations | Catches a right number with wrong writing. |
| `note_ok` | every missed criterion carries a usable note | A missed criterion with an empty note is a mark the student cannot act on — and it is all they get when nothing is quotable. |

**`null` means NOT APPLICABLE and is dropped, never scored.** An MCQ has no
criteria to sum; an answer that dropped marks has no full-marks silence to keep.
A metric that counts its inapplicable cases as passes reports a number that
rises as the set grows.

**The judge never sees the gold mark** and is told the mark is scored elsewhere.
A judge asked to form its own view of the mark becomes a second, unlabelled and
worse gold. Its rubric is five concrete checkable claims, not a 1–5 scale.

### Where the change should show

`tags` carries `discriminating` on the eight cases whose gold depends on a
convention the marker only has now that the profile reaches it — exact form,
misread command terms, a named method ignored, a blank answer, a carried source.
If the profile is doing anything, it is doing it there.

`should_not_dock` is the other half and it is not optional: removing "be lenient
on phrasing" makes a marker stricter, and a set made only of answers that
*should* lose marks would score a marker that fails everything at 100%. Six
cases are tagged `should_not_dock` and seven gold at full marks, including one
riddled with spelling errors and one three times longer than it needed to be.
Five gold at zero, so nothing rewards a marker that simply gives credit.

---

## Noise floor — read this before acting on a delta

For a pass-rate, the noise floor is about `1/sqrt(n · reps)`:

| reps | effective n | ± on the headline |
|---|---|---|
| 1 | 20 | ~22 points |
| 2 | 40 | ~16 points |
| 3 | 60 | ~13 points |

**At 20 cases this eval can see a large change and cannot see a small one.** Run
3 reps and treat anything under ~13 points as noise. If you need to resolve a
5-point tweak, the honest options are more cases or more reps — not a closer
reading of the same run.

The per-tag rows matter more than the headline here: a change that moves the
eight `discriminating` cases and leaves `should_not_dock` alone is the result
you want, and the overall figure dilutes exactly that.

## Cost

Estimated from the block sizes and the published rates, not measured — there was
no API key in the container this was built in.

Per case: a marking call on Sonnet 5.5 (~2,500 cached system tokens, ~300 prompt,
~800 out) plus a judge call on Opus 5.5 (~1,200 in, ~400 out) ≈ **$0.022**.
The system block is a cache *write* on the first case of each subject (~$0.006)
and a read (~$0.0005) thereafter; the set covers eight subjects.

**≈ $0.45 a rep, ≈ $1.35 for a 3-rep pass.** `cost_usd` is derived by the report
from each row's real `model` × `usage`, so the figure in `report.html` is the
one to trust over this paragraph.

## Files

- `cases.json` — the inputs, with gold marks, provenance and the reasoning behind each
- `grade.mjs` — every scoring decision, as pure functions
- `run-eval.mjs` — the runner (scaffold, filled in); resume, backoff, per-case ceiling, served-model assertion, harness gate
- `build-report-lite.mjs` — the report builder
- `src/lib/evalCases.test.mjs` — runs the whole grader offline against fixtures, in `npm test`
- `.claude/hillclimb/quiz-marking/_state.json` — metric and perf declarations

The harness gate refuses to run until a human passes `--approve-harness` once,
recording a sha over the runner, the grader, the cases and the three prompt
modules. Re-approve after editing any of them — that is the point of it.
