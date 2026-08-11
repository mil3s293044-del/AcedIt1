import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Trophy, Swords, Crown, Activity, ClipboardList, Settings as SettingsIcon,
    LogIn, Loader2, ArrowRight, TrendingUp, Coins, RotateCcw, Target, Users, ShieldAlert
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import GoalCompetitionDetail from "@/components/competition/GoalCompetitionDetail";
import Arena from "@/components/arena/Arena";
import CreateDuelDialog from "@/components/arena/CreateDuelDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { joinGoalCompetition, createGoalCompetition } from "@/api/functionsShim";
import { computePot } from "@/components/competition/arenaHelpers";
import { momentumOf } from "@/components/competition/battleOdds";
import { allBattles } from "@/components/competition/normaliseBattle";
import BattleRow from "@/components/competition/BattleRow";
import BattleDashboard from "@/components/competition/BattleDashboard";
import CalloutQuiz from "@/components/competition/CalloutQuiz";
import { fmtDate } from "@/lib/safeDate";
import HelpButton from "@/components/shared/HelpButton";
import AceShuffle from "@/components/ace/AceShuffle";

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

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Competitions() {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [competitions, setCompetitions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedComp, setSelectedComp] = useState(null);
    const [inviteCode, setInviteCode] = useState("");
    const [competeTab, setCompeteTab] = useState("duels");
    // Duels for the unified list. The arena owns creating/answering them;
    // this is a read so both kinds of competition can sit in one place.
    const [duels, setDuels] = useState([]);
    const [ticker, setTicker] = useState([]);
    // Call-outs involving me, in either direction. Loaded once here rather
    // than per-battle so an incoming one can be surfaced page-wide — a
    // challenge you never see is a forfeit you didn't choose.
    const [callouts, setCallouts] = useState([]);
    const [answering, setAnswering] = useState(null);
    // False until the server confirms the callouts table is there. Migrations
    // 0025/0026 can lag a deploy, and a button that 500s is worse than a
    // feature that hasn't appeared yet.
    const [calloutsReady, setCalloutsReady] = useState(false);
    const [userSubjects, setUserSubjects] = useState([]);
    const [openBattle, setOpenBattle] = useState(null);
    // The challenge dialog is opened from the "Start something" card, so this
    // page owns it rather than reaching into Arena for a button that used to
    // float on its own above the list.
    const [challengeOpen, setChallengeOpen] = useState(false);
    const [newBattleTitle, setNewBattleTitle] = useState("");
    const [newBattleDays, setNewBattleDays] = useState(7);
    const [newBattleSubject, setNewBattleSubject] = useState('');
    const [creatingBattle, setCreatingBattle] = useState(false);

    const handleCreateBattle = async () => {
        if (!newBattleTitle.trim()) return;
        setCreatingBattle(true);
        try {
            const res = await createGoalCompetition({
                standalone: true,
                title: newBattleTitle.trim(),
                duration_days: newBattleDays,
                subject_name: newBattleSubject || undefined,
            });
            const data = res?.data ?? res;
            toast({ title: "⚔️ Battle created!", description: data?.invite_code ? `Share code ${data.invite_code} with your friends.` : "Open it to grab the invite code." });
            setNewBattleTitle(""); setNewBattleSubject("");
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
            const [allComps, profiles, subjects] = await Promise.all([
                base44.entities.GoalCompetition.list('-created_date', 50),
                base44.entities.UserProfile.filter({ created_by: u.email }),
                base44.entities.UserSubject.filter({ created_by: u.email, is_active: true }).catch(() => []),
            ]);
            const seenSub = new Set();
            setUserSubjects((subjects || []).filter(x => !seenSub.has(x.subject_name) && seenSub.add(x.subject_name)));
            const myComps = allComps.filter(c => c.creator_email === u.email || (c.participants || []).some(p => p.email === u.email));
            setCompetitions(myComps);
            base44.functions.invoke('getArenaState')
                .then(r => {
                    const d = r?.data ?? r;
                    setDuels((d?.duels || []).filter(x => x.status === 'active' || x.status === 'settled'));
                    setTicker(d?.ticker || []);
                })
                .catch(() => {});
            loadCallouts();
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

    const loadCallouts = useCallback(async () => {
        try {
            const d = (await base44.functions.invoke('getCallouts'))?.data ?? {};
            setCalloutsReady(d.available !== false);
            setCallouts(d.callouts || []);
        } catch {
            setCalloutsReady(false);   // the page works fine without them
        }
    }, []);

    // Only what needs answering: aimed at me, still open. A settled one is a
    // record, not a demand.
    const incoming = useMemo(
        () => callouts.filter(c => c.target_email === user?.email && ["pending", "active"].includes(c.status)),
        [callouts, user]);

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

    // Every competition in one list, most urgent first.
    const allBattles_ = useMemo(
        () => allBattles({ duels, competitions, myEmail: user?.email }),
        [duels, competitions, user],
    );
    const liveBattleCount = allBattles_.filter(b => b.status === "live").length;

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

        // Nobody has joined yet. "You're leading" against an empty field read
        // as a contradiction — leading, and alone, in the same breath — and the
        // useful thing to say is how to get someone in.
        if (ranked.length < 2) {
            return {
                label: "Waiting on players",
                title: `Share the code for "${target.goal_title}"`,
                sub: `Nobody's joined yet. Send ${target.invite_code || "the invite code"} to a friend and it becomes a race.`,
                accent: "chart-4",
                icon: Users,
                comp: target,
            };
        }

        if (isLeading) {
            return {
                label: "You're leading",
                title: `Hold the lead in "${target.goal_title}"`,
                sub: `${Math.round(me?.progress_percent || 0)}% done. ${ranked[1].name?.split(' ')[0]} is at ${Math.round(ranked[1].progress_percent || 0)}%.`,
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
                    <AceShuffle size="lg" className="mb-3 mx-auto" />
                    <p className="text-muted-foreground text-sm">Loading…</p>
                </div>
            </div>
        );
    }

    // Rendered in every branch that can be on screen: the banner because
    // ignoring a call-out forfeits real XP, and the quiz because it must be
    // openable from the battle dashboard as well as the list.
    const calloutBanner = incoming.map(c => (
        <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border-2 border-streak/40 bg-streak/5 p-5 shadow-soft flex flex-wrap items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-streak/15 flex items-center justify-center flex-shrink-0">
                <ShieldAlert className="w-5 h-5 text-streak" />
            </div>
            <div className="flex-1 min-w-[220px]">
                <p className="stat-label text-streak">Called out</p>
                <p className="font-display font-extrabold text-foreground mt-0.5">
                    {c.caller_name || "A rival"} says you didn't actually learn it
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                    {c.question_count} questions from your own study ·
                    {" "}{Math.round((c.seconds_allowed || 300) / 60)} min ·
                    {" "}{Math.round((c.pass_mark || 0.75) * 100)}% to pass ·
                    {" "}answer by {fmtDate(c.respond_by, "EEE h:mmaaa", "soon")}
                </p>
            </div>
            <Button onClick={() => setAnswering(c)}
                className="gap-1.5 bg-streak hover:bg-streak/90 text-white btn-3d flex-shrink-0">
                <Swords className="w-4 h-4" /> {c.status === "active" ? "Resume" : "Prove it"}
            </Button>
        </motion.div>
    ));

    // `loadData` is deliberately NOT called on settle. It flips isLoading,
    // which swaps the whole page for a spinner, unmounts this dialog and
    // throws away the result screen the student just earned. The board
    // refreshes when they close it instead.
    const calloutDialog = answering ? (
        <CalloutQuiz
            key={answering.id}
            callout={answering}
            open={!!answering}
            onOpenChange={(o) => { if (!o) { setAnswering(null); loadCallouts(); loadData(); } }}
            onSettled={loadCallouts}
        />
    ) : null;

    // The battle dashboard — one competition read as a live market. Group
    // battles keep their existing management panel (invite code, settle,
    // sub-goals) below it rather than losing those controls.
    if (openBattle) {
        const live = allBattles_.find(b => b.kind === openBattle.kind && b.id === openBattle.id) || openBattle;
        return (
            <div className="min-h-screen bg-background">
                <div className="max-w-3xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
                    {calloutBanner.length > 0 && <div className="mb-5 space-y-3">{calloutBanner}</div>}
                    {calloutDialog}
                    <BattleDashboard
                        battle={live}
                        me={{ email: user?.email, name: userProfile?.full_name || user?.full_name }}
                        callouts={calloutsReady ? { list: callouts, refresh: loadCallouts, onSelfCheck: setAnswering } : null}
                        record={userProfile?.extra?.callout_record}
                        activity={(() => {
                            const emails = new Set(live.sides.map(x => x.email));
                            const label = { quiz: "a quiz", flashcard: "flashcards", study_session: "a session",
                                active_recall: "active recall", blurting: "blurting", focus_session: "focus",
                                mini_test: "a mock", loading_quiz: "a warm-up", challenge: "a mission",
                                practice_questions: "practice" };
                            const ago = (at) => {
                                const m = Math.max(1, Math.round((Date.now() - new Date(at).getTime()) / 60000));
                                return m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ago`;
                            };
                            return (ticker || []).filter(e => emails.has(e.email)).map(e => ({
                                ...e, isMe: e.email === user?.email,
                                label: label[e.source] || e.source, ago: ago(e.at),
                            }));
                        })()}
                        onBack={() => { setOpenBattle(null); loadData(); }}
                        footer={live.kind === "battle" ? (
                            <div className="pt-2">
                                <GoalCompetitionDetail
                                    competition={live.raw}
                                    currentUserEmail={user?.email}
                                    onBack={() => { setOpenBattle(null); loadData(); }}
                                    onUpdate={loadData}
                                    embedded
                                />
                            </div>
                        ) : null}
                    />
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

                {calloutBanner}

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
                    <TabsList className="grid w-full grid-cols-2 h-auto p-1.5 rounded-2xl bg-surface border-2 border-border shadow-soft">
                        {[
                            { value: "duels", label: "Battles", icon: Swords, count: liveBattleCount },
                            { value: "bets", label: "Back yourself", icon: Target },
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

                    {/* Back yourself — solo commitment bets */}
                    <TabsContent value="bets" className="mt-4">
                        <Arena view="bets" />
                    </TabsContent>

                    {/* Battles — every competition the student is in, duels and
                        group battles together. They were split across two tabs
                        with two card designs, which is most of why the page felt
                        disorganised: you don't have "duels" and "battles", you
                        have things you're racing in. */}
                    <TabsContent value="duels" className="mt-4 space-y-6">

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

                {allBattles_.length > 0 && (
                    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
                        <div className="flex items-baseline justify-between mb-3">
                            <h2 className="font-display font-extrabold text-foreground text-base flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-primary animate-soft-pulse" /> Live now
                                <span className="pill bg-primary/15 text-primary">{liveBattleCount}</span>
                            </h2>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            {allBattles_.filter(b => b.status === "live").map(b => (
                                <BattleRow key={`${b.kind}-${b.id}`} battle={b} onClick={() => setOpenBattle(b)} />
                            ))}
                        </div>
                        {allBattles_.some(b => b.status === "settled") && (
                            <>
                                <h2 className="font-display font-extrabold text-foreground text-base mt-6 mb-3 flex items-center gap-2">
                                    <Trophy className="w-4 h-4 text-chart-4" /> Settled
                                </h2>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                    {allBattles_.filter(b => b.status === "settled").map(b => (
                                        <BattleRow key={`${b.kind}-${b.id}`} battle={b} onClick={() => setOpenBattle(b)} />
                                    ))}
                                </div>
                            </>
                        )}
                    </motion.section>
                )}

                {/* Challenge / spectate / respond still live in the arena. */}
                <Arena view="actions" />

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

                {/* ── START SOMETHING ─────────────────────────────────── */}
                {/* Was three separate things in three places: a Challenge
                    button floating alone in dead space, a create bar and a
                    join bar — all "begin a new competition", none of them next
                    to each other. One card, three routes, at the end of the
                    page where you land after reading what you're already in. */}
                <motion.section
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}
                    className="card-soft p-5 lg:p-6"
                >
                    <p className="stat-label mb-4">Start something new</p>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Group battle */}
                        <div className="rounded-2xl border border-border p-4">
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className="w-9 h-9 rounded-xl bg-chart-4/10 border border-chart-4/15 flex items-center justify-center flex-shrink-0">
                                    <Trophy className="w-4 h-4 text-chart-4" />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-bold text-foreground text-sm">Group battle</p>
                                    <p className="text-xs text-muted-foreground">Most study wins. Friends join by code.</p>
                                </div>
                            </div>
                            <Input
                                placeholder="Name it — e.g. SAC week grind"
                                value={newBattleTitle}
                                onChange={e => setNewBattleTitle(e.target.value)}
                                maxLength={80}
                                className="mb-2"
                            />
                            {/* Subject scopes what counts. The server has always
                                accepted it on a standalone battle; the form
                                never asked, so every battle silently counted
                                every subject. */}
                            <div className="mb-2">
                                <p className="stat-label mb-1.5">Counts study in</p>
                                <div className="flex flex-wrap gap-1.5">
                                    <button onClick={() => setNewBattleSubject("")}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${
                                            !newBattleSubject ? "bg-foreground border-foreground text-background" : "bg-surface border-border text-muted-foreground hover:border-muted-foreground/40"
                                        }`}>Every subject</button>
                                    {userSubjects.map(sub => (
                                        <button key={sub.id} onClick={() => setNewBattleSubject(sub.subject_name)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${
                                                newBattleSubject === sub.subject_name ? "bg-foreground border-foreground text-background" : "bg-surface border-border text-muted-foreground hover:border-muted-foreground/40"
                                            }`}>{sub.subject_name}</button>
                                    ))}
                                </div>
                            </div>
                            <p className="stat-label mb-1.5">Runs for</p>
                            <div className="flex items-center gap-2">
                                {[3, 7, 14].map(d => (
                                    <button key={d} onClick={() => setNewBattleDays(d)}
                                        className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                                            newBattleDays === d ? "bg-chart-4 border-chart-4 text-white" : "bg-surface border-border text-foreground hover:border-chart-4/40"
                                        }`}>{d}d</button>
                                ))}
                                <Button onClick={handleCreateBattle} disabled={creatingBattle || !newBattleTitle.trim()} className="ml-auto">
                                    {creatingBattle ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Create <ArrowRight className="w-4 h-4" /></>}
                                </Button>
                            </div>
                        </div>

                        {/* Duel, and joining someone else's */}
                        <div className="space-y-3">
                            <div className="rounded-2xl border border-border p-4">
                                <div className="flex items-center gap-2.5 mb-3">
                                    <div className="w-9 h-9 rounded-xl bg-chart-4/10 border border-chart-4/15 flex items-center justify-center flex-shrink-0">
                                        <Swords className="w-4 h-4 text-chart-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-foreground text-sm">Duel a friend</p>
                                        <p className="text-xs text-muted-foreground">One rival, one yardstick, winner takes the pot.</p>
                                    </div>
                                </div>
                                <Button onClick={() => setChallengeOpen(true)}
                                    className="w-full rounded-xl bg-chart-4 hover:bg-chart-4/90 text-white font-bold gap-2 btn-3d">
                                    <Swords className="w-4 h-4" /> Challenge a rival
                                </Button>
                            </div>

                            <div className="rounded-2xl border border-border p-4">
                                <div className="flex items-center gap-2.5 mb-3">
                                    <div className="w-9 h-9 rounded-xl bg-chart-3/10 border border-chart-3/15 flex items-center justify-center flex-shrink-0">
                                        <LogIn className="w-4 h-4 text-chart-3" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-foreground text-sm">Join with a code</p>
                                        <p className="text-xs text-muted-foreground">Someone sent you six characters.</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Input
                                        placeholder="ABCD12"
                                        value={inviteCode}
                                        onChange={e => setInviteCode(e.target.value.toUpperCase())}
                                        onKeyDown={e => e.key === 'Enter' && handleJoinByCode()}
                                        className="flex-1 font-mono uppercase text-center tracking-widest"
                                        maxLength={6}
                                    />
                                    <Button onClick={handleJoinByCode} disabled={joiningCode || !inviteCode.trim()}>
                                        {joiningCode ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Join <ArrowRight className="w-4 h-4" /></>}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.section>

                    </TabsContent>
                </Tabs>

                <CreateDuelDialog
                    open={challengeOpen}
                    onOpenChange={setChallengeOpen}
                    currentUser={user}
                    balance={userProfile?.total_xp ?? null}
                    onCreated={() => { setChallengeOpen(false); loadData(); }}
                />
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
            {calloutDialog}
        </div>
    );
}
