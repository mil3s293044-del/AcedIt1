/**
 * mistake bank assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/bankRun.test.mjs
 *
 * ═══ ONE PILE, AND WHAT A RUN DID TO IT ═════════════════════════════════════
 * The bank organised seven mistakes three ways on one screen and drew each
 * one's state four ways; a drill run ended on "3 of 4 recalled" when what it
 * changed was where each mistake sits on its ladder. The rules are pure
 * (bankRun.js) and the wiring is scanned, and every check below was verified
 * by putting the bug back.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import {
    pileOf, PILE_SLOTS_MAX, bankBands, stepsFor, rungOf, afterRating, moveOf, moveLine, runSummary,
} from "@/lib/bankRun";
import { drillFor } from "@/lib/drill";
import { BANK_TOPIC, fixState, bankKey } from "@/lib/mistakeBank";
import { trayGroups, alreadyBanked, trayPicks, trayOpen, trayButton, savedLine } from "@/lib/bankTray";
import { normaliseMark, markLedger } from "@/lib/quizMarking";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};
const read = (rel) => fs.readFileSync(rel, "utf8");
/** A comment naming the broken form is not the broken form. */
const strip = (src) => src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");

/** A banked mistake with a quote and a wording, so every rung can be built. */
const card = (id, { subject = "Chemistry", criterion = `criterion ${id}`, reps = 0, interval = 0, quality = null,
    again = 0, good = 0, retired = false, source = null, topic = "Redox" } = {}) => ({
    id, topic: BANK_TOPIC, unit: BANK_TOPIC, subject_name: subject, is_active: true,
    question: "q", answer: "Anions migrate toward the anode half-cell, balancing the positive charge produced there.",
    repetitions: reps, interval_days: interval, last_quality: quality,
    review_count_again: again, review_count_good: good, total_reviews: again + good,
    ...(retired ? { retired_at: "2026-10-10T00:00:00Z" } : {}),
    extra: { mistake: { kind: "criterion", topic, criterion,
        quote: "the salt bridge just keeps everything neutral somehow",
        wanted: "Anions migrate toward the anode half-cell, balancing the positive charge produced there.",
        ...(source ? { source } : {}) } },
});

/* ── The pile ─────────────────────────────────────────────────────────────── */

check("the pile draws ONE fact, fixed or not, with the fixed at the end", () => {
    const cards = [card("a", { reps: 6, interval: 20, good: 6, quality: 4 }), card("b", { again: 2, quality: 1 }), card("c")];
    const p = pileOf(cards);
    assert.equal(p.total, 3);
    assert.equal(p.fixed, 1);
    assert.deepEqual(p.slots, [false, false, true], "fixed slots are not at the end");
    assert.equal(p.pct, 33);
});

check("past PILE_SLOTS_MAX the pile is a bar, not a row of one-pixel slots", () => {
    const many = Array.from({ length: PILE_SLOTS_MAX + 1 }, (_, i) => card(`m${i}`));
    assert.equal(pileOf(many).slots, null);
    assert.ok(Array.isArray(pileOf(many.slice(0, PILE_SLOTS_MAX)).slots));
    assert.equal(pileOf([]).pct, 0);
});

/* ── The bands ────────────────────────────────────────────────────────────── */

check("ONE organisation: subject bands, the work first inside each", () => {
    const cards = [
        card("fixed", { reps: 6, interval: 20, good: 6, quality: 4 }),
        card("slip", { again: 2, good: 1, quality: 1 }),
        card("new1"),
        card("m1", { subject: "Mathematical Methods" }),
    ];
    const bands = bankBands(cards);
    assert.deepEqual(bands.map((b) => b.subject), ["Chemistry", "Mathematical Methods"], "most outstanding is not first");
    assert.deepEqual(bands[0].rows.map((r) => r.card.id), ["slip", "new1", "fixed"], "the wins come before the work");
    assert.deepEqual([bands[0].fixed, bands[0].outstanding, bands[0].total], [1, 2, 3]);
});

check("a repeated criterion carries its count on the ROW; a one-off carries none", () => {
    const cards = [
        card("a", { criterion: "Links ion movement to neutrality" }),
        card("b", { criterion: "links ion movement to neutrality" }),
        card("c", { criterion: "Names the oxidising agent" }),
    ];
    const rows = bankBands(cards)[0].rows;
    const by = Object.fromEntries(rows.map((r) => [r.card.id, r.repeat]));
    assert.deepEqual(by, { a: 2, b: 2, c: 0 });
});

check("a cleared mistake is history, not a row; ready is what the band's button plays", () => {
    const cards = [card("live"), card("gone", { retired: true })];
    const band = bankBands(cards, { isReady: (c) => c.id === "live" })[0];
    assert.deepEqual(band.rows.map((r) => r.card.id), ["live"]);
    assert.deepEqual(band.ready.map((c) => c.id), ["live"]);
});

/* ── The ladder, before and after ─────────────────────────────────────────── */

check("a new mistake is on See it", () => {
    const r = rungOf(card("n"));
    assert.equal(r.id, "recognise");
    assert.equal(r.label, "See it");
});

check("afterRating is the scheduler's patch: Again resets, Good counts up", () => {
    const c = card("x", { reps: 2, interval: 3, good: 2, quality: 3 });
    assert.equal(afterRating(c, 1).repetitions, 0);
    assert.equal(afterRating(c, 3).repetitions, 3);
    assert.equal(afterRating(c, 2).repetitions, 2, "Hard moved the counter");
    assert.equal(afterRating(c, 3).total_reviews, 3);
});

check("GOOD CLIMBS, AGAIN SLIPS, HARD HOLDS — read off the card, not the button", () => {
    const fresh = card("f");
    const up = moveOf(fresh, afterRating(fresh, 3));
    assert.equal(up.kind, "climbed");
    assert.equal(moveLine(up), `Up to ${up.to}.`);

    const mid = card("m", { reps: 2, interval: 3, good: 2, quality: 3 });
    const down = moveOf(mid, afterRating(mid, 1));
    assert.equal(down.kind, "slipped");
    assert.equal(down.to, "See it");
    assert.match(moveLine(down), /^Back to See it\./);

    assert.equal(moveOf(mid, afterRating(mid, 2)).kind, "held");
});

check("Good INSIDE a rung is CLOSER, and says how close", () => {
    // Rungs open at 1, 2 and 4 repetitions, so 2 → 3 is a Good that keeps the
    // same exercise. "Up a rung" would claim a climb that did not happen;
    // "still on" would hide the one it did.
    const c = card("h", { reps: 2, interval: 3, good: 2, quality: 3 });
    const m = moveOf(c, afterRating(c, 3));
    assert.equal(m.kind, "closer");
    assert.equal(m.from, m.to);
    assert.equal(moveLine(m), "One more good to reach Rewrite it.");
});

/** A mistake whose own words cannot be spotted in: three words, two of them wrong. */
const unspottable = (id, extra = {}) => {
    const c = card(id, extra);
    c.extra.mistake.quote = "keeps it neutral";
    return c;
};

check("A RUNG IT CANNOT BUILD: the drill falls back, and so does the tracker", () => {
    // Found by driving a real run: the counter sat on Spot it, which this
    // mistake cannot build, so ladderFor lit no step, the drill served See it
    // again, and the run reported the card as Done.
    const c = unspottable("u", { reps: 1, interval: 1, good: 1, quality: 3 });
    assert.equal(drillFor(c).stage, "recognise");
    const steps = stepsFor(c);
    assert.equal(steps.find((s) => s.state === "current")?.id, "recognise", "no step is current");
    const r = rungOf(c);
    assert.notEqual(r.id, "done", "an unfinished card reads as done");
    assert.equal(r.id, "recognise");
    assert.equal(r.next, "Fill it");
});

check("Good on a card whose next rung is unbuildable is CLOSER, never Done", () => {
    const c = unspottable("u2");
    const m = moveOf(c, afterRating(c, 3));
    assert.equal(m.kind, "closer");
    assert.equal(m.to, "See it");
    assert.equal(moveLine(m), "One more good to reach Fill it.");
});

check("Again where it already was is the START of that rung, not a fall", () => {
    const c = unspottable("u3", { reps: 1, interval: 1, good: 1, quality: 3 });
    const m = moveOf(c, afterRating(c, 1));
    assert.equal(m.kind, "slipped");
    assert.match(moveLine(m), /^Back to the start of See it\./);
});

check("with no source question the end of the ladder is FIXED, not Prove it", () => {
    const c = card("ns", { reps: 4, interval: 6, good: 4, quality: 3 });
    assert.equal(rungOf(c).next, "fixed");
    const withSrc = card("ws", { reps: 4, interval: 6, good: 4, quality: 3, source: { quiz_id: "q", q_index: 0 } });
    assert.equal(rungOf(withSrc).next, "Prove it");
});

check("off the end of the rehearsal with a source: PROVEN, not fixed", () => {
    const src = { quiz_id: "q1", q_index: 1 };
    const c = card("p", { reps: 4, interval: 9, good: 4, quality: 4, source: src });
    const after = afterRating(c, 4);
    assert.equal(fixState(after, []), "drilled");
    const m = moveOf(c, after, []);
    assert.equal(m.kind, "proven");
    assert.match(moveLine(m), /sit the question/);
});

check("off the end with no source question: FIXED on the ladder alone", () => {
    const c = card("s", { reps: 4, interval: 9, good: 4, quality: 4 });
    assert.equal(moveOf(c, afterRating(c, 4), []).kind, "fixed");
});

/* ── The run ──────────────────────────────────────────────────────────────── */

check("a card is counted ONCE, on its last move", () => {
    const s = runSummary([
        { id: "a", kind: "slipped" }, { id: "a", kind: "climbed" },
        { id: "b", kind: "held" }, { id: "c", kind: "proven" }, { id: "d", kind: "fixed" }, { id: "e", kind: "closer" },
    ]);
    assert.equal(s.total, 5);
    assert.deepEqual([s.climbed.length, s.slipped.length, s.held.length, s.closer.length], [1, 0, 1, 1]);
    assert.equal(s.up, 4, "closer, proven and fixed are progress too");
});

/* ── The tray: banking from the marking ───────────────────────────────────── */

/** A marked written answer: one criterion earned, one dropped, a note on wording. */
const marked = (outOf = 3) => normaliseMark({
    marks: outOf - 1,
    criteria: [
        { text: "States the role of the salt bridge", got: true, worth: outOf - 1 },
        { text: "Links ion movement to neutrality", got: false, worth: 1, note: "Never says what the ions do." },
    ],
    annotations: [
        { quote: "keeps it neutral", issue: "By what?", fixes: ["anions migrate to the anode"], criterion_index: 1, severity: "lost", worth: 1 },
        { quote: "the bridge thing", issue: "Name it", fixes: ["the salt bridge"], criterion: "Precise terms", severity: "risk" },
    ],
}, outOf);

check("the tray lists what is bankable, ticks only what COST a mark", () => {
    const [g] = trayGroups([{ qIndex: 1, mark: marked(), blank: false }]);
    assert.equal(g.label, "Q2");
    const by = Object.fromEntries(g.rows.map((r) => [r.mod.text, r.pick]));
    assert.equal(by["Links ion movement to neutrality"], true, "a dropped mark is not ticked");
    assert.equal(by["Precise terms"], false, "a note that cost nothing is ticked");
    assert.ok(!("States the role of the salt bridge" in by), "an EARNED mark is offered to the bank");
    assert.equal(g.rows[0].mod.status, "lost", "the dropped mark is not first");
});

check("a BLANK question is listed and never ticked — it is a sit, not a mistake", () => {
    const [g] = trayGroups([{ qIndex: 0, mark: marked(), blank: true }]);
    assert.equal(g.blank, true);
    assert.ok(g.rows.length > 0);
    assert.ok(g.rows.every((r) => !r.pick), "an unanswered question was ticked into drill cards");
});

check("THE KEY IS THE PANEL'S KEY, so a save on one side shows on the other", () => {
    const mark = marked();
    const [g] = trayGroups([{ qIndex: 3, mark }]);
    const panelKeys = markLedger(mark).bankable.map((m) => bankKey(m, 3));
    assert.deepEqual(g.rows.map((r) => r.key), panelKeys);
    assert.ok(g.rows.every((r) => r.qIndex === 3), "a row cannot say which question it came from");
});

check("an unmarked or un-itemised question is no group; nothing ticks what is saved", () => {
    assert.deepEqual(trayGroups([{ qIndex: 0, mark: null }, { qIndex: 1, mark: { itemised: false } }]), []);
    const groups = trayGroups([{ qIndex: 0, mark: marked() }, { qIndex: 1, mark: marked(2) }]);
    const all = trayPicks(groups);
    assert.equal(all.size, 2);
    const first = [...all][0];
    const banked = new Set([first]);
    assert.ok(!trayPicks(groups, banked).has(first), "a saved mark is ticked to be saved again");
    assert.ok(!trayOpen(groups, banked).some((r) => r.key === first));
});

check("A MISTAKE BANKED ON AN EARLIER SIT reads as saved — on a re-sit too", () => {
    // A re-sit is made of questions already in the bank, so without this the
    // tray offered every repeat as new and the bank grew a copy per attempt.
    const groups = trayGroups([{ qIndex: 0, mark: marked() }]);
    const banked = (over = {}) => ({
        ...card("old", { criterion: "  links ion MOVEMENT to neutrality " }),
        ...over,
    });
    const withSource = (c, quiz_id, q_index) => { c.extra.mistake.source = { quiz_id, q_index }; return c; };
    // On a re-sit, question 0 of this paper is question 4 of the quiz.
    const hit = alreadyBanked(groups, [withSource(banked(), "quiz-1", 4)], { quizId: "quiz-1", sourceOf: () => 4 });
    assert.deepEqual([...hit], [groups[0].rows[0].key], "a banked criterion is offered again");
    assert.equal(alreadyBanked(groups, [withSource(banked(), "quiz-1", 4)], { quizId: "quiz-1" }).size, 0,
        "the same criterion on a DIFFERENT question counted as banked");
    assert.equal(alreadyBanked(groups, [withSource(banked(), "quiz-2", 4)], { quizId: "quiz-1", sourceOf: () => 4 }).size, 0,
        "another quiz's card counted");
    assert.equal(alreadyBanked(groups, [withSource(banked({ retired_at: "2026-10-01" }), "quiz-1", 4)],
        { quizId: "quiz-1", sourceOf: () => 4 }).size, 0, "a CLEARED card blocks banking a mistake made again");
    assert.equal(alreadyBanked(groups, [banked()], { quizId: "quiz-1", sourceOf: () => 4 }).size, 0,
        "a card with no source matched");
});

check("the button and the toast say what happened", () => {
    assert.match(trayButton(0), /Tick/);
    assert.equal(trayButton(3), "Save 3 to my mistake bank");
    assert.equal(savedLine(1).title, "Saved to your mistake bank");
    assert.equal(savedLine(4, 1).tone, "partial");
    assert.equal(savedLine(0, 2).tone, "error");
});

/* ── The wiring ───────────────────────────────────────────────────────────── */

const PLAYER = strip(read("src/components/quizzes/QuizPlayer.jsx"));
const MODULE = strip(read("src/components/quizzes/marking/MarkModule.jsx"));
const PANEL = strip(read("src/components/quizzes/marking/MarkPanel.jsx"));
const TRAY = strip(read("src/components/quizzes/marking/BankTray.jsx"));

check("THE VERDICT CARRIES THE TRAY, and no button there leaves before anything is saved", () => {
    assert.ok(/<BankTray groups=\{tray\} banked=\{inBank\}/.test(PLAYER), "the verdict no longer lays out the dropped marks");
    assert.ok(/alreadyBanked\(tray, bankCards/.test(PLAYER), "the tray forgets what earlier sits saved");
    assert.ok(/banked=\{inBank\}\s*saving=\{bankSaving\}\s*questionIndex/.test(PLAYER), "the marks and the tray read two different sets");
    assert.ok(/const tray = trayGroups\(/.test(PLAYER));
    assert.ok(!/data-open-bank/.test(PLAYER), "the verdict's go-to-the-bank button is back above unsaved marks");
    // The tray offers the bank only once nothing is left to save.
    assert.ok(/open\.length > 0 \? \([\s\S]*data-tray-save[\s\S]*\) : \([\s\S]*data-tray-open/.test(TRAY),
        "the tray offers to leave while marks are still unsaved");
});

check("ONE SAVE PATH, settled together, one toast a sit", () => {
    const at = PLAYER.indexOf("const bankMarks = async");
    assert.ok(at > -1, "bankMarks is gone");
    const body = PLAYER.slice(at, PLAYER.indexOf("const bankMistake", at));
    assert.ok(/Promise\.allSettled\(/.test(body), "one failed card throws the saved ones away");
    assert.ok(!/Promise\.all\(/.test(body));
    assert.ok(/if \(toldWhere\.current\) return;/.test(body), "every save fires a toast again");
    assert.ok(/bankingRef\.current\.add\(key\)/.test(body), "the double-click guard is gone");
    assert.ok(/const bankMistake = \(mod, qIndex = currentFeedbackIndex\) => bankMarks\(/.test(PLAYER));
    assert.ok(/onBankMany \? onBankMany\(unsaved\)/.test(PANEL), "Save all fires one toast per card again");
});

check("a mark's save is on its HEADER, never only inside the body that collapses", () => {
    const save = MODULE.indexOf("data-save-mark");
    const body = MODULE.indexOf("<AnimatePresence");
    assert.ok(save > -1 && body > -1 && save < body, "the save is back at the bottom of the body");
    assert.equal((MODULE.match(/onBank\(mod\)/g) || []).length, 1, "a mark has two save buttons");
    assert.ok(/Save mistake/.test(MODULE), "the mark's save reads as the card's other Save");
});

check("THE BANK PAGE: one primary drill, bands that drill their own, a ladder off stepsFor", () => {
    const PAGE = strip(read("src/pages/MistakeBank.jsx"));
    const BAND = strip(read("src/components/mistakes/BankBand.jsx"));
    assert.equal((PAGE.match(/data-drill-ready/g) || []).length, 1, "the page has more than one way to start the review again");
    assert.ok(/<BankBand[\s\S]{0,200}onDrill=/.test(PAGE), "the bands no longer drill their own subject");
    assert.ok(/stepsFor\(card, attempts\)/.test(BAND) && !/ladderFor\(/.test(BAND),
        "the row's ladder is read off the counter again, and can light nothing");
    assert.ok(!/hidden sm:block[^"]*"[^>]*>\s*<LadderTrack/.test(BAND), "the ladder is hidden on a phone again");
    // The footer said bank cards "also show up in Spaced Repetition". They do
    // not: deckCards takes the bank out of every deck surface, on purpose.
    const footer = PAGE.slice(PAGE.indexOf("data-bank-footer"));
    assert.ok(!/Spaced Repetition/.test(footer.slice(0, 400)), "the footer claims the bank is on the flashcard shelf");
    assert.ok(/if \(!haveDetail \|\| terms\.rows\.length === 0\) return null;/.test(strip(read("src/components/quizzes/CommandTermPanel.jsx"))),
        "an empty command-term panel apologises for itself again");
});

check("A DRILL AND A RE-SIT TAKE THE WHOLE SCREEN, and a re-sit is a retry of the parent", () => {
    const PAGE = strip(read("src/pages/MistakeBank.jsx"));
    const RUN = strip(read("src/components/mistakes/DrillRun.jsx"));
    assert.ok(/<SitScreen[^>]*>\s*<QuizPlayer/.test(PAGE), "a re-sit sits inside the page frame");
    assert.ok((RUN.match(/<SitScreen /g) || []).length >= 1, "the drill run is not full screen");
    assert.ok(/_isRetry: true/.test(PAGE) && /_sourceIndex: r\.qIndex/.test(PAGE),
        "a re-sit's answers are keyed to its own positions, not the parent's");
    assert.ok(/<PreSit open=\{!!pendingRedo\}/.test(PAGE), "a re-sit starts without the table");
    // EVERY KEY IN BOTH TARGETS, or a fast rating freezes the card tilted.
    const card = RUN.slice(RUN.indexOf("data-drill-card={drill.stage}"), RUN.indexOf("exit=", RUN.indexOf("data-drill-card={drill.stage}")));
    const targets = card.match(/\{ opacity: [^}]*\}/g) || [];
    assert.ok(targets.length >= 3, "the card's animate targets moved — re-check this scan");
    for (const t of targets.slice(1)) assert.ok(/\bx: /.test(t) && /rotate: /.test(t), `a target drops x or rotate: ${t}`);
});

console.log(`\n${passed} mistake bank checks passed`);
