import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Users, School, Sparkles, Flame, Trophy } from 'lucide-react';

import GamifiedMyRank from '../components/ranked/GamifiedMyRank';
import CompetitiveLeaderboard from '../components/ranked/CompetitiveLeaderboard';
import SchoolLeaderboard from '../components/ranked/SchoolLeaderboard';
import PerksSystem from '../components/ranked/PerksSystem';
import { base44 } from "@/api/base44Client";
import HelpButton from "@/components/shared/HelpButton";

function getStreakMultiplier(days) {
    if (days >= 30) return '2.5×';
    if (days >= 21) return '2.0×';
    if (days >= 14) return '1.75×';
    if (days >= 7)  return '1.5×';
    if (days >= 3)  return '1.2×';
    return '1.0×';
}

const TABS = [
    { value: 'my-rank',     icon: TrendingUp, label: 'My Rank',     short: 'Me' },
    { value: 'leaderboard', icon: Users,      label: 'Leaderboard', short: 'Board' },
    { value: 'perks',       icon: Sparkles,   label: 'Perks',       short: 'Perks' },
    { value: 'schools',     icon: School,     label: 'Schools',     short: 'Sch.' },
];

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
        <div className="min-h-screen bg-background">
            <div className="max-w-6xl mx-auto px-4 lg:px-8 py-6 lg:py-8 space-y-6">

                {/* ── HERO ──────────────────────────────────────────────── */}
                <motion.section
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35 }}
                >
                    <div className="flex items-start justify-between mb-1">
                        <p className="text-sm text-muted-foreground font-medium">Compete</p>
                        <HelpButton page="Ranked" />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-xp/10 flex items-center justify-center flex-shrink-0">
                            <Trophy className="w-6 h-6 text-xp" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="font-display text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground">
                                Ranked
                            </h1>
                            <p className="text-muted-foreground text-sm mt-0.5">
                                XP, streaks, perks, and leaderboards.
                            </p>
                        </div>
                    </div>

                    {streakDays > 0 && (
                        <div className="mt-4 inline-flex items-center gap-2.5 bg-streak/10 border-2 border-streak/20 rounded-xl px-4 py-2.5">
                            <Flame className="w-4 h-4 text-streak" />
                            <span className="text-sm font-bold text-foreground">
                                {streakDays} day streak active
                            </span>
                            <span className="pill bg-streak/15 text-streak text-[11px] py-0.5">
                                {getStreakMultiplier(streakDays)} XP
                            </span>
                        </div>
                    )}
                </motion.section>

                {/* ── TABS ──────────────────────────────────────────────── */}
                <Tabs defaultValue="my-rank" className="space-y-5">
                    <TabsList className="grid w-full grid-cols-4 h-auto p-1.5 rounded-2xl bg-surface border-2 border-border shadow-soft">
                        {TABS.map(({ value, icon: Icon, label, short }) => (
                            <TabsTrigger
                                key={value}
                                value={value}
                                className="flex items-center gap-1.5 py-2.5 px-2 rounded-xl text-xs lg:text-sm font-bold text-muted-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-soft transition-all"
                            >
                                <Icon className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">{label}</span>
                                <span className="sm:hidden">{short}</span>
                            </TabsTrigger>
                        ))}
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
