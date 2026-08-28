/**
 * GuidedRun — the walkthrough, on screen.
 *
 * The logic all lives in `@/lib/guidedRun`; this file navigates, points, and
 * pays. It deliberately owns no opinion about when a step is finished — it
 * asks, and the answer comes from rows.
 *
 * ─── Why this is not a modal ────────────────────────────────────────────────
 * The worst version of this feature is a backdrop with Next / Next / Next. It
 * gets closed in two seconds, teaches nothing, and — the part that actually
 * costs us — teaches the student that the correct response to this app talking
 * to them is to close it, after which none of the good guidance already in
 * here gets read either. aceFirstRun's header makes the same argument at
 * length, and it is the reason a walkthrough was worth building at all.
 *
 * So: a card in the corner, never over the thing it is describing, the app
 * fully usable behind it. "Later" folds it to a pill. It never blocks a route,
 * never traps focus, and never waits for a click before the student is allowed
 * to do something else.
 *
 * ─── The three ways it goes quiet ───────────────────────────────────────────
 *   - Finished. Every step has a row behind it, so it congratulates once and
 *     hands over to Explore.
 *   - Stopped. They said no. The run is marked skipped and is not offered
 *     again; the same rule aceFirstRun applies after three dismissals.
 *   - Nothing to ask for. A student who already did all three never sees it
 *     (activeRun returns null), and the run is closed off silently rather than
 *     sitting there as an unfinishable badge.
 *
 * ─── Polling ───────────────────────────────────────────────────────────────
 * Completion is a row appearing in a table the student is filling in on
 * another page, so something has to look again. It re-reads on navigation, on
 * the tab regaining focus, and on a slow timer while the card is open — and
 * the timer stops the moment the tab is hidden or the card is folded away.
 * Cheap, and it means the tick lands while they are still looking at it.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, Check, Compass, Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { awardXP } from "@/api/functionsShim";
import { fireXPFeedback } from "@/components/ranked/XPFeedback";
import { isPremium } from "@/components/shared/subscriptionHelpers";
import SpadeMark from "@/components/ace/SpadeMark";
import AceRoam from "@/components/ace/AceRoam";
import {
    activeRun, chooseRun, runProgress, runRecord, withRunPatch,
    unpaidSteps, preexistingSteps, xpFor, eventKeyFor,
} from "@/lib/guidedRun";

/**
 * Pages where a walkthrough card would be an interruption rather than a guide:
 * the signup wizard it follows on from, the legal pages, and every screen in
 * the payment flow — someone mid-checkout is not looking to be taught.
 */
const QUIET_PAGES = new Set([
    "Onboarding", "Landing", "Login", "ForgotPassword", "ResetPassword", "Suspended",
    "Checkout", "PaymentSuccess", "PaymentCancel", "Paywall", "Premium", "Subscription",
    "Terms", "Privacy", "Support",
]);

/** Slow on purpose. The row is being written on another page, not this one. */
const POLL_MS = 10_000;
/** How long the finished-step state holds before the card moves on. */
const CELEBRATE_MS = 2600;

export default function GuidedRun({ page, userProfile, onLiveChange }) {
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [data, setData] = useState(null);
    const [collapsed, setCollapsed] = useState(false);
    const [celebrating, setCelebrating] = useState(null);
    const [finishedRun, setFinishedRun] = useState(null);
    // One settle at a time. Paying a step patches the profile, which re-runs
    // the effect that pays steps — without this it is a loop with a network
    // call in it.
    const settling = useRef(false);
    const paid = useRef(new Set());

    // Layout owns the profile fetch; this keeps its own copy because it writes
    // to `extra` and Layout would not know. Re-seeded whenever a different
    // profile arrives, never on every render of the same one.
    useEffect(() => {
        if (userProfile?.id && userProfile.id !== profile?.id) setProfile(userProfile);
    }, [userProfile, profile?.id]);

    const quiet = QUIET_PAGES.has(page);

    const load = useCallback(async () => {
        try {
            const me = await base44.auth.me();
            const email = me?.email;
            if (!email) return;
            const q = (entity, extra = {}, ...rest) =>
                base44.entities[entity].filter({ created_by: email, ...extra }, ...rest).catch(() => []);
            const [subjects, quizAttempts, techniques, recallSessions, aiResults] = await Promise.all([
                q("UserSubject", { is_active: true }),
                q("QuizAttempt", {}, "-created_date", 5),
                q("StudyTechnique", {}, "-date", 60),
                q("ActiveRecallSession", {}, "-created_date", 5),
                q("AISavedResult", {}, "-created_date", 60),
            ]);
            setData({ subjects, quizAttempts, techniques, recallSessions, aiResults });
        } catch {
            // A walkthrough that cannot reach the database should go quiet, not
            // guess. `data` stays null and nothing renders.
        }
    }, []);

    // Re-read on arrival at a new page, and whenever the tab comes back.
    useEffect(() => {
        if (quiet || !profile) return;
        load();
        const onFocus = () => { if (!document.hidden) load(); };
        document.addEventListener("visibilitychange", onFocus);
        window.addEventListener("focus", onFocus);
        return () => {
            document.removeEventListener("visibilitychange", onFocus);
            window.removeEventListener("focus", onFocus);
        };
    }, [page, quiet, profile, load]);

    const premium = useMemo(() => isPremium(profile), [profile]);
    const runId = useMemo(
        () => (quiet || !profile || !data ? null : activeRun(profile, data, { premium })),
        [quiet, profile, data, premium]);
    const record = useMemo(
        () => (runId ? runRecord(profile, runId) : null), [profile, runId]);
    const progress = useMemo(
        () => (runId ? runProgress(runId, data, record) : null), [runId, data, record]);

    // Keep looking while there is something to look for.
    useEffect(() => {
        if (!runId || collapsed) return;
        const t = setInterval(() => { if (!document.hidden) load(); }, POLL_MS);
        return () => clearInterval(t);
    }, [runId, collapsed, load]);

    /** Write a patch to `extra.guided_run` and keep the local copy in step. */
    const patch = useCallback(async (id, changes) => {
        if (!profile?.id) return;
        const extra = withRunPatch(profile, id, changes);
        setProfile((p) => (p ? { ...p, extra } : p));
        try { await base44.entities.UserProfile.update(profile.id, { extra }); }
        catch { /* the local copy still advances; the next load re-reads truth */ }
    }, [profile]);

    // ── Settle: start the run, pay finished steps, close it when it is done ──
    useEffect(() => {
        if (quiet || !profile || !data || settling.current) return;
        const chosen = chooseRun(profile, { premium });
        if (!chosen) return;
        const rec = runRecord(profile, chosen);
        const prog = runProgress(chosen, data, rec);

        settling.current = true;
        (async () => {
            try {
                // First sighting. Two things happen once, here, and never again
                // for this run: whatever was ALREADY done gets recorded as
                // pre-existing so it is ticked but not paid for, and a run with
                // nothing left to ask for is closed rather than opened.
                if (rec.status === "unstarted") {
                    await patch(chosen, prog.complete
                        ? { status: "done", completed_at: new Date().toISOString() }
                        : {
                            status: "active",
                            started_at: new Date().toISOString(),
                            preexisting: preexistingSteps(chosen, data),
                        });
                    // The next pass reads the record back with `preexisting` on
                    // it. Paying in the same tick would use the empty one.
                    return;
                }

                // Pay for what has evidence behind it and was earned inside the
                // run. The server re-checks the same evidence AND the same
                // pre-existing list, and is idempotent per event_key, so a
                // double call here costs a request and nothing else.
                const owed = unpaidSteps(chosen, data, rec).filter((s) => !paid.current.has(s.id));
                const settled = [];
                for (const step of owed) {
                    paid.current.add(step.id);
                    try {
                        const res = await awardXP({
                            source: "guided_run",
                            step_id: step.id,
                            event_key: eventKeyFor(step.id),
                        });
                        const body = res?.data ?? res;
                        // `pending` means the row had not landed server-side yet.
                        // Let the next poll try again rather than banking it.
                        if (body?.pending) { paid.current.delete(step.id); continue; }
                        fireXPFeedback(body, "guided_run");
                        settled.push(step.id);
                        setCelebrating({ id: step.id, label: step.label, xp: xpFor(step.id) });
                    } catch {
                        paid.current.delete(step.id);
                    }
                }
                if (settled.length) await patch(chosen, { paid: [...rec.paid, ...settled] });

                if (prog.complete && rec.status !== "done") {
                    setFinishedRun(chosen);
                    await patch(chosen, { status: "done", completed_at: new Date().toISOString() });
                }
            } finally {
                settling.current = false;
            }
        })();
    }, [quiet, profile, data, premium, patch]);

    useEffect(() => {
        if (!celebrating) return;
        const t = setTimeout(() => setCelebrating(null), CELEBRATE_MS);
        return () => clearTimeout(t);
    }, [celebrating]);

    const step = progress?.active;
    const onStepPage = step && page === step.page;

    // Layout stands the other Ace surfaces down while this is up — they share
    // the corner, and two of him talking at once is worse than either alone.
    const live = !!(runId && step) || !!finishedRun;
    useEffect(() => { onLiveChange?.(live); }, [live, onLiveChange]);

    const stop = useCallback(() => {
        if (runId) patch(runId, { status: "skipped" });
    }, [runId, patch]);

    // ── The finished card, shown once, then it hands over ───────────────────
    if (finishedRun) {
        return (
            <Shell onClose={() => setFinishedRun(null)}>
                <div className="flex items-start gap-2.5">
                    <SpadeMark className="w-9 h-9 flex-shrink-0" mood="pleased" />
                    <div className="min-w-0 flex-1">
                        <p className="stat-label text-primary">All three, done</p>
                        <p className="font-display font-extrabold text-foreground leading-tight">
                            That is the whole loop
                        </p>
                    </div>
                    <CloseButton onClick={() => setFinishedRun(null)} />
                </div>
                <p className="text-sm text-foreground leading-snug mt-2.5">
                    {finishedRun === "premium"
                        ? "You have used the three tools that do the most work. The rest of the chat is the same idea with different specialists."
                        : "Subjects in, a quiz sat, a recall pass run. Everything else in here is a variation on those three."}
                </p>
                <div className="flex items-center gap-2 mt-3.5">
                    <button onClick={() => setFinishedRun(null)}
                        className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
                        Close
                    </button>
                    <button
                        onClick={() => { setFinishedRun(null); navigate("/Explore"); }}
                        className="ml-auto inline-flex items-center gap-1 rounded-xl bg-primary text-primary-foreground px-3 py-1.5 text-xs font-bold hover:bg-primary/90 transition-colors">
                        <Compass className="w-3 h-3" /> See what else is here
                    </button>
                </div>
            </Shell>
        );
    }

    if (!runId || !progress || !step) return null;

    // ── Folded away ─────────────────────────────────────────────────────────
    if (collapsed) {
        return (
            <button
                onClick={() => setCollapsed(false)}
                aria-label={`Getting started — ${progress.doneCount} of ${progress.total} done`}
                className="fixed right-3 bottom-40 sm:right-6 sm:bottom-[5.5rem] z-30
                    inline-flex items-center gap-2 rounded-full bg-surface border-2 border-border
                    shadow-soft-lg pl-2.5 pr-3.5 py-2 hover:border-primary/50 transition-colors">
                <SpadeMark className="w-5 h-5" mood="pleased" />
                <span className="text-xs font-bold text-foreground tabular-nums">
                    {progress.doneCount}/{progress.total}
                </span>
                <Dots progress={progress} />
            </button>
        );
    }

    return (
        <>
            {/* He walks over to the thing, but only once they are on its page —
                a mascot pointing at a button that is on another route is just a
                mascot standing in a corner. AceRoam handles the target having
                gone by staying put, so a page mid-render never strands him. */}
            {onStepPage && !celebrating && <AceRoam target={step.target} pose="point" />}

            <Shell onClose={() => setCollapsed(true)}>
                <AnimatePresence mode="wait">
                    {celebrating ? (
                        <motion.div key="done"
                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                            <div className="flex items-start gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                                    <Check className="w-5 h-5 text-primary" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="stat-label text-primary">Done</p>
                                    <p className="font-display font-extrabold text-foreground leading-tight">
                                        {celebrating.label}
                                    </p>
                                </div>
                                <span className="pill bg-xp/10 text-xp text-[10px] font-black flex-shrink-0">
                                    +{celebrating.xp} XP
                                </span>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div key={step.id}
                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                            <div className="flex items-start gap-2.5">
                                <SpadeMark className="w-9 h-9 flex-shrink-0" mood="pleased" />
                                <div className="min-w-0 flex-1">
                                    {/* Just the label. The header also carries
                                        the XP pill and the close button inside
                                        340px, and an uppercase eyebrow with a
                                        counter on it truncated to "GETTING
                                        STARTED ·…" — which loses the one number
                                        it was there to show. The count lives on
                                        the progress strip instead, next to the
                                        segments that already draw it. */}
                                    <p className="stat-label truncate">
                                        {runId === "premium" ? "Just unlocked" : "Getting started"}
                                    </p>
                                    <p className="font-display font-extrabold text-foreground leading-tight">
                                        {step.label}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <span className="pill bg-xp/10 text-xp text-[10px] font-black whitespace-nowrap">
                                        +{xpFor(step.id)} XP
                                    </span>
                                    <CloseButton onClick={() => setCollapsed(true)} label="Fold away" />
                                </div>
                            </div>

                            <div className="flex items-center gap-2.5 mt-2.5">
                                <Dots progress={progress} className="flex-1" />
                                {/* The step they are ON, not a fraction —
                                    "3/3" beside two filled segments reads as
                                    finished, and the segments are the ones
                                    telling the truth. */}
                                <span className="text-[10px] font-black text-muted-foreground tabular-nums
                                    uppercase tracking-wider whitespace-nowrap">
                                    Step {progress.activeIndex + 1}
                                </span>
                            </div>

                            <p className="text-sm text-foreground leading-snug mt-2.5">{step.ask}</p>
                            <p className="text-xs text-muted-foreground leading-snug mt-1.5">{step.why}</p>

                            {onStepPage && (
                                <p className="text-xs text-foreground leading-snug mt-2.5 rounded-xl
                                    bg-primary/5 border border-primary/20 px-2.5 py-2">
                                    <Sparkles className="w-3 h-3 text-primary inline mr-1 -mt-0.5" />
                                    {step.here}
                                </p>
                            )}

                            <div className="flex items-center gap-3 mt-3.5">
                                <button onClick={stop}
                                    className="text-xs font-bold text-muted-foreground hover:text-foreground
                                        transition-colors whitespace-nowrap">
                                    Skip the walkthrough
                                </button>
                                {onStepPage ? (
                                    // They are already standing on it, so there
                                    // is nowhere to send them — the useful
                                    // second action is getting out of the way.
                                    <button onClick={() => setCollapsed(true)}
                                        className="ml-auto inline-flex items-center gap-1 rounded-xl
                                            border-2 border-border px-3 py-1.5 text-xs font-bold
                                            text-foreground hover:border-primary/50 transition-colors
                                            whitespace-nowrap">
                                        Let me try it
                                    </button>
                                ) : (
                                    <button onClick={() => navigate(step.to)}
                                        className="ml-auto inline-flex items-center gap-1 rounded-xl bg-primary
                                            text-primary-foreground px-3 py-1.5 text-xs font-bold
                                            hover:bg-primary/90 transition-colors whitespace-nowrap">
                                        Take me there <ArrowRight className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Shell>
        </>
    );
}

/**
 * The card. Right column on desktop, stacked above the companion launcher
 * rather than beside it — at phone width this is full-bleed, so "the opposite
 * corner" stops meaning anything and it has to clear the launcher vertically.
 * Same geometry AceIntro uses, because they are the same shape of thing.
 */
function Shell({ children, onClose }) {
    return (
        <motion.aside
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            data-guided-run
            role="note" aria-label="Getting started with AcedIt"
            onKeyDown={(e) => { if (e.key === "Escape") onClose?.(); }}
            className="fixed left-3 right-3 bottom-40 sm:left-auto sm:right-6 sm:bottom-[5.5rem]
                sm:w-[340px] z-30 rounded-2xl bg-surface border-2 border-primary/30
                shadow-soft-lg p-4">
            {children}
        </motion.aside>
    );
}

function CloseButton({ onClick, label = "Dismiss" }) {
    return (
        <button onClick={onClick} aria-label={label}
            className="text-muted-foreground hover:text-foreground p-1 -m-1 rounded-lg flex-shrink-0">
            <X className="w-4 h-4" />
        </button>
    );
}

/** One segment per step, filled once there is a row behind it. */
function Dots({ progress, className = "" }) {
    return (
        <div className={`flex items-center gap-1.5 ${className}`}>
            {progress.steps.map((s) => (
                <span key={s.id}
                    className={`h-1.5 flex-1 min-w-[14px] rounded-full ${s.done ? "bg-primary" : "bg-foreground/15"}`}
                    aria-hidden="true" />
            ))}
        </div>
    );
}
