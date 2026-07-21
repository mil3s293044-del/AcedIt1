/**
 * Arena — the competitive heart of Compete. Self-fetching section:
 * live duels (VS cards), duel invites, spectator matches with side bets,
 * back-yourself commitment bets, and a momentum ticker. All settlement is
 * server-side; this just renders state and fires celebrations.
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Swords, Eye, Activity, Loader2, Check, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import DuelCard from "./DuelCard";
import CreateDuelDialog from "./CreateDuelDialog";
import BackYourself from "./BackYourself";
import { METRICS, firstName } from "./arenaMeta";

const TICKER_SOURCE_LABELS = {
    quiz: "quiz", flashcard: "flashcards", study_session: "pomodoro",
    active_recall: "active recall", blurting: "blurting", focus_session: "focus",
    practice_questions: "practice", mini_test: "mock exam", loading_quiz: "warm-up", challenge: "mission",
};

function agoLabel(iso) {
    const mins = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    return `${Math.round(mins / 60)}h ago`;
}

// view: "all" (legacy single-scroll), "matches" (duels only), "bets"
// (back-yourself only) — the Compete tabs render one slice each.
export default function Arena({ view = "all" }) {
    const { toast } = useToast();
    const [user, setUser] = useState(null);
    const [state, setState] = useState(null);
    const [loading, setLoading] = useState(true);
    const [challengeOpen, setChallengeOpen] = useState(false);
    const [responding, setResponding] = useState(null);
    const celebratedRef = useRef(new Set());

    const refresh = useCallback(async () => {
        try {
            const res = await base44.functions.invoke('getArenaState', {});
            const data = res?.data ?? res;
            setState(data);
            // Back-yourself wins celebrate immediately (they're always mine);
            // duel wins fire from the user-aware effect below.
            (data?.freshly_settled || []).forEach(s => {
                const key = `${s.type}_${s.id}`;
                if (celebratedRef.current.has(key)) return;
                celebratedRef.current.add(key);
                if (s.type === "study_bet" && s.won) {
                    window.dispatchEvent(new CustomEvent('xp_awarded', { detail: { xp: s.payout, source: 'bet_win' } }));
                }
            });
        } catch (e) {
            console.error("Arena load error:", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        base44.auth.me().then(setUser).catch(() => {});
        refresh();
        // Any XP award can move a score or settle a bet — refetch right after
        // the server has recorded it so the arena tracks in near-real-time.
        let debounce = null;
        const onXP = () => {
            clearTimeout(debounce);
            debounce = setTimeout(refresh, 1800);
        };
        window.addEventListener('xp_awarded', onXP);
        return () => {
            window.removeEventListener('xp_awarded', onXP);
            clearTimeout(debounce);
        };
    }, [refresh]);

    // Keep live duels fresh without hammering the server.
    const hasLive = (state?.duels || []).some(d => d.status === "active") || (state?.spectator_duels || []).length > 0;
    useEffect(() => {
        if (!hasLive) return;
        const t = setInterval(refresh, 60000);
        return () => clearInterval(t);
    }, [hasLive, refresh]);

    // Duel-win popup with the real pot (server already paid it out).
    useEffect(() => {
        if (!user?.email || !state?.freshly_settled) return;
        state.freshly_settled.forEach(s => {
            const key = `pop_${s.type}_${s.id}`;
            if (celebratedRef.current.has(key)) return;
            celebratedRef.current.add(key);
            if (s.type === "duel" && s.winner_email === user.email) {
                window.dispatchEvent(new CustomEvent('xp_awarded', { detail: { xp: s.pot, source: 'duel_win' } }));
            }
        });
    }, [state, user]);

    const respond = async (duelId, accept) => {
        setResponding(duelId);
        try {
            await base44.functions.invoke('respondDuel', { duel_id: duelId, accept });
            toast(accept
                ? { title: "⚔️ Duel on!", description: "The clock starts now. Every study action counts." }
                : { title: "Challenge declined", description: "Their ante has been returned." });
            await refresh();
        } catch (e) {
            toast({ title: "Couldn't respond", description: e.message, variant: "destructive" });
        } finally {
            setResponding(null);
        }
    };

    if (loading) {
        return (
            <div className="space-y-3">
                {[1, 2].map(i => <div key={i} className="card-soft h-28 animate-pulse bg-secondary/50" />)}
            </div>
        );
    }
    if (!state || state.setup_required) return null;

    const me = user?.email;
    const duels = state.duels || [];
    const incoming = duels.filter(d => d.status === "pending" && d.opponent_email === me);
    const outgoing = duels.filter(d => d.status === "pending" && d.challenger_email === me);
    const active = duels.filter(d => d.status === "active");
    const recent = duels.filter(d => d.status === "settled").slice(0, 3);
    const spectating = state.spectator_duels || [];

    // Bets-only slice: just the commitment bets, nothing else competing for
    // attention.
    if (view === "bets") {
        return (
            <BackYourself bets={state.bets || []} balance={state.balance} currentUserEmail={me} onUpdate={refresh} />
        );
    }

    const showBets = view === "all";

    return (
        <div className="space-y-6">
            {/* Section header + challenge CTA */}
            <div className="flex items-center justify-end gap-3">
                <Button onClick={() => setChallengeOpen(true)}
                    className="rounded-2xl bg-chart-4 hover:bg-chart-4/90 text-white font-bold gap-2 btn-3d">
                    <Swords className="w-4 h-4" /> Challenge a rival
                </Button>
            </div>

            {/* Incoming challenges — the loudest thing on the page */}
            {incoming.map(d => (
                <motion.div key={d.id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                    className="card-soft border-2 border-chart-4/50 bg-chart-4/[0.06] p-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex-1 min-w-[200px]">
                            <p className="font-black text-foreground">
                                ⚔️ {firstName(d.challenger_name)} challenged you!
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {METRICS[d.metric]?.label} · {d.window_hours === 168 ? "1 week" : d.window_hours === 72 ? "3 days" : "24 hours"} ·{" "}
                                <span className="font-bold text-xp">{d.ante_xp} XP ante each — {d.ante_xp * 2} XP pot</span>
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={() => respond(d.id, true)} disabled={responding === d.id}
                                className="rounded-xl bg-primary hover:bg-primary/90 text-white font-bold gap-1.5">
                                {responding === d.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Accept
                            </Button>
                            <Button onClick={() => respond(d.id, false)} disabled={responding === d.id} variant="outline"
                                className="rounded-xl border-2 font-bold gap-1.5">
                                <X className="w-4 h-4" /> Decline
                            </Button>
                        </div>
                    </div>
                </motion.div>
            ))}

            {/* Live duels */}
            {active.length > 0 && (
                <div className="space-y-3">
                    {active.map(d => (
                        <DuelCard key={d.id} duel={d} currentUserEmail={me} balance={state.balance} onUpdate={refresh} />
                    ))}
                </div>
            )}

            {/* Momentum ticker */}
            {state.ticker?.length > 0 && (
                <div className="card-soft px-4 py-3 overflow-hidden">
                    <p className="stat-label mb-2 flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-primary" /> Momentum
                    </p>
                    <div className="space-y-1.5">
                        {state.ticker.slice(0, 5).map((e, i) => (
                            <motion.p key={`${e.email}_${e.at}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }} className="text-xs text-muted-foreground">
                                <span className="font-bold text-foreground">{firstName(e.name)}</span>
                                {" "}<span className="font-bold text-xp">+{e.xp} XP</span>
                                {" "}from {TICKER_SOURCE_LABELS[e.source] || e.source} · {agoLabel(e.at)}
                            </motion.p>
                        ))}
                    </div>
                </div>
            )}

            {/* Waiting on rivals */}
            {outgoing.map(d => (
                <div key={d.id} className="card-soft p-3.5 flex items-center gap-3 border-2 border-dashed border-border">
                    <Loader2 className="w-4 h-4 text-muted-foreground animate-spin flex-shrink-0" />
                    <p className="text-xs text-muted-foreground">
                        Waiting on <span className="font-bold text-foreground">{firstName(d.opponent_name)}</span> to accept your {METRICS[d.metric]?.label} duel — {d.ante_xp} XP ante is in the pot.
                    </p>
                </div>
            ))}

            {/* Empty-state pitch */}
            {active.length === 0 && incoming.length === 0 && outgoing.length === 0 && (
                <button onClick={() => setChallengeOpen(true)}
                    className="w-full card-soft border-2 border-dashed border-chart-4/30 p-6 text-center hover:border-chart-4/60 transition-all">
                    <p className="font-black text-foreground">No live duels — someone's getting too comfortable</p>
                    <p className="text-xs text-muted-foreground mt-1">
                        Ante up, pick a yardstick, and let a week of studying settle it. Winner takes the pot.
                    </p>
                </button>
            )}

            {/* Friends' matches — watch and side-bet */}
            {spectating.length > 0 && (
                <div className="space-y-3">
                    <h3 className="font-display font-extrabold text-foreground flex items-center gap-2">
                        <Eye className="w-5 h-5 text-chart-3" /> Live now
                    </h3>
                    {spectating.map(d => (
                        <DuelCard key={d.id} duel={d} currentUserEmail={me} spectator balance={state.balance} onUpdate={refresh} />
                    ))}
                </div>
            )}

            {/* Back-yourself bets (only in the legacy single-scroll view) */}
            {showBets && (
                <BackYourself bets={state.bets || []} balance={state.balance} currentUserEmail={me} onUpdate={refresh} />
            )}

            {/* Recent results */}
            {recent.length > 0 && (
                <div className="space-y-3">
                    <p className="stat-label">Recent results</p>
                    {recent.map(d => (
                        <DuelCard key={d.id} duel={d} currentUserEmail={me} balance={state.balance} onUpdate={refresh} />
                    ))}
                </div>
            )}

            <CreateDuelDialog
                open={challengeOpen}
                onOpenChange={setChallengeOpen}
                currentUser={user}
                balance={state.balance}
                onCreated={refresh}
            />
        </div>
    );
}
