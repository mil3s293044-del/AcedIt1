/**
 * AI Tools — the bench.
 *
 * ─── A CHAT LOSES THE ARTIFACT ──────────────────────────────────────────────
 * This page was nine personas behind a dropdown. Ask the essay planner for a
 * plan and the plan was a message in a scroll: the next tool could not act on
 * it, so the student copied it back in and restated the context. One piece of
 * work meant up to nine conversations about it, none of which knew about the
 * others.
 *
 * The WORKPIECE is the object now and the tools are operations on it —
 * `src/lib/workpiece.js` carries that whole argument. What each tool produced
 * stays on the bench, in order, and every later step has the ones before it.
 *
 * ─── THREE STATES AND THEY ARE ALL REAL ─────────────────────────────────────
 *   PICK   nothing on the bench. Candidates are the student's own work, and
 *          "something else" takes anything they can paste.
 *   BENCH  a workpiece, the tools that can act on it, and what has been done.
 *   STEP   one operation, open as a conversation, scoped to that step.
 *
 * ─── THE STEP IS THE REAL CHAT, UNCHANGED ───────────────────────────────────
 * `UnifiedChat` already streams, handles artifacts, bills the right feature and
 * persists. A step hands it a tool, a subject and an opening message. Writing a
 * runner here would be a second copy of a surface this codebase has had to fix
 * four times, and the first thing to drift would be the billing.
 *
 * ─── THE BENCH IS FREE AND THE TOOLS ARE NOT ────────────────────────────────
 * Unchanged from the split that replaced `RequirePremium`: the diagnosis is
 * arithmetic over rows the student already owns and costs nothing to run, so
 * everybody sees what is worth working on and what each tool would do to it.
 * Running one is an Anthropic bill, so the composer locks.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import UnifiedChat from "@/components/ai_tools/UnifiedChat";
import WorkBench from "@/components/ai_tools/WorkBench";
import WorkPicker from "@/components/ai_tools/WorkPicker";
import AceShuffle from "@/components/ace/AceShuffle";
import { isPremium } from "@/lib/tierAccess";
import { candidates } from "@/lib/workpieceSources";
import { seedFor, stepTitle } from "@/lib/workpiece";
import { deckCards, isBankCard } from "@/lib/mistakeBank";
import { isReady, todayISO } from "@/lib/due";

export default function AITools() {
    // `undefined` while it loads, so nothing decides before the profile lands.
    // Defaulting either way flashes the wrong thing at somebody and takes it
    // back.
    const [premium, setPremium] = useState(undefined);
    const [rows, setRows] = useState(null);

    // The thing on the bench, and the operation currently open on it. Neither
    // is persisted: a workpiece is DERIVED from what the student picked, and
    // the STEPS are what persist — they are conversations, and `UnifiedChat`
    // already saves those.
    const [workpiece, setWorkpiece] = useState(null);
    const [steps, setSteps] = useState([]);
    const [step, setStep] = useState(null);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const u = await base44.auth.me();
                // ── ONE ROUND TRIP, EACH READ CATCHING FOR ITSELF ───────────
                // `Promise.all` is the wrong primitive for a list of
                // independent reads: one unreadable table would discard the
                // other four and the picker would render as though the student
                // had no history at all.
                const [profiles, flashcards, attempts, quizzes, assessments] = await Promise.all([
                    base44.entities.UserProfile.filter({ created_by: u.email }).catch(() => []),
                    base44.entities.Flashcard.filter({ created_by: u.email, is_active: true }).catch(() => []),
                    base44.entities.QuizAttempt.filter({ created_by: u.email }).catch(() => []),
                    base44.entities.Quiz.filter({ created_by: u.email }).catch(() => []),
                    base44.entities.SubjectAssessment.filter({ created_by: u.email }).catch(() => []),
                ]);
                if (!alive) return;
                setPremium(isPremium(profiles?.[0] ?? null));
                setRows({
                    // The deck half and the bank half, split once. A banked
                    // mistake is a flashcards ROW and is not a flashcard.
                    cards: deckCards(flashcards || []),
                    bankCards: (flashcards || []).filter(isBankCard),
                    attempts: attempts || [],
                    quizzes: quizzes || [],
                    assessments: assessments || [],
                });
            } catch {
                // A FAILED READ LOCKS. The server refuses the send either way,
                // so an unlocked composer would only produce a refusal the
                // student cannot act on.
                if (alive) { setPremium(false); setRows({}); }
            }
        })();
        return () => { alive = false; };
    }, []);

    // `isReady` IS PASSED WITH ITS DAY, the way /Review passes it. Handed bare
    // it still works — `dayOf` falls back to now when `today` is undefined —
    // but the two screens would be answering "ready" against different
    // instants, and the point-free form is the one due.js records as the arity
    // bug that renders perfectly and reports every learned card as due.
    const picks = useMemo(() => {
        if (!rows) return [];
        const today = todayISO();
        return candidates({ ...rows, isReady: (c) => isReady(c, today) });
    }, [rows]);

    /**
     * Run a tool on the workpiece.
     *
     * It does not call anything — it OPENS a step, which is a conversation
     * seeded with the operation's opening message. The model runs when the
     * student sends, which is the same rule the brief kept: a card that spent a
     * chip on one tap would be the only action in the app costing them
     * something they had not read.
     */
    const run = useCallback((op) => {
        const next = {
            id: `${op.id}-${Date.now()}`,
            op: op.id,
            tool: op.tool,
            title: stepTitle(op, workpiece),
            preview: op.does,
            seed: seedFor(op, workpiece),
        };
        setSteps((s) => [...s, next]);
        setStep(next);
    }, [workpiece]);

    const pick = useCallback((w) => {
        setWorkpiece(w);
        setSteps([]);
        setStep(null);
    }, []);

    const clear = useCallback(() => {
        setWorkpiece(null);
        setSteps([]);
        setStep(null);
    }, []);

    if (premium === undefined) {
        return (
            <div className="h-[calc(100dvh-8rem)] md:h-[calc(100dvh-3rem)] flex items-center justify-center">
                <AceShuffle size="lg" />
            </div>
        );
    }

    // ── A STEP TAKES THE WHOLE SCREEN ───────────────────────────────────────
    // It is a conversation, and a conversation in a 300px panel beside a bench
    // is the cramped shape Ranked was just split for. The way back is the
    // workpiece header, which is the one thing that stays.
    if (step) {
        return (
            <div className="h-[calc(100dvh-8rem)] md:h-[calc(100dvh-3rem)] bg-background">
                <div className="h-full max-w-7xl mx-auto px-2 lg:px-4 py-3 flex flex-col min-h-0">
                    <UnifiedChat
                        locked={!premium}
                        startTool={step.tool}
                        startSubject={workpiece?.subject || ""}
                        startSeed={step.seed}
                        onExit={() => setStep(null)}
                        exitLabel={workpiece?.title || "Bench"}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100dvh-8rem)] md:min-h-[calc(100dvh-3rem)] bg-background">
            {workpiece ? (
                <WorkBench
                    workpiece={workpiece}
                    steps={steps}
                    onRun={run}
                    onOpenStep={setStep}
                    onNew={clear}
                />
            ) : (
                <WorkPicker candidates={picks} onPick={pick} loading={rows === null} />
            )}
        </div>
    );
}
