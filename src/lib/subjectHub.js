/**
 * subjectHub — everything the app knows about ONE subject, in one shape.
 *
 * ─── Why this exists ────────────────────────────────────────────────────────
 * A student's work on a subject was scattered across six pages and gathered
 * nowhere: the decks on Review, the quizzes on Quizzes, the dropped criteria
 * on /MistakeBank, the hours in two log tables, the SAC on the planner. The
 * Subjects page — the one place named after the thing — showed VCAA metadata
 * and a "Details" link, so it was a catalogue you opened once at signup.
 *
 * Everything here is DERIVED from rows the app already loads. Nothing new is
 * stored, so nothing here can go stale, double up, or disagree with the screen
 * it came from — the same rule `redoQueue` follows in quizInsight.
 *
 * ─── Two facts the app shipped and had never read ───────────────────────────
 * `vceSubjects.js` carries `assessment_structure` (the real VCAA mark split:
 * Exam 2 is 44% of Methods, Unit 3 SAC is 20%) and `key_skills` (the areas of
 * study). Neither was referenced anywhere in the codebase. They are the two
 * things a student cannot work out for themselves and cannot get from their
 * own data, which is exactly what a subject page should be adding.
 */

import { isDue, isNew } from "@/lib/due";
import { cardMastery } from "@/lib/mastery";
import { effectiveScore } from "@/lib/quizDeck";
import { isRetryAttempt } from "@/lib/quizInsight";
import { fixState } from "@/lib/mistakeBank";
import { dayKey, weekStart } from "@/lib/studyLog";

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const median = (xs) => {
    if (!xs.length) return 0;
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

// ─── The mark split ─────────────────────────────────────────────────────────

/**
 * The subject's assessments, heaviest first, with their share of the study
 * score.
 *
 * WHY HEAVIEST FIRST: this is the whole point of surfacing it. A student
 * revising for a 14% SAC the week before a 44% exam is making a bad trade and
 * has no way to know it — the weights are in the study design, which nobody
 * reads. Sorted, the list answers "what is actually worth revising" before
 * anything else on the page does.
 *
 * The percentages are VCAA's and are NOT renormalised: if a study design's
 * components do not add to 100 that is a fact about the data, and quietly
 * scaling them to fit would invent numbers. `total` is reported so a caller
 * can say so rather than pretending.
 */
export function markSplit(fullSubject) {
    const rows = Array.isArray(fullSubject?.assessment_structure)
        ? fullSubject.assessment_structure
        : [];
    const parts = rows
        .map((r) => ({
            component: r?.component || "",
            description: r?.description || "",
            percentage: Number(r?.percentage) || 0,
        }))
        .filter((r) => r.component && r.percentage > 0)
        .sort((a, b) => b.percentage - a.percentage);

    return {
        parts,
        total: parts.reduce((sum, p) => sum + p.percentage, 0),
        // The single assessment carrying the most marks. Null rather than a
        // guess when the subject has no structure in the catalogue — a custom
        // subject the student created has none, and inventing one would be
        // the app making up a curriculum.
        heaviest: parts[0] || null,
    };
}

// ─── Coverage against the study design ──────────────────────────────────────

/**
 * Which areas of study this student's own material actually touches.
 *
 * ─── Matched by NAME, and it refuses rather than guesses ────────────────────
 * There is no tagging in this app and adding some would mean a new field, a
 * tagging flow and a backfill over everything that already exists. So this
 * matches the topics a student has ALREADY written — deck topics, quiz titles
 * — against the subject's `key_skills`, on normalised containment either way
 * ("Calculus" covers "calculus revision", "vectors and matrices" covers
 * "Vectors").
 *
 * A topic that matches nothing is reported as `unmatched`, not dropped and not
 * forced onto the nearest skill. That distinction is the whole reason this is
 * trustworthy: "you have never studied Vectors" is only worth printing if the
 * page can also admit it did not recognise four of your decks. Crediting an
 * area a student has not covered is the one error this cannot make — it would
 * send them into a SAC believing they had done the work.
 */
export function coverage(keySkills = [], topics = []) {
    const skills = (Array.isArray(keySkills) ? keySkills : []).filter(Boolean);
    const seen = [...new Set((Array.isArray(topics) ? topics : []).filter(Boolean))];

    // Containment in EITHER direction: a deck called "Calculus revision"
    // covers the skill "Calculus", and a deck called "Vectors" covers the
    // skill "Vectors and matrices". Both are the same student saying the same
    // thing, and requiring one direction only would miss half of them.
    const hits = (skill) => seen.filter((t) => {
        const a = norm(skill);
        const b = norm(t);
        if (!a || !b) return false;
        return a === b || a.includes(b) || b.includes(a);
    });

    const areas = skills.map((skill) => {
        const matched = hits(skill);
        return { skill, covered: matched.length > 0, topics: matched };
    });

    const matchedTopics = new Set(areas.flatMap((a) => a.topics));
    return {
        areas,
        covered: areas.filter((a) => a.covered).length,
        total: areas.length,
        // Areas with nothing against them, in the study design's own order —
        // which is roughly teaching order, so the first gap is usually the
        // oldest one.
        untouched: areas.filter((a) => !a.covered).map((a) => a.skill),
        // Said out loud rather than swept up. See the note above.
        unmatched: seen.filter((t) => !matchedTopics.has(t)),
    };
}

// ─── One subject's own numbers ──────────────────────────────────────────────

/**
 * The student's actual work in a subject: decks, cards, review load, quizzes,
 * outstanding mistakes, hours, and the next thing on the calendar.
 *
 * Every input is a list the app already loads. Flashcards are expected to be
 * DECK CARDS (the mistake bank filtered out by `deckCards`) — the bank is
 * counted separately as mistakes, and counting it twice would inflate both.
 */
export function subjectStats(subjectName, {
    flashcards = [], quizzes = [], attempts = [], bankCards = [],
    events = [], assessments = [], now = new Date(),
} = {}) {
    const name = String(subjectName || "");
    const key = norm(name);
    const sameSubject = (v) => norm(v) === key;

    // ── Cards ──────────────────────────────────────────────────────────────
    const cards = flashcards.filter((c) => sameSubject(c?.subject_name));
    const due = cards.filter((c) => isDue(c, now) || isNew(c)).length;
    const decks = new Set(cards.map((c) => c?.topic).filter(Boolean));
    const mastery = cards.length
        ? Math.round(cards.reduce((sum, c) => sum + cardMastery(c), 0) / cards.length)
        : 0;

    // ── Quizzes. Retries count as work and never as a measurement, the same
    //    split every other reader of this data makes. ────────────────────────
    const quizIds = new Set(quizzes.filter((q) => sameSubject(q?.subject)).map((q) => q?.id));
    const sits = attempts
        .filter((a) => quizIds.has(a?.quiz_id) && !isRetryAttempt(a))
        .sort((a, b) => new Date(b?.created_date || 0) - new Date(a?.created_date || 0));
    const scored = sits.map(effectiveScore).filter((s) => typeof s === "number" && Number.isFinite(s));

    // ── Mistakes still costing marks ───────────────────────────────────────
    const mistakes = bankCards
        .filter((c) => sameSubject(c?.subject_name))
        .filter((c) => fixState(c) !== "fixed").length;

    // ── Hours. The median of past weeks, current week excluded: it is
    //    half-finished, and a Monday morning would drag it toward nothing. ───
    // Bucketed with studyLog's own `weekStart` and `dayKey`. Rolling the
    // Monday maths again here would be a second copy of the week, and `dayKey`
    // exists specifically because `toISOString` is UTC — a local midnight in a
    // positive-offset zone comes back as the previous day.
    const rows = events.filter((e) => sameSubject(e?.subject));
    const byWeek = new Map();
    rows.forEach((e) => {
        const d = new Date(`${String(e.day).slice(0, 10)}T00:00:00`);
        if (Number.isNaN(d.getTime())) return;
        const k = dayKey(weekStart(d));
        byWeek.set(k, (byWeek.get(k) || 0) + (Number(e.minutes) || 0));
    });
    const thisKey = dayKey(weekStart(now));
    const priorWeeks = [...byWeek.entries()].filter(([k]) => k < thisKey).map(([, v]) => v);

    // ── The next assessment, if one is on the calendar ─────────────────────
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const next = assessments
        .filter((a) => sameSubject(a?.subject_name) && !a?.is_completed && a?.due_date)
        .map((a) => ({ ...a, at: new Date(`${String(a.due_date).slice(0, 10)}T00:00:00`) }))
        .filter((a) => !Number.isNaN(a.at.getTime()) && a.at >= today)
        .sort((a, b) => a.at - b.at)[0] || null;

    return {
        subject: name,
        cards: cards.length,
        decks: decks.size,
        due,
        mastery,
        topics: [...decks],
        quizzes: quizIds.size,
        sits: sits.length,
        // Null, not zero: a quiz nobody has sat is a different thing from one
        // somebody scored nothing on.
        bestScore: scored.length ? Math.max(...scored) : null,
        lastScore: scored.length ? scored[0] : null,
        mistakes,
        weekMinutes: byWeek.get(thisKey) || 0,
        usualMinutes: priorWeeks.length ? median(priorWeeks) : null,
        nextAssessment: next
            ? { ...next, daysAway: Math.round((next.at - today) / 86400000) }
            : null,
    };
}

/**
 * The one line the subject leads with.
 *
 * ORDER IS BY WHAT IT COSTS, not by what is easiest to say. A SAC inside a
 * fortnight beats everything, then marks you are actively dropping, then the
 * review pile, then a gap in the course, then nothing-to-report. Each branch
 * returns null rather than a placeholder when its number is not real — the
 * same rule Today's Play keeps about its rail.
 */
export const SOON_DAYS = 14;

export function subjectLead(stats, cov, split) {
    if (!stats) return null;

    if (stats.nextAssessment && stats.nextAssessment.daysAway <= SOON_DAYS) {
        const d = stats.nextAssessment.daysAway;
        return {
            kind: "assessment",
            title: d === 0 ? "Assessment today" : d === 1 ? "Assessment tomorrow" : `Assessment in ${d} days`,
            detail: stats.nextAssessment.title || stats.nextAssessment.assessment_type || "On your calendar",
        };
    }
    if (stats.mistakes > 0) {
        return {
            kind: "mistakes",
            title: `${stats.mistakes} mistake${stats.mistakes === 1 ? "" : "s"} still costing marks`,
            detail: "Drill them before they show up in a SAC.",
        };
    }
    if (stats.due > 0) {
        return {
            kind: "due",
            title: `${stats.due} card${stats.due === 1 ? "" : "s"} ready`,
            detail: "The pile only grows while you leave it.",
        };
    }
    if (cov && cov.total > 0 && cov.untouched.length > 0) {
        return {
            kind: "gap",
            title: `${cov.untouched.length} of ${cov.total} areas untouched`,
            detail: `Nothing yet on ${cov.untouched[0]}.`,
        };
    }
    if (split?.heaviest) {
        return {
            kind: "weight",
            title: `${split.heaviest.component} is ${split.heaviest.percentage}% of this subject`,
            detail: "The biggest single thing you are marked on.",
        };
    }
    return null;
}
