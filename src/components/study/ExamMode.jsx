import React, { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap, Clock, AlertCircle, BarChart3, Check, X,
  ChevronLeft, ChevronRight, Play, Trophy, Loader2, RefreshCw,
  Target, Flag, Brain, Zap, BookOpen, Layers, ArrowRight,
  CheckCircle2, Circle, TrendingUp, Award, Star } from
"lucide-react";

const SOURCES = [
{ id: "flashcards", label: "Flashcards", emoji: "🃏", color: "blue" },
{ id: "quizzes", label: "Quizzes", emoji: "📝", color: "purple" },
{ id: "active_recall", label: "Active Recall", emoji: "🧠", color: "emerald" }];


const TIME_OPTIONS = [
{ value: 0, label: "∞ Free", sub: "No limit" },
{ value: 15, label: "15m", sub: "Quick" },
{ value: 30, label: "30m", sub: "Standard" },
{ value: 45, label: "45m", sub: "Extended" },
{ value: 60, label: "1hr", sub: "Deep dive" },
{ value: 90, label: "1.5hr", sub: "Full exam" }];


const COUNT_OPTIONS = [10, 20, 30, 50];

function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function getSourceKey(source) {
  if (source === "Flashcards") return "flashcards";
  if (source === "Quizzes") return "quizzes";
  return "active_recall";
}

export default function ExamMode({ userSubjects }) {
  const [user, setUser] = useState(null);
  const [phase, setPhase] = useState("setup");
  const [allQuestions, setAllQuestions] = useState([]);
  const [examQuestions, setExamQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [examStartTime, setExamStartTime] = useState(null);
  const [submittedAt, setSubmittedAt] = useState(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [showQuestionMap, setShowQuestionMap] = useState(false);
  const hasSubmitted = useRef(false);

  const [config, setConfig] = useState({
    subject: "all",
    questionCount: 20,
    timeLimit: 30,
    sources: ["flashcards", "quizzes"]
  });

  useEffect(() => {
    base44.auth.me().then((u) => setUser(u)).catch(() => {});
  }, []);

  useEffect(() => {
    if (user) loadAllQuestions();
  }, [user]);

  const loadAllQuestions = async () => {
    setIsLoadingData(true);
    try {
      const [flashcards, quizzes, arSessions] = await Promise.all([
      base44.entities.Flashcard.filter({ created_by: user.email, is_active: true }),
      base44.entities.Quiz.filter({ created_by: user.email }), // FIX: only user's own quizzes
      base44.entities.ActiveRecallSession.filter({ created_by: user.email }, "-created_date", 30)]
      );

      const questions = [];

      (flashcards || []).forEach((fc) => {
        if (!fc.question || !fc.answer) return;
        questions.push({ id: `fc_${fc.id}`, type: "open", question: fc.question, modelAnswer: fc.answer, subject: fc.subject_name || "General", topic: fc.topic || "General", source: "Flashcards" });
      });

      (quizzes || []).forEach((quiz) => {
        (quiz.questions || []).forEach((q, i) => {
          if (!q.question) return;
          if (q.type === "mcq" && q.options?.length > 0) {
            questions.push({ id: `qz_${quiz.id}_${i}`, type: "mcq", question: q.question, options: q.options, correctIndex: q.correct_answer, modelAnswer: q.explanation || q.options?.[q.correct_answer] || "", subject: quiz.subject || "General", topic: quiz.title || "General", source: "Quizzes" });
          } else {
            questions.push({ id: `qz_${quiz.id}_${i}`, type: "open", question: q.question, modelAnswer: q.model_answer || "", subject: quiz.subject || "General", topic: quiz.title || "General", source: "Quizzes" });
          }
        });
      });

      (arSessions || []).forEach((session) => {
        (session.questions || []).forEach((q, i) => {
          if (!q) return;
          questions.push({ id: `ar_${session.id}_${i}`, type: "open", question: q, modelAnswer: session.answers?.[i] || "", subject: session.subject_name || "General", topic: session.topic || "General", source: "Active Recall" });
        });
      });

      setAllQuestions(questions);
    } catch (err) {
      console.error("Error loading exam questions:", err);
    } finally {
      setIsLoadingData(false);
    }
  };

  const getAvailablePool = (cfg = config) =>
  allQuestions.filter((q) =>
  (cfg.subject === "all" || q.subject === cfg.subject) &&
  cfg.sources.includes(getSourceKey(q.source))
  );

  const handleStartExam = () => {
    let pool = [...getAvailablePool()].sort(() => Math.random() - 0.5);
    if (config.questionCount !== "all") pool = pool.slice(0, config.questionCount);
    if (!pool.length) return;
    hasSubmitted.current = false;
    setExamQuestions(pool);
    setCurrentIndex(0);
    setAnswers({});
    setExamStartTime(Date.now());
    setSubmittedAt(null);
    setTimeLeft(config.timeLimit > 0 ? config.timeLimit * 60 : 0);
    setPhase("exam");
  };

  useEffect(() => {
    if (phase !== "exam" || config.timeLimit === 0) return;
    const interval = setInterval(() => setTimeLeft((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(interval);
  }, [phase, config.timeLimit]);

  useEffect(() => {
    if (phase === "exam" && config.timeLimit > 0 && timeLeft === 0 && examStartTime) {
      handleSubmitExam();
    }
  }, [timeLeft]);

  const handleSubmitExam = () => {
    if (hasSubmitted.current) return;
    hasSubmitted.current = true;
    setSubmittedAt(Date.now());
    setPhase("results");
  };

  const handleSelectMCQ = (qId, idx) => {
    setAnswers((prev) => ({ ...prev, [qId]: { ...prev[qId], selectedIndex: idx } }));
    // Auto-advance after short delay for MCQ
    setTimeout(() => {
      setCurrentIndex((i) => Math.min(i + 1, examQuestions.length - 1));
    }, 400);
  };

  const handleTypeAnswer = (qId, text) =>
  setAnswers((prev) => ({ ...prev, [qId]: { ...prev[qId], typed: text } }));

  const handleSelfMark = (qId, correct) =>
  setAnswers((prev) => ({ ...prev, [qId]: { ...prev[qId], selfMark: correct } }));

  const computeScore = () => {
    let correct = 0,total = 0,pending = 0;
    const bySubject = {};
    examQuestions.forEach((q) => {
      const a = answers[q.id] || {};
      const isCorrect = q.type === "mcq" ? a.selectedIndex === q.correctIndex : a.selfMark === true;
      const isPending = q.type === "open" && a.selfMark === undefined;
      total++;
      if (isCorrect) correct++;
      if (isPending) pending++;
      if (!bySubject[q.subject]) bySubject[q.subject] = { correct: 0, total: 0, topics: {} };
      bySubject[q.subject].total++;
      if (isCorrect) bySubject[q.subject].correct++;
      if (!bySubject[q.subject].topics[q.topic]) bySubject[q.subject].topics[q.topic] = { correct: 0, total: 0 };
      bySubject[q.subject].topics[q.topic].total++;
      if (isCorrect) bySubject[q.subject].topics[q.topic].correct++;
    });
    return { correct, total, pending, score: total - pending > 0 ? Math.round(correct / (total - pending) * 100) : 0, bySubject };
  };

  // ─── SETUP ────────────────────────────────────────────────────────────────
  if (phase === "setup") {
    const available = getAvailablePool().length;
    const willUse = config.questionCount === "all" ? available : Math.min(config.questionCount, available);

    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-5 px-1">
                {/* Hero */}
                <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 rounded-3xl p-8 text-white text-center">
                    <div className="absolute inset-0 opacity-20">
                        <div className="absolute top-4 right-8 w-24 h-24 bg-indigo-400 rounded-full blur-2xl" />
                        <div className="absolute bottom-4 left-8 w-32 h-32 bg-purple-400 rounded-full blur-3xl" />
                    </div>
                    <div className="relative">
                        <div className="w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4 ring-1 ring-white/20">
                            <GraduationCap className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-3xl font-black mb-2">Revision Mode</h2>
                        <p className="text-white/60 text-sm max-w-sm mx-auto">Simulate real conditions with timed questions from your personal study materials.</p>
                        {!isLoadingData &&
            <div className="flex justify-center gap-6 mt-5 pt-5 border-t border-white/10">
                                {[
              { label: "Flashcards", val: allQuestions.filter((q) => q.source === "Flashcards").length, icon: "🃏" },
              { label: "Quiz Q's", val: allQuestions.filter((q) => q.source === "Quizzes").length, icon: "📝" },
              { label: "Recall", val: allQuestions.filter((q) => q.source === "Active Recall").length, icon: "🧠" }].
              map((s) =>
              <div key={s.label} className="text-center">
                                        <p className="text-xl font-bold">{s.val}</p>
                                        <p className="text-xs text-white/40">{s.icon} {s.label}</p>
                                    </div>
              )}
                            </div>
            }
                    </div>
                </div>

                {isLoadingData ?
        <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
                        <span className="text-slate-500 text-sm">Loading your study materials...</span>
                    </div> :

        <div className="space-y-4">
                        {/* Subject */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-slate-400" /> Subject
                            </label>
                            <Select value={config.subject} onValueChange={(v) => setConfig((c) => ({ ...c, subject: v }))}>
                                <SelectTrigger className="border-2 border-slate-100 rounded-xl h-11 bg-slate-50 focus:border-indigo-300">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">✨ All Subjects</SelectItem>
                                    {userSubjects.map((s) => <SelectItem key={s.id} value={s.subject_name}>{s.subject_name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Sources */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                <Layers className="w-4 h-4 text-slate-400" /> Question Sources
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                                {SOURCES.map((s) => {
                const cnt = allQuestions.filter((q) => getSourceKey(q.source) === s.id && (config.subject === "all" || q.subject === config.subject)).length;
                const sel = config.sources.includes(s.id);
                const colorMap = { blue: "bg-blue-600 border-blue-600", purple: "bg-purple-600 border-purple-600", emerald: "bg-emerald-600 border-emerald-600" };
                return (
                  <button key={s.id}
                  onClick={() => {
                    if (sel && config.sources.length === 1) return;
                    setConfig((c) => ({ ...c, sources: sel ? c.sources.filter((x) => x !== s.id) : [...c.sources, s.id] }));
                  }}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-200 ${sel ? `${colorMap[s.color]} text-white shadow-md` : "border-slate-200 text-slate-600 hover:border-slate-300 bg-slate-50"}`}>
                                            {sel && <Check className="absolute top-2 right-2 w-3.5 h-3.5" />}
                                            <span className="text-2xl">{s.emoji}</span>
                                            <span className="text-xs font-bold">{s.label}</span>
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sel ? "bg-white/20" : "bg-slate-200 text-slate-500"}`}>{cnt}</span>
                                        </button>);

              })}
                            </div>
                        </div>

                        {/* Count + Time in a grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                    <Target className="w-4 h-4 text-slate-400" /> Questions
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {COUNT_OPTIONS.map((n) =>
                <button key={n} onClick={() => setConfig((c) => ({ ...c, questionCount: n }))}
                className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${config.questionCount === n ? "bg-slate-900 border-slate-900 text-white" : "border-slate-200 text-slate-500 hover:border-slate-400"}`}>
                                            {n}
                                        </button>
                )}
                                    <button onClick={() => setConfig((c) => ({ ...c, questionCount: "all" }))}
                className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${config.questionCount === "all" ? "bg-slate-900 border-slate-900 text-white" : "border-slate-200 text-slate-500 hover:border-slate-400"}`}>
                                        All
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-slate-400" /> Time Limit
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {TIME_OPTIONS.map((t) =>
                <button key={t.value} onClick={() => setConfig((c) => ({ ...c, timeLimit: t.value }))}
                className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all text-center ${config.timeLimit === t.value ? "bg-slate-900 border-slate-900 text-white" : "border-slate-200 text-slate-500 hover:border-slate-400"}`}>
                                            {t.label}
                                        </button>
                )}
                                </div>
                            </div>
                        </div>

                        {/* Start Button */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    {available === 0 ?
                <p className="text-sm text-red-500 font-medium">No questions match your selection. Add flashcards or quizzes first.</p> :

                <>
                                            <p className="text-sm text-slate-600"><span className="font-black text-slate-900 text-lg">{willUse}</span> <span className="text-slate-400">of {available} questions</span></p>
                                            <p className="text-xs text-slate-400 mt-0.5">{config.timeLimit > 0 ? `${config.timeLimit} minute limit` : "No time limit"}</p>
                                        </>
                }
                                </div>
                                <Button onClick={handleStartExam} disabled={available === 0}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-2xl px-8 h-12 gap-2 font-bold shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02]">
                                    <Play className="w-4 h-4" /> Begin Exam
                                </Button>
                            </div>
                        </div>
                    </div>
        }
            </motion.div>);

  }

  // ─── EXAM ─────────────────────────────────────────────────────────────────
  if (phase === "exam") {
    const q = examQuestions[currentIndex];
    const answered = Object.keys(answers).filter((id) => {
      const a = answers[id];
      const qq = examQuestions.find((x) => x.id === id);
      return qq?.type === "mcq" ? a.selectedIndex !== undefined : a.typed?.length > 0;
    }).length;
    const progress = answered / examQuestions.length * 100;
    const isLow = config.timeLimit > 0 && timeLeft <= 300;
    const isVeryLow = config.timeLimit > 0 && timeLeft <= 60;
    const currentAnswer = answers[q?.id] || {};
    const isCurrentAnswered = q?.type === "mcq" ? currentAnswer.selectedIndex !== undefined : currentAnswer.typed?.length > 0;

    return (
      <div className="max-w-2xl mx-auto space-y-3">
                {/* Header Bar */}
                <motion.div
          animate={{ backgroundColor: isVeryLow ? "#7f1d1d" : isLow ? "#991b1b" : "#0f172a" }}
          className="rounded-2xl p-4 flex items-center justify-between gap-4 transition-colors duration-1000">

                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                            <GraduationCap className="w-4 h-4 text-white/70" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-white font-bold text-sm truncate">Exam Mode</p>
                            <p className="text-white/40 text-xs">{answered}/{examQuestions.length} answered</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {config.timeLimit > 0 &&
            <div className={`font-mono font-black text-2xl flex items-center gap-1.5 tabular-nums ${isVeryLow ? "text-red-300 animate-pulse" : isLow ? "text-orange-300" : "text-white"}`}>
                                <Clock className="w-4 h-4" />
                                {formatTime(timeLeft)}
                            </div>
            }
                        <button onClick={() => setShowQuestionMap((v) => !v)}
            className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-colors">
                            <Layers className="w-4 h-4 text-white/70" />
                        </button>
                        <Button size="sm" onClick={handleSubmitExam}
            className={`rounded-xl font-bold gap-1.5 text-xs px-4 ${isLow ? "bg-red-500 hover:bg-red-600 text-white" : "bg-white/15 hover:bg-white/25 text-white border border-white/20"}`}>
                            <Flag className="w-3.5 h-3.5" /> Submit
                        </Button>
                    </div>
                </motion.div>

                {/* Progress bar */}
                <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" animate={{ width: `${progress}%` }} transition={{ duration: 0.4, ease: "easeOut" }} />
                </div>

                {/* Question Map Drawer */}
                <AnimatePresence>
                    {showQuestionMap &&
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
          className="bg-white rounded-2xl border border-slate-100 p-4 overflow-hidden">
                            <p className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">Question Map</p>
                            <div className="flex flex-wrap gap-1.5">
                                {examQuestions.map((eq, i) => {
                const a = answers[eq.id] || {};
                const done = eq.type === "mcq" ? a.selectedIndex !== undefined : a.typed?.length > 0;
                return (
                  <button key={i} onClick={() => {setCurrentIndex(i);setShowQuestionMap(false);}}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${i === currentIndex ? "bg-indigo-600 text-white ring-2 ring-indigo-300" : done ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400 hover:bg-slate-200"}`}>
                                            {i + 1}
                                        </button>);

              })}
                            </div>
                        </motion.div>
          }
                </AnimatePresence>

                {/* Question Card */}
                <AnimatePresence mode="wait">
                    <motion.div key={currentIndex}
          initial={{ opacity: 0, x: 30, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -30, scale: 0.98 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">

                        {/* Question header */}
                        <div className="px-6 pt-5 pb-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${q?.source === "Flashcards" ? "bg-blue-50 text-blue-600" : q?.source === "Quizzes" ? "bg-purple-50 text-purple-600" : "bg-emerald-50 text-emerald-600"}`}>
                                        {q?.source}
                                    </span>
                                    <span className="text-xs text-slate-400 font-medium">{q?.subject}</span>
                                    {q?.topic && q.topic !== q.subject && <span className="text-xs text-slate-300">• {q.topic}</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                    {isCurrentAnswered &&
                  <span className="flex items-center gap-1 text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
                                            <Check className="w-3 h-3" /> Done
                                        </span>
                  }
                                    <span className="text-xs font-bold text-slate-300">{currentIndex + 1} / {examQuestions.length}</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 space-y-5">
                            <p className="text-lg font-semibold text-slate-900 leading-relaxed">{q?.question}</p>

                            {q?.type === "mcq" &&
              <div className="space-y-2.5">
                                    {q.options.map((opt, i) => {
                  const sel = currentAnswer.selectedIndex === i;
                  return (
                    <motion.button key={i} onClick={() => handleSelectMCQ(q.id, i)}
                    whileHover={{ scale: 1.005 }}
                    whileTap={{ scale: 0.998 }}
                    className={`w-full text-left px-5 py-4 rounded-2xl border-2 text-sm font-medium transition-all duration-150 flex items-center gap-3 group ${sel ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "border-slate-200 text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/50 bg-white"}`}>
                                                <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0 transition-all ${sel ? "bg-white/20 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600"}`}>
                                                    {String.fromCharCode(65 + i)}
                                                </span>
                                                <span className="flex-1">{opt}</span>
                                                {sel && <Check className="w-4 h-4 flex-shrink-0" />}
                                            </motion.button>);

                })}
                                </div>
              }

                            {q?.type === "open" &&
              <div className="space-y-2">
                                    <Textarea
                  value={currentAnswer.typed || ""}
                  onChange={(e) => handleTypeAnswer(q.id, e.target.value)}
                  placeholder="Type your answer here..."
                  rows={5}
                  className="border-2 border-slate-200 focus:border-indigo-400 rounded-2xl resize-none text-sm bg-slate-50 focus:bg-white transition-colors placeholder:text-slate-300" />

                                    {currentAnswer.typed?.length > 0 &&
                <p className="text-xs text-slate-400 text-right">{currentAnswer.typed.length} chars</p>
                }
                                </div>
              }
                        </div>
                    </motion.div>
                </AnimatePresence>

                {/* Navigation */}
                <div className="flex items-center justify-between gap-3">
                    <Button variant="outline" onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))} disabled={currentIndex === 0}
          className="gap-2 rounded-xl border-2 border-slate-200 font-semibold hover:bg-slate-50">
                        <ChevronLeft className="w-4 h-4" /> Prev
                    </Button>

                    <Button onClick={() => {
            if (currentIndex < examQuestions.length - 1) {
              setCurrentIndex((i) => i + 1);
            } else {
              handleSubmitExam();
            }
          }}
          className={`gap-2 rounded-xl font-bold px-6 ${currentIndex === examQuestions.length - 1 ? "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg" : "bg-slate-900 hover:bg-slate-800 text-white"}`}>
                        {currentIndex === examQuestions.length - 1 ?
            <><Flag className="w-4 h-4" /> Finish</> :

            <>Next <ChevronRight className="w-4 h-4" /></>
            }
                    </Button>
                </div>
            </div>);

  }

  // ─── RESULTS ──────────────────────────────────────────────────────────────
  if (phase === "results") {
    const results = computeScore();
    const timeTakenSec = examStartTime && submittedAt ? Math.round((submittedAt - examStartTime) / 1000) : 0;

    const weakTopics = [];
    Object.entries(results.bySubject).forEach(([subject, data]) => {
      Object.entries(data.topics).forEach(([topic, td]) => {
        if (td.total >= 2) {
          const pct = Math.round(td.correct / td.total * 100);
          if (pct < 60) weakTopics.push({ subject, topic, pct, total: td.total });
        }
      });
    });
    weakTopics.sort((a, b) => a.pct - b.pct);

    const grade = results.score >= 85 ? { label: "Outstanding", emoji: "🏆", color: "from-amber-500 to-yellow-400" } :
    results.score >= 70 ? { label: "Great Work", emoji: "⭐", color: "from-emerald-500 to-teal-400" } :
    results.score >= 55 ? { label: "Good Effort", emoji: "📈", color: "from-blue-500 to-indigo-400" } :
    { label: "Keep Revising", emoji: "📚", color: "from-slate-600 to-slate-500" };

    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-4">

                {/* Score Hero */}
                <div className={`bg-gradient-to-br ${grade.color} rounded-3xl p-8 text-white text-center relative overflow-hidden`}>
                    <div className="absolute inset-0 opacity-20">
                        <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
                    </div>
                    <div className="relative">
                        <p className="text-5xl mb-3">{grade.emoji}</p>
                        <p className="text-6xl font-black mb-1">{results.pending > 0 ? `~${results.score}%` : `${results.score}%`}</p>
                        <p className="text-white/80 font-semibold text-lg">{grade.label}</p>
                        {results.pending > 0 &&
            <p className="text-white/60 text-xs mt-2 bg-white/10 rounded-full px-3 py-1 inline-block">
                                {results.pending} open question{results.pending > 1 ? "s" : ""} need self-marking below
                            </p>
            }
                        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/20">
                            <div>
                                <p className="text-3xl font-black">{results.correct}</p>
                                <p className="text-xs text-white/60 mt-0.5">Correct</p>
                            </div>
                            <div>
                                <p className="text-3xl font-black">{results.total}</p>
                                <p className="text-xs text-white/60 mt-0.5">Total</p>
                            </div>
                            <div>
                                <p className="text-3xl font-black font-mono">{formatTime(timeTakenSec)}</p>
                                <p className="text-xs text-white/60 mt-0.5">Time</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Subject Breakdown */}
                {Object.keys(results.bySubject).length > 0 &&
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-sm uppercase tracking-wider text-slate-400">
                            <BarChart3 className="w-4 h-4" /> By Subject
                        </h3>
                        <div className="space-y-4">
                            {Object.entries(results.bySubject).map(([subject, data]) => {
              const pct = data.total > 0 ? Math.round(data.correct / data.total * 100) : 0;
              const barColor = pct >= 70 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-red-400";
              return (
                <div key={subject}>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-sm font-bold text-slate-800">{subject}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-400">{data.correct}/{data.total}</span>
                                                <span className={`text-sm font-black ${pct >= 70 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-600"}`}>{pct}%</span>
                                            </div>
                                        </div>
                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: "easeOut" }}
                    className={`h-full rounded-full ${barColor}`} />
                                        </div>
                                    </div>);

            })}
                        </div>
                    </div>
        }

                {/* Weak Areas */}
                {weakTopics.length > 0 &&
        <div className="bg-amber-50 rounded-3xl border border-amber-200 p-6">
                        <h3 className="font-bold text-amber-800 flex items-center gap-2 text-sm mb-1">
                            <AlertCircle className="w-4 h-4" /> Areas to Prioritise
                        </h3>
                        <p className="text-xs text-amber-600 mb-4">Scored below 60% — focus revision here.</p>
                        <div className="space-y-2">
                            {weakTopics.slice(0, 5).map((t, i) =>
            <div key={i} className="flex items-center justify-between bg-white rounded-2xl p-3.5 border border-amber-100 shadow-sm">
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">{t.topic}</p>
                                        <p className="text-xs text-slate-400">{t.subject} · {t.total} questions</p>
                                    </div>
                                    <span className="text-sm font-black text-red-600 bg-red-50 px-3 py-1 rounded-full border border-red-100">{t.pct}%</span>
                                </div>
            )}
                        </div>
                    </div>
        }

                {/* Question Review */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wider flex items-center gap-2">
                            <Target className="w-4 h-4 text-slate-400" /> Review Answers
                        </h3>
                        {results.pending > 0 &&
            <span className="text-xs bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-bold">{results.pending} to mark</span>
            }
                    </div>
                    <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto">
                        {examQuestions.map((eq, i) => {
              const a = answers[eq.id] || {};
              const isMCQ = eq.type === "mcq";
              const isCorrect = isMCQ ? a.selectedIndex === eq.correctIndex : a.selfMark === true;
              const isWrong = isMCQ ? a.selectedIndex !== undefined && a.selectedIndex !== eq.correctIndex : a.selfMark === false;
              const isPending = !isMCQ && a.selfMark === undefined;

              return (
                <div key={eq.id} className={`p-5 transition-colors ${isPending ? "bg-amber-50/50" : ""}`}>
                                    <div className="flex gap-3">
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-black ${isCorrect ? "bg-emerald-100 text-emerald-600" : isWrong ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-400"}`}>
                                            {isCorrect ? <Check className="w-4 h-4" /> : isWrong ? <X className="w-4 h-4" /> : i + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-slate-900 text-sm mb-3 leading-relaxed">{eq.question}</p>

                                            {isMCQ &&
                      <div className="space-y-1.5">
                                                    {eq.options.map((opt, oi) =>
                        <div key={oi} className={`text-xs px-3 py-2 rounded-xl font-medium ${oi === eq.correctIndex ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : oi === a.selectedIndex && oi !== eq.correctIndex ? "bg-red-50 text-red-700 border border-red-200" : "text-slate-400"}`}>
                                                            <span className="font-bold mr-2">{oi === eq.correctIndex ? "✓" : oi === a.selectedIndex ? "✗" : String.fromCharCode(65 + oi) + "."}</span>{opt}
                                                        </div>
                        )}
                                                    {eq.modelAnswer && <p className="text-xs text-slate-400 mt-2 pl-2 border-l-2 border-slate-100 italic">{eq.modelAnswer}</p>}
                                                </div>
                      }

                                            {!isMCQ &&
                      <div className="space-y-2">
                                                    {a.typed ?
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                                            <p className="text-xs text-slate-400 mb-1 font-semibold uppercase tracking-wide">Your Answer</p>
                                                            <p className="text-sm text-slate-700">{a.typed}</p>
                                                        </div> :

                        <p className="text-xs text-slate-300 italic">No answer written</p>
                        }
                                                    {eq.modelAnswer &&
                        <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                                                            <p className="text-xs text-emerald-600 mb-1 font-semibold uppercase tracking-wide">Model Answer</p>
                                                            <p className="text-sm text-slate-700">{eq.modelAnswer}</p>
                                                        </div>
                        }
                                                    <div className="flex gap-2">
                                                        <button onClick={() => handleSelfMark(eq.id, true)}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all ${a.selfMark === true ? "bg-emerald-500 text-white border-emerald-500" : "border-slate-200 text-slate-500 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"}`}>
                                                            <Check className="w-3.5 h-3.5" /> Correct
                                                        </button>
                                                        <button onClick={() => handleSelfMark(eq.id, false)}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all ${a.selfMark === false ? "bg-red-500 text-white border-red-500" : "border-slate-200 text-slate-500 hover:border-red-300 hover:bg-red-50 hover:text-red-700"}`}>
                                                            <X className="w-3.5 h-3.5" /> Incorrect
                                                        </button>
                                                    </div>
                                                </div>
                      }
                                        </div>
                                    </div>
                                </div>);

            })}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pb-4">
                    <Button onClick={() => {setPhase("setup");setExamQuestions([]);setAnswers({});}} variant="outline"
          className="flex-1 rounded-2xl border-2 border-slate-200 h-12 gap-2 font-bold hover:bg-slate-50">
                        <RefreshCw className="w-4 h-4" /> New Exam
                    </Button>
                    <Button onClick={handleStartExam}
          className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-2xl h-12 gap-2 font-bold shadow-lg shadow-indigo-500/25">
                        <Play className="w-4 h-4" /> Retry Same Setup
                    </Button>
                </div>
            </motion.div>);

  }

  return null;
}