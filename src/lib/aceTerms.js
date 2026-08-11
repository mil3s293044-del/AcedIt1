/**
 * aceTerms — the words the app uses without ever saying what they mean.
 *
 * The feature map answers "what is Blurting". This answers the other half of
 * the confusion, which is smaller and far more common: a student is looking at
 * a number, a badge or a row of four buttons, and nothing on the screen says
 * what it is. "AcedIt ATAR 71.4". "Weak spot". "Again / Hard / Good / Easy".
 * "Stability 62". Every one of those shipped with no definition anywhere in
 * the product.
 *
 * Two rules, both learned the hard way elsewhere in this app:
 *
 *   Say how it's WORKED OUT, not what it's for. "Consistency" doesn't need a
 *   motivational sentence, it needs "distinct days you studied in the last 28,
 *   full marks at 20" — because the student's real question is always "why is
 *   mine low" and only the formula answers that.
 *
 *   Say what it ISN'T where that's the misreading waiting to happen. The
 *   AcedIt ATAR is the obvious one: it scores your habits over 28 days and a
 *   student will read it as a predicted score unless told otherwise, in the
 *   same breath rather than in a footnote.
 *
 * Definitions here are taken from the code that computes them (server.mjs's
 * arena scoring, src/lib/retention.js, src/lib/cognitiveProfile.js). If one of
 * those changes and this doesn't, this file is wrong — which is the same
 * bargain the feature map makes, and the reason both live next to each other.
 */
import { AXES } from "@/lib/cognitiveProfile";

/**
 * @typedef Term
 * @property {string} term   what it's called on screen, exactly
 * @property {string} what   one sentence: what the number or control IS
 * @property {string} [how]  how it's actually computed, when that's the question
 * @property {string} [not}  the misreading to head off, where there is one
 * @property {string} [see]  a feature id from aceKnowledge to offer a door to
 */
export const TERMS = {
    // ── The flagship number ─────────────────────────────────────────────
    atar: {
        term: "AcedIt ATAR",
        what: "A single score out of 99.95 for how well you've been studying over the last 28 days.",
        how: "Five parts, weighted: mastery 28%, consistency 27%, effort 22%, breadth 13%, planning 10%.",
        not: "It is not a predicted VCE result and has nothing to do with VCAA. It scores your habits, not your marks — you can hold a high one and still have work to do on the content.",
        see: "atar",
    },
    provisional: {
        term: "Provisional",
        what: "Your score is being shown before there's enough of it to stand behind.",
        how: "Under three separate study days in the window, the number moves too much to mean anything. It's still computed so you can see what's missing.",
    },

    // ── The five parts of it ────────────────────────────────────────────
    mastery: {
        term: "Mastery",
        what: "How often you're getting things right, across quizzes and flashcards.",
        how: "Quiz accuracy counts for 60% and flashcard accuracy for 40%. Thin evidence scales the whole thing down, so one lucky quiz can't carry it — it takes about 20 questions and cards before it counts in full.",
        see: "spaced_repetition",
    },
    consistency: {
        term: "Consistency",
        what: "How many separate days you actually studied.",
        how: "Distinct study days in the last 28. Full marks at 20 of them — so five short days beat one long one.",
        see: "streak",
    },
    effort: {
        term: "Effort",
        what: "Total study minutes over the last 28 days.",
        how: "Log-scaled, so the first hour is worth far more than the tenth. Full marks around 1,200 minutes — roughly 43 minutes a day.",
        see: "pomodoro",
    },
    breadth: {
        term: "Breadth",
        what: "How many different kinds of study you've done, rather than how much.",
        how: "Counts the families you've touched — focus sessions, quizzes, flashcards, mock exams, practice questions. Full marks at five.",
        not: "It isn't about how many subjects you cover. It's about not doing the same one thing every time.",
    },
    planning: {
        term: "Planning",
        what: "Whether you set things to do and then did them.",
        how: "Goals set and met, planned blocks kept, and preparation started before the week of the assessment.",
        see: "week_plan",
    },

    // ── Flashcards ──────────────────────────────────────────────────────
    sm2_rating: {
        term: "Again · Hard · Good · Easy",
        what: "How well you recalled the card, which decides when you see it next.",
        how: "Again sends it back today. Hard shortens the gap, Good keeps it growing, Easy stretches it further. Answer honestly — rating everything Easy just hides the cards you don't know.",
        see: "spaced_repetition",
    },
    weak_spot: {
        term: "Weak spot",
        what: "A card you keep failing, flagged so it can be pulled out separately.",
        how: "Set when a card has been rated Again enough times to stop looking like bad luck.",
        see: "weak_spots",
    },
    interval: {
        term: "Interval",
        what: "The gap the scheduler is currently leaving before it shows you this card again.",
        how: "It grows every time you recall the card and collapses when you don't. A long interval means the card has held up repeatedly, not that it's unimportant.",
    },
    due: {
        term: "Due",
        what: "The scheduler thinks today is the day this card is about to slip.",
        not: "Due doesn't mean forgotten. It means you're at the point where reviewing costs the least and does the most.",
    },
    at_risk: {
        term: "At risk",
        what: "Cards whose recall is projected to drop below reliable in the next seven days.",
        how: "Modelled from each card's own interval — a card crosses the line at roughly one and a half times the gap it was scheduled for. It's a projection from your review history, not a measurement of your memory.",
        see: "retention",
    },

    // ── Cognition ───────────────────────────────────────────────────────
    lapse_rate: {
        term: "Lapse rate",
        what: "The share of your reviews that came back as Again.",
        how: "A few lapses are how spacing is meant to work. A high rate means cards are being scheduled further out than they're holding.",
    },
    calibration: {
        term: "Calibration",
        what: "Whether how sure you felt matched how right you were.",
        how: "You rate confidence before the answer is marked, and the two are compared. Being sure and wrong is the one that costs marks; being unsure and right only costs revision time.",
        see: "calibration",
    },
    retention_score: {
        term: "Retention",
        what: "How much of a mind map came back when you rebuilt it from memory.",
        how: "The rebuilt map is compared against your real one. What's missing is the finding — that's the point of doing it closed-book.",
        see: "mindmap_recall",
    },
    node_confidence: {
        term: "How solid is it?",
        what: "Your own call on whether you could explain this node to somebody else.",
        how: "Marked shaky, getting it, or solid. It's what decides which parts of the map come through when you send it to recall practice.",
    },

    // ── Gamification ────────────────────────────────────────────────────
    xp: {
        term: "XP",
        what: "Points for studying, which drive your level and the XP leaderboard.",
        not: "XP measures how much you did, not how well you did it. Mastery is the part of your AcedIt ATAR that cares whether you were right.",
    },
    streak: {
        term: "Streak",
        what: "Consecutive days with at least one study session logged.",
        how: "One session is enough to keep it. It also feeds the consistency part of your AcedIt ATAR, which is the second-heaviest of the five.",
        see: "streak",
    },
};

// The five cognition axes already carry their own definitions, written where
// they're computed. Pulling them in beats retyping them here and letting the
// two drift.
for (const a of AXES) {
    TERMS[a.id] = {
        term: a.label,
        what: a.what,
        how: a.how || undefined,
        see: "cognition",
    };
}

export const TERM_IDS = Object.keys(TERMS);

/** Look up a term, tolerating the on-screen label as well as the id. */
export function termFor(key) {
    if (!key) return null;
    if (TERMS[key]) return TERMS[key];
    const k = String(key).toLowerCase().trim();
    return Object.values(TERMS).find(t => t.term.toLowerCase() === k) || null;
}
