import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Trophy, Swords, Users, Crown, Activity, ClipboardList, Settings as SettingsIcon,
    LogIn, Loader2, Clock, ChevronRight, ArrowRight, TrendingUp
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import GoalCompetitionDetail from "@/components/competition/GoalCompetitionDetail";
import { joinGoalCompetition } from "@/api/functionsShim";
import HelpButton from "@/components/shared/HelpButton";
import EmptyState from "@/components/shared/EmptyState";
import { getSeasonRankFromXP } from "@/components/shared/xpSystem";
import { format, isPast, parseISO } from "date-fns";

// Battles now rank by Compete Score; fall back to legacy progress for old data.
const rankVal = (p) => (p?.compete_score ?? p?.progress_percent ?? 0);

// ─── Coach voice ──────────────────────────────────────────────────────────────
function getCoachLine({ name, hour, total, active, leading, behind, recentWins }) {
    const period = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : hour < 21 ? "Evening" : "Late night";
    if (total === 0) return `${period}, ${name}. No competitions yet — challenge a friend from any goal.`;
    if (active === 0 && recentWins > 0) return `${period}, ${name}. ${recentWins} win${recentWins === 1 ? '' : 's'} under your belt. Time for another.`;
    if (active === 0) return `${period}, ${name}. Nothing live right now — let's get a battle going.`;
    if (behind > 0 && behind === active) return `${period}, ${name}. You're behind in every active comp. Time to push.`;
    if (behind > 0 && leading > 0) return `${period}, ${name}. Leading ${leading}, behind in ${behind}. Mixed bag — focus on the gap.`;
    if (leading === active) return `${period}, ${name}. Leading every active comp. Hold position.`;
    if (leading > 0) return `${period}, ${name}. Leading ${leading} of ${active} battles. Keep building.`;
    return `${period}, ${name}. ${active} live battle${active === 1 ? '' : 's'} on the board.`;
}

// ─── CompCard ────────────────────────────────────────────────────────────────
function CompCard({ comp, currentUserEmail, onClick }) {
    const accepted = (comp.participants || []).filter(p => p.status === 'accepted' || p.status === 'completed');
    const me = comp.participants?.find(p => p.email === currentUserEmail);
    const ranked = [...accepted].sort((a, b) => rankVal(b) - rankVal(a));
    const myRank = ranked.findIndex(p => p.email === currentUserEmail) + 1;
    const isCompleted = comp.status === 'completed';
    const isLeading = myRank === 1 && !isCompleted && accepted.length > 1;
    const myScore = Math.round(rankVal(me));
    const leaderScore = Math.round(rankVal(ranked[0])) || 1;
    const myPct = Math.min(100, Math.round((myScore / leaderScore) * 100));
    // Live rivalry: who's just above (chasing) or just below (defending)?
    const rival = isLeading ? ranked[1] : ranked[0];
    const gap = rival ? Math.abs(Math.round(rankVal(me) - rankVal(rival))) : 0;
    const overdue = comp.goal_target_date && isPast(parseISO(comp.goal_target_date)) && !isCompleted;

    // Token-tinted shell based on state
    const shell = isCompleted
        ? "bg-chart-4/5 border-chart-4/25"
        : isLeading
            ? "bg-xp/5 border-xp/30"
            : overdue
                ? "bg-streak/5 border-streak/25"
                : "bg-chart-3/5 border-chart-3/25";

    const accentColor = isCompleted ? "text-chart-4" : isLeading ? "text-xp" : overdue ? "text-streak" : "text-chart-3";

    return (
        <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={onClick}
            className={`relative text-left rounded-2xl border-2 p-5 hover:shadow-soft transition-all group w-full ${shell}`}
        >
            {/* State indicator */}
            {!isCompleted && (
                <div className="absolute top-4 right-4 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full animate-soft-pulse ${overdue ? 'bg-streak' : 'bg-primary'}`} />
                    <span className={`text-xs font-extrabold ${overdue ? 'text-streak' : 'text-primary'}`}>{overdue ? 'Overdue' : 'Live'}</span>
                </div>
            )}
            {isCompleted && (
                <div className="absolute top-4 right-4 inline-flex items-center gap-1 pill bg-chart-4/15 text-chart-4">
                    <Trophy className="w-3 h-3" /> Settled
                </div>
            )}

            <div className="mb-3 pr-20">
                <h3 className="font-display font-extrabold text-foreground text-base leading-tight truncate">{comp.goal_title}</h3>
                <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1">
                    by {comp.creator_name} <span className="text-muted-foreground/40">·</span> <Users className="w-3 h-3" /> {accepted.length}
                </p>
            </div>

            {/* My progress bar */}
            {me && (
                <div className="mb-4">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-bold text-muted-foreground">Your score</span>
                        <div className="flex items-center gap-2">
                            {isLeading && (
                                <span className="inline-flex items-center gap-1 font-extrabold text-xp">
                                    <Crown className="w-3 h-3" /> Leading
                                </span>
                            )}
                            <span className={`font-display font-extrabold text-base ${accentColor}`}>{myScore} pts</span>
                        </div>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${myPct}%` }}
                            transition={{ duration: 0.9, ease: "easeOut" }}
                            className={`h-full rounded-full ${isLeading ? 'bg-xp' : overdue ? 'bg-streak' : 'bg-chart-3'}`}
                        />
                    </div>
                </div>
            )}

            {/* Mini leaderboard */}
            <div className="space-y-1.5">
                {ranked.slice(0, 3).map((p, i) => {
                    const placeBg = i === 0 ? 'bg-xp text-background' : i === 1 ? 'bg-secondary text-foreground' : 'bg-streak/80 text-background';
                    const isMe = p.email === currentUserEmail;
                    return (
                        <div
                            key={p.email}
                            className={`flex items-center gap-2 text-xs rounded-xl px-2.5 py-1.5 ${isMe ? 'bg-primary/15 ring-1 ring-primary/30 font-bold' : 'bg-surface'}`}
                        >
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-extrabold flex-shrink-0 ${placeBg}`}>{i + 1}</div>
                            <span className="flex-1 truncate text-foreground">{p.name?.split(' ')[0]}</span>
                            <span className="text-chart-3 font-bold">{Math.round(rankVal(p))} pts</span>
                        </div>
                    );
                })}
            </div>

            {/* Live rivalry alert — push the user to study */}
            {!isCompleted && accepted.length > 1 && rival && (
                <div className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${isLeading ? 'bg-primary/10 text-primary' : 'bg-streak/10 text-streak'}`}>
                    {isLeading
                        ? <><Crown className="w-3.5 h-3.5 flex-shrink-0" /> {rival.name?.split(' ')[0]} is {gap} pts behind — defend your lead</>
                        : <><TrendingUp className="w-3.5 h-3.5 flex-shrink-0" /> {gap} pts behind {rival.name?.split(' ')[0]} — catch up!</>}
                </div>
            )}

            {isCompleted && comp.winner_name && (
                <div className="mt-3 inline-flex items-center gap-2 bg-xp/10 border-2 border-xp/25 rounded-xl px-3 py-1.5">
                    <Trophy className="w-3.5 h-3.5 text-xp" />
                    <span className="text-xs font-bold text-foreground">{comp.winner_name} took it</span>
                </div>
            )}

            {comp.goal_target_date && (
                <div className="mt-2.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {format(parseISO(comp.goal_target_date), 'MMM d, yyyy')}
                </div>
            )}

            <ChevronRight className="absolute bottom-5 right-4 w-4 h-4 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
        </motion.button>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Competitions() {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [competitions, setCompetitions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedComp, setSelectedComp] = useState(null);
    const [inviteCode, setInviteCode] = useState("");
    const [joiningCode, setJoiningCode] = useState(false);
    const [joinSetupChoice, setJoinSetupChoice] = useState(null);
    const [pendingJoinCode, setPendingJoinCode] = useState(null);
    const { toast } = useToast();

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const u = await base44.auth.me();
            setUser(u);
            const [allComps, profiles] = await Promise.all([
                base44.entities.GoalCompetition.list('-created_date', 50),
                base44.entities.UserProfile.filter({ created_by: u.email }),
            ]);
            const myComps = allComps.filter(c => c.creator_email === u.email || (c.participants || []).some(p => p.email === u.email));
            setCompetitions(myComps);
            setUserProfile(profiles[0] || null);

            // Auto-sync hours for all active competitions the user is in
            const activeMyComps = myComps.filter(c => c.status === 'active');
            for (const comp of activeMyComps) {
                const me = (comp.participants || []).find(p => p.email === u.email);
                if (me?.status === 'accepted') {
                    base44.functions.invoke('updateCompetitionProgress', { competition_id: comp.id }).catch(() => {});
                }
            }
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    };

    const handleJoinByCode = async () => {
        if (!inviteCode.trim()) return;
        setPendingJoinCode(inviteCode.trim().toUpperCase());
        setJoinSetupChoice('prompt');
    };

    const confirmJoin = async (useOwnSetup) => {
        setJoiningCode(true);
        setJoinSetupChoice(null);
        try {
            const res = await joinGoalCompetition({ invite_code: pendingJoinCode, use_own_setup: useOwnSetup });
            const data = res?.data ?? res;
            if (data?.error) {
                toast({ title: "Could not join", description: data.error, variant: "destructive" });
            } else {
                toast({ title: "Joined! You're in.", description: "Good luck out there." });
                setInviteCode(""); setPendingJoinCode(null);
                await loadData();
            }
        } catch (e) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally { setJoiningCode(false); }
    };

    // ─── Derived stats ────────────────────────────────────────────────────────
    const stats = useMemo(() => {
        const myEmail = user?.email;
        const active = competitions.filter(c => c.status === 'active' || c.status === 'pending');
        const completed = competitions.filter(c => c.status === 'completed');
        const recentWins = completed.filter(c => c.winner_email === myEmail).length;

        let leading = 0, behind = 0;
        active.forEach(c => {
            const accepted = (c.participants || []).filter(p => p.status === 'accepted' || p.status === 'completed');
            if (accepted.length < 2) return;
            const ranked = [...accepted].sort((a, b) => rankVal(b) - rankVal(a));
            const myIdx = ranked.findIndex(p => p.email === myEmail);
            if (myIdx === 0) leading++;
            else if (myIdx > 0) behind++;
        });

        // Current win streak — consecutive wins from the most recent settled battle.
        const settledByDate = [...completed].sort((a, b) =>
            new Date(b.completed_at || b.updated_date || 0) - new Date(a.completed_at || a.updated_date || 0));
        let winStreak = 0;
        for (const c of settledByDate) {
            if (c.winner_email === myEmail) winStreak++; else break;
        }

        // Head-to-head rivalries from settled battles.
        const rivalMap = {};
        completed.forEach(c => {
            const iWon = c.winner_email === myEmail;
            (c.participants || []).filter(p => p.email && p.email !== myEmail).forEach(p => {
                if (!rivalMap[p.email]) rivalMap[p.email] = { email: p.email, name: p.name, wins: 0, losses: 0 };
                if (iWon) rivalMap[p.email].wins++;
                else if (c.winner_email === p.email) rivalMap[p.email].losses++;
            });
        });
        const rivals = Object.values(rivalMap)
            .map(r => ({ ...r, games: r.wins + r.losses }))
            .filter(r => r.games > 0)
            .sort((a, b) => b.games - a.games)
            .slice(0, 4);

        return { active, completed, recentWins, leading, behind, winStreak, rivals };
    }, [competitions, user]);

    const firstName = userProfile?.username || user?.full_name?.split(' ')[0] || 'friend';
    const hour = new Date().getHours();
    const coachLine = getCoachLine({
        name: firstName,
        hour,
        total: competitions.length,
        active: stats.active.length,
        leading: stats.leading,
        behind: stats.behind,
        recentWins: stats.recentWins,
    });
    const seasonRank = userProfile ? getSeasonRankFromXP(userProfile.season_xp || 0) : null;
    const seasonXp = userProfile?.season_xp || 0;

    // Featured: most-active comp where user is behind, OR most recent active
    const focus = useMemo(() => {
        if (stats.active.length === 0) return null;
        const sorted = [...stats.active].sort((a, b) => {
            const am = (a.participants || []).find(p => p.email === user?.email);
            const bm = (b.participants || []).find(p => p.email === user?.email);
            return (am?.progress_percent || 0) - (bm?.progress_percent || 0);
        });
        const target = sorted[0];
        const me = (target.participants || []).find(p => p.email === user?.email);
        const accepted = (target.participants || []).filter(p => p.status === 'accepted' || p.status === 'completed');
        const ranked = [...accepted].sort((a, b) => (b.progress_percent || 0) - (a.progress_percent || 0));
        const myIdx = ranked.findIndex(p => p.email === user?.email);
        const leader = ranked[0];
        const isLeading = myIdx === 0;

        if (isLeading) {
            return {
                label: "You're leading",
                title: `Hold the lead in "${target.goal_title}"`,
                sub: `${Math.round(me?.progress_percent || 0)}% done. ${ranked.length > 1 ? `${ranked[1].name?.split(' ')[0]} is at ${Math.round(ranked[1].progress_percent || 0)}%.` : 'You\'re alone — finish strong.'}`,
                accent: "xp",
                icon: Crown,
                comp: target,
            };
        }
        return {
            label: leader ? `${leader.name?.split(' ')[0]} is ahead` : "Time to focus",
            title: `Catch up on "${target.goal_title}"`,
            sub: `You're at ${Math.round(me?.progress_percent || 0)}%. ${leader ? `${leader.name?.split(' ')[0]} is at ${Math.round(leader.progress_percent || 0)}% — ${Math.round((leader.progress_percent || 0) - (me?.progress_percent || 0))}pp gap.` : ''}`,
            accent: "chart-3",
            icon: Swords,
            comp: target,
        };
    }, [stats, user]);

    // Direction A: lighter tints, 1px borders, shadow-soft for depth.
    const FOCUS_THEME = {
        xp:        { bg: "bg-xp/5",         border: "border-xp/15",        iconBg: "bg-xp/10",        iconText: "text-xp"        },
        "chart-3": { bg: "bg-chart-3/5",    border: "border-chart-3/15",   iconBg: "bg-chart-3/10",   iconText: "text-chart-3"   },
        streak:    { bg: "bg-streak/5",     border: "border-streak/15",    iconBg: "bg-streak/10",    iconText: "text-streak"    },
        "chart-4": { bg: "bg-chart-4/5",    border: "border-chart-4/15",   iconBg: "bg-chart-4/10",   iconText: "text-chart-4"   },
        primary:   { bg: "bg-primary/5",    border: "border-primary/15",   iconBg: "bg-primary/10",   iconText: "text-primary"   },
    };

    // Hall of Fame stats — derived from existing data, no new schema needed.
    const winRate = stats.completed.length > 0
        ? Math.round((stats.recentWins / stats.completed.length) * 100)
        : 0;

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 text-chart-4 animate-spin mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">Loading…</p>
                </div>
            </div>
        );
    }

    if (selectedComp) {
        return (
            <div className="min-h-screen bg-background">
                <div className="max-w-3xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
                    <GoalCompetitionDetail
                        competition={selectedComp}
                        currentUserEmail={user?.email}
                        onBack={() => { setSelectedComp(null); loadData(); }}
                        onUpdate={loadData}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-6xl mx-auto px-4 lg:px-8 py-6 lg:py-10 space-y-6 lg:space-y-8">

                {/* ── COACH STRIP ─────────────────────────────────────── */}
                <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-xs">
                            <span className="font-bold text-muted-foreground uppercase tracking-wider">Compete</span>
                            {stats.active.length > 0 && (
                                <>
                                    <span className="text-muted-foreground/40">·</span>
                                    <span className="inline-flex items-center gap-1 font-extrabold text-chart-3">
                                        <Activity className="w-3.5 h-3.5" /> {stats.active.length} live
                                    </span>
                                </>
                            )}
                            {stats.recentWins > 0 && (
                                <>
                                    <span className="text-muted-foreground/40">·</span>
                                    <span className="inline-flex items-center gap-1 font-extrabold text-xp">
                                        <Trophy className="w-3.5 h-3.5" /> {stats.recentWins} won
                                    </span>
                                </>
                            )}
                        </div>
                        <HelpButton page="Competitions" />
                    </div>
                    <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                        {coachLine}
                    </h1>
                </motion.section>

                {/* ── HERO ROW: Season rank (3/5) + Stats (2/5) ───────── */}
                <motion.section
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="grid grid-cols-1 md:grid-cols-5 gap-5 lg:gap-6"
                >
                    {/* Season rank poster — Direction A */}
                    <div className="md:col-span-3">
                        <div className="relative overflow-hidden rounded-2xl bg-chart-4/5 border border-chart-4/15 shadow-soft p-6 lg:p-8 h-full">
                            <Trophy className="absolute -top-4 -right-4 w-32 h-32 text-chart-4/[0.08] pointer-events-none" />
                            <p className="stat-label text-chart-4/80 mb-2">Season rank</p>
                            <h2
                                className="font-display font-extrabold text-foreground leading-none mb-3"
                                style={{ fontSize: 'clamp(2rem, 5.5vw, 3.5rem)' }}
                            >
                                {seasonRank?.name || 'Unranked'}
                            </h2>
                            <p className="text-sm text-muted-foreground mb-4">
                                {seasonXp.toLocaleString()} season XP{seasonRank?.maxXP && seasonRank.maxXP !== Infinity ? ` · ${(seasonRank.maxXP - seasonXp).toLocaleString()} to next tier` : ''}
                            </p>
                            {seasonRank?.maxXP && seasonRank.maxXP !== Infinity && (
                                <div className="h-2 bg-chart-4/10 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.min(100, ((seasonXp - seasonRank.minXP) / (seasonRank.maxXP - seasonRank.minXP)) * 100)}%` }}
                                        transition={{ duration: 0.9, delay: 0.4 }}
                                        className="h-full rounded-full bg-chart-4"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Hall of Fame panel — W-L record + live battle status */}
                    <div className="md:col-span-2">
                        <div className="rounded-2xl bg-primary/5 border border-primary/15 shadow-soft p-6 h-full flex flex-col">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Swords className="w-4 h-4 text-primary" />
                                    <p className="stat-label text-primary/80">Hall of fame</p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {stats.winStreak > 1 && (
                                        <span className="pill bg-xp/15 text-xp text-[10px]">🔥 {stats.winStreak} streak</span>
                                    )}
                                    {stats.completed.length > 0 && (
                                        <span className="pill bg-primary/10 text-primary text-[10px]">
                                            {winRate}% win rate
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 mb-auto">
                                <div>
                                    <p className="font-display font-extrabold text-primary leading-none text-3xl lg:text-4xl">{stats.recentWins}</p>
                                    <p className="text-xs font-bold text-muted-foreground mt-1">Wins</p>
                                </div>
                                <div>
                                    <p className="font-display font-extrabold text-muted-foreground leading-none text-3xl lg:text-4xl">{stats.completed.length - stats.recentWins}</p>
                                    <p className="text-xs font-bold text-muted-foreground mt-1">Losses</p>
                                </div>
                            </div>
                            {stats.active.length > 0 && (
                                <div className="mt-5 pt-4 border-t border-primary/10 space-y-1.5">
                                    <div className="flex items-baseline justify-between">
                                        <p className="text-xs font-bold text-muted-foreground inline-flex items-center gap-1">
                                            <Crown className="w-3 h-3 text-xp" /> Leading now
                                        </p>
                                        <p className="text-xs font-extrabold text-foreground">{stats.leading}</p>
                                    </div>
                                    <div className="flex items-baseline justify-between">
                                        <p className="text-xs font-bold text-muted-foreground inline-flex items-center gap-1">
                                            <Activity className="w-3 h-3 text-chart-3" /> Catching up
                                        </p>
                                        <p className="text-xs font-extrabold text-foreground">{stats.behind}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.section>

                {/* ── FOCUS PANEL ─────────────────────────────────────── */}
                {focus && (
                    <motion.section
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <div className={`rounded-2xl ${FOCUS_THEME[focus.accent].bg} border ${FOCUS_THEME[focus.accent].border} shadow-soft p-5 lg:p-6`}>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                <div className={`w-12 h-12 rounded-xl ${FOCUS_THEME[focus.accent].iconBg} flex items-center justify-center flex-shrink-0`}>
                                    <focus.icon className={`w-6 h-6 ${FOCUS_THEME[focus.accent].iconText}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="stat-label mb-1">Today's focus · {focus.label}</p>
                                    <h2 className="font-display font-extrabold text-foreground text-base lg:text-lg leading-snug">
                                        {focus.title}
                                    </h2>
                                    <p className="text-muted-foreground text-sm mt-0.5">{focus.sub}</p>
                                </div>
                                <Button
                                    onClick={() => setSelectedComp(focus.comp)}
                                    className="w-full sm:w-auto flex-shrink-0"
                                >
                                    Open battle <ArrowRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </motion.section>
                )}

                {/* ── RIVALRIES (head-to-head records) ────────────────── */}
                {stats.rivals.length > 0 && (
                    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
                        <div className="flex items-center gap-2 mb-3">
                            <Swords className="w-4 h-4 text-muted-foreground" />
                            <p className="stat-label">Your rivalries</p>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {stats.rivals.map(r => {
                                const ahead = r.wins > r.losses;
                                const even = r.wins === r.losses;
                                return (
                                    <div key={r.email} className="card-soft p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-xs font-bold text-foreground flex-shrink-0">{(r.name || '?').slice(0, 2).toUpperCase()}</div>
                                            <p className="font-bold text-foreground text-sm truncate">{r.name?.split(' ')[0]}</p>
                                        </div>
                                        <p className="font-display font-extrabold text-lg leading-none">
                                            <span className="text-primary">{r.wins}</span>
                                            <span className="text-muted-foreground/50"> – </span>
                                            <span className="text-streak">{r.losses}</span>
                                        </p>
                                        <p className={`text-xs font-bold mt-1 ${ahead ? 'text-primary' : even ? 'text-muted-foreground' : 'text-streak'}`}>
                                            {ahead ? 'You lead' : even ? 'Dead even' : 'They lead'}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.section>
                )}

                {/* ── JOIN CODE BAR ───────────────────────────────────── */}
                <motion.section
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="card-soft p-4 lg:p-5"
                >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <div className="flex items-center gap-2.5 flex-1">
                            <div className="w-9 h-9 rounded-xl bg-chart-3/10 border border-chart-3/15 flex items-center justify-center flex-shrink-0">
                                <LogIn className="w-4 h-4 text-chart-3" />
                            </div>
                            <div className="min-w-0">
                                <p className="font-bold text-foreground text-sm">Got an invite code?</p>
                                <p className="text-xs text-muted-foreground">Drop it below to join a friend's battle.</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <Input
                                placeholder="ABCD12"
                                value={inviteCode}
                                onChange={e => setInviteCode(e.target.value.toUpperCase())}
                                onKeyDown={e => e.key === 'Enter' && handleJoinByCode()}
                                className="w-full sm:w-32 font-mono uppercase text-center tracking-widest"
                                maxLength={6}
                            />
                            <Button onClick={handleJoinByCode} disabled={joiningCode || !inviteCode.trim()}>
                                {joiningCode ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Join <ArrowRight className="w-4 h-4" /></>}
                            </Button>
                        </div>
                    </div>
                </motion.section>

                {/* ── COMPETITIONS LIST ───────────────────────────────── */}
                {competitions.length === 0 ? (
                    <motion.section
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="rounded-2xl bg-surface border border-dashed border-border shadow-soft"
                    >
                        <EmptyState
                            icon={Swords}
                            title="No battles yet"
                            description="Open any goal and tap “Compete with friends” to challenge them — or paste an invite code above to join one."
                            tone="muted"
                        />
                    </motion.section>
                ) : (
                    <div className="space-y-6">
                        {stats.active.length > 0 && (
                            <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="w-2 h-2 bg-primary rounded-full animate-soft-pulse" />
                                    <h2 className="font-display font-extrabold text-foreground text-lg lg:text-xl">
                                        Live battles
                                    </h2>
                                    <span className="pill bg-primary/15 text-primary">{stats.active.length}</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {stats.active.map(c => (
                                        <CompCard key={c.id} comp={c} currentUserEmail={user?.email} onClick={() => setSelectedComp(c)} />
                                    ))}
                                </div>
                            </motion.section>
                        )}

                        {stats.completed.length > 0 && (
                            <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                                <div className="flex items-center gap-2 mb-3">
                                    <Trophy className="w-4 h-4 text-chart-4" />
                                    <h2 className="font-display font-extrabold text-foreground text-lg lg:text-xl">
                                        Settled
                                    </h2>
                                    <span className="pill bg-chart-4/15 text-chart-4">{stats.completed.length}</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {stats.completed.map(c => (
                                        <CompCard key={c.id} comp={c} currentUserEmail={user?.email} onClick={() => setSelectedComp(c)} />
                                    ))}
                                </div>
                            </motion.section>
                        )}
                    </div>
                )}
            </div>

            {/* Join setup dialog */}
            <AnimatePresence>
                {joinSetupChoice === 'prompt' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
                        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}
                            className="bg-surface rounded-2xl shadow-soft-lg p-7 max-w-sm w-full text-center space-y-4 border border-border/60">
                            <div className="w-14 h-14 bg-chart-4/10 border border-chart-4/15 rounded-2xl flex items-center justify-center mx-auto">
                                <Trophy className="w-7 h-7 text-chart-4" strokeWidth={2.5} />
                            </div>
                            <div>
                                <h2 className="font-display font-extrabold text-foreground text-xl">How do you want to compete?</h2>
                                <p className="text-sm text-muted-foreground mt-1">Mirror their setup, or build your own path?</p>
                            </div>
                            <div className="space-y-3 text-left">
                                <button
                                    onClick={() => confirmJoin(false)}
                                    className="w-full p-4 border border-chart-3/20 rounded-xl shadow-soft hover:bg-chart-3/5 hover:border-chart-3/40 transition-all"
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <ClipboardList className="w-4 h-4 text-chart-3" />
                                        <p className="font-bold text-chart-3 text-sm">Mirror their structure</p>
                                    </div>
                                    <p className="text-xs text-muted-foreground">Same sub-goals. Fair head-to-head.</p>
                                </button>
                                <button
                                    onClick={() => confirmJoin(true)}
                                    className="w-full p-4 border border-chart-4/20 rounded-xl shadow-soft hover:bg-chart-4/5 hover:border-chart-4/40 transition-all"
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <SettingsIcon className="w-4 h-4 text-chart-4" />
                                        <p className="font-bold text-chart-4 text-sm">Custom setup</p>
                                    </div>
                                    <p className="text-xs text-muted-foreground">Your own goal structure, compete on XP.</p>
                                </button>
                            </div>
                            <button
                                onClick={() => { setJoinSetupChoice(null); setPendingJoinCode(null); }}
                                className="text-xs text-muted-foreground hover:text-foreground"
                            >
                                Cancel
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
