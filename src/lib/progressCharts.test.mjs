/**
 * progressCharts assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/progressCharts.test.mjs
 *
 * ═══ A CHART THAT IS WRONG RENDERS PERFECTLY ════════════════════════════════
 * A dot on the wrong day, a trend through two points, a funnel that widens, a
 * Saturday that has not happened yet shaded as a day off — every one of those
 * draws cleanly and passes lint, the build and a glance. Only something that
 * reads what the derivations return can say so, which is why they are pure and
 * why this file exists.
 *
 * The refusals are the same ones the rest of the report keeps: a trend needs
 * `TREND_MIN` sits on BOTH halves, a row with no date is never plotted, an
 * empty day is a gap for an average and a zero only for a count, and nothing
 * is projected — a card does not appear on Thursday because it might be
 * failed on Tuesday.
 *
 * Every check below was verified by putting the bug back.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import {
    strengthStack, reviewForecast, sitPlot, fixFunnel, heatCalendar, heatLevel,
    MIN_SHARE, FUNNEL, HEAT_STEPS,
} from "@/lib/progressCharts";
import { TREND_MIN } from "@/lib/quizDeck";
import { isReady } from "@/lib/due";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};
const read = (rel) => fs.readFileSync(rel, "utf8");
const strip = (src) => src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");

const TODAY = "2026-10-15"; // a Thursday
const day = (n) => {
    const d = new Date(`${TODAY}T00:00:00`);
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/* ─── Cards: the deck as one band ─────────────────────────────────────────── */

check("the band adds up to exactly the track", () => {
    const { segments, total } = strengthStack([
        { id: "strong", n: 120 }, { id: "fair", n: 40 }, { id: "weak", n: 2 }, { id: "fresh", n: 38 },
    ]);
    assert.equal(total, 200);
    const sum = segments.reduce((s, x) => s + x.width, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, `the band is ${sum} of the track`);
});

check("A CATEGORY THE STUDENT HAS NEVER VANISHES — it is floored at MIN_SHARE", () => {
    const { segments } = strengthStack([{ id: "strong", n: 997 }, { id: "weak", n: 3 }]);
    const weak = segments.find((s) => s.id === "weak");
    assert.ok(weak.width >= MIN_SHARE, `three weak cards drew at ${weak.width}`);
    assert.ok(Math.abs(weak.share - 0.003) < 1e-9, "the floor rewrote the real share it reports");
});

check("an empty band is no segments, and an empty category is not drawn", () => {
    assert.deepEqual(strengthStack([]), { total: 0, segments: [] });
    assert.deepEqual(strengthStack([{ id: "a", n: 0 }]).segments, []);
    assert.equal(strengthStack([{ id: "a", n: 4 }, { id: "b", n: 0 }]).segments.length, 1);
});

/* ─── Cards: the next seven days ──────────────────────────────────────────── */

const fresh = (over = {}) => ({ repetitions: 0, total_reviews: 0, next_review_date: TODAY, ...over });
const learned = (next, over = {}) => ({ repetitions: 3, total_reviews: 3, interval_days: 10, next_review_date: next, ...over });

check("today is what can be sat RIGHT NOW, split into reviews and never-opened", () => {
    const cards = [fresh(), fresh(), learned(day(-2)), learned(day(0)), learned(day(3))];
    const [today] = reviewForecast(cards, TODAY);
    assert.equal(today.total, cards.filter((c) => isReady(c, TODAY)).length, "today disagrees with isReady");
    assert.equal(today.fresh, 2);
    assert.equal(today.review, 2);
});

check("a later day counts only the cards SCHEDULED for exactly that day", () => {
    const cards = [learned(day(1)), learned(day(3)), learned(day(3)), learned(day(9)), fresh()];
    const f = reviewForecast(cards, TODAY);
    assert.equal(f.length, 7);
    assert.deepEqual(f.slice(1).map((d) => d.total), [1, 0, 2, 0, 0, 0]);
    assert.ok(f.slice(1).every((d) => d.fresh === 0), "a never-opened card was projected onto a later day");
});

check("a snooze lands where the scheduler will put it, and a known card nowhere", () => {
    const cards = [
        learned(day(1), { snoozed_until: day(4) }),
        learned(day(2), { retired_at: "2026-10-01T00:00:00Z" }),
    ];
    const f = reviewForecast(cards, TODAY);
    assert.equal(f[1].total, 0, "a snoozed card came back on its old date");
    assert.equal(f[4].total, 1, "a snoozed card was lost instead of landing on its snooze");
    assert.equal(f[2].total, 0, "a card put away as known came back");
});

/* ─── Quizzes: every sit, where it happened ───────────────────────────────── */

const sit = (id, d, score, over = {}) => ({ id, quiz_id: "q1", date: d, created_date: `${d}T10:00:00Z`, score, ...over });
const RANGE = { from: day(-27), to: TODAY };

check("A RETRY IS NOT A SIT, and an unmarked attempt is not a zero", () => {
    const plot = sitPlot([
        sit("a", day(-5), 60),
        sit("retry", day(-4), 0, { extra: { is_retry: true } }),
        sit("unmarked", day(-3), null),
    ], [{ id: "q1", title: "Redox", subject: "Chemistry" }], RANGE, TODAY);
    assert.deepEqual(plot.points.map((p) => p.key), ["a"]);
    assert.equal(plot.mean, 60, "a retry or an unmarked attempt moved the average");
});

check("A ROW WITH NO DATE IS NEVER PLOTTED — not at the left edge as the oldest result", () => {
    const plot = sitPlot([sit("a", day(-5), 70), { id: "x", quiz_id: "q1", score: 10 }], [], RANGE, TODAY);
    assert.deepEqual(plot.points.map((p) => p.key), ["a"]);
});

check("the adjusted score is the one plotted", () => {
    const plot = sitPlot([sit("a", day(-1), 60, { adjusted_score: 78 })], [], RANGE, TODAY);
    assert.equal(plot.points[0].score, 78, "the chart plotted the raw score the results screen does not show");
});

check("a sit lands on its own day, and sits on one day are spread across it in order", () => {
    const plot = sitPlot([
        sit("late", day(-2), 50, { created_date: `${day(-2)}T15:00:00Z` }),
        sit("early", day(-2), 90, { created_date: `${day(-2)}T09:00:00Z` }),
        sit("other", day(-10), 70),
    ], [], RANGE, TODAY);
    const by = Object.fromEntries(plot.points.map((p) => [p.key, p]));
    assert.ok(by.other.x < by.early.x && by.early.x < by.late.x, "the sits are out of order");
    const span = 28;
    const slot = (n) => (27 - n) / span;
    assert.ok(by.early.x >= slot(2) && by.late.x < slot(2) + 1 / span, "a sit was placed outside its own day");
    assert.ok(plot.points.every((p) => p.x > 0 && p.x < 1));
});

check("THE TREND IS EARNED: TREND_MIN sits on BOTH halves, or nothing is drawn", () => {
    const short = Array.from({ length: TREND_MIN * 2 - 1 }, (_, i) => sit(`s${i}`, day(-20 + i), 50 + i * 10));
    const none = sitPlot(short, [], RANGE, TODAY);
    assert.equal(none.trend, null, "a direction was drawn through too few sits");
    assert.equal(none.need, 1, "it does not say how many more unlock it");
    const enough = sitPlot([...short, sit("last", day(-1), 95)], [], RANGE, TODAY);
    assert.ok(enough.trend, "enough sits and still no trend");
    assert.equal(enough.trend.n, TREND_MIN);
    assert.equal(enough.need, 0);
});

check("the trend runs earlier half to later half, in time order, whatever order rows arrive in", () => {
    const rows = [sit("d", day(-1), 90), sit("a", day(-20), 40), sit("c", day(-5), 80), sit("b", day(-15), 50)];
    const { trend } = sitPlot(rows, [], RANGE, TODAY);
    assert.deepEqual(trend, { from: 45, to: 85, n: 2 });
});

check("outside the window is outside the plot", () => {
    const plot = sitPlot([sit("old", day(-40), 30), sit("in", day(-3), 80)], [], RANGE, TODAY);
    assert.deepEqual(plot.points.map((p) => p.key), ["in"]);
});

/* ─── Mistakes: the funnel ────────────────────────────────────────────────── */

check("THE FUNNEL ONLY NARROWS — each stage is everything that reached at least that far", () => {
    const f = fixFunnel([
        { state: "fixed", n: 2 }, { state: "drilled", n: 3 }, { state: "working", n: 4 },
        { state: "slipping", n: 1 }, { state: "new", n: 5 },
    ]);
    assert.deepEqual(f.map((s) => s.id), FUNNEL.map((s) => s.id));
    assert.deepEqual(f.map((s) => s.n), [15, 10, 5, 2]);
    for (let i = 1; i < f.length; i++) assert.ok(f[i].n <= f[i - 1].n, `the funnel widens at ${f[i].id}`);
});

check("a card that slipped back was started, and has not been drilled", () => {
    const f = Object.fromEntries(fixFunnel([{ state: "slipping", n: 3 }]).map((s) => [s.id, s.n]));
    assert.equal(f.started, 3);
    assert.equal(f.drilled, 0, "a slipping card was counted as drilled");
});

check("an empty bank is a funnel of zeroes, never NaN", () => {
    const f = fixFunnel([]);
    assert.ok(f.every((s) => s.n === 0 && s.share === 0));
});

/* ─── Hours: four weeks of evenings ───────────────────────────────────────── */

const ev = (d, minutes) => ({ day: d, minutes });

check("four Monday-anchored weeks, ending with this one", () => {
    const h = heatCalendar([], TODAY);
    assert.equal(h.rows.length, 4);
    assert.equal(h.rows[3].monday, "2026-10-12", "the last row is not this week");
    assert.equal(h.start, "2026-09-21");
    assert.ok(h.rows.every((r) => r.cells.length === 7 && new Date(`${r.monday}T00:00:00`).getDay() === 1));
});

check("A DAY THAT HAS NOT HAPPENED IS FUTURE, never an empty day off", () => {
    const h = heatCalendar([ev(day(1), 60)], TODAY);
    const cells = h.rows[3].cells;
    const fri = cells.find((c) => c.day === day(1));
    assert.equal(fri.future, true);
    assert.equal(fri.minutes, 0, "a row dated in the future was counted");
    assert.ok(cells.find((c) => c.day === TODAY).today);
    assert.equal(h.active, 0);
});

check("a cell reads the same caps the league does — never hotter than the board", () => {
    const h = heatCalendar([ev(day(-3), 600), ev(day(-3), 600)], TODAY);
    const cell = h.rows.flatMap((r) => r.cells).find((c) => c.day === day(-3));
    assert.ok(cell.minutes <= 720, `${cell.minutes} uncapped minutes on one day`);
    assert.ok(cell.minutes > 0);
});

check("the shading steps are fixed and printed, not rescaled to this month", () => {
    assert.equal(heatLevel(0), 0);
    assert.equal(heatLevel(null), 0, "Number(null) shaded a day nobody studied");
    assert.equal(heatLevel(HEAT_STEPS[0] - 1), 1);
    assert.equal(heatLevel(HEAT_STEPS[0]), 2);
    assert.equal(heatLevel(HEAT_STEPS[HEAT_STEPS.length - 1]), HEAT_STEPS.length + 1);
    const quiet = heatCalendar([ev(day(-2), 15)], TODAY);
    const cell = quiet.rows.flatMap((r) => r.cells).find((c) => c.day === day(-2));
    assert.equal(cell.level, 1, "a quiet month's best day was drawn at full heat");
});

/* ─── The page ────────────────────────────────────────────────────────────── */

check("every feature tab is handed its chart", () => {
    const review = strip(read("src/pages/Review.jsx"));
    for (const tab of ["cards", "quizzes", "mistakes", "hours"]) {
        assert.match(review, new RegExp(`chart=\\{charts\\?\\.${tab}\\}|chart=\\{charts\\.${tab}\\}`), `the ${tab} tab gets no chart`);
    }
});

check("the sit chart draws a trend only when the plot earned one", () => {
    const src = strip(read("src/components/progress/Signature.jsx"));
    const uses = [...src.matchAll(/plot\.trend\.(from|to)/g)].length;
    assert.ok(uses >= 2, "the trend is not drawn from plot.trend at all");
    // Every element reading the trend's ends sits behind a `plot.trend &&` gate.
    const gates = [...src.matchAll(/\{plot\.trend && \(/g)].length;
    assert.ok(gates >= 2, `the line and its marker are not both gated (found ${gates})`);
});

console.log(`\nprogressCharts: ${passed} checks passed`);
