import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Clock, Zap, RefreshCw, Loader2, Trophy,
    CheckCircle2, Swords, Coins, TrendingUp, Crown, Flame, ShieldAlert
} from "lucide-react";
import { updateCompetitionProgress, settleHoursCompetition } from "@/api/functionsShim";
import { useToast } from "@/components/ui/use-toast";
import { parseISO, differenceInDays } from "date-fns";
import { Countdown, computePot } from "./arenaHelpers";
import { fmtDate } from "@/lib/safeDate";

// Flat XP by finishing rank (1st / 2nd / 3rd / 4th+).
const FLAT_XP = [150, 100, 60, 30];
// On-brand rank styles: gold → xp, silver → secondary, bronze → streak.
const RANK_STYLES = [
    { bg: "bg-xp", text: "text-white", label: "🥇" },
    { bg: "bg-secondary", text: "text-foreground", label: "🥈" },
    { bg: "bg-streak", text: "text-white", label: "🥉" },
    { bg: "bg-secondary", text: "text-muted-foreground", label: "4" },
];

function formatTime(minutes) {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function ParticipantRow({ participant, rank, currentUserEmail, isCompleted, maxScore, scoreAbove, scoreBelow }) {
    const isMe = participant.email === currentUserEmail;
    const rs = RANK_STYLES[Math.min(rank - 1, RANK_STYLES.length - 1)];
    const score = participant.compete_score || 0;
    const flatXP = FLAT_XP[Math.min(rank - 1, FLAT_XP.length - 1)];
    const barPct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

    // Momentum: how far behind the person directly above, and whether the
    // chaser directly below is breathing down your neck (danger zone).
    const gapAbove = scoreAbove != null ? Math.max(0, Math.round(scoreAbove - score)) : null;
    const gapBelow = scoreBelow != null ? Math.round(score - scoreBelow) : null;
    const inDanger = isMe && !isCompleted && gapBelow != null && gapBelow <= 25;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl p-4 border-2 transition-all ${
                inDanger ? 'border-streak/50 bg-streak/5'
                : isMe ? 'border-primary/40 bg-primary/5'
                : 'border-border bg-surface'
            }`}
        >
            <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 shadow-soft ${rs.bg} ${rs.text}`}>
                    {rank <= 3 ? rs.label : rank}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`font-bold text-sm truncate ${isMe ? 'text-primary' : 'text-foreground'}`}>
                            {participant.name}{isMe ? ' (you)' : ''}
                        </span>
                        {participant.status === 'completed' && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        )}
                        {inDanger && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-extrabold text-streak uppercase tracking-wide">
                                <ShieldAlert className="w-3 h-3" /> defend
                            </span>
                        )}
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${barPct}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className={`h-full rounded-full ${isMe ? 'bg-primary' : 'bg-muted-foreground/40'}`}
                        />
                    </div>
                    {!isCompleted && isMe && gapAbove != null && gapAbove > 0 && (
                        <p className="text-[11px] font-bold text-chart-3 mt-1 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" /> {gapAbove} pts to overtake the spot above
                        </p>
                    )}
                    {!isCompleted && isMe && gapAbove === 0 && rank > 1 && (
                        <p className="text-[11px] font-bold text-xp mt-1 flex items-center gap-1">
                            <Flame className="w-3 h-3" /> dead level — one session takes the spot
                        </p>
                    )}
                </div>

                <div className="text-right flex-shrink-0">
                    <p className="font-black text-foreground text-sm tabular-nums">{score}<span className="text-xs text-muted-foreground font-bold"> pts</span></p>
                    {!isCompleted ? (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end mt-0.5">
                            <Clock className="w-3 h-3" />{formatTime(participant.study_minutes || 0)}
                        </p>
                    ) : participant.bonus_xp_awarded > 0 ? (
                        <p className="text-xs text-xp font-semibold flex items-center gap-0.5 justify-end mt-0.5">
                            <Zap className="w-3 h-3" />+{participant.bonus_xp_awarded} XP
                        </p>
                    ) : null}
                    {!isCompleted && rank <= 4 && (
                        <p className="text-xs text-xp font-semibold mt-0.5">+{flatXP} XP if you finish here</p>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

export default function HoursLeaderboard({ competition, currentUserEmail, onUpdate }) {
    const { toast } = useToast();
    const [syncing, setSyncing] = useState(false);
    const [settling, setSettling] = useState(false);

    const accepted = (competition.participants || [])
        .filter(p => p.status === 'accepted' || p.status === 'completed')
        .sort((a, b) => (b.compete_score || 0) - (a.compete_score || 0) || (b.study_minutes || 0) - (a.study_minutes || 0));

    const isCompleted = competition.status === 'completed';
    const isCreator = competition.creator_email === currentUserEmail;
    const me = competition.participants?.find(p => p.email === currentUserEmail);
    const myRank = accepted.findIndex(p => p.email === currentUserEmail) + 1;
    const maxScore = accepted.reduce((sum, p) => Math.max(sum, p.compete_score || 0), 0) || 1;

    const daysLeft = competition.goal_target_date
        ? differenceInDays(parseISO(competition.goal_target_date), new Date())
        : null;
    const isPastDeadline = daysLeft !== null && daysLeft < 0;

    const handleSync = async () => {
        setSyncing(true);
        try {
            await updateCompetitionProgress({ competition_id: competition.id });
            toast({ title: "Score synced! 📊" });
            onUpdate?.();
        } catch (e) {
            toast({ title: "Sync failed", description: e.message, variant: "destructive" });
        } finally {
            setSyncing(false);
        }
    };

    const handleSettle = async () => {
        if (!confirm("Settle competition? This will finalise rankings and award XP to all participants.")) return;
        setSettling(true);
        try {
            await settleHoursCompetition({ competition_id: competition.id });
            toast({ title: "Competition settled! 🏆 XP awarded." });
            onUpdate?.();
        } catch (e) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally {
            setSettling(false);
        }
    };

    const myScore = me?.compete_score || 0;
    const myHours = ((me?.study_minutes || 0) / 60).toFixed(1);

    // Stakes + live momentum.
    const pot = computePot(competition);
    const leaderScore = accepted[0]?.compete_score || 0;
    const gapToLead = Math.max(0, Math.round(leaderScore - myScore));
    const chaser = myRank > 0 ? accepted[myRank] : null;       // person directly below me
    const gapToChaser = chaser ? Math.round(myScore - (chaser.compete_score || 0)) : null;
    const isLeader = myRank === 1 && accepted.length > 1;
    const myPrize = FLAT_XP[Math.min(Math.max(myRank - 1, 0), FLAT_XP.length - 1)];

    // One charged line that reframes the standings as a call to act.
    let pressure = null;
    if (!isCompleted && accepted.length > 1 && me) {
        if (isLeader) {
            pressure = gapToChaser != null && gapToChaser <= 25
                ? { tone: "streak", icon: ShieldAlert, text: `${chaser?.name?.split(' ')[0]} is only ${gapToChaser} pts back — your lead is slipping.` }
                : { tone: "xp", icon: Crown, text: `You're on top by ${gapToChaser ?? 0} pts. Hold the line — ${myPrize} XP on it.` };
        } else {
            pressure = { tone: "chart-3", icon: TrendingUp, text: `${gapToLead} pts off 1st. One focused session can flip this.` };
        }
    }
    const PRESS = {
        xp: "bg-xp/10 text-xp",
        streak: "bg-streak/10 text-streak",
        "chart-3": "bg-chart-3/10 text-chart-3",
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Swords className="w-5 h-5 text-chart-4" />
                    <h3 className="font-display font-extrabold text-foreground">Compete Score Battle</h3>
                    {competition.subject_name && (
                        <Badge className="bg-chart-4/15 text-chart-4 border-0 text-xs">{competition.subject_name}</Badge>
                    )}
                </div>
                {!isCompleted && (
                    <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}
                        className="gap-1.5 text-xs rounded-xl">
                        {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        Sync
                    </Button>
                )}
            </div>

            {/* My stats strip */}
            {me && (
                <div className="bg-chart-4/5 border-2 border-chart-4/20 rounded-2xl p-4">
                    <div className="grid grid-cols-3 gap-3">
                        <div className="text-center">
                            <p className="stat-label mb-1">Your score</p>
                            <p className="font-display font-black text-2xl tabular-nums text-chart-4">{myScore}</p>
                        </div>
                        <div className="text-center border-x border-chart-4/15">
                            <p className="stat-label mb-1">Your rank</p>
                            <p className="font-display font-black text-2xl text-foreground">#{myRank}</p>
                        </div>
                        <div className="text-center">
                            <p className="stat-label mb-1">Hours</p>
                            <p className="font-display font-black text-2xl text-foreground">{myHours}h</p>
                        </div>
                    </div>
                    {!isCompleted && competition.goal_target_date && (
                        <div className="mt-3 pt-3 border-t border-chart-4/15">
                            <Countdown targetDate={competition.goal_target_date} variant="banner" />
                        </div>
                    )}
                </div>
            )}

            {/* The Pot — total XP on the line */}
            {!isCompleted && pot.total > 0 && (
                <div className="flex items-center gap-3 rounded-2xl bg-xp/5 border-2 border-xp/25 px-4 py-3">
                    <div className="w-10 h-10 rounded-xl bg-xp/15 flex items-center justify-center flex-shrink-0">
                        <Coins className="w-5 h-5 text-xp" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="stat-label">XP on the line</p>
                        <p className="font-display font-black text-foreground text-lg leading-none">
                            {pot.total.toLocaleString()} XP
                            <span className="text-xs font-bold text-muted-foreground ml-1.5">winner takes the top cut</span>
                        </p>
                    </div>
                    {pot.wagerPot > 0 && (
                        <Badge className="bg-xp/15 text-xp border-0 text-xs flex-shrink-0">{pot.wagerPot} in bets</Badge>
                    )}
                </div>
            )}

            {/* Live pressure line */}
            {pressure && (
                <motion.div
                    key={pressure.text}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${PRESS[pressure.tone]}`}
                >
                    <pressure.icon className="w-4 h-4 flex-shrink-0" />
                    {pressure.text}
                </motion.div>
            )}

            {/* Flat XP prize tiers */}
            {!isCompleted && (
                <div className="grid grid-cols-4 gap-2">
                    {[
                        { pos: "1st", emoji: "🥇", xp: 150, color: "bg-xp/10 border-xp/20" },
                        { pos: "2nd", emoji: "🥈", xp: 100, color: "bg-secondary border-border" },
                        { pos: "3rd", emoji: "🥉", xp: 60, color: "bg-streak/10 border-streak/20" },
                        { pos: "4th+", emoji: "📚", xp: 30, color: "bg-secondary border-border" },
                    ].map(tier => (
                        <div key={tier.pos} className={`${tier.color} border rounded-xl p-2.5 text-center`}>
                            <p className="text-lg mb-0.5">{tier.emoji}</p>
                            <p className="text-xs font-bold text-muted-foreground">{tier.pos}</p>
                            <p className="text-xs font-black text-xp">{tier.xp} XP</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Leaderboard */}
            <div className="space-y-2">
                {accepted.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">No participants yet.</div>
                ) : (
                    <AnimatePresence>
                        {accepted.map((p, i) => (
                            <ParticipantRow
                                key={p.email}
                                participant={p}
                                rank={i + 1}
                                currentUserEmail={currentUserEmail}
                                isCompleted={isCompleted}
                                maxScore={maxScore}
                                scoreAbove={i > 0 ? (accepted[i - 1].compete_score || 0) : null}
                                scoreBelow={i < accepted.length - 1 ? (accepted[i + 1].compete_score || 0) : null}
                            />
                        ))}
                    </AnimatePresence>
                )}
            </div>

            {/* Settle button for creator */}
            {isCreator && !isCompleted && isPastDeadline && (
                <Button onClick={handleSettle} disabled={settling}
                    className="w-full bg-xp hover:bg-xp/90 text-white font-display font-extrabold rounded-2xl py-6 text-base shadow-soft btn-3d">
                    {settling ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Trophy className="w-5 h-5 mr-2" />}
                    {settling ? 'Settling…' : 'Settle Competition & Award XP 🏆'}
                </Button>
            )}

            {competition.competition_start_date && (
                <p className="text-xs text-muted-foreground text-center">
                    Scoring effort, accuracy &amp; consistency since{' '}
                    {fmtDate(competition.competition_start_date, 'MMM d, yyyy')}
                    {competition.goal_target_date ? ` → ${fmtDate(competition.goal_target_date, 'MMM d, yyyy')}` : ''}
                </p>
            )}
        </div>
    );
}
