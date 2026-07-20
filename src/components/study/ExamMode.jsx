import React, { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { FEATURES, checkLiveTier } from "@/lib/tierAccess";
import { getExaminerPrompt, getLatexRules } from "@/lib/subjectExaminerPrompts";
import { recordStudyAndGetStreak } from "@/components/shared/streakHelpers";
import { fireXPFeedback } from "@/components/ranked/XPFeedback";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap, Clock, AlertCircle, BarChart3, Check, X,
  ChevronLeft, ChevronRight, Play, Trophy, Loader2, RefreshCw,
  Target, Flag, Brain, Zap, BookOpen, Layers, ArrowRight,
  CheckCircle2, Circle, TrendingUp, Award, Star, FileText,
  Sparkles } from
"lucide-react";

// Static class lookup for SOURCES (Tailwind JIT-safe)
const SOURCE_CLASSES = {
  flashcards: {
    selected: "bg-chart-3 border-chart-3 text-white shadow-soft",
    chipBg: "bg-chart-3/10",
    chipText: "text-chart-3"
  },
  quizzes: {
    selected: "bg-chart-4 border-chart-4 text-white shadow-soft",
    chipBg: "bg-chart-4/10",
    chipText: "text-chart-4"
  },
  active_recall: {
    selected: "bg-primary border-primary text-white shadow-soft",
    chipBg: "bg-primary/10",
    chipText: "text-primary"
  }
};

const SOURCES = [
{ id: "flashcards", label: "Flashcards", icon: BookOpen, color: "chart-3" },
{ id: "quizzes", label: "Quizzes", icon: FileText, color: "chart-4" },
{ id: "active_recall", label: "Active Recall", icon: Brain, color: "primary" }];


const TIME_OPTIONS = [
{ value: 0, label: "∞ Free", sub: "No limit" },
{ value: 15, label: "15m", sub: "Quick" },
{ value: 30, label: "30m", sub: "Standard" },
{ value: 45, label: "45m", sub: "Extended" },
{ value: 60, label: "1hr", sub: "Deep dive" },
{ value: 90, label: "1.5hr", sub: "Full exam" }];


const COUNT_OPTIONS = [10, 20, 30, 50];

// Static class strings for AI marking verdicts (Tailwind JIT-safe).
const AI_VERDICT_CLASSES = {
  correct:   { box: "bg-primary/5 border-primary/20",  text: "text-primary",  label: "Full marks" },
  partial:   { box: "bg-xp/5 border-xp/20",            text: "text-xp",       label: "Partial credit" },
  incorrect: { box: "bg-streak/5 border-streak/20",    text: "text-streak",   label: "Marks lost" },
};

// Static lookup for source pill colours in question header / hero stats
const SOURCE_PILL = {
  Flashcards: "bg-chart-3/10 text-chart-3",
  Quizzes: "bg-chart-4/10 text-chart-4",
  "Active Recall": "bg-primary/10 text-primary"
};

const SOURCE_ICON = {
  Flashcards: BookOpen,
  Quizzes: FileText,
  "Active Recall": Brain
};

// Static lookup for grade tiers (no dynamic gradient strings)
const GRADE_CLASSES = {
  outstanding: { tile: "bg-xp/10", text: "text-xp", icon: Trophy },
  great: { tile: "bg-primary/10", text: "text-primary", icon: Award },
  good: { tile: "bg-chart-3/10", text: "text-chart-3", icon: Star },
  keep: { tile: "bg-secondary", text: "text-muted-foreground", icon: BookOpen }
};

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

  const [isAIMarking, setIsAIMarking] = useState(false);
  const { toast } = useToast();
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
    // A finished mock counts as real study: record streak + mini_test XP
    // (self-marks arriving later don't change the award — idempotent key).
    recordStudyAndGetStreak().catch(() => {});
    const { score, total, pending } = computeScore();
    if (user?.email && total - pending > 0) {
      base44.functions.
      invoke("awardXP", {
        source: "mini_test",
        event_key: `mini_test_${user.email}_${examStartTime || Date.now()}`,
        score
      }).
      then((res) => fireXPFeedback(res?.data ?? res, "mini_test")).
      catch(() => {});
    }
  };

  // AI-mark every open question that has a typed answer. Verdicts auto-fill
  // the self-mark (full marks -> correct, otherwise incorrect) but the manual
  // buttons stay as an override.
  const handleAIMark = async () => {
    const openQs = examQuestions.filter(
      (q) => q.type === "open" && (answers[q.id]?.typed || "").trim().length > 0
    );
    if (!openQs.length) {
      toast({ title: "Nothing to mark", description: "No written answers found in this mock." });
      return;
    }
    const access = await checkLiveTier(FEATURES.QUIZ_AI_MARK);
    if (!access.allowed) {
      toast({
        title: access.upgradeRequired ? "Premium feature" : "Daily limit reached",
        description: `${access.reason} You can still self-mark below.`,
        variant: "destructive"
      });
      return;
    }
    setIsAIMarking(true);
    try {
      const subjects = [...new Set(openQs.map((q) => q.subject))];
      const header = subjects.length === 1 ? getExaminerPrompt(subjects[0]) : getLatexRules();
      const response = await base44.integrations.Core.InvokeLLM({
        feature: "quiz_ai_mark",
        prompt: `${header}

Mark these VCE mock-exam short answers against their model answers, using VCAA marking conventions. Be strict but fair: "correct" only if the response would earn full marks, "partial" if it would earn some marks, "incorrect" otherwise. Give one or two sentences of feedback each — name exactly what earns or loses the marks.

${openQs.map((q, i) => `Q${i + 1} [${q.subject}]:
Question: ${q.question}
Model Answer: ${q.modelAnswer || "Not provided — judge on accuracy and command-term depth"}
Student Answer: ${answers[q.id].typed}`).join("\n---\n")}

Return exactly ${openQs.length} results, in order.`,
        response_json_schema: {
          type: "object",
          properties: {
            results: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  verdict: { type: "string", enum: ["correct", "partial", "incorrect"] },
                  feedback: { type: "string" }
                },
                required: ["verdict", "feedback"]
              }
            }
          },
          required: ["results"]
        }
      });
      const marked = response?.results || [];
      if (!marked.length) throw new Error("The examiner returned no results — try again.");
      setAnswers((prev) => {
        const next = { ...prev };
        openQs.forEach((q, i) => {
          const r = marked[i];
          if (!r) return;
          next[q.id] = {
            ...next[q.id],
            selfMark: r.verdict === "correct",
            aiVerdict: r.verdict,
            aiFeedback: r.feedback
          };
        });
        return next;
      });
      toast({ title: "✅ Marked by the examiner", description: `${marked.length} answer${marked.length === 1 ? "" : "s"} assessed to VCAA standards.` });
    } catch (e) {
      toast({ title: "AI marking unavailable", description: e.message || "You can still self-mark below.", variant: "destructive" });
    } finally {
      setIsAIMarking(false);
    }
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
                <div className="relative overflow-hidden bg-streak/10 rounded-3xl p-8 text-center">
                    <div className="relative">
                        <div className="w-16 h-16 bg-streak/15 rounded-2xl flex items-center justify-center mx-auto mb-4 ring-1 ring-streak/20">
                            <GraduationCap className="w-8 h-8 text-streak" />
                        </div>
                        <h2 className="text-3xl font-black mb-2 text-foreground">Revision Mode</h2>
                        <p className="text-muted-foreground text-sm max-w-sm mx-auto">Simulate real conditions with timed questions from your personal study materials.</p>
                        {!isLoadingData &&
            <div className="flex justify-center gap-6 mt-5 pt-5 border-t border-border">
                                {[
              { label: "Flashcards", val: allQuestions.filter((q) => q.source === "Flashcards").length, Icon: BookOpen, color: "text-chart-3" },
              { label: "Quiz Q's", val: allQuestions.filter((q) => q.source === "Quizzes").length, Icon: FileText, color: "text-chart-4" },
              { label: "Recall", val: allQuestions.filter((q) => q.source === "Active Recall").length, Icon: Brain, color: "text-primary" }].
              map((s) =>
              <div key={s.label} className="text-center">
                                        <p className="text-xl font-bold text-foreground">{s.val}</p>
                                        <p className="text-xs text-muted-foreground flex items-center gap-1 justify-center mt-0.5">
                                            <s.Icon className={`w-3 h-3 ${s.color}`} /> {s.label}
                                        </p>
                                    </div>
              )}
                            </div>
            }
                    </div>
                </div>

                {isLoadingData ?
        <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <Loader2 className="w-7 h-7 animate-spin text-streak" />
                        <span className="text-muted-foreground text-sm">Loading your study materials...</span>
                    </div> :

        <div className="space-y-4">
                        {/* Subject */}
                        <div className="card-soft p-5 space-y-3">
                            <label className="text-sm font-bold text-foreground flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-muted-foreground" /> Subject
                            </label>
                            <Select value={config.subject} onValueChange={(v) => setConfig((c) => ({ ...c, subject: v }))}>
                                <SelectTrigger className="border-2 border-border rounded-xl h-11 bg-secondary/50 focus:border-streak/40">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all"><span className="inline-flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-xp" /> All Subjects</span></SelectItem>
                                    {userSubjects.map((s) => <SelectItem key={s.id} value={s.subject_name}>{s.subject_name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Sources */}
                        <div className="card-soft p-5 space-y-3">
                            <label className="text-sm font-bold text-foreground flex items-center gap-2">
                                <Layers className="w-4 h-4 text-muted-foreground" /> Question Sources
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                                {SOURCES.map((s) => {
                const cnt = allQuestions.filter((q) => getSourceKey(q.source) === s.id && (config.subject === "all" || q.subject === config.subject)).length;
                const sel = config.sources.includes(s.id);
                const cls = SOURCE_CLASSES[s.id];
                const SourceIcon = s.icon;
                return (
                  <button key={s.id}
                  onClick={() => {
                    if (sel && config.sources.length === 1) return;
                    setConfig((c) => ({ ...c, sources: sel ? c.sources.filter((x) => x !== s.id) : [...c.sources, s.id] }));
                  }}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-200 ${sel ? cls.selected : "border-border text-muted-foreground hover:border-border bg-secondary/50"}`}>
                                            {sel && <Check className="absolute top-2 right-2 w-3.5 h-3.5" />}
                                            <SourceIcon className="w-6 h-6" />
                                            <span className="text-xs font-bold">{s.label}</span>
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sel ? "bg-surface/20" : "bg-secondary text-muted-foreground"}`}>{cnt}</span>
                                        </button>);

              })}
                            </div>
                        </div>

                        {/* Count + Time in a grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="card-soft p-5 space-y-3">
                                <label className="text-sm font-bold text-foreground flex items-center gap-2">
                                    <Target className="w-4 h-4 text-muted-foreground" /> Questions
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {COUNT_OPTIONS.map((n) =>
                <button key={n} onClick={() => setConfig((c) => ({ ...c, questionCount: n }))}
                className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${config.questionCount === n ? "bg-foreground border-foreground text-background" : "border-border text-muted-foreground hover:border-muted-foreground"}`}>
                                            {n}
                                        </button>
                )}
                                    <button onClick={() => setConfig((c) => ({ ...c, questionCount: "all" }))}
                className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${config.questionCount === "all" ? "bg-foreground border-foreground text-background" : "border-border text-muted-foreground hover:border-muted-foreground"}`}>
                                        All
                                    </button>
                                </div>
                            </div>

                            <div className="card-soft p-5 space-y-3">
                                <label className="text-sm font-bold text-foreground flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-muted-foreground" /> Time Limit
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {TIME_OPTIONS.map((t) =>
                <button key={t.value} onClick={() => setConfig((c) => ({ ...c, timeLimit: t.value }))}
                className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all text-center ${config.timeLimit === t.value ? "bg-foreground border-foreground text-background" : "border-border text-muted-foreground hover:border-muted-foreground"}`}>
                                            {t.label}
                                        </button>
                )}
                                </div>
                            </div>
                        </div>

                        {/* Start Button */}
                        <div className="card-soft p-5">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    {available === 0 ?
                <p className="text-sm text-streak font-medium">No questions match your selection. Add flashcards or quizzes first.</p> :

                <>
                                            <p className="text-sm text-muted-foreground"><span className="font-black text-foreground text-lg">{willUse}</span> <span className="text-muted-foreground/60">of {available} questions</span></p>
                                            <p className="text-xs text-muted-foreground/60 mt-0.5">{config.timeLimit > 0 ? `${config.timeLimit} minute limit` : "No time limit"}</p>
                                        </>
                }
                                </div>
                                <Button onClick={handleStartExam} disabled={available === 0}
              className="bg-streak hover:bg-streak/90 text-white rounded-2xl px-8 h-12 gap-2 font-bold btn-3d transition-all">
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
      <div className="max-w-3xl mx-auto space-y-4">
                {/* Header Bar */}
                <motion.div
          animate={{ backgroundColor: isVeryLow ? "hsl(0 100% 45%)" : isLow ? "hsl(0 100% 55%)" : "hsl(218 50% 11%)" }}
          className="rounded-2xl p-4 flex items-center justify-between gap-4 transition-colors duration-1000">

                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 bg-surface/10 rounded-xl flex items-center justify-center flex-shrink-0">
                            <GraduationCap className="w-4 h-4 text-white/70" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-white font-bold text-sm truncate">Exam Mode</p>
                            <p className="text-white/60 text-xs">{answered}/{examQuestions.length} answered</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {config.timeLimit > 0 &&
            <div className={`font-mono font-black text-2xl flex items-center gap-1.5 tabular-nums ${isVeryLow ? "text-white animate-pulse" : isLow ? "text-white" : "text-white"}`}>
                                <Clock className="w-4 h-4" />
                                {formatTime(timeLeft)}
                            </div>
            }
                        <button onClick={() => setShowQuestionMap((v) => !v)}
            className="w-9 h-9 bg-surface/10 hover:bg-surface/20 rounded-xl flex items-center justify-center transition-colors">
                            <Layers className="w-4 h-4 text-white/70" />
                        </button>
                        <Button size="sm" onClick={handleSubmitExam}
            className={`rounded-xl font-bold gap-1.5 text-xs px-4 ${isLow ? "bg-surface text-streak hover:bg-surface/90" : "bg-surface/15 hover:bg-surface/25 text-white border border-white/20"}`}>
                            <Flag className="w-3.5 h-3.5" /> Submit
                        </Button>
                    </div>
                </motion.div>

                {/* Progress bar */}
                <div className="h-1 bg-secondary rounded-full overflow-hidden">
                    <motion.div className="h-full bg-streak rounded-full" animate={{ width: `${progress}%` }} transition={{ duration: 0.4, ease: "easeOut" }} />
                </div>

                {/* Question Map Drawer */}
                <AnimatePresence>
                    {showQuestionMap &&
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
          className="card-soft p-4 overflow-hidden">
                            <p className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wider">Question Map</p>
                            <div className="flex flex-wrap gap-1.5">
                                {examQuestions.map((eq, i) => {
                const a = answers[eq.id] || {};
                const done = eq.type === "mcq" ? a.selectedIndex !== undefined : a.typed?.length > 0;
                return (
                  <button key={i} onClick={() => {setCurrentIndex(i);setShowQuestionMap(false);}}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${i === currentIndex ? "bg-streak text-white ring-2 ring-streak/30" : done ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground hover:bg-secondary"}`}>
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
          initial={{ opacity: 0, x: 40, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -40, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 420, damping: 32, mass: 0.6 }}
          className="card-soft overflow-hidden">

                        {/* Question header */}
                        <div className="px-6 pt-5 pb-4 bg-secondary/50 border-b border-border">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`pill ${SOURCE_PILL[q?.source] || "bg-secondary text-muted-foreground"}`}>
                                        {q?.source}
                                    </span>
                                    <span className="text-xs text-muted-foreground font-medium">{q?.subject}</span>
                                    {q?.topic && q.topic !== q.subject && <span className="text-xs text-muted-foreground/60">• {q.topic}</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                    {isCurrentAnswered &&
                  <span className="pill bg-primary/10 text-primary">
                                            <Check className="w-3 h-3" /> Done
                                        </span>
                  }
                                    <span className="text-xs font-bold text-muted-foreground/60">{currentIndex + 1} / {examQuestions.length}</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 sm:p-8 space-y-6">
                            <p className="text-xl sm:text-2xl font-semibold text-foreground leading-relaxed">{q?.question}</p>

                            {q?.type === "mcq" &&
              <div className="space-y-3">
                                    {q.options.map((opt, i) => {
                  const sel = currentAnswer.selectedIndex === i;
                  return (
                    <motion.button key={i} onClick={() => handleSelectMCQ(q.id, i)}
                    whileHover={{ scale: 1.005 }}
                    whileTap={{ scale: 0.998 }}
                    className={`w-full text-left px-5 py-4 rounded-2xl border-2 text-base font-medium transition-all duration-150 flex items-center gap-4 group ${sel ? "bg-streak border-streak text-white shadow-soft" : "border-border text-foreground hover:border-streak/40 hover:bg-streak/5 bg-surface"}`}>
                                                <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0 transition-all ${sel ? "bg-surface/20 text-white" : "bg-secondary text-muted-foreground group-hover:bg-streak/10 group-hover:text-streak"}`}>
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
                  className="border-2 border-border focus:border-streak/40 rounded-2xl resize-none text-sm bg-secondary/50 focus:bg-surface transition-colors placeholder:text-muted-foreground/60" />

                                    {currentAnswer.typed?.length > 0 &&
                <p className="text-xs text-muted-foreground text-right">{currentAnswer.typed.length} chars</p>
                }
                                </div>
              }
                        </div>
                    </motion.div>
                </AnimatePresence>

                {/* Navigation */}
                <div className="flex items-center justify-between gap-3">
                    <Button variant="outline" onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))} disabled={currentIndex === 0}
          className="gap-2 rounded-xl border-2 border-border font-semibold hover:bg-secondary/50">
                        <ChevronLeft className="w-4 h-4" /> Prev
                    </Button>

                    <Button onClick={() => {
            if (currentIndex < examQuestions.length - 1) {
              setCurrentIndex((i) => i + 1);
            } else {
              handleSubmitExam();
            }
          }}
          className={`gap-2 rounded-xl font-bold px-6 ${currentIndex === examQuestions.length - 1 ? "bg-streak hover:bg-streak/90 text-white btn-3d" : "bg-foreground hover:bg-foreground/90 text-background"}`}>
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

    const grade = results.score >= 85 ? { label: "Outstanding", key: "outstanding" } :
    results.score >= 70 ? { label: "Great Work", key: "great" } :
    results.score >= 55 ? { label: "Good Effort", key: "good" } :
    { label: "Keep Revising", key: "keep" };
    const gradeCls = GRADE_CLASSES[grade.key];
    const GradeIcon = gradeCls.icon;

    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-4">

                {/* Score Hero */}
                <div className={`${gradeCls.tile} rounded-3xl p-8 text-center relative overflow-hidden`}>
                    <div className="relative">
                        <div className={`w-16 h-16 rounded-2xl bg-surface/80 flex items-center justify-center mx-auto mb-3 ${gradeCls.text}`}>
                            <GradeIcon className="w-8 h-8" />
                        </div>
                        <p className={`stat-num ${gradeCls.text} mb-1`}>{results.pending > 0 ? `~${results.score}%` : `${results.score}%`}</p>
                        <p className="text-foreground/80 font-semibold text-lg">{grade.label}</p>
                        {results.pending > 0 &&
            <p className="text-muted-foreground text-xs mt-2 bg-surface/70 rounded-full px-3 py-1 inline-block">
                                {results.pending} open question{results.pending > 1 ? "s" : ""} to mark below — try the AI examiner
                            </p>
            }
                        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-border">
                            <div>
                                <p className="text-3xl font-black text-xp">{results.correct}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Correct</p>
                            </div>
                            <div>
                                <p className="text-3xl font-black text-foreground">{results.total}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Total</p>
                            </div>
                            <div>
                                <p className="text-3xl font-black font-mono text-streak">{formatTime(timeTakenSec)}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Time</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Subject Breakdown */}
                {Object.keys(results.bySubject).length > 0 &&
        <div className="card-soft p-6">
                        <h3 className="font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
                            <BarChart3 className="w-4 h-4 text-chart-3" /> By Subject
                        </h3>
                        <div className="space-y-4">
                            {Object.entries(results.bySubject).map(([subject, data]) => {
              const pct = data.total > 0 ? Math.round(data.correct / data.total * 100) : 0;
              const barColor = pct >= 70 ? "bg-primary" : pct >= 50 ? "bg-xp" : "bg-streak";
              const pctText = pct >= 70 ? "text-primary" : pct >= 50 ? "text-xp" : "text-streak";
              return (
                <div key={subject}>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-sm font-bold text-foreground">{subject}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-muted-foreground">{data.correct}/{data.total}</span>
                                                <span className={`text-sm font-black ${pctText}`}>{pct}%</span>
                                            </div>
                                        </div>
                                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
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
        <div className="bg-streak/5 rounded-3xl border border-streak/20 p-6">
                        <h3 className="font-bold text-streak flex items-center gap-2 text-sm mb-1">
                            <AlertCircle className="w-4 h-4" /> Areas to Prioritise
                        </h3>
                        <p className="text-xs text-streak/80 mb-4">Scored below 60% — focus revision here.</p>
                        <div className="space-y-2">
                            {weakTopics.slice(0, 5).map((t, i) =>
            <div key={i} className="flex items-center justify-between bg-surface rounded-2xl p-3.5 border border-border shadow-soft">
                                    <div>
                                        <p className="font-bold text-foreground text-sm">{t.topic}</p>
                                        <p className="text-xs text-muted-foreground">{t.subject} · {t.total} questions</p>
                                    </div>
                                    <span className="pill bg-streak/10 text-streak border border-streak/20">{t.pct}%</span>
                                </div>
            )}
                        </div>
                    </div>
        }

                {/* Question Review */}
                <div className="card-soft overflow-hidden">
                    <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3">
                        <h3 className="font-bold text-foreground text-sm uppercase tracking-wider flex items-center gap-2">
                            <Target className="w-4 h-4 text-chart-3" /> Review Answers
                        </h3>
                        <div className="flex items-center gap-2">
                            {results.pending > 0 &&
              <span className="pill bg-xp/10 text-xp hidden sm:inline-block">{results.pending} to mark</span>
              }
                            {examQuestions.some((q) => q.type === "open" && (answers[q.id]?.typed || "").trim()) &&
              <Button onClick={handleAIMark} disabled={isAIMarking} size="sm"
                className="rounded-xl bg-chart-4 hover:bg-chart-4/90 text-white font-bold gap-1.5 text-xs">
                                    {isAIMarking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                    {isAIMarking ? "Marking…" : "AI examiner marking"}
                                </Button>
              }
                        </div>
                    </div>
                    <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
                        {examQuestions.map((eq, i) => {
              const a = answers[eq.id] || {};
              const isMCQ = eq.type === "mcq";
              const isCorrect = isMCQ ? a.selectedIndex === eq.correctIndex : a.selfMark === true;
              const isWrong = isMCQ ? a.selectedIndex !== undefined && a.selectedIndex !== eq.correctIndex : a.selfMark === false;
              const isPending = !isMCQ && a.selfMark === undefined;

              return (
                <div key={eq.id} className={`p-5 transition-colors ${isPending ? "bg-xp/5" : ""}`}>
                                    <div className="flex gap-3">
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-black ${isCorrect ? "bg-primary/10 text-primary" : isWrong ? "bg-streak/10 text-streak" : "bg-secondary text-muted-foreground"}`}>
                                            {isCorrect ? <Check className="w-4 h-4" /> : isWrong ? <X className="w-4 h-4" /> : i + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-foreground text-sm mb-3 leading-relaxed">{eq.question}</p>

                                            {isMCQ &&
                      <div className="space-y-1.5">
                                                    {eq.options.map((opt, oi) =>
                        <div key={oi} className={`text-xs px-3 py-2 rounded-xl font-medium ${oi === eq.correctIndex ? "bg-primary/10 text-primary border border-primary/20" : oi === a.selectedIndex && oi !== eq.correctIndex ? "bg-streak/10 text-streak border border-streak/20" : "text-muted-foreground"}`}>
                                                            <span className="font-bold mr-2">{oi === eq.correctIndex ? "✓" : oi === a.selectedIndex ? "✗" : String.fromCharCode(65 + oi) + "."}</span>{opt}
                                                        </div>
                        )}
                                                    {eq.modelAnswer && <p className="text-xs text-muted-foreground mt-2 pl-2 border-l-2 border-chart-4/40 italic">{eq.modelAnswer}</p>}
                                                </div>
                      }

                                            {!isMCQ &&
                      <div className="space-y-2">
                                                    {a.typed ?
                        <div className="bg-secondary/50 rounded-xl p-3 border border-border">
                                                            <p className="text-xs text-muted-foreground mb-1 font-semibold uppercase tracking-wide">Your Answer</p>
                                                            <p className="text-sm text-foreground">{a.typed}</p>
                                                        </div> :

                        <p className="text-xs text-muted-foreground/60 italic">No answer written</p>
                        }
                                                    {eq.modelAnswer &&
                        <div className="bg-chart-4/5 rounded-xl p-3 border border-chart-4/20">
                                                            <p className="text-xs text-chart-4 mb-1 font-semibold uppercase tracking-wide">Model Answer</p>
                                                            <p className="text-sm text-foreground">{eq.modelAnswer}</p>
                                                        </div>
                        }
                                                    {a.aiVerdict &&
                        <div className={`rounded-xl p-3 border ${AI_VERDICT_CLASSES[a.aiVerdict].box}`}>
                                                            <p className={`text-xs mb-1 font-semibold uppercase tracking-wide flex items-center gap-1.5 ${AI_VERDICT_CLASSES[a.aiVerdict].text}`}>
                                                                <Sparkles className="w-3 h-3" /> Examiner: {AI_VERDICT_CLASSES[a.aiVerdict].label}
                                                            </p>
                                                            <p className="text-sm text-foreground">{a.aiFeedback}</p>
                                                        </div>
                        }
                                                    <div className="flex gap-2">
                                                        <button onClick={() => handleSelfMark(eq.id, true)}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all ${a.selfMark === true ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary"}`}>
                                                            <Check className="w-3.5 h-3.5" /> Correct
                                                        </button>
                                                        <button onClick={() => handleSelfMark(eq.id, false)}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all ${a.selfMark === false ? "bg-streak text-white border-streak" : "border-border text-muted-foreground hover:border-streak/40 hover:bg-streak/5 hover:text-streak"}`}>
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
          className="flex-1 rounded-2xl border-2 border-border h-12 gap-2 font-bold hover:bg-secondary/50">
                        <RefreshCw className="w-4 h-4" /> New Exam
                    </Button>
                    <Button onClick={handleStartExam}
          className="flex-1 bg-streak hover:bg-streak/90 text-white rounded-2xl h-12 gap-2 font-bold btn-3d">
                        <Play className="w-4 h-4" /> Retry Same Setup
                    </Button>
                </div>
            </motion.div>);

  }

  return null;
}
