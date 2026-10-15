/**
 * progressCharts — the one chart each Progress tab opens on.
 *
 * ─── EVERY TAB WAS THE SAME OBJECT ─────────────────────────────────────────
 * A figure, a sentence, then rows of horizontal bars — on Cards, on Quizzes,
 * on Mistakes and on Hours alike. Each was true, and four tabs drawn with one
 * shape read as one tab four times: nothing on screen said that a deck, a run
 * of papers, a pile of mistakes and a month of evenings are different kinds of
 * thing. So each feature gets the drawing its own data asks for, and these
 * are the derivations behind them:
 *
 *   CARDS     strengthStack + reviewForecast — how strong the deck is as ONE
 *             band, and how many cards come up on each of the next seven days.
 *   QUIZZES   sitPlot — every sit, plotted where it happened, with a trend
 *             only once there are enough sits to have one.
 *   MISTAKES  fixFunnel — banked, started, drilled, fixed, as a funnel.
 *   HOURS     heatCalendar — the last four Monday-anchored weeks, shaded.
 *
 * ─── PURE, BECAUSE A CHART IS WHERE A NUMBER GETS INVENTED QUIETLY ─────────
 * Every one of these is a function of rows the page already loads; nothing is
 * stored and nothing is fetched. They are here rather than in the components
 * because a chart that is wrong renders PERFECTLY — a dot on the wrong day, a
 * trend through two points, a funnel that widens — and only something that
 * reads what they return can say so. The `.js` is also what lets the test
 * loader reach them at all; it will not resolve a `.jsx`.
 *
 * ─── THE SAME REFUSALS AS EVERYWHERE ELSE ──────────────────────────────────
 * A trend needs `TREND_MIN` sits on BOTH halves before it is drawn, a day with
 * no row is a gap and never a zero for an average, and a row with no date is
 * never plotted anywhere — the `Number(null) === 0` family, which has now
 * reached more modules than any other trap in this codebase.
 */

import { dayKey, weekStart } from "@/lib/studyLog";
import { effectiveScore, TREND_MIN } from "@/lib/quizDeck";
import { cardState, dueFrom, isReady } from "@/lib/due";
import { measurable, countableMinutesByDay } from "@/lib/progressReport";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const asDay = (v) => {
    if (v instanceof Date) return dayKey(v);
    if (typeof v !== "string") return null;
    const d = v.slice(0, 10);
    return DAY_RE.test(d) ? d : null;
};

const shiftDays = (iso, n) => {
    const d = new Date(`${iso}T00:00:00`);
    d.setDate(d.getDate() + n);
    return dayKey(d);
};

const dayIndex = (iso) => Math.round(new Date(`${iso}T00:00:00`).getTime() / 86400000);

// ─── CARDS ──────────────────────────────────────────────────────────────────

/**
 * The deck's strength bands as ONE band, each a share of the whole.
 *
 * Four bars of different lengths answer "how many in each" and make the reader
 * add them up to see the deck; one band answers "what is my deck made of" at a
 * glance, which is the question this tab is about. A band too thin to see is
 * still drawn at `MIN_SHARE`, because a category with three cards in it is a
 * category the student has, and a segment that vanishes says they do not.
 */
export const MIN_SHARE = 0.03;

export function strengthStack(bands = []) {
    const live = (Array.isArray(bands) ? bands : []).filter((b) => Number(b?.n) > 0);
    const total = live.reduce((s, b) => s + Number(b.n), 0);
    if (!total) return { total: 0, segments: [] };
    // Floor each visible share, then take what the floors added back off the
    // widest, so the band still adds up to exactly the track.
    const raw = live.map((b) => ({ ...b, share: Number(b.n) / total }));
    const floored = raw.map((s) => ({ ...s, width: Math.max(MIN_SHARE, s.share) }));
    const over = floored.reduce((s, x) => s + x.width, 0) - 1;
    if (over > 0) {
        const widest = floored.reduce((a, b) => (b.width > a.width ? b : a));
        widest.width = Math.max(MIN_SHARE, widest.width - over);
    }
    return { total, segments: floored };
}

/**
 * How many cards come up on each of the next `days` days.
 *
 * Today is what can be sat RIGHT NOW — the same `isReady` every count of a
 * pile reads, split into what came up for review and what has never been
 * opened, because "40 ready" that is 38 untouched cards is a different evening
 * from 40 reviews. Every later day counts the cards SCHEDULED for exactly that
 * day, read through `dueFrom` so a snooze lands where the scheduler will put
 * it. Nothing is projected: a card does not appear on Thursday because it
 * might be failed on Tuesday.
 */
export function reviewForecast(cards = [], today, days = 7) {
    const day0 = asDay(today) || dayKey(new Date());
    const rows = Array.isArray(cards) ? cards : [];
    const out = [];
    let review = 0, fresh = 0;
    for (const c of rows) {
        if (!isReady(c, day0)) continue;
        if (cardState(c, day0) === "new") fresh += 1;
        else review += 1;
    }
    out.push({ day: day0, offset: 0, review, fresh, total: review + fresh });
    for (let k = 1; k < days; k++) {
        const d = shiftDays(day0, k);
        let n = 0;
        for (const c of rows) {
            // A snoozed card is coming back too — on its snooze, which is what
            // `dueFrom` reads. Filtering on "scheduled" alone dropped every
            // snoozed card off the forecast entirely, so "remind me Friday"
            // drew Friday as empty.
            const st = cardState(c, day0);
            if (st !== "scheduled" && st !== "snoozed") continue;
            if (asDay(dueFrom(c)) === d) n += 1;
        }
        out.push({ day: d, offset: k, review: n, fresh: 0, total: n });
    }
    return out;
}

// ─── QUIZZES ────────────────────────────────────────────────────────────────

const mean = (xs) => (xs.length ? xs.reduce((s, n) => s + n, 0) / xs.length : null);

/**
 * Every measurable sit in the window, placed on the day it was sat.
 *
 * Retries are not sits (`measurable`), and a sit with no date is not plotted —
 * it cannot be placed, and putting it at the left edge would draw it as the
 * oldest result the student has. Sits on one day are spread across that day
 * in the order they happened so four papers in an afternoon read as four dots
 * rather than one.
 *
 * THE TREND IS EARNED. It is the difference between the mean of the later half
 * and the mean of the earlier half, drawn only when each half holds
 * `TREND_MIN` sits — the rule the Quizzes hero keeps, and the reason a student
 * with three results is shown three dots and no direction. A least-squares
 * line through three points is a confident diagonal off a coin flip.
 */
export function sitPlot(attempts = [], quizzes = [], range = {}, today) {
    const to = asDay(range?.to) || asDay(today) || dayKey(new Date());
    const titleOf = new Map((Array.isArray(quizzes) ? quizzes : []).map((q) => [String(q?.id), q]));

    const sits = measurable(attempts)
        .map((a) => ({ a, day: asDay(a?.date) || asDay(a?.created_date) }))
        .filter(({ day }) => day && (!range?.from || day >= range.from) && day <= to)
        .sort((x, y) => (x.day === y.day
            ? String(x.a?.created_date || "").localeCompare(String(y.a?.created_date || ""))
            : x.day.localeCompare(y.day)));

    if (!sits.length) return { points: [], from: range?.from || to, to, mean: null, trend: null };

    const from = range?.from || sits[0].day;
    const span = Math.max(1, dayIndex(to) - dayIndex(from) + 1);

    const perDay = new Map();
    for (const s of sits) perDay.set(s.day, (perDay.get(s.day) || 0) + 1);
    const seen = new Map();

    const points = sits.map(({ a, day }, i) => {
        const k = seen.get(day) || 0;
        seen.set(day, k + 1);
        const n = perDay.get(day);
        // The day's own slot, divided between however many sits it holds.
        const within = (k + 0.5) / n;
        const q = titleOf.get(String(a?.quiz_id));
        return {
            key: String(a?.id ?? `${day}:${i}`),
            day,
            x: (dayIndex(day) - dayIndex(from) + within) / span,
            score: Math.round(Number(effectiveScore(a))),
            subject: q?.subject || a?.quiz_category || null,
            title: q?.title || a?.quiz_title || "Quiz",
        };
    });

    const scores = points.map((p) => p.score);
    const half = Math.floor(points.length / 2);
    const early = scores.slice(0, half);
    const late = scores.slice(points.length - half);
    const trend = (half >= TREND_MIN)
        ? { from: Math.round(mean(early)), to: Math.round(mean(late)), n: half }
        : null;

    return { points, from, to, mean: Math.round(mean(scores)), trend, need: Math.max(0, TREND_MIN * 2 - points.length) };
}

// ─── MISTAKES ───────────────────────────────────────────────────────────────

/**
 * The ladder as a FUNNEL: of everything banked, how much has been started, how
 * much drilled, and how much fixed.
 *
 * `fixState` buckets are exclusive, so each stage is the count that has
 * reached AT LEAST that far — which is what makes it narrow monotonically and
 * read as a funnel. A card that slipped back was started; it has not been
 * drilled. Fixed means what `/MistakeBank` means by it: the ladder cleared AND
 * a later sit earned the criterion back.
 */
export const FUNNEL = [
    { id: "banked", label: "Banked" },
    { id: "started", label: "Started" },
    { id: "drilled", label: "Drilled" },
    { id: "fixed", label: "Fixed" },
];

export function fixFunnel(states = []) {
    const n = (id) => (Array.isArray(states) ? states : [])
        .filter((s) => s?.state === id)
        .reduce((t, s) => t + (Number(s?.n) || 0), 0);
    const total = (Array.isArray(states) ? states : []).reduce((t, s) => t + (Number(s?.n) || 0), 0);
    const fixed = n("fixed");
    const drilled = fixed + n("drilled");
    const started = drilled + n("working") + n("slipping");
    const counts = { banked: total, started, drilled, fixed };
    return FUNNEL.map((s) => ({ ...s, n: counts[s.id], share: total ? counts[s.id] / total : 0 }));
}

// ─── HOURS ──────────────────────────────────────────────────────────────────

/**
 * Shading thresholds, in COUNTABLE minutes. Fixed rather than relative to the
 * student's own best day: a legend reading "30m · 1h · 2h" can be checked
 * against the figure above it, and a scale that rescales to whatever this
 * month happened to hold makes a quiet month look exactly like a busy one.
 */
export const HEAT_STEPS = [30, 60, 120];

export const heatLevel = (minutes) => {
    const m = Number(minutes);
    if (!Number.isFinite(m) || m <= 0) return 0;
    let level = 1;
    for (const step of HEAT_STEPS) if (m >= step) level += 1;
    return level;
};

/**
 * The last `weeks` weeks, Monday-anchored, one row per week, ending with the
 * current one. Days after today are drawn as FUTURE rather than as empty,
 * because an empty Saturday that has not happened yet is not a day off.
 *
 * Minutes come through `countableMinutesByDay`, the same caps the league and
 * the ATAR's effort component apply, so a cell can never read hotter than the
 * board this page claims to agree with.
 */
export function heatCalendar(events = [], today, weeks = 4) {
    const day0 = asDay(today) || dayKey(new Date());
    const thisMonday = dayKey(weekStart(new Date(`${day0}T00:00:00`)));
    const start = shiftDays(thisMonday, -7 * (weeks - 1));
    const end = shiftDays(thisMonday, 6);
    const byDay = countableMinutesByDay(events, start, day0);

    const rows = [];
    for (let w = 0; w < weeks; w++) {
        const monday = shiftDays(start, w * 7);
        const cells = [];
        for (let i = 0; i < 7; i++) {
            const day = shiftDays(monday, i);
            const future = day > day0;
            const minutes = future ? 0 : (byDay.get(day) || 0);
            cells.push({ day, minutes, level: future ? 0 : heatLevel(minutes), future, today: day === day0 });
        }
        rows.push({ monday, cells });
    }
    const all = rows.flatMap((r) => r.cells).filter((c) => !c.future);
    return {
        start, end, rows,
        active: all.filter((c) => c.minutes > 0).length,
        total: all.reduce((s, c) => s + c.minutes, 0),
    };
}
