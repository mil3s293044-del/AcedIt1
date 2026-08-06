import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Trophy, Swords, Users, Crown, Activity, ClipboardList, Settings as SettingsIcon,
    LogIn, Loader2, Clock, ChevronRight, ArrowRight, TrendingUp, Coins, RotateCcw, Target
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import GoalCompetitionDetail from "@/components/competition/GoalCompetitionDetail";
import Arena from "@/components/arena/Arena";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { joinGoalCompetition, createGoalCompetition } from "@/api/functionsShim";
import { Countdown, computePot } from "@/components/competition/arenaHelpers";
import { winOdds, momentumOf, gapSeries, battleNarrative } from "@/components/competition/battleOdds";
import HelpButton from "@/components/shared/HelpButton";
import EmptyState from "@/components/shared/EmptyState";
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
    const overdue = comp.goal_target_date && isPast(parseISO(comp.goal_target_date)) && !isCompleted;
    const pot = computePot(comp);

    // The competitive read: odds, today's movement, and the shape of the gap.
    const others = accepted.filter(p => p.email !== currentUserEmail);
    const odds = isCompleted ? null : winOdds({ me, rivals: others, targetDate: comp.goal_target_date });
    const myMomentum = momentumOf(me, 24);
    const swing = gapSeries({ me, rivals: others });
    const narrative = isCompleted ? null : battleNarrative({ me, rivals: others });
    // Sparkline geometry, scaled to the range the gap actually walked so a
    // few points of swing don't render as a flat line.
    const swingPoints = (() => {
        if (swing.length < 2) return "";
        const lo = Math.min(...swing, 0), hi = Math.max(...swing, 0);
        const span = Math.max(1, hi - lo);
        return swing.map((v, i) => {
            const x = (i / (swing.length - 1)) * 100;
            const y = 32 - ((v - lo) / span) * 32;
            return `${x},${Math.max(2, Math.min(30, y))}`;
        }).join(" ");
    })();

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
                <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1 flex-wrap">
                    by {comp.creator_name} <span className="text-muted-foreground/40">·</span> <Users className="w-3 h-3" /> {accepted.length}
                    {!isCompleted && pot.total > 0 && (
                        <>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="inline-flex items-center gap-0.5 font-bold text-xp"><Coins className="w-3 h-3" /> {pot.total} XP</span>
                        </>
                    )}
                </p>
            </div>

            {/* Odds + momentum — the two things a score alone can't tell you:
                whether you're likely to win, and which way it's moving. */}
            {me && !isCompleted && odds != null && (
                <div className="mb-3.5">
                    <div className="flex items-baseline justify-between mb-1.5">
                        <span className="stat-label">Chance of winning</span>
                        <span className={`font-display font-black text-2xl leading-none tabular-nums ${
                            odds >= 60 ? "text-primary" : odds >= 40 ? "text-xp" : "text-streak"
                        }`}>{odds}%</span>
                    </div>
                    {/* Two-sided bar: your share of the race against the leader. */}
                    <div className="h-2.5 bg-streak/20 rounded-full overflow-hidden flex">
                        <motion.div
                            initial={{ width: 0 }} animate={{ width: `${odds}%` }}
                            transition={{ duration: 0.9, ease: "easeOut" }}
                            className={`h-full ${odds >= 60 ? "bg-primary" : odds >= 40 ? "bg-xp" : "bg-streak"}`}
                        />
                    </div>
                    <div className="flex items-center justify-between mt-1.5 gap-2">
                        <span className="text-[11px] font-bold text-muted-foreground tabular-nums">{myScore} pts</span>
                        {myMomentum != null && (
                            <span className={`text-[11px] font-bold inline-flex items-center gap-0.5 ${
                                myMomentum > 0 ? "text-primary" : "text-muted-foreground"
                            }`}>
                                {myMomentum > 0 ? <TrendingUp className="w-3 h-3" /> : null}
                                {myMomentum > 0 ? `+${myMomentum}` : myMomentum} today
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Settled, or no rival to race — keep the plain score bar. */}
            {me && (isCompleted || odds == null) && (
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

            {/* Swing line — the gap over time. Above the centre line you're
                ahead, below it you're behind; the shape is the story. */}
            {swing.length > 1 && !isCompleted && (
                <div className="mb-3.5">
                    <div className="flex items-baseline justify-between mb-1">
                        <span className="stat-label">Momentum</span>
                        <span className="text-[11px] text-muted-foreground/70">gap over time</span>
                    </div>
                    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="w-full h-8" role="img"
                        aria-label="Your points gap against the leader over time">
                        <line x1="0" y1="16" x2="100" y2="16" stroke="currentColor" strokeWidth="1"
                            vectorEffect="non-scaling-stroke" className="text-border" strokeDasharray="3 3" />
                        <polyline points={swingPoints} fill="none" stroke="currentColor" strokeWidth="2"
                            vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round"
                            className={swing[swing.length - 1] >= 0 ? "text-primary" : "text-streak"} />
                    </svg>
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

            {/* Where the race actually stands — reads the momentum, not just
                the standing, so "pulling away" and "lead is closing" are
                distinguishable at a glance. */}
            {narrative && (
                <div className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-xs font-bold ${
                    narrative.tone === "good" ? "bg-primary/10 text-primary"
                        : narrative.tone === "bad" ? "bg-streak/10 text-streak"
                        : "bg-xp/10 text-xp"
                }`}>
                    {narrative.tone === "good"
                        ? <Crown className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        : <TrendingUp className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
                    <span>{narrative.text}</span>
                </div>
            )}

            {isCompleted && comp.winner_name && (
                <div className="mt-3 inline-flex items-center gap-2 bg-xp/10 border-2 border-xp/25 rounded-xl px-3 py-1.5">
                    <Trophy className="w-3.5 h-3.5 text-xp" />
                    <span className="text-xs font-bold text-foreground">{comp.winner_name} took it</span>
                </div>
            )}

            {comp.goal_target_date && (
                <div className="mt-2.5">
                    {isCompleted ? (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {format(parseISO(comp.goal_target_date), 'MMM d, yyyy')}
                        </div>
                    ) : (
                        <Countdown targetDate={comp.goal_target_date} variant="chip" />
                    )}
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
    const [competeTab, setCompeteTab] = useState("duels");
    const [newBattleTitle, setNewBattleTitle] = useState("");
    const [newBattleDays, setNewBattleDays] = useState(7);
    const [creatingBattle, setCreatingBattle] = useState(false);

    const handleCreateBattle = async () => {
        if (!newBattleTitle.trim()) return;
        setCreatingBattle(true);
        try {
            const res = await createGoalCompetition({
                standalone: true,
                title: newBattleTitle.trim(),
                duration_days: newBattleDays,
            });
            const data = res?.data ?? res;
            toast({ title: "⚔️ Battle created!", description: data?.invite_code ? `Share code ${data.invite_code} with your friends.` : "Open it to grab the invite code." });
            setNewBattleTitle("");
            loadData();
        } catch (e) {
            toast({ title: "Battle not created", description: e.message, variant: "destructive" });
        } finally {
            setCreatingBattle(false);
        }
    };
    const [joiningCode, setJoiningCode] = useState(false);
    const [joinSetupChoice, setJoinSetupChoice] = useState(null);
    const [pendingJoinCode, setPendingJoinCode] = useState(null);
    const [rematchingEmail, setRematchingEmail] = useState(null);
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

    // Rematch: re-run the most recent battle YOU created against this rival.
    const handleRematch = async (rival) => {
        // Find my most recent settled comp where this rival took part.
        const mine = competitions
            .filter(c => c.creator_email === user?.email
                && (c.participants || []).some(p => p.email === rival.email))
            .sort((a, b) => new Date(b.completed_at || b.updated_date || 0) - new Date(a.completed_at || a.updated_date || 0));
        const base = mine[0];
        if (!base?.goal_id) {
            toast({ title: "Start it from a goal", description: `Open a goal and tap “Compete with friends” to challenge ${rival.name?.split(' ')[0]} again.` });
            return;
        }
        setRematchingEmail(rival.email);
        try {
            const res = await createGoalCompetition({ goal_id: base.goal_id, invite_emails: [rival.email] });
            const data = res?.data ?? res;
            if (data?.error) {
                toast({ title: "Couldn't start rematch", description: data.error, variant: "destructive" });
            } else {
                toast({ title: `Rematch on! 🔥`, description: `${rival.name?.split(' ')[0]} has been challenged on “${base.goal_title}”.` });
                await loadData();
            }
        } catch (e) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally { setRematchingEmail(null); }
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

        // Points put on the board today across every live battle, and the XP
        // riding on them. Both are about the competition you're in right now,
        // which is what the tier ladder never was.
        let pointsToday = 0;
        let xpAtStake = 0;
        active.forEach(c => {
            const mine = (c.participants || []).find(p => p.email === myEmail);
            const mo = momentumOf(mine, 24);
            if (mo && mo > 0) pointsToday += mo;
            xpAtStake += computePot(c)?.total || 0;
        });

        return { active, completed, recentWins, leading, behind, winStreak, rivals, pointsToday, xpAtStake };
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

                {/* ── SCOREBOARD ──────────────────────────────────────── */}
                {/* Replaces the tier ladder. Every number here is about the
                    battles on this page, not a lifetime-XP rank that moved
                    whether or not you were competing. */}
                <motion.section
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                >
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        {[
                            { label: "Record", value: `${stats.recentWins}\u2013${Math.max(0, stats.completed.length - stats.recentWins)}`,
                              icon: Trophy, iconBg: "bg-xp/15", iconColor: "text-xp", tone: "text-foreground" },
                            { label: "Win rate", value: `${winRate}%`,
                              icon: Target, iconBg: "bg-primary/15", iconColor: "text-primary",
                              tone: winRate >= 50 ? "text-primary" : "text-foreground" },
                            { label: "Live now", value: `${stats.active.length}`,
                              icon: Activity, iconBg: "bg-chart-3/15", iconColor: "text-chart-3", tone: "text-foreground" },
                            { label: "Leading", value: `${stats.leading}/${stats.active.length}`,
                              icon: Crown, iconBg: "bg-xp/15", iconColor: "text-xp",
                              tone: stats.leading > 0 ? "text-xp" : "text-muted-foreground" },
                            { label: "Points today", value: stats.pointsToday > 0 ? `+${stats.pointsToday}` : "0",
                              icon: TrendingUp, iconBg: "bg-chart-4/15", iconColor: "text-chart-4",
                              tone: stats.pointsToday > 0 ? "text-chart-4" : "text-muted-foreground" },
                            { label: "XP at stake", value: stats.xpAtStake.toLocaleString(),
                              icon: Coins, iconBg: "bg-streak/15", iconColor: "text-streak",
                              tone: stats.xpAtStake > 0 ? "text-streak" : "text-muted-foreground" },
                        ].map(({ label, value, icon: Icon, iconBg, iconColor, tone }) => (
                            <div key={label} className="card-soft p-4 flex flex-col gap-2">
                                <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center`}>
                                    <Icon className={`w-4 h-4 ${iconColor}`} />
                                </div>
                                <p className={`font-display font-extrabold text-2xl leading-none tabular-nums ${tone}`}>{value}</p>
                                <p className="stat-label">{label}</p>
                            </div>
                        ))}
                    </div>
                    {stats.winStreak > 1 && (
                        <p className="mt-3 inline-flex items-center gap-1.5 pill bg-xp/15 text-xp">
                            \ud83d\udd25 {stats.winStreak} battle win streak
                        </p>
                    )}
                </motion.section>

                {/* ── ONE PAGE, THREE CLEAR MODES ──────────────────────── */}
                <Tabs value={competeTab} onValueChange={setCompeteTab} className="space-y-5">
                    <TabsList className="grid w-full grid-cols-3 h-auto p-1.5 rounded-2xl bg-surface border-2 border-border shadow-soft">
                        {[
                            { value: "duels", label: "Duels", icon: Swords },
                            { value: "bets", label: "Back yourself", icon: Target },
                            { value: "battles", label: "Group battles", icon: Trophy, count: stats.active.length },
                        ].map(tab => (
                            <TabsTrigger key={tab.value} value={tab.value}
                                className="flex items-center justify-center gap-1 sm:gap-1.5 py-2.5 px-1.5 sm:px-2 rounded-xl text-xs lg:text-sm font-bold text-muted-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-soft transition-all min-w-0">
                                {/* Icon goes at phone width — three labels plus icons
                                    plus a count badge doesn't fit 390px, and the
                                    badge was the thing getting clipped off. */}
                                <tab.icon className="w-3.5 h-3.5 hidden sm:block flex-shrink-0" />
                                <span className="truncate">{tab.label}</span>
                                {tab.count > 0 && (
                                    <span className="bg-primary text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold flex-shrink-0">{tab.count}</span>
                                )}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {/* Duels — challenges, live matches, spectating */}
                    <TabsContent value="duels" className="mt-4">
                        <Arena view="matches" />
                    </TabsContent>

                    {/* Back yourself — solo commitment bets */}
                    <TabsContent value="bets" className="mt-4">
                        <Arena view="bets" />
                    </TabsContent>

                    {/* Group battles — goal competitions */}
                    <TabsContent value="battles" className="mt-4 space-y-6">

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
                                    <div key={r.email} className="card-soft p-4 flex flex-col">
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
                                        <button
                                            onClick={() => handleRematch(r)}
                                            disabled={rematchingEmail === r.email}
                                            className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-xl bg-streak/10 hover:bg-streak/20 text-streak font-bold text-xs py-2 transition-colors disabled:opacity-60"
                                        >
                                            {rematchingEmail === r.email
                                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                : <RotateCcw className="w-3.5 h-3.5" />}
                                            {even || ahead ? 'Rematch' : 'Run it back'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.section>
                )}

                {/* ── START A BATTLE — standalone, no goal needed ──────── */}
                <motion.section
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.13 }}
                    className="card-soft p-4 lg:p-5"
                >
                    <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-9 h-9 rounded-xl bg-chart-4/10 border border-chart-4/15 flex items-center justify-center flex-shrink-0">
                            <Swords className="w-4 h-4 text-chart-4" />
                        </div>
                        <div>
                            <p className="font-bold text-foreground text-sm">Start a battle</p>
                            <p className="text-xs text-muted-foreground">Most study wins. Friends join with the invite code.</p>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                            placeholder="Name it — e.g. SAC week grind"
                            value={newBattleTitle}
                            onChange={e => setNewBattleTitle(e.target.value)}
                            maxLength={80}
                            className="flex-1"
                        />
                        <div className="flex gap-2">
                            {[3, 7, 14].map(d => (
                                <button key={d} onClick={() => setNewBattleDays(d)}
                                    className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                                        newBattleDays === d ? "bg-chart-4 border-chart-4 text-white" : "bg-surface border-border text-foreground hover:border-chart-4/40"
                                    }`}>{d}d</button>
                            ))}
                            <Button onClick={handleCreateBattle} disabled={creatingBattle || !newBattleTitle.trim()}>
                                {creatingBattle ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Create <ArrowRight className="w-4 h-4" /></>}
                            </Button>
                        </div>
                    </div>
                </motion.section>

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
                    </TabsContent>
                </Tabs>
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
