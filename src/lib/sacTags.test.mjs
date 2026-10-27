/**
 * sacTags assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/sacTags.test.mjs
 *
 * ═══ TAG ANYTHING TO THE SAC IT IS FOR ══════════════════════════════════════
 * A tag is a claim the SAC makes on its own row; study time is stamped when it
 * is saved. What can go wrong is silent: a tag that quietly REMOVES something
 * a folder held, a write that spreads a stale `extra` and undoes the points, a
 * session counted twice or not at all, a total that is not the sum of its
 * bars, a "0 sits" at somebody a month out, and a readiness line drawn from
 * nothing. Every check below was verified by putting the bug back.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import {
    foldersFor, findFolder, sacKey, examKey, folderContents, folderMember, cleanClaims, claims,
    deckKeyOf, CLAIM_KINDS, CLAIM_MAX, readiness,
} from "@/lib/revision";
import {
    claimPatch, claimingFolders, tagTargets, tagLabel, chipLabel, stampOf, withStamp, parseFor,
    runupRange, folderStats, historyOf, historyPatch, readinessSeries, scopeFolders, RUNUP_WEEKS, HISTORY_MAX,
} from "@/lib/sacTags";
import { strategyIdFor } from "@/lib/strategise";
import { sliceByFolder, isFolderScope } from "@/lib/progressReport";
import { studyEvents } from "@/lib/studyLog";
import { BANK_TOPIC } from "@/lib/mistakeBank";
import { SESSION_MAX_MINUTES } from "@/lib/integrity";
import { shortSubject } from "@/lib/subjectShort";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const NOW = new Date(2026, 9, 21, 15, 0, 0); // Wed 21 Oct 2026, 3pm local
const day = (offset) => {
    const d = new Date(2026, 9, 21 + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// One Chemistry SAC on "Redox", tagged with a deck, a quiz, a map and a chat
// that are NOT in its topic — the whole point of a tag.
const SAC = {
    id: "s1", subject_name: "Chemistry", title: "Unit 3 SAC 1", due_date: day(6),
    extra: {
        keep: "other feature's data",
        revision: {
            topics: ["Redox"],
            points: [{ id: "p1", text: "Oxidation numbers", from: "typed" }],
            claims: {
                decks: [deckKeyOf("Chemistry", "Electrolysis")],
                quizzes: ["qTag"],
                maps: ["mTag"],
                chats: ["cTag"],
                mistakes: ["bTag"],
            },
        },
    },
};
const OTHER = { id: "s2", subject_name: "Mathematical Methods", title: "Test 2", due_date: day(3) };
const PAST = { id: "s0", subject_name: "Chemistry", title: "Prac report", due_date: day(-10), extra: { revision: { claims: { quizzes: ["qOld"] } } } };
const F = foldersFor({ assessments: [SAC, OTHER, PAST], userSubjects: [{ id: "u1", subject_name: "Chemistry" }], now: NOW });
const folder = findFolder(F, sacKey("s1"));

const bank = (id, topic, quizId) => ({
    id, topic: BANK_TOPIC, subject_name: "Chemistry", unit: "Mistakes", is_active: true,
    extra: { mistake: { topic, criterion: "c", source: { quiz_id: quizId } } },
});
const data = {
    flashcards: [
        { id: "f1", subject_name: "Chemistry", topic: "Redox", question: "q", answer: "a" },
        { id: "f2", subject_name: "chemistry ", topic: "Electrolysis", question: "q", answer: "a", last_reviewed_date: day(-2) },
        { id: "f3", subject_name: "Chemistry", topic: "Organic", question: "q", answer: "a" },
    ],
    bankCards: [
        bank("b1", "Redox", null),          // in by topic
        bank("b2", "Organic", "qTag"),      // in because its quiz is tagged
        bank("bTag", "Organic", null),      // in because it is tagged itself
        bank("b3", "Organic", "qOther"),    // out
    ],
    answerCards: [],
    quizzes: [
        { id: "qRedox", title: "Redox", subject: "Chemistry", questions: [] },
        { id: "qTag", title: "Equilibrium mixed", subject: "Chemistry", questions: [] },
        { id: "qOther", title: "Organic", subject: "Chemistry", questions: [] },
    ],
    attempts: [
        { id: "a1", quiz_id: "qTag", score: 80, date: day(-3) },
        { id: "a2", quiz_id: "qOther", score: 50, date: day(-3) },
        { id: "a3", quiz_id: "qRedox", score: 60, date: day(-1) },
    ],
    maps: [
        { id: "mTag", subject_name: "Chemistry", topic: "Organic" },
        { id: "mRedox", subject_name: "Chemistry", topic: "Redox" },
        { id: "mOther", subject_name: "Chemistry", topic: "Organic" },
    ],
    chats: [
        { id: "cTag", subject_name: "English", topic: "" },
        { id: "cOther", subject_name: "Chemistry", topic: "Organic" },
    ],
    sessions: [],
    techniques: [],
};

check("a tag ADDS to what the topics hold and removes nothing", () => {
    const c = folderContents(folder, data);
    assert.deepEqual(c.cards.map((x) => x.id).sort(), ["f1", "f2"]);
    assert.deepEqual(c.quizzes.map((x) => x.id).sort(), ["qRedox", "qTag"]);
    assert.deepEqual(c.maps.map((x) => x.id).sort(), ["mRedox", "mTag"]);
    assert.deepEqual(c.chats.map((x) => x.id), ["cTag"]);
    // Untagged, the same folder still holds its topic matches.
    const bare = { ...folder, claims: cleanClaims(null) };
    const b = folderContents(bare, data);
    assert.deepEqual(b.cards.map((x) => x.id), ["f1"]);
    assert.deepEqual(b.quizzes.map((x) => x.id), ["qRedox"]);
});

check("a mistake follows its quiz into the folder, and a tagged mistake comes on its own", () => {
    const c = folderContents(folder, data);
    assert.deepEqual(c.mistakes.map((x) => x.id).sort(), ["b1", "b2", "bTag"]);
});

check("attempts follow the quizzes in the folder, tagged or matched", () => {
    const c = folderContents(folder, data);
    assert.deepEqual(c.attempts.map((x) => x.id).sort(), ["a1", "a3"]);
});

check("a deck's identity ignores case, spacing and punctuation", () => {
    assert.equal(deckKeyOf("Chemistry ", "Redox & Galvanic"), deckKeyOf("chemistry", "redox galvanic"));
    assert.notEqual(deckKeyOf("Chemistry", "Redox"), deckKeyOf("Physics", "Redox"));
    assert.equal(deckKeyOf("", ""), deckKeyOf("Other", "General"));
});

check("study time: a stamp, a tagged quiz, an old quiz's notes, a tagged deck, or the topics", () => {
    const m = folderMember(folder, { quizzes: data.quizzes });
    const yes = [
        { extra: { revision_for: [sacKey("s1")] }, subject: "Physics" },              // stamped
        { extra: { quiz_id: "qTag" }, subject: "Chemistry" },                          // tagged quiz
        { notes: "Quiz: Equilibrium Mixed", subject: "Chemistry" },                   // legacy notes
        { subject: "Chemistry", topic: "Electrolysis" },                               // tagged deck
        { subject: "Chemistry", topic: "Redox" },                                      // topic
    ];
    const no = [
        { extra: { revision_for: [sacKey("s2")] }, subject: "Physics" },
        { extra: { quiz_id: "qOther" }, subject: "Chemistry" },
        { notes: "Quiz: Organic", subject: "Chemistry" },
        { subject: "Chemistry", topic: "Organic" },
        { subject: "Chemistry", topic: null },
    ];
    yes.forEach((r, i) => assert.ok(m.time(r), `yes[${i}] should count`));
    no.forEach((r, i) => assert.ok(!m.time(r), `no[${i}] should not count`));
    // A whole-course folder takes any session in its subject, quizzes included.
    const exam = findFolder(F, examKey("Chemistry"));
    const e = folderMember(exam, { quizzes: data.quizzes });
    assert.ok(e.time({ notes: "Quiz: Something deleted", subject: "Chemistry" }));
});

check("claims are cleaned: strings only, no duplicates, every kind present, capped", () => {
    const c = cleanClaims({ decks: ["a", "a", null, "", 3, { x: 1 }], quizzes: "nope", maps: Array.from({ length: CLAIM_MAX + 5 }, (_, i) => `m${i}`) });
    assert.deepEqual(Object.keys(c).sort(), [...CLAIM_KINDS].sort());
    assert.deepEqual(c.decks, ["a", "3"], "an object is not an id");
    assert.deepEqual(c.quizzes, []);
    assert.equal(c.maps.length, CLAIM_MAX);
    assert.ok(!claims({ claims: c }, "decks", ""), "an empty id is never claimed");
    assert.ok(!claims({ claims: c }, "decks", null));
});

check("a claim write keeps every other part of the row", () => {
    const on = claimPatch(SAC, "quizzes", "qNew", true);
    assert.equal(on.extra.keep, "other feature's data");
    assert.deepEqual(on.extra.revision.topics, ["Redox"]);
    assert.equal(on.extra.revision.points.length, 1);
    assert.deepEqual(on.extra.revision.claims.quizzes, ["qTag", "qNew"]);
    assert.deepEqual(on.extra.revision.claims.decks, SAC.extra.revision.claims.decks);
    const twice = claimPatch({ ...SAC, extra: on.extra }, "quizzes", "qNew", true);
    assert.deepEqual(twice.extra.revision.claims.quizzes, ["qTag", "qNew"], "tagging twice is one tag");
    const off = claimPatch({ ...SAC, extra: on.extra }, "quizzes", "qTag", false);
    assert.deepEqual(off.extra.revision.claims.quizzes, ["qNew"]);
    assert.throws(() => claimPatch(SAC, "planets", "x", true));
    assert.throws(() => claimPatch(SAC, "quizzes", "", true));
});

check("an exam folder claims nothing and is never offered as a tag", () => {
    const exam = findFolder(F, examKey("Chemistry"));
    assert.deepEqual(Object.values(exam.claims).flat(), []);
    const t = tagTargets(F, { subject: "Chemistry", kind: "quizzes", id: "qX" });
    assert.ok(t.every((f) => f.kind === "sac"));
});

check("the picker offers this subject's SACs first, and a finished SAC only to untag it", () => {
    const fresh = tagTargets(F, { subject: "Chemistry", kind: "quizzes", id: "qX" });
    assert.deepEqual(fresh.map((f) => f.id), ["s1", "s2"]);
    const held = tagTargets(F, { subject: "Chemistry", kind: "quizzes", id: "qOld" });
    assert.deepEqual(held.map((f) => f.id), ["s1", "s2", "s0"]);
    assert.deepEqual(claimingFolders(F.all, "quizzes", "qTag").map((f) => f.id), ["s1"]);
});

check("a chip names the SAC once and counts more than one", () => {
    assert.equal(tagLabel(folder), `${shortSubject("Chemistry")} · Unit 3 SAC 1`);
    assert.equal(tagLabel({ subject: "Chemistry", title: "Chemistry SAC 2" }), "Chemistry SAC 2");
    assert.equal(chipLabel([]), null);
    assert.equal(chipLabel([folder, findFolder(F, sacKey("s2"))]), "2 SACs");
});

check("a stamp merges into the payload's own extra, and only a SAC key stamps", () => {
    const p = withStamp({ technique_name: "pomodoro", extra: { idle_ratio: 0.1 } }, sacKey("s1"));
    assert.deepEqual(p.extra, { idle_ratio: 0.1, revision_for: ["sac:s1"] });
    const same = { technique_name: "pomodoro" };
    assert.equal(withStamp(same, null), same);
    assert.equal(withStamp(same, "exam:chemistry"), same);
    assert.equal(withStamp(same, "sac:"), same);
    assert.deepEqual(stampOf({ extra: { revision_for: ["sac:a", "exam:x", 4] } }), ["sac:a"]);
    assert.deepEqual(stampOf({ extra: { revision_for: "sac:a" } }), []);
});

check("?for= is read only when it is a SAC key", () => {
    assert.equal(parseFor("?for=sac:abc-123"), "sac:abc-123");
    assert.equal(parseFor("?tab=x&for=sac:a_b"), "sac:a_b");
    assert.equal(parseFor("?for=exam:chemistry"), null);
    assert.equal(parseFor("?for=sac:<script>"), null);
    assert.equal(parseFor(""), null);
});

check("the run-up is whole Monday weeks, ending today or on the day of a finished SAC", () => {
    const r = runupRange(folder, NOW);
    assert.equal(r.to, day(0));
    assert.equal(r.from, day(-2 - 21), "Monday three weeks before this Monday");
    const past = findFolder(F, sacKey("s0"));
    const p = runupRange(past, NOW);
    assert.equal(p.to, day(-10));
});

check("the run-up: capped minutes, bars that sum to the total, no retries, nothing printed as zero", () => {
    const time = [
        { date: day(0), session_duration: 30, subject: "Chemistry", topic: "Redox" },
        { date: day(-8), session_duration: 600, subject: "Chemistry", topic: "Redox" },  // capped at one sitting
        { date: day(-40), session_duration: 50, subject: "Chemistry", topic: "Redox" },  // outside the window
    ];
    const contents = {
        time,
        attempts: [
            { quiz_id: "qRedox", score: 60, date: day(-1) },
            { quiz_id: "qRedox", score: 0, date: day(-1), extra: { is_retry: true } },
            { quiz_id: "qRedox", score: 90, date: day(-60) },
        ],
        cards: [{ last_reviewed_date: day(-2) }, { last_reviewed_date: day(-90) }],
        mistakes: [{ last_reviewed_date: day(-5) }],
        answers: [],
    };
    const s = folderStats(contents, folder, NOW);
    assert.equal(s.minutes, 30 + SESSION_MAX_MINUTES);
    assert.equal(s.weeks.length, RUNUP_WEEKS);
    assert.equal(s.weeks.reduce((a, w) => a + w.minutes, 0), s.minutes);
    assert.equal(s.weeks[RUNUP_WEEKS - 1].minutes, 30, "the last bar is this week");
    assert.ok(s.weeks[RUNUP_WEEKS - 1].current);
    assert.equal(s.sits, 1, "a wrong-only retry is never a sit");
    assert.equal(s.average, 60);
    assert.equal(s.reviewed, 2);
    assert.equal(s.sessions, 2);
    assert.ok(s.any);

    const empty = folderStats({ time: [], attempts: [], cards: [] }, folder, NOW);
    assert.equal(empty.minutes, null);
    assert.equal(empty.sits, null);
    assert.equal(empty.average, null, "no sits is no average, never 0%");
    assert.equal(empty.reviewed, null);
    assert.equal(empty.any, false);
});

check("readiness is recorded once a day, only when it changes, and never for an empty folder", () => {
    const r = { total: 4, proved: 1, said: 1 };
    const first = historyPatch(SAC, r, NOW);
    assert.deepEqual(first.extra.revision.history, [{ d: day(0), p: 1, s: 1, t: 4 }]);
    assert.deepEqual(first.extra.revision.topics, ["Redox"], "the rest of the folder survives");
    assert.equal(first.extra.keep, "other feature's data");
    const row = { ...SAC, extra: first.extra };
    assert.equal(historyPatch(row, r, NOW), null, "same numbers, same day: no write");
    const moved = historyPatch(row, { total: 4, proved: 2, said: 1 }, NOW);
    assert.deepEqual(moved.extra.revision.history, [{ d: day(0), p: 2, s: 1, t: 4 }], "today is replaced, not appended");
    assert.equal(historyPatch(SAC, { total: 0, proved: 0, said: 0 }, NOW), null);
    const long = { extra: { revision: { history: Array.from({ length: HISTORY_MAX + 10 }, (_, i) => ({ d: `2025-01-${String((i % 28) + 1).padStart(2, "0")}`, p: 0, s: 0, t: 1 })) } } };
    assert.ok(historyPatch(long, r, NOW).extra.revision.history.length <= HISTORY_MAX);
    assert.deepEqual(historyOf({ extra: { revision: { history: [{ d: "junk", p: 1, s: 1, t: 1 }, { d: day(-1), p: 1, s: 0, t: null }, { d: day(-2), p: 1, s: 0, t: 2 }] } } }),
        [{ d: day(-2), p: 1, s: 0, t: 2 }]);
    assert.deepEqual(readinessSeries([{ d: day(0), p: 1, s: 1, t: 4 }]), [{ d: day(0), ready: 50, proved: 25 }]);
});

check("Progress narrowed to a SAC holds exactly what the folder holds", () => {
    const events = studyEvents(
        [{ id: "x1", date: day(-1), duration_minutes: 20, subject: "Chemistry", notes: "Quiz: Equilibrium mixed" }],
        [{ id: "t1", date: day(-1), session_duration: 25, subject: "Chemistry", topic: "Organic" },
         { id: "t2", date: day(-1), session_duration: 25, subject: "Physics", extra: { revision_for: ["sac:s1"] } }],
    );
    assert.ok(events.every((e) => "topic" in e && "extra" in e && "notes" in e), "events carry what membership reads");
    const bag = {
        cards: data.flashcards, bankCards: data.bankCards, quizzes: data.quizzes, attempts: data.attempts,
        events, techniques: [], sessions: [], assessments: [SAC, OTHER],
    };
    const s = sliceByFolder(bag, folder);
    const c = folderContents(folder, data);
    assert.deepEqual(s.cards.map((x) => x.id).sort(), c.cards.map((x) => x.id).sort());
    assert.deepEqual(s.bankCards.map((x) => x.id).sort(), c.mistakes.map((x) => x.id).sort());
    assert.deepEqual(s.attempts.map((x) => x.id).sort(), c.attempts.map((x) => x.id).sort());
    assert.deepEqual(s.events.map((x) => x.id).sort(), ["t2", "x1"]);
    assert.deepEqual(s.assessments.map((x) => x.id), ["s1"]);
    assert.ok(isFolderScope("sac:s1") && !isFolderScope("Chemistry") && !isFolderScope("__all__"));
});

check("a planned session is the SAC's when stamped or built for it — never by subject alone", () => {
    const LONG = { ...SAC, id: "abcd1234-0000-4000-8000-000000000000" };
    const F2 = foldersFor({ assessments: [LONG], now: NOW });
    const f = F2.sacs[0];
    const strat = strategyIdFor(LONG.id, "zz9");
    const plans = [
        { id: "p1", subject_name: "Physics", date: day(1), extra: { revision_for: [f.key] } },               // stamped
        { id: "p2", subject_name: "Chemistry", date: day(2), notes: `Recall [str:${strat}]` },               // built by Strategise for it
        { id: "p3", subject_name: "Chemistry", date: day(3), notes: "Recall" },                               // same subject, nothing else
        { id: "p4", subject_name: "Chemistry", date: day(2), notes: `x [str:${strategyIdFor("zzzz9999-1", "q")}]` }, // another SAC's plan
    ];
    const c = folderContents(f, { ...data, plans });
    assert.deepEqual(c.plans.map((p) => p.id).sort(), ["p1", "p2"]);
    const s = folderStats({ ...c, plans: [...c.plans, { id: "late", date: day(30), extra: { revision_for: [f.key] } }].map((p, i) => ({ ...p, is_completed: i === 0 })) }, f, NOW);
    assert.deepEqual(s.planned, { total: 2, done: 1 }, "a session after the SAC was for something else");
    assert.ok(s.any, "planned sessions alone are something to show");
    assert.equal(folderStats({ plans: [] }, f, NOW).planned, null);
});

check("the Progress filter offers what is coming and what just finished", () => {
    const old = { id: "s9", subject_name: "Chemistry", title: "Ages ago", due_date: day(-40) };
    const F3 = foldersFor({ assessments: [SAC, OTHER, PAST, old], now: NOW });
    assert.deepEqual(scopeFolders(F3).map((f) => f.id), ["s2", "s1", "s0"]);
});

// ─── The wiring ─────────────────────────────────────────────────────────────
// Every one of these renders perfectly with the wire cut: a surface with no
// chip, a "make one for it" link that tags nothing, a session saved unstamped.

const read = (rel) => fs.readFileSync(rel, "utf8");
const code = (src) => src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");

check("every taggable thing carries the chip, with its own kind", () => {
    const want = [
        ["src/components/study/SpacedRepetition.jsx", "decks"],
        ["src/pages/Quizzes.jsx", "quizzes"],
        ["src/components/mistakes/BankBand.jsx", "mistakes"],
        ["src/components/revision/AnswerList.jsx", "answers"],
        ["src/components/study/MindMaps.jsx", "maps"],
        ["src/components/ai_tools/UnifiedChat.jsx", "chats"],
    ];
    for (const [f, kind] of want) {
        const src = code(read(f));
        assert.ok(new RegExp(`<ForChip[^>]*kind="${kind}"`).test(src), `${f} draws no ${kind} chip`);
    }
    // The chip's `tags` must be a real value on every surface, not a bare name
    // that happens to be undefined. Each of these takes it from the hook or a prop.
    for (const [f] of want) assert.ok(/tags=\{tags\}/.test(code(read(f))), `${f} hands the chip no tags`);
});

check("anything made from inside a folder is tagged for it", () => {
    const made = [
        // The CONDITION is pinned with the call: `if (false) setClaim(...)`
        // still contains the call, and a span match would wave it through.
        ["src/pages/Quizzes.jsx", /if \(forKey && created\?\.id\) setClaim\(forKey,\s*"quizzes",\s*created\.id,\s*true\)/],
        ["src/components/study/SpacedRepetition.jsx", /if \(saved > 0 && forKey\) setClaim\(forKey,\s*"decks",\s*deckKeyOf\(deckInfo\.subject_name, deckInfo\.topic\),\s*true\)/],
        ["src/components/study/MindMaps.jsx", /if \(forRef\.current && id\) setClaim\(forRef\.current,\s*"maps",\s*id,\s*true\)/],
        ["src/components/ai_tools/UnifiedChat.jsx", /if \(tagForRef\.current\) setClaim\(tagForRef\.current,\s*"chats",\s*id,\s*true\)/],
    ];
    for (const [f, re] of made) assert.ok(re.test(code(read(f))), `${f} makes something from ?for= and tags nothing`);
    // And says so first: a tag nobody saw applied is the guess this refuses.
    for (const [f] of made) assert.ok(/<ForNote\b/.test(code(read(f))), `${f} tags without saying so`);
    // A map is claimed where it is MADE — on both create paths, the subject's
    // root and a layer — and never merely on being opened.
    const maps = code(read("src/components/study/MindMaps.jsx"));
    assert.ok((maps.match(/MindMap\.create\([^)]*\)\);\s*claimMade\(created\?\.id\)/g) || []).length >= 2, "a map made from a folder is not claimed on both create paths");
    const between = (from, to) => { const i = maps.indexOf(from); return i < 0 ? "" : maps.slice(i, maps.indexOf(to, i + from.length)); };
    const opening = between("const openMapRow = useCallback(", "}, [");
    const linking = between("const linked = useRef(", "}, [loading");
    assert.ok(opening && linking, "could not find where a map is opened");
    assert.ok(!/claimMade|setClaim/.test(opening + linking), "opening a map must not claim it");
});

check("the links a folder hands out are read where they land", () => {
    const tab = code(read("src/components/revision/MaterialTab.jsx"));
    const study = code(read("src/pages/Study.jsx"));
    const ids = [...study.matchAll(/\{ id: "([a-z_]+)",\s+name:/g)].map((m) => m[1]);
    for (const m of tab.matchAll(/createPageUrl\("Study"\)\}\?tab=([a-z_]+)/g)) {
        assert.ok(ids.includes(m[1]), `MaterialTab links to Study?tab=${m[1]}, which is not a technique`);
    }
    for (const f of ["src/pages/Quizzes.jsx", "src/components/study/SpacedRepetition.jsx", "src/components/study/MindMaps.jsx", "src/pages/AITools.jsx", "src/pages/Study.jsx"]) {
        assert.ok(/parseFor\(/.test(code(read(f))), `${f} is sent ?for= and never reads it`);
    }
    // The deep links Material opens with.
    assert.ok(/get\("chat"\)/.test(code(read("src/pages/AITools.jsx"))), "AITools does not read ?chat=");
    assert.ok(/get\("map"\)/.test(code(read("src/components/study/MindMaps.jsx"))), "MindMaps does not read ?map=");
});

check("study time is stamped where it is saved", () => {
    const study = code(read("src/pages/Study.jsx"));
    assert.ok(/StudyTechnique\.create\(withStamp\(/.test(study), "Study saves a session unstamped");
    const sr = code(read("src/components/study/SpacedRepetition.jsx"));
    const writes = sr.match(/StudyTechnique\.create\(/g) || [];
    const stamped = sr.match(/StudyTechnique\.create\(withStamp\(/g) || [];
    assert.ok(writes.length >= 2 && writes.length === stamped.length, "a flashcard review is saved unstamped");
    assert.ok(/readFocus\(\)/.test(sr), "the flashcard review does not read what the sitting is for");
    const qp = code(read("src/components/quizzes/QuizPlayer.jsx"));
    assert.ok(/StudySession\.create\(\{[^\n]*quiz_id: String\(quiz\.id\)/.test(qp), "a quiz's session no longer records its quiz");
    // Planned sessions.
    // Both paths, separately: a scan for "withStamp(..., planFor)" anywhere is
    // satisfied by the edit path alone, and a new session would go unstamped.
    const goals = code(read("src/pages/Goals.jsx"));
    assert.ok(/Array\.from\(\{ length: weeks \}, \(_, i\) => withStamp\(\{[\s\S]{0,400}?\},\s*planFor\)\)\)/.test(goals), "a new planner session ignores its For field");
    assert.ok(/patch\.extra = planFor \? withStamp\(\{ extra: rest \}, planFor\)\.extra : rest/.test(goals), "editing a session's For field changes nothing");
    assert.ok(/withStamp\(\{[\s\S]{0,400}\},\s*sacKey\(sac\.id\)\)/.test(code(read("src/pages/Strategise.jsx"))), "Strategise plans a SAC's sessions unstamped");
});

check("a SAC's row is only ever written through the queue that re-reads it", () => {
    const rev = code(read("src/pages/Revision.jsx"));
    assert.ok(!/SubjectAssessment\.update\(/.test(rev), "Revision writes a SAC row around patchSac, so a points edit can undo a tag");
    const hook = code(read("src/hooks/useSacTags.js"));
    const body = hook.slice(hook.indexOf("export function patchSac"), hook.indexOf("export function setClaim"));
    assert.ok(/await latest\(sacId\)[\s\S]*build\(row\)/.test(body), "patchSac builds its patch off a row it did not just read");
    assert.ok(/queues\.get\(sacId\)/.test(body) && /queues\.set\(sacId/.test(body), "writes to one SAC are no longer queued");
    assert.ok(/setClaim[\s\S]*return patchSac\(/.test(hook), "setClaim goes around the queue");
});

check("Progress narrows to a SAC through the folder's own rules", () => {
    const review = code(read("src/pages/Review.jsx"));
    assert.ok(/isFolderScope\(scope\)\s*\?\s*sliceByFolder\(/.test(review), "Progress no longer slices by SAC");
    assert.ok(/folders=\{sacScopes\}/.test(review), "the filter is not offered the SACs");
});

console.log(`\n${passed} checks passed`);
