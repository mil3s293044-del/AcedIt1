import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Globe, Users, Clock, Zap, Trophy, Crown, Flame, Star, Target, ArrowUp, RefreshCw, Search, Bell, Check, X, TrendingUp, Swords, Shield } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { getRankFromXP, levelFromXP } from "@/components/shared/xpSystem";
import { Friendship } from "@/entities/all";

const fmt = (m) => !m ? "0h" : m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60 > 0 ? ` ${m % 60}m` : ''}`;
const PAGE_SIZE = 20;



function Podium({ top3, currentUserEmail, metric }) {
    if (top3.length < 3) return null;
    const order = [top3[1], top3[0], top3[2]]; // Silver, Gold, Bronze display order
    const heights = ["h-24", "h-32", "h-20"];
    const glow = ["", "shadow-2xl shadow-amber-200", ""];
    const badges = ["🥈", "🥇", "🥉"];
    const sizeClass = ["", "ring-4 ring-amber-400 ring-offset-2", ""];

    return (
        <div className="relative mb-2 px-2">
            <div className="absolute inset-0 flex justify-center items-end pointer-events-none">
                <div className="w-24 h-24 bg-amber-400/20 rounded-full blur-2xl" />
            </div>
            <div className="flex items-end justify-center gap-3">
                {order.map((u, oi) => {
                    const realIdx = oi === 0 ? 1 : oi === 1 ? 0 : 2;
                    const isMe = u.user_email === currentUserEmail;
                    const fullName = u.is_anonymous && u.user_email !== currentUserEmail
                        ? `Anon #${u.id?.slice(-4) || '????'}`
                        : (u.user_name || u.username || "Student");
                    const firstName = fullName.split(" ")[0];
                    const xpStr = (u.total_xp || 0).toLocaleString();
                    const hoursStr = fmt(u.total_study_time || 0);
                    return (
                        <motion.div key={u.id} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: oi * 0.15, type: "spring", bounce: 0.4 }}
                            className="flex flex-col items-center gap-1">
                            <p className="text-xs font-bold text-white/90 text-center w-20 truncate">{firstName}</p>
                            <p className="text-xs text-white/60 text-center w-20 truncate hidden sm:block">{fullName !== firstName ? fullName.split(" ").slice(1).join(" ") : ""}</p>
                            {isMe && <Badge className="bg-purple-400/40 text-white text-xs border-0 px-1.5 py-0">You</Badge>}
                            <div className="text-center">
                                <p className="text-xs font-black text-amber-300">{xpStr} XP</p>
                                <p className="text-xs text-white/50">{hoursStr} studied</p>
                            </div>
                            <div className={`w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center ${sizeClass[oi]} ${glow[oi]} shadow-lg`}>
                                <span className="text-2xl">{badges[oi]}</span>
                            </div>
                            <div className={`w-16 ${heights[oi]} bg-gradient-to-t ${realIdx === 0 ? 'from-amber-500 to-amber-300' : realIdx === 1 ? 'from-slate-400 to-slate-200' : 'from-orange-500 to-orange-300'} rounded-t-xl flex items-center justify-center shadow-md`}>
                                <span className="text-white font-black text-xl">#{realIdx + 1}</span>
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}

function BeatNextCard({ nextPlayer, gap, metric }) {
    if (!nextPlayer) return null;
    const displayName = nextPlayer.is_anonymous ? `Anon #${nextPlayer.id?.slice(-4)}` : (nextPlayer.username || nextPlayer.user_name || "Student");
    const metricLabel = metric === 'hours' ? 'study time' : metric === 'streak' ? 'streak days' : 'XP';
    const gapStr = metric === 'hours' ? fmt(gap) : metric === 'streak' ? `${gap}d` : gap.toLocaleString();
    return (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-4">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
                    <Swords className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide">Next Target 🎯</p>
                    <p className="font-bold text-gray-900 text-sm truncate">
                        Beat <span className="text-orange-700">{displayName}</span>
                    </p>
                    <p className="text-xs text-gray-500">Only <span className="font-bold text-orange-600">{gapStr}</span> more {metricLabel} ahead!</p>
                </div>
                <div className="flex items-center gap-1 text-orange-600">
                    <ArrowUp className="w-4 h-4" />
                    <span className="text-xs font-black">CLIMB</span>
                </div>
            </div>
        </motion.div>
    );
}

function MyPositionCard({ myEntry, rank, metric, total, sorted }) {
    if (!myEntry) return null;
    const percentile = Math.round(((total - rank) / total) * 100);
    const nextPlayer = rank > 1 ? sorted[rank - 2] : null; // player just above me
    const myVal = metric === 'hours' ? (myEntry.total_study_time || 0) : metric === 'streak' ? (myEntry.streak_days || 0) : (myEntry.total_xp || 0);
    const nextVal = nextPlayer ? (metric === 'hours' ? (nextPlayer.total_study_time || 0) : metric === 'streak' ? (nextPlayer.streak_days || 0) : (nextPlayer.total_xp || 0)) : 0;
    const gap = Math.max(0, nextVal - myVal);

    return (
        <div className="space-y-3">
            <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-violet-600 rounded-2xl p-4 text-white shadow-lg shadow-purple-200">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <p className="text-white/70 text-xs font-semibold uppercase tracking-wide">Your Rank</p>
                        <p className="text-4xl font-black leading-none">#{rank}</p>
                        <p className="text-white/70 text-xs mt-0.5">Top {Math.max(1, 100 - percentile)}% of {total} students</p>
                    </div>
                    <div className="text-right">
                        <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center shadow-inner">
                            <span className="text-3xl">{getRankFromXP(myEntry.total_xp || 0).emoji}</span>
                        </div>
                    </div>
                </div>
                <div className="space-y-1">
                    <div className="flex justify-between text-xs text-white/70">
                        <span>Global Percentile</span>
                        <span>Top {Math.max(1, 100 - percentile)}%</span>
                    </div>
                    <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${percentile}%` }}
                            transition={{ duration: 1, delay: 0.3 }}
                            className="h-full bg-gradient-to-r from-white/80 to-white rounded-full" />
                    </div>
                </div>
            </div>
            {nextPlayer && gap > 0 && <BeatNextCard nextPlayer={nextPlayer} gap={gap} metric={metric} />}
        </div>
    );
}

function LeaderboardRow({ user: u, index, currentUserEmail, metric }) {
    const RANK_STYLES = [
        { bg: "bg-gradient-to-r from-yellow-50 to-amber-100", border: "border-l-4 border-yellow-400", badge: "from-yellow-400 to-amber-500", glow: "shadow-amber-100 shadow-lg" },
        { bg: "bg-gradient-to-r from-slate-50 to-gray-100",   border: "border-l-4 border-slate-400",  badge: "from-slate-400 to-gray-500",  glow: "" },
        { bg: "bg-gradient-to-r from-orange-50 to-amber-50",  border: "border-l-4 border-orange-400", badge: "from-orange-400 to-red-400",  glow: "" },
    ];
    const style = RANK_STYLES[index] || { bg: "bg-white", border: "border-l-4 border-indigo-200", badge: "from-indigo-400 to-purple-500", glow: "" };
    const isCurrentUser = u.user_email === currentUserEmail;
    const xpRank = getRankFromXP(u.total_xp || 0);
    const level = levelFromXP(u.total_xp || 0);
    const displayName = u.is_anonymous && u.user_email !== currentUserEmail
        ? `Anonymous #${u.id?.slice(-4) || '????'}`
        : (u.username || u.user_name || "Student");

    const mainValue = metric === 'hours' ? fmt(u.total_study_time || 0) : metric === 'streak' ? `${u.streak_days || 0}d` : (u.total_xp || 0).toLocaleString();
    const mainIcon = metric === 'hours' ? <Clock className="w-3.5 h-3.5 text-blue-400" /> : metric === 'streak' ? <Flame className="w-3.5 h-3.5 text-orange-400" /> : <Zap className="w-3.5 h-3.5 text-amber-400" />;
    const valueColor = metric === 'hours' ? 'text-blue-600' : metric === 'streak' ? 'text-orange-600' : 'text-amber-600';

    return (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.025, 0.4) }} whileHover={{ scale: 1.01, x: 2 }}>
            <div className={`${style.bg} ${style.border} ${isCurrentUser ? 'ring-2 ring-purple-400 ring-offset-1' : ''} ${index === 0 ? style.glow : ''} rounded-xl p-3 flex items-center gap-3 transition-all hover:shadow-md relative overflow-hidden`}>
                {index === 0 && <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMTAiIGN5PSIxMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjAwLDAsMC4xNSkiLz48L3N2Zz4=')] pointer-events-none opacity-40" />}

                <div className={`w-9 h-9 bg-gradient-to-br ${style.badge} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
                    {index === 0 ? <Crown className="w-5 h-5 text-white" /> :
                     index === 1 ? <Star className="w-4 h-4 text-white" /> :
                     index === 2 ? <Trophy className="w-4 h-4 text-white" /> :
                     <span className="text-white font-black text-xs">{index + 1}</span>}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-bold text-gray-900 text-sm truncate">{displayName}</p>
                        {isCurrentUser && <Badge className="bg-purple-100 text-purple-700 text-xs border-0">You</Badge>}
                        <span className="text-sm">{xpRank.emoji}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-gray-400">Lv.{level}</span>
                        {u.streak_days > 0 && metric !== 'streak' && (
                            <div className="flex items-center gap-0.5 text-orange-500 text-xs">
                                <Flame className="w-3 h-3" />{u.streak_days}d
                            </div>
                        )}
                        <span className="text-xs text-gray-400 truncate hidden sm:inline">{xpRank.name}</span>
                    </div>
                </div>

                <div className="text-right flex-shrink-0">
                    <div className="flex items-center gap-1 justify-end">
                        {mainIcon}
                        <p className={`text-base font-black ${valueColor}`}>{mainValue}</p>
                    </div>
                    <p className="text-xs text-gray-400">{metric === 'hours' ? 'study time' : metric === 'streak' ? 'streak' : 'XP'}</p>
                </div>
            </div>
        </motion.div>
    );
}

function StatsBar({ sorted, metric, currentUserEmail }) {
    if (sorted.length === 0) return null;
    const top = sorted[0];
    const topVal = metric === 'hours' ? (top.total_study_time || 0) : metric === 'streak' ? (top.streak_days || 0) : (top.total_xp || 0);
    const topDisplay = metric === 'hours' ? fmt(topVal) : metric === 'streak' ? `${topVal}d` : topVal.toLocaleString();
    const myEntry = sorted.find(e => e.user_email === currentUserEmail);
    const myVal = myEntry ? (metric === 'hours' ? (myEntry.total_study_time || 0) : metric === 'streak' ? (myEntry.streak_days || 0) : (myEntry.total_xp || 0)) : 0;
    const avgVal = Math.round(sorted.slice(0, 50).reduce((s, e) => s + (metric === 'hours' ? (e.total_study_time || 0) : metric === 'streak' ? (e.streak_days || 0) : (e.total_xp || 0)), 0) / Math.min(50, sorted.length));

    return (
        <div className="grid grid-cols-3 gap-2 bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
            {[
                { label: "🏆 Leader", value: topDisplay, sub: (top.username || top.user_name || "").slice(0, 12) },
                { label: "👥 Players", value: sorted.length.toLocaleString(), sub: "on leaderboard" },
                { label: "📊 Top 50 Avg", value: metric === 'hours' ? fmt(avgVal) : metric === 'streak' ? `${avgVal}d` : avgVal.toLocaleString(), sub: metric === 'hours' ? 'study time' : metric === 'streak' ? 'streak' : 'XP' },
            ].map(({ label, value, sub }) => (
                <div key={label} className="text-center">
                    <p className="text-xs text-gray-400">{label}</p>
                    <p className="font-black text-gray-900 text-sm">{value}</p>
                    <p className="text-xs text-gray-400 truncate">{sub}</p>
                </div>
            ))}
        </div>
    );
}

export default function CompetitiveLeaderboard() {
    const [metric, setMetric]           = useState("xp");
    const [scope, setScope]             = useState("global");
    const [allEntries, setAllEntries]   = useState([]);
    const [friendsEntries, setFriendsEntries] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [friendRequests, setFriendRequests] = useState([]);
    const [isLoading, setIsLoading]     = useState(true);
    const [showRequests, setShowRequests] = useState(false);
    const [search, setSearch]           = useState("");
    const [page, setPage]               = useState(1);
    const { toast } = useToast();

    const load = useCallback(async () => {
        setIsLoading(true);
        try {
            const user = await base44.auth.me();
            setCurrentUser(user);
            const [lbEntries, friendships, studySessions, profile] = await Promise.all([
                base44.entities.Leaderboard.list('-total_xp', 200),
                Friendship.list('-created_date', 200),
                base44.entities.StudyTechnique.filter({ created_by: user.email }),
                base44.entities.UserProfile.filter({ created_by: user.email }).then(d => d[0] || null),
            ]);
            if (profile) {
                const totalStudyMins = studySessions.reduce((s, x) => s + (x.session_duration || 0), 0);
                const lbData = { user_email: user.email, user_name: user.full_name, username: profile.username || "", total_xp: profile.total_xp || 0, season_xp: profile.season_xp || 0, level: profile.current_level || 1, streak_days: profile.streak_days || 0, total_study_time: totalStudyMins, is_anonymous: profile.is_anonymous_on_leaderboard || false, last_updated: new Date().toISOString() };
                const existing = lbEntries.find(e => e.user_email === user.email);
                if (existing) base44.entities.Leaderboard.update(existing.id, lbData).catch(() => {});
                else base44.entities.Leaderboard.create(lbData).catch(() => {});
            }
            setAllEntries(lbEntries.filter(e => (e.total_xp || 0) > 0));
            const myFriendships = friendships.filter(f => f.status === 'accepted' && (f.requester_email === user.email || f.recipient_email === user.email));
            const friendEmails = new Set(myFriendships.map(f => f.requester_email === user.email ? f.recipient_email : f.requester_email));
            friendEmails.add(user.email);
            setFriendsEntries(lbEntries.filter(e => friendEmails.has(e.user_email) && (e.total_xp || 0) > 0));
            setFriendRequests(friendships.filter(f => f.recipient_email === user.email && f.status === 'pending'));
        } catch {}
        finally { setIsLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);
    React.useEffect(() => { setPage(1); }, [metric, scope, search]);

    const handleAccept = async (req) => {
        await Friendship.update(req.id, { status: 'accepted' });
        toast({ title: `Now friends with ${req.requester_name}!` });
        setFriendRequests(p => p.filter(r => r.id !== req.id));
        const entry = allEntries.find(e => e.user_email === req.requester_email);
        if (entry) setFriendsEntries(p => [...p, entry].sort((a, b) => (b.total_xp || 0) - (a.total_xp || 0)));
    };

    const getSorted = () => {
        const list = scope === 'friends' ? friendsEntries : allEntries;
        return [...list].sort((a, b) => {
            if (metric === 'hours') return (b.total_study_time || 0) - (a.total_study_time || 0);
            if (metric === 'streak') return (b.streak_days || 0) - (a.streak_days || 0);
            return (b.total_xp || 0) - (a.total_xp || 0);
        }).filter(e => !search.trim() || (e.username || e.user_name || '').toLowerCase().includes(search.toLowerCase()));
    };

    const sorted = getSorted();
    const myRank = sorted.findIndex(e => e.user_email === currentUser?.email) + 1;
    const myEntry = sorted.find(e => e.user_email === currentUser?.email);
    const top3 = sorted.slice(0, 3);
    const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
    const pagedEntries = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    if (isLoading) return (
        <div className="space-y-2">
            {[1,2,3,4,5].map(i => <div key={i} className="bg-white rounded-xl p-4 animate-pulse h-16 flex items-center gap-3"><div className="w-9 h-9 bg-gray-200 rounded-xl" /><div className="flex-1"><div className="h-4 bg-gray-200 rounded w-32 mb-1.5" /><div className="h-3 bg-gray-100 rounded w-20" /></div><div className="h-5 bg-gray-200 rounded w-16" /></div>)}
        </div>
    );

    return (
        <div className="space-y-4">
            {/* My Position + Tier Progress */}
            {myEntry && myRank > 0 && (
                <MyPositionCard myEntry={myEntry} rank={myRank} metric={metric} total={sorted.length} sorted={sorted} />
            )}
            {/* Controls */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                    {[['global', Globe, 'Global'], ['friends', Users, 'Friends']].map(([s, Icon, label]) => (
                        <button key={s} onClick={() => setScope(s)}
                            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${scope === s ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                            <Icon className="w-4 h-4" />{label}
                        </button>
                    ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                    {[['xp', Zap, 'XP'], ['hours', Clock, 'Hours'], ['streak', Flame, 'Streak']].map(([m, Icon, label]) => (
                        <button key={m} onClick={() => setMetric(m)}
                            className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${metric === m ? 'bg-amber-500 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                            <Icon className="w-3.5 h-3.5" />{label}
                        </button>
                    ))}
                </div>
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by username..."
                            className="pl-8 h-9 text-xs border-gray-200 bg-gray-50" />
                    </div>
                    <Button size="sm" variant="outline" onClick={load} className="h-9 w-9 p-0"><RefreshCw className="w-3.5 h-3.5" /></Button>
                    {friendRequests.length > 0 && (
                        <Button size="sm" variant="outline" onClick={() => setShowRequests(true)} className="relative h-9 text-xs">
                            <Bell className="w-3.5 h-3.5 mr-1" />
                            <Badge className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 p-0 flex items-center justify-center rounded-full">{friendRequests.length}</Badge>
                        </Button>
                    )}
                </div>
            </div>

            {/* Stats Bar */}
            {sorted.length > 0 && !search && <StatsBar sorted={sorted} metric={metric} currentUserEmail={currentUser?.email} />}

            {/* Podium for page 1 with no search */}
            {page === 1 && !search && top3.length >= 3 && (
                <div className="bg-gradient-to-b from-indigo-950 to-purple-900 rounded-2xl p-5 shadow-2xl">
                    <div className="text-center mb-4">
                        <p className="text-white font-black text-lg">🏆 Hall of Fame</p>
                        <p className="text-white/50 text-xs">{metric === 'xp' ? 'Total XP' : metric === 'hours' ? 'Study Hours' : 'Study Streak'} Leaderboard</p>
                    </div>
                    <Podium top3={top3} currentUserEmail={currentUser?.email} metric={metric} />
                </div>
            )}

            {/* Empty state */}
            {sorted.length === 0 && scope === 'friends' && (
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-10 text-center">
                    <Users className="w-12 h-12 mx-auto mb-3 text-purple-300" />
                    <h3 className="font-bold text-gray-800 mb-1">No friends on the board yet</h3>
                    <p className="text-gray-500 text-sm">Add friends in the Friends tab to see them here!</p>
                </div>
            )}

            {/* Rows — skip top 3 on page 1 if showing podium */}
            <div className="space-y-2">
                {pagedEntries.map((u, i) => {
                    const realIndex = (page - 1) * PAGE_SIZE + i;
                    if (page === 1 && !search && realIndex < 3) return null;
                    return <LeaderboardRow key={u.id || u.user_email} user={u} index={realIndex} currentUserEmail={currentUser?.email} metric={metric} />;
                })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                        className="w-8 h-8 rounded-lg border border-gray-200 text-gray-600 text-sm font-bold disabled:opacity-30 hover:bg-gray-50">‹</button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let p;
                        if (totalPages <= 5) p = i + 1;
                        else if (page <= 3) p = i + 1;
                        else if (page >= totalPages - 2) p = totalPages - 4 + i;
                        else p = page - 2 + i;
                        return (
                            <button key={p} onClick={() => setPage(p)}
                                className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${page === p ? 'bg-purple-600 text-white shadow-md' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{p}</button>
                        );
                    })}
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                        className="w-8 h-8 rounded-lg border border-gray-200 text-gray-600 text-sm font-bold disabled:opacity-30 hover:bg-gray-50">›</button>
                </div>
            )}

            {/* Friend Requests */}
            <Dialog open={showRequests} onOpenChange={setShowRequests}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Friend Requests</DialogTitle></DialogHeader>
                    <div className="space-y-3 py-2">
                        {friendRequests.length === 0 ? <p className="text-center text-gray-400 py-4">No pending requests</p> : friendRequests.map(r => (
                            <div key={r.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-200">
                                <div>
                                    <p className="font-bold text-sm">{r.requester_name}</p>
                                    <p className="text-xs text-gray-500">{r.requester_username ? `@${r.requester_username}` : r.requester_email}</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" onClick={() => handleAccept(r)} className="bg-green-600 hover:bg-green-700 h-8 text-xs"><Check className="w-3 h-3 mr-1" />Accept</Button>
                                    <Button size="sm" variant="outline" onClick={() => { Friendship.update(r.id, { status: 'declined' }); setFriendRequests(p => p.filter(x => x.id !== r.id)); }} className="text-red-600 h-8 text-xs"><X className="w-3 h-3 mr-1" />Decline</Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}