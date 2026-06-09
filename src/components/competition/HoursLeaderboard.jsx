import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Clock, Zap, RefreshCw, Loader2, Trophy,
    CheckCircle2, Swords
} from "lucide-react";
import { updateCompetitionProgress, settleHoursCompetition } from "@/api/functionsShim";
import { useToast } from "@/components/ui/use-toast";
import { format, parseISO, differenceInDays } from "date-fns";

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

function ParticipantRow({ participant, rank, currentUserEmail, isCompleted, maxScore }) {
    const isMe = participant.email === currentUserEmail;
    const rs = RANK_STYLES[Math.min(rank - 1, RANK_STYLES.length - 1)];
    const score = participant.compete_score || 0;
    const flatXP = FLAT_XP[Math.min(rank - 1, FLAT_XP.length - 1)];
    const barPct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl p-4 border-2 transition-all ${
                isMe ? 'border-primary/40 bg-primary/5' : 'border-border bg-surface'
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
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${barPct}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className={`h-full rounded-full ${isMe ? 'bg-primary' : 'bg-muted-foreground/40'}`}
                        />
                    </div>
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
                <div className="bg-gradient-to-br from-chart-4 to-chart-3 rounded-2xl p-4 text-white">
                    <div className="grid grid-cols-3 gap-3">
                        <div className="text-center">
                            <p className="text-white/70 text-xs mb-1">Your score</p>
                            <p className="font-display font-black text-2xl tabular-nums">{myScore}</p>
                        </div>
                        <div className="text-center border-x border-white/20">
                            <p className="text-white/70 text-xs mb-1">Your rank</p>
                            <p className="font-display font-black text-2xl">#{myRank}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-white/70 text-xs mb-1">Hours</p>
                            <p className="font-display font-black text-2xl">{myHours}h</p>
                        </div>
                    </div>
                    {!isCompleted && daysLeft !== null && (
                        <div className="mt-3 pt-3 border-t border-white/20 text-center">
                            <p className="text-white/80 text-xs">
                                {isPastDeadline
                                    ? `Competition ended ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''} ago`
                                    : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left · study smart — effort, accuracy & consistency all count`
                                }
                            </p>
                        </div>
                    )}
                </div>
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
                            />
                        ))}
                    </AnimatePresence>
                )}
            </div>

            {/* Settle button for creator */}
            {isCreator && !isCompleted && isPastDeadline && (
                <Button onClick={handleSettle} disabled={settling}
                    className="w-full bg-gradient-to-r from-xp to-streak text-white font-display font-extrabold rounded-2xl py-6 text-base shadow-soft btn-3d">
                    {settling ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Trophy className="w-5 h-5 mr-2" />}
                    {settling ? 'Settling…' : 'Settle Competition & Award XP 🏆'}
                </Button>
            )}

            {competition.competition_start_date && (
                <p className="text-xs text-muted-foreground text-center">
                    Scoring effort, accuracy &amp; consistency since{' '}
                    {format(parseISO(competition.competition_start_date), 'MMM d, yyyy')}
                    {competition.goal_target_date ? ` → ${format(parseISO(competition.goal_target_date), 'MMM d, yyyy')}` : ''}
                </p>
            )}
        </div>
    );
}
