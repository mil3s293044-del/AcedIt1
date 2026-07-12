import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
    Sparkles, Lightbulb, Save, Trash2, Eye, History, FolderOpen, ChevronDown,
    Square, GraduationCap, BookOpen, PenTool,
    Scale, MessageCircle, FileText, RefreshCw, X
} from "lucide-react";
import { useAIToolSidePanel } from "./sidePanelContext";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { recordStudyAndGetStreak } from "@/components/shared/streakHelpers";
import MarkdownMath from "@/components/shared/MarkdownMath";
import { getExaminerPrompt } from "@/lib/subjectExaminerPrompts";
import { invokeLLMStream } from "@/lib/streamingAI";

const ENGLISH_MENTOR_PROMPT = `You are the "AI English Mentor," a specialist VCE English tutor for the 2024–2027 Study Design (Units 3 & 4). You are a Lead Examiner helping students achieve A+ results.

CRITICAL SECTIONS:
- Section A (Reading & Responding): authorial intent, TEEL/PETAL, sophisticated metalanguage, no plot summary
- Section B (Creating Texts): Four Frameworks (Country, Protest, Personal Journeys, Play), Reflective Commentary, 2026 mentor texts
- Section C (Analysing Argument): What/How/Why, tone shifts, appeals, rhetorical questions, audience positioning
- Essay Planning: nuanced contentions, IDEA-focused topic sentences, A+ synonyms`;

const SECTIONS = {
    essay_marker: {
        name: "VCAA Essay Marker",
        short: "Essay Marker",
        icon: GraduationCap,
        accent: "streak",
        isMarker: true,
    },
    text_response: {
        name: "Section A: Text Response",
        short: "Section A",
        icon: BookOpen,
        accent: "chart-3",
        tasks: [
            { id: "contention_crafting", name: "Contention Crafting", prompt: "Analyse student's contention. Is it nuanced? Does it avoid simple agree/disagree? Suggest improvements with sophisticated language." },
            { id: "quote_analysis", name: "Quote Analysis & Evidence", prompt: "Evaluate quote selection and analysis. Do they explain authorial intent? Use metalanguage (symbolism, syntax, juxtaposition)? Suggest A+ level analysis." },
            { id: "paragraph_feedback", name: "Paragraph Feedback (TEEL)", prompt: "Provide detailed TEEL/PETAL paragraph feedback: Topic sentence (idea-focused), Evidence, Explanation (authorial intent), Link." },
            { id: "views_values", name: "Author's Views & Values", prompt: "Guide identification of author's views/values. How is this conveyed through characterisation, symbolism, narrative choices?" },
        ],
    },
    section_b: {
        name: "Section B: Creating Texts",
        short: "Section B",
        icon: PenTool,
        accent: "chart-4",
        tasks: [
            { id: "framework_ideas", name: "Framework of Ideas", prompt: "Help develop creative piece using Frameworks of Ideas (Country, Protest, Personal Journeys, Play). Deepen thematic exploration." },
            { id: "creative_piece", name: "Creative Piece Feedback", prompt: "Evaluate creative writing: thematic depth, literary devices, Framework of Ideas engagement, language sophistication." },
            { id: "reflective_commentary", name: "Reflective Commentary", prompt: "Help write Reflective Commentary. Justify authorial choices using metalanguage. Why these techniques? What effect?" },
            { id: "mentor_text_links", name: "Mentor Text Links", prompt: "Analyse links to 2026 mentor texts. Are thematic connections strong? Do they demonstrate Framework of Ideas understanding?" },
        ],
    },
    section_c: {
        name: "Section C: Analysing Argument",
        short: "Section C",
        icon: Scale,
        accent: "primary",
        tasks: [
            { id: "what_how_why", name: "What, How, Why Analysis", prompt: "Teach What (technique), How (effect), Why (purpose) analysis. Elevate metalanguage to A+ standard." },
            { id: "tone_shifts", name: "Tone Shifts & Positioning", prompt: "Identify tone shifts and audience positioning. What is the strategic purpose of each shift?" },
            { id: "persuasive_techniques", name: "Persuasive Techniques", prompt: "Break down persuasive techniques with A+ metalanguage: appeals to authority, rhetorical questions, emotive language, inclusive language." },
            { id: "metalanguage_upgrade", name: "Metalanguage Upgrade", prompt: "Upgrade student's language analysis. Replace generic terms: 'shows' → 'underscores/epitomises', 'makes reader feel' → 'positions audience to'." },
        ],
    },
};

const PLACEHOLDERS = {
    text_response: { contention_crafting: "Write your contention here...", quote_analysis: "Paste quotes and your current analysis...", paragraph_feedback: "Paste your full TEEL/PETAL paragraph...", views_values: "Describe the author's views and your evidence..." },
    section_b:     { framework_ideas: "Which Framework are you using? What themes?", creative_piece: "Paste your creative piece...", reflective_commentary: "Describe your authorial choices and techniques...", mentor_text_links: "How does your piece connect to mentor texts?" },
    section_c:     { what_how_why: "Paste the persuasive text to analyse...", tone_shifts: "Paste the article...", persuasive_techniques: "Paste the persuasive text...", metalanguage_upgrade: "Paste your current analysis to upgrade..." },
};

// Static class lookups so JIT picks them up
const ACCENT_CLASSES = {
    primary:   { activeBg: "bg-primary/10",   activeBorder: "border-primary",   activeText: "text-primary"   },
    "chart-3": { activeBg: "bg-chart-3/10",   activeBorder: "border-chart-3",   activeText: "text-chart-3"   },
    "chart-4": { activeBg: "bg-chart-4/10",   activeBorder: "border-chart-4",   activeText: "text-chart-4"   },
    streak:    { activeBg: "bg-streak/10",    activeBorder: "border-streak",    activeText: "text-streak"    },
    xp:        { activeBg: "bg-xp/10",        activeBorder: "border-xp",        activeText: "text-xp"        },
};

const MODES = [
    { id: "question", Icon: MessageCircle, label: "I have a question", desc: "Ask anything about this section" },
    { id: "review",   Icon: FileText,      label: "Review my work",    desc: "Get feedback on your writing" },
];

export default function EnglishMentor() {
    const [activeSection, setActiveSection] = useState("essay_marker");
    const [selectedTask, setSelectedTask] = useState({});
    const [sectionMode, setSectionMode] = useState({});
    const [userInput, setUserInput] = useState("");
    const [essayTopic, setEssayTopic] = useState("");
    const [essayPrompt, setEssayPrompt] = useState("");
    const [essaySection, setEssaySection] = useState("A");
    const [aiResponse, setAiResponse] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [savedResults, setSavedResults] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [viewingResult, setViewingResult] = useState(null);
    const abortRef = useRef(null);
    const { toast } = useToast();

    const currentSection = SECTIONS[activeSection];
    const sectionKeys = Object.keys(SECTIONS);
    const currentMode = sectionMode[activeSection] || null;

    useEffect(() => {
        const loadHistory = async () => {
            try {
                const user = await base44.auth.me();
                const results = await base44.entities.AISavedResult
                    .filter({ created_by: user.email, tool_type: "english_mentor" }, "-date_created")
                    .catch(() => []);
                setSavedResults(results || []);
            } catch {
                /* signed-out or load failure — leave history empty */
            }
        };
        loadHistory();
    }, []);

    const handleSectionTabChange = (key) => {
        setActiveSection(key);
        setAiResponse("");
        setUserInput("");
        setEssayTopic("");
        setEssayPrompt("");
    };

    const handleGenerate = async () => {
        if (currentSection.isMarker) {
            if (!userInput.trim()) {
                toast({ title: "Please paste your essay", variant: "destructive" });
                return;
            }
        } else {
            if (!userInput.trim() || !selectedTask[activeSection] || !currentMode) {
                toast({ title: "Please select a task and provide your work", variant: "destructive" });
                return;
            }
        }
        setIsGenerating(true);
        setAiResponse("");

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            let prompt;
            if (currentSection.isMarker) {
                prompt = `${getExaminerPrompt("English")}

${ENGLISH_MENTOR_PROMPT}

You are a VCAA Lead Examiner marking a student's VCE English essay for Section ${essaySection}.
${essayTopic ? `Text/Topic: ${essayTopic}` : ""}
${essayPrompt ? `Prompt: ${essayPrompt}` : ""}

Student Essay:
${userInput}

Provide a comprehensive, specific examiner's report in this exact Markdown structure:

## Examiner's Report — Section ${essaySection}

### Overall Mark: [X/10]

### Criterion 1: Understanding & Interpretation
**Mark: X/10**
[Specific feedback. Quote the essay directly. Reference VCAA criteria.]

### Criterion 2: Analysis of Language & Construction
**Mark: X/10**
[Metalanguage use, authorial intent, technique identification with quotes from the essay.]

### Criterion 3: Argument & Contention
**Mark: X/10**
[Contention sophistication, paragraph structure (TEEL), topic sentences, linking.]

### Criterion 4: Expression & Vocabulary
**Mark: X/10**
[Vocabulary range, sentence variety, metalanguage precision, register.]

### Key Strengths
- [Specific strength with direct quote from essay]
- [Specific strength]
- [Specific strength]

### Areas for Improvement
- [Specific weakness with direct quote and how to fix it]
- [Specific weakness]
- [Specific weakness]

### Examiner's Comments
[2–3 paragraphs of holistic examiner feedback exactly like a real VCAA examiner report — reference the marking guide, compare to a 10/10 essay, give specific actionable advice. Rigorous but constructive.]

### To Achieve a Higher Score
[3–5 specific, actionable steps this student should take.]

Be extremely specific, quote the student's essay directly, and apply the 2024–2027 VCAA Study Design marking criteria rigorously.`;
            } else {
                const task = currentSection.tasks.find((t) => t.id === selectedTask[activeSection]);
                const modeContext =
                    currentMode === "question"
                        ? "The student has a QUESTION. Answer it directly and thoroughly with expert VCE guidance."
                        : "The student wants you to REVIEW THEIR WORK. Provide detailed, constructive feedback with specific improvements.";
                prompt = `${getExaminerPrompt("English")}

${ENGLISH_MENTOR_PROMPT}

Task: ${task.prompt}

Mode: ${modeContext}

Student's Input: ${userInput}

Provide expert VCE English guidance following the 2024–2027 Study Design. Use sophisticated metalanguage, be specific and actionable. Format in Markdown.`;
            }

            await invokeLLMStream(
                { prompt },
                (_delta, soFar) => setAiResponse(soFar),
                { signal: controller.signal }
            );
            recordStudyAndGetStreak().catch(() => {});
        } catch (err) {
            if (err?.name !== "AbortError") {
                toast({ title: "Generation failed", description: err?.message, variant: "destructive" });
            }
        } finally {
            setIsGenerating(false);
            abortRef.current = null;
        }
    };

    const handleStop = () => abortRef.current?.abort();

    const handleSave = async () => {
        if (!aiResponse) return;
        setIsSaving(true);
        try {
            const taskName = currentSection.isMarker
                ? `Essay Mark: ${essayTopic || "Section " + essaySection}`
                : (currentSection.tasks?.find((t) => t.id === selectedTask[activeSection])?.name || currentSection.name);
            await base44.entities.AISavedResult.create({
                tool_type: "english_mentor",
                title: taskName,
                subject_name: "VCE English",
                topic: currentSection.name,
                content: aiResponse,
                input_data: { activeSection, selectedTask, mode: currentMode, essayTopic, essayPrompt, essaySection, userInput },
                date_created: new Date().toISOString().split("T")[0],
            });
            toast({ title: "Saved!" });
            const user = await base44.auth.me();
            const results = await base44.entities.AISavedResult
                .filter({ created_by: user.email, tool_type: "english_mentor" }, "-date_created")
                .catch(() => []);
            setSavedResults(results || []);
        } finally {
            setIsSaving(false);
        }
    };

    // ── Sidebar generation panel ──────────────────────────────────────────
    // Inside the AITools page on large screens, the generation output portals
    // into the page sidebar (replacing tips/examples while it's showing).
    // Mobile / standalone use falls back to rendering inline below the form.
    const sidePanel = useAIToolSidePanel();
    const panelVisible = isGenerating || !!aiResponse;
    const inSidebar = !!sidePanel?.node;
    const setPanelActive = sidePanel?.setActive;
    useEffect(() => {
        setPanelActive?.(panelVisible);
    }, [panelVisible, setPanelActive]);
    // Clear the sidebar takeover if the tool unmounts mid-generation.
    useEffect(() => () => setPanelActive?.(false), [setPanelActive]);

    const handleClosePanel = () => {
        abortRef.current?.abort();
        setAiResponse("");
    };

    const resultPanel = (
        <AnimatePresence>
            {panelVisible && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="card-soft overflow-hidden"
                >
                    {/* Header — compact in the sidebar, roomy inline */}
                    <div className={`flex items-center gap-2 border-b border-border bg-surface flex-shrink-0 ${inSidebar ? "px-4 py-3" : "gap-3 px-5 py-4"}`}>
                        <div className="w-1 h-8 bg-primary rounded-full flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="font-display font-extrabold text-foreground text-sm leading-tight truncate">Expert VCE Feedback</p>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{currentSection.name}</p>
                        </div>
                        {!inSidebar && <span className="pill bg-primary/10 text-primary flex-shrink-0">VCE English</span>}
                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-1">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setAiResponse(""); setUserInput(""); }}
                                disabled={isGenerating}
                                title="Start over"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                {!inSidebar && <span className="hidden sm:inline">New</span>}
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleSave}
                                disabled={isGenerating || isSaving || !aiResponse}
                            >
                                <Save className="w-3.5 h-3.5" />
                                {!inSidebar && <span className="hidden sm:inline">{isSaving ? "…" : "Save"}</span>}
                            </Button>
                            <button
                                onClick={handleClosePanel}
                                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors cursor-pointer"
                                title="Close — brings tips & examples back"
                                aria-label="Close feedback panel"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Body — streams in like ChatGPT */}
                    <div className={`overflow-y-auto bg-surface text-sm text-foreground/90 leading-relaxed ${inSidebar ? "px-4 py-4 max-h-[70vh]" : "px-6 py-5 max-h-[600px]"}`}>
                        {aiResponse ? (
                            <MarkdownMath isStreaming={isGenerating}>{aiResponse}</MarkdownMath>
                        ) : (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                                <Sparkles className="w-4 h-4 animate-pulse text-primary" />
                                Thinking…
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    return (
        <div className="space-y-5">
            {/* Section Tabs */}
            <div className="card-soft overflow-hidden">
                <div className="flex overflow-x-auto border-b-2 border-border scrollbar-hide">
                    {sectionKeys.map((key) => {
                        const s = SECTIONS[key];
                        const isActive = activeSection === key;
                        const cls = ACCENT_CLASSES[s.accent] || ACCENT_CLASSES.primary;
                        const SectionIcon = s.icon;
                        return (
                            <button
                                key={key}
                                onClick={() => handleSectionTabChange(key)}
                                className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-xs font-bold border-b-2 transition-all ${
                                    isActive
                                        ? `${cls.activeBorder} ${cls.activeText} ${cls.activeBg}`
                                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                                }`}
                            >
                                <SectionIcon className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">{s.short}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="p-5 space-y-4">
                    {currentSection.isMarker ? (
                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <label className="stat-label">Section</label>
                                <div className="flex gap-2">
                                    {[["A", "Reading & Responding"], ["B", "Creating Texts"], ["C", "Analysing Argument"]].map(([val, lbl]) => (
                                        <button
                                            key={val}
                                            onClick={() => setEssaySection(val)}
                                            className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                                                essaySection === val
                                                    ? "border-primary bg-primary/10 text-primary"
                                                    : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/60"
                                            }`}
                                        >
                                            {val}: {lbl}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="stat-label">
                                    Text / Topic <span className="font-normal text-muted-foreground/70">(optional)</span>
                                </label>
                                <Input
                                    value={essayTopic}
                                    onChange={(e) => setEssayTopic(e.target.value)}
                                    placeholder="e.g. The Crucible, To Kill a Mockingbird"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="stat-label">
                                    Essay Prompt <span className="font-normal text-muted-foreground/70">(optional)</span>
                                </label>
                                <Input
                                    value={essayPrompt}
                                    onChange={(e) => setEssayPrompt(e.target.value)}
                                    placeholder="Enter the essay prompt or question..."
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="stat-label">Your Essay</label>
                                <Textarea
                                    value={userInput}
                                    onChange={(e) => setUserInput(e.target.value)}
                                    placeholder="Paste your full essay here for VCAA examiner marking..."
                                    rows={10}
                                    className="resize-none text-sm"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="stat-label">What would you like to do?</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {MODES.map((mode) => {
                                        const isActive = currentMode === mode.id;
                                        const ModeIcon = mode.Icon;
                                        return (
                                            <button
                                                key={mode.id}
                                                onClick={() => {
                                                    setSectionMode((prev) => ({ ...prev, [activeSection]: mode.id }));
                                                    setSelectedTask((prev) => ({ ...prev, [activeSection]: undefined }));
                                                    setUserInput("");
                                                }}
                                                className={`p-3 rounded-xl border-2 text-left transition-all ${
                                                    isActive
                                                        ? "border-primary bg-primary/10"
                                                        : "border-border hover:border-primary/40 bg-surface"
                                                }`}
                                            >
                                                <ModeIcon className={`w-4 h-4 mb-1 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                                                <div className="text-xs font-bold text-foreground">{mode.label}</div>
                                                <div className="text-xs text-muted-foreground mt-0.5">{mode.desc}</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {currentMode && (
                                <>
                                    <div className="space-y-1.5">
                                        <label className="stat-label">
                                            {currentMode === "question" ? "Topic area" : "What type of help?"}
                                        </label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {currentSection.tasks?.map((task) => (
                                                <button
                                                    key={task.id}
                                                    onClick={() => setSelectedTask((prev) => ({ ...prev, [activeSection]: task.id }))}
                                                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                                                        selectedTask[activeSection] === task.id
                                                            ? "border-primary bg-primary/10"
                                                            : "border-border hover:border-primary/40 bg-surface"
                                                    }`}
                                                >
                                                    <span className="text-xs font-bold text-foreground">{task.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="stat-label">
                                            {currentMode === "question" ? "Your Question" : "Your Work"}
                                        </label>
                                        <Textarea
                                            value={userInput}
                                            onChange={(e) => setUserInput(e.target.value)}
                                            placeholder={
                                                currentMode === "question"
                                                    ? "Type your question here... e.g. How do I write a strong contention for Section A?"
                                                    : (PLACEHOLDERS[activeSection]?.[selectedTask[activeSection]] || "Paste your essay, paragraph, or writing here...")
                                            }
                                            rows={8}
                                            className="resize-none text-sm"
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {isGenerating ? (
                        <Button onClick={handleStop} variant="destructive" className="w-full">
                            <Square className="w-4 h-4" /> Stop generating
                        </Button>
                    ) : (
                        <Button
                            onClick={handleGenerate}
                            disabled={
                                currentSection.isMarker
                                    ? !userInput.trim()
                                    : !userInput.trim() || !selectedTask[activeSection] || !currentMode
                            }
                            className="w-full"
                        >
                            <Sparkles className="w-4 h-4" />
                            {currentSection.isMarker ? "Mark My Essay" : "Get Expert Feedback"}
                        </Button>
                    )}
                </div>
            </div>

            {/* Quick Tips */}
            <div className="card-soft p-4 bg-xp/5 border-xp/20">
                <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="w-4 h-4 text-xp" />
                    <span className="text-xs font-extrabold text-foreground uppercase tracking-wide">VCE English success tips</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {[
                        "Avoid plot summary — focus on authorial intent",
                        "Metalanguage: symbolism, juxtaposition, syntax, subtext",
                        "Contention: move beyond \"I agree/disagree\"",
                        "Section C: always explain What, How, Why",
                    ].map((tip, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-xs text-foreground">
                            <span className="text-xp font-bold mt-0.5 flex-shrink-0">→</span>
                            <span>{tip}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Generation output — portals into the page sidebar on large
                screens (replacing the tips/examples card while showing);
                renders inline below the form on mobile / standalone. */}
            {inSidebar ? createPortal(resultPanel, sidePanel.node) : resultPanel}

            {/* History */}
            {savedResults.length > 0 && (
                <div className="card-soft overflow-hidden">
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="w-full flex items-center justify-between px-5 py-4 hover:bg-secondary/40 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <History className="w-4 h-4 text-muted-foreground" />
                            <span className="font-bold text-foreground text-sm">Saved feedback</span>
                            <span className="pill bg-secondary text-muted-foreground">{savedResults.length}</span>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showHistory ? "rotate-180" : ""}`} />
                    </button>
                    <AnimatePresence>
                        {showHistory && (
                            <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: "auto" }}
                                exit={{ height: 0 }}
                                className="overflow-hidden border-t border-border"
                            >
                                <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
                                    {savedResults.map((r) => (
                                        <div
                                            key={r.id}
                                            className="flex items-center justify-between p-3 bg-background rounded-xl border border-border"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-foreground truncate">{r.title}</p>
                                                <p className="text-xs text-muted-foreground">{r.topic} · {r.date_created}</p>
                                            </div>
                                            <div className="flex gap-1 ml-2">
                                                <button
                                                    onClick={() => setViewingResult(r)}
                                                    className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        base44.entities.AISavedResult.delete(r.id).then(() =>
                                                            setSavedResults((prev) => prev.filter((x) => x.id !== r.id))
                                                        )
                                                    }
                                                    className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            <Dialog open={!!viewingResult} onOpenChange={() => setViewingResult(null)}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{viewingResult?.title}</DialogTitle>
                    </DialogHeader>
                    <div className="text-sm text-foreground">
                        <MarkdownMath>{viewingResult?.content || ""}</MarkdownMath>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
