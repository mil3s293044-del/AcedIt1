/**
 * studyQueue assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/studyQueue.test.mjs
 *
 * ═══ A QUEUE THAT PADS ITSELF IS A QUEUE NOBODY BELIEVES ════════════════════
 * Every builder here returns null rather than a zero row, and that is the one
 * property this file exists to hold. A list that reaches a respectable length
 * by printing "0 cards due" and "0 mistakes ready" teaches a student that the
 * numbers on this page are decoration — after which the real ones do not land
 * either. It is the rule Today's Play keeps about its rail and `closingFacts`
 * keeps about the first run, on the screen that now carries six sources at
 * once and therefore has six chances to break it.
 *
 * The other half is the ORDER. Seven kinds of thing need one ranking, and the
 * failure is silent: a SAC a fortnight away sitting above one tomorrow renders
 * perfectly and is simply the wrong advice. The deadline tier counts DOWN and
 * every other tier counts UP, which is one `if` and the obvious thing to get
 * backwards.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
    studyQueue, assessmentItems, unmarkedItem, resitItem, mistakeItem,
    decayItem, cardsItem, queueLead, queueMinutes, daysUntil, whenLabel,
    clearedThisWeek, hoursLabel,
    TIERS, SOON_DAYS, PREP_STALE_DAYS,
} from "@/lib/studyQueue";

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

const NOW = new Date("2026-10-03T09:00:00+10:00");
const iso = (d) => new Date(NOW.getTime() + d * 86400000).toISOString().split("T")[0];
const today = iso(0);

/** A learned card that is overdue. */
const card = (over) => ({
    id: `c${over}`, subject_name: "Chemistry", topic: "Redox", is_active: true,
    repetitions: 4, ease_factor: 2.5, interval_days: 10,
    last_reviewed_date: iso(-20), next_review_date: iso(-over),
});

// ─── 1. Nothing is drawn when its number is not real ───────────────────────

check("AN EMPTY ACCOUNT PRODUCES AN EMPTY QUEUE, not six zero rows", () => {
    const q = studyQueue({ today, now: NOW });
    assert.deepEqual(q, [],
        "a builder returned a row with nothing behind it — a queue padded with zeroes is " +
        "how a student learns the numbers on this page mean nothing");
});

check("every builder answers null rather than a zero row", () => {
    assert.equal(unmarkedItem([]), null);
    assert.equal(resitItem([], [], []), null);
    assert.equal(mistakeItem([], () => true, []), null);
    assert.equal(decayItem([]), null);
    assert.equal(cardsItem([], today, []), null);
    assert.deepEqual(assessmentItems([], [], NOW), []);
    // And on rows that exist but have nothing outstanding.
    assert.equal(cardsItem([{ id: "x", is_active: true, next_review_date: iso(30),
        repetitions: 3, last_reviewed_date: iso(-1) }], today, []), null,
        "a card scheduled a month out is being counted as ready");
});

// ─── 2. The order ──────────────────────────────────────────────────────────

check("THE TIERS RANK WORST-FIRST, and an unknown tier sorts LAST", () => {
    assert.deepEqual(TIERS, ["deadline", "dropped", "decaying", "routine"]);
    // A kind added later without a tier must fall to the bottom of the queue,
    // never to the top of it — the generous-guess direction is the dangerous
    // one everywhere in this codebase.
    const src = read("src/lib/studyQueue.js");
    assert.match(src, /i < 0 \? TIERS\.length : i/,
        "an unrecognised tier no longer sorts last");
});

check("A DEADLINE COUNTS DOWN AND EVERYTHING ELSE COUNTS UP", () => {
    const assessments = [
        { id: "far", subject_name: "Chemistry", title: "Unit 4 SAC", due_date: iso(12) },
        { id: "near", subject_name: "Methods", title: "Unit 3 SAC", due_date: iso(1) },
    ];
    const items = assessmentItems(assessments, [], NOW);
    assert.equal(items[0].id ?? items[0].key, "assessment:near",
        "a SAC a fortnight out is sitting above one tomorrow — the deadline tier is being " +
        "sorted the same way as the size-based ones");
    assert.equal(items[1].key, "assessment:far");
});

check("the whole queue is deadline, then dropped, then decaying, then routine", () => {
    const cards = [card(5), card(6), card(7)];
    const q = studyQueue({
        cards,
        attempts: [{ quiz_id: "q1", created_date: "2026-10-01", extra: {
            question_results: [{ q_index: 0, marks: null }, { q_index: 1, marks: 2 }] } }],
        // TWO of them, because the whole-queue sort re-orders what the builder
        // already ordered — with one assessment there is nothing to get
        // backwards and the flipped comparator passes.
        assessments: [
            { id: "far", subject_name: "Legal", title: "Unit 4 SAC", due_date: iso(11) },
            { id: "near", subject_name: "Methods", title: "Unit 3 SAC", due_date: iso(2) },
        ],
        today, now: NOW,
    });
    const kinds = q.map((x) => x.kind);
    assert.equal(kinds[0], "assessment", "the thing with a date on it is not first");
    assert.equal(q[0].key, "assessment:near",
        "the queue's own sort put a SAC eleven days out above one in two — the deadline " +
        "tier counts DOWN and every other tier counts UP, which is the one `if` in it");
    assert.equal(q[1].key, "assessment:far");
    assert.ok(kinds.indexOf("unmarked") < kinds.indexOf("cards"),
        "marks already dropped are ranked below the routine pile");
    assert.ok(q.every((x) => TIERS.includes(x.tier)), "an item carries a tier nothing ranks");
});

// ─── 3. Assessments: never score a student on a signal they cannot reach ───

check("AN ASSESSMENT WITH NO SUBJECT IS SKIPPED, not reported unprepared", () => {
    // It cannot be matched against the study log at all, so "you have not
    // studied for this" would be a claim the app has no basis for.
    const items = assessmentItems([{ id: "x", title: "Something", due_date: iso(2) }], [], NOW);
    assert.deepEqual(items, []);
});

check("recent study on the subject means prep HAS started", () => {
    const a = [{ id: "a", subject_name: "Chemistry", title: "SAC", due_date: iso(5) }];
    const studied = [{ day: iso(-2), subject: "Chemistry", minutes: 45 }];
    assert.deepEqual(assessmentItems(a, studied, NOW), [],
        `a subject studied 2 days ago is being called unprepared — PREP_STALE_DAYS is ${PREP_STALE_DAYS}`);
    const stale = [{ day: iso(-(PREP_STALE_DAYS + 3)), subject: "Chemistry", minutes: 45 }];
    const out = assessmentItems(a, stale, NOW);
    assert.equal(out.length, 1);
    assert.match(out[0].why, /\d+ days/, "the row does not say how long it has been quiet");
});

check("a subject NEVER studied reads differently from one gone quiet", () => {
    const a = [{ id: "a", subject_name: "Chemistry", title: "SAC", due_date: iso(5) }];
    const out = assessmentItems(a, [], NOW);
    assert.match(out[0].why, /not studied this subject yet/i,
        "never-touched is being reported as a number of quiet days, which would be a " +
        "figure with nothing behind it");
});

check("a completed or far-off assessment is not in the queue", () => {
    const base = { id: "a", subject_name: "Chemistry", title: "SAC" };
    assert.deepEqual(assessmentItems([{ ...base, due_date: iso(5), is_completed: true }], [], NOW), []);
    assert.deepEqual(assessmentItems([{ ...base, due_date: iso(SOON_DAYS + 1) }], [], NOW), []);
    assert.deepEqual(assessmentItems([{ ...base, due_date: iso(-1) }], [], NOW), [],
        "an assessment that has already happened is still being chased");
});

// ─── 4. Unmarked answers, and the zero that is a real mark ─────────────────

check("MARKS OF ZERO ARE MARKED. Only an ABSENT figure is outstanding", () => {
    // `!r.marks` is the tempting test and it treats a legitimately earned zero
    // as never marked — the same falsy-zero family as `Number(null)`.
    const attempts = [{ quiz_id: "q", extra: { question_results: [
        { q_index: 0, marks: 0 }, { q_index: 1, marks: 3 }] } }];
    assert.equal(unmarkedItem(attempts), null,
        "a question the marker gave 0 is being reported as unmarked");
});

check("a self-marked question is no longer outstanding", () => {
    const results = [{ q_index: 0, marks: null }, { q_index: 1, marks: null }];
    const open = unmarkedItem([{ quiz_id: "q", extra: { question_results: results } }]);
    assert.equal(open.count, 2);
    // Keys come back from PostgREST as strings on a jsonb object, so both
    // forms have to be honoured or the row never clears.
    const half = unmarkedItem([{ quiz_id: "q", self_marked_marks: { 0: 2 },
        extra: { question_results: results } }]);
    assert.equal(half.count, 1);
    const done = unmarkedItem([{ quiz_id: "q", self_marked_marks: { "0": 2, "1": 1 },
        extra: { question_results: results } }]);
    assert.equal(done, null, "string-keyed self marks are not being read");
});

check("a RETRY is not counted — its answers are keyed to the retry", () => {
    const a = [{ quiz_id: "q", extra: { is_retry: true,
        question_results: [{ q_index: 0, marks: null }] } }];
    assert.equal(unmarkedItem(a), null,
        "a wrong-only retry is being read as a normal attempt, which is the split rule " +
        "every other consumer of these rows keeps");
});

// ─── 5. The rest of the builders ───────────────────────────────────────────

check("the card row reports READY and says what is in it", () => {
    const it = cardsItem([card(5), card(2), { id: "n", subject_name: "Methods",
        is_active: true, next_review_date: today }], today, []);
    assert.equal(it.count, 3, "ready is not due + overdue + new");
    assert.equal(it.tier, "routine");
    assert.match(it.why, /never opened|review/,
        "the honest split is gone — the thing this page was built to say");
});

check("the mistake row counts READY, not the whole bank", () => {
    const bank = [
        { id: "m1", topic: "Mistake bank", subject_name: "Legal", repetitions: 0,
          extra: { mistake: { criterion: "names the transfer" } } },
        { id: "m2", topic: "Mistake bank", subject_name: "Legal", repetitions: 0,
          extra: { mistake: { criterion: "cites the section" } } },
    ];
    const onlyOne = mistakeItem(bank, (c) => c.id === "m1", []);
    assert.equal(onlyOne.count, 1,
        "\"Review 6\" that is one card due and five scheduled next week is the small lie " +
        "that costs this screen its credibility");
    assert.equal(mistakeItem(bank, () => false, []), null);
});

check("decay reports cards already BELOW the floor", () => {
    // A card reviewed long ago on a short interval has decayed; one reviewed
    // today has not.
    const stale = { id: "d", subject_name: "Bio", is_active: true, repetitions: 3,
        ease_factor: 2.5, interval_days: 2, last_reviewed_date: iso(-40),
        next_review_date: iso(-38) };
    const fresh = { id: "f", subject_name: "Bio", is_active: true, repetitions: 3,
        ease_factor: 2.5, interval_days: 30, last_reviewed_date: iso(0),
        next_review_date: iso(30) };
    const it = decayItem([stale, fresh], NOW.getTime());
    assert.ok(it && it.count >= 1, "a card forty days past a two-day interval is not slipping");
    assert.equal(it.tier, "decaying");
    assert.equal(decayItem([fresh], NOW.getTime()), null,
        "a card reviewed today is being called slipping");
});

check("a RETIRED card is never chased", () => {
    // "I know this" is the student overruling the scheduler, and the
    // forgetting curve has no opinion they did not already hear.
    const retired = { id: "r", subject_name: "Bio", is_active: true, repetitions: 3,
        ease_factor: 2.5, interval_days: 2, last_reviewed_date: iso(-40),
        next_review_date: iso(-38), retired_at: iso(-1) };
    assert.equal(decayItem([retired], NOW.getTime()), null);
});

// ─── 6. The lead sentence, and the minutes badge ───────────────────────────

check("THE LEAD NAMES THE FIRST ITEM rather than summing the queue", () => {
    assert.equal(queueLead([]), null, "an empty queue is handed a sentence about nothing");
    const one = queueLead([{ title: "12 cards ready" }]);
    assert.equal(one.rest, 0);
    assert.ok(!/other/.test(one.line), "a queue of one claims there are others");
    const many = queueLead([{ title: "Chem SAC Friday" }, { title: "a" }, { title: "b" }]);
    assert.match(many.line, /Chem SAC Friday/, "the lead is a count rather than a reason");
    assert.match(many.line, /2 other things/);
});

check("the minutes badge is NULL rather than 0 when nothing can be estimated", () => {
    assert.equal(queueMinutes([{ kind: "a" }, { kind: "b" }], () => null), null,
        "a \"0 min\" badge over six real tasks is worse than no badge");
    const m = queueMinutes([{ kind: "a" }, { kind: "b" }], (it) => (it.kind === "a" ? 8 : null));
    assert.deepEqual(m, { minutes: 8, from: 1, of: 2 });
});

// ─── 7. Dates ──────────────────────────────────────────────────────────────

check("daysUntil flattens both ends to midnight", () => {
    // Read at 9am, "due tomorrow" must be 1 and not 0 — the same local-day
    // trap `dayKey` exists for.
    assert.equal(daysUntil(iso(1), NOW), 1);
    assert.equal(daysUntil(iso(0), NOW), 0);
    assert.equal(daysUntil(iso(-2), NOW), -2);
    assert.equal(daysUntil(null, NOW), null);
    assert.equal(daysUntil("not a date", NOW), null);
});

check("whenLabel never prints a negative number of days", () => {
    assert.equal(whenLabel(0), "today");
    assert.equal(whenLabel(1), "tomorrow");
    assert.equal(whenLabel(4), "in 4 days");
    assert.equal(whenLabel(-3), "today", "an overdue item is being told it is in -3 days");
    assert.equal(whenLabel(null), null);
});

// ─── 8. Nothing is stored ──────────────────────────────────────────────────

check("THE QUEUE STORES NOTHING AND QUERIES NOTHING", () => {
    const src = strip(read("src/lib/studyQueue.js"));
    assert.ok(!/base44|supabase|\.create\(|\.update\(|bulkUpdate|localStorage/.test(src),
        "this module reaches a database or storage — the whole point is that it is derived " +
        "from rows the page already has, so it cannot go stale or disagree with them");
});

// ─── 9. Every kind can be drawn, and the colour means the rank ─────────────

check("EVERY KIND HAS A LOOK AND EVERY TIER HAS AN INK", () => {
    const row = read("src/components/study/QueueRow.jsx");
    // A kind the row cannot draw renders as a grey spine and the internal name
    // as its label — it does not throw, it just looks like a bug.
    const kinds = ["assessment", "unmarked", "resit", "mistakes", "decay", "cards"];
    // `};` and not `}` — the first bare brace closes the FIRST entry, so the
    // slice was one row long and every kind after it read as missing.
    const metaAt = row.indexOf("export const KIND_META");
    const meta = row.slice(metaAt, row.indexOf("};", metaAt));
    for (const k of kinds) {
        assert.ok(meta.includes(`${k}:`), `QueueRow has no look for the "${k}" row`);
    }
    const tiers = row.slice(row.indexOf("export const TIER_INK"), row.indexOf("};", row.indexOf("export const TIER_INK")));
    for (const t of TIERS) {
        assert.ok(tiers.includes(`${t}:`), `no ink for the "${t}" tier, so those rows draw grey`);
    }
});

check("THE SPINE IS THE TIER, which is what makes the ranking visible", () => {
    const row = read("src/components/study/QueueRow.jsx");
    assert.match(row, /const spine = tier\?\.spine/,
        "the spine is coloured by KIND again — six kinds against five hues means two of " +
        "them match by accident, which is how \"Mistakes\" and \"Sit again\" came out the " +
        "same purple for no reason a student could read");
    assert.match(row, /const ink = tier\?\.ink/,
        "the label ink no longer follows the spine, so the row carries two colours saying " +
        "different things");
});


// ═══ THE DONE PILE ══════════════════════════════════════════════════════════
// The queue gets SHORTER the better a student does, so a page that only draws
// it rewards a good week with a shorter list of failings. Everything below is
// about the other half being counted off the SAME rows, and about it refusing
// to claim a week that did not happen.

/** Monday of the week `d` falls in, as "YYYY-MM-DD". */
const mondayOf = (d) => {
    const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
    return `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, "0")}-${String(s.getDate()).padStart(2, "0")}`;
};
// A Thursday, so the week has days either side of "now" inside it.
const THU = new Date(2026, 9, 8, 14, 0, 0);
const MON = mondayOf(THU);
const dayBefore = (iso, n) => {
    const d = new Date(`${iso}T00:00:00`);
    d.setDate(d.getDate() - n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const LAST_WEEK = dayBefore(MON, 3);

check("clearedThisWeek counts reviews, drills and sits off the rows already loaded", () => {
    const c = clearedThisWeek({
        cards: [
            { id: "a", last_reviewed_date: `${MON}T09:00:00Z` },
            { id: "b", last_reviewed_date: MON },
            { id: "c", last_reviewed_date: LAST_WEEK },
        ],
        bankCards: [{ id: "m", last_reviewed_date: `${MON}T10:00:00Z` }],
        attempts: [
            { id: "q1", created_date: `${MON}T11:00:00Z` },
            { id: "q2", created_date: LAST_WEEK },
        ],
        events: [{ day: MON, minutes: 45 }, { day: LAST_WEEK, minutes: 600 }],
        now: THU,
    });
    const by = Object.fromEntries(c.items.map((i) => [i.kind, i.n]));
    assert.equal(by.cards, 2, "last week's review was counted into this week");
    assert.equal(by.mistakes, 1);
    assert.equal(by.resit, 1);
    assert.equal(c.minutes, 45, "last week's minutes leaked into this week's total");
    assert.ok(c.any);
});

check("THE WEEK IS MONDAY, which is studyLog's and not date-fns' default", () => {
    // date-fns defaults startOfWeek to SUNDAY, which put five surfaces a full
    // week out of step with nine others — one day in seven, which is exactly
    // why a comment would not have held. On a Monday the week starts TODAY, so
    // the Sunday before it is last week's work and must not be counted.
    const mon = new Date(2026, 9, 5, 9, 0, 0);          // Monday
    const sun = "2026-10-04";
    const c = clearedThisWeek({ cards: [{ last_reviewed_date: sun }], now: mon });
    assert.equal(c.items.length, 0, "the Sunday before Monday counted as this week");
    assert.equal(c.from, "2026-10-05");
});

check("A ROW WITH NO DATE IS NEVER COUNTED, in either direction", () => {
    // `Number(null)` is 0 and "" slices LOW, so a coerced comparison files
    // every undated row outside the window and the obvious "fix" — defaulting
    // to today — files every one of them inside it. Both are wrong and only
    // one is visible. This is the ninth module that trap has reached.
    const c = clearedThisWeek({
        cards: [{ last_reviewed_date: null }, { last_reviewed_date: "" }, {}],
        bankCards: [{ last_reviewed_date: undefined }],
        attempts: [{ created_date: null }, { id: "x" }],
        events: [{ day: null, minutes: 300 }, { minutes: 90 }],
        now: THU,
    });
    assert.equal(c.items.length, 0, "an undated row was counted as this week's work");
    assert.equal(c.minutes, 0);
    assert.equal(c.any, false);
});

check("NO ZERO ROWS, and a quiet week draws nothing at all", () => {
    const c = clearedThisWeek({ now: THU });
    assert.deepEqual(c.items, [], "a kind with nothing in it was still listed");
    assert.equal(c.any, false,
        "`any` is true on an empty week, so the strip prints \"0 cards reviewed\" at " +
        "somebody on a Monday morning — the zero row every builder here refuses");
});

check("minutes alone is still a week", () => {
    const c = clearedThisWeek({ events: [{ day: MON, minutes: 30 }], now: THU });
    assert.equal(c.items.length, 0);
    assert.equal(c.any, true, "half an hour of real study read as a week with nothing in it");
});

check("EVERY CLEARED KIND CARRIES A TIER, and it is one the queue knows", () => {
    // Without it the strip needs its own kind -> tier table, which is the
    // second copy this codebase keeps deleting — and the copy that drifted
    // would print "quizzes sat" in a colour the queue uses for something else.
    const c = clearedThisWeek({
        cards: [{ last_reviewed_date: MON }],
        bankCards: [{ last_reviewed_date: MON }],
        attempts: [{ created_date: MON }],
        now: THU,
    });
    assert.equal(c.items.length, 3);
    for (const i of c.items) {
        assert.ok(TIERS.includes(i.tier), `cleared kind "${i.kind}" has a tier the queue does not rank`);
        const meta = read("src/components/study/QueueRow.jsx");
        assert.ok(meta.includes(`${i.kind}:`), `cleared kind "${i.kind}" has no glyph on QueueRow`);
    }
});

check("hoursLabel is null under a minute rather than \"0m\"", () => {
    assert.equal(hoursLabel(0), null);
    assert.equal(hoursLabel(null), null);
    assert.equal(hoursLabel(-5), null);
    assert.equal(hoursLabel(NaN), null);
    assert.equal(hoursLabel(35), "35m");
    assert.equal(hoursLabel(60), "1h");
    assert.equal(hoursLabel(260), "4h 20m");
});

// ═══ THE PAGE ═══════════════════════════════════════════════════════════════

check("THE QUEUE IS STILL THE FIRST THING THE PAGE OPENS ON", () => {
    // It is tab one, and it is the only tab with an action on every row. This
    // used to assert that nothing was behind a tab at all, which pinned a
    // MECHANISM rather than a property — the charts being reachable and named
    // is the thing that matters, and `progressReport.test.mjs` holds it.
    const page = strip(read("src/pages/Review.jsx"));
    const tabs = page.slice(page.indexOf("const TABS = ["), page.indexOf("];", page.indexOf("const TABS = [")));
    assert.match(tabs, /^\s*\[\s*"today"/m,
        "the queue is no longer the first tab, so the page opens on a report rather " +
        "than on the one screen that has something to do on it");
    assert.match(page, /<QueueRow/, "the queue is not rendered at all");
});

check("NOTHING IS TICKED OFF THAT WAS NOT ACTUALLY DONE", () => {
    const page = strip(read("src/pages/Review.jsx"));
    // No "dismissed" flag: the queue is derived and a tick that WROTE one
    // would let somebody clear a SAC that is still on Friday.
    assert.ok(!/dismiss/i.test(page),
        "something on this page dismisses a queue item — the queue stores nothing, " +
        "so a tick has to be the work rather than a control");
    assert.match(page, /if \(!prev\) return;/,
        "the first settle no longer announces nothing, so opening the page ticks off " +
        "everything the student ever cleared");
    assert.match(page, /if \(!loadOk\.current\) \{ seen\.current = null; return; \}/,
        "a FAILED read hands back six empty arrays, so without this guard an outage " +
        "empties the queue and every item on it is announced as done");
});

check("THE DONE PILE IS DRAWN, and only when there is one", () => {
    const page = strip(read("src/pages/Review.jsx"));
    assert.match(page, /<ClearedStrip cleared=\{cleared\}/, "the strip is not mounted");
    assert.match(page, /clearedThisWeek\(\{/, "the strip is not derived from the model");
    // The strip is a real component so the probe can draw it — /Review is
    // auth-gated and the one thing that settles a layout is opening it.
    const strip_ = strip(read("src/components/study/Cleared.jsx"));
    assert.match(strip_, /if \(!cleared\?\.any\) return null;/,
        "the strip draws on something other than `any`, so a quiet week prints an " +
        "empty row of figures");
    assert.match(strip_, /TIER_INK\[i\.tier\]/,
        "the strip inks itself rather than reading the queue's own tier ink, which is " +
        "the second colour table this release exists to avoid");
});

check("THE EMPTY QUEUE CLAIMS A WIN ONLY WHEN THERE WAS ONE", () => {
    const page = strip(read("src/pages/Review.jsx"));
    assert.match(page, /cleared\?\.any \? "You cleared it\." :/,
        "the caught-up card congratulates an account that did nothing this week, which " +
        "is the same card somebody who has never opened the app would get");
});

console.log(`\nstudyQueue: ${passed} checks passed`);
