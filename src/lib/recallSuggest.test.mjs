/**
 * recallSuggest assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/recallSuggest.test.mjs
 *
 * Both of these shipped and were caught in a SCREENSHOT of a real account,
 * which is the shape this codebase keeps meeting: the panel rendered
 * perfectly, lint and the build passed, and the sentences under two of the
 * four rows were simply false about the student they were describing.
 */
import assert from "node:assert/strict";
import { suggestTopics } from "@/lib/recallSuggest";
import { retentionOutlook } from "@/lib/retention";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const DAY = 86400000;
const NOW = Date.parse("2026-10-02T00:00:00Z");

/** A card the forgetting curve can place: reviewed once, due long ago. */
const learned = (subject, topic, i, daysAgo) => ({
    id: `${subject}-${topic}-${i}`,
    subject_name: subject,
    topic,
    question: `Q${i}`,
    answer: `A${i}`,
    is_active: true,
    total_reviews: 3,
    review_count_good: 3,
    interval_days: 2,
    last_reviewed_date: new Date(NOW - daysAgo * DAY).toISOString(),
});

check("A 0% MISS RATE IS NOT EVIDENCE OF COSTING MARKS", () => {
    // `weakTopicsFrom` keeps a topic on `weakCards > 0` ALONE, so a deck whose
    // every review landed still arrives with a real `missRate` of 0 — and
    // `missRate != null` is TRUE of 0. The row printed "0% of your reviews on
    // this missed" under a pill reading "Costing you marks", which is the app
    // telling a student their clean record is the problem.
    const flashcards = [0, 1, 2].map(i => ({
        id: `w${i}`, subject_name: "Legal Studies", topic: "Remedies",
        question: `Q${i}`, answer: `A${i}`, is_active: true,
        total_reviews: 4, review_count_good: 4,   // every review landed
        is_weak_spot: true,                       // but flagged by hand
    }));
    const [row] = suggestTopics({ flashcards, now: NOW, limit: 4 });
    assert.ok(row, "a flagged topic should still be suggested");
    assert.equal(row.kind.id, "weak");
    assert.doesNotMatch(row.why, /^0%/, `printed "${row.why}"`);
    assert.match(row.why, /weak spot/, `printed "${row.why}"`);
});

check("a real miss rate is still the reason when there is one", () => {
    // The fix must not simply delete the rate — it is the better sentence
    // whenever it is true.
    const flashcards = [0, 1, 2, 3].map(i => ({
        id: `m${i}`, subject_name: "Chemistry", topic: "Redox",
        question: `Q${i}`, answer: `A${i}`, is_active: true,
        total_reviews: 4, review_count_good: 1, is_weak_spot: true,
    }));
    const [row] = suggestTopics({ flashcards, now: NOW, limit: 4 });
    assert.match(row.why, /% of your reviews on this missed/);
    assert.doesNotMatch(row.why, /^0%/);
});

check("A SUBJECT TOTAL IS NOT A TOPIC'S NUMBER", () => {
    // `s.slipping` counts the whole SUBJECT and was printed on every TOPIC row
    // it produced, with two topics taken per subject — so both rows read
    // identically, and the figure sat next to a card count for one topic that
    // it could not possibly be about.
    const flashcards = [
        ...Array.from({ length: 9 }, (_, i) => learned("Legal Studies", "Slide 3", i, 60)),
        ...Array.from({ length: 4 }, (_, i) => learned("Legal Studies", "AOS 2", i, 60)),
    ];
    const rows = suggestTopics({ flashcards, now: NOW, limit: 6 })
        .filter(r => r.kind.id === "slipped");
    assert.ok(rows.length >= 2, `expected two slipped topics, got ${rows.length}`);
    assert.notEqual(rows[0].why, rows[1].why,
        `two topics under one subject printed the identical sentence: "${rows[0].why}"`);
    // And the number is the TOPIC's, so it can never exceed that topic's deck.
    for (const r of rows) {
        const n = Number((r.why.match(/^(\d+)/) || [])[1]);
        const inTopic = flashcards.filter(c => c.topic === r.topic).length;
        assert.ok(Number.isFinite(n) && n <= inTopic,
            `"${r.why}" claims more cards than the ${inTopic} in ${r.topic}`);
    }
});

check("topicCounts keys match the topics beside them, and sum to the subject", () => {
    // The carrier for the above. A map keyed on anything else is a silent
    // lookup miss, which would print 0 — the number the fix exists to stop.
    const flashcards = [
        ...Array.from({ length: 5 }, (_, i) => learned("Chemistry", "Bonding", i, 60)),
        ...Array.from({ length: 3 }, (_, i) => learned("Chemistry", "Rates", i, 60)),
    ];
    const [s] = retentionOutlook(flashcards, { days: 7, now: NOW }).subjects;
    assert.ok(s, "nothing was projected at all");
    for (const t of s.topics) {
        assert.ok(s.topicCounts[t], `no count for "${t}"`);
    }
    const summed = Object.values(s.topicCounts).reduce((a, n) => a + n.total, 0);
    assert.equal(summed, s.total, "the topic counts do not add up to the subject");
});

check("no history is no suggestions, never filler", () => {
    // A suggestion with no reason behind it is the "default questions" problem
    // in a new hat, which is what this module replaced.
    assert.deepEqual(suggestTopics({ now: NOW }), []);
    assert.deepEqual(suggestTopics({ flashcards: [], assessments: [], techniques: [], now: NOW }), []);
});

console.log(`\nrecallSuggest: ${passed} checks passed`);
