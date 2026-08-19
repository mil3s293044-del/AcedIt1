/**
 * due assertions — node --import ./src/lib/_aliasLoader.mjs src/lib/due.test.mjs
 *
 * The regression these pin down is the complaint that started this: the app
 * always thinks a bunch of flashcards are due. It was right that the number
 * was large and wrong about what the number meant.
 */
import assert from "node:assert/strict";
import {
    cardState, isDue, isNew, tally, dueQueue, auditPiles, reasonFor,
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

console.log(`\n${passed} passed${process.exitCode ? " (with failures)" : ""}\n`);
