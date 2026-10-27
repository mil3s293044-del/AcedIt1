/**
 * slate — the week's shared questions, the clock they run on, and the season
 * ladder every call feeds.
 *
 * ═══ ONE SLATE, EVERYBODY ON IT ═══════════════════════════════════════════════
 * The floor was a board of private facts: "will Maya study five days" is a
 * question four people have a view on. The SLATE is the opposite — a short
 * card of questions the whole room can call, the same card for everybody, the
 * way a footy-tipping comp hands every entrant the same round. Answering the
 * same questions is what makes it a COMPETITION rather than a list: two
 * students who called the same slate can be compared, and a week's podium
 * means something.
 *
 * ═══ MORE QUESTIONS WITHOUT A FLOOD ══════════════════════════════════════════
 * Two moves, and neither adds a card per student:
 *   · A CARD CAN HOLD SEVERAL ANSWERS. "Who tops the League?" is one card with
 *     four priced names and "someone else" under it. Each answer is its own
 *     binary market underneath — the price, the payout, the settlement and
 *     every position are exactly the ones a single question already uses — so
 *     nothing about the scoring changed. Only the card groups them (`meta.group`).
 *   · THE SLATE ARRIVES IN TWO DROPS. Monday opens it; Wednesday adds the
 *     questions only a half-played week can ask ("on pace to beat last
 *     week?"). The board moves through the week instead of arriving whole.
 *
 * ═══ LAST CALL, BEFORE THE ANSWER IS VISIBLE ═════════════════════════════════
 * A weekly question used to trade until Sunday night, by which time the
 * League, Ranked and every group's week had published most of its answer. That
 * is the one form of insider trading this board cannot otherwise stop: the
 * information is not secret, it is simply LATE, and a position taken on it is
 * a near-certainty bought at a stale price. Every weekly question locks at
 * `LAST_CALL` — Friday evening in Melbourne — and resolves when the week does.
 *
 * And EARLY CALLS COUNT FOR MORE on the ladder (`earlyWeight`). A read made on
 * Monday is foresight; the same read on Friday afternoon is mostly reading the
 * board. The weight is fixed at the moment of the call, so it changes nothing
 * about which answer is the honest one to give — properness survives a scale.
 *
 * ═══ THE LADDER RANKS SKILL, NOT CREDITS ═════════════════════════════════════
 * Credits are what a student commits; READ POINTS are what ranks them. A read
 * point is the improvement on the room's own forecast at the moment of the
 * call — the same quantity the payout is scored on, before the stake multiplies
 * it — so agreeing with the room earns exactly nothing, and a ladder can never
 * be climbed by committing more. That is the difference between a forecasting
 * competition and a betting one, written down as arithmetic.
 *
 * Pure. Imported by `server.mjs`, never mirrored — the week key, the last call
 * and the division thresholds are the same objects on both sides.
 */
import { skill, clampP } from "./market.js";
import { weekKeyUTC } from "./utcWeek.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/**
 * A time from anything, or NULL — never zero. `Number(null)` is 0, which is
 * 1970, and a missing timestamp read as the dawn of time makes every call look
 * as early as a call can be. That trap is in a dozen modules here already.
 */
export function toTime(v) {
    if (v === null || v === undefined || v === "") return null;
    const t = v instanceof Date ? v.getTime() : typeof v === "number" ? v : Date.parse(String(v));
    return Number.isFinite(t) ? t : null;
}

const isWeekKey = (k) => typeof k === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k);
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);

/** The Monday (UTC) of the week holding `d`, as YYYY-MM-DD. The server's week. */
export { weekKeyUTC };

const weekStartMs = (weekKey) => Date.parse(`${weekKey}T00:00:00Z`);

// ─── Last call ──────────────────────────────────────────────────────────────

/**
 * Friday 08:00 UTC: 6pm in Melbourne in winter, 7pm in summer. The server's
 * week is UTC (CLAUDE.md records that as a known offset), so the evening is
 * stated in UTC and lands on a Melbourne evening either side of daylight
 * saving — late enough that a student can still call after school, early
 * enough that the weekend's study is genuinely unknown.
 */
export const LAST_CALL_DAY = 4;   // days after Monday
export const LAST_CALL_HOUR_UTC = 8;

export function weekLastCall(weekKey) {
    if (!isWeekKey(weekKey)) return null;
    return weekStartMs(weekKey) + LAST_CALL_DAY * DAY_MS + LAST_CALL_HOUR_UTC * 3600e3;
}

/** The kinds whose answer is a WEEK of the study log, and so leaks as it plays. */
export const WEEKLY_KINDS = new Set(["streak", "hours", "versus", "cohort", "longshot", "quiz"]);

/** A prep question's answer is the lead-up itself, so it locks two days short. */
export const PREP_LAST_CALL_MS = 2 * DAY_MS;

/**
 * When a market stops taking calls. Never later than it closes.
 *
 * `meta.last_call` wins when the mint wrote one. A weekly question minted
 * before last call existed derives the same Friday from its own period, so
 * the rule reaches every open market on the day it ships rather than only the
 * ones minted after. A SAC line already closes the morning it is sat, which is
 * before anybody can know the mark.
 */
export function lastCallOf(market) {
    if (!market) return null;
    const meta = market.meta || {};
    const closes = toTime(market.closes_at);
    const cap = (t) => (t == null ? closes : closes == null ? t : Math.min(t, closes));
    const explicit = toTime(meta.last_call);
    if (explicit != null) return cap(explicit);
    if (WEEKLY_KINDS.has(market.kind) && isWeekKey(meta.period)) return cap(weekLastCall(meta.period));
    if (market.kind === "prep" && closes != null) return closes - PREP_LAST_CALL_MS;
    return closes;
}

/** Past last call and not yet resolved: on the board, taking no more calls. */
export function isLocked(market, now = Date.now()) {
    if (!market || market.status !== "open") return false;
    const lc = lastCallOf(market);
    return lc != null && now >= lc;
}

// ─── Early calls count for more ─────────────────────────────────────────────

/** What a call made AT last call is worth, against one made the moment it opened. */
export const EARLY_FLOOR = 0.5;

/**
 * 1 at the open, falling in a straight line to `EARLY_FLOOR` at last call.
 * Anything it cannot place — a missing time, a market with no clock — is 1:
 * an unknown cannot be punished, and a weight that defaulted to the floor
 * would quietly halve every call made before this existed.
 */
export function earlyWeight(at, opened, lastCall) {
    const t = toTime(at);
    const o = toTime(opened);
    const l = toTime(lastCall);
    if (t == null || o == null || l == null || l <= o) return 1;
    const f = Math.min(1, Math.max(0, (t - o) / (l - o)));
    return 1 - (1 - EARLY_FLOOR) * f;
}

// ─── Read points ────────────────────────────────────────────────────────────

/** Points per unit of skill. Skill lives in [-1, 1], so a call is worth ±100 at most. */
export const READ_SCALE = 100;

/**
 * What one settled call is worth on the ladder.
 *
 * `skill` is the improvement on the room's Brier score at the price the call
 * was taken at — the payout's own quantity before the stake multiplies it. So
 * the stake cannot buy points, agreeing with the room is worth zero, and a
 * void tested nothing and is worth nothing. An unresolved call is NULL, never
 * zero: "not decided yet" is not "earned nothing".
 */
export function readPoints(position, market) {
    if (!position || !market) return null;
    if (market.status === "void") return 0;
    if (market.status !== "resolved" || typeof market.outcome !== "boolean") return null;
    if (position.p == null || position.price_at_entry == null) return null;
    const p = Number(position.p);
    const price = Number(position.price_at_entry);
    if (!Number.isFinite(p) || !Number.isFinite(price)) return null;
    const w = earlyWeight(position.created_date,
        market.opens_at || market.created_date, lastCallOf(market));
    return Math.round(READ_SCALE * skill(clampP(p), clampP(price), market.outcome) * w);
}

// ─── Seasons ────────────────────────────────────────────────────────────────

/**
 * Four weeks. Long enough that one lucky Friday cannot decide it, short
 * enough that a bad start is not a lost term — about two and a half a term.
 */
export const SEASON_WEEKS = 4;
/** A Monday. Seasons are counted from here, so season N is the same four weeks for everybody. */
export const SEASON_EPOCH = "2026-01-05";

export function seasonOf(d = new Date()) {
    const wk = weekKeyUTC(d);
    const epoch = weekStartMs(SEASON_EPOCH);
    const weeks = Math.round((weekStartMs(wk) - epoch) / WEEK_MS);
    const index = Math.floor(weeks / SEASON_WEEKS);
    const start = epoch + index * SEASON_WEEKS * WEEK_MS;
    const keys = Array.from({ length: SEASON_WEEKS }, (_, i) => isoDay(start + i * WEEK_MS));
    return {
        index,
        number: index + 1,
        start: keys[0],
        weeks: keys,
        week: weeks - index * SEASON_WEEKS + 1,
        endsAt: start + SEASON_WEEKS * WEEK_MS,
    };
}

export const seasonOfWeek = (weekKey) =>
    (isWeekKey(weekKey) ? seasonOf(new Date(`${weekKey}T12:00:00Z`)) : null);

/**
 * Which week a settled call counts toward. The question's own period when it
 * has one — a weekly market settles lazily, often on the Monday after, and
 * filing it under the settling week would push a season's last week into the
 * next season. Otherwise the week it resolved.
 */
export function pointsWeek(market) {
    const p = market?.meta?.period;
    if (isWeekKey(p)) return p;
    const r = toTime(market?.resolved_at);
    return r == null ? null : weekKeyUTC(r);
}

// ─── Divisions ──────────────────────────────────────────────────────────────

/**
 * FIVE DIVISIONS, AND EACH IS A CARD. Rank is how strong a thing is everywhere
 * in this app, and an Ace is always earned — so the top division is the Ace and
 * nobody starts anywhere near it. The thresholds are season read points:
 * a sharp call is worth roughly ten, and the room's own forecast is hard to
 * beat, so a season at Strategist is a month of genuinely good reads.
 *
 * The names are a forecaster's, deliberately. Nothing here is called a shark,
 * a whale or a high roller; nothing is about how much somebody risked.
 */
export const DIVISIONS = [
    { id: "rookie", label: "Rookie", rank: "10", suit: "club", min: 0 },
    { id: "scout", label: "Scout", rank: "J", suit: "diamond", min: 30 },
    { id: "analyst", label: "Analyst", rank: "Q", suit: "heart", min: 80 },
    { id: "strategist", label: "Strategist", rank: "K", suit: "spade", min: 160 },
    { id: "oracle", label: "Oracle", rank: "A", suit: "spade", min: 280 },
];

export function divisionOf(points) {
    const pts = points === null || points === undefined || !Number.isFinite(Number(points))
        ? 0 : Number(points);
    let i = 0;
    DIVISIONS.forEach((d, k) => { if (pts >= d.min) i = k; });
    const d = DIVISIONS[i];
    const next = DIVISIONS[i + 1] || null;
    const progress = next ? Math.min(1, Math.max(0, (pts - d.min) / (next.min - d.min))) : 1;
    return { ...d, index: i, next, toNext: next ? Math.max(0, next.min - pts) : 0, progress, points: pts };
}

/**
 * What a season leaves behind, worn through the next one. From Analyst up the
 * division's card is a crest beside your name; the Oracle's season also earns
 * its card back. Earned only — neither is in the store, and neither can be.
 */
export const CREST_FROM = "analyst";
export const ORACLE_BACK = "back-oracle";

export function seasonAward(points) {
    const d = divisionOf(points);
    const crestAt = DIVISIONS.findIndex((x) => x.id === CREST_FROM);
    if (d.index < crestAt) return null;
    return { division: d.id, back: d.id === "oracle" ? ORACLE_BACK : null };
}

// ─── The drops ──────────────────────────────────────────────────────────────

export const WAVES = [
    { id: 1, label: "Monday drop", day: 0 },
    { id: 2, label: "Wednesday drop", day: 2 },
];

export function waveOpensAt(weekKey, wave) {
    const w = WAVES.find((x) => x.id === wave);
    if (!w || !isWeekKey(weekKey)) return null;
    return weekStartMs(weekKey) + w.day * DAY_MS;
}

/** Which drops are out by `now`. A drop is never minted after last call. */
export function wavesDue(now = Date.now(), weekKey = weekKeyUTC(now)) {
    const t = toTime(now);
    const lc = weekLastCall(weekKey);
    if (t == null || lc == null || t >= lc) return [];
    return WAVES.filter((w) => t >= waveOpensAt(weekKey, w.id)).map((w) => w.id);
}

// ─── Grouping the slate for a card ──────────────────────────────────────────

export const isSlate = (m) => !!m?.meta?.slate;

/**
 * The slate as cards: rows sharing `meta.group` are ONE card with several
 * answers, everything else is a card of its own. Ordered by drop, then by the
 * order the mint wrote, so the card reads the same on every load.
 */
export function slateOf(markets = []) {
    const out = [];
    const byGroup = new Map();
    for (const m of markets.filter(isSlate)) {
        const g = m.meta?.group;
        if (g) {
            if (!byGroup.has(g)) {
                const entry = {
                    id: g, kind: "group", wave: Number(m.meta?.wave) || 1,
                    order: Number(m.meta?.order) || 0,
                    title: m.meta?.group_title || m.title, rows: [],
                };
                byGroup.set(g, entry);
                out.push(entry);
            }
            byGroup.get(g).rows.push(m);
        } else {
            out.push({
                id: m.id, kind: "single", wave: Number(m.meta?.wave) || 1,
                order: Number(m.meta?.order) || 0, title: m.title, rows: [m],
            });
        }
    }
    byGroup.forEach((e) => e.rows.sort((a, b) =>
        (Number(a.meta?.outcome_order) || 0) - (Number(b.meta?.outcome_order) || 0)));
    return out.sort((a, b) => (a.wave - b.wave) || (a.order - b.order)
        || String(a.title).localeCompare(String(b.title)));
}

/** How much of the slate somebody has called. A group counts once, whichever answer. */
export function slateProgress(entries = []) {
    const total = entries.length;
    const called = entries.filter((e) => e.rows.some((r) => r.mine)).length;
    return { called, total, done: total > 0 && called === total };
}

// ─── The week's table ───────────────────────────────────────────────────────

/**
 * Read points per person over a set of settled calls, best first. A tie is
 * broken by the number of calls — more of the slate called is the harder way
 * to the same total — and then by name, so the order is stable.
 */
export function slateTable(rows = []) {
    const by = new Map();
    for (const r of rows) {
        if (r?.points === null || r?.points === undefined || !r.email) continue;
        const k = String(r.email).toLowerCase();
        if (!by.has(k)) by.set(k, { email: r.email, name: r.name || null, points: 0, calls: 0 });
        const e = by.get(k);
        e.points += Number(r.points) || 0;
        e.calls += 1;
        if (!e.name && r.name) e.name = r.name;
    }
    return [...by.values()].sort((a, b) => (b.points - a.points) || (b.calls - a.calls)
        || String(a.name || "").localeCompare(String(b.name || "")));
}

/**
 * The share of other people you finished ahead of, a tie counting half — a
 * BAND, never "4th of 31", which is the rule the book keeps about standing.
 * NULL when there is nobody to compare against.
 */
export function aheadOf(mine, others = []) {
    const xs = others.filter((x) => x !== null && x !== undefined && Number.isFinite(Number(x)));
    if (mine === null || mine === undefined || !xs.length) return null;
    const m = Number(mine);
    const score = xs.reduce((s, x) => s + (Number(x) < m ? 1 : Number(x) === m ? 0.5 : 0), 0);
    return Math.round((score / xs.length) * 100);
}

// ─── Priors for the questions the slate asks ────────────────────────────────

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/** What "someone else" opens at on a card of names. */
export const FIELD_PRIOR = 0.35;

/**
 * Opening prices for "who tops the League": last week's front-runners in
 * proportion to last week's scores, with the field holding a real share —
 * a League winner repeating is far from certain, and opening the favourite at
 * 90% would leave nothing for anybody to read. An opening price, not a claim.
 */
export function contenderPriors(scores = [], field = FIELD_PRIOR) {
    const xs = scores.map((s) => Math.max(0, Number(s?.score) || 0));
    const total = xs.reduce((a, b) => a + b, 0);
    const share = 1 - field;
    const each = scores.map((s, i) => ({
        ...s,
        prior: clamp(total > 0 ? share * (xs[i] / total) : share / Math.max(1, scores.length), 0.05, 0.6),
    }));
    return { contenders: each, field };
}

/**
 * Is the room on pace? A smooth reading of this week's minutes so far against
 * last week's over the same days, held off the extremes: two days of data is
 * a lean, not a verdict.
 */
export function pacePrior(soFar, lastSoFar) {
    // Unknown is not zero minutes: `Number(null)` would read a missing total
    // as a room that has done nothing and open the question at its floor.
    if (soFar === null || soFar === undefined || lastSoFar === null || lastSoFar === undefined) return 0.5;
    const a = Number(soFar);
    const b = Number(lastSoFar);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return 0.5;
    return clamp(0.5 + 0.5 * Math.tanh(1.5 * (a / b - 1)), 0.15, 0.85);
}

const hours = (m) => `${Math.round(m / 60)}h`;

/**
 * Four brackets for the room's total, cut at the quartiles of its own past
 * weeks. Each opens at its share of that history, Laplace-smoothed so a bracket
 * the room has never landed in is unlikely rather than impossible. NULL when
 * there is not enough history, or when rounding to the hour collapses two cuts
 * into one — a bracket "40h–40h" is not a question.
 */
export const BRACKET_MIN_WEEKS = 4;

export function bracketsFrom(totals = []) {
    const xs = totals.map(Number).filter((t) => Number.isFinite(t) && t > 0).sort((a, b) => a - b);
    if (xs.length < BRACKET_MIN_WEEKS) return null;
    const q = (f) => xs[Math.min(xs.length - 1, Math.floor(f * xs.length))];
    const cuts = [q(0.25), q(0.5), q(0.75)].map((m) => Math.round(m / 60) * 60);
    if (!(cuts[0] > 0 && cuts[0] < cuts[1] && cuts[1] < cuts[2])) return null;
    const edges = [0, ...cuts, null];
    const out = [];
    for (let i = 0; i < 4; i++) {
        const lo = edges[i];
        const hi = edges[i + 1];
        const hits = xs.filter((t) => t >= lo && (hi === null || t < hi)).length;
        out.push({
            lo, hi,
            label: i === 0 ? `Under ${hours(hi)}` : hi === null ? `${hours(lo)}+` : `${hours(lo)}–${hours(hi)}`,
            prior: (hits + 1) / (xs.length + 4),
        });
    }
    return out;
}

export const inBracket = (total, b) =>
    Number(total) >= Number(b.lo) && (b.hi === null || b.hi === undefined || Number(total) < Number(b.hi));

// ─── Subjects ───────────────────────────────────────────────────────────────

export const subjectKey = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Countable minutes per subject across a room.
 *
 * The integrity caps work on a person's DAY, not on a subject, so applying them
 * per subject would give a student six days' worth of ceiling. Instead each
 * person-day is capped as a whole and its countable minutes are SHARED across
 * that day's subjects in proportion to what was logged — the total can never
 * exceed what the League would count, and a subject cannot be padded past it.
 * `countable(rows)` is the server's own `countableStudyMinutes`, passed in so
 * this module stays pure.
 */
export function subjectMinutes(rows = [], countable) {
    const days = new Map();
    for (const r of rows) {
        const key = subjectKey(r?.subject);
        if (!key || !r?.email || !r?.day) continue;
        const k = `${r.email}|${r.day}`;
        if (!days.has(k)) days.set(k, []);
        days.get(k).push({ ...r, key });
    }
    const out = new Map();
    const labels = new Map();
    const people = new Map();
    days.forEach((list) => {
        const capped = Number(countable(list)) || 0;
        const claimed = list.reduce((s, r) => s + Math.max(0, Number(r.minutes) || 0), 0);
        if (capped <= 0 || claimed <= 0) return;
        for (const r of list) {
            const share = capped * (Math.max(0, Number(r.minutes) || 0) / claimed);
            out.set(r.key, (out.get(r.key) || 0) + share);
            if (!people.has(r.key)) people.set(r.key, new Set());
            people.get(r.key).add(String(r.email).toLowerCase());
            const name = String(r.subject).trim();
            if (!labels.has(r.key)) labels.set(r.key, new Map());
            labels.get(r.key).set(name, (labels.get(r.key).get(name) || 0) + 1);
        }
    });
    const result = new Map();
    out.forEach((minutes, key) => {
        const names = [...labels.get(key).entries()].sort((a, b) => b[1] - a[1]);
        result.set(key, { key, label: names[0][0], minutes: Math.round(minutes), people: people.get(key).size });
    });
    return result;
}

/**
 * SAC season: subjects with an assessment coming up for enough people that
 * the number is about a CLASS and not about a person. Under `min` students a
 * count of "the people with a Methods SAC" is a short list of names anyone in
 * the class could fill in, so it is not asked.
 */
export const SAC_SEASON_MIN = 4;

/**
 * A subject is only NAMED on the slate when several people study it. With one
 * student in Legal, "Will Legal get the most study time?" is a question about
 * that student's week with the name filed off.
 */
export const SUBJECT_MIN_PEOPLE = 3;

export function sacSeasonGroups(assessments = [], { min = SAC_SEASON_MIN } = {}) {
    const by = new Map();
    for (const a of assessments) {
        const key = subjectKey(a?.subject_name);
        if (!key || !a?.created_by) continue;
        if (!by.has(key)) by.set(key, { key, label: String(a.subject_name).trim(), emails: new Set() });
        by.get(key).emails.add(String(a.created_by).toLowerCase());
    }
    return [...by.values()]
        .filter((g) => g.emails.size >= min)
        .map((g) => ({ ...g, emails: [...g.emails].sort() }))
        .sort((a, b) => (b.emails.length - a.emails.length) || a.label.localeCompare(b.label));
}

// ─── The Sunday reveal, once per week per device ────────────────────────────

const RESULTS_SEEN_KEY = "acedit.slate.results.seen";

function seenResultWeeks() {
    try {
        if (globalThis.localStorage === undefined) return null;
        const raw = globalThis.localStorage.getItem(RESULTS_SEEN_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return new Set(Array.isArray(arr) ? arr : []);
    } catch {
        // BLOCKED STORAGE COUNTS AS SEEN, the settlement reveal's rule: a
        // results screen replayed on every load is worse than one never shown.
        return null;
    }
}

/**
 * Whether last week's results are owed to this device: settled, with at least
 * one card, and not shown here before. Marked seen ON ARRIVAL by the caller —
 * a student who closes the tab has still had it put in front of them.
 */
export function slateResultsDue(results) {
    if (!results || results.pending || !Array.isArray(results.cards) || !results.cards.length) return false;
    const seen = seenResultWeeks();
    return seen !== null && !seen.has(results.week);
}

export function markSlateResultsSeen(week) {
    try {
        const s = seenResultWeeks() || new Set();
        if (week) s.add(week);
        globalThis.localStorage?.setItem(RESULTS_SEEN_KEY, JSON.stringify([...s].slice(-20)));
    } catch { /* treated as seen already */ }
}

export default {
    toTime, weekKeyUTC, weekLastCall, lastCallOf, isLocked, earlyWeight, readPoints,
    seasonOf, seasonOfWeek, pointsWeek, divisionOf, seasonAward, wavesDue, waveOpensAt,
    slateOf, slateProgress, slateTable, aheadOf, contenderPriors, pacePrior,
    bracketsFrom, inBracket, subjectMinutes, sacSeasonGroups, subjectKey,
};
