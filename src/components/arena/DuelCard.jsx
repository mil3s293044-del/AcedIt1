/**
 * DuelCard — a live head-to-head study duel. VS layout, live score bars,
 * pot chip, countdown with a final-hours urgency state, and (for spectators)
 * an inline side-bet slip. Settled duels render as a result card.
 */
import React, { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Swords, Zap, Trophy, Loader2, TrendingUp, ArrowRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { METRICS, SIDE_BET_OPTIONS, SIDE_BET_MULT, timeLeft, firstName } from "./arenaMeta";

// The fastest study surface for each yardstick — the duel tells you how to
// fight it.
const METRIC_ROUTE = {
    xp:            { to: "/Study",                      label: "Stack XP with a study session" },
    flashcards:    { to: "/Study?tab=spaced_repetition", label: "Clear flashcards" },
    study_minutes: { to: "/Study?tab=pomodoro",          label: "Start a pomodoro" },
    quiz_marks:    { to: "/Quizzes",                     label: "Take a quiz" },
};

// Static class strings (Tailwind JIT-safe).
const SIDE_CLASSES = {
    lead:  { bar: "bg-primary",  text: "text-primary" },
    trail: { bar: "bg-chart-3",  text: "text-chart-3" },
};

function Side({ name, score, unit, isLead, isMe, pct }) {
    const cls = isLead ? SIDE_CLASSES.lead : SIDE_CLASSES.trail;
    return (
        <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2 mb-1.5">
                <p className="font-bold text-foreground text-sm truncate">
                    {firstName(name)}{isMe && <span className="text-muted-foreground font-semibold"> (you)</span>}
                </p>
                <p className={`font-display font-black text-xl tabular-nums ${cls.text}`}>
                    {score.toLocaleString()}<span className="text-xs font-bold ml-1 opacity-70">{unit}</span>
                </p>
            </div>
            <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
                <motion.div
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.9, ease: "easeOut" }}
                    className={`h-full rounded-full ${cls.bar}`}
                />
            </div>
        </div>
    );
}

export default function DuelCard({ duel, currentUserEmail, spectator = false, balance, onUpdate }) {
    const { toast } = useToast();
    const [betOpen, setBetOpen] = useState(false);
    const [backing, setBacking] = useState(null);
    const [stake, setStake] = useState(50);
    const [placing, setPlacing] = useState(false);

    const metric = METRICS[duel.metric] || METRICS.xp;
    const scores = duel.status === "settled" ? (duel.final_scores || {}) : (duel.live_scores || {});
    const cScore = scores[duel.challenger_email] || 0;
    const oScore = scores[duel.opponent_email] || 0;
    const maxScore = Math.max(cScore, oScore, 1);
    const pot = duel.ante_xp * 2;
    const t = duel.status === "active" ? timeLeft(duel.ends_at) : null;
    const myBet = (duel.side_bets || []).find(b => b.bettor_email === currentUserEmail);
    const isTie = duel.status === "settled" && !duel.winner_email;
    const iWon = duel.status === "settled" && duel.winner_email === currentUserEmail;

    const placeSideBet = async () => {
        if (!backing) return;
        setPlacing(true);
        try {
            await base44.functions.invoke('placeDuelSideBet', {
                duel_id: duel.id,
                backed_email: backing,
                wagered_xp: stake,
            });
            toast({ title: "Side bet placed!", description: `${stake} XP on ${firstName(backing === duel.challenger_email ? duel.challenger_name : duel.opponent_name)}` });
            setBetOpen(false);
            onUpdate?.();
        } catch (e) {
            toast({ title: "Bet not placed", description: e.message, variant: "destructive" });
        } finally {
            setPlacing(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className={`card-soft overflow-hidden border-2 ${
                duel.status === "settled"
                    ? (iWon ? "border-primary/40" : "border-border")
                    : t?.urgent ? "border-streak/50" : "border-chart-4/25"
            }`}
        >
            {/* Header strip */}
            <div className={`px-4 py-2.5 flex items-center justify-between gap-2 ${
                duel.status === "settled" ? "bg-secondary/50" : t?.urgent ? "bg-streak/10" : "bg-chart-4/[0.07]"
            }`}>
                <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <Swords className={`w-3.5 h-3.5 ${t?.urgent ? "text-streak" : "text-chart-4"}`} />
                    {metric.label} duel
                    {spectator && <span className="pill bg-chart-3/10 text-chart-3 ml-1">Watching</span>}
                </span>
                <div className="flex items-center gap-2">
                    <span className="pill bg-xp/15 text-xp flex items-center gap-1">
                        <Zap className="w-3 h-3" /> {pot} XP pot
                    </span>
                    {duel.status === "active" && (
                        <span className={`text-xs font-bold tabular-nums ${t.urgent ? "text-streak animate-pulse" : "text-muted-foreground"}`}>
                            {t.label}
                        </span>
                    )}
                </div>
            </div>

            {/* VS body */}
            <div className="p-4">
                <div className="flex items-center gap-4">
                    <Side
                        name={duel.challenger_name} score={cScore} unit={metric.unit}
                        isLead={cScore >= oScore} isMe={duel.challenger_email === currentUserEmail}
                        pct={(cScore / maxScore) * 100}
                    />
                    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-foreground text-background flex items-center justify-center font-display font-black text-xs">
                        VS
                    </div>
                    <Side
                        name={duel.opponent_name} score={oScore} unit={metric.unit}
                        isLead={oScore >= cScore} isMe={duel.opponent_email === currentUserEmail}
                        pct={(oScore / maxScore) * 100}
                    />
                </div>

                {/* Fight-it shortcut — participants only, while live */}
                {!spectator && duel.status === "active" && METRIC_ROUTE[duel.metric] && (
                    <Link to={METRIC_ROUTE[duel.metric].to}
                        className={`mt-3 flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-bold border-2 transition-all group ${
                            t?.urgent ? "border-streak/40 bg-streak/5 text-streak hover:bg-streak/10" : "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
                        }`}>
                        <span>{METRIC_ROUTE[duel.metric].label}</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                )}

                {/* Settled result */}
                {duel.status === "settled" && (
                    <div className={`mt-3 rounded-xl px-3 py-2.5 flex items-center gap-2 text-sm font-bold ${
                        isTie ? "bg-secondary text-muted-foreground" : iWon ? "bg-primary/10 text-primary" : "bg-streak/5 text-foreground"
                    }`}>
                        <Trophy className={`w-4 h-4 ${isTie ? "text-muted-foreground" : "text-xp"}`} />
                        {isTie
                            ? "Dead heat — both antes refunded."
                            : `${firstName(duel.winner_email === duel.challenger_email ? duel.challenger_name : duel.opponent_name)} takes the ${pot} XP pot${iWon ? " — that's you!" : ""}`}
                    </div>
                )}

                {/* My side bet status */}
                {myBet && (
                    <div className={`mt-3 rounded-xl px-3 py-2 flex items-center justify-between text-xs font-bold ${
                        myBet.status === "won" ? "bg-primary/10 text-primary" :
                        myBet.status === "lost" ? "bg-streak/10 text-streak" :
                        myBet.status === "refunded" ? "bg-secondary text-muted-foreground" : "bg-chart-3/10 text-chart-3"
                    }`}>
                        <span className="flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5" />
                            {myBet.wagered_xp} XP on {firstName(myBet.backed_email === duel.challenger_email ? duel.challenger_name : duel.opponent_name)}
                        </span>
                        <span>
                            {myBet.status === "open" ? "Riding…" :
                             myBet.status === "won" ? `+${myBet.xp_outcome} XP` :
                             myBet.status === "refunded" ? "Refunded (tie)" : `${myBet.xp_outcome} XP`}
                        </span>
                    </div>
                )}

                {/* Spectator side-bet entry */}
                {spectator && duel.status === "active" && !myBet && (
                    !betOpen ? (
                        <button onClick={() => setBetOpen(true)}
                            className="mt-3 w-full text-xs font-bold py-2.5 rounded-xl border-2 border-chart-4/30 text-chart-4 hover:bg-chart-4/5 transition-all">
                            Back a duelist → win {SIDE_BET_MULT}×
                        </button>
                    ) : (
                        <div className="mt-3 bg-chart-4/5 border border-chart-4/20 rounded-xl p-3 space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { email: duel.challenger_email, name: duel.challenger_name },
                                    { email: duel.opponent_email, name: duel.opponent_name },
                                ].map(p => (
                                    <button key={p.email} onClick={() => setBacking(p.email)}
                                        className={`py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                                            backing === p.email ? "bg-chart-4 border-chart-4 text-white" : "bg-surface border-border text-foreground hover:border-chart-4/40"
                                        }`}>
                                        {firstName(p.name)}
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-1.5 flex-wrap">
                                {SIDE_BET_OPTIONS.map(amt => {
                                    const unaffordable = balance != null && amt > balance;
                                    return (
                                        <button key={amt} onClick={() => setStake(amt)} disabled={unaffordable}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all disabled:opacity-40 ${
                                                stake === amt ? "bg-chart-3 border-chart-3 text-white" : "bg-surface border-border text-foreground"
                                            }`}>{amt}</button>
                                    );
                                })}
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={placeSideBet} disabled={!backing || placing || (balance != null && stake > balance)}
                                    className="flex-1 bg-chart-4 hover:bg-chart-4/90 text-white font-bold rounded-xl text-xs h-9">
                                    {placing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : `Bet ${stake} XP → win ${Math.floor(stake * SIDE_BET_MULT)}`}
                                </Button>
                                <Button onClick={() => setBetOpen(false)} variant="ghost" className="rounded-xl text-xs h-9">Cancel</Button>
                            </div>
                        </div>
                    )
                )}
            </div>
        </motion.div>
    );
}
