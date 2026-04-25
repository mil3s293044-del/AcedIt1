import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { fetchVCAAPaper } from "@/functions/fetchVCAAPaper";
import { renderPdfPages } from "@/functions/renderPdfPages";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
    GraduationCap, Clock, Play, Loader2, Flag, CheckCircle2,
    Sparkles, BarChart3, RefreshCw, Target, FileText, Award,
    Check, BookOpen, AlertCircle, ExternalLink
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

// ─── Constants ────────────────────────────────────────────────────────────────

const VCE_SUBJECTS = [
    { name: "English", hasExam1: true, hasExam2: false, exam1Duration: 180 },
    { name: "English Language", hasExam1: true, hasExam2: false, exam1Duration: 165 },
    { name: "Literature", hasExam1: true, hasExam2: false, exam1Duration: 180 },
    { name: "EAL/D", hasExam1: true, hasExam2: false, exam1Duration: 195 },
    { name: "Mathematical Methods", hasExam1: true, hasExam2: true, exam1Duration: 60, exam2Duration: 120 },
    { name: "Specialist Mathematics", hasExam1: true, hasExam2: true, exam1Duration: 60, exam2Duration: 120 },
    { name: "Further Mathematics", hasExam1: true, hasExam2: true, exam1Duration: 90, exam2Duration: 90 },
    { name: "Physics", hasExam1: true, hasExam2: false, exam1Duration: 150 },
    { name: "Chemistry", hasExam1: true, hasExam2: false, exam1Duration: 150 },
    { name: "Biology", hasExam1: true, hasExam2: false, exam1Duration: 150 },
    { name: "Psychology", hasExam1: true, hasExam2: false, exam1Duration: 150 },
    { name: "Legal Studies", hasExam1: true, hasExam2: false, exam1Duration: 120 },
    { name: "Business Management", hasExam1: true, hasExam2: false, exam1Duration: 120 },
    { name: "Economics", hasExam1: true, hasExam2: false, exam1Duration: 120 },
    { name: "Accounting", hasExam1: true, hasExam2: false, exam1Duration: 120 },
    { name: "History: Revolutions", hasExam1: true, hasExam2: false, exam1Duration: 150 },
    { name: "Health and Human Development", hasExam1: true, hasExam2: false, exam1Duration: 150 },
    { name: "Physical Education", hasExam1: true, hasExam2: false, exam1Duration: 150 },
    { name: "Geography", hasExam1: true, hasExam2: false, exam1Duration: 150 },
    { name: "Sociology", hasExam1: true, hasExam2: false, exam1Duration: 120 },
    { name: "Software Development", hasExam1: true, hasExam2: false, exam1Duration: 150 },
    { name: "Music Performance", hasExam1: true, hasExam2: false, exam1Duration: 120 },
];

const YEARS = ["2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016"];

function formatTime(secs) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function VCAAExamSimulator() {
    const [phase, setPhase] = useState("setup"); // setup | fetching | exam | marking | results
    const [selectedSubject, setSelectedSubject] = useState("");
    const [selectedYear, setSelectedYear] = useState("");
    const [selectedExam, setSelectedExam] = useState("1");
    const [fetchStatus, setFetchStatus] = useState("");

    // Exam data
    const [examPdfDataUrl, setExamPdfDataUrl] = useState(null);
    const [examPdfUrl, setExamPdfUrl] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({});
    const [timeLeft, setTimeLeft] = useState(0);

    // Marking data
    const [markingStatus, setMarkingStatus] = useState("");
    const [markingResults, setMarkingResults] = useState(null);
    const [examinerInsights, setExaminerInsights] = useState(null);
    const [reportPdfDataUrl, setReportPdfDataUrl] = useState(null);
    const [reportUrl, setReportUrl] = useState(null);
    const [markingError, setMarkingError] = useState(null);

    const hasSubmitted = useRef(false);
    const { toast } = useToast();

    const subjectInfo = VCE_SUBJECTS.find(s => s.name === selectedSubject);
    const examDuration = selectedExam === "1" ? subjectInfo?.exam1Duration : subjectInfo?.exam2Duration;
    const isLow = timeLeft <= 600;
    const isVeryLow = timeLeft <= 120;
    const totalMarks = questions.reduce((s, q) => s + (q.marks || 1), 0);
    const answeredCount = questions.filter(q =>
        q.type === "mcq"
            ? answers[q.id]?.selectedOption !== undefined
            : (answers[q.id]?.text || "").trim().length > 0
    ).length;

    // Timer
    useEffect(() => {
        if (phase !== "exam") return;
        const interval = setInterval(() => setTimeLeft(t => {
            if (t <= 1) { submitExam(); return 0; }
            return t - 1;
        }), 1000);
        return () => clearInterval(interval);
    }, [phase]);

    function submitExam() {
        if (hasSubmitted.current) return;
        hasSubmitted.current = true;
        setPhase("marking");
    }

    function resetAll() {
        setPhase("setup");
        setExamPdfDataUrl(null);
        setExamPdfUrl(null);
        setQuestions([]);
        setAnswers({});
        setMarkingResults(null);
        setExaminerInsights(null);
        setReportPdfDataUrl(null);
        setReportUrl(null);
        setMarkingError(null);
        hasSubmitted.current = false;
    }

    // ── FETCH EXAM ─────────────────────────────────────────────────────────────
    async function handleFetchExam() {
        if (!selectedSubject || !selectedYear) {
            toast({ title: "Please select a subject and year", variant: "destructive" });
            return;
        }
        setPhase("fetching");

        try {
            setFetchStatus("Finding exam on VCAA website...");
            const pdfResponse = await fetchVCAAPaper({
                subject: selectedSubject,
                year: selectedYear,
                examNumber: parseInt(selectedExam),
                type: "exam"
            });

            if (pdfResponse.data?.error === "not_found") {
                toast({ title: "Exam not found", description: pdfResponse.data.message, variant: "destructive" });
                setPhase("setup");
                return;
            }

            const { extracted_text: examText, url: pdfUrl } = pdfResponse.data;
            if (!examText || examText.length < 100) {
                toast({ title: "Couldn't read this exam", description: "Try another year.", variant: "destructive" });
                setPhase("setup");
                return;
            }

            setExamPdfUrl(pdfUrl);

            // Fetch PDF bytes for inline rendering
            setFetchStatus("Loading exam PDF...");
            let pdfDataUrl = null;
            try {
                const renderResp = await renderPdfPages({ pdf_url: pdfUrl });
                if (renderResp.data?.success) pdfDataUrl = renderResp.data.pdf_data_url;
            } catch (e) {
                console.warn("PDF inline render failed, will fallback to link:", e);
            }

            // AI question detection — number, marks, type ONLY
            setFetchStatus("Detecting questions...");
            const detected = await base44.integrations.Core.InvokeLLM({
                prompt: `You are analysing a VCE ${selectedSubject} Exam ${selectedExam} (${selectedYear}).

From the raw text below, extract ALL question numbers with mark allocations and types.

RULES:
- type = "mcq" ONLY for Section A questions worth 1 mark where A/B/C/D options appear in the text.
- type = "written" for everything else (short answer, extended response, any multi-mark question, any Section B/C question).
- List sub-parts (e.g. 3a, 3b) as separate entries.
- Do not skip any question.

--- EXAM TEXT ---
${examText.substring(0, 20000)}
---`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        questions: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    id: { type: "string" },
                                    number: { type: "string" },
                                    label: { type: "string" },
                                    type: { type: "string", enum: ["mcq", "written"] },
                                    marks: { type: "number" }
                                },
                                required: ["id", "number", "label", "type", "marks"]
                            }
                        },
                        duration_minutes: { type: "number" }
                    },
                    required: ["questions"]
                }
            });

            const detectedQs = detected.questions || [];
            const duration = detected.duration_minutes || examDuration || 120;

            setQuestions(detectedQs);
            setExamPdfDataUrl(pdfDataUrl);
            setAnswers({});
            hasSubmitted.current = false;
            setTimeLeft(duration * 60);
            setPhase("exam");

        } catch (error) {
            toast({ title: "Failed to load exam", description: error.message, variant: "destructive" });
            setPhase("setup");
        }
    }

    // ── AI MARKING ─────────────────────────────────────────────────────────────
    async function handleAIMark() {
        setMarkingError(null);
        setMarkingStatus("Fetching official VCAA Examiner's Report...");

        // Step 1: Mandatory fetch of examiner's report
        let reportText = null;
        let reportPdfData = null;
        let reportFetchUrl = null;

        try {
            const reportResp = await fetchVCAAPaper({
                subject: selectedSubject,
                year: selectedYear,
                examNumber: parseInt(selectedExam),
                type: "report"
            });

            if (reportResp.data?.error === "not_found") {
                setMarkingError("We couldn't retrieve the official marking scheme for this exam. Marking is unavailable without the official examiner's report.");
                return;
            }

            const text = reportResp.data?.extracted_text;
            reportFetchUrl = reportResp.data?.url;

            // Validate the report actually contains marking content
            const hasMarkingContent = text && text.length > 200 &&
                (/question\s*\d/i.test(text) || /mark/i.test(text) || /answer/i.test(text));

            if (!hasMarkingContent) {
                setMarkingError("We couldn't retrieve the official marking scheme for this exam. The examiner's report appears to be empty or unreadable. Marking is unavailable.");
                return;
            }

            reportText = text;
            setReportUrl(reportFetchUrl);

            // Fetch report PDF for display
            setMarkingStatus("Loading examiner's report PDF...");
            try {
                const reportRender = await renderPdfPages({ pdf_url: reportFetchUrl });
                if (reportRender.data?.success) reportPdfData = reportRender.data.pdf_data_url;
            } catch {}

            if (reportPdfData) setReportPdfDataUrl(reportPdfData);

        } catch (err) {
            setMarkingError("We couldn't retrieve the official marking scheme for this exam. Marking is unavailable without the official examiner's report.");
            return;
        }

        // Step 2: Extract MCQ answer key from report text
        setMarkingStatus("Extracting answer key from examiner's report...");
        let mcqAnswerKey = {};
        const mcqQuestions = questions.filter(q => q.type === "mcq");

        if (mcqQuestions.length > 0) {
            try {
                const keyResp = await base44.integrations.Core.InvokeLLM({
                    prompt: `From this official VCAA Examiner's Report for ${selectedSubject} Exam ${selectedExam} (${selectedYear}), extract the multiple choice answer key.

The answer key is typically listed as a table showing Question 1: A, Question 2: C, etc. or similar format.

--- EXAMINER'S REPORT ---
${reportText.substring(0, 10000)}
---

Return the answer key as a mapping of question number (as a string, e.g. "1", "2") to the correct option letter (A, B, C, or D).
Only include questions that are multiple choice. If you cannot find the answer key, return an empty object.`,
                    response_json_schema: {
                        type: "object",
                        properties: {
                            answer_key: {
                                type: "object",
                                additionalProperties: { type: "string" }
                            }
                        },
                        required: ["answer_key"]
                    }
                });
                mcqAnswerKey = keyResp.answer_key || {};
            } catch {}
        }

        // Step 3: Auto-mark MCQs against the answer key
        const autoMarkedMCQ = {};
        mcqQuestions.forEach(q => {
            const correctAnswer = mcqAnswerKey[q.number] || mcqAnswerKey[q.id];
            if (correctAnswer) {
                const studentAnswer = answers[q.id]?.selectedOption;
                const correct = studentAnswer === correctAnswer;
                autoMarkedMCQ[q.id] = {
                    question_id: q.id,
                    marks_awarded: correct ? 1 : 0,
                    total_marks: 1,
                    correct_answer: correctAnswer,
                    feedback: correct
                        ? `Correct. The answer is ${correctAnswer}.`
                        : `Incorrect. You answered ${studentAnswer || "(no answer)"}. The correct answer is ${correctAnswer}.`,
                    official_criteria: `Answer key from VCAA Examiner's Report: ${correctAnswer}`
                };
            }
        });

        // Step 4: AI marking for written questions (and MCQs without an answer key)
        setMarkingStatus("Marking written answers against official criteria...");

        const writtenQuestions = questions.filter(q => q.type === "written" || !autoMarkedMCQ[q.id]);
        const answersPayload = writtenQuestions.map(q => ({
            question_id: q.id,
            question_number: q.label,
            type: q.type,
            marks: q.marks,
            student_answer: q.type === "mcq"
                ? (answers[q.id]?.selectedOption ?? "(no answer)")
                : (answers[q.id]?.text || "(no answer)")
        }));

        let aiMarked = {};
        if (answersPayload.length > 0) {
            const markingResp = await base44.integrations.Core.InvokeLLM({
                prompt: `You are marking a student's VCE ${selectedSubject} Exam ${selectedExam} (${selectedYear}) responses.

You MUST use ONLY the official marking criteria contained in the following examiner's report text to determine correct answers and award marks. Do not use any prior knowledge, do not guess, and do not deviate from the official criteria.

For each question:
1. Find the corresponding marking criteria in the examiner's report text below.
2. Compare the student's answer directly against those criteria.
3. Award marks only where the student's answer satisfies the official criteria.
4. Provide specific feedback quoting the relevant criteria from the report.
5. Include the exact official criteria in your response.
6. If you cannot find marking criteria for a question in the provided examiner's report text, set feedback to "Marking criteria not found in report" and award 0 marks.

--- OFFICIAL VCAA EXAMINER'S REPORT (USE ONLY THIS FOR MARKING) ---
${reportText.substring(0, 30000)}
--- END OF EXAMINER'S REPORT ---

STUDENT ANSWERS TO MARK:
${JSON.stringify(answersPayload, null, 2)}`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        marked_questions: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    question_id: { type: "string" },
                                    marks_awarded: { type: "number" },
                                    total_marks: { type: "number" },
                                    feedback: { type: "string" },
                                    official_criteria: { type: "string" },
                                    correct_answer: { type: "string" }
                                },
                                required: ["question_id", "marks_awarded", "total_marks", "feedback", "official_criteria"]
                            }
                        },
                        overall_feedback: { type: "string" },
                        common_mistakes: { type: "array", items: { type: "string" } },
                        high_score_tips: { type: "array", items: { type: "string" } }
                    },
                    required: ["marked_questions", "overall_feedback"]
                }
            });

            (markingResp.marked_questions || []).forEach(mr => { aiMarked[mr.question_id] = mr; });

            setExaminerInsights({
                overall: markingResp.overall_feedback,
                common_mistakes: markingResp.common_mistakes || [],
                high_score_tips: markingResp.high_score_tips || []
            });
        }

        // Merge MCQ auto-marks + AI marks
        const allResults = { ...aiMarked, ...autoMarkedMCQ };
        setMarkingResults(allResults);
        setMarkingStatus("");
        setPhase("results");
    }

    // ═════════════════════════════════════════════════════════════════════════
    // RENDER
    // ═════════════════════════════════════════════════════════════════════════

    // ── SETUP ─────────────────────────────────────────────────────────────────
    if (phase === "setup") {
        return (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-5">
                <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 rounded-3xl p-8 text-white">
                    <div className="absolute inset-0 opacity-20 pointer-events-none">
                        <div className="absolute top-0 right-0 w-40 h-40 bg-purple-400 rounded-full blur-3xl" />
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-400 rounded-full blur-2xl" />
                    </div>
                    <div className="relative text-center">
                        <div className="w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4 ring-1 ring-white/20">
                            <GraduationCap className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-3xl font-black mb-2">Past Exam Practice</h2>
                        <p className="text-white/60 text-sm max-w-md mx-auto">
                            Sit real VCAA past exams with the original PDF displayed exactly as printed. Marked against the official examiner's report.
                        </p>
                        <div className="flex justify-center gap-8 mt-5 pt-5 border-t border-white/10">
                            {["Real VCAA PDF", "Preserved Formatting", "Official Report Marking"].map(f => (
                                <p key={f} className="text-xs text-white/50 font-medium">{f}</p>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-slate-400" /> Subject
                        </label>
                        <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                            <SelectTrigger className="h-11 border-2 border-slate-200 rounded-xl">
                                <SelectValue placeholder="Select a VCE subject..." />
                            </SelectTrigger>
                            <SelectContent>
                                {VCE_SUBJECTS.map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700">Year</label>
                            <Select value={selectedYear} onValueChange={setSelectedYear}>
                                <SelectTrigger className="h-11 border-2 border-slate-200 rounded-xl">
                                    <SelectValue placeholder="Select year..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700">Exam</label>
                            <Select value={selectedExam} onValueChange={setSelectedExam} disabled={!subjectInfo}>
                                <SelectTrigger className="h-11 border-2 border-slate-200 rounded-xl">
                                    <SelectValue placeholder="Select exam..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {subjectInfo?.hasExam1 && <SelectItem value="1">Exam 1{subjectInfo.exam1Duration ? ` (${subjectInfo.exam1Duration} min)` : ""}</SelectItem>}
                                    {subjectInfo?.hasExam2 && <SelectItem value="2">Exam 2{subjectInfo.exam2Duration ? ` (${subjectInfo.exam2Duration} min)` : ""}</SelectItem>}
                                    {!subjectInfo && <SelectItem value="1">Exam 1</SelectItem>}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    {selectedSubject && selectedYear && (
                        <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                            <p className="text-sm font-semibold text-indigo-800">{selectedYear} VCE {selectedSubject} — Exam {selectedExam}</p>
                            <p className="text-xs text-indigo-600 mt-0.5">Duration: {examDuration || "?"} minutes · Original VCAA PDF displayed as-is</p>
                        </div>
                    )}
                </div>

                <Button onClick={handleFetchExam} disabled={!selectedSubject || !selectedYear}
                    className="w-full h-14 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-2xl text-base gap-3 shadow-xl shadow-indigo-500/25">
                    <Play className="w-5 h-5" /> Start Exam
                </Button>
            </motion.div>
        );
    }

    // ── FETCHING ──────────────────────────────────────────────────────────────
    if (phase === "fetching") {
        return (
            <div className="flex flex-col items-center justify-center py-28 gap-6">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl flex items-center justify-center shadow-xl shadow-indigo-300">
                    <GraduationCap className="w-10 h-10 text-white" />
                </div>
                <div className="text-center space-y-2">
                    <h3 className="text-xl font-bold text-slate-800">Preparing Your Exam</h3>
                    <p className="text-slate-500 text-sm">{fetchStatus}</p>
                    <p className="text-xs text-slate-400">{selectedYear} VCE {selectedSubject} Exam {selectedExam}</p>
                </div>
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
        );
    }

    // ── EXAM ──────────────────────────────────────────────────────────────────
    if (phase === "exam") {
        return (
            <div className="flex flex-col" style={{ height: "calc(100vh - 120px)" }}>

                {/* ── STICKY HEADER BAR ──────────────────────────────────────── */}
                <div
                    className="flex-shrink-0 rounded-2xl p-3 flex items-center justify-between gap-3 mb-3 transition-colors duration-700"
                    style={{ backgroundColor: isVeryLow ? "#7f1d1d" : isLow ? "#991b1b" : "#0f172a" }}
                >
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                            <GraduationCap className="w-4 h-4 text-white/70" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-white font-bold text-sm truncate">{selectedYear} VCE {selectedSubject} — Exam {selectedExam}</p>
                            <p className="text-white/40 text-xs">{answeredCount}/{questions.length} answered</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <div className={`font-mono font-black text-lg flex items-center gap-1.5 tabular-nums ${isVeryLow ? "text-red-300 animate-pulse" : isLow ? "text-orange-300" : "text-white"}`}>
                            <Clock className="w-4 h-4" /> {formatTime(timeLeft)}
                        </div>
                        {examPdfUrl && (
                            <a href={examPdfUrl} target="_blank" rel="noopener noreferrer"
                                className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-colors" title="Open PDF in new tab">
                                <ExternalLink className="w-3.5 h-3.5 text-white/70" />
                            </a>
                        )}
                        <Button size="sm" onClick={submitExam}
                            className={`rounded-xl font-bold gap-1.5 text-xs px-3 ${isLow ? "bg-red-500 hover:bg-red-600 text-white" : "bg-white/15 hover:bg-white/25 text-white border border-white/20"}`}>
                            <Flag className="w-3 h-3" /> Submit
                        </Button>
                    </div>
                </div>

                {/* ── PROGRESS BAR ──────────────────────────────────────────── */}
                <div className="flex-shrink-0 h-1 bg-slate-200 rounded-full overflow-hidden mb-3">
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                        style={{ width: `${(answeredCount / Math.max(questions.length, 1)) * 100}%` }} />
                </div>

                {/* ── TWO INDEPENDENT PANELS ─────────────────────────────────── */}
                {/* 
                    CRITICAL: These two panels are completely separate DOM containers.
                    - Left: PDF viewer only. No answer content. Independent overflow-y scroll.
                    - Right: Answer sheet only. No PDF content. Independent overflow-y scroll.
                    They share no children, refs, or content.
                */}
                <div className="flex gap-4 flex-1 min-h-0">

                    {/* ── LEFT PANEL: PDF VIEWER ONLY (60%) ─────────────────── */}
                    <div className="flex flex-col" style={{ width: "60%", minWidth: 0 }}>
                        {examPdfDataUrl ? (
                            <iframe
                                src={examPdfDataUrl}
                                title="VCAA Exam PDF"
                                className="w-full flex-1 rounded-2xl border border-slate-200 shadow-sm bg-white"
                                style={{ border: "none" }}
                            />
                        ) : (
                            <div className="flex-1 flex flex-col gap-3">
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-amber-800">PDF cannot be embedded directly</p>
                                        <p className="text-xs text-amber-700 mt-0.5">Open the exam in a new tab to read each question, then enter your answers in the panel on the right.</p>
                                    </div>
                                    {examPdfUrl && (
                                        <a href={examPdfUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                                            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5">
                                                <ExternalLink className="w-3.5 h-3.5" /> Open PDF
                                            </Button>
                                        </a>
                                    )}
                                </div>
                                <div className="flex-1 bg-slate-100 rounded-2xl flex items-center justify-center">
                                    <div className="text-center text-slate-400">
                                        <FileText className="w-16 h-16 mx-auto mb-3 opacity-30" />
                                        <p className="text-sm">Open the PDF link above to read the exam</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── RIGHT PANEL: ANSWER SHEET ONLY (40%) ──────────────── */}
                    <div
                        className="flex flex-col gap-3 overflow-y-auto"
                        style={{ width: "40%", minWidth: 0, flexShrink: 0 }}
                    >
                        {/* Answer sheet header */}
                        <div className="flex-shrink-0 bg-white rounded-2xl border border-slate-100 shadow-sm p-3">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Answer Sheet</p>
                            <p className="text-xs text-slate-500 mt-0.5">{answeredCount} of {questions.length} answered · {totalMarks} marks total</p>
                        </div>

                        {/* One entry per question — no PDF content, no exam text */}
                        {questions.map(q => {
                            const ans = answers[q.id] || {};
                            const isAnswered = q.type === "mcq"
                                ? ans.selectedOption !== undefined
                                : (ans.text || "").trim().length > 0;

                            return (
                                <div key={q.id}
                                    className={`flex-shrink-0 bg-white rounded-2xl border shadow-sm overflow-hidden transition-colors ${isAnswered ? "border-emerald-200" : "border-slate-100"}`}
                                >
                                    {/* Question header row */}
                                    <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-50">
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0 ${isAnswered ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                                            {isAnswered ? <Check className="w-3.5 h-3.5" /> : q.label.replace("Q", "")}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">{q.label}</p>
                                            <p className="text-xs text-slate-400">{q.marks} mark{q.marks !== 1 ? "s" : ""} · {q.type === "mcq" ? "Multiple Choice" : "Written"}</p>
                                        </div>
                                    </div>

                                    {/* Input area */}
                                    <div className="p-3">
                                        {q.type === "mcq" ? (
                                            <div className="grid grid-cols-2 gap-2">
                                                {["A", "B", "C", "D"].map(opt => (
                                                    <button key={opt}
                                                        onClick={() => setAnswers(prev => ({ ...prev, [q.id]: { selectedOption: opt } }))}
                                                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${ans.selectedOption === opt
                                                            ? "bg-indigo-600 border-indigo-600 text-white"
                                                            : "border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50"
                                                            }`}>
                                                        <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-xs flex-shrink-0 ${ans.selectedOption === opt ? "bg-white/20" : "bg-slate-100"}`}>{opt}</span>
                                                        {ans.selectedOption === opt && <Check className="w-3 h-3 ml-auto" />}
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <div>
                                                <Textarea
                                                    value={ans.text || ""}
                                                    onChange={e => setAnswers(prev => ({ ...prev, [q.id]: { text: e.target.value } }))}
                                                    placeholder={`Write your answer for ${q.label} here...`}
                                                    rows={Math.max(3, Math.min(q.marks * 2, 12))}
                                                    className="border-2 border-slate-200 focus:border-indigo-400 rounded-xl resize-none text-sm bg-slate-50 focus:bg-white transition-colors w-full"
                                                />
                                                <p className="text-xs text-slate-400 text-right mt-1">
                                                    {(ans.text || "").split(/\s+/).filter(Boolean).length} words
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Submit button at bottom of answer sheet */}
                        <div className="flex-shrink-0 pb-2">
                            <Button onClick={submitExam}
                                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl h-12 gap-2 font-bold shadow-lg">
                                <Flag className="w-4 h-4" /> Submit Exam
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ── MARKING SCREEN ─────────────────────────────────────────────────────────
    if (phase === "marking") {
        const isRunning = !!markingStatus && !markingError;

        return (
            <div className="max-w-2xl mx-auto space-y-6 py-12 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-indigo-300">
                    <GraduationCap className="w-10 h-10 text-white" />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-slate-800 mb-2">Exam Submitted!</h2>
                    <p className="text-slate-500 text-sm max-w-sm mx-auto">
                        Your answers will be marked against the official VCAA examiner's report and marking scheme. The report must be available to proceed.
                    </p>
                </div>

                {markingError && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-left">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-bold text-red-800">Marking Unavailable</p>
                                <p className="text-sm text-red-700 mt-1">{markingError}</p>
                            </div>
                        </div>
                    </div>
                )}

                {isRunning && (
                    <div className="bg-indigo-50 rounded-2xl p-5 border border-indigo-100">
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-indigo-800">{markingStatus}</p>
                        <p className="text-xs text-indigo-500 mt-1">Reading official VCAA marking criteria...</p>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    {!isRunning && (
                        <Button onClick={handleAIMark} disabled={isRunning}
                            className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl h-12 px-8 gap-2 font-bold shadow-lg">
                            <Sparkles className="w-4 h-4" /> Mark My Exam
                        </Button>
                    )}
                    <Button variant="outline" onClick={resetAll} className="rounded-2xl h-12 px-8 gap-2 font-bold border-2">
                        <RefreshCw className="w-4 h-4" /> Try Another Exam
                    </Button>
                </div>
            </div>
        );
    }

    // ── RESULTS ────────────────────────────────────────────────────────────────
    if (phase === "results" && markingResults) {
        const marksAwarded = Object.values(markingResults).reduce((s, mr) => s + (mr.marks_awarded || 0), 0);
        const pct = totalMarks > 0 ? Math.round((marksAwarded / totalMarks) * 100) : 0;
        const grade = pct >= 80 ? { label: "Excellent", emoji: "🏆", color: "from-amber-500 to-yellow-400" }
            : pct >= 65 ? { label: "Strong", emoji: "⭐", color: "from-emerald-500 to-teal-400" }
            : pct >= 50 ? { label: "Developing", emoji: "📈", color: "from-blue-500 to-indigo-500" }
            : { label: "Keep Revising", emoji: "📚", color: "from-slate-600 to-slate-500" };

        return (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl mx-auto space-y-5 pb-6">

                {/* Score hero */}
                <div className={`bg-gradient-to-br ${grade.color} rounded-3xl p-8 text-white text-center relative overflow-hidden`}>
                    <div className="absolute inset-0 opacity-10 pointer-events-none">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-white rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
                    </div>
                    <div className="relative">
                        <p className="text-5xl mb-3">{grade.emoji}</p>
                        <p className="text-6xl font-black mb-1">{pct}%</p>
                        <p className="text-white/80 font-semibold text-lg mb-1">{grade.label}</p>
                        <p className="text-white/60 text-sm">{selectedYear} VCE {selectedSubject} Exam {selectedExam} · Marked against official VCAA Examiner's Report</p>
                        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/20">
                            <div><p className="text-3xl font-black">{marksAwarded}</p><p className="text-xs text-white/60 mt-0.5">Marks Earned</p></div>
                            <div><p className="text-3xl font-black">{totalMarks}</p><p className="text-xs text-white/60 mt-0.5">Total Marks</p></div>
                            <div><p className="text-3xl font-black">{questions.length}</p><p className="text-xs text-white/60 mt-0.5">Questions</p></div>
                        </div>
                    </div>
                </div>

                {/* Examiner insights */}
                {examinerInsights && (
                    <div className="bg-indigo-50 rounded-3xl border border-indigo-100 p-6 space-y-4">
                        <div className="flex items-center gap-2">
                            <Award className="w-5 h-5 text-indigo-600" />
                            <h3 className="font-bold text-indigo-800 text-sm uppercase tracking-wider">Examiner Insights</h3>
                            <Badge className="text-xs bg-emerald-100 text-emerald-700 border-0">Official Report</Badge>
                        </div>
                        {examinerInsights.overall && <p className="text-sm text-slate-700 leading-relaxed">{examinerInsights.overall}</p>}
                        <div className="grid sm:grid-cols-2 gap-4">
                            {examinerInsights.common_mistakes?.length > 0 && (
                                <div>
                                    <p className="text-xs font-bold text-red-600 mb-2 uppercase tracking-wide">⚠ Common Mistakes</p>
                                    <ul className="space-y-1.5">
                                        {examinerInsights.common_mistakes.map((m, i) => (
                                            <li key={i} className="text-xs text-slate-700 flex gap-2"><span className="text-red-400 flex-shrink-0">•</span>{m}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {examinerInsights.high_score_tips?.length > 0 && (
                                <div>
                                    <p className="text-xs font-bold text-emerald-600 mb-2 uppercase tracking-wide">✓ What Top Students Did</p>
                                    <ul className="space-y-1.5">
                                        {examinerInsights.high_score_tips.map((t, i) => (
                                            <li key={i} className="text-xs text-slate-700 flex gap-2"><span className="text-emerald-400 flex-shrink-0">•</span>{t}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Side-by-side: exam PDF + question breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

                    {/* Left: Exam PDF */}
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wider flex items-center gap-2">
                                <FileText className="w-4 h-4 text-slate-400" /> Original Exam
                            </h3>
                            {examPdfUrl && (
                                <a href={examPdfUrl} target="_blank" rel="noopener noreferrer">
                                    <Button size="sm" variant="outline" className="gap-1 text-xs h-7">
                                        <ExternalLink className="w-3 h-3" /> Open
                                    </Button>
                                </a>
                            )}
                        </div>
                        {examPdfDataUrl ? (
                            <iframe src={examPdfDataUrl} className="w-full" style={{ height: 600, border: "none" }} title="Original Exam" />
                        ) : examPdfUrl ? (
                            <div className="p-8 text-center">
                                <a href={examPdfUrl} target="_blank" rel="noopener noreferrer">
                                    <Button className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                                        <ExternalLink className="w-4 h-4" /> View Exam PDF
                                    </Button>
                                </a>
                            </div>
                        ) : <div className="p-8 text-center text-slate-400 text-sm">Exam PDF not available</div>}
                    </div>

                    {/* Right: Question-by-question breakdown */}
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100">
                            <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wider flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-slate-400" /> Question Breakdown
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">Each question marked against official VCAA criteria</p>
                        </div>
                        <div className="divide-y divide-slate-50 overflow-y-auto" style={{ maxHeight: 600 }}>
                            {questions.map(q => {
                                const mr = markingResults[q.id];
                                const ans = answers[q.id] || {};
                                const awarded = mr?.marks_awarded ?? 0;
                                const total = mr?.total_marks ?? q.marks;
                                const full = awarded >= total;
                                const partial = awarded > 0 && !full;

                                return (
                                    <div key={q.id} className="p-4 space-y-2">
                                        {/* Question header */}
                                        <div className="flex items-center gap-2">
                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0 ${full ? "bg-emerald-100 text-emerald-600" : partial ? "bg-amber-100 text-amber-600" : "bg-red-100 text-red-600"}`}>
                                                {full ? <CheckCircle2 className="w-4 h-4" /> : awarded}
                                            </div>
                                            <span className="font-bold text-slate-800 text-sm">{q.label}</span>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ml-auto ${full ? "bg-emerald-100 text-emerald-700" : partial ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                                                {awarded}/{total} marks
                                            </span>
                                        </div>

                                        {/* Student answer */}
                                        {q.type === "mcq" ? (
                                            <div className="text-xs bg-slate-50 rounded-lg px-3 py-2">
                                                <span className="text-slate-500">Your answer: </span>
                                                <strong className="text-slate-800">{ans.selectedOption || "—"}</strong>
                                                {mr?.correct_answer && (
                                                    <span className={`ml-2 font-semibold ${ans.selectedOption === mr.correct_answer ? "text-emerald-600" : "text-red-600"}`}>
                                                        · Correct: {mr.correct_answer}
                                                    </span>
                                                )}
                                            </div>
                                        ) : ans.text ? (
                                            <div className="bg-slate-50 rounded-lg p-2">
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Your Answer</p>
                                                <p className="text-xs text-slate-700 whitespace-pre-wrap line-clamp-4">{ans.text}</p>
                                            </div>
                                        ) : (
                                            <div className="bg-slate-50 rounded-lg px-3 py-2">
                                                <p className="text-xs text-slate-400 italic">No answer provided</p>
                                            </div>
                                        )}

                                        {/* Official criteria from report */}
                                        {mr?.official_criteria && (
                                            <div className="bg-blue-50 rounded-lg p-2 border border-blue-100">
                                                <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-1">Official Marking Criteria</p>
                                                <p className="text-xs text-slate-700">{mr.official_criteria}</p>
                                            </div>
                                        )}

                                        {/* AI feedback */}
                                        {mr?.feedback && (
                                            <div className={`rounded-lg p-2 ${full ? "bg-emerald-50" : partial ? "bg-amber-50" : "bg-red-50"}`}>
                                                <p className={`text-xs font-bold uppercase tracking-wide mb-1 ${full ? "text-emerald-600" : partial ? "text-amber-600" : "text-red-600"}`}>Feedback</p>
                                                <p className="text-xs text-slate-700">{mr.feedback}</p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Examiner's report PDF */}
                {(reportPdfDataUrl || reportUrl) && (
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wider flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-slate-400" /> Official VCAA Examiner's Report
                            </h3>
                            {reportUrl && (
                                <a href={reportUrl} target="_blank" rel="noopener noreferrer">
                                    <Button size="sm" variant="outline" className="gap-1 text-xs h-7">
                                        <ExternalLink className="w-3 h-3" /> Open
                                    </Button>
                                </a>
                            )}
                        </div>
                        {reportPdfDataUrl ? (
                            <iframe src={reportPdfDataUrl} className="w-full" style={{ height: 500, border: "none" }} title="Examiner's Report" />
                        ) : (
                            <div className="p-8 text-center">
                                <a href={reportUrl} target="_blank" rel="noopener noreferrer">
                                    <Button className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                                        <ExternalLink className="w-4 h-4" /> View Examiner's Report
                                    </Button>
                                </a>
                            </div>
                        )}
                    </div>
                )}

                <Button onClick={resetAll} variant="outline" className="w-full rounded-2xl border-2 h-12 gap-2 font-bold hover:bg-slate-50">
                    <RefreshCw className="w-4 h-4" /> Start New Exam
                </Button>
            </motion.div>
        );
    }

    return null;
}