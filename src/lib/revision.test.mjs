/**
 * revision assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/revision.test.mjs
 *
 * ═══ ONE FOLDER PER SAC, AND EVERYTHING THAT BELONGS IN IT ══════════════════
 * A folder is a SAC (or a subject's exam) plus the topics it covers, and its
 * contents are DERIVED from rows the app already loads. What can go wrong
 * silently is all arithmetic: an item filed in the wrong folder, a topic guess
 * applied without being asked, a check read back against the wrong point, an
 * unmarked answer read as a fail, and a readiness bar that flatters. Every
 * check below was verified by putting the bug back.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import {
    foldersFor, findFolder, daysUntil, sacKey, examKey, topicOf, topicOptions, suggestedTopics, inFolder,
    folderContents, isWeakCard, splitOutline, mergePoints, ratePoint, removePoint, editPoint, pointId,
    revisionPatch, checkQuiz, pointProof, pointState, orderPoints, checkCandidates, readiness,
    calibration, folderLead, drillQueue, POINTS_MAX, CHECK_MAX,
} from "@/lib/revision";
import { BANK_TOPIC } from "@/lib/mistakeBank";
import { ANSWER_TOPIC, cardFromAnswer, LEARNED_AT } from "@/lib/answerBank";

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

const NOW = new Date(2026, 9, 20, 15, 0, 0); // 20 Oct 2026, 3pm local
const day = (offset) => {
    const d = new Date(2026, 9, 20 + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const assessments = [
    { id: "s2", subject_name: "Mathematical Methods", title: "SAC 2 — Calculus", due_date: day(16) },
    { id: "s1", subject_name: "Chemistry", title: "Redox SAC", description: "Covers galvanic cells and electrolysis", due_date: day(9),
        extra: { revision: { topics: ["Galvanic cells", "galvanic  CELLS", "Electrolysis"], points: [
            { id: "p1", text: "Write half-equations for oxidation and reduction", said: "got", said_at: "2026-10-10T00:00:00Z" },
            { text: "Predict the products of electrolysis" },
        ] } } },
    { id: "s0", subject_name: "Chemistry", title: "Organic SAC", due_date: day(-3) },
    { id: "sx", subject_name: "", title: "No subject" },
    { id: "sd", subject_name: "Chemistry", title: "Done one", due_date: day(4), is_completed: true },
];
const userSubjects = [
    { id: "u1", subject_name: "Chemistry", is_active: true, extra: { revision: { points: [{ text: "Equilibrium" }] } } },
    { id: "u2", subject_name: "Mathematical Methods", is_active: true },
    { id: "u3", subject_name: "chemistry", is_active: true },
    { id: "u4", subject_name: "Legal Studies", is_active: false },
];
const F = foldersFor({ assessments, userSubjects, now: NOW });

check("days are counted on the LOCAL calendar, so 3pm does not floor tomorrow to today", () => {
    assert.equal(daysUntil(day(1), NOW), 1);
    assert.equal(daysUntil(day(0), NOW), 0);
    assert.equal(daysUntil(day(-2), NOW), -2);
    assert.equal(daysUntil("not a date", NOW), null);
    assert.equal(daysUntil(null, NOW), null);
});

check("upcoming SACs soonest first, one exam per subject, past and finished SACs apart", () => {
    assert.deepEqual(F.sacs.map((f) => f.id), ["s1", "s2"]);
    assert.deepEqual(F.exams.map((f) => f.subject), ["Chemistry", "Mathematical Methods"],
        "one exam folder per subject taken — a second casing is the same subject, an inactive one is not taken");
    assert.deepEqual(F.past.map((f) => f.id), ["sd", "s0"],
        "a finished SAC is not what to revise for, and past SACs read most recent first");
    assert.ok(!F.all.some((f) => f.id === "sx"), "a SAC with no subject has nothing to gather");
    assert.equal(findFolder(F, sacKey("s1")).title, "Redox SAC");
    assert.equal(findFolder(F, examKey("chemistry")).kind, "exam");
    assert.equal(findFolder(F, "sac:nope"), null);
});

check("a folder's stored topics and points are cleaned on read", () => {
    const f = findFolder(F, sacKey("s1"));
    assert.deepEqual(f.topics, ["Galvanic cells", "Electrolysis"], "two spellings of one topic are one topic");
    assert.equal(f.points.length, 2);
    assert.equal(f.points[1].id, pointId("Predict the products of electrolysis"), "a point with no id gets a stable one");
    assert.equal(f.points[1].said, null);
    assert.equal(findFolder(F, examKey("Chemistry")).topics.length, 0, "an exam folder is the whole course");
    assert.equal(findFolder(F, examKey("Chemistry")).points[0].text, "Equilibrium");
});

const quizzes = [
    { id: "qz1", title: "Galvanic cells", subject: "Chemistry", questions: [{ question: "a" }, { question: "b" }] },
    { id: "qz2", title: "Organic reactions", subject: "Chemistry", questions: [{ question: "c" }] },
    { id: "qz3", title: "Differentiation", subject: "Mathematical Methods", questions: [{ question: "d" }] },
];
const quizById = new Map(quizzes.map((q) => [q.id, q]));
const mistake = (id, extra = {}, over = {}) => ({
    id, topic: BANK_TOPIC, unit: BANK_TOPIC, subject_name: "Chemistry", is_active: true, question: "q", answer: "a",
    extra: { mistake: { criterion: `c ${id}`, ...extra } }, ...over,
});
const answer = (id, topic, over = {}) => ({
    id, ...cardFromAnswer({ question: `Q ${id}`, answer: "A model answer with several words in it here.", subject: "Chemistry", topic }), ...over,
});

check("each source's topic is read from the field it actually keeps it in", () => {
    assert.equal(topicOf({ topic: "Redox", question: "q" }), "Redox", "a deck card is its deck");
    assert.equal(topicOf(quizzes[0]), "Galvanic cells", "a quiz is its title");
    assert.equal(topicOf(mistake("m1", { topic: "Electrolysis" })), "Electrolysis");
    assert.equal(topicOf(mistake("m2", { source: { quiz_id: "qz1", q_index: 0 } }), { quizById }), "Galvanic cells",
        "a mistake with no topic of its own belongs to the quiz it came from");
    assert.equal(topicOf(mistake("m3", { question_title: "Explain why the anode…" })), "",
        "a clipped question is a label, never a topic — matching on it files mistakes by accident");
    assert.equal(topicOf(answer("a1", "Electrolysis")), "Electrolysis");
});

check("an item is in a folder by subject AND one of its topics, exactly", () => {
    const f = findFolder(F, sacKey("s1"));
    assert.ok(inFolder(f, "chemistry", "galvanic cells"));
    assert.ok(!inFolder(f, "Chemistry", "Organic reactions"));
    assert.ok(!inFolder(f, "Physics", "Galvanic cells"), "the subject has to match too");
    assert.ok(!inFolder(f, "Chemistry", "Galvanic cells and more"), "containment is a guess; the scope is exact");
    const whole = findFolder(F, sacKey("s2"));
    assert.ok(inFolder(whole, "Mathematical Methods", "anything at all"), "no topics chosen yet means the whole subject");
    assert.ok(!inFolder(whole, "Chemistry", "anything"));
});

check("topic options are the student's own, most-used first, markers excluded", () => {
    const opts = topicOptions("Chemistry", {
        flashcards: [{ subject_name: "Chemistry", topic: "Electrolysis" }, { subject_name: "Chemistry", topic: "electrolysis" },
            { subject_name: "Chemistry", topic: "General" }, { subject_name: "Physics", topic: "Waves" }],
        quizzes,
        bankCards: [mistake("m1", { topic: "Electrolysis" })],
        answerCards: [answer("a1", "Galvanic cells")],
    });
    assert.equal(opts[0].topic, "Electrolysis");
    assert.equal(opts[0].count, 3);
    assert.ok(opts[0].kinds.includes("mistakes"));
    assert.ok(!opts.some((o) => /mistake bank|answer bank|general/i.test(o.topic)), "markers are not topics");
    assert.ok(!opts.some((o) => o.topic === "Waves"), "another subject's topic is not offered");
});

check("topics named in the SAC's own title are SUGGESTED, never applied", () => {
    const f = findFolder(F, sacKey("s1"));
    const sug = suggestedTopics(f, [{ topic: "Galvanic cells" }, { topic: "Electrolysis" }, { topic: "Organic reactions" }, { topic: "SAC" }]);
    assert.deepEqual(sug.sort(), ["Electrolysis", "Galvanic cells"], "from the description too; a three-letter word is not evidence");
    const untouched = findFolder(foldersFor({ assessments: [{ id: "z", subject_name: "Chemistry", title: "Electrolysis SAC" }], now: NOW }), sacKey("z"));
    assert.deepEqual(untouched.topics, [], "nothing is ticked until the student ticks it");
});

const learnedAnswer = answer("a2", "Galvanic cells", { repetitions: LEARNED_AT, interval_days: 10, total_reviews: 6 });
const data = {
    flashcards: [
        { id: "c1", subject_name: "Chemistry", topic: "Electrolysis", question: "q", answer: "a", is_weak_spot: true },
        { id: "c2", subject_name: "Chemistry", topic: "Electrolysis", question: "q", answer: "a", repetitions: 3, interval_days: 10,
            last_reviewed_date: "2026-08-01", total_reviews: 3 },
        { id: "c3", subject_name: "Chemistry", topic: "Electrolysis", question: "q", answer: "a", repetitions: 3, interval_days: 30,
            last_reviewed_date: day(-1), total_reviews: 3 },
        { id: "c4", subject_name: "Chemistry", topic: "Organic", question: "q", answer: "a", is_weak_spot: true },
    ],
    bankCards: [
        mistake("m1", { topic: "Electrolysis" }),
        mistake("m2", { source: { quiz_id: "qz1", q_index: 0 } }),
        mistake("m3", { topic: "Organic" }),
        mistake("m4", { topic: "Electrolysis" }, { retired_at: "2026-10-01" }),
    ],
    answerCards: [answer("a1", "Electrolysis"), learnedAnswer, answer("a3", "Organic")],
    quizzes,
    redo: [{ quizId: "qz1", qIndex: 1 }, { quizId: "qz2", qIndex: 0 }],
    legacySaved: [{ id: "s", tool_type: "saved_answer", subject_name: "Chemistry", topic: "Electrolysis" },
        { id: "t", tool_type: "saved_answer", subject_name: "Chemistry", topic: "Organic" }],
    isReady: (c) => c.id !== "m2",
    now: NOW.getTime(),
};

check("a folder gathers its mistakes, answers, cards, re-sits and old saved answers — nothing else", () => {
    const c = folderContents(findFolder(F, sacKey("s1")), data);
    assert.deepEqual(c.mistakes.map((x) => x.id).sort(), ["m1", "m2"], "a cleared mistake is history, not work");
    assert.deepEqual(c.answers.map((x) => x.id).sort(), ["a1", "a2"]);
    assert.deepEqual(c.cards.map((x) => x.id).sort(), ["c1", "c2", "c3"]);
    assert.deepEqual(c.quizzes.map((x) => x.id), ["qz1"]);
    assert.deepEqual(c.redo.map((r) => r.quizId), ["qz1"], "a re-sit belongs to its quiz's folder");
    assert.deepEqual(c.legacy.map((r) => r.id), ["s"]);
    assert.deepEqual(c.ready.mistakes.map((x) => x.id), ["m1"], "ready is ready, not total");
    assert.deepEqual(drillQueue(c).map((x) => x.id), ["m1", "a1", "a2"], "mistakes before answers");
});

check("a weak card is flagged, or learned and under the recall floor — never a fresh one", () => {
    const now = NOW.getTime();
    assert.ok(isWeakCard(data.flashcards[0], now), "flagged");
    assert.ok(isWeakCard(data.flashcards[1], now), "learned months ago on a ten-day interval has faded");
    assert.ok(!isWeakCard(data.flashcards[2], now), "reviewed yesterday on a month's interval holds");
    assert.ok(!isWeakCard({ id: "n", repetitions: 0, total_reviews: 0 }, now), "never learned is not decaying");
    assert.ok(!isWeakCard({ ...data.flashcards[0], retired_at: "x" }, now), "put away is not weak");
});

check("a pasted outline becomes dot points: bullets stripped, wraps glued, headings dropped", () => {
    const pts = splitOutline(`Key knowledge:
• the difference between oxidation and reduction,
  including oxidation numbers
- writing balanced half-equations
1. predicting the products of electrolysis
(a) the role of the salt bridge
* writing balanced half-equations

ii) Faraday's laws`);
    assert.deepEqual(pts, [
        "the difference between oxidation and reduction, including oxidation numbers",
        "writing balanced half-equations",
        "predicting the products of electrolysis",
        "the role of the salt bridge",
        "Faraday's laws",
    ]);
    assert.equal(splitOutline("").length, 0);
    assert.equal(splitOutline(Array.from({ length: 90 }, (_, i) => `point number ${i}`).join("\n")).length, POINTS_MAX);
});

check("adding points keeps what is there and never doubles one", () => {
    const start = findFolder(F, sacKey("s1")).points;
    const { points, added } = mergePoints(start, ["Predict the products of electrolysis", "New one"], "outline");
    assert.equal(added, 1);
    assert.equal(points.length, 3);
    assert.equal(points[2].from, "outline");
    const rated = ratePoint(points, points[2].id, "shaky", NOW);
    assert.equal(rated[2].said, "shaky");
    assert.equal(ratePoint(rated, points[2].id, "shaky", NOW)[2].said, null, "tapping the same rating again clears it");
    assert.equal(removePoint(rated, points[2].id).length, 2);
    assert.equal(editPoint(rated, points[2].id, "  ")[2].text, "New one", "an empty edit changes nothing");
    assert.equal(editPoint(rated, points[2].id, "Renamed")[2].text, "Renamed");
});

check("writing a folder back keeps everything else on the row", () => {
    const p = revisionPatch({ extra: { other: 1, revision: { topics: ["a"], points: [] } } }, { points: [{ id: "x" }] });
    assert.equal(p.extra.other, 1, "extra is shared with other features");
    assert.deepEqual(p.extra.revision.topics, ["a"], "a points write must not drop the scope");
    assert.deepEqual(p.extra.revision.points, [{ id: "x" }]);
    assert.deepEqual(revisionPatch({ extra: null }, { topics: ["t"] }).extra.revision.topics, ["t"]);
});

const folder = findFolder(F, sacKey("s1"));
const pts = folder.points;
const checkRow = { id: "chk", ...checkQuiz({ folder, points: pts, questions: [{ question: "Q1" }, { question: "Q2" }, { question: "Q3" }] }) };
const attempt = (results, created, quizId = "chk") => ({ quiz_id: quizId, created_date: created, extra: { question_results: results } });

check("a check is one question per point, and the quiz records which point each question is", () => {
    assert.equal(checkRow.questions.length, 2, "never more questions than points");
    assert.deepEqual(checkRow.extra.revision_check.points, [pts[0].id, pts[1].id]);
    assert.equal(checkRow.extra.revision_check.folder, folder.key);
    assert.equal(checkRow.subject, "Chemistry");
});

check("proof is the LATEST marked check, full marks only, and an unmarked answer is no evidence", () => {
    const proof = pointProof([checkRow, quizzes[0]], [
        attempt([{ q_index: 0, marks: 2, marks_max: 3 }, { q_index: 1, marks: 3, marks_max: 3 }], "2026-10-12T00:00:00Z"),
        attempt([{ q_index: 0, marks: 3, marks_max: 3 }, { q_index: 1, marks: null, marks_max: 3 }], "2026-10-15T00:00:00Z"),
        attempt([{ q_index: 0, marks: 3, marks_max: 3 }], "2026-10-15T00:00:00Z", "qz1"),
    ]);
    assert.equal(proof.get(pts[0].id).full, true, "the newer check wins");
    assert.equal(proof.get(pts[1].id).full, true,
        "the newer check left point 2 unmarked, so the older full mark stands — Number(null) is 0, which would read as a fail");
    const failed = pointProof([checkRow], [attempt([{ q_index: 0, marks: 2, marks_max: 3 }], "2026-10-16T00:00:00Z")]);
    assert.equal(failed.get(pts[0].id).full, false, "two of three is not proved");
    assert.equal(pointProof([quizzes[0]], [attempt([{ q_index: 0, marks: 3, marks_max: 3 }], "x", "qz1")]).size, 0,
        "an ordinary quiz proves nothing about a key-knowledge point");
});

check("the newer of the rating and the check decides the state", () => {
    const proof = new Map([[pts[0].id, { at: "2026-10-12T00:00:00Z", full: true }]]);
    assert.equal(pointState(pts[0], proof), "proved", "proved after the rating");
    assert.equal(pointState({ ...pts[0], said: "shaky", said_at: "2026-10-14T00:00:00Z" }, proof), "shaky",
        "rated shaky since — they are telling us they have lost it");
    const missed = new Map([[pts[0].id, { at: "2026-10-12T00:00:00Z", full: false }]]);
    assert.equal(pointState({ ...pts[0], said: null }, missed), "missed");
    assert.equal(pointState({ ...pts[0], said: "got", said_at: "2026-10-14T00:00:00Z" }, missed), "got");
    assert.equal(pointState({ id: "z", text: "t" }, new Map()), "unrated");
});

check("the checklist reads worst first, the teacher's order kept inside each group", () => {
    const ps = [
        { id: "a", text: "a", said: "got" }, { id: "b", text: "b" }, { id: "c", text: "c", said: "not_yet" },
        { id: "d", text: "d" }, { id: "e", text: "e" },
    ];
    const proof = new Map([["d", { at: "x", full: false }], ["e", { at: "x", full: true }]]);
    assert.deepEqual(orderPoints(ps, proof).map((r) => r.point.id), ["d", "c", "b", "a", "e"]);
    assert.deepEqual(checkCandidates(ps, proof, 3).map((p) => p.id), ["d", "c", "b"], "a check asks about what is not proved");
    assert.equal(checkCandidates(Array.from({ length: 20 }, (_, i) => ({ id: `x${i}`, text: `t${i}` })), new Map()).length, CHECK_MAX);
});

check("readiness counts proved and said apart, and never counts a deck card", () => {
    const c = folderContents(folder, data);
    const proof = new Map([[pts[1].id, { at: "2026-10-30T00:00:00Z", full: true }]]);
    const r = readiness({ points: pts, proof, mistakes: c.mistakes, answers: c.answers });
    assert.equal(r.total, 2 + 2 + 2, "points, mistakes and answers — the deck is a deck");
    assert.equal(r.points.said, 1, "rated got it, never checked");
    assert.equal(r.points.proved, 1);
    assert.equal(r.answers.proved, 1, "a learned answer is proved");
    assert.equal(r.mistakes.open, 2);
    assert.equal(r.ready, r.proved + r.said);
    assert.equal(r.proved + r.said + r.open, r.total);
    const empty = readiness({});
    assert.equal(empty.total, 0);
    assert.equal(empty.pct, 0, "an empty folder is not 100% ready");
});

check("calibration only speaks about points that were checked", () => {
    const ps = [{ id: "a", said: "got" }, { id: "b", said: "got" }, { id: "c", said: "got" }, { id: "d", said: "shaky" }];
    const cal = calibration(ps, new Map([["a", { full: true }], ["b", { full: false }], ["d", { full: false }]]));
    assert.deepEqual(cal, { said: 3, held: 1, slipped: 1, checked: 2 });
});

check("the lead says only what is true, and never the date the countdown already says", () => {
    const sac = { kind: "sac", daysAway: 9 };
    assert.ok(/1 of 2 ready/.test(folderLead(sac, readiness({ points: [{ id: "a", said: "got" }, { id: "b" }] }))));
    assert.ok(!/9|days|tomorrow|today/i.test(folderLead(sac, readiness({ points: [{ id: "a", said: "got" }, { id: "b" }] }))),
        "the hero's countdown says the date; the lead printing it again is the same fact twice");
    assert.ok(/Add what this SAC covers/.test(folderLead(sac, readiness({}))), "an empty SAC folder asks for the one thing that fills it");
    assert.ok(/Everything in here is ready/.test(folderLead(sac, readiness({ points: [{ id: "a", said: "got" }] }))));
    assert.ok(/Nothing saved/.test(folderLead({ kind: "exam", daysAway: null }, readiness({}))));
});

check("no figure on the Revision page is typed in", () => {
    const page = strip(read("src/pages/Revision.jsx"));
    assert.ok(!/\b\d+ of \d+ ready\b/.test(page), "the readiness sentence is folderLead's, never a literal");
});

check("every count the mock prints is over the folder's scope", () => {
    // The source tiles counted the whole subject while the header above them
    // counted the folder, so one sheet printed "0 Flashcards" over a tile
    // reading 6 — two answers to one question, an inch apart.
    const exam = strip(read("src/components/study/ExamMode.jsx"));
    const calls = [...exam.matchAll(/allQuestions\.\s*filter\(\s*\(q\)\s*=>\s*([^&]{0,40})/g)].map((m) => m[1].trim());
    assert.ok(calls.length >= 5, "the scan reached the pool, the topics, the header and the source tiles");
    for (const c of calls) assert.ok(c.startsWith("inScope(q)"), `a count over the question pool skips the folder's scope: ${c}`);
});

check("nothing Revision prints uses a banned word", () => {
    // The drill's repair rung was labelled "Fix it" for months, on a screen
    // this page now sends students to. Comments are stripped first: a note
    // explaining why a word was replaced is not the word on screen.
    const files = [
        "src/pages/Revision.jsx", "src/components/mistakes/DrillRun.jsx", "src/lib/drill.js",
        "src/lib/answerBank.js", "src/lib/revision.js",
        ...fs.readdirSync("src/components/revision").map((f) => `src/components/revision/${f}`),
    ];
    const BANNED = /\b(Don[’']t|Fix it|No excuses|Embarrassing|Move)\b/;
    for (const f of files) {
        const hit = strip(read(f)).match(BANNED);
        assert.ok(!hit, `${f} prints "${hit?.[0]}"`);
    }
});

console.log(`\n${passed} checks passed`);
