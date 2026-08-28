import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    ChevronLeft, Copy, Check, Timer,
    TrendingUp, Users, Zap
, Trophy} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import HoursLeaderboard from "./HoursLeaderboard";
import ScorePredictionBetting from "./ScorePredictionBetting";
import { Countdown, Confetti, useCountUp } from "./arenaHelpers";

/**
 * `embedded` renders this under the BattleDashboard, which already shows the
 * title, participants, countdown, standings and scores. In that mode the
 * duplicated header — back button, title, countdown — is dropped and only the
 * controls the dashboard doesn't have survive: the invite code, sync, settle,
 * sub-goals and score bets.
 */
export default function GoalCompetitionDetail({ competition, currentUserEmail, onBack, onUpdate, embedded = false }) {
    const { toast } = useToast();
    const [copied, setCopied] = useState(false);

    const accepted = (competition.participants || []).filter(p => p.status === 'accepted' || p.status === 'completed');
    const invited = (competition.participants || []).filter(p => p.status === 'invited');
    const isCompleted = competition.status === 'completed';
    const isWinner = competition.winner_email === currentUserEmail;
    const me = competition.participants?.find(p => p.email === currentUserEmail);
    const bonusXP = useCountUp(me?.bonus_xp_awarded || 0, 1100);

    const handleCopyCode = () => {
        navigator.clipboard.writeText(competition.invite_code);
        setCopied(true);
        toast({ title: "Invite code copied!" });
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-5">
            {/* Win celebration */}
            <Confetti active={isCompleted && isWinner} />

            {/* Header */}
            {embedded ? (
                !isCompleted && (
                    <div className="flex items-center justify-between gap-3">
                        <p className="stat-label">Manage this battle</p>
                        <Button variant="outline" size="sm" onClick={handleCopyCode}
                            className="gap-1.5 font-mono font-bold text-xs rounded-xl border-dashed">
                            {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                            {competition.invite_code}
                        </Button>
                    </div>
                )
            ) : (
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={onBack} className="rounded-xl">
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back
                </Button>
                <div className="flex-1 min-w-0">
                    <h2 className="font-display font-extrabold text-foreground text-lg truncate">{competition.goal_title}</h2>
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs text-muted-foreground">
                            by {competition.creator_name} · {accepted.length} participant{accepted.length !== 1 ? 's' : ''}
                        </p>
                        {!isCompleted && competition.goal_target_date && (
                            <>
                                <span className="text-muted-foreground/40 text-xs">·</span>
                                <Countdown targetDate={competition.goal_target_date} variant="chip" />
                            </>
                        )}
                    </div>
                </div>
                {!isCompleted && (
                    <Button variant="outline" size="sm" onClick={handleCopyCode}
                        className="gap-1.5 font-mono font-bold text-xs rounded-xl border-dashed">
                        {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                        {competition.invite_code}
                    </Button>
                )}
            </div>
            )}

            {/* Winner banner */}
            <AnimatePresence>
                {isCompleted && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ type: "spring", stiffness: 320, damping: 22 }}
                        className={`rounded-2xl p-6 text-center ${
                            isWinner
                                ? 'bg-xp/10 border-2 border-xp/40 shadow-soft'
                                : 'card-soft border-chart-4/25 bg-chart-4/5'
                        }`}>
                        <motion.div
                            initial={{ scale: 0, rotate: -25 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.15 }}
                            className="mb-2 flex justify-center"
                        >
                            <span className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                                isWinner ? "bg-xp/15" : "bg-secondary"}`}>
                                <Trophy className={`w-8 h-8 ${isWinner ? "text-xp" : "text-muted-foreground"}`}
                                    strokeWidth={2.2} />
                            </span>
                        </motion.div>
                        <p className={`font-display font-black text-2xl ${isWinner ? 'text-xp' : 'text-foreground'}`}>
                            {isWinner ? 'Champion!' : `${competition.winner_name} took it`}
                        </p>
                        {me?.final_rank && (
                            <p className={`text-sm font-bold mt-0.5 ${isWinner ? 'text-foreground/70' : 'text-muted-foreground'}`}>
                                You finished #{me.final_rank} of {accepted.length}
                            </p>
                        )}
                        {me?.bonus_xp_awarded > 0 && (
                            <div className={`inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-full font-display font-black text-lg ${isWinner ? 'bg-xp/15 text-xp' : 'bg-chart-4/15 text-chart-4'}`}>
                                <Zap className="w-5 h-5" />+{bonusXP} XP
                            </div>
                        )}
                        {!isWinner && (
                            <p className="text-xs text-muted-foreground mt-3">Run it back — challenge them again from the arena.</p>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Invited waiting */}
            {invited.length > 0 && !isCompleted && (
                <div className="flex items-center gap-2 flex-wrap bg-xp/5 border border-xp/20 rounded-xl px-3 py-2.5">
                    <Users className="w-4 h-4 text-xp flex-shrink-0" />
                    <span className="text-xs text-xp font-semibold">Waiting for:</span>
                    {invited.map(p => <Badge key={p.email} className="text-xs bg-xp/15 text-xp border-0">{p.name.split(' ')[0]}</Badge>)}
                    <span className="text-xs text-muted-foreground ml-auto">Share code: <strong className="text-foreground">{competition.invite_code}</strong></span>
                </div>
            )}

            {/* Tabs: Hours Battle / Score Bets */}
            <Tabs defaultValue="hours">
                <TabsList className="grid grid-cols-2 bg-secondary p-1 rounded-2xl h-auto">
                    <TabsTrigger value="hours"
                        className="flex items-center gap-1.5 py-2.5 text-muted-foreground data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:shadow-soft rounded-xl text-sm font-bold transition-all">
                        <Timer className="w-4 h-4" /> Hours Battle
                    </TabsTrigger>
                    <TabsTrigger value="bets"
                        className="flex items-center gap-1.5 py-2.5 text-muted-foreground data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:shadow-soft rounded-xl text-sm font-bold transition-all">
                        <TrendingUp className="w-4 h-4" /> Score Bets
                        {(competition.progress_bets || []).length > 0 && (
                            <span className="w-5 h-5 bg-chart-4/15 text-chart-4 rounded-full text-xs font-black flex items-center justify-center">
                                {(competition.progress_bets || []).length}
                            </span>
                        )}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="hours" className="pt-4">
                    <HoursLeaderboard
                        competition={competition}
                        currentUserEmail={currentUserEmail}
                        onUpdate={onUpdate}
                    />
                </TabsContent>

                <TabsContent value="bets" className="pt-4">
                    <ScorePredictionBetting
                        competition={competition}
                        currentUserEmail={currentUserEmail}
                        onUpdate={onUpdate}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}