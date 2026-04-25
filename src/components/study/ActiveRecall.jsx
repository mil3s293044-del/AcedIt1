import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Brain, Play, Clock, CheckCircle, Upload, Wand2, Maximize, ArrowRight, ArrowLeft, RotateCcw, X, FolderOpen, Trash2, Sparkles, Loader2, ChevronDown, ChevronUp, FileText, Zap } from "lucide-react";
import { format } from "date-fns";
import ReactMarkdown from 'react-markdown';
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { enhancePromptWithVCEExpert } from "@/components/shared/vceExpertPrompt";
import { recordStudyAndGetStreak } from "@/components/shared/streakHelpers";

const verdictConfig = {
    "Correct": { color: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", label: "Correct ✓" },
    "Partially Correct": { color: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", label: "Partial ◐" },
    "Incorrect": { color: "bg-red-500", text: "text-red-700", bg: "bg-red-50", border: "border-red-200", label: "Incorrect ✗" },
};

function QuestionCard({ question, index, total, answer, onAnswerChange, onNext, onPrev, isLast }) {
    const progress = ((index + 1) / total) * 100;
    const wordCount = answer.trim() ? answer.trim().split(/\s+/).length : 0;

    return (
        <div className="flex flex-col h-full">
            {/* Progress bar */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-500">Question {index + 1} of {total}</span>
                    <span className="text-sm font-medium text-violet-600">{Math.round(progress)}% complete</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full"
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
                                i === index ? 'w-6 bg-violet-500' :
                                i < index ? 'w-3 bg-violet-300' : 'w-3 bg-slate-200'
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
                className="bg-gradient-to-br from-violet-50 via-indigo-50 to-purple-50 rounded-2xl p-6 border border-violet-100 mb-5"
            >
                <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-violet-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                        {index + 1}
                    </div>
                    <p className="text-lg font-medium text-slate-800 leading-relaxed">{question}</p>
                </div>
            </motion.div>

            {/* Answer textarea */}
            <div className="flex-1 relative">
                <Textarea
                    placeholder="Write everything you can recall — don't hold back. No peeking at notes!"
                    value={answer}
                    onChange={(e) => onAnswerChange(e.target.value)}
                    className="w-full h-48 resize-none border-2 border-slate-200 focus:border-violet-400 rounded-2xl p-4 text-base bg-white placeholder:text-slate-400 transition-colors"
                    autoFocus
                />
                <div className="absolute bottom-3 right-4 text-xs text-slate-400">
                    {wordCount} {wordCount === 1 ? 'word' : 'words'}
                </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-5 pt-5 border-t border-slate-100">
                <Button
                    onClick={onPrev}
                    disabled={index === 0}
                    variant="outline"
                    className="gap-2 border-2 border-slate-200 hover:border-violet-300 hover:bg-violet-50 disabled:opacity-30"
                >
                    <ArrowLeft className="w-4 h-4" /> Previous
                </Button>
                <Button
                    onClick={onNext}
                    className={`gap-2 px-6 ${isLast ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600' : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700'} text-white shadow-lg`}
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
            className="border border-slate-200 rounded-2xl overflow-hidden bg-white"
        >
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-start gap-4 p-5 hover:bg-slate-50 transition-colors text-left"
            >
                <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                    {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 leading-snug">{question}</p>
                    <p className="text-sm text-slate-500 mt-1 line-clamp-1">
                        {answer || <em>No answer provided</em>}
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    {cfg && (
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
                            {cfg.label}
                        </span>
                    )}
                    {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
            </button>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-slate-100 overflow-hidden"
                    >
                        <div className="p-5 space-y-4">
                            {/* Your answer */}
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Your Answer</p>
                                <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 border border-slate-200">
                                    {answer || <em className="text-slate-400">No answer provided</em>}
                                </div>
                            </div>
                            {/* AI feedback */}
                            {result && (
                                <div className={`rounded-xl p-4 border ${cfg.border} ${cfg.bg} space-y-3`}>
                                    <div className="flex items-center gap-2">
                                        <Sparkles className={`w-4 h-4 ${cfg.text}`} />
                                        <span className={`text-sm font-semibold ${cfg.text}`}>AI Feedback</span>
                                    </div>
                                    <p className="text-sm text-slate-700">{result.feedback}</p>
                                    {result.model_answer && (
                                        <div className="bg-white/70 rounded-lg p-3 border border-white">
                                            <p className="text-xs font-semibold text-slate-600 mb-1.5">Model Answer</p>
                                            <ReactMarkdown className="text-sm text-slate-700 prose prose-sm max-w-none">
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
                prompt: enhancePromptWithVCEExpert(`Based on the uploaded study material (${sourceFiles.length} file(s)), create 8-12 active recall questions for ${selectedSubject}${topic ? ` focusing on ${topic}` : ''} that align with VCE Study Design and VCAA assessment criteria.${documentContext}

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
- Help identify gaps in Study Design requirements`),
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
                prompt: enhancePromptWithVCEExpert(`Mark the following ${selectedSubject} student answers according to VCAA standards and the provided source material.${documentContext}

Student Answers:
${allAnswers}

For each answer:
1. Verdict (Correct, Partially Correct, Incorrect) based on VCAA marking criteria
2. Feedback: Did the student match the command term requirement?
3. What would gain/lose marks in a real VCAA exam?
4. Model Answer showing the expected depth per command term used`),
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
            // Award XP: 10 per Correct, 5 per Partially Correct
            const xpEarned = response.results.reduce((sum, r) => {
                if (r.verdict === "Correct") return sum + 10;
                if (r.verdict === "Partially Correct") return sum + 5;
                return sum;
            }, 0);
            if (xpEarned > 0) {
                window.dispatchEvent(new CustomEvent('xp_awarded', { detail: { xp: xpEarned, source: 'active_recall' } }));
            }
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
                <div className="lg:col-span-3 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-slate-800 text-lg">Session Setup</h3>
                        <button
                            onClick={() => { loadSessionHistory(); setShowSessionHistory(!showSessionHistory); }}
                            className="flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-800 font-medium"
                        >
                            <FolderOpen className="w-4 h-4" /> History
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium text-slate-600">Subject</Label>
                            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                                <SelectTrigger className="h-11 border-2 border-slate-200 focus:border-violet-400 rounded-xl">
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
                            <Label className="text-sm font-medium text-slate-600">Topic <span className="text-slate-400 font-normal">(optional)</span></Label>
                            <Input
                                placeholder="e.g. Causes of World War II"
                                value={topic}
                                onChange={e => setTopic(e.target.value)}
                                className="h-11 border-2 border-slate-200 focus:border-violet-400 rounded-xl"
                            />
                        </div>
                    </div>

                    {questions.length > 0 && (
                        <div className="bg-violet-50 border border-violet-100 rounded-xl p-3.5">
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircle className="w-4 h-4 text-violet-600" />
                                <span className="text-sm font-semibold text-violet-700">{questions.length} questions ready</span>
                            </div>
                            <div className="space-y-1">
                                {questions.slice(0, 3).map((q, i) => (
                                    <p key={i} className="text-xs text-violet-600 truncate">• {q}</p>
                                ))}
                                {questions.length > 3 && <p className="text-xs text-violet-400">+ {questions.length - 3} more...</p>}
                            </div>
                        </div>
                    )}

                    <Button
                        onClick={startSession}
                        disabled={!!sourceFiles.length && questions.length === 0}
                        className="w-full h-12 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-violet-200 gap-2"
                    >
                        <Play className="w-5 h-5" />
                        {questions.length > 0 ? `Start Session (${questions.length} questions)` : 'Start with Default Questions'}
                    </Button>
                    {!!sourceFiles.length && questions.length === 0 && (
                        <p className="text-xs text-center text-amber-600">Generate questions from your uploaded notes first.</p>
                    )}
                </div>

                {/* Right: AI Questions */}
                <div className="lg:col-span-2 bg-gradient-to-br from-violet-50 to-indigo-50 rounded-3xl border border-violet-100 p-6 space-y-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-violet-600 rounded-xl flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-800 text-sm">AI Question Generator</h3>
                            <p className="text-xs text-slate-500">Upload notes → get smart questions</p>
                        </div>
                    </div>

                    <div className={`rounded-2xl border-2 border-dashed transition-all ${sourceFiles.length ? 'border-violet-400 bg-violet-50' : 'border-slate-300 bg-white'}`}>
                        <label className="flex items-center gap-3 p-4 cursor-pointer hover:bg-violet-50/50 transition-colors rounded-2xl">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${sourceFiles.length ? 'bg-violet-100' : 'bg-slate-100'}`}>
                                <FileText className={`w-4 h-4 ${sourceFiles.length ? 'text-violet-600' : 'text-slate-500'}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium ${sourceFiles.length ? 'text-violet-700' : 'text-slate-600'}`}>
                                    {sourceFiles.length ? `${sourceFiles.length} file${sourceFiles.length > 1 ? 's' : ''} selected` : 'Upload PDF / DOCX / PPTX'}
                                </p>
                                <p className="text-xs text-slate-400">Multiple files supported</p>
                            </div>
                            <input type="file" className="hidden" multiple onChange={e => {
                                const files = Array.from(e.target.files || []);
                                setSourceFiles(prev => { const names = new Set(prev.map(f => f.name)); return [...prev, ...files.filter(f => !names.has(f.name))]; });
                            }} accept=".pdf,.docx,.pptx" />
                        </label>
                        {sourceFiles.length > 0 && (
                            <div className="px-4 pb-3 space-y-1" onClick={e => e.stopPropagation()}>
                                {sourceFiles.map((f, i) => (
                                    <div key={i} className="flex items-center gap-2 bg-white rounded-lg px-2 py-1 border border-violet-100">
                                        <span className="flex-1 text-xs text-slate-700 truncate">{f.name}</span>
                                        <button type="button" onClick={() => setSourceFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-red-500 flex-shrink-0">
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
                        className="w-full h-11 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium gap-2"
                    >
                        {isGeneratingQuestions ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                        ) : (
                            <><Wand2 className="w-4 h-4" /> Generate Questions</>
                        )}
                    </Button>

                    <div className="bg-white/70 rounded-xl p-3 border border-violet-100">
                        <p className="text-xs text-violet-800 leading-relaxed">
                            <span className="font-semibold">💡 Tip:</span> AI generates VCE-aligned questions using command terms like <em>Explain</em>, <em>Evaluate</em> and <em>Compare</em> — matching real VCAA criteria.
                        </p>
                    </div>
                </div>
            </div>

            {/* Session History */}
            <AnimatePresence>
                {showSessionHistory && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                                <FolderOpen className="w-4 h-4 text-violet-600" /> Previous Sessions
                            </h3>
                            <button onClick={() => setShowSessionHistory(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        {sessionHistory.length === 0 ? (
                            <div className="text-center py-10">
                                <Brain className="w-12 h-12 mx-auto mb-3 text-violet-200" />
                                <p className="text-slate-500 font-medium">No sessions yet</p>
                                <p className="text-sm text-slate-400 mt-1">Complete your first Active Recall session!</p>
                            </div>
                        ) : (
                            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                                {sessionHistory.map(session => (
                                    <div
                                        key={session.id}
                                        onClick={() => setSelectedHistorySession(session)}
                                        className="group flex items-start justify-between p-4 bg-slate-50 hover:bg-violet-50 rounded-2xl border border-slate-200 hover:border-violet-200 cursor-pointer transition-all"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-slate-800 text-sm truncate">{session.subject_name}</p>
                                            <p className="text-xs text-slate-500 truncate mt-0.5">{session.topic || "General Review"}</p>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">{session.questions?.length || 0}q</span>
                                                <span className="text-xs text-slate-400">{format(new Date(session.date), "MMM d")}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={e => { e.stopPropagation(); deleteHistorySession(session.id); }}
                                            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 ml-2 flex-shrink-0 transition-opacity"
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
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-violet-50 to-indigo-50">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-violet-600 rounded-xl flex items-center justify-center">
                            <Brain className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <p className="font-semibold text-slate-800 text-sm">{selectedSubject}</p>
                            {topic && <p className="text-xs text-slate-500">{topic}</p>}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-mono font-bold ${timeLeft < 60 ? 'bg-red-100 text-red-600' : 'bg-violet-100 text-violet-700'}`}>
                            <Clock className="w-3.5 h-3.5" />
                            {formatTime(timeLeft)}
                        </div>
                        {!isFocusMode && (
                            <Button variant="outline" size="sm" onClick={() => { setIsFocusMode(true); enterFullscreen(); }} className="gap-1.5 text-xs border-slate-200 hover:border-violet-300">
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
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-3xl p-6 text-white">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-xl">Session Complete!</h3>
                        <p className="text-emerald-100 text-sm">{questions.length} questions answered</p>
                    </div>
                </div>
                {scoreStats && (
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white/15 rounded-xl p-3 text-center">
                            <p className="text-2xl font-bold">{scoreStats.correct}</p>
                            <p className="text-xs text-emerald-100">Correct</p>
                        </div>
                        <div className="bg-white/15 rounded-xl p-3 text-center">
                            <p className="text-2xl font-bold">{scoreStats.partial}</p>
                            <p className="text-xs text-emerald-100">Partial</p>
                        </div>
                        <div className="bg-white/15 rounded-xl p-3 text-center">
                            <p className="text-2xl font-bold">{scoreStats.incorrect}</p>
                            <p className="text-xs text-emerald-100">Incorrect</p>
                        </div>
                    </div>
                )}
            </div>

            {/* AI Feedback CTA */}
            {!markingResults.length && (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-violet-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                            <Sparkles className="w-5 h-5 text-violet-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-slate-800 mb-1">Get AI Feedback</h3>
                            <p className="text-sm text-slate-500 mb-4">
                                {sourceFiles.length ? "AI will mark each answer against your notes using VCAA criteria." : "Upload your notes to unlock AI marking."}
                            </p>
                            {!sourceFiles.length ? (
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <div className="flex-1 flex items-center gap-3 p-3 bg-slate-50 border-2 border-dashed border-slate-300 hover:border-violet-300 rounded-xl transition-all">
                                        <Upload className="w-4 h-4 text-slate-400" />
                                        <span className="text-sm text-slate-500">Upload notes (PDF/DOCX/PPTX, multiple allowed)</span>
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
                                    className="h-11 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-medium rounded-xl gap-2"
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
                <h3 className="font-semibold text-slate-700 text-sm px-1">Your Answers</h3>
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
                    className="flex-1 h-12 border-2 border-slate-200 hover:border-violet-300 hover:bg-violet-50 rounded-xl font-medium gap-2"
                >
                    <RotateCcw className="w-4 h-4" /> New Session
                </Button>
                <Button
                    onClick={() => { completeSession(4); if (isFocusMode) { exitFullscreen(); setIsFocusMode(false); } }}
                    className="flex-1 h-12 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl font-medium gap-2 shadow-lg shadow-emerald-200"
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
            <div ref={focusModeRef} className="fixed inset-0 z-[10000] bg-slate-950">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/40 via-slate-950 to-slate-950" />
                <div className="relative z-10 flex flex-col h-full">
                    <div className="flex items-center justify-between px-6 py-4">
                        <div className="flex items-center gap-2 text-white/60 text-sm">
                            <Brain className="w-4 h-4" />
                            Active Recall — Focus Mode
                        </div>
                        <Button onClick={() => { exitFullscreen(); setIsFocusMode(false); }} variant="ghost" className="text-white/60 hover:text-white hover:bg-white/10 gap-2">
                            <X className="w-4 h-4" /> Exit Focus
                        </Button>
                    </div>
                    <div className="flex-1 overflow-auto px-6 pb-6">
                        <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-2xl p-8">
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
                <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-200">
                    <Brain className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-900">Active Recall</h2>
                    <p className="text-sm text-slate-500">Test yourself without notes to strengthen memory</p>
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
                        <Button onClick={() => handleStartConfirmed(true)} className="h-11 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl gap-2">
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
                                <div key={index} className="border border-slate-200 rounded-2xl p-4 space-y-3">
                                    <div className="flex items-start gap-3">
                                        <span className="w-6 h-6 rounded-lg bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{index + 1}</span>
                                        <p className="font-medium text-slate-800 text-sm">{question}</p>
                                    </div>
                                    <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-700 border border-slate-200 ml-9">
                                        {selectedHistorySession.answers?.[index] || <em className="text-slate-400">No answer provided</em>}
                                    </div>
                                    {selectedHistorySession.ai_feedback && (() => {
                                        try {
                                            const feedback = JSON.parse(selectedHistorySession.ai_feedback);
                                            const f = feedback[index];
                                            if (!f) return null;
                                            const cfg = verdictConfig[f.verdict];
                                            return (
                                                <div className={`ml-9 rounded-xl p-3 border ${cfg.border} ${cfg.bg}`}>
                                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text} border ${cfg.border}`}>{f.verdict}</span>
                                                    <p className="text-sm text-slate-700 mt-2">{f.feedback}</p>
                                                </div>
                                            );
                                        } catch { return null; }
                                    })()}
                                </div>
                            ))}
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={() => setSelectedHistorySession(null)} className="bg-violet-600 hover:bg-violet-700 rounded-xl">Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}