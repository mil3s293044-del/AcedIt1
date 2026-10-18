/**
 * quiz sit assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/quizSit.test.mjs
 *
 * ═══ ONE SIT, FOUR SCREENS, ONE ARITHMETIC ══════════════════════════════════
 * The shelf, the table before a sit, the sit and the results each printed a
 * number about the quiz and worked it out for themselves. The results headline
 * was a percentage of MARKS over "2 right · 4 total" in QUESTIONS; "lost marks
 * on 2" sat beside "redo the 1 you missed"; the SAC clock counted a nine-mark
 * multipart question as one mark; "next quiz" was whichever row came first.
 *
 * None of that throws. So the rules are pure (quizSit.js) and the wiring is
 * scanned, and every check below was verified by putting the bug back.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import {
    paperFacts, SAC_MIN_MINUTES, daysBetween, agoLabel, sitHistory,
    nextSit, LOW_SCORE, STALE_DAYS,
    cardState, handOf, handTotal, marksShown, rankTurn, handTiming, HAND,
} from "@/lib/quizSit";
import { questionMark, attemptScore, needsDrill } from "@/lib/quizScore";
import { MINUTES_PER_MARK } from "@/lib/quizSetup";
import { DEFAULT_SHORT_MARKS } from "@/lib/quizSchema";

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

const NOW = new Date(2026, 9, 18, 15, 0, 0).getTime();
const ago = (days, h = 0) => { const d = new Date(NOW); d.setDate(d.getDate() - days); d.setHours(d.getHours() - h); return d.toISOString(); };

const MCQ = (correct = 0) => ({ type: "mcq", question: "q", options: ["a", "b", "c", "d"], correct_answer: correct });
const SHORT = (marks) => ({ type: "short_answer", question: "q", ...(marks ? { marks } : {}), model_answer: "m" });
const MULTI = { stem: "s", parts: [
    { label: "a", type: "short_answer", marks: 4, question: "a" },
    { label: "b", type: "short_answer", marks: 5, question: "b" },
] };

/* ── The paper ────────────────────────────────────────────────────────────── */

check("MARKS COME THROUGH normaliseQuestion: a multipart worth nine is nine, not one", () => {
    const f = paperFacts({ questions: [MCQ(), SHORT(3), MULTI] });
    assert.equal(f.marks, 1 + 3 + 9);
    assert.deepEqual([f.questions, f.mcq, f.written, f.multipart], [3, 1, 1, 1]);
});

check("a written answer with no stored allocation is the schema's default, not one", () => {
    // `Number(q.marks) || 1` read it as one mark, so the SAC clock ran short.
    assert.equal(paperFacts({ questions: [SHORT()] }).marks, DEFAULT_SHORT_MARKS);
});

check("the SAC clock is VCAA's rate on the real marks, with a floor", () => {
    const big = paperFacts({ questions: Array.from({ length: 8 }, () => SHORT(5)) });
    assert.equal(big.sacMinutes, Math.ceil(40 * MINUTES_PER_MARK));
    assert.equal(paperFacts({ questions: [MCQ()] }).sacMinutes, SAC_MIN_MINUTES);
});

check("an empty quiz has no minutes rather than a five-minute floor", () => {
    assert.equal(paperFacts({ questions: [] }).minutes, 0);
    assert.equal(paperFacts(null).questions, 0);
});

/* ── History ──────────────────────────────────────────────────────────────── */

check("days are LOCAL calendar days, so 11pm last night is yesterday", () => {
    const late = new Date(NOW); late.setDate(late.getDate() - 1); late.setHours(23, 30, 0, 0);
    assert.equal(daysBetween(late, NOW), 1);
    assert.equal(daysBetween("junk", NOW), null);
    assert.deepEqual([agoLabel(0), agoLabel(1), agoLabel(4), agoLabel(null)], ["today", "yesterday", "4 days ago", null]);
});

check("a retry is a TRY and never a SIT: it moves no best and no last score", () => {
    const quiz = { id: "q" };
    const attempts = [
        { quiz_id: "q", score: 60, created_date: ago(5) },
        { quiz_id: "q", score: 100, created_date: ago(1), extra: { is_retry: true } },
    ];
    const h = sitHistory(quiz, attempts, NOW);
    assert.equal(h.tries, 2);
    assert.equal(h.sits, 1);
    assert.equal(h.best, 60);
    assert.equal(h.last.score, 60);
});

check("THE ADJUSTED SCORE is the one a student was shown", () => {
    const h = sitHistory({ id: "q" }, [{ quiz_id: "q", score: 60, adjusted_score: 78, created_date: ago(2) }], NOW);
    assert.equal(h.best, 78);
    assert.equal(h.last.score, 78);
});

check("a quiz never sat has a NULL best (a two on the face), never 0", () => {
    const h = sitHistory({ id: "q" }, [], NOW);
    assert.equal(h.best, null);
    assert.equal(h.last, null);
    assert.equal(h.rank, "2");
});

check("an unscored sit is not a zero", () => {
    const h = sitHistory({ id: "q" }, [{ quiz_id: "q", score: null, created_date: ago(1) }], NOW);
    assert.equal(h.sits, 1);
    assert.equal(h.best, null);
    assert.equal(h.last, null);
});

/* ── The next sit ─────────────────────────────────────────────────────────── */

const Q = (id, days) => ({ id, title: id, questions: [MCQ()], created_date: ago(days) });

check("a low last sit is run back — but never the same day", () => {
    const quizzes = [Q("a", 20), Q("b", 20)];
    const today = [{ quiz_id: "a", score: 30, created_date: ago(0) }, { quiz_id: "b", score: 80, created_date: ago(2) }];
    assert.notEqual(nextSit(quizzes, today, NOW).reason, "low");
    const yesterday = [{ quiz_id: "a", score: 30, created_date: ago(1) }, { quiz_id: "b", score: 80, created_date: ago(2) }];
    const n = nextSit(quizzes, yesterday, NOW);
    assert.equal(n.quiz.id, "a");
    assert.equal(n.reason, "low");
});

check("the lowest of several low sits goes first", () => {
    const n = nextSit([Q("a", 20), Q("b", 20)], [
        { quiz_id: "a", score: LOW_SCORE - 1, created_date: ago(3) },
        { quiz_id: "b", score: 20, created_date: ago(3) },
    ], NOW);
    assert.equal(n.quiz.id, "b");
});

check("then a quiz never sat, newest first", () => {
    const n = nextSit([Q("old", 30), Q("new", 1), Q("sat", 30)], [{ quiz_id: "sat", score: 90, created_date: ago(2) }], NOW);
    assert.equal(n.quiz.id, "new");
    assert.equal(n.reason, "new");
});

check("then the longest since a sit, once it is STALE_DAYS old", () => {
    const n = nextSit([Q("a", 40), Q("b", 40)], [
        { quiz_id: "a", score: 90, created_date: ago(STALE_DAYS) },
        { quiz_id: "b", score: 90, created_date: ago(STALE_DAYS + 5) },
    ], NOW);
    assert.equal(n.quiz.id, "b");
    assert.equal(n.reason, "stale");
});

check("otherwise the lowest last sit, and the line says so", () => {
    const n = nextSit([Q("a", 40), Q("b", 40)], [
        { quiz_id: "a", score: 88, created_date: ago(2) },
        { quiz_id: "b", score: 72, created_date: ago(1) },
    ], NOW);
    assert.equal(n.quiz.id, "b");
});

check("a quiz with no questions is never offered, and nothing at all is null", () => {
    assert.equal(nextSit([{ id: "x", questions: [] }], [], NOW), null);
    assert.equal(nextSit([], [], NOW), null);
});

/* ── The scored hand ──────────────────────────────────────────────────────── */

const paper = [MCQ(0), SHORT(3), MCQ(1), SHORT(2)];
const fb = [{ marks: 1 }, { marks: 2 }, { marks: 1 }, { marks: 1 }];
const text = ["", "it completes the circuit", "", "Cu2+"];
const markAt = (i) => questionMark(paper[i], i, fb[i], undefined, paper[i].type === "mcq" ? undefined : text[i]);

check("the headline is in MARKS: 5 of 7, and it is the saved score exactly", () => {
    const hand = handOf(paper, markAt, () => true);
    const t = handTotal(hand);
    assert.deepEqual([t.awarded, t.outOf], [5, 7]);
    const saved = attemptScore(paper, fb, {}, (i) => (paper[i].type === "mcq" ? undefined : text[i]));
    assert.equal(t.pct, saved.autoPct, "the hand and the persisted score disagree");
});

check("FULL, PART and MISSED — and MISSED is needsDrill, not a second threshold", () => {
    const hand = handOf(paper, markAt, () => true);
    assert.deepEqual(hand.map((c) => c.state), ["full", "part", "full", "missed"]);
    const drill = paper.filter((q, i) => needsDrill(q, markAt(i))).length;
    const t = handTotal(hand);
    assert.equal(t.missed, drill, "the redo count and the red cards disagree");
    assert.equal(t.lost, 2, "lost marks is every card short of full");
});

check("a written answer still with the marker is PENDING, not zero", () => {
    // MCQs are known the moment they are answered; written work is not.
    const hand = handOf(paper, (i) => questionMark(paper[i], i, paper[i].type === "mcq" ? fb[i] : undefined),
        (i) => paper[i].type === "mcq");
    assert.deepEqual(hand.map((c) => c.state), ["full", "pending", "full", "pending"]);
    const t = handTotal(hand);
    assert.deepEqual([t.awarded, t.outOf, t.pendingMarks, t.pending], [2, 2, 5, 2]);
    assert.equal(t.pct, 100, "pending marks were counted as lost");
});

check("with the marking failed, the hand's percentage IS the MCQ-only fallback", () => {
    // What saveMcqOnlyAttempt saves: MCQs right over MCQs asked.
    const mcqIdx = paper.map((q, i) => (q.type === "mcq" ? i : -1)).filter((i) => i >= 0);
    const right = mcqIdx.filter((i) => fb[i].marks >= 1).length;
    const fallback = Math.round((right / mcqIdx.length) * 100);
    const hand = handOf(paper, (i) => questionMark(paper[i], i, paper[i].type === "mcq" ? fb[i] : undefined),
        (i) => paper[i].type === "mcq");
    assert.equal(handTotal(hand).pct, fallback);
});

check("nothing marked is NULL, never 0%", () => {
    assert.equal(handTotal(handOf([SHORT(3)], () => questionMark(SHORT(3), 0), () => false)).pct, null);
    assert.equal(handTotal([]).pct, null);
});

check("cardState: no mark or no allocation is pending", () => {
    assert.equal(cardState(MCQ(), null, true), "pending");
    assert.equal(cardState(MCQ(), { outOf: 0, auto: 0 }, true), "pending");
});

check("the count is the CARDS: only a turned card adds, and all turned is the headline", () => {
    const hand = handOf(paper, markAt, () => true);
    const after = (ids) => marksShown(hand, new Set(ids));
    assert.deepEqual([after([]), after([0]), after([0, 1]), after([0, 1, 2]), after([0, 1, 2, 3])], [0, 1, 3, 4, 5]);
    assert.equal(after([0, 1, 2, 3]), handTotal(hand).awarded);
    // A late card (the marker came back) adds whenever IT turns, in any order.
    assert.equal(after([3]), 1);
});

check("a pending card adds nothing, even if something claims it turned", () => {
    const hand = handOf(paper, (i) => questionMark(paper[i], i, paper[i].type === "mcq" ? fb[i] : undefined),
        (i) => paper[i].type === "mcq");
    assert.equal(marksShown(hand, new Set([0, 1, 2, 3])), 2);
    // handOf nulls a pending card's marks, so the rule has to be tested on a
    // card that CARRIES a number — the state decides, not the figure.
    assert.equal(marksShown([{ index: 0, state: "pending", auto: 3, outOf: 3 }], new Set([0])), 0);
});

/* ── The deck face turning ────────────────────────────────────────────────── */

check("a first sit turns the never-sat two into what it earned", () => {
    const t = rankTurn({ previousBest: null, score: 71 });
    assert.equal(t.first, true);
    assert.equal(t.from, "2");
    assert.equal(t.turned, true);
});

check("only a NEW BEST moves the face, and only a new rank turns it", () => {
    assert.equal(rankTurn({ previousBest: 75, score: 71 }), null);
    assert.equal(rankTurn({ previousBest: 75, score: 75 }), null);
    const same = rankTurn({ previousBest: 75, score: 76 });
    assert.ok(same && same.turned === false, "a best on the same card turned it");
    const up = rankTurn({ previousBest: 58, score: 92 });
    assert.ok(up.turned && up.from !== up.to);
});

check("a retry and an unscored sit never move the face", () => {
    assert.equal(rankTurn({ previousBest: 40, score: 100, isRetry: true }), null);
    assert.equal(rankTurn({ previousBest: 40, score: null }), null);
    // `Number(null)` is 0: a null previous best must read as a first sit, and
    // a null score must not read as a zero that "fails to beat" anything.
    assert.equal(rankTurn({ previousBest: 0, score: 0 }), null);
});

/* ── The reveal ───────────────────────────────────────────────────────────── */

check("the reveal is CAPPED however long the paper is", () => {
    for (const n of [1, 4, 12, 30]) {
        const t = handTiming(n);
        assert.ok(t.turnAt(n - 1) <= HAND.turnStart + HAND.turnCap + 1e-9, `${n} cards turned past the cap`);
        assert.ok(t.dealAt(n - 1) <= HAND.dealCap + 1e-9, `${n} cards dealt past the cap`);
        assert.ok(t.turnAt(0) >= t.dealAt(n - 1), "a card turned before the deal finished");
    }
    assert.equal(handTiming(0).doneAt, 0);
});

/* ── The wiring ───────────────────────────────────────────────────────────── */

const PLAYER = strip(read("src/components/quizzes/QuizPlayer.jsx"));
const PAGE = strip(read("src/pages/Quizzes.jsx"));
const PRESIT = strip(read("src/components/quizzes/PreSit.jsx"));
const HANDC = strip(read("src/components/quizzes/ScoredHand.jsx"));
const REACTS = strip(read("src/components/ace/AceReacts.jsx"));

/** The body of `const name = (...) => { ... }`, by brace depth from its arrow. */
function bodyOf(src, name) {
    const at = src.indexOf(`const ${name} = `);
    assert.ok(at > -1, `${name} is gone — re-check this scan`);
    const open = src.indexOf("{", src.indexOf("=>", at));
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        if (src[i] === "{") depth += 1;
        else if (src[i] === "}") { depth -= 1; if (depth === 0) return src.slice(open, i + 1); }
    }
    return src.slice(open);
}

check("A SAC HOLDS EVERY VERDICT: the player returns before marking an MCQ", () => {
    // The SAC sheet said "nothing marked until you hand it in" and the player
    // never checked, so options went green and Ace ate cards in exam mode.
    const body = bodyOf(PLAYER, "handleSubmitAnswer");
    const hold = body.indexOf("if (isSAC)");
    const verdict = body.indexOf("setShowFeedback(true)");
    assert.ok(hold > -1 && verdict > -1 && hold < verdict, "an MCQ is marked as you go in a SAC");
    assert.ok(/if \(isSAC\) \{[^}]*handleNext\(\);[^}]*return;/.test(body), "the SAC hold does not move on and return");
    // And the sheet says so, because the two are one promise.
    assert.ok(/nothing marked until you hand it in/.test(PRESIT), "the SAC line changed — re-check the player still keeps it");
});

check("the SAC clock is paperFacts's, never a hand-rolled `q.marks || 1`", () => {
    assert.ok(/facts\.sacMinutes/.test(PRESIT), "the sheet no longer sets the clock from the paper");
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
        d.isDirectory() ? walk(`${dir}/${d.name}`) : /\.(jsx?|mjs)$/.test(d.name) ? [`${dir}/${d.name}`] : []);
    const bad = walk("src").filter((f) => !f.endsWith(".test.mjs"))
        .filter((f) => /Number\(q\.marks\)\s*\|\|\s*1\b/.test(strip(read(f))));
    assert.deepEqual(bad, [], "a mark allocation is hand-rolled again");
    assert.ok(!fs.existsSync("src/components/quizzes/QuizModePicker.jsx"), "the two-step mode picker is back");
});

check("THE SIT IS FULL SCREEN WITH ONE EXIT", () => {
    // One wrapper for every sit — the quiz, a re-sit, a drill run.
    assert.ok(/<SitScreen[^>]*>\s*<QuizPlayer/.test(PAGE), "the sit is back inside the page frame");
    assert.ok(/data-sit[^>]*className="fixed inset-0 z-50/.test(strip(read("src/components/shared/SitScreen.jsx"))),
        "the sit screen no longer covers the frame");
    assert.ok(!/Back to Quizzes/.test(PAGE), "a second exit is back above the player's own");
    assert.ok(/<button onClick=\{leave\}/.test(PLAYER), "the player's exit no longer goes through leave()");
    assert.ok(/if \(isSAC\)[\s\S]{0,120}window\.confirm/.test(bodyOf(PLAYER, "leave")), "leaving a SAC no longer asks");
});

check("THE RESULTS ARE THE HAND, in marks, with nothing counted in questions", () => {
    assert.ok(/<ScoredHand[\s\S]{0,200}hand=\{hand\}[\s\S]{0,80}total=\{handSum\}/.test(PLAYER), "the verdict is not the scored hand");
    assert.ok(!/stat-label">\s*Right/.test(PLAYER), "\"2 right · 4 total\" is back under a percentage of marks");
    assert.ok(/marks<\/p>/.test(HANDC), "the hand's total no longer says it is marks");
    // The sentence and the button count off the hand, and the hand's red
    // cards ARE the drill (the model check above).
    assert.ok(/You dropped marks on <span[^>]*>\{handSum\.lost\}/.test(PLAYER), "the dropped-marks sentence counts something else");
});

check("THE COUNT IS THE CARDS, and a card the marker has not returned stays down", () => {
    assert.ok(/marksShown\(hand, turned\)/.test(HANDC), "the total animates on its own rather than adding turned cards");
    assert.ok(/animate=\{\{ rotateY: up \? 0 : 180 \}\}/.test(HANDC), "a pending card is turned over before it is marked");
    assert.ok(/firstUp\.current\.has\(card\.index\) \? timing\.turnAt/.test(HANDC), "the reveal no longer runs on handTiming's capped clock");
});

check("the time taken stops when the paper is handed in", () => {
    // `Date.now() - startTime` on the results kept ticking while they read.
    assert.ok(/elapsed=\{formatElapsed\(\(finishedAt \?\? Date\.now\(\)\) - startTime\)\}/.test(PLAYER));
    assert.ok(/setFinishedAt\(Date\.now\(\)\)/.test(bodyOf(PLAYER, "handleFinishQuiz")));
});

check("ACE REACTS TO THE SAVED SCORE, after the marker — and no toast says it twice", () => {
    assert.ok(!/aceDone\(/.test(bodyOf(PLAYER, "handleFinishQuiz")), "Ace fires before marking again, on MCQs over every question");
    assert.ok(/aceDone\("quiz", finalScore\)/.test(PLAYER), "Ace no longer reacts to the real score");
    assert.ok(!/title: "Quiz marked!"/.test(PLAYER), "the success toast is back over the top bar");
    // Centred by a full-width row: framer writes its own transform and wipes
    // a Tailwind translate on the moving element.
    assert.ok(!/-translate-x-1\/2/.test(REACTS), "the reaction is centred by a transform framer overwrites");
    const after = read("src/lib/aceVoice.js").split("export const AFTER")[1].split("};")[0];
    assert.ok(!/into cards/.test(strip(after)), "Ace offers to make cards from misses, a button that was deleted");
});

check("THE OLD HEADER, AND THE QUIZ ITS STRIP NAMES IS DECIDED", () => {
    // The head went back to the coach strip, the hero and the "Next quiz"
    // strip by request. What survived is which quiz that strip names: it was
    // a RANDOM one for a library never sat and otherwise the first row.
    assert.ok(/nextSit\(quizzes, quizAttempts\)/.test(PAGE), "the strip no longer asks nextSit");
    assert.ok(!/Math\.random\(\)/.test(PAGE), "a random quiz is offered again");
    assert.ok(/const random = pick \|\|/.test(PAGE) && /const target = pick \|\|/.test(PAGE),
        "the strip names a quiz nextSit did not choose");
    assert.ok(!fs.existsSync("src/components/quizzes/ShelfHead.jsx"), "the reworked head is back");
});

check("the generator names the job, not the technology", () => {
    assert.ok(!/AI Quiz Generator/.test(PAGE));
    assert.ok(!/let AI create/.test(PAGE));
});

console.log(`\n${passed} quiz sit checks passed`);
