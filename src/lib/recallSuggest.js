/**
 * recallSuggest — "what should I test?", answered from the student's own data.
 *
 * Active Recall's primary button used to be "Start with Default Questions",
 * which for an unspecified topic can only produce generic ones. The good path
 * — AI questions from your notes — was gated behind finding and uploading a
 * PDF. So the fast path was useless and the useful path was slow.
 *
 * Everything needed to answer the question properly was already being
 * computed elsewhere in the app and never read here: which topics are costing
 * marks, which cards have fallen out of reach, and what's being assessed soon.
 *
 * The second half of this file solves the other end of it. A student's own
 * flashcards ARE question/answer pairs, and their mind map nodes are terms and
 * the relationships between them. Both make better recall material than a PDF
 * they have to go and find, and both are already in the database.
 */
import { retentionOutlook } from "@/lib/retention";
import { weakTopicsFrom } from "@/lib/weakTopics";

const DAY = 86400000;

export const SUGGESTION_KIND = {
    weak:       { id: "weak",       rank: 1, label: "Costing you marks" },
    assessment: { id: "assessment", rank: 2, label: "Assessed soon" },
    slipped:    { id: "slipped",    rank: 3, label: "Slipping" },
    recent:     { id: "recent",     rank: 4, label: "Picked up again" },
};

/**
 * Ranked topics worth testing, each carrying the evidence that put it there.
 *
 * Ordered by what it costs to leave alone, not by what's easiest to generate
 * questions for. Returns [] rather than filler when there's nothing to go on —
 * a suggestion with no reason behind it is exactly the "default questions"
 * problem in a new hat.
 */
export function suggestTopics({
    flashcards = [], assessments = [], techniques = [], now = Date.now(), limit = 4,
} = {}) {
    const out = [];
    const seen = new Set();
    const key = (subject, topic) => `${subject || ""}:::${(topic || "").toLowerCase()}`;
    const push = (s) => {
        const k = key(s.subject, s.topic);
        if (!s.topic || seen.has(k)) return;
        seen.add(k);
        out.push(s);
    };

    // 1. Topics whose reviews keep failing. The clearest signal the app has
    //    that something is genuinely not understood.
    for (const t of weakTopicsFrom(flashcards)) {
        push({
            kind: SUGGESTION_KIND.weak,
            subject: t.subject,
            topic: t.topic,
            why: t.missRate != null
                ? `${t.missRate}% of your reviews on this missed`
                : `${t.weakCards} card${t.weakCards === 1 ? "" : "s"} flagged as a weak spot`,
            evidence: `${t.cards} card${t.cards === 1 ? "" : "s"}${t.reviews ? ` · ${t.reviews} reviews` : ""}`,
            cards: t.cards,
        });
    }

    // 2. Anything assessed inside three weeks, soonest first.
    const soon = (assessments || [])
        .filter(a => a && !a.is_completed && a.due_date)
        .map(a => ({ ...a, days: Math.round((Date.parse(a.due_date) - now) / DAY) }))
        .filter(a => Number.isFinite(a.days) && a.days >= 0 && a.days <= 21)
        .sort((a, b) => a.days - b.days);
    for (const a of soon) {
        push({
            kind: SUGGESTION_KIND.assessment,
            subject: a.subject_name,
            topic: a.topic || a.title,
            why: a.days === 0 ? "It's today" : a.days === 1 ? "It's tomorrow" : `In ${a.days} days`,
            evidence: a.assessment_type ? `${a.assessment_type} · ${a.due_date}` : a.due_date,
            urgent: a.days <= 7,
        });
    }

    // 3. Topics whose cards have fallen through the recall floor. Different
    //    from "weak": these were known and are being lost.
    const outlook = retentionOutlook(flashcards, { days: 7, now });
    for (const s of outlook.subjects) {
        for (const topic of s.topics.slice(0, 2)) {
            push({
                kind: SUGGESTION_KIND.slipped,
                subject: s.subject,
                topic,
                why: s.slipping > 0
                    ? `${s.slipping} card${s.slipping === 1 ? "" : "s"} already past reliable recall`
                    : `${s.falling} card${s.falling === 1 ? "" : "s"} drop out of reach this week`,
                evidence: `${s.total} at risk in ${s.subject}`,
            });
        }
    }

    // 4. Something they've just been working on — the cheapest possible win,
    //    and the only one that needs no cards at all.
    const recent = [...(techniques || [])]
        .filter(t => t?.topic && t.topic !== "Focus Session")
        .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    for (const t of recent.slice(0, 3)) {
        push({
            kind: SUGGESTION_KIND.recent,
            subject: t.subject,
            topic: t.topic,
            why: "You studied this recently — test whether it stuck",
            evidence: t.date || "",
        });
    }

    return out
        .sort((a, b) => (a.kind.rank - b.kind.rank) || ((b.urgent ? 1 : 0) - (a.urgent ? 1 : 0)))
        .slice(0, limit);
}

/**
 * Questions built from the student's own flashcards.
 *
 * A card is already a question and its answer, so this needs no model call, no
 * upload and no wait. It's also material they've chosen, which beats anything
 * generated about a topic name.
 *
 * Cards that have slipped come first: the point of testing is to find what's
 * gone, and starting with what the scheduler already believes is shaky finds
 * it faster.
 */
export function questionsFromCards(flashcards = [], { subject, topic, limit = 8, now = Date.now() } = {}) {
    const norm = (v) => String(v || "").trim().toLowerCase();
    const pool = (flashcards || []).filter(c =>
        c && c.is_active !== false && c.question && c.answer
        && (!subject || norm(c.subject_name) === norm(subject))
        && (!topic || norm(c.topic) === norm(topic)));

    const outlook = retentionOutlook(pool, { days: 7, now });
    const atRisk = outlook.atRisk;

    return pool
        // Weak spots first, then longest since seen — the cards most likely to
        // reveal something.
        .map(c => ({
            c,
            weak: c.is_weak_spot ? 1 : 0,
            since: Date.parse(c.last_reviewed_date || c.created_date || "") || 0,
        }))
        .sort((a, b) => (b.weak - a.weak) || (a.since - b.since))
        .slice(0, limit)
        .map(({ c }, i) => ({
            id: c.id || `card-${i}`,
            question: c.question,
            // The card's own answer is the mark scheme. Nothing to invent.
            expected: c.answer,
            source: "flashcard",
            subject: c.subject_name || subject || null,
            topic: c.topic || topic || null,
        }))
        .map(q => ({ ...q, poolSize: pool.length, atRisk }));
}

/**
 * Questions built from a mind map.
 *
 * A labelled link is the most valuable thing on a map — "the Calvin cycle USES
 * THE ATP" is a relationship the student wrote down themselves — so those
 * become the questions. An unlabelled box is just a word, and asking "what is
 * Stroma?" from a map that never said is how you generate a question with no
 * markable answer.
 */
export function questionsFromMap(map, { limit = 8 } = {}) {
    if (!map?.nodes?.length) return [];
    const byId = new Map(map.nodes.map(n => [n.id, n]));
    const out = [];

    for (const n of map.nodes) {
        if (out.length >= limit) break;
        const parent = n.parent ? byId.get(n.parent) : null;
        if (n.link && parent) {
            out.push({
                id: `link-${n.id}`,
                question: `How does ${n.text} relate to ${parent.text}?`,
                expected: n.link,
                source: "mindmap",
                subject: map.subject_name || null,
                topic: map.topic || map.title || null,
            });
        } else if (n.note) {
            out.push({
                id: `note-${n.id}`,
                question: `What do you need to know about ${n.text}?`,
                expected: n.note,
                source: "mindmap",
                subject: map.subject_name || null,
                topic: map.topic || map.title || null,
            });
        }
    }

    for (const e of map.cross_links || map.crossLinks || []) {
        if (out.length >= limit) break;
        if (!e?.label) continue;
        const a = byId.get(e.from), b = byId.get(e.to);
        if (!a || !b) continue;
        out.push({
            id: `x-${e.id || `${e.from}${e.to}`}`,
            question: `What is the connection between ${a.text} and ${b.text}?`,
            expected: e.label,
            source: "mindmap",
            subject: map.subject_name || null,
            topic: map.topic || map.title || null,
        });
    }
    return out.slice(0, limit);
}

/**
 * Everything available for a topic without asking the student for anything.
 * The UI uses this to say "12 of your own cards cover this" BEFORE they commit
 * to a session, rather than starting one and finding out it's empty.
 */
export function ownMaterial({ flashcards = [], maps = [], subject, topic, limit = 20 } = {}) {
    const cards = questionsFromCards(flashcards, { subject, topic, limit });
    const norm = (v) => String(v || "").trim().toLowerCase();
    const map = (maps || []).find(m =>
        m && (!subject || norm(m.subject_name) === norm(subject))
        && (!topic || norm(m.topic) === norm(topic) || norm(m.title) === norm(topic)));
    const fromMap = map ? questionsFromMap(map, { limit }) : [];
    return {
        cards,
        fromMap,
        total: cards.length + fromMap.length,
        hasEnough: cards.length + fromMap.length >= 3,
    };
}
