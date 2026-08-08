/**
 * StakesPill — contextual stakes reminder. Instead of a permanent sticky bar,
 * a compact floating pill appears only where the stake is relevant: while
 * you're on a study surface (Study / Quizzes / AI tools), showing the ONE
 * stake your current activity feeds. Lead-change flashes and the
 * "while you were away" report surface briefly on any page, then get out of
 * the way. Dismissible for the session.
 */
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { Swords, Target, Crown, X, ShieldAlert } from "lucide-react";
import { useStakes } from "./useStakes";
import { METRICS, timeLeft, firstName } from "./arenaMeta";

// Which routes count as "executing the task", and which duel metrics each
// route's work feeds (first match wins when picking the pill's stake).
const ROUTE_METRICS = {
    "/study":   ["flashcards", "study_minutes", "xp", "quiz_marks"],
    "/quizzes": ["quiz_marks", "xp", "flashcards", "study_minutes"],
    "/aitools": ["xp", "quiz_marks", "flashcards", "study_minutes"],
};

function routeKey(pathname) {
    const p = pathname.toLowerCase();
    return Object.keys(ROUTE_METRICS).find(r => p.startsWith(r)) || null;
}

export default function StakesPill() {
    const { stakes } = useStakes();
    const location = useLocation();
    const [flash, setFlash] = useState(null);
    const [dismissed, setDismissed] = useState(() => sessionStorage.getItem("stakes_pill_dismissed") === "1");

    // Transient events show anywhere, then clear.
    useEffect(() => {
        const onLead = (e) => {
            setFlash({ kind: "lead", ...e.detail });
            setTimeout(() => setFlash(null), 6000);
        };
        const onAway = (e) => {
            const item = e.detail.items[0];
            setFlash({ kind: "away", ...item });
            setTimeout(() => setFlash(null), 8000);
        };
        window.addEventListener("duel_lead_change", onLead);
        window.addEventListener("arena_away_report", onAway);
        return () => {
            window.removeEventListener("duel_lead_change", onLead);
            window.removeEventListener("arena_away_report", onAway);
        };
    }, []);

    const me = stakes?.me;
    const rk = routeKey(location.pathname);
    const activeDuels = (stakes?.duels || []).filter(d => d.status === "active" && d.live_scores);
    const activeBets = (stakes?.bets || []).filter(b => b.status === "active");

    // An open call-out outranks everything, everywhere — not just on study
    // surfaces and not dismissible. Ignoring one forfeits XP, so it is the one
    // stake that must not be possible to miss.
    const callout = (stakes?.callouts || [])[0] || null;

    // Pick the single most relevant stake for this surface.
    let picked = null;
    if (me && rk && !dismissed) {
        for (const metric of ROUTE_METRICS[rk]) {
            const duel = activeDuels
                .filter(d => d.metric === metric)
                .sort((a, b) => new Date(a.ends_at) - new Date(b.ends_at))[0];
            if (duel) { picked = { kind: "duel", duel }; break; }
        }
        if (!picked && activeBets.length) {
            const bet = [...activeBets].sort((a, b) => new Date(a.ends_at) - new Date(b.ends_at))[0];
            picked = { kind: "bet", bet };
        }
    }

    // A transient flash outranks the ambient pill; a call-out outranks both.
    const show = callout || flash || picked;
    if (!show) return null;

    let content = null;
    let tone = "border-chart-4/40 bg-surface";

    if (callout) {
        tone = "border-streak bg-streak text-white";
        content = (
            <Link to="/Competitions" className="flex items-center gap-2 text-sm font-black">
                <ShieldAlert className="w-4 h-4" />
                {firstName(callout.caller_name) || "Someone"} called you out — prove it or forfeit
            </Link>
        );
    } else if (flash?.kind === "lead") {
        tone = flash.nowLeading ? "border-primary bg-primary text-white" : "border-streak bg-streak text-white";
        content = (
            <span className="flex items-center gap-2 text-sm font-black">
                {flash.nowLeading ? <Crown className="w-4 h-4" /> : <Swords className="w-4 h-4" />}
                {flash.nowLeading
                    ? `You've taken the lead vs ${firstName(flash.rivalName)}!`
                    : `${firstName(flash.rivalName)} went in front — down ${flash.gap}.`}
            </span>
        );
    } else if (flash?.kind === "away") {
        tone = "border-chart-4 bg-chart-4 text-white";
        content = (
            <span className="text-sm font-bold">
                While you were away: {firstName(flash.rivalName)} +{flash.gained}. Answer back.
            </span>
        );
    } else if (picked?.kind === "duel") {
        const d = picked.duel;
        const isChallenger = d.challenger_email === me;
        const rival = firstName(isChallenger ? d.opponent_name : d.challenger_name);
        const mine = d.live_scores[me] || 0;
        const theirs = d.live_scores[isChallenger ? d.opponent_email : d.challenger_email] || 0;
        const leading = mine > theirs;
        const t = timeLeft(d.ends_at);
        tone = leading ? "border-primary/40 bg-surface" : "border-streak/40 bg-surface";
        content = (
            <span className="flex items-center gap-2 text-xs font-bold text-foreground">
                <Swords className={`w-3.5 h-3.5 ${leading ? "text-primary" : "text-streak"}`} />
                <span>
                    This counts vs {rival}:{" "}
                    <span className={`tabular-nums ${leading ? "text-primary" : "text-streak"}`}>{mine}:{theirs}</span>
                </span>
                <span className={`${t.urgent ? "text-streak" : "text-muted-foreground/70"}`}>· {t.label}</span>
            </span>
        );
    } else if (picked?.kind === "bet") {
        const b = picked.bet;
        const metric = METRICS[b.metric] || METRICS.xp;
        const t = timeLeft(b.ends_at);
        tone = "border-xp/40 bg-surface";
        content = (
            <span className="flex items-center gap-2 text-xs font-bold text-foreground">
                <Target className="w-3.5 h-3.5 text-xp" />
                <span>This counts: <span className="tabular-nums">{b.progress || 0}/{b.target}</span> {metric.unit}</span>
                <span className={`${t.urgent ? "text-streak" : "text-muted-foreground/70"}`}>· {t.label}</span>
            </span>
        );
    }

    return (
        <AnimatePresence>
            <motion.div
                key={flash ? "flash" : "pill"}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                className="fixed bottom-24 md:bottom-6 left-4 md:left-20 z-40 max-w-[calc(100vw-2rem)]"
            >
                <div className={`flex items-center gap-2 rounded-full border-2 shadow-soft-lg pl-4 pr-2 py-2 ${tone}`}>
                    <Link to="/Competitions" className="min-w-0">{content}</Link>
                    {!flash && (
                        <button
                            onClick={() => { setDismissed(true); try { sessionStorage.setItem("stakes_pill_dismissed", "1"); } catch { /* private mode */ } }}
                            aria-label="Hide stakes reminder for this session"
                            className="w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-secondary transition-colors flex-shrink-0"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
