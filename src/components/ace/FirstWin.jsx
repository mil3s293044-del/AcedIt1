/**
 * FirstWin — the first session, on screen.
 *
 * A student picks a subject, says what is going wrong with it, and the app
 * builds them three real exam questions, marks their answers and shows what
 * that did. `@/lib/firstWin` owns the beats, the copy and every rule about who
 * sees it; this file conducts.
 *
 * ─── It hands off rather than reimplementing ────────────────────────────────
 * The sitting and the marking happen in the REAL QuizPlayer, reached by the
 * real route (`/Quizzes?play=<id>`). That is the whole design: the marking
 * panel already itemises criteria and already carries the "save to your
 * mistake bank" button, so the two least discoverable things in this app get
 * taught by being USED. A bespoke three-question player would be a second copy
 * of the surface quizScore.js has had to fix four times.
 *
 * So this component's state has to survive a navigation, which is why the beat
 * is written to the profile before leaving rather than held in memory.
 *
 * ─── The generate needs no upload, and that is deliberate ───────────────────
 * The main quiz generator requires a file — reasonable on the Quizzes page,
 * impossible on minute one, when a student has uploaded nothing. So the
 * questions come from the subject's VCAA examiner prompt instead: the same
 * move blurting makes when it marks against the Study Design with no notes.
 * `getExaminerPrompt` is the shared source, so these questions are written to
 * the same standard as every other question in the app.
 *
 * ─── He ACTS each beat out, and then he relaxes ─────────────────────────────
 * `POSE` gives every beat its own arrival gesture and the resting pose he
 * settles into afterwards. The settle is the load-bearing half: AceBody fires
 * its idles only from resting poses, so the old single held `point` meant he
 * froze mid-gesture for as long as the student took to read — which on the
 * first beat is the longest he is ever on screen. He waves them in, thinks
 * about the problem, points at the button, and between beats he is simply
 * standing there being a character.
 *
 * ─── He is drawn the way he is drawn everywhere else ────────────────────────
 * AceWalker + AceBubble, in AceBuddy's corner, never a modal with a backdrop.
 * AceTour's header argues this at length and it applies harder here: a modal
 * on somebody's first screen teaches them that the correct response to this
 * app talking to them is to close it, after which none of the good guidance
 * already in the product gets read either.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AceWalker, { AceBubble } from "@/components/ace/AceWalker";
import AceShuffle from "@/components/ace/AceShuffle";
import { createPageUrl } from "@/utils";
import { getExaminerPrompt } from "@/lib/subjectExaminerPrompts";
import { STIMULUS_RULE, STIMULUS_SCHEMA } from "@/lib/quizSchema";
import { canAfford } from "@/lib/chips";
import {
    PROBLEMS, QUESTION_COUNT, GENERATE_FEATURE, GENERATE_PRICE,
    problemById, firstWinState, firstWinStatus, withFirstWinPatch,
    subjectChoices, closingFacts, droppedFrom, replayPatch,
} from "@/lib/firstWin";
import { RUN, TOUR, requestAce, onAceRequest, takeAceRequest } from "@/lib/aceReplay";

/**
 * Pages where he holds his tongue. Same list and same reason as AceTour: the
 * wizard sends premium-intent signups straight to /Subscription, so without
 * this a brand-new premium account meets a tutorial on top of a checkout.
 * The run is only PAUSED here — it keeps its place.
 */
/**
 * Per beat: what he does on arrival, then what he settles into.
 *
 * The last entry is HELD, so it has to be one of AceBody's resting poses or
 * his fidgets never fire. Reading a beat takes far longer than playing one.
 */
const POSE = {
    subject: ["wave", "happy"],     // hello, and here is the offer
    problem: ["think", "stand"],    // he is asking, so he is thinking
    build:   ["point", "stand"],    // at the button that does it
    quiz:    ["alert", "offer"],    // still going? — then holding it out
    close:   ["cheer", "proud", "happy"],
    /* Not a beat. He asked for a replay and there is nothing to build on. */
    blocked: ["think", "offer"],
};
/** While the questions are being written. Not a rest: he is working. */
const POSE_BUSY = "think";

const QUIET_PAGES = new Set([
    "Onboarding", "Landing", "Login", "ForgotPassword", "ResetPassword", "Suspended",
    "Checkout", "PaymentSuccess", "PaymentCancel", "Paywall", "Premium", "Subscription",
]);

/** While they are sitting it, he gets out of the way entirely. */
const HANDED_OFF = new Set(["Quizzes"]);

export default function FirstWin({ page, userProfile, onLiveChange, onFinished }) {
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [subjects, setSubjects] = useState([]);
    const [state, setState] = useState(null);
    const [live, setLive] = useState(false);
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(null);
    const [facts, setFacts] = useState(null);
    const [blocked, setBlocked] = useState(false);
    const started = useRef(false);

    // Layout owns the profile fetch. This keeps its own copy because it writes
    // to `extra`, and re-seeds only when a genuinely different profile lands.
    useEffect(() => {
        if (userProfile?.id && userProfile.id !== profile?.id) setProfile(userProfile);
    }, [userProfile, profile?.id]);

    /** Patch `extra.first_win`, locally first so the UI never waits on the network. */
    const patch = useCallback(async (changes) => {
        if (!profile?.id) return;
        const extra = withFirstWinPatch(profile, changes);
        setProfile((p) => (p ? { ...p, extra } : p));
        setState((s) => ({ ...(s || {}), ...changes }));
        try { await base44.entities.UserProfile.update(profile.id, { extra }); }
        catch { /* the run still works; the next login re-reads whatever stuck */ }
    }, [profile]);

    /**
     * Load their subjects and go live.
     *
     * `replay` is the difference between an offer and a request, and the only
     * place it changes anything is the no-subjects branch — see below. It also
     * starts from scratch, because the subject and the quiz on a finished run
     * are last time's.
     */
    const open = useCallback(async ({ replay = false } = {}) => {
        if (!profile) return;
        const rows = await base44.entities.UserSubject
            .filter({ created_by: profile.created_by }).catch(() => []);
        const picks = subjectChoices(rows);

        // NO SUBJECTS, NO FIRST WIN. Inventing one to demo on would make the
        // quiz fake, and the entire premise is that what this produces is real
        // and stays.
        //
        // How it stands down depends on WHO ASKED. Nobody asked for the
        // automatic one, so it writes `skipped` and hands them to the tour
        // without ever appearing. A replay was a button somebody pressed, and
        // a button that does nothing visible is the worst thing on this list —
        // so it says what is missing and points at the page that fixes it.
        if (!picks.length) {
            if (!replay) { await patch({ status: "skipped" }); onFinished?.("skipped"); return; }
            setBlocked(true);
            setLive(true);
            return;
        }

        setBlocked(false);
        setSubjects(picks);
        if (replay) {
            setFacts(null);
            setFailed(null);
            const fresh = replayPatch();
            setState({ ...firstWinState(profile), ...fresh });
            setLive(true);
            await patch(fresh);
            return;
        }
        setState(firstWinState(profile));
        setLive(true);
        if (firstWinStatus(profile) === "start") {
            await patch({ status: "active", beat: "subject", started_at: new Date().toISOString() });
        }
    }, [profile, patch, onFinished]);

    // Open it, or pick it back up. Guarded by a ref rather than by state so a
    // re-render mid-write cannot start it twice.
    useEffect(() => {
        if (!profile || started.current) return;
        if (!firstWinStatus(profile)) return;
        started.current = true;
        open();
    }, [profile, open]);

    /**
     * Somebody pressed "start it" — on the dashboard card or on Help.
     *
     * The request is claimed on mount as well as listened for, because the
     * button and this component are the same React tree and the event can
     * arrive in either order. `started.current` is set so the automatic effect
     * above cannot then fire a second opening over the top of this one.
     */
    useEffect(() => {
        if (!profile) return undefined;
        const go = () => { started.current = true; open({ replay: true }); };
        if (takeAceRequest(RUN)) go();
        return onAceRequest(RUN, go);
    }, [profile, open]);

    /**
     * TWO DIFFERENT QUESTIONS, and answering Layout with the wrong one put
     * three Aces on the screen at once.
     *
     * `showing` is whether the BUBBLE draws here. `running` is whether a run
     * is in progress at all — which stays true while it is handed off to the
     * quiz player, because the student is in the middle of it.
     *
     * Layout suppresses AceIntro and AceBuddy, and holds the tour, on what it
     * is told here. Told `showing`, it un-suppressed both the moment the run
     * handed over: so on the single most important screen of the first session
     * — sitting the three questions it just built — the student got the
     * study-intent modal AND AceBuddy's bubble AND a second Ace drawn in the
     * corner, over the top of the quiz. That is the exact "two of him talking
     * over each other" this run is sequenced to prevent, reached from the one
     * direction nothing was watching.
     *
     * QUIET_PAGES stays out of `running`: the payment flow is where every one
     * of these stands down on its own, and the run is paused rather than
     * in progress there.
     */
    const showing = live && !QUIET_PAGES.has(page) && !HANDED_OFF.has(page);
    const running = live && !QUIET_PAGES.has(page);
    useEffect(() => { onLiveChange?.(running); }, [running, onLiveChange]);

    /**
     * `onFinished` is not decoration. This component patches its OWN copy of
     * the profile, so Layout's copy still reads "unstarted" for the rest of
     * the session — and Layout is what decides whether the tour may start. Without
     * telling it, the close button's "Show me around" would hand over to
     * nothing until the next reload.
     */
    const finish = useCallback((status, { toTour = false } = {}) => {
        setLive(false);
        setBlocked(false);
        patch({ status, finished_at: new Date().toISOString() });
        onFinished?.(status);
        // "Show me around" REQUESTS the tour rather than relying on it being
        // eligible. On a replay months later it is not — tourStatus reads the
        // profile's age — so without this the one button on the close would
        // hand over to nothing. The request is sticky, which is what makes it
        // survive AceTour being unmounted for as long as this is live.
        if (toTour) requestAce(TOUR);
    }, [patch, onFinished]);

    /**
     * Coming back from the player. The beat is still "quiz", so look for the
     * attempt they just sat and close on what it actually says. With no
     * attempt they left without finishing — the run simply waits rather than
     * congratulating them on work they did not do.
     */
    useEffect(() => {
        if (!live || state?.beat !== "quiz" || !state?.quiz_id || HANDED_OFF.has(page)) return;
        let cancelled = false;
        (async () => {
            const attempts = await base44.entities.QuizAttempt
                .filter({ quiz_id: state.quiz_id }).catch(() => []);
            if (cancelled || !attempts?.length) return;
            const latest = [...attempts].sort((a, b) =>
                new Date(b.created_date || 0) - new Date(a.created_date || 0))[0];
            setFacts(closingFacts({
                score: latest.score,
                xp: latest.xp_earned,
                dropped: droppedFrom(latest),
            }));
            patch({ beat: "close" });
        })();
        return () => { cancelled = true; };
    }, [live, state?.beat, state?.quiz_id, page, patch]);

    /**
     * Build the quiz. The price was on screen before the button, which is the
     * rule megaUpload keeps and the reason `canAfford` is checked here rather
     * than after the spend.
     */
    const build = useCallback(async () => {
        const subject = state?.subject;
        const problem = problemById(state?.problem);
        if (!subject || busy) return;
        setBusy(true);
        setFailed(null);
        try {
            const afford = canAfford(profile, GENERATE_FEATURE);
            if (!afford.ok) { setFailed("chips"); return; }

            const response = await base44.integrations.Core.InvokeLLM({
                feature: GENERATE_FEATURE,
                prompt: `${getExaminerPrompt(subject)}

Write EXACTLY ${QUESTION_COUNT} VCE ${subject} questions for a student who says: "${problem?.label || "I want to test myself"}".

This is the first thing they have ever done in this app, so it has to be winnable and it has to be real:
- Question 1 is short and answerable from core knowledge — they must not bounce off the first thing they see.
- Question 2 applies it.
- Question 3 stretches, worth more marks.
- Cover the Study Design's core material for this subject. NEVER invent a course.
- Mark allocations match the work: 1-2 to state or identify, 3-5 to explain or justify.
- Give every question a model answer detailed enough to mark against.

${STIMULUS_RULE}`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        questions: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    type: { type: "string" },
                                    question: { type: "string" },
                                    stimulus: STIMULUS_SCHEMA,
                                    model_answer: { type: "string" },
                                    marks: { type: "number" },
                                },
                                required: ["question", "model_answer"],
                            },
                        },
                    },
                    required: ["questions"],
                },
            });

            const questions = (response?.questions || [])
                .filter((q) => q?.question && q?.model_answer)
                .slice(0, QUESTION_COUNT)
                .map((q) => ({
                    type: "short_answer",
                    question: q.question,
                    ...(q.stimulus ? { stimulus: q.stimulus } : {}),
                    model_answer: q.model_answer,
                    marks: Math.max(1, Number(q.marks) || 3),
                }));
            // NOTHING TO SIT IS NOT A QUIZ. An empty shell would send them into
            // the player to look at a blank page, which is a worse first
            // impression than saying the build did not work.
            if (!questions.length) { setFailed("build"); return; }

            const quiz = await base44.entities.Quiz.create({
                title: `${subject} — your first three`,
                subject,
                questions,
                difficulty: "Medium",
                category: "subject_content",
            });
            if (!quiz?.id) { setFailed("build"); return; }
            await patch({ beat: "quiz", quiz_id: quiz.id });
            navigate(`${createPageUrl("Quizzes")}?play=${quiz.id}`);
        } catch {
            setFailed("build");
        } finally {
            setBusy(false);
        }
    }, [state, busy, profile, patch, navigate]);

    const afford = useMemo(
        () => (profile ? canAfford(profile, GENERATE_FEATURE) : null), [profile]);

    // `blocked` has no stored state behind it — it is a replay that found
    // nothing to build on, which is a thing to SAY rather than a beat to save.
    if (!showing || (!state && !blocked)) return null;
    const beat = state?.beat;
    const problem = problemById(state?.problem);

    return (
        <motion.aside
            data-first-win={beat}
            role="status" aria-label="Your first session"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}
            /* His lane: the same geometry as AceBuddy and AceTour, because they
               are the same character standing in the same place. */
            className="fixed z-40 right-3 sm:right-6 max-w-[calc(100vw-1.5rem)]
                bottom-[9.5rem] sm:bottom-[5.5rem] pointer-events-none"
        >
            {/* `trip` is the BEAT and not the busy flag: he is already standing
                there when the build starts, and bumping it would send him back
                off the edge to walk in again. Only the pose changes. */}
            <AceWalker trip={blocked ? "blocked" : beat}
                pose={blocked ? POSE.blocked : (busy ? POSE_BUSY : (POSE[beat] || "stand"))}
                size="w-20 sm:w-24" className="justify-end">
                <AceBubble className="pointer-events-auto w-[min(21rem,calc(100vw-8.5rem))]">
                    <AnimatePresence mode="wait">
                        <motion.div key={blocked ? "blocked" : beat}
                            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}>

                            <div className="flex items-start gap-2.5">
                                <div className="min-w-0 flex-1">
                                    <p className="stat-label truncate">
                                        {blocked ? "One thing first"
                                            : beat === "close" ? "That is a real result"
                                            : "Let's do one real thing"}
                                    </p>
                                    <p className="font-display font-extrabold text-foreground leading-tight">
                                        {blocked && "Add a subject first"}
                                        {!blocked && beat === "subject" && "Which subject?"}
                                        {!blocked && beat === "problem" && `What is going wrong in ${state.subject}?`}
                                        {!blocked && beat === "build" && "Three questions, then"}
                                        {!blocked && beat === "quiz" && "Still going?"}
                                        {!blocked && beat === "close" && "You are up and running"}
                                    </p>
                                </div>
                                <button onClick={() => finish("skipped")} aria-label="Close"
                                    className="text-muted-foreground hover:text-foreground p-1 -m-1
                                        rounded-lg flex-shrink-0">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* ── A replay with nothing to build on. It SAYS so. ── */}
                            {blocked && (
                                <>
                                    <p className="text-sm text-foreground leading-snug mt-2.5">
                                        The questions come from a subject you actually study, so there is
                                        nothing real for me to build yet. Put your subjects in and I will
                                        be here.
                                    </p>
                                    <div className="flex items-center gap-3 mt-3">
                                        <button onClick={() => finish("skipped")}
                                            className="text-xs font-bold text-muted-foreground
                                                hover:text-foreground transition-colors">
                                            Later
                                        </button>
                                        <button
                                            onClick={() => { setLive(false); setBlocked(false);
                                                navigate(createPageUrl("Subjects")); }}
                                            className="ml-auto inline-flex items-center gap-1 rounded-xl bg-primary
                                                text-primary-foreground px-3 py-1.5 text-xs font-bold
                                                hover:bg-primary/90 transition-colors">
                                            Add subjects <ArrowRight className="w-3 h-3" />
                                        </button>
                                    </div>
                                </>
                            )}

                            {/* ── Pick a subject: their OWN, never a demo one ── */}
                            {!blocked && beat === "subject" && (
                                <>
                                    <p className="text-sm text-foreground leading-snug mt-2.5">
                                        I will build you three real exam questions and mark them. Pick the one
                                        you are most worried about.
                                    </p>
                                    <div className="flex flex-wrap gap-1.5 mt-3">
                                        {subjects.map((s) => (
                                            <button key={s.name}
                                                onClick={() => patch({ subject: s.name, beat: "problem" })}
                                                className="inline-flex items-center gap-1.5 rounded-xl border-2
                                                    border-border px-2.5 py-1.5 text-xs font-bold text-foreground
                                                    hover:border-primary hover:bg-primary/5 transition-colors">
                                                {s.color && (
                                                    <span className="w-2 h-2 rounded-full flex-shrink-0"
                                                        style={{ backgroundColor: s.color }} />
                                                )}
                                                {s.name}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* ── The problem, in their words. The technique is the ANSWER. ── */}
                            {!blocked && beat === "problem" && (
                                <div className="mt-2.5 space-y-1.5">
                                    {PROBLEMS.map((p) => (
                                        <button key={p.id}
                                            onClick={() => patch({ problem: p.id, beat: "build" })}
                                            className="block w-full text-left rounded-xl border-2 border-border
                                                px-3 py-2 text-sm font-bold text-foreground
                                                hover:border-primary hover:bg-primary/5 transition-colors">
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* ── The build. The price is on screen BEFORE the button. ── */}
                            {!blocked && beat === "build" && (
                                <>
                                    {problem && (
                                        <p className="text-sm text-foreground leading-snug mt-2.5">
                                            {problem.answer}
                                        </p>
                                    )}
                                    <p className="text-sm text-foreground leading-snug mt-2">
                                        <span className="font-bold">{problem?.techniqueLabel}</span> is on the
                                        Study page for that. First, let's see where you actually are.
                                    </p>

                                    {failed === "chips" && (
                                        <p className="text-xs text-streak font-bold leading-snug mt-2.5">
                                            You are out of chips for this week, so I cannot build it right now.
                                            Everything else on the site still works.
                                        </p>
                                    )}
                                    {failed === "build" && (
                                        <p className="text-xs text-streak font-bold leading-snug mt-2.5">
                                            That did not come back properly. Worth one more go — or skip and
                                            have a look around instead.
                                        </p>
                                    )}

                                    {/* Chips explained where one is spent, not as a lesson. */}
                                    {!failed && (
                                        <p className="text-[11px] text-muted-foreground leading-snug mt-2.5">
                                            Anything AI costs <span className="font-bold text-foreground">chips</span> from
                                            a weekly allowance — this one is {GENERATE_PRICE}
                                            {afford?.remaining != null && <> of your {afford.remaining}</>}.
                                        </p>
                                    )}

                                    <div className="flex items-center gap-3 mt-3">
                                        <button onClick={() => finish("skipped")}
                                            className="text-xs font-bold text-muted-foreground
                                                hover:text-foreground transition-colors whitespace-nowrap">
                                            Not now
                                        </button>
                                        <button onClick={build} disabled={busy}
                                            className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-primary
                                                text-primary-foreground px-3 py-1.5 text-xs font-bold
                                                hover:bg-primary/90 disabled:opacity-60 transition-colors
                                                whitespace-nowrap">
                                            {busy
                                                ? <><AceShuffle size="sm" /> Writing them…</>
                                                : <><Sparkles className="w-3 h-3" /> {failed ? "Try again" : "Build them"}</>}
                                        </button>
                                    </div>
                                </>
                            )}

                            {/* ── They wandered off mid-quiz. Wait; do not congratulate. ── */}
                            {!blocked && beat === "quiz" && (
                                <>
                                    <p className="text-sm text-foreground leading-snug mt-2.5">
                                        Your {state.subject} questions are waiting — finish them and I will show
                                        you what they said.
                                    </p>
                                    <div className="flex items-center gap-3 mt-3">
                                        <button onClick={() => finish("skipped")}
                                            className="text-xs font-bold text-muted-foreground
                                                hover:text-foreground transition-colors">
                                            Leave it
                                        </button>
                                        <button
                                            onClick={() => navigate(`${createPageUrl("Quizzes")}?play=${state.quiz_id}`)}
                                            className="ml-auto inline-flex items-center gap-1 rounded-xl bg-primary
                                                text-primary-foreground px-3 py-1.5 text-xs font-bold
                                                hover:bg-primary/90 transition-colors">
                                            Back to it <ArrowRight className="w-3 h-3" />
                                        </button>
                                    </div>
                                </>
                            )}

                            {/* ── The close: only what actually happened. ── */}
                            {!blocked && beat === "close" && facts && (
                                <>
                                    <p className="text-sm text-foreground leading-snug mt-2.5">
                                        {facts.score !== null
                                            ? <>You scored <span className="font-bold">{facts.score}%</span> on that
                                                {facts.xp !== null && <> and earned {facts.xp} XP</>}. That quiz and
                                                your answers are yours now — they are in your library.</>
                                            : <>That is sat and saved. The quiz and your answers are in your library.</>}
                                    </p>

                                    {facts.showMistakeBank && (
                                        <p className="text-sm text-foreground leading-snug mt-2">
                                            You dropped a mark or two. Every one you save from a marked answer goes
                                            to your <span className="font-bold">Mistake Bank</span>, which drills it
                                            until you can produce it — then asks you to prove it on the real question
                                            again.
                                        </p>
                                    )}

                                    <p className="text-[11px] text-muted-foreground leading-snug mt-2.5">
                                        {facts.atarLine}
                                    </p>

                                    <div className="flex items-center gap-3 mt-3">
                                        <button onClick={() => finish("done", { toTour: true })}
                                            className="ml-auto inline-flex items-center gap-1 rounded-xl bg-primary
                                                text-primary-foreground px-3 py-1.5 text-xs font-bold
                                                hover:bg-primary/90 transition-colors">
                                            Show me around <ArrowRight className="w-3 h-3" />
                                        </button>
                                    </div>
                                </>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </AceBubble>
            </AceWalker>
        </motion.aside>
    );
}
