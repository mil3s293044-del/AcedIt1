import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { LatexBlock, LatexInline, processLatexContent } from "@/components/shared/LatexRenderer";
import MathKeyboard from "../shared/MathKeyboard";
import MathInput from "../shared/MathInput";
import {
    ArrowLeft, ArrowRight, Clock, Award, CheckCircle, XCircle,
    Loader2, TrendingUp, AlertCircle, Timer, AlertTriangle,
    Upload, Image as ImageIcon, Ban, Calculator, Lightbulb,
    Star, ChevronDown, BookOpen, MessageSquare, Zap
} from "lucide-react";
import AILoadingProgress from "../shared/AILoadingProgress";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { PastPaperAttempt, User } from "@/entities/all";
import { useToast } from "@/components/ui/use-toast";

export default function AITestPlayer({ paper, onComplete, onBack }) {
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState({});
    const [imageAnswers, setImageAnswers] = useState({});
    const [unanswerableQuestions, setUnanswerableQuestions] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCompleted, setIsCompleted] = useState(false);
    const [results, setResults] = useState(null);
    const [totalTimeElapsed, setTotalTimeElapsed] = useState(0);
    const [questionTimeSpent, setQuestionTimeSpent] = useState({});
    const [questionStartTime, setQuestionStartTime] = useState(Date.now());
    const [user, setUser] = useState(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [editingMarks, setEditingMarks] = useState({});
    const [mathMode, setMathMode] = useState({});
    const [showKeyboard, setShowKeyboard] = useState({});
    const [cursorPosition, setCursorPosition] = useState({});
    const [expandedQuestion, setExpandedQuestion] = useState(null);
    const [activeTab, setActiveTab] = useState({});
    const textAreaRefs = useRef({});
    const mathInputRefs = useRef({});
    const fileInputRefs = useRef({});
    const timerRef = useRef(null);
    const { toast } = useToast();
    const [, forceUpdate] = useState(0);

    const totalTimeSeconds = paper.time_allowed * 60;
    const totalMarks = paper.total_marks || paper.questions.reduce((sum, q) => sum + (q.marks || 1), 0);
    const secondsPerMark = totalTimeSeconds / totalMarks;

    const getQuestionTime = (question) => Math.round((question.marks || 1) * secondsPerMark);
    const question = paper.questions[currentQuestion];
    const questionTimeAllowed = getQuestionTime(question);

    useEffect(() => {
        const init = async () => { const u = await User.me(); setUser(u); };
        init();
        timerRef.current = setInterval(() => {
            setTotalTimeElapsed(prev => prev + 1);
            forceUpdate(prev => prev + 1);
        }, 1000);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, []);

    useEffect(() => {
        setQuestionStartTime(Date.now());
        return () => {
            const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000);
            setQuestionTimeSpent(prev => ({ ...prev, [currentQuestion]: (prev[currentQuestion] || 0) + timeSpent }));
        };
    }, [currentQuestion]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const getCurrentQuestionTime = () => {
        return (questionTimeSpent[currentQuestion] || 0) + Math.floor((Date.now() - questionStartTime) / 1000);
    };

    const getTimeStatus = () => {
        const remaining = questionTimeAllowed - getCurrentQuestionTime();
        if (remaining <= 0) return 'overtime';
        if (remaining <= 30) return 'warning';
        return 'ok';
    };

    const handleAnswerChange = (questionNumber, answer) => {
        setAnswers(prev => ({ ...prev, [questionNumber]: answer }));
    };

    const handleImageUpload = async (questionNumber, file) => {
        if (!file) return;
        setUploadingImage(true);
        try {
            const { file_url } = await base44.integrations.Core.UploadFile({ file });
            setImageAnswers(prev => ({ ...prev, [questionNumber]: file_url }));
            toast({ title: "Image attached!" });
        } catch {
            toast({ title: "Upload failed", variant: "destructive" });
        } finally {
            setUploadingImage(false);
        }
    };

    const toggleUnanswerable = (questionNumber) => {
        setUnanswerableQuestions(prev => ({ ...prev, [questionNumber]: !prev[questionNumber] }));
    };

    const handleAdjustMarks = (questionNumber, newMarks) => {
        setEditingMarks(prev => ({ ...prev, [questionNumber]: newMarks }));
    };

    const handleSaveAdjustments = async () => {
        try {
            const updatedAnswers = results.marked_answers.map(a =>
                editingMarks[a.question_number] !== undefined
                    ? { ...a, marks_awarded: parseFloat(editingMarks[a.question_number]) }
                    : a
            );
            const totalAwarded = updatedAnswers.reduce((sum, a) => sum + (parseFloat(a.marks_awarded) || 0), 0);
            const totalPossible = updatedAnswers.reduce((sum, a) => sum + (parseFloat(a.max_marks) || 0), 0);
            const percentage = Math.round((totalAwarded / totalPossible) * 100);
            const attemptData = {
                paper_id: paper.id, paper_title: paper.title, subject: paper.subject,
                answers: updatedAnswers.map(a => ({ ...a, answer: answers[a.question_number] || "", time_spent: results.questionTimes[paper.questions.findIndex(q => q.question_number === a.question_number)] || 0 })),
                total_marks_awarded: totalAwarded, total_marks_possible: totalPossible, percentage,
                time_taken: totalTimeElapsed, completed_date: format(new Date(), 'yyyy-MM-dd')
            };
            await PastPaperAttempt.update(results.attemptId, attemptData);
            setResults({ ...results, marked_answers: updatedAnswers, totalAwarded, totalPossible, percentage });
            setEditingMarks({});
            toast({ title: "Marks saved!" });
        } catch (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };

    const handleSubmit = async () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setIsSubmitting(true);
        window.dispatchEvent(new CustomEvent('aiTaskComplete'));
        const finalTimeSpent = Math.floor((Date.now() - questionStartTime) / 1000);
        const finalQuestionTimes = { ...questionTimeSpent, [currentQuestion]: (questionTimeSpent[currentQuestion] || 0) + finalTimeSpent };

        try {
            const answerableQuestions = paper.questions.filter(q => !unanswerableQuestions[q.question_number]);
            const unanswerableQuestionsArr = paper.questions.filter(q => unanswerableQuestions[q.question_number]);
            const questionsWithImages = answerableQuestions.filter(q => imageAnswers[q.question_number]);
            let imageDescriptions = {};

            if (questionsWithImages.length > 0) {
                try {
                    const analysis = await base44.integrations.Core.InvokeLLM({
                        prompt: `Transcribe each image answer: math equations, text, diagrams. Be brief.\n${questionsWithImages.map(q => `Q${q.question_number}(${q.marks}m)`).join(', ')}`,
                        file_urls: questionsWithImages.map(q => imageAnswers[q.question_number]),
                        response_json_schema: { type: "object", properties: { answers: { type: "array", items: { type: "object", properties: { question_number: { type: "string" }, description: { type: "string" } } } } } }
                    });
                    analysis.answers?.forEach(a => { imageDescriptions[a.question_number] = a.description; });
                } catch (e) { console.error("Image analysis failed", e); }
            }

            const answersForMarking = answerableQuestions.map(q => {
                const hasImage = imageAnswers[q.question_number];
                const hasText = answers[q.question_number]?.trim();
                return {
                    question_number: q.question_number, question_text: q.question_text, marks: q.marks || 1,
                    question_type: q.question_type, marking_criteria: q.marking_criteria,
                    student_answer: hasText ? answers[q.question_number] : "",
                    student_image_description: imageDescriptions[q.question_number] || "",
                    has_image_answer: !!hasImage, was_attempted: !!(hasText || hasImage),
                    correct_mcq_answer: q.correct_mcq_answer, mcq_options: q.mcq_options
                };
            });

            const markingResponse = await base44.integrations.Core.InvokeLLM({
                model: "claude_sonnet_4_6",
                prompt: `You are a highly qualified ${paper.subject} examiner. Mark every question with STRICT ACCURACY. Return EXACTLY ${answersForMarking.length} entries — one per question, no exceptions.

SUBJECT: ${paper.subject}. All content MUST be accurate to this subject's curriculum, conventions, and terminology.

━━━ MARKING RULES ━━━
• marks_awarded: Award based solely on correctness of the student's actual answer. Be rigorous — do not give marks for vague or incorrect responses. Partial marks only if genuine partial understanding is demonstrated. MCQ = full marks or 0.
• For unattempted questions: marks_awarded = 0. Still provide full sample_response, feedback, and recommendation.

━━━ REQUIRED FIELDS FOR EVERY QUESTION ━━━

1. feedback — Specific critique of the STUDENT'S ACTUAL answer. State exactly what was correct, what was wrong, what was missing, and any misconceptions. Must be personalised to what they wrote (or didn't write). Minimum 2-3 sentences.

2. sample_response — A COMPLETE, full-marks exemplar scaled to the mark value:
   • 1 mark: 1–2 precise sentences covering the exact marking point(s).
   • 2–3 marks: A short structured response hitting each marking point clearly.
   • 4–6 marks: A well-developed response with clear structure — topic sentence, explanation, evidence/working, conclusion. For maths/science: show all steps.
   • 7+ marks: Extended response — multiple paragraphs with argument, evidence, analysis, and synthesis. For maths: full stepwise working with every line shown.
   • Written in natural student voice (first person where appropriate). NOT bullet points for essay-type. USE LaTeX for all maths.
   • This is the ONLY reference the student gets — make it complete enough to understand exactly what a full-marks answer requires.

3. recommendation — One precise, actionable study tip specific to this question's topic and type. Must be targeted, not generic.

━━━ LATEX RULES (maths/science) ━━━
• ALL mathematical expressions in LaTeX. Never plain-text math.
• Inline: $expression$ | Display: $$expression$$

━━━ QUESTIONS ━━━
${answersForMarking.map(q => `
Q${q.question_number} [${q.marks} mark${q.marks !== 1 ? 's' : ''}] — ${q.question_type?.toUpperCase() || 'WRITTEN'}
Question: ${q.question_text}
Student Answer: ${q.was_attempted ? (q.student_answer || q.student_image_description || "(image submitted)") : "NOT ATTEMPTED"}${q.mcq_options ? `\nOptions: ${q.mcq_options.map((opt, i) => `(${i}) ${opt}`).join(' | ')}\nCorrect: ${q.correct_mcq_answer}` : ''}${q.marking_criteria ? `\nMarking Criteria: ${q.marking_criteria}` : ''}
`).join('---')}

CRITICAL: Every entry MUST have non-empty feedback, sample_response, and recommendation. Output exactly ${answersForMarking.length} objects.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        marked_answers: { type: "array", items: { type: "object", properties: { question_number: { type: "string" }, marks_awarded: { type: "number" }, max_marks: { type: "number" }, feedback: { type: "string" }, sample_response: { type: "string" }, recommendation: { type: "string" } }, required: ["question_number", "marks_awarded", "max_marks", "feedback", "sample_response", "recommendation"] } },
                        overall_feedback: { type: "string" },
                        strengths: { type: "array", items: { type: "string" } },
                        areas_for_improvement: { type: "array", items: { type: "string" } }
                    },
                    required: ["marked_answers", "overall_feedback", "strengths", "areas_for_improvement"]
                }
            });

            const aiAnswers = markingResponse.marked_answers || [];
            const completeMarkedAnswers = answersForMarking.map(q => {
                const ai = aiAnswers.find(a => a.question_number === q.question_number) || aiAnswers[answersForMarking.indexOf(q)];
                return {
                    question_number: q.question_number,
                    marks_awarded: ai?.marks_awarded ?? 0,
                    max_marks: ai?.max_marks ?? q.marks ?? 1,
                    feedback: ai?.feedback || "No feedback available for this question.",
                    sample_response: ai?.sample_response || "See your teacher for a sample response.",
                    recommendation: ai?.recommendation || "Review this topic and attempt similar questions to build confidence."
                };
            });

            let totalAwarded = 0, totalPossible = 0;
            completeMarkedAnswers.forEach(a => { totalAwarded += a.marks_awarded; totalPossible += a.max_marks; });
            const percentage = totalPossible > 0 ? Math.round((totalAwarded / totalPossible) * 100) : 0;

            const savedAttempt = await PastPaperAttempt.create({
                paper_id: paper.id, paper_title: paper.title, subject: paper.subject,
                answers: completeMarkedAnswers.map(a => ({ ...a, answer: answers[a.question_number] || "", time_spent: finalQuestionTimes[paper.questions.findIndex(q => q.question_number === a.question_number)] || 0 })),
                total_marks_awarded: totalAwarded, total_marks_possible: totalPossible, percentage,
                time_taken: totalTimeElapsed, completed_date: format(new Date(), 'yyyy-MM-dd')
            });

            setResults({ ...markingResponse, marked_answers: completeMarkedAnswers, answerableQuestions, totalAwarded, totalPossible, percentage, questionTimes: finalQuestionTimes, unanswerableCount: unanswerableQuestionsArr.length, unanswerableMarks: unanswerableQuestionsArr.reduce((s, q) => s + (q.marks || 1), 0), attemptId: savedAttempt.id });
            setIsCompleted(true);
        } catch (error) {
            console.error("Error submitting:", error);
            toast({ title: "Error", description: "Failed to mark your answers.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const progress = ((currentQuestion + 1) / paper.questions.length) * 100;
    const timeStatus = getTimeStatus();

    const renderLatex = (text) => processLatexContent(text || "").map((part, idx) => {
        if (part.type === 'display') return <LatexBlock key={idx}>{part.content}</LatexBlock>;
        if (part.type === 'inline') return <LatexInline key={idx}>{part.content}</LatexInline>;
        return <span key={idx} className="whitespace-pre-wrap">{part.content}</span>;
    });

    const getTab = (qNum) => activeTab[qNum] || 'feedback';
    const setTab = (qNum, tab) => setActiveTab(prev => ({ ...prev, [qNum]: tab }));

    // ─── RESULTS VIEW ──────────────────────────────────────────────
    if (isCompleted && results) {
        const pct = results.percentage;
        const grade = pct >= 80 ? { label: 'Excellent', bg: 'from-emerald-500 to-teal-600', ring: 'ring-emerald-300' }
            : pct >= 65 ? { label: 'Good Work', bg: 'from-blue-500 to-indigo-600', ring: 'ring-blue-300' }
            : pct >= 50 ? { label: 'Developing', bg: 'from-amber-500 to-orange-500', ring: 'ring-amber-300' }
            : { label: 'Keep Trying', bg: 'from-red-500 to-rose-600', ring: 'ring-red-300' };

        const tabs = [
            { id: 'feedback', icon: MessageSquare, label: 'Feedback' },
            { id: 'sample', icon: Star, label: 'Sample Response' },
            { id: 'tip', icon: Lightbulb, label: 'Tips' },
        ];

        return (
            <div className="pb-16 space-y-4">
                <button onClick={onComplete} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Back to Tests
                </button>

                {/* Score Hero */}
                <div className={`rounded-2xl bg-gradient-to-br ${grade.bg} p-6 text-white overflow-hidden relative`}>
                    <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <div className="relative">
                        <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-0.5">{paper.subject}</p>
                        <h2 className="text-lg font-bold text-white mb-4 leading-tight">{paper.title}</h2>
                        <div className="flex items-end justify-between">
                            <div>
                                <div className="text-6xl font-black leading-none">{pct}%</div>
                                <div className="text-white/70 text-sm mt-1">{grade.label}</div>
                            </div>
                            <div className="text-right text-white/80 text-sm space-y-1">
                                <div className="flex items-center gap-1.5 justify-end"><Zap className="w-3.5 h-3.5" />{results.totalAwarded}/{results.totalPossible} marks</div>
                                <div className="flex items-center gap-1.5 justify-end"><Clock className="w-3.5 h-3.5" />{formatTime(totalTimeElapsed)} taken</div>
                                {results.unanswerableCount > 0 && <div className="flex items-center gap-1.5 justify-end"><Ban className="w-3.5 h-3.5" />{results.unanswerableCount} skipped</div>}
                            </div>
                        </div>
                        <div className="mt-4 h-1.5 bg-white/20 rounded-full"><div className="h-full bg-white/70 rounded-full" style={{ width: `${pct}%` }} /></div>
                    </div>
                </div>

                {/* AI note */}
                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    AI marking may need adjustments — expand any question to review and edit marks.
                </div>

                {/* Strengths & Improvements */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {results.strengths?.length > 0 && (
                        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center"><CheckCircle className="w-4 h-4 text-emerald-600" /></div>
                                <span className="text-sm font-bold text-gray-800">What You Did Well</span>
                            </div>
                            <ul className="space-y-2">{results.strengths.map((s, i) => <li key={i} className="text-sm text-gray-600 flex gap-2"><span className="text-emerald-500 font-bold flex-shrink-0">✓</span>{s}</li>)}</ul>
                        </div>
                    )}
                    {results.areas_for_improvement?.length > 0 && (
                        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-7 h-7 bg-rose-100 rounded-lg flex items-center justify-center"><TrendingUp className="w-4 h-4 text-rose-600" /></div>
                                <span className="text-sm font-bold text-gray-800">Focus Areas</span>
                            </div>
                            <ul className="space-y-2">{results.areas_for_improvement.map((a, i) => <li key={i} className="text-sm text-gray-600 flex gap-2"><span className="text-rose-400 font-bold flex-shrink-0">→</span>{a}</li>)}</ul>
                        </div>
                    )}
                </div>

                {results.overall_feedback && (
                    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Examiner's Summary</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{results.overall_feedback}</p>
                    </div>
                )}

                {/* Question Breakdown */}
                <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Question Breakdown</p>
                    <div className="space-y-2">
                        {results.marked_answers.map((answer, qIndex) => {
                            const q = paper.questions.find(pq => pq.question_number === answer.question_number) || paper.questions[qIndex];
                            if (!q) return null;
                            const paperQIdx = paper.questions.findIndex(pq => pq.question_number === answer.question_number);
                            const timeSpent = results.questionTimes[paperQIdx] || 0;
                            const tookTooLong = timeSpent > getQuestionTime(q) * 1.5;
                            const isFullMarks = answer.marks_awarded >= answer.max_marks;
                            const isPartial = !isFullMarks && answer.marks_awarded > 0;
                            const wasAttempted = !!(answers[q.question_number] || imageAnswers[q.question_number]);
                            const isExpanded = expandedQuestion === answer.question_number;
                            const currentTab = getTab(answer.question_number);

                            const accentLeft = isFullMarks ? 'border-l-emerald-400' : isPartial ? 'border-l-amber-400' : 'border-l-red-400';
                            const dotFill = isFullMarks ? 'bg-emerald-400' : isPartial ? 'bg-amber-400' : 'bg-red-400';
                            const scorePill = isFullMarks ? 'bg-emerald-100 text-emerald-700' : isPartial ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600';

                            return (
                                <div key={answer.question_number} className={`bg-white rounded-xl border border-gray-200 border-l-4 ${accentLeft} shadow-sm overflow-hidden`}>
                                    <button
                                        onClick={() => setExpandedQuestion(isExpanded ? null : answer.question_number)}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50/80 transition-colors text-left"
                                    >
                                        <div className="flex gap-0.5 flex-shrink-0">
                                            {Array.from({ length: Math.min(answer.max_marks, 8) }).map((_, i) => (
                                                <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < answer.marks_awarded ? dotFill : 'bg-gray-200'}`} />
                                            ))}
                                        </div>
                                        <span className="text-sm font-bold text-gray-800 flex-shrink-0">Q{answer.question_number}</span>
                                        <span className="text-xs text-gray-400 flex-1 truncate hidden sm:block">{q.question_text?.substring(0, 65)}...</span>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            {tookTooLong && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-md font-semibold flex items-center gap-1"><AlertTriangle className="w-2.5 h-2.5" />Slow</span>}
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${scorePill}`}>{answer.marks_awarded}/{answer.max_marks}</span>
                                            <ChevronDown className={`w-4 h-4 text-gray-300 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                        </div>
                                    </button>

                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.18 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="border-t border-gray-100">
                                                    {/* Question */}
                                                    <div className="px-4 py-3 bg-gray-50/70 border-b border-gray-100">
                                                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wide mb-1.5">Question</p>
                                                        <div className="text-sm text-gray-800 leading-relaxed">{renderLatex(q.question_text)}</div>
                                                    </div>
                                                    {/* Your answer */}
                                                    <div className="px-4 py-3 border-b border-gray-100">
                                                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wide mb-1.5">Your Answer</p>
                                                        {wasAttempted ? (
                                                            <p className="text-sm text-gray-700">{answers[q.question_number] || "(Image submitted)"}</p>
                                                        ) : (
                                                            <p className="text-sm text-gray-400 italic">Not attempted</p>
                                                        )}
                                                        {imageAnswers[q.question_number] && (
                                                            <img src={imageAnswers[q.question_number]} alt="Answer" className="mt-2 max-w-xs rounded-lg border border-gray-200" />
                                                        )}
                                                    </div>

                                                    {/* Tabs */}
                                                    <div className="flex border-b border-gray-100">
                                                        {tabs.map(tab => (
                                                            <button
                                                                key={tab.id}
                                                                onClick={() => setTab(answer.question_number, tab.id)}
                                                                className={`flex-1 flex items-center justify-center gap-1 text-xs font-semibold py-2.5 border-b-2 transition-all ${
                                                                    currentTab === tab.id
                                                                        ? 'border-violet-500 text-violet-700 bg-violet-50/40'
                                                                        : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                                                                }`}
                                                            >
                                                                <tab.icon className="w-3 h-3" />{tab.label}
                                                            </button>
                                                        ))}
                                                    </div>

                                                    {/* Tab content */}
                                                    <div className="px-4 py-4 min-h-[60px]">
                                                        <AnimatePresence mode="wait">
                                                            <motion.div key={currentTab} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
                                                                {currentTab === 'feedback' && (
                                                                    <div className="space-y-2">
                                                                        <p className="text-sm text-gray-700 leading-relaxed">{answer.feedback}</p>
                                                                    </div>
                                                                )}
                                                                {currentTab === 'sample' && (
                                                                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                                                                        <p className="text-xs font-bold text-emerald-700 mb-2 flex items-center gap-1"><Star className="w-3 h-3" />Full-marks sample response ({answer.max_marks} mark{answer.max_marks !== 1 ? 's' : ''})</p>
                                                                        <div className="text-sm text-emerald-900 leading-relaxed space-y-1">{renderLatex(answer.sample_response)}</div>
                                                                    </div>
                                                                )}
                                                                {currentTab === 'tip' && (
                                                                    <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                                                                        <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                                                                        <p className="text-sm text-amber-900 leading-relaxed">{answer.recommendation}</p>
                                                                    </div>
                                                                )}
                                                            </motion.div>
                                                        </AnimatePresence>
                                                    </div>

                                                    {tookTooLong && (
                                                        <div className="px-4 pb-3">
                                                            <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-100 flex items-center gap-2">
                                                                <AlertTriangle className="w-3.5 h-3.5" />
                                                                Spent {formatTime(timeSpent - getQuestionTime(q))} over the recommended time
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Mark adjuster */}
                                                    <div className="flex items-center gap-3 px-4 py-3 border-t border-gray-100 bg-gray-50/60">
                                                        <span className="text-xs text-gray-400 font-semibold">Adjust:</span>
                                                        <Input
                                                            type="number" min="0" max={answer.max_marks} step="0.5"
                                                            value={editingMarks[answer.question_number] !== undefined ? editingMarks[answer.question_number] : answer.marks_awarded}
                                                            onChange={(e) => handleAdjustMarks(answer.question_number, e.target.value)}
                                                            onWheel={(e) => e.target.blur()}
                                                            className="w-16 h-8 text-sm text-center"
                                                        />
                                                        <span className="text-xs text-gray-400">/ {answer.max_marks}</span>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {Object.keys(editingMarks).length > 0 && (
                    <div className="sticky bottom-4 flex justify-center">
                        <Button onClick={handleSaveAdjustments} className="bg-violet-600 hover:bg-violet-700 shadow-2xl shadow-violet-200 px-8 rounded-full">
                            <CheckCircle className="w-4 h-4 mr-2" /> Save Adjusted Marks
                        </Button>
                    </div>
                )}
            </div>
        );
    }

    // ─── SUBMITTING ──────────────────────────────────────────────
    if (isSubmitting) {
        return <AILoadingProgress stage="analyzing" message="AI is marking your test..." estimatedTime={60} />;
    }

    // ─── TEST-TAKING VIEW ──────────────────────────────────────────
    const answeredCount = Object.keys(answers).filter(k => answers[k]?.trim()).length + Object.keys(imageAnswers).length;

    return (
        <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 60px)' }}>
            {/* Dark sticky header */}
            <div className="sticky top-0 z-40 bg-gray-950 text-white px-4 py-3 flex items-center justify-between gap-3 shadow-2xl -mx-4 sm:-mx-6 lg:-mx-8">
                <button onClick={onBack} className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors flex-shrink-0">
                    <ArrowLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Exit</span>
                </button>
                <div className="flex-1 text-center min-w-0">
                    <p className="text-gray-500 text-xs uppercase tracking-widest truncate">{paper.subject}</p>
                    <p className="text-sm font-semibold text-white truncate leading-tight">{paper.title}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold ${
                        timeStatus === 'overtime' ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/40' :
                        timeStatus === 'warning' ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10 text-white'
                    }`}>
                        <Timer className="w-3 h-3" />
                        {formatTime(totalTimeElapsed)}
                    </div>
                    <div className="text-xs font-bold bg-white/10 px-2.5 py-1 rounded-full">
                        {currentQuestion + 1}/{paper.questions.length}
                    </div>
                </div>
            </div>

            {/* Progress strips */}
            <div className="flex-shrink-0 -mx-4 sm:-mx-6 lg:-mx-8">
                <div className="h-0.5 bg-gray-800">
                    <motion.div className="h-full bg-violet-500" animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
                </div>
                <div className="h-0.5 bg-gray-100">
                    <div className={`h-full transition-all duration-1000 ${timeStatus === 'overtime' ? 'bg-red-500' : timeStatus === 'warning' ? 'bg-amber-400' : 'bg-sky-400'}`}
                        style={{ width: `${Math.min(100, (getCurrentQuestionTime() / questionTimeAllowed) * 100)}%` }} />
                </div>
            </div>

            {/* Question content */}
            <div className="flex-1 py-5">
                <AnimatePresence mode="wait">
                    <motion.div key={currentQuestion}
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.18 }}
                        className="max-w-2xl mx-auto space-y-3"
                    >
                        {/* Meta */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black bg-gray-900 text-white px-2.5 py-1 rounded-lg">Q{question.question_number}</span>
                            <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg flex items-center gap-1">
                                <Award className="w-3 h-3" />{question.marks || 1} mark{(question.marks || 1) !== 1 ? 's' : ''}
                            </span>
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1 ${
                                timeStatus === 'overtime' ? 'bg-red-100 text-red-700' : timeStatus === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-sky-50 text-sky-700'
                            }`}><Clock className="w-3 h-3" />~{formatTime(questionTimeAllowed)}</span>
                            {timeStatus === 'overtime' && <span className="text-xs font-bold bg-red-500 text-white px-2 py-1 rounded-lg flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Over Time</span>}
                        </div>

                        {/* Question card */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                            <div className="text-base text-gray-900 leading-relaxed space-y-2">
                                {processLatexContent(question.question_text || "").map((part, idx) => {
                                    if (part.type === 'display') return <LatexBlock key={idx}>{part.content}</LatexBlock>;
                                    if (part.type === 'inline') return <LatexInline key={idx}>{part.content}</LatexInline>;
                                    return <span key={idx}>{part.content}</span>;
                                })}
                            </div>
                        </div>

                        {/* Answer card */}
                        {!unanswerableQuestions[question.question_number] ? (
                            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-semibold text-gray-700">Your Answer</span>
                                    {question.question_type !== 'mcq' && (
                                        <div className="flex items-center gap-2">
                                            <Calculator className="w-3.5 h-3.5 text-gray-400" />
                                            <Switch checked={mathMode[question.question_number] || false}
                                                onCheckedChange={(c) => { setMathMode(prev => ({...prev, [question.question_number]: c})); setShowKeyboard(prev => ({...prev, [question.question_number]: c})); }} />
                                            <span className="text-xs text-gray-500">Math</span>
                                        </div>
                                    )}
                                </div>

                                {question.question_type === 'mcq' && question.mcq_options ? (
                                    <RadioGroup value={answers[question.question_number]?.toString() || ""} onValueChange={(v) => handleAnswerChange(question.question_number, v)} className="space-y-2">
                                        {question.mcq_options.map((option, idx) => (
                                            <div key={idx}
                                                onClick={() => handleAnswerChange(question.question_number, idx.toString())}
                                                className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${answers[question.question_number] === idx.toString() ? 'border-violet-400 bg-violet-50' : 'border-gray-200 hover:border-gray-300'}`}
                                            >
                                                <RadioGroupItem value={idx.toString()} id={`opt-${idx}`} />
                                                <Label htmlFor={`opt-${idx}`} className="flex-1 cursor-pointer text-sm text-gray-800">{renderLatex(option)}</Label>
                                            </div>
                                        ))}
                                    </RadioGroup>
                                ) : mathMode[question.question_number] ? (
                                    <>
                                        <MathInput value={answers[question.question_number] || ""} onChange={(v) => handleAnswerChange(question.question_number, v)}
                                            onCursorPositionChange={(p) => setCursorPosition(prev => ({...prev, [question.question_number]: p}))}
                                            textareaRef={(ref) => { if (ref) mathInputRefs.current[question.question_number] = ref; }}
                                            placeholder="Type your answer here..." rows={8}
                                            className="w-full rounded-xl border-2 border-gray-200 focus-within:border-violet-400" />
                                        {showKeyboard[question.question_number] && (
                                            <MathKeyboard
                                                getCurrentValue={() => answers[question.question_number] || ""}
                                                onInput={(value, options = {}) => {
                                                    let cv = answers[question.question_number] || "";
                                                    const ta = mathInputRefs.current[question.question_number];
                                                    const pos = ta?.selectionStart ?? cv.length;
                                                    let nv, nc;
                                                    if (options.replaceLastToken && cv.trim()) {
                                                        const bc = cv.substring(0, pos);
                                                        const tokens = bc.match(/[\d.]+|[a-zA-Z]+|[^\s\w]/g) || [];
                                                        if (tokens.length > 0 && /^[\d.]+$/.test(tokens[tokens.length - 1])) {
                                                            const lt = tokens[tokens.length - 1];
                                                            const ltp = bc.lastIndexOf(lt);
                                                            const rv = value.replace(/^x/, lt);
                                                            nv = cv.substring(0, ltp) + rv + cv.substring(pos);
                                                            nc = ltp + rv.length;
                                                            handleAnswerChange(question.question_number, nv);
                                                            setCursorPosition(prev => ({...prev, [question.question_number]: nc}));
                                                            setTimeout(() => { if (ta) { ta.selectionStart = nc; ta.selectionEnd = nc; ta.focus(); } }, 0);
                                                            return;
                                                        }
                                                    }
                                                    nv = cv.substring(0, pos) + value + cv.substring(pos);
                                                    nc = pos + value.length;
                                                    handleAnswerChange(question.question_number, nv);
                                                    setCursorPosition(prev => ({...prev, [question.question_number]: nc}));
                                                    setTimeout(() => { if (ta) { ta.selectionStart = nc; ta.selectionEnd = nc; ta.focus(); } }, 0);
                                                }}
                                                onBackspace={() => {
                                                    const cv = answers[question.question_number] || "";
                                                    const ta = mathInputRefs.current[question.question_number];
                                                    const pos = ta?.selectionStart ?? cv.length;
                                                    if (pos > 0) {
                                                        const nv = cv.substring(0, pos - 1) + cv.substring(pos);
                                                        const nc = pos - 1;
                                                        handleAnswerChange(question.question_number, nv);
                                                        setCursorPosition(prev => ({...prev, [question.question_number]: nc}));
                                                        setTimeout(() => { if (ta) { ta.selectionStart = nc; ta.selectionEnd = nc; ta.focus(); } }, 0);
                                                    }
                                                }}
                                                onClear={() => {
                                                    handleAnswerChange(question.question_number, "");
                                                    setCursorPosition(prev => ({...prev, [question.question_number]: 0}));
                                                    const ta = mathInputRefs.current[question.question_number];
                                                    setTimeout(() => { if (ta) { ta.selectionStart = 0; ta.selectionEnd = 0; ta.focus(); } }, 0);
                                                }}
                                            />
                                        )}
                                    </>
                                ) : (
                                    <Textarea
                                        ref={(el) => { if (el) textAreaRefs.current[question.question_number] = el; }}
                                        value={answers[question.question_number] || ""}
                                        onChange={(e) => handleAnswerChange(question.question_number, e.target.value)}
                                        placeholder="Write your answer here..."
                                        className="min-h-[150px] border-gray-200 focus:border-violet-400 rounded-xl resize-none text-sm"
                                    />
                                )}

                                {/* Image upload */}
                                {question.question_type !== 'mcq' && (
                                    <div className="pt-2 border-t border-gray-100">
                                        <input ref={(el) => { if (el) fileInputRefs.current[question.question_number] = el; }}
                                            type="file" accept="image/*"
                                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(question.question_number, f); }}
                                            className="hidden" />
                                        {!imageAnswers[question.question_number] ? (
                                            <button type="button" onClick={() => fileInputRefs.current[question.question_number]?.click()} disabled={uploadingImage}
                                                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-violet-600 transition-colors">
                                                {uploadingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
                                                {uploadingImage ? 'Uploading...' : 'Attach image answer'}
                                            </button>
                                        ) : (
                                            <div className="flex items-center gap-3">
                                                <img src={imageAnswers[question.question_number]} alt="Answer" className="h-16 rounded-lg border border-gray-200 object-cover" />
                                                <button type="button" className="text-xs text-red-500 hover:text-red-700"
                                                    onClick={() => setImageAnswers(prev => { const n = {...prev}; delete n[question.question_number]; return n; })}>
                                                    Remove
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="bg-orange-50 rounded-2xl border-2 border-orange-200 p-5 text-center">
                                <Ban className="w-8 h-8 text-orange-400 mx-auto mb-1.5" />
                                <p className="font-semibold text-orange-800 text-sm">Skipped</p>
                                <p className="text-xs text-orange-600 mt-0.5">Won't affect your score</p>
                            </div>
                        )}

                        {/* Skip toggle */}
                        <div className="flex items-center gap-2">
                            <Checkbox id={`skip-${question.question_number}`} checked={!!unanswerableQuestions[question.question_number]} onCheckedChange={() => toggleUnanswerable(question.question_number)} />
                            <Label htmlFor={`skip-${question.question_number}`} className="text-xs text-gray-400 cursor-pointer flex items-center gap-1">
                                <Ban className="w-3 h-3" /> Skip this question
                            </Label>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Bottom nav */}
            <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 px-4 py-3 -mx-4 sm:-mx-6 lg:-mx-8">
                <div className="max-w-2xl mx-auto">
                    <div className="flex items-center gap-1.5 flex-wrap justify-center mb-3">
                        {paper.questions.map((q, idx) => {
                            const isAnswered = !!answers[q.question_number] || !!imageAnswers[q.question_number];
                            const isSkipped = !!unanswerableQuestions[q.question_number];
                            const isCurrent = idx === currentQuestion;
                            return (
                                <button key={q.question_number} onClick={() => setCurrentQuestion(idx)}
                                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                                        isCurrent ? 'bg-gray-950 text-white scale-110' :
                                        isSkipped ? 'bg-orange-100 text-orange-600' :
                                        isAnswered ? 'bg-emerald-100 text-emerald-700' :
                                        'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                    }`}>
                                    {idx + 1}
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                        <Button variant="outline" size="sm" onClick={() => setCurrentQuestion(p => Math.max(0, p - 1))} disabled={currentQuestion === 0} className="rounded-xl">
                            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Prev
                        </Button>
                        <span className="text-xs text-gray-400">{answeredCount}/{paper.questions.length} answered</span>
                        {currentQuestion === paper.questions.length - 1 ? (
                            <Button onClick={handleSubmit} disabled={isSubmitting}
                                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 rounded-xl shadow-lg shadow-violet-200/50">
                                <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Submit
                            </Button>
                        ) : (
                            <Button size="sm" onClick={() => setCurrentQuestion(p => Math.min(paper.questions.length - 1, p + 1))}
                                className="bg-gray-900 hover:bg-gray-800 text-white rounded-xl">
                                Next <ArrowRight className="w-3.5 h-3.5 ml-1" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}