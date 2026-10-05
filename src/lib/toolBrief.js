/**
 * toolBrief — what to use an AI tool FOR today, derived from what the app
 * already measured.
 *
 * ─── THE PAGE OPENED ON A BLANK BOX ─────────────────────────────────────────
 * /AITools is a chat with a nine-persona dropdown. A student arriving there had
 * to know which of nine personas solves their problem, and then describe that
 * problem from scratch — while nine modules in this codebase already knew
 * exactly what was wrong with their study:
 *
 *   studyQueue        everything outstanding, ranked in four tiers
 *   bankSummary       the criteria they keep dropping, with the repeats named
 *   weakSpots         the topics their reviews keep failing on
 *   retentionOutlook  what is fading fastest, per subject
 *   subject_assessments  what is on the calendar and how close it is
 *
 * And NOTHING in the app deep-linked into a tool. Not MistakeBank, which knows
 * the exact criterion. Not SubjectHub, which knows the course gap. Not the
 * queue, not Ranked's component doors. The most informed screens in the app
 * all stopped one link short of the one surface that could act on what they
 * had found.
 *
 * ─── THE DIAGNOSIS IS ARITHMETIC. THE AGENT IS WHAT YOU HAND IT TO ──────────
 * The tempting build is an agent that reads the student's data and writes the
 * diagnosis itself. That is exactly what was deleted from Insights, and the
 * reason it was deleted holds harder here: every panel there "names one thing
 * and points at the screen that moves it, so a paragraph of generated advice on
 * top of them is a SECOND answer to a question four panels have already
 * answered properly — and the one answer nobody can check."
 *
 * So nothing in this module calls a model. Every line it produces is counted
 * off rows the page already loaded, which means a student can check it: "three
 * times" is three, and the three are nameable. The MODEL runs when they press
 * the card, on a problem that has already been established.
 *
 * ─── NOTHING IS STORED ──────────────────────────────────────────────────────
 * The rule `redoQueue`, `studyQueue` and `subjectHub` already follow. There is
 * no brief table, no dismissed flag and no backfill; a card disappears because
 * the fact behind it stopped being true.
 *
 * ─── AND IT REFUSES RATHER THAN PADDING ─────────────────────────────────────
 * Every builder returns null when its number is not real. A brief that reaches
 * a respectable length by printing "0 topics to review" teaches a student that
 * the numbers here are decoration, after which the real ones do not land
 * either — the rule the dashboard rail and studyQueue both keep. An account
 * with nothing measured yet gets NO cards and a sentence saying so, which is a
 * real answer.
 */
import { bankSummary } from "./mistakeBank.js";
import { weakTopicsFrom } from "./weakTopics.js";
import { retentionOutlook } from "./retention.js";
import { daysUntil, SOON_DAYS } from "./studyQueue.js";

/* ── Routing ─────────────────────────────────────────────────────────────── */

/**
 * The persona a SUBJECT's written work belongs to.
 *
 * ─── `subjectIsMathHeavy` IS THE WRONG FLAG, and it was the obvious one ─────
 * It exists to decide whether a prompt needs the LaTeX delimiter rules, so it
 * is TRUE for Chemistry, Physics, Economics and Psychology — subjects whose
 * answers carry working. Routed on it, a student with a Chemistry SAC was sent
 * to the MATH TUTOR, which reads as the app not knowing what subject they take.
 * Caught by this module's own test on its first run.
 *
 * So both branches are name matches over the studies the catalogue profiles,
 * which is exact at this size: four mathematics studies and four English ones.
 * There is no field saying "this is assessed as an essay" to read instead, and
 * a heuristic over the name is what gets Data Analytics wrong — the same reason
 * `subjectBrowse`'s learning areas are hand-mapped rather than derived.
 *
 * Anything else gets the general examiner, which is the honest default: a wrong
 * persona is worse than a general one.
 */
export function personaFor(subject) {
    const s = String(subject || "");
    if (!s) return "exam_questions";
    if (/\bMathematic(s|al)\b/i.test(s)) return "math_tutor";
    if (/\bEnglish\b|\bLiterature\b|\bEAL\b/i.test(s)) return "english_mentor";
    return "exam_questions";
}

/** Is this one of the mathematics studies? Used to pick how a topic is drilled. */
const isMaths = (subject) => /\bMathematic(s|al)\b/i.test(String(subject || ""));

/** Minimum evidence before a card may claim a pattern rather than an instance. */
export const REPEAT_MIN = 2;

/* ── The cards ───────────────────────────────────────────────────────────── */

/**
 * An assessment close enough to prepare for.
 *
 * This is the only card with a DATE in it, so it leads — the rule studyQueue's
 * four tiers already state: a date cannot be moved, so anything that can wait,
 * waits. It does not check whether prep has started, because studyQueue's
 * version of that question is about the study log and this one is about what to
 * ask a tool; a student who has revised all week can still want questions.
 */
export function assessmentCard(assessments = [], now = new Date()) {
    let best = null;
    for (const a of assessments) {
        if (!a || a.is_completed) continue;
        const subject = a.subject_name;
        if (!subject) continue;
        const days = daysUntil(a.due_date, now);
        if (days == null || days < 0 || days > SOON_DAYS) continue;
        if (!best || days < best.days) best = { a, days, subject };
    }
    if (!best) return null;

    const { subject, days, a } = best;
    const tool = personaFor(subject);
    const when = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
    return {
        key: `assessment:${a.id || subject}`,
        kind: "assessment",
        tool,
        subject,
        // THE FACT IS SEPARATE FROM THE OFFER, and both are printed. The fact
        // is what the student checks us on; the offer is what the button does.
        fact: `${a.title || "An assessment"} in ${subject} is ${when}.`,
        offer: tool === "math_tutor"
            ? "Work through the kind of question it will ask"
            : tool === "english_mentor"
                ? "Plan and mark a response under its criteria"
                : "Sit VCAA-style questions on it",
        // The seed is a REAL first message, not a prompt template: it is what
        // the student would have had to type, so it has to read like them.
        seed: `I have a ${subject} assessment ${when}: ${a.title || "a SAC"}. Give me exam-style questions on it and mark my answers.`,
        options: { subject },
        urgency: 1000 - days,
    };
}

/**
 * A criterion dropped more than once.
 *
 * `bankSummary` already computes repeats, and a repeat is the strongest card
 * this brief can print: it is one thing to fix rather than four, which is the
 * argument /MistakeBank's own headline makes. A criterion dropped ONCE is an
 * instance and stays on the bank where it belongs.
 */
export function repeatCard(bankCards = [], isReady = () => false, attempts = []) {
    const s = bankSummary(bankCards, isReady, attempts);
    const repeats = (s.repeats || []).filter((r) => (r.count || 0) >= REPEAT_MIN);
    if (!repeats.length) return null;
    const worst = repeats.slice().sort((a, b) => (b.count || 0) - (a.count || 0))[0];
    const criterion = String(worst.criterion || "").trim();
    if (!criterion) return null;

    // `repeatOffenders` returns `subjects` — a SET of every subject the
    // criterion was dropped in, flattened to an array. One subject is a fact
    // about that subject; several is a fact about the student's writing, and
    // naming one of them would be picking arbitrarily.
    const subs = Array.isArray(worst.subjects) ? worst.subjects : [];
    const subject = subs.length === 1 ? subs[0] : null;
    return {
        key: `repeat:${criterion}`,
        kind: "repeat",
        tool: "concept_explainer",
        subject,
        fact: `You have dropped "${criterion}" ${worst.count} times${subject ? ` in ${subject}` : ""}.`,
        offer: "Have the idea behind it explained properly",
        seed: `An assessor keeps marking me down for this: "${criterion}"${subject ? ` in ${subject}` : ""}. Explain what they are actually looking for, and show me what a full-mark version sounds like.`,
        options: subject ? { subject } : {},
        urgency: 900 + (worst.count || 0),
    };
}

/**
 * The topic the reviews keep failing on.
 *
 * `weakTopicsFrom` keeps a topic on `weakCards > 0` ALONE, so a real `missRate`
 * of 0 arrives on a topic that has never been missed — the falsy-zero trap
 * recallSuggest.js records being caught by a screenshot. A card claiming a
 * topic is costing marks must have a miss rate ABOVE zero to say so.
 */
export function weakTopicCard(cards = []) {
    const topics = weakTopicsFrom(cards) || [];
    // `missRate` IS ALREADY A PERCENTAGE, 0-100, and it is NULL for a topic
    // with no reviews behind it. Multiplying by 100 would have printed 3000%,
    // and `Number(null)` is 0, which the `> 0` test is what catches — the
    // falsy-zero trap this codebase has now met in nine modules, and the exact
    // "0% of your reviews on this missed" sentence recallSuggest.js records a
    // screenshot catching under a pill reading *Costing you marks*.
    const real = topics.filter((t) => t?.missRate != null && Number(t.missRate) > 0);
    if (!real.length) return null;
    const t = real.slice().sort((a, b) => Number(b.missRate) - Number(a.missRate))[0];
    const pct = Math.round(Number(t.missRate));
    // TWO GUARDS, AND THEY ARE REDUNDANT ON PURPOSE — which is worth stating,
    // because it means removing EITHER ONE ALONE is invisible to the test, and
    // only removing both is caught. Verified by injecting all three cases.
    //
    // What they refuse is one sentence apart. The filter refuses a NULL miss
    // rate — a topic with no reviews behind it, where `Number(null)` is 0 and
    // would read as a perfect record rather than as no record. This line
    // refuses a genuine ZERO: a deck whose every review landed still arrives
    // with `weakCards > 0`, so it survives weakTopicsFrom's own filter carrying
    // a real miss rate of nought, and printing "0% of your reviews on this
    // missed" under an offer to fix it is the app telling a student their clean
    // record is the problem. recallSuggest.js records a screenshot catching
    // exactly that sentence, under a pill reading *Costing you marks*.
    if (!pct) return null;

    const subject = t.subject || null;
    const tool = isMaths(subject) ? "math_tutor" : "concept_explainer";
    return {
        key: `weak:${subject || ""}:${t.topic}`,
        kind: "weak",
        tool,
        subject,
        fact: `${pct}% of your reviews on ${t.topic} have missed.`,
        offer: tool === "math_tutor"
            ? "Work it step by step until it holds"
            : "Get it explained a different way",
        seed: `I keep getting ${t.topic}${subject ? ` in ${subject}` : ""} wrong — about ${pct}% of my reviews on it miss. Explain it from the start and check I have actually got it.`,
        options: subject ? { subject } : {},
        urgency: 800 + pct,
    };
}

/**
 * Cards whose predicted recall has fallen through the floor.
 *
 * TEACH IT BACK rather than an explainer, deliberately: the student has already
 * met this material and recall is what failed, so being told it again is
 * recognition — the illusion drill.js is built to refuse. Explaining it is
 * retrieval.
 *
 * ─── AND IT POINTS AT THE TECHNIQUE NOW, NOT AT A CHAT WINDOW ───────────────
 * This card made the right argument and then dead-ended: it opened the
 * `teaching_assistant` persona, so the app's own best reasoning about fading
 * material handed the student a text box. /Study?tab=feynman is the same idea
 * built as a session — it logs minutes, it pays XP, it earns a breadth family,
 * and it ends in a rewrite rather than a transcript.
 *
 * `to` is how a card says it is a LINK rather than a seed. A card without one
 * is unchanged and still opens the chat with its message in the composer.
 */
export function slippingCard(cards = [], now = Date.now()) {
    const o = retentionOutlook(cards, { now });
    const subjects = (o.subjects || []).filter((s) => s.slipping > 0);
    if (!subjects.length) return null;
    const worst = subjects.slice().sort((a, b) => b.slipping - a.slipping)[0];
    return {
        key: `slipping:${worst.subject}`,
        kind: "slipping",
        tool: "teaching_assistant",
        subject: worst.subject,
        fact: `${worst.slipping} of your ${worst.subject} cards are past reliable recall.`,
        offer: "Teach it back, and answer what you cannot",
        seed: `I am going to teach you ${worst.subject}. Play a student who asks why, and stop me where I am vague.`,
        options: { subject: worst.subject },
        // The Feynman technique, opened on this subject. The tool above stays
        // as the card's GLYPH and name — a conversation about the same material
        // is still worth having — but the button goes to the session.
        to: { page: "Study", query: { tab: "feynman", subject: worst.subject } },
        urgency: 700 + worst.slipping,
    };
}

/* ── The brief ───────────────────────────────────────────────────────────── */

/** How many cards the brief may show. */
export const BRIEF_MAX = 3;

/**
 * The whole brief, ordered by what it costs to skip.
 *
 * ONE CARD PER KIND, capped at three. A page that opens with eight next moves
 * is the Quizzes shelf before it was cut to one, and the cap is what keeps this
 * a brief rather than a second queue — /Review owns the full list, and a
 * smaller second copy of it is the thing this codebase keeps deleting.
 */
export function toolBrief({
    assessments = [],
    bankCards = [],
    cards = [],
    attempts = [],
    isReady = () => false,
    now = new Date(),
} = {}) {
    const at = now instanceof Date ? now : new Date(now);
    const cards_ = [
        assessmentCard(assessments, at),
        repeatCard(bankCards, isReady, attempts),
        weakTopicCard(cards),
        slippingCard(cards, at.getTime()),
    ].filter(Boolean);

    return cards_.sort((a, b) => b.urgency - a.urgency).slice(0, BRIEF_MAX);
}

/*
 * THERE IS NO `briefLead`, AND THERE WAS.
 *
 * It returned the first card's fact, on `queueLead`'s rule that naming the
 * first item beats counting them — right for a queue, and wrong here for a
 * reason only the screenshot showed: the first CARD then prints that same
 * sentence two inches below, in bold, as its own headline. One fact, twice, on
 * a screen whose whole claim is that every line on it is worth reading.
 *
 * The cards lead themselves. Each one opens with its fact at full weight, so
 * the brief has a heading that frames rather than restates, and nothing above
 * the list competes with the first row of it.
 */

/**
 * The query string that hands a problem to a tool.
 *
 * ONE BUILDER, because every screen that knows something needs to hand it over
 * the same way — the brief, the mistake bank's repeat rows, the subject hub.
 * Three copies of "tool, q, subject" is three chances for one of them to spell
 * a key differently, and the failure is silent: the link lands on the right
 * page and the thing it promised to open simply does not.
 *
 * No routing in here. No module in src/lib imports `@/utils`, so the caller
 * prepends `createPageUrl("AITools")` and this stays pure and testable.
 */
export function toolQuery({ tool, seed = "", subject = null } = {}) {
    const q = new URLSearchParams();
    if (tool) q.set("tool", tool);
    if (seed) q.set("q", seed);
    if (subject) q.set("subject", subject);
    return q.toString();
}

export default {
    personaFor, assessmentCard, repeatCard, weakTopicCard, slippingCard,
    toolBrief, toolQuery, BRIEF_MAX, REPEAT_MIN,
};
