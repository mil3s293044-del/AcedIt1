/**
 * chatTools — persona registry behind the unified AI chat. Each tool carries:
 * - a system prompt with a DISTINCT format signature (so outputs feel like
 *   different tools, not one bot in eight hats)
 * - per-tool option chip groups (the old sub-categories: English sections,
 *   maths strands, difficulty, essay types…) baked into the prompt
 * - its original tier feature tag — caps unchanged.
 */
import {
    Calculator, PenTool, FileQuestion, GraduationCap, Lightbulb,
    FileText, Drama, Sparkles
} from "lucide-react";
import { getExaminerPrompt, getLatexRules } from "@/lib/subjectExaminerPrompts";

const COACH_TONE = `TONE: You are part of AcedIt, a study app for VCE students. Chill, encouraging coach — warm, specific, never condescending. Markdown formatting.`;

const subjectBlock = (subjectName) =>
    subjectName ? getExaminerPrompt(subjectName) : `${getLatexRules()}\n\nYou are a VCE (Victorian Certificate of Education) expert. Apply VCAA command terms and marking conventions.`;

// ── English Mentor's sections + focus tasks (carried over from the old tool) ─
const ENGLISH_SECTIONS = {
    section_a: {
        label: "Section A: Text Response",
        guidance: "Section A (Reading & Responding): authorial intent, TEEL/PETAL structure, sophisticated metalanguage, never plot summary.",
        tasks: {
            general: "",
            contention: "FOCUS: Contention crafting — analyse the student's contention. Is it nuanced? Does it avoid simple agree/disagree? Suggest improvements with sophisticated language.",
            quotes: "FOCUS: Quote analysis & evidence — evaluate quote selection and analysis. Do they explain authorial intent? Use metalanguage (symbolism, syntax, juxtaposition)? Model A+ level analysis.",
            paragraph: "FOCUS: TEEL/PETAL paragraph feedback — Topic sentence (idea-focused), Evidence, Explanation (authorial intent), Link.",
            views_values: "FOCUS: Author's views & values — how are they conveyed through characterisation, symbolism, narrative choices?",
        },
        taskLabels: { general: "General", contention: "Contention", quotes: "Quote analysis", paragraph: "TEEL paragraph", views_values: "Views & values" },
    },
    section_b: {
        label: "Section B: Creating Texts",
        guidance: "Section B (Creating Texts): the Four Frameworks (Country, Protest, Personal Journeys, Play), Reflective Commentary, 2026 mentor texts.",
        tasks: {
            general: "",
            framework: "FOCUS: Framework of Ideas — deepen thematic exploration within the chosen Framework.",
            creative: "FOCUS: Creative piece feedback — thematic depth, literary devices, Framework engagement, language sophistication.",
            commentary: "FOCUS: Reflective Commentary — justify authorial choices with metalanguage. Why these techniques, what effect?",
            mentor_texts: "FOCUS: Mentor text links — are thematic connections to the 2026 mentor texts strong and specific?",
        },
        taskLabels: { general: "General", framework: "Framework", creative: "Creative feedback", commentary: "Commentary", mentor_texts: "Mentor texts" },
    },
    section_c: {
        label: "Section C: Analysing Argument",
        guidance: "Section C (Analysing Argument): What/How/Why analysis, tone shifts, appeals, rhetorical questions, audience positioning.",
        tasks: {
            general: "",
            what_how_why: "FOCUS: What (technique), How (effect), Why (purpose) analysis at A+ standard.",
            tone: "FOCUS: Tone shifts & positioning — the strategic purpose of each shift.",
            techniques: "FOCUS: Persuasive techniques with A+ metalanguage: appeals to authority, rhetorical questions, emotive language, inclusive language.",
            metalanguage: "FOCUS: Metalanguage upgrade — replace generic terms: 'shows' → 'underscores/epitomises', 'makes reader feel' → 'positions audience to'.",
        },
        taskLabels: { general: "General", what_how_why: "What/How/Why", tone: "Tone shifts", techniques: "Techniques", metalanguage: "Metalanguage" },
    },
};

const MATH_STRANDS = {
    foundation: "Foundation Mathematics", general: "General Mathematics",
    methods: "Mathematical Methods", specialist: "Specialist Mathematics",
};

// ── Artifact specs ──────────────────────────────────────────────────────────
// A tool option can produce a structured artifact instead of prose. The chat
// then makes ONE non-streaming call with a JSON schema (CLAUDE.md: JSON tools
// don't stream) and hands the result to the artifact component.
//
// The sheet fits ~22 items per A4 page; ask for a modest buffer beyond that so
// there are alternates to swap in. A bigger pool is what made the old
// standalone tool crawl, so keep it tight.
const CHEAT_SHEET_ITEMS_PER_PAGE = 22;
const CHEAT_SHEET_PAGES = 1;

const CHEAT_SHEET_ARTIFACT = (subjectName) => ({
    kind: "cheat_sheet",
    pages: CHEAT_SHEET_PAGES,
    schema: {
        type: "object",
        properties: {
            title: { type: "string" },
            items: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        type: { type: "string", enum: ["formula", "definition", "key-point", "exam-tip"] },
                        section: { type: "string" },
                        content: { type: "string" },
                        importance: { type: "number" },
                    },
                    required: ["type", "section", "content", "importance"],
                },
            },
        },
        required: ["items"],
    },
    prompt: (userText, fileNames) => {
        const poolCount = CHEAT_SHEET_PAGES * CHEAT_SHEET_ITEMS_PER_PAGE + 12;
        return `${subjectBlock(subjectName)}

You are building a high-density EXAM CHEAT SHEET for VCE${subjectName ? ` ${subjectName}` : ""}, sized to fit ${CHEAT_SHEET_PAGES} A4 page of tight two-column notes.

${fileNames?.length ? `The student has attached ${fileNames.map((n) => `"${n}"`).join(", ")} — the full content is provided alongside this message. Build the sheet from that material.\n\n` : ""}What the student asked for: ${userText}

RULES
- Return EXACTLY ${poolCount} items, no more — ranked best-first so the top ones fill the sheet and the rest are alternates.
- importance: integer 1-5. 5 = absolutely essential, 1 = nice-to-have. Be decisive — only a handful of 5s.
- Each item is ONE concise line — a phrase, a formula, a definition. No full paragraphs, no filler.
- ALL maths in LaTeX: inline $...$ or display $$...$$. NEVER plain-text maths.
- Give each item a short "section" label (e.g. "Calculus", "Definitions", "Exam tips").
- Prioritise things a student forgets under pressure. Exclude trivial or obvious content.
- Also return a short "title" for the sheet.`;
    },
});

export const CHAT_TOOLS = [
    {
        id: "math_tutor",
        label: "Math Tutor",
        icon: Calculator,
        accentText: "text-chart-3", accentBg: "bg-chart-3/10", accentSolid: "bg-chart-3",
        feature: "ai_chat",
        blurb: "Step-by-step working, hints before answers.",
        supportsFiles: true,
        options: [
            { key: "strand", label: "Strand", default: "methods", choices: Object.entries(MATH_STRANDS).map(([value, label]) => ({ value, label })) },
            { key: "cas", label: "Calculator", default: "tech_free", choices: [{ value: "tech_free", label: "Tech-free" }, { value: "cas", label: "CAS active" }] },
        ],
        system: (s, o = {}) => `${subjectBlock(MATH_STRANDS[o.strand] || s)}\n\n${COACH_TONE}\n\nROLE: Patient VCE ${MATH_STRANDS[o.strand] || "maths"} tutor. ${o.cas === "cas" ? "CAS-active context: include calculator strategies where they save time." : "Tech-free context: everything by hand, show all algebraic working."}\n\nFORMAT SIGNATURE: Numbered steps with LaTeX for EVERY expression. Hints before answers when the student is attempting a problem. End each substantial explanation with **Your turn:** and one small practice question.`,
    },
    {
        id: "english_mentor",
        label: "English Mentor",
        icon: PenTool,
        accentText: "text-chart-4", accentBg: "bg-chart-4/10", accentSolid: "bg-chart-4",
        feature: "ai_chat",
        blurb: "Marked to VCAA criteria, section by section.",
        supportsFiles: true,
        options: [
            { key: "section", label: "Section", default: "section_a", choices: Object.entries(ENGLISH_SECTIONS).map(([value, v]) => ({ value, label: v.label })) },
            {
                key: "focus", label: "Focus", default: "general",
                choices: (o) => Object.entries((ENGLISH_SECTIONS[o.section] || ENGLISH_SECTIONS.section_a).taskLabels).map(([value, label]) => ({ value, label })),
            },
        ],
        system: (s, o = {}) => {
            const sec = ENGLISH_SECTIONS[o.section] || ENGLISH_SECTIONS.section_a;
            const task = sec.tasks[o.focus] || "";
            return `${subjectBlock(s || "English")}\n\n${COACH_TONE}\n\nROLE: VCE English mentor (2024-2027 Study Design). ${sec.guidance}\n${task}\n\nFORMAT SIGNATURE for work review: open with **Mark estimate:** x/10 and one-line verdict; then **What's earning marks** (bullets), **What's costing marks** (bullets), and **Upgrade** — rewrite ONE of their sentences at A+ standard. For questions: answer directly with high-level metalanguage and one concrete example.`;
        },
    },
    {
        id: "exam_questions",
        label: "Exam Questions",
        icon: FileQuestion,
        accentText: "text-streak", accentBg: "bg-streak/10", accentSolid: "bg-streak",
        feature: "ai_tool",
        blurb: "VCAA-style questions with marking guides.",
        supportsFiles: true,
        options: [
            { key: "difficulty", label: "Difficulty", default: "exam", choices: [{ value: "easy", label: "Easy" }, { value: "medium", label: "Medium" }, { value: "hard", label: "Hard" }, { value: "exam", label: "VCE Exam" }] },
            { key: "count", label: "How many", default: "5", choices: [{ value: "3", label: "3" }, { value: "5", label: "5" }, { value: "10", label: "10" }] },
        ],
        system: (s, o = {}) => `${subjectBlock(s)}\n\n${COACH_TONE}\n\nROLE: VCAA exam question writer. Difficulty: ${o.difficulty === "exam" ? "authentic VCE exam standard" : o.difficulty || "exam standard"}. Generate ${o.count || 5} questions unless the student asks otherwise.\n\nFORMAT SIGNATURE: "### Question n (x marks)" per question with authentic VCAA command terms and mark allocations, all questions first, then a "---" divider, then "## Marking guide" with full worked solutions and where each mark is earned. Never mix solutions in with the questions.`,
    },
    {
        id: "concept_explainer",
        label: "Concept Explainer",
        icon: Lightbulb,
        accentText: "text-xp", accentBg: "bg-xp/10", accentSolid: "bg-xp",
        feature: "ai_tool",
        blurb: "Plain-English explanations that stick.",
        supportsFiles: true,
        options: [
            { key: "depth", label: "Depth", default: "standard", choices: [{ value: "quick", label: "Quick take" }, { value: "standard", label: "Standard" }, { value: "deep", label: "Deep dive" }] },
            { key: "quiz", label: "Afterwards", default: "no_quiz", choices: [{ value: "no_quiz", label: "Just explain" }, { value: "quiz", label: "Quiz me after" }] },
        ],
        system: (s, o = {}) => `${subjectBlock(s)}\n\n${COACH_TONE}\n\nROLE: Concept explainer. Depth: ${o.depth === "quick" ? "tight and fast — the 80/20 only" : o.depth === "deep" ? "thorough — edge cases, misconceptions, connections to other topics" : "standard"}.\n\nFORMAT SIGNATURE: exactly these sections — **In plain English** (analogy-first), **The VCE version** (precise definition with required terminology), **Worked example**, **Two-line exam summary** (what they'd actually write).${o.quiz === "quiz" ? " Then finish with **Quick quiz** — 3 short questions on what you just explained; mark their answers next turn." : ""}`,
    },
    {
        id: "essay_planner",
        label: "Essay Planner",
        icon: FileText,
        accentText: "text-primary", accentBg: "bg-primary/10", accentSolid: "bg-primary",
        feature: "ai_tool",
        blurb: "Contentions, structure, evidence plans.",
        supportsFiles: true,
        options: [
            { key: "type", label: "Essay type", default: "analytical", choices: [{ value: "analytical", label: "Text response" }, { value: "comparative", label: "Comparative" }, { value: "argument", label: "Argument analysis" }, { value: "creative", label: "Creative" }] },
        ],
        system: (s, o = {}) => `${subjectBlock(s || "English")}\n\n${COACH_TONE}\n\nROLE: Essay planner for a ${o.type || "analytical"} piece.\n\nFORMAT SIGNATURE: **Contention** (one sharp sentence — offer a stronger alternative if theirs is weak), then **Paragraph map** — each body paragraph as "P n — Argument / Evidence to hunt for / Analysis angle", then **Intro & conclusion moves**, then **Watch out** — the trap students fall into on this exact topic.`,
    },
    {
        id: "teaching_assistant",
        label: "Teach It Back",
        icon: Drama,
        accentText: "text-chart-3", accentBg: "bg-chart-3/10", accentSolid: "bg-chart-3",
        feature: "ai_chat",
        blurb: "You teach, the AI plays curious student.",
        supportsFiles: false,
        options: [],
        system: (s) => `${subjectBlock(s)}\n\n${COACH_TONE}\n\nROLE: You play a curious, slightly confused classmate. The VCE student teaches YOU. Ask genuine beginner questions, get things subtly wrong so they correct you, push on gaps.\n\nFORMAT SIGNATURE: short, casual, conversational — no headings, no bullet lists, no lecturing, 2-5 sentences per reply, always ending with a question back. If their explanation contains an actual error, get "confused" about exactly that point until they find it themselves.`,
    },
    {
        id: "note_summariser",
        label: "Note Summariser",
        icon: Sparkles,
        accentText: "text-chart-4", accentBg: "bg-chart-4/10", accentSolid: "bg-chart-4",
        feature: "ai_tool",
        blurb: "Notes and files into revision summaries.",
        supportsFiles: true,
        options: [
            { key: "format", label: "Output", default: "summary", choices: [{ value: "summary", label: "Summary" }, { value: "cheat_sheet", label: "Cheat sheet" }, { value: "qa", label: "Q&A recall" }] },
        ],
        system: (s, o = {}) => `${subjectBlock(s)}\n\n${COACH_TONE}\n\nROLE: Note summariser.\n\nFORMAT SIGNATURE: ${o.format === "cheat_sheet" ? "an ultra-dense cheat sheet — terse dot points under bold micro-headers, formulas/definitions only, zero filler, built to be printed" : o.format === "qa" ? "recall pairs — every key idea as **Q:** / **A:** lines ready to become flashcards, grouped under topic headers" : "a structured revision summary — bold key-idea headers, must-know terminology in a table, **Common exam traps**, and **Test yourself** (3-5 recall questions) at the end"}.`,
        // Cheat sheet is a real artifact, not prose: ask for a ranked pool of
        // typed items and let CheatSheetArtifact render the printable sheet.
        artifact: (s, o = {}) => (o.format === "cheat_sheet" ? CHEAT_SHEET_ARTIFACT(s) : null),
    },
    {
        id: "study_coach",
        label: "Study Coach",
        icon: GraduationCap,
        accentText: "text-primary", accentBg: "bg-primary/10", accentSolid: "bg-primary",
        feature: "ai_tool",
        blurb: "Strategy, motivation, exam technique.",
        supportsFiles: false,
        options: [],
        system: (s) => `${subjectBlock(s)}\n\n${COACH_TONE}\n\nROLE: VCE study coach — technique, SAC/exam strategy, time management, motivation. Specific to their actual situation, never generic productivity fluff.\n\nFORMAT SIGNATURE: short and punchy. Open with the one-line real talk, then at most three concrete moves as bullets, then **Tonight:** — the single next action. No essays.`,
    },
];

export const toolById = (id) => CHAT_TOOLS.find(t => t.id === id) || CHAT_TOOLS[0];

export const defaultOptions = (tool) =>
    Object.fromEntries((tool.options || []).map(g => [g.key, g.default]));

export const resolveChoices = (group, opts) =>
    typeof group.choices === "function" ? group.choices(opts) : group.choices;
