// ════════════════════════════════════════════════════════════════════════════
// Pre-signup onboarding — a deal, hosted.
//
//   Year → Birthday → Subjects → Target → Build → Reveal → Sign in
//
// Flow: Landing → /onboarding (this) → Google OAuth / email → Dashboard.
//
// A SPLIT STAGE. On a desktop the questions sit on the app's own ground and a
// dark felt table sits beside them; every answer leaves the question as a card
// and lands on the table, so what the student is building is the biggest thing
// on the screen rather than a strip along the bottom of it. Ace stands on the
// table and says one line per screen — a REACTION to the last answer, never a
// compliment (`aceLines`). On a phone there is no beside: Ace is a row over the
// question, the hand is a rail under the button, and the build and the reveal
// put the felt in the content.
//
// ONE DECISION PER SCREEN. Seven short screens beat five long ones: the old
// year screen grew a birthday form under the cards once one was picked, the
// subjects screen held a scroll box with its payout below it, and the target's
// course fields sat where nobody scrolled. See steps.jsx.
//
// ONE COUNT. The header's pips are the only progress indicator. The flow once
// carried three — a 1/6 badge, a "Step 2 of 6" eyebrow and the pips — and they
// disagreed whenever a step was added. `onboardingFlow.test.mjs` refuses an
// eyebrow that counts.
//
// THE BRAIN LEFT THE FUNNEL, and the build replaced it: four seconds of lines
// the app genuinely computed from the answers (weeks left, their subjects'
// scaling, their first review dates off the real scheduler, their target band),
// skippable, and claiming no work that is not happening.
//
// THE BUTTON IS NEVER UNDER ANYTHING. Actions live in a bar pinned to the
// bottom of the question column, offset by `--consent-h`, which the consent
// banner publishes — the banner used to sit on top of the primary button for
// every first-time visitor, on the one screen where that costs a signup.
//
// Answers are saved to localStorage on every change (`acedit_onboarding_v1`).
// After sign-in, AuthContext reads them back and writes the profile and
// subjects (see authPostSignupApply). The answer SHAPE is that contract and is
// unchanged by this file.
// ════════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { VCE_SUBJECTS } from "@/data/vceSubjects";
import { ageAnswerReady, ageAnswerHint } from "@/components/legal/AgeAnswer";
import { supabase } from "@/api/supabaseClient";
import BrandMark from "@/components/shared/BrandMark";
import AceShuffle from "@/components/ace/AceShuffle";
import HandOfAnswers from "@/components/onboarding/wizard/HandOfAnswers";
import CostGap from "@/components/onboarding/wizard/CostGap";
import Table, { FeltScaling } from "@/components/onboarding/Table";
import AceHost from "@/components/onboarding/AceHost";
import { FlightProvider } from "@/components/onboarding/DealFlight";
import { ActionsSlot } from "@/components/onboarding/Shell";
import {
    StepYear, StepBirthday, StepSubjects, StepTarget, StepBuild, StepReveal, DEFAULT_TARGET,
} from "@/components/onboarding/steps";
import { StepSignin, StepSaveExisting } from "@/components/onboarding/StepSignin";
import { stepsFor, prevStep, STEP_NAME, aceLines } from "@/lib/onboardingFlow";

const STORAGE_KEY = "acedit_onboarding_v1";

// ─── Wizard state ────────────────────────────────────────────────────────────
const DEFAULT_ANSWERS = {
    yearLevel:       null,
    // The birthday and the guardian tick ride with the other answers, so a
    // refresh mid-wizard keeps them like everything else.
    dob:             "",
    guardian:        false,
    subjects:        [],         // [{ name, code, id, is_custom }]
    goalAtar:        null,
    goalCourseName:  "",
    goalUniversity:  "",
    intent:          null,       // "premium" | "free" — set on the sign-in step
    completedAt:     null,
    email:           null,       // email+password path only — the AuthContext
                                 // email-match guard, so the storage window
                                 // cannot leak to another user on a shared
                                 // browser.
};

function loadAnswers() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...DEFAULT_ANSWERS };
        return { ...DEFAULT_ANSWERS, ...JSON.parse(raw) };
    } catch {
        return { ...DEFAULT_ANSWERS };
    }
}

function saveAnswers(answers) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(answers)); }
    catch { /* localStorage full or disabled — silent */ }
}

/**
 * The split is a LAYOUT decision, not a style: exactly one place may carry
 * the deal slots (the table, or the rail), because a card flight lands on
 * whichever slot is visible and two would race. So it is read, not CSS-hidden.
 */
const DESKTOP = "(min-width: 1024px)";
function useIsDesktop() {
    const get = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(DESKTOP).matches : false);
    const [on, setOn] = useState(get);
    useEffect(() => {
        if (!window.matchMedia) return undefined;
        const mq = window.matchMedia(DESKTOP);
        const onChange = () => setOn(mq.matches);
        mq.addEventListener?.("change", onChange);
        return () => mq.removeEventListener?.("change", onChange);
    }, []);
    return on;
}

/** The pinned bar's height, watched — it changes per step and the rail grows. */
function useHeight(node) {
    const [h, setH] = useState(140);
    useEffect(() => {
        if (!node) return undefined;
        const ro = new ResizeObserver(([e]) => setH(Math.ceil(e.contentRect.height)));
        ro.observe(node);
        return () => ro.disconnect();
    }, [node]);
    return h;
}

/** What Ace is doing on each screen, between the tosses a landed card sets off. */
const POSE = {
    year: "offer", birthday: "think", subjects: "point", target: "ponder",
    build: "shuffle", reveal: "proud", signin: "wave",
};

/** Which way the table is laid out on each screen. */
const TABLE_MODE = { build: "deck", reveal: "reveal", signin: "reveal" };

/**
 * One pip per screen, the current one stretched. The pips ARE the count —
 * there is no "3/7" beside them, because a second count is a second thing to
 * disagree.
 */
function Pips({ steps, index }) {
    const reduce = useReducedMotion();
    return (
        <div className="flex items-center gap-1.5" role="progressbar"
            aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={index + 1}
            aria-valuetext={STEP_NAME[steps[index]]}>
            {steps.map((s, i) => (
                <motion.span key={s} aria-hidden="true" layout={!reduce}
                    className={`h-2 rounded-full ${i < index ? "bg-primary" : i === index ? "bg-primary" : "bg-border"}`}
                    animate={{ width: i === index ? 28 : 8, opacity: i < index ? 0.55 : 1 }}
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 30 }} />
            ))}
        </div>
    );
}

// ─── Page ────────────────────────────────────────────────────────────────────
// `existingUser`: a retake from Settings → Study setup. Two things change —
// where the starting answers come from, and what the last screen does with
// them — and the build is skipped, because it is theatre for a first deal.
export default function Onboarding({ existingUser = false }) {
    const steps = useMemo(() => stepsFor({ existingUser }), [existingUser]);
    const [index, setIndex] = useState(0);
    const [answers, setAnswers] = useState(() => (existingUser ? { ...DEFAULT_ANSWERS } : loadAnswers()));
    const [isPrefilling, setIsPrefilling] = useState(existingUser);
    // Callback-ref state rather than refs: a ref does not re-render when it is
    // populated, so the portal target and the height would both still be their
    // initial values on the paint that matters.
    const [actionsEl, setActionsEl] = useState(null);
    const [barEl, setBarEl] = useState(null);
    const barH = useHeight(barEl);
    const isDesktop = useIsDesktop();
    const reduce = useReducedMotion();
    const navigate = useNavigate();

    const step = steps[index];

    useEffect(() => {
        if (existingUser) return;
        saveAnswers(answers);
    }, [answers, existingUser]);

    // Already signed in? The pre-signup wizard has nothing to offer. A retake
    // reached this on purpose, so a live session there is expected.
    useEffect(() => {
        if (existingUser) return;
        (async () => {
            try {
                const { data } = await supabase.auth.getSession();
                if (data?.session?.user) navigate("/", { replace: true });
            } catch { /* ignore */ }
        })();
    }, [navigate, existingUser]);

    // A retake starts from what is saved, so it reads as "edit your hand"
    // rather than "start over".
    useEffect(() => {
        if (!existingUser) return;
        let cancelled = false;
        (async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                const email = user?.email;
                if (!email) return;
                const [{ data: profile }, { data: subjectRows }] = await Promise.all([
                    supabase.from('user_profiles')
                        .select('goal_atar, goal_course_name, goal_university, extra')
                        .eq('created_by', email)
                        .maybeSingle(),
                    supabase.from('user_subjects')
                        .select('subject_name, subject_code, vce_subject_id')
                        .eq('created_by', email),
                ]);
                if (cancelled) return;
                setAnswers({
                    ...DEFAULT_ANSWERS,
                    yearLevel: profile?.extra?.year_level || null,
                    dob: profile?.extra?.date_of_birth || "",
                    guardian: !!profile?.extra?.guardian_ack,
                    goalAtar: profile?.goal_atar || null,
                    goalCourseName: profile?.goal_course_name || "",
                    goalUniversity: profile?.goal_university || "",
                    subjects: (subjectRows || []).map((r) => ({
                        id: r.vce_subject_id || `existing_${r.subject_code}`,
                        name: r.subject_name,
                        code: r.subject_code,
                        is_custom: !VCE_SUBJECTS.some((c) => c.code === r.subject_code),
                    })),
                });
            } catch (e) {
                console.error('[onboarding:redo] prefill failed:', e);
            } finally {
                if (!cancelled) setIsPrefilling(false);
            }
        })();
        return () => { cancelled = true; };
    }, [existingUser]);

    // A new screen starts at its top. On a phone the subjects list is long, and
    // arriving at the target screen scrolled halfway down it is arriving lost.
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: "instant" });
    }, [index]);

    const update = useCallback((patch) => setAnswers((a) => ({ ...a, ...patch })), []);
    const goNext = useCallback(() => setIndex((i) => Math.min(steps.length - 1, i + 1)), [steps.length]);
    const goBack = useCallback(() => setIndex((i) => prevStep(steps, i)), [steps]);

    if (isPrefilling) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <AceShuffle size="lg" label="Loading your details" />
            </div>
        );
    }

    const ready = ageAnswerReady(answers.dob || "", !!answers.guardian);
    const ace = {
        lines: aceLines(step, answers),
        beat: step,
        pose: POSE[step] || "stand",
    };

    const screen = (() => {
        switch (step) {
            case "year":
                return <StepYear answers={answers} update={update} onNext={goNext} />;
            case "birthday":
                return <StepBirthday answers={answers} update={update} onNext={goNext}
                    ready={ready} hint={ready ? null : ageAnswerHint(answers.dob || "", !!answers.guardian)} />;
            case "subjects":
                return <StepSubjects answers={answers} update={update} onNext={goNext} isDesktop={isDesktop} />;
            case "target":
                return <StepTarget answers={answers} update={update} onNext={goNext} />;
            case "build":
                return <StepBuild answers={answers} onNext={goNext} isDesktop={isDesktop} />;
            case "reveal":
                return <StepReveal answers={answers} onNext={goNext} isDesktop={isDesktop}
                    cta={existingUser ? "Continue" : "Keep this hand"} />;
            case "signin":
                return existingUser
                    ? <StepSaveExisting answers={answers} onSaved={() => navigate("/", { replace: true })} />
                    : <StepSignin answers={answers} update={update} persist={saveAnswers} isDesktop={isDesktop} />;
            default:
                return null;
        }
    })();

    // The table's payout, under the hand: what VTAC does to the line-up while
    // it is being chosen, and the year of tutoring against the year of this at
    // the moment the plan is.
    const tableFooter = (step === "subjects" || step === "target") && answers.subjects.length > 0
        ? <FeltScaling subjects={answers.subjects} />
        : step === "signin" && !existingUser
            ? <CostGap variant="felt" />
            : null;

    // The rail is the phone's table. The build and the reveal draw the felt
    // in the content, so a second copy of the hand under it would be two of
    // the same object on one screen.
    const railVisible = !isDesktop && !["build", "reveal", "signin"].includes(step);

    return (
        <FlightProvider>
        <ActionsSlot.Provider value={actionsEl}>
            <div className="min-h-screen bg-background lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
                {/* ── The question column ─────────────────────────────── */}
                <div className="flex flex-col min-h-screen min-w-0">
                    <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-md">
                        <div className="h-[60px] px-4 sm:px-8 lg:px-12 xl:px-20 flex items-center gap-3">
                            {/* On a desktop the back button hangs in the gutter, so
                                the pips start on the same edge as the question. */}
                            <div className="w-9 flex-shrink-0 lg:w-0 lg:-mr-3 lg:relative lg:self-stretch lg:flex lg:items-center">
                                <AnimatePresence initial={false}>
                                    {index > 0 && step !== "build" && (
                                        <motion.button type="button" onClick={goBack} aria-label="Back"
                                            initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 6 }}
                                            className="w-9 h-9 -ml-2 lg:ml-0 lg:absolute lg:right-2 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                                            <ChevronLeft className="w-5 h-5" />
                                        </motion.button>
                                    )}
                                </AnimatePresence>
                            </div>
                            <div className="flex-1 flex justify-center lg:justify-start">
                                <Pips steps={steps} index={index} />
                            </div>
                            <BrandMark size="sm" showWord={false} className="flex-shrink-0" />
                        </div>
                    </header>

                    <main className="flex-1 flex flex-col lg:justify-center lg:px-12 xl:px-20"
                        style={isDesktop ? undefined : { paddingBottom: `calc(${barH + 12}px + var(--consent-h, 0px))` }}>
                        {!isDesktop && (
                            <div className="px-5 sm:px-8 pt-3">
                                <AceHost variant="row" lines={ace.lines} beat={ace.beat} pose={ace.pose} />
                            </div>
                        )}
                        <AnimatePresence mode="wait" initial={false}>
                            <motion.div key={step}
                                initial={reduce ? { opacity: 0 } : { opacity: 0, x: 28, filter: "blur(6px)" }}
                                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                                exit={reduce ? { opacity: 0 } : { opacity: 0, x: -28, filter: "blur(6px)" }}
                                transition={{ duration: 0.26, ease: [0.2, 0.8, 0.2, 1] }}>
                                {screen}
                            </motion.div>
                        </AnimatePresence>
                    </main>

                    {/* The actions, and on a phone the hand under them. Fixed on
                        a phone, sticky in its column on a desktop — and in both
                        lifted clear of the consent banner. Pointer events are
                        off on the bar and on for the actions, so a card can
                        never eat a tap meant for the button. */}
                    <div ref={setBarEl}
                        className="fixed inset-x-0 lg:sticky z-20 pointer-events-none lg:px-12 xl:px-20"
                        style={{ bottom: "var(--consent-h, 0px)" }}>
                        <span aria-hidden="true" className="block h-6 bg-gradient-to-t from-background to-transparent" />
                        <div className="bg-background pb-3 lg:pb-8">
                            <div className="w-full max-w-xl mx-auto lg:mx-0 px-5 sm:px-8 lg:px-0">
                                <div ref={setActionsEl} className="pointer-events-auto empty:hidden" />
                                <AnimatePresence>
                                    {railVisible && (
                                        <motion.div className="mt-2"
                                            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 30 }} transition={{ duration: 0.3 }}>
                                            <HandOfAnswers answers={answers} />
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── The table ───────────────────────────────────────── */}
                {isDesktop && (
                    <aside className="sticky top-0 h-screen p-4 pl-0">
                        <Table
                            answers={answers}
                            mode={TABLE_MODE[step] || "spread"}
                            ace={ace}
                            footer={tableFooter}
                            previewAtar={step === "target" && answers.goalAtar == null ? DEFAULT_TARGET : null}
                        />
                    </aside>
                )}
            </div>
        </ActionsSlot.Provider>
        </FlightProvider>
    );
}
