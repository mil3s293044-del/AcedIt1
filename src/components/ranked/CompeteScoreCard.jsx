import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Zap, Target, Flame, Loader2, TrendingUp } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { startOfWeek } from "date-fns";

// ─── Balanced weekly "Compete Score" (max 1000) ─────────────────────────────
//   Effort      (0–400) — study minutes this week, capped so grinding plateaus
//   Mastery     (0–400) — average quiz accuracy this week (reward getting it RIGHT)
//   Consistency (0–200) — active days this week + current streak
// One transparent number that rewards smart, steady study over raw grinding.

const EFFORT_MAX = 400;
const MASTERY_MAX = 400;
const CONSISTENCY_MAX = 200;
const EFFORT_MINUTES_CAP = 400; // 1 pt / min up to ~6.7h

const TIERS = [
    { min: 800, label: "Elite",         color: "text-primary" },
    { min: 600, label: "Strong",        color: "text-chart-3" },
    { min: 400, label: "Solid",         color: "text-chart-4" },
    { min: 200, label: "Building",      color: "text-xp" },
    { min: 0,   label: "Getting going", color: "text-muted-foreground" },
];
const tierFor = (s) => TIERS.find((t) => s >= t.min) || TIERS[TIERS.length - 1];

const Pillar = ({ icon: Icon, label, value, max, tone, delay }) => {
    const pct = Math.round((value / max) * 100);
    return (
        <div>
            <div className="flex items-center gap-2 mb-1.5">
                <div className={`w-6 h-6 rounded-lg ${tone.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-3.5 h-3.5 ${tone.text}`} />
                </div>
                <span className="text-xs font-bold text-foreground flex-1">{label}</span>
                <span className="text-xs font-bold text-muted-foreground tabular-nums">{value}<span className="text-muted-foreground/50"> / {max}</span></span>
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <motion.div className={`h-full rounded-full ${tone.bar}`} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: "easeOut", delay }} />
            </div>
        </div>
    );
};

export default function CompeteScoreCard() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);

    useEffect(() => {
        const load = async () => {
            try {
                const user = await base44.auth.me();
                const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString().split("T")[0];
                const [profiles, sessions, techniques, quizzes] = await Promise.all([
                    base44.entities.UserProfile.filter({ created_by: user.email }).catch(() => []),
                    base44.entities.StudySession.filter({ created_by: user.email, date: { $gte: weekStart } }).catch(() => []),
                    base44.entities.StudyTechnique.filter({ created_by: user.email, date: { $gte: weekStart } }).catch(() => []),
                    base44.entities.QuizAttempt.filter({ created_by: user.email, date: { $gte: weekStart } }).catch(() => []),
                ]);
                const profile = profiles[0] || {};

                const minutes =
                    (sessions || []).reduce((a, s) => a + (s.duration_minutes || 0), 0) +
                    (techniques || []).reduce((a, t) => a + (t.session_duration || 0), 0);

                const quizScores = (quizzes || []).map((q) => q.score).filter((s) => typeof s === "number");
                const avgAccuracy = quizScores.length ? quizScores.reduce((a, b) => a + b, 0) / quizScores.length : 0;

                const activeDays = new Set([
                    ...(sessions || []).map((s) => s.date),
                    ...(techniques || []).map((t) => t.date),
                    ...(quizzes || []).map((q) => q.date),
                ].filter(Boolean)).size;

                const streak = profile.streak_days || 0;

                const effort = Math.round(Math.min(minutes, EFFORT_MINUTES_CAP) / EFFORT_MINUTES_CAP * EFFORT_MAX);
                const mastery = Math.round((avgAccuracy / 100) * MASTERY_MAX);
                const consistency = Math.round(Math.min(activeDays / 7, 1) * 150 + Math.min(streak / 14, 1) * 50);
                const total = effort + mastery + consistency;

                setData({ effort, mastery, consistency, total, minutes, avgAccuracy, quizCount: quizScores.length, activeDays, streak });
            } catch {
                setData({ effort: 0, mastery: 0, consistency: 0, total: 0, minutes: 0, avgAccuracy: 0, quizCount: 0, activeDays: 0, streak: 0 });
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    if (loading) {
        return (
            <div className="card-soft p-8 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
        );
    }

    const tier = tierFor(data.total);

    return (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card-soft overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-5">
                {/* Score */}
                <div className="sm:col-span-2 p-6 flex flex-col items-center justify-center text-center border-b sm:border-b-0 sm:border-r border-border bg-secondary/30">
                    <p className="stat-label text-muted-foreground mb-1">This week's Compete Score</p>
                    <p className="font-display font-black text-6xl text-foreground leading-none tabular-nums">{data.total}</p>
                    <p className={`mt-2 font-display font-extrabold text-lg ${tier.color}`}>{tier.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">of 1000 · resets Monday</p>
                </div>

                {/* Breakdown */}
                <div className="sm:col-span-3 p-6 space-y-4">
                    <Pillar icon={Zap} label="Effort" value={data.effort} max={EFFORT_MAX} delay={0.05}
                        tone={{ bg: "bg-primary/15", text: "text-primary", bar: "bg-primary" }} />
                    <Pillar icon={Target} label="Mastery" value={data.mastery} max={MASTERY_MAX} delay={0.12}
                        tone={{ bg: "bg-chart-3/15", text: "text-chart-3", bar: "bg-chart-3" }} />
                    <Pillar icon={Flame} label="Consistency" value={data.consistency} max={CONSISTENCY_MAX} delay={0.19}
                        tone={{ bg: "bg-xp/15", text: "text-xp", bar: "bg-xp" }} />

                    <p className="text-xs text-muted-foreground pt-1 leading-relaxed flex items-start gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                        {data.quizCount === 0
                            ? "Take a quiz this week to start earning Mastery points — accuracy counts for the most."
                            : `${Math.round(data.avgAccuracy)}% quiz accuracy · ${data.activeDays} active day${data.activeDays === 1 ? "" : "s"} · ${Math.round(data.minutes)} min studied.`}
                    </p>
                </div>
            </div>
        </motion.div>
    );
}
