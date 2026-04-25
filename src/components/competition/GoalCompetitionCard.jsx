import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Trophy, Users, Zap, Clock, Crown, Target, Flame } from "lucide-react";
import { format, isPast, parseISO } from "date-fns";

const statusColors = {
    active: "bg-green-100 text-green-700 border-green-200",
    pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
    completed: "bg-purple-100 text-purple-700 border-purple-200",
    cancelled: "bg-gray-100 text-gray-500 border-gray-200"
};

export default function GoalCompetitionCard({ competition, currentUserEmail, onView }) {
    const accepted = (competition.participants || []).filter(p => p.status === 'accepted' || p.status === 'completed');
    const myParticipant = competition.participants?.find(p => p.email === currentUserEmail);

    // Sort by progress → XP → speed
    const ranked = [...accepted].sort((a, b) => {
        if (b.progress_percent !== a.progress_percent) return b.progress_percent - a.progress_percent;
        if (b.xp_earned !== a.xp_earned) return b.xp_earned - a.xp_earned;
        return (b.study_minutes || 0) - (a.study_minutes || 0);
    });

    const myRank = ranked.findIndex(p => p.email === currentUserEmail) + 1;
    const leader = ranked[0];
    const isCompleted = competition.status === 'completed';

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className={`border-2 hover:shadow-lg transition-all cursor-pointer ${
                isCompleted ? 'border-purple-200 bg-purple-50/30' : 'border-indigo-200 bg-gradient-to-br from-white to-indigo-50/30'
            }`} onClick={onView}>
                <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                <Badge className={`text-xs border ${statusColors[competition.status]}`}>
                                    {competition.status}
                                </Badge>
                                {myRank === 1 && !isCompleted && accepted.length > 1 && (
                                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
                                        <Crown className="w-3 h-3 mr-1" /> Leading
                                    </Badge>
                                )}
                            </div>
                            <h3 className="font-bold text-gray-900 truncate">{competition.goal_title}</h3>
                            <p className="text-xs text-gray-500 mt-0.5">by {competition.creator_name}</p>
                        </div>
                        <div className="flex items-center gap-1 text-gray-500 text-sm ml-3">
                            <Users className="w-4 h-4" />
                            <span className="font-semibold">{accepted.length}</span>
                        </div>
                    </div>

                    {/* My progress */}
                    {myParticipant && (
                        <div className="mb-3">
                            <div className="flex justify-between text-xs text-gray-600 mb-1">
                                <span>Your progress</span>
                                <span className="font-bold">{Math.round(myParticipant.progress_percent || 0)}%</span>
                            </div>
                            <Progress value={myParticipant.progress_percent || 0} className="h-2" />
                        </div>
                    )}

                    {/* Mini leaderboard */}
                    <div className="space-y-1.5">
                        {ranked.slice(0, 3).map((p, i) => (
                            <div key={p.email} className={`flex items-center gap-2 text-xs rounded-lg px-2 py-1 ${
                                p.email === currentUserEmail ? 'bg-indigo-100 font-semibold' : 'bg-white/60'
                            }`}>
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
                                    i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-gray-400' : 'bg-orange-400'
                                }`}>{i + 1}</span>
                                <span className="flex-1 truncate">{p.name.split(' ')[0]}</span>
                                <div className="flex items-center gap-2 text-gray-600">
                                    <span className="flex items-center gap-0.5"><Zap className="w-3 h-3 text-amber-500" />{p.xp_earned || 0}</span>
                                    <span className="flex items-center gap-0.5"><Target className="w-3 h-3 text-indigo-500" />{Math.round(p.progress_percent || 0)}%</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {competition.goal_target_date && (
                        <div className="mt-3 flex items-center gap-1 text-xs text-gray-500">
                            <Clock className="w-3 h-3" />
                            <span>Deadline: {format(parseISO(competition.goal_target_date), 'MMM d, yyyy')}</span>
                            {isPast(parseISO(competition.goal_target_date)) && <Badge className="bg-red-100 text-red-600 text-xs ml-1">Overdue</Badge>}
                        </div>
                    )}

                    {isCompleted && competition.winner_name && (
                        <div className="mt-3 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                            <Trophy className="w-4 h-4 text-amber-600 flex-shrink-0" />
                            <span className="text-xs font-bold text-amber-800">Winner: {competition.winner_name}</span>
                        </div>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    );
}