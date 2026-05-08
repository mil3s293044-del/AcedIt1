import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Globe, Users, Clock, Zap, Trophy, Crown, Flame, Star, ArrowUp, RefreshCw, Search, Bell, Check, X, Swords } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { getRankFromXP, levelFromXP } from "@/components/shared/xpSystem";
import { Friendship } from "@/entities/all";

const fmt = (m) => !m ? "0h" : m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60 > 0 ? ` ${m % 60}m` : ''}`;
const PAGE_SIZE = 20;

// Deterministic accent token from a string (name/email).
const ACCENT_TOKENS = ['primary', 'xp', 'streak', 'chart-3', 'chart-4'];
const accentFor = (key = '') => {
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
    return ACCENT_TOKENS[Math.abs(h) % ACCENT_TOKENS.length];
};

function Podium({ top3, currentUserEmail, metric }) {
    if (top3.length < 3) return null;
    const order = [top3[1], top3[0], top3[2]]; // Silver, Gold, Bronze display order
    const heights = ["h-24", "h-32", "h-20"];
    // Rank styling per podium position (0=silver, 1=gold, 2=bronze)
    const podiumStyle = [
        { plinth: "bg-secondary border-2 border-border",          ring: "" },
        { plinth: "bg-xp/15 border-2 border-xp/40",               ring: "ring-4 ring-xp/40 ring-offset-2 ring-offset-surface" },
        { plinth: "bg-streak/10 border-2 border-streak/30",       ring: "" },
    ];
    const badges = ["2", "1", "3"];

    return (
        <div className="relative px-2">
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
                    const accent = accentFor(u.user_email || u.id || firstName);
                    return (
                        <motion.div key={u.id} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: oi * 0.15, type: "spring", bounce: 0.4 }}
                            className="flex flex-col items-center gap-1.5">
                            <p className="text-xs font-bold text-foreground text-center w-20 truncate">{firstName}</p>
                            {isMe && <span className="pill bg-primary/15 text-primary text-[10px] py-0">You</span>}
                            <div className="text-center">
                                <p className="text-xs font-extrabold text-xp">{xpStr} XP</p>
                                <p className="text-[11px] text-muted-foreground">{hoursStr} studied</p>
                            </div>
                            <div className={`w-14 h-14 rounded-full bg-${accent}/15 flex items-center justify-center ${podiumStyle[oi].ring}`}>
                                <span className={`font-display font-extrabold text-lg text-${accent}`}>
                                    {firstName?.[0]?.toUpperCase() || '?'}
                                </span>
                            </div>
                            <div className={`w-16 ${heights[oi]} ${podiumStyle[oi].plinth} rounded-t-xl flex items-center justify-center`}>
                                <span className="font-display font-extrabold text-foreground text-2xl">#{badges[oi]}</span>
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
            className="card-soft p-4 bg-xp/5 border-xp/30">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-xp/15 flex items-center justify-center flex-shrink-0">
                    <Swords className="w-5 h-5 text-xp" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-xp uppercase tracking-wide">Next target</p>
                    <p className="font-display font-extrabold text-foreground text-sm truncate">
                        Beat <span className="text-xp">{displayName}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Only <span className="font-bold text-foreground">{gapStr}</span> more {metricLabel} ahead.
                    </p>
                </div>
                <div className="flex flex-col items-center text-xp">
                    <ArrowUp className="w-4 h-4" />
                    <span className="text-[10px] font-extrabold tracking-wide">CLIMB</span>
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
            <div className="card-soft p-5">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-chart-4/10 flex items-center justify-center flex-shrink-0">
                        <Trophy className="w-5 h-5 text-chart-4" />
                    </div>
                    <div>
                        <h2 className="font-display font-extrabold text-foreground text-base">Your rank</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">Where you stand on the leaderboard.</p>
                    </div>
                </div>

                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className="stat-label">Position</p>
                        <p className="stat-num text-foreground">#{rank}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Top {Math.max(1, 100 - percentile)}% of {total} students
                        </p>
                    </div>
                    <div className="w-16 h-16 rounded-2xl bg-chart-4/10 flex items-center justify-center">
                        <span className="text-3xl">{getRankFromXP(myEntry.total_xp || 0).emoji}</span>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground font-semibold">Global percentile</span>
                        <span className="text-foreground font-bold">Top {Math.max(1, 100 - percentile)}%</span>
                    </div>
                    <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${percentile}%` }}
                            transition={{ duration: 1, delay: 0.3 }}
                            className="h-full bg-primary rounded-full" />
                    </div>
                </div>
            </div>
            {nextPlayer && gap > 0 && <BeatNextCard nextPlayer={nextPlayer} gap={gap} metric={metric} />}
        </div>
    );
}

function LeaderboardRow({ user: u, index, currentUserEmail, metric }) {
    // Top-3 accents for rank chip + row tint
    const RANK_STYLES = [
        { row: "bg-xp/10 border-xp/30",         chip: "bg-xp/15 text-xp",         icon: <Crown className="w-4 h-4" /> },
        { row: "bg-secondary border-border",    chip: "bg-secondary text-foreground", icon: <Star className="w-4 h-4" /> },
        { row: "bg-streak/5 border-streak/20",  chip: "bg-streak/15 text-streak", icon: <Trophy className="w-4 h-4" /> },
    ];
    const style = RANK_STYLES[index] || { row: "border-border", chip: "bg-secondary text-muted-foreground", icon: null };
    const isCurrentUser = u.user_email === currentUserEmail;
    const xpRank = getRankFromXP(u.total_xp || 0);
    const level = levelFromXP(u.total_xp || 0);
    const displayName = u.is_anonymous && u.user_email !== currentUserEmail
        ? `Anonymous #${u.id?.slice(-4) || '????'}`
        : (u.username || u.user_name || "Student");

    const mainValue = metric === 'hours' ? fmt(u.total_study_time || 0) : metric === 'streak' ? `${u.streak_days || 0}d` : (u.total_xp || 0).toLocaleString();
    const mainIcon = metric === 'hours'
        ? <Clock className="w-3.5 h-3.5 text-chart-3" />
        : metric === 'streak'
            ? <Flame className="w-3.5 h-3.5 text-streak" />
            : <Zap className="w-3.5 h-3.5 text-xp" />;
    const valueColor = metric === 'hours' ? 'text-chart-3' : metric === 'streak' ? 'text-streak' : 'text-xp';

    const rowBase = isCurrentUser
        ? 'border-2 border-primary bg-primary/5'
        : index < 3
            ? `border ${style.row}`
            : 'border border-border hover:bg-secondary/40';

    return (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.025, 0.4) }}>
            <div className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${rowBase}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${style.chip}`}>
                    {index < 3
                        ? style.icon
                        : <span className="font-display font-extrabold text-xs">{index + 1}</span>}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-display font-extrabold text-foreground text-sm truncate">{displayName}</p>
                        {isCurrentUser && <span className="pill bg-primary/15 text-primary text-[10px] py-0">You</span>}
                        <span className="text-sm">{xpRank.emoji}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-muted-foreground">Lv.{level}</span>
                        {u.streak_days > 0 && metric !== 'streak' && (
                            <div className="flex items-center gap-0.5 text-streak text-xs">
                                <Flame className="w-3 h-3" />{u.streak_days}d
                            </div>
                        )}
                        <span className="text-xs text-muted-foreground/60 truncate hidden sm:inline">{xpRank.name}</span>
                    </div>
                </div>

                <div className="text-right flex-shrink-0">
                    <div className="flex items-center gap-1 justify-end">
                        {mainIcon}
                        <p className={`text-base font-display font-extrabold ${valueColor}`}>{mainValue}</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground/70">
                        {metric === 'hours' ? 'study time' : metric === 'streak' ? 'streak' : 'XP'}
                    </p>
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

    const items = [
        { label: "Leader",      value: topDisplay,                                                                                              sub: (top.username || top.user_name || "").slice(0, 12), accent: "xp" },
        { label: "Players",     value: sorted.length.toLocaleString(),                                                                          sub: "on leaderboard",                                   accent: "chart-3" },
        { label: "Top 50 avg",  value: metric === 'hours' ? fmt(avgVal) : metric === 'streak' ? `${avgVal}d` : avgVal.toLocaleString(),         sub: metric === 'hours' ? 'study time' : metric === 'streak' ? 'streak' : 'XP', accent: "chart-4" },
    ];

    return (
        <div className="card-soft p-4">
            <div className="grid grid-cols-3 gap-3">
                {items.map(({ label, value, sub, accent }) => (
                    <div key={label} className="text-center">
                        <p className={`text-[10px] font-bold uppercase tracking-wider text-${accent}`}>{label}</p>
                        <p className="font-display font-extrabold text-foreground text-base mt-0.5">{value}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{sub}</p>
                    </div>
                ))}
            </div>
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
            {[1,2,3,4,5].map(i => (
                <div key={i} className="card-soft p-4 animate-pulse h-16 flex items-center gap-3">
                    <div className="w-9 h-9 bg-secondary rounded-xl" />
                    <div className="flex-1">
                        <div className="h-4 bg-secondary rounded w-32 mb-1.5" />
                        <div className="h-3 bg-secondary/60 rounded w-20" />
                    </div>
                    <div className="h-5 bg-secondary rounded w-16" />
                </div>
            ))}
        </div>
    );

    return (
        <div className="space-y-5">
            {/* My Position + Tier Progress */}
            {myEntry && myRank > 0 && (
                <MyPositionCard myEntry={myEntry} rank={myRank} metric={metric} total={sorted.length} sorted={sorted} />
            )}

            {/* Controls */}
            <div className="card-soft p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                    {[['global', Globe, 'Global'], ['friends', Users, 'Friends']].map(([s, Icon, label]) => (
                        <button key={s} onClick={() => setScope(s)}
                            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-colors ${scope === s ? 'bg-foreground text-background' : 'bg-secondary text-muted-foreground hover:bg-secondary/70'}`}>
                            <Icon className="w-4 h-4" />{label}
                        </button>
                    ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                    {[
                        ['xp',     Zap,   'XP',     'bg-xp/15 text-xp border border-xp/30'],
                        ['hours',  Clock, 'Hours',  'bg-chart-3/15 text-chart-3 border border-chart-3/30'],
                        ['streak', Flame, 'Streak', 'bg-streak/15 text-streak border border-streak/30'],
                    ].map(([m, Icon, label, activeCls]) => (
                        <button key={m} onClick={() => setMetric(m)}
                            className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-colors ${metric === m ? activeCls : 'bg-secondary text-muted-foreground border border-transparent hover:bg-secondary/70'}`}>
                            <Icon className="w-3.5 h-3.5" />{label}
                        </button>
                    ))}
                </div>
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by username..."
                            className="pl-8 h-9 text-xs bg-secondary/50" />
                    </div>
                    <Button size="sm" variant="outline" onClick={load} className="h-9 w-9 p-0">
                        <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                    {friendRequests.length > 0 && (
                        <Button size="sm" variant="outline" onClick={() => setShowRequests(true)} className="relative h-9 text-xs">
                            <Bell className="w-3.5 h-3.5 mr-1" />
                            <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-streak text-background text-[10px] font-extrabold flex items-center justify-center">
                                {friendRequests.length}
                            </span>
                        </Button>
                    )}
                </div>
            </div>

            {/* Stats Bar */}
            {sorted.length > 0 && !search && <StatsBar sorted={sorted} metric={metric} currentUserEmail={currentUser?.email} />}

            {/* Podium for page 1 with no search */}
            {page === 1 && !search && top3.length >= 3 && (
                <div className="card-soft p-5">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-xp/10 flex items-center justify-center flex-shrink-0">
                            <Trophy className="w-5 h-5 text-xp" />
                        </div>
                        <div>
                            <h2 className="font-display font-extrabold text-foreground text-base">Hall of fame</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {metric === 'xp' ? 'Total XP' : metric === 'hours' ? 'Study hours' : 'Study streak'} leaders.
                            </p>
                        </div>
                    </div>
                    <Podium top3={top3} currentUserEmail={currentUser?.email} metric={metric} />
                </div>
            )}

            {/* Empty state */}
            {sorted.length === 0 && scope === 'friends' && (
                <div className="card-soft p-10 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-chart-4/10 mx-auto mb-3 flex items-center justify-center">
                        <Users className="w-6 h-6 text-chart-4" />
                    </div>
                    <h3 className="font-display font-extrabold text-foreground mb-1">No friends on the board yet</h3>
                    <p className="text-muted-foreground text-sm">Add friends in the Friends tab to see them here.</p>
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
                        className="w-8 h-8 rounded-lg border border-border bg-surface text-muted-foreground text-sm font-bold disabled:opacity-30 hover:bg-secondary/50 transition-colors">‹</button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let p;
                        if (totalPages <= 5) p = i + 1;
                        else if (page <= 3) p = i + 1;
                        else if (page >= totalPages - 2) p = totalPages - 4 + i;
                        else p = page - 2 + i;
                        return (
                            <button key={p} onClick={() => setPage(p)}
                                className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${page === p ? 'bg-foreground text-background' : 'border border-border bg-surface text-muted-foreground hover:bg-secondary/50'}`}>{p}</button>
                        );
                    })}
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                        className="w-8 h-8 rounded-lg border border-border bg-surface text-muted-foreground text-sm font-bold disabled:opacity-30 hover:bg-secondary/50 transition-colors">›</button>
                </div>
            )}

            {/* Friend Requests */}
            <Dialog open={showRequests} onOpenChange={setShowRequests}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="font-display font-extrabold text-foreground">Friend requests</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        {friendRequests.length === 0 ? (
                            <p className="text-center text-muted-foreground py-4 text-sm">No pending requests</p>
                        ) : friendRequests.map(r => (
                            <div key={r.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-secondary/40">
                                <div className="min-w-0">
                                    <p className="font-display font-extrabold text-foreground text-sm truncate">{r.requester_name}</p>
                                    <p className="text-xs text-muted-foreground truncate">
                                        {r.requester_username ? `@${r.requester_username}` : r.requester_email}
                                    </p>
                                </div>
                                <div className="flex gap-2 flex-shrink-0">
                                    <Button size="sm" onClick={() => handleAccept(r)} className="h-8 text-xs">
                                        <Check className="w-3 h-3 mr-1" />Accept
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => { Friendship.update(r.id, { status: 'declined' }); setFriendRequests(p => p.filter(x => x.id !== r.id)); }}
                                        className="h-8 text-xs text-streak hover:text-streak"
                                    >
                                        <X className="w-3 h-3 mr-1" />Decline
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
