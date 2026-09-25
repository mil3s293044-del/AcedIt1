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

**IT GOES STALE ON THE CLOCK ALONE, and for a long time nothing noticed.**
A trailing-28-day score changes for two reasons: new work, and old work ageing
OUT of the window. `refreshAcedItATAR` only ever ran on the student's own
activity — fired from `awardXP`, or forced when they opened Ranked — so the
second reason had no trigger at all. A student who stopped logging in kept the
score they had the day they left, forever. Not merely stale: WRONG, and wrong
in a direction that cost everybody else, because their window was emptying
while the board still ranked them on a full one.

`sweepStaleATARs` fixes it. `getRankedBoards` fires it FIRE-AND-FORGET once the
payload has gone out, refreshing the few stalest rows on the board — recomputing
all 300 is hundreds of round trips with a student waiting on them, so the viewer
waits for nothing and the board converges over the next few loads. Serial, not
`Promise.all`: six concurrent recomputes each paging `xp_events` is a spike on a
database nobody is waiting on. `ATAR_STALE_HOURS` is under 24 so a student does
not drift later each day and skip one, and a profile never computed sorts first.

Lazy, like the league's settlement and the market sweep: it needs somebody to
open Ranked. Several visits a day converges within one; a week with nobody on
the board and nothing moves. That is the trade this codebase takes everywhere
rather than introduce a scheduler.

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

**One page, one next move — and eventually NONE.** Quizzes carried five: a
mistake-bank panel, a "next quiz" strip, and a three-panel rail (losing marks /
command terms / fading fastest). That collapsed to one rail (`workQueue`), and
the rail is now gone too: /MistakeBank answers the same question properly —
questions missed more than once are its "Sit again" tab, individual dropped
marks are its whole reason to exist — so the rail was a second, smaller answer
to a question another screen owns, taking 380px off the shelf beside it.
`workQueue` is deleted; `weakSpots`, `retrievalStrength` and
`buildDrillQuestions` are what it was built from and are KEPT, with a note
where it stood, because twice now an "unused" symbol here has marked a
half-wired feature rather than dead code.

The single-tab `Tabs` went with it. **A tab bar with exactly one tab is chrome
pretending to be navigation**: nothing can be switched to, and the only thing
it carried that was not decoration was the count, which belongs beside a
heading.

**A PACK IS A FIXED WIDTH, so a wider container does not make the shelf
better.** `PACK_W` has to stay fixed — the same pack is dealt on the flashcard
shelf and one per row on a phone is the right call there — so taking the rail's
380px just moved the dead space from beside the list to the right of it.

The first answer was CSS `columns-2` at xl, and against REAL DATA it was
worse. Most students have one or two quizzes per subject, so the columns filled
with single cards at unequal heights and the page became a zigzag of headings
starting at four different vertical positions. Balancing a masonry needs
sections of comparable size and these are not — which a fixture of three
quizzes per subject hid completely, and one screenshot of a real account made
obvious. **Check a layout against the shape of the data somebody actually has.**

It is stacked bands — one subject, one row, scrolled through. **The rhythm is
what makes it read:** every heading starts at the same x, so the eye runs
straight down the subjects instead of hunting for the next one. And each header
ends in A RULE TO THE END OF THE ROW, which is what turns a left-aligned row of
fixed-width cards from a hole into a shelf: the rule terminates the band, so
the space beside two packs is margin somebody chose rather than somewhere
content failed to reach. Free, and it does the job the columns were attempting.
The colour is a SPINE rather than a dot, because Subjects already identifies a
subject that way and the two shelves listing a student's own work should not
label them differently.

**With no quizzes the whole section is not rendered.** The featured strip above
already makes the one ask, so a heading, a toolbar and a large dashed empty box
would be three more things saying "you have none" — and the toolbar's own
generate button made THREE buttons for one dialog on a single screen, which is
the exact paper-cut this page had already been through once.

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

**ONE MARK PER QUESTION, AND `quizScore.js` IS IT.** A student photographed a
header pill reading **3/5** sitting eight inches above a red **0/5** on the same
card, over an answer box that said "No answer written". Eight readers worked the
mark out for themselves and disagreed about both halves of the fraction:

- **The reconciliation existed and nothing read it.** `normaliseMark` has always
  recomputed the total from the criteria when the model's stated figure
  contradicts them — that is the rule the whole panel rests on — but the
  reconciled number lives on `fb.mark.marks` and every other reader took
  `fb.marks`, the raw claim. So the small panel was right and the big number,
  the score, the saved attempt **and the XP payout** were all wrong.
- **The denominator was hand-rolled** as `q.type === "mcq" ? 1 : (q.marks || 5)`
  in four more places, which reads 5 for a multipart question worth nine. It is
  the same expression this file already records being fixed three times.
  `quizScore.test.mjs` scans the tree for it now, and for `fb.marks` inside
  QuizPlayer, because both render perfectly and are simply a different number
  from the one beside them.
- **A BLANK ANSWER SCORES ZERO, whatever the marker says.** That 3/5 was awarded
  to text that does not exist, and no amount of reconciliation catches it when
  the criteria come back equally invented. The only legitimate way a blank
  answer scores is the student's own "I answered this on paper" box.
  `blank` is false for anything answered by SELECTION — a legacy MCQ, and a
  multipart question whose parts are all MCQs, whose joined answer is correctly
  the empty string however well it went.

`questionMark` returns BOTH `auto` (what pays XP and what is persisted) and
`awarded` (`auto` + self-marked, what the student sees). Anything printing a
number reads `markFor(i)`; anything paying out reads `.auto`.

**And where the fraction legitimately differs from the list under it, the panel
SAYS SO** — one sentence, because said separately "nothing scored" appeared
directly under a 4/5 on a question marked from paper.

**The review card is part-aware too, and was not.** `userAnswers[index]` is
empty for a multipart question (its parts are keyed "3a", "3b") and
`q.model_answer` is undefined (the model answers live on the parts), so every
multipart question reviewed after marking printed "No answer written" above "No
model answer provided" and offered the self-mark box for a question that had
been answered in full. The answer comes through `answerTextFor`, the model
answer through `modelAnswerFor`, and the self-mark box is gated on
`currentMark.blank` — the SAME test the zero it explains was computed from. A
model answer that genuinely does not exist renders no panel at all rather than a
box headed "Model Answer" containing "No model answer provided".

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

## READY is the count. `isDue` alone was the wrong number everywhere.

**"50 flashcards, 10 have been done, it says 10 are due, even though it would
be 40."** Two separate bugs on one number, and the second had been on the deck
face for as long as the face has existed.

**NEW IS NOT NOTHING.** Splitting `new` off from `due` was right and stays
right — a freshly generated sixty-card deck is not a backlog, which is the
whole of `due.js` above. But `isDue` alone as a COUNT quietly deletes the new
pile: a deck of fifty cards a student had just made printed **"All caught
up"**, and their example printed **10**. `isReady` is due + overdue + new, and
every count of "what can I sit right now" reads it. The distinction survives
where it is USEFUL — /Review and AuditPile, which exist to take a pile apart,
and the per-card pill inside a deck, which has room to say which one it is.

**The word moves with the number.** "50 due" would be the phantom pile this
file was written to kill; "50 ready" claims nothing about being behind. Every
label went with the sum — the deck face, the deck screen's tile and button,
Dashboard, Study, Analytics, FlashcardPerformance. Under the button the deck
screen says the split once ("10 came up for review · 40 you have never
opened"), because a number has to be the whole pile and a sentence has room to
say what is in it.

**`.filter(isDue)` PASSES THE ARRAY INDEX IN AS `today`**, and it renders
perfectly. `Array.prototype.filter` calls back with `(element, index, array)`,
so `cards.filter(isDue)` is `isDue(card, 0)`, `isDue(card, 1)` … and a number
where an ISO date belongs does not throw: `from > today` compares a string
against a number and is false, so nothing is ever SCHEDULED, and `daysBetween`
parses NaN to 0, so nothing is ever OVERDUE. Every learned card came back
"due", **including cards scheduled next week.** That is the point-free form
anybody writes, so it is not banned — every entry point runs its `today`
through `dayOf`, which takes an ISO day and otherwise falls back to now.

Only a SCREENSHOT caught it. The sweep passed its own tests, and the fixture
deck of cards scheduled a week out rendered "12 READY" in the probe. A test
that calls `isReady(c, today)` explicitly can never see this — which is why
`scripts/_floorProbe.jsx?v=decks` draws the three deck states against real card
rows, and why `due.test.mjs` now asserts the POINT-FREE form specifically.

The other guard is a scan for `.filter(isDue)` used as a count, exempting the
audit surfaces BY NAME — and asserting those files still exist, because an
exemption pointing at a moved file silently covers nothing and the scan passes
either way.

`previewFor` moved with them, and the reason is worth keeping: the dashboard
card turns over on a promise ("here is the first one"), and Study plays
`isReady`, so on a deck of fresh cards the panel showed nothing while the
session behind it had sixty questions waiting. **A preview reads the same
predicate as the session it is previewing** or it is lying about the one
interaction the panel asks for.

## A question may only refer to material it carries

VCAA examines from stimulus — an extract, a data table, a case study — and the
generator, reading a textbook, writes like VCAA: *"Using Source B, explain…"*,
*"Refer to the case study on p.14"*. **Nothing in the saved quiz held Source
B.** So the question was unanswerable, the student wrote what they could, and
THE MARKER THEN MARKED THEM DOWN FOR IT — the app asking about something it
never showed them and then docking marks for the gap. Twice for one missing
artefact, the second time in writing.

`stimulus` is that material, reproduced in full on the question
(`normaliseStimulus`). It belongs to the QUESTION and never to a part, which is
what a real paper does: one source, then (a), (b), (c) about it. A bare string
is accepted — a generator will sometimes return one, and a source with no
caption is still a source; losing the material over a missing label is the
exact failure this exists to stop. A quiz generated before this has `null` and
every renderer draws nothing.

**It goes to THREE places and the third is the one that gets forgotten.**
`SourcePanel` draws it above the stem in the player and on the review card
after marking — feedback that says "you did not cite the 1962 figure" is not
checkable without the thing they were reading from — and `stimulusText` puts it
in the MARKING prompt, because an examiner asked to judge an answer to a
question they cannot read will mark it as recall failure.

It is drawn as a DOCUMENT and not as another of the app's panels: an inset
well, a rule down the left the way a block quote is set, the label as a caption
above. Half the skill being tested is reading the source, so a student has to
be able to tell at a glance which words are the examiner's. Selectable, and it
scrolls at a height rather than clamping behind a "show more" — a source you
cannot read all of is the same failure as no source.

**ONE RULE, FOUR GENERATORS, IMPORTED NEVER MIRRORED.** `STIMULUS_RULE` is a
long prompt string and pasting it into four files is the copy that rots: three
get a fix and the fourth quietly keeps shipping unanswerable questions.
`quizSchema.test.mjs` scans for it, the same guard `megaUpload.test.mjs` keeps
over the page price.

- The **main quiz generator** and **reshuffle** take `STIMULUS_RULE` and
  `STIMULUS_SCHEMA`. Reshuffle gets one extra line: it works from the QUESTIONS
  rather than the original file, so it cannot point back at anything.
- **Active Recall** takes `STIMULUS_RULE_INLINE`, because `session.questions`
  is a string array and there is no field to put a source in. Inlining it as a
  quoted preamble is correct there rather than a compromise — the question
  renders as one block of text, so it reads exactly like a paper.
- **ExamMode generates nothing.** It assembles questions out of quizzes the
  student already has, so its fix is to CARRY the source through
  (`normaliseStimulus` at the point of assembly) and draw it. Without that, a
  stimulus question arrives on the mock exam stripped of its extract, still
  saying "Using Source A".

**BOTH FORMATTERS REBUILD A FIELD WHITELIST**, which is exactly where a newly
added field is silently dropped — the question would still say "Using Source A"
and the source would be gone. Carried explicitly in both, and the test
round-trips it.

`referencesMissingSource` catches a dangling reference and is **deliberately
narrow**: it matches phrasings that point at a NAMED ARTEFACT the model was
reading and did not reproduce, never "the following", "below" or "above", which
refer to the question's own text, and never a bare "the graph", because a
question can legitimately describe one in words. Guessing wide throws away good
questions, which is the worse error. Nothing is stripped — a paper two
questions short is worse than one odd question — but the generate toast SAYS
how many, because the student is the only one who can press generate again.

## Where numbers disagreed, and the five places they still did

**"Can you check the whole site for other places where numbers disagree."** The
answer was five, all visible to a student, plus two mirrors with nothing
guarding them. The shape is always the same and it is worth naming once: **two
surfaces answer one question, each is internally consistent, and nothing on
screen says which is right.** It never throws, lint and the build pass, and the
student is left to decide which of the app's own numbers to believe.

**THE QUIZ AVERAGE HAD FOUR DIFFERENT ANSWERS ACROSS SEVEN SURFACES.** Three
corrections, each invisible on its own, and every reader had applied a
different subset:

| | adjusted score | unscored dropped | retries excluded |
|---|---|---|---|
| Quizzes hero, deck faces, SubjectHub | yes | yes | yes |
| Analytics — headline, per-subject, AND the improvement delta | inline copy | **no** | no |
| AI performance analyser | no, raw `.score` | no, `\|\| 0` | no |
| The student's own DATA EXPORT, twice | no, raw `.score` | **no, and no coercion** | no |

That last row is the worst of them: `sum + r.score` over an attempt whose
marking never came back is NaN, so the export printed **"Average Score: NaN%"**
in a file the student downloads. `sitScores` / `averageScore` (quizDeck.js) are
the one answer now, and `quizDeck.test.mjs` scans for a reduce over `.score`
that is then divided — **which is how the fourth Analytics average was found at
all.** `quizDelta` was not in the manual sweep; the scan caught it, along with
the fact that it sorted on `date`, a DAY, so sits in one afternoon fell into
whichever half the rows happened to come back in.

**"THIS WEEK" MEANT TWO DIFFERENT WEEKS.** `date-fns` defaults `startOfWeek` to
SUNDAY. Nine surfaces passed `{ weekStartsOn: 1 }` or used `studyLog`'s own
`weekStart`; five took the default — Study (twice), Analytics (twice) and
StudyGoalsProgress. **On a Sunday those two groups are a FULL WEEK apart**, so
the dashboard and the Study page reported different totals for "this week" and
neither was wrong about its own arithmetic. Monday everywhere now, and
`studyLog.test.mjs` scans for the bare call — reading to the matching paren, so
a multi-argument call is judged on its own arguments rather than on the rest of
the line. It diverges one day in seven, which is exactly why a comment would
not have held.

**THE EXAM SIMULATOR PRINTED THREE SCORES FOR ONE PAPER.** A written answer the
student has not self-marked is PENDING — neither right nor wrong. The headline
divided by `total - pending`; the By Subject bars and the weak-topic list
divided by `total`, counting every unmarked answer as a miss. So one screen
showed 80% at the top and 40% underneath, and **told a student Chemistry was a
weak topic when all that had happened was they had not marked it.** `markedPct`
(quizScore.js) is the one denominator, `bySubject` tracks `pending` so it CAN
be applied, and it returns NULL rather than 0 when nothing is marked — grading
a submitted paper at the bottom band for work nobody has read is the same
mistake in a different direction.

**ANALYTICS' SUBJECT ROWS NEVER SUMMED TO ITS OWN HEADLINE.** The headline was
techniques + recall + blurting + QUIZZES; each subject row was the first three.
A student who mostly sits quizzes watched most of their term go missing from
the breakdown directly below the total that included it.

**AND THE TWO-TABLE TRAP HAPPENED A THIRD AND FOURTH TIME.** The study-log
section above says anything asking "did they study" goes through `studyEvents`
"or it will happen a third time". `StudyGoalsProgress` and the data export both
read `study_techniques` alone, so a week spent on quizzes and the activity
tracker was worth nothing on the dashboard's goal bar and missing from the
export's "Total Study Time".

**THE MIRRORS WERE FINE AND NOTHING WAS CHECKING THEM**, which is a different
risk and not a smaller one. `uploadPrep`, `megaUpload`, `storageBudget` and
`holdings` all pin their client/server copies. Two did not:

- **The level curve.** `xpSystem.jsx` opens with "Mirrors functions/awardXP.js
  — keep in sync" and nothing ever did. The server writes `current_level` off
  ITS copy while every screen draws the ring off the CLIENT's, so a changed
  exponent would put the stored level and the drawn one on different curves,
  permanently.
- **The ATAR bands.** Eight thresholds written out THREE times — `atarBands.js`
  (whose header says "KEEP THE THRESHOLDS IN SYNC"), `ranked.js`'s own `BANDS`
  with a tone on each row, and `atarBand()` in server.mjs. `ranked.js` derives
  from `atarBands.js` now and writes down only the TONE, which is the part it
  actually owns.

`mirrors.test.mjs` pins both. It parses BOTH sides as text and runs them —
server.mjs boots Express on load and `xpSystem.jsx` is a .jsx the test loader
will not resolve — which compares BEHAVIOUR rather than source, so a reformat
passes and a changed exponent fails. Verified by breaking each side in turn.

Two smaller ones fixed alongside: the data export read the STORED
`current_level` while every other screen derives it from `total_xp`, so it was
the one place able to print a stale level; and `bestScore` there was
`Math.max(...quizzes.map(q => q.score))`, which is NaN the moment one attempt
is unscored.

**Not fixed, recorded:** the server's week is **UTC** Monday
(`currentWeekStartUTC`) and the client's is **local** Monday, so the weekly AI
budget resets about ten hours late for a Melbourne student. Closing it needs a
timezone per account, which the server does not have, and it is a fixed offset
rather than two screens disagreeing. And four components are mounted NOWHERE —
`QuizStats`, `StudyStats`, `StudyAnalytics`, `WeeklyProgress`. Each carries its
own copy of a number computed elsewhere (QuizStats has its own inline
`effectiveScore`), so they are four future disagreements; they are left alone
under this file's own rule that twice an "unused" symbol here marked a
half-wired feature rather than dead code. Do not re-audit them — decide.

## Sharing: a column name nobody checked broke six features silently

**"Can you make sure flashcards can be shared between friends."** They could be
sent. They could not be ACCEPTED, and had never once been — and the audit that
established it turned up five more features failing the same way, all of them
invisible for the same reason.

**THE WHOLE CLASS IS ONE MISTAKE: a column the app names and the database does
not have.** PostgREST answers 400, the promise rejects, the `catch` prints a
generic toast or nothing at all, and lint, the build and every test pass —
because nothing in any of them touches a database. There is no runtime signal, so
these sit for months. `dbColumns.test.mjs` reads `supabase/schema.json` and now
scans the CLIENT half too (`entityTables()` + a brace-depth walker over the first
object literal of every `.filter` / `.create` / `.update`), which is what
surfaced all six at once:

- **`subject_code` is not a flashcards column.** Both share writers put it in
  the payload and `handleAcceptFlashcards` SPREAD that payload into
  `Flashcard.create` — so every accept 400'd. The knowledge was already in the
  repo: SpacedRepetition.jsx carries the comment *"schema has no subject_code
  column on flashcards — keeping the field would 400 the insert"* seventy lines
  above the share path that keeps it.
- **`shared_flashcards` / `shared_ai_results` name the receiver
  `shared_with_email`**, not `recipient_email` — only `friendships` has that.
  Account deletion read both with the wrong name, which rejected the whole
  `Promise.all`, so **"delete my account" failed for every student, always.**
- **`study_groups` has no `is_active`**, and `member_emails` is a `text[]` that
  a scalar `eq` can never match. Two separate reasons the group list came back
  empty on /StudyGroups and in the share dialog.
- **`group_flashcard_decks` has no `deck_name`, `created_by_email` or
  `contributors`** (they are `name`, `created_by` and `extra`), so a group deck
  has never been created.
- **`group_shared_resources` has no `imports_count` or `imported_by_emails`** —
  also `extra` — so sharing to a group failed and "already imported" could
  never be true.
- **`$or` is a Base44 / Mongo-ism.** `applyWhere` turns every key into an `eq`,
  so AIToolsHistory asked PostgREST for a column called "or": nobody on that
  page could see a friend to share with.

**A DECK CROSSES A BOUNDARY TWICE, and each crossing had its own answer.** Out
of the sharer's rows into a JSON blob, and out of that blob into the
recipient's rows. Three call sites, three different answers.
`src/lib/sharedDeck.js` is the one crossing now and it is two pure functions:
`outgoingCard` is what may LEAVE, `importedCard` is what may ARRIVE. Nothing is
spread in either direction.

- **A spread carries whatever the blob holds.** Today's writers whitelist six
  fields so nothing leaks; an older row, or the next writer somebody adds,
  carries the SHARER'S SM-2 state — and `retired_at` above all, which takes a
  card out of every queue in the app (`due.js` reports `known` before it checks
  anything else). Carried across, a friend would accept sixty cards and open an
  empty deck. The test asserts against the sharer's FULL row rather than the
  whitelisted blob, because that is the shape the leak actually arrives in.
- **`unit` survives.** The group importer dropped it, and the review shelf keys
  decks on subject|topic|unit — so an imported deck split away from its subject
  under a blank unit. The same constant-`unit` lesson the mistake bank records.
- **An imported card is NEW, not scheduled.** The group importer dated every
  card to tomorrow; `due.js` counts a never-reviewed card as new, which is the
  honest reading, and dating it hid a deck for a day on the screen the student
  imported it to use.
- **A card with no question or answer is DROPPED.** Both columns are `not null`,
  so one empty card would reject the insert and lose the other fifty-nine.

The test reads the flashcards column list out of `schema.json` rather than
restating it — a column list written down twice is what went wrong — and scans
the tree for the two shapes that render perfectly and are simply wrong: a
card-shaped literal naming `subject_code`, and a shared card spread into
`create()`. The scan matches on the literal's SHAPE (it carries `question` and
`answer`) rather than on what is near it: the window-based first draft missed
SpacedRepetition.jsx, where the literal and the `flashcard_data:` consuming it
are three hundred characters apart.

**`Promise.all` IS THE WRONG PRIMITIVE FOR A LIST OF INDEPENDENT WRITES**, and
account deletion was the worst case of it in the app. One unreadable table
discarded the other twenty-one reads; one rejected delete discarded every delete
that had already landed. Both phases are `allSettled` now, the tables are a
NAMED list (`accountTables`), and a partial failure says which part is still on
file — and **does not log the student out**, because signing somebody out of a
half-deleted account leaves them no way back in to see what is left or to ask us
to finish it. Same rule `uploadAll` already keeps.

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

**THE MULTIPLIER IS WHAT COMES BACK. It was 1/price, and that was WRONG BY UP
TO TEN TIMES.** The reasoning that shipped it sounded fine — a multiplier is how
a market prints what it believes, "1.61× yes" says *the favourite* to somebody
who has never met a probability, and the real cred sat in the tiles beside it.
All true and all beside the point: the largest figure on the card had no
relationship to money, on a screen where everything else is money. A longshot
card printed **7.24×** when the most that position could ever return was 1.8×.

The honest multiple is simple and it exists. A position returns `stake +
payout` and `payout = stake · K · skill`, so `back / staked = 1 + K · skill`.
The stake cancels. `returnMultiple` is that, `bestReturn` is the ceiling per
side at `CONVICTION_MAX`, and every figure a card prints is now a call a
student can actually place by dragging the slider to the end.

**THE 2× CEILING IS STRUCTURAL, not a setting.** `skill` is bounded in [-1, 1],
so at K = 1 the return is bounded in [0, 2] — and raising `PAYOUT_K` does not
lift it, because the escrow has to cover K · stake and the ratio against what
you put up is unchanged. A proper scoring rule whose downside is bounded by the
stake CANNOT pay more than double. Returns genuinely live in a narrow 1.0–2.0×
band; printing that narrowly is the price of printing something true, and
`market.test.mjs` sweeps the whole (p, price, outcome) space to prove nothing
escapes it and that the multiple equals the cred to within one rounded unit.

The ordering survived, which is what made the old number plausible: the
underdog still pays more than the favourite. Only the magnitudes were fiction.

Switching to real bookmaker payouts was considered and refused. It reopens the
farm the who-may-resolve rule closed — a market on your own study log is
allowed deliberately, and under a scoring rule backing a near-certainty you
control pays ~nothing while under a multiplier it prints cred — and a
pari-mutuel needs two sides this board will not have: four people all on YES
with YES landing is an empty loser pool and a market that pays nothing when you
were right.

**THE CONVICTION TRACK BEGINS AT THE ROOM'S PRICE, AND THAT DELETED A
PARAGRAPH.** A side and a strength are two controls over one number, so the two
could disagree and did: pick YES at 55% into a market already pricing yes at
80¢ and you are FURTHER from yes than the price is, so the rule pays you when
NO lands. Correct arithmetic, printed as a contradiction, under the side the
student had just chosen — and the panel answered it with a warning naming the
side they were really on, the line, and what to drag.

A warning that explains a control is a control that wants replacing. The RANGE
was the wrong thing: conviction ran from the coin flip whatever the price was,
so half the track was, for that side, a position on the other one.
`convictionRange` anchors the floor at what the room already pays for the side
picked, and the inversion is not warned about — IT CANNOT BE EXPRESSED.
`market.test.mjs` walks every price and every reachable conviction to hold
that, because the warning it replaced is gone and nothing on screen would say
so if it came back.

What is left is the reading that was buried in the sentence: HOW FAR PAST THE
ROOM YOU HAVE DRAGGED is the gap you are paid on, as a distance rather than a
subtraction of two printed numbers. Three things fall out of it:

- **The floor is the room's line OR the coin flip, whichever is HIGHER**, and
  the label says which. Under 50¢ a side already beats even money, so the coin
  flip is the real anchor there and "past the room" would simply be false.
- **A side the room has run past `CONVICTION_MAX` has no call left on it.**
  That is a fact about the market rather than an error, so it is REPORTED — the
  button is disabled and says "already priced in" — and the panel opens on the
  side that can still be backed rather than greeting somebody with a dead one.
- **Conviction is CLAMPED ON READ, not only where it is set.** The price is a
  prop and it moves: somebody else takes a side while the sheet is open and the
  floor slides out from under a handle nobody touched. That is the inversion
  arriving without anybody dragging anything.

**"If you're right" was a lie under a scoring rule, and it printed one.** A side
is not a position here; a DISTANCE FROM THE PRICE is. Take NO at 55% into a
market already pricing NO at 80¢ and you are further from NO than the price is,
so the rule pays you when YES lands — which the old panel drew as "If you're
right: −16", a negative number under the winning label in the winning colour.
The tiles name the two OUTCOMES now, the colour follows the sign of the money,
and when the two disagree the panel says so and names the conviction that would
actually back the chosen side.

**THE PRICE HISTORY IS ALREADY RECORDED, so nothing about the chart is stored.**
Every position carries its stake, its probability and its timestamp, and
`priceOf` is a pure function of the positions standing at the time — so
replaying them reproduces the path EXACTLY, including every frozen
`price_at_entry`, with no snapshot table and nothing that can drift from the
board it describes. `priceHistory` does it; the test asserts the reconstruction
rather than approximating it.

**It plots the PRICE and prints the return.** The price is the quantity with a
meaningful scale (0–100); the return is bounded in [0, 2] and is a different
number that must not share an axis with it. One line, never two — NO is
100 − YES, so a second line is the first one's reflection. It is a STEP chart
because it is a step function: at thirty students a market's week is three or
four steps with flat stretches between, and smoothing draws a line through data
that is not there. The y-window is padded but never narrower than `MIN_SPAN`,
since tight auto-scaling draws a two-point wander as a crash and a fixed 0–100
draws every market near even as a flat line.

**SHAPE CARRIES THE SIDE ON THE CHART, NOT JUST COLOUR.** The brand green and
the streak red sit at ΔE 7.0 under deuteranopia — fine everywhere else on the
floor, where the word "yes" or "no" is printed beside them, and NOT fine on the
step dots, where a bare mark was the only thing saying which way somebody
leaned. A circle against a square reads at 8px and needs no colour at all.
Anything on this floor encoding yes/no in those two hues needs a second channel
or a label; run the palette through a CVD check before assuming otherwise.

**A MARKET ABOUT YOU SORTS FIRST, whatever its heat.** "Twelve people are
trading your week" is the single most motivating sentence this app can put on a
screen and it is most of why this can be a retention engine rather than a
leaderboard. Otherwise the board is sorted by heat — conviction on the table
plus a clock running out — never by recency, which would put an untouched
question above one four people are arguing over.

**It is a different ROOM, on purpose — AND THE DARKNESS WAS NEVER WHAT MADE IT
ONE.** This note used to say the floor rendered identically in both themes and
that THAT was the point, on the focus-mode reasoning: a token that flips
underneath a deliberate inversion is the bug rather than the fix. Half of that
holds and half of it does not, and the difference is what the two screens are
FOR. Focus mode is a BLACKOUT — bright is the one thing it must never be, so a
token that could turn it white is a genuine fault and its ink stays literal.
The floor is not a blackout; it is somewhere else. A light floor does that
perfectly well as long as it is COOL SLATE where the app is warm cream, rather
than the dashboard with market cards on it.

So the floor has its OWN palette rather than no palette: `.floor` scopes about
thirty `--floor-*` tokens (index.css) with a light and a dark value each, and
it follows the app theme. A student who set the app light no longer walks into
a near-black page halfway through a navigation, which was the real cost of the
old rule and never something it intended. The class sits on ONE wrapper
(`Room`), which is what lets a `position: fixed` overlay inside the room — the
settlement reveal, the take-side sheet, the line dialog — inherit the palette
without being told which room it is in: custom properties inherit down the DOM
tree, and `fixed` escapes layout rather than the cascade.

**THREE TOKENS PER BRAND HUE, and each has a job.** `--floor-yes` is the FILL
and is the brand green on both floors, because a filled pill is bright either
way and near-black ink reads on it. `--floor-yes-ink` is TEXT and strokes and
is DEEPENED on light: `#58CC02` is about 2:1 on white, so a price printed in it
is a price nobody can read. `--floor-yes-rgb` is the same colour as channels,
for the seventeen places wanting a tint — Tailwind's `/40` modifier cannot
compute alpha from a `var()` holding a whole colour, and a tint of the BRIGHT
hue on white is invisible, so a tint follows the ink rather than the fill. The
two colours a student already reads as good and bad mean the same things on
both floors; only their depth moves. Third place on the league board taught the
matching lesson: `streak` red on a podium read as a warning.

**A DESIGNED ROOM DOES NOT LEAVE A CONTROL TO THE BROWSER.** `accent-color`
paints the filled half of a range track and leaves the rest to the user agent,
which draws it from `color-scheme` rather than from anything on the page — so
the floor's one slider came out as a `#3B3B3B` bar across a white card. The
`.floor-range` rule puts the gradient on the INPUT's own background with the
track made transparent, because a pseudo-element cannot take an inline style
and the fill position has to come from the value: `--range-fill` is that
position and `--range-ink` the hue, both set at the call site.

**EVERY WAY TO BREAK THIS IS SILENT**, which is why `floorInk.test.mjs` exists
rather than a comment. A misspelled token is an invalid declaration, so the
element simply inherits; a floor token used outside `.floor` is blank; the
`floor` class going missing blanks all of them at once. That last one HAPPENED
during the refactor — an earlier pass had already rewritten the string the edit
was looking for, so the replace matched nothing and the page rendered in
inherited ink. And `--floor-solid` is the one pair that swaps outright between
the floors, so sharing `--floor-on-bright` with the brand fills made the
primary button dark-on-dark the moment the floor went light. All four are
assertions now; only a screenshot caught any of them.

**ACE DEALS THE BOARD WHILE IT LOADS** (`AceDeal`). Opening the floor is an
ARRIVAL — a dark room a student has not seen, and the thing they are waiting
for is a table with cards on it — so the wait IS the deal rather than the grey
spinner this was the last screen in the app still showing.

**AND THE MASCOT HAS TO BE THE THING THAT MOVES.** The first version was six
cards springing in past a STILL DRAWING of him: `pose="toss"` set once,
`idle={false}`, `eyes={false}` — three switches that each turn his own motion
off, so the only animation was the cards and the character was a picture beside
them. A mascot who does not move while six cards fly past him is not dealing
them, he is watching.

He deals A ROW AT A TIME, which is what dealing onto a two-column table looks
like and is also what makes the flick legible: three beats with a real pause
rather than six at a speed where the arm never finishes travelling. Each beat
is toss → recover, and the recovery is `stand` because it is the biggest ARM
delta from `toss` in the pose table — `offer` was the first choice and its
hands sit almost where the toss leaves them, so at 56px the throw disappeared.
The cards fly from HIS corner, further for each row and column, so the six fan
out of one point instead of sliding in from the same offset six times.

Then `proud`, so the deal has a finish rather than a stop — and then he is
simply standing with `idle` ON and his own fidget system takes over. A SLOW
LOAD IS THE ONE CASE A LOADER CANNOT DESIGN FOR, and the answer is the
character's own behaviour rather than a loop that gets more annoying the longer
it runs.

**IT IS THE SKELETON, NOT A CURTAIN IN FRONT OF ONE.** The dealt cards are on
the same grid at the same size in the same places, so the content fills in
underneath and nothing jumps. An animation that plays and THEN hands over to a
loading state has made the student wait twice.

It reuses `pose="toss"` — Ace flicking a card out of frame and watching it go,
written for a gag and exactly a deal — so there is no new artwork and he
arrives the way he arrives everywhere else. `tone`/`card` are CLASS NAMES and
not colours, and they are passed the floor's literal inks taken from
`MarketCard`, because the room renders identically in both themes. Under
`prefers-reduced-motion` the cards are simply placed. `AceShuffle` stays right
for the other twenty-five screens: small, beside a line of text, out of the way.

**Minting is automatic, because an empty board kills a market site.** The first
person to arrive on Monday must find something to trade, and "create the first
market" is work nobody does. Minted on demand, deduped by a unique index on
(kind, subject, period, ref) so two students opening the board in the same
second cannot post the same question twice with the stakes split between the
copies.

**THE SCARCE RESOURCE IS TRADERS, NOT QUESTIONS, and the first version had it
exactly backwards.** It minted two markets per member per week over the whole
`user_profiles` roster: ~264 questions a week about ~132 accounts, most of whom
had not opened the app since the migration. Against that, ~30 active students
take maybe 110 positions between them in a week — **under half a trader per
market**, so most questions ended the week untouched and the floor read as a
site nobody uses.

The failure was structural rather than cosmetic: supply scaled with SIGNUPS and
demand scaled with ACTIVES, so the board got worse as the app grew. A market
has to do the opposite. The target is roughly fifteen to twenty questions,
which is five to seven traders each and a price that means something.

Three cuts get there, and none of them takes anybody off the board:

- **The activity gate.** Solo markets are minted only about students who have
  studied inside `MARKET_ACTIVE_DAYS`. Nobody can hold a view on a stranger who
  last studied in May — and it closes a live farm: a student under
  `MARKET_MIN_OBS` weeks gets prior 0.5, so "Will <dormant> study 5+ days?"
  opened at even and resolved NO with near-certainty. Taking NO at 97% paid
  **+125 on a 500 stake, risk-free**, across two hundred such markets.
- **One question per person, not two.** Streak and hours about the same student
  correlate so hard that holding both is one position taken twice. They
  alternate on the week and the address, so the board is not thirty streak
  questions one week and thirty hours questions the next.
- **PAIR THE ROOM UP.** `pairUpRoom` sorts by base rate and pairs neighbours
  into head-to-heads, so thirty students become fifteen markets with everybody
  still on the board. Two solo markets about two similar students are two
  private facts; ONE market asking which of them logs more is a question the
  whole room can hold a view on. Matched on the prior because an even question
  is the tradeable one — a mismatch prices at 90¢ and pays nobody. The offset
  alternates weekly so the same two are not rivals all term, and ties break on
  the address or two students swap places between board loads.

**The special lines are four more QUESTIONS, not four more objects.** `kind`
picks a glyph and a sentence and nothing else — same card, same gesture, same
`payoutFor`, same sweep. That is the line between a variant and a feature, and
it is the line this rebuild was about. `versus` is the pairing above; `cohort`
is the whole board's week as one question (best value per row on the floor —
one market, thirty people with a genuine view, and nobody needs to know the
subject); `longshot` is deliberately unlikely, with the threshold ESCALATING
until the base rate is actually long, because a longshot the room clears most
weeks is a question with a bad name; `prep` comes off an assessment already on
somebody's planner.

**A SAC LINE IS OPENED ON AN ASSESSMENT, NOT TYPED.** `openMarkMarket` took a
free-text subject, a slider and a date, none of which the app checked against
anything it already knew — so "Chem" and "Chemistry" were two subjects to every
screen that groups by one, a line could close on a day no SAC was happening,
and nothing connected the market to the SAC. Which made reporting the mark a
SECOND act of typing: `window.prompt`, into a market, out of 100, while
`subject_assessments.score` and `out_of` — columns shipped since migration 0002
— stayed null on every row in the database. An input with no column and a
column with no input, for the same number, on two screens.

It reads the planner now. Everything but the line comes off the row, and THE
ROW IS WHAT SETTLES IT: the mark is entered once on the planner (`MarkEntry`),
and `reportMark` reads it back off `subject_assessments` rather than accepting
a number from the request body — the rule every other settlement here keeps,
reached on the one endpoint that had been ignoring it. The two screens cannot
disagree about one mark because there is only one mark. `markPercent` is the
one conversion, shared with the server, so the percentage under the box is the
percentage the market settles on; a missing half returns NULL and never a zero,
which would resolve a market as a fail for a student who has not typed it in.
The dedupe index does the rest: `ref` is `sac:<assessment id>`, so one line per
SAC, and the dialog hides the ones already called rather than offering a row
that produces a 409.

**AND A LINE IS PRICED AGAINST THEIR OWN RECORD.** Every SAC market opened at
0.5 whatever it said, which is the same hole the activity gate closed on the
weekly lines: "Will they score 95+?" from a student averaging 58 opened at even
money and paid whoever took no, on a fact anybody with a calendar could see.
`priorForLine` is Laplace-smoothed rather than the raw share, so four-from-four
does not open at 100¢ and leave nothing to trade, and clamped either side for
the reason `PRIOR_WEIGHT` exists — an opening price nobody can profitably
disagree with is not a market. Under `MARK_MIN_OBS` past marks IN THAT SUBJECT
it refuses, opens even, and the card says so; a Methods mark tells you nothing
about a Chemistry SAC, so nothing is borrowed across subjects. The dialog
states what the prior will be built from BEFORE the line is set — "off your
last 4 Chemistry marks, averaging 75%" — because the room is about to be handed
their average and that is the most useful thing this screen can tell them.

**THE SUBJECT GETS THE ROOM'S READ, AND NO CRED IN ANY BRANCH.** They cannot
hold a position — they report the result — so the floor used to tell the one
person the whole board was trading absolutely nothing. `selfLine` is what they
get instead: how many people are reading them, which way, and where the price
landed. On settlement `calledOf` puts it in the same `SettlementReveal` as
everybody else's payout, sharing one seen-set, keyed `called:<id>` so a subject
result and a position result on one market cannot swallow each other. `missed`
is drawn in the CAUTION ink and never the loss red — the number on that card is
a real school result, and an app that prints a sixteen-year-old's SAC mark in
the colour it uses for a lost bet has started editorialising about their
schooling. `selfRecord` keeps the running version and REFUSES under
`MARK_MIN_OBS` closed lines, the same floor as the calibration curve; its
`drift` is signed, because a student who clears every line is not
well-calibrated, they are sandbagging.

Nothing in any of it is farmable, because no branch moves cred toward the
subject — which is what lets the mark stay self-reported.

**A mark needs somewhere to be READ, or the input repeats the failure it
closed.** The planner prints "Marks so far" under the upcoming list, derived
from the rows already loaded. Six of them: this is a glance at how the term is
going, not a transcript — a full record belongs on Analytics.

**The planner mints PREP and not a mark market, and that is a deliberate
deviation.** A SAC mark line is the best content this board has and
`openMarkMarket` already builds one — on request, by the student it is about.
Minting those automatically would publish "this person has a Chemistry SAC on
Friday" and put a sixteen-year-old's mark up for the room, for someone who
asked for neither. Streak and hours are already auto-minted about everyone, but
a MARK is a different order of private than an hours total, and consent nobody
sought is not something a settlement can hand back. So the planner mints the
question beside it — whether they START — which resolves off the study log that
is already on the board, publishes no mark, and is the better question anyway.
The mark line stays one tap away, opened by the person whose mark it is.

**FRIENDS MAY NEVER SPLIT A PRICE — BUT THEY MAY NARROW A VIEW**, and the
difference is everything. A friends-only *market pool* is the obvious fix for a
floor full of strangers and it makes the real problem strictly worse: five
friends means five possible traders per question and a price that means
nothing. Thin markets need CONCENTRATION — the same arithmetic that rules out
an order book here. School fragments it harder still at two to five students
each, and is worth having later as a TEAM dimension ("Melbourne High vs
Brighton" is one market both schools trade) rather than as a pool.

So `ROOMS` are a VIEW of one floor. Everybody trades the same market at the
same price; a room only decides which of them are LISTED. The rule was never
about what may be shown — it was about what may be PRICED, and this note used
to conflate the two. Three rooms: **Everyone** (the floor, always offered),
**Friends** (people you know, plus yourself — the most motivating market on the
board is the one about you), and **Whole cohort** (`cohort` and `longshot`, the
questions about nobody in particular).

**A ROOM WITH NOTHING IN IT IS NOT OFFERED.** A student with no friends yet
never sees a Friends tab, rather than meeting an empty one on their first
visit; and the page falls back to Everyone if the room they are in empties
underneath them. Switching rooms resets the kind chips, because a chip from
the old room may not exist in the new one.

`subject_is_friend` and `in_contest` are computed server-side for the same
reason: the subject's email is stripped from the payload for everyone but its
owner, so the client has nothing to match on.

**THE FLOOR HAS A SIZE, AND IT IS ABOUT TRADERS RATHER THAN STUDENTS.**
Minting makes one question per active student, so the board grew with the room:
~18 markets at 30 actives, which is the target, and **~68 at 130**, which is
nearly four times it. That is the "supply scales with the roster" failure this
board was rebuilt to fix, arriving a SECOND time — through growth rather than
through signups — and at ~110 positions a week it puts under two traders on
each question. "Having all users is too much" was that, and a room filter alone
would only have hidden it.

`pickBoard` caps the floor at `BOARD_TARGET` and chooses what makes it:

- **The special lines always make it.** `cohort`, `longshot` and `prep` are few
  and each is the best value per row — one market the whole room can hold a
  view on. Capping those for a head-to-head is backwards.
- **An EVEN question beats a lopsided one**, the same reason `pairUpRoom`
  matches on the base rate: a market priced at 90¢ pays nobody.
- **BUT THE BOARD ROTATES.** Ranking on evenness alone means a student whose
  prior sits at 0.85 never once sees a question about themselves, which is the
  single most motivating thing this board does. The tradeable ones are rotated
  by a stable hash of the WEEK before slicing, so everybody surfaces — just not
  all at once, and the same week always picks the same board, because a floor
  that reshuffles between two page loads is one nobody can come back to.
- **What is already open counts against the target**, or a second visit in one
  week mints another twenty.

`MARKET_MINT_CAP` survives as the outer valve on a single insert. It is not the
board's size and never was.

**Some `meta` keys may never be published.** A head-to-head carries both
addresses and a cohort line carries the roster it was minted against — both
needed to SETTLE, neither publishable. `publicMeta` strips them in `shape()`
rather than at each call site, where the next kind to carry one would quietly
leak it. The roster is FROZEN at mint and never re-derived at settlement:
recomputing who is "active" afterwards would change the denominator after every
position was taken against the old one.

**A dead heat VOIDS.** "Did A beat B" has no answer when they tied, and
defaulting it to NO would pay everyone who happened to be on the second-named
side for a question that was never settled.

**THE BOOK HAD EVERYTHING EXCEPT A HIERARCHY.** The content was right from the
start — value, calibration, equity, open and settled — and it still read as a
form rather than as a trading screen, because NOTHING LED. Four identically
sized tiles sat in a row with no first number among them; the equity curve,
which is the whole story of somebody's week, was in a 190px box in the second
column; and the positions were plain text lines where the one figure that
matters was a 14px column on the right.

Every broker app opens the same way and it is not decoration: ONE value, large,
with what you made under it, and the chart of that number filling the width
beneath. That ordering IS the argument — this is what you have, this is what
you did to get it, here is the path — and everything else is detail drawn as
detail.

**THE HERO IS A BALANCE AND THE DELTA IS THE PART YOU EARNED**, which is what
finally answers the complaint this section opens with. Value is `cred + at
stake`: what is in hand plus what is escrowed, both real cred. Under it,
`realised` — what the student's own calls have paid, which is exactly what the
curve draws. The big number is allowed to include the Monday grant because it
is a BALANCE; the number attributed to them is the one they earned. **Expected
is NOT in it**: there is no way to close a position early here, so folding the
open book's EV into a headline balance is the same overreach as calling it
unrealised P/L.

**A DRIFT BAR HAS TO BE ON ONE SCALE, or it is not a comparison.** A position
row's question is "has the room come toward me", and the obvious drawing — a
track spanning THIS row's entry and current price — is worse than the text it
replaces: every row gets its own scale, so a 2-point drift and a 30-point drift
render identically and the column becomes actively misleading. It is a signed
bar from a shared centre on a fixed ±`DRIFT_FULL`, with the number still
printed beside it for anything past the end.

**EXPOSURE IS CAPPED AT FOUR NAMED SLICES BECAUSE THE FLOOR HAS FOUR HUES.**
Seven kinds mint on this board, and an uncapped bar needs seven distinguishable
colours; past four it is reaching for greys that read as the same slice twice,
and a legend nobody can map back to the bar has stopped being a legend.
`exposureOf` folds the tail rather than the legend doing it — but never folds a
SINGLE slice, which would just rename it and lose the name. Grouped by `kind`
because that is what a student can act on; grouping by yes/no would only say
which way they lean, which the hit rate already covers.

**THE STANDING IS A BAND, NEVER A POSITION.** "4th of 31" is a leaderboard and
Compete already has one; a second on the page that exists to answer "how am I
doing" turns a private screen public. `standingOf` reports "ahead of 68% of
traders" — the same information about THEM with nobody else identifiable — and
the server sends bare figures with no addresses attached, so there is nothing
in the payload to put a name to. A TIE COUNTS AS HALF, or everybody on a flat
book reads as ahead of everybody else on a flat book. It refuses under
`RANK_MIN_CALLS`, the same floor as the calibration curve and for the same
reason. That constant is restated in `server.mjs` — `holdings.js` resolves
`@/lib/...`, which only the bundler and the test alias loader understand — and
`holdings.test.mjs` asserts the two copies agree.

**`Number(null) === 0` GOT IN AGAIN**, in the peer list: coercing first turned
every missing figure into a trader sitting flat, which drags the band toward
the middle and puts anybody with a positive book ahead of people who do not
exist. Caught by its own test, fixed the way `expiredKeys` and `markPercent`
already do it. That is three separate modules this trap has reached.

**`best` was computed and rendered nowhere**, which this codebase treats as a
bug rather than as spare capacity — and a book that names only your best call
is a highlight reel, so `worst` joins it and they are drawn as a pair. A void
is neither: it tested nothing.

**This week is Monday-anchored off `studyLog`'s own `weekStart`** rather than a
second copy of the Monday maths, and it is NULL rather than a row of zeroes
when nothing has settled — "0 calls, +0 cred" printed every Monday morning is a
strip that says nothing three days out of seven.

**THE BOOK IS THE SECOND TAB, and calibration is the centre of it.** The floor
answers "what can I take a side on" and has no way to answer "how am I doing" —
which is the question that brings somebody back midweek. The cred figure in the
header is not an answer: it moves for two unrelated reasons, the Monday grant
and your own calls, so a number that goes up when you did nothing teaches that
the number means nothing.

`holdings.js` derives all of it from positions that already exist — equity from
settled payouts in order, the record, the expected value of the open book, and
the calibration bands. Nothing is stored, so the curve cannot disagree with the
tape and the record cannot disagree with the reveal.

**Calibration is the one thing a betting app cannot show you.** The model asks
for a BELIEF rather than an accepted price, so the beliefs are on file: when you
said 80%, were you right 80% of the time? It is bucketed on CONVICTION and not
on P(yes) — backing no at 80% is the same claim as backing yes at 80%, and
bucketing on the raw probability would split one skill across two ends of the
axis and report neither. Count is the DOT'S SIZE and never a second y-axis: how
many calls sit in a band and how accurate they were are different scales, and a
second axis would invent a relationship between them.

**And it refuses to score somebody on two calls.** A band under
`CALIBRATION_MIN` is a tick with its count, never a point; under
`CALIBRATION_MIN_TOTAL` settled calls the panel says how many more are needed
and draws nothing. Telling a sixteen-year-old with three resolved calls they are
overconfident is a personality judgement made off a coin flip — the same rule
as TREND_MIN, MARKET_MIN_OBS and MIN_BASELINE_WEEKS, each added after the same
mistake.

**EXPECTED IS NOT UNREALISED.** There is no way to close a position early here,
so there is no exit value; the tile holds the expected payout at today's prices
and says so. Calling it unrealised P/L implies a sell button that does not
exist.

**A LEVEL AND A VOID ARE NEVER LOSSES** — not in the record, not in the hit
rate's denominator, and not in the streak. The whole board rests on "restating
the price pays exactly nothing", and a book that files that under defeats
teaches the opposite of the one property the system has.

**`getPortfolio` is separate from `getMarkets` on purpose.** That endpoint
returns the 30 most recently resolved markets on the whole board, which is the
right payload for a tape and the wrong one for a history: a student's own tenth
call can easily fall outside it, so a book built on it would report a fraction
of somebody's record as all of it. It pages, it mints nothing, it settles
nothing, and it is in `READ_ONLY_FUNCTIONS`.

**`/Market?id=` is one question in full**, because a market is a thing you send
somebody — "twelve people are trading your week" is worth far more with a link
under it, which an in-place expansion cannot give. The id rides in the query
string for the reason SubjectHub's does. The card's TITLE is the way in, not the
whole card: the primary action on a board card is taking a side, and a card-wide
link would swallow the take-side sheet inside it.

**THE TAPE IS THE CONVERSATION, and that is why there are no comments.**
Migration 0034 ruled out free text on Compete in its own words — "16-year-olds
competing with each other and sometimes losing in front of the group; a text box
on that is a moderation problem this app has no way to staff" — and that got
STRONGER, not weaker, once markets were being auto-minted about named students.
A thread under "Will Maya study 5+ days this week?" is an unmoderated public
conversation about a named minor on a page her school can open. What replaces it
is already there: "Maya took no at 71¢ with 300 cred" is a statement with a name
and money behind it and needs no moderation, because the only vocabulary is a
price. Reactions are the rest — `reactToEvent` grew a market branch reusing
0034's glyph set and its `unique (created_by, event_key)`, so **no migration was
needed**; a position gets its own glyphs too. THE EVENT KEY IS DERIVED ON THE
SERVER for the market path, because the contest path's membership check is what
guards its client-supplied keys and a market has no contest to check.

**`Room` had a negative margin cancelling padding that does not exist.** It
carried `-m-4 sm:-m-6 p-4 sm:p-6` to pull the dark ground past the page padding —
except Layout's `<main>` has none, and every other page is a plain
`min-h-screen bg-background` that owns its width and pads inside. So the margin
had nothing to cancel and pushed the floor 24px wider than the viewport, giving
/Competitions a horizontal scrollbar at `sm` and up for as long as it has
existed. Extracted to a component so the market page cannot re-copy the bug.

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

## The first session DOES ONE REAL THING

**"A starter tutorial... effective, educational but also engaging so the user
doesn't get bored or tabs out."** A new account already met four surfaces — the
six-step signup wizard, `AceTour`, the dashboard setup nudge and the Help
manual — so the ask was not for more onboarding. It was that the onboarding
there is PASSIVE.

**A TOUR IS A NARRATED SLIDESHOW.** Ace walks to a page, says what it is for,
you press Next. Six times. Nothing happens and nothing is yours at the end, so
you read the first two leads and press Next through the rest. That is the
SHAPE, not the copy, and no rewrite of the leads fixes it.

**The apparatus was the problem, not the idea.** A richer version existed and
was reverted (`be14756`): it gated each step on evidence and paid XP per step,
across a client library, a component, a SERVER PAYOUT SOURCE and six
`data-run-target` anchors scattered through the pages. Every one of those rots.
So the constraint on this one was to earn its engagement without rebuilding
any of it.

**So the student PRODUCES something.** Pick a subject, say what is going wrong
with it, and the app writes three real exam questions, marks the answers, and
says what that did. The quiz row, the attempt and any banked mistake are REAL
and they stay — which is the whole difference between a tutorial and a first
win. `src/lib/firstWin.js` is the model; `FirstWin.jsx` conducts.

**IT IS A CONDUCTOR, NOT A SECOND QUIZ PLAYER.** The sitting and the marking
happen in the real `QuizPlayer`, reached by a real route (`/Quizzes?play=<id>`,
added for this and useful on its own). That is the point rather than a
shortcut: the marking panel already itemises criteria and already carries the
save-to-your-mistake-bank button, so **the two least discoverable things in the
app get taught by being USED.** A bespoke three-question player would have been
a second copy of the surface `quizScore.js` has had to fix four times. The cost
is that the run must survive a navigation, so the beat is written to the
profile before leaving rather than held in memory.

**THE GENERATE NEEDS NO UPLOAD.** The main quiz generator requires a file —
reasonable on the Quizzes page, impossible on minute one. The questions come
from the subject's VCAA examiner prompt instead, which is the same move
blurting makes when it marks against the Study Design with no notes.

**Four concepts, each taught AT THE MOMENT IT BECOMES TRUE** rather than
delivered as a lesson:

- **Which technique** — at the "what is going wrong" beat. The options are the
  student's own words ("I read it, then it's gone"), never ours; the TECHNIQUE
  is the answer, and putting it in the question would teach nothing. The test
  reads Study.jsx's own `TECHNIQUES` list to check each one exists, because
  recommending a technique and then opening somewhere else is the app arguing
  with itself one screen later — studyIntent's rule.
- **Chips** — at the moment one is spent, with the price on screen BEFORE the
  button. That is megaUpload's rule, and it is why the first refusal a student
  meets later reads as a budget rather than as the app being broken.
- **The marking** — by being marked, in the real panel.
- **The ATAR** — at the close, and see below.

**THE CLOSE MAY NOT INVENT.** The tempting ending is "that's +0.4 ATAR". It
would be fiction: the AcedIt ATAR is a trailing-28-day composite that is
UNRANKED under three study days, so a brand-new account does not have one and
nothing they just did produced that figure. Printing it teaches a student on
their VERY FIRST SCREEN that the numbers here are decoration, after which the
real ones do not land either — the same refusal the dashboard rail makes.
`closingFacts` reports only what happened (their real score, the real XP,
whether a mark was dropped) and explains the ATAR as a thing that starts from
here. `firstWin.test.mjs` asserts the line quotes no figure, and scans the
module for a hard-coded one.

**A CLEAN SWEEP IS NEVER OFFERED A MISTAKE TO BANK.** `droppedFrom` counts off
`extra.question_results`, the per-criterion verdicts the marking already
produced. Without them the honest answer is that we cannot tell — except a
score under 100, which is arithmetic rather than inference.

**`Number(null) === 0` GOT IN AGAIN**, in `closingFacts`' own default argument,
and this time it would have printed **0%** at a student about work nobody had
marked, on their first screen. Caught by the test that was written for it. That
is now five modules — `criterionIndexFor`, `expiredKeys`, `markPercent`,
`standingOf` and this.

**NO SUBJECTS, NO FIRST WIN.** Inventing a subject to demo on would make the
quiz fake, and the whole premise is that what this produces is real. With an
empty list it stands down and the tour takes it.

**NEITHER OF THEM COULD BE STARTED, and both are one tap from being gone
forever.** Both derive their own eligibility from the profile's age and open
themselves in Ace's corner, and both write `skipped` the moment the X on his
bubble is pressed — which is the single most likely thing to happen to a bubble
that appears unasked-for. So a student who dismissed him on minute one had
permanently lost the first run AND the tour, with no control anywhere in the
app to get either back, and no way to find out there had been anything there.

`aceReplay.js` is the channel and the line it draws is: **an automatic offer is
DERIVED, a replay is a REQUEST.** Nothing in it touches `firstWinStatus` or
`tourStatus`, which answer "should this open at somebody who did not ask" and
must stay derived from the profile's age — a flag meaning "has not seen it"
would ambush all ~130 existing accounts at once. A replay is not that question:
somebody pressed a button, so it runs, at any age, as often as they like.

**A REQUEST IS STICKY, because the listener may not have mounted.** The run
hands to the tour at its close and Layout keeps AceTour unmounted for as long
as the run is live, so the handover fires at a component that does not exist
yet and a plain event is simply lost — the one button on the close doing
nothing. The pending set makes the order irrelevant: a late listener claims it
on mount, an already-mounted one hears the event, and `take` clears it either
way so a surface that does both cannot start itself twice. The close requests
the tour rather than relying on it being eligible, or a replay months later
would hand over to a `tourStatus` that says no.

**ONE CARD, TWO HOMES.** `StartHereCard` is on the dashboard for
`ENTRY_WINDOW_HOURS` — double the run's own window, deliberately, because it
exists for the student who just closed Ace and will not go looking — and then
permanently on Help, where reference lives. `showRunCard` refuses while
`firstWinStatus` is non-null, since a card telling somebody to start a thing
that is already talking to them from the corner is the app asking twice. The
dashboard copy SAYS where it goes, because a control that disappears without
saying so is one the student assumes they imagined.

**AND A PRESSED BUTTON NEVER DOES NOTHING.** The no-subjects branch used to
write `skipped` and vanish, which is right for the automatic run — nobody asked
— and is the worst thing on this page for a replay. `open({ replay })` is the
only thing that flag changes: a request with nothing to build on says what is
missing and points at Subjects.

**THE RUN LEADS, THE TOUR IS THE MAP BEHIND IT.** Both fire on a fresh account
and both are Ace in the same corner; two of him talking over each other on
somebody's first screen is worse than either alone. `tourShouldWait` holds the
tour until the run is done or skipped. Eligibility for both is derived from the
profile's own age, never a flag needing a backfill — an unknown age counts as
OLD, because getting it wrong generously ambushes all ~130 existing accounts
with a tutorial for an app they already use, and getting it wrong the other way
costs one student a first run.

**`onFinished` is not decoration.** FirstWin patches its OWN copy of the
profile, so Layout's stays stale for the rest of the session — and Layout is
what decides whether the tour may start. Without the callback, the close
button's "Show me around" would hand over to nothing until the next reload.

**Every failure stands down honestly.** Out of chips, a generate that does not
come back, or a response with no usable questions: it says so and offers the
tour. It never fabricates a question to keep the flow moving, and an empty
shell is not a quiz — sending somebody into the player to look at a blank page
is a worse first impression than admitting the build failed.

`scripts/_floorProbe.jsx?v=firstwin` draws all four talking beats at the
bubble's TRUE width, which is the only way to judge them: at full width the
copy looked fine and at 21rem the third beat was 420px of theory on a phone,
read before anything had happened. Both themes, and check the phone.

**AND THE WHOLE RUN IS WALKED IN A REAL BROWSER** (`npm run e2e:serve`, then
`npm run e2e:firstwin`). Everything interesting about a CONDUCTOR is an
INTEGRATION — a navigation, a write that has to survive it, two components
agreeing about whose turn it is to speak — and not one of those is reachable
from an assertion file. `firstWin.test.mjs` covers the model and could not see
any of it. The first walk found two real bugs on its first pass:

- **He talked over himself on the most important screen of the run.**
  `onLiveChange` was answering "is the bubble on screen", and Layout was asking
  "is a run in progress". They differ in exactly one place: the quiz player,
  where the bubble stands down and the run is still going. So the moment the
  first quiz opened, Layout un-suppressed everything — the study-intent modal,
  AceBuddy's bubble and a second Ace, all drawn over the three questions the
  app had just built for them. `showing` and `running` are separate now.
- **`droppedFrom` read `criteria[].met`, a field nothing has ever written.**
  The player writes `got`, and so does the field /MistakeBank's redo gate
  reads. So the per-criterion branch was DEAD and every close fell through to
  "score < 100", reporting one dropped mark on a paper that dropped three.
  **Its own test used `met` in the fixture too** — written from the same memory
  as the code, which proves only that the two agree. The check that closes it
  reads the field name out of the PLAYER's own mapper.

`scripts/_fakeBase44.js` is the backend, swapped in at the module level by
`E2E_FAKE=1`. It has to be a module alias: `base44` is a Proxy answering its
five surfaces from closures, so assigning over them lands on the client
underneath and changes nothing. **And it goes in `dualRunDispatch`, not in
`resolve.alias`** — a pre-plugin resolves first, which is why the two entries
in the alias array are duplicated there — matching on the MODULE and not the
spelling, because by then `@/api/base44Client` has already become
`/src/api/base44Client`. The store lives in `sessionStorage` because a real
backend survives a reload, which is the whole reason the beat is written to the
profile rather than held in state.

What it does NOT cover, stated plainly: the API boundary itself. Whether those
columns exist is `dbColumns.test.mjs`'s job against the real schema, and
whether Claude returns usable questions is not something any harness asserts.

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

**A HELD POSE IS A STILL FRAME, and both onboarding surfaces were one.** Every
tour stop passed `pose="point"` and every first-run beat did the same, which
reads as a decision and is the AceDeal failure with a different switch:
AceBody fires its idles ONLY from a resting pose (`stand`, `happy`, `peek`,
`offer`), so `point` is not a mood he holds, it is his own motion turned off.
He walked in, raised an arm, and froze there for as long as the student took
to read — which on a tutorial beat is the longest he is ever on screen, and
six stops that all pointed were also six identical stops.

`pose` may be a SEQUENCE now. AceWalker plays it once the stride has landed
and **holds the LAST entry**, so the last one is the load-bearing one: end on a
resting pose and his fidget system takes over, end on a gesture and he holds
the gesture. The gesture plays only after the walk, because the stride
overrides the pose and one played during it is one nobody sees; under reduced
motion he goes straight to the settle. `trip` stays the BEAT and never the
busy flag — he is already standing there when a build starts, and bumping it
would send him off the edge to walk in again.

So he waves them in, thinks about what is going wrong, points at the button,
and works (`think`, deliberately not a rest) while the questions are written.
The tour gets a gesture per stop for the same reason it gets a lead per stop.
`acePose.test.mjs` reads `POSES`/`RESTING` out of AceBody as TEXT — it is a
.jsx and the loader will not resolve it, the same reason mirrors.test.mjs
parses its two sides — and asserts every sequence settles. `?v=acepose` runs
them all for real; `data-ace-pose` is what a still can show of an animation.

Layout stands AceIntro and AceBuddy down while it runs; they share the corner
and the mascot. It goes quiet on the payment flow, because the wizard sends
premium-intent signups straight to /Subscription.

**IT NO LONGER LEADS.** The first run (above) goes first, because it is the one
that produces something; `tourShouldWait` holds the tour until that is done or
skipped. The tour then answers the other question — where everything lives —
which is a real question and not one the first run tries to cover.

## The science rail folds away

`NeuroPanel` is 380px of every Study screen, on every technique, permanently —
and it is REFERENCE. Read once, maybe twice, then sitting beside the thing the
student actually opened the page to do. A timer running next to a brain diagram
is the diagram winning an argument it should not be having.

It collapses now, and **the grid goes with it**: keeping the 380px column and
putting a bar in it would leave the tool at the same width with a hole beside
it, which is the whole thing the student was collapsing. One column, and the
technique takes the page.

**It is not deleted and it does not hide itself.** What is worth reading once is
worth being able to find again, so the collapsed state is a real control that
NAMES what is behind it — "The science behind Pomodoro" — rather than a chevron
on nothing.

**ONE preference for every technique**, keyed `acedit.study.science`. A student
who folds it away on Pomodoro has said what they think of a reference rail;
asking again on Active Recall is the app not listening. It defaults OPEN —
folding somebody's content away for them on a first visit is not the app's
decision to make — and a blocked or absent `localStorage` costs a render rather
than a crash, the same posture every other stored preference here takes.

Sticky only while it is a rail. A one-line bar that follows the page down is a
thing stuck to the screen for no reason.

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
- Supabase is on the FREE plan and the app now self-limits to stay inside it
  (see the storage section). If you raise any upload cap, re-read the
  arithmetic there first — the failure mode is the whole project 402ing, not a
  failed upload.
- Lint is at 3 warnings, down from 190. What's left is unread state; the
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

## Uploads: where files live, and why they kept failing

**"Uploading and generating is broken all over the site, especially flashcards,
and even smaller files get rejected."** Four separate causes, none of them the
one it looked like.

**THE FILE STORE WAS NINE TIMES LARGER THAN THE SERVER.** Uploads lived in a
plain `Map` in `server.mjs`, capped at 150 files × 30 MB — up to **4.5 GB** on a
Render `starter` instance with **512 MB of RAM**. One 30 MB PDF costs ~70 MB
transient on its own (the buffer, plus the base64 string built from it), so a
couple of ordinary uploads OOM'd the box; Render restarted it, and every stored
file went with it. `render.yaml` also sets `autoDeploy: true`, so **every push
to main wiped it too**. Upload and generate are two separate HTTP calls, and
anything in between — a deploy, a restart, or 150 other students' uploads — left
the model holding an `[ATTACHMENT PROBLEM]` block and telling the student it
could not see their file. That is the whole of "sometimes it just doesn't
generate", and it was worst exactly when the app was being worked on.

Files go to **Supabase Storage** now (`ai-uploads`, bucket created on first use
so there is no setup step), with memory kept only as a **write-through read
cache bounded in BYTES** — 48 MB, a number that means something on a 512 MB box,
where "150 files" did not. With no service-role key it degrades to memory-only
and logs that ONCE, so a misconfigured deploy is visible without spamming.

**THE SIZE LIMIT WAS A NUMBER FROM NOWHERE.** multer allowed 30 MB. The real
ceilings, which everything now derives from rather than restates:

- an image may be **10 MB of BASE64**, and base64 inflates by 4/3 — so the
  number a file picker must enforce is **≈7.5 MB of actual file**;
- the whole request may be **32 MB**, which is what bounds a PDF (16 MB raw
  leaves real headroom once encoded);
- images must be JPEG/PNG/GIF/WebP; both models the app uses have 1M context, so
  the PDF page ceiling is 600, not 100 — a long PDF is a cost and quality
  problem, not an API one, which is why the page count is a WARNING.

`IMAGE_RAW_CAP` is written as `IMAGE_BASE64_CAP / BASE64_INFLATION` so the step
that was got wrong stays visible, and `uploadPrep.test.mjs` asserts the server's
copies match — the "change one, change both" guard this codebase keeps needing.

**THE FIX FOR PHOTOS IS A RESIZE, NOT A LIMIT.** Claude downsamples every image
to 1568 px (2576 px on newer models) on its long edge before reading anything,
so the megapixels in a phone photo are thrown away on arrival — they only ever
cost upload time on school wifi, tokens, and the chance of being refused.
`prepareFiles` resizes to 2000 px in the browser first: **11.8 MB → 1.6 MB**
measured, and nothing the model reads is lost. An image already small enough is
returned UNTOUCHED, or a clean PNG diagram would collect JPEG artefacts for
nothing, and the canvas is filled white first, or a transparent PNG flattens to
black. HEIC cannot be decoded by a browser, so it travels whole and the server
converts it.

**A FILE IS NEVER REFUSED OVER A HEADER.** The same JPEG arrives as
`image/jpeg`, `image/jpg`, or `application/octet-stream` depending on the
browser, the OS and whether it was dragged or picked. The server matched on the
MIME type alone and CheatSheetMaker had its own `allowed.includes(f.type)`
whitelist, so two of those three were dropped as "unsupported file type" — a
small, valid, readable file refused over a string the student never chose. That
is most of what "even smaller ones get rejected" was. `resolveMime` (server) and
`kindOf` (client) fall back to the extension whenever the type is missing or
unrecognised.

**AND THE PICKERS DID NOT ACCEPT IMAGES AT ALL.** Flashcards took
`.pdf,.txt,.docx,.pptx`; Active Recall took `.pdf,.docx,.pptx` and not even
plain text. Four surfaces, four different answers, none of them a photo — on an
app for sixteen-year-olds, whose server has read images the whole time.
Photographing your notes is the most natural way a student has of getting
material in, and it was the one thing they could not do. `STUDY_ACCEPT` and
`STUDY_ACCEPT_LABEL` in `pickFiles.js` are now the single answer, and the label
is derived from the same constant so the copy under the button cannot drift from
what the button takes.

**`Promise.all` IS THE WRONG PRIMITIVE FOR A LIST OF UPLOADS.** It rejects on the
first failure and discards every result that succeeded, so one unreadable file
turned a five-file generate into nothing at all with no clue which file was the
problem. `uploadAll` is `allSettled`: what landed goes, what did not is named.
Quizzes already did this; the three study tools did not.

**Every refusal names the file, the size and the limit** — including multer's
own. `LIMIT_FILE_SIZE` went to Express's default handler as a **500 with a
stack**, so the largest files failed in the most opaque way available. Both
numbers print to one decimal: rounding the cap told a student with a 7.8 MB
photo that "the limit is 8 MB" and then refused it, which makes the app look
broken rather than the file.

## Mega uploads: a textbook, stored whole, read a chapter at a time

**A BIG UPLOAD IS NOT JUST A BIGGER UPLOAD.** The ordinary path caps a PDF at
16 MB because a request may be 32 MB. Raising that is the easy half and it is
not the problem. The problem is that **a document costs input tokens for every
page, every time it is read**, and the docs are explicit: 1,500–3,000 tokens of
text per page PLUS the image tokens, because each page is rendered and read as
a picture as well. About 4,600 tokens a page all in.

So 600 pages is ~2.8M input tokens — **about $8.30 on Sonnet, against a $1.95
weekly budget for the entire student**. One press of "make flashcards from my
textbook" would cost four weeks of everything else they do. Anything that
sends a whole book is unshippable at any price the chip stack can express.

**UPLOAD WHOLE, GENERATE FROM A RANGE.** The book is stored once; each generate
names its pages and only those are sent and only those are charged. Three
things fall out and all three are improvements: a 40-page chapter is a normal
action (95 chips of reading); "make cards from chapter 7" is a better ask than
"from these 600 pages", which returns mush; and a textbook never sits in the
512 MB box, because only the slice is ever encoded.

`src/lib/megaUpload.js` is the model — caps, ranges and the price — and the
server IMPORTS it rather than mirroring it, so the number under the range
picker is the number on the bill. `megaUpload.test.mjs` scans the tree to keep
it that way; a second copy of the page price is the one thing this must never
grow.

**THE PRICE IS ON SCREEN BEFORE IT IS SPENT.** This is the only action in the
app whose price is not fixed — every other button costs what `chips.js`
published, and a mega read costs its PAGES. The surcharge threads through
`canAfford` → `canUseFeature` on the client and `checkTierAccess` →
`recordTierUsage` on the server, so the button cannot say yes to something the
server is about to refuse.

**IT READS ON HAIKU AND THE PANEL SAYS SO.** Input tokens are the whole cost
here and Haiku is 3× cheaper on them — the same chapter is 95 chips rather than
283 — and pulling facts out of a textbook is bulk comprehension rather than the
judgement marking needs. `megaPages > 0` forces the model past the student's
own tier. An app that quietly downgrades the model and lets a student conclude
it is just bad has spent their trust to save its own money.

**A MISSING RANGE MEANS ONE PAGE, NEVER THE WHOLE BOOK.** Every clamp points
the same way, because the failure modes are wildly asymmetric: reading too few
pages wastes one press, reading 600 spends a term's chips. The picker opens on
30 pages — a typical chapter — rather than on `RANGE_PAGE_CAP`, which would
greet somebody with a third of their weekly stack and a slider already pinned
to the right.

**PAGE NUMBERS ARE 1-BASED EVERYWHERE, and `pageIndices` is the one
conversion.** An off-by-one here is invisible: page 214 looks exactly like page
215 unless something checks the number printed on it. The round-trip is
asserted against a book whose every page carries its own number.

**A HANDLE IS SCOPED TO ITS OWNER.** `local-file://` ids are unguessable UUIDs
and that is all that protects them; a stored textbook is far larger and more
personal, so the owner is hashed INTO the bucket key and checked on every read.
The client only ever holds `mega-file://<uuid>` — `megaFiles` strips the
storage key before answering, and a test asserts it does.

**ONE SLICE AT A TIME, server-wide** (`megaGate`). MEASURED, not assumed: a
74.8 MB book loads in 93 ms for ~7 MB above the buffer (pdf-lib's `load` is
lazy) and slicing 40 pages costs another 7 MB. So one slice of a 100 MB book is
~115 MB transient and two at once is not something a 512 MB instance should be
asked to survive — this file has OOM'd that box once already.

**STORAGE IS THE CONSTRAINT, NOT COST**: 60 MB a book, two active books, a
72-hour TTL and a 450 MB share of the bucket, all bounded by EVICTION rather
than by a clock — see the storage section below. A book is cached on local
disk for an hour after it is fetched, so a student working four chapters in
one sitting costs one download of egress rather than four.

**It is wired into Flashcards, Quizzes and Active Recall**, one `<MegaPicker>`
each, and each one prices the pages against that feature's own chip price. A
chapter is SOURCE MATERIAL, so every one of them starts a generate on its own —
requiring an upload beside it would make the picker a control that cannot be
used, which is the "feature gated behind an optional-looking step" shape this
file already records. Active Recall shares ONE pick across both of its generate
paths: it is one setup screen with one source list, and a second picker would
be two answers to "what am I working from".

`pdf-lib` is the one new dependency and it is load-bearing — nothing else in
the tree can count a PDF's pages or cut a range out of one.

## The free tier is a CLIFF, and a full bucket breaks the whole app

`src/lib/storageBudget.js`. Supabase's free plan is 1 GB of file storage and
5 GB of egress a month, and exceeding it does NOT degrade storage and leave the
rest running: the organisation gets a grace period, and after it **every
service returns 402** — database, auth, the lot. A second grace period is not
granted. So a bucket quietly filling up does not break uploads, it breaks the
app for every student including the ones who never uploaded anything.

**`ai-uploads` had NO SWEEP. Ever.** Every file any student had uploaded was
kept forever. At 230 accounts (130 live plus a 100-student trial) three files
each at 3 MB is 2.0 GB; five at 4 MB is 4.5 GB. There is no plausible usage
pattern where that bucket stays under 1 GB, and it was already on that path
before mega uploads existed and whether or not anybody ever used one. That —
not books — was the thing about to take the site down.

**THE ORDER OF YIELDING IS THE DESIGN**, and `storageBudget.test.mjs` asserts
it rather than trusting the comments:

1. **Sweep.** An ordinary upload is read ONCE, by the generate seconds later.
   Keeping it for a week bought nothing, so a day's TTL reclaims essentially
   the whole bucket, tightening to four hours at `SWEEP_HARDER_AT`.
2. **Books EVICT, and only then refuse.** Reclaiming beats refusing every
   time, and there is almost always something to reclaim: somebody's book from
   two days ago that nobody has opened. `sweepMegaGlobal` drops what has aged
   out across every student, then evicts least-recently-read until the bucket
   fits — including making room for the upload arriving, so a book is never
   refused by a bucket that was one file over. A student meets the refusal
   only when every book on the shelf is being actively read, which is the one
   case where refusing is correct. The picker asks the server first, so nobody
   pushes 60 MB up school wifi to be told no at the far end, and **books
   already stored keep working**.
3. **Ordinary uploads stop being PERSISTED and keep working.** `storeFile`
   already had this path for a deploy with no service key, and it serves a
   generate perfectly — upload and generate are seconds apart and the bytes are
   in the memory cache. What is given up is surviving a restart, which is
   strictly better than a 402 across the whole project.
4. There is no step four. **A GENERATE NEVER FAILS BECAUSE OF STORAGE.**

Usage is TRACKED, not measured per call: listing a bucket to answer "how full"
on every upload would be the slowest thing in the path. Seeded from one
listing, moved by every write and delete, re-seeded on a timer — eventually
consistent, which is why every threshold sits well short of the cliff.

**EVICTION IS WHAT LETS THE CAPS BE GENEROUS.** Once the bucket is bounded by
reclaiming rather than by a TTL, the TTL stops being a storage control at all
and becomes a UX one — so it is as long as is useful (a book survives a
weekend) rather than as short as is safe. The same reasoning raised the file
cap: 60 MB rather than 40 because THAT is the limit a student actually
collides with, and collides with hardest — a real VCE textbook PDF is commonly
30–60 MB and "yours is 55 and the limit is 40" is a flat refusal with nothing
to do about it. Shared pressure is absorbed invisibly; a per-file ceiling is
not, so the ceiling goes as high as the share allows.

**AND THE SWEEP WALKS EVERY STUDENT.** `sweepMegaFiles` only ever touched the
prefix of whoever was uploading, so a student who stored a book and never came
back kept it forever — their own sweep can never run again, by construction.
`megaInventory` walks the whole bucket, and `maybeSweep` is fired from every
path that touches storage (both uploads, the book list, and any generate
carrying a file) rather than from uploads alone, which is the RAREST thing the
app does. Firing only there meant a quiet week reclaimed nothing.

**`expiredKeys` and `evictionPlan` are pure functions because they DELETE** —
`evictionPlan` deletes OTHER PEOPLE'S files, which is a higher bar again. Same reasoning as
`pageIndices`: a deletion decision inside a loop in a handler cannot be checked
until it has already removed the wrong thing. Two rules, both asserted:
**a file with no timestamp is NEVER swept** — and watch `Number(null) === 0`,
which turns "no timestamp" into 1970 and deletes exactly the file the rule
protects, the identical trap `criterionIndexFor` records, caught here by one
fixture row with a null date; and **`keepNewest` protects the book a sitting is
using**, so a sweep firing mid-session cannot pull it out from under them.

Eviction adds three of its own, each asserted: **a book being READ is never
evicted** (storage records writes and never reads, so the oldest by timestamp
may be the one somebody is three chapters into — `megaTouched` is the missing
half, kept in process); **each owner keeps their newest through the age pass**,
so ageing alone cannot take somebody's only book; and **it stops the moment the
budget is met**, because evicting past that destroys an upload to buy space
nobody asked for. The comparator is explicit about ties: `(b.at ?? Infinity) -
(a.at ?? Infinity)` is NaN when BOTH are unknown, and a comparator returning
NaN orders arbitrarily — for a function deciding what to delete, the answer
would change between engines.

**Do we need the paid plan?** Not for this. Ordinary uploads hold about a
day's worth (~370 MB at 230 accounts uploading normally, against 450 budgeted),
headroom takes 120, and books are hard-bounded at 450 MB by eviction — roughly
fifteen typical 30 MB textbooks resident, fewer if everybody uploads at the
ceiling, and the shortfall is absorbed by evicting rather than refusing. What a
paid plan buys is a bigger resident set and a higher per-file cap;
`MEGA_FILE_CAP`, `MEGA_ACTIVE_MAX`, `MEGA_TTL_HOURS` and `MEGA_BUCKET_BYTES`
are in one place precisely so raising them is one line each.

**AN EPHEMERAL REFERENCE ON A PERMANENT ROW IS A LIE ON A TIMER**, and
`source_file_url` was one. A Quiz row kept a `local-file://` handle and two
things re-read it long after the sweep had taken the file:

- **Reshuffle** sent it and told the model to "base ALL questions on the
  uploaded document content". With the file gone the server answers with an
  `[ATTACHMENT PROBLEM]` block and the generate RUNS ANYWAY — so the student
  got a quiz titled "(Reshuffled)" that was not from their material at all,
  silently. Not a degradation: a wrong answer wearing the right label.
- **Marking** attached it too, which is worse, because the block tells the
  model to tell the student their file could not be read — inside a MARKING
  prompt, weeks after they made the quiz.

Both now work from THE QUIZ ITSELF, which is permanent and is the better
source anyway: it holds the subject, the difficulty, the shape and every
question with its model answer, which is a fuller account of what was covered
than the PDF was. It also makes reshuffle's core instruction satisfiable for
the first time — "generate DIFFERENT questions from what was asked before" was
being given to a model that could not see what was asked before — and it means
reshuffle works on EVERY quiz now, including hand-written ones and ones built
from a chapter of a book. Marking loses nothing: every question and model
answer was already in that prompt.

Nothing reads the column, so nothing writes it (collect nothing you don't use);
old rows keep theirs harmlessly.

**A DECK IS A ROW AND IS NOT A FILE**, which is the distinction every TTL here
depends on. Cards, quizzes, mistakes and attempts are database rows and are
permanent — the sweep only ever touches the uploaded SOURCE in Storage, which
exists for the seconds between an upload and the generate that reads it. A
student who makes a deck from a textbook keeps that deck forever; what expires
is the textbook, and only as something to generate MORE from.

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
- **ONE LOADER, AND A STUDENT MUST NEVER SEE TWO IN A ROW.** `AceShuffle`
  shipped and the generic spinners were left where they were, so the commonest
  wait in the app played BOTH: a green ring while the page's chunk arrived,
  then the riffling deck while its data did. One navigation, two different
  loaders, in sequence — which reads as the app having started over rather than
  as one wait continuing.
  `App.jsx`'s `PageFallback` was the worst of them by exposure, because all 24
  pages are code-split so it fires on EVERY navigation. Its own comment said
  the ring "matches the auth one below it — same size, same tokens — so the two
  never look like different states of the same wait": the right instinct
  pointed at the wrong pair. The one it had to match was the one that comes
  NEXT, a tenth of a second later, on the same screen.
  Nothing spins a ring now, and 68 `<Loader2>` across 44 files are gone.
  `aceLoading.test.mjs` scans for both idioms, because each renders perfectly,
  passes lint and the build, and is simply a DIFFERENT loader from the one
  either side of it — the same invisible class `quizScore.test.mjs` and
  `fnResult.test.mjs` exist for.
  Three sizes and they are the three places a wait appears: `sm` in a control
  or beside a line of text, `md` beside a heading, `lg` alone in a panel —
  which is what `AceLoading` wraps, with the sentence under it.
  **A REFRESH GLYPH THAT TURNS IS NOT A LOADER** and the scan leaves it alone:
  `RefreshCw` spinning is the control saying it is working, in the control's
  own place. Shimmer skeletons (`AISkeleton`) are not loaders either — a
  skeleton is the shape of the content, which is the better answer wherever one
  can be built, and is why `AceDeal` deals cards onto the real grid.
  **THE INK IS A NAMED PRESET, NOT LOOSE PROPS.** `ink="floor"` exists because
  the Compete floor renders in literal ink in both themes, so a token card is
  cream on the felt in light mode and invisible in dark. It is a preset after
  the loose version shipped a bug: the card was given the floor's ground and
  THE FACE WAS NOT, so the spade stayed `fill-foreground` — near-black on a
  near-black card — and rendered as two floating eyes and no spade. A card's
  ground and the ink printed on it are one decision; splitting them across two
  props is how half of it gets made.
- **A STATUS DISC HOLDS A GLYPH, and a deck of cards is not one.**
  PaymentSuccess put the loader in the same 64px coloured circle its error
  state uses for `AlertCircle`; a card stack inside a coloured pill reads as a
  rendering fault. The waiting case loses the circle rather than being squeezed
  into it, and the failed case keeps its badge, because a warning IS an icon.
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
- `src/lib/uploadPrep.js` + `uploadPrep.test.mjs`, `src/lib/pickFiles.js` — the
  real API limits and the arithmetic behind them, in-browser photo resizing, and
  the one `accept` string every upload surface uses. `storeFile` / `loadFile` /
  `resolveMime` in `server.mjs` are the server half; the test pins them together
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
- `src/components/market/PriceChart.jsx` — the tape. Replayed from positions,
  plotted as a price and printed as a return; `header={false}` inside TakeSide,
  where the card above already prints it
- `src/lib/holdings.js` + `holdings.test.mjs` — the book: equity, calibration,
  the four-outcome record. `getPortfolio` in `server.mjs` is its only read
- `src/components/market/PortfolioPanel.jsx`, `CalibrationCurve.jsx`,
  `EquityCurve.jsx` — the second tab on the floor, led by one value with the
  curve of it underneath. `scripts/_floorProbe.jsx?v=book` renders the whole
  book against a term of fixture calls, which is the only way to judge a
  hierarchy
- `src/pages/Market.jsx` + `Reactions.jsx` + `Room.jsx` — one question in full,
  the glyphs, and the floor's shared ground; `getMarket` in `server.mjs`.
  `Room` is where the `floor` class goes, which is what scopes the palette
- `src/index.css` `.floor` / `.dark .floor` + `src/lib/floorInk.test.mjs` — the
  floor's own light and dark palette, and the four silent ways to break it.
  `scripts/_floorProbe.jsx?v=floor` draws the board, a card and the take-side
  sheet in one screen so the room can be judged as a room
- `src/components/ace/AceShuffle.jsx` + `src/lib/aceLoading.test.mjs` — THE
  loader, its three sizes and its two rooms; the scan that stops a generic
  spinner reappearing beside it. `scripts/_floorProbe.jsx?v=loaders` draws
  every size, both inks and the in-control case in one screen
- `src/components/market/AceDeal.jsx` — the floor's arrival: Ace dealing the
  board onto the grid the real cards fill, which is the skeleton rather than a
  curtain in front of one. HE is what moves; the switches that turn his own
  motion off are the bug this had
- `src/components/planner/MarkEntry.jsx` — what you actually got, typed once,
  on the planner. It fills `score`/`out_of` and `reportMark` reads them back to
  settle; `scripts/_floorProbe.jsx` renders it and the floor's other new
  surfaces against fixtures, since both pages are auth-gated
- `src/lib/megaUpload.js` + `megaUpload.test.mjs`, `src/api/megaUploads.js`,
  `src/components/shared/MegaPicker.jsx` — a textbook stored whole and read a
  chapter at a time: the caps, the 1-based ranges and the per-page chip price.
  `uploadMega` / `megaFiles` / `sliceMegaPages` in `server.mjs` are the other
  half and IMPORT this module; the test scans so a second price cannot appear
- `src/lib/storageBudget.js` + `storageBudget.test.mjs` — the free tier's
  cliff, the order things stand down in so a generate never fails for want of
  storage, and `expiredKeys`, the tested decision both sweeps delete through.
  `storageState` / `sweepUploads` / `noteUsage` in `server.mjs` are its half
- `src/lib/quizScore.js` + `quizScore.test.mjs` — ONE mark per question, read
  by every surface that prints one; the test scans for the hand-rolled
  allocation and the unreconciled claim, both of which render perfectly
- `src/lib/fnResult.js` — the one unwrap for `functions.invoke`; reading its
  `{ data, error }` envelope as the payload is silent and has shipped twice
- `src/lib/firstWin.js` + `firstWin.test.mjs`,
  `src/components/ace/FirstWin.jsx` — the first session does ONE REAL THING:
  a real quiz, built from their subject, sat in the REAL player and marked.
  The close reports what happened and refuses to quote an ATAR. Draw the beats
  with `scripts/_floorProbe.jsx?v=firstwin`, at the bubble's true width
- `scripts/firstWinE2E.mjs` + `scripts/_fakeBase44.js` — the whole first run
  walked in a browser against an in-memory backend. The only thing that can see
  a conductor's integrations; it found the two bugs above on its first pass
- `src/lib/aceReplay.js` + `aceReplay.test.mjs`,
  `src/components/ace/StartHereCard.jsx` — the only way back into the first run
  or the tour once Ace has been dismissed. A sticky request, because the
  handover fires at a component Layout has not mounted yet
- `src/components/ace/AceWalker.jsx` + `src/lib/acePose.test.mjs` — the walk,
  and the pose SEQUENCE whose last entry is held. A sequence ending on a
  non-resting pose renders perfectly and is a character standing perfectly
  still; the test is the only thing that says so
- `src/lib/mirrors.test.mjs` — the client/server copies nothing was checking:
  the level curve (`xpSystem.jsx` vs server.mjs) and the ATAR bands. Both sides
  are parsed as text and RUN, so it compares behaviour rather than source
- `src/lib/quizDeck.js` — `sitScores` / `averageScore`: the ONE quiz average,
  with the three corrections that were each applied by a different subset of
  seven surfaces. The test scans for a fourth hand-rolled mean
- `src/lib/studyLog.test.mjs` — the Monday scan. `date-fns` defaults
  `startOfWeek` to Sunday, which put five surfaces a full week out of step with
  the other nine, one day in seven
- `src/lib/due.js` + `due.test.mjs` — the six card states, and `isReady`: the
  ONE count of what can be sat now. `dayOf` is why `.filter(isDue)` is safe;
  the scan is why nothing counts a pile with `isDue` alone. Draw the deck faces
  with `scripts/_floorProbe.jsx?v=decks` — only a screenshot caught the arity bug
- `src/lib/quizSchema.js` + `quizSchema.test.mjs`,
  `src/components/quizzes/SourcePanel.jsx` — a question may only refer to
  material it carries: the `stimulus` field, the one rule all four generators
  import, and the panel that draws it in the player, on the review card and in
  the marking prompt. `scripts/_floorProbe.jsx?v=source` renders one
- `src/lib/sharedDeck.js` + `sharedDeck.test.mjs` — the one crossing a deck
  makes between two students: what may LEAVE the sharer and what may ARRIVE,
  neither of them a spread. Read by Friends.jsx, SpacedRepetition.jsx and
  GroupResources.jsx; the test reads the column list out of `schema.json`
- `src/lib/dbColumns.test.mjs` — the guard on the whole silent class: every
  column the CLIENT and the server name, checked against the real schema. Six
  features were failing on imagined column names when the client half was added
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
