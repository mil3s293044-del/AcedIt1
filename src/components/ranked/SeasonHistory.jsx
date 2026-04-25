import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Calendar, Trophy, Zap, Target, Swords, Star } from "lucide-react";
import { SEASONS, COMPOSITE_TIERS, getCompositeTier } from "@/components/shared/rankingEngine";

const REWARD_LABELS = {
    "season_finisher":  { label: "Season Finisher",   emoji: "🎖️", color: "bg-blue-100 text-blue-700" },
    "top10_global":     { label: "Top 10 Global",      emoji: "🌍", color: "bg-yellow-100 text-yellow-700" },
    "top100_global":    { label: "Top 100 Global",     emoji: "🏅", color: "bg-amber-100 text-amber-700" },
    "streak_warrior":   { label: "Streak Warrior",     emoji: "🔥", color: "bg-orange-100 text-orange-700" },
    "goal_crusher":     { label: "Goal Crusher",       emoji: "🎯", color: "bg-green-100 text-green-700" },
    "comp_champion":    { label: "Comp Champion",      emoji: "⚔️", color: "bg-purple-100 text-purple-700" },
};

export default function SeasonHistory() {
    const [records, setRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const user = await base44.auth.me();
                const data = await base44.entities.SeasonRecord.filter({ user_email: user.email }, "-created_date", 20);
                setRecords(data);
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    const allSeasonIds = SEASONS.map(s => s.id);

    if (isLoading) {
        return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl p-4 animate-pulse h-24" />)}</div>;
    }

    return (
        <div className="space-y-5">
            {/* Season explanation */}
            <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-violet-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-bold text-violet-900 text-sm">How Seasons Work</h3>
                        <p className="text-xs text-violet-700 mt-1 leading-relaxed">
                            Seasons align with VCE semesters (~5 months each). At season end, rankings soft-reset — you keep <strong>30% of your composite score</strong> as a prestige bonus. Your total XP is never lost. Top finishers earn exclusive badges and school recognition.
                        </p>
                    </div>
                </div>
            </div>

            {/* Upcoming seasons */}
            <div>
                <h3 className="font-bold text-gray-900 mb-3">Season Calendar</h3>
                <div className="space-y-2">
                    {SEASONS.map((season) => {
                        const record = records.find(r => r.season_id === season.id);
                        const isUpcoming = new Date(season.start) > new Date();
                        const isCurrent = new Date(season.start) <= new Date() && new Date(season.end) >= new Date();
                        const isPast = new Date(season.end) < new Date();

                        return (
                            <motion.div
                                key={season.id}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`rounded-2xl border p-4 ${isCurrent ? "border-2 border-purple-300 bg-purple-50" : "border-gray-100 bg-white"}`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${season.theme}`} />
                                            <p className="font-bold text-gray-900 text-sm">{season.name}</p>
                                            {isCurrent && <Badge className="bg-purple-200 text-purple-800 text-xs font-bold">LIVE</Badge>}
                                            {isUpcoming && <Badge className="bg-gray-100 text-gray-500 text-xs">Upcoming</Badge>}
                                            {isPast && !record && <Badge className="bg-gray-100 text-gray-400 text-xs">Missed</Badge>}
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            {new Date(season.start).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })} →{" "}
                                            {new Date(season.end).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </p>
                                    </div>

                                    {record && (
                                        <div className="text-right flex-shrink-0">
                                            <p className="text-lg font-black text-indigo-700">{record.final_composite_score || 0}</p>
                                            <p className="text-xs text-gray-400">composite</p>
                                        </div>
                                    )}
                                </div>

                                {record && (
                                    <div className="mt-3 space-y-2">
                                        <div className="grid grid-cols-4 gap-2 text-center">
                                            {[
                                                { icon: Zap,    val: (record.final_xp || 0).toLocaleString(), label: "XP",       color: "text-amber-600" },
                                                { icon: Target, val: record.goals_completed || 0,              label: "Goals",    color: "text-green-600" },
                                                { icon: Swords, val: record.competitions_won || 0,             label: "Wins",     color: "text-purple-600" },
                                                { icon: Trophy, val: record.placement ? `#${record.placement}` : "—", label: "Placement", color: "text-indigo-600" },
                                            ].map(({ icon: Icon, val, label, color }) => (
                                                <div key={label} className="bg-white rounded-xl p-2">
                                                    <Icon className={`w-3.5 h-3.5 mx-auto mb-0.5 ${color}`} />
                                                    <p className={`text-sm font-black ${color}`}>{val}</p>
                                                    <p className="text-xs text-gray-400">{label}</p>
                                                </div>
                                            ))}
                                        </div>

                                        {record.rewards_claimed?.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                                {record.rewards_claimed.map(reward => {
                                                    const meta = REWARD_LABELS[reward] || { label: reward, emoji: "🏅", color: "bg-gray-100 text-gray-600" };
                                                    return (
                                                        <span key={reward} className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.color}`}>
                                                            {meta.emoji} {meta.label}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {record.final_rank_name && (
                                            <p className="text-xs text-gray-500 text-center">
                                                Ended as <strong>{record.final_rank_name}</strong>
                                                {record.school_placement && ` · School Rank #${record.school_placement}`}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}