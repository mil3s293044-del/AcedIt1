/**
 * shared-deck assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/sharedDeck.test.mjs
 *
 * A deck crossing between two students is the one write in this app that is
 * built from ANOTHER student's row, so every field is guilty until named. The
 * bug this exists for rendered perfectly, passed lint and the build, and simply
 * 400'd at the database: `subject_code` is not a flashcards column, both share
 * writers put it in the blob, and the accept handler spread the blob straight
 * into `create`. Accepting a shared deck had never worked.
 *
 * So the schema is read from the migrations rather than restated here — a
 * column list written down twice is the thing that went wrong.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
    SHARED_CARD_FIELDS, outgoingCard, outgoingDeck, importedCard, importedDeck, importDeckId,
} from "@/lib/sharedDeck";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const ROOT = process.cwd();
const schema = JSON.parse(fs.readFileSync(path.join(ROOT, "supabase/schema.json"), "utf8"));
const FLASHCARD_COLUMNS = new Set(schema.flashcards || []);

/* A card as the SHARER holds it: content, plus everything that is theirs. */
const sharerCard = {
    id: "card-1",
    created_by: "sharer@example.com",
    created_date: "2026-01-01T00:00:00Z",
    subject_name: "Chemistry",
    subject_code: "CHEM",          // not a column — this is the bug
    unit: "Unit 3",
    topic: "Redox",
    question: "What is oxidation?",
    answer: "Loss of electrons.",
    repetitions: 6,
    easiness_factor: 2.9,
    interval_days: 45,
    next_review_date: "2026-12-01",
    last_reviewed_date: "2026-10-17",
    last_quality: 5,
    total_reviews: 11,
    retired_at: "2026-10-17T09:00:00Z",   // they marked it "I know this"
    snoozed_until: "2026-11-01",
    consecutive_good: 4,
    consecutive_easy: 3,
    review_count_easy: 7,
    is_weak_spot: true,
    _mastery_score: 0.94,          // derived, has no column at all
};

check("every field a card carries is a real flashcards column", () => {
    assert.ok(FLASHCARD_COLUMNS.size > 0, "schema.json has no flashcards entry");
    for (const f of SHARED_CARD_FIELDS) {
        assert.ok(FLASHCARD_COLUMNS.has(f), `SHARED_CARD_FIELDS names "${f}", which flashcards does not have`);
    }
});

check("the outgoing card carries content and nothing else", () => {
    const out = outgoingCard(sharerCard);
    assert.deepEqual(Object.keys(out).sort(), [...SHARED_CARD_FIELDS].sort());
    assert.equal(out.subject_code, undefined, "subject_code left the sharer — this is the 400");
    assert.equal(out.id, undefined);
    assert.equal(out.created_by, undefined);
    assert.equal(out.retired_at, undefined);
});

check("unit survives the crossing", () => {
    // The review shelf keys decks on subject|topic|unit. The group importer
    // dropped it, so an imported deck split off under a blank unit.
    assert.equal(outgoingCard(sharerCard).unit, "Unit 3");
    assert.equal(importedCard(sharerCard, "d1").unit, "Unit 3");
});

check("a card with no unit of its own takes the deck's", () => {
    const out = outgoingCard({ question: "q", answer: "a" }, { subject_name: "Methods", unit: "Unit 4", topic: "Calculus" });
    assert.equal(out.subject_name, "Methods");
    assert.equal(out.unit, "Unit 4");
    assert.equal(out.topic, "Calculus");
});

check("every field the recipient gets is a real flashcards column", () => {
    for (const k of Object.keys(importedCard(sharerCard, "d1"))) {
        assert.ok(FLASHCARD_COLUMNS.has(k), `importedCard writes "${k}", which flashcards does not have`);
    }
});

check("NONE of the sharer's SM-2 state arrives", () => {
    // Asserted against the sharer's FULL row, not the whitelisted blob: an
    // older shared_flashcards row, or the next writer somebody adds, carries
    // all of this, and a spread would have taken it.
    const got = importedCard(sharerCard, "d1");
    assert.equal(got.repetitions, 0);
    assert.equal(got.easiness_factor, 2.5);
    assert.equal(got.interval_days, 0);
    assert.equal(got.total_reviews, 0);
    assert.equal(got.last_quality, null);
    assert.equal(got.last_reviewed_date, null);
    assert.equal(got.consecutive_good, 0);
    assert.equal(got.consecutive_easy, 0);
    assert.equal(got.review_count_easy, 0);
    assert.equal(got.is_weak_spot, false);
    assert.equal(got.session_skip_count, 0);
});

check("a deck the sharer had retired arrives LIVE", () => {
    // `retired_at` takes a card out of every queue in the app — due.js reports
    // `known` before it checks anything else. Carried across, a friend would
    // accept sixty cards and find an empty deck.
    const got = importedCard(sharerCard, "d1");
    assert.equal(got.retired_at, null);
    assert.equal(got.snoozed_until, null);
    assert.equal(got.is_active, true);
});

check("an imported card is NEW, not scheduled", () => {
    assert.equal(importedCard(sharerCard, "d1").next_review_date, null);
});

check("the deck id is the one given", () => {
    assert.equal(importedCard(sharerCard, "deck_abc").deck_id, "deck_abc");
});

check("a card missing its question or answer is dropped, not inserted", () => {
    // Both columns are `not null`, so one empty card would reject the insert
    // and lose every other card in the deck.
    const deck = { subject_name: "Bio", topic: "Cells", cards: [
        { question: "q1", answer: "a1" },
        { question: "  ", answer: "a2" },
        { question: "q3", answer: null },
        { question: "q4", answer: "a4" },
    ] };
    assert.equal(outgoingDeck(deck).length, 2);
    assert.equal(importedDeck(deck.cards, "d1").length, 2);
});

check("empty and malformed input is a deck of nothing, never a throw", () => {
    assert.deepEqual(outgoingDeck(null), []);
    assert.deepEqual(outgoingDeck({ cards: "nope" }), []);
    assert.deepEqual(importedDeck(undefined, "d1"), []);
    assert.equal(outgoingCard(null).question, "");
});

check("two imports in the same millisecond get different deck ids", () => {
    const ids = new Set(Array.from({ length: 200 }, () => importDeckId()));
    assert.ok(ids.size > 190, `import deck ids collided: ${200 - ids.size} of 200`);
});

/* ── The scan: nothing may hand-roll this crossing again ──────────────── */

const walk = (dir, out = []) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out);
        else if (/\.(jsx?|mjs)$/.test(e.name) && !p.includes(".test.")) out.push(p);
    }
    return out;
};
const FILES = walk(path.join(ROOT, "src")).map((p) => [path.relative(ROOT, p), fs.readFileSync(p, "utf8")]);

check("no card-shaped literal names subject_code", () => {
    // Matched on the SHAPE rather than on what is nearby: an object carrying
    // `question` and `answer` is a flashcard wherever it was written, and
    // flashcards has no `subject_code`. The window-based version of this check
    // missed SpacedRepetition.jsx, where the literal and the
    // `flashcard_data:` that consumes it are three hundred characters apart.
    const bad = [];
    for (const [file, src] of FILES) {
        if (file === "src/lib/sharedDeck.js") continue;
        for (const m of src.matchAll(/\{[^{}]*\bsubject_code:[^{}]*\}/g)) {
            const lit = m[0];
            if (!/\bquestion:/.test(lit) || !/\banswer:/.test(lit)) continue;
            bad.push(`${file}:${src.slice(0, m.index).split("\n").length}`);
        }
    }
    assert.deepEqual(bad, [], `subject_code on a flashcard payload — flashcards has no such column:\n  ${bad.join("\n  ")}`);
});

check("no accept handler spreads a shared card into create()", () => {
    const bad = [];
    for (const [file, src] of FILES) {
        for (const m of src.matchAll(/Flashcard\.create\(\s*\{\s*\.\.\./g)) {
            const line = src.slice(0, m.index).split("\n").length;
            const around = src.slice(Math.max(0, m.index - 400), m.index);
            // A spread of a card the app itself just generated is fine; a
            // spread of somebody ELSE'S stored row is the leak.
            if (/flashcard_data|resource_data|shared|imported/i.test(around)) bad.push(`${file}:${line}`);
        }
    }
    assert.deepEqual(bad, [], `a shared card spread into create() carries the sharer's own state:\n  ${bad.join("\n  ")}`);
});

console.log(`\nsharedDeck: ${passed} checks passed`);
