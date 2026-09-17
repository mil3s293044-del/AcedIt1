/**
 * due assertions — node --import ./src/lib/_aliasLoader.mjs src/lib/due.test.mjs
 *
 * The regression these pin down is the complaint that started this: the app
 * always thinks a bunch of flashcards are due. It was right that the number
 * was large and wrong about what the number meant.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
    cardState, isDue, isNew, isReady, tally, dueQueue, auditPiles, reasonFor,
    markKnown, markUnknown, snoozeFor, daysBetween,
    DAILY_CAP, OVERDUE_AFTER_DAYS,
} from "@/lib/due";

let passed = 0;
const check = (name, fn) => {
    try {
        fn();
        passed += 1;
        console.log(`  ok  ${name}`);
    } catch (err) {
        console.error(`FAIL  ${name}\n      ${err.message}`);
        process.exitCode = 1;
    }
};

const TODAY = "2026-08-19";

/** What the old test was, in every place except mastery.js and Analytics.jsx. */
const oldIsDue = (c) => !!(c.next_review_date && c.next_review_date <= TODAY);

/** Exactly what SpacedRepetition writes when it creates a card. */
const freshCard = (over = {}) => ({
    subject_name: "Biology", topic: "Cells",
    repetitions: 0, total_reviews: 0, interval_days: 1,
    next_review_date: TODAY,        // <- born due
    ...over,
});

/** A card that has been reviewed and is genuinely scheduled. */
const learned = (nextReview, over = {}) => ({
    subject_name: "Biology", topic: "Cells",
    repetitions: 3, total_reviews: 3, interval_days: 10,
    next_review_date: nextReview,
    ...over,
});

const ago = (days) => {
    const d = new Date(`${TODAY}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - days);
    return d.toISOString().split("T")[0];
};

console.log("\ndue\n");

check("a deck generated last night is not a backlog [REGRESSION]", () => {
    // The complaint, reproduced. 60 cards made by the AI tools, never opened.
    const deck = Array.from({ length: 60 }, () => freshCard());
    assert.equal(deck.filter(oldIsDue).length, 60, "the old rule really did call all 60 due");

    const t = tally(deck, TODAY);
    assert.equal(t.active, 0, "none of them are review debt");
    assert.equal(t.new, 60, "all 60 are unopened material");
});

check("a card that lapsed once does not stay due forever [REGRESSION]", () => {
    // It IS still due — the fix is not that it disappears, it is that the
    // student can now audit it and say they know it.
    const lapsed = learned(ago(90));
    assert.equal(cardState(lapsed, TODAY), "overdue");
    assert.equal(cardState({ ...lapsed, ...markKnown() }, TODAY), "known");
    assert.equal(isDue({ ...lapsed, ...markKnown() }, TODAY), false,
        "marked known means it stops being recommended");
});

check("marking known is reversible and keeps the card", () => {
    const card = learned(ago(10));
    const known = { ...card, ...markKnown("2026-08-19T04:00:00.000Z") };
    assert.equal(known.retired_at, "2026-08-19T04:00:00.000Z", "we record when, so the audit can say so");
    assert.equal(known.question, card.question, "the card is not destroyed");

    const back = { ...known, ...markUnknown() };
    assert.equal(cardState(back, TODAY), "overdue", "undo returns it to where the scheduler left it");
});

check("snoozing clears when the date arrives, and known outranks it", () => {
    const card = { ...learned(ago(1)), ...snoozeFor(3, TODAY) };
    assert.equal(card.snoozed_until, "2026-08-22");
    assert.equal(cardState(card, TODAY), "snoozed");
    assert.equal(cardState(card, "2026-08-22"), "due", "a snooze expires on the day it names");

    // Saying you know it is a stronger claim than saying not today.
    const both = { ...card, ...markKnown() };
    assert.equal(both.snoozed_until, null);
    assert.equal(cardState(both, TODAY), "known");
});

check("due and overdue are different states", () => {
    assert.equal(cardState(learned(TODAY), TODAY), "due");
    assert.equal(cardState(learned(ago(OVERDUE_AFTER_DAYS)), TODAY), "due", "just inside the boundary");
    assert.equal(cardState(learned(ago(OVERDUE_AFTER_DAYS + 1)), TODAY), "overdue");
    assert.equal(cardState(learned("2026-09-01"), TODAY), "scheduled");
});

check("the three old definitions disagreed with each other [REGRESSION]", () => {
    // mastery.js said a card with no date was due; Dashboard said it was not.
    const noDate = learned(null);
    const masteryOld = (c) => (!c.next_review_date ? true : c.next_review_date <= TODAY);
    assert.notEqual(masteryOld(noDate), oldIsDue(noDate), "the same card, two answers");
    // One answer now: reviewed but unscheduled is due, because it was learned
    // and nothing is holding it.
    assert.equal(cardState(noDate, TODAY), "due");
    assert.equal(cardState(freshCard({ next_review_date: null }), TODAY), "new",
        "unreviewed and unscheduled is new, not due");
});

check("the queue is capped, and says what it left out", () => {
    const cards = Array.from({ length: 312 }, (_, i) => learned(ago(i % 40)));
    const q = dueQueue(cards, { today: TODAY });
    assert.equal(q.queue.length, DAILY_CAP, "a day's work, not the whole pile");
    assert.equal(q.totalDue, 312);
    assert.equal(q.backlog, 312 - DAILY_CAP, "the rest is reported, not hidden");
});

check("the most overdue card is at the front of the queue", () => {
    const cards = [learned(ago(1)), learned(ago(60)), learned(ago(9))];
    const q = dueQueue(cards, { today: TODAY });
    assert.equal(q.queue[0].next_review_date, ago(60), "closest to being lost goes first");
    assert.equal(q.queue[2].next_review_date, ago(1));
});

check("a weak spot outranks an ordinary card at the same lateness", () => {
    const plain = learned(ago(5), { question: "plain" });
    const weak = learned(ago(5), { question: "weak", is_weak_spot: true });
    const q = dueQueue([plain, weak], { today: TODAY });
    assert.equal(q.queue[0].question, "weak");
});

check("new cards fill the gap when there is no backlog", () => {
    const cards = [learned(ago(1)), ...Array.from({ length: 50 }, () => freshCard())];
    const q = dueQueue(cards, { today: TODAY });
    assert.equal(q.queue.length, 1, "one real review");
    assert.equal(q.starters.length, 15, "and a bounded amount of new material");
    assert.equal(q.totalNew, 50);
});

check("a full backlog does not drag new cards in on top of it", () => {
    const cards = [
        ...Array.from({ length: 100 }, () => learned(ago(20))),
        ...Array.from({ length: 100 }, () => freshCard()),
    ];
    const q = dueQueue(cards, { today: TODAY });
    assert.equal(q.queue.length, DAILY_CAP);
    assert.equal(q.starters.length, 0, "clear the debt before starting more");
});

check("known and snoozed cards never reach the queue", () => {
    const cards = [
        learned(ago(5), { ...markKnown() }),
        learned(ago(5), { ...snoozeFor(7, TODAY) }),
        learned(ago(5)),
    ];
    const q = dueQueue(cards, { today: TODAY });
    assert.equal(q.queue.length, 1);
    assert.equal(q.totalDue, 1, "the backlog count excludes them too");
});

check("the audit groups by subject then topic, loudest first", () => {
    const cards = [
        learned(ago(40), { subject_name: "Chemistry", topic: "Redox" }),
        learned(ago(40), { subject_name: "Chemistry", topic: "Redox" }),
        learned(TODAY,   { subject_name: "Chemistry", topic: "Bonding" }),
        freshCard({ subject_name: "Biology", topic: "Cells" }),
    ];
    const piles = auditPiles(cards, TODAY);
    assert.equal(piles[0].subject, "Chemistry", "real debt outranks a new pile");
    assert.equal(piles[0].active, 3);
    assert.equal(piles[0].overdue, 2);
    assert.equal(piles[0].topics[0].topic, "Redox", "the noisy topic opens first");
    assert.equal(piles[1].subject, "Biology");
    assert.equal(piles[1].active, 0);
    assert.equal(piles[1].fresh, 1);
});

check("the audit still shows what has been marked known", () => {
    // The point of an audit is seeing what the app is doing with your cards,
    // including what it has stopped asking about.
    const piles = auditPiles([learned(ago(5), { ...markKnown() })], TODAY);
    assert.equal(piles[0].known, 1);
    assert.equal(piles[0].active, 0);
});

check("every pile can say why it is on screen", () => {
    assert.match(reasonFor({ overdue: 2, oldestLate: 45 }), /over a month/);
    assert.match(reasonFor({ overdue: 1, oldestLate: 5 }), /went past 5 days ago/);
    assert.match(reasonFor({ due: 3 }), /came up for review today/);
    assert.match(reasonFor({ fresh: 9 }), /never opened/);
    assert.match(reasonFor({}), /Nothing outstanding/);
    // Singular and plural both read as English.
    assert.match(reasonFor({ overdue: 1, oldestLate: 1 }), /1 card slipped|went past 1 day ago/);
});

check("date maths does not drift across a daylight saving boundary", () => {
    // Melbourne shifts on 5 Oct 2025. Local-time date maths loses or gains an
    // hour here and rounds a 7-day gap to 6.
    assert.equal(daysBetween("2025-10-12", "2025-10-05"), 7);
    assert.equal(daysBetween("2025-04-12", "2025-04-05"), 7);
    assert.equal(daysBetween("2026-01-01", "2025-12-31"), 1);
});

check("malformed cards do not throw or count as due", () => {
    assert.equal(cardState(null, TODAY), "scheduled");
    assert.equal(isDue(null, TODAY), false);
    assert.equal(isDue({}, TODAY), false, "an empty object is new, not due");
    assert.equal(isNew({}, TODAY), true);
    assert.equal(cardState({ next_review_date: "not-a-date", total_reviews: 2 }, TODAY), "scheduled");
    assert.deepEqual(auditPiles([], TODAY), []);
    assert.equal(dueQueue([], { today: TODAY }).totalDue, 0);
});

/* ── READY: the count a deck face prints ──────────────────────────────────
 *
 * The complaint that produced this: "50 flashcards, 10 have been done, it says
 * 10 are due, even though it would be 40." `isDue` alone is the right
 * predicate for "has this lapsed" and the WRONG one for "what can I sit", and
 * every deck surface in the app was using it as the second.
 */

const reviewed = (late = 0) => ({
    repetitions: 3, total_reviews: 3,
    next_review_date: late > 0 ? shift(TODAY, -late) : TODAY,
});
const untouched = () => ({ repetitions: 0, total_reviews: 0, next_review_date: TODAY });

function shift(iso, days) {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().split("T")[0];
}

check("the student's own deck: 50 cards, 10 reviewed, reads 50 ready", () => {
    const deck = [
        ...Array.from({ length: 10 }, () => reviewed(1)),
        ...Array.from({ length: 40 }, () => untouched()),
    ];
    const t = tally(deck, TODAY);
    assert.equal(t.ready, 50, "the whole pile can be sat right now");
    assert.equal(t.active, 10, "and only ten of them have actually lapsed");
    assert.equal(t.new, 40);
    assert.equal(deck.filter((c) => isReady(c, TODAY)).length, 50);
    assert.equal(deck.filter((c) => isDue(c, TODAY)).length, 10, "the old number");
});

check("a deck nobody has opened is NOT 'all caught up'", () => {
    const fresh = Array.from({ length: 50 }, () => untouched());
    assert.equal(tally(fresh, TODAY).ready, 50);
    assert.equal(tally(fresh, TODAY).active, 0, "nothing has lapsed, and that is still true");
});

check("ready never counts a card the student has put away or snoozed", () => {
    // The whole point of retired_at and snoozed_until is leaving the queue.
    // Folding new into the count must not quietly undo either.
    assert.equal(isReady({ ...untouched(), retired_at: "2026-01-01T00:00:00Z" }, TODAY), false);
    assert.equal(isReady({ ...untouched(), snoozed_until: shift(TODAY, 3) }, TODAY), false);
    assert.equal(isReady({ ...reviewed(0), next_review_date: shift(TODAY, 5) }, TODAY), false,
        "scheduled for next week is not ready");
});

check("ready is exactly due + overdue + new, on any mix", () => {
    const mix = [
        reviewed(0), reviewed(1), reviewed(30), untouched(), untouched(),
        { ...untouched(), retired_at: "2026-01-01T00:00:00Z" },
        { ...untouched(), snoozed_until: shift(TODAY, 2) },
        { ...reviewed(0), next_review_date: shift(TODAY, 9) },
        null, {},
    ];
    const t = tally(mix, TODAY);
    assert.equal(t.ready, t.due + t.overdue + t.new);
    assert.equal(t.ready, mix.filter((c) => isReady(c, TODAY)).length);
});

check("malformed input is handled the same way isDue handles it", () => {
    assert.equal(isReady(null, TODAY), false, "there is no card to sit");
    assert.equal(isReady({}, TODAY), true, "an empty object is new, and new is ready");
});

check("`.filter(isDue)` does not hand the ARRAY INDEX in as today", () => {
    // filter calls back with (element, index, array). A number where an ISO
    // date belongs does not throw: `from > today` is false against a number so
    // nothing is scheduled, and daysBetween parses NaN to 0 so nothing is
    // overdue. Every learned card came back "due", INCLUDING ones scheduled
    // next week — which is what the deck face had always been printing.
    // Dated off the REAL today, not the fixture's: the point-free form has no
    // way to be told a date, so falling back to now is the whole behaviour
    // being asserted here.
    const ahead = new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10);
    const scheduled = { repetitions: 3, total_reviews: 3, next_review_date: ahead };
    const deck = Array.from({ length: 12 }, () => scheduled);

    assert.equal(deck.filter(isDue).length, 0, "nothing here is due");
    assert.equal(deck.filter(isReady).length, 0, "nothing here can be sat");
    assert.equal(deck.filter(isNew).length, 0);
    // And the point-free form must agree with the explicit one, always.
    assert.equal(deck.filter(isReady).length, deck.filter((c) => isReady(c)).length);
});

check("a garbage `today` falls back to now rather than mangling the answer", () => {
    const overdue = { repetitions: 2, total_reviews: 2, next_review_date: "2020-01-01" };
    for (const bad of [0, 7, null, undefined, NaN, {}, "nonsense"]) {
        assert.equal(cardState(overdue, bad), "overdue", `today=${String(bad)}`);
    }
    // A real ISO day is still honoured.
    assert.equal(cardState(overdue, "2019-01-01"), "scheduled");
});

/* ── The scan: a pile counted with isDue alone ────────────────────────────
 *
 * This renders perfectly, passes lint and the build, and is simply a smaller
 * number than the one beside it — the invisible class quizScore.test.mjs and
 * fnResult.test.mjs exist for. The audit screen is exempt BY NAME: taking a
 * pile apart into its six states is the whole reason that screen exists.
 */
const ROOT = process.cwd();
const AUDIT_SURFACES = new Set([
    "src/pages/Review.jsx",
    "src/components/study/AuditPile.jsx",
    // due.js documents the broken pattern in its own header, the same way
    // fnResult.js does. Scanning the file that defines the rule is noise.
    "src/lib/due.js",
]);

const walk = (dir, out = []) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out);
        else if (/\.jsx?$/.test(e.name) && !p.includes(".test.")) out.push(p);
    }
    return out;
};

check("nothing counts a pile with isDue alone", () => {
    const bad = [];
    for (const abs of walk(path.join(ROOT, "src"))) {
        const file = path.relative(ROOT, abs);
        if (AUDIT_SURFACES.has(file)) continue;
        const src = fs.readFileSync(abs, "utf8");
        // `.filter(isDue)` / `.filter(c => isDue(c))` feeding a `.length`, a
        // `reduce` sum or an assignment — i.e. used as a COUNT rather than as a
        // per-card label.
        const re = /\.filter\(\s*(?:isDue\b|\(?\s*\w+\s*\)?\s*=>[^)]*\bisDue\()/g;
        for (const m of src.matchAll(re)) {
            bad.push(`${file}:${src.slice(0, m.index).split("\n").length}`);
        }
    }
    assert.deepEqual(bad, [], `a pile counted with isDue alone drops every never-opened card:\n  ${bad.join("\n  ")}`);
});

check("the audit surfaces named above still exist", () => {
    // An exemption pointing at a file that has moved is an exemption that
    // silently covers nothing, and the scan would pass either way.
    for (const f of AUDIT_SURFACES) {
        assert.ok(fs.existsSync(path.join(ROOT, f)), `exempted ${f} no longer exists`);
    }
});

console.log(`\n${passed} passed${process.exitCode ? " (with failures)" : ""}\n`);
