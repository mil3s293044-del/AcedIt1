/**
 * examinerReports — worked marking examples, and the shape real VCAA report
 * data drops into.
 *
 * ─── WHY EXAMPLES AND NOT MORE INSTRUCTIONS ─────────────────────────────────
 * The marking prompt already TELLS the model to write like a VCAA examiner's
 * report, at length and accurately. Instructions describe a standard; they do
 * not SET one. Where the line sits between 2 and 3 marks on a three-mark
 * "explain" is a calibration, and a calibration is transferred by showing a
 * marked response, not by adding an adjective. That is the whole of this file.
 *
 * Each exemplar is a complete worked mark in EXACTLY the shape the marker has
 * to return — a question, a realistic mid-range answer, the itemised criteria
 * with their verdicts and worths, and the note on each dropped one. It is the
 * output schema demonstrated rather than described.
 *
 * ─── `source` IS PART OF THE DATA, AND IT IS NOT DECORATION ─────────────────
 * "A VCAA assessor awarded this 1 of 3" and "these are the conventions VCAA
 * publishes, applied to a written answer" are different claims, and a model
 * told the second is the first has been miscalibrated on purpose. So every
 * exemplar declares which it is and the prompt PRINTS it:
 *
 *   "study-design"    — written here from the mark conventions, command terms
 *                       and key terminology in `subjectExaminerPrompts.js`.
 *                       Accurate about what a full-mark response contains; not
 *                       a quotation of any published report.
 *   "examiner-report" — taken from a real VCAA examiner's report. `cite` names
 *                       it. Nothing in this repo carries this yet.
 *
 * ─── DISTRIBUTIONS SHIP EMPTY, DELIBERATELY ─────────────────────────────────
 * VCAA publishes, per question, the percentage of the state scoring 0/1/2/3.
 * It is the most examiner-like datum in the document and the app has never had
 * it. What is here is the CARRIER — the shape, the reader, the prompt line, the
 * renderer's absent case — and no figures, because there is no honest way to
 * produce "31% of students earned this mark" from anything in this repo. An
 * invented percentage presented as VCAA's is the same failure `closingFacts`
 * refuses on the first-run screen, one screen further in and harder to catch.
 *
 * Paste real figures into `DISTRIBUTIONS` and every reader below starts using
 * them. Until then `distributionNote` returns null and the prompt omits the
 * section entirely rather than printing a heading over nothing.
 */

/**
 * Worked marks, keyed by subject exactly as `vceSubjects` names it — the same
 * key `subjectExaminerPrompts` uses, so a subject cannot have a profile under
 * one spelling and an exemplar under another.
 *
 * TWO per subject at most. A third costs another ~700 cached tokens and adds
 * almost nothing: what these teach is the register and where the mark line
 * sits, and one full-mark case against one part-mark case already shows both.
 */
export const EXEMPLARS = {
    "Chemistry": [
        {
            source: "study-design",
            commandTerm: "Explain",
            question:
                "Explain why the boiling point of water is significantly higher than that of hydrogen sulfide, "
                + "despite both molecules having similar molar masses.",
            outOf: 3,
            answer:
                "Water has hydrogen bonding between its molecules which is stronger than the bonding in "
                + "hydrogen sulfide, so it takes more energy to boil it.",
            awarded: 1,
            criteria: [
                {
                    text: "Identifies hydrogen bonding as the intermolecular force between water molecules",
                    got: true,
                    worth: 1,
                    note: "",
                },
                {
                    text: "Explains that hydrogen bonding arises from the large electronegativity difference between O and H, and the lone pair on oxygen",
                    got: false,
                    worth: 1,
                    note:
                        "A full-mark response states WHY water hydrogen bonds and hydrogen sulfide does not: "
                        + "oxygen is sufficiently electronegative to produce the required charge separation, "
                        + "sulfur is not. Naming the force without accounting for it does not address the "
                        + "command term.",
                },
                {
                    text: "Relates the stronger intermolecular forces to the greater energy required to separate molecules, and hence the higher boiling point",
                    got: false,
                    worth: 1,
                    note:
                        "The response asserts more energy is needed without linking it to separating molecules "
                        + "against the intermolecular force. \"Stronger bonding\" is also imprecise here — the "
                        + "intramolecular bonds are not broken on boiling.",
                },
            ],
        },
        {
            source: "study-design",
            commandTerm: "Calculate",
            question:
                "Calculate the concentration, in mol L$^{-1}$, of a solution prepared by dissolving 4.25 g of "
                + "sodium carbonate, Na$_2$CO$_3$, in water and making the volume up to 250.0 mL.",
            outOf: 3,
            answer:
                "M(Na$_2$CO$_3$) = 106.0 g mol$^{-1}$. n = 4.25 / 106.0 = 0.0401 mol. "
                + "c = 0.0401 / 0.2500 = 0.160 mol L$^{-1}$.",
            awarded: 3,
            criteria: [
                { text: "Correct molar mass of Na$_2$CO$_3$ (106.0 g mol$^{-1}$)", got: true, worth: 1, note: "" },
                { text: "Correct amount of substance, n = m/M", got: true, worth: 1, note: "" },
                {
                    text: "Correct concentration with volume converted to litres, answer to three significant figures with units",
                    got: true,
                    worth: 1,
                    note: "",
                },
            ],
        },
    ],

    "Biology": [
        {
            source: "study-design",
            commandTerm: "Describe",
            question:
                "Describe the role of the plasma membrane in maintaining a stable internal environment within a cell.",
            outOf: 2,
            answer:
                "The plasma membrane controls what goes in and out of the cell, which keeps the inside of "
                + "the cell stable.",
            awarded: 1,
            criteria: [
                {
                    text: "Identifies the plasma membrane as selectively (differentially) permeable",
                    got: true,
                    worth: 1,
                    note: "",
                },
                {
                    text: "Describes a mechanism by which it regulates movement — simple diffusion, facilitated diffusion through channel or carrier proteins, osmosis, or active transport against a gradient",
                    got: false,
                    worth: 1,
                    note:
                        "\"Controls what goes in and out\" restates selective permeability rather than adding "
                        + "the second mark. A response scoring both names at least one transport mechanism and "
                        + "the structure carrying it out.",
                },
            ],
        },
    ],

    "English": [
        {
            source: "study-design",
            commandTerm: "Analyse",
            question:
                "Analyse how the writer uses language to position the reader to accept their contention "
                + "in the opening two paragraphs.",
            outOf: 4,
            answer:
                "The writer uses emotive language like \"devastating\" and \"betrayed\" to make the reader feel "
                + "sad and angry. They also use statistics which makes them sound credible. This positions "
                + "the reader to agree with them.",
            awarded: 2,
            criteria: [
                {
                    text: "Identifies specific language choices with accurate textual evidence",
                    got: true,
                    worth: 1,
                    note: "",
                },
                {
                    text: "Names the persuasive technique using metalanguage appropriate to the study design",
                    got: true,
                    worth: 1,
                    note: "",
                },
                {
                    text: "Analyses the intended effect on the reader's POSITION rather than their feelings — what the reader is led to accept, concede or dismiss",
                    got: false,
                    worth: 1,
                    note:
                        "The response reports an emotional reaction (\"sad and angry\") where the command term "
                        + "asks how the reader is positioned. A response scoring this mark states what the "
                        + "emotion is mobilised TO DO — here, to read the policy as a breach of trust rather "
                        + "than a budgetary decision.",
                },
                {
                    text: "Connects the individual choices to the sustained development of the contention across the passage",
                    got: false,
                    worth: 1,
                    note:
                        "The two techniques are treated as a list. The mark is for how the second builds on "
                        + "the first — the appeal to credibility arriving after the emotional appeal so the "
                        + "reader reads the statistics as confirmation of a judgement already formed.",
                },
            ],
        },
    ],

    "Mathematical Methods": [
        {
            source: "study-design",
            commandTerm: "Find",
            question:
                "Find the exact value of the area enclosed between the curve $y = x^2 - 4$ and the $x$-axis.",
            outOf: 3,
            answer:
                "$\\int_{-2}^{2} (x^2 - 4)\\,dx = [\\frac{x^3}{3} - 4x]_{-2}^{2} = (\\frac{8}{3} - 8) - "
                + "(-\\frac{8}{3} + 8) = -\\frac{32}{3}$. So the area is $-10.67$.",
            awarded: 2,
            criteria: [
                { text: "Correct terminals, found from the $x$-intercepts of the curve", got: true, worth: 1, note: "" },
                { text: "Correct antidifferentiation and substitution", got: true, worth: 1, note: "" },
                {
                    text: "States the AREA as a positive exact value, $\\frac{32}{3}$",
                    got: false,
                    worth: 1,
                    note:
                        "The definite integral is negative because the curve lies below the axis over this "
                        + "interval; an area is not. A full-mark response takes the magnitude, and states the "
                        + "exact value — the question said EXACT, so the decimal cannot earn this mark.",
                },
            ],
        },
    ],

    "Psychology": [
        {
            source: "study-design",
            commandTerm: "Evaluate",
            question:
                "Evaluate the use of a self-report questionnaire to measure sleep quality in adolescents.",
            outOf: 4,
            answer:
                "Self-report questionnaires are good because they are cheap and you can collect data from "
                + "lots of people quickly. A limitation is that participants might not tell the truth. "
                + "Overall they are a useful tool for measuring sleep quality.",
            awarded: 2,
            criteria: [
                { text: "Identifies a relevant strength of self-report in this context", got: true, worth: 1, note: "" },
                {
                    text: "Identifies a relevant limitation using the correct terminology — social desirability bias, or the unreliability of retrospective self-assessment",
                    got: true,
                    worth: 1,
                    note: "",
                },
                {
                    text: "Applies the evaluation to the SPECIFIC construct and population — sleep quality in adolescents — rather than to self-report in general",
                    got: false,
                    worth: 1,
                    note:
                        "Nothing in the response is about sleep or about adolescents. The mark is for the "
                        + "point that a sleeping participant cannot observe their own sleep, so the measure "
                        + "captures perceived rather than actual quality.",
                },
                {
                    text: "Reaches a judgement that follows from the evidence weighed, rather than asserting a conclusion",
                    got: false,
                    worth: 1,
                    note:
                        "\"Overall they are a useful tool\" restates the first sentence. EVALUATE requires the "
                        + "judgement to rest on the weighing — for instance, that self-report is defensible for "
                        + "perceived quality and insufficient on its own for physiological measures.",
                },
            ],
        },
    ],
};

/**
 * Per-question mark distributions from published examiner reports.
 *
 * SHIPS EMPTY. See the header: the carrier exists, the data does not, and a
 * fabricated percentage attributed to VCAA is worse than no percentage.
 *
 * Shape, when you paste real figures in — keyed by subject, then by a stable
 * label for the question it describes:
 *
 *   "Chemistry": {
 *       "2023 Exam Q4b": {
 *           cite: "VCAA 2023 Chemistry Examination Report",
 *           outOf: 3,
 *           // Percentage of the state at each mark. Index IS the mark, so the
 *           // array is always outOf + 1 long and should sum to about 100.
 *           spread: [41, 28, 19, 12],
 *           average: 1.0,
 *       },
 *   }
 */
export const DISTRIBUTIONS = {};

/** Exemplars for a subject, or an empty array. Never throws on an unknown one. */
export function exemplarsFor(subject) {
    const rows = EXEMPLARS[String(subject || "").trim()];
    return Array.isArray(rows) ? rows : [];
}

/**
 * One exemplar rendered as the marker's own output.
 *
 * The criteria are printed with their verdicts and worths BECAUSE that is the
 * schema the marker has to fill — an example in the answer's own format teaches
 * the format and the standard in one pass, where a prose description of either
 * teaches neither reliably.
 */
function renderExemplar(ex, i) {
    const provenance = ex.source === "examiner-report"
        ? `real examiner's report${ex.cite ? ` — ${ex.cite}` : ""}`
        : "VCAA mark conventions applied to a written response, not a quoted report";
    const lines = [
        `WORKED MARK ${i + 1} (${provenance})`,
        `Command term: ${ex.commandTerm}`,
        `Question [${ex.outOf} marks]: ${ex.question}`,
        `Student response: ${ex.answer}`,
        `Awarded: ${ex.awarded}/${ex.outOf}`,
        `Criteria:`,
        ...(ex.criteria || []).map((c) =>
            `  - [${c.got ? "got" : "missed"}, ${c.worth} mark${c.worth === 1 ? "" : "s"}] ${c.text}`
            + (c.got ? "" : `\n      note: ${c.note}`)),
    ];
    return lines.join("\n");
}

/**
 * The worked-marks section, or null when the subject has none.
 *
 * NULL rather than a placeholder, for the reason every branch in `previewFor`
 * and `subjectLead` returns null: a heading reading "WORKED MARKS" over nothing
 * spends cached tokens telling the model there are examples it cannot see.
 */
export function exemplarSection(subject) {
    const rows = exemplarsFor(subject);
    if (!rows.length) return null;
    return [
        "WORKED MARKS FOR THIS SUBJECT — match this standard and this register.",
        "These show where the mark line sits and how a dropped criterion is written up.",
        "Each one states what it is derived from; weight a quoted report above a",
        "convention-derived example where they could ever disagree.",
        "",
        rows.map(renderExemplar).join("\n\n"),
    ].join("\n");
}

/**
 * What the state scored on a comparable question, or null.
 *
 * Returns null while `DISTRIBUTIONS` is empty, which is every call today. It is
 * wired through the prompt composer now so that pasting figures in is the whole
 * change rather than the start of one.
 */
export function distributionNote(subject) {
    const rows = DISTRIBUTIONS[String(subject || "").trim()];
    const keys = rows ? Object.keys(rows) : [];
    if (!keys.length) return null;

    const lines = keys.map((label) => {
        const d = rows[label];
        const spread = Array.isArray(d?.spread) ? d.spread : [];
        if (!spread.length) return null;
        const at = spread.map((pct, mark) => `${mark}: ${pct}%`).join(", ");
        const avg = Number.isFinite(d?.average) ? ` (state average ${d.average}/${d.outOf})` : "";
        return `  - ${label}${d?.cite ? ` [${d.cite}]` : ""} — ${at}${avg}`;
    }).filter(Boolean);
    if (!lines.length) return null;

    return [
        "HOW THE STATE SCORED ON COMPARABLE QUESTIONS.",
        "These are published percentages of candidates at each mark. Use them to",
        "judge which marks genuinely discriminate: a mark most of the state dropped",
        "is not one to award for a partial answer.",
        ...lines,
    ].join("\n");
}

export default { EXEMPLARS, DISTRIBUTIONS, exemplarsFor, exemplarSection, distributionNote };
