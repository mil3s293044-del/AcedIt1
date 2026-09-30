/**
 * markingPrompt — the marking instructions, as ONE cacheable block.
 *
 * ─── THE EXAMINER PROFILE WAS NEVER REACHING THE MARKER ─────────────────────
 * `subjectExaminerPrompts.js` carries 35 subjects of real study-design detail:
 * the mark allocation conventions (M/A/C, "exact form or the answer mark only",
 * "show every step"), the key VCAA terminology, the per-subject list of how
 * candidates actually lose marks, and the full command-term table. Six surfaces
 * import it. The one that MARKS did not — QuizPlayer took `getLatexRules()` and
 * nothing else, so the prompt instructed the model to "WRITE LIKE A VCAA
 * EXAMINER'S REPORT" and to "use the command term" while the command-term table
 * sat unused two imports away.
 *
 * That is this codebase's own recurring failure — an input collected and then
 * ignored — landing on the highest-stakes call in the app, the one whose errors
 * come out of a student's marks.
 *
 * ─── AND "BE LENIENT ON PHRASING" CONTRADICTED ALL OF IT ────────────────────
 * The old prompt carried that line. Methods' conventions say a decimal cannot
 * earn a mark the question asked for exactly; Chemistry's say a named force
 * without its cause does not address the command term. A marker told both
 * resolves it somewhere nobody chose, differently each time. Leniency belongs
 * where it was actually meant — spelling, notation and word order, none of
 * which VCAA penalises either — and that is what the register rules say now.
 *
 * ─── WHY THIS IS A SYSTEM BLOCK AND NOT MORE PROMPT ─────────────────────────
 * Everything here is identical for every mark in a subject; only the questions
 * and the student's answers change. Left inline it is re-billed at full rate on
 * every single marking call. Hoisted into a cached system block it bills at
 * ~0.1x after the first hit, which is what makes the profile, the worked marks
 * and (later) the distributions affordable at all.
 *
 * THE BLOCK HAS TO CLEAR THE MODEL'S MINIMUM CACHEABLE PREFIX OR THE CACHING IS
 * THEATRE — a shorter prefix simply does not cache, with no error and
 * `cache_creation_input_tokens: 0`. That minimum is per-model and is NOT
 * monotonic across generations, which is why `MIN_CACHEABLE_PREFIX` is a table
 * rather than a number: 512 tokens on current Sonnet and Opus, 1024 on Sonnet
 * 4.6, 4096 on Haiku 4.5.
 *
 * A bare examiner profile is ~865-1170 tokens and would have been UNDER the
 * floor on Sonnet 4.6 — the profile plus the worked marks plus the rubric is
 * ~2000-3000, which clears every model marking runs on EXCEPT Haiku 4.5. That
 * exception is real and is stated rather than hidden: `SAVER_EXCLUDES` is empty
 * on purpose (read its comment), so a student on the Saver tier has their
 * marking run on Haiku, where this block is sent and billed in full every time.
 * `cachesFor` answers that truthfully per model instead of pretending one
 * number covers it.
 *
 * ─── ONE LATEX RULE SET, NOT TWO ────────────────────────────────────────────
 * `getLatexRules()` returns the same `SHARED_LATEX_RULES` that
 * `getExaminerPrompt()` already appends for a math-heavy subject. Sending both
 * prints the delimiter rules TWICE for every maths subject — duplicated
 * instructions and duplicated cached tokens. So the rules are added only when
 * the profile did not already carry them.
 */

import { getExaminerPrompt, getLatexRules, subjectIsMathHeavy } from "@/lib/subjectExaminerPrompts";
import { exemplarSection, distributionNote } from "@/lib/examinerReports";

/**
 * Minimum cacheable prefix per model family, in tokens.
 *
 * Longest-prefix match, the same rule `priceFor` uses and for the same reason —
 * a dated snapshot has to resolve to its family. Anything unrecognised gets the
 * STRICTEST known floor, because the failure is silent: guessing generously
 * would report a block as cacheable when it is being billed in full on every
 * mark, and the only trace is a zero in a log line.
 */
export const MIN_CACHEABLE_PREFIX = {
    "claude-haiku-4-5":  4096,
    "claude-sonnet-4-6": 1024,
    "claude-sonnet-5":   1024,
    "claude-sonnet-5-5":  512,
    "claude-opus-4-8":   1024,
    "claude-opus-5":      512,
    "claude-opus-5-5":    512,
};

const STRICTEST_PREFIX = Math.max(...Object.values(MIN_CACHEABLE_PREFIX));

/** The floor for one model id, by longest prefix; strictest known if unknown. */
export function cacheFloorFor(model) {
    const id = String(model || "");
    let best = null;
    for (const key of Object.keys(MIN_CACHEABLE_PREFIX)) {
        if (id.startsWith(key) && (!best || key.length > best.length)) best = key;
    }
    return best ? MIN_CACHEABLE_PREFIX[best] : STRICTEST_PREFIX;
}

/**
 * Rough token count for a prompt fragment.
 *
 * Deliberately crude and deliberately PESSIMISTIC — 4 characters per token
 * over-counts English prose slightly, so a block this says clears the floor
 * really does. Anything needing a true count uses `messages.count_tokens`; this
 * exists so a test can assert the block is in the right order of magnitude
 * without a network call.
 */
export function approxTokens(text) {
    return Math.ceil(String(text || "").length / 4);
}

/**
 * How the mark is itemised, and the register it is written in.
 *
 * Moved here verbatim in substance from QuizPlayer's inline prompt: it is the
 * same rubric, and `quizMarking.js` is what enforces it on the way back in.
 * Anything about a SPECIFIC attempt — how many questions, whether any carries a
 * previous answer, the questions themselves — stays out, because it is what
 * makes the prefix vary and a varying prefix does not cache.
 */
const MARK_RUBRIC = `HOW TO MARK.

MCQ scores 0 or 1 and nothing between. A written question scores from 0 to its
stated allocation. Judge the SUBSTANCE against the mark conventions above: do
not deduct for spelling, for notation the student has written legibly a
different way, or for word order, none of which VCAA penalises — and do not
award a mark the conventions say was not earned.

A question carrying source material was answered WITH THAT SOURCE IN FRONT OF
THE STUDENT — it is printed above the question exactly as they saw it. Mark
against it: credit what the source supports, and treat a point the source does
not carry as unsupported rather than as an error of recall.

For EACH question return: marks, criteria, annotations, what_wrong, improve.
For a question that scored full marks, leave what_wrong and improve as empty
strings — do not write praise.

CRITERIA are the marks themselves, itemised — one entry per mark the assessor
is looking for, so their "worth" values must add up to the question's total
allocation. Each says what was wanted, whether this answer did it, and for a
missed one, what specifically was absent. This is the most useful thing you
produce: "you dropped the mark for naming the electron transfer" is something a
student can act on, and "2/4" is not. Write the criterion as the assessor would
phrase it, not as a comment on the student.

  - "note" on a MISSED criterion is where the student reads what to do, and it
    is shown whether or not you managed to quote anything, so it must stand on
    its own. Say what a full-mark response would have contained for THIS mark.
    A missed criterion with an empty note is a mark the student cannot act on.

ANNOTATIONS point at the exact words that cost the mark, so they can be
underlined in the student's own answer. An annotation is EVIDENCE FOR A
CRITERION, never a verdict of its own — the criteria decide what was lost, and
an annotation only shows where it happened.

  - "criterion_index" is the 0-based position of the criterion in the array
    above that this annotation is evidence for. Always set it. An annotation
    that names no criterion cannot be shown as having cost a mark, because
    nothing connects it to one.
  - Do not annotate a phrase to say it cost a mark when every criterion is met.
    The criteria are the ledger; if they all say "got", nothing cost anything.
  - "quote" MUST be copied from their answer CHARACTER FOR CHARACTER — same
    case, same punctuation, same spacing. It is matched against their text
    exactly, and anything that does not match is silently discarded, so a
    paraphrase is the same as sending nothing.
  - Quote the SHORTEST span that carries the problem. A whole sentence tells
    the student to rewrite a sentence; four words tells them what to change.
  - "issue" — what an assessor sees wrong with those words. One sentence.
  - "wanted" — what the assessor was looking for there, in the language of the
    study design or the command term. This is the half a student cannot work
    out for themselves, and it is what makes the note worth reading.
  - "fixes" — one or two wordings that would have scored. Two is better than
    one where two genuinely different phrasings work, because it lets the
    student pick the one that sounds like them instead of copying yours. Never
    pad to two.
  - "severity" is "lost" when it cost a mark, "risk" when it survived but is
    imprecise. This is checked against the criterion you linked it to and
    corrected if it disagrees, so linking it correctly matters more.
  - Only annotate where the wording genuinely matters — never a stylistic
    preference, and never on an answer that scored full marks. Zero
    annotations is a normal and common answer.

WRITE LIKE A VCAA EXAMINER'S REPORT, because that is what this is. That means:
  - Address what the RESPONSE did, not what the student is. "This response
    describes the change without naming the transfer", never "you didn't
    understand" and never "great effort".
  - Use the command term. If the question said EVALUATE and the answer
    described, say so — misreading the command term is the single most common
    way marks are lost, and naming it teaches something that transfers.
  - No praise, no encouragement, no exclamation marks. A clean mark gets an
    empty comment; the mark itself is the feedback.
  - Say what a full-mark response would have contained. Examiners publish the
    high-scoring answer; that is the useful part of the report.

THEN look ACROSS every question that lost marks and find the THEMES.
A theme is one underlying reason that cost marks on TWO OR MORE questions —
the same confusion, the same missing step, the same misread command term.
This is the most useful thing you will produce: a student who is told "these
three were the same mistake" has one thing to fix instead of three.
  - "questions" must list the question numbers it covers, and there must be at
    least two of them.
  - "title" is at most eight words and names the mistake, not the topic.
  - "detail" is ONE sentence saying what to do differently.
If no two lost questions share a cause, return an empty themes array. Never
invent a theme from a single question.`;

/**
 * The whole cacheable marking block for one subject.
 *
 * Order matters and it is not cosmetic: the examiner profile comes FIRST
 * because it is the largest stable span and a cache prefix matches from the
 * front, then the worked marks calibrate against it, then the rubric says what
 * shape to answer in. Every optional section is dropped rather than stubbed —
 * a heading over nothing spends cached tokens saying there is nothing there.
 */
export function markingSystem(subject) {
    const name = String(subject || "").trim();
    const sections = [
        getExaminerPrompt(name),
        // Already inside the profile for a math-heavy subject; sending it again
        // prints the same delimiter rules twice.
        subjectIsMathHeavy(name) ? null : getLatexRules(),
        exemplarSection(name),
        distributionNote(name),
        MARK_RUBRIC,
    ].filter(Boolean);
    return sections.join("\n\n");
}

/**
 * True when this subject's block is long enough to cache ON THAT MODEL.
 *
 * Not a guard — a block under the floor is still correct and still marks well,
 * it just does not cache, so refusing to send it would trade a real feature for
 * a cost optimisation. It exists to be asserted in the test and to be logged,
 * because the failure is otherwise invisible.
 */
export function cachesFor(subject, model) {
    return approxTokens(markingSystem(subject)) >= cacheFloorFor(model);
}

export default {
    markingSystem, cachesFor, cacheFloorFor, approxTokens, MIN_CACHEABLE_PREFIX,
};
