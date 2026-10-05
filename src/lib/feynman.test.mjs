/**
 * feynman assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/feynman.test.mjs
 *
 * ═══ WHAT RENDERS PERFECTLY AND IS SIMPLY WRONG ═════════════════════════════
 * The loop that never terminates, the free half claiming what only the model
 * knows, a reading level computed off two sentences, and a pass priced on the
 * expensive model because nothing pinned it. None of these throw.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
    AUDIENCES, audienceOf, GAP_KINDS, GAP_LIST, isGapKind, kindOf,
    normaliseGap, readGaps, applyRecheck, openGaps, progressOf,
    jargonUsed, readingLevel, readyToCheck,
    GAPS_MAX, WORK_MIN_WORDS, FEYNMAN_FEATURE, RECHECK_FEATURE,
} from "@/lib/feynman";
import { feynmanSystem, explainPrompt, recheckPrompt, GAPS_SCHEMA, RECHECK_SCHEMA } from "@/lib/feynmanPrompt";
import { PRICE, ALREADY_CHEAP } from "@/lib/chips";
import { ALWAYS_CHEAP, modelFor, TIERS } from "@/lib/aiModels";
import { keyTermsFor } from "@/lib/subjectExaminerPrompts";

let n = 0;
const ok = (name, fn) => { fn(); n += 1; console.log("  ok ", name); };
const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
/* Comments stripped before every scan — a comment naming the thing it refuses
   is not the thing, the false positive three other test files had to learn. */
const stripped = (rel) => read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/* ── The audience is a real input ────────────────────────────────────────── */

ok("exactly one audience is the default, and an unknown id falls back to it", () => {
    const defaults = AUDIENCES.filter((a) => a.default);
    assert.equal(defaults.length, 1, "two defaults is a coin toss over which bar they are judged against");
    assert.equal(audienceOf("nope").id, defaults[0].id);
    assert.equal(audienceOf(null).id, defaults[0].id);
    assert.equal(audienceOf("kid").id, "kid");
    // The bar has to actually differ, or the control is decoration.
    const years = new Set(AUDIENCES.map((a) => a.targetYear));
    assert.equal(years.size, AUDIENCES.length);
});

/* ── A gap is a QUESTION ─────────────────────────────────────────────────── */

ok("THE QUESTION IS REQUIRED AND THE QUOTE IS NOT", () => {
    // The opposite of `normaliseAnnotation`, and deliberate: "never says why it
    // is spontaneous" is unquotable precisely in that the words are absent, and
    // that is the strongest kind of gap there is.
    assert.equal(normaliseGap({ quote: "something" }), null, "a gap with no question is not a gap");
    const g = normaliseGap({ ask: "Why does that follow?", kind: "leap" }, 2);
    assert.equal(g.quote, "");
    assert.equal(g.id, "g2");
    assert.equal(g.kind, "leap");
    assert.equal(g.closed, false);
    // An unknown kind is not a crash and not a silent drop.
    assert.equal(normaliseGap({ ask: "x", kind: "banana" }).kind, "hollow");
    assert.ok(isGapKind("jargon") && !isGapKind("banana"));
    assert.equal(kindOf("banana").id, "hollow");
});

ok("EVERY KIND HAS A SHAPE, because colour alone cannot carry it", () => {
    // The floor's step-dot rule: the brand green and the streak red sit at
    // ΔE 7.0 under deuteranopia, so a bare hue is not a second channel.
    const shapes = new Set(GAP_LIST.map((k) => k.shape));
    assert.equal(shapes.size, GAP_LIST.length, "two kinds share a shape");
    for (const k of GAP_LIST) {
        assert.ok(k.shape && k.tone && k.label && k.blurb, `${k.id} is missing a field`);
    }
});

ok("an invented QUOTE loses its underline and KEEPS its question", () => {
    // `annotate.js` drops an unplaceable annotation, and that reasoning covers
    // the UNDERLINE — the question is what the pass was paid for, so losing it
    // over a bad quote throws away the finding.
    const work = "Entropy increases because the particles spread out.";
    const { gaps, unplaced } = readGaps({
        gaps: [
            { ask: "What does spread out mean here?", quote: "the particles spread out" },
            { ask: "Why does that increase entropy?", quote: "a phrase the student never wrote" },
        ],
    }, { work });
    assert.equal(gaps.length, 2, "the second gap was dropped with its question");
    assert.equal(gaps[0].quote, "the particles spread out");
    assert.equal(gaps[1].quote, "");
    assert.equal(unplaced, 1);
});

ok("a pass is CAPPED and deduplicated", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ ask: `Question ${i}?` }));
    assert.equal(readGaps({ gaps: many }, { work: "" }).gaps.length, GAPS_MAX);
    const dupes = [{ ask: "Why?" }, { ask: "why?  " }, { ask: "Because?" }];
    assert.equal(readGaps({ gaps: dupes }, { work: "" }).gaps.length, 2);
});

ok("AN EMPTY PASS IS A REAL ANSWER", () => {
    // The property the whole design rests on. A pass that always finds five is
    // a horoscope: the first good explanation told it is broken costs every
    // later finding its credibility too.
    assert.deepEqual(readGaps({ gaps: [] }, { work: "x" }).gaps, []);
    assert.deepEqual(readGaps({}, { work: "x" }).gaps, []);
    assert.deepEqual(readGaps(null, { work: "x" }).gaps, []);
    const src = stripped("src/lib/feynmanPrompt.js");
    assert.ok(/empty list/i.test(src), "the prompt no longer tells the model it may find nothing");
});

/* ── The loop terminates ─────────────────────────────────────────────────── */

ok("A RECHECK MAY ONLY CLOSE, NEVER RAISE", () => {
    // `applyRescan`'s rule. Left to append, each pass finds new or reshaped
    // gaps and the student who worked for an hour sees a readout as red as when
    // they began — the all-clear is never reachable.
    const gaps = [
        { id: "g0", ask: "a", closed: false },
        { id: "g1", ask: "b", closed: false },
        { id: "g2", ask: "c", closed: true },
    ];
    const after = applyRecheck(gaps, ["g1", "g9"]);
    assert.equal(after.length, 3, "the recheck added a finding");
    assert.equal(after[0].closed, true, "g0 was not listed as open, so it closed");
    assert.equal(after[1].closed, false);
    assert.equal(after[2].closed, true, "an already-closed gap must never reopen");
    // And the prompt says so, or reporting a new one costs the model nothing.
    const src = stripped("src/lib/feynmanPrompt.js");
    assert.ok(/may not raise anything new/i.test(src));
});

ok("progress never divides by zero", () => {
    assert.deepEqual(progressOf([]), { total: 0, closed: 0, open: 0, pct: 0 });
    assert.equal(progressOf([{ closed: true }, { closed: false }]).pct, 50);
    assert.equal(openGaps([{ closed: true }, { closed: false }]).length, 1);
    assert.equal(openGaps(null).length, 0);
});

/* ── The free half, and what it may not claim ────────────────────────────── */

ok("jargon is matched on a WORD BOUNDARY and never overlaps itself", () => {
    const terms = ["normal distribution", "normal", "distribution", "domain"];
    const used = jargonUsed("The normal distribution has a domain of all reals.", terms);
    assert.deepEqual(used, ["normal distribution", "domain"],
        "the longer term must claim the span, or one phrase reports as three");
    // "domain" must not match inside "domains of" — it does, legitimately, as a
    // word; but it must NOT match inside "predominant".
    assert.deepEqual(jargonUsed("a predominant factor", ["domain"]), []);
    assert.deepEqual(jargonUsed("", terms), []);
    assert.deepEqual(jargonUsed("x", []), []);
});

ok("the subject's own terms are REAL and come from the profile", () => {
    const methods = keyTermsFor("Mathematical Methods");
    assert.ok(methods.length > 5, "Methods has no key terms, so the ribbon draws nothing");
    assert.ok(methods.includes("stationary point"));
    assert.deepEqual(keyTermsFor("Not A Subject"), [],
        "an unprofiled subject must draw no ribbon rather than a wrong one");
    // A copy, or a caller could mutate the catalogue.
    const a = keyTermsFor("Mathematical Methods");
    a.push("x");
    assert.ok(!keyTermsFor("Mathematical Methods").includes("x"));
});

ok("THE RIBBON STATES A FACT AND MAKES NO VERDICT", () => {
    // The tempting version turns a term green for looking "explained nearby" —
    // a window heuristic over definitional cues, wrong constantly, and wrong in
    // the direction that tells a student their hand-wave was fine.
    const src = stripped("src/lib/feynman.js");
    assert.ok(!/explained|defines|definition/i.test(src.split("export function jargonUsed")[1].split("export")[0]),
        "jargonUsed is trying to decide whether a term was explained");
    const board = stripped("src/components/study/FeynmanBoard.jsx");
    assert.ok(!/unexplained|undefined term|you did not explain/i.test(board),
        "the board is claiming a term is unexplained, which only a pass can know");
});

ok("READING LEVEL REFUSES rather than printing noise", () => {
    assert.equal(readingLevel("Too short."), null, "a grade off two sentences is noise");
    assert.equal(readingLevel(""), null);
    const prose = "The rate of reaction increases when the temperature rises. "
        + "This happens because the particles have more kinetic energy on average. "
        + "A greater proportion of collisions therefore exceeds the activation energy. "
        + "The activation energy itself does not change at all when you heat the mixture.";
    const lvl = readingLevel(prose);
    assert.ok(lvl && lvl.year >= 3 && lvl.year <= 12, "the year must be clamped to something real");
    assert.ok(lvl.words > WORK_MIN_WORDS);
    // Mostly symbols is not prose, and a reading level on LaTeX is invented.
    const maths = "$$\\int_0^1 x^2\\,dx = \\tfrac{1}{3}$$ ".repeat(14);
    assert.equal(readingLevel(maths), null, "a reading level was computed for notation");
});

ok("the button says HOW MANY MORE WORDS rather than just refusing", () => {
    const short = readyToCheck("three words only");
    assert.equal(short.ok, false);
    assert.equal(short.need, WORK_MIN_WORDS - 3);
    assert.equal(readyToCheck("word ".repeat(WORK_MIN_WORDS)).ok, true);
});

/* ── The cost design ─────────────────────────────────────────────────────── */

ok("THE RECHECK IS PINNED TO THE CHEAP MODEL FOR EVERYBODY", () => {
    // Judgement runs on the student's own model; classification runs cheap.
    // Deciding whether an already-identified question is now answered is the
    // second, and the first pass has been made and paid for.
    assert.ok(ALWAYS_CHEAP.includes(RECHECK_FEATURE));
    assert.ok(!ALWAYS_CHEAP.includes(FEYNMAN_FEATURE),
        "the pass that raises the questions must run on the student's own model");
    const cheap = TIERS.saver.model;
    assert.equal(modelFor("standard", RECHECK_FEATURE, { standardModel: "big" }), cheap,
        "a Standard student pays Sonnet rates to be told which questions they answered");
    assert.equal(modelFor("standard", FEYNMAN_FEATURE, { standardModel: "big" }), "big");
    // Vision still outranks it — a downgraded transcript gets MARKED.
    assert.equal(
        modelFor("standard", RECHECK_FEATURE, { standardModel: "big", visionModel: "eyes", vision: true }),
        "eyes");
});

ok("both passes are PRICED, and the cheap one is priced as cheap", () => {
    assert.ok(PRICE[FEYNMAN_FEATURE] > 0, "the pass has no price, so nothing can be charged for it");
    assert.ok(PRICE[RECHECK_FEATURE] > 0);
    assert.ok(PRICE[RECHECK_FEATURE] < PRICE[FEYNMAN_FEATURE],
        "a recheck costs as much as a full pass, which discourages the one behaviour the technique is");
    assert.ok(ALREADY_CHEAP.has(RECHECK_FEATURE),
        "the recheck is not flagged cheap, so the tier screen offers to downgrade a Haiku call");
    // The whole loop has to stay a small fraction of a week, or the technique
    // is unaffordable and nobody completes it.
    const loop = PRICE[FEYNMAN_FEATURE] + PRICE[RECHECK_FEATURE] * 2;
    assert.ok(loop <= 20, `explain + two rewrites is ${loop} chips, which is too much of a 1000 week`);
});

ok("THE SYSTEM BLOCK IS SHARED WITH THE MARKER, which is what makes it cache", () => {
    const src = stripped("src/lib/feynmanPrompt.js");
    assert.ok(/markingSystem\(subject\)/.test(src),
        "a second preamble was composed, so every pass pays full rate for a block the marker already warmed");
    const sys = feynmanSystem("Chemistry");
    assert.ok(sys.length > 500, "the system block is suspiciously short — the profile is not reaching it");
    assert.ok(/NOT MARKING/i.test(sys), "the rubric is not in the system block");
});

ok("the audience and the explanation ride in the USER message, not the block", () => {
    // Everything that changes between calls has to be outside the cached prefix
    // or the prefix is not a prefix.
    const a = feynmanSystem("Chemistry");
    const b = feynmanSystem("Chemistry");
    assert.equal(a, b, "the system block is not stable for one subject");
    const p1 = explainPrompt("my words", { subject: "Chemistry", audience: "kid" });
    const p2 = explainPrompt("my words", { subject: "Chemistry", audience: "examiner" });
    assert.notEqual(p1, p2, "the audience changes nothing, so the control is decoration");
    assert.ok(p1.includes("my words"));
});

ok("the schemas name what the readers actually read", () => {
    assert.ok(GAPS_SCHEMA.properties.gaps, "readGaps looks for `gaps`");
    const item = GAPS_SCHEMA.properties.gaps.items;
    assert.deepEqual(item.required, ["kind", "ask"]);
    assert.deepEqual(item.properties.kind.enum.sort(), GAP_LIST.map((k) => k.id).sort(),
        "the schema offers a kind the reader does not know, or hides one it does");
    assert.ok(RECHECK_SCHEMA.properties.still_open, "the recheck reader looks for `still_open`");
    assert.ok(recheckPrompt("x", [{ id: "g0", ask: "why?" }]).includes("[g0]"),
        "the ids are not in the prompt, so the model cannot name one back");
});

/* ── Wired, or it earns nothing ──────────────────────────────────────────── */

ok("THE TECHNIQUE IS WIRED END TO END", () => {
    const study = stripped("src/pages/Study.jsx");
    assert.match(study, /id: "feynman"/, "it is not on the technique grid");
    assert.match(study, /<Feynman[\s\S]{0,300}onSessionComplete=\{handleSessionComplete\}/,
        "no session is logged, so the minutes are missing from the dashboard and the ATAR");
    assert.match(study, /feynman: 'feynman'/, "it has no XP source of its own, so no breadth family");
    const server = read("server.mjs");
    assert.match(server, /case "feynman":/,
        "awardXP rejects the source with a 400 and the catch swallows it — the student earns nothing");
    assert.ok(/berry:\s*\{/.test(study), "the accent theme has no berry entry, so the tiles render unstyled");
});

ok("THE SLIPPING CARD OPENS THE TECHNIQUE, not a chat window", () => {
    // It made the right argument and dead-ended: the app's own best reasoning
    // about fading material handed the student a text box.
    const brief = stripped("src/lib/toolBrief.js");
    assert.match(brief, /to: \{ page: "Study", query: \{ tab: "feynman"/,
        "the slipping card still opens a chat");
    // AND THE QUERY IT EMITS IS READ BY THE PAGE IT POINTS AT — rankedMove's
    // rule. A link that lands on the right page while the thing it promised to
    // open does not is the half-wired shape this app keeps meeting.
    const study = stripped("src/pages/Study.jsx");
    assert.match(study, /params\.get\("subject"\)/, "Study never reads the subject the link names");
    assert.match(study, /initialSubject=\{deepSubject\}/, "the subject is read and then thrown away");
    const comp = stripped("src/components/study/Feynman.jsx");
    assert.match(comp, /useState\(initialSubject \|\| ""\)/, "Feynman ignores the subject it was handed");
    // The card is a LINK now, not a button that opens the composer.
    const card = stripped("src/components/ai_tools/ToolBrief.jsx");
    assert.match(card, /card\.to \?/, "a card carrying `to` is still rendered as a chat button");
});

console.log(`\nfeynman: ${n} checks passed`);
