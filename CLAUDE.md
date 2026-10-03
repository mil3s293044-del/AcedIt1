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

**A QUIZ MISS WENT TO THE FLASHCARD SHELF, and the filter was never wrong.**
`makeCardsFromMisses` was a button on the results screen that wrote every
missed question straight into `flashcards` with `topic: quiz.title` — the very
field `deckCards` filters on — so those rows were INDISTINGUISHABLE from real
cards. They sat on the shelf, in the due counts, in the forgetting curve and in
the exam builder. Nineteen files read through the filter correctly; this writer
simply went around it, which is why the reader-side audit above found nothing.

It is deleted, and nothing is lost, because both halves already exist and
neither stores anything: a dropped MARK banks from its own criterion through
`cardFromModule`, and a missed QUESTION is a SIT, which /MistakeBank's "Sit
again" tab derives from the attempt history. `autoBankRows` was deleted for
exactly this reason once already — a mistake and a question are different
sizes. The guard is on the WRITER rather than the reader now: the quiz surface
may only ever create a flashcard that `cardFromModule` built.

Rows already written cannot be told from real cards — that is what made them a
leak — so nothing is retagged; they simply stop accumulating.

**THE QUESTION IS KEPT WHOLE, AND RENDERED AS MATHS.** Every rung drills a
FRAGMENT — a criterion, a phrase, a model wording — and the question those
fragments came from was never stored. The only trace was `question_title`, a
sixty-character clip for a pill, which on a maths question is a formula cut off
mid-expression. `extra.mistake.question` holds it verbatim now and the drill
screen prints it through `MarkdownMath` like every other surface that prints a
question, as a quieter inset above the exercise: it is the CONTEXT for the
drill and never the drill itself. A card banked before it existed falls back to
its label rather than rendering an empty panel.

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

## The marker was told to be an examiner and shown none of the rules

**`subjectExaminerPrompts.js` carries 35 subjects of real study-design detail**
— the mark allocation conventions (M/A/C, "exact form or the answer mark only",
"show every step"), the key VCAA terminology, a per-subject list of how
candidates actually lose marks, and the full command-term table. Six surfaces
import it. **The one that MARKS did not.** QuizPlayer took `getLatexRules()`
and nothing else, so the prompt instructed the model to "WRITE LIKE A VCAA
EXAMINER'S REPORT" and to "use the command term" with the command-term table
sitting unused two imports away. The app's own "collect nothing you don't use"
rule, inverted, on the highest-stakes call it makes — the one whose errors come
out of a student's marks.

**And the prompt argued with itself.** It said *"Be lenient on phrasing"* above
conventions stating that a decimal cannot earn a mark the question asked for
exactly. Both instructions are defensible; together they are a coin toss the
student pays for. The line is gone, and the leniency that was actually meant —
spelling, notation written legibly another way, word order, none of which VCAA
penalises either — is stated in the rubric, so removing it did not simply make
the marker harsher.

**`markingSystem(subject)` is the one composition**, and it is a SYSTEM BLOCK
rather than more prompt. Everything in it is identical for every mark in a
subject; only the questions and the student's answers change. Left inline it
was re-billed at full rate on every marking call, which is why the profile
"could not be afforded" without anyone ever deciding that. Hoisted, it bills at
~0.1x after the first hit, and that is what pays for the worked marks too.

**A BLOCK UNDER THE MODEL'S MINIMUM CACHEABLE PREFIX DOES NOT CACHE, and
nothing says so** — it is sent in full, billed in full, and reports
`cache_creation_input_tokens: 0`. The minimum is per-model and is NOT monotonic
across generations, so `MIN_CACHEABLE_PREFIX` is a table: 512 tokens on current
Sonnet and Opus, 1024 on Sonnet 4.6, 4096 on Haiku 4.5. A bare examiner profile
is ~865–1170 tokens and would have been UNDER the floor on Sonnet 4.6; profile
plus worked marks plus rubric is ~2000–3000 and clears every model marking runs
on **except Haiku 4.5**. That exception is real: `SAVER_EXCLUDES` is empty on
purpose, so a Saver student's marking runs on Haiku and this block is not cached
for them. `cachesFor(subject, model)` answers that per model instead of
pretending one number covers it, and an unrecognised id gets the STRICTEST
floor, because guessing generously is the silent direction.

**`getLatexRules()` IS the block the profile already appends for a math-heavy
subject.** Sending both prints the delimiter rules twice, which is duplicated
instruction and duplicated cached tokens, so they are added only when the
profile did not carry them.

**WORKED MARKS BEAT MORE ADJECTIVES.** The prompt already told the model to
write like an examiner, at length and accurately. Instructions DESCRIBE a
standard; they do not SET one. Where the line sits between 2 and 3 marks on a
three-mark "explain" is a calibration, and a calibration transfers by showing a
marked response. `examinerReports.js` holds them, each a complete mark in
exactly the shape the marker must return — so the output schema is demonstrated
rather than described.

**`source` IS PART OF THE DATA.** "A VCAA assessor awarded this 1 of 3" and
"these are the published conventions applied to a written answer" are different
claims, and a model told the second is the first has been miscalibrated on
purpose. Every exemplar declares which it is and the prompt PRINTS it.
Everything shipped is `study-design`; `examiner-report` requires a `cite` and
the test enforces it.

**DISTRIBUTIONS SHIP EMPTY, DELIBERATELY.** VCAA publishes the percentage of the
state at each mark per question — the most examiner-like datum there is, and
the app has never had it. What exists is the CARRIER: the shape, the reader, the
prompt section, and the absent case. No figures, because there is no honest way
to produce "31% of students earned this mark" from anything in this repo, and an
invented percentage attributed to VCAA is the failure `closingFacts` refuses on
the first-run screen, one screen further in and much harder to catch. Paste real
figures into `DISTRIBUTIONS` and every reader starts using them; the test
exercises that path against a fixture so it cannot rot unused, and separately
asserts the shipped store is empty.

**`params.system` is how anything else gets a cached prefix.** The server's
`splitSystemAndUser` used to recognise exactly ONE prompt — it sniffed for
`VCE_EXPERT_SYSTEM_PROMPT` at position 0 — so any other stable preamble could
not be expressed and rode in the user message, re-billed in full however
unchanging it was. A caller declares one now; the old sniff stays as the
fallback. The field is scanned by `detectThreat` along with the prompt, or it
would be the one way past a check the single-field shape could not be got past.

**Both model calls in QuizPlayer send the identical block.** `askWhyRight` is
not marking, but it is the same subject and the same register, so sharing the
block means it reads the cache entry the marking call warmed rather than paying
for a preamble of its own — and "what the question was testing" is a command
term and a key skill, which is what the profile knows. The test scans BOTH
calls: a profile that reaches one and not its neighbour is the half-wired state
this replaced.

**There is no fine-tuning for Claude.** "Train it on examiner reports" cannot
mean weights. It means the profile, the worked marks, the distributions, and an
eval built from the sample responses the reports publish WITH their awarded
marks — which is also the only way to know whether any of this helped, and the
thing that would settle whether `SAVER_EXCLUDES` should finally gain
`quiz_ai_mark`.

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

## The deal was a third of a skeleton, and the mascot was a caption

**"Make the load animation look more like the page it loads into, and more
dramatic."** Both halves were real, and the first one was a bug.

**IT IS THE SKELETON, NOT A CURTAIN — AND IT ONLY WAS FOR THE CARDS.** The real
floor is a header strip, three tabs, a chip row, a board and a 300px tape rail;
`AceDeal` drew six card slots and nothing else, so every other region appeared
at once when the data landed. And the slot was `h-[132px]` against a real
`MarketCard` that MEASURES 316 at its shortest — three rows of that is about
550px of jump, on the one screen whose loader exists to stop the page
rearranging itself. Every region is drawn now, at its real size, and `SLOT_H`
is the measured height of the commonest card with MarketCard's own shape inside
it (kind row, title, the price well, the crowd row). Cards whose content runs
longer are taller and nothing can fix that; targeting the common one is what
makes the usual case seamless.

**THE WAIT GOES IN THE HEADLINE SLOT.** "Opening the floor…" used to be its own
line beside him — an element the real page does not have, and therefore one
more thing that vanishes. It sits in the `h1`, exactly where "You're holding 3
positions" is about to be, so the one honest non-skeleton element costs no
layout at all.

**THE DEAL IS FACE DOWN, THEN THE BOARD TURNS OVER.** Cards fly from his hand
as real `CardBack`s and the board turns in a WAVE — a diagonal out of his hand,
each card a beat behind the one before — into the skeleton. Six turning at once
is a transition; six turning in sequence is somebody turning them. The back is
the student's OWN if they have bought one, because the cred store's whole rule
is that owned has to be worn somewhere a person can see it.

`perspective` goes on the PARENT and the rotation on the child — an element
cannot supply its own vanishing point, and a `rotateY` without one reads as a
horizontal squash. MovePreview's card records the same lesson on the dashboard.

**HE IS BIG AND HE STANDS AT THE TABLE.** At 56px in a caption he was labelling
the wait rather than performing it: the arm is the only part of him that reads
as a throw and it had about nine pixels of travel. He overlaps the board's
near-left corner on purpose, and he CANNOT go further out — `Room` pads the page
by 16/24px and `max-w-6xl` leaves nothing at 1152, so a larger negative offset
is a horizontal scrollbar at some width, which is the exact bug `Room`'s own
header records. A halo in the GROUND colour is what separates him from the card
instead: the BrandMark glow idiom, pointed the other way.

### `CardBack` stretched its own lattice, and said in its comment that it did not

The weave is a `userSpaceOnUse` pattern — chosen, in that component's own
words, so the gauge "stays the same whatever size the card is rendered at,
because a CSS gradient lattice scales with the box and goes coarse on a big
card". It was drawn inside `viewBox="0 0 100 140" preserveAspectRatio="none"`,
**which scales user space with the box**, so the pattern scaled with it. On a
normal card that is a 20% error nobody would see. On the floor's 400×304 slots
the 8px weave came out at roughly 32×17 and skewed — the exact failure the
comment describes, produced by the line directly under it.

No viewBox, so user space IS CSS pixels and the gauge is constant at every size
and every aspect, which is what nineteen callers already believed. Two smaller
things fell out alongside, both because a room with its own palette had no way
in: `ink`/`soft` may now be passed directly, since `tone` goes through `alpha()`
which parses six hex digits and cannot read a `var()` — so inking a back in
floor tokens previously meant writing a literal into a floor component, which
the palette guard failed, correctly. And `medallion` is a prop, because 38% of
the WIDTH is right for a card shaped like a card and a dinner plate on a wide
one.

### Two guards learned the same lesson, one of them the hard way

`aceLoading.test.mjs` asserts the deal draws each region by name, that `SLOT_H`
is within the range of a real card, and that the lattice is not back inside a
stretched viewBox. All three verified by putting the bug back.

**A COMMENT NAMING A HEX IS NOT A HEX.** `floorInk.test.mjs` read raw source,
so the moment a floor component EXPLAINED why it does not write a literal — "so
inking it that way meant a literal #FFC800 here" — the scan reported the
explanation as the defect. That is the false positive `fnResult.test.mjs` and
`hookDeps.test.mjs` each had to learn, and the cost of not learning it is worse
than a red suite: the obvious way to make it green again is to delete the
sentence that says why. Comments are stripped before both scans now.

**THE SLOT IS TWO NUMBERS, because the board is one column on a phone.** 316px
is the shortest real card at 384px wide; at a 360px phone the card is 328 wide
and its title takes a third line — 338px, measured the same way. Six of those
stacked is another 130px of jump, which is the bug `SLOT_H` was added to close,
left behind on the half of the traffic that is phones. They live on the grid as
`--slot-h` rather than as two constants and a template string: a class cannot be
assembled, and a second copy of a measured number is the mirror this codebase
keeps deleting.

**AND HE IS NEVER OVER A CARD.** He stood at the board's left edge, on top of
the first one, for the whole wait — and the cards are the thing a student is
there to watch arrive. He deals from ABOVE the grid: his feet sit on the chip
row and he rises into the tab strip, so the only things he overlaps are two
rows of placeholder pills. He cannot be moved further OUT instead — `Room` pads
the page by 16/24px and `max-w-6xl` leaves nothing at 1152, so a larger negative
offset is a horizontal scrollbar at some width. Up is the direction with room in
it, and the lane is MEASURED: about 118px between the headline's baseline and
the grid, so he is sized to fit it rather than sized first and clipped after.

**THE THROW IS ALWAYS INWARD, and that is a constraint rather than a choice.**
The board is ONE full-width column on a phone, so a card starting to the RIGHT
of its slot extends the page and puts a horizontal scrollbar on it; starting to
the left runs into the margin and costs nothing. Measured: +90px of start offset
was 74px of overflow at 390.

Draw it with `scripts/_floorProbe.jsx?v=deal`, and judge it on the CLOCK rather
than on one frame — the deal, the turn and the finish are three different
screens.

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

**A MARKET BETWEEN TWO PEOPLE HAS TWO PEOPLE AS ITS SIDES.** "Who logs more
hours this week — Maya or Sam?" was answered with a Yes button and a No button.
Yes to WHAT? The student had to work out that yes meant the first name in the
title, and then put cred on it — the model's storage leaking onto the floor.
`sideLabels` is the one place that decides, and ONLY THE LABEL MOVES: the
outcome stays boolean in `payoutFor`, the settlement, `price_at_entry` and
every position already taken, and renaming that would rewrite history. Yes is
the FIRST name, because that is the order `meta.names` and the title are minted
in. A pair that arrives half-formed falls back to Yes/No rather than printing
one name against "No" — half a rename is worse than none. The settled item
CARRIES its labels, because the reveal is handed the item and never the market,
so a lookup there fell back silently and announced that a head-to-head
"resolved YES".

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

## `@/` IS NOT A PATH. It crashed the server and nothing could see it

**Two deploys failed in a row and the build was fine both times.** `credStore.js`
imported `@/lib/chips`; `server.mjs` imports `credStore.js`. Vite resolves the
alias, the test loader resolves the alias, **node does not** — so the bundle
built, lint was clean, all 946 checks passed, and the process threw
`ERR_MODULE_NOT_FOUND` on boot. On Render the only symptom is a health check
that never answers and a deploy marked Failed, and the commit that caused it was
two merges back by the time anybody looked.

There is no runtime signal short of starting the process, which is the same
shape as the missing-column 400s `dbColumns.test.mjs` exists for: it renders
perfectly, it passes everything, and it is simply wrong. `holdings.js` records
the identical trap one file over — `RANK_MIN_CALLS` is restated in `server.mjs`
precisely because `holdings.js` resolves `@/lib/...` — so the knowledge was in
the repo and a comment was all that held it.

`serverBoot.test.mjs` walks the graph now: start at `server.mjs`, follow every
relative import, and assert each one resolves under node's ESM rules. Three ways
to fail, all of them silent:

- **`@/lib/x`** — the alias, vite and the loader only;
- **`./x`** — extensionless, because node's ESM resolver does not guess `.js`;
- **`./x.jsx`** — a file node has no loader for, which is why `XP_RANKS` had to
  move out of `xpSystem.jsx` into `xpRanks.js` in the first place.

It reads files as TEXT and imports nothing — `server.mjs` boots Express and
binds a port on load, so importing it to test it is a side effect in a test run,
the same reason `mirrors.test.mjs` parses both sides rather than loading them.
It also asserts the walk REACHED the shared modules, because a walk that
silently matched nothing passes forever; and that a comment naming an alias is
not read as the defect, which is the false positive `fnResult.test.mjs` and
`hookDeps.test.mjs` each had to learn about. Verified by putting the real bug
back.

**Anything `server.mjs` can reach is written with a relative path and an
extension.** That is the rule; the test is what enforces it.

**AND THE DEPLOY RUNS THE TESTS NOW.** `buildCommand` is
`npm install && npm test && npm run build` — tests BEFORE the bundle, so a
failure costs seconds instead of a full build. The suite is ~35s, needs no
secrets, no network and no `dist`, and is stable across timezones (checked in
both UTC and Melbourne, since `studyLog`'s Monday is the obvious fragility).
That is what turns this class from a deploy that dies at the health check into
a build that fails naming the file.

**`render.yaml` ONLY BINDS IF THE SERVICE IS BLUEPRINT-MANAGED.** A service
created by hand keeps its build command in the dashboard and the committed
blueprint is inert — so a change here can look done and change nothing, which
is this file's own "half-wired feature" shape pointed at the infrastructure.
Check Settings → Build Command on the service and make the two agree.

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

**THE TABLE IS GONE, AND THE GROUND IS FLAT.** `TableGround` painted two radial
washes, a vignette and a woven texture behind the dashboard, lit by the hour —
warm from the top-left corner, falling away at the edges. It was the only page
in the app whose ground was not flat `--background`, so the top of the page read
as a tinted band that stopped partway down and lined up with nothing above or
below it: the header strip, every other route and the dashboard's own lower half
were all one colour and the hero was not.

What it was FOR survives. The panels are objects on a surface because `.on-table`
gives them elevation, and that is unchanged — the shadow was always doing that
work; the paint underneath was only ever colour. `tableHour()` went with it, so
`theme.js`'s two references to it were repointed rather than left naming a
function nothing exports. The content wrapper's `relative z-10` went too: it
existed solely to lift the page over an absolutely positioned ground, and a
stacking context whose reason has been deleted is the drift this file keeps
recording.

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

## NOTHING EVER INSERTED A LEADERBOARD ROW

**"Some users earned XP, doesn't sync up with Ranked or the ATAR."** One cause,
eleven call sites, and it had been there since the migration.

Every mirror into `leaderboards` — XP, streak, study time, the ATAR, on seven
server paths and four client ones — was shaped `select id where user_email → if
(row) update`. **There was no `else` anywhere in the tree.** The only rows in
the table are the 42 that phase 3c migrated against 132 profiles, so roughly
ninety accounts plus every account created since earned XP into `user_profiles`
and were simply ABSENT from the board.

**It reports nothing.** PostgREST answers 200 for an update that matched no
rows, so all eleven sites looked like they worked, logged nothing, and passed
lint, the build and every test — the same silent class as the missing columns
`dbColumns.test.mjs` exists for.

**What the student saw is why this reads as a sync bug rather than a missing
row.** The Ranked hero prints `my_atar` off `user_profiles`, so they have a
score; the board below is built from `leaderboards` and does not contain them;
and `MyProfile` reads XP off that same board row, so the profile tab printed
`totalXP={0}` — Level 1, tier 1, an empty ladder, on an account with 18,439 XP.
One screen, two tables, and only one of them had ever been written.

`syncBoardRow` is the one writer now, and `boardSync.test.mjs` scans for a write
that goes around it — exempting the two writers BY NAME and asserting both still
exist, because an exemption pointing at something that has moved covers nothing
and the scan passes anyway.

**UPDATE-THEN-INSERT, NOT UPSERT, AND THE REASON IS PRIVACY.** `is_anonymous` is
the student's own setting, written from Settings, and `user_name` is theirs too.
A blanket upsert sets every column it carries on conflict, so mirroring XP would
quietly clear the anonymity of anybody who had turned it on. The common path is
a plain UPDATE of the columns that caller owns; the INSERT runs once per account
ever and is the only thing that seeds identity, from
`is_anonymous_on_leaderboard` on the profile. Of everything in this fix, that is
the one part that could not be repaired afterwards — a student outed on a public
board cannot be un-outed.

**The seed is a FLOOR, and the order of the spread decides it.** The `Math.max`
against the profile's figures sits AFTER `...fields`, or a first mirror carrying
only a streak creates a row reporting zero XP for an account that has eighteen
thousand. Asserted, because it reads as a formatting preference and is not.

**`sweepBoardRows` is the backfill**, lazy and budgeted off whoever opens
Ranked, like the ATAR sweep beside it and the league's settlement — because
"the next time they earn XP" never comes for the dormant accounts, which are
exactly the ones missing. The viewer's OWN row is ensured BEFORE the board is
read, since a student who just earned XP and opened Ranked to see it must not be
told they are nowhere.

Three smaller things fell out of the same audit:

- **A THIRD LEVEL CURVE.** `awardGoalXP` computed `Math.floor(currentXP / 100) +
  1` and wrote it to `current_level` and the board's `level` — so finishing a
  goal overwrote the real level with a number off a different curve (level 181
  against a true 15 at 18,000 XP) until the next ordinary award put it back.
  `mirrors.test.mjs` exists because two copies of this curve drift; this was a
  third that never agreed with either. The scan now refuses the hand-rolled form.
- **The board read was an unordered `.limit(300)`**, which hands back whichever
  300 PostgREST feels like — the same arbitrary-prefix bug the ATAR window
  queries had. Moot under 300 students, wrong above it.
- **QuizPlayer is the ONLY writer of `total_study_time`** and stopped at the
  same `if (entries.length > 0)`, so the hours board stayed at zero for anyone
  without a row. It creates one now: `recordStudyAndGetStreak()` above it is
  fire-and-forget, so a student's very first quiz can still land before the row
  that call would have made exists.

### And the lazy sweeps were too slow to be the whole answer

`sweepBoardRows` and `sweepStaleATARs` are budgeted — 25 rows and 6 scores per
Ranked visit — which converges, and "converges" is a poor answer to ~130
students who have never had an ATAR computed at all. It needs twenty-odd page
loads, and a quiet week moves nothing. `catchUpEveryone` walks the whole roster
ONCE at boot instead: board rows, then XP, then every missing score.

**IT IS NOT A SCHEDULER**, which is the distinction this file keeps making. It
runs once per process, finds what is missing, fixes it and stops — so a second
boot costs two counting queries and exits, and a crash loop cannot turn it into
load. It fires behind a timer AFTER `listen` and is `unref`'d: Render marks a
deploy failed on a health check that does not answer, and this reads every
profile on the site. `ACEDIT_SKIP_CATCHUP=1` stops it without a deploy.

**THE XP PASS ONLY EVER RAISES, and that is not caution — it is correctness.**
The log is INCOMPLETE: `awardGoalXP` writes `total_xp` directly and records no
`xp_events` row at all, and the achievement reward does the same. So a profile
is routinely and legitimately AHEAD of its own log, and setting the column from
the log would DELETE real XP from real students, silently, across the whole
roster, in one pass. `max(stored, logged)` is the only safe shape, and it is
the same one `reconcileXP` and `awardXP`'s own integrity restore already take —
that restore only ever fired on a stored total of exactly ZERO, so a profile
that lost a single write stayed wrong forever.

**THE RECONSTRUCTION IS THE RUNNING SUM OF `xp_awarded`, NEVER
`max(total_xp_after)`.** The second looks tighter — it is the running total the
server itself recorded, so it survives the unlogged bumps — and it is wrong,
because XP legitimately goes DOWN: `deductXPWithAudit` takes escrow for a
progress bet and writes a negative row, so an earlier row's running total sits
above the real balance. Taking the max of it hands every student back what they
staked. The sum includes the negatives, which is why `deductXPWithAudit`'s own
comment says the audit log "stays the source of truth for integrity restores".

It PAGES, with an ORDER. An unbounded read of `xp_events` stops at PostgREST's
1000 rows, which would undercount exactly the heaviest users — the ones a
reconcile is for — and `fetchAllRows` walks with `.range()`, so without an
order the database may reorder between pages and rows are double-counted or
missed.

Both of the destructive shapes are asserted and both were verified by putting
the bug back, because neither throws and neither shows up in a render: the
first quietly lowers a number, the second quietly raises one.

**What could not be verified here:** the container's `.env.local` points at
`stub.supabase.co` and carries no service-role key, so none of this was run
against the real database. Every column it names is checked against
`supabase/schema.json` by `dbColumns.test.mjs` — confirmed non-vacuous by
breaking one and watching it name the line — but the first real pass happens on
deploy. The log line it prints says exactly what it did.

## A NEW BUILD IS ANNOUNCED, NOT WALKED INTO

`lazyPage.js` already records the failure: the 24 pages are code-split, a deploy
replaces `index.html` and DELETES the old chunks, and a student holding an open
tab is one navigation from a white screen. `lazyPage` is the safety net — retry,
then one guarded reload. `UpdatePrompt` is the other half: telling them first,
so the reload is something they chose.

**THE VERSION IS WHATEVER THE SERVER IS SERVING.** No constant to bump, nothing
stamped at build time: `/local-ai/version` is the sha1 of the built
`index.html`, the one file that names every chunk. Two properties fall out and
both were verified by rebuilding: a code change moves the id, and **a restart
with no deploy does not**, so a crash loop cannot nag anybody. Null in dev,
where there is no `dist/` and hot reload makes the whole idea pointless. It is
registered BEFORE the SPA fallback, which otherwise answers it with
`index.html`, and `no-store` on both ends — the one request whose job is to
notice a change must not be answered from a cache written before it.

**IT NEVER ARRIVES OVER REAL WORK, and that is the only reason a blocking
prompt is safe.** A reload is strictly larger than the refetch `liveRefresh.js`
was written to schedule: it destroys typed answers, a marking call in flight and
a running focus block. So the hold list is not a second opinion — `holdReasons`
was extracted from `decideRefresh` and BOTH import it, which is what makes
QuizPlayer, ExamMode, the pomodoro, blurting, the floating timer and every AI
stream hold the reload automatically, having only ever declared themselves once.
Written twice, the two would disagree within a release, and the half that
drifted would be the one that reloads a quiz away.

**DEFER, NEVER DROP**, the same rule that file keeps: an update noticed mid-quiz
waits in a ref and is shown the moment the registry clears — not at the next
poll, which is three minutes away. The poll is deliberately slow; being late
costs a few minutes on an old bundle, which `lazyPage` covers anyway, and being
fast costs a request per tab forever to answer a question that changes a few
times a week.

**THE SCRIM IS LITERAL.** `bg-foreground/60` inverts with the theme —
`--foreground` is near-white in the dark — so the overlay came out a pale wash
that BRIGHTENED the page it was meant to push back. Only a screenshot caught it.
A scrim is SHADOW, not ink: `bg-black/60`, in both themes, for the same reason
focus mode's ground is a literal `#0A121F`.

It draws the brand MARK rather than a body, so it claims nobody in `ACE_ORDER`
and cannot become a second Ace talking over the first. Draw it with
`scripts/_floorProbe.jsx?v=update`, which stubs the endpoint and waits out the
focus gap — judge it in both themes and at 390.

## TWO INTEGRAL SCREENS NOBODY COULD FIND

**"The check pile in flashcards and the leagues in Ranked are kinda hidden,
despite being an integral part of the website."** Both were worse than hidden,
and in the same way: a page that exists, renders perfectly, and has no entrance
worth the name. This codebase has shipped that failure three times and written
it down twice — `League`'s own header ("the league endpoint existed, worked, and
nothing ever called it"), `WeekStrip`'s ("a page with no entrance is the shape
this whole feature already had"), and `fnResult.js` on the strip then reading
the wrong field so the one entrance rendered nothing.

**`/Review` WAS IN NEITHER NAV.** Not the side rail, not the bottom sheet. Its
main entrance was an **11px muted underlined link in the corner of one dashboard
panel** — and that panel only draws the link when it has blips to plot, so on a
quiet week the page had one entrance left, buried inside Spaced Repetition.

**`/League` HAD ONE ENTRANCE, IN THE SECOND COLUMN.** `WeekStrip` sat in
Ranked's `xl:sticky` rail, and that rail is the second cell of
`xl:grid-cols-[1fr_320px]` — so **below xl, which is every phone, it stacks
UNDER the whole thirty-row board.** The way into a weekly competition sat below
everything on the page for most of the traffic. And the strip returns `null` on
any failure or missing membership, so a student with no league row got no
entrance at all and the page became unreachable rather than merely buried.

### The league is a TAB, because a tab reads the same at every width

Ranked is already the page about where you stand — the ATAR over 28 days, the
league over the week — so the third tab belongs there rather than as a sixth nav
item, which is the trade `WeekStrip`'s header argues and is still right. What
changed is that a tab puts the word "league" on screen **before anybody clicks**,
and cannot stack under anything.

**IT RENDERS THE REAL PAGE.** `League` takes an `embedded` prop rather than
Ranked building its own view: `/League` is still a route that links already point
at, and two renderings of one board is the mirror this codebase keeps deleting.
Embedded drops only the page shell — the back link (a link to Ranked, on Ranked),
the min-height and the width, which Ranked's grid owns.

**AND THE STRIP LEADS THE BOARD.** It is out of the rail and full width at the
top of the Leaderboard tab, so it is read on the way past rather than found. It
opens the TAB rather than the route, because the route is the thing beside it —
`onOpen` is a prop, so without a parent it stays a real link and the component
does not require Ranked to be useful.

### The queue is in the nav, and everything calls it the same thing

"Check the pile" is a phrase nobody uses, on a page whose own h1 reads **"Your
review queue"**. Four surfaces, three names, and the one a student had never
heard was the one doing the navigating. It is **Review queue** everywhere now —
a real nav item in both navs, the shelf button, and the dashboard link — and
`reachable.test.mjs` asserts the entrances match the page's own h1, so a rename
on either side fails the suite rather than quietly splitting the screen in two.

### THE ENTRANCE STATES THE STAKE

Neither was only hard to find; neither said why it mattered. A label is not a
reason to tap.

- **The queue's entrances carry a number.** A shelf with four cards ready and one
  with two hundred read identically before. Counted off the UNFILTERED decks —
  a button reporting "3" because somebody typed "chem" in the search box would be
  lying about the queue it opens.
- **The league's entrance says what a finish pays**, from `grantForLeague`, the
  function the server actually grants with, never a figure typed into a
  component. Only on a board big enough to HAVE a podium: "top 3 take" on a board
  of two is everybody, the refusal `podiumGap` and `leagueLead` already make.

### Three tabs did not fit, and only a screenshot said so

At 360 the bar is a full-width `grid-cols-3`, so each cell is about 105px.
`px-6` made "My profile" **wrap to two lines**, doubling the bar's height;
`whitespace-nowrap` turned that into "Leaderboard" **clipped inside its own
pill**. Both render, neither throws, and the measurement that found them is the
tab's own height against its height at 1280 — 60 against 40.

The fix is three things, each the smallest one that works: `px-3 sm:px-6`,
"My profile" → **"Profile"** (unambiguous on a page about you), and the icons
**hidden below `sm`**. That last one is this file's own rule applied rather than
bent: a trophy beside "Leaderboard" and a cap beside "Profile" restate the word
next to them, so they are decoration exactly where width is the binding
constraint — and they stay at `sm` and up, where a repeated set legitimately
keeps its glyphs.

**What the probe cannot draw, and why it is worth knowing.** `WeekStrip` fetches
its own standing through `base44`, which is a **Proxy over an axios SDK**:
assigning `.functions.invoke`, `Object.defineProperty` and a patched
`window.fetch` ALL fail to intercept it, and each failure silently lets the real
call 404 so the strip renders nothing — the exact shape this feature already had
in production. `SideRail` reads Layout's context and renders blank alone. So
`?v=reach` draws the tab bar and the shelf control, which are what changed shape;
the strip's payout block is `hidden sm:flex` and cannot move the phone layout at
all.

## Ranked is THREE ERAS, and the ATAR was on all of them

**"Only one page having all the ATAR and ranks."** The page carried an
always-on hero — the dial, the five components, the rank tiles — ABOVE the tab
bar, so a student heading for the weekly league scrolled past a 230px gauge of
a trailing-28-day score to get there, and the profile tab opened under the same
gauge. One number owning the top of every tab, including the two it has nothing
to do with.

Everything here answers "where do I stand", and the only real difference
between the answers is the WINDOW:

| tab | window | what is on it |
|---|---|---|
| **My rank** | trailing 28 days | the ATAR dial, the five components with their doors, the ATAR board, and the ten-tier ladder + achievements |
| **League** | this week | the real `/League`, embedded |
| **All time** | lifetime | XP and study time |

**`era` IS A FIELD ON THE BOARD, not two hard-coded arrays.** `BOARDS` moved
out of `Ranked.jsx` into `ranked.js` and each descriptor declares `month` or
`alltime`; `boardsFor(era)` is what fills a tab. Two lists instead would be the
mirror this codebase keeps deleting, and the failure is silent — the ATAR
quietly appearing under a heading reading "everything you have ever earned".
Each one also states its `window`, printed under the board's own heading: a
leaderboard whose span is not stated is one a student cannot argue with, and
three different spans sharing one chip row is most of what made the old header
confusing.

`useBoardView` is the scoped, sorted field plus everything derived from it —
the rows, the titles, the standing, the movement — so the two board tabs cannot
arrive at a rank differently from the list they drew it on.

**SIX BORDERED CHIPS ON ONE LINE IS A TOOLBAR.** Three board chips beside three
scope chips, at 360px, is what the header was. The board question is answered by
the TABS now, so each tab needs one control and it is a real segmented switch —
inset on the secondary ground with the live segment lifted onto the surface,
deliberately QUIETER than the tab bar above it. Two controls drawn identically,
one inside the other, is how a student loses track of which one they are using.
`BoardSwitch` draws nothing when handed fewer than two boards, which is the
single-tab `Tabs` rule and is what lets the ATAR tab pass none at all.

### The board moves now, and nothing about that may be invented

**AN ORDER THAT LOOKS IDENTICAL EVERY TIME YOU OPEN IT READS AS A FIXTURE.**
One arrow per row is the cheapest thing that turns a ranking into a race, and
`boardMovement.js` is the whole model.

**ONE SNAPSHOT PER BOARD PER WEEK** (migration 0039, `board_snapshots`). Written
per student — `leaderboards.extra` — it would be 300 rows to write and read, and
PostgREST has no bulk update with per-row values except an upsert, which
`syncBoardRow` already records being unable to use here: an upsert sets every
column it carries on conflict, so it would quietly clear `is_anonymous` for
anybody who had turned it on. One row holding `{ email: rank }` is one read, one
insert, three rows a week for the whole site — and it is the stronger design as
well as the cheaper one, because every row's movement is measured against the
SAME instant.

Written LAZILY by whoever opens Ranked first in a given week, the posture the
league's settlement, the market sweep and `sweepStaleATARs` all take. The unique
index on `(week_start, board)` is what makes that safe: two students opening the
board in the same second cannot split one week's snapshot across two rows, and
the 23505 is the correct outcome rather than an error to log.

**A SNAPSHOT WRITTEN BY THIS REQUEST IS NOT RETURNED.** It describes right now,
so every movement against it is zero — and leaving it out means the board draws
NOTHING rather than telling the whole field it is holding position.

**A LOWER RANK NUMBER IS BETTER**, so the delta is `was - now`. One character
the other way renders perfectly and draws every climb as a fall, on the student
who had the best week.

**AND IT NEVER INVENTS A POSITION.** Four ways a previous rank can be absent and
not one of them may print a number of places: no snapshot (null for the whole
board), a student not in it (`new`, a badge — they did not climb from last
place, they were not there), a junk value (treated as absent, or a corrupt row
becomes last week's leader and shifts everybody), and a real zero, which is
`level` and draws a dash. **`Number(null) === 0`** is the live trap: coerced, 0
beats every real rank, so every new student reads as having FALLEN — a
plausible, wrong, red arrow on exactly the rows that should be celebrating.
That trap has now reached `criterionIndexFor`, `expiredKeys`, `markPercent`,
`standingOf`, `closingFacts`, `weakTopicsFrom` and this.

**THE SNAPSHOT IS RE-RANKED WITHIN THE ROWS ON SCREEN.** The stored map is the
whole field; the board may be a SCOPE of it. In a scope of five, being 2nd now
against a stored 7th is two numbers from two different boards subtracted, so
last week's placing is recomputed as the row's position among these rows sorted
by its stored rank. Subsetting cannot reorder anybody, so that is exactly their
scope placing at snapshot time, and on the global board it is the stored number
back again.

**AN ARRIVAL DOES PUSH EVERYBODY DOWN**, and the test was written expecting the
opposite. The tempting rule is that being overtaken by somebody who was not on
the board last week should not count as slipping. It is wrong and visibly so:
the place numeral beside the arrow SAYS 2, so a chip reading "holding" sits
directly next to the evidence that they are not. A board that contradicts its
own rank column has spent the credibility that column had.

**SHAPE CARRIES THE DIRECTION.** The brand green and the streak red sit at ΔE
7.0 under deuteranopia — the floor's step-dot lesson — so an up arrow against a
down arrow is what makes this readable, with the number as the third channel.
The lane is a FIXED WIDTH even with no snapshot, or every other column shifts
sideways the moment arrows appear.

### What makes the rows read as premium

**THE COLUMNS ARE FIXED WIDTHS, and that is most of it.** Every figure shares a
right edge, every place numeral a lane, every arrow a third. Before this the
score sat at the end of a flex row, so its left edge moved with the length of
the name beside it and a column of numbers came out ragged — the difference
between a table somebody designed and a list of divs. The place numeral went
from a 7px muted digit to display type with real weight, because on a
leaderboard the rank IS the content.

**THE PODIUM IS AN OBJECT**, capped at `max-w-2xl` and centred. Stretched to a
1100px board column each card was ~360px holding a 56px avatar and one number,
so the ceremony at the top of the board was the emptiest part of the page. The
medal rides ON the avatar ring and the place is a numeral on a plinth — the
first version had a "1st" pill, a medal glyph AND the number in one card, which
is this file's own icon rule broken three times in one place. The title is
`hidden sm:` there: at 360 a podium card is a third of the screen and
"Metronome" beside a movement chip is wider than that, so the pill was clipped
by the card's own `overflow-hidden` and bled off the side as a cut-off word.

**YOUR ROW IS NEVER LOST.** Scroll past yourself and a compact bar pins your
place, your figure and your reach to the bottom; tap it to go back. It appears
only when the real row is off screen — a permanent bar would be a second,
smaller copy of a row already in front of them — and it sits at
`bottom-[5.25rem] md:bottom-5` with `z-30`, ABOVE a bottom nav that is
`fixed bottom-0 z-40` and about 72px tall. Under it, it is a control nobody can
tap on a phone, and only a screenshot would say so.

`rankedBoards.test.mjs` holds all of it — the movement rules, the era split, the
ATAR panel being inside the first tab, the server's snapshot ids matching the
client's `BOARDS`, and the pinned bar's clearance against the nav's real
classes. Draw the board with `scripts/_floorProbe.jsx?v=board`, against
**fourteen rows with climbers, fallers, a holder and two arrivals** — a two-row
fixture hides the podium, the median gap scale, the movement column and the
pinned bar at once, which is the lesson the Quizzes shelf learned about checking
a layout against the shape of the data somebody actually has.

### `hookDeps.test.mjs` could not see a function parameter

Its TDZ check states the intent in its own words — "anything declared above,
imported, OR A PARAMETER is fine" — and `declarationLines` sees `const` and
`let` only. So `function useBoardView(data, meta, scope)`, sitting above the
component's own `const [data, setData] = useState(null)`, was reported as a
crash on code that is correct: inside that helper `data` is the parameter, bound
before the first line of the body runs.

`paramScopes` is a brace-depth walk — `dbColumns.test.mjs`'s idiom — and the
span has to be the OWNING BODY rather than the whole file, or a parameter named
`data` in one helper would exempt a genuine TDZ hazard in the component beside
it. That would be a hole rather than a fix, so it is asserted both ways, and
the real crash shape was put back to confirm it still bites. This is the
false-positive class `fnResult.test.mjs` and this file's own comment scan each
had to learn, and the cost of not learning it is worse than a red suite: the
obvious way to make it green is to rename a perfectly good parameter, or to
delete the check.

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

## Ranked named the weakest component and gave nobody a door

**A BAR WITH NO WAY THROUGH IS A DIAGNOSIS.** The panel drew the five ATAR
components with their evidence, named the weakest in a sentence, and left every
one of them to the student to work out which screen moves it. That is the same
failure as a percentage with no evidence under it, one step further along — on
the number the whole app is standardised around.

`COMPONENT_MOVE` (`ranked.js`) is the door, and it is a DEEP LINK where one
exists rather than a page: `/Study?tab=pomodoro` lands on the timer and not on
the technique grid, `/Goals?plan=week` opens the plan dialog. That is
`startFromSuggestion`'s rule — a suggestion that says it will build the thing
has to build it.

**TWO DELIBERATELY DO NOT DEEP-LINK**, and saying so is the honest answer rather
than a shortfall. *Breadth*'s action IS choosing a technique you have not used,
and Study's landing screen is that chooser — picking one FOR them would need the
technique families the component only stores a COUNT of, so naming one would be
a guess. *Consistency* counts DAYS: there is no screen that adds one, so it goes
to today's move rather than pretending otherwise.

**EACH LINK STATES WHAT TEN POINTS IS WORTH**, from `liftFor` — the same
differenced model Today's Play and `StandingRail` already use, so it is
checkable rather than a number the page invented. A gain that rounds to +0.00
prints no figure and a component with no headroom is offered no action at all:
a row whose number is not real teaches a student that none of the numbers here
are, which is the rule the dashboard rail keeps.

**FIVE QUIET LINKS AND ONE LOUD BUTTON.** Five filled buttons in a panel that
already carries a primary one below reads as a toolbar; the loud one stays where
it belongs, on the component that is actually costing them.

`COMPONENT_PAGE` used to live inside `StandingRail` as its own object — the
second copy this codebase keeps deleting, and Ranked needed the same mapping.
`rankedMove.test.mjs` holds all of it: every ATAR component has a move, every
page is a real route, the map is not restated, and **every query it emits is
read by the page that has to honour it** — a link that lands on the right page
while the thing it promised to open does not is the half-wired shape this app
has met over and over. Verified by breaking the reader and by pointing one move
at a page that does not exist.

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

**ONE ACE ON SCREEN, AND `ACE_ORDER` IS WHICH ONE.** Six surfaces draw him and
they were only ever suppressed in pairs, by whoever remembered. On an ordinary
page you got the AceCompanion launcher AND AceBuddy's walker; earn some XP and
AceReacts made a third. During the first run two were suppressed and the
launcher was not, so the student sat their first quiz with one Ace talking and
a second standing under him.

The registry in `useAceYield.js` already existed and had two holes. It was
UNORDERED — "is anyone OTHER than me holding him" — so two surfaces that both
claim both stand down, or neither does, depending on which effect ran first: a
coin toss deciding which Ace a student sees. And `FirstWin` and `AceTour` walk
a full body onto the page and never claimed at all. `ACE_ORDER` ranks them, by
how much the moment belongs to the student — a celebration is never talked
over, the run leads the tour, and the launcher always loses because it is what
is there when nothing is happening. An unranked id loses rather than winning by
accident. NOBODY IS DELETED, only deferred: the tour keeps its stop, the run
keeps its beat.

**AND `showing` IS NOT `running`.** FirstWin told Layout it was not live the
moment it handed off to the quiz player — true of the BUBBLE and false of the
RUN — so on the single most important screen of the first session Layout
un-suppressed the study-intent modal and AceBuddy over the top of the three
questions it had just built. The two are separate now; the claim above stays on
`showing`, because while it is handed off it draws nobody and holding him there
would leave the corner empty on the one screen being worked on.

`AceIntro` draws the MARK rather than a body, so it never claims and the
launcher may stand beneath it — which its class list is arranged for. What it
must not do is share the lane: it sits at `sm:bottom-[5.5rem]`, the exact
coordinates of the walker's bubble, so it now defers to anything speaking
there.

`aceStage.test.mjs` pins both halves — the ordering is arithmetic over the
list, and a SCAN checks that every component drawing a body claims one, because
a surface that forgets renders perfectly and is simply a second Ace. Verified
by removing FirstWin's claim.

**Two illustrations are not a third Ace.** The dashboard draws him inside the
streak card's empty state, and there is another on a page card — those are
CONTENT: they do not talk, do not follow you between pages and do not compete
for the corner. The rule is about the floating one.

Layout stands AceIntro and AceBuddy down while it runs; they share the corner
and the mascot. It goes quiet on the payment flow, because the wizard sends
premium-intent signups straight to /Subscription.

**IT NO LONGER LEADS.** The first run (above) goes first, because it is the one
that produces something; `tourShouldWait` holds the tour until that is done or
skipped. The tour then answers the other question — where everything lives —
which is a real question and not one the first run tries to cover.

## Three panels asked one question, so they read as patched on

**"The preset topics feel like a blob patched on top of the page."** Both study
setup screens were THREE cards stacked — Ace's picks, "Session Setup", and an
upload panel — and every one of them was answering *what am I about to study*.
Picking a row in the first quietly changed two fields in the second, which a
student has no reason to be looking at. So the most useful thing on the screen
read as an advert for the form underneath it.

**ONE CARD.** The picks lead it, a rule hands over to the manual fields, and
the sources sit with the thing they are a source FOR. The same move the Quizzes
page made when it carried five next-moves, on the screen a session starts from.

- **A ROW IS A SPINE, NOT A BOX.** Each pick was a `rounded-2xl border-2` inside
  a bordered card — box in a box, four times down the screen, which is most of
  what made it read as pasted on. The kind's colour is a spine down a flush row
  now, the idiom Subjects and the Quizzes shelf already use to identify a thing.
  The pill stays: "costing you marks" is a CLAIM and a bare colour cannot make
  one.
- **THE HANDOVER IS ONLY DRAWN WHEN THERE IS SOMETHING TO HAND OVER FROM.**
  `suggestTopics` returns [] on a new account, so the rule reading "or set it up
  yourself" would be handing over from nothing. The parent computes the picks
  and passes them down for exactly this — the card has to know before it draws.
- **THE ROW STARTS THE SESSION ON BOTH PAGES.** Blurting's used to fill two
  fields and stop, so one affordance meant two different things on two sibling
  screens, and on one of them it left the student scrolling to find a button —
  the failure `startFromSuggestion` was written to end. It sets `showFocusPrompt`
  directly, because the subject is set in the same tick and `startSession`'s
  guard would read the state before it updates.
- **`SourceRow` is the other half.** "Turn your notes into questions" and "Your
  notes (optional)" were panels of their own, which made an upload look like the
  real way in — when the student's own cards and mind map are better material
  and need no upload at all. That is the mega-picker's own rule (a second picker
  would be "two answers to 'what am I working from'") one level up. The row
  states what it ALREADY has for the chosen topic before it offers an upload.
- Blurting's "How Blurting Works" list is four lines under the button rather
  than a third of the screen beside it. It is read once, by somebody who has not
  done this before, and it was taking that space from everybody who had.

### Two sentences under those rows were false, and only a screenshot caught it

Both render perfectly, pass lint and the build, and are simply wrong about the
student they describe. `recallSuggest.test.mjs` asserts them; verified by
putting each bug back.

- **A 0% MISS RATE IS NOT EVIDENCE OF COSTING MARKS.** `weakTopicsFrom` keeps a
  topic on `weakCards > 0` ALONE, so a deck whose every review landed still
  arrives with a real `missRate` of 0 — and `missRate != null` is TRUE of 0. The
  row printed **"0% of your reviews on this missed"** under a pill reading
  *Costing you marks*: the app telling a student their clean record is the
  problem. Another `Number`/falsy-zero, in a module the list did not yet have.
- **A SUBJECT TOTAL IS NOT A TOPIC'S NUMBER.** `s.slipping` counts the whole
  subject and was printed on every TOPIC row, two topics per subject — so both
  rows read **"138 cards already past reliable recall"**, identically, and that
  138 sat on the same line as "20 of your cards" for a topic that has twenty.
  Two numbers disagreeing on one row, about one topic. `retentionOutlook` now
  carries `topicCounts` — the same walk, kept per topic, free where the card is
  already in hand.

## The planner: a form you use monthly took the top of a section every visit

**Re-sequenced rather than restyled.** The page opened with a coach line, the
SAC hero, then an always-on five-field add-SAC form, then the week board — so
the first thing under "Upcoming SACs" was permanently a thing to fill in rather
than the assessments somebody came to look at, and planning the week, which is
why the page is called the Planner, was third.

- **The week board moves up**, directly under the hero.
- **The form is a dialog behind one button.** Tracking a SAC is a
  handful-of-times-a-term action; the same call the Quizzes page made about
  three buttons for one dialog. Stacked and labelled in the dialog, rather than
  a five-column grid that collapsed to five unlabelled rows on a phone. It
  closes ONLY on a success — closing regardless throws away what they typed on a
  failed write and leaves nothing on screen explaining why nothing appeared.
- **Upcoming and Marks are separate sections.** "What is coming" and "what
  already happened" were one block with the past tucked under the future, which
  is two questions sharing a heading.
- **THE ASK CARRIES THE ACTION.** The hero's empty state read "add it below",
  pointing at a form further down — and then the form moved, so the sentence was
  directing a student at a section that no longer holds one. It opens the dialog
  itself now. The list's own empty state is one line, because the hero above
  already makes that ask and two empty states saying the same thing on one
  screen is a paper-cut this app has had before.

Draw both with `scripts/_floorProbe.jsx?v=study` (the setup card against picks
of every kind), `?v=setup` (the REAL components, which is the only way to see
the no-picks path a fixture cannot reach) and `?v=planner`.

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

## Cred had no sink, and XP must never be one

**A currency with nowhere to go stops meaning anything.** The grant was a flat
1000 a week, the cap 3000, and the only exit was a bet — so a student who trades
well saturates in a fortnight and every Monday after that is a number going up
because a clock ticked. That is the failure `PortfolioPanel`'s own header names
about the cred figure: "it moves for two unrelated reasons… a number that goes
up when you did nothing teaches that the number means nothing."

**XP SETS THE RATE, NEVER THE BALANCE.** The obvious wiring is XP → cred and it
breaks the property `market.js` is built on: "XP drives level, rank and the
ATAR, so staking it makes the rational play 'never bet'." A conversion makes
spending cred cost rank and cost the ATAR, so the rational play for anyone who
cares about Ranked is never to convert — and it puts a sixteen-year-old's
flagship study score up for spending on bets. So **rank moves the GRANT**
(`grantForTier`, 700 at tier 1 to 1800 at tier 10). Nothing is deducted,
abstaining stays never-optimal, and climbing Ranked visibly pays off on the
floor. `credStore.test.mjs` scans the module for any reach toward XP.

Tier 1 gets LESS than the old flat 1000 deliberately: a raise that costs nobody
anything is inflation, and a floor equal to the ceiling cannot express a rank.

**THE THRESHOLDS MOVED OUT OF A `.jsx`.** `XP_RANKS` lived in `xpSystem.jsx`,
which `server.mjs` cannot import and the test loader cannot resolve — so the
grant had two options, restate ten thresholds or go without. `src/lib/xpRanks.js`
is the one copy now and `xpSystem.jsx` re-exports it, so every existing import
is untouched. The same move `sm2.js` and `mastery.js` already made.

**PRICES ARE MULTIPLES OF A MID-TIER GRANT, ROUNDED TO 50.** A multiple keeps
"how long does this take to afford" readable when a grant moves; the rounding is
because the first draft priced things at 713, 951, 1427 and 2378 — arithmetic
showing its working on a shelf. Nobody weighs 713 against 951.

**NOTHING ON THIS SHELF COSTS REAL MONEY, and that is now a PROPERTY rather
than a ceiling.** There was one exception and it has been removed: a door
converting cred into AI chips. `chips.js` prices a week's stack at $1.95 of
actual Anthropic spend, so that row was a path from "won a market" to "the bill
goes up" — and a market on your own study log is allowed DELIBERATELY, so there
was a farm at the end of it. It was bounded, by the scoring rule (which pays
~nothing for backing a near-certainty you control) and by a weekly micro-dollar
ceiling, and bounded is not zero. It was the only thing here that could be wrong
in DOLLARS rather than in pixels.

What replaces the ceiling is an ABSENCE, which is a stronger guarantee and the
same shape the refund rule takes: no catalogue entry is per-unit, and nothing in
the module reaches toward `chips.js` in either direction. `credStore.test.mjs`
asserts both, so the day somebody adds a door back is the day the suite says so
rather than the day it turns up on an invoice. Verified by putting each back.

Three things fell out with it, and each was load-bearing ONLY for that row:
`priceOf` lost its `units` multiplier, the store lost its quantity slider, and
the server's `buyWithCred` lost the "charged but not granted" branch — because
every remaining effect is recorded by the patch itself, so the write that
charges is the write that grants and the two cannot come apart. It leaves
`extra.cred_chips_week` on any row that ever bought one; nothing reads it, and
it is not cleaned up for the reason the leaked flashcard rows were not retagged.

**THE WHOLE SHELF WAS AN INVENTORY WITH NO CONSUMERS.** `cred_owned`,
`cred_equipped` and `cred_held` were written by the store and read by NOTHING —
a student could spend 2,400 credits, most of a fortnight's earning, on a gilt
card back that rendered nowhere, and the only evidence it existed was the word
"Owned" on the shelf they bought it from. That is "collect nothing you don't
use" inverted for the fifth recorded time and the worst version of it: the
others asked a student something and ignored the answer; this took their money.

- **A back is drawn from CONTEXT, never threaded.** `CardBack` is on nineteen
  surfaces, so passing an equipped skin to each is nineteen chances to forget,
  and a half-worn cosmetic is worse than an unworn one — the gilt back on the
  flashcard shelf and the default in the quiz player reads as a broken app.
  `CosmeticsProvider` reads the profile once and `CardBack` consumes it;
  `skin={null}` is how a surface opts out explicitly rather than by omission.
- **A skin is LITERAL ink, like the floor.** A gilt back is gilt in both
  themes: it is a physical object somebody paid for, not a semantic colour, and
  a token that flipped would mean the thing they bought looks like a different
  thing after dark. `SpadePip` grew a `fill` for the same reason —
  `fill-foreground` is near-white on dark and near-black on light, so the
  medallion pip vanished on whichever theme matched the skin.
- **With nothing equipped NOTHING CHANGES**, so this cannot move a pixel for
  the ~130 students who have bought nothing.
- **OWNED IS NOT WORN**, and the shelf now has the control. Buying used to end
  the interaction, because `cred_equipped` had no writer either.

**THE STREAK FREEZE WAS A SECOND FREEZE BESIDE A WORKING ONE.**
`user_profiles.streak_shields` has existed since migration 0020, `updateStreak`
already spends one to cover a slipped day, and the Dashboard already draws how
many you hold. The store wrote its own into `extra.cred_held`, where nothing
would ever look. The item declares its `column` now and the purchase increments
the real one — one mechanism, which is the rule everywhere else here.

**THE LEAGUE PAYS THE GRANT.** It used to read the all-time rank tier, which
made Monday's credits a STATUS — a number following from lifetime XP, moving a
few times a year — while `settleLeagueGroup` computed a `final_position` every
week and granted nothing with it. `grantForLeague` splits the range so FINISH
OUTWEIGHS TIER: a bronze student who wins their group (1400) out-earns a master
who came last (1100). If the tier dominated, the grant would still be a status,
just a slower one, and the league would still not be worth playing on a week you
were already safe. The two weights SUM to the range, so the floor and ceiling
are `GRANT_BASE`/`GRANT_TOP` by construction rather than by a clamp — the first
draft multiplied a band by a spread and paid 1983 against a ceiling of 1800.

`tierIndex` is a NUMBER, not a tier name: `server.mjs` owns `LEAGUE_TIERS` and
a second copy of that list is the mirror this codebase keeps deleting. An
unplaced finish takes the FLOOR of its band, never the middle. A student the
league has not placed falls back to the rank grant, because granting the floor
on somebody's first week leaves them unable to take a side at all.

**AND THE SENTENCE FOLLOWS THE NUMBER.** The panel said "Rank 6 of 10 sets
that" for exactly as long as rank did set it. Copy explaining a reason that
stopped being true is worse than no copy: a student checks it against their rank,
finds it does not move, and stops believing the panel. `grant_from` says which
of the two paid, and the panel reads the league's own `ordinal` rather than a
second copy of it.

**XP CONVERTS, AND `total_xp` IS NEVER WRITTEN.** The ATAR is computed from the
`xp_events` LOG, not from the column, so a debit would not move it — but it
WOULD move level and rank, which is the failure `market.js` refuses about
staking XP, and server.mjs already guards the column in its own words
("total_xp is STRICTLY ADDITIVE"). So conversion spends from a BUDGET:
`extra.xp_converted` records what has gone and the remainder is what is left.
Each point of XP converts once, ever. Nothing a student does on the floor can
cost them a mark, a level or a place on the ladder — the property the whole
board rests on, extended to the one place it had not reached.

`credStore.test.mjs` used to assert the module never MENTIONED XP, which was
right while nothing converted and is too blunt now: conversion legitimately
reads `total_xp`. It asserts the narrower true thing — nothing here assigns it,
and no patch carries the key.

**THE WEEKLY CAP IS WHAT STOPS THIS EATING THE LEAGUE.** Without it a student
with a term of XP banked arrives on Monday with more credits than winning a
group could pay, and `grantForLeague` stops mattering the day it ships.
`WEEKLY_CONVERT_MAX` is well under the league's own spread, and the test asserts
that relationship rather than the number.

**TWO CEILINGS, AND THE ANSWER IS THE TIGHTER ONE.** There is a weekly cap and
a balance cap, and checking them in sequence reports whichever is tested first
rather than whichever binds — a student with 10 credits of room was told "you
can convert 500 more this week", dragged the slider to 500, and was refused by a
limit nobody had mentioned. One ceiling, and the message NAMES the binding half,
because "wait until Monday" and "spend something" are different fixes. An
overflow REFUSES rather than clamping: a clamp spends XP out of a budget that
only spends once and hands back credits the cap discarded.

**NOTHING IS REFUNDABLE, and that is what closes the arbitrage.** With no
sell-back there is no path from an owned object to a balance, so a cosmetic
cannot be laundered back into a balance. Asserted as an ABSENCE — the day
somebody adds a refund is the day this stops being true.

**A consumable cannot be stockpiled.** One streak freeze is insurance; five is
an exemption, and a streak that can be bought out of stops measuring anything.

**THE PURCHASE IS A COMPARE-AND-SET.** Two taps on a slow connection are two
requests that both read 900 cred and both spend it, and PostgREST has no
transaction across calls. The update matches on the balance the check was made
against, so the second touches no rows. The effect is applied AFTER the charge
lands: granting first and failing to charge is a free purchase with no refund
path to unwind it, and a charge that lands with a failed effect is the
recoverable direction. Since the money door went, every effect is recorded by
the patch itself, so there is one write and nothing left to come apart.

**`weekly_chips_bonus` WAS NOT A COLUMN**, and the first draft wrote one —
the silent 400 class `dbColumns.test.mjs` exists for. Moot now that the door is
gone, and kept because the lesson is not: a second column holding a number that
already lives in `extra` is the mirror this codebase keeps deleting, and naming
a column the database does not have fails at runtime and nowhere else.

**THE PRICE WAS THE SMALLEST FIGURE ON A CARD MADE OF PRICES.** The board card
led with two payout ceilings at 20px and put 42¢ in a 62px gutter beside them.
That is a CONDITIONAL — what the strongest call the slider allows returns if it
lands, on a call nobody has made — outranking the market's actual state: the
number every position was scored against, the one the tape moves, and the only
thing on the card that changes while a student is reading it.

`PriceBar` is one object where there were three. The figure leads, the split is
drawn under it, and what each side pays sits under its own end of the bar. A
split four-tenths along is "42¢" with nothing to convert, read peripherally down
a column of cards, which is what a board is for — and POSITION is the second
channel the floor's CVD rule asks for, so the bar survives greyscale. The labels
go UNDER the bar, never inside: a longshot at 5¢ has a sliver with nowhere to put
the word "Yes", and `MIN_SHARE` keeps that sliver visible, because a side the
room has abandoned is still a side you can take.

**A MARKET WITH NO TRADES HAS NO TAPE.** The compact chart drew a dashed rule
edge to edge for one, which reads as a divider. The full chart carries a sentence
saying what the dashes are and the card has no room for it, so the card draws
nothing and lets the crowd row say it.

**`sideLabels` EXISTED AND THE CARD READ IT IN TWO PLACES OUT OF FOUR.** A
head-to-head printed "2 yes · 0 no" and "You: YES" — the model's boolean storage
on the floor, on the one kind the function was written for, two lines below a
call to it. Names are not shouted either: "YES" is a label and "PRIYANKA" is a
fifteen-year-old in caps. And the names of who is holding trail the YES count
they belong to rather than the end of both, or "1 yes · 2 no — Ava" reads as Ava
being one of the two on no.

**"+N if right" WAS THE SAME LIE TakeSide WAS REBUILT TO END**, on the board card
that kept the hard-coded green. A side is not a position here; a distance from
the price is. The row printed "−2 if right" — a negative number under a positive
claim in the colour of money coming in. The colour follows the SIGN, and the
label names the outcome rather than promising the student is right.

**THREE GOLDS WERE TWO TOO MANY.** A market about you carried a gold ring, a gold
sentence and a full-strength gold slab, and the slab was the loudest thing on a
board whose primary gesture is taking a side — which the subject is the one
person who may not do. It is an outline now. The sentence keeps its weight; it is
the whole payoff they get in place of a stake.

**A `kind`'s `resolves` is written as a CONTINUATION** ("from their study log,
both tables") and the footer printed it bare, so it read as a lowercase fragment
somebody had left behind. Prefixed "Settles" — but only on the fallback, since a
`resolves_note` is already a whole sentence.

**AND THE FIXTURE HAD TO CARRY THE SHAPE OF REAL DATA TO SHOW ANY OF IT.** The
probe's positions had no `created_date`, so `priceHistory` collapsed every step
onto x=0 and the sparkline rendered as one stroke against the left edge — which
looks like a broken chart and hid the whole price block from judgement. The same
lesson the Quizzes shelf learned when three-quizzes-per-subject hid a layout that
fell apart on a real account. `?v=card` now deals all four shapes the board can
produce: about you, a head-to-head, a longshot at 5¢, and one nobody has touched.

**THE PRICE MOVES WHERE YOU CAN SEE IT** (`PriceTick`). `Competitions.jsx`
already held a `useLiveTick`, so a card whose room has traded re-rendered at the
new price on its own — SILENTLY. 71¢ became 68¢ between two paints and nothing
said a person had done that, which is the single most important fact a market
board carries, thrown away by a component that already had it. The number counts
and the delta ghosts off above it.

Two rules it keeps. **It never animates on arrival** — the first price a card
shows has not moved, and counting on mount would announce every market as
swinging on every page load. And **the printed figure is always the TRUE
price**: only weight and colour move, so a student who taps mid-animation never
stakes against a number the card was still travelling toward.

The tape follows the same rule — new rows arrive with `layout` and read "just
now", and the first paint flags nothing, or the whole week is breaking news on
every load.

## The weekly league: what it measures, and what it finally pays

**The league has been computing a winner every week and paying them nothing.**
`settleLeagueGroup` wrote `final_position`, the board ranked on a compete score,
and the end of a week produced a number nobody saw and no consequence. A
competition with no prize is a leaderboard with a clock on it.

### THREE SLICES, AND TWO OF THEM MEASURED THE WRONG THING

`computeCompeteScore` moved out of `server.mjs` into `league.js` and the server
IMPORTS it — the mirror this codebase keeps deleting, on the ONE number a
student is ranked on, which is a worse thing to keep two copies of than a page
price. `league.test.mjs` asserts the import and asserts no second definition.

- **Effort** (400) — a countable study minute is a point, through
  `countableStudyMinutes`, so the integrity caps apply.
- **Mastery** (400) — **AN AVERAGE ALONE PUNISHED DOING MORE WORK.** It was the
  bare average of your first sit of each eligible quiz, so ONE easy quiz at 95%
  scored 380 and TWELVE at 78% scored 312: the student who did twelve times the
  work came second, every week, by construction, and the fastest way up the
  board was to sit one quiz on your best topic and stop. The average still sets
  the HEIGHT and the count sets how much of it you get, ramping to full at
  `MASTERY_SITS_FULL` = four. Four because it is a real week of quizzing rather
  than a grind — at twelve the ramp would reward volume over accuracy, the same
  inversion pointed the other way. `BOARD_MIN_QUESTIONS`/`BOARD_MIN_MARKS`
  already stop an eight-second quiz counting at all, so the ramp never has to be
  the thing defending against that.
- **Consistency** (200) — **EVERY SLICE MEASURES THIS WEEK, and one of them did
  not.** It was `days/7 × 150 + streak/14 × 50`, and a streak is a LIFETIME
  number sitting inside a weekly competition: a 60-day run banked 50 points
  every Monday for nothing done that week, and a first-week student could not
  close it however hard they worked. "Never score a student on a signal they
  can't reach", on the one board whose whole promise is that it resets. Days
  active takes the full 200 now; the streak still pays everywhere else it
  always did.

### THE PODIUM IS WHAT A WEEK IS FOR

Three places pay, and three deliberately different KINDS of thing:

- **credits**, the Monday grant, set by where you finished (`grantForLeague`);
- **a crest**, worn beside your name for the week AFTER, on every board the app
  draws — the only reward here other students can SEE, which is what makes a
  league competitive rather than a private score;
- **XP**, small, top three only (`LEAGUE_XP`).

**THE XP IS SMALL ON PURPOSE.** XP feeds level, rank AND the ATAR. A payout big
enough to move somebody's ATAR would mean a quiet week costs them twice — once
on the board and once on the number the whole app is standardised around — and
would make the flagship study score partly a measure of how competitive somebody
is. These are worth about one good session: a nod, not a lever.

**A PODIUM CREST IS EARNED AND IS NOT BOUGHT**, so it is stored apart from
`cred_equipped` (`extra.league_award`, keyed on the week). One slot for both
would mean winning the league silently took off a crest somebody paid 2,850
credits for, or that buying one erased the proof they came first. Where both
exist the EARNED one draws: it is the one with information in it.
`podiumIsCurrent` is what makes it a claim about NOW — a permanent badge for one
good week in March is a statement that stopped being true in March.

**THE PODIUM IS PAID IN BOTH MODES.** Promotion and demotion are a TIERED idea
and are skipped in global mode, where there is nowhere to go — but a finish is a
finish, and the payout block sits deliberately ABOVE that `if (!tiered)
continue`. `grantForLeague` grew a `tiered` flag for the same reason: scoring the
grant on a tier that is a fixed placeholder handed every student the identical
tier weight, so winning the only board there is could never pay the ceiling.
A reward nobody can reach is the "signal they can't reach" rule pointed at the
payout.

### THE CREST RENDERER DID NOT EXIST

`CRESTS` and `crestOf` shipped with the cred store, `useCosmetics` has exposed an
equipped crest since Layout mounted the provider, and **nothing in the tree ever
drew one** — so a student could buy a crest and the only evidence it existed was
the word "Owned" on the shelf they bought it from. That is precisely the bug the
store release was written to end, one file short of the finish.
`components/shared/Crest.jsx` is the renderer, shared by both sources, and the
board SENDS the bought one (`crest_skin`) because a cosmetic only its owner can
see is not worn. `league.test.mjs` asserts the component is reached rather than
merely present.

**SHAPE CARRIES THE PLACE, NOT JUST COLOUR.** There is no bronze token and
inventing one for a single mark is not worth a colour in the palette —
WeeklyBoard's medal note already refused that. First is a filled medal in the XP
amber, second filled in the muted ink, third the OUTLINE: three readings from two
tokens, and it survives greyscale the way the floor's step dots have to.

### PAYING ANOTHER STUDENT NEEDS A TOKEN, AND THE WRITE THAT RECORDS IT CAN LOCK IT OUT

`awardXP` authenticates the requester, so a podium bonus needs `target_email`
AND the caller's header — without it every finisher's XP lands on whoever
happened to open the page, which is the bug `settleHoursCompetition` records in
its own comment. `authHeader` is threaded through `checkAndGrantAchievements` →
`addLeagueXP` → `ensureCurrentLeagueMembership` → `settleLeagueGroup`.

**AND NEVER SETTLE WITHOUT A TOKEN TO PAY WITH.** A settlement writes
`final_position` on every row and `league_award` on every podium profile, and
BOTH are one-shot guards: the group returns early once any position exists, and
the award is keyed on the week. So a settle that could not pay would write the
crest and lock the bonus out FOREVER — worse than settling late. It defers
instead, which costs a tiered student one week at their current tier, and the
next read of the league page carries a token and settles it properly. The lazy
pattern the whole feature already uses.

### THE PAGE HAD THE RACE AND NOT THE REASON

The board drew every gap to one scale and answered "where am I". It could not
answer "what am I racing FOR", because in a ranked list the three paid places
are the first three of thirty rows.

- **`Podium`** is above the standings, and **the reward is printed on the step**
  — a student deciding whether a quiet Thursday is worth one more session is
  weighing exactly that, and a podium that draws three heights is decoration.
  The credits come from `grantForLeague`, the same function the server grants
  with. It is 2-1-3 at `sm` and a plain stacked list on a phone, because three
  stepped columns at phone width are three unreadable slivers.
- **The payline** is a rule across the board after third with what is on the
  other side named. It is the only edge the board has, and it is drawn only when
  somebody is below it — a line under the last row claims a cut-off that does
  not exist.
- **`podiumGap`** is the sentence. Out, it is the gap to THIRD, from wherever
  you are. In, it is the margin over FOURTH rather than over the row below —
  fourth is the only person who can take the crest, so for anyone in first or
  second "8 ahead of 3rd" is a number about nothing at stake. It returns null on
  a board of three or fewer: three paid places out of three students is
  everybody, the same refusal `leagueLead` makes about "1st of 1". It also
  carries `WeekStrip`, which is the entrance students actually land on.
- **`ScoreGuide`** replaced one sentence naming the three slices in passing. A
  student 40 points off third had no way to find out whether 40 points was forty
  minutes, one quiz or a day — which is the difference between a board you can
  play and a number that happens to you. Each slice states its rule and its
  PRICE, and the price comes from `nextPoint`, which is the same arithmetic the
  score is computed with rather than a second description of it. A FULL slice is
  never priced; "study more" to somebody who has maxed effort is the app not
  reading its own screen.

**THE INPUTS TRAVEL WITH THE SCORE.** `nextPoint` cannot price a quiz from three
slice totals — the mastery ramp needs the sit COUNT and the average behind it —
so `leagueStandingRows` returns them and the payload carries `active_days` and
`avg_accuracy` on the student's own row. Computing a number and throwing it away
is this codebase's own recurring bug, pointed at its own board.

Draw the whole page with `scripts/_floorProbe.jsx?v=league`, against a nine-row
board with a crest on it: a two-row fixture hides the payline, the gap scale and
the 2-1-3 step entirely, which is the lesson the Quizzes shelf learned about
checking a layout against the shape of the data somebody actually has.

## Pranks: student-to-student, and every bound is asserted

**This is the only feature where one student does something TO another**, on a
product whose users are mostly fifteen to eighteen and which is being sold to
schools. Migration 0034 ruled out free text on Compete in its own words —
"a text box on that is a moderation problem this app has no way to staff" — so
this ships only because every one of those words can be made false about it.

**FOUR BOUNDS, and the first two are what make it safe:**

- **A FIXED VOCABULARY.** `KINDS` is the whole language. There is no free text
  anywhere in a prank, in the table or on the screen, so nobody can say anything
  to anybody: the most hostile thing that can arrive is a wobble.
- **A RECEIVE CAP, which is the one that matters.** A send cap bounds each
  sender and says nothing about a class of thirty deciding on one person — five
  each is a hundred and fifty, which is a campaign. `WEEKLY_RECEIVE_MAX` makes
  a pile-on structurally impossible, and is TIGHTER than the send cap: better to
  hold one you cannot deliver than to receive one you did not want.
- **FRIENDS ONLY**, mutual and accepted — the difference between a classmate you
  know and a stranger on a public board picking a target.
- **THE SENDER IS NAMED**, always, on the card itself. A row whose sender cannot
  be resolved is DROPPED rather than delivered anonymously.

**THE TWO RECIPIENT-SIDE REFUSALS ARE INDISTINGUISHABLE**, and the test asserts
it. "They can't receive one right now" covers an opt-out AND a full week,
because a refusal that said which would turn the shelf into a way of finding out
who has opted out — and that person is exactly who a determined sender would
then work around. Your OWN limit names itself, because a cap on your own
behaviour is something you can act on, and it is checked first: a sender told
"they can't receive one" when they had also run out would fix the wrong thing.
The picker greys nobody out for the same reason.

**NOTHING A PRANK DOES CAN REACH ANYTHING A STUDENT IS MEASURED ON** — not XP,
a streak, the ATAR, a mark, a deck or a position. Asserted as an ABSENCE over
the module, the shape the refund rule takes: the day somebody adds an effect
that touches a mark is the day this stops being a prank and becomes a penalty
that was bought. The two page-level kinds are pure transform and change no
layout, so nothing moves out from under a finger mid-quiz.

**A PRANK IS NOT IN THE CATALOGUE, and that was a real mistake caught mid-build.**
Everything on the shelf is bought through `purchasePatch`, which charges and
records ownership in ONE write — and a prank is not owned, it is SENT, so it
needs a recipient before it means anything. Listed as a buyable item it would be
charged, written into `cred_owned`, and delivered to nobody: precisely the bug
the rest of this release exists to fix, reintroduced one file over. `sendPrank`
is the only thing that may charge for one, and it refunds directly if the insert
fails — the escrow rule `takePosition` already keeps.

**IT IS NOT A MARKET COMPONENT.** `PrankOverlay` lives in `components/pranks/`
because a prank is BOUGHT on the floor and PLAYS anywhere — over a quiz, the
dashboard, the planner — so it follows the app's own tokens, not the floor's
`--floor-*` palette, which is blank outside `.floor` and would have rendered an
invisible prank on every screen except the one it was bought on.
`floorInk.test.mjs` caught it sitting in `components/market/` with literal hex
in it, which was two mistakes that looked like one.

**REDUCED MOTION STILL DELIVERS.** The animation is suppressed and the CARD
still plays, or a student with motion sensitivity silently receives nothing
while their friend is charged for something that did not happen.

**`getPranks` marks seen ON ARRIVAL**, the rule `SettlementReveal` keeps: a
student who closes the tab has still had it put in front of them, and the
alternative is a prank replaying on every load — the pile-on arriving by another
route. It is in `READ_ONLY_FUNCTIONS` despite writing, because nothing reads
`pranks` through the entity cache, so there is no cached value to invalidate;
left off, it would flush the whole cache on every page mount.

**Migration 0038 must be applied before any of this works.** Writes go through
the service role only — every bound is checked in `sendPrank`, and a client that
could insert directly would walk past all four.

**AND `dbColumns.test.mjs` NOW HONOURS A COMMITTED MIGRATION.** Its message said
"no migration" while only ever checking `schema.json`, which is a dump of what
is DEPLOYED — so a table whose migration is written but not yet applied failed
the check correctly and uselessly, and the suite would stay red through every
release that adds one. A `create table` in `supabase/migrations/` now counts,
with the columns it declares; the dump still WINS wherever both describe a
table, because a migration can be superseded (0008's drop-and-recreate) and a
parsed guess beating a measurement is the inversion that file's header warns
about. Verified it still catches a genuinely imaginary table.

## The floor speaks forecasting, not betting

**"Because we are selling to schools."** The board was built on Polymarket's
vocabulary and inherited a betting shop's words with it. Every one of them had
a more accurate replacement, which is the useful thing: this was not a
euphemism pass.

**`71¢` BECAME `71%`, AND THE CENT WAS THE WRONG UNIT BEFORE IT WAS THE WRONG
WORD.** The number is a PROBABILITY — the model asks for a belief, scores it
with a proper scoring rule and stores it in [0, 1]. Printing it in cents
borrowed a unit for a quantity forecasting already has a word for, and implied
a share you could buy and sell, which this board cannot do: there is no exit
here, which is the same point `EXPECTED IS NOT UNREALISED` makes elsewhere.
`priceLabel` is one function, so the whole app moved at once; the tests pinned
the old unit and were repointed rather than loosened.

- **"Stake" → "Commit."** A stake is wagered against a house. This is scored
  against the room's own forecast, so the new word is also the true one.
- **"Take a side" → "Take a position"**, the exchange idiom.
- **"Longshot" → "Outside chance."**
- **"cred" → "credits"** everywhere it is PRINTED.

**STORAGE NAMES DID NOT MOVE.** `price_at_entry`, `payoutFor`, `stake`,
`cred_balance` and the payload keys stay exactly as they are — renaming those
rewrites history, which is the rule `sideLabels` already keeps about yes and no:
only the LABEL moves, and every position already taken still reads back.

## Age, consent, and the policies the product did not implement

**The Privacy Policy and Terms have promised guardian consent for months.**
`Privacy.jsx` said "We only knowingly collect information from a student where
they are capable of giving consent, or where a parent or guardian has
consented"; `Terms.jsx` said a user under 18 may use the Service "only with the
knowledge and consent of a parent or guardian". **The app collected no age and
asked for no consent** — there was no `date_of_birth` anywhere in the tree, so
neither sentence could have been true of anybody.

Whether the Privacy Act binds a sole trader under the $3M small-business
threshold is arguable. Whether a published statement the product does not
implement is a representation is not: that is misleading conduct under the
Australian Consumer Law whatever the Privacy Act says. **The fix was never to
soften the policy. It was to make the product do what the policy claimed.**

**`initAnalytics()` RAN AT MODULE SCOPE IN `main.jsx`** — so the Meta and TikTok
pixels fired on every page load, before React rendered, before login, before
anything could have been agreed to, on an app whose users are mostly fifteen to
eighteen. There was no consent banner anywhere in the tree. It is
`applyConsent()` now, it loads nothing unless a stored choice is GRANTED, and
`compliance.test.mjs` scans `main.jsx` for the module-scope call specifically.

**THREE THRESHOLDS, AND THEY ARE NOT THE SAME NUMBER** (`src/lib/compliance.js`):

- **13** `MIN_AGE` — below this the account is refused. VCE starts around 15, so
  nobody legitimate is excluded. The refusal does NOT delete on the spot: a
  birthday can be a typo, and destroying a child's data before anybody can check
  is the wrong failure.
- **16** `SOCIAL_MIN_AGE` — Australia's social media minimum age. AcedIt's
  primary purpose is education, which the Rules exempt, so this gates the SOCIAL
  surfaces rather than the account. A safety margin, and one line to move.
- **18** `ADULT_AGE` — guardian consent, and where advertising tracking stops.
  **Advertising stops at 18, not 16**, because the children's code means under
  18 — a sixteen-year-old ticking a box is not the consent it asks for, so the
  honest implementation is not to ask them.

**UNKNOWN AGE IS TREATED AS A CHILD, which is the OPPOSITE of the tour's rule.**
`aceTour.js` counts an unknown account age as OLD, because getting that wrong
generously ambushes 130 accounts with a tutorial. Here the asymmetry runs the
other way: wrong-generously means advertising to a fifteen-year-old and putting
a named minor on a public board; wrong-strictly means an adult is asked their
birthday. So UNKNOWN denies every permission.

**THE GATE IS NOT A WIZARD STEP**, and that is the whole reason it works. A step
in signup only ever catches NEW accounts, and the ~130 existing ones are exactly
the people the policies were already making promises about. `AgeGate` renders
whenever the loaded profile's band is UNKNOWN — new and old alike — and blocks,
because the permissions hanging off the answer default to "no" and a dismissable
question would leave a student silently restricted with no idea why.

The guardian step is an **acknowledgement, not verification**. Nothing is
emailed and nothing is checked, and the code says so rather than implying a
rigour it does not have. Verifiable parental consent is a bigger build and a
question for a lawyer; what this closes is the gap between a policy promising
consent was sought and a product that never asked.

**A NAMED MINOR IS NOT A MARKET SUBJECT BY DEFAULT.** Compete auto-minted "Will
<name> study 5+ days this week?" about students who asked for nothing. The
codebase already refused to auto-mint SAC MARK markets for exactly this reason
and says so in its own words — consent nobody sought is not something a
settlement can hand back — and the same argument applies to a study log; it was
simply never applied. `mayBeMarketSubject` opts adults IN and anybody under 18
OUT, because a default is a decision made on somebody's behalf and should only
be made for people who can knowingly undo it. **It filters the ROSTER, before
minting** — filtering at the card would still have created the row, and a market
that exists but is hidden has published the question to the tape, the settlement
and everyone already holding a position.

Consequence worth knowing: the board mints nothing about anyone until they
answer the gate. The gate blocks the app, so active students answer on their
next login and it repopulates within days.

**Consent is opt-in and silence is not consent.** Two buttons of equal weight,
nothing pre-selected, a dismissal is a refusal, and blocked or absent storage is
a refusal — the one direction this can fail is toward not tracking, which costs
a marketing number and nothing else. Withdrawal stops anything further being
sent; a script already in the page cannot be unloaded, and the policy says that
plainly rather than implying otherwise.

**Loading and sending are different acts, and only the second carries data.**
`applyConsent()` does not check the band — at the moment of consent on the
marketing site there is usually no account to have one. The per-event
`allowed()` gate is what stops a known minor's behaviour ever being sent, and it
reads storage on every call rather than caching, so a withdrawal takes effect
immediately.

`setTrackingBand(null)` on sign-out is not decoration: on a school library
machine, leaving the last student's band behind applies their permissions to a
stranger.

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
- **CHANGING THE LENGTH OF A BLOCK RESETS THE BLOCK**, and it used to reset
  nothing. `settings.workTime` moved and `timeLeft` did not, and elapsed here
  is not stored — it is DERIVED as `total - timeLeft`. So sliding the total up
  while the remainder stood still INVENTED the difference: 25 → 50 on an
  untouched timer made the app believe twenty-five minutes had been studied,
  and a reset then SAVED them and paid XP for them. The other direction drew
  the orb past a full turn. Neither threw; the arithmetic was correct about the
  wrong pair of numbers. The block restarts now, and whatever was genuinely
  studied is banked FIRST — a student who has done ten real minutes and decides
  to stretch the block must not lose them, which is the same error pointed the
  other way.
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
- `src/components/study/WhatToTest.jsx`, `SourceRow.jsx`,
  `src/lib/recallSuggest.js` + `recallSuggest.test.mjs` — the picks that open a
  session and the sources it runs on, drawn as the TOP OF the setup card rather
  than as panels on it. The test holds the two sentences that were false under
  a real account's rows
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
- `src/lib/pranks.js` + `pranks.test.mjs`,
  `src/components/pranks/PrankOverlay.jsx`, `supabase/migrations/0038_pranks.sql`
  — the four bounds, and the tests that assert them rather than describing them.
  `sendPrank` / `getPranks` in `server.mjs`; draw them with
  `scripts/_floorProbe.jsx?v=pranks`, over real content
- `src/lib/cosmetics.js`, `src/lib/CosmeticsContext.jsx` — what a student
  bought, actually drawn. The provider is mounted in Layout; `CardBack` and the
  crest consume it rather than being handed a skin by nineteen call sites
- `src/components/market/PriceBar.jsx` — the price, drawn: the figure, the
  split, and what each side pays under its own end. One object where the card
  had an odds row, a price gutter and a change figure
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
  WHOLE page — header, tabs, chips, board and tape rail — face down, then
  turning it over into the skeleton. It drew the cards alone at less than half
  their real height, so the page it promised would not jump, jumped.
  `aceLoading.test.mjs` holds the regions and the slot height; draw it with
  `scripts/_floorProbe.jsx?v=deal`
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
- `src/lib/markingPrompt.js` + `markingPrompt.test.mjs`,
  `src/lib/examinerReports.js` — the marking instructions as ONE cacheable
  system block: the subject's examiner profile (which the marker never used),
  the worked marks, and the rubric. The scan is what stops the profile
  silently falling back out of the prompt again
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
- `src/components/ace/useAceYield.js` + `src/lib/aceStage.test.mjs` —
  `ACE_ORDER`, the one list that decides which Ace is on screen. The scan is
  what catches a surface that draws him and forgets to claim
- `src/lib/serverBoot.test.mjs` — every module `server.mjs` reaches, checked
  against what NODE can resolve rather than what vite can. An `@/` alias in a
  shared module builds, lints, tests green and crashes the deploy on boot
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
- `src/lib/league.js` + `league.test.mjs`, `src/pages/League.jsx`,
  `src/components/league/WeeklyBoard.jsx`, `Podium.jsx`, `ScoreGuide.jsx`,
  `src/components/ranked/WeekStrip.jsx` — the weekly board: the compete score
  (imported by `server.mjs`, never mirrored), what a finish pays, the payline
  and what one more point costs. `leagueStandingRows` and `settleLeagueGroup`
  in `server.mjs` are the one ranking and the settlement that finally writes a
  payout down; draw the page with `scripts/_floorProbe.jsx?v=league`
- `src/components/shared/Crest.jsx` — the mark beside a name, from either way
  of getting one. The earned crest outranks the bought one; `CRESTS` was sold
  for a release with no renderer at all
- `src/lib/integrity.js` — the caps, the idle discount, the quiz floors and the
  verified/claimed split. Mirrored server-side by `countableStudyMinutes`,
  `verifiedStudyMinutes` and `boardQuizScores`; change one, change both
- `src/lib/liveRefresh.js`, `src/lib/LiveContext.jsx`, `src/api/realtime.js` —
  when the app may refetch, who can hold it still, and the push path
- `src/components/shared/LiveNumber.jsx` — rolling figures. `LiveDot.jsx` is
  DELETED; see the note where `useLiveCount` stood in `useStakes.js`
- `src/components/shared/Reveal.jsx` — the one page entrance, and the rule
  about what should not animate at all
- `supabase/schema.json` + `scripts/dumpSchema.sh` — the real column list, and
  how to regenerate it after a migration
- `src/lib/achievements.js` — the catalogue, its progress functions and the
  showcase ordering; `buildAchievementStats` in `server.mjs` is the only reader
  of the database, and adding an achievement means adding its stat there too
- `catchUpEveryone` / `loggedXPFor` in `server.mjs` — the one-shot roster
  backfill at boot: missing board rows, XP behind its own log, and every ATAR
  never computed. The XP pass only ever RAISES, because `awardGoalXP` logs no
  event and setting from the log would delete real XP
- `syncBoardRow` / `sweepBoardRows` in `server.mjs` + `boardSync.test.mjs` —
  the ONE writer of `leaderboards` and the lazy backfill. Nothing in the tree
  had ever INSERTED a row, so ~90 accounts earned XP and never appeared on the
  board; the scan is what stops a twelfth mirror being written the old way
- `src/lib/appVersion.js` + `appVersion.test.mjs`,
  `src/components/shared/UpdatePrompt.jsx` — noticing a deploy and asking to
  reload into it. The version is the hash of the served `index.html`, and the
  hold list is `liveRefresh`'s own, imported rather than restated
- `src/lib/reachable.test.mjs` — the guard on a page nobody can find: the
  Review queue is in both navs, the League is a tab on Ranked, every entrance
  uses the page's own name and carries a real number, and no nav entry points
  at a route that is not there. Draw the bar with
  `scripts/_floorProbe.jsx?v=reach`
- `src/lib/ranked.js` `BOARDS` / `boardsFor` + `src/lib/boardMovement.js` +
  `rankedBoards.test.mjs` — the three boards, the ERA that decides which tab
  each sits on, and which way every row has gone since Monday. The movement
  rules are the whole file: a lower rank number is better, a missing previous
  placing is NEW and never a fall from zeroth, and no snapshot draws nothing.
  `weekBoardSnapshots` / `board_snapshots` (migration 0039) are the server half
- `src/components/ranked/RankedBoard.jsx`, `BoardControls.jsx` — the board: one
  right-aligned figure column, the place as display type, the movement lane,
  the capped podium and the bar that pins your row once you scroll past it.
  Draw it with `scripts/_floorProbe.jsx?v=board`, against fourteen rows
- `src/lib/ranked.js` `COMPONENT_MOVE` + `rankedMove.test.mjs` — the one map
  from an ATAR component to the thing that raises it, deep-linked where a deep
  link exists. The test checks every query it emits is actually READ by the page
  it points at; draw the panel with `scripts/_floorProbe.jsx?v=ranked`
- `src/components/ranked/AchievementUnlock.jsx`, `CrestRow.jsx` — the moment,
  and the badges beside somebody's name
- `src/components/shared/MarkdownMath.jsx`, `LatexRenderer.jsx` — KaTeX
- `supabase/migrations/0001…0006_*.sql` — applied schema
- `base44/entities/*.jsonc`, `base44/functions/*/` — Base44 reference, kept until cutover
