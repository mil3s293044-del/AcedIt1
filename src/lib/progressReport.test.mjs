/**
 * progressReport assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/progressReport.test.mjs
 *
 * ═══ A REPORT MAY NOT INVENT, AND MAY NOT COMPARE OFF TWO DATA POINTS ═══════
 * Two properties carry this whole file. The first is that every figure is
 * derived from rows the page already holds — there is no stored score and no
 * composite out of 100, because the app already has one number everything is
 * standardised around and a second invented scale beside it would be a figure
 * nobody can argue with competing with the one they can.
 *
 * The second is the comparison. A delta is null under its floor and null on a
 * window with no predecessor, and the WEEK's previous window is cut to the same
 * number of days — against a whole previous week every student is behind until
 * Sunday, which is the trap `weekPace` was written to close and which this
 * module had every opportunity to reopen.
 *
 * Every check below was verified by putting the bug back.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
    PERIODS, MONTH_DAYS, SIT_FLOOR, DAY_FLOOR,
    periodRange, within, deltaOf, cardsReport, quizzesReport, mistakesReport,
    hoursReport, verdictFor, hhmm, measurable, TAB_KINDS, workFor,
} from "@/lib/progressReport";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};
const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const strip = (src) => src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

// A Thursday, so the week has days either side of "now" inside it.
const THU = new Date(2026, 9, 8, 14, 0, 0);
const day = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const back = (iso, n) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() - n); return day(d); };

// ═══ THE WINDOW ═════════════════════════════════════════════════════════════

check("the week is Monday-anchored, which is studyLog's and not date-fns' default", () => {
    const r = periodRange("week", THU);
    assert.equal(r.from, "2026-10-05", "the week does not start on Monday");
    assert.equal(r.to, "2026-10-08");
    assert.equal(r.days, 4, "Mon-Thu is four days");
});

check("THE PREVIOUS WEEK IS CUT TO THE SAME LENGTH", () => {
    // Against a whole previous week every student is behind until Sunday —
    // `weekPace`'s own lesson, and the single likeliest way to get this wrong.
    const r = periodRange("week", THU);
    assert.equal(r.prevFrom, "2026-09-28", "the previous week starts on the wrong Monday");
    assert.equal(r.prevTo, "2026-10-01",
        "the previous window is a FULL week against a part week, so every Thursday " +
        "reads as a collapse");
    const span = (a, b) => Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000) + 1;
    assert.equal(span(r.prevFrom, r.prevTo), span(r.from, r.to), "the two windows are different lengths");
});

check("the month is trailing 28 against the 28 before it", () => {
    const r = periodRange("month", THU);
    assert.equal(r.days, MONTH_DAYS);
    assert.equal(r.to, "2026-10-08");
    assert.equal(r.from, back("2026-10-08", MONTH_DAYS - 1));
    assert.equal(r.prevTo, back(r.from, 1), "the two windows overlap or leave a gap");
});

check("ALL HAS NO PREVIOUS WINDOW, so nothing on it is compared", () => {
    const r = periodRange("all", THU);
    assert.equal(r.comparable, false);
    assert.equal(r.from, null, "a bound on `all` silently hides the student's own history");
    assert.equal(r.prevFrom, null);
});

check("A ROW WITH NO DATE IS NEVER INSIDE ANY WINDOW", () => {
    // `Number(null)` is 0 and "" slices LOW, so a coerced comparison files every
    // undated row OUTSIDE and the obvious "fix" files every one of them inside.
    for (const v of [null, undefined, "", 0, {}, "nope"]) {
        assert.equal(within(v, "2026-10-01", "2026-10-31"), false, `an undated row (${JSON.stringify(v)}) was counted`);
        // AND ON AN UNBOUNDED WINDOW TOO, which is the half the first version of
        // this check missed: `all` passes null bounds, so an undated row that
        // merely sorts low is still excluded by a bounded window and would sail
        // straight into "All" — where every report would silently gain rows that
        // cannot say when they happened.
        assert.equal(within(v, null, null), false, `an undated row (${JSON.stringify(v)}) counted on an unbounded window`);
    }
    assert.equal(within("2026-10-05T09:00:00Z", "2026-10-01", "2026-10-31"), true, "a timestamp is not matched against a day");
    assert.equal(within("2026-10-05", null, null), true, "an unbounded window excluded a real day");
});

check("a delta is null rather than 0 when there is nothing to compare", () => {
    assert.equal(deltaOf(5, null), null);
    assert.equal(deltaOf(null, 5), null);
    const d = deltaOf(10, 4);
    assert.equal(d.value, 6);
    assert.equal(d.better, true);
    assert.equal(deltaOf(4, 4).flat, true, "equal periods must read as level, not as a gain");
});

// ═══ THE FOUR REPORTS ═══════════════════════════════════════════════════════

const MON = "2026-10-05";
const LAST = "2026-09-29";

check("quizzes: retries and unscored sits are never MEASURED", () => {
    const rows = [
        { id: "a", created_date: MON, score: 80, quiz_id: "q1" },
        { id: "b", created_date: MON, score: 60, quiz_id: "q1" },
        // A "wrong only" retry is on a different scale by construction.
        { id: "c", created_date: MON, score: 0, quiz_id: "q1", quiz_title: "Redox — wrong only", extra: { is_retry: true } },
        // Marking never came back — not a zero.
        { id: "d", created_date: MON, score: null, quiz_id: "q1" },
    ];
    // ASSERTED ON THE PREDICATE ITSELF, not only through the report. `sitScores`
    // already drops retries, so the headline average is right either way — and
    // the per-subject table and the command terms walk `measurable` DIRECTLY, so
    // dropping the filter here feeds a retry into both of those silently. The
    // first version of this check could not see that at all.
    assert.equal(measurable(rows).length, 2, "a retry or an unscored sit is measurable");

    const r = quizzesReport(rows, [{ id: "q1", subject: "Chemistry" }], periodRange("week", THU));
    assert.equal(r.sits, 2, "a retry or an unscored sit was averaged in");
    assert.equal(r.avg, 70);
    assert.equal(r.subjects[0].sits, 2, "a retry reached the per-subject table");
    assert.equal(r.subjects[0].avg, 70);
});

check("QUIZZES REFUSES A COMPARISON UNDER THE FLOOR, ON BOTH SIDES", () => {
    const range = periodRange("week", THU);
    const thin = quizzesReport([
        { id: "a", created_date: MON, score: 90 },
        { id: "p", created_date: LAST, score: 40 },
    ], [], range);
    assert.equal(thin.delta, null,
        "one sit either way is the difference between two papers, printed as a direction");
    assert.ok(thin.need > 0, "the page cannot say how many more are needed");

    const fat = quizzesReport([
        { id: "a", created_date: MON, score: 90 }, { id: "b", created_date: MON, score: 70 },
        { id: "p", created_date: LAST, score: 40 }, { id: "q", created_date: LAST, score: 60 },
    ], [], range);
    assert.ok(fat.delta, `${SIT_FLOOR} sits a side should compare`);
    assert.equal(fat.delta.value, 30);
    assert.equal(fat.delta.better, true);
});

check("quizzes: ALL has no delta however many sits there are", () => {
    const r = quizzesReport(
        [1, 2, 3, 4, 5].map((i) => ({ id: `a${i}`, created_date: MON, score: 70 })),
        [], periodRange("all", THU));
    assert.equal(r.delta, null, "`all` compared itself against a window that does not exist");
    assert.equal(r.sits, 5);
});

check("cards: accuracy is lifetime and the bands place every card", () => {
    const r = cardsReport([
        { id: "a", last_reviewed_date: MON, review_count_good: 3, review_count_again: 1, interval_days: 20, easiness_factor: 2.6 },
        { id: "b", last_reviewed_date: LAST, review_count_easy: 2 },
        { id: "c" },
    ], periodRange("week", THU));
    assert.equal(r.total, 3);
    assert.equal(r.reviewed, 1, "a card last reviewed last week counted as this week");
    assert.equal(r.accuracy, 83, "good+easy over every rating given");
    assert.equal(r.bands.reduce((s, b) => s + b.n, 0), 3, "a card fell through every band");
});

check("A RETIRED CARD IS NOT IN THE REPORT AT ALL", () => {
    // `retired_at` takes a card out of every queue in the app — a report that
    // counted them would tell a student they own cards they have put away.
    const r = cardsReport([
        { id: "a", last_reviewed_date: MON },
        { id: "z", last_reviewed_date: MON, retired_at: MON },
    ], periodRange("week", THU));
    assert.equal(r.total, 1);
    assert.equal(r.reviewed, 1);
});

check("hours: minutes are the COUNTABLE ones, and days are counted once", () => {
    const r = hoursReport([
        { day: MON, minutes: 30 }, { day: MON, minutes: 30 },
        { day: "2026-10-06", minutes: 45 },
        { day: LAST, minutes: 600 },
        { day: null, minutes: 999 },
    ], [], periodRange("week", THU));
    assert.equal(r.activeDays, 2, "two rows on one day counted as two days");
    assert.equal(r.minutes, 105, "last week's minutes or an undated row leaked in");
});

check("HOURS REFUSES A COMPARISON UNDER THE DAY FLOOR", () => {
    const r = hoursReport([{ day: MON, minutes: 40 }, { day: LAST, minutes: 400 }], [],
        periodRange("week", THU));
    assert.equal(r.delta, null,
        `one active day a side is not a comparison; the floor is ${DAY_FLOOR}`);
    assert.ok(r.needDays > 0);
});

check("mistakes: banked and drilled are counted off their own dates", () => {
    const r = mistakesReport([
        { id: "m1", topic: "Mistake bank", created_date: MON, last_reviewed_date: MON, repetitions: 0 },
        { id: "m2", topic: "Mistake bank", created_date: LAST, last_reviewed_date: MON, repetitions: 1 },
        { id: "m3", topic: "Mistake bank", created_date: LAST, repetitions: 0 },
    ], [], () => true, periodRange("week", THU));
    assert.equal(r.banked, 1, "a card banked last week counted as banked this week");
    assert.equal(r.drilled, 2);
    assert.equal(r.states.reduce((s, x) => s + x.n, 0), 3, "a card fell through every ladder state");
});

// ═══ THE SENTENCE ═══════════════════════════════════════════════════════════

check("A VERDICT IS ABSENT RATHER THAN PADDED", () => {
    const range = periodRange("week", THU);
    assert.equal(verdictFor(quizzesReport([], [], range), range), null,
        "a tab with no sits still produced a sentence about them");
    assert.equal(verdictFor(cardsReport([], range), range), null);
    assert.equal(verdictFor(hoursReport([], [], range), range), null);
    assert.equal(verdictFor(null, range), null);
});

check("a verdict names the direction and never contradicts its own delta", () => {
    const range = periodRange("week", THU);
    const up = quizzesReport([
        { id: "a", created_date: MON, score: 90 }, { id: "b", created_date: MON, score: 90 },
        { id: "p", created_date: LAST, score: 50 }, { id: "q", created_date: LAST, score: 50 },
    ], [], range);
    const v = verdictFor(up, range);
    assert.equal(v.tone, "good");
    assert.match(v.line, /Up 40 points/);

    const down = quizzesReport([
        { id: "a", created_date: MON, score: 50 }, { id: "b", created_date: MON, score: 50 },
        { id: "p", created_date: LAST, score: 90 }, { id: "q", created_date: LAST, score: 90 },
    ], [], range);
    const w = verdictFor(down, range);
    assert.equal(w.tone, "watch", "a fall was praised");
    assert.ok(!/Up /.test(w.line), "the sentence says up while the delta says down");
});

check("hhmm is null under a minute rather than \"0m\"", () => {
    assert.equal(hhmm(0), null);
    assert.equal(hhmm(null), null);
    assert.equal(hhmm(45), "45m");
    assert.equal(hhmm(60), "1h");
    assert.equal(hhmm(260), "4h 20m");
});

// ═══ THE PAGE ═══════════════════════════════════════════════════════════════

check("THE QUEUE IS TAB ONE, and the order is read off the first entry", () => {
    // `/^\s*\["today"/m` would pass with "today" ANYWHERE in the list, because
    // `m` makes `^` match at every line start — which is how the first draft of
    // this let the queue be moved to the end and said nothing.
    const page = strip(read("src/pages/Review.jsx"));
    const table = page.slice(page.indexOf("const TABS = ["), page.indexOf("];", page.indexOf("const TABS = [")));
    const ids = [...table.matchAll(/\[\s*"([a-z]+)"/g)].map((m) => m[1]);
    assert.equal(ids[0], "today",
        "the page opens on a report rather than on the one tab that has something " +
        `to do on it — it opens on "${ids[0]}"`);
});

check("FIVE TABS, ONE PER FEATURE, AND EVERY ONE IS RENDERED", () => {
    const page = strip(read("src/pages/Review.jsx"));
    const table = page.slice(page.indexOf("const TABS = ["), page.indexOf("];", page.indexOf("const TABS = [")));
    for (const id of ["today", "cards", "quizzes", "mistakes", "hours"]) {
        assert.ok(table.includes(`"${id}"`), `no "${id}" tab — a feature with no tab is a feature this page cannot report on`);
    }
    for (const t of ["CardsTab", "QuizzesTab", "MistakesTab", "HoursTab"]) {
        assert.ok(new RegExp(`<${t}\\b`).test(page), `${t} is declared and never drawn`);
    }
});

check("AND EVERY TAB IS REACHABLE BY A LINK", () => {
    // The thing the old "no tabs" guard was really protecting. A tab nobody can
    // deep-link to is one no other screen can hand a student off to.
    const page = strip(read("src/pages/Review.jsx"));
    assert.match(page, /resolveTab\(/, "the ?tab= param is no longer resolved");
    assert.match(page, /TAB_ALIAS/, "nothing maps the old names onto real tabs");
    const alias = page.slice(page.indexOf("const TAB_ALIAS"), page.indexOf("};", page.indexOf("const TAB_ALIAS")));
    assert.match(alias, /insights:/,
        "/Analytics redirects to ?tab=insights and has since the merge — without an " +
        "alias every one of those bookmarks lands on the wrong screen");
});

check("THE WINDOW IS ALWAYS STATED", () => {
    const page = strip(read("src/pages/Review.jsx"));
    assert.match(page, /<PeriodSwitch/, "the period control is not mounted");
    const sw = strip(read("src/components/progress/PeriodSwitch.jsx"));
    assert.match(sw, /\{live\.blurb\}/,
        "the switch prints a word without saying what span it means — the `date-fns` " +
        "Sunday default put five surfaces of this app a full week out of step");
    for (const p of PERIODS) {
        assert.ok(p.blurb && p.blurb.length > 3, `the "${p.label}" period does not say what it covers`);
    }
});

check("NOTHING HERE INVENTS A SCORE, AND NOTHING CALLS A MODEL", () => {
    const src = read("src/lib/progressReport.js") + read("src/components/progress/FeatureTabs.jsx");
    const code = strip(src);
    assert.ok(!/InvokeLLM|invokeAI|streamAI|callInvokeAI/.test(code),
        "the report generates advice — a paragraph nobody can check, which is what " +
        "was deleted from Insights for exactly this reason");
    assert.ok(!/\/\s*100\s*\)|progressScore|overallScore/.test(code),
        "a composite score out of 100 — a second invented scale sitting beside the " +
        "one number the whole app is standardised around");
});

check("every figure on a tab comes from the report, never from a literal", () => {
    const tabs = strip(read("src/components/progress/FeatureTabs.jsx"));
    // A hard-coded percentage or minute figure in the prose is the failure
    // `closingFacts` refuses on the first-run screen.
    const bad = tabs.match(/>\s*\d+%\s*</g);
    assert.equal(bad, null, `a literal percentage is printed on a tab: ${bad && bad.join(", ")}`);
});


// ═══ ACT, THEN READ ═════════════════════════════════════════════════════════
//
// The rework's whole premise, and every one of these renders perfectly when
// broken. A tab that leads with its figure instead of its work, a kind that
// reaches two tabs, a panel that draws an apology — none of them throws.

const TABS_SRC = strip(read("src/components/progress/FeatureTabs.jsx"));
const QUEUE_SRC = strip(read("src/lib/studyQueue.js"));

/** Every `kind:` a queue builder actually emits. */
const QUEUE_KINDS = [...QUEUE_SRC.matchAll(/kind:\s*"([a-z]+)"/g)].map((m) => m[1]);

check("every kind a tab claims is a kind the queue actually emits", () => {
    assert.ok(QUEUE_KINDS.length >= 6, "the queue-kind scan matched nothing — it would pass forever");
    for (const [tab, kinds] of Object.entries(TAB_KINDS)) {
        for (const k of kinds) {
            assert.ok(QUEUE_KINDS.includes(k),
                `the ${tab} tab claims kind "${k}", which no builder in studyQueue emits — ` +
                `that tab silently leads with nothing`);
        }
    }
});

check("no kind reaches two tabs, and an assessment reaches none", () => {
    const seen = new Set();
    for (const [tab, kinds] of Object.entries(TAB_KINDS)) {
        for (const k of kinds) {
            assert.ok(!seen.has(k), `"${k}" is on two feature tabs — the same work offered twice (${tab})`);
            seen.add(k);
        }
    }
    // A SAC is the whole term, not a flashcard or a quiz. It stays on Today,
    // which is the tab that ranks all seven kinds against each other.
    assert.ok(!seen.has("assessment"),
        "an assessment was given to a feature tab — it belongs to no one feature");
});

check("HOURS IS DELIBERATELY EMPTY, and that is asserted so nobody fills it", () => {
    // There is no such thing as an overdue hour. Inventing a row to make the
    // four tabs symmetrical is the padding every builder in studyQueue refuses.
    assert.deepEqual(TAB_KINDS.hours, [],
        "the hours tab was given outstanding work — nothing in the queue is about time");
});

check("workFor keeps the queue's own order and drops everything else", () => {
    const q = [
        { key: "a", kind: "assessment" }, { key: "b", kind: "decay" },
        { key: "c", kind: "mistakes" }, { key: "d", kind: "cards" },
    ];
    assert.deepEqual(workFor(q, "cards").map((x) => x.key), ["b", "d"],
        "workFor reordered or dropped a row — the tab would disagree with Today about the same item");
    assert.deepEqual(workFor(q, "hours"), [], "hours was handed work");
    assert.deepEqual(workFor(q, "nope"), [], "an unknown tab was handed work");
    assert.deepEqual(workFor(null, "cards"), [], "a missing queue threw instead of returning nothing");
});

check("THE ACTION LEADS EVERY TAB IT HAS ONE FOR", () => {
    // The complaint this release answers: the thing a student can DO was a
    // small outlined button in the corner of a 252px figure. Each tab that
    // takes `work` must render it BEFORE its strip, or the ordering silently
    // reverts and the page looks identical to a reader of the diff.
    for (const tab of ["CardsTab", "QuizzesTab", "MistakesTab"]) {
        const at = TABS_SRC.indexOf(`export function ${tab}`);
        assert.ok(at > -1, `${tab} is gone`);
        const body = TABS_SRC.slice(at, TABS_SRC.indexOf("export function", at + 10) + 1 || undefined);
        const work = body.indexOf("<FeatureWork");
        const strip_ = body.indexOf("<ReportStrip");
        assert.ok(work > -1, `${tab} does not render its outstanding work at all`);
        assert.ok(strip_ > -1, `${tab} does not render a figure`);
        assert.ok(work < strip_,
            `${tab} draws its figure above its work — the analytics outrank the action again`);
    }
});

check("the strip's fallback door is drawn ONLY when there is no work to lead with", () => {
    // Two ways to the same place, one above the other, is the duplication this
    // codebase keeps deleting — and the corner button is the weaker of the two.
    const n = (TABS_SRC.match(/action=\{work\.length \? null :/g) || []).length;
    assert.equal(n, 3,
        `${n} of the three work-taking tabs gate their corner door on having no work`);
});

check("A PANEL WITH NOTHING TO SAY IS NOT DRAWN", () => {
    // Each of these used to render a bordered box explaining what would fill
    // it — 94, 132 and ~600 measured pixels of apology, stacked, on a
    // first-week account.
    // THE GUARD IS ON THE EXPORTED COMPONENT'S OWN BODY, not on the file.
    // Matching any `return null` anywhere passed with the bug in place:
    // MemoryPanel has one inside `ForecastChart`, so the thing being checked
    // was a helper forty lines above the component that matters.
    for (const [file, why] of [
        ["src/components/analytics/WeakTopicsPanel.jsx", "nothing is standing out yet"],
        ["src/components/analytics/AttentionPanel.jsx", "no timed sessions yet"],
        ["src/components/analytics/MemoryPanel.jsx", "no cards reviewed yet"],
    ]) {
        const src = strip(read(file));
        const at = src.indexOf("export default function");
        assert.ok(at > -1, `${file} has no default export`);
        // Everything before the component's own `return (` — its guards.
        const head = src.slice(at, src.indexOf("return (", at));
        assert.ok(/\breturn null;/.test(head),
            `${file} still draws itself with nothing in it (${why})`);
    }
});

check("the three cut panels are gone from the tree, not merely unmounted", () => {
    const all = TABS_SRC
        + strip(read("src/components/analytics/MemoryPanel.jsx"))
        + strip(read("src/components/analytics/AttentionPanel.jsx"));
    for (const gone of ["Retrieval vs review", "How long it holds up"]) {
        assert.ok(!all.includes(gone), `"${gone}" is still drawn`);
    }
    assert.ok(!fs.existsSync(path.join(root, "src/components/analytics/CognitiveProfilePanel.jsx")),
        "CognitiveProfilePanel is back — 599px with three of five axes unmeasured");
    assert.ok(!fs.existsSync(path.join(root, "src/components/progress/ReportHead.jsx")),
        "ReportHead is back — the 252px card ReportStrip replaced");
});

check("nothing imports a progress module that has been deleted", () => {
    // The orphan this exact shape produced one release ago: the probe still
    // imported a deleted component and `npm run build` was green, because the
    // probe is not an entry point.
    const walk = (dir, out = []) => {
        for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
            if (e.name === "node_modules" || e.name.startsWith(".")) continue;
            const rel = `${dir}/${e.name}`;
            if (e.isDirectory()) walk(rel, out);
            else if (/\.(js|jsx|mjs)$/.test(e.name)) out.push(rel);
        }
        return out;
    };
    const files = [...walk("src"), ...walk("scripts")];
    for (const f of files) {
        const src = strip(read(f));
        for (const gone of ["CognitiveProfilePanel", "ReportHead"]) {
            assert.ok(!new RegExp(`from\\s+["'][^"']*${gone}["']`).test(src),
                `${f} imports ${gone}, which no longer exists`);
        }
    }
});

// ═══ A BAR WITH NO WAY THROUGH IS A DIAGNOSIS ═══════════════════════════════

check("BarList renders a row with a destination AS A LINK", () => {
    const bar = strip(read("src/components/progress/BarList.jsx"));
    assert.ok(/r\.to \?/.test(bar) && /<Link\b/.test(bar),
        "BarList no longer turns a row with a destination into a link — every bar " +
        "is a readout again, which is the isolated-stats complaint this answered");
});

check("the rows that CAN be doors are, and the ones that cannot are not", () => {
    const section = (name) => {
        const at = TABS_SRC.indexOf(`export function ${name}`);
        const end = TABS_SRC.indexOf("export function", at + 10);
        return TABS_SRC.slice(at, end === -1 ? undefined : end);
    };
    // A subject has a hub, a command term has a tool, a technique IS a tab on
    // /Study. Each of these was flat text until this release.
    assert.ok(/to: subjectHub\(/.test(section("QuizzesTab")),
        "a quiz subject row no longer opens that subject");
    assert.ok(/\bto:\s*`[^`]*\$\{toolQuery\(\{/.test(section("QuizzesTab")),
        "a command-term row no longer seeds that term's tool AS ITS DESTINATION — " +
        "calling toolQuery and not putting the result on `to` builds the link and " +
        "throws it away, which renders as a flat row");
    assert.ok(/to: TECHNIQUE_ID\[/.test(section("HoursTab")),
        "a technique row no longer opens that technique");
    // And the refusal, which is the half that keeps the others honest: there is
    // no review session filtered to one strength band.
    const cards = section("CardsTab");
    const bands = cards.slice(cards.indexOf("report.bands"), cards.indexOf("report.bands") + 420);
    assert.ok(!/\bto:/.test(bands),
        "a strength band was given a destination — there is no review session " +
        "filtered to one band, so the link would land on the whole deck");
});

check("every technique a row claims to open is one of Study's own ids", () => {
    const study = strip(read("src/pages/Study.jsx"));
    const ids = [...study.matchAll(/\{\s*id:\s*"([a-z_]+)"/g)].map((m) => m[1]);
    assert.ok(ids.includes("spaced_repetition"), "the Study technique scan matched nothing");
    const claimed = [...TABS_SRC.matchAll(/^\s*"[^"]+":\s*"([a-z_]+)",$/gm)].map((m) => m[1]);
    assert.ok(claimed.length >= 6, "the TECHNIQUE_ID map was not found — the scan would pass forever");
    for (const id of claimed) {
        assert.ok(ids.includes(id),
            `a technique row links to ?tab=${id}, which Study does not honour — ` +
            `its deep link tests against TECHNIQUES, so the student lands on Pomodoro`);
    }
});

// ═══ DENSITY ════════════════════════════════════════════════════════════════

check("the two-column split fires at lg, not xl", () => {
    // Tailwind breakpoints are VIEWPORT-based and the page is `max-w-5xl`, so
    // at xl (1280) a 1100px laptop fell to one column inside a 1024px
    // container — a bar a thousand pixels wide to say "7 cards". The same
    // viewport-is-not-element trap `WeekPace` records.
    assert.ok(/const SPLIT = "[^"]*\blg:grid-cols-2\b/.test(TABS_SRC),
        "the panel split is not on lg");
    assert.ok(!/\bxl:grid-cols-2\b/.test(TABS_SRC),
        "a panel row still waits for xl, so a 1100px laptop draws it full width");
});

check("the methodology half is behind ONE named fold", () => {
    const n = (TABS_SRC.match(/<MoreDetail\s+label="/g) || []).length;
    assert.ok(n >= 2, "the detail fold is gone — the tabs are one long scroll again");
    assert.ok(!/<MoreDetail\s+label="(More|Detail|More detail)"/i.test(TABS_SRC),
        "the fold is labelled 'more' rather than named — a chevron on nothing is " +
        "a control nobody presses, which is the call the science rail already makes");
});

console.log(`\nprogressReport: ${passed} checks passed`);
