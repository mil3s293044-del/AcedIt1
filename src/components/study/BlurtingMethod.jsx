import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useBusy, BUSY } from "@/lib/LiveContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field, Segmented } from "@/components/shared/SetupControls";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { PenTool, Play, Clock, CheckCircle, RotateCcw, Maximize, Wand2, X, Sparkles, FolderOpen, Trash2, AlertCircle, Brain, Check, ChevronRight, Layers } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { acceptFiles, uploadAll } from "@/lib/pickFiles";
import { aceDone } from "@/components/ace/AceReacts";
import WhatToTest from "./WhatToTest";
import SourceRow from "./SourceRow";
import { suggestTopics } from "@/lib/recallSuggest";
import { FEATURES, checkLiveTier } from "@/lib/tierAccess";
import { getExaminerPrompt } from "@/lib/subjectExaminerPrompts";
import { fmtDate } from "@/lib/safeDate";
import { deckCards } from "@/lib/mistakeBank";
import AceShuffle from "@/components/ace/AceShuffle";

// Static class lookup for AI score pill — Tailwind JIT cannot see interpolated tokens.
const SCORE_PILL = {
    high:   'bg-primary/10 text-primary',
    mid:    'bg-xp/10 text-xp',
    low:    'bg-streak/10 text-streak',
};
const scorePillClass = (score) => score >= 75 ? SCORE_PILL.high : score >= 50 ? SCORE_PILL.mid : SCORE_PILL.low;

// Static class lookup for word-count progress dot.
const WORDCOUNT_DOT = {
    high: 'bg-primary',
    mid:  'bg-xp',
    low:  'bg-secondary',
};
const wordCountDotClass = (n) => n >= 100 ? WORDCOUNT_DOT.high : n >= 50 ? WORDCOUNT_DOT.mid : WORDCOUNT_DOT.low;

function ScoreRing({ percentage, size = 120 }) {
    const r = 46;
    const c = 2 * Math.PI * r;
    const offset = c - (percentage / 100) * c;
    // Resolve token-driven stroke colors via CSS variables so the ring stays on-palette.
    const color = percentage >= 75
        ? "hsl(var(--primary))"
        : percentage >= 50
            ? "hsl(var(--xp))"
            : "hsl(var(--streak))";

    return (
        <div style={{ width: size, height: size }} className="relative flex items-center justify-center">
            <svg width={size} height={size} viewBox="0 0 110 110" className="-rotate-90">
                <circle cx="55" cy="55" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
                <motion.circle
                    cx="55" cy="55" r={r} fill="none" stroke={color} strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={c}
                    initial={{ strokeDashoffset: c }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.span
                    className="text-2xl font-black"
                    style={{ color }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                >
                    {percentage}%
                </motion.span>
                <span className="text-xs text-muted-foreground/60 font-medium">recall</span>
            </div>
        </div>
    );
}

export default function BlurtingMethod({ onSessionComplete }) {
    const [phase, setPhase] = useState("setup");
    const [ownFlashcards, setOwnFlashcards] = useState([]);
    const [ownMaps, setOwnMaps] = useState([]);
    const [ownAssessments, setOwnAssessments] = useState([]);
    const [ownTechniques, setOwnTechniques] = useState([]);
    const [makingCards, setMakingCards] = useState(false);
    const [cardsMade, setCardsMade] = useState(0);
    const [selectedSubject, setSelectedSubject] = useState("");
    const [topic, setTopic] = useState("");
    const [blurtedText, setBlurtedText] = useState("");
    const [sessionStartTime, setSessionStartTime] = useState(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [isFocusMode, setIsFocusMode] = useState(false);
    // Blurting IS a page of unsaved typing, so the phase claim covers what the
    // document-level typing check would only catch between keystrokes.
    useBusy(isFocusMode || phase === "active", BUSY.FOCUS);
    const [showFocusPrompt, setShowFocusPrompt] = useState(false);
    const [sourceFiles, setSourceFiles] = useState([]);
    const [aiFeedback, setAiFeedback] = useState(null);
    const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
    const [userSubjects, setUserSubjects] = useState([]);
    const [showSessionHistory, setShowSessionHistory] = useState(false);
    const [sessionHistory, setSessionHistory] = useState([]);
    const [selectedHistorySession, setSelectedHistorySession] = useState(null);
    const [sessionDuration, setSessionDuration] = useState(10);
    /**
     * WHAT TO BLURT, AND HOW HARD IT IS MARKED.
     *
     * A blurt was always "everything on the topic, marked one way". Both of
     * those are real choices and the technique is better for making them: a
     * student revising for a SAC next week wants breadth, and one who can list
     * the facts and cannot explain them wants the opposite — which the marking
     * prompt already asks about in its own words ("Can the student EXPLAIN
     * relationships, not just STATE facts?") without ever being told which the
     * student was going for.
     *
     * STRICTNESS IS RECORDED WITH THE RESULT. The completeness percentage is
     * the figure this screen is built around, and a percentage marked three
     * ways that does not say which is three numbers a student cannot compare
     * with each other — the "two surfaces, one question" failure this codebase
     * keeps finding. The feedback carries `marked_at` and the panel prints it,
     * beside the "marked against" line that is already there for the same
     * reason.
     */
    const [focus, setFocus] = useState("all");
    const [strictness, setStrictness] = useState("standard");
    const { toast } = useToast();
    const focusModeRef = useRef(null);
    const textareaRef = useRef(null);

    useEffect(() => {
        let timer;
        if (phase === "active" && timeLeft > 0) {
            timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        } else if (phase === "active" && timeLeft === 0) {
            setPhase("review");
        }
        return () => clearInterval(timer);
    }, [phase, timeLeft]);

    useEffect(() => {
        const loadSubjects = async () => {
            try {
                const currentUser = await base44.auth.me();
                const subjects = await base44.entities.UserSubject.filter({ created_by: currentUser.email, is_active: true });
                const uniqueSubjects = subjects.reduce((acc, cur) => {
                    if (!acc.find(i => i.subject_name === cur.subject_name)) acc.push(cur);
                    return acc;
                }, []);
                setUserSubjects(uniqueSubjects || []);

                const [cards, maps, asmts, techs] = await Promise.all([
                    base44.entities.Flashcard.filter({ created_by: currentUser.email, is_active: true }).then(deckCards).catch(() => []),
                    base44.entities.MindMap.filter({ created_by: currentUser.email }, "-updated_date", 50).catch(() => []),
                    base44.entities.SubjectAssessment.filter({ created_by: currentUser.email, is_completed: false }, "due_date", 20).catch(() => []),
                    base44.entities.StudyTechnique.filter({ created_by: currentUser.email }, "-date", 40).catch(() => []),
                ]);
                setOwnFlashcards(cards || []);
                setOwnMaps(maps || []);
                setOwnAssessments(asmts || []);
                setOwnTechniques(techs || []);
            } catch (error) {
                console.error("Error loading subjects:", error);
                if (error.message?.includes("not logged in")) base44.auth.redirectToLogin(window.location.pathname);
            }
        };
        loadSubjects();
    }, []);

    const enterFullscreen = () => {
        const elem = document.documentElement;
        if (elem.requestFullscreen) elem.requestFullscreen();
        else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
    };

    const exitFullscreen = () => {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        }
    };

    const startSession = () => {
        if (!selectedSubject) {
            toast({ title: "Select a subject", description: "Choose a subject before starting.", variant: "destructive" });
            return;
        }
        setShowFocusPrompt(true);
    };

    const handleStartConfirmed = (inFocus) => {
        setSessionStartTime(Date.now());
        setTimeLeft(sessionDuration * 60);
        setBlurtedText("");
        setPhase("active");
        setShowFocusPrompt(false);
        if (inFocus) {
            setIsFocusMode(true);
            enterFullscreen();
        }
        setTimeout(() => textareaRef.current?.focus(), 100);
    };

    /**
     * What each focus asks FOR, as a brief rather than a label — one line for
     * the student on the writing screen, one for the marker.
     */
    const FOCUS_BRIEF = {
        all:      { ask: "everything you can recall",
                    mark: "Weigh BREADTH: how much of the topic did they reach at all?" },
        links:    { ask: "how it all connects — causes, consequences, mechanisms",
                    mark: "Weigh EXPLANATION over coverage: credit reasoning and causal links, and treat a correct fact stated with no link behind it as only partly there." },
        terms:    { ask: "the key terms and definitions, precisely",
                    mark: "Weigh TERMINOLOGY: credit correct VCAA terms used accurately, and name the ones they reached for and got slightly wrong." },
        evidence: { ask: "the evidence — cases, studies, data, examples",
                    mark: "Weigh EVIDENCE: credit named cases, studies, figures and worked examples. A claim with nothing behind it is not covered." },
    };

    /**
     * How hard. It moves the BAR, never the honesty: every level still names
     * what was missed, because softening that would make the gentle setting a
     * screen that tells a student they are fine.
     */
    const STRICT_BRIEF = {
        gentle:   "Mark generously. Credit a point they clearly knew even if the wording was loose. This is a first pass at a topic.",
        standard: "Mark as a teacher would on a practice task: the point has to be recognisably made, but phrasing is not penalised.",
        examiner: "Mark as a VCAA assessor would on a SAC: a point counts only if it is stated with the precision and the terminology the Study Design expects. Name every point that was close but would not have scored.",
    };

    /**
     * Mark the blurt.
     *
     * This used to require uploaded notes — both here and in the review screen,
     * which rendered the whole AI Marking panel only when `sourceFiles.length`
     * was non-zero. The upload sits in a side panel on the setup screen and
     * reads as optional, so most students never touched it and never saw any
     * marking at all. Meanwhile "How Blurting Works" promised, unconditionally,
     * that step 4 was "AI checks what you missed". The app was advertising a
     * feature and then hiding it behind a step nobody knew was load-bearing.
     *
     * Notes are still better: they let it mark against what the student's own
     * class actually covered. Without them it marks against the VCE Study
     * Design via the subject's examiner prompt — less specific, still the point
     * of the technique — and says which of the two it did, because a "you
     * missed this" that the student's course never covered is worse than no
     * feedback at all.
     */
    const handleGenerateFeedback = async () => {
        if (!blurtedText.trim()) {
            toast({ title: "Nothing to mark yet", description: "Write your brain dump first.", variant: "destructive" });
            return;
        }
        const hasNotes = sourceFiles.length > 0;
        const topicLabel = topic?.trim() || "the topic they chose";

        const access = await checkLiveTier(FEATURES.BLURTING);
        if (!access.allowed) {
            toast({
                title: access.upgradeRequired ? "Premium feature" : "Daily limit reached",
                description: access.reason,
                variant: "destructive",
            });
            return;
        }

        setIsGeneratingFeedback(true);
        try {
            const { uploaded, failed } = hasNotes
                ? await uploadAll(sourceFiles, base44.integrations.Core.UploadFile)
                : { uploaded: [], failed: [] };
            failed.forEach(f => toast({
                title: "Skipped a file",
                description: `${f.name} couldn't be uploaded, so it isn't included.`,
                variant: "destructive",
            }));
            const docxPptx = uploaded.filter(f => f.ext === 'docx' || f.ext === 'pptx');
            const directFiles = uploaded.filter(f => f.ext !== 'docx' && f.ext !== 'pptx');
            let documentContext = '';
            for (const f of docxPptx) {
                try {
                    const textResult = await base44.functions.invoke('extractDocumentText', { file_url: f.url });
                    if (textResult.data?.error) {
                        toast({ title: "File read issue", description: "Could not read " + f.name + ": " + textResult.data.error, variant: "destructive" });
                    } else {
                        documentContext += `\n\n[${f.name}]:\n${textResult.data?.text || ''}`;
                    }
                } catch (e) {
                    toast({ title: "File read failed", description: "Could not read " + f.name + ": " + e.message, variant: "destructive" });
                }
            }
            const task = hasNotes
                ? `Evaluate this ${selectedSubject} "blurting" attempt against the source material (${sourceFiles.length} file(s)) using VCE Study Design criteria.`
                : `Evaluate this ${selectedSubject} "blurting" attempt — everything the student could recall from memory about ${topicLabel}.

There is NO source material for this session. Mark it against the VCE Study Design for ${selectedSubject}: what a VCE student is expected to know on this topic. Two rules follow from that, and breaking either makes the feedback worse than none:
- Never say or imply you have seen their notes, their class, or their teacher's material. You have not.
- Keep every "missed" point inside the Study Design for this subject and topic. A student told they missed something their course never covered will stop trusting the rest of it.`;

            const response = await base44.integrations.Core.InvokeLLM({
                feature: "blurting",
                prompt: `${getExaminerPrompt(selectedSubject)}

${task}

Student's Blurted Text:
${blurtedText}
${documentContext}
=== WHAT THEY WERE ASKED FOR ===
They were asked to write ${FOCUS_BRIEF[focus]?.ask || FOCUS_BRIEF.all.ask}.
${FOCUS_BRIEF[focus]?.mark || FOCUS_BRIEF.all.mark}

=== HOW HARD TO MARK ===
${STRICT_BRIEF[strictness] || STRICT_BRIEF.standard}
Whatever the level, still name everything they missed — a marking that goes soft on the gaps is a screen telling a student they are fine.

Assess according to VCAA standards:
1. Overall Assessment: Completeness percentage - Can the student EXPLAIN relationships (not just STATE facts)?
2. Key Points Covered: Which Study Design dot points did they recall?
3. Key Points Missed: Which critical VCAA requirements were omitted?
4. Accuracy Issues: Any errors that would lose marks in VCAA assessment?
5. Suggestions: VCE-specific improvements using appropriate metalanguage for SAC/exam prep

Reference Study Design requirements in your feedback.`,
                file_urls: directFiles.length ? directFiles.map(f => f.url) : undefined,
                response_json_schema: {
                    type: "object",
                    properties: {
                        completeness_percentage: { type: "number" },
                        overall_assessment: { type: "string" },
                        points_covered: { type: "array", items: { type: "string" } },
                        points_missed: { type: "array", items: { type: "string" } },
                        accuracy_issues: { type: "string" },
                        suggestions: { type: "array", items: { type: "string" } }
                    },
                    required: ["completeness_percentage", "overall_assessment", "points_covered", "points_missed", "suggestions"]
                }
            });
            setAiFeedback({ ...response, marked_against: hasNotes ? "notes" : "study_design", marked_at: strictness });
            // Real XP arrives via onSessionComplete → awardXP; no cosmetic
            // popups here (they'd show amounts the engine never granted).
            toast({ title: "Feedback ready!" });
        } catch (error) {
            toast({ title: "Feedback failed", description: error.message || "Could not generate feedback.", variant: "destructive" });
        } finally {
            setIsGeneratingFeedback(false);
        }
    };

    const loadSessionHistory = async () => {
        try {
            const sessions = await base44.entities.BlurtingSession.list("-created_date", 50);
            setSessionHistory(sessions || []);
        } catch (error) { console.error(error); }
    };

    const deleteHistorySession = async (sessionId) => {
        if (!window.confirm("Delete this session?")) return;
        try {
            await base44.entities.BlurtingSession.delete(sessionId);
            toast({ title: "Session deleted" });
            loadSessionHistory();
        } catch {
            toast({ title: "Delete failed", variant: "destructive" });
        }
    };

    const saveSession = async () => {
        try {
            await base44.entities.BlurtingSession.create({
                subject_name: selectedSubject,
                topic: topic || "General Review",
                blurted_text: blurtedText,
                ai_feedback: aiFeedback ? JSON.stringify(aiFeedback) : "",
                session_duration: sessionStartTime ? Math.floor((Date.now() - sessionStartTime) / 60000) : 0,
                date: format(new Date(), "yyyy-MM-dd")
            });
        } catch (error) { console.error(error); }
    };

    const completeSession = async (confidence) => {
        await saveSession();
        aceDone("blurting", aiFeedback?.completeness_percentage ?? null);
        const totalDuration = sessionStartTime ? Math.floor((Date.now() - sessionStartTime) / 60000) : 0;
        await onSessionComplete({
            technique_name: "blurting",
            session_duration: Math.max(totalDuration, 1),
            subject: selectedSubject,
            topic: topic || "General Review",
            confidence_rating: confidence,
            notes: `Blurted ${blurtedText.length} characters. ${aiFeedback ? `AI Score: ${aiFeedback.completeness_percentage}%` : ''}`,
            date: format(new Date(), "yyyy-MM-dd")
        });
        setPhase("setup");
        setBlurtedText("");
        setAiFeedback(null);
        setSourceFiles([]);
        if (isFocusMode) { exitFullscreen(); setIsFocusMode(false); }
    };

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const wordCount = blurtedText.trim() ? blurtedText.trim().split(/\s+/).length : 0;
    const timerPercent = sessionStartTime ? Math.max(0, (timeLeft / (sessionDuration * 60)) * 100) : 100;

    /**
     * Turn the misses into flashcards.
     *
     * Without this, a blurt ends with a list of things you didn't know and no
     * mechanism that ever shows them to you again — which is most of the value
     * of having done it. The cards go into the same SM-2 schedule as
     * everything else, so the misses come back at the right interval.
     */
    const makeCardsFromMisses = async () => {
        const missed = aiFeedback?.points_missed || [];
        if (!missed.length) return;
        setMakingCards(true);
        try {
            const rows = missed
                .map(point => String(point || "").trim())
                .filter(Boolean)
                .map(text => ({
                    subject_name: selectedSubject || null,
                    topic: topic || "Blurting gaps",
                    // The miss IS the answer; the prompt asks for it back.
                    question: `${topic || selectedSubject || "This topic"}: what about — ${text.slice(0, 90)}?`,
                    answer: text,
                    is_active: true,
                    // Straight into the schedule as a weak spot, because it
                    // demonstrably is one.
                    is_weak_spot: true,
                    next_review_date: format(new Date(), "yyyy-MM-dd"),
                }));
            await base44.entities.Flashcard.bulkCreate(rows);
            const made = rows.length;
            setCardsMade(made);
            toast({
                title: `${made} card${made === 1 ? "" : "s"} made`,
                description: "They're due now and flagged as weak spots, so they'll come back until they stick.",
            });
        } catch (e) {
            toast({ title: "Couldn't make the cards", description: e.message, variant: "destructive" });
        } finally {
            setMakingCards(false);
        }
    };

    // Computed here, not inside the picks component: the card has to know
    // whether there are any before it draws the rule handing over to the
    // manual fields. See WhatToTest.
    const picks = useMemo(
        () => suggestTopics({
            flashcards: ownFlashcards, assessments: ownAssessments,
            techniques: ownTechniques, limit: 4,
        }),
        [ownFlashcards, ownAssessments, ownTechniques]);

    /**
     * A pick STARTS the blurt, the way Active Recall's does.
     *
     * It used to set two fields and stop, which made one affordance mean two
     * different things on two sibling screens — and left the student scrolling
     * past the card to find a button, which is the exact failure
     * `startFromSuggestion` was written to end. `showFocusPrompt` is set
     * directly rather than through `startSession`, because the subject is set
     * in this same tick and that guard would read the state before it updates.
     */
    const startFromSuggestion = (sug) => {
        if (sug.subject) setSelectedSubject(sug.subject);
        setTopic(sug.topic || "");
        setShowFocusPrompt(true);
    };

    const renderSetup = () => (
        <motion.div key="setup" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="space-y-5">

            {/* ── ONE CARD ─────────────────────────────────────────────────
                Three panels used to ask one question between them — Ace's
                picks, "Session Setup", and a notes upload sitting under a
                "How Blurting Works" list. The picks lead, a rule hands over to
                the manual fields, and the notes sit with the thing they are
                notes FOR. */}
            <div className="card-soft p-5 sm:p-6 overflow-hidden">
                <WhatToTest
                    picks={picks}
                    flashcards={ownFlashcards}
                    assessments={ownAssessments}
                    techniques={ownTechniques}
                    maps={ownMaps}
                    verb="Blurt"
                    onPick={startFromSuggestion}
                />

                {picks.length > 0 && (
                    <div className="flex items-center gap-3 my-5">
                        <span className="h-px flex-1 bg-border" />
                        <span className="stat-label text-muted-foreground">Or set it up yourself</span>
                        <span className="h-px flex-1 bg-border" />
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label className="text-sm font-medium text-muted-foreground">Subject</Label>
                        <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                            <SelectTrigger className="h-11 border-2 border-border focus:border-xp rounded-xl">
                                <SelectValue placeholder="Choose a subject..." />
                            </SelectTrigger>
                            <SelectContent>
                                {userSubjects.map(s => (
                                    <SelectItem key={s.id} value={s.subject_name}>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color || 'hsl(var(--xp))' }} />
                                            {s.subject_name}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-sm font-medium text-muted-foreground">
                            Topic <span className="text-muted-foreground/60 font-normal">(optional)</span>
                        </Label>
                        <Input
                            placeholder="e.g. French Revolution"
                            value={topic}
                            onChange={e => setTopic(e.target.value)}
                            className="h-11 border-2 border-border focus:border-xp rounded-xl"
                        />
                    </div>
                </div>

                {/* The row is the shared control now — this and Active
                    Recall's question-count row were two copies of one button
                    sitting on two sibling screens. */}
                <div className="mt-4 space-y-4">
                    <Field label="How long" tone="xp">
                        <Segmented tone="xp" value={sessionDuration} onChange={setSessionDuration}
                            options={[5, 10, 15, 20].map(m => ({ value: m, label: `${m}m` }))} />
                    </Field>

                    <Field label="What to write" tone="xp"
                        hint={`Ace asks for ${FOCUS_BRIEF[focus].ask}, and marks it that way.`}>
                        <Segmented tone="xp" size="sm" value={focus} onChange={setFocus}
                            options={[
                                { value: "all",      label: "Everything", sub: "breadth" },
                                { value: "links",    label: "The links",  sub: "why and how" },
                                { value: "terms",    label: "Key terms",  sub: "precision" },
                                { value: "evidence", label: "Evidence",   sub: "cases, data" },
                            ]} />
                    </Field>

                    {/* The level rides with the result, so two blurts marked
                        differently cannot be read as one score going up. */}
                    <Field label="How hard to mark" tone="xp">
                        <Segmented tone="xp" size="sm" value={strictness} onChange={setStrictness}
                            options={[
                                { value: "gentle",   label: "Gentle",   sub: "first pass" },
                                { value: "standard", label: "Standard", sub: "practice task" },
                                { value: "examiner", label: "Examiner", sub: "SAC marking" },
                            ]} />
                    </Field>
                </div>

                {/* ── Working from ─────────────────────────────────────────
                    Marking works without notes, and saying so HERE is the
                    whole point: the upload used to sit in its own panel, which
                    made the marking look gated behind it. That is the shape
                    this file's own history records — a feature almost nobody
                    saw because it looked optional-but-required. */}
                <div className="mt-5 pt-5 border-t border-border">
                    <SourceRow
                        files={sourceFiles}
                        hint="Optional. Marking works without them — add notes and it marks against what your class covered rather than the Study Design."
                        onPick={async (picked) => setSourceFiles(await acceptFiles(picked, { toast, existing: sourceFiles }))}
                        onRemove={(i) => setSourceFiles(prev => prev.filter((_, idx) => idx !== i))}
                    />
                </div>

                <Button
                    onClick={startSession}
                    className="w-full h-12 mt-5 bg-xp hover:bg-xp/90 text-white font-semibold rounded-xl shadow-soft gap-2"
                >
                    <Play className="w-5 h-5" /> Start blurting ({sessionDuration} min)
                </Button>

                {/* ── What a blurt IS ──────────────────────────────────────
                    Four lines, under the button rather than in a panel beside
                    it: it is read once, by somebody who has not done this
                    before, and it was taking a third of the screen on every
                    visit from everybody who had. */}
                <ol className="mt-5 pt-5 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                    {[
                        "Close your notes completely",
                        "Write everything you remember",
                        "Keep writing — no editing",
                        "Ace marks what you missed",
                    ].map((text, i) => (
                        <li key={text} className="flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded-lg bg-xp/15 text-xp text-[11px] font-black
                                flex items-center justify-center flex-shrink-0 mt-px">{i + 1}</span>
                            <p className="text-xs text-muted-foreground leading-snug">{text}</p>
                        </li>
                    ))}
                </ol>

                <div className="mt-4 pt-4 border-t border-border flex justify-center">
                    <button
                        onClick={() => { loadSessionHistory(); setShowSessionHistory(!showSessionHistory); }}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <FolderOpen className="w-3.5 h-3.5" /> Previous blurts
                    </button>
                </div>
            </div>

            {/* History */}
            <AnimatePresence>
                {showSessionHistory && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        className="card-soft p-6"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-foreground flex items-center gap-2">
                                <FolderOpen className="w-4 h-4 text-xp" /> Previous Sessions
                            </h3>
                            <button onClick={() => setShowSessionHistory(false)} className="text-muted-foreground/60 hover:text-muted-foreground">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        {sessionHistory.length === 0 ? (
                            <div className="flex flex-col items-center text-center gap-3 py-10">
                                <div className="w-12 h-12 rounded-2xl bg-xp/10 flex items-center justify-center">
                                    <PenTool className="w-6 h-6 text-xp" />
                                </div>
                                <div>
                                    <p className="font-bold text-foreground">No blurts yet</p>
                                    <p className="text-sm text-muted-foreground mt-1 max-w-[260px]">Brain-dump everything you remember on a topic — past sessions land here for review.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                                {sessionHistory.map(session => {
                                    let score = null;
                                    if (session.ai_feedback) {
                                        try { score = JSON.parse(session.ai_feedback).completeness_percentage; } catch { }
                                    }
                                    return (
                                        <div
                                            key={session.id}
                                            onClick={() => setSelectedHistorySession(session)}
                                            className="group flex items-start justify-between p-4 bg-secondary/50 hover:bg-xp/5 rounded-2xl border border-border hover:border-xp/30 cursor-pointer transition-all"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-foreground text-sm truncate">{session.subject_name}</p>
                                                <p className="text-xs text-muted-foreground truncate mt-0.5">{session.topic || "General Review"}</p>
                                                <div className="flex items-center gap-2 mt-2">
                                                    {score !== null && (
                                                        <span className={`pill ${scorePillClass(score)} text-[11px] py-0.5`}>
                                                            {score}%
                                                        </span>
                                                    )}
                                                    <span className="text-xs text-muted-foreground/60">{fmtDate(session.date, "MMM d")}</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={e => { e.stopPropagation(); deleteHistorySession(session.id); }}
                                                className="opacity-0 group-hover:opacity-100 text-streak/60 hover:text-streak ml-2 flex-shrink-0 transition-opacity"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );

    const renderActive = () => (
        <motion.div key="active" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
            <div className="card-soft overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-xp/5">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-xp rounded-xl flex items-center justify-center">
                            <PenTool className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <p className="font-semibold text-foreground text-sm">{selectedSubject}</p>
                            {topic && <p className="text-xs text-muted-foreground">{topic}</p>}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Timer with progress ring */}
                        <div className="relative flex items-center gap-2">
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-mono font-bold transition-colors ${timeLeft < 60 ? 'bg-streak/10 text-streak animate-pulse' : 'bg-xp/10 text-xp'}`}>
                                <Clock className="w-3.5 h-3.5" />
                                {formatTime(timeLeft)}
                            </div>
                        </div>
                        {!isFocusMode && (
                            <Button variant="outline" size="sm" onClick={() => { setIsFocusMode(true); enterFullscreen(); }} className="gap-1.5 text-xs border-border hover:border-xp/40">
                                <Maximize className="w-3.5 h-3.5" /> Focus
                            </Button>
                        )}
                    </div>
                </div>

                {/* Timer progress bar */}
                <div className="h-1 bg-secondary">
                    <motion.div
                        className={`h-full transition-colors ${timerPercent < 20 ? 'bg-streak' : 'bg-xp'}`}
                        style={{ width: `${timerPercent}%` }}
                        transition={{ duration: 1 }}
                    />
                </div>

                <div className="p-6 space-y-4">
                    {/* Prompt */}
                    <div className="bg-xp/5 border border-xp/20 rounded-2xl p-4 flex items-start gap-3">
                        <div className="w-6 h-6 bg-xp/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Brain className="w-3.5 h-3.5 text-xp" />
                        </div>
                        <p className="text-sm text-foreground font-medium leading-relaxed">
                            Write <strong>{FOCUS_BRIEF[focus].ask}</strong> about <strong>{topic || selectedSubject}</strong> from memory — no notes, no editing, keep going until the clock stops.
                        </p>
                    </div>

                    {/* Writing area */}
                    <div className="relative">
                        <Textarea
                            ref={textareaRef}
                            placeholder="Start writing... every detail counts. Key terms, dates, processes, examples — get it all out."
                            value={blurtedText}
                            onChange={e => setBlurtedText(e.target.value)}
                            className="w-full min-h-64 resize-none border-2 border-border focus:border-xp rounded-2xl p-4 text-base bg-surface placeholder:text-muted-foreground/60 transition-colors leading-relaxed"
                        />
                    </div>

                    {/* Stats + Finish */}
                    <div className="flex items-center justify-between bg-secondary/50 rounded-2xl px-4 py-3 border border-border">
                        <div className="flex items-center gap-4">
                            <div className="text-center">
                                <p className="text-lg font-bold text-foreground">{wordCount}</p>
                                <p className="text-xs text-muted-foreground/60">words</p>
                            </div>
                            <div className="w-px h-8 bg-border" />
                            <div className="text-center">
                                <p className="text-lg font-bold text-foreground">{blurtedText.length}</p>
                                <p className="text-xs text-muted-foreground/60">characters</p>
                            </div>
                            {wordCount > 0 && (
                                <>
                                    <div className="w-px h-8 bg-border" />
                                    <div className="flex items-center gap-1.5">
                                        <div className={`w-2 h-2 rounded-full ${wordCountDotClass(wordCount)}`} />
                                        <span className="text-xs text-muted-foreground">
                                            {wordCount >= 100 ? 'Great depth!' : wordCount >= 50 ? 'Keep going' : 'Write more'}
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                        <Button
                            onClick={() => setPhase("review")}
                            className="h-10 bg-xp hover:bg-xp/90 text-white rounded-xl font-medium gap-2 shadow-soft"
                        >
                            <CheckCircle className="w-4 h-4" /> Done
                        </Button>
                    </div>
                </div>
            </div>
        </motion.div>
    );

    const renderReview = () => (
        <motion.div key="review" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
            {/* AI Feedback section.

                This whole panel used to render only when notes had been
                uploaded — the marking existed, it was just invisible to every
                student who skipped an optional-looking upload on the setup
                screen. Which is most of them, and is the likeliest reason
                blurting sits at zero in the usage audit: the payoff was
                unreachable. It marks either way now. */}
            <div className="card-soft p-6">
                {!aiFeedback ? (
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-chart-4/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                            <Sparkles className="w-5 h-5 text-chart-4" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-foreground mb-1">Check what you missed</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                {sourceFiles.length > 0
                                    ? "Compare your recall against your notes to see what you got right and what you missed."
                                    : `See what you got right and what you left out, against the VCE Study Design for ${selectedSubject || "this subject"}.`}
                            </p>
                            <Button
                                onClick={handleGenerateFeedback}
                                disabled={isGeneratingFeedback || !blurtedText.trim()}
                                className="h-11 bg-xp hover:bg-xp/90 text-white rounded-xl font-medium gap-2 shadow-soft"
                            >
                                {isGeneratingFeedback ? (
                                    <><AceShuffle size="sm" /> Analysing your recall...</>
                                ) : (
                                    <><Wand2 className="w-4 h-4" /> Mark what I missed</>
                                )}
                            </Button>
                            {sourceFiles.length === 0 && (
                                <p className="text-xs text-muted-foreground/80 mt-3 leading-snug">
                                    Upload your notes on the setup screen next time and it marks against
                                    what your class actually covered instead.
                                </p>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {/* Score */}
                        <div className="flex items-center gap-6 pb-5 border-b border-border">
                            <ScoreRing percentage={aiFeedback.completeness_percentage} />
                            <div className="flex-1">
                                <h3 className="font-bold text-foreground text-xl mb-1">AI Feedback</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">{aiFeedback.overall_assessment}</p>
                                <p className="text-xs text-muted-foreground/70 mt-2">
                                    {aiFeedback.marked_against === "notes"
                                        ? "Marked against the notes you uploaded"
                                        : `Marked against the VCE Study Design for ${selectedSubject || "this subject"} — not against your class notes`}
                                    {aiFeedback.marked_at && aiFeedback.marked_at !== "standard"
                                        && `, at the ${aiFeedback.marked_at} bar`}.
                                </p>
                            </div>
                        </div>

                        {/* Points covered */}
                        {aiFeedback.points_covered?.length > 0 && (
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2.5 flex items-center gap-1.5">
                                    <CheckCircle className="w-3.5 h-3.5" /> What you remembered ({aiFeedback.points_covered.length})
                                </p>
                                <div className="space-y-1.5">
                                    {aiFeedback.points_covered.map((point, idx) => (
                                        <motion.div
                                            key={idx}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                            className="flex items-start gap-2.5 bg-primary/5 border border-primary/20 rounded-xl px-3.5 py-2.5"
                                        >
                                            <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                                            <span className="text-sm text-foreground">{point}</span>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Points missed */}
                        {aiFeedback.points_missed?.length > 0 && (
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-streak mb-2.5 flex items-center gap-1.5">
                                    <AlertCircle className="w-3.5 h-3.5" /> What you missed ({aiFeedback.points_missed.length})
                                </p>
                                <div className="space-y-1.5">
                                    {aiFeedback.points_missed.map((point, idx) => (
                                        <motion.div
                                            key={idx}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                            className="flex items-start gap-2.5 bg-streak/5 border border-streak/20 rounded-xl px-3.5 py-2.5"
                                        >
                                            <X className="w-4 h-4 text-streak mt-0.5 flex-shrink-0" />
                                            <span className="text-sm text-foreground">{point}</span>
                                        </motion.div>
                                    ))}
                                </div>
                                {/* The loop-closer. A list of things you
                                    didn't know, with no mechanism that ever
                                    shows them to you again, is most of the
                                    value of the blurt thrown away. */}
                                <Button onClick={makeCardsFromMisses} disabled={makingCards || cardsMade > 0}
                                    className="mt-3 w-full gap-2 rounded-xl bg-streak hover:bg-streak/90 text-white">
                                    {makingCards ? <AceShuffle size="sm" />
                                        : cardsMade > 0 ? <Check className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
                                    {cardsMade > 0
                                        ? `${cardsMade} card${cardsMade === 1 ? "" : "s"} made — due now`
                                        : `Turn these ${aiFeedback.points_missed.length} into flashcards`}
                                </Button>
                            </div>
                        )}

                        {/* Accuracy issues */}
                        {aiFeedback.accuracy_issues && (
                            <div className="bg-xp/5 border border-xp/20 rounded-2xl p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-xp mb-2">Accuracy Issues</p>
                                <p className="text-sm text-foreground">{aiFeedback.accuracy_issues}</p>
                            </div>
                        )}

                        {/* Suggestions */}
                        {aiFeedback.suggestions?.length > 0 && (
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-chart-4 mb-2.5 flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5" /> Study Suggestions
                                </p>
                                <div className="space-y-1.5">
                                    {aiFeedback.suggestions.map((s, idx) => (
                                        <motion.div
                                            key={idx}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                            className="flex items-start gap-2.5 bg-chart-4/5 border border-chart-4/20 rounded-xl px-3.5 py-2.5"
                                        >
                                            <ChevronRight className="w-4 h-4 text-chart-4 mt-0.5 flex-shrink-0" />
                                            <span className="text-sm text-foreground">{s}</span>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Your blurted text */}
            <div className="card-soft overflow-hidden">
                <div className="px-6 py-4 border-b border-border">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-foreground">Your Brain Dump</h3>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span><span className="font-semibold text-foreground">{wordCount}</span> words</span>
                            <span>·</span>
                            <span><span className="font-semibold text-foreground">{blurtedText.length}</span> chars</span>
                        </div>
                    </div>
                </div>
                <div className="p-6">
                    <div className="bg-secondary/50 rounded-2xl p-4 border border-border whitespace-pre-wrap text-sm text-foreground leading-relaxed font-mono max-h-64 overflow-y-auto">
                        {blurtedText || <em className="text-muted-foreground/60 not-italic">Nothing written yet.</em>}
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
                <Button
                    onClick={() => { setPhase('setup'); if (isFocusMode) { exitFullscreen(); setIsFocusMode(false); } }}
                    variant="outline"
                    className="flex-1 h-12 border-2 border-border hover:border-xp/40 hover:bg-xp/5 rounded-xl font-medium gap-2"
                >
                    <RotateCcw className="w-4 h-4" /> New Session
                </Button>
                <Button
                    onClick={() => { completeSession(4); if (isFocusMode) { exitFullscreen(); setIsFocusMode(false); } }}
                    className="flex-1 h-12 bg-xp hover:bg-xp/90 text-white rounded-xl font-medium gap-2 shadow-soft"
                >
                    <CheckCircle className="w-4 h-4" /> Save & Finish
                </Button>
            </div>
        </motion.div>
    );

    const renderContent = () => (
        <AnimatePresence mode="wait">
            {phase === "setup" && renderSetup()}
            {phase === "active" && renderActive()}
            {phase === "review" && renderReview()}
        </AnimatePresence>
    );

    // Fixed dark in both themes. `bg-foreground` over `text-surface` is an
    // inversion that only holds in light mode and turned this into a white
    // page in the dark; see the longer note in PomodoroTimer.
    if (isFocusMode) {
        return (
            <div ref={focusModeRef} className="fixed inset-0 z-[10000] bg-[#0A121F]">
                <div className="absolute inset-0 bg-xp/10" />
                <div className="relative z-10 flex flex-col h-full">
                    <div className="flex items-center justify-between px-6 py-4">
                        <div className="flex items-center gap-2 text-white/60 text-sm">
                            <PenTool className="w-4 h-4" />
                            Blurting — Focus Mode
                        </div>
                        <Button onClick={() => { exitFullscreen(); setIsFocusMode(false); }} variant="ghost" className="text-white/60 hover:text-white hover:bg-white/10 gap-2">
                            <X className="w-4 h-4" /> Exit Focus
                        </Button>
                    </div>
                    <div className="flex-1 overflow-auto px-6 pb-6">
                        <div className="max-w-3xl mx-auto card-soft p-8">
                            {renderContent()}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center gap-4 px-1">
                <div className="w-12 h-12 bg-xp rounded-2xl flex items-center justify-center shadow-soft">
                    <PenTool className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-foreground">Blurting Method</h2>
                    <p className="text-sm text-muted-foreground">Write everything from memory, then check what you missed</p>
                </div>
            </div>

            {renderContent()}

            {/* Focus prompt */}
            <Dialog open={showFocusPrompt} onOpenChange={setShowFocusPrompt}>
                <DialogContent className="max-w-sm rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl">Ready to blurt?</DialogTitle>
                        <DialogDescription>
                            You have <strong>{sessionDuration} minutes</strong>. Focus Mode goes fullscreen for a distraction-free environment.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                        <Button variant="outline" onClick={() => handleStartConfirmed(false)} className="h-11 rounded-xl border-2">
                            Normal Mode
                        </Button>
                        <Button onClick={() => handleStartConfirmed(true)} className="h-11 bg-xp hover:bg-xp/90 text-white rounded-xl gap-2">
                            <Maximize className="w-4 h-4" /> Focus Mode
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* History detail */}
            <Dialog open={!!selectedHistorySession} onOpenChange={() => setSelectedHistorySession(null)}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl">
                    <DialogHeader>
                        <DialogTitle>{selectedHistorySession?.subject_name}</DialogTitle>
                        <DialogDescription>
                            {selectedHistorySession?.topic || "General Review"} · {fmtDate(selectedHistorySession?.date, "MMMM d, yyyy", "")}
                        </DialogDescription>
                    </DialogHeader>
                    {selectedHistorySession && (
                        <div className="space-y-4">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Brain Dump</p>
                                <div className="bg-secondary/50 rounded-2xl p-4 border border-border whitespace-pre-wrap text-sm text-foreground font-mono max-h-48 overflow-y-auto">
                                    {selectedHistorySession.blurted_text || <em className="text-muted-foreground/60">No text</em>}
                                </div>
                                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                                    <span>{selectedHistorySession.blurted_text?.split(/\s+/).filter(w => w).length || 0} words</span>
                                    <span>·</span>
                                    <span>{selectedHistorySession.session_duration}min session</span>
                                </div>
                            </div>
                            {selectedHistorySession.ai_feedback && (() => {
                                try {
                                    const fb = JSON.parse(selectedHistorySession.ai_feedback);
                                    return (
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-4 bg-xp/5 rounded-2xl p-4 border border-xp/20">
                                                <ScoreRing percentage={fb.completeness_percentage} size={80} />
                                                <div>
                                                    <p className="font-semibold text-foreground">AI Score</p>
                                                    <p className="text-sm text-muted-foreground mt-1">{fb.overall_assessment}</p>
                                                </div>
                                            </div>
                                            {fb.points_covered?.length > 0 && (
                                                <div className="bg-primary/5 rounded-2xl p-4 border border-primary/20">
                                                    <p className="text-xs font-semibold text-primary mb-2">Points Covered</p>
                                                    <ul className="space-y-1">{fb.points_covered.map((p, i) => <li key={i} className="text-sm text-foreground flex items-start gap-2"><Check className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />{p}</li>)}</ul>
                                                </div>
                                            )}
                                            {fb.points_missed?.length > 0 && (
                                                <div className="bg-streak/5 rounded-2xl p-4 border border-streak/20">
                                                    <p className="text-xs font-semibold text-streak mb-2">Points Missed</p>
                                                    <ul className="space-y-1">{fb.points_missed.map((p, i) => <li key={i} className="text-sm text-foreground flex items-start gap-2"><X className="w-3.5 h-3.5 text-streak mt-0.5 flex-shrink-0" />{p}</li>)}</ul>
                                                </div>
                                            )}
                                        </div>
                                    );
                                } catch { return null; }
                            })()}
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={() => setSelectedHistorySession(null)} className="bg-xp hover:bg-xp/90 text-white rounded-xl">Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
