/**
 * subject information page assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/subjectInfo.test.mjs
 *
 * ═══ EVERY FACT OFF THE CATALOGUE ═══════════════════════════════════════════
 * The page printed "Popular choice" and "2 year program" beside every subject,
 * coloured scaling by reputation rather than direction, and read
 * "recommended" prerequisites as requirements. The rules are pure
 * (subjectInfo.js), they run against the REAL catalogue as well as fixtures,
 * and the wiring is scanned. Every check was verified by putting the bug back.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import {
    assessKind, yearBar, barLead, prereqsOf, alternativesFor, areaNameOf,
    overlap, compareRows, subjectForView, subjectLink,
} from "@/lib/subjectInfo";
import {
    rememberSubjectLink, takePendingSubject, normaliseSubjectView,
    PENDING_SUBJECT_KEY, PENDING_SUBJECT_TTL_MS,
} from "@/lib/pendingSubject";
import { coverageFor } from "@/lib/subjectHub";
import { VCE_SUBJECTS } from "@/data/vceSubjects";

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

const byName = (n) => VCE_SUBJECTS.find((s) => s.name === n);
const GENERAL = byName("General Mathematics");
const MUSIC = byName("Music Repertoire Performance");

/* ── The year bar ─────────────────────────────────────────────────────────── */

check("an assessment's kind is read off its own name, and a guess is OTHER", () => {
    assert.equal(assessKind("End-of-year exam"), "exam");
    assert.equal(assessKind("Exam 2 (CAS)"), "exam");
    assert.equal(assessKind("Oral exam"), "exam");
    assert.equal(assessKind("Unit 3 SAC"), "school");
    assert.equal(assessKind("Unit 3-4 SACs"), "school");
    assert.equal(assessKind("Unit 3-4 SAT (folio)"), "school");
    assert.equal(assessKind("Solo performance"), "other", "a performance was guessed into a side");
    assert.equal(assessKind(""), "other");
});

check("EVERY catalogue subject has a bar, and no component lands in OTHER unless its name is neither", () => {
    for (const s of VCE_SUBJECTS) {
        const bar = yearBar(s);
        assert.ok(bar, `${s.name} has no bar`);
        for (const p of bar.parts) {
            if (p.kind === "other") assert.ok(!/exam|SA[CT]|folio/i.test(p.component), `${s.name}: ${p.component} misread`);
        }
        assert.equal(bar.school + bar.exam + bar.other, bar.total, `${s.name} loses a mark between the halves`);
    }
});

check("General Maths: 40 at school, 60 in the exams, and the lead says the larger half", () => {
    const bar = yearBar(GENERAL);
    assert.deepEqual([bar.school, bar.exam, bar.other], [40, 60, 0]);
    assert.equal(bar.lead, "60% of the study score is decided in the exams.");
    assert.deepEqual(bar.parts.filter((p) => p.heaviest).map((p) => p.component), ["Exam 2"]);
});

check("THE BAR IS IN THE ORDER OF THE YEAR: school, then neither, then the exams", () => {
    // Music Repertoire lists its performance exam FIRST in the catalogue.
    const kinds = yearBar(MUSIC).parts.map((p) => p.kind);
    assert.equal(kinds[kinds.length - 1], "exam", "an exam is drawn before the SACs it follows");
    const rank = { school: 0, other: 1, exam: 2 };
    for (let i = 1; i < kinds.length; i++) assert.ok(rank[kinds[i - 1]] <= rank[kinds[i]], `out of order: ${kinds}`);
});

check("segments are contiguous, and a study design that overshoots still fits the bar", () => {
    const bar = yearBar(GENERAL);
    let at = 0;
    for (const p of bar.parts) { assert.ok(Math.abs(p.start - at) < 1e-9); at += p.width; }
    assert.ok(Math.abs(at - 100) < 1e-9);
    const over = yearBar({ assessment_structure: [
        { component: "Unit 3 SAC", percentage: 70 }, { component: "End-of-year exam", percentage: 50 },
    ] });
    assert.equal(over.total, 120, "the total was renormalised");
    assert.ok(over.parts.reduce((t, p) => t + p.width, 0) <= 100 + 1e-9, "the bar runs past its own edge");
});

check("every part tying for the most marks is the heaviest", () => {
    const bar = yearBar({ assessment_structure: [
        { component: "Unit 3 SAC", percentage: 25 }, { component: "Unit 4 SAC", percentage: 25 },
        { component: "End-of-year exam", percentage: 50 },
    ] });
    assert.deepEqual(bar.parts.filter((p) => p.heaviest).map((p) => p.component), ["End-of-year exam"]);
    const tie = yearBar({ assessment_structure: [
        { component: "Unit 3 SAC", percentage: 50 }, { component: "End-of-year exam", percentage: 50 },
    ] });
    assert.equal(tie.parts.filter((p) => p.heaviest).length, 2);
    assert.match(tie.lead, /^Split evenly/);
});

check("a subject with no exam says so; nothing at all is no bar", () => {
    assert.equal(barLead({ school: 100 }), "No exam — every mark is earned during the year.");
    assert.equal(yearBar({ assessment_structure: [] }), null);
    assert.equal(yearBar({}), null);
    assert.equal(yearBar({ assessment_structure: [{ component: "Unit 3 SAC", percentage: 0 }] }), null);
});

/* ── Prerequisites ────────────────────────────────────────────────────────── */

check("a recommendation is SUITS, a requirement is NEEDS, None is nothing, and the sentence is kept", () => {
    const ps = prereqsOf({ prerequisites: ["Year 10 maths recommended", "None", "Year 10 Chemistry; concurrent Methods recommended"] });
    assert.equal(ps.length, 2);
    assert.equal(ps[0].kind, "recommended");
    assert.equal(ps[1].kind, "required");
    assert.equal(ps[1].raw, "Year 10 Chemistry; concurrent Methods recommended", "the advice was dropped");
    assert.deepEqual(prereqsOf({}), []);
});

/* ── Alternatives ─────────────────────────────────────────────────────────── */

check("General Maths sits on the maths ladder, ordered by scaling, and is flagged as itself", () => {
    const alts = alternativesFor(GENERAL, VCE_SUBJECTS);
    assert.deepEqual(alts.map((a) => a.subject.name),
        ["General Mathematics", "Mathematical Methods", "Specialist Mathematics"]);
    assert.deepEqual(alts.map((a) => a.current), [true, false, false]);
    assert.deepEqual(alts.map((a) => a.scaling), [-2, 5, 13]);
    assert.equal(alts[0].exam, 60);
    assert.equal(areaNameOf(GENERAL), "Maths");
});

check("a custom subject has no area and no alternatives; a private row never joins a strip", () => {
    const mine = { id: "x1", name: "Robotics club", is_private: true };
    assert.deepEqual(alternativesFor(mine, VCE_SUBJECTS), []);
    assert.equal(areaNameOf(mine), null);
    const withPrivate = [...VCE_SUBJECTS, { id: "p", name: "Mathematical Methods", is_private: true }];
    assert.equal(alternativesFor(GENERAL, withPrivate).length, 3);
});

check("a subject whose scaling is unknown sorts LAST, never as a zero", () => {
    const cat = [
        { id: "a", name: "Mathematical Methods", scaling_info: { scaling_factor: "+5" } },
        { id: "b", name: "General Mathematics", scaling_info: { scaling_factor: "+N" } },
        { id: "c", name: "Specialist Mathematics", scaling_info: { scaling_factor: "-1" } },
    ];
    assert.deepEqual(alternativesFor(cat[0], cat).map((a) => a.subject.id), ["c", "a", "b"]);
});

/* ── Compare ──────────────────────────────────────────────────────────────── */

check("compare puts the facts side by side and NAMES NO WINNER", () => {
    const rows = compareRows(GENERAL, byName("Mathematical Methods"));
    assert.deepEqual(rows.map((r) => r.key), ["scaling", "mean", "exam", "heaviest", "prereq"]);
    assert.deepEqual(rows[0], { key: "scaling", label: "Scaling", a: "-2", b: "+5" });
    for (const r of rows) {
        assert.deepEqual(Object.keys(r).sort(), ["a", "b", "key", "label"], `row ${r.key} carries a verdict`);
    }
});

check("a fact one side lacks is a dash, never a zero", () => {
    const rows = compareRows({ name: "Mine" }, GENERAL);
    const by = Object.fromEntries(rows.map((r) => [r.key, r]));
    assert.equal(by.scaling.a, null);
    assert.equal(by.mean.a, null);
    assert.equal(by.exam.a, null);
    assert.equal(by.prereq.a, "None listed");
});

check("overlap is case-blind and keeps each side's own spelling", () => {
    const o = overlap(["Business", "Finance"], ["finance", "Law"]);
    assert.deepEqual(o, { both: ["Finance"], onlyA: ["Business"], onlyB: ["Law"] });
});

/* ── The address, and coverage ────────────────────────────────────────────── */

check("?view= is a stable catalogue id, and an unknown one opens nothing", () => {
    assert.equal(subjectForView("vce-general-maths", VCE_SUBJECTS), GENERAL);
    assert.equal(subjectForView("vce-nonsense", VCE_SUBJECTS), null);
    assert.equal(subjectForView("", VCE_SUBJECTS), null);
    assert.equal(subjectForView(null, VCE_SUBJECTS), null);
});

check("coverage is ONE composition: deck topics plus that subject's quiz titles only", () => {
    const cov = coverageFor({
        keySkills: ["Statistics", "Networks", "Matrices"],
        name: "General Mathematics",
        stats: { topics: ["Statistics revision"] },
        quizzes: [{ subject: "general mathematics", title: "Networks quiz" }, { subject: "Biology", title: "Matrices" }],
    });
    assert.deepEqual(cov.areas.map((a) => a.covered), [true, true, false], "another subject's quiz ticked an area");
    const hub = strip(read("src/pages/SubjectHub.jsx"));
    assert.ok(/coverageFor\(\{/.test(hub), "the hub rolls its own coverage composition again");
});

/* ── The link, kept across a sign-in ──────────────────────────────────────── */

const memStore = () => {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

check("the share link is the page's own address, and the route map serves it", () => {
    assert.equal(subjectLink("vce-maths-methods", "https://acedit.au"), "https://acedit.au/Subjects?view=vce-maths-methods");
    const config = read("src/pages.config.js").replace(/\/\*[\s\S]*?\*\//g, "");
    assert.ok(/"Subjects"\s*:/.test(config), "the link names a page the router does not serve");
    for (const s of VCE_SUBJECTS) assert.equal(normaliseSubjectView(s.id), s.id, `${s.id} could not survive a sign-in`);
});

check("a subject link opened signed out is kept, taken ONCE, and only for a catalogue id", () => {
    const st = memStore();
    assert.equal(rememberSubjectLink({ pathname: "/Subjects", search: "?view=vce-chemistry" }, st, 1000), "vce-chemistry");
    assert.ok(st.getItem(PENDING_SUBJECT_KEY));
    assert.equal(takePendingSubject(st, 2000), "vce-chemistry");
    assert.equal(takePendingSubject(st, 2000), null, "taken twice");
    assert.equal(rememberSubjectLink({ pathname: "/Subjects", search: "?view=abc123" }, st, 1), null, "a private subject's id was kept");
    assert.equal(rememberSubjectLink({ pathname: "/Quizzes", search: "?view=vce-chemistry" }, st, 1), null);
    rememberSubjectLink({ pathname: "/Subjects", search: "?view=vce-chemistry" }, st, 1000);
    assert.equal(takePendingSubject(st, 1000 + PENDING_SUBJECT_TTL_MS + 1), null, "a stale link was honoured");
    assert.equal(takePendingSubject({ getItem: () => { throw new Error("blocked"); } }), null);
});

/* ── Wiring ───────────────────────────────────────────────────────────────── */

const detail = strip(read("src/components/vce/SubjectDetail.jsx"));
const compare = strip(read("src/components/vce/SubjectCompare.jsx"));
const page = strip(read("src/pages/Subjects.jsx"));
const app = strip(read("src/App.jsx"));

check("THE PAGE SAYS NOTHING THAT IS TRUE OF EVERY SUBJECT", () => {
    for (const phrase of ["Popular choice", "2 year program", "Key Skills Covered"]) {
        assert.ok(!detail.includes(phrase), `"${phrase}" is back`);
    }
    for (const name of ["<ScalingMark", "<YearBar", "<ScoreCurve", "prereqsOf(", "alternativesFor("]) {
        assert.ok(detail.includes(name), `the page no longer draws ${name}`);
    }
});

check("a what-if is never saved, and coverage is only claimed for a subject they take", () => {
    assert.ok(/onCommit=\{taken \? onCommitTarget : undefined\}/.test(detail), "a looked-at subject writes a target");
    assert.ok(/setWhatIf\(null\)[^\n]*subject\?\.id/.test(detail), "the what-if carries over to the next subject");
    assert.ok(/const coverage = mine \?/.test(page), "coverage is ticked off for a subject nobody takes");
});

check("a private subject has no share button; the link opens the page from the address", () => {
    assert.ok(/!subject\.is_private && <ShareLink/.test(detail), "a private subject offers a link nobody else can open");
    assert.ok(/subjectForView\(view,/.test(page), "the open subject is not read off ?view=");
    assert.ok(!/useState\(null\);\s*\n[^\n]*selectedSubject/.test(page) && !/setSelectedSubject\(/.test(page),
        "the open subject is held in state again, so it cannot be linked");
    assert.ok(/rememberSubjectLink\(location\)/.test(app) && /takePendingSubject\(\)/.test(app),
        "a link opened signed out is lost at the sign-in");
});

check("SWITCHING KEEPS THE ENTRY'S STATE, so back never leaves the app", () => {
    // Marking a replaced entry as opened-from-the-list made the page's own
    // back button navigate(-1) out of the app, to whatever came before.
    assert.ok(/state: replace \? location\.state : \{ fromSubjects: true \}/.test(page),
        "a replace stamps fromSubjects on an entry the list never opened");
    assert.ok(/if \(location\.state\?\.fromSubjects\) navigate\(-1\)/.test(page), "back no longer checks how it arrived");
    assert.ok(/onOpen=\{\(s\) => openSubject\(s, \{ replace: true \}\)\}/.test(page),
        "switching subjects pushes, so back walks every subject flicked through");
});

check("the add dialog exists on the subject page as well as the list", () => {
    const uses = (page.match(/\{yearDialog\}/g) || []).length;
    assert.equal(uses, 2, `the year dialog is drawn on ${uses} view(s); Add opens nothing on the other`);
});

check("compare NAMES NO WINNER: every cell is the row's own value, unranked", () => {
    assert.ok(compare.includes("compareRows("), "compare rolls its own rows");
    assert.ok(/<Cell value=\{r\.a\} \/>\s*<Cell value=\{r\.b\} \/>/.test(compare), "a cell is drawn from something other than the row");
    // No exemption for the sentence saying neither is better: it names none
    // of these, and an exemption matched quote-to-quote swallowed the JSX
    // text around it, which is where an injected verdict landed unseen.
    assert.ok(!/\b(winner|wins|stronger|weaker|easier|harder)\b/i.test(compare),
        "compare is calling one side");
    assert.ok(!/r\.a\s*[<>]=?\s*r\.b|r\.b\s*[<>]=?\s*r\.a/.test(compare), "compare is comparing the values it should only print");
});

check("a figure on a solid segment is inked for contrast, not white by default", () => {
    const src = strip(read("src/components/vce/YearBar.jsx"));
    assert.ok(/style=\{p\.kind === "exam" \? \{ color: inkOn\(hex\) \}/.test(src), "exam figures are a fixed ink again");
    // The function is pure: lift and run it rather than import a .jsx.
    const body = src.slice(src.indexOf("export function inkOn"), src.indexOf("function runsOf"));
    const fn = new Function(`${body.replace("export ", "")}; return inkOn;`)();
    assert.equal(fn("#F0B429"), "#111827", "white on amber");
    assert.equal(fn("#0EA5E9"), "#111827", "white on sky");
    assert.equal(fn("#8B5CF6"), "#FFFFFF", "dark on violet");
});

console.log(`\n${passed} subject info checks passed`);
