import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Clock, Crown, Zap, RefreshCw, Loader2, Trophy,
    TrendingUp, CheckCircle2, Timer
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { updateCompetitionProgress, settleHoursCompetition } from "@/api/functionsShim";
import { useToast } from "@/components/ui/use-toast";
import { format, parseISO, differenceInDays } from "date-fns";

const XP_RATES = [75, 50, 30, 15];
const RANK_STYLES = [
    { bg: "bg-amber-500", text: "text-white", label: "🥇", glow: "shadow-amber-500/40" },
    { bg: "bg-slate-400", text: "text-white", label: "🥈", glow: "shadow-slate-400/40" },
    { bg: "bg-orange-400", text: "text-white", label: "🥉", glow: "shadow-orange-400/40" },
    { bg: "bg-gray-300", text: "text-gray-700", label: "4", glow: "" },
];

function formatTime(minutes) {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function ParticipantRow({ participant, rank, currentUserEmail, isCompleted, totalMinutes }) {
    const isMe = participant.email === currentUserEmail;
    const rs = RANK_STYLES[Math.min(rank - 1, RANK_STYLES.length - 1)];
    const hours = (participant.study_minutes || 0) / 60;
    const xpRate = XP_RATES[Math.min(rank - 1, XP_RATES.length - 1)];
    const projectedXP = Math.round(hours * xpRate);
    const barPct = totalMinutes > 0 ? Math.round(((participant.study_minutes || 0) / totalMinutes) * 100) : 0;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl p-4 border-2 transition-all ${
                isMe ? 'border-indigo-300 bg-indigo-50' : 'border-gray-100 bg-white'
            }`}
        >
            <div className="flex items-center gap-3">
                {/* Rank badge */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 shadow-lg ${rs.bg} ${rs.text} ${rs.glow}`}>
                    {rank <= 3 ? rs.label : rank}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`font-bold text-sm truncate ${isMe ? 'text-indigo-700' : 'text-gray-900'}`}>
                            {participant.name}{isMe ? ' (you)' : ''}
                        </span>
                        {participant.status === 'completed' && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                        )}
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${barPct}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className={`h-full rounded-full ${isMe ? 'bg-gradient-to-r from-indigo-400 to-purple-500' : 'bg-gradient-to-r from-gray-300 to-gray-400'}`}
                        />
                    </div>
                </div>

                <div className="text-right flex-shrink-0">
                    <p className="font-black text-gray-900 text-sm flex items-center gap-1 justify-end">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        {formatTime(participant.study_minutes || 0)}
                    </p>
                    {!isCompleted && (
                        <p className="text-xs text-amber-600 font-semibold flex items-center gap-0.5 justify-end mt-0.5">
                            <Zap className="w-3 h-3" />{xpRate}/hr
                        </p>
                    )}
                    {isCompleted && participant.bonus_xp_awarded > 0 && (
                        <p className="text-xs text-emerald-600 font-semibold justify-end mt-0.5">
                            +{participant.bonus_xp_awarded} XP
                        </p>
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
        .sort((a, b) => (b.study_minutes || 0) - (a.study_minutes || 0));

    const isCompleted = competition.status === 'completed';
    const isCreator = competition.creator_email === currentUserEmail;
    const me = competition.participants?.find(p => p.email === currentUserEmail);
    const myRank = accepted.findIndex(p => p.email === currentUserEmail) + 1;
    const totalMinutes = accepted.reduce((sum, p) => Math.max(sum, p.study_minutes || 0), 0) || 1;

    const daysLeft = competition.goal_target_date
        ? differenceInDays(parseISO(competition.goal_target_date), new Date())
        : null;

    const isPastDeadline = daysLeft !== null && daysLeft < 0;

    const handleSync = async () => {
        setSyncing(true);
        try {
            await updateCompetitionProgress({ competition_id: competition.id });
            toast({ title: "Hours synced! 📊" });
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

    const myHours = ((me?.study_minutes || 0) / 60).toFixed(1);
    const myXPRate = XP_RATES[Math.min(myRank - 1, XP_RATES.length - 1)];

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Timer className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-black text-gray-900">Study Hours Battle</h3>
                    {competition.subject_name && (
                        <Badge className="bg-indigo-100 text-indigo-700 border-0 text-xs">{competition.subject_name}</Badge>
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
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-4 text-white">
                    <div className="grid grid-cols-3 gap-3">
                        <div className="text-center">
                            <p className="text-white/70 text-xs mb-1">Your hours</p>
                            <p className="text-2xl font-black">{myHours}h</p>
                        </div>
                        <div className="text-center border-x border-white/20">
                            <p className="text-white/70 text-xs mb-1">Your rank</p>
                            <p className="text-2xl font-black">#{myRank}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-white/70 text-xs mb-1">XP rate</p>
                            <p className="text-2xl font-black">{myXPRate}<span className="text-sm font-bold text-white/70">/hr</span></p>
                        </div>
                    </div>
                    {!isCompleted && daysLeft !== null && (
                        <div className="mt-3 pt-3 border-t border-white/20 text-center">
                            <p className="text-white/70 text-xs">
                                {isPastDeadline
                                    ? `Competition ended ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''} ago`
                                    : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining · every hour you study = ${myXPRate} XP`
                                }
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* XP Prize tiers */}
            {!isCompleted && (
                <div className="grid grid-cols-4 gap-2">
                    {[
                        { pos: "1st", emoji: "🥇", rate: 75, color: "bg-amber-50 border-amber-200" },
                        { pos: "2nd", emoji: "🥈", rate: 50, color: "bg-gray-50 border-gray-200" },
                        { pos: "3rd", emoji: "🥉", rate: 30, color: "bg-orange-50 border-orange-200" },
                        { pos: "4th+", emoji: "📚", rate: 15, color: "bg-gray-50 border-gray-200" },
                    ].map(tier => (
                        <div key={tier.pos} className={`${tier.color} border rounded-xl p-2.5 text-center`}>
                            <p className="text-lg mb-0.5">{tier.emoji}</p>
                            <p className="text-xs font-bold text-gray-700">{tier.pos}</p>
                            <p className="text-xs font-black text-amber-600">{tier.rate} XP/hr</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Leaderboard */}
            <div className="space-y-2">
                {accepted.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">No participants yet.</div>
                ) : (
                    <AnimatePresence>
                        {accepted.map((p, i) => (
                            <ParticipantRow
                                key={p.email}
                                participant={p}
                                rank={i + 1}
                                currentUserEmail={currentUserEmail}
                                isCompleted={isCompleted}
                                totalMinutes={totalMinutes}
                            />
                        ))}
                    </AnimatePresence>
                )}
            </div>

            {/* Settle button for creator */}
            {isCreator && !isCompleted && isPastDeadline && (
                <Button onClick={handleSettle} disabled={settling}
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-2xl py-6 text-base shadow-lg shadow-amber-500/20">
                    {settling ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Trophy className="w-5 h-5 mr-2" />}
                    {settling ? 'Settling...' : 'Settle Competition & Award XP 🏆'}
                </Button>
            )}

            {competition.competition_start_date && (
                <p className="text-xs text-gray-400 text-center">
                    Counting {competition.subject_name ? `${competition.subject_name} ` : ''}study sessions from{' '}
                    {format(parseISO(competition.competition_start_date), 'MMM d, yyyy')}
                    {competition.goal_target_date ? ` → ${format(parseISO(competition.goal_target_date), 'MMM d, yyyy')}` : ''}
                </p>
            )}
        </div>
    );
}