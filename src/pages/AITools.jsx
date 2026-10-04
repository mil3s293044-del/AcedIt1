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
 * ─── A BENCH IS NOT STORED, AND THAT IS WHY NOTHING IS STRANDED ─────────────
 * A bench is a workpiece plus the steps run on it, and every step IS a
 * conversation that already persists — so `bench.js` reconstructs the shelf by
 * grouping those rows on the workpiece's key. No table, no migration, nothing
 * that can disagree with the steps it is made of. Which also means every chat
 * on this site from before the bench existed is on the shelf: one with no
 * workpiece opens as a DRAFT and the bench asks the one fact it is missing.
 *
 * ─── THREE STATES AND THEY ARE ALL REAL ─────────────────────────────────────
 *   PICK   nothing on the bench. The shelf of what is already on the go leads,
 *          then candidates off the student's own work, then anything they paste.
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
import { seedFor, stepTitle, makeWorkpiece } from "@/lib/workpiece";
import { benches } from "@/lib/bench";
import { loadSavedResults } from "@/lib/saveResult";
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
    // A bench adopted from a chat that predates the workpiece. It holds the
    // body, the subject and the earlier steps, and is waiting on a kind.
    const [draft, setDraft] = useState(null);
    const [steps, setSteps] = useState([]);
    const [step, setStep] = useState(null);
    const [convs, setConvs] = useState([]);

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
                const [profiles, flashcards, attempts, quizzes, assessments, saved] = await Promise.all([
                    base44.entities.UserProfile.filter({ created_by: u.email }).catch(() => []),
                    base44.entities.Flashcard.filter({ created_by: u.email, is_active: true }).catch(() => []),
                    base44.entities.QuizAttempt.filter({ created_by: u.email }).catch(() => []),
                    base44.entities.Quiz.filter({ created_by: u.email }).catch(() => []),
                    base44.entities.SubjectAssessment.filter({ created_by: u.email }).catch(() => []),
                    loadSavedResults(null, u.email).catch(() => []),
                ]);
                if (!alive) return;
                setConvs(saved || []);
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

    // THE SHELF IS DERIVED, like the candidates beside it. A bench appears
    // because steps were saved against it and disappears when they are deleted;
    // there is nothing to invalidate and nothing to backfill.
    const shelf = useMemo(() => benches(convs), [convs]);

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
            // No conversation yet — one exists the moment the student sends,
            // and `onSaved` below is how this row learns its id so the step can
            // be reopened without a reload.
            convId: null,
            conv: null,
        };
        setSteps((s) => [...s, next]);
        setStep(next);
    }, [workpiece]);

    /**
     * A step has saved, so it is now a thing that can be reopened.
     *
     * Matched on the STEP ID rather than on the open step, because `persist`
     * fires after the turn completes and the student may already have gone back
     * to the bench — reading `step` would attach the conversation to whatever
     * was open at that moment, or to nothing.
     */
    const saved = useCallback((stepId, row) => {
        if (!row?.id) return;
        setSteps((list) => list.map((s) => (s.id === stepId
            ? { ...s, convId: row.id, conv: row } : s)));
        // The shelf is built from these rows, so a bench the student started
        // this session is on it the moment they come back to the picker.
        setConvs((list) => {
            const rest = list.filter((c) => c.id !== row.id);
            return [row, ...rest];
        });
    }, []);

    const pick = useCallback((w) => {
        setWorkpiece(w);
        setDraft(null);
        // THE STEPS ALREADY RUN ON THIS PIECE COME WITH IT. A workpiece key is
        // a function of what the thing IS, so picking the same question out of
        // the mistake bank a second time reopens the bench it already has
        // rather than starting an empty one beside it.
        const existing = benches(convs, { max: Infinity })
            .find((b) => b.key === w.key);
        setSteps(existing?.steps || []);
        setStep(null);
    }, [convs]);

    const openBench = useCallback((b) => {
        setWorkpiece(b.workpiece || null);
        setDraft(b.workpiece ? null : b.draft);
        setSteps(b.steps || []);
        setStep(null);
    }, []);

    /**
     * The student has said what an adopted chat is.
     *
     * The key stays the DRAFT'S key — the row it came from — so the steps
     * already on the bench and every step run from here group together. Keying
     * on the body instead would leave the earlier conversation on a bench of
     * its own, which is the stranding this whole half exists to prevent.
     */
    const nameKind = useCallback((kind) => {
        if (!draft) return;
        const w = makeWorkpiece({
            kind,
            body: draft.body,
            title: draft.title,
            subject: draft.subject,
            source: "chat",
            files: draft.files,
            key: draft.key,
        });
        if (!w) return;
        setWorkpiece(w);
        setDraft(null);
    }, [draft]);

    const clear = useCallback(() => {
        setWorkpiece(null);
        setDraft(null);
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
                        // KEYED ON THE STEP, so switching between two steps
                        // remounts rather than leaving the first one's messages
                        // in a component whose props have changed underneath
                        // it — the conversation is hydrated once, on mount.
                        key={step.id}
                        locked={!premium}
                        startTool={step.tool}
                        startSubject={workpiece?.subject || ""}
                        startSeed={step.conv ? "" : step.seed}
                        startConversation={step.conv || null}
                        workpiece={workpiece}
                        operation={step.op}
                        onSaved={(row) => saved(step.id, row)}
                        onExit={() => setStep(null)}
                        exitLabel={workpiece?.title || "Bench"}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100dvh-8rem)] md:min-h-[calc(100dvh-3rem)] bg-background">
            {workpiece || draft ? (
                <WorkBench
                    workpiece={workpiece}
                    draft={draft}
                    steps={steps}
                    onRun={run}
                    onOpenStep={setStep}
                    onKind={nameKind}
                    onNew={clear}
                />
            ) : (
                <WorkPicker
                    candidates={picks}
                    benches={shelf}
                    onPick={pick}
                    onOpenBench={openBench}
                    loading={rows === null}
                />
            )}
        </div>
    );
}
