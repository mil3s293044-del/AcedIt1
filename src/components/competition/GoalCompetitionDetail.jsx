import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    ChevronLeft, Copy, Check, Trophy, Timer,
    TrendingUp, Users, Crown, Zap
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import HoursLeaderboard from "./HoursLeaderboard";
import ScorePredictionBetting from "./ScorePredictionBetting";

export default function GoalCompetitionDetail({ competition, currentUserEmail, onBack, onUpdate }) {
    const { toast } = useToast();
    const [copied, setCopied] = useState(false);

    const accepted = (competition.participants || []).filter(p => p.status === 'accepted' || p.status === 'completed');
    const invited = (competition.participants || []).filter(p => p.status === 'invited');
    const isCompleted = competition.status === 'completed';
    const isWinner = competition.winner_email === currentUserEmail;
    const me = competition.participants?.find(p => p.email === currentUserEmail);

    const handleCopyCode = () => {
        navigator.clipboard.writeText(competition.invite_code);
        setCopied(true);
        toast({ title: "Invite code copied!" });
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={onBack} className="rounded-xl">
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back
                </Button>
                <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-black text-gray-900 truncate">{competition.goal_title}</h2>
                    <p className="text-xs text-gray-400">
                        by {competition.creator_name} · {accepted.length} participant{accepted.length !== 1 ? 's' : ''}
                        {competition.goal_target_date && ` · ends ${format(parseISO(competition.goal_target_date), 'MMM d')}`}
                    </p>
                </div>
                {!isCompleted && (
                    <Button variant="outline" size="sm" onClick={handleCopyCode}
                        className="gap-1.5 font-mono font-bold text-xs rounded-xl border-dashed">
                        {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                        {competition.invite_code}
                    </Button>
                )}
            </div>

            {/* Winner banner */}
            <AnimatePresence>
                {isCompleted && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                        className={`rounded-2xl p-5 text-center ${
                            isWinner
                                ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-white shadow-xl shadow-amber-500/30'
                                : 'bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200'
                        }`}>
                        <div className="text-4xl mb-2">{isWinner ? '🏆' : '🎖️'}</div>
                        <p className="text-lg font-black">
                            {isWinner ? 'You won!' : `${competition.winner_name} won!`}
                        </p>
                        {me?.bonus_xp_awarded > 0 && (
                            <p className={`text-sm mt-1 flex items-center justify-center gap-1 ${isWinner ? 'text-white/90' : 'text-purple-700'}`}>
                                <Zap className="w-4 h-4" />+{me.bonus_xp_awarded} XP awarded
                            </p>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Invited waiting */}
            {invited.length > 0 && !isCompleted && (
                <div className="flex items-center gap-2 flex-wrap bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                    <Users className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span className="text-xs text-amber-700 font-semibold">Waiting for:</span>
                    {invited.map(p => <Badge key={p.email} className="text-xs bg-amber-100 text-amber-700 border-0">{p.name.split(' ')[0]}</Badge>)}
                    <span className="text-xs text-amber-600 ml-auto">Share code: <strong>{competition.invite_code}</strong></span>
                </div>
            )}

            {/* Tabs: Hours Battle / Score Bets */}
            <Tabs defaultValue="hours">
                <TabsList className="grid grid-cols-2 bg-gray-100 p-1 rounded-2xl h-auto">
                    <TabsTrigger value="hours"
                        className="flex items-center gap-1.5 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow rounded-xl text-sm font-bold">
                        <Timer className="w-4 h-4" /> Hours Battle
                    </TabsTrigger>
                    <TabsTrigger value="bets"
                        className="flex items-center gap-1.5 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow rounded-xl text-sm font-bold">
                        <TrendingUp className="w-4 h-4" /> Score Bets
                        {(competition.progress_bets || []).length > 0 && (
                            <span className="w-5 h-5 bg-purple-100 text-purple-700 rounded-full text-xs font-black flex items-center justify-center">
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