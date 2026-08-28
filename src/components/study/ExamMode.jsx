import React, { useState, useEffect, useRef } from "react";
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
import AceShuffle from "@/components/ace/AceShuffle";
import {
  GraduationCap, Clock, AlertCircle, BarChart3, Check, X,
  ChevronLeft, ChevronRight, Play, Trophy, Loader2, RefreshCw,
  Target, Flag, Brain, BookOpen, Layers, Award, Star, FileText,
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

// Roughly half the paper drawn from flagged-weak material when there's enough
// of it. Enough to make revision feel targeted, not so much that the mock stops
// covering the rest of the course.
const WEAK_SHARE = 0.5;

// Fisher-Yates. `sort(() => Math.random() - 0.5)` is not a shuffle — the
// comparator is inconsistent, so the result is measurably biased toward the
// original order and some questions surface far less often than others.
function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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
  const [flagged, setFlagged] = useState({});          // qId -> true, "come back to this"
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const hasSubmitted = useRef(false);

  const [isAIMarking, setIsAIMarking] = useState(false);
  const { toast } = useToast();
  const [config, setConfig] = useState(() => {
    // Deep link from the weak-topics panel on Analytics:
    // /Study?tab=exam&subject=…&topic=…. Read straight off the URL at init —
    // seeding it from an effect would leave loadAllQuestions' closure holding
    // the pre-seed value.
    const params = new URLSearchParams(window.location.search);
    return {
      subject: params.get("subject") || "all",
      topic: params.get("topic") || "all",
      questionCount: 20,
      timeLimit: 30,
      // Active recall sessions were collected and then excluded by default, so
      // that material never reached a mock unless you went looking for the toggle.
      sources: ["flashcards", "quizzes", "active_recall"]
    };
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
        // cardId + weak are what let the exam feed back into spaced repetition
        // rather than being a read-only dead end.
        questions.push({ id: `fc_${fc.id}`, cardId: fc.id, weak: !!fc.is_weak_spot, type: "open", question: fc.question, modelAnswer: fc.answer, subject: fc.subject_name || "General", topic: fc.topic || "General", source: "Flashcards" });
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
  (cfg.subject === "all" || q.subject === cfg.subject) && (
  cfg.topic === "all" || q.topic === cfg.topic) &&
  cfg.sources.includes(getSourceKey(q.source))
  );

  // Topics that actually have material behind them, for the subject in play.
  const availableTopics = [...new Set(
    allQuestions.
    filter((q) => config.subject === "all" || q.subject === config.subject).
    map((q) => q.topic).
    filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  const handleStartExam = () => {
    const available = getAvailablePool();
    let pool;
    if (config.questionCount === "all") {
      pool = shuffle(available);
    } else {
      // Weight the paper toward what you're actually weak at. The app flags
      // weak cards in spaced repetition and this is the one place it matters
      // most, but selection used to be flat random — you could sit a whole mock
      // and never meet the material you keep getting wrong.
      const want = config.questionCount;
      const weak = shuffle(available.filter((q) => q.weak));
      const rest = shuffle(available.filter((q) => !q.weak));
      // Up to WEAK_SHARE from weak material, but never the entire paper —
      // revision that only revisits failures stops testing everything else.
      const weakSlots = Math.min(weak.length, Math.floor(want * WEAK_SHARE));
      pool = shuffle([...weak.slice(0, weakSlots), ...rest.slice(0, want - weakSlots)]);
      // Short on fresh material — top back up from whatever's left.
      if (pool.length < want) {
        const used = new Set(pool.map((q) => q.id));
        pool = pool.concat(available.filter((q) => !used.has(q.id)).slice(0, want - pool.length));
      }
    }
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

  // Under exam conditions a stray reload or back-swipe costs the whole paper,
  // so make the browser ask first. Only while a paper is actually running.
  useEffect(() => {
    if (phase !== "exam") return;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [phase]);

  // Keyboard, the way you'd actually sit a paper: arrows to move between
  // questions, number keys to pick a multiple-choice option, F to flag.
  useEffect(() => {
    if (phase !== "exam") return;
    const onKey = (e) => {
      const typing = ["INPUT", "TEXTAREA"].includes(e.target?.tagName);
      if (e.key === "ArrowRight" && !typing) setCurrentIndex((i) => Math.min(examQuestions.length - 1, i + 1));
      if (e.key === "ArrowLeft" && !typing) setCurrentIndex((i) => Math.max(0, i - 1));
      const q = examQuestions[currentIndex];
      if (!q) return;
      if ((e.key === "f" || e.key === "F") && !typing) {
        setFlagged((prev) => ({ ...prev, [q.id]: !prev[q.id] }));
      }
      if (!typing && q.type === "mcq" && /^[1-9]$/.test(e.key)) {
        const idx = Number(e.key) - 1;
        if (idx < (q.options?.length || 0)) handleSelectMCQ(q.id, idx);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, currentIndex, examQuestions]);

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
      // Same feedback loop as a manual self-mark — anything short of full marks
      // sends the card back into the review queue.
      openQs.forEach((q, i) => {
        if (marked[i]) feedWeakSpot(q, marked[i].verdict === "correct");
      });
      toast({ title: "Marked by the examiner", description: `${marked.length} answer${marked.length === 1 ? "" : "s"} assessed to VCAA standards.` });
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

  // Getting a card wrong in a mock used to teach the system nothing — ExamMode
  // only ever read. A miss here now flags the card weak and pulls its next
  // review to today, so the mock feeds spaced repetition instead of sitting
  // outside it. Only ever flags: clearing a weak spot is what real graded
  // reviews are for, and one lucky mock answer shouldn't undo that.
  const markedWeak = useRef(new Set());
  const feedWeakSpot = (question, isCorrect) => {
    if (isCorrect || !question?.cardId || markedWeak.current.has(question.cardId)) return;
    markedWeak.current.add(question.cardId);
    base44.entities.Flashcard.update(question.cardId, {
      is_weak_spot: true,
      next_review_date: new Date().toISOString().split("T")[0],
    }).catch((e) => console.error("Could not flag weak card:", e));
  };

  const handleSelfMark = (qId, correct) => {
    setAnswers((prev) => ({ ...prev, [qId]: { ...prev[qId], selfMark: correct } }));
    feedWeakSpot(examQuestions.find((q) => q.id === qId), correct);
  };

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
                        <AceShuffle size="lg" />
                        <span className="text-muted-foreground text-sm">Loading your study materials...</span>
                    </div> :

        <div className="space-y-4">
                        {/* Subject + Topic */}
                        <div className="card-soft p-5 space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-foreground flex items-center gap-2">
                                        <BookOpen className="w-4 h-4 text-muted-foreground" /> Subject
                                    </label>
                                    {/* Topic belongs to a subject — switching subject has to clear it,
                                        or you get a paper filtered to a topic that isn't in there. */}
                                    <Select value={config.subject} onValueChange={(v) => setConfig((c) => ({ ...c, subject: v, topic: "all" }))}>
                                        <SelectTrigger className="border-2 border-border rounded-xl h-11 bg-secondary/50 focus:border-streak/40">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all"><span className="inline-flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-xp" /> All Subjects</span></SelectItem>
                                            {(userSubjects || []).map((s) => <SelectItem key={s.id} value={s.subject_name}>{s.subject_name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-foreground flex items-center gap-2">
                                        <Target className="w-4 h-4 text-muted-foreground" /> Topic
                                    </label>
                                    <Select value={config.topic} onValueChange={(v) => setConfig((c) => ({ ...c, topic: v }))} disabled={!availableTopics.length}>
                                        <SelectTrigger className="border-2 border-border rounded-xl h-11 bg-secondary/50 focus:border-streak/40">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All topics</SelectItem>
                                            {availableTopics.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                            {/* A deep link can name a topic with nothing behind it any
                                                more. Keep it selectable so the label isn't blank. */}
                                            {config.topic !== "all" && !availableTopics.includes(config.topic) &&
                                            <SelectItem value={config.topic}>{config.topic}</SelectItem>}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            {config.topic !== "all" &&
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <Target className="w-3 h-3 text-streak flex-shrink-0" />
                                Drilling <span className="font-bold text-foreground">{config.topic}</span> only.
                                <button onClick={() => setConfig((c) => ({ ...c, topic: "all" }))} className="font-bold text-streak hover:underline">
                                    Widen it
                                </button>
                            </p>
              }
                        </div>

                        {/* Sources */}
                        <div className="card-soft p-5 space-y-3">
                            <label className="text-sm font-bold text-foreground flex items-center gap-2">
                                <Layers className="w-4 h-4 text-muted-foreground" /> Question Sources
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                                {SOURCES.map((s) => {
                const cnt = allQuestions.filter((q) => getSourceKey(q.source) === s.id && (config.subject === "all" || q.subject === config.subject) && (config.topic === "all" || q.topic === config.topic)).length;
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
                <p className="text-sm text-streak font-medium">
                                        {config.topic !== "all" ?
                  <>Nothing on <span className="font-bold">{config.topic}</span> in these sources. Widen the topic, or make cards for it first.</> :
                  "No questions match your selection. Add flashcards or quizzes first."}
                                    </p> :

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

    const flaggedCount = examQuestions.filter((eq) => flagged[eq.id]).length;
    const unanswered = examQuestions.length - answered;

    return (
      // Full-screen takeover. Sitting a paper with the nav, side rail and tab
      // bar still on screen is the main reason this never felt like an exam —
      // everything else in the app is one tap away the whole time.
      // z-[60], not z-50 — BottomNav's mobile tab bar is also z-50 and renders
      // later in the DOM, so at equal stacking it painted straight over the
      // paper. A column shell rather than one long scroll: the timer and the
      // navigation stay put, and only the question itself scrolls.
      <div className="fixed inset-0 z-[60] bg-background flex flex-col">

                {/* ── Top bar — full width, spans the screen ─────────── */}
                <motion.header
          animate={{ backgroundColor: isVeryLow ? "hsl(0 100% 45%)" : isLow ? "hsl(0 100% 55%)" : "hsl(218 50% 11%)" }}
          className="flex-shrink-0 transition-colors duration-1000">
                    <div className="px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 bg-surface/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                <GraduationCap className="w-4 h-4 text-white/70" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-white font-bold text-sm truncate">Exam conditions</p>
                                <p className="text-white/60 text-xs">
                                    {answered}/{examQuestions.length} answered
                                    {flaggedCount > 0 && <span className="text-white/50"> · {flaggedCount} flagged</span>}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-3">
                            {config.timeLimit > 0 &&
              <div className={`font-mono font-black text-xl sm:text-3xl flex items-center gap-1.5 tabular-nums text-white ${isVeryLow ? "animate-pulse" : ""}`}>
                                    <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                                    {formatTime(timeLeft)}
                                </div>
              }
                            {/* Desktop keeps the navigator open beside the paper,
                                so the toggle is only needed on small screens. */}
                            <button onClick={() => setShowQuestionMap((v) => !v)}
              aria-label="Question map"
              className="lg:hidden w-9 h-9 bg-surface/10 hover:bg-surface/20 rounded-xl flex items-center justify-center transition-colors">
                                <Layers className="w-4 h-4 text-white/70" />
                            </button>
                            <Button size="sm" onClick={() => setConfirmSubmit(true)}
              className={`rounded-xl font-bold gap-1.5 text-xs px-4 ${isLow ? "bg-surface text-streak hover:bg-surface/90" : "bg-surface/15 hover:bg-surface/25 text-white border border-white/20"}`}>
                                <Flag className="w-3.5 h-3.5" /> Hand in
                            </Button>
                        </div>
                    </div>
                    <div className="h-1 bg-black/20">
                        <motion.div className="h-full bg-white/70" animate={{ width: `${progress}%` }} transition={{ duration: 0.4, ease: "easeOut" }} />
                    </div>
                </motion.header>

                <div className="flex-1 flex min-h-0">

                    {/* ── Navigator — always visible on desktop ──────── */}
                    <aside className="hidden lg:flex lg:flex-col w-56 flex-shrink-0 border-r border-border bg-surface/40 overflow-y-auto p-4">
                        <p className="stat-label mb-3">Questions</p>
                        <div className="grid grid-cols-5 gap-1.5">
                            {examQuestions.map((eq, i) => {
                const a = answers[eq.id] || {};
                const done = eq.type === "mcq" ? a.selectedIndex !== undefined : a.typed?.length > 0;
                const isFlagged = !!flagged[eq.id];
                return (
                  <button key={i} onClick={() => setCurrentIndex(i)}
                  className={`relative w-8 h-8 rounded-lg text-xs font-bold transition-all ${i === currentIndex ? "bg-streak text-white ring-2 ring-streak/30" : done ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground hover:bg-secondary/80"}`}>
                                        {i + 1}
                                        {isFlagged && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-xp" />}
                                    </button>);

              })}
                        </div>
                        <div className="mt-5 space-y-1.5 text-[11px] text-muted-foreground">
                            <p className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-primary/30" /> answered</p>
                            <p className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-secondary" /> not yet</p>
                            <p className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-xp" /> flagged</p>
                        </div>
                    </aside>

                    {/* ── The paper ──────────────────────────────────── */}
                    <main className="flex-1 overflow-y-auto">
                    {/* min-h-full + centring: a short question sat at the top of
                        a full-height column with a screen of empty background
                        under it, which is the opposite of filling the screen.
                        Long questions still scroll normally. */}
                    <div className="min-h-full max-w-3xl mx-auto px-4 sm:px-8 py-6 flex flex-col justify-center">

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
                                    {/* Come back to this one — what you'd circle on a real paper. */}
                                    <button
                    onClick={() => q && setFlagged((prev) => ({ ...prev, [q.id]: !prev[q.id] }))}
                    aria-label={flagged[q?.id] ? "Remove flag" : "Flag for review"}
                    aria-pressed={!!flagged[q?.id]}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${flagged[q?.id] ? "bg-xp/15 text-xp" : "text-muted-foreground/50 hover:text-foreground hover:bg-secondary"}`}>
                                        <Flag className="w-3.5 h-3.5" />
                                    </button>
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

                    </div>
                    </main>
                </div>

                {/* ── Navigation — pinned, so moving between questions never
                       depends on scrolling back down the page ────────── */}
                <footer className="flex-shrink-0 border-t border-border bg-surface">
                    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-3 flex items-center justify-between gap-3">
                        <Button variant="outline" onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))} disabled={currentIndex === 0}
            className="gap-2 rounded-xl border-2 border-border font-semibold hover:bg-secondary/50">
                            <ChevronLeft className="w-4 h-4" /> Prev
                        </Button>

                        <p className="hidden sm:block text-[11px] text-muted-foreground/60 text-center">
                            ← → between questions · 1-9 to answer · F to flag
                        </p>

                        <Button onClick={() => {
              if (currentIndex < examQuestions.length - 1) {
                setCurrentIndex((i) => i + 1);
              } else {
                setConfirmSubmit(true);
              }
            }}
            className={`gap-2 rounded-xl font-bold px-6 ${currentIndex === examQuestions.length - 1 ? "bg-streak hover:bg-streak/90 text-white btn-3d" : "bg-foreground hover:bg-foreground/90 text-background"}`}>
                            {currentIndex === examQuestions.length - 1 ?
              <><Flag className="w-4 h-4" /> Finish</> :

              <>Next <ChevronRight className="w-4 h-4" /></>
              }
                        </Button>
                    </div>
                </footer>

                {/* ── Navigator on small screens, as an overlay ───────── */}
                <AnimatePresence>
                    {showQuestionMap &&
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => setShowQuestionMap(false)}
          className="lg:hidden fixed inset-0 z-[70] bg-foreground/50 backdrop-blur-sm flex items-end">
                            <motion.div initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-surface rounded-t-2xl p-5 max-h-[70vh] overflow-y-auto">
                                <p className="stat-label mb-3">Questions</p>
                                <div className="grid grid-cols-8 gap-2">
                                    {examQuestions.map((eq, i) => {
                  const a = answers[eq.id] || {};
                  const done = eq.type === "mcq" ? a.selectedIndex !== undefined : a.typed?.length > 0;
                  const isFlagged = !!flagged[eq.id];
                  return (
                    <button key={i} onClick={() => {setCurrentIndex(i);setShowQuestionMap(false);}}
                    className={`relative w-9 h-9 rounded-lg text-xs font-bold transition-all ${i === currentIndex ? "bg-streak text-white ring-2 ring-streak/30" : done ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>
                                            {i + 1}
                                            {isFlagged && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-xp" />}
                                        </button>);

                })}
                                </div>
                            </motion.div>
                        </motion.div>
          }
                </AnimatePresence>

                {/* Handing in is final — say what's still open before it happens.
                    Submit used to fire straight off a single tap. */}
                <AnimatePresence>
                    {confirmSubmit &&
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/50 backdrop-blur-sm p-4">
                            <motion.div initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }}
            className="bg-surface rounded-2xl border-2 border-border shadow-soft-lg w-full max-w-sm p-6">
                                <h3 className="font-display font-extrabold text-foreground text-xl mb-1">Hand it in?</h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                    {unanswered === 0 && flaggedCount === 0
                    ? "Everything's answered. Once you hand in you can't change your answers."
                    : "Once you hand in you can't change your answers."}
                                </p>
                                {(unanswered > 0 || flaggedCount > 0) &&
              <div className="space-y-1.5 mb-5">
                                        {unanswered > 0 &&
                <p className="text-sm font-bold text-streak">{unanswered} question{unanswered === 1 ? "" : "s"} unanswered</p>
                }
                                        {flaggedCount > 0 &&
                <p className="text-sm font-bold text-xp">{flaggedCount} flagged for review</p>
                }
                                    </div>
              }
                                <div className="flex flex-col gap-2">
                                    <Button onClick={() => { setConfirmSubmit(false); handleSubmitExam(); }}
                  className="w-full rounded-xl font-bold bg-streak hover:bg-streak/90 text-white">
                                        Hand in
                                    </Button>
                                    <Button variant="outline" onClick={() => setConfirmSubmit(false)}
                  className="w-full rounded-xl font-semibold">
                                        Keep working
                                    </Button>
                                </div>
                            </motion.div>
                        </motion.div>
          }
                </AnimatePresence>
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
                                            {/* Where each question came from — SOURCE_ICON was defined
                                                and never rendered, so review gave no way to tell a
                                                flashcard miss from a quiz miss. */}
                                            <div className="flex items-center gap-1.5 mb-1.5 text-[11px] text-muted-foreground">
                                                {SOURCE_ICON[eq.source] && React.createElement(SOURCE_ICON[eq.source], { className: "w-3 h-3" })}
                                                <span>{eq.source}</span>
                                                {eq.weak && <span className="pill bg-streak/10 text-streak text-[10px] px-1.5 py-0">weak spot</span>}
                                                <span className="text-muted-foreground/50">· {eq.topic}</span>
                                            </div>
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
