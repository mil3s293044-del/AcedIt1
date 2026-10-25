/**
 * revision — one folder per SAC, one per subject's exam, and everything the app
 * knows that belongs inside it.
 *
 * ─── Why a folder ───────────────────────────────────────────────────────────
 * The week before a SAC a student asks one question — "where am I with this?"
 * — and the answer was spread over five screens that each knew part of it: the
 * mistakes on the bank, the model answers on Quizzes, the weak cards on Study,
 * the dates on the planner, the course areas on the subject page. None of them
 * knew which of those things were ON THE SAC, because nothing had ever said.
 *
 * So a folder is a SAC (a `subject_assessments` row the planner already has)
 * plus the one fact only the student can supply: which of their topics it
 * covers. With that, everything in those topics is in the folder — derived on
 * read, never copied in, so it cannot go stale or disagree with the screen it
 * came from. The exam folder is the same thing with no narrowing: the whole
 * course.
 *
 * ─── What is stored, and where ──────────────────────────────────────────────
 * Two things, both on rows that already exist:
 *   - the scope (`topics`) and the key-knowledge checklist (`points`) on the
 *     SAC row's `extra.revision`;
 *   - the exam folder's checklist on the `user_subjects` row's `extra.revision`.
 * Everything else — which mistakes, which answers, which cards, whether a point
 * has been PROVED — is computed from rows the page loads anyway.
 *
 * ─── Said and proved ────────────────────────────────────────────────────────
 * A key-knowledge point carries the student's own rating (got it / shaky / not
 * yet), and separately what a marked check showed. Both are worth having and
 * they are different claims: the first is what they believe, the second is
 * what an assessor would see. The readiness bar draws them as two layers
 * rather than adding them up as one, because "you said you had 9, 4 held up"
 * is the most useful sentence a revision screen can print.
 */
import { fixState, isBankCard, isRetired } from "@/lib/mistakeBank";
import { isAnswerCard, exemplarMeta, answerState, isRetiredAnswer } from "@/lib/answerBank";
import { recallAt, isLearned, RISK_FLOOR } from "@/lib/retention";
import { shortSubject } from "@/lib/subjectShort";

const str = (v) => String(v ?? "").trim();

/** Topic identity: case, punctuation and spacing do not make two topics. */
export const normTopic = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const sameSubject = (a, b) => normTopic(a) === normTopic(b) && normTopic(a) !== "";

/** Topic strings that are markers, not topics. */
const NOT_TOPICS = new Set(["mistake bank", "answer bank", "general", "no topic"]);

// ─── Folders ────────────────────────────────────────────────────────────────

export const SAC_PREFIX = "sac:";
export const EXAM_PREFIX = "exam:";
export const sacKey = (id) => `${SAC_PREFIX}${id}`;
export const examKey = (subject) => `${EXAM_PREFIX}${normTopic(subject)}`;

/** Calendar days from today to a due date, LOCAL — `toISOString` is UTC. */
export function daysUntil(due, now = new Date()) {
    const d = str(due).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
    const [y, m, day] = d.split("-").map(Number);
    const at = new Date(y, m - 1, day);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((at - today) / 86400000);
}

const revisionOf = (row) => (row?.extra && typeof row.extra === "object" ? row.extra.revision || {} : {});

/**
 * Every folder a student has, in the order they are worked through.
 *
 *   upcoming SACs, soonest first — the deadline is the whole reason to be here
 *   one exam folder per subject they take, the whole course
 *   past SACs, most recent first, kept apart: a finished SAC's mistakes are
 *   still mistakes, but it is no longer what to revise for
 *
 * A SAC with no subject has nothing to gather and is skipped rather than
 * shown as an empty folder.
 */
export function foldersFor({ assessments = [], userSubjects = [], now = new Date() } = {}) {
    const sacs = [];
    const past = [];
    for (const a of assessments || []) {
        if (!a?.id || !str(a.subject_name)) continue;
        const rev = revisionOf(a);
        const days = daysUntil(a.due_date, now);
        const folder = {
            key: sacKey(a.id),
            kind: "sac",
            id: a.id,
            subject: str(a.subject_name),
            title: str(a.title) || str(a.assessment_type) || "SAC",
            type: str(a.assessment_type),
            due: str(a.due_date).slice(0, 10) || null,
            daysAway: days,
            topics: cleanTopics(rev.topics),
            points: cleanPoints(rev.points),
            row: a,
        };
        if (a.is_completed || (days != null && days < 0)) past.push(folder);
        else sacs.push(folder);
    }
    sacs.sort((x, y) => (x.daysAway ?? 9999) - (y.daysAway ?? 9999) || x.title.localeCompare(y.title));
    past.sort((x, y) => (y.daysAway ?? -9999) - (x.daysAway ?? -9999));

    const seen = new Set();
    const exams = [];
    for (const us of userSubjects || []) {
        const subject = str(us?.subject_name);
        if (!subject || us?.is_active === false) continue;
        const k = normTopic(subject);
        if (seen.has(k)) continue;
        seen.add(k);
        exams.push({
            key: examKey(subject),
            kind: "exam",
            id: us.id || null,
            subject,
            title: `${shortSubject(subject)} exam`,
            type: "Exam",
            due: null,
            daysAway: null,
            // The whole course, always. An exam folder that could be narrowed
            // would be a second SAC folder with a misleading name.
            topics: [],
            points: cleanPoints(revisionOf(us).points),
            row: us,
        });
    }
    exams.sort((x, y) => x.subject.localeCompare(y.subject));
    return { sacs, exams, past, all: [...sacs, ...exams, ...past] };
}

export const findFolder = (folders, key) => (folders?.all || []).find((f) => f.key === key) || null;

const cleanTopics = (topics) => {
    const out = []; const seen = new Set();
    for (const t of Array.isArray(topics) ? topics : []) {
        const s = str(t); const k = normTopic(s);
        if (!s || !k || seen.has(k)) continue;
        seen.add(k); out.push(s);
    }
    return out;
};

// ─── Topics ─────────────────────────────────────────────────────────────────

/**
 * The topic an item belongs to. Every source spells it its own way and in its
 * own field, so this is the one place that knows which:
 *   a deck card         its `topic` (the deck)
 *   a quiz              its title
 *   a banked mistake    `extra.mistake.topic`, else the quiz it came from
 *   a saved answer      `extra.exemplar.topic`, else the quiz it came from
 *   a session row       its `topic`
 *
 * A banked mistake's fallback is NOT `mistakeMeta().topic`, which falls back to
 * the clipped question for display. A question is not a topic, and matching on
 * one would put a mistake in a folder because its stem happened to contain a
 * topic's name.
 */
export function topicOf(item, { quizById } = {}) {
    if (!item) return "";
    if (isBankCard(item)) {
        const t = str(item?.extra?.mistake?.topic);
        if (t) return t;
        const q = quizById?.get(str(item?.extra?.mistake?.source?.quiz_id));
        return str(q?.title);
    }
    if (isAnswerCard(item)) {
        const m = exemplarMeta(item);
        if (m.topic) return m.topic;
        return str(quizById?.get(m.source?.quizId)?.title);
    }
    if (Array.isArray(item.questions) && "title" in item) return str(item.title);
    return str(item.topic);
}

/** The subject an item belongs to, by the same per-source rule. */
export function subjectOf(item, { quizById } = {}) {
    if (!item) return "";
    if (Array.isArray(item.questions) && "title" in item) return str(item.subject);
    if (item.quiz_id && quizById) return str(quizById.get(item.quiz_id)?.subject);
    return str(item.subject_name || item.subject);
}

/**
 * The topics a student could put a folder on, for one subject — their OWN, off
 * every source, most-used first. Never the study design's names: a folder on a
 * topic they have no material in would gather nothing and look broken.
 */
export function topicOptions(subject, { flashcards = [], quizzes = [], bankCards = [], answerCards = [], sessions = [] } = {}) {
    const quizById = new Map((quizzes || []).map((q) => [q.id, q]));
    const tally = new Map();
    const add = (item, kind) => {
        if (!sameSubject(subjectOf(item, { quizById }), subject)) return;
        const t = topicOf(item, { quizById });
        const k = normTopic(t);
        if (!k || NOT_TOPICS.has(k)) return;
        if (!tally.has(k)) tally.set(k, { topic: t, count: 0, kinds: new Set() });
        const row = tally.get(k);
        row.count += 1;
        row.kinds.add(kind);
    };
    (flashcards || []).forEach((c) => add(c, "cards"));
    (quizzes || []).forEach((q) => add(q, "quizzes"));
    (bankCards || []).forEach((c) => add(c, "mistakes"));
    (answerCards || []).forEach((c) => add(c, "answers"));
    (sessions || []).forEach((s) => add(s, "sessions"));
    return [...tally.values()]
        .map((r) => ({ topic: r.topic, count: r.count, kinds: [...r.kinds] }))
        .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic));
}

/**
 * Topics whose name appears in the SAC's own title or description — offered as
 * a SUGGESTION in the scope picker, never applied on their own. The student
 * ticks them; a folder that silently decided what a SAC was on would be the
 * guess this file refuses.
 */
export function suggestedTopics(folder, options = []) {
    const hay = ` ${normTopic(`${folder?.title || ""} ${folder?.row?.description || ""}`)} `;
    return options
        .filter((o) => {
            const k = normTopic(o.topic);
            return k.length >= 4 && hay.includes(` ${k} `);
        })
        .map((o) => o.topic);
}

/** Does an item in this subject and topic belong in the folder? */
export function inFolder(folder, subject, topic) {
    if (!folder || !sameSubject(subject, folder.subject)) return false;
    if (!folder.topics?.length) return true;
    const want = new Set(folder.topics.map(normTopic));
    return want.has(normTopic(topic));
}

// ─── What is in a folder ────────────────────────────────────────────────────

/** A deck card that is slipping: learned, and predicted recall under the floor, or flagged. */
export function isWeakCard(card, now = Date.now()) {
    if (!card || card.retired_at) return false;
    if (card.is_weak_spot) return true;
    if (!isLearned(card)) return false;
    return recallAt(card, now) < RISK_FLOOR;
}

/**
 * Everything in one folder, gathered off rows the page already holds.
 *
 * `flashcards` are DECK cards (`deckCards` already applied). `redo` is the
 * redo queue, computed once for the whole page — it needs every attempt, and
 * recomputing it per folder would be the same walk five times.
 */
export function folderContents(folder, {
    flashcards = [], bankCards = [], answerCards = [], quizzes = [], attempts = [],
    redo = [], legacySaved = [], isReady = () => false, now = Date.now(),
} = {}) {
    const quizById = new Map((quizzes || []).map((q) => [q.id, q]));
    const here = (item) => inFolder(folder, subjectOf(item, { quizById }), topicOf(item, { quizById }));

    const mistakes = (bankCards || []).filter((c) => isBankCard(c) && !isRetired(c) && c.is_active !== false && here(c));
    const answers = (answerCards || []).filter((c) => isAnswerCard(c) && !isRetiredAnswer(c) && c.is_active !== false && here(c));
    const cards = (flashcards || []).filter(here);
    const weak = cards.filter((c) => isWeakCard(c, now));
    const quizzesIn = (quizzes || []).filter(here);
    const quizIds = new Set(quizzesIn.map((q) => q.id));
    const redoIn = (redo || []).filter((r) => quizIds.has(r.quizId));
    const legacy = (legacySaved || []).filter((row) =>
        inFolder(folder, row?.subject_name, row?.topic || row?.input_data?.quiz_title));

    return {
        mistakes,
        answers,
        cards,
        weak,
        quizzes: quizzesIn,
        attempts: (attempts || []).filter((a) => quizIds.has(a.quiz_id)),
        redo: redoIn,
        legacy,
        ready: {
            mistakes: mistakes.filter(isReady),
            answers: answers.filter(isReady),
            cards: cards.filter(isReady),
        },
    };
}

// ─── Key knowledge ──────────────────────────────────────────────────────────

/** A checklist longer than this is a study design, not a SAC. */
export const POINTS_MAX = 60;
/** How many points one check asks about — one question each. */
export const CHECK_MAX = 6;

export const RATINGS = [
    { id: "got",     label: "Got it" },
    { id: "shaky",   label: "Shaky" },
    { id: "not_yet", label: "Not yet" },
];
const RATING_IDS = new Set(RATINGS.map((r) => r.id));

/** A stable id from the text, so the same point pasted twice is one point. */
export function pointId(text) {
    let h = 2166136261;
    for (const ch of normTopic(text)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    return `p${h.toString(36)}`;
}

function cleanPoints(points) {
    const out = []; const seen = new Set();
    for (const p of Array.isArray(points) ? points : []) {
        const text = str(p?.text);
        if (!text) continue;
        const id = str(p?.id) || pointId(text);
        if (seen.has(id)) continue;
        seen.add(id);
        out.push({
            id,
            text,
            from: ["outline", "suggested", "typed"].includes(p?.from) ? p.from : "typed",
            said: RATING_IDS.has(p?.said) ? p.said : null,
            said_at: str(p?.said_at) || null,
        });
    }
    return out.slice(0, POINTS_MAX);
}

/**
 * A pasted outline, as dot points.
 *
 * Teachers' SAC outlines arrive as bullets, numbers, dashes or plain lines, and
 * a dot point that wrapped in the source arrives as two lines. So: strip every
 * bullet shape, glue a line that starts in lower case onto the one before it
 * (that is a wrap, not a new point), and drop headings — a line ending in a
 * colon introduces points rather than being one.
 */
export function splitOutline(text) {
    const lines = String(text || "").replace(/\r/g, "").split("\n");
    const bullet = /^\s*(?:[-–—•·●○▪■*+>]+|\(?\d{1,2}[.)]|\(?[a-z][.)]|\(?[ivx]{1,4}[.)])\s+/i;
    const out = [];
    for (const raw of lines) {
        const had = bullet.test(raw);
        const line = raw.replace(bullet, "").replace(/\s+/g, " ").trim();
        if (!line) continue;
        if (/:$/.test(line) && line.split(" ").length <= 8) continue;
        // A WRAP, not a new point, only when the line before plainly did not
        // finish: it ends on a comma or a joining word, or it is as long as a
        // wrapped line is. A plain list of short lower-case lines is a list —
        // gluing every line that starts in lower case turned one into a single
        // point sixty items long.
        const prev = out[out.length - 1];
        const unfinished = prev && (/,$/.test(prev)
            || /\b(and|or|of|the|to|in|for|with|between|including|a|an)$/i.test(prev)
            || (prev.length >= 60 && !/[.;:!?)]$/.test(prev)));
        if (prev && !had && /^[a-z(]/.test(line) && unfinished) {
            out[out.length - 1] = `${prev} ${line}`;
            continue;
        }
        out.push(line);
    }
    const seen = new Set();
    return out
        .map((s) => s.replace(/[;,]$/, "").trim())
        .filter((s) => s.length >= 3)
        .filter((s) => { const k = normTopic(s); if (!k || seen.has(k)) return false; seen.add(k); return true; })
        .slice(0, POINTS_MAX);
}

/** New texts added to a checklist; what is already there is kept, not doubled. */
export function mergePoints(points = [], texts = [], from = "typed") {
    const have = new Set(points.map((p) => p.id));
    const added = [];
    for (const t of texts) {
        const text = str(t);
        if (!text) continue;
        const id = pointId(text);
        if (have.has(id)) continue;
        have.add(id);
        added.push({ id, text, from, said: null, said_at: null });
    }
    const next = [...points, ...added].slice(0, POINTS_MAX);
    return { points: next, added: added.filter((p) => next.includes(p)).length };
}

export function ratePoint(points = [], id, said, now = new Date()) {
    return points.map((p) => (p.id === id
        ? { ...p, said: RATING_IDS.has(said) && p.said !== said ? said : null, said_at: now.toISOString() }
        : p));
}
export const removePoint = (points = [], id) => points.filter((p) => p.id !== id);
export function editPoint(points = [], id, text) {
    const t = str(text);
    if (!t) return points;
    return points.map((p) => (p.id === id ? { ...p, text: t } : p));
}

/** The patch that writes a folder's revision back onto its row, keeping everything else in `extra`. */
export function revisionPatch(row, next = {}) {
    const extra = row?.extra && typeof row.extra === "object" ? row.extra : {};
    return { extra: { ...extra, revision: { ...(extra.revision || {}), ...next } } };
}

// ─── Proof ──────────────────────────────────────────────────────────────────

/**
 * The quiz row a key-knowledge check is saved as. One question per point, and
 * `extra.revision_check.points[i]` is the point question i is about — which is
 * the only thing that lets a marked attempt be read back as proof per point.
 */
export function checkQuiz({ folder, points = [], questions = [] }) {
    const n = Math.min(points.length, questions.length);
    return {
        title: `${folder?.title || "Key knowledge"} · knowledge check`,
        subject: folder?.subject || "",
        questions: questions.slice(0, n),
        difficulty: "Medium",
        category: "subject_content",
        extra: { revision_check: { folder: folder?.key || null, points: points.slice(0, n).map((p) => p.id) } },
    };
}

/**
 * Pair what the model wrote with the points it was asked about.
 *
 * Each generated question carries the number of the point it is on. Read back
 * by that number when the numbers are usable (in range, no point twice); only
 * when NONE are usable is position the fallback. A question credited to the
 * wrong point would let a student "prove" a dot point by answering another one
 * — the exact thing the check exists to stop. A point the model skipped simply
 * gets no question; a question about no point is dropped.
 */
export function alignCheck(points = [], questions = []) {
    const n = points.length;
    const numbered = questions.map((q) => Number(q?.point));
    const usable = numbered.filter((x, i) => Number.isInteger(x) && x >= 1 && x <= n && numbered.indexOf(x) === i);
    if (usable.length) {
        const pairs = [];
        questions.forEach((q, i) => {
            const x = numbered[i];
            if (Number.isInteger(x) && x >= 1 && x <= n && numbered.indexOf(x) === i) pairs.push([x - 1, q]);
        });
        pairs.sort((a, b) => a[0] - b[0]);
        return { points: pairs.map(([k]) => points[k]), questions: pairs.map(([, q]) => q) };
    }
    const k = Math.min(n, questions.length);
    return { points: points.slice(0, k), questions: questions.slice(0, k) };
}

/**
 * What the latest marked check said about each point. Derived from the
 * attempts, never stored on the point: a stored verdict is one more copy of a
 * mark to drift from the attempt it came from.
 *
 * PROVED means full marks on that point's question, and nothing less. A SAC
 * gives no partial credit for knowing most of a dot point, and calling 2 of 3
 * "proved" would be the flattery the mistake bank's case gate refuses.
 */
export function pointProof(quizzes = [], attempts = []) {
    const byQuiz = new Map();
    for (const q of quizzes || []) {
        const ids = q?.extra?.revision_check?.points;
        if (Array.isArray(ids) && ids.length) byQuiz.set(q.id, ids);
    }
    const proof = new Map();
    const sorted = [...(attempts || [])]
        .filter((a) => byQuiz.has(a?.quiz_id))
        .sort((a, b) => Date.parse(b?.created_date || b?.date || 0) - Date.parse(a?.created_date || a?.date || 0));
    for (const a of sorted) {
        const ids = byQuiz.get(a.quiz_id);
        const results = Array.isArray(a?.extra?.question_results) ? a.extra.question_results : [];
        for (const r of results) {
            const idx = Number.isInteger(r?.q_index) ? r.q_index : null;
            if (idx == null || idx >= ids.length) continue;
            const id = ids[idx];
            if (proof.has(id)) continue;
            // An unmarked answer is not evidence either way — `Number(null)`
            // is 0, which would file every unmarked check as a fail.
            if (r.marks == null || r.marks_max == null || !(Number(r.marks_max) > 0)) continue;
            proof.set(id, {
                at: a.created_date || a.date || null,
                marks: Number(r.marks),
                outOf: Number(r.marks_max),
                full: Number(r.marks) >= Number(r.marks_max),
                quizId: a.quiz_id,
            });
        }
    }
    return proof;
}

/**
 * Where a point stands. The newer of the two claims wins: a point proved last
 * week and rated "shaky" today is shaky (they are telling us they have lost
 * it), and a point that failed a check and was rated "got it" since is "got"
 * — but it counts as SAID, not proved, until a check says otherwise.
 */
export function pointState(point, proof) {
    const p = proof?.get?.(point?.id) || null;
    const saidAt = Date.parse(point?.said_at || "") || 0;
    const proofAt = Date.parse(p?.at || "") || 0;
    if (p && (!point?.said || proofAt >= saidAt)) return p.full ? "proved" : "missed";
    if (point?.said) return point.said;
    return "unrated";
}

/**
 * The point list as it should be read: what needs work first, proved last.
 * The checklist's own order is the teacher's, and is kept within each group.
 */
const POINT_RANK = { missed: 0, not_yet: 1, unrated: 2, shaky: 3, got: 4, proved: 5 };
export function orderPoints(points = [], proof) {
    return points
        .map((p, i) => ({ point: p, state: pointState(p, proof), proof: proof?.get?.(p.id) || null, i }))
        .sort((a, b) => POINT_RANK[a.state] - POINT_RANK[b.state] || a.i - b.i);
}

/** The points a check should ask about next: what has not been proved, worst first. */
export function checkCandidates(points = [], proof, max = CHECK_MAX) {
    return orderPoints(points, proof).filter((r) => r.state !== "proved").slice(0, max).map((r) => r.point);
}

// ─── Readiness ──────────────────────────────────────────────────────────────

/**
 * Every item in the folder, each one PROVED, SAID or OPEN:
 *
 *   point     proved = full marks on a check; said = rated got it; else open
 *   mistake   proved = fixed (ladder AND earned back); said = rehearsed to the
 *             end and waiting on the question; else open
 *   answer    proved = learned (every rung, a week apart); said = up to the
 *             write rung; else open
 *
 * "Ready" is proved + said, and the bar draws the two apart. Weak deck cards
 * are not items — they are a deck's state, and a folder with a sixty-card deck
 * in it would be a bar about flashcards.
 */
export function readiness({ points = [], proof, mistakes = [], answers = [], attempts = [] } = {}) {
    const out = {
        points: { proved: 0, said: 0, open: 0, total: points.length },
        mistakes: { proved: 0, said: 0, open: 0, total: mistakes.length },
        answers: { proved: 0, said: 0, open: 0, total: answers.length },
    };
    for (const p of points) {
        const s = pointState(p, proof);
        out.points[s === "proved" ? "proved" : s === "got" ? "said" : "open"] += 1;
    }
    for (const c of mistakes) {
        const s = fixState(c, attempts);
        out.mistakes[s === "fixed" ? "proved" : s === "drilled" ? "said" : "open"] += 1;
    }
    for (const c of answers) {
        const s = answerState(c);
        const reps = Number(c?.repetitions) || 0;
        out.answers[s === "learned" ? "proved" : s === "rehearsing" && reps >= 4 ? "said" : "open"] += 1;
    }
    const sum = (k) => out.points[k] + out.mistakes[k] + out.answers[k];
    const total = points.length + mistakes.length + answers.length;
    const proved = sum("proved");
    const said = sum("said");
    return {
        ...out,
        total,
        proved,
        said,
        open: sum("open"),
        ready: proved + said,
        pct: total ? Math.round(((proved + said) / total) * 100) : 0,
    };
}

/**
 * "You said 9; 4 held up." Only printed when a check has actually been sat on
 * something the student rated — calibration off zero checks is a guess.
 */
export function calibration(points = [], proof) {
    let said = 0; let held = 0; let slipped = 0;
    for (const p of points) {
        if (p.said !== "got") continue;
        said += 1;
        const pr = proof?.get?.(p.id);
        if (!pr) continue;
        if (pr.full) held += 1; else slipped += 1;
    }
    return { said, held, slipped, checked: held + slipped };
}

/**
 * The folder's one line. Null when there is nothing true to say.
 *
 * It carries no date: the hero's countdown already says it, at a size nothing
 * else on the page competes with, and "4 days." printed again under it is the
 * same fact twice.
 */
export function folderLead(folder, r) {
    if (!folder || !r) return null;
    if (!r.total) {
        return folder.kind === "sac"
            ? "Add what this SAC covers and the folder fills itself."
            : "Nothing saved in this subject yet. Mistakes and answers you save from marked quizzes land here.";
    }
    if (!r.open) return "Everything in here is ready.";
    return `${r.ready} of ${r.total} ready, ${r.open} still open.`;
}

/** The ids of everything in a folder that can be drilled now, mistakes first. */
export function drillQueue(contents) {
    if (!contents) return [];
    return [...(contents.ready?.mistakes || []), ...(contents.ready?.answers || [])];
}

export default {
    foldersFor, findFolder, topicOf, subjectOf, topicOptions, suggestedTopics, inFolder, folderContents,
    splitOutline, mergePoints, ratePoint, removePoint, editPoint, revisionPatch, checkQuiz, pointProof,
    pointState, orderPoints, checkCandidates, readiness, calibration, folderLead, drillQueue, isWeakCard,
};

// ─── The address ────────────────────────────────────────────────────────────

/**
 * The query string for a place in Revision. One builder, so a link into a
 * folder, a bank view or a tab is spelled the same way everywhere — the
 * `?tab=spaced` lesson, where five call sites each wrote their own and none of
 * them was a value the page honoured.
 */
export const VIEWS = ["mistakes", "answers"];
export const FOLDER_TABS = ["knowledge", "mistakes", "answers", "cards", "mock"];

export function revisionQuery({ folder, view, tab, sit } = {}) {
    const q = new URLSearchParams();
    if (folder) q.set("folder", folder);
    else if (view && VIEWS.includes(view)) q.set("view", view);
    if (tab) q.set("tab", tab);
    if (sit) q.set("sit", sit);
    const s = q.toString();
    return s ? `?${s}` : "";
}
