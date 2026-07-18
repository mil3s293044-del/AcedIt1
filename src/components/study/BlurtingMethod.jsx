import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { PenTool, Play, Clock, CheckCircle, RotateCcw, Maximize, Upload, Wand2, Loader2, X, Sparkles, FolderOpen, Trash2, FileText, AlertCircle, Lightbulb, Brain, Check, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { FEATURES, checkLiveTier } from "@/lib/tierAccess";
import { getExaminerPrompt } from "@/lib/subjectExaminerPrompts";

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
    const [selectedSubject, setSelectedSubject] = useState("");
    const [topic, setTopic] = useState("");
    const [blurtedText, setBlurtedText] = useState("");
    const [sessionStartTime, setSessionStartTime] = useState(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [isFocusMode, setIsFocusMode] = useState(false);
    const [showFocusPrompt, setShowFocusPrompt] = useState(false);
    const [sourceFiles, setSourceFiles] = useState([]);
    const [aiFeedback, setAiFeedback] = useState(null);
    const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
    const [userSubjects, setUserSubjects] = useState([]);
    const [showSessionHistory, setShowSessionHistory] = useState(false);
    const [sessionHistory, setSessionHistory] = useState([]);
    const [selectedHistorySession, setSelectedHistorySession] = useState(null);
    const [sessionDuration, setSessionDuration] = useState(10);
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

    const handleGenerateFeedback = async () => {
        if (!sourceFiles.length || !blurtedText.trim()) {
            toast({ title: "Missing info", description: "Upload notes and write your blurt first.", variant: "destructive" });
            return;
        }

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
            const uploaded = await Promise.all(sourceFiles.map(f => base44.integrations.Core.UploadFile({ file: f }).then(r => ({ url: r.file_url, name: f.name, ext: f.name.split('.').pop().toLowerCase() }))));
            const docxPptx = uploaded.filter(f => f.ext === 'docx' || f.ext === 'pptx');
            const directFiles = uploaded.filter(f => f.ext !== 'docx' && f.ext !== 'pptx');
            let documentContext = '';
            for (const f of docxPptx) {
                const textResult = await base44.functions.invoke('extractDocumentText', { file_url: f.url });
                documentContext += `\n\n[${f.name}]:\n${textResult.data?.text || ''}`;
            }
            const response = await base44.integrations.Core.InvokeLLM({
                feature: "blurting",
                prompt: `${getExaminerPrompt(selectedSubject)}

Evaluate this ${selectedSubject} "blurting" attempt against the source material (${sourceFiles.length} file(s)) using VCE Study Design criteria.

Student's Blurted Text:
${blurtedText}
${documentContext}
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
            setAiFeedback(response);
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
        } catch (error) {
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

    const renderSetup = () => (
        <motion.div key="setup" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                {/* Left: Setup */}
                <div className="lg:col-span-3 card-soft p-6 space-y-5">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-foreground text-lg">Session Setup</h3>
                        <button
                            onClick={() => { loadSessionHistory(); setShowSessionHistory(!showSessionHistory); }}
                            className="flex items-center gap-1.5 text-sm text-xp hover:text-xp/80 font-medium"
                        >
                            <FolderOpen className="w-4 h-4" /> History
                        </button>
                    </div>

                    <div className="space-y-4">
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
                            <Label className="text-sm font-medium text-muted-foreground">Topic <span className="text-muted-foreground/60 font-normal">(optional)</span></Label>
                            <Input
                                placeholder="e.g. French Revolution"
                                value={topic}
                                onChange={e => setTopic(e.target.value)}
                                className="h-11 border-2 border-border focus:border-xp rounded-xl"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium text-muted-foreground">Session duration</Label>
                            <div className="flex gap-2">
                                {[5, 10, 15, 20].map(min => (
                                    <button
                                        key={min}
                                        onClick={() => setSessionDuration(min)}
                                        className={`flex-1 h-10 rounded-xl text-sm font-semibold border-2 transition-all ${
                                            sessionDuration === min
                                                ? 'bg-xp border-xp text-white shadow-soft'
                                                : 'border-border text-muted-foreground hover:border-xp/40 hover:bg-xp/5'
                                        }`}
                                    >
                                        {min}m
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <Button
                        onClick={startSession}
                        className="w-full h-12 bg-xp hover:bg-xp/90 text-white font-semibold rounded-xl shadow-soft gap-2"
                    >
                        <Play className="w-5 h-5" /> Start Blurting ({sessionDuration} min)
                    </Button>
                </div>

                {/* Right: How it works + notes upload */}
                <div className="lg:col-span-2 space-y-4">
                    {/* How it works */}
                    <div className="card-soft bg-xp/5 border-xp/20 p-5 space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-xp rounded-xl flex items-center justify-center">
                                <Lightbulb className="w-3.5 h-3.5 text-white" />
                            </div>
                            <h3 className="font-semibold text-foreground text-sm">How Blurting Works</h3>
                        </div>
                        {[
                            { n: "1", text: "Close your notes completely" },
                            { n: "2", text: "Write EVERYTHING you remember" },
                            { n: "3", text: "Don't stop — just keep writing" },
                            { n: "4", text: "AI checks what you missed" },
                        ].map(step => (
                            <div key={step.n} className="flex items-start gap-3">
                                <span className="w-5 h-5 rounded-lg bg-xp/20 text-xp text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{step.n}</span>
                                <p className="text-sm text-foreground">{step.text}</p>
                            </div>
                        ))}
                    </div>

                    {/* Upload notes */}
                    <div className="card-soft p-5 space-y-3">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-xp" />
                            <h3 className="font-semibold text-foreground text-sm">Upload Notes for AI Marking</h3>
                        </div>
                        <div className={`rounded-2xl border-2 border-dashed transition-all ${sourceFiles.length ? 'border-xp/50 bg-xp/5' : 'border-border bg-secondary/50'}`}>
                            <label className="flex items-center gap-3 p-3.5 cursor-pointer hover:bg-xp/5 transition-colors rounded-2xl">
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${sourceFiles.length ? 'bg-xp/10' : 'bg-surface'}`}>
                                    <FileText className={`w-4 h-4 ${sourceFiles.length ? 'text-xp' : 'text-muted-foreground/60'}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium ${sourceFiles.length ? 'text-xp' : 'text-muted-foreground'}`}>
                                        {sourceFiles.length ? `${sourceFiles.length} file${sourceFiles.length > 1 ? 's' : ''} selected` : 'Upload notes'}
                                    </p>
                                    <p className="text-xs text-muted-foreground/60">PDF, DOCX, PPTX, TXT — multiple files</p>
                                </div>
                                <input type="file" className="hidden" multiple onChange={e => {
                                    const files = Array.from(e.target.files || []);
                                    setSourceFiles(prev => { const names = new Set(prev.map(f => f.name)); return [...prev, ...files.filter(f => !names.has(f.name))]; });
                                }} accept=".pdf,.docx,.pptx,.txt" />
                            </label>
                            {sourceFiles.length > 0 && (
                                <div className="px-3.5 pb-3 space-y-1" onClick={e => e.stopPropagation()}>
                                    {sourceFiles.map((f, i) => (
                                        <div key={i} className="flex items-center gap-2 bg-surface rounded-lg px-2 py-1 border border-xp/20">
                                            <span className="flex-1 text-xs text-foreground truncate">{f.name}</span>
                                            <button type="button" onClick={() => setSourceFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground/60 hover:text-streak">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
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
                                                    <span className="text-xs text-muted-foreground/60">{format(new Date(session.date), "MMM d")}</span>
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
                            Write <strong>everything</strong> you can recall about <strong>{topic || selectedSubject}</strong> from memory. Don't stop, don't look at notes — just brain dump!
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
            {/* AI Feedback section */}
            {sourceFiles.length > 0 ? (
                <div className="card-soft p-6">
                    {!aiFeedback ? (
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 bg-chart-4/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                                <Sparkles className="w-5 h-5 text-chart-4" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-foreground mb-1">AI Marking</h3>
                                <p className="text-sm text-muted-foreground mb-4">Compare your recall against your notes to see what you got right and what you missed.</p>
                                <Button
                                    onClick={handleGenerateFeedback}
                                    disabled={isGeneratingFeedback || !blurtedText.trim()}
                                    className="h-11 bg-xp hover:bg-xp/90 text-white rounded-xl font-medium gap-2 shadow-soft"
                                >
                                    {isGeneratingFeedback ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Analysing your recall...</>
                                    ) : (
                                        <><Wand2 className="w-4 h-4" /> Mark My Blurt</>
                                    )}
                                </Button>
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
            ) : (
                <div className="card-soft bg-xp/5 border-xp/20 p-5 flex items-center gap-4">
                    <Sparkles className="w-5 h-5 text-xp flex-shrink-0" />
                    <p className="text-sm text-foreground">
                        <span className="font-semibold">Next time:</span> Upload your PDF notes before the session to get AI feedback comparing your recall to your source material.
                    </p>
                </div>
            )}

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

    if (isFocusMode) {
        return (
            <div ref={focusModeRef} className="fixed inset-0 z-[10000] bg-foreground">
                <div className="absolute inset-0 bg-xp/10" />
                <div className="relative z-10 flex flex-col h-full">
                    <div className="flex items-center justify-between px-6 py-4">
                        <div className="flex items-center gap-2 text-background/60 text-sm">
                            <PenTool className="w-4 h-4" />
                            Blurting — Focus Mode
                        </div>
                        <Button onClick={() => { exitFullscreen(); setIsFocusMode(false); }} variant="ghost" className="text-background/60 hover:text-background hover:bg-background/10 gap-2">
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
                            {selectedHistorySession?.topic || "General Review"} · {selectedHistorySession && format(new Date(selectedHistorySession.date), "MMMM d, yyyy")}
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
