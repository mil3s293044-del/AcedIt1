// ════════════════════════════════════════════════════════════════════════════
// The landing page, which is no longer a page. It is the first six acts of a
// film whose last three are the signup wizard.
//
// WHAT THIS REPLACED. Thirteen alternating bands — a subject marquee, a stats
// strip, a hook, an evidence split, a brain, a how-it-works, a feature bento,
// a marking demo, a forgetting curve, a price anchor, pricing, an FAQ and a
// final CTA — each fading up as you scrolled past it, ending in a button that
// called `window.location.assign("/onboarding")`. A brochure and a form,
// joined by a full document reload.
//
// Six of those bands are ACTS now, where the reader DOES the thing rather than
// reading about it: they drag the days and watch their own retention fall, tap
// the phrase that cost a mark, pick a technique and see which regions move,
// drag their own tutoring hours until the gap is a number they specified. Four
// more were restatements of what the acts demonstrate — a demonstration
// followed by a paragraph repeating it is the paragraph admitting the
// demonstration did not land — and they are gone. The rest is the tail:
// pricing, objections, footer, deliberately un-snapped, for the sceptic and
// the crawler.
//
// THE RULES THIS PAGE KEEPS, all of them recorded properly in lib/reel.js:
// every act pays out a real card into a hand that survives the whole film; the
// interaction is never a gate; scroll is the escape hatch and is never
// swallowed; and there is no navigation between the sixth act and the seventh.
//
// THE COLOUR IS AN ARC, not a stripe pattern. Cream, then three deepening
// darks, then back to cream. Day, night, dawn: the problem gets darker as it
// gets more specific (what you lose → what it cost you → what is actually
// happening in there), and the daylight comes back at the point the reader is
// being asked to decide something. The old page alternated light and dark
// every band, which is a rhythm rather than a story and reads as decoration
// once you have seen it twice.
// ════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, Suspense, lazy } from "react";

import { trackStartTrial } from "@/lib/analytics";
import BrandMark from "@/components/shared/BrandMark";
import AceShuffle from "@/components/ace/AceShuffle";
import Reel from "@/components/reel/Reel";
import Act from "@/components/reel/Act";
import { useReel } from "@/components/reel/ReelContext";
import ReelTail from "@/components/reel/ReelTail";
import ActDeal from "@/components/reel/acts/ActDeal";
import ActForget from "@/components/reel/acts/ActForget";
import ActMarking from "@/components/reel/acts/ActMarking";
import ActScience from "@/components/reel/acts/ActScience";
import ActCost from "@/components/reel/acts/ActCost";
import ActHand from "@/components/reel/acts/ActHand";
import { loadAnswers, saveAnswers } from "@/lib/onboardingAnswers";
import { ACTS } from "@/lib/reel";

/**
 * The three question acts, split out of the first bundle.
 *
 * They pull in the Onboarding page (1,300 lines), the VCE catalogue and the
 * auth client, none of which an unauthenticated visitor needs to see act one.
 * WARMED ON MOUNT rather than left to fault in on arrival: the import fires
 * immediately, so by the time anybody has picked a card and dragged two
 * sliders the chunk is long since there, and the Suspense fallback below is a
 * safety net rather than something a student is expected to see.
 */
const StepActs = lazy(() => import("@/components/reel/acts/StepActs"));
const warmStepActs = () => import("@/components/reel/acts/StepActs");

const CREAM = "#FBF7F0";

/* ── The nav ──────────────────────────────────────────────────────────────
 *
 * A FILM DOES NOT HAVE A MENU BAR. The old one carried four section links and
 * two buttons, which is a table of contents for a page this no longer is —
 * "How it works" pointed at a band that is now three acts, and the chapter
 * rail does that job properly.
 *
 * What survives is the three things a nav is actually for: who this is, the
 * way in for somebody who already has an account, and the way STRAIGHT to the
 * questions for a returning visitor who has already seen the film and does not
 * want to watch it again. That last one is not a leak in the funnel; making
 * somebody re-watch it would be.
 */
function ReelNav({ onLogin, onStart }) {
    const { index, ground } = useReel();
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 16);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    // Once the questions have started, the CTA has nothing left to point at —
    // the student is already there, and a "get started" button above a form
    // they are filling in is the page not paying attention.
    const inSteps = index >= ACTS.findIndex((a) => a.kind === "step");

    /**
     * THE NAV IS FIXED, SO IT BELONGS TO NO ACT AND MUST BE TOLD WHICH ONE IT
     * IS OVER. The first version was a cream bar with near-black type,
     * hard-coded, which is correct on the four light acts and rendered as an
     * opaque GREY SLAB with unreadable type over the three dark ones — the
     * same class of bug as `Countdown variant="banner"`, arrived at from the
     * opposite direction. Only a screenshot caught it.
     *
     * The mark's ink is fixed per ground rather than themed: this page paints
     * its own palette and does not follow the OS theme, so `fill-foreground`
     * would come out white on cream for anybody whose system is set to dark.
     */
    const dark = ground === "dark";
    const barTone = !scrolled
        ? "bg-transparent"
        : dark
            ? "bg-[#0B1220]/80 backdrop-blur-md border-b border-white/10"
            : "bg-[#FBF7F0]/80 backdrop-blur-md border-b border-black/5";
    const markInk = dark ? "fill-[#F4F7FB]" : "fill-[#0D1626]";
    const wordInk = dark ? "text-[#F4F7FB]" : "text-[#0D1626]";
    const linkInk = dark
        ? "text-white/65 hover:text-white"
        : "text-[#0D1626]/65 hover:text-[#0D1626]";

    return (
        <nav className={`fixed top-0 inset-x-0 z-[66] transition-colors duration-300 ${barTone}`}>
            <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
                <BrandMark size="md" tone={markInk} wordClassName={`${wordInk} transition-colors duration-300`} />
                <div className="flex items-center gap-4 sm:gap-6">
                    <button
                        onClick={onLogin}
                        className={`text-sm font-bold transition-colors duration-300 cursor-pointer ${linkInk}`}
                    >
                        Login
                    </button>
                    {!inSteps && (
                        <button
                            onClick={onStart}
                            onPointerEnter={warmStepActs}
                            className="bg-primary hover:bg-primary/90 text-white font-black rounded-xl
                                       px-4 sm:px-5 h-10 text-sm shadow-pop border-b-4 border-primary-dark
                                       active:translate-y-0.5 active:border-b-2 transition cursor-pointer"
                        >
                            Start free
                        </button>
                    )}
                </div>
            </div>
        </nav>
    );
}

/** Keeps the act height while the chunk lands, so the snap measurement holds. */
function StepFallback() {
    return (
        <div className="w-full flex items-center justify-center">
            <AceShuffle size="lg" label="Setting up your hand" />
        </div>
    );
}

/**
 * The film's own body, inside the provider so the nav and the acts can steer
 * it. Everything stateful about the WIZARD lives here rather than in the acts,
 * because three of them write to one record.
 */
function Film({ answers, update, onLogin }) {
    const { goTo } = useReel();

    const start = useCallback(() => {
        trackStartTrial();
        warmStepActs();
        goTo("subjects");
    }, [goTo]);

    return (
        <>
            <ReelNav onLogin={onLogin} onStart={start} />

            {/* ── The case ─────────────────────────────────────────────── */}
            <Act id="deal" label="Pick your year" className="bg-[#FBF7F0]">
                <ActDeal onYear={(y) => update({ yearLevel: y })} />
            </Act>

            <Act id="forget" label="What you lose" className="bg-[#0B1220]">
                <ActForget />
            </Act>

            <Act id="marking" label="The marking" className="bg-[#0D1626]">
                <ActMarking />
            </Act>

            <Act id="science" label="Why it works" className="bg-[#070E1A]">
                <ActScience />
            </Act>

            <Act id="cost" label="What it costs" className="bg-[#FBF7F0]">
                <ActCost />
            </Act>

            <Act id="hand" label="Your hand" className="bg-[#FBF7F0]">
                <ActHand onLogin={onLogin} />
            </Act>

            {/* ── The questions. Same film, same table, no navigation. ─── */}
            <Act id="subjects" label="Your subjects" className="bg-[#FBF7F0]">
                <Suspense fallback={<StepFallback />}>
                    <StepActs which="subjects" answers={answers} update={update} />
                </Suspense>
            </Act>

            <Act id="target" label="Your target" className="bg-[#FBF7F0]">
                <Suspense fallback={<StepFallback />}>
                    <StepActs which="target" answers={answers} update={update} />
                </Suspense>
            </Act>

            <Act id="signin" label="Create your account" className="bg-[#FBF7F0]">
                <Suspense fallback={<StepFallback />}>
                    <StepActs which="signin" answers={answers} update={update} />
                </Suspense>
            </Act>
        </>
    );
}

export default function Landing() {
    /**
     * ONE RECORD, SHARED WITH /onboarding. Same key, same shape — a student who
     * answers two questions here, closes the tab and comes back to the wizard
     * resumes mid-sentence rather than starting again.
     */
    const [answers, setAnswers] = useState(loadAnswers);
    const update = useCallback((patch) => setAnswers((a) => ({ ...a, ...patch })), []);

    useEffect(() => { saveAnswers(answers); }, [answers]);
    useEffect(() => { warmStepActs(); }, []);

    const goToLogin = useCallback(() => { window.location.assign("/login"); }, []);
    const startFromTail = useCallback(() => {
        trackStartTrial();
        const el = document.getElementById("subjects");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, []);

    return (
        <div className="theme-locked-light min-h-screen bg-[#FBF7F0] text-[#0D1626] font-sans antialiased overflow-x-hidden">
            <Reel tail={<ReelTail onStart={startFromTail} onLogin={goToLogin} />}>
                <Film answers={answers} update={update} onLogin={goToLogin} />
            </Reel>
        </div>
    );
}
