/**
 * guide assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/guides.test.mjs
 *
 * ═══ A GUIDE IS BUILT, NEVER WRITTEN ═══════════════════════════════════════
 * /Guides was student posts published to the whole site. Every guide is now
 * read straight off three sources the app already carries — the examiner
 * profiles, VCAA's mark split and the cited technique science — and these
 * checks hold the two ways that goes wrong without anything throwing: a
 * section printing text that is not true of the subject (the generic
 * fallback, or instructions meant for a model), and a door leading somewhere
 * that does not exist.
 *
 * Every check below was verified by putting the bug back.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import {
    TECHNIQUES, TERMS_KEY, techniqueGuide, termsGuide, lostMarks, subjectGuide,
    subjectLine, subjectLead, guideLibrary, searchAreas, guideFromQuery,
} from "@/lib/guides";
import { examinerProfile, getProfiledSubjects, getExaminerPrompt, COMMAND_TERMS } from "@/lib/subjectExaminerPrompts";
import { VCE_SUBJECTS } from "@/data/vceSubjects";
import { markSplit } from "@/lib/subjectHub";
import { TECHNIQUE_NEURO } from "@/lib/neuro";
import { TOOL_LABELS } from "@/lib/toolLabels";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};
const read = (rel) => fs.readFileSync(rel, "utf8");
const strip = (src) => src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1")
    .replace(/^\s*--[^\n]*$/gm, "");
const walk = (dir, out = []) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = `${dir}/${e.name}`;
        if (e.isDirectory()) walk(p, out);
        else if (/\.(jsx?|mjs)$/.test(e.name) && !/\.test\.mjs$/.test(e.name)) out.push(p);
    }
    return out;
};

const PROMPTS_SRC = read("src/lib/subjectExaminerPrompts.js");
const LIB = guideLibrary({});
const ALL = LIB.areas.flatMap((a) => a.guides);
const PAGES = new Set([...read("src/pages.config.js").matchAll(/^\s*"([A-Za-z]+)":\s*[A-Za-z]+,/gm)].map((m) => m[1]));

/* ── Nothing invented ─────────────────────────────────────────────────── */

check("every catalogue subject has a guide, and a made-up one has none", () => {
    for (const s of VCE_SUBJECTS) assert.ok(subjectGuide(s.name), `${s.name} has no guide`);
    assert.equal(subjectGuide("Underwater Basket Weaving"), null);
    assert.equal(subjectGuide(""), null);
    assert.equal(LIB.count, VCE_SUBJECTS.length);
    // Case does not decide it — a hub's name comes off a student's own row.
    assert.equal(subjectGuide("chemistry")?.name, "Chemistry");
});

check("the generic fallback profile is never printed as a subject's marking", () => {
    // `_default` exists so a PROMPT always has something. Under a subject's
    // name it would be the app making up how that subject is marked.
    assert.equal(examinerProfile("_default"), null);
    assert.equal(subjectGuide("_default"), null);
    const start = PROMPTS_SRC.indexOf('"_default": {');
    const def = PROMPTS_SRC.slice(start, PROMPTS_SRC.indexOf("\n    },", start));
    const lines = [...def.matchAll(/(?:examFormat|markConventions|commonMistakes|topicCoverage): "([^"]{20,})"/g)].map((m) => m[1]);
    assert.ok(lines.length >= 3, "could not read the _default profile — has it moved?");
    const everything = JSON.stringify(ALL);
    for (const l of lines) assert.ok(!everything.includes(l.slice(0, 40)), `a guide prints the _default text "${l.slice(0, 40)}…"`);
});

check("instructions written for a model never reach a student", () => {
    const styles = [...PROMPTS_SRC.matchAll(/examplePromptStyle: "([^"]{20,})"/g)].map((m) => m[1]);
    assert.ok(styles.length >= 30, `only found ${styles.length} examplePromptStyle lines`);
    const everything = JSON.stringify(ALL);
    for (const s of styles) assert.ok(!everything.includes(s.slice(0, 40)), `a guide prints model instructions: "${s.slice(0, 40)}…"`);
    assert.ok(!("examplePromptStyle" in (examinerProfile("Chemistry") || {})));
});

check("the marks split IS the hub's split, through markSplit", () => {
    for (const s of VCE_SUBJECTS) {
        const g = subjectGuide(s.name);
        assert.deepEqual(g.marks?.parts || [], markSplit(s).parts, `${s.name} prints a different split from its hub`);
    }
});

check("a weight in an exam format is one the catalogue can produce", () => {
    // The exam prose and the split sit on one screen. Specialist said "~17%
    // each" against a 20/14 split, and Media a 30/10 against 20/20 — the page
    // disagreeing with itself. Every % printed must be a component's weight
    // or a sum of components' weights.
    for (const s of VCE_SUBJECTS) {
        const weights = s.assessment_structure.map((a) => Number(a.percentage)).filter((n) => n > 0);
        const sums = new Set([0]);
        for (const w of weights) for (const v of [...sums]) sums.add(v + w);
        const exam = examinerProfile(s.name)?.examFormat || "";
        for (const m of exam.matchAll(/(\d+)%/g)) {
            assert.ok(sums.has(Number(m[1])), `${s.name}'s exam format says ${m[1]}%, which its split cannot add up to`);
        }
    }
});

check("the General Maths growth-factor line says what it means", () => {
    // It read "Using $r = 1.05$ instead of $r = 1.05$" — the same number on
    // both sides, printed to a student as a mistake to avoid.
    for (const g of ALL) for (const l of g.lost) {
        const m = l.match(/(\$[^$]+\$)[^$]*instead of[^$]*(\$[^$]+\$)/);
        if (m) assert.notEqual(m[1], m[2], `${g.name}: "${l}" names the same thing twice`);
    }
});

check("no banned word reaches a guide", () => {
    for (const g of ALL) {
        const t = JSON.stringify(g);
        assert.ok(!/\b[Dd]on['’]t\b|\bFix it\b|\bNo excuses\b|\bEmbarrassing\b/.test(t), `${g.name} carries a banned word`);
    }
});

/* ── Lost marks ───────────────────────────────────────────────────────── */

check("lost marks parse in all three shapes the profiles use", () => {
    assert.deepEqual(lostMarks("Students lose marks by: (1) giving decimals; (2) forgetting +c."),
        ["Giving decimals", "Forgetting +c"]);
    assert.deepEqual(lostMarks("(1) Wrong sign for $\\Delta H$; (2) Missing units."),
        ["Wrong sign for $\\Delta H$", "Missing units"]);
    // A comma INSIDE brackets is part of the item, not a split.
    assert.deepEqual(lostMarks("Unit conversions, ignoring context (audience, setting), wrong period."),
        ["Unit conversions", "Ignoring context (audience, setting)", "Wrong period"]);
    assert.deepEqual(lostMarks(""), []);
    assert.deepEqual(lostMarks(null), []);
});

check("every profiled subject parses to a real list", () => {
    for (const n of getProfiledSubjects()) {
        const items = lostMarks(examinerProfile(n).commonMistakes);
        assert.ok(items.length >= 3, `${n} parsed to ${items.length} items`);
        for (const i of items) {
            assert.ok(!/^\(\d+\)/.test(i), `${n}: "${i}" kept its number`);
            assert.ok(!/^students lose/i.test(i), `${n}: kept the prefix`);
            assert.ok(i.length > 4, `${n}: "${i}" is a fragment`);
        }
    }
});

check("the profile change did not change what the marker is told, beyond the fixes", () => {
    // The accessor is a reader. The prompt is still built off the same object.
    const prompt = getExaminerPrompt("Chemistry");
    assert.ok(prompt.includes(examinerProfile("Chemistry").markConventions));
    assert.ok(prompt.includes("QUESTION STYLE"), "the model still gets its own instructions");
});

/* ── Techniques and command terms ─────────────────────────────────────── */

check("technique names and ids are Study's own", () => {
    const study = read("src/pages/Study.jsx");
    const block = study.slice(study.indexOf("const TECHNIQUES = ["));
    const list = block.slice(0, block.indexOf("\n];"));
    const theirs = new Map([...list.matchAll(/id:\s*"([a-z_]+)",\s*name:\s*"([^"]+)"/g)].map((m) => [m[1], m[2]]));
    assert.ok(theirs.size >= 6, `only found ${theirs.size} techniques in Study.jsx — has the list moved?`);
    assert.equal(TECHNIQUES.length, theirs.size, "a technique is missing from the guides");
    for (const t of TECHNIQUES) {
        assert.equal(theirs.get(t.id), t.name, `${t.id} is "${theirs.get(t.id)}" on Study and "${t.name}" here`);
        assert.ok(TECHNIQUE_NEURO[t.id], `${t.id} has no science behind it`);
        assert.ok(techniqueGuide(t.id), `${t.id} has no guide`);
    }
    assert.equal(LIB.techniques.length, TECHNIQUES.length);
    assert.equal(techniqueGuide("nap"), null);
});

check("the command terms are the one list, in full", () => {
    const g = termsGuide();
    assert.equal(g.terms.length, COMMAND_TERMS.length);
    for (const t of COMMAND_TERMS) assert.ok(g.terms.some((x) => x.term === t.term && x.behaviour === t.behaviour));
    // ONE guide rather than thirty-five copies inside the subject guides.
    for (const sg of ALL) assert.ok(!("commandTerms" in sg));
});

/* ── Every door lands ─────────────────────────────────────────────────── */

const everyGuide = [...ALL, ...LIB.techniques, ...LIB.reference];

check("every guide ends in a door, and every door is a real page", () => {
    for (const g of everyGuide) {
        assert.ok(g.doors.length > 0, `${g.name} has no way through`);
        assert.equal(g.doors.filter((d) => d.primary).length, 1, `${g.name} has ${g.doors.filter((d) => d.primary).length} primary doors`);
        for (const d of g.doors) {
            const pageName = d.to.replace(/^\//, "").split("?")[0];
            assert.ok(PAGES.has(pageName), `${g.name} → ${d.to}: no page called ${pageName}`);
        }
    }
});

check("a tool door names a real tool, and a Study door a real technique", () => {
    const study = read("src/pages/Study.jsx");
    for (const g of everyGuide) for (const d of g.doors) {
        const q = new URLSearchParams(d.to.split("?")[1] || "");
        if (d.to.startsWith("/AITools")) assert.ok(TOOL_LABELS[q.get("tool")], `${g.name}: no tool "${q.get("tool")}"`);
        if (d.to.startsWith("/Study")) {
            assert.ok(TECHNIQUES.some((t) => t.id === q.get("tab")), `${g.name}: no technique "${q.get("tab")}"`);
            assert.match(study, /TECHNIQUES\.some\(\s*\w+\s*=>\s*\w+\.id === \w+\)/, "Study no longer honours ?tab=");
        }
        if (d.to.startsWith("/SubjectHub")) assert.equal(q.get("subject"), g.name);
    }
});

check("every guide's own link reads back as that guide", () => {
    for (const g of everyGuide) {
        const back = guideFromQuery(g.href.split("?")[1]);
        assert.equal(back?.key, g.key, `${g.href} opens ${back?.key}`);
    }
    assert.equal(guideFromQuery("?subject=_default"), null);
    assert.equal(guideFromQuery("?subject=Nope"), null);
    assert.equal(guideFromQuery("?technique=nope"), null);
    assert.equal(guideFromQuery(""), null);
    assert.equal(guideFromQuery(`?ref=${TERMS_KEY}`)?.kind, "terms");
});

/* ── The library ──────────────────────────────────────────────────────── */

check("your subjects lead, deduped, in your order, and only real ones", () => {
    const L = guideLibrary({ mySubjects: ["physics", "Chemistry", "Physics", "My own subject", "Foundation Mathematics"] });
    assert.deepEqual(L.mine.map((g) => g.name), ["Physics", "Chemistry", "Foundation Mathematics"]);
    // A profiled subject the catalogue lacks is still reachable from the shelf.
    assert.ok(L.areas.some((a) => a.guides.some((g) => g.name === "Foundation Mathematics")));
    assert.equal(L.count, VCE_SUBJECTS.length + 1);
});

check("the shelf is by learning area, sorted, with no empty area", () => {
    for (const a of LIB.areas) {
        assert.ok(a.guides.length > 0, `${a.label} is empty`);
        const names = a.guides.map((g) => g.name);
        assert.deepEqual(names, [...names].sort((x, y) => x.localeCompare(y)));
    }
    assert.ok(!LIB.areas.some((a) => a.key === "other"), "a catalogue subject fell into 'Your own'");
    const found = searchAreas(LIB.areas, "chem");
    assert.deepEqual(found.flatMap((a) => a.guides.map((g) => g.name)), ["Chemistry"]);
    assert.equal(searchAreas(LIB.areas, "zzz").length, 0);
    assert.equal(searchAreas(LIB.areas, "  ").length, LIB.areas.length);
});

check("a row's line is a fact off the guide, or nothing", () => {
    const g = subjectGuide("Mathematical Methods");
    assert.equal(subjectLine(g), `${g.marks.heaviest.component} is ${g.marks.heaviest.percentage}%`);
    assert.equal(subjectLead(g), `${g.marks.heaviest.component} is ${g.marks.heaviest.percentage}% of the study score · ${g.lost.length} common ways marks are lost`);
    assert.equal(subjectLine(null), "");
    assert.equal(subjectLead(null), "");
    // No split in the catalogue: the line is EMPTY, never "undefined is NaN%".
    const noSplit = subjectGuide("Foundation Mathematics");
    assert.equal(noSplit.marks, null);
    assert.equal(subjectLine(noSplit), "");
    assert.ok(!/undefined|null|NaN/.test(subjectLead(noSplit)));
});

/* ── The wiring ───────────────────────────────────────────────────────── */

const PAGE = strip(read("src/pages/Guides.jsx"));
const HUB = strip(read("src/pages/SubjectHub.jsx"));

check("the page reads no student posts and offers no way to write one", () => {
    assert.ok(!/StudyGuide/.test(PAGE), "Guides.jsx still reads the study_guides table");
    assert.ok(!/<textarea|<Textarea|is_featured|\.create\(/.test(PAGE), "Guides.jsx can still write a post");
    for (const gone of ["GuideCard", "GuideReader", "GuideQuizPlayer"]) {
        assert.ok(!fs.existsSync(`src/components/guides/${gone}.jsx`), `${gone}.jsx is back`);
        for (const f of walk("src")) assert.ok(!read(f).includes(`guides/${gone}`), `${f} imports ${gone}`);
    }
});

check("the hub and the page draw a subject's guide with ONE component", () => {
    assert.match(PAGE, /<SubjectGuide guide=\{guide\} place="page"/);
    assert.match(HUB, /<SubjectGuide guide=\{guide\} place="hub"/);
    assert.match(HUB, /subjectGuide\(name\)/);
    // And the split, which both draw, through one list.
    assert.match(HUB, /<MarkSplitList split=\{split\}/);
    assert.match(strip(read("src/components/guides/SubjectGuide.jsx")), /<MarkSplitList split=\{guide\.marks\}/);
    assert.ok(!/split\.parts\.map/.test(HUB), "the hub draws its own copy of the split again");
});

check("the hub leaves out what it already shows", () => {
    const comp = strip(read("src/components/guides/SubjectGuide.jsx"));
    assert.match(comp, /!hub && guide\.marks/);
    assert.match(comp, /!hub && guide\.course/);
    assert.match(comp, /!hub && guide\.tips\.length/);
});

check("prose goes through KaTeX, because the maths profiles carry LaTeX", () => {
    const comp = strip(read("src/components/guides/SubjectGuide.jsx"));
    for (const f of ["guide.exam", "guide.rewarded", "item", "guide.course"]) {
        assert.match(comp, new RegExp(`<MarkdownMath[^>]*>\\{${f.replace(".", "\\.")}\\}</MarkdownMath>`), `${f} is not rendered as maths`);
    }
});

check("a technique guide is the Study panel, not a second drawing of the science", () => {
    assert.match(PAGE, /<NeuroPanel techniqueId=\{guide\.id\}[^>]*layout="page"/);
    const panel = strip(read("src/components/study/NeuroPanel.jsx"));
    assert.match(panel, /layout = "rail"/, "the rail stopped being the default — Study would change");
});

check("Guides is in both navs, and old posts go with an account", () => {
    for (const nav of ["src/components/layout/SideRail.jsx", "src/components/layout/BottomNav.jsx"]) {
        assert.match(read(nav), /path: "Guides"/, `${nav} has no way to Guides`);
    }
    assert.match(strip(read("src/pages/Settings.jsx")), /label: "Study guides",\s*read: \(\) => base44\.entities\.StudyGuide\.filter\(\{ created_by: email \}\)/);
});

check("migration 0044 unpublishes the posts and keeps the author's own", () => {
    const sql = strip(read("supabase/migrations/0044_study_guides_private.sql"));
    for (const p of ["study_guides_select_all", "study_guides_insert_own", "study_guides_update_own"]) {
        assert.match(sql, new RegExp(`drop policy if exists "${p}"`), `${p} is not dropped`);
    }
    assert.match(sql, /create policy "study_guides_select_own"[\s\S]*?using \(created_by = auth\.email\(\)\)/);
    assert.ok(!/for (insert|update)|auth\.uid\(\) is not null/.test(sql), "0044 re-opens a write or a read for everyone");
});

console.log(`\n${passed} guide checks passed`);
