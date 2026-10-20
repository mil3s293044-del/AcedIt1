/**
 * question text assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/questionText.test.mjs
 *
 * ═══ "THESE WEIRD LINES OF SYMBOLS CAME UP" ═════════════════════════════════
 * A Chemistry question reached a student as raw LaTeX with the two characters
 * `\n` between its parts. The model had doubled the newline escape along with
 * every LaTeX backslash, and three surfaces printed question strings straight
 * into a paragraph with no maths renderer at all.
 *
 * Both halves render perfectly and throw nothing, so the repair is a pure
 * function (questionText.js) run by both renderers and by normaliseQuestion,
 * and the printers are SCANNED: every place that prints a question, an answer
 * or a model answer goes through MarkdownMath or MathText. Every check below
 * was verified by putting the bug back.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { cleanText, cleanQuestion, splitInlineParts, liftInlineParts, isCommand } from "@/lib/questionText";
import { normaliseQuestion, normaliseStimulus, questionAsText } from "@/lib/quizSchema";

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
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

// The question exactly as the student reported it: single backslashes on the
// LaTeX, and the two characters `\` `n` where each line break belonged.
const COMPLAINT = String.raw`A student burns ethanol in a spirit burner beneath a metal can containing 100 g of water. The mass of ethanol burned is 1.85 g, and the temperature of the water increases from 20.0 °C to 40.0 °C. The specific heat capacity of water is $4.18\ \text{J g}^{-1}\ ^{\circ}\text{C}^{-1}$. The value for the energy released by the complete combustion of ethanol is $29.6\ \text{kJ g}^{-1}$.\n(a) Write a balanced equation for the complete combustion of ethanol, $\text{C}_2\text{H}_5\text{OH}$. (1 mark)\n(b) Calculate the energy transferred to the water, in kJ, using $q = mc\Delta T$. (2 marks)\n(c) Hence determine the experimental enthalpy change of combustion of ethanol, in $\text{kJ mol}^{-1}$, including the correct sign. Give your answer to 3 significant figures. (3 marks)\n(d) Calculate the percentage of the expected energy per gram that was transferred to the water. (2 marks)\n(e) Evaluate the statement: 'The value in part (d) shows that only this percentage of the ethanol underwent combustion.' In your response, identify two sources of systematic error that would make the experimental value too low and state one modification to the apparatus that would address each. (4 marks)`;

console.log("\n── The repair ──");

check("the complaint's literal \\n become line breaks, and its LaTeX survives untouched", () => {
    const out = cleanText(COMPLAINT);
    assert.ok(!out.includes("\\n"), "a literal \\n is left");
    assert.equal(out.split("\n").length, 6, "the stem and five parts are six lines");
    for (const tex of [String.raw`\text{J g}^{-1}`, String.raw`^{\circ}`, String.raw`\Delta T`, String.raw`\text{kJ mol}^{-1}`]) {
        assert.ok(out.includes(tex), `${tex} was altered`);
    }
});

check("a real command that starts with n stays a command, in maths and out", () => {
    for (const cmd of ["neq", "nabla", "nu", "ne", "not", "notin", "neg", "ni"]) {
        assert.equal(cleanText(`$a \\${cmd} b$`), `$a \\${cmd} b$`, `\\${cmd} became a line break`);
    }
    assert.equal(cleanText(String.raw`x \neq y`), String.raw`x \neq y`);
    // …and the letter run is matched WHOLE: `\nunder` is not `\nu` + "nder".
    assert.equal(cleanText(String.raw`one\nunder two`), "one\nunder two");
    assert.equal(cleanText(String.raw`a\nThe end`), "a\nThe end");
});

check("TeX's own line break `\\\\` followed by n is left alone", () => {
    const s = String.raw`$\begin{aligned} a &= 1 \\ n &= 2 \end{aligned}$`;
    assert.equal(cleanText(s), s);
    assert.equal(cleanText(String.raw`a \\new`), String.raw`a \\new`);
});

check("a literal \\r\\n is one line break, and a real CRLF becomes LF", () => {
    assert.equal(cleanText(String.raw`one\r\ntwo`), "one\ntwo");
    assert.equal(cleanText("one\r\ntwo"), "one\ntwo");
});

check("code is shown exactly as written — a question ABOUT \\n keeps it", () => {
    const s = 'What does `printf("\\n")` print?\\n(a) Explain. (2 marks)';
    const out = cleanText(s);
    assert.ok(out.includes('`printf("\\n")`'), "the code span was repaired");
    assert.ok(out.includes("print?\n(a)"), "the prose around it was not");
    const fenced = "```\nprint('a\\nb')\n```";
    assert.equal(cleanText(fenced), fenced);
});

check("escapes a single-escaping model lost are restored INSIDE maths", () => {
    // What JSON.parse makes of `\text`, `\frac`, `\beta`, `\rho`, `\vec`, `\nu`.
    assert.equal(cleanText("$4.18\\ \text{J}$"), String.raw`$4.18\ \text{J}$`);
    assert.equal(cleanText("$\frac{1}{2}$"), String.raw`$\frac{1}{2}$`);
    assert.equal(cleanText("$\beta + \rho$"), String.raw`$\beta + \rho$`);
    assert.equal(cleanText("$\vec{v}$"), String.raw`$\vec{v}$`);
    assert.equal(cleanText("$\nu = 3$"), String.raw`$\nu = 3$`);
    assert.equal(cleanText("$\times 10^3$"), String.raw`$\times 10^3$`);
});

check("…only when the letter run is a WHOLE command, and never outside maths", () => {
    assert.equal(cleanText("$a\textra$"), "$a\textra$", "a tab before a non-command was rewritten");
    assert.equal(cleanText("Name:\ttan lines"), "Name:\ttan lines", "prose was rewritten");
});

check("a line break inside DISPLAY maths is layout, not an eaten \\nu", () => {
    const s = "$$\nu = v_0 + at\n$$";
    assert.equal(cleanText(s), s, "a physics student's initial velocity became a Greek letter");
});

check("a doubly-escaped quote outside maths is a quote", () => {
    assert.equal(cleanText(String.raw`Evaluate the statement: \"It burns.\"`), 'Evaluate the statement: "It burns."');
    // Before a formula and after one — and a quote's own accent inside maths stays.
    assert.equal(cleanText(String.raw`Evaluate \"this\" using $q = mc\Delta T$, then \"that\".`),
        String.raw`Evaluate "this" using $q = mc\Delta T$, then "that".`);
});

check("idempotent: a repaired string has nothing left to repair", () => {
    const once = cleanText(COMPLAINT);
    assert.equal(cleanText(once), once);
    const eaten = cleanText("$\text{a} \nu$\\n(b) next");
    assert.equal(cleanText(eaten), eaten);
});

check("anything that is not a string comes back as a string; null is empty", () => {
    assert.equal(cleanText(null), "");
    assert.equal(cleanText(undefined), "");
    assert.equal(cleanText(12), "12");
});

check("the command tables hold no name under the wrong letter", () => {
    for (const [letter, name] of [["n", "nu"], ["t", "text"], ["f", "frac"], ["b", "beta"], ["v", "vec"], ["r", "rho"]]) {
        assert.ok(isCommand(letter, name), `${name} is missing`);
    }
    assert.ok(!isCommand("n", "nunder"));
    assert.ok(!isCommand("t", "nu"));
});

console.log("\n── Every field, and every reader through normaliseQuestion ──");

check("cleanQuestion repairs every text field and keeps the shape", () => {
    const q = cleanQuestion({
        type: "multipart", question: "Stem\\nmore", marks: 4, extra: { keep: true },
        stimulus: { label: "Source A", content: "row\\nrow" },
        parts: [{ prompt: "a\\nb", model_answer: "x\\ny", marks: 2 }],
        options: ["one\\ntwo", 3],
    });
    assert.equal(q.question, "Stem\nmore");
    assert.equal(q.stimulus.content, "row\nrow");
    assert.equal(q.stimulus.label, "Source A");
    assert.equal(q.parts[0].prompt, "a\nb");
    assert.equal(q.parts[0].model_answer, "x\ny");
    assert.deepEqual(q.options, ["one\ntwo", 3]);
    assert.deepEqual(q.extra, { keep: true });
    assert.equal(q.marks, 4);
});

check("a STORED question reads back clean through normaliseQuestion — stem, part, answer, source", () => {
    const n = normaliseQuestion({ type: "short_answer", question: COMPLAINT, model_answer: "x\\ny", marks: 12 }, 3);
    assert.ok(!n.stem.includes("\\n"), "the stem still carries a literal \\n");
    assert.ok(!n.parts[0].prompt.includes("\\n"), "the part still does");
    assert.equal(n.parts[0].model_answer, "x\ny");
    const m = normaliseQuestion({ question: "S\\nT", parts: [{ prompt: "p\\nq", marks: 2 }, { prompt: "r", marks: 1 }] }, 0);
    assert.equal(m.stem, "S\nT");
    assert.equal(m.parts[0].prompt, "p\nq");
    assert.equal(normaliseStimulus("line\\nline").content, "line\nline");
});

check("…and it NEVER splits a stored question, because its answer key is its bare index", () => {
    const n = normaliseQuestion({ type: "short_answer", question: COMPLAINT, marks: 12 }, 3);
    assert.equal(n.multipart, false);
    assert.equal(n.parts.length, 1);
    assert.equal(n.parts[0].key, "3", "a stored question's answer key moved");
});

console.log("\n── Parts written into the stem, lifted at generation ──");

check("the complaint lifts into a stem and five parts worth 1+2+3+2+4", () => {
    const split = splitInlineParts(COMPLAINT);
    assert.ok(split, "it did not split");
    assert.ok(split.stem.startsWith("A student burns ethanol"));
    assert.ok(split.stem.endsWith(String.raw`$29.6\ \text{kJ g}^{-1}$.`));
    assert.deepEqual(split.parts.map((p) => p.label), ["a", "b", "c", "d", "e"]);
    assert.deepEqual(split.parts.map((p) => p.marks), [1, 2, 3, 2, 4]);
    assert.ok(!split.parts.some((p) => /\(\d+ marks?\)/.test(p.prompt)), "an allocation is left in a prompt");
    // Part (e) quotes part (d) by name, and that is still part of (e).
    assert.ok(split.parts[4].prompt.includes("part (d) shows"));
});

check("the model answer splits under the same labels, or the question is not lifted", () => {
    const answer = "(a) C2H5OH(l) + 3O2(g) → 2CO2(g) + 3H2O(l)\n(b) 8.36 kJ\n(c) −208 kJ/mol\n(d) 15.3%\n(e) Heat lost; incomplete combustion.";
    const split = splitInlineParts(COMPLAINT, answer);
    assert.ok(split);
    assert.equal(split.parts[0].model_answer, "C2H5OH(l) + 3O2(g) → 2CO2(g) + 3H2O(l)",
        "a state symbol was read as a part label");
    assert.equal(split.parts[4].model_answer, "Heat lost; incomplete combustion.");
    assert.equal(splitInlineParts(COMPLAINT, "(a) one (b) two"), null, "a short answer key was spread across five parts");
    assert.equal(splitInlineParts(COMPLAINT, "")?.parts[0].model_answer, "");
});

check("it refuses rather than guesses", () => {
    // A part with no allocation of its own is not proven to be a part.
    assert.equal(splitInlineParts("Stem.\n(a) First. (2 marks)\n(b) Second."), null);
    // One label is a sentence, not a question in parts.
    assert.equal(splitInlineParts("Stem.\n(a) Only one. (2 marks)"), null);
    // Labels out of order are not a run.
    assert.equal(splitInlineParts("Stem.\n(a) One. (1 mark)\n(c) Three. (1 mark)"), null);
    // No stem is not a question this can lift.
    assert.equal(splitInlineParts("(a) One. (1 mark)\n(b) Two. (1 mark)"), null);
    // A forward reference ends the earlier part without an allocation.
    assert.equal(splitInlineParts("Stem.\n(a) Use the result in (b) below. (2 marks)\n(b) Two. (1 mark)"), null);
    // Square brackets and a trailing full stop are both an allocation.
    assert.ok(splitInlineParts("Stem.\n(a) One [1 mark].\n(b) Two (2 marks)."));
});

check("liftInlineParts makes a real multipart question, and leaves everything else alone", () => {
    const lifted = liftInlineParts({ type: "short_answer", question: COMPLAINT, marks: 5, model_answer: "" });
    assert.equal(lifted.type, "multipart");
    assert.equal(lifted.parts.length, 5);
    assert.ok(!("marks" in lifted), "the flat allocation survived beside the parts");
    assert.ok(lifted.parts.every((p) => p.type === "short"));
    const n = normaliseQuestion(lifted, 2);
    assert.equal(n.marks, 12, "five parts did not add up to their allocations");
    assert.deepEqual(n.parts.map((p) => p.key), ["2a", "2b", "2c", "2d", "2e"]);

    const withParts = { type: "multipart", question: "S", parts: [{ prompt: "p", marks: 1 }] };
    assert.equal(liftInlineParts(withParts), withParts);
    const mcq = { type: "mcq", question: COMPLAINT, options: ["a", "b", "c", "d"] };
    assert.equal(liftInlineParts(mcq), mcq);
    const plain = { type: "short_answer", question: "Define enthalpy." };
    assert.equal(liftInlineParts(plain), plain);
});

console.log("\n── The renderers repair, and nothing prints a question raw ──");

check("MarkdownMath and MathText both run cleanText before rendering", () => {
    const md = strip(read("src/components/shared/MarkdownMath.jsx"));
    assert.ok(/import\s*\{[^}]*\bcleanText\b[^}]*\}\s*from\s*"@\/lib\/questionText"/.test(md), "MarkdownMath does not import it");
    assert.ok(/useStreamedText\(\s*cleanText\(/.test(md) || /=\s*cleanText\([^)]*children/.test(md),
        "MarkdownMath does not clean what it renders");
    const mt = strip(read("src/components/shared/LatexRenderer.jsx"));
    assert.ok(/processLatexContent\(\s*cleanText\(/.test(mt), "MathText does not clean what it renders");
});

check("MarkdownMath draws a single line break as a break, so (a) and (b) are two lines", () => {
    const md = strip(read("src/components/shared/MarkdownMath.jsx"));
    const plugins = md.match(/remarkPlugins=\{\[([^\]]*)\]\}/);
    assert.ok(plugins, "no remarkPlugins list");
    assert.ok(/\bremarkSoftBreaks\b/.test(plugins[1]), "the soft-break plugin is not in the list");
    assert.ok(/type:\s*"break"/.test(md), "the plugin does not emit a break node");
});

/** Every .jsx under src. */
function jsxFiles(dir = "src") {
    const out = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) out.push(...jsxFiles(p));
        else if (e.name.endsWith(".jsx")) out.push(p);
    }
    return out;
}

// A question, an answer or a model answer printed as a bare JSX child. The
// fields are the ones a model writes; `title` and labels are the app's own.
const RAW = /(^|[^=\w"'`$])\{\s*[A-Za-z_][\w?.[\]]*\??\.(question|answer|model_answer|modelAnswer|prompt|stem|explanation|feedback)\s*\}/g;
// A local holding one, printed bare. Named, because a bare `{question}` is
// also how a prop is passed down, and only the printing sites matter.
const RAW_LOCAL = /<(p|span|div|h\d|li|em|strong)\b[^>]*>\s*\{\s*(question|answer)\s*\}/g;
// Directly inside one of these, the text is rendered as maths.
const RENDERED = /<(MarkdownMath|MathText|QuestionPanel|SourcePanel)\b[^>]*>\s*$/;

/**
 * Named exceptions, each with its reason, each asserted to still be the line
 * it describes — an exemption pointing at code that has moved covers nothing
 * and the scan passes anyway.
 */
const EXEMPT = [
    { file: "src/components/cards/QuizTable.jsx", match: "{question}",
      why: "a rendered node the player builds (it holds MarkdownMath), not a string" },
    { file: "src/components/ace/FirstWin.jsx", match: "{problem.answer}",
      why: "the app's own option copy in the student's words, not a model's" },
];

/** Comments out, line count kept, so a hit reports the line it is on. */
const blank = (src) => src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

/** Every raw printer in one source, as "line: text". */
function rawPrinters(file, src) {
    const lines = blank(src).split("\n");
    const hits = [];
    lines.forEach((line, i) => {
        if (/value=\{|placeholder=|aria-label=|alt=/.test(line)) return;
        const lead = lines.slice(Math.max(0, i - 2), i).join("\n");
        for (const re of [RAW, RAW_LOCAL]) {
            for (const m of line.matchAll(re)) {
                const at = m.index + (m[1] && re === RAW ? m[1].length : 0);
                const before = `${lead}\n${line.slice(0, at)}`;
                if (RENDERED.test(before)) continue;
                if (EXEMPT.some((e) => file.endsWith(e.file) && line.includes(e.match))) continue;
                hits.push(`${file}:${i + 1}: ${line.trim()}`);
            }
        }
    });
    return hits;
}

check("no component prints a model-written question or answer as raw text", () => {
    const hits = jsxFiles().flatMap((f) => rawPrinters(f, read(f)));
    assert.deepEqual(hits, [], `printed raw:\n        ${hits.join("\n        ")}`);
});

check("…the exemptions still point at real lines", () => {
    for (const e of EXEMPT) {
        assert.ok(fs.existsSync(e.file), `${e.file} has moved`);
        assert.ok(read(e.file).includes(e.match), `${e.file} no longer has ${e.match}`);
    }
});

check("…and the scan is not vacuous: it finds each shape, and passes a rendered one", () => {
    assert.equal(rawPrinters("x.jsx", '<p className="text-lg">{q?.question}</p>').length, 1);
    assert.equal(rawPrinters("x.jsx", '<p className="x">{question}</p>').length, 1);
    assert.equal(rawPrinters("x.jsx", "<span>\n    {card.answer}\n</span>").length, 1);
    assert.equal(rawPrinters("x.jsx", '<p><MathText>{card.question}</MathText></p>').length, 0);
    assert.equal(rawPrinters("x.jsx", '<MarkdownMath className="a">\n    {eq.modelAnswer}\n</MarkdownMath>').length, 0);
    assert.equal(rawPrinters("x.jsx", "<Textarea value={card.question} />").length, 0);
    assert.equal(rawPrinters("x.jsx", "{/* {card.question} */}").length, 0);
});

check("a short formula keeps its full stop on the same line, and a long one can still wrap", () => {
    const md = strip(read("src/components/shared/MarkdownMath.jsx"));
    const plugins = md.match(/rehypePlugins=\{\[([^\]]*)\]\}/);
    assert.ok(plugins && /rehypeKatex\s*,\s*rehypeGluePunctuation/.test(plugins[1]),
        "the glue must run AFTER KaTeX, on the formula it drew");
    assert.ok(/whitespace-nowrap/.test(md), "the pair is not held together");
    assert.ok(/visibleText\(child\)\.length\s*>\s*GLUE_MAX/.test(md),
        "every formula is glued — a long equation becomes unbreakable and overflows a phone");
});

console.log("\n── Revision Mode sits a question whole, against a real model answer ──");

check("questionAsText: a multipart question is its stem AND every part, with allocations", () => {
    const q = { type: "multipart", question: "Magnesium reacts with HCl.", parts: [
        { label: "a", prompt: "Write the equation.", marks: 2, model_answer: "Mg + 2HCl" },
        { label: "b", type: "mcq", prompt: "Which gas?", options: ["H2", "O2"], correct_answer: 0 },
    ] };
    const t = questionAsText(q, 4);
    assert.equal(t.text, "Magnesium reacts with HCl.\n\n(a) Write the equation. (2 marks)\n(b) Which gas? (1 mark)\nA. H2\nB. O2");
    assert.equal(t.modelAnswer, "(a) Mg + 2HCl\n(b) H2");
    assert.equal(t.marks, 3);
    const flat = questionAsText({ type: "short_answer", question: "Define x\\ny.", model_answer: "y", marks: 3 }, 0);
    assert.equal(flat.text, "Define x\ny.");
    assert.equal(flat.modelAnswer, "y");
});

check("Revision Mode builds quiz questions through questionAsText, never the bare stem", () => {
    const src = strip(read("src/components/study/ExamMode.jsx"));
    assert.ok(/questionAsText\(\s*q\s*,\s*i\s*\)/.test(src), "Revision Mode does not use questionAsText");
    assert.ok(!/type:\s*"open",\s*question:\s*q\.question/.test(src), "an open quiz question is still its bare stem");
});

check("Revision Mode never hands a student's own earlier answer to the marker as the model answer", () => {
    const src = strip(read("src/components/study/ExamMode.jsx"));
    assert.ok(!/modelAnswer:\s*session\.answers/.test(src), "the student's own answer is the key again");
    assert.ok(/marked\[i\]\?\.model_answer/.test(src), "the marker's model answer is not read from ai_feedback");
});

console.log("\n── Generators clean, and lift parts, before anything is saved ──");

check("both quiz generators lift inline parts and clean before they format", () => {
    const src = strip(read("src/pages/Quizzes.jsx"));
    const lifts = src.match(/response\.questions\s*\.map\(\s*\(?q\)?\s*=>\s*liftInlineParts\(\s*cleanQuestion\(q\)\s*\)\s*\)/g) || [];
    assert.equal(lifts.length, 2, `expected both generators (main and reshuffle) to lift; found ${lifts.length}`);
});

check("Active Recall cleans the questions it generates", () => {
    const src = strip(read("src/components/study/ActiveRecall.jsx"));
    assert.ok(/response\.questions\.map\(\s*\(?q\)?\s*=>\s*cleanText\(\s*q\.question\s*\)\s*\)/.test(src),
        "Active Recall stores what the model wrote, unrepaired");
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
