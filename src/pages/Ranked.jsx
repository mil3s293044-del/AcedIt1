import React, { useState } from "react";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Users, School, Sparkles, Flame, Trophy } from 'lucide-react';

import GamifiedMyRank from '../components/ranked/GamifiedMyRank';
import CompetitiveLeaderboard from '../components/ranked/CompetitiveLeaderboard';
import SchoolLeaderboard from '../components/ranked/SchoolLeaderboard';
import PerksSystem from '../components/ranked/PerksSystem';
import { useEffect } from "react";
import { base44 } from "@/api/base44Client";
import HelpButton from "@/components/shared/HelpButton";

export default function RankedPage() {
    const [totalXP, setTotalXP] = useState(0);
    const [streakDays, setStreakDays] = useState(0);

    useEffect(() => {
        const load = async () => {
            const user = await base44.auth.me();
            const profiles = await base44.entities.UserProfile.filter({ created_by: user.email }).catch(() => []);
            const p = profiles[0];
            if (p) { setTotalXP(p.total_xp || 0); setStreakDays(p.streak_days || 0); }
        };
        load();
    }, []);

    return (
        <div className="px-4 lg:px-8 py-6">
            <div className="w-full max-w-[1400px] mx-auto">
                <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-200">
                            <Trophy className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl lg:text-3xl font-black text-gray-900">Ranked</h1>
                            <p className="text-gray-500 text-sm">XP · Streaks · Perks · Leaderboards</p>
                        </div>
                        <HelpButton page="Ranked" />
                    </div>
                    {streakDays > 0 && (
                        <div className="mt-3 flex items-center gap-2 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl px-4 py-2.5">
                            <Flame className="w-4 h-4 text-orange-500" />
                            <span className="text-sm font-bold text-orange-800">
                                {streakDays} day streak active!
                            </span>
                            <span className="text-xs text-orange-600 ml-1">
                                {streakDays >= 30 ? '2.5×' : streakDays >= 21 ? '2.0×' : streakDays >= 14 ? '1.75×' : streakDays >= 7 ? '1.5×' : streakDays >= 3 ? '1.2×' : '1.0×'} XP multiplier
                            </span>
                        </div>
                    )}
                </motion.div>

                <Tabs defaultValue="my-rank" className="space-y-5">
                    <TabsList className="grid w-full grid-cols-4 bg-white/60 backdrop-blur-sm p-1.5 h-auto border border-gray-200 shadow-sm rounded-xl">
                        <TabsTrigger value="my-rank" className="flex items-center gap-1.5 py-2.5 px-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg text-gray-600 data-[state=active]:text-gray-900 font-medium text-xs lg:text-sm">
                            <TrendingUp className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">My Rank</span>
                            <span className="sm:hidden">Me</span>
                        </TabsTrigger>
                        <TabsTrigger value="leaderboard" className="flex items-center gap-1.5 py-2.5 px-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg text-gray-600 data-[state=active]:text-gray-900 font-medium text-xs lg:text-sm">
                            <Users className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Leaderboard</span>
                            <span className="sm:hidden">Board</span>
                        </TabsTrigger>
                        <TabsTrigger value="perks" className="flex items-center gap-1.5 py-2.5 px-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg text-gray-600 data-[state=active]:text-gray-900 font-medium text-xs lg:text-sm">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Perks</span>
                            <span className="sm:hidden">Perks</span>
                        </TabsTrigger>
                        <TabsTrigger value="schools" className="flex items-center gap-1.5 py-2.5 px-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg text-gray-600 data-[state=active]:text-gray-900 font-medium text-xs lg:text-sm">
                            <School className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Schools</span>
                            <span className="sm:hidden">Sch.</span>
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="my-rank"><GamifiedMyRank /></TabsContent>
                    <TabsContent value="leaderboard"><CompetitiveLeaderboard /></TabsContent>
                    <TabsContent value="perks"><PerksSystem totalXP={totalXP} /></TabsContent>
                    <TabsContent value="schools"><SchoolLeaderboard /></TabsContent>
                </Tabs>
            </div>
        </div>
    );
}