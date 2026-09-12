# AcedIt — Claude Code briefing

This file is auto-loaded by any Claude Code session opened in this directory. It is the canonical handoff for the in-progress migration of the AcedIt app off Base44.

## What is AcedIt

AcedIt (acedit.au) is a gamified VCE study app for Australian high schoolers. It bundles AI study tools (essay planner, math tutor, note summariser, concept explainer, English mentor, exam simulator, etc.), quizzes, flashcards, leaderboards, goals, streaks, and XP. ~30 active / ~130 signed-up users on the live site.

## Stack

- **Frontend**: React 18, Vite 6, Tailwind 3.4, shadcn/Radix, framer-motion, react-router 6. JavaScript only (no TS).
- **Local server**: `server.mjs` (Express 5) on port 3001 — proxies Anthropic Claude and hosts ported Base44 functions.
- **Vite dev server**: port 5173. `npm run dev` runs both via `concurrently`.
- **Backend (target)**: Supabase (Postgres + Auth + Storage). Project: `qhwyjycihgtxpzkitmpt.supabase.co`.
- **Auth**: Google OAuth (set up in Supabase, app code still uses Base44 — not yet swapped).
- **AI**: Anthropic Claude (default `claude-sonnet-4-6`, set in `server.mjs:17`). Replaces Base44's metered LLM.

## Migration plan (the "1% diff dual-run" strategy — already chosen)

The app reads/writes through shims that route to either Base44 or Supabase based on a runtime flag, so we cut over per-entity rather than big-bang.

- `src/api/runtimeConfig.js` — toggle (`VITE_USE_SUPABASE` env or `window.__forceSupabase(true)` in console).
- `src/api/entitiesShim.js`, `src/api/functionsShim.js` — route reads/writes/calls.
- `src/api/supabaseClient.js` — Supabase client + `PORTED_FUNCTIONS` list.
- `src/api/_dualRunDevTools.js` — diff helpers.

## Phase status

| Phase | What | Status |
|---|---|---|
| 1 | Local replication of Base44 export | done |
| 2 | UI uplift (Duolingo/Cal-AI vibe, design tokens, page-by-page restyle, LaTeX, streaming) | done |
| 3a | Supabase schema + migrations 0001–0006 | done (applied) |
| 3b | Port Base44 serverless functions into `server.mjs` | **18 of 18 done** (3 challenge + 2 past papers deprecated; admin 3 deferred post-cutover; Stripe 4 ported 2026-05-05 — needs ngrok for webhook testing in dev) |
| 3c | Data migration script + cutover for ~130 users | **done** (132 user_profiles + 42 leaderboards migrated 2026-05-08; smaller entities skipped — users re-select subjects post-cutover) |
| 3d | Swap `AuthContext.jsx` from Base44 to Supabase Google OAuth | **done** (2026-05-08; dual-run via `shouldUseSupabase()` toggle, Base44 path preserved for rollback) |
| 4 | Capacitor wrap → iOS app via Xcode | future |

## The AcedIt ATAR

The flagship score everything else is standardised around. 0–99.95, trailing 28
days, **not** a VCAA prediction and the UI says so wherever it appears. Computed
in `computeAcedItATAR` (`server.mjs`), stored on `user_profiles.acedit_atar` +
`atar_components`, mirrored to `leaderboards`.

Mastery 28% · consistency 27% · effort 22% · breadth 13% · planning 10%.
Unranked under 3 study days. Planning is goals set-and-met, planned blocks kept,
prep started before an assessment, and declared study intents actually followed
— its weights live in `computePlanning`.

Every component reports the evidence behind it in `atar_components`, and Ranked
renders it under each bar. If you add a component, add its counts too — a bare
percentage tells a student nothing they can act on. `planningEvidence` in
`src/lib/atarBands.js` is the one wording, shared by Ranked and AtarPanel.

Two traps this component has fallen into already, both fixed 2026-08-28:

- **Read every table the behaviour lands in.** Pomodoro, active recall,
  blurting and spaced repetition write to `study_techniques`; only quizzes and
  the activity tracker write to `study_sessions`. Planning read just the latter,
  so kept blocks, prep and kept intents all scored near zero for students who
  used the Study page — the exact "planning is 22" the Ranked comment cites.
- **Never score a student on a signal they can't reach.** Prep is only
  applicable once an assessment is on the calendar and its lead-up has begun;
  its weight is redistributed when there isn't one, rather than banked as a
  zero. Same rule for grading an assessment that's still two weeks out.

- **`xp_awarded > 0` is not "did they study".** All five components read one
  predicate now: an event counts if it paid XP *or* was capped. The caps govern
  the XP economy, not the study log — `awardXPIncremental` says as much where it
  writes the row ("capping the payout must not stop the counting") — so gating
  on payout quietly deleted a student's *best* days from consistency, effort,
  mastery and breadth. A zero-content session (raw XP zero, uncapped) still
  doesn't count; there's no work in it to measure. Velocity-capped rows count
  too: 600 XP/hour is reachable honestly with a 2× streak on a long session.

Effort totals minutes per day and clamps each day at `EFFORT_DAILY_MINUTE_CAP`,
because `duration_minutes` comes from the client. The daily XP cap used to bound
this incidentally, and badly — where it landed moved with the student's streak
multiplier. And every window query pages (`fetchAllRows`): an unordered
`.limit(n)` on `xp_events` handed heavy users an arbitrary prefix of their own
log, which cost them breadth, effort and mastery at once.

Client mirror of the band thresholds is `src/lib/atarBands.js`. Server is the
source of truth; keep them in sync.

## Quizzes: parts, ink, and itemised marking

**`quizSchema.js` is an adapter, not a format.** VCAA questions come in parts —
a stem, then (a), (b), (c) worth different marks. 76 places across thirteen
files read `.questions` and QuizPlayer alone branches on `type === 'mcq'` 41
times, so nothing branches on "is this the new shape": `normaliseQuestion`
turns BOTH into a stem plus one or more parts, and a legacy question becomes a
stem with a single unlabelled part.

**Answer keys are load-bearing.** Every attempt ever saved keys answers by
question index (`user_answers[3]`). A single-part question therefore keeps the
bare index — "3", not "3a" — or every existing attempt reads back as
unanswered. Only genuinely multi-part questions suffix.

Marks are the currency: score is a percentage of marks available, not of
questions answered, so a four-mark part b counts double a two-mark part a.
Three places used to compute a question's allocation by hand as
`q.type === 'mcq' ? 1 : (q.marks || 5)` and all three read 5 for a multipart
question worth nine — they go through `normaliseQuestion(q, i).marks` now,
which returns exactly the old value for a legacy question.

**The player branches ONCE.** `MultipartQuestion` owns the whole part-shaped
screen — stem in a quieter box, parts stacked below with the allocation
right-aligned the way a paper prints it, textarea rows scaling with the marks.
Everything else stays on the path it always took, which is why this cannot
reach the quizzes that already exist. Marking stays ONE entry per question with
the parts laid out inside the prompt, because the score, the feedback array and
the attempt row are all indexed by question.

Only the main generator (`handleGenerateQuiz`) emits parts. Reshuffle still
produces flat questions.

**Annotations point at characters, and an unquotable one is dropped.** The
marker returns a verbatim `quote` from the student's answer; `annotate.js`
finds it by EXACT string match and underlines only those characters, in place,
in their own paragraph. No fuzzy matching — underlining the wrong six words and
saying they cost a mark sends a student to rewrite a sentence that was fine and
costs the next annotation its credibility. Overlaps are dropped for the same
reason.

**An annotation POINTS. It does not hold the feedback.** It used to: what the
assessor wanted, the rewrites, and the save button all lived in a note that
opened on hover. Two failures came out of that and neither was tunable. The
note is portalled to the body, so reaching toward the button left the phrase
and closed it — you could see the save button and not get to it. And a mark
with no quotable phrase had nowhere to put its explanation at all, which is
backwards: "does not name the transfer" is unquotable precisely because the
words are absent, so the marks that most needed explaining were the ones with
a single line and no button.

All of it lives in `MarkModule` now, which is simply on the screen. The
underline opens a small label — which mark this belongs to, what it cost — and
tapping it scrolls to that module; pointing at a module's quote scrolls the
other way. The label is `pointer-events-none` and holds no action, so there is
nothing to catch. Content you need is never behind something that disappears
when you reach for it.

Still PORTALLED and positioned `fixed` from a measured rect, because
`position: fixed` resolves against a transformed ancestor and framer-motion
leaves an inline transform on every animated section here. AceRoam's header
records the same lesson. The old note's three-case viewport clamping went with
the note — a label two lines tall only needs below-else-above.

`wanted` is what the assessor was looking for, and it is ONLY ever a real
statement of what would have scored. It used to fall back to the criterion's
note, which is the examiner's remark on what went wrong, so a block headed "the
assessor wanted" printed a criticism — telling the student to write the
diagnosis. The criterion text is itself the statement of what was wanted and it
is already the heading.

The marker writes like a VCAA examiner's report: it addresses the RESPONSE and
not the student, names the command term when the answer misread it, gives no
praise, and says what a full-mark response would have contained.

An annotation was a strikethrough over the whole phrase, off in its own card.
Both were wrong: a strikethrough means DELETE THIS when the point is LOOK HERE,
and lifting the phrase out of the paragraph loses the thing that makes it land.

**The Quizzes hero and the shelf under it share one calculation**
(`quizzingSummary`, beside `quizDeckStats`). The hero computed its own inline
and disagreed with the deck faces three ways, all of them visible to a student:

- **The adjusted score.** The faces read `effectiveScore`; the hero read the
  raw `score`. A student who marked their own written work saw the results
  screen say 78%, the deck face say 78%, and the panel above both say 60% —
  the exact failure quizDeck.js's own header describes, on the one surface
  that had never been fixed.
- **An unscored attempt is not a zero.** `sum + (a.score || 0)` counted an
  attempt whose marking never came back as nought and divided by it anyway.
- **"Last 5" has to mean the last 5.** Attempts were ordered on `date`, which
  is written as a DAY, so every sit in one afternoon tied and the winner was
  whatever order PostgREST returned. Ordered on `created_date` now, and the
  label says what it actually averaged rather than promising five.

The second tile is TREND, not "best score all time". A personal record only
changes when you beat it, so it sat unmoved for weeks, and it is set on your
easiest quiz by construction — a trophy, not a measurement. `trend` differences
the last five against the five before, needs `TREND_MIN` on BOTH sides (one sit
either way is the difference between two papers, printed as a direction), and
is null rather than 0 when there is not enough — 0 means "holding steady" and
must not double as "I don't know yet". The tile says how many more sits unlock
it rather than printing a dash forever.

Attempts on a DELETED quiz still count: deleting a quiz does not delete its
attempts, so "all time" spans quizzes no longer on the shelf. That is the
intended reading — losing your best score because you tidied your library is
the worse failure — but it is why the hero's best can exceed every face below.

**A "wrong only" retry is not a sit, and four readers treated it as one.**
The retry button plays the questions you missed as a quiz of their own, so its
score is on a different scale (it is made of your hardest questions by
construction) and its answers are keyed by their positions IN THE RETRY. Every
consumer that read it as a normal attempt got something visibly wrong:

- `retrievalStrength` took it as the quiz's latest result, so the fading list
  read "Mathematical Methods — wrong only · 0%" — a student who had just done
  the right thing, told their retention had collapsed, under a renamed quiz.
- `quizDeckStats` read `user_answers` against the PARENT question array, so one
  press of retry made every number on that deck face arbitrary from then on,
  and pressing it again served a set chosen at random.
- The Quizzes greeting and the "run it back" strip averaged it in: "You scored
  0% last time" printed directly above a card reading 60% BEST.
- `weakSpots` attributed the miss to whatever question held that index in the
  parent, and `buildDrillQuestions` then drilled it.

New attempts carry `extra.is_retry` and record the PARENT index (`_sourceIndex`
rides on the question). `isRetryAttempt` also matches the title suffix, which is
the only trace older retries left; `isLegacyRetry` is the ones whose indices
cannot be trusted and are skipped rather than half-believed. The split rule
everywhere: a retry COUNTS as activity ("3 tries") and never as a MEASUREMENT
(best, average, last score, what is left to fix).

**One page, one next move.** Quizzes carried five: a mistake-bank panel, a
"next quiz" strip, and a three-panel rail (losing marks / command terms /
fading fastest). Each was defensible alone; together they were five headings
answering the same question differently, and choosing between them is work the
app was supposed to have done. The rail is ONE panel now (`workQueue`), and the
command-term breakdown moved to /MistakeBank, which is the diagnosis screen.

Order inside it is by KIND, deliberately: a question missed twice is EVIDENCE,
a fading quiz is an ESTIMATE off a curve fitted to nobody's data. Blending them
would mean inventing an exchange rate between the two and printing it as though
it were measured, so evidence sorts first, each half sorts by its own measure,
and a line between them says which is which.

**A MISTAKE AND A QUESTION ARE DIFFERENT SIZES, and they get different
treatment.** The bank is for small specific errors — a criterion the assessor
wanted, a phrase that cost a mark, a wording the marker flagged. Those you can
drill in thirty seconds and rehearse on a schedule. A whole exam question is
not that; it is a SIT.

They were briefly the same thing. `autoBankRows` wrote a repeatedly-missed
question into the bank as a card, which gave a phrase-sized ladder to an
exam-sized thing, wrote rows on page load, and stored a clipped copy of the
stem as the card's criterion — which the runner prints as its heading, so a
long question arrived on screen cut off mid-word. It is deleted.

`redoQueue` replaces it and stores NOTHING. Which questions need re-sitting is
a fact about the attempt history, which is already loaded: questions missed
more than once, and questions carrying banked mistakes that have never been sat
clean. Derived, so it cannot go stale, double up, or disagree with the marks it
came from. /MistakeBank is two tabs — Fix is the drilling, Sit again is the
proving — and a re-sit plays through the existing retry path, so its results
land with parent-relative indices like any other attempt.

**A BANKED MISTAKE IS A FLASHCARDS ROW AND IS NOT A FLASHCARD**, and nothing
enforced that until it had leaked everywhere. `deckCards` (mistakeBank.js) is
the filter every DECK surface reads through — the shelf, /Review, Study, the
dashboard's due counts and retention, the exam/blurting/recall builders,
Analytics, sharing. Without it a "Mistake bank" deck sat on the flashcard shelf
beside Chemistry, its cards counted toward due totals and the forgetting curve,
and the exam builder was willing to ask a question made of one marker's note
about a phrase.

Applied at the READ, per surface, rather than inside the shim: /MistakeBank and
the Quizzes hero genuinely want those rows, and a global exclusion with an
opt-out is the kind of magic that silently empties a screen a year later. Two
reads are deliberately NOT filtered — the data export and account deletion,
which are about everything the student owns rather than about decks.

**The mistake bank is flashcards with a marker** (`topic: "Mistake bank"`), so a
banked mistake comes back through the SM-2 engine that already exists rather
than sitting in a list nobody opens — same move blurting's `makeCardsFromMisses`
already makes. The card asks for the FIX, never for the mistake; a card that
rehearses the error is the opposite of the point.

**Every mark a student can see, they can save.** One builder, `cardFromModule`,
over a mark rather than over a quote. There were two — one for a quoted phrase,
one for a missed criterion — and only the phrase one was ever wired up, so the
unquotable mistakes had no button. A lost mark NEVER fails to make a card: with
no fix and no `wanted`, the criterion text is a legitimate back, because it is
already phrased as what the assessor was looking for. A surviving imprecision
still needs a fix, or the card has no back at all.

Banking is keyed `q{index}:{criterion}` and guarded by a ref, not by state. Two
questions on one paper can genuinely drop the same criterion and both are worth
rehearsing, which the old bare-quote key made look already-saved; and a second
click landing in the same tick as the first read `banked` before React had
updated it and wrote a duplicate. The button also says *saving* until the row
exists — it used to claim saved before the write and roll back on failure.

**`/MistakeBank` answers "am I actually fixing these?"** — not "what did I get
wrong", which is a guilt list and a screen nobody opens twice. The headline is
a fraction of what is FIXED, the bar shows the pile shrinking, and repeats are
called out because a student told they have dropped one criterion four times
has one thing to fix instead of four.

**REHEARSAL IS NOT PROOF, so "fixed" has two levels.** The SM-2 counters
measure whether a student can recall what the assessor wanted, on a card, in
isolation, after being reminded four times. That is worth measuring and it is
not what a SAC asks — so clearing the ladder makes a card `drilled`, not fixed.

`ladderDone` reads `repetitions`, and both halves of that matter. It asked for
two consecutive good recalls, which did not mean what it said: SM-2 keeps
`consecutive_good` and `consecutive_easy` as SEPARATE streaks and each rating
resets the other, so a student who rated a card Good then Easy — two clean
recalls, the second better — sat on a maximum streak of one and could never
finish. And two recalls only puts a card on the SECOND rung, so a mistake could
be called rehearsed having never been asked to spot the error in its own
sentence or rewrite it. `LADDER_COMPLETE_AT` comes from drill.js, so "passed
every module" and "which rung am I on" cannot disagree.

A MISTAKE is fixed when it has cleared the ladder AND a later sit of its own
question recorded its criterion as earned. A CASE — one question and every
mistake on it — is closed only when all of them are fixed AND a later sit
scored FULL MARKS, because a student can earn the criterion they drilled while
dropping a different one in the same answer, and calling that finished is the
trade the screen refuses.

The evidence comes from `extra.question_results[].criteria`, which the player
now records: the marking already produced the per-criterion verdicts and was
throwing them away. `clearedBy` matches criterion text exactly, then by
containment of at least twelve characters — the same refuse-rather-than-guess
rule `criterionIndexFor` uses, because crediting a student with a fix they did
not make is the one error this screen exists to prevent. A card with no source
question (every card banked before the gate existed) reports on the ladder
alone rather than being held one rung short forever.

Slipping is their LAST answer, not their history, so a card with four early
lapses since recalled twice reads as going the right way.

**A fixed mistake can be cleared out, and is asked about ONCE.** `start`
snapshots which cards were already fixed, so the prompt at the end of a run
names only what that run finished — a prompt on every visit is nagging, and a
pile that never empties makes the headline fraction meaningless.

Clearing writes `retired_at`, the field /Review already uses for "I know this",
and its reasoning holds exactly: the only other exit from a review queue is
`is_active: false`, which destroys the card, so a student who had genuinely
fixed something had to choose between being asked forever and losing it before
revision week. The card survives, leaves every queue in the app (due.js reports
`known` before it checks anything else), and comes back with one tap — which is
the only reason this is safe to offer on a routine screen. `clearedCount` is
lifetime, so an emptied bank still says what it was.

**The bank is a shelf: subject, then topic.** A flat list has one order, worst
first, which is right for "what next" and wrong for the other thing a student
does here — sit down before a SAC and work on ONE subject. Every level plays
what its own count says, and that count is READY rather than total: "Review 6"
that turns out to be one card due and five scheduled next week is the small lie
that costs this screen its credibility. Topic comes from `extra.mistake.topic`,
never the card's `topic` field, which is the constant "Mistake bank" and has to
stay that way or the review shelf splits the bank into a deck per quiz.

**The ladder is visible now** (`LadderTrack`). It was the most useful thing
about the bank and completely hidden: a student saw one exercise, rated it, and
had no way to know whether that was the first of two or the fourth of five. A
rung this card can never build — no quote means no spot — is struck through
rather than left pending, and struck-through steps come out of the denominator,
or a card with two reachable rungs caps at 40% and reads as permanently
unfinished.

READY IS NOT DUE. `due.js` counts a never-reviewed card as *new* on purpose —
a fresh sixty-card deck must not report sixty overdue. But a mistake banked an
hour ago is not unopened material; the student got it wrong this morning. The
page passes "due or new", so a bank with five mistakes never opens on "nothing
due today", which is the dead end the screen exists to avoid.

**The bank DRILLS, it does not show you the answer.** A two-sided card is
RECOGNITION, and recognition feels like learning because the answer looks
familiar when you see it — the exact illusion the landing page calls out by
name. So a mistake gets harder as the student gets it right (`drill.js`):

  RECOGNISE  first time. What they wrote, what would have scored. There is
             nothing to retrieve yet; asking somebody to produce a wording
             nobody has shown them is a test, not a drill.
  SPOT       their own sentence, with the words that cost the mark to be found
             in it. The first rung asking for a JUDGEMENT rather than a memory,
             and the only one that works on their words rather than a model
             answer — which is what makes it transfer, because in a SAC nobody
             has underlined anything.
  CLOZE      the model wording with the load-bearing terms removed, and those
             same terms as the word bank. No invented distractors — every word
             belongs in a gap, so there is nothing to eliminate by feel.
  REPAIR     their sentence, editable, rewritten so it would score, marked by
             the model against that one criterion. Production anchored to what
             they actually wrote: a smaller and fairer ask than a blank box,
             and it teaches the edit rather than a replacement text.
  REDO       the whole question again, marked. NOT a rung — it is the gate past
             the ladder, and it lives in `clearedBy` because it is evidence
             rather than rehearsal.

The rung is read off `repetitions`, so nothing new is stored and a lapse drops
the card back down the ladder WITH the scheduler rather than leaving it hard
while its interval collapses. `keyTerms` blanks what the CRITERION turns on —
words in both the criterion and the answer — never a stopword, never the
opening word (a passage that starts with a hole has no context before it), and
three gaps at most.

`buildSpot` is a word diff between the quote and what would have scored: the
words in one and not the other are exactly what the mark turned on, so nothing
is generated and nothing is guessed. Two limits, both learned from the render:
the FOUR most load-bearing differences only (longest-first, the same proxy
`keyTerms` uses), because a casual sentence against a tight model phrase
differs almost everywhere and flagging six of eight words is not a drill; and
never more than half the sentence, because "most of this" is a rewrite, which
is the rung above. `gradeSpot` counts a wrong tap against a right one, or
tapping everything wins.

**A rung that cannot be built falls back rather than degrading, and the
fallback CASCADES** — no quote means no spot, and if the wording also has
nothing blankable it keeps falling to recognise. Checking one level down and
stopping renders an empty exercise.

The model SUGGESTS a rating and highlights that button; the student still
presses one. An app that schedules a card off its own verdict has taken the one
judgement only they can make — whether they knew it or guessed. A failed
marking call is not a dead end either: the model wording appears and they rate
themselves, which is the rung below.

The review runs ON the page. A review screen that sends you elsewhere to review
is not one. It grades through `sm2.js` — `calculateNextReview`, the rating
scale and `reviewPatch`, moved out of SpacedRepetition.jsx unchanged for
exactly this, the same move `mastery.js` already made. Two schedulers for one
card is how an app starts disagreeing with itself. `reviewPatch` names the
columns so the derived `_mastery_score` cannot reach a table with no column for
it — PostgREST rejects the whole row and the student loses the rating.

Provenance rides in `extra.mistake` (criterion, quote, question, cost), because
grouping by criterion cannot parse it back out of question prose that will be
reworded. Cards banked before it exists still count, still review and still
show their state; they just cannot be grouped. And `unit` is CONSTANT — the
shelf keys decks on subject|topic|unit, so putting "Lost mark" there split one
student's bank into two decks per subject.

**Handwriting goes to `VISION_MODEL`**, not the prose default — Saver included.
A downgraded model produces a wrong transcript and the transcript is what gets
MARKED, so the saving comes out of the student's marks. Mathpix's `v3/strokes`
endpoint takes the exact shape `ink.js` already produces and is purpose-built
for this; it is not wired up, and doing so needs an account and a key.

**Marking is itemised, and the itemisation is the truth.** `quizMarking.js`
returns criteria (what the assessor wanted, each got or missed, each worth n
marks) and edits (word-level swaps in the student's own words). If the model
states a total that contradicts its own criteria, THE CRITERIA WIN and the
number is recomputed — a total that visibly disagrees with the list under it
costs the marking all its credibility. The denominator always comes from the
question, never from the model, or a marker can silently rescale a score.
`MarkPanel` renders it with the landing page's own pen strokes (`PenMarks`,
extracted from `MarkedWord` and put on design tokens). It REPLACES the prose
panels rather than joining them — the same finding stated twice is worse.

**THE CRITERIA ARE THE LEDGER. Annotations are evidence for it, never a second
verdict.** They used to be two independent judgements and they contradicted
each other in front of the student: the criteria said which marks were dropped,
and the annotations, chosen separately by the model, put "Cost a mark −1" on a
phrase with nothing forcing agreement. A clean 3/3 could sit directly above a
sentence underlined in red and told it cost a mark. So `linkAnnotations` binds
every annotation to a criterion, and the link decides what it may claim —
missed criterion → it cost exactly that criterion's marks; earned criterion →
imprecise, cost nothing; linked to nothing → it may not bill a mark it is not
attached to. Marks lost is the sum of the missed criteria and nothing else,
which is `outOf - marks` by construction, and every "costing you" figure on the
screen comes off that one subtraction (`markLedger`).

`criterionIndexFor` REFUSES rather than guesses — index, then exact match on
normalised text, then containment of at least 8 characters. Unlinked is safe
and visible; mislinked blames the wrong mark, which is what the join exists to
prevent. Watch `Number(null) === 0`: coercing the index attached every unlinked
annotation to the first criterion on the page, silently and plausibly.

**The ink pad holds one line.** Write a step, it is recognised, it lifts off
the pad into the typeset stack above, the pad clears. That is the whole
anti-crowding design: nothing accumulates on the writing surface. Recognition
is Claude vision over the upload path that already exists — no new dependency,
nothing new on the server. A small in-browser digit model was the alternative
and it handles isolated digits and nothing else: no fractions, roots, integrals
or superscripts, which is to say it fails on exactly the maths this is for.

Every recognised line stays editable before submission. A student marked down
for the transcriber's mistake would be invisible to us and infuriating to them.
The transcript is what gets marked; the strokes are session-only, because the
saved answer is a plain string like every other answer.

## A blank page is a missing error boundary

**"I click a page and it's just a blank screen; refreshing loads it."** That is
a dynamic import that REJECTED. The 24 pages are code-split, so a navigation
fetches a chunk; when the fetch fails the lazy promise rejects, and with NO
ERROR BOUNDARY ANYWHERE IN THE APP React unmounted the whole tree — nav, rail,
theme — leaving white. The refresh works because it re-fetches `index.html` and
gets the current chunk names.

Which is usually the cause: a DEPLOY. A student holding an open tab has an
`index.html` naming `Dashboard-a1b2c3.js`; a deploy replaces it and deletes the
old file; their next navigation asks for a file that no longer exists. On a
site that ships often, every open tab is one navigation from a white screen.

`lazyPage` (`src/lib/lazyPage.js`) retries once after 400ms — which alone fixes
the transient case invisibly — then reloads, ONCE, guarded by `sessionStorage`.
The guard is not optional: an unguarded `location.reload()` on a chunk that is
missing for any reason a reload cannot cure spins forever, and the app goes
from broken to unusable and unreportable.

`PageErrorBoundary` catches everything else. `resetKey` is the current page
name, and that matters more than it looks: without it a boundary that has
caught once keeps rendering its fallback, so one bad page makes every OTHER
page look broken until a refresh — turning one failure into a broken app.

**Keep the `import()` a literal.** Rollup only splits on a static
`import('./pages/X')` it can see; a variable or template path silently
collapses all 24 pages into the main bundle, the build still succeeds, and
nothing notices. `routes.test.mjs` asserts it, along with the `lazyPage` name
argument matching its file — a wrong name there is invisible until the failure
path lies about which page failed.

## Compete is ONE object: a market

**Seven nouns all meant "a thing you can win"** — battles (`goal_competitions`),
duels (`study_duels`), call-outs, forecasts, progress bets, back-yourself bets
and the weekly league. Seven mental models, seven card shapes, 6,700 lines
across 24 components and a 1,087-line page. A student had to learn all seven
before they could do anything, which is why the page read as confusing however
it was styled. **Restyling seven objects gives you seven prettier objects.**

Polymarket's real lesson is not the look. It is that there is exactly ONE
object: a question, a price, a side, a resolution. You learn it once and
everything else is a variant. So a battle is a market on who wins it, a duel is
a two-outcome market, a call-out is a market with a clock, a SAC is a market on
a number, and hours and streaks are markets on a study log. `MarketCard` is the
only card; `src/lib/market.js` is the only model.

**THE PRICE IS THE CROWD, AND BEATING IT IS THE GAME.** `forecast.js` scored a
student against the HOUSE's base rate, which was right maths and the wrong
shape — a house number is not a market. The base rate is now only the PRIOR,
and you are scored against the price the crowd had reached when you took your
side. That one change is what makes it a market: the price means something,
early information is what pays, agreeing with it pays EXACTLY ZERO so nothing
is farmable by repetition, and no counterparty is needed — which matters
enormously at thirty active students, where a real order book would sit empty
and every market would read as broken.

The rule stays proper and `market.test.mjs` sweeps it to prove so. **K is 1 and
there is no clamp**, carried over from forecast.js where it was learned the hard
way: with the loss floored, extra confidence past the floor is free and the rule
goes improper in the tails.

**THE FIRST POSITION IS NOT THE PRICE.** `PRIOR_WEIGHT` is a pseudo-stake, so
one student putting 10 on 95% cannot move a market to 95¢ and have the next
person read one teenager's guess as a consensus — then be scored against it.

**YOU MAY NEVER HOLD A PAYING POSITION ON A MARKET YOU RESOLVE.** One rule,
stated about WHO rather than about which feature, and it closes the whole class
the old wagering layer died of:

- A **SAC mark** is reported by the student, so the student cannot back it.
  Their line is public and everybody else trades it — which is a better game
  anyway: being read by twelve people is more motivating than being paid for a
  number you typed. This is what makes real marks bettable at all.
- A **call-out's** caller and target decide its outcome, so neither may hold.
- A **battle's** competitors decide the standings.
- But a market on your own **study log** IS allowed, deliberately: the app
  measures that itself under the service role with the integrity caps on top.
  Betting you will study five days and then doing it is the product working.

**Cred, not XP and not chips.** XP drives level, rank and the ATAR, so staking
it makes the rational play "never bet" — a market where abstaining is optimal
is not a market. `chips.js` is already the weekly AI budget, so that word was
taken. Cred is granted weekly (`CRED_WEEKLY_GRANT`) and capped
(`CRED_BALANCE_CAP`); the Monday grant is a reason to come back that is not a
streak, and the cap stops a student who ignored Compete for a term arriving
with an unanswerable stack. It is TOPPED UP to the grant rather than added to.

**A MARKET ABOUT YOU SORTS FIRST, whatever its heat.** "Twelve people are
trading your week" is the single most motivating sentence this app can put on a
screen and it is most of why this can be a retention engine rather than a
leaderboard. Otherwise the board is sorted by heat — conviction on the table
plus a clock running out — never by recency, which would put an untouched
question above one four people are arguing over.

**It is a different ROOM, on purpose.** Literal ink, not tokens: the focus-mode
lesson arrived at from the same direction — a token that flips underneath a
deliberate inversion is the bug, not the fix — so the floor renders identically
in both themes, which is the point. The brand green stays YES and the streak
red stays NO so the two colours a student already reads as good and bad mean
the same things here. Third place on the league board taught the matching
lesson: `streak` red on a podium read as a warning.

**Minting is automatic, because an empty board kills a market site.** The first
person to arrive on Monday must find something to trade, and "create the first
market" is work nobody does. Two questions per student per week, minted on
demand, deduped by a unique index on (kind, subject, period, ref) so two
students opening the board in the same second cannot post the same question
twice with the stakes split between the copies.

**Settlement is lazy and recomputed.** No cron here — the sweep runs whenever
somebody opens the board, the same design the weekly league commits to. THE
OUTCOME IS RECOMPUTED FROM THE STUDY TABLES AND NEVER ACCEPTED FROM A REQUEST
BODY. A market past its close with no answer stays OPEN rather than resolving
false by default: resolving a question nobody could answer is worse than
leaving it hanging. A void returns every stake whole.

**The escrow is unwound on failure.** The stake is taken before the row exists
and there are no transactions across PostgREST calls, so a failed insert
refunds — `placeForecast` destroyed real XP for months by not doing exactly
this, and the refund is written DIRECTLY rather than through `awardXP`, which
is cap-bounded and would quietly keep part of it.

**What went, and what was kept.** Deleted: 26 components and `competeFeed.js`,
`forecast.js`, `portfolio.js` with their tests — all superseded, zero importers,
and `market.test.mjs` carries its own properness sweep so nothing was lost.
Kept: `integrity.js` (the server implements the same caps), `StakesPill` /
`useStakes` / `arenaMeta` (Layout, the nav and Study read them), and
`arenaHelpers` (League uses `Countdown`).

**The server endpoints for the seven old objects are deliberately still there.**
There may be battles, duels and call-outs mid-flight with real XP in them, and
deleting a settlement path would strand them. They are simply unreachable from
the UI now, so the old objects drain naturally — and the `callout` and `battle`
market kinds read those same tables to resolve, which is the point: the old
objects became market SUBJECTS rather than separate features.

**THE REVEAL IS THE TWO NUMBERS, NOT THE CRED** (`SettlementReveal`). Every
other thing on the floor pays out visibly — the price moves while you watch,
the payout rolls as you drag — and the one place with a REAL result was a line
on the tape. What makes this different from any other betting screen is that
you were scored against WHAT EVERYONE ELSE BELIEVED, so the centre of the card
is "you said 85, the room said 62" and the cred is the consequence printed
under it. Lead with the payout and it is a slot machine; lead with the
disagreement and it is a read you got right.

`edgePoints` is ABSOLUTE error where the payout is squared, deliberately: a
student can check "23 points closer" by subtracting two numbers both printed on
the card, which they cannot do with a Brier difference. Its sign can never
disagree with the payout — |a| < |b| exactly when a² < b² — and a sweep pins
that, because a screen praising a call that lost cred would be the worst
possible version of this.

FOUR CASES, not two. `level` (you agreed with the price, so it paid exactly
zero) and `void` (nothing was tested) are real outcomes and both would read as
a defeat if collapsed into `lost` — and drawing "restating the price pays
nothing" as a loss teaches the wrong lesson about the one property the whole
system rests on.

**A LOSS DOES NOT PERFORM.** The read STAYS on a loss — it is information, and
the one thing that helps somebody call the next one better, so hiding it would
be less kind rather than more. What goes is the staging: a win reveals in
steps with confetti and a count-up, a loss arrives all at once and waits. Every
delay runs through one `step()` that returns 0 unless it is a win, so a new
element cannot accidentally stage on a defeat.

It fires ONCE and is marked seen ON ARRIVAL rather than on dismissal — a
student who closes the tab has still had the result put in front of them.
`unseenSettlements` owns the seen-set so the rule lives with the model, and
blocked or absent storage counts as already-seen: `recent` re-reports resolved
markets forever, so without the guard opening the floor would replay a
student's whole history of losses at them every time.

## `invoke` returns AN ENVELOPE, and reading it as the payload is invisible

`functionsApi._invoke` returns `{ data, error }` — deliberately, to match
Base44's SDK envelope through the dual run. So this is wrong:

```js
const res = await base44.functions.invoke("getMarkets", {});
if (res?.error) throw new Error(res.error);
setData(res);                         // ← the envelope, not the payload
```

Every field the page then reads is `undefined`, so it renders its EMPTY STATE
and looks like a feature nobody is using rather than one that is broken.
`res.error` is `null`, so the guard passes and **nothing anywhere reports a
problem.** That is what makes it dangerous.

It shipped twice in one session without being noticed: the League board read
the envelope, and `WeekStrip` — the only entrance to that page — checked
`res.success`, which lives inside `data`, so the strip never rendered at all. A
feature shipped completely invisible, which is the same failure the league had
before it was rebuilt, reached from a totally different direction.

`src/lib/fnResult.js` is the one unwrap (`takeFn` / `unwrapFn` / `fnError`).
`?? res` is not padding: an unported function still falls through to the real
Base44 SDK, and during the dual run both shapes are live. `fnError` reads BOTH
levels, because a ported function answers 200 with `{ error }` in its body for
a refusal it wants the UI to print.

`fnResult.test.mjs` scans for it. Two false-positive classes had to go first,
the same lesson `hookDeps.test.mjs` learned: `x?.data?.y || x?.y` is the
CORRECT both-shapes idiom (every Stripe page uses it), so a variable read
through `.data` anywhere is exempt; and fnResult.js documents the broken
pattern in its own header. Verified by putting the real WeekStrip bug back.

## Compete: a claim has to survive something

`src/lib/integrity.js`. **Every rule here DISCOUNTS a claim; none of them
accuses a person.** A student who studied honestly never notices any of it, and
a student inflating their hours simply finds the inflation is not worth
anything — which is the only version of this that can be wrong occasionally
without doing harm. An app that calls a sixteen-year-old a cheat on the basis
of a heuristic is a worse outcome than the cheating.

**FABRICATED TIME.** `duration_minutes` and `session_duration` arrive from the
client, and **four** ranking paths summed them raw — `syncCompetitionSlice`
(which writes the `study_minutes` the hours board ranks on), the goal engine's
`study_hours`, the Arena's `study_minutes` metric, and `competitionCompeteScore`.
A single POST of 600 minutes went to the top of a board. The ATAR's effort
component has capped its own days since it was written; the boards had no
equivalent. They all go through `countableStudyMinutes` now:

- one row is at most one sitting (`SESSION_MAX_MINUTES`),
- one day is at most `DAILY_MINUTE_CAP`,
- and **you cannot have studied more minutes today than have passed today** —
  today's ceiling is the minutes since local midnight, which catches the actual
  attack (ten POSTs of four hours inside one second) exactly and is trivially
  explainable to anyone who asks. Past days get the flat cap, because once the
  day is over the app cannot know when a row was earned.

The client mirror is `countableByDay`. Server is the source of truth — and
since the Compete rebuild `integrity.js` has NO client consumer: it is kept
because the server implements the same caps and its test is the guard on them.
Delete it only together with the server's copies.

**IDLE FARMING, which was collected and thrown away.** `awardXP` has accepted
`idle_ratio`, `tab_away_count` and `session_complete` since it was ported;
`calcFocusTimerXP` destructured only `duration_minutes`, and **no client had
ever sent one of them**. So the anti-farming inputs existed on the server, no
producer existed on the client, and a timer left running in a background tab
paid exactly what an hour of work paid — "collect nothing you don't use",
inverted, in the one place built to stop this. PomodoroTimer counts them off
the `visibilitychange` handler that was already mounted, Study.jsx forwards
them, and `calcFocusTimerXP` finally reads them. Away time is measured **only
while the clock is running**: a paused timer is a student on a break, which is
the thing the technique is built around and must never be charged for. A
tab-away costs a flat minute, not a proportion, or a long honest session pays
more for one glance at a message than a short one does.

**TRIVIAL, REPEATED AND RETRY QUIZZES.** `competitionCompeteScore` averaged
every attempt in the window into a 400-point mastery slice, which was farmable
three ways at once: write an eight-second quiz on your easiest topic and score
100; sit the same easy quiz twenty times; or run "wrong only" retries, whose
scores are on a different scale by construction. It reads the FIRST sit of each
quiz clearing `BOARD_MIN_QUESTIONS`/`BOARD_MIN_MARKS` now — first rather than
best, because taking the best rewards grinding a paper until a good roll comes
up, the same "wait for a result you like" shape the forecast settlement
refuses.

**Practice is untouched by ANY of this.** A three-question warm-up still
scores, still feeds the deck, still pays XP. It just does not decide a contest.

**And the gate SAYS WHAT UNLOCKS IT.** A student who only ever sits short
quizzes would otherwise take a silent zero on a 400-point slice — the "never
score a student on a signal they can't reach" rule applies just as hard to one
they CAN reach and were never told about. `board_sits` rides on the participant
and BattleDashboard names the floor, on that student's own row only. It is
deliberately NOT inside `score_breakdown`, which the dashboard renders by
iterating every numeric key, so "sits 0" would read as a fourth component worth
nothing.

**Call-outs: verified hours are drawn differently, never ranked differently.**
The call-out system (migrations 0025/0026, `createCallout`/`submitCallout`)
already existed — one competitor challenges another to a short timed quiz built
from the material that competitor themselves studied. What was missing was any
consequence on the board. `verifiedStudyMinutes` splits a participant's hours
into proven and claimed, and the row draws the proven part in solid ink with
the rest ghosted beside it. Nothing is hidden, flagged, ranked lower or called
suspect — **verifying is a FLEX, not a defence against an accusation the app
made.** A student nobody has ever challenged is not at 0% proven; they have
never been asked, and their row prints the time exactly as it always did.

**A pass proves the window it was BUILT from**, `window_start` → `submitted_at`,
which is a real column and not a heuristic. `VERIFY_COVERS_HOURS` is only the
fallback for a verification that arrived without one.

Two bugs this has already had:

- **A `callouts` row carries `status`, not a boolean.** A check for
  `passed !== false` waved every row through including the failures, because
  their `passed` field is simply absent — a verification system that is a
  rubber stamp at exactly the moment it matters. Status is checked first and an
  unrecognised one verifies nothing.
- **Verified minutes are capped too.** Passing a quiz must not license an
  impossible day, or verification becomes the exploit.

**And when a cap bites, the screen says so.** Silently deleting time would be
worse than the cheating it prevents, so the strip prints what it counted of
what was logged and states the limit. It states a limit; it does not accuse
anybody. An honest student never sees the line.

`Countdown variant="banner"` used to fall back to `text-white` on a 15%-alpha
ground — legible on the dark battle header it was written for, invisible on
every light surface it was later reused on, including this one. A hard-coded
ink was the bug; the token follows the theme. Same lesson as the focus-mode
blackout, arrived at from the other direction.

## Cards are the app's visual language

`PlayingCard` + `cardIdentity` are used on eighteen surfaces — marketing, the
signup wizard, Dashboard, Subjects, Review, the flashcard shelf, and inside the
quiz player. **Rank is how strong the thing is, suit is the family it belongs
to**, and that contract holds everywhere: deck mastery, quiz best score, a
subject in the signup hand. An Ace is always earned, never given.

**The deck is a REAL deck.** Anything printed on a card is checked against
what a printer would actually put there, because the whole theme collapses the
moment one card is obviously invented:

- **Court cards carry a FIGURE** (`CourtFigure`), double-headed about the
  panel's mirror line. They were a framed box with the suit pip in it twice,
  which reads as a domino — a court card is the one card in the deck that is
  not a pip layout, and the mirrored figure is the whole reason a jack is
  recognisable across a table. Drawn as flat shapes rather than a woodcut: this
  card is 55px wide far more often than it is large, and the crown, head, ruff
  and robe are the part that survives being small. The HEADWEAR is the rank
  cue — spikes for a king, domes for a queen, a plumed cap for the jack — with
  the held object (sword, flower, staff) as the second.
  The plate is drawn in a LANDSCAPE box, because each half of the panel is
  about 64 × 39; a square viewBox letterboxed to the height and the figure came
  out a chess pawn with margins either side.
  **WHAT MEETS AT THE FOLD DECIDES WHETHER THIS IS A FIGURE.** Mirror any
  silhouette whose top edge peaks in the middle and you get a lens — so the
  robe's last stretch into the mirror line is VERTICAL, and it stops short of
  the sides. Vertical sides mirror into a rectangle, which is a band of cloth
  at the waist; full width and a curve mirror into a flying saucer with the
  halves' dividing rule running through it like an equator. This note used to
  say the saucer was fixed by squaring the robe's bottom CORNERS. It was not,
  and it never could have been — the corners were never what made the lens.
  Two more rules the redraw is holding:
  **Nothing is drawn outside the viewBox.** Crowns were plotted up to y=-3 in a
  box starting at 0, so every king's and queen's headwear was quietly clipped
  flat by `overflow-hidden`.
  **Head, ruff, robe and the held object INTERLOCK.** With daylight between
  them they read as scattered marks small and as an exploded diagram large. The
  ruff's top curve tucks behind the skull, the robe overlaps the ruff, and the
  object's shaft runs down under the robe — free, because BODY paints last and
  covers it, and the difference between held and laid alongside.
  If the figure looks wrong at one size it is wrong at ALL of them: the SVG
  uses `meet`, so it is scale-invariant. Large is just where you can see it.
- **There is no 1 in a deck**, and no 11, 12 or 17. Two surfaces numbered
  things and printed that number straight onto a card — step 1 of three, and
  the question number in the quiz player, which reaches 17 on a long quiz.
  `rankAt` maps a 1-based position onto a real rank (1 = ace, 11 = jack).
- **The pip field is a panel inset from all four corners**, indices outside it.
  At the old metrics the top-left pip of a four printed straight over its own
  rank, on every numbered card from four up.
- **THE INDEX IS A FRACTION OF THE CARD, not a number of pixels.** Everything
  else on the face already was one — the pip field is inset to 27/50/73 across
  the width, the frame is a percentage, the aspect is fixed — and the index
  alone sat at a flat 8px from the edge at 11px tall. So the two converged as
  the card shrank: a hairline in the corner of a 176px pack, and a third of the
  width on the 62px cards in the onboarding fan, where the index's own suit
  mark had already landed against the top-left pip and a nine read as a card
  with ten marks on it.
  `.card-face` in index.css puts `container-type: inline-size` on the card and
  publishes the metrics as `--idx-*`; `.card-face-lg` is the fuller ramp, which
  is all `smallIndices` now selects between. Containment is INLINE ONLY, so the
  cards whose height comes from their content (the quiz question, the marked
  answer) are untouched — check that before widening it.
  **The `min()` caps are load-bearing.** Past about 160px a real index stops
  growing, and the name bands and body copy these cards print are still in
  pixels, so the caps are what make a large card render exactly as it did — no
  existing clearance had to be re-tuned. There is a px fallback ahead of the
  `@supports` block, so a browser without container queries gets the old
  rendering rather than no index.
- **A face reserves the corner with `--card-index-w` / `--card-index-h`**, never
  by counting pixels. Three places counted: CardPack's `pt-7 pr-5`, the
  onboarding fan's flat 18px (29% of a 62px card), and the subject hub's name
  band. A reserve tuned by hand at one width is wrong at every other one, and
  it is the reason the fan's own comment used to read "the index is drawn at a
  fixed size, so the reserve is a fixed number of pixels".
- **The ace's big centred pip is an early return, and has to stay one**:
  PIP_LAYOUT has an entry for the ace as well, so losing that branch prints an
  ace as a single ordinary pip.

The onboarding hand prints BOTH indices. It printed only the top-left, on the
reasoning that a card in a fan shows one corner — true of the cards that are
overlapped, and the last one is not overlapped by anything, so it sat there
reading as a card with a corner missing. What made the single index look
necessary was the label running under the bottom-right mark, so the LABEL gives
way: on the full-width card its band reserves the corner, and on an overlapped
card the band is only as wide as the visible strip and the index is out under
the next card, where it costs nothing.

**The printed face is INKED PER MODE** (`PIP_INK`). A card being a card prints
at full strength; `compact` (a name band along the bottom) and `faint` (a
paragraph over the top) back off, because the app's own words have to win a
contest against a pattern read peripherally. The court figure is inked lighter
than its own frame on top of that — it is one large filled shape where a
numbered card has six small marks, so matching their alpha makes a court card
the heaviest thing in a hand, and rank means strength here, not weight.

`CardPack` is the shared pack — backs behind, one face on top, thickness = the
count, fan on hover. `DeckStack` (flashcard decks) and `QuizDeck` (quizzes) are
thin faces on it; before the extraction they were two near-identical
two-hundred-line components, which is the copy that rots.

If you are about to render a list of anything deck-shaped, it goes on
`CardPack`. The quiz list was the last holdout — an icon in a rounded square, a
title, two pills and three grey stat tiles reading Attempts / Best / Avg —
and a grid of those is precisely what makes an app look generated. Tapping one
also dropped you straight into a card table, so the seam was in the middle of
the flow the page exists to start.

Three things that took a rebuild to learn:

- **One number on the face.** A card has room for one figure and it should be
  the one that answers "what now" — due, or the score to beat. The rest goes on
  the screen behind it.
- **Actions go in the gutter under the card, not its top-right corner.** That
  corner is where the title starts. They were `opacity-0` until hover, which
  hid the collision and also made delete unreachable on a touch screen.
- **One pack per row on a phone is correct.** Narrowing the card to fit two
  does not fit two and clips the face trying. Two-up arrives at `sm`.

## Study is logged in TWO tables, and both of them count

`study_techniques` takes everything the Study page runs — pomodoro, active
recall, blurting, spaced repetition — with its minutes in `session_duration`.
`study_sessions` takes quizzes and the activity tracker, with its minutes in
`duration_minutes`. Neither is a superset.

The dashboard's week panel read the second one alone, so a student who spent
the week on the Study page was shown their QUIZZES and told that was the week.
That is the identical trap the ATAR's planning component fell into, already
written up above, repeated on the panel beside it. Anything asking "did they
study" goes through `studyEvents` (`src/lib/studyLog.js`) or it will happen a
third time.

**`WeekPace` compares a student to THEMSELVES.** The app has no basis for
saying anybody should do ninety minutes a day, so it does not: the bar is their
own median week, cut at the SAME WEEKDAY (comparing Wednesday's running total
against past full weeks tells everybody they are behind until Sunday). Median,
not mean, or one cram week before a SAC sets the bar for the term — the same
lesson the Ranked board learned about gap scales. A week with nothing in it is
NO HISTORY rather than a zero-minute week, because reading a new account's
empty weeks as zeroes puts their usual at nothing and congratulates any effort
at all. Under `MIN_BASELINE_WEEKS` there is no comparison and the panel says so.

**The subjects hand is gone, and so is the per-subject split that briefly
replaced it.** The hand was a fan of playing cards whose corner had held, in
turn, the deck's card count, the days since it was last opened, and finally the
usual weekly hours — at which point it was answering WeekPace's question, on a
different object, two panels away, with the same number. The breakdown moved
into WeekPace and then came out again: a panel that answers "have I done enough
lately" with a headline, a bar and a sentence does not also need four rows
taking the same total apart, and that list read as an accusation. Where the
hours go belongs on Analytics. `usualWeek.js`, `usualWeeklyMinutes`,
`studyMove.js` and `subjectHand` all went with them.

The panel is STACKED and single-column. It sits in half of a two-column row
inside the page's own two-column grid, so at the viewport where a `lg:` split
would fire the panel itself is about 500px and each column would be 250 — the
same viewport-is-not-element trap the streak panel beside it already records.

## Subjects is a shelf, and each subject has a hub

**Subjects was a catalogue you opened once at signup.** A VCAA overview, a
scaling pill, a difficulty pill and a "Details" link — facts about the
curriculum, nothing about the student. So the question anybody actually opens
that page to ask ("where am I up to in Chemistry, and what do I do about it")
had nowhere to be answered, while the answer sat scattered across six screens:
the decks on Review, the quizzes on Quizzes, the dropped criteria on
/MistakeBank, the hours in two log tables, the SAC on the planner.

`subjectHub.js` gathers it and `/SubjectHub?subject=` is where it lands. The
subject rides in the QUERY STRING because `createPageUrl` builds `/PageName`
and every cross-page link in the app is built with it; a second URL scheme for
one page is how routes start disagreeing with the router.

**The hub and the shelf draw a subject the SAME WAY**, and keeping that true is
the point rather than a tidy-up. The hub led with a `PlayingCard` for exactly
as long as the shelf did; when the shelf became a colour-spine row the hub was
briefly the only screen still calling a subject a card, which is two surfaces
disagreeing about what the object is. It carries the spine, the same
`ScoreCurve` writing the same `goal_study_score`, and `ScalingMark` in its
header — so the wrong-arrow bug fixed on browse cannot come back here.

Dropping the card cost one number: the rank ENCODED mastery and nothing else on
the page printed it. It is a stat in the strip now. Removing a display is fine;
removing the only place a measurement appears, silently, is not.

**Everything is DERIVED from rows the app already loads.** Nothing new is
stored, so nothing here can go stale, double up, or disagree with the screen it
came from — the rule `redoQueue` already follows. Subjects loads the student's
work ONCE and slices it per subject: six subjects querying for themselves would
be thirty-six round trips before the shelf painted.

**Two fields the app has shipped for months and had never once read.**
`assessment_structure` and `key_skills` in `vceSubjects.js` were referenced
nowhere in the codebase, and they are exactly the two things a student cannot
work out from their own data:

- **Where the marks are.** Exam 2 is 44% of Methods, the Unit 4 SAC is 14%. A
  student revising the 14% the week before the 44% is making a bad trade and
  has no way to see it, because the weights live in a study design nobody
  opens. `markSplit` sorts heaviest first, which is the whole point.
  The percentages are VCAA's and are **not renormalised**: a study design whose
  components do not add to 100 is a fact about the data, and scaling them to
  fit would invent numbers. `total` is reported so the panel can say so.
- **What you have never touched.** `coverage` matches the topics a student has
  already written — deck topics, quiz titles — against `key_skills`, on
  normalised containment either way. No tagging, no new field, no backfill.

**Coverage REFUSES rather than guesses, and says what it could not place.** A
topic matching no area comes back as `unmatched` — printed on the panel — not
dropped and not forced onto the nearest skill. Crediting an area the student
has not covered is the one error this cannot make: it would send them into a
SAC believing they had done the work. And "you have never studied Vectors" is
only worth printing by a page that also admits it did not recognise four of
your decks.

**`subjectLead` is the one line, ordered by what it COSTS** — a SAC inside a
fortnight, then marks you are actively dropping, then the review pile, then a
gap in the course, then what the marks are worth. Each branch returns null
rather than a placeholder when its number is not real, the same rule Today's
Play keeps about its rail. The shelf card and the hub print the SAME lead:
two surfaces answering "what next" with different sentences is how a student
stops believing either.

`usualMinutes` is a median of past weeks with the current one EXCLUDED — it is
half-finished, and a Monday morning would drag every subject toward nothing.
Week buckets go through `studyLog`'s own `weekStart` and `dayKey`; rolling the
Monday maths again here would be a second copy of the week, and `dayKey` exists
precisely because `toISOString` is UTC.

**A subject is a ROW with a colour spine, and deliberately NOT a card.**
`PlayingCard` is the app's language on eighteen surfaces and this was briefly
the nineteenth. It is not, because a card's rank is a SUMMARY — one glyph for
how strong a thing is — and the row's job is the opposite: the target you are
chasing, drawn against the state, with the distance to it visible. A rank in
the corner would be a second, coarser answer to the question the curve answers
properly, and the face would take the width the curve needs. What identifies a
subject here is its COLOUR, as a spine down the full height of the row rather
than a dot, because that is the thing the page is sorted by.

**The shelf is in colour-wheel order** (`hueOf`). Greys sort LAST and together:
an unset subject carries the default `#6B7280`, whose hue is an artefact of a
near-neutral mix, so sorting it by that would scatter every uncoloured subject
through the spectrum at a position nobody chose. Saturation under 0.15 is "no
colour"; the check is HSL saturation, so a dark green is still green. Name
breaks ties or two subjects on one palette entry swap places between renders.

## Browse is where subjects get CHOSEN

**It was a catalogue of thirty-three identical cards.** The same book icon on
every one (the "icon that restates the word next to it" rule, thirty-three
times over), a two-line truncated overview cut mid-sentence so the longest
element on the card was the one nobody could finish, and a single text box to
narrow the lot. A student on this page is making one of the larger decisions of
their schooling.

**The scaling factor had the wrong arrow on it.** Every subject printed its
factor in one pill — a `TrendingUp` glyph in `text-primary` green — so Further
Maths at −4 and Specialist at +13 both got a green arrow pointing up, on the
single number VCE students most want off this page. `ScalingMark` drives the
glyph and the colour off the same comparison, so they cannot disagree, and the
catalogue's `+N` placeholder renders as a dash rather than a zero.

**Three fields the catalogue has always carried and browse never showed.**
`career_pathways` (where it leads) is the headline under the name;
`prerequisites` is the one fact that can rule a subject out; both were behind a
"Details" link nobody clicks.

**A PREREQUISITE IS WRITTEN THREE WAYS and only one is a requirement.** Printed
raw with "Needs " in front, two of the three come out as nonsense:
`"None"` → "Needs None", `"Recommended: Year 10 Drama"` → "Needs Recommended:
Year 10 Drama". The third is the dangerous one — `"Year 10 maths recommended"`
→ "Needs Yr 10 maths recommended" reads as a hard gate on a subject the student
could take. `prerequisiteOf` returns `null`, `recommended` or `required`, the
card says *Needs* or *Suits* accordingly, and a requirement carrying advice
after a semicolon keeps only the requirement ("Year 10 Chemistry; concurrent
Methods recommended" → Needs Yr 10 Chemistry). A test parses every prerequisite
in the real catalogue, so a fourth phrasing added later fails the suite instead
of reaching a student.

**Learning areas are HAND-MAPPED, not derived.** Thirty-three is small enough
to be exact, and every heuristic that could produce them ("does the name
contain Mathematics") gets Data Analytics wrong. A test asserts every catalogue
subject has a mapped area — without it a subject added later falls into "Your
own", the heading meant for the student's own custom subjects.

**Sections appear ONLY when sorting by area.** Any other sort is a single
ranking across the whole catalogue, and chopping it into headed sections breaks
the very order the student asked for. Empty areas are dropped: a heading over
nothing is a broken filter, not a section. The area chips are computed off the
SEARCH results rather than the area filter, or picking one chip would hide
every other chip.

**`LoadStrip` checks RULES and reports the rest.** An ATAR needs a completed
Unit 3–4 English sequence and study scores in at least four studies — things a
student can fail to satisfy without knowing, so they get a tick or a warning.
The scaling average is reported and NOT judged: scaling reflects the strength
of the cohort that sat a subject, not a discount available to whoever picks it,
so a strip grading a load as "scaling badly" would push a student to drop
subjects on a misreading of the number. Subjects whose scaling the catalogue
does not know are excluded from that average rather than counted as zero, and
the strip says what it averaged over. An account with nothing picked is not
failing two requirements — it is a student who has not started, and gets one
neutral line instead of two warnings.

## The study-score curve

**`goal_study_score` has been on `user_subjects` since migration 0002, and
until now nothing in the app ever set it.** Analytics reads it and the AI
performance analyser reads it — two consumers, no input, null for every
student on the site. It is the "collect nothing you don't use" rule inverted
and it is worse: a screen was drawing conclusions from a column nobody could
fill in.

**The curve IS the input.** Drag the handle; there is no separate control,
because a slider under a picture of a slider is two things doing one job. The
write happens once on pointer-up, never per move — and the pending value lives
in a ref, because the commit fires in the same tick as the last move and a
closure read would save the second-to-last value (the trap `startFromSuggestion`
already records). A failed write ROLLS BACK, since a handle resting where the
student left it while the database says otherwise is the screen lying.

**What is drawn is a construction, not an estimate.** VCAA builds every study's
RAW score to mean 30, SD 7 on a 0–50 scale — the same curve for every subject
in the state, which is exactly why it can be drawn without inventing anything.

**`mean_study_score` in the catalogue is NOT that mean, and must never be
plotted on this curve.** It ranges 26.4–41.5 across the 33 subjects carrying
it, because it is the SCALED mean — what VTAC turns the raw score into. The
catalogue says so in its own words two fields away: "A raw 30 scales to 35."
Plotting Methods' 34.4 on a raw curve would put its average student at the 73rd
percentile of their own cohort. So the per-subject fact is reported beside the
curve as scaling, which is what it is.

**Scaling is tapered, and labelled `≈`.** The catalogue gives ONE point on the
scaling curve, and real scaling compresses toward the top because 50 is the
ceiling on both sides. Applied flat, a raw 48 in Methods would print as 53. The
offset is exact at 30, where the catalogue's number actually applies, and
closes to nothing at 50.

**The shaded regions are the whole reason to draw a curve.** Area under a
distribution is a COUNT of people: left of the marker is everyone you would
finish ahead of, right is everyone still ahead of you. The right tail is inked
harder despite being smaller, because it is what the number refers to — a
student dragging 30 → 45 watches that sliver close, which is what "top 2%" is
trying to say and cannot. NOTHING is shaded until a target exists: with no
target there is no "you", and shading around the ghost handle would claim they
are aiming at 30 — the question the strip is asking.

Two rendering notes. The regions are ONE static area path behind two animated
clip rectangles, never a tweened `d`: an interpolator can only walk between
paths with equal point counts, and a region 0–12 has a different sample count
from 0–44, so it would snap. And the ticks are centred on their own score, so
the drawing is inset horizontally — without it a "50" at `x = W` has half of
itself outside the viewBox and renders as a lone "5".

The shelf card sits at **92px** as a legibility call rather than a constraint:
the index scales with the card now (see the cards section above), so it clears
the pip field at any width, and 92 is simply where nine marks still read as
nine across a two-column row.

## The dashboard answers one question

**"What do I do right now."** Today's Play is the page; everything else is
context around it. Progress belongs on Ranked and Analytics, which exist to
show it properly — the distance-to-target block was removed for that reason,
and it was the third progress readout on one screen.

The table stays. `TableGround`, `Placed` and the fanned `HandRail` are the only
place in the app with that vocabulary and they are what stop a page full of
cards reading as a document. Concordance means the panels obey the same tokens
and card shapes as the rest, not that the felt goes.

Nothing is printed twice. The streak had its number in the header strip AND a
panel below with the run of seven in it; the panel says it properly, so the
strip stopped saying it at all. Today's Play carried a footer strip too —
today's minutes, the week against a 20h goal, the average quiz — and all three
went the same way: the week's time is a panel of its own that compares it to
the student's own usual rather than to a number nobody chose, and the quiz
average is on Quizzes beside the trend that gives it meaning. A hero that makes
ONE case does not close with a row of context that is the third thing on screen
answering "how am I doing".

**The hero MAKES A CASE, it does not assert one.** Three columns: the card,
the move and one button, and the rail — what fired it, what skipping it costs,
and what it is worth in ATAR points (`todaysCase.js`).

EVERY RAIL ROW IS DROPPED WHEN ITS NUMBER IS NOT REAL, and the rail disappears
when none survive. A first-week account has no components and no cards below
recall; printing "+0.00 ATAR" at them teaches a student that the numbers on
this page are decoration, after which the real ones do not land either.

The payoff is ATAR points and never XP. `liftFor` differences two runs of the
same model Ranked uses, so it is checkable; XP is a number the app invented.

**The card turns over to the actual work.** This column has been a dealt
playing card, then a 3D brain, and is a card again — but not the same card.
The first turned over to an icon and the move's LABEL, which is the headline
beside it restated in the largest element on the page. The brain carried real
information and none of it was about the work; interesting once, then never
again on a screen opened every morning.

It now turns over to the real question off their own deck, the real assessment
title, or the clock counting the block. `previewFor` NEVER invents a face —
every branch returns null rather than a placeholder, because the card turns on
a promise ("here is the first one") and a face reading "your question will
appear here" breaks it on the one interaction the panel asks for. With nothing
real, it keeps the old icon-and-label face, which promises nothing.

The rank still carries urgency (Ace = deadline, Jack = not started). It could
never justify the space alone; the face is what pays for it.

Two things the brain took with it when it went. The rail's "4 regions your
recent work hasn't touched" row — evidence that only reads next to a graphic
goes when the graphic does, or it is jargon a student cannot check. And
`CommitmentRun`'s ghost pack, which existed to give the empty state an object:
with a real card two inches away, a second row of card shapes reads as a
loading skeleton. The sentence asking for a commitment stays either way.

A move needs `technique` (which regions) and `component` (which ATAR slice) to
have a case at all, and `why` for its trigger row. Add a move without them and
it silently renders bare.

**A flip is a tween; a deal is a spring.** MovePreview's card wobbled on its
way over because both animations shared one `animate` on one spring — hovering
re-entered it with velocity still on `rotate` and `scale`. They are nested now:
outer does the deal once, inner does `rotateY` alone on a fixed 0.42s tween, so
a fast hover-out-hover-in cannot stutter. `perspective` goes on the PARENT; an
element cannot supply its own vanishing point, and on the child a rotateY reads
as a horizontal squash.

**And hover detection NEVER goes on the element that rotates.** That was the
real cause and the tween alone did not fix it. As the card turns through 90°
its projected width collapses to nothing, so the stationary pointer falls
outside its own hit box — `pointerleave` fires, it turns back, the box widens,
`pointerenter` fires, forever. Holding the mouse still made it oscillate, which
is why it looked like an animation bug and was not. `onPointerEnter`/`Leave`
sit on the static wrapper now; only the inner element rotates. Anything that
scales, rotates or flips on hover has this bug waiting in it.

**Clearing the pile is an event, and the dashboard says so.** A student who
worked through their cards — or cleared them on /Review by marking them known —
came back to a hero that behaved as though nothing had happened. There is an
"all caught up" move now, and it is only claimed by somebody who HAS a deck to
be caught up on; congratulating an empty account on owning nothing is worse
than silence. A pile under ten also no longer falls through the cracks: the
high-priority branch needs ten to beat a streak on the line, the low-priority
one only has to beat a generic Pomodoro.

## Ranked: the board is the race, the profile is the climb

The page is two tabs and the split between them is the whole design. The BOARD
tab is everyone else — where you sit, who is next, what it costs. The PROFILE
tab is only you — how far up the ladder you have come and what you have
unlocked. Anything that needs a rival on screen belongs on the board side.

Getting that wrong is easy and was done once: the profile briefly carried a
player card and a three-row ladder of the students either side of you, which
the board was already drawing larger, two feet to the left — and it put the
competitive half of a page called Ranked behind a tab you have to go and
choose.

**`StandingRail` is the contest.** Where you are, the person above with the gap
to them, the person behind with what dropping it costs, and then WHAT CLOSES IT
— `bestLever` naming the component with the most ATAR sitting on it and what a
ten-point nudge is worth, checked against the gap so it only claims to overtake
somebody when the arithmetic says it would. That figure comes from `atarLift`,
the same differenced model Today's Play uses, so it is checkable. It is offered
ONLY on the ATAR board: `atarLift` models the ATAR composite and nothing else,
and "sit two quizzes to close it" under an XP gap would be a guess dressed as
arithmetic.

**Every row on the board shows its own gap, drawn to one scale.** That is what
makes a position look takeable — before it, the only gap anybody could see was
their own. The scale is the MEDIAN gap doubled, not the largest: one student
sitting 27 points clear set the scale for the whole board and every gap people
could actually close drew as two invisible pixels. Past twice the median the
bar fills and the row is simply "far"; the number is printed beside it.

Your row and the two either side carry a left rail, because those three rows
are the race you are in. **Side-specific colour utilities, and the list
separates with `border-t` rather than `divide-y`** — Tailwind's `divide-*`
writes `border-color` through a combinator that outranks a plain `border-primary`
on the child, so the first rail came out the same grey as the dividers.

**`MyProfile` is XP, the ladder, and achievements.** It was `GamifiedMyRank` —
an XP card, five stat tiles, twelve hand-written achievements, daily missions, a
streak explainer and a rate table — with `AchievementsGallery` rendering a
SECOND achievements grid from the server underneath. The server catalogue
stayed; it grants the XP. XP and streak come off the board row the page already
fetched, so the tab makes no query of its own.

**A rank is a badge, not a string.** `RankCrest` — a hexagon in the rank's own
colour with its tier numeral, and the ring around it is progress to the next
one. Ten tiers all drawn as the same amber trophy meant arriving at tier 9
changed a string and nothing else.

**And the ladder runs ALONG the page** (`RankLadder`). Ten tiers is the only
thing on this tab that is inherently long, and it was the one thing squeezed
into a three-row window with the rest behind a toggle — while a third of a wide
screen sat empty beside it. Horizontal, all ten visible, passed tiers ticked
and the rest padlocked.

The rail's fill runs to your crest PLUS how far through that tier you are, so
it moves whenever XP lands rather than once every few months when a tier flips.
The `+0.5` in `railEnd` is not decoration: crest *i* sits at `(i + 0.5)/n`
across the track, so without it the bar stops a half-cell short and visibly
fails to reach the crest the number above it says you are on. It SCROLLS on a
phone rather than shrinking — the alternatives are unreadable numerals or
dropping the names, which is what the ladder is for — and the current tier is
scrolled into view on mount.

Level folded into the rank hero at the same time. Rank and level are drawn
differently on purpose (a ring against a bar, because one moves every few
sessions and the other a few times a year) but they answer the same question,
and the level card on its own was a heading and a number at opposite ends of a
wide strip.

No state or curriculum in a rank name. Two of them were "VCE Demigod" and
"Legend of the HSC" — two different states' exam systems, in consecutive tiers,
in a ladder every student on the app climbs. They are Syllabus Slayer and Final
Boss.

`DailyMissions` came off the profile and is NOT deleted: it calls `awardXP`, so
it is the only surface where mission XP can be claimed, and removing a payout is
a product call. It is mounted nowhere — read the note at the top of the file
before rehoming it.

## The signup tour

`AceTour` — six stops and a sign-off, fired once for accounts that are hours
old. Ace walks in on Dashboard, Subjects, Study, Quizzes, Planner and Help,
says what each is for, and hands them back to the Dashboard. Copy and
eligibility live in `src/lib/aceTour.js`; the component navigates, speaks and
remembers the stop index so a refresh resumes rather than restarts.

It is a tour, not an onboarding run. Nothing is gated on the student having
done something, nothing pays XP, no step can be failed. The version that did
all of that was a client library, a component, a server payout source and six
anchor attributes scattered through the pages — reverted in `be14756`, and
worth reading that commit before proposing it again.

Two rules it exists to keep:

- **It can only ever fire for genuinely new accounts.** Eligibility is derived
  from `user_profiles.created_date`, not from a flag needing a backfill: older
  than `TOUR_WINDOW_HOURS` and nothing starts, nothing is written. An unknown
  age counts as old. Getting this wrong the generous way ambushes all ~130
  existing accounts at once; getting it wrong the other way costs one student a
  tour.
- **He is drawn with `AceWalker` + `AceBubble`**, the pair AceBuddy uses, so he
  arrives the way he arrives everywhere else. The first version pointed him at
  each page's `<h1>` through AceRoam and he clipped under the nav — headings
  are near the top, that is what headings are.

Layout stands AceIntro and AceBuddy down while it runs; they share the corner
and the mascot. It goes quiet on the payment flow, because the wizard sends
premium-intent signups straight to /Subscription.

## Study intent

The Dashboard modal asks what today is for (homework / cramming / free study)
and how long. The answer lives on `user_profiles.extra.daily_intent`, with a
capped `intent_log` for history. `src/lib/studyIntent.js` is the shared read and
owns the mode→technique→tool mapping.

It threads: Today's move leads with it, Study opens on the matching technique,
AI Tools on the matching persona, the greeting closes the loop once minutes are
logged, and kept intents feed the ATAR's planning component. The mapping matches
the advice the modal itself gives — change one, change both, or the app argues
with itself one screen later.

### Functions ported (in `server.mjs`)
- **XP/Streak (4)**: `updateStreak`, `awardXP`, `awardXPIncremental`, `awardGoalXP`. JWT auth helper + `supabaseAdmin` (service_role) live at `server.mjs:28-60`.
- **Goal AI (2)**: `updateGoalProgress`, `generateGoalWithAI`. Helpers `callLocalFn` / `callInvokeAI` near top of `server.mjs` let one ported function call another.
- **Competitions + Wagers (5)**: `createGoalCompetition`, `joinGoalCompetition`, `updateCompetitionProgress`, `settleHoursCompetition`, `resolveScoreWager`. Migration `0008_competitions_wagers_schema.sql` realigned `goal_competitions` (drop+recreate) and `score_wagers` (rename `wager_xp` → `wagered_xp`, add accuracy/xp_outcome/actual_score/assessment_id, status enum changed to active/resolved/cancelled).

### Functions deprecated (won't migrate)
- **Challenges (3)**: `saveChallengeProgress`, `completeGoalChallenge`, `generateGoalChallenge` — never wired into live UI. `ChallengeEngine.jsx` deleted. Migration 0007 columns are orphan but harmless.
- **Past papers (2)**: `fetchVCAAPaper`, `renderPdfPages` — VCAAExamSimulator/PastPapersSection/PastPaperPlayer/AITestMarkerSection were all dead code, deleted 2026-05-05.

### Functions ported (continued)
- **Support (1)**: `sendSupportTicket` — ticket saves to DB AND sends two Resend emails (admin notification to `ADMIN_EMAIL`, confirmation to user). Sender domain `acedit.au` is DNS-verified in Resend. Wired 2026-05-19.

### Functions remaining
- **Admin (3)**: `resetAllCredits`, `migrateStudyHoursToXP`, `banAbusiveAccounts` — admin-only, can defer post-cutover. Genuinely unported: no handler exists in `server.mjs` for any of them.

Stripe is **not** remaining. All four (`stripeCheckout`, `stripePortal`,
`verifySubscription`, `stripe-webhook`) are live in `server.mjs` and wired in
`supabaseClient.js` — this section listed them as outstanding for months while
the phase table above said they were ported, and every session that read it was
sent to write code that already existed.

Still worth confirming rather than assuming: the webhook path needs a public
URL, so it may never have run against a real Stripe event. If subscriptions are
not activating after payment, start there, not at the port.

Recommended next: nothing in the migration is blocking. Product work is the
better use of a session — see below.

## Run / develop

```bash
npm run dev    # vite :5173 + server.mjs :3001 concurrently
```

`.env.local` (gitignored) holds `ANTHROPIC_API_KEY`, `VITE_BASE44_APP_ID`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_USE_SUPABASE`.

## Reads are cached, and pages are split

Two things every session should know before adding a query or a page.

**Every entity read goes through one cache** (`src/api/readCache.js`, wired in
`supabaseClient.js`). Its real job is DEDUPE, not memory: six components mount
on first paint and five of them ask for the same `user_profiles` row, so they
share one promise. The 8s TTL only absorbs remount storms. react-query is
installed and configured and still nothing uses it — caching at the shim was
one file against migrating 159 call sites, and that trade has not changed.

Invalidation is eager and coarse on purpose: any write drops every cached read
of that table, any non-read server function drops everything (`awardXP` alone
touches xp_events, user_profiles and leaderboards), and any auth event drops
the lot plus the memoised email and `auth.me()`. If you add a ported function
that only reads, put it in `READ_ONLY_FUNCTIONS`; if you are not sure what it
writes, leave it out. Getting that wrong shows a student a stale XP total the
moment after they earned it.

**Reads page.** PostgREST caps a response at 1000 rows and says nothing about
it, so every unbounded `.filter({...})` was silently truncating for anyone past
that many flashcards or xp_events. `fetchPaged` walks 1000 at a time with `id`
as a tiebreak so a row cannot land on two pages, up to a 20000 ceiling that
WARNS when it bites rather than handing back a prefix — the same failure the
ATAR window queries hit.

**Pages are lazy** (`pages.config.js`, `Suspense` in `App.jsx`). Statically
imported, the 24 pages plus recharts, KaTeX and html2canvas built one 4MB
bundle that every student parsed before the dashboard painted; it is 1.4MB now
and the dashboard adds 61KB. Landing, Login and Layout stay in the first chunk
because they are what an unauthenticated visitor and every route respectively
need immediately. The Suspense boundary sits INSIDE the layout so a navigation
reads as the page filling in, not the app blinking out. `routes.test.mjs`
accepts either binding form — a route registered against an undeclared name is
the 404 it exists to catch, and that looks the same either way.

Write loops are gone from the paths that had them (Goals, Strategise,
StrategyCheckIn, MindMaps, BlurtingMethod, Review): same-payload rows go
through `bulkCreate`/`bulkUpdate`, and independent ones through `Promise.all`.
A rebuilt fortnight was thirty sequential round trips with the button spinning
through all of them.

## Known issues / paper-cuts

- Console 400s on `/study_plans` and `/flashcards` — missing-column patches. Non-blocking.
- Lint is at ~46 warnings, down from 190. What's left is mostly unread state; the
  genuinely dead things have been removed. Worth reading a warning before deleting
  it — twice now an "unused" symbol turned out to mark a half-wired feature, not
  dead code (the shared-quiz handlers, Layout's unreachable UpgradeModal).
- No test runner is configured — there is no vitest or jest. What exists is a
  set of plain-node assertion files (`src/lib/*.test.mjs`, run through
  `_aliasLoader.mjs`) wired into `npm test`. Adding a real runner is still a
  decision, not a freebie.
- **A feature gated behind an optional-looking step is a feature nobody has.**
  Blurting's AI marking rendered only when source notes had been uploaded — an
  upload sitting in a side panel on the setup screen, next to a "How Blurting
  Works" list that promised "AI checks what you missed" unconditionally. The
  marking worked; almost nobody ever saw it, which is the likeliest reason
  blurting reads as zero in the usage audit. It marks either way now, against
  the Study Design when there are no notes, and says which of the two it did.
  Worth checking the same shape elsewhere before blaming a technique for being
  unpopular.
- **An icon that restates the word next to it is decoration.** A clock in a
  tile beside the heading "Pomodoro", a sparkle before "Good for:", a brain
  before "Your brain on X" — and behind all of it a 128px ghosted clock at 10%
  opacity. Three clocks in one panel. That stacking is most of what reads as
  vibe-coded, and it is the same instinct as the emoji sweep: decoration added
  because the space looked empty.
  The rule is whether the glyph carries something the text does not. **Keep**
  logo lockups, status (check, warning, spinner), empty-state anchors, icons
  that differentiate items in a repeated set, and the wand/sparkle ON an AI
  generate button — there it is the affordance. **Cut** ghosted watermarks,
  icon tiles in front of a heading that names the same thing, and generic
  Sparkles/Star/Crown/Zap on a standalone label.
  Sets are kept whole: pulling one icon out of five sibling category headings
  looks like a bug rather than a decision.
- Copy drifts away from the product. Retired features kept being advertised
  (weekly leagues on the paid tier, a Study Roadmap page that redirects, past
  papers in Revision Mode) and the AI tool count was hand-written as three
  different numbers across five screens. Tool count now derives from
  `TOOL_COUNT` in `chatTools.js`. When you retire something, grep the copy.
- Long subagent runs in this codebase have repeatedly hit 600s stream-idle timeouts. Avoid long-running subagents — do work in the main conversation or split into smaller agent tasks.
- `package.json` `name` is still `base44-app` and `@base44/sdk` + `@base44/vite-plugin` are still listed (kept for dual-run; remove after cutover).

**A button names the JOB, not the technology.** "AI Generate" told a student
which technology was involved and nothing about what would happen — on the
Study page it could plausibly have made cards, marked something, or written an
answer. They say the work now: *Make cards from notes*, *Make a quiz from
notes*, *Make questions from my notes*, *Mark my answers*, *Mark what I
missed*. The wand stays; on a generate button the icon IS the affordance.

And a disabled button says WHY. Active Recall's needed both a subject and a
file and sat greyed out saying neither.

One dialog, one button per surface. Making a quiz had three buttons on the
Quizzes page; the one in the side panel only existed because that panel used to
be about quizzing, and three buttons for one dialog is how a student stops
believing they do different things.

## The logo, and the signup email

**One mark, one component** (`BrandMark`). It was a green rounded square with a
lucide `GraduationCap` in it, hand-rolled at EIGHT call sites — side rail,
landing header and footer, login, forgot-password, reset-password, the legal
shell and the suspended screen — which had already drifted to three corner
radii, two icon colours and one hard-coded `#534AB7` that appears nowhere else
in the app.

In the app it is the brand green (`fill-primary`), lit with a two-stop
`drop-shadow` glow, and drawn larger than the
other call sites (`rail`, a 28px pip in its 40px box): the bare spade at 20px
was visibly smaller than the 40px green tile it replaced, because the tile's
colour was doing work the glyph now has to do alone. It cannot grow past the
box — the collapsed rail is 64px wide with 12px of padding either side. The
glow is a drop-shadow on the GLYPH, never a box-shadow on its span: the span is
a rectangle, and a halo around a rectangle behind a spade is a green square.

It is the ace of spades now. The whole visual language is playing cards and the
mascot is a spade already; a mortarboard belongs to every education app. Drawn
with `fill-foreground`, so one asset is near-black on light and near-white on
dark with no second file and no runtime swap — the same trick `SpadeFace` uses
for the knocked-out eyes. The Landing page passes a FIXED ink instead, because
it paints its own cream palette and does not follow the theme.

**The favicon is ours and local.** It pointed at `https://base44.com/logo_v2.svg`
— a third party's logo, fetched from their domain, on every page load. It is
now `public/favicon.svg`: the same spade path, black on a white card, IDENTICAL
in both themes on purpose. A favicon has no theme to follow; it sits on a tab
strip whose colour neither the app nor the student chose, and a bare black pip
disappears on a dark one. `index.html` also linked a `manifest.json` that has
never existed in this repo; that line is gone.

**Swapping that tag fixed the tab and did NOT fix Google**, which went on
printing Base44's orange mark beside acedit.au — a crawler does not look the
way a browser does. It wants a real `/favicon.ico` at the root (the path that
is checked without parsing the page), square and a multiple of 48px, which is
the size a search result renders. And `apple-touch-icon` cannot be an SVG at
all: iOS ignores it, so "add to home screen" fell back to a screenshot. So
SAFARI wants two more on top of that. PNG favicons at 16 and 32, because its
tab strip, bookmarks bar and Start Page do not all read the same asset and a
PNG at the size being drawn is the one every version of it has taken; and
`rel="mask-icon"` for a pinned tab, which is a MASK — Safari throws away its
colours and fills whatever is opaque with the `color` on the link, so
`mask-icon.svg` holds the bare spade and no white card. Ship the card there and
a pinned tab comes back as a solid square with a spade-shaped hole in it.

So `favicon.ico` (16/32/48), `icon-16/32.png`, `mask-icon.svg`,
`apple-touch-icon.png` (180) and `icon-192/512.png` all ship, ALL GENERATED
FROM `favicon.svg` — regenerate them together or the tab, the pinned tab, the
home screen and the search result become four different marks. Neither Safari
nor Google updates on deploy: Safari caches favicons in its own icon database,
Google re-crawls on its own schedule. Nothing in the page can force either.

**The signup email is sent by US, through Resend** (`sendSignupEmail` in
`server.mjs`). `supabase.auth.signUp()` asks Supabase to send it over the
built-in SMTP relay — three emails an hour for the whole project, not meant for
production, and it drops mail. The onboarding page already had a branch for the
resulting error whose comment read "Once we wire Resend SMTP this should never
fire in practice", so this was diagnosed long ago and never done; students were
being shown "have Miles set up Resend SMTP".

`admin.generateLink({ type: "signup" })` creates the account and returns the
confirmation link WITHOUT sending anything, and Resend delivers it from the
DNS-verified `acedit.au` sender that already carries support mail.

Three rules it keeps:

- **It creates nothing it cannot deliver.** With no `RESEND_API_KEY` it returns
  `fallback: true` before touching Supabase and the client uses the old path.
  An account whose verification email was never sent is one nobody can get into
  and nobody can re-register.
- **An internal failure is never shown to a student.** A bad service key
  surfaced on the signup form as the literal string "fetch failed". Unknown
  errors log the real message and answer `fallback: true` — the anon key may
  well work when the service key does not.
- **It is rate limited, because it has to be unauthenticated.** Five per email
  and twenty per IP an hour, in memory. Enough for someone holding down the
  button or mail-bombing one address, and honest about being per-process.

`generateLink` regenerates the link for an account that exists but is
unconfirmed, which is what makes "Send it again" on the check-your-inbox screen
the identical call rather than a second code path. There was no way to ask for
another email before this.

## Voice / UX guardrails (from prior decisions)

- **Tone**: chill motivational coach. Never cocky.
- **Banned words**: "Don't", "Fix it", "No excuses", "Embarrassing", "Move".
- **Primary green** `#58CC02` (Duolingo-like). XP orange, streak red, chart-3 blue, chart-4 purple. Use design tokens, not raw hex.
- **Static Tailwind classes only** — JIT can't see template-string class names. Recurring gotcha.
- **Streaming AI for prose tools, NOT JSON tools.** In the unified chat this is
  the `artifact` spec on a tool in `chatTools.js`: declaring one switches that
  send to a single non-streaming schema call. Cheat sheet, exam questions and
  the line memoriser all take that path.
- **Collect nothing you don't use.** The recurring bug in this app is asking the
  student something and then ignoring the answer — the study intent was
  discarded on close, the duration they picked was never read, the ATAR
  components were computed and never shown. If you add an input, wire it through
  the same session.
- **FOCUS MODE IS A BLACKOUT AND IS NOT THEMED.** Both focus screens (the
  pomodoro's and blurting's) painted themselves `bg-foreground` with
  `text-surface` on top — a hand-rolled inversion that reads as "the ink
  becomes the page". It only holds in light mode: in the dark `--foreground`
  is near-white and `--surface` is a dark navy, so the one screen in the app
  that must never be bright came out as a WHITE page with dark text. The
  ground is a literal `#0A121F` now and the ink is literal white, in both
  themes — a token that flips underneath a deliberate inversion is the bug,
  not the fix. Watch for `text-background` in the same blocks: on a dark
  ground it is black on black.
- **A widget that floats over the app is still one of the app's panels.** The
  pomodoro timer was styled in isolation and it showed in the dark: a 2px
  border at /40 in the brand green, which on a dark ground reads near
  full-strength and rings the thing in neon (while saying "running" for the
  third time, beside an orb and a label that already do); `shadow-lg`, a BLACK
  shadow, so the one genuinely floating element on screen had no elevation at
  all on a near-black page; a translucent blur that muddied it over dark
  content and bought nothing; and `font-mono` digits, where every other number
  in the app is `font-display` + `tabular-nums`. It wears `card-soft on-table`
  now — the app's own panel and its own dark elevation — and the tone lives on
  the orb and the word, which is where it was already.
- **The running timer is a clock, not a glyph beside a number.**
  `PomodoroOrb` — a green (amber on break) face that glows, with an arc for how
  much of the block is left and a hand that steps 6° every second. The arc is
  an explicit SVG arc path with sweep-flag 1, NOT a `strokeDashoffset` on a
  circle: the dash idiom is ambiguous about winding and the first version ran
  anticlockwise, which on a clock face is the one thing it must not do. It
  draws from `left` and `total` and nothing else, so the ring cannot disagree
  with the digits next to it, and with no `total` (older saved state) the ring
  is simply not drawn rather than drawn against a guess. Its glow is TWO STOPS
  BELOW FULL STRENGTH — a tight edge and a faint bloom, the same idiom
  BrandMark uses. One `drop-shadow` at the token's full alpha is fine on cream
  and comes out as a fuzzy smear on dark, where there is nothing to absorb it.
- **A draggable thing that is also a link separates the two by DISTANCE, not
  by target.** The floating timer's whole interior is the link to Study, and
  the drag handler bailed on anything inside it — so `cursor: grab` sat over
  about twelve pixels of padding that could actually be grabbed. A press
  anywhere starts a drag now; under 4px of travel it was a tap and the link
  fires, over it the click is swallowed on the capture phase.
  Three things that had to be right, in Layout's `handlePointerDown`:
  **capture LATE** (a captured pointer retargets the click to the capturing
  element, so capturing on press meant a tap silently did nothing);
  **listeners attached for the widget's lifetime, not while dragging** (keyed
  on `isDragging` they only went on after React re-rendered, and a quick flick
  finished before anything was listening); and **`setPointerCapture` in a
  try/catch**, because it throws on a pointer that is already gone and the
  throw would abort the rest of the move handler.
- **A suggestion that says "I'll build it" has to build it.** Ace's WhatToTest
  panel used to fill in two form fields and stop, leaving the student to scroll
  down and find the start button. `startFromSuggestion` takes the pick all the
  way into the session. It carries the choice in a ref, not state: the pick
  arrives in the same tick that sets the subject, so reading state would build
  the session for whatever subject was selected BEFORE they picked.
- **No mascot yet** (maybe later). **Dark mode EXISTS** — `index.css` has a
  complete `.dark` token block and `src/lib/theme.js` offers four preferences
  (system / light / dark / auto by the clock). This line used to say there was
  no dark mode, which sent every session that read it to write light-only CSS.
  Check both themes on any UI change.
- VCAA examiner prompts live in `src/lib/subjectExaminerPrompts.js` (34 subjects).

## Working style

- Be concise. Surface scope before big work.
- Test in browser before declaring done. UI changes need a real visual check.
- Don't introduce casual deps.
- The user has Anthropic API credit; don't worry about cost on small calls but don't run unbounded loops.

## Key files

- `server.mjs` — Anthropic proxy + ported functions
- `src/api/supabaseClient.js`, `runtimeConfig.js`, `entitiesShim.js`, `functionsShim.js`, `_dualRunDevTools.js`
- `src/lib/AuthContext.jsx` — still on Base44, swap pending
- `src/lib/streamingAI.js`, `src/lib/reconcileXP.js`, `src/lib/subjectExaminerPrompts.js`
- `src/data/vceSubjects.js` — VCE subject catalog (`assessment_structure` and
  `key_skills` are read by `subjectHub.js`)
- `src/lib/subjectHub.js`, `src/pages/SubjectHub.jsx` — one subject, gathered
- `src/lib/studyScore.js`, `src/components/subjects/ScoreCurve.jsx` — the state
  distribution, and the drag that finally sets `goal_study_score`
- `src/lib/subjectBrowse.js`, `src/components/subjects/ScalingMark.jsx`,
  `LoadStrip.jsx` — learning areas, sorting, prerequisites, and the load checks
- `src/lib/market.js` + `market.test.mjs` — THE model: the proper scoring rule
  against the crowd's price, the prior blend, cred, and the one rule about who
  may hold a position. Imported by `server.mjs`, never mirrored
- `src/pages/Competitions.jsx`, `src/components/market/MarketCard.jsx`,
  `PriceBar.jsx`, `TakeSide.jsx`, `SettlementReveal.jsx` — the floor, the one
  card, the price, the gesture and the payoff moment; `getMarkets` /
  `takePosition` / `openMarkMarket` / `reportMark` in `server.mjs` mint, escrow
  and settle
- `src/lib/fnResult.js` — the one unwrap for `functions.invoke`; reading its
  `{ data, error }` envelope as the payload is silent and has shipped twice
- `src/lib/wagerStatus.js` — the one vocabulary `score_wagers.status` may
  speak, imported by client AND server; `dbEnums.test.mjs` holds it
- `src/lib/league.js`, `src/pages/League.jsx`,
  `src/components/league/WeeklyBoard.jsx`, `src/components/ranked/WeekStrip.jsx`
  — the weekly board; `leagueStandingRows` and `settleLeagueGroup` in
  `server.mjs` are the one ranking and the settlement that writes it down
- `src/lib/integrity.js` — the caps, the idle discount, the quiz floors and the
  verified/claimed split. Mirrored server-side by `countableStudyMinutes`,
  `verifiedStudyMinutes` and `boardQuizScores`; change one, change both
- `src/lib/liveRefresh.js`, `src/lib/LiveContext.jsx`, `src/api/realtime.js` —
  when the app may refetch, who can hold it still, and the push path
- `src/components/shared/LiveNumber.jsx`, `LiveDot.jsx` — rolling figures and
  the "something is running" mark
- `src/components/shared/Reveal.jsx` — the one page entrance, and the rule
  about what should not animate at all
- `supabase/schema.json` + `scripts/dumpSchema.sh` — the real column list, and
  how to regenerate it after a migration
- `src/lib/achievements.js` — the catalogue, its progress functions and the
  showcase ordering; `buildAchievementStats` in `server.mjs` is the only reader
  of the database, and adding an achievement means adding its stat there too
- `src/components/ranked/AchievementUnlock.jsx`, `CrestRow.jsx` — the moment,
  and the badges beside somebody's name
- `src/components/shared/MarkdownMath.jsx`, `LatexRenderer.jsx` — KaTeX
- `supabase/migrations/0001…0006_*.sql` — applied schema
- `base44/entities/*.jsonc`, `base44/functions/*/` — Base44 reference, kept until cutover
