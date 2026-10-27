/**
 * sacTags — tagging anything a student owns to the SAC it is for, and what a
 * SAC can then say about how the run-up to it is going.
 *
 * ─── Where a tag lives ──────────────────────────────────────────────────────
 * A tag on a deck, a quiz, a mistake, an answer, a mind map or a chat is a
 * CLAIM the SAC makes, on the SAC's own row (`extra.revision.claims`). The
 * reasons are in revision.js beside `folderMember`, which is the one reading
 * of it. This file is the writing: the patch, which SACs a picker offers, and
 * the label a chip prints.
 *
 * Study time is STAMPED instead (`extra.revision_for` on the session row), at
 * the moment it is saved, because a session is an event that already happened
 * for something and a deck is a resource whose purpose can change.
 *
 * ─── What a SAC can say ─────────────────────────────────────────────────────
 * `folderStats` is the run-up: minutes, sits, cards reviewed, all over the four
 * weeks before the SAC (or up to today, while it is still coming). Every
 * figure is counted off rows the folder already gathered and is NULL rather
 * than 0 when there is nothing — "0 sits" printed at somebody a month out is
 * the padding every builder in studyQueue refuses.
 *
 * Readiness over time is the one thing nothing records, so it is written down:
 * a snapshot a day on the SAC's row, taken when the folder is opened. It is a
 * record of what the folder showed that day and never a reconstruction — the
 * mistake bank already says that nothing records WHEN a mistake became fixed,
 * and inventing the line backwards would be drawing that claim.
 */
import { sacKey, SAC_PREFIX, revisionPatch, cleanClaims, CLAIM_KINDS, CLAIM_MAX, normTopic, daysUntil } from "./revision.js";
import { countableByDay } from "./integrity.js";
import { dayKey, weekStart } from "./studyLog.js";
import { averageScore } from "./quizDeck.js";
import { isRetryAttempt } from "./quizInsight.js";
import { shortSubject } from "./subjectShort.js";

const str = (v) => String(v ?? "").trim();

// ─── Claims ─────────────────────────────────────────────────────────────────

/**
 * The patch that adds or removes one claim, keeping everything else on the
 * row — the points, the topics, the history, and whatever else `extra` holds.
 * Built off the row it is handed, so the caller must hand it the LATEST one.
 */
export function claimPatch(row, kind, id, on) {
    if (!CLAIM_KINDS.includes(kind)) throw new Error(`Unknown claim kind: ${kind}`);
    const key = str(id);
    if (!key) throw new Error("A claim needs an id");
    const current = cleanClaims(row?.extra?.revision?.claims);
    const list = current[kind].filter((v) => v !== key);
    if (on) {
        if (list.length >= CLAIM_MAX) list.shift();
        list.push(key);
    }
    return revisionPatch(row, { claims: { ...current, [kind]: list } });
}

/** The SACs that claim this thing, by their own word (not by topic). */
export function claimingFolders(folders = [], kind, id) {
    const key = str(id);
    if (!key) return [];
    return (folders || []).filter((f) => f?.kind === "sac" && f.claims?.[kind]?.includes(key));
}

/**
 * What a tag picker offers, in order: the SACs still coming in this item's
 * subject (soonest first), then the SACs still coming in other subjects, then
 * any FINISHED SAC that already claims it — so it can be untagged, and only
 * then. A finished SAC is not something to tag new work for.
 *
 * Exam folders are never offered: an exam folder already holds the whole
 * subject, so a tag on it could only ever say nothing.
 */
export function tagTargets({ sacs = [], past = [] } = {}, { subject, kind, id } = {}) {
    const mine = (f) => normTopic(f.subject) === normTopic(subject);
    const coming = [...(sacs || [])];
    const ordered = [...coming.filter(mine), ...coming.filter((f) => !mine(f))];
    const held = kind && id ? claimingFolders(past, kind, id) : [];
    return [...ordered, ...held];
}

/** A SAC as a chip names it: the subject, short, then the SAC's own title. */
export function tagLabel(folder) {
    if (!folder) return "";
    const subject = shortSubject(folder.subject || "");
    const title = str(folder.title) || "SAC";
    if (!subject || normTopic(title).includes(normTopic(subject))) return title;
    return `${subject} · ${title}`;
}

/** What a chip says for the SACs it carries. */
export function chipLabel(folders = []) {
    if (!folders.length) return null;
    if (folders.length === 1) return tagLabel(folders[0]);
    return `${folders.length} SACs`;
}

// ─── Stamps on study time ───────────────────────────────────────────────────

export const STAMP_KEY = "revision_for";

/** The SAC keys a session row was stamped for. */
export function stampOf(row) {
    const v = row?.extra?.[STAMP_KEY];
    return Array.isArray(v) ? v.map(str).filter((k) => k.startsWith(SAC_PREFIX)) : [];
}

/**
 * A session payload with its stamp, merging into whatever `extra` the payload
 * already carries. With no key it is returned untouched — a row carrying an
 * empty stamp says it was for nothing, which is not what happened.
 */
export function withStamp(payload, key) {
    const k = str(key);
    if (!k.startsWith(SAC_PREFIX) || k.length <= SAC_PREFIX.length) return payload;
    const extra = payload?.extra && typeof payload.extra === "object" ? payload.extra : {};
    return { ...payload, extra: { ...extra, [STAMP_KEY]: [k] } };
}

/** A `?for=` value, if it is a SAC key. Anything else is ignored rather than trusted. */
export function parseFor(search) {
    const raw = new URLSearchParams(String(search || "")).get("for");
    const k = str(raw);
    return /^sac:[A-Za-z0-9_-]+$/.test(k) ? k : null;
}

/** The SAC id inside a key. */
export const sacIdOf = (key) => (str(key).startsWith(SAC_PREFIX) ? str(key).slice(SAC_PREFIX.length) : null);
export { sacKey };

// ─── The run-up ─────────────────────────────────────────────────────────────

/** Monday weeks a SAC's run-up covers, the current one included. */
export const RUNUP_WEEKS = 4;

const asDay = (v) => {
    const d = str(v).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
};
const fromDay = (d) => { const [y, m, x] = d.split("-").map(Number); return new Date(y, m - 1, x); };

/**
 * The window a SAC's figures cover: RUNUP_WEEKS whole Monday weeks, ending
 * today — or ending on the day of the SAC once it has passed, because a
 * finished SAC's run-up is the one that led to it, not the month after.
 *
 * WHOLE WEEKS, so the bars and the total are one count. A 28-day window
 * starting mid-week put up to six days into the total that no bar drew, and
 * a total that is not the sum of the bars under it is two figures disagreeing
 * on one panel.
 */
export function runupRange(folder, now = new Date()) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const days = folder?.due ? daysUntil(folder.due, now) : null;
    const end = days != null && days < 0 ? fromDay(folder.due) : today;
    const start = weekStart(end);
    start.setDate(start.getDate() - (RUNUP_WEEKS - 1) * 7);
    return { from: dayKey(start), to: dayKey(end), end };
}

const inRange = (d, r) => !!d && d >= r.from && d <= r.to;

/**
 * Everything the "How you're tracking" panel prints, off the folder's contents.
 *
 *   minutes    countable, through the same caps the league uses, so a SAC can
 *              never claim more time than the boards would count
 *   weeks      the last RUNUP_WEEKS Monday weeks, oldest first
 *   sits       measurable attempts (never a "wrong only" retry) in the window
 *   average    their mean, through the one average every surface uses
 *   reviewed   cards, mistakes and answers whose last review falls in it
 *
 * Absent rather than zero: `any` is what the panel renders on.
 */
export function folderStats(contents, folder, now = new Date()) {
    const range = runupRange(folder, now);
    const rows = (contents?.time || [])
        .map((r) => ({ ...r, day: asDay(r.date || r.created_date) }))
        .filter((r) => inRange(r.day, range));
    const byDay = countableByDay(rows, now);

    const weeks = [];
    for (let i = RUNUP_WEEKS - 1; i >= 0; i--) {
        const start = weekStart(range.end);
        start.setDate(start.getDate() - i * 7);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        const from = dayKey(start);
        const to = dayKey(end);
        let m = 0;
        byDay.forEach((v, day) => { if (day >= from && day <= to) m += v.exact; });
        weeks.push({ from, minutes: Math.round(m), current: i === 0 && !(folder?.due && daysUntil(folder.due, now) < 0) });
    }

    // The total IS the sum of the bars, rounded the same way, so the figure
    // and the four bars under it cannot disagree by a rounding.
    const minutes = weeks.reduce((sum, w) => sum + w.minutes, 0);

    const sits = (contents?.attempts || [])
        .filter((a) => !isRetryAttempt(a) && inRange(asDay(a.date || a.created_date), range));
    const reviewed = [...(contents?.cards || []), ...(contents?.mistakes || []), ...(contents?.answers || [])]
        .filter((c) => inRange(asDay(c.last_reviewed_date), range)).length;

    // Sessions planned for it: everything from the run-up's start to the SAC
    // itself, done or still to come. Past the SAC, a planned session was for
    // something else.
    const due = asDay(folder?.due);
    const plans = (contents?.plans || []).filter((p) => {
        const d = asDay(p?.date);
        return !!d && d >= range.from && (!due || d <= due);
    });
    const planned = plans.length ? { total: plans.length, done: plans.filter((p) => p.is_completed).length } : null;

    const out = {
        range,
        planned,
        minutes: minutes > 0 ? minutes : null,
        weeks,
        sessions: rows.length || null,
        sits: sits.length || null,
        average: sits.length ? averageScore(sits) : null,
        reviewed: reviewed || null,
    };
    out.any = out.minutes != null || out.sits != null || out.reviewed != null || out.planned != null;
    return out;
}

/**
 * The SACs a Progress filter offers: every one still coming, and any finished
 * inside the last RUNUP_WEEKS — a student a week past a SAC still asks how the
 * run-up went. Older ones would only lengthen a list nobody scrolls.
 */
export function scopeFolders({ sacs = [], past = [] } = {}) {
    const recent = (past || []).filter((f) => f?.daysAway != null && f.daysAway >= -RUNUP_WEEKS * 7);
    return [...(sacs || []), ...recent];
}

// ─── Readiness over time ────────────────────────────────────────────────────

/** Days kept. A term and a bit; a SAC folder older than that is history. */
export const HISTORY_MAX = 120;

/** The snapshots on a folder's row, oldest first, every one well formed. */
export function historyOf(row) {
    const raw = row?.extra?.revision?.history;
    return (Array.isArray(raw) ? raw : [])
        .filter((h) => asDay(h?.d) && Number.isFinite(h?.t) && h.t >= 0
            && Number.isFinite(h?.p) && Number.isFinite(h?.s))
        .sort((a, b) => a.d.localeCompare(b.d));
}

/**
 * The patch that records today's readiness, or NULL when there is nothing to
 * write: an empty folder (a snapshot of nothing is not a reading), or today
 * already recorded with these exact numbers. Re-opening a folder ten times a
 * day therefore costs at most one write per change.
 */
export function historyPatch(row, r, now = new Date()) {
    if (!r || !(r.total > 0)) return null;
    const d = dayKey(now);
    const entry = { d, p: r.proved, s: r.said, t: r.total };
    const list = historyOf(row);
    const last = list[list.length - 1];
    if (last && last.d === d && last.p === entry.p && last.s === entry.s && last.t === entry.t) return null;
    const next = [...list.filter((h) => h.d !== d), entry].slice(-HISTORY_MAX);
    return revisionPatch(row, { history: next });
}

/**
 * The readiness line: ready (proved + said) and proved, as percentages of what
 * was in the folder THAT day. A folder that grew from 4 items to 20 has a line
 * that dips when it grew, which is true: there was more to be ready for.
 */
export function readinessSeries(history = []) {
    return (history || []).map((h) => ({
        d: h.d,
        ready: h.t ? Math.round(((h.p + h.s) / h.t) * 100) : 0,
        proved: h.t ? Math.round((h.p / h.t) * 100) : 0,
    }));
}

export default {
    claimPatch, claimingFolders, tagTargets, tagLabel, chipLabel, stampOf, withStamp, parseFor,
    runupRange, folderStats, historyOf, historyPatch, readinessSeries,
};
