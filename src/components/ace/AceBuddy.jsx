/**
 * AceBuddy — Ace, tagging along.
 *
 * He does two things. Once a day he asks what the plan is, which replaces the
 * Dashboard's three-choice intent modal: same question, same stored answer,
 * but asked by someone instead of by a form you have to get past. Then he
 * travels with you and says one short thing per page, tuned to what you told
 * him.
 *
 * EVERYTHING SITS ON THE RIGHT. The left of the screen belongs to the nav rail
 * on desktop, and anything Ace puts over there is either under it or fighting
 * it. He gets one column on the right and stays in it.
 *
 * He stacks ABOVE the launcher rather than beside it, because the launcher is
 * a button people reach for and covering it is the one unforgivable thing a
 * floating helper can do.
 *
 * And he goes when told. "Not now" and "never" are different requests — the
 * first is answered for this visit, the second until they turn him back on —
 * and neither gets an "are you sure?", because arguing with someone who has
 * just asked you to be quiet is how you get uninstalled.
 */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, MoonStar, BellOff } from "lucide-react";
import AceWalker, { AceBubble } from "@/components/ace/AceWalker";
import useAceYield, { claimAce } from "@/components/ace/useAceYield";
import { PAGES } from "@/lib/aceKnowledge";
import {
    shouldAskPlan, setPlan, skipPlan, currentPlan, shouldSpeak, markSpoke,
    snooze, turnOff, readBuddy,
} from "@/lib/aceBuddy";
import { PLANS, PLAN_BY_ID, greeting, pageLine, pick, DISMISS } from "@/lib/aceVoice";

/** Let the page settle before he says anything. */
const SETTLE_MS = 1500;
/** A page line is a passing remark, so it leaves on its own. */
const LINE_LIFE_MS = 11_000;

export default function AceBuddy({ page, userProfile, suppressed = false, onPlan }) {
    // "ask" — what's the plan · "reply" — his reaction to it · "line" — a
    // passing remark · "bye" — the sign-off
    const [mode, setMode] = useState(null);
    // He shares this corner with the XP popup stack, which wins on z-index.
    // Rather than get covered by a celebration, he steps out for a few seconds.
    const yielding = useAceYield();
    const [line, setLine] = useState(null);
    const [bye, setBye] = useState(null);
    const [chosen, setChosen] = useState(null);
    // The Dashboard's read on what today is for — a deadline beats a plan,
    // a plan beats a habit. Ace leads with it when there is one.
    const [suggested, setSuggested] = useState(null);
    const name = userProfile?.username || userProfile?.full_name || "";
    const today = new Date().toDateString();

    useEffect(() => {
        const on = (e) => { if (e?.detail?.mode) setSuggested(e.detail); };
        window.addEventListener("ace:suggest", on);
        return () => window.removeEventListener("ace:suggest", on);
    }, []);

    // ── Ask what the plan is ─────────────────────────────────────────────
    useEffect(() => {
        if (suppressed || !page) return;
        if (!shouldAskPlan()) return;
        const t = setTimeout(() => {
            // Re-checked on fire: navigating twice quickly shouldn't queue two.
            if (shouldAskPlan()) setMode("ask");
        }, SETTLE_MS);
        return () => clearTimeout(t);
    }, [page, suppressed]);

    // ── Or say one thing about where we are ──────────────────────────────
    useEffect(() => {
        if (suppressed || !page || mode === "ask") return;
        if (!PAGES[page]) return;              // nothing honest to say about it
        // The plan question wins. Both of these wait for the page to settle,
        // so checking `mode` alone loses the race — at schedule time mode is
        // still null for both, and whichever setState landed second won. That
        // meant a first-time student got a throwaway page remark instead of
        // being asked what they were there to do.
        if (shouldAskPlan()) return;
        if (!shouldSpeak(page)) return;
        const t = setTimeout(() => {
            if (shouldAskPlan() || !shouldSpeak(page)) return;
            const plan = currentPlan() || "lost";
            markSpoke(page);
            setLine(pageLine(page, plan, `${page}:${plan}:${today}`));
            setMode("line");
        }, SETTLE_MS);
        return () => clearTimeout(t);
    }, [page, suppressed, mode, today]);

    // A remark is a remark — it doesn't sit there waiting to be dealt with.
    useEffect(() => {
        if (mode !== "line") return;
        const t = setTimeout(() => setMode(null), LINE_LIFE_MS);
        return () => clearTimeout(t);
    }, [mode, line]);

    const hello = useMemo(
        () => greeting({ name, seed: today }), [name, today]);

    // Whatever the app thinks is likeliest goes first. Only the first match —
    // "cramming" and "free study" both map to more than one plan, and marking
    // two of four as recommended is the same as marking none.
    const ordered = useMemo(() => {
        if (!suggested?.mode) return PLANS;
        const i = PLANS.findIndex(p => p.mode === suggested.mode);
        return i <= 0 ? PLANS : [PLANS[i], ...PLANS.filter((_, x) => x !== i)];
    }, [suggested]);

    const choose = useCallback((plan) => {
        setPlan(plan.id);
        setChosen(plan);
        onPlan?.(plan);
        // The answer goes back to whoever owns the profile. Ace doesn't write
        // to the database himself — he asks the question and passes it on.
        window.dispatchEvent(new CustomEvent("ace:plan", { detail: { mode: plan.mode, id: plan.id } }));
        // He reacts, then gets out of the way. Holding the screen after you've
        // answered is how a greeting turns back into a form.
        setMode("reply");
        setTimeout(() => setMode(null), 3000);
    }, [onPlan]);

    const goAway = useCallback((forGood) => {
        if (forGood) turnOff(); else snooze();
        setBye(pick(DISMISS[forGood ? "off" : "snooze"], today));
        setMode("bye");
        setTimeout(() => setMode(null), 2600);
    }, [today]);

    // While the buddy is drawing him, the launcher stands down — otherwise
    // there are two of him in the same corner.
    const showing = Boolean(mode) && !yielding && !suppressed;
    useEffect(() => (showing ? claimAce() : undefined), [showing]);

    if (suppressed) return null;

    return (
        <AnimatePresence mode="wait">
            {mode && !yielding && (
                <motion.aside
                    key={mode}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, x: 60 }}
                    transition={{ duration: 0.25 }}
                    data-ace-buddy={mode}
                    role="status"
                    /* RIGHT side, above the launcher lane. The nav rail owns
                       the left edge on desktop; the launcher owns the corner. */
                    className="fixed z-40 right-3 sm:right-6 max-w-[calc(100vw-1.5rem)]
                        bottom-[9.5rem] sm:bottom-[5.5rem] pointer-events-none">
                <AceWalker trip={`${mode}-${page || ""}`}
                    pose={mode === "bye" ? "sleep" : mode === "reply" ? (chosen?.pose || "happy") : mode === "ask" ? "wave" : "stand"}
                    size={mode === "ask" ? "w-24 sm:w-28" : "w-20 sm:w-24"}
                    className="justify-end">
                <AceBubble className="pointer-events-auto w-[min(19rem,calc(100vw-8.5rem))]">

                    {mode === "ask" && (
                        <>
                            <div className="flex items-start gap-2.5">
                                <p className="text-sm font-bold text-foreground leading-snug flex-1 min-w-0">
                                    {hello}
                                </p>
                                <button onClick={() => { skipPlan(); setMode(null); }}
                                    aria-label="Not now" data-ace-buddy-skip
                                    className="text-muted-foreground hover:text-foreground p-1 -m-1 rounded-lg flex-shrink-0">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="space-y-1.5 mt-3">
                                {ordered.map((p, i) => (
                                    <motion.button key={p.id}
                                        initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.05 + i * 0.05 }}
                                        onClick={() => choose(p)} data-ace-plan={p.id}
                                        className="w-full text-left rounded-xl border-2 border-border hover:border-primary/50 hover:bg-primary/5 px-3 py-2 transition-colors group">
                                        <span className="flex items-center gap-1.5">
                                            <span className="text-xs font-bold text-foreground">{p.label}</span>
                                            {suggested?.mode === p.mode && (
                                                <span className="pill bg-primary/15 text-foreground">probably this</span>
                                            )}
                                            <ArrowRight className="w-3 h-3 text-muted-foreground ml-auto group-hover:translate-x-0.5 transition-transform" />
                                        </span>
                                        <span className="block text-[11px] text-muted-foreground leading-snug">
                                            {suggested?.mode === p.mode && suggested.reason ? suggested.reason : p.blurb}
                                        </span>
                                    </motion.button>
                                ))}
                            </div>

                            <div className="flex items-center gap-3 mt-3 pt-2.5 border-t border-border">
                                <button onClick={() => goAway(false)} data-ace-snooze
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors">
                                    <MoonStar className="w-3 h-3" /> Not now
                                </button>
                                <button onClick={() => goAway(true)} data-ace-off
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors ml-auto">
                                    <BellOff className="w-3 h-3" /> Don't pop up
                                </button>
                            </div>
                        </>
                    )}

                    {mode === "line" && (
                        <div className="flex items-start gap-2.5">
                            <p className="text-sm text-foreground leading-snug flex-1 min-w-0">{line}</p>
                            <div className="flex flex-col gap-1 flex-shrink-0">
                                <button onClick={() => setMode(null)} aria-label="Dismiss"
                                    data-ace-line-close
                                    className="text-muted-foreground hover:text-foreground p-1 -m-1 rounded-lg">
                                    <X className="w-4 h-4" />
                                </button>
                                <button onClick={() => goAway(false)} aria-label="Be quiet for now"
                                    data-ace-snooze
                                    className="text-muted-foreground/60 hover:text-foreground p-1 -m-1 rounded-lg">
                                    <MoonStar className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* His reaction to your answer — the moment he stops
                        being a form and starts being someone. */}
                    {mode === "reply" && chosen && (
                        <p className="text-sm text-foreground leading-snug">{chosen.ace}</p>
                    )}

                    {mode === "bye" && (
                        <p className="text-sm text-foreground leading-snug">{bye}</p>
                    )}
                </AceBubble>
                </AceWalker>
                </motion.aside>
            )}
        </AnimatePresence>
    );
}

export { PLAN_BY_ID, readBuddy };
