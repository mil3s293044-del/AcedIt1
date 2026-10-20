/**
 * questionText — what a model wrote, made readable, once.
 *
 * ─── THE COMPLAINT ──────────────────────────────────────────────────────────
 * "These weird lines of symbols came up" — on a Chemistry question that read
 * `…$4.18\ \text{J g}^{-1}\ ^{\circ}\text{C}^{-1}$…(1 mark)\n(b) Calculate…`.
 * Two faults, and neither is the student's or the maths':
 *
 *   1. THE TWO CHARACTERS `\` `n` WHERE A LINE BREAK BELONGED. A model writing
 *      JSON is told to double every LaTeX backslash (`\\text`), and while it is
 *      doing that it doubles the newline escape too — so `\\n` parses to a
 *      backslash and an `n` rather than to a line break. Every part of the
 *      question then ran together with a literal "\n" between them.
 *   2. SURFACES THAT PRINT THE TEXT RAW. Active Recall, Exam Mode and the
 *      flashcard faces printed question strings straight into a `<p>`, so
 *      `$\text{kJ mol}^{-1}$` arrived as exactly that.
 *
 * This module is the first half: `cleanText` repairs the string, and it is run
 * by BOTH renderers (MarkdownMath and MathText) and by `normaliseQuestion`, so
 * no printer has to remember. The second half is every printer going through
 * one of those renderers, which `questionText.test.mjs` scans for.
 *
 * ─── THE OTHER DIRECTION OF THE SAME CONFUSION ──────────────────────────────
 * A model that does NOT double a backslash produces valid JSON that parses to
 * the wrong thing: `\text` is a TAB then "ext", `\frac` a form feed then "rac",
 * `\beta` a backspace then "eta", `\rho` a carriage return then "ho", `\nu` a
 * line break then "u". KaTeX then fails and prints the source in red. Inside a
 * maths span a control character followed by the rest of a REAL command name
 * is restored to the command — and only then: an exact match on the whole
 * letter run, because LaTeX command names are maximal letter runs, so a tab
 * before "ext{" is `\text` and a tab before "extra" is not.
 *
 * ─── WHAT IS NEVER TOUCHED ──────────────────────────────────────────────────
 * Code. A question on Algorithmics may genuinely be about the escape sequence
 * `\n`, and inside backticks it is shown as written. And a real command that
 * starts with n — `\neq`, `\nabla`, `\nu`, `\not` — stays a command: only a
 * `\n` whose letter run is NOT a command becomes a line break.
 *
 * Idempotent, which is what lets it run at every layer without counting: a
 * repaired string has no literal `\n` left to repair and no control character
 * left to restore. Asserted.
 */

const words = (s) => new Set(s.trim().split(/\s+/));

/** KaTeX commands that start with each letter a JSON escape can eat. */
const COMMANDS = {
    n: words(`nabla natural ncong ne nearrow neg negthinspace negmedspace negthickspace neq
        newline nexists ngeq ngeqq ngeqslant ngtr ni nLeftarrow nleftarrow nLeftrightarrow
        nleftrightarrow nleq nleqq nleqslant nless nmid nobreak nobreakspace nolimits nonumber
        normalfont normalsize not notag notin notni nparallel nprec npreceq nRightarrow
        nrightarrow nshortmid nshortparallel nsim nsubseteq nsubseteqq nsucc nsucceq nsupseteq
        nsupseteqq ntriangleleft ntrianglelefteq ntriangleright ntrianglerighteq nu nVDash
        nVdash nvDash nvdash nwarrow`),
    t: words(`tag tan tanh tau tbinom text textbf textit textmd textnormal textrm textsf
        textstyle texttt textup textdegree tfrac tg th therefore theta thetasym thickapprox
        thicksim thinspace tilde times tiny to top triangle triangledown triangleleft
        trianglelefteq triangleq triangleright trianglerighteq twoheadleftarrow
        twoheadrightarrow`),
    f: words(`forall frac flat frown footnotesize fbox fcolorbox`),
    b: words(`backepsilon backprime backsim backsimeq backslash bar barwedge bcancel because
        begin beta beth between bf bfseries big bigcap bigcirc bigcup bigg biggl biggm biggr
        bigl bigm bigodot bigoplus bigotimes bigr bigsqcup bigstar bigtriangledown
        bigtriangleup biguplus bigvee bigwedge binom blacklozenge blacksquare blacktriangle
        blacktriangledown blacktriangleleft blacktriangleright bm bmod boldsymbol bot bowtie
        boxdot boxed boxminus boxplus boxtimes breve bullet bumpeq`),
    v: words(`varDelta varepsilon varGamma varkappa varLambda varnothing varOmega varPhi
        varphi varPi varpi varpropto varPsi varrho varSigma varsigma varTheta vartheta
        vartriangle vcentcolon vdash vDash vdots vec vee veebar verb vert vphantom`),
    r: words(`rangle rbrace rbrack rceil restriction rfloor rgroup rho right rightarrow
        rightarrowtail rightharpoondown rightharpoonup rightleftarrows rightleftharpoons
        rightrightarrows rightsquigarrow rightthreetimes risingdotseq rlap rm rmoustache root
        rq rule rVert rvert`),
};

/** The letter a JSON escape turned into each control character. */
const EATEN = { "\n": "n", "\t": "t", "\f": "f", "\b": "b", "\v": "v", "\r": "r" };

/** Is `name` (no backslash) a command starting with `letter`? */
export const isCommand = (letter, name) => !!COMMANDS[letter]?.has(name);

/** Fenced or inline code, which is shown exactly as written. */
const CODE = /(```[\s\S]*?```|`[^`\n]*`)/g;
/** A maths span in any of the four delimiters the renderers read. */
const MATH = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$[^$]*?\$)/g;

/**
 * Cheap test for "nothing here could need repairing", which is most strings: no
 * backslash, no control character, and no line break that could sit inside a
 * maths span (where it may be an eaten `\nu`).
 */
const suspect = (t) => /[\\\t\f\b\v\r]/.test(t) || (t.includes("$") && t.includes("\n"));

/**
 * Inside maths: a control character followed by the rest of a real command.
 *
 * A LINE BREAK is only restored inside INLINE maths. Display maths is written
 * on its own lines — `$$` then a break then the equation — so a break followed
 * by "u = v_0 + at" there is the layout, and reading it as `\nu` would turn a
 * physics student's initial velocity into a Greek letter. Inline maths never
 * starts or continues on a new line, so a break inside it was an escape.
 */
function restoreEaten(math, display) {
    const eaten = display ? /([\t\f\b\v\r])([A-Za-z]+)/g : /([\n\t\f\b\v\r])([A-Za-z]+)/g;
    return math.replace(eaten, (whole, ch, run) => {
        const letter = EATEN[ch];
        return isCommand(letter, letter + run) ? `\\${letter}${run}` : whole;
    });
}

/**
 * The two characters `\` `n` → a line break, unless they start a real command.
 * A backslash that is itself escaped (`\\` is TeX's own line break) is left.
 */
function literalBreaks(s) {
    return s
        .replace(/(?<!\\)\\r\\n/g, "\n")
        .replace(/(?<!\\)\\(n[A-Za-z]*)/g, (whole, name) =>
            isCommand("n", name) ? whole : `\n${name.slice(1)}`);
}

/** Text outside maths: line breaks, and a quote the model escaped twice. */
const prose = (s) => literalBreaks(s).replace(/(?<!\\)\\"/g, '"');

function repairProse(segment) {
    const out = [];
    let last = 0;
    for (const m of segment.matchAll(MATH)) {
        if (m.index > last) out.push(prose(segment.slice(last, m.index)));
        const display = m[0].startsWith("$$") || m[0].startsWith("\\[");
        out.push(literalBreaks(restoreEaten(m[0], display)));
        last = m.index + m[0].length;
    }
    if (last < segment.length) out.push(prose(segment.slice(last)));
    return out.join("");
}

/**
 * A model-written string, readable. Anything that is not a string comes back
 * as "" so a printer can hand it whatever the row holds.
 */
export function cleanText(value) {
    if (value === null || value === undefined) return "";
    const text = String(value);
    if (!suspect(text)) return text;
    const out = [];
    let last = 0;
    for (const m of text.matchAll(CODE)) {
        if (m.index > last) out.push(repairProse(text.slice(last, m.index)));
        out.push(m[0]);
        last = m.index + m[0].length;
    }
    if (last < text.length) out.push(repairProse(text.slice(last)));
    return out.join("").replace(/\r\n?/g, "\n");
}

/**
 * Every text field on a generated or stored question, cleaned, shape kept.
 * Parts recurse; a stimulus may be a bare string or an object.
 */
export function cleanQuestion(q) {
    if (!q || typeof q !== "object") return q;
    const out = { ...q };
    for (const k of ["question", "stem", "prompt", "model_answer", "explanation"]) {
        if (typeof out[k] === "string") out[k] = cleanText(out[k]);
    }
    if (Array.isArray(out.options)) out.options = out.options.map((o) => (typeof o === "string" ? cleanText(o) : o));
    if (Array.isArray(out.parts)) out.parts = out.parts.map(cleanQuestion);
    if (typeof out.stimulus === "string") out.stimulus = cleanText(out.stimulus);
    else if (out.stimulus && typeof out.stimulus === "object" && typeof out.stimulus.content === "string") {
        out.stimulus = { ...out.stimulus, content: cleanText(out.stimulus.content) };
    }
    return out;
}

// ─── Parts written into the stem ────────────────────────────────────────────
//
// The generator is told to put parts in the `parts` array, and sometimes writes
// them into the question as prose instead — "(a) Write… (1 mark)\n(b)…". A
// five-part, twelve-mark question then becomes ONE short answer worth whatever
// the default is, with one answer box for all five parts and one mark against
// all of it. At GENERATION time, before anything is saved, such a question is
// lifted into real parts.
//
// Never at read time: every attempt ever saved keys a single-part question's
// answer by its bare index, and splitting a stored question would read every
// one of those attempts back as unanswered. Old questions get the line breaks
// (which the renderers now draw) and keep their shape.
//
// It REFUSES rather than guesses, the rule `criterionIndexFor` keeps. Lifted
// only when every part carries its own allocation — "(2 marks)" or "[2 marks]"
// at its end — because that is what makes it a paper's part rather than a
// sentence that happens to contain "(b)". A model answer must split into the
// same labels or be empty; parts with nobody's answer under them are worse than
// one question with the whole answer.

const ALLOC = /[([]\s*(\d{1,2})\s*marks?\s*[)\]]\s*[.:]?\s*$/i;

/**
 * The labels (a), (b), (c)… in order, each preceded by the start, a line break
 * or white space and followed by white space. A label out of sequence ends the
 * run, which is what stops a state symbol like "(g)" in a chemistry answer
 * being read as part g.
 */
function labelRun(text) {
    const found = [];
    let from = 0;
    for (let i = 0; i < 26; i++) {
        const label = String.fromCharCode(97 + i);
        const re = new RegExp(`(^|\\s)\\(${label}\\)(?=\\s)`, "g");
        re.lastIndex = from;
        const m = re.exec(text);
        if (!m) break;
        const start = m.index + m[1].length;
        found.push({ label, start, end: start + label.length + 2 });
        from = start + label.length + 2;
    }
    return found;
}

const bodies = (text, run) => run.map((m, i) =>
    text.slice(m.end, i + 1 < run.length ? run[i + 1].start : text.length).trim());

/**
 * A question whose parts were written into its text, as a stem and parts —
 * or null when that cannot be said for certain.
 */
export function splitInlineParts(text, modelAnswer = "") {
    const t = cleanText(text);
    const run = labelRun(t);
    if (run.length < 2) return null;
    const stem = t.slice(0, run[0].start).trim();
    if (!stem) return null;

    const parts = [];
    for (const [i, body] of bodies(t, run).entries()) {
        const alloc = body.match(ALLOC);
        if (!alloc) return null;
        const prompt = body.slice(0, alloc.index).trim();
        const marks = Number(alloc[1]);
        if (!prompt || !(marks >= 1)) return null;
        parts.push({ label: run[i].label, prompt, marks, model_answer: "" });
    }

    const answer = cleanText(modelAnswer).trim();
    if (answer) {
        const aRun = labelRun(answer);
        if (aRun.length !== parts.length) return null;
        bodies(answer, aRun).forEach((body, i) => { parts[i].model_answer = body; });
    }
    return { stem, parts };
}

/**
 * A generated question, with parts written into its text lifted into real
 * ones. Anything else — a question that already has parts, a multiple-choice
 * question, a question that does not split cleanly — comes back unchanged.
 */
export function liftInlineParts(q) {
    if (!q || typeof q !== "object") return q;
    if (Array.isArray(q.parts) && q.parts.length > 0) return q;
    if (q.type === "mcq" || (Array.isArray(q.options) && q.options.length >= 2)) return q;
    const split = splitInlineParts(q.question || "", q.model_answer || "");
    if (!split) return q;
    const { model_answer: _answer, marks: _marks, ...rest } = q;
    return {
        ...rest,
        type: "multipart",
        question: split.stem,
        parts: split.parts.map((p) => ({ ...p, type: "short" })),
    };
}
