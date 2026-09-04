import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Clock, Sparkles, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import MathText from "@/components/shared/LatexRenderer";
import { fireXPFeedback } from "@/components/ranked/XPFeedback";
import { deckCards } from "@/lib/mistakeBank";

// ─── Loading mini-quiz ───────────────────────────────────────────────────────
// Shown while a slow AI generation runs. Pulls quick MCQs from the student's
// own quizzes + flashcards (zero AI cost — real revision), falling back to a
// small built-in bank. 10s per question, 4 options, instant feedback. Correct
// answers award +5 XP for the first XP_AWARD_LIMIT per loading session (the
// server also caps the daily total), so it's a bonus, not a farm.

const QUESTION_SECONDS = 10;
const XP_AWARD_LIMIT = 2;   // correct answers that earn XP per loading session
const XP_PER_CORRECT = 5;
const DECK_SIZE = 12;

const STATIC_BANK = [
    { question: "Mitochondria are best known as the cell's…", options: ["Powerhouse (make ATP)", "Protein factory", "Genetic library", "Waste disposal"], correctIndex: 0 },
    { question: "What is the derivative of $x^2$?", options: ["$2x$", "$x$", "$2$", "$\\frac{x^3}{3}$"], correctIndex: 0 },
    { question: "In an essay, TEEL stands for Topic sentence, Evidence, Explanation, and…", options: ["Link", "List", "Logic", "Lesson"], correctIndex: 0 },
    { question: "Water's chemical formula is…", options: ["H₂O", "CO₂", "O₂", "NaCl"], correctIndex: 0 },
    { question: "Solve $2x = 10$. $x = ?$", options: ["$5$", "$2$", "$10$", "$20$"], correctIndex: 0 },
    { question: "Which study technique is most effective for memory?", options: ["Active recall", "Re-reading", "Highlighting", "Cramming"], correctIndex: 0 },
    { question: "Which is a metalanguage term used in English analysis?", options: ["Juxtaposition", "Photosynthesis", "Derivative", "Titration"], correctIndex: 0 },
    { question: "$\\frac{1}{2} + \\frac{1}{4} = ?$", options: ["$\\frac{3}{4}$", "$\\frac{1}{6}$", "$\\frac{2}{6}$", "$1$"], correctIndex: 0 },
    { question: "The gradient of the line $y = 3x + 2$ is…", options: ["$3$", "$2$", "$1$", "$5$"], correctIndex: 0 },
    { question: "Photosynthesis mainly takes place in the…", options: ["Chloroplast", "Nucleus", "Ribosome", "Mitochondria"], correctIndex: 0 },
];

const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};

// Randomise where the correct answer sits.
const shuffleQuestion = (q) => {
    const correct = q.options[q.correctIndex];
    const opts = shuffle(q.options);
    return { question: q.question, options: opts, correctIndex: opts.indexOf(correct) };
};

export default function LoadingQuiz() {
    const [deck, setDeck] = useState([]);
    const [loadingDeck, setLoadingDeck] = useState(true);
    const [idx, setIdx] = useState(0);
    const [selected, setSelected] = useState(null); // null | index | -1 (timeout)
    const [timeLeft, setTimeLeft] = useState(QUESTION_SECONDS);
    const [correctCount, setCorrectCount] = useState(0);
    const [xpEarned, setXpEarned] = useState(0);
    const xpAwardedRef = useRef(0);
    const advanceRef = useRef(null);

    // ── Build the deck once from the student's own content + fallback bank ──
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const built = [];
            try {
                const user = await base44.auth.me();
                const [quizzes, cards] = await Promise.all([
                    base44.entities.Quiz.filter({ created_by: user.email }).catch(() => []),
                    base44.entities.Flashcard.filter({ created_by: user.email }).then(deckCards).catch(() => []),
                ]);

                // From saved quizzes — MCQs already have options + correct index.
                (quizzes || []).forEach((qz) => {
                    (qz.questions || []).forEach((q) => {
                        if ((q.type === "mcq" || Array.isArray(q.options)) && Array.isArray(q.options) && q.options.length >= 2 && typeof q.correct_answer === "number" && q.options[q.correct_answer] != null) {
                            built.push({ question: q.question, options: q.options.slice(0, 4), correctIndex: Math.min(q.correct_answer, 3) });
                        }
                    });
                });

                // From flashcards — answer is correct, distractors from other cards.
                const usable = (cards || []).filter((c) => c.question && c.answer);
                if (usable.length >= 4) {
                    usable.forEach((c) => {
                        const distractors = shuffle(usable.filter((o) => o.answer !== c.answer)).slice(0, 3).map((o) => o.answer);
                        if (distractors.length === 3) {
                            built.push({ question: c.question, options: [c.answer, ...distractors], correctIndex: 0 });
                        }
                    });
                }
            } catch { /* not signed in / fetch failed — fall back below */ }

            // Always mix in the static bank so there's never an empty deck.
            built.push(...STATIC_BANK);

            const finalDeck = shuffle(built).slice(0, DECK_SIZE).map(shuffleQuestion);
            if (!cancelled) {
                setDeck(finalDeck.length ? finalDeck : STATIC_BANK.map(shuffleQuestion));
                setLoadingDeck(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const current = deck[idx];

    const goNext = useCallback(() => {
        setSelected(null);
        setTimeLeft(QUESTION_SECONDS);
        setIdx((i) => (deck.length ? (i + 1) % deck.length : 0));
    }, [deck.length]);

    // ── Per-question countdown ──
    useEffect(() => {
        if (loadingDeck || selected !== null) return;
        if (timeLeft <= 0) { setSelected(-1); return; }
        const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
        return () => clearTimeout(t);
    }, [timeLeft, selected, loadingDeck]);

    // ── Auto-advance after an answer/timeout ──
    useEffect(() => {
        if (selected === null) return;
        advanceRef.current = setTimeout(goNext, 1300);
        return () => clearTimeout(advanceRef.current);
    }, [selected, goNext]);

    const handleSelect = (i) => {
        if (selected !== null || !current) return;
        setSelected(i);
        if (i === current.correctIndex) {
            setCorrectCount((c) => c + 1);
            if (xpAwardedRef.current < XP_AWARD_LIMIT) {
                xpAwardedRef.current += 1;
                setXpEarned((x) => x + XP_PER_CORRECT);
                base44.functions
                    .invoke("awardXP", { source: "loading_quiz", event_key: `lq_${Date.now()}_${idx}`, flat_xp: XP_PER_CORRECT })
                    .then((r) => fireXPFeedback(r?.data || r, "loading_quiz"))
                    .catch(() => {});
            }
        }
    };

    if (loadingDeck || !current) {
        return (
            <div className="card-soft p-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin text-primary" /> Building your cheat sheet…
            </div>
        );
    }

    const answered = selected !== null;

    return (
        <div className="card-soft overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/30">
                <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-sm font-bold text-foreground">Quick quiz while we build your cheat sheet</span>
                </div>
                {xpEarned > 0 && (
                    <span className="pill bg-xp/10 text-xp flex items-center gap-1"><Sparkles className="w-3 h-3" /> +{xpEarned} XP</span>
                )}
            </div>

            <div className="p-5 space-y-4">
                {/* Timer bar */}
                <div className="flex items-center gap-2">
                    <Clock className={`w-3.5 h-3.5 ${timeLeft <= 3 && !answered ? "text-streak" : "text-muted-foreground"}`} />
                    <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <motion.div
                            className={`h-full rounded-full ${timeLeft <= 3 && !answered ? "bg-streak" : "bg-primary"}`}
                            animate={{ width: `${(timeLeft / QUESTION_SECONDS) * 100}%` }}
                            transition={{ ease: "linear", duration: 0.3 }}
                        />
                    </div>
                    <span className="text-xs font-bold text-muted-foreground tabular-nums w-5 text-right">{Math.max(0, timeLeft)}</span>
                </div>

                {/* Question */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="space-y-3"
                    >
                        <p className="text-sm font-bold text-foreground leading-snug min-h-[2.5rem]"><MathText>{current.question}</MathText></p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {current.options.map((opt, i) => {
                                const isCorrect = i === current.correctIndex;
                                const isPicked = i === selected;
                                let cls = "border-border bg-surface hover:border-primary/40 hover:bg-primary/5";
                                if (answered) {
                                    if (isCorrect) cls = "border-primary/50 bg-primary/10 text-primary";
                                    else if (isPicked) cls = "border-streak/50 bg-streak/10 text-streak";
                                    else cls = "border-border bg-surface opacity-50";
                                }
                                return (
                                    <button
                                        key={i}
                                        onClick={() => handleSelect(i)}
                                        disabled={answered}
                                        className={`text-left px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all flex items-center justify-between gap-2 ${cls}`}
                                    >
                                        <span className="flex-1 min-w-0"><MathText>{opt}</MathText></span>
                                        {answered && isCorrect && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                                        {answered && isPicked && !isCorrect && <X className="w-4 h-4 text-streak flex-shrink-0" />}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="h-4 text-center">
                            {answered && (
                                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`text-xs font-bold ${selected === current.correctIndex ? "text-primary" : "text-muted-foreground"}`}>
                                    {selected === current.correctIndex ? "Correct!" : selected === -1 ? "Time's up — moving on" : "Not quite — next one coming up"}
                                </motion.p>
                            )}
                        </div>
                    </motion.div>
                </AnimatePresence>

                <p className="text-[11px] text-center text-muted-foreground">Score {correctCount} · keep going while your cheat sheet builds</p>
            </div>
        </div>
    );
}
