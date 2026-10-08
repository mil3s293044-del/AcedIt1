/**
 * progressReport — the Progress page as a REPORT rather than a wall of panels.
 *
 * ─── WHAT WAS WRONG WITH ONE LONG SCROLL ────────────────────────────────────
 * Every number the app knows arrived at once, in one column, with nothing
 * saying which feature it was about or whether it was good. A student met a
 * wave of true figures and could not tell what any of them were asking of
 * them. The fix is not fewer numbers — it is that each feature gets its own
 * screen, and each screen opens with a VERDICT rather than a chart.
 *
 * ─── THE SHAPE IS THE SAME FOUR THINGS EVERY TIME ───────────────────────────
 * One headline figure · how it moved against the student's OWN previous period
 * · one sentence saying what that means · then the breakdown. Learned once on
 * the first tab and read instantly on the other three, which is the whole
 * reason a report reads faster than a dashboard carrying the same data.
 *
 * ─── EVERY FIGURE IS DERIVED AND CHECKABLE ──────────────────────────────────
 * Nothing here is stored and nothing is a composite the student cannot take
 * apart. There is deliberately NO "progress score out of 100": the app already
 * has one number everything is standardised around, the AcedIt ATAR, and a
 * second invented scale on the page next to it would be a figure nobody can
 * argue with competing with the one they can. The same refusal `closingFacts`
 * makes on the first-run screen and the console makes about its own lattice.
 *
 * ─── A COMPARISON NEEDS LIKE FOR LIKE, AND THE WEEK IS THE TRAP ─────────────
 * Trailing-28 against the 28 before it is fair by construction. "This week" is
 * NOT: it is Monday-to-now, so comparing it against a whole previous week tells
 * every student they are behind until Sunday — which is exactly the trap
 * `weekPace` was written to close, met again one module over. The previous
 * window is cut to the SAME NUMBER OF DAYS, so Wednesday is measured against
 * Wednesday.
 *
 * ─── AND IT REFUSES RATHER THAN SCORING SOMEBODY ON TWO DATA POINTS ─────────
 * Every delta has a floor on BOTH sides and returns null under it, with a note
 * saying how many more are needed. Telling a student their average "fell 9
 * points" off one sit either way is a personality judgement made off a coin
 * flip — the rule `TREND_MIN`, `CALIBRATION_MIN`, `MARK_MIN_OBS` and
 * `MIN_BASELINE_WEEKS` each already keep.
 *
 * ─── ONE LIMIT WORTH KNOWING ────────────────────────────────────────────────
 * Flashcards store SM-2 COUNTERS, not a review log: there is one
 * `last_reviewed_date` per card and lifetime tallies beside it. So "cards
 * reviewed in a period" counts a card ONCE however many times it came up, and
 * accuracy is lifetime and says so on the tile. The undercount is in the same
 * direction in both windows, so the delta stays fair; a per-review log is what
 * it would take to do better, and that is a migration rather than a function.
 */

import { dayKey, weekStart } from "@/lib/studyLog";
import { sitScores, effectiveScore, TREND_MIN } from "@/lib/quizDeck";
import { isRetryAttempt, isLegacyRetry, commandTermStats } from "@/lib/quizInsight";
import { retentionOutlook } from "@/lib/retention";
import { cardMastery } from "@/lib/mastery";
import { bankSummary, isRetired, fixState, repeatOffenders } from "@/lib/mistakeBank";
import { countableByDay } from "@/lib/integrity";

/** The three windows, in the order the switch draws them. */
export const PERIODS = [
    { id: "week", label: "Week", blurb: "since Monday" },
    { id: "month", label: "Month", blurb: "last 28 days" },
    { id: "all", label: "All", blurb: "everything you have logged" },
];

export const MONTH_DAYS = 28;

/** Sits needed on BOTH sides before an average is compared. */
export const SIT_FLOOR = TREND_MIN;
/** Days with something logged, before effort is compared. */
export const DAY_FLOOR = 2;

/**
 * "YYYY-MM-DD", or null.
 *
 * THE SHAPE IS CHECKED, not the length. The obvious version takes the first ten
 * characters and accepts anything that long — so `String({})` slices to
 * "[object Ob", which is ten characters, passes, and then compares as a string
 * against every real day. It sorts above "2026-…", so on an unbounded window
 * (which is what "All" passes) a junk value counts as a row that happened. Its
 * own test found this; nothing on screen would have.
 */
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const isDay = (v) => {
    if (typeof v !== "string" && !(v instanceof Date)) return null;
    const d = (v instanceof Date ? dayKey(v) : v).slice(0, 10);
    return DAY_RE.test(d) ? d : null;
};

const shiftDays = (iso, n) => {
    const d = new Date(`${iso}T00:00:00`);
    d.setDate(d.getDate() + n);
    return dayKey(d);
};

/**
 * The window, and the window before it.
 *
 * `from` is INCLUSIVE and `to` is inclusive, both as "YYYY-MM-DD". `all`
 * carries no bounds and no previous window, which is what makes every delta on
 * it null rather than a comparison against nothing.
 */
export function periodRange(id = "week", now = new Date()) {
    const today = dayKey(now instanceof Date ? now : new Date(now));
    // THE RANGE CARRIES ITS OWN WORDS. Every tab prints "Average {blurb}", so a
    // range without one renders the literal string "undefined" into six
    // headings — which throws nothing, passes every test that does not look at
    // the screen, and is exactly what the first screenshot showed.
    const meta = PERIODS.find((p) => p.id === id) || PERIODS[0];

    if (id === "all") {
        return { id: "all", from: null, to: today, prevFrom: null, prevTo: null, days: null, label: meta.label, blurb: meta.blurb, comparable: false };
    }

    if (id === "month") {
        const from = shiftDays(today, -(MONTH_DAYS - 1));
        return {
            id: "month", from, to: today,
            prevFrom: shiftDays(from, -MONTH_DAYS), prevTo: shiftDays(from, -1),
            days: MONTH_DAYS, label: meta.label, blurb: meta.blurb, comparable: true,
        };
    }

    // THE WEEK IS MONDAY-ANCHORED and the previous window is cut to the SAME
    // LENGTH. Against a whole previous week every student is behind until
    // Sunday — `weekPace`'s lesson, and the reason this is not just `-7`.
    const from = dayKey(weekStart(now instanceof Date ? now : new Date(now)));
    const span = Math.max(1, Math.round((new Date(`${today}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86400000) + 1);
    const prevFrom = shiftDays(from, -7);
    return {
        id: "week", from, to: today,
        prevFrom, prevTo: shiftDays(prevFrom, span - 1),
        days: span, label: meta.label, blurb: meta.blurb, comparable: true,
    };
}

/**
 * Is this row's day inside [from, to]?
 *
 * A row with NO DATE is never inside anything. `Number(null)` is 0 and an empty
 * string slices LOW, so a coerced comparison files every undated row outside
 * the window and the obvious "fix" of defaulting it to today files every one of
 * them inside it. Both are wrong and only one is visible.
 */
export const within = (value, from, to) => {
    const d = isDay(value);
    if (!d) return false;
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
};

const dayOfRow = (r) => isDay(r?.date) || isDay(r?.created_date);

/**
 * ─── THE LINE UNDER THE FIGURE ──────────────────────────────────────────────
 * One point per day in the window, from rows the report already has — no new
 * query, nothing stored, and it cannot disagree with the headline because it
 * is built from the same array.
 *
 * TWO KINDS OF QUANTITY, and conflating them is the bug this signature
 * exists to prevent. A COUNT (cards reviewed, minutes studied) has a real
 * zero: a day with nothing in it is a day you did nothing, so it plots at the
 * floor. An AVERAGE (a quiz score) does NOT: a day with no sit is a day with
 * no information, and plotting it as zero draws a rest day as having scored
 * nothing — the `Number(null) === 0` family, pointed at a chart. So an
 * aggregate is only emitted for days that HAVE rows, and `value` is null
 * everywhere else for the renderer to break the line on.
 *
 * `all` is unbounded, so it draws nothing rather than a line whose x-axis is
 * however long the account has existed.
 */
export function dailySeries(range, rows = [], dayOfRow_, aggregate = null) {
    if (!range?.from || range.id === "all") return [];
    const buckets = new Map();
    for (const r of (Array.isArray(rows) ? rows : [])) {
        const d = dayOfRow_(r);
        if (!d || d < range.from || d > range.to) continue;
        if (!buckets.has(d)) buckets.set(d, []);
        buckets.get(d).push(r);
    }
    const out = [];
    for (let d = range.from; d <= range.to; d = shiftDays(d, 1)) {
        const hit = buckets.get(d);
        if (aggregate) out.push({ day: d, value: hit ? aggregate(hit) : null });
        else out.push({ day: d, value: hit ? hit.length : 0 });
        if (out.length > 60) break;
    }
    return out;
}

/**
 * A movement, or null.
 *
 * NULL rather than 0 under the floor, and null when the period has no
 * predecessor. 0 means "holding steady" and must never double as "I do not
 * know yet" — the rule `trend` already keeps on the Quizzes shelf.
 */
export function deltaOf(now, before, { floorNow = 0, floorBefore = 0, higherIsBetter = true } = {}) {
    if (!Number.isFinite(now) || !Number.isFinite(before)) return null;
    if (floorNow > 0 || floorBefore > 0) {
        // The caller passes the COUNTS behind each side as the floors; both
        // have to clear or the comparison is one sit against one sit.
        if (floorNow < 0 || floorBefore < 0) return null;
    }
    const diff = now - before;
    return { value: diff, better: higherIsBetter ? diff > 0 : diff < 0, flat: diff === 0 };
}

// ─── CARDS ──────────────────────────────────────────────────────────────────

/**
 * Flashcards, over the window.
 *
 * The headline is REVIEWS because that is the only card figure a period can
 * honestly carry (see the header). Accuracy is lifetime and the tile says so
 * rather than implying it moved this week.
 */
export function cardsReport(cards = [], range, now = Date.now()) {
    const live = (Array.isArray(cards) ? cards : []).filter((c) => !isRetired(c));
    const reviewed = live.filter((c) => within(c?.last_reviewed_date, range.from, range.to)).length;
    const prior = range.comparable
        ? live.filter((c) => within(c?.last_reviewed_date, range.prevFrom, range.prevTo)).length
        : null;

    // LIFETIME, from the SM-2 counters. Good + easy against every rating given.
    let good = 0, total = 0;
    for (const c of live) {
        const g = Number(c?.review_count_good) || 0;
        const e = Number(c?.review_count_easy) || 0;
        const h = Number(c?.review_count_hard) || 0;
        const a = Number(c?.review_count_again) || 0;
        good += g + e;
        total += g + e + h + a;
    }
    const accuracy = total > 0 ? Math.round((good / total) * 100) : null;

    // The pile as it stands, and what is slipping out of reach.
    const outlook = retentionOutlook(live, { now });

    // Mastery as a DISTRIBUTION rather than an average: "your deck averages
    // 61%" is a number nobody can act on, and four bands say where the work is.
    const bands = [
        { id: "strong", label: "Solid", min: 80, n: 0 },
        { id: "fair", label: "Getting there", min: 50, n: 0 },
        { id: "weak", label: "Shaky", min: 20, n: 0 },
        { id: "fresh", label: "Barely seen", min: 0, n: 0 },
    ];
    for (const c of live) {
        // `cardMastery` ALREADY RETURNS 0-100 — it ends in `Math.round(raw * 100)`.
        // The obvious normalise (`m <= 1 ? m * 100 : m`) reads a card sitting at
        // a mastery of 1 as a card at 100%, which is the worst card in the deck
        // drawn as the best, and it renders perfectly.
        const m = Number(cardMastery(c));
        const pct = Number.isFinite(m) ? m : 0;
        const band = bands.find((b) => pct >= b.min) || bands[bands.length - 1];
        band.n += 1;
    }

    return {
        kind: "cards",
        total: live.length,
        reviewed,
        prior,
        series: dailySeries(range, live, (c) => isDay(c?.last_reviewed_date)),
        delta: prior == null ? null : deltaOf(reviewed, prior),
        accuracy,
        ratings: total,
        // A COUNT, not an array — `?.length` on it is undefined, which coerces
        // to 0 and silently reports every deck as holding.
        slipping: Number(outlook?.slipping) || 0,
        bands: bands.filter((b) => b.n > 0),
    };
}

// ─── QUIZZES ────────────────────────────────────────────────────────────────

/** Attempts that may be MEASURED: a sit, scored, and never a "wrong only" retry. */
export const measurable = (attempts = []) => (Array.isArray(attempts) ? attempts : [])
    .filter((a) => a && !isRetryAttempt(a) && !isLegacyRetry(a) && effectiveScore(a) != null);

const mean = (xs) => (xs.length ? xs.reduce((s, n) => s + n, 0) / xs.length : null);

export function quizzesReport(attempts = [], quizzes = [], range) {
    const all = measurable(attempts);
    const inWindow = all.filter((a) => within(dayOfRow(a), range.from, range.to));
    const before = range.comparable
        ? all.filter((a) => within(dayOfRow(a), range.prevFrom, range.prevTo))
        : [];

    const now = sitScores(inWindow);
    const prev = sitScores(before);
    const avg = mean(now);
    const prevAvg = mean(prev);

    // BOTH SIDES clear the floor or there is no comparison — one sit either way
    // is the difference between two papers printed as a direction.
    const delta = (now.length >= SIT_FLOOR && prev.length >= SIT_FLOOR && avg != null && prevAvg != null)
        ? deltaOf(Math.round(avg), Math.round(prevAvg))
        : null;

    const need = Math.max(0, SIT_FLOOR - now.length);

    // Per subject, off the quiz the attempt belongs to. A sit whose quiz is
    // gone keeps counting — deleting a quiz does not delete its attempts, and
    // losing a result because a library was tidied is the worse failure.
    const titleOf = new Map((Array.isArray(quizzes) ? quizzes : []).map((q) => [String(q?.id), q]));
    const bySubject = new Map();
    for (const a of inWindow) {
        const q = titleOf.get(String(a?.quiz_id));
        const name = q?.subject || a?.quiz_category || null;
        if (!name) continue;
        if (!bySubject.has(name)) bySubject.set(name, []);
        bySubject.get(name).push(effectiveScore(a));
    }
    const subjects = [...bySubject.entries()]
        .map(([subject, scores]) => ({ subject, sits: scores.length, avg: Math.round(mean(scores)) }))
        .sort((a, b) => a.avg - b.avg);

    // The command terms costing marks. Already written, read by nothing until
    // now — the "collect nothing you don't use" rule, inverted, on the most
    // examiner-like statistic this app can produce.
    // IT RETURNS `{ rows, weakest, strongest, hasGap }`, NOT AN ARRAY — and a
    // row is keyed `id`/`label`, never `term`. Read as a list it is empty every
    // time and the panel silently never draws, which is the half-wired shape
    // this codebase keeps meeting.
    const terms = commandTermStats(inWindow)?.rows || [];

    return {
        kind: "quizzes",
        sits: now.length,
        // THE LINE PLOTS WHAT THE HEADLINE SAYS, which here is an average and
        // not a count — so a day with no sit has NO POINT rather than a zero.
        // Plotted as zero, a rest day reads as having scored nothing.
        series: dailySeries(range, inWindow, (a) => dayOfRow(a),
            (rows) => Math.round(mean(rows.map(effectiveScore)))),
        avg: avg == null ? null : Math.round(avg),
        prevSits: prev.length,
        prevAvg: prevAvg == null ? null : Math.round(prevAvg),
        delta,
        need,
        best: now.length ? Math.round(Math.max(...now)) : null,
        subjects,
        terms: terms.filter((t) => t && Number.isFinite(t.pct)).slice(0, 6),
    };
}

// ─── MISTAKES ───────────────────────────────────────────────────────────────

export function mistakesReport(bankCards = [], attempts = [], isReady = () => false, range) {
    const rows = Array.isArray(bankCards) ? bankCards : [];
    const summary = bankSummary(rows, isReady, attempts) || {};

    const banked = rows.filter((c) => within(c?.created_date, range.from, range.to)).length;
    const drilled = rows.filter((c) => within(c?.last_reviewed_date, range.from, range.to)).length;
    const priorDrilled = range.comparable
        ? rows.filter((c) => within(c?.last_reviewed_date, range.prevFrom, range.prevTo)).length
        : null;

    // The ladder, as a distribution. `fixState` is the one reader of what
    // "fixed" means, so the shelf and this cannot disagree about a card.
    const states = new Map();
    for (const c of rows) {
        if (isRetired(c)) continue;
        const s = fixState(c, attempts) || "new";
        states.set(s, (states.get(s) || 0) + 1);
    }

    const repeats = (repeatOffenders(rows, { attempts }) || []).slice(0, 5);

    return {
        kind: "mistakes",
        total: Number(summary.total) || rows.filter((c) => !isRetired(c)).length,
        fixed: Number(summary.fixed) || 0,
        ready: Number(summary.ready) || 0,
        banked,
        drilled,
        delta: priorDrilled == null ? null : deltaOf(drilled, priorDrilled),
        states: [...states.entries()].map(([state, n]) => ({ state, n })),
        repeats,
    };
}

// ─── HOURS ──────────────────────────────────────────────────────────────────

/**
 * Minutes, capped the way every ranked surface caps them.
 *
 * `countableByDay` is `integrity.js`'s own client mirror, so the figure on this
 * page is the figure the league and the ATAR's effort component count — a
 * report that printed raw `duration_minutes` would read higher than every board
 * in the app and the student would be right to believe the bigger one.
 */
function minutesIn(events, from, to) {
    const rows = (Array.isArray(events) ? events : []).filter((e) => within(e?.day, from, to));
    // IT YIELDS A RECORD PER DAY, not a number: `{ claimed, counted, capped }`.
    // Read as a scalar every day coerces to NaN and the whole report prints
    // zero minutes at somebody who studied all week.
    const byDay = countableByDay(rows.map((e) => ({ date: e.day, duration_minutes: e.minutes })));
    let total = 0;
    const days = new Map();
    const entries = byDay instanceof Map ? [...byDay.entries()] : Object.entries(byDay || {});
    for (const [day, rec] of entries) {
        const n = Number(rec?.counted) || 0;
        if (n <= 0) continue;
        total += n;
        days.set(day, n);
    }
    return { total: Math.round(total), days };
}

export function hoursReport(events = [], techniques = [], range) {
    const now = minutesIn(events, range.from, range.to);
    const before = range.comparable ? minutesIn(events, range.prevFrom, range.prevTo) : null;

    const activeDays = now.days.size;
    const delta = (before && activeDays >= DAY_FLOOR && before.days.size >= DAY_FLOOR)
        ? deltaOf(now.total, before.total)
        : null;

    // Which TECHNIQUES the time went into. `technique_name` is the Study page's
    // own vocabulary, so a row it does not recognise is kept under its own name
    // rather than folded into "other" — a bucket nobody can act on.
    const byTech = new Map();
    for (const t of (Array.isArray(techniques) ? techniques : [])) {
        if (!within(dayOfRow(t), range.from, range.to)) continue;
        const name = String(t?.technique_name || "").trim();
        if (!name) continue;
        const mins = Number(t?.session_duration) || Number(t?.duration_minutes) || 0;
        if (mins <= 0) continue;
        byTech.set(name, (byTech.get(name) || 0) + mins);
    }
    const techniquesUsed = [...byTech.entries()]
        .map(([name, minutes]) => ({ name, minutes: Math.round(minutes) }))
        .sort((a, b) => b.minutes - a.minutes);

    // Day by day, oldest first, so the strip reads left to right like a week.
    const bars = [];
    if (range.from) {
        for (let d = range.from; d <= range.to; d = shiftDays(d, 1)) {
            bars.push({ day: d, minutes: now.days.get(d) || 0 });
            if (bars.length > 60) break;      // `all` never draws a strip; this is the guard
        }
    }

    return {
        kind: "hours",
        minutes: now.total,
        series: (range.id === "all" ? [] : bars).map((b) => ({ day: b.day, value: b.minutes })),
        prevMinutes: before ? before.total : null,
        delta,
        activeDays,
        span: range.days,
        perActiveDay: activeDays ? Math.round(now.total / activeDays) : null,
        techniques: techniquesUsed,
        bars: range.id === "all" ? [] : bars,
        needDays: Math.max(0, DAY_FLOOR - activeDays),
    };
}

// ─── THE SENTENCE UNDER THE FIGURE ──────────────────────────────────────────

/**
 * One line per tab, and it is allowed to say NOTHING.
 *
 * A verdict is only ever printed off a real comparison or a fact the student
 * can check on the screen beside it. Padding this to always produce a sentence
 * is how a page teaches somebody that its words are decoration — the rule the
 * dashboard rail and `closingFacts` both keep, pointed at prose instead of a
 * number.
 */
export function verdictFor(report, range) {
    if (!report) return null;
    const period = range?.id === "week" ? "last week" : range?.id === "month" ? "the 28 days before" : null;

    if (report.kind === "quizzes") {
        if (!report.sits) return null;
        if (report.delta && period) {
            const n = Math.abs(report.delta.value);
            if (!n) return { tone: "flat", line: `Your average is level with ${period}, across ${report.sits} sits.` };
            const worst = report.subjects[0];
            // `subjects` is sorted WEAKEST FIRST, so [0] is the one costing the
            // most. "Pulling hardest" reads as the one carrying you, which is
            // the opposite subject — a sentence that renders perfectly and
            // sends a student to revise the thing they are already best at.
            const tail = worst && report.subjects.length > 1
                ? ` ${worst.subject} is costing you most, at ${worst.avg}%.`
                : "";
            return report.delta.better
                ? { tone: "good", line: `Up ${n} points on ${period}.${tail}` }
                : { tone: "watch", line: `Down ${n} points on ${period}.${tail}` };
        }
        if (report.need > 0 && period) {
            return { tone: "flat", line: `${report.need} more ${report.need === 1 ? "sit" : "sits"} and this starts comparing you against ${period}.` };
        }
        return null;
    }

    if (report.kind === "cards") {
        if (!report.total) return null;
        if (report.slipping > 0) {
            return { tone: "watch", line: `${report.slipping} ${report.slipping === 1 ? "card has" : "cards have"} fallen past reliable recall — still yours today, not next week.` };
        }
        if (report.delta && period) {
            const n = Math.abs(report.delta.value);
            if (!n) return { tone: "flat", line: `The same number of cards as ${period}.` };
            return report.delta.better
                ? { tone: "good", line: `${n} more cards than ${period}, and nothing has slipped past recall.` }
                : { tone: "watch", line: `${n} fewer cards than ${period}.` };
        }
        return null;
    }

    if (report.kind === "mistakes") {
        if (!report.total) return null;
        const left = report.total - report.fixed;
        if (!left) return { tone: "good", line: "Every mistake you have banked is fixed." };
        if (report.repeats.length) {
            const r = report.repeats[0];
            const times = Number(r?.count) || 0;
            if (times > 1) {
                return { tone: "watch", line: `One criterion has cost you ${times} times — that is one thing to fix, not ${times}.` };
            }
        }
        return { tone: "flat", line: `${left} still ${left === 1 ? "open" : "open"}, ${report.ready} ready to drill right now.` };
    }

    if (report.kind === "hours") {
        if (!report.minutes) return null;
        if (report.delta && period) {
            const n = Math.abs(report.delta.value);
            if (n < 5) return { tone: "flat", line: `Within five minutes of ${period}.` };
            return report.delta.better
                ? { tone: "good", line: `${n} minutes more than ${period}, over ${report.activeDays} days.` }
                : { tone: "watch", line: `${n} minutes fewer than ${period}, over ${report.activeDays} days.` };
        }
        if (report.needDays > 0 && period) {
            return { tone: "flat", line: `One more day logged and this starts comparing you against ${period}.` };
        }
        return null;
    }

    return null;
}

/** Minutes a student would say them. Null under a minute, never "0m". */
export function hhmm(mins) {
    const n = Number(mins);
    if (!Number.isFinite(n) || n < 1) return null;
    const h = Math.floor(n / 60);
    const m = Math.round(n % 60);
    if (!h) return `${m}m`;
    return m ? `${h}h ${m}m` : `${h}h`;
}

/**
 * ─── WHICH OUTSTANDING WORK BELONGS TO WHICH TAB ────────────────────────────
 * The action outranks the analytics, so every feature tab leads with ITS OWN
 * rows out of the one queue the Today tab draws — the same items, the same
 * order, the same model. One map rather than a list of kinds written out at
 * each call site, because a tab and its filter disagreeing is a tab that
 * silently drops a student's work.
 *
 * HOURS IS DELIBERATELY EMPTY. There is no such thing as an overdue hour:
 * nothing in `studyQueue` is about time, so that tab leads with its figure and
 * a door instead. Inventing a row to make the four tabs symmetrical is the
 * padding every builder in `studyQueue.js` already refuses.
 *
 * `assessment` belongs to no feature — a SAC is the whole term, not a
 * flashcard or a quiz — so it stays on Today, which is the tab that ranks all
 * seven kinds against each other.
 */
export const TAB_KINDS = {
    cards: ["decay", "cards"],
    quizzes: ["unmarked", "resit"],
    mistakes: ["mistakes"],
    hours: [],
};

/** This tab's slice of the queue, in the queue's own order. */
export function workFor(queue = [], tab) {
    const kinds = TAB_KINDS[tab];
    if (!kinds?.length) return [];
    return (Array.isArray(queue) ? queue : []).filter((it) => kinds.includes(it?.kind));
}

// ═══ ONE SUBJECT, ACROSS EVERY TAB ══════════════════════════════════════════
//
// Every figure on this page was whole-account, and the question a student
// actually has in the week before a SAC is about ONE subject: how are my
// Chemistry cards, my Chemistry sits, my Chemistry mistakes, my Chemistry
// hours. All four reports already group by subject internally — this is what
// exposes it, and it does so by slicing the INPUTS rather than by threading a
// subject argument through four builders.
//
// SLICING THE INPUTS IS WHAT KEEPS THE TAB COHERENT. The action rows at the
// top of each tab come out of `studyQueue`, which takes the same arrays — so
// filtering once means the work, the figure, the line and every panel are all
// about the same subject and cannot disagree. A subject threaded into the
// reports alone would leave the rows above them talking about the whole
// account, which is the "two surfaces answer one question" failure.
//
// TODAY IS NEVER FILTERED. It is the cross-feature queue that ranks all seven
// kinds against each other, so narrowing it to one subject would hide a SAC
// on Friday because the student happened to be looking at Legal.

/** A row's subject, under whichever of the three names its table uses. */
const subjectOf = (row) =>
    (row?.subject_name || row?.subject || row?.quiz_category || "").trim() || null;

/**
 * Subjects with something in them, A to Z.
 *
 * Off the rows rather than off `user_subjects`: a student who dropped a
 * subject still has its cards and its marks, and a filter that cannot reach
 * them is a filter that hides their own work. Sorted by NAME and not by
 * volume, because a control whose options move between visits is one nobody
 * can learn.
 */
export function subjectsIn({ cards = [], attempts = [], quizzes = [], bankCards = [], events = [] } = {}) {
    const seen = new Set();
    const add = (n) => { if (n) seen.add(n); };
    for (const c of cards) add(subjectOf(c));
    for (const c of bankCards) add(subjectOf(c));
    for (const e of events) add(subjectOf(e));
    const byId = new Map(quizzes.map((q) => [String(q?.id), q]));
    for (const a of attempts) add(subjectOf(byId.get(String(a?.quiz_id))) || subjectOf(a));
    return [...seen].sort((a, b) => a.localeCompare(b));
}

/**
 * The same bag of rows, narrowed to one subject.
 *
 * An ATTEMPT carries no subject of its own — it is reached through its quiz,
 * which is why `quizzes` is sliced first and the attempts are matched against
 * what survives. An attempt whose quiz has been DELETED is dropped from a
 * subject view and kept by "All subjects": deleting a quiz does not delete
 * its attempts, so the account-wide average still counts it (the rule
 * `quizDeck` keeps), but there is no honest way to say which subject it was.
 */
export function sliceBySubject(bag, subject) {
    if (!subject || subject === ALL_SUBJECTS) return bag;
    const keep = (r) => subjectOf(r) === subject;
    const quizzes = (bag.quizzes || []).filter(keep);
    const ids = new Set(quizzes.map((q) => String(q?.id)));
    return {
        ...bag,
        cards: (bag.cards || []).filter(keep),
        bankCards: (bag.bankCards || []).filter(keep),
        events: (bag.events || []).filter(keep),
        techniques: (bag.techniques || []).filter(keep),
        sessions: (bag.sessions || []).filter(keep),
        assessments: (bag.assessments || []).filter(keep),
        quizzes,
        attempts: (bag.attempts || []).filter((a) => ids.has(String(a?.quiz_id))),
    };
}

/** The "no filter" value, so the control and the slice cannot disagree. */
export const ALL_SUBJECTS = "__all__";
