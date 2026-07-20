import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Brain, Play, Clock, CheckCircle, Upload, Wand2, Maximize, ArrowRight, ArrowLeft, RotateCcw, X, FolderOpen, Trash2, Sparkles, Loader2, ChevronDown, ChevronUp, FileText, Zap } from "lucide-react";
import { format } from "date-fns";
import ReactMarkdown from 'react-markdown';
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { FEATURES, checkLiveTier } from "@/lib/tierAccess";
import { getExaminerPrompt } from "@/lib/subjectExaminerPrompts";
import { recordStudyAndGetStreak } from "@/components/shared/streakHelpers";

// Static class lookups so Tailwind JIT can see every utility.
const verdictConfig = {
    "Correct": {
        dot: "bg-primary",
        text: "text-primary",
        bg: "bg-primary/10",
        border: "border-primary/30",
        label: "Correct ✓",
    },
    "Partially Correct": {
        dot: "bg-xp",
        text: "text-xp",
        bg: "bg-xp/10",
        border: "border-xp/30",
        label: "Partial ◐",
    },
    "Incorrect": {
        dot: "bg-streak",
        text: "text-streak",
        bg: "bg-streak/10",
        border: "border-streak/30",
        label: "Incorrect ✗",
    },
};

function QuestionCard({ question, index, total, answer, onAnswerChange, onNext, onPrev, isLast }) {
    const progress = ((index + 1) / total) * 100;
    const wordCount = answer.trim() ? answer.trim().split(/\s+/).length : 0;

    return (
        <div className="flex flex-col h-full">
            {/* Progress bar */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">Question {index + 1} of {total}</span>
                    <span className="text-sm font-medium text-chart-4">{Math.round(progress)}% complete</span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-chart-4 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.4 }}
                    />
                </div>
                {/* Dot indicators */}
                <div className="flex gap-1.5 mt-3 flex-wrap">
                    {Array.from({ length: total }).map((_, i) => (
                        <div
                            key={i}
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                                i === index ? 'w-6 bg-chart-4' :
                                i < index ? 'w-3 bg-chart-4/50' : 'w-3 bg-secondary'
                            }`}
                        />
                    ))}
                </div>
            </div>

            {/* Question */}
            <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-chart-4/10 rounded-2xl p-6 border border-chart-4/20 mb-5"
            >
                <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-chart-4 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                        {index + 1}
                    </div>
                    <p className="text-lg font-medium text-foreground leading-relaxed">{question}</p>
                </div>
            </motion.div>

            {/* Answer textarea */}
            <div className="flex-1 relative">
                <Textarea
                    placeholder="Write everything you can recall — don't hold back. No peeking at notes!"
                    value={answer}
                    onChange={(e) => onAnswerChange(e.target.value)}
                    className="w-full h-48 resize-none border-2 border-border focus:border-chart-4 rounded-2xl p-4 text-base bg-surface placeholder:text-muted-foreground/60 transition-colors"
                    autoFocus
                />
                <div className="absolute bottom-3 right-4 text-xs text-muted-foreground/60">
                    {wordCount} {wordCount === 1 ? 'word' : 'words'}
                </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-5 pt-5 border-t border-border">
                <Button
                    onClick={onPrev}
                    disabled={index === 0}
                    variant="outline"
                    className="gap-2 border-2 border-border hover:border-chart-4/40 hover:bg-chart-4/10 disabled:opacity-30"
                >
                    <ArrowLeft className="w-4 h-4" /> Previous
                </Button>
                <Button
                    onClick={onNext}
                    className="gap-2 px-6 bg-chart-4 hover:bg-chart-4/90 text-white shadow-soft"
                >
                    {isLast ? (
                        <><CheckCircle className="w-4 h-4" /> Finish Session</>
                    ) : (
                        <>Next <ArrowRight className="w-4 h-4" /></>
                    )}
                </Button>
            </div>
        </div>
    );
}

function ReviewItem({ question, answer, result, index }) {
    const [expanded, setExpanded] = useState(false);
    const cfg = result ? verdictConfig[result.verdict] : null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="card-soft overflow-hidden"
        >
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-start gap-4 p-5 hover:bg-secondary/50 transition-colors text-left"
            >
                <div className="w-8 h-8 rounded-xl bg-chart-4/15 text-chart-4 flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                    {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground leading-snug">{question}</p>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                        {answer || <em>No answer provided</em>}
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    {cfg && (
                        <span className={`pill ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
                            {cfg.label}
                        </span>
                    )}
                    {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground/60" /> : <ChevronDown className="w-4 h-4 text-muted-foreground/60" />}
                </div>
            </button>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-border overflow-hidden"
                    >
                        <div className="p-5 space-y-4">
                            {/* Your answer */}
                            <div>
                                <p className="stat-label mb-2">Your Answer</p>
                                <div className="bg-secondary/50 rounded-xl p-4 text-sm text-foreground border border-border">
                                    {answer || <em className="text-muted-foreground/60">No answer provided</em>}
                                </div>
                            </div>
                            {/* AI feedback */}
                            {result && (
                                <div className={`rounded-xl p-4 border ${cfg.border} ${cfg.bg} space-y-3`}>
                                    <div className="flex items-center gap-2">
                                        <Sparkles className={`w-4 h-4 ${cfg.text}`} />
                                        <span className={`text-sm font-semibold ${cfg.text}`}>AI Feedback</span>
                                    </div>
                                    <p className="text-sm text-foreground">{result.feedback}</p>
                                    {result.model_answer && (
                                        <div className="bg-surface rounded-lg p-3 border border-border">
                                            <p className="text-xs font-semibold text-muted-foreground mb-1.5">Model Answer</p>
                                            <ReactMarkdown className="text-sm text-foreground prose prose-sm max-w-none">
                                                {result.model_answer}
                                            </ReactMarkdown>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

export default function ActiveRecall({ onSessionComplete, userSubjects: initialUserSubjects = [] }) {
    const [phase, setPhase] = useState("setup");
    const [selectedSubject, setSelectedSubject] = useState("");
    const [topic, setTopic] = useState("");
    const [questions, setQuestions] = useState([]);
    const [userAnswers, setUserAnswers] = useState([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [sessionStartTime, setSessionStartTime] = useState(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [markingResults, setMarkingResults] = useState([]);
    const [sourceFiles, setSourceFiles] = useState([]);
    const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
    const [isGeneratingMarking, setIsGeneratingMarking] = useState(false);
    const [isFocusMode, setIsFocusMode] = useState(false);
    const [showFocusPrompt, setShowFocusPrompt] = useState(false);
    const { toast } = useToast();
    const focusModeRef = useRef(null);

    const [showSessionHistory, setShowSessionHistory] = useState(false);
    const [sessionHistory, setSessionHistory] = useState([]);
    const [selectedHistorySession, setSelectedHistorySession] = useState(null);
    const [user, setUser] = useState(null);
    const [userSubjects, setUserSubjects] = useState(initialUserSubjects);

    const defaultQuestions = [
        "What are the key concepts you studied today?",
        "How would you explain this topic to someone else?",
        "What connections can you make to other topics?",
        "What questions do you still have about this material?",
        "Can you provide specific examples of the concepts?"
    ];

    useEffect(() => {
        const loadSubjects = async () => {
            try {
                const currentUser = await base44.auth.me();
                setUser(currentUser);
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

    useEffect(() => {
        let timer;
        if (phase === "active" && timeLeft > 0) {
            timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        }
        return () => clearInterval(timer);
    }, [phase, timeLeft]);

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

    const handleGenerateQuestions = async () => {
        if (!sourceFiles.length || !selectedSubject) {
            toast({ title: "Missing info", description: "Select a subject and upload notes first.", variant: "destructive" });
            return;
        }

        const access = await checkLiveTier(FEATURES.ACTIVE_RECALL);
        if (!access.allowed) {
            toast({
                title: access.upgradeRequired ? "Premium feature" : "Daily limit reached",
                description: access.reason,
                variant: "destructive",
            });
            return;
        }

        setIsGeneratingQuestions(true);
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
                feature: "active_recall",
                prompt: `${getExaminerPrompt(selectedSubject)}

Based on the uploaded study material (${sourceFiles.length} file(s)), create 8-12 active recall questions for ${selectedSubject}${topic ? ` focusing on ${topic}` : ''} that align with VCE Study Design and VCAA assessment criteria.${documentContext}

CRITICAL - Use proper VCE command terms:
- IDENTIFY/STATE questions (require brief facts only)
- DESCRIBE/OUTLINE questions (require detailed accounts)
- EXPLAIN questions (require cause-and-effect links)
- COMPARE questions (require similarities AND differences)
- EVALUATE/DISCUSS questions (require balanced pros/cons with judgment)

Questions should:
- Test understanding at different VCAA cognitive levels
- Use VCE-appropriate metalanguage
- Be specific to the document content
- Help identify gaps in Study Design requirements`,
                file_urls: directFiles.length ? directFiles.map(f => f.url) : undefined,
                response_json_schema: {
                    type: "object",
                    properties: {
                        questions: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    question: { type: "string" },
                                    focus_area: { type: "string" },
                                    difficulty: { type: "string", enum: ["basic", "intermediate", "advanced"] }
                                },
                                required: ["question", "focus_area"]
                            }
                        }
                    },
                    required: ["questions"]
                }
            });
            if (response?.questions?.length > 0) {
                setQuestions(response.questions.map(q => q.question));
                setUserAnswers(new Array(response.questions.length).fill(""));
                toast({ title: `${response.questions.length} questions generated!`, description: "Ready to start your session." });
            }
        } catch (error) {
            toast({ title: "Generation failed", description: error.message || "Could not generate questions.", variant: "destructive" });
        } finally {
            setIsGeneratingQuestions(false);
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
        const questionsToUse = questions.length > 0 ? questions : defaultQuestions;
        setQuestions(questionsToUse);
        setUserAnswers(new Array(questionsToUse.length).fill(""));
        setCurrentQuestionIndex(0);
        setSessionStartTime(Date.now());
        setTimeLeft(questionsToUse.length * 180);
        setPhase("active");
        setShowFocusPrompt(false);
        recordStudyAndGetStreak().catch(() => {});
        if (inFocus) {
            setIsFocusMode(true);
            enterFullscreen();
        }
    };

    const handleNext = () => {
        if (currentQuestionIndex < questions.length - 1) setCurrentQuestionIndex(prev => prev + 1);
        else setPhase("review");
    };

    const handlePrevious = () => {
        if (currentQuestionIndex > 0) setCurrentQuestionIndex(prev => prev - 1);
    };

    const loadSessionHistory = async () => {
        try {
            const sessions = await base44.entities.ActiveRecallSession.list("-created_date", 50);
            setSessionHistory(sessions || []);
        } catch (error) { console.error(error); }
    };

    const deleteHistorySession = async (sessionId) => {
        if (!window.confirm("Delete this session?")) return;
        try {
            await base44.entities.ActiveRecallSession.delete(sessionId);
            toast({ title: "Session deleted" });
            loadSessionHistory();
        } catch (error) {
            toast({ title: "Delete failed", variant: "destructive" });
        }
    };

    const saveSession = async () => {
        try {
            await base44.entities.ActiveRecallSession.create({
                subject_name: selectedSubject,
                topic: topic || "General Review",
                questions,
                answers: userAnswers,
                ai_feedback: markingResults.length > 0 ? JSON.stringify(markingResults) : "",
                session_duration: sessionStartTime ? Math.floor((Date.now() - sessionStartTime) / 60000) : 0,
                date: format(new Date(), "yyyy-MM-dd")
            });
        } catch (error) { console.error(error); }
    };

    const handleGenerateMarking = async () => {
        if (!sourceFiles.length) {
            toast({ title: "No source material", description: "Upload notes to get AI feedback.", variant: "destructive" });
            return;
        }

        const access = await checkLiveTier(FEATURES.ACTIVE_RECALL);
        if (!access.allowed) {
            toast({
                title: access.upgradeRequired ? "Premium feature" : "Daily limit reached",
                description: access.reason,
                variant: "destructive",
            });
            return;
        }

        setIsGeneratingMarking(true);
        setMarkingResults([]);
        try {
            const uploaded = await Promise.all(sourceFiles.map(f => base44.integrations.Core.UploadFile({ file: f }).then(r => ({ url: r.file_url, name: f.name, ext: f.name.split('.').pop().toLowerCase() }))));
            const docxPptx = uploaded.filter(f => f.ext === 'docx' || f.ext === 'pptx');
            const directFiles = uploaded.filter(f => f.ext !== 'docx' && f.ext !== 'pptx');
            let documentContext = '';
            for (const f of docxPptx) {
                const textResult = await base44.functions.invoke('extractDocumentText', { file_url: f.url });
                documentContext += `\n\n[${f.name}]:\n${textResult.data?.text || ''}`;
            }
            const allAnswers = userAnswers.map((ans, idx) => `Question ${idx + 1}: ${questions[idx]}\nYour Answer: ${ans}`).join("\n\n");
            const response = await base44.integrations.Core.InvokeLLM({
                feature: "active_recall",
                prompt: `${getExaminerPrompt(selectedSubject)}

Mark the following ${selectedSubject} student answers according to VCAA standards and the provided source material.${documentContext}

Student Answers:
${allAnswers}

For each answer:
1. Verdict (Correct, Partially Correct, Incorrect) based on VCAA marking criteria
2. Feedback: Did the student match the command term requirement?
3. What would gain/lose marks in a real VCAA exam?
4. Model Answer showing the expected depth per command term used`,
                file_urls: directFiles.length ? directFiles.map(f => f.url) : undefined,
                response_json_schema: {
                    type: "object",
                    properties: {
                        results: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    verdict: { type: "string", enum: ["Correct", "Partially Correct", "Incorrect"] },
                                    feedback: { type: "string" },
                                    model_answer: { type: "string" }
                                },
                                required: ["verdict", "feedback", "model_answer"]
                            }
                        }
                    },
                    required: ["results"]
                }
            });
            setMarkingResults(response.results);
            // Real XP arrives via onSessionComplete → awardXP; no cosmetic
            // popups here (they'd show amounts the engine never granted).
            toast({ title: "Feedback ready!", description: "Expand each question to see your results." });
        } catch (error) {
            toast({ title: "Feedback failed", description: error.message || "Could not generate feedback.", variant: "destructive" });
        } finally {
            setIsGeneratingMarking(false);
        }
    };

    const completeSession = async (confidence) => {
        await saveSession();
        const totalDuration = sessionStartTime ? Math.floor((Date.now() - sessionStartTime) / 60000) : 0;
        await onSessionComplete({
            technique_name: "active_recall",
            session_duration: Math.max(totalDuration, 1),
            subject: selectedSubject,
            topic: topic || "General Review",
            confidence_rating: confidence,
            notes: `Answered ${questions.length} questions. ${userAnswers.filter(a => a.trim()).length} responses provided.`,
            date: format(new Date(), "yyyy-MM-dd")
        });
        setPhase("setup");
        setQuestions([]);
        setUserAnswers([]);
        setCurrentQuestionIndex(0);
        setMarkingResults([]);
        if (isFocusMode) { exitFullscreen(); setIsFocusMode(false); }
    };

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Score summary for review
    const scoreStats = markingResults.length > 0 ? {
        correct: markingResults.filter(r => r.verdict === "Correct").length,
        partial: markingResults.filter(r => r.verdict === "Partially Correct").length,
        incorrect: markingResults.filter(r => r.verdict === "Incorrect").length,
    } : null;

    const renderSetup = () => (
        <motion.div key="setup" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                {/* Left: Setup */}
                <div className="lg:col-span-3 card-soft p-6 space-y-5">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-foreground text-lg">Session Setup</h3>
                        <button
                            onClick={() => { loadSessionHistory(); setShowSessionHistory(!showSessionHistory); }}
                            className="flex items-center gap-1.5 text-sm text-chart-4 hover:text-chart-4/80 font-medium"
                        >
                            <FolderOpen className="w-4 h-4" /> History
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium text-muted-foreground">Subject</Label>
                            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                                <SelectTrigger className="h-11 border-2 border-border focus:border-chart-4 rounded-xl">
                                    <SelectValue placeholder="Choose a subject..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {userSubjects.map(s => (
                                        <SelectItem key={s.id} value={s.subject_name}>
                                            <div className="flex items-center gap-2">
                                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color || '#7C3AED' }} />
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
                                placeholder="e.g. Causes of World War II"
                                value={topic}
                                onChange={e => setTopic(e.target.value)}
                                className="h-11 border-2 border-border focus:border-chart-4 rounded-xl"
                            />
                        </div>
                    </div>

                    {questions.length > 0 && (
                        <div className="bg-chart-4/10 border border-chart-4/20 rounded-xl p-3.5">
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircle className="w-4 h-4 text-chart-4" />
                                <span className="text-sm font-semibold text-chart-4">{questions.length} questions ready</span>
                            </div>
                            <div className="space-y-1">
                                {questions.slice(0, 3).map((q, i) => (
                                    <p key={i} className="text-xs text-chart-4 truncate">• {q}</p>
                                ))}
                                {questions.length > 3 && <p className="text-xs text-chart-4/60">+ {questions.length - 3} more...</p>}
                            </div>
                        </div>
                    )}

                    <Button
                        onClick={startSession}
                        disabled={!!sourceFiles.length && questions.length === 0}
                        className="w-full h-12 bg-chart-4 hover:bg-chart-4/90 text-white font-semibold rounded-xl shadow-soft gap-2"
                    >
                        <Play className="w-5 h-5" />
                        {questions.length > 0 ? `Start Session (${questions.length} questions)` : 'Start with Default Questions'}
                    </Button>
                    {!!sourceFiles.length && questions.length === 0 && (
                        <p className="text-xs text-center text-xp">Generate questions from your uploaded notes first.</p>
                    )}
                </div>

                {/* Right: AI Questions */}
                <div className="lg:col-span-2 card-soft bg-chart-4/5 p-6 space-y-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-chart-4 rounded-xl flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground text-sm">AI Question Generator</h3>
                            <p className="text-xs text-muted-foreground">Upload notes → get smart questions</p>
                        </div>
                    </div>

                    <div className={`rounded-2xl border-2 border-dashed transition-all ${sourceFiles.length ? 'border-chart-4/40 bg-chart-4/10' : 'border-border bg-surface'}`}>
                        <label className="flex items-center gap-3 p-4 cursor-pointer hover:bg-chart-4/5 transition-colors rounded-2xl">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${sourceFiles.length ? 'bg-chart-4/15' : 'bg-secondary'}`}>
                                <FileText className={`w-4 h-4 ${sourceFiles.length ? 'text-chart-4' : 'text-muted-foreground'}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium ${sourceFiles.length ? 'text-chart-4' : 'text-muted-foreground'}`}>
                                    {sourceFiles.length ? `${sourceFiles.length} file${sourceFiles.length > 1 ? 's' : ''} selected` : 'Upload PDF / DOCX / PPTX'}
                                </p>
                                <p className="text-xs text-muted-foreground/60">Multiple files supported</p>
                            </div>
                            <input type="file" className="hidden" multiple onChange={e => {
                                const files = Array.from(e.target.files || []);
                                setSourceFiles(prev => { const names = new Set(prev.map(f => f.name)); return [...prev, ...files.filter(f => !names.has(f.name))]; });
                            }} accept=".pdf,.docx,.pptx" />
                        </label>
                        {sourceFiles.length > 0 && (
                            <div className="px-4 pb-3 space-y-1" onClick={e => e.stopPropagation()}>
                                {sourceFiles.map((f, i) => (
                                    <div key={i} className="flex items-center gap-2 bg-surface rounded-lg px-2 py-1 border border-chart-4/20">
                                        <span className="flex-1 text-xs text-foreground truncate">{f.name}</span>
                                        <button type="button" onClick={() => setSourceFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground/60 hover:text-streak flex-shrink-0">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <Button
                        onClick={handleGenerateQuestions}
                        disabled={isGeneratingQuestions || !sourceFiles.length || !selectedSubject}
                        className="w-full h-11 bg-chart-4 hover:bg-chart-4/90 text-white rounded-xl font-medium gap-2"
                    >
                        {isGeneratingQuestions ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                        ) : (
                            <><Wand2 className="w-4 h-4" /> Generate Questions</>
                        )}
                    </Button>

                    <div className="bg-surface rounded-xl p-3 border border-chart-4/20">
                        <p className="text-xs text-chart-4 leading-relaxed">
                            <span className="font-semibold">💡 Tip:</span> AI generates VCE-aligned questions using command terms like <em>Explain</em>, <em>Evaluate</em> and <em>Compare</em> — matching real VCAA criteria.
                        </p>
                    </div>
                </div>
            </div>

            {/* Session History */}
            <AnimatePresence>
                {showSessionHistory && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        className="card-soft p-6"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-foreground flex items-center gap-2">
                                <FolderOpen className="w-4 h-4 text-chart-4" /> Previous Sessions
                            </h3>
                            <button onClick={() => setShowSessionHistory(false)} className="text-muted-foreground/60 hover:text-muted-foreground">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        {sessionHistory.length === 0 ? (
                            <div className="text-center py-10">
                                <Brain className="w-12 h-12 mx-auto mb-3 text-chart-4/30" />
                                <p className="text-muted-foreground font-medium">No sessions yet</p>
                                <p className="text-sm text-muted-foreground/60 mt-1">Complete your first Active Recall session!</p>
                            </div>
                        ) : (
                            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                                {sessionHistory.map(session => (
                                    <div
                                        key={session.id}
                                        onClick={() => setSelectedHistorySession(session)}
                                        className="group flex items-start justify-between p-4 bg-secondary/50 hover:bg-chart-4/10 rounded-2xl border border-border hover:border-chart-4/30 cursor-pointer transition-all"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-foreground text-sm truncate">{session.subject_name}</p>
                                            <p className="text-xs text-muted-foreground truncate mt-0.5">{session.topic || "General Review"}</p>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="pill bg-chart-4/15 text-chart-4 py-0.5">{session.questions?.length || 0}q</span>
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
                                ))}
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
                <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-chart-4/10">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-chart-4 rounded-xl flex items-center justify-center">
                            <Brain className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <p className="font-semibold text-foreground text-sm">{selectedSubject}</p>
                            {topic && <p className="text-xs text-muted-foreground">{topic}</p>}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-mono font-bold ${timeLeft < 60 ? 'bg-streak/15 text-streak' : 'bg-chart-4/15 text-chart-4'}`}>
                            <Clock className="w-3.5 h-3.5" />
                            {formatTime(timeLeft)}
                        </div>
                        {!isFocusMode && (
                            <Button variant="outline" size="sm" onClick={() => { setIsFocusMode(true); enterFullscreen(); }} className="gap-1.5 text-xs border-border hover:border-chart-4/40">
                                <Maximize className="w-3.5 h-3.5" /> Focus
                            </Button>
                        )}
                    </div>
                </div>
                {/* Question */}
                <div className="p-6">
                    <QuestionCard
                        question={questions[currentQuestionIndex]}
                        index={currentQuestionIndex}
                        total={questions.length}
                        answer={userAnswers[currentQuestionIndex] || ""}
                        onAnswerChange={(val) => {
                            const a = [...userAnswers];
                            a[currentQuestionIndex] = val;
                            setUserAnswers(a);
                        }}
                        onNext={handleNext}
                        onPrev={handlePrevious}
                        isLast={currentQuestionIndex === questions.length - 1}
                    />
                </div>
            </div>
        </motion.div>
    );

    const renderReview = () => (
        <motion.div key="review" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
            {/* Summary bar */}
            <div className="bg-chart-4 rounded-3xl p-6 text-white">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-surface/20 rounded-2xl flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-xl">Session Complete!</h3>
                        <p className="text-white/80 text-sm">{questions.length} questions answered</p>
                    </div>
                </div>
                {scoreStats && (
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-surface/15 rounded-xl p-3 text-center">
                            <p className="text-2xl font-bold">{scoreStats.correct}</p>
                            <p className="text-xs text-white/80">Correct</p>
                        </div>
                        <div className="bg-surface/15 rounded-xl p-3 text-center">
                            <p className="text-2xl font-bold">{scoreStats.partial}</p>
                            <p className="text-xs text-white/80">Partial</p>
                        </div>
                        <div className="bg-surface/15 rounded-xl p-3 text-center">
                            <p className="text-2xl font-bold">{scoreStats.incorrect}</p>
                            <p className="text-xs text-white/80">Incorrect</p>
                        </div>
                    </div>
                )}
            </div>

            {/* AI Feedback CTA */}
            {!markingResults.length && (
                <div className="card-soft p-6">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-chart-4/15 rounded-2xl flex items-center justify-center flex-shrink-0">
                            <Sparkles className="w-5 h-5 text-chart-4" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-foreground mb-1">Get AI Feedback</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                {sourceFiles.length ? "AI will mark each answer against your notes using VCAA criteria." : "Upload your notes to unlock AI marking."}
                            </p>
                            {!sourceFiles.length ? (
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <div className="flex-1 flex items-center gap-3 p-3 bg-secondary/50 border-2 border-dashed border-border hover:border-chart-4/40 rounded-xl transition-all">
                                        <Upload className="w-4 h-4 text-muted-foreground/60" />
                                        <span className="text-sm text-muted-foreground">Upload notes (PDF/DOCX/PPTX, multiple allowed)</span>
                                    </div>
                                    <input type="file" className="hidden" multiple onChange={e => {
                                        const files = Array.from(e.target.files || []);
                                        setSourceFiles(prev => { const names = new Set(prev.map(f => f.name)); return [...prev, ...files.filter(f => !names.has(f.name))]; });
                                    }} accept=".pdf,.docx,.pptx" />
                                </label>
                            ) : (
                                <Button
                                    onClick={handleGenerateMarking}
                                    disabled={isGeneratingMarking}
                                    className="h-11 bg-chart-4 hover:bg-chart-4/90 text-white font-medium rounded-xl gap-2"
                                >
                                    {isGeneratingMarking ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Analysing answers...</>
                                    ) : (
                                        <><Zap className="w-4 h-4" /> Mark My Answers</>
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Q&A Review */}
            <div className="space-y-2.5">
                <h3 className="font-semibold text-muted-foreground text-sm px-1">Your Answers</h3>
                {questions.map((q, i) => (
                    <ReviewItem
                        key={i}
                        question={q}
                        answer={userAnswers[i]}
                        result={markingResults[i]}
                        index={i}
                    />
                ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
                <Button
                    onClick={() => { setPhase('setup'); if (isFocusMode) { exitFullscreen(); setIsFocusMode(false); } }}
                    variant="outline"
                    className="flex-1 h-12 border-2 border-border hover:border-chart-4/40 hover:bg-chart-4/10 rounded-xl font-medium gap-2"
                >
                    <RotateCcw className="w-4 h-4" /> New Session
                </Button>
                <Button
                    onClick={() => { completeSession(4); if (isFocusMode) { exitFullscreen(); setIsFocusMode(false); } }}
                    className="flex-1 h-12 bg-chart-4 hover:bg-chart-4/90 text-white rounded-xl font-medium gap-2 shadow-soft"
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
                <div className="absolute inset-0 bg-chart-4/20" />
                <div className="relative z-10 flex flex-col h-full">
                    <div className="flex items-center justify-between px-6 py-4">
                        <div className="flex items-center gap-2 text-white/60 text-sm">
                            <Brain className="w-4 h-4" />
                            Active Recall — Focus Mode
                        </div>
                        <Button onClick={() => { exitFullscreen(); setIsFocusMode(false); }} variant="ghost" className="text-white/60 hover:text-white hover:bg-surface/10 gap-2">
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
                <div className="w-12 h-12 bg-chart-4 rounded-2xl flex items-center justify-center shadow-soft">
                    <Brain className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-foreground">Active Recall</h2>
                    <p className="text-sm text-muted-foreground">Test yourself without notes to strengthen memory</p>
                </div>
            </div>

            {renderContent()}

            {/* Focus prompt dialog */}
            <Dialog open={showFocusPrompt} onOpenChange={setShowFocusPrompt}>
                <DialogContent className="max-w-sm rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl">Ready to start?</DialogTitle>
                        <DialogDescription>
                            Focus Mode hides distractions and goes fullscreen — ideal for deep recall practice.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                        <Button variant="outline" onClick={() => handleStartConfirmed(false)} className="h-11 rounded-xl border-2">
                            Normal Mode
                        </Button>
                        <Button onClick={() => handleStartConfirmed(true)} className="h-11 bg-chart-4 hover:bg-chart-4/90 text-white rounded-xl gap-2">
                            <Maximize className="w-4 h-4" /> Focus Mode
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* History detail dialog */}
            <Dialog open={!!selectedHistorySession} onOpenChange={() => setSelectedHistorySession(null)}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl">
                    <DialogHeader>
                        <DialogTitle>{selectedHistorySession?.subject_name}</DialogTitle>
                        <DialogDescription>
                            {selectedHistorySession?.topic || "General Review"} · {selectedHistorySession && format(new Date(selectedHistorySession.date), "MMMM d, yyyy")}
                        </DialogDescription>
                    </DialogHeader>
                    {selectedHistorySession && (
                        <div className="space-y-3">
                            {selectedHistorySession.questions?.map((question, index) => (
                                <div key={index} className="border border-border rounded-2xl p-4 space-y-3">
                                    <div className="flex items-start gap-3">
                                        <span className="w-6 h-6 rounded-lg bg-chart-4/15 text-chart-4 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{index + 1}</span>
                                        <p className="font-medium text-foreground text-sm">{question}</p>
                                    </div>
                                    <div className="bg-secondary/50 rounded-xl p-3 text-sm text-foreground border border-border ml-9">
                                        {selectedHistorySession.answers?.[index] || <em className="text-muted-foreground/60">No answer provided</em>}
                                    </div>
                                    {selectedHistorySession.ai_feedback && (() => {
                                        try {
                                            const feedback = JSON.parse(selectedHistorySession.ai_feedback);
                                            const f = feedback[index];
                                            if (!f) return null;
                                            const cfg = verdictConfig[f.verdict];
                                            return (
                                                <div className={`ml-9 rounded-xl p-3 border ${cfg.border} ${cfg.bg}`}>
                                                    <span className={`pill ${cfg.bg} ${cfg.text} border ${cfg.border}`}>{f.verdict}</span>
                                                    <p className="text-sm text-foreground mt-2">{f.feedback}</p>
                                                </div>
                                            );
                                        } catch { return null; }
                                    })()}
                                </div>
                            ))}
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={() => setSelectedHistorySession(null)} className="bg-chart-4 hover:bg-chart-4/90 rounded-xl">Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
