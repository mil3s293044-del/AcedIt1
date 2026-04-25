import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
    Trophy, Swords, Zap, Users, Crown, Flame, Activity,
    Plus, LogIn, Loader2, Clock, Target, ArrowUpRight,
    ArrowDownRight, BarChart2, Star, TrendingUp, ChevronRight, X
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import GoalCompetitionDetail from "@/components/competition/GoalCompetitionDetail";
import { joinGoalCompetition } from "@/functions/joinGoalCompetition";
import HelpButton from "@/components/shared/HelpButton";
import { getSeasonRankFromXP } from "@/components/shared/xpSystem";
import { format, isPast, parseISO, differenceInDays } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

// ── Competition Card ─────────────────────────────────────────────────────────
function CompCard({ comp, currentUserEmail, onClick }) {
    const accepted = (comp.participants || []).filter(p => p.status === 'accepted' || p.status === 'completed');
    const me = comp.participants?.find(p => p.email === currentUserEmail);
    const ranked = [...accepted].sort((a, b) => (b.progress_percent || 0) - (a.progress_percent || 0) || (b.xp_earned || 0) - (a.xp_earned || 0));
    const myRank = ranked.findIndex(p => p.email === currentUserEmail) + 1;
    const isCompleted = comp.status === 'completed';
    const isLeading = myRank === 1 && !isCompleted && accepted.length > 1;
    const myPct = Math.round(me?.progress_percent || 0);

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            onClick={onClick}
            className={`relative cursor-pointer rounded-2xl border-2 p-5 hover:shadow-xl transition-all group ${
                isCompleted ? 'border-purple-200 bg-gradient-to-br from-purple-50 to-white' :
                isLeading ? 'border-amber-300 bg-gradient-to-br from-amber-50 to-white' :
                'border-indigo-200 bg-gradient-to-br from-indigo-50 to-white'
            }`}>
            {/* Live indicator */}
            {!isCompleted && (
                <div className="absolute top-4 right-4 flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                    <span className="text-xs font-semibold text-emerald-600">Live</span>
                </div>
            )}

            <div className="mb-3 pr-16">
                <h3 className="font-bold text-gray-900 truncate">{comp.goal_title}</h3>
                <p className="text-xs text-gray-500 mt-0.5">by {comp.creator_name} · <Users className="w-3 h-3 inline" /> {accepted.length}</p>
            </div>

            {/* My progress ring + bar */}
            {me && (
                <div className="mb-4">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-gray-500 font-medium">Your progress</span>
                        <div className="flex items-center gap-2">
                            {isLeading && <span className="text-amber-600 font-bold flex items-center gap-1"><Crown className="w-3 h-3" />Leading</span>}
                            <span className="font-black text-indigo-600">{myPct}%</span>
                        </div>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${myPct}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className={`h-full rounded-full ${isLeading ? 'bg-gradient-to-r from-amber-400 to-orange-400' : 'bg-gradient-to-r from-indigo-400 to-purple-500'}`}
                        />
                    </div>
                </div>
            )}

            {/* Mini leaderboard */}
            <div className="space-y-1.5">
                {ranked.slice(0, 3).map((p, i) => (
                    <div key={p.email} className={`flex items-center gap-2 text-xs rounded-xl px-2.5 py-1.5 ${p.email === currentUserEmail ? 'bg-indigo-100 font-semibold' : 'bg-gray-50'}`}>
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0 ${i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-gray-400' : 'bg-orange-400'}`}>{i + 1}</div>
                        <span className="flex-1 truncate text-gray-800">{p.name?.split(' ')[0]}</span>
                        <span className="text-indigo-600 font-bold">{Math.round(p.progress_percent || 0)}%</span>
                        <span className="flex items-center gap-0.5 text-amber-600"><Zap className="w-3 h-3" />{p.xp_earned || 0}</span>
                    </div>
                ))}
            </div>

            {isCompleted && comp.winner_name && (
                <div className="mt-3 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    <Trophy className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span className="text-xs font-bold text-amber-800">🏆 {comp.winner_name} won!</span>
                </div>
            )}

            {comp.goal_target_date && (
                <div className="mt-2.5 flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    {format(parseISO(comp.goal_target_date), 'MMM d, yyyy')}
                    {isPast(parseISO(comp.goal_target_date)) && !isCompleted && <Badge className="bg-red-100 text-red-600 text-xs ml-1">Overdue</Badge>}
                </div>
            )}

            <ChevronRight className="absolute bottom-5 right-4 w-4 h-4 text-gray-300 group-hover:text-indigo-500 transition-colors" />
        </motion.div>
    );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function Competitions() {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [competitions, setCompetitions] = useState([]);
    const [wagers, setWagers] = useState([]);
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
                toast({ title: "Joined! 🏆", description: "You're in. Go win." });
                setInviteCode(""); setPendingJoinCode(null);
                await loadData();
            }
        } catch (e) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally { setJoiningCode(false); }
    };

    const activeComps = competitions.filter(c => c.status === 'active' || c.status === 'pending');
    const completedComps = competitions.filter(c => c.status === 'completed');
    const seasonRank = userProfile ? getSeasonRankFromXP(userProfile.season_xp || 0) : null;

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
            </div>
        );
    }

    if (selectedComp) {
        return (
            <div className="p-4 lg:p-8 max-w-3xl mx-auto">
                <GoalCompetitionDetail competition={selectedComp} currentUserEmail={user?.email}
                    onBack={() => { setSelectedComp(null); loadData(); }} onUpdate={loadData} />
            </div>
        );
    }

    return (
        <div className="p-4 lg:p-8">
            <div className="max-w-5xl mx-auto space-y-6">

                {/* ── Hero Header ── */}
                <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-br from-indigo-600 via-purple-600 to-violet-700 rounded-3xl p-6 text-white relative overflow-hidden shadow-xl shadow-indigo-500/20">
                    {/* decorative orbs */}
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
                    <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />

                    <div className="relative">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                                <Swords className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-black">Compete</h1>
                                <p className="text-white/70 text-xs">Goal battles & score wagers</p>
                            </div>
                            <HelpButton page="Competitions" className="bg-white/20 border-white/30 text-white hover:bg-white/30 hover:text-white" />
                            {seasonRank && (
                                <div className="ml-auto flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-2xl px-4 py-2">
                                    <span className="text-2xl">{seasonRank.emoji}</span>
                                    <div>
                                        <p className="text-white/60 text-xs">Season Rank</p>
                                        <p className="font-black text-sm">{seasonRank.name}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Stats row */}
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: "Active Comps", value: activeComps.length, IconComp: Trophy, color: "bg-white/10" },
                                { label: "Completed", value: completedComps.length, IconComp: Activity, color: "bg-white/10" },
                            ].map(({ label, value, IconComp, color }) => (
                                <div key={label} className={`${color} rounded-2xl p-3.5 backdrop-blur-sm`}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <IconComp className="w-4 h-4 text-white/70" />
                                        <span className="text-white/60 text-xs uppercase tracking-wide">{label}</span>
                                    </div>
                                    <p className="text-xl font-black">{value}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>

                {/* ── Join Code Bar ── */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
                    className="flex items-center gap-3 bg-white rounded-2xl border border-gray-200 shadow-sm px-4 py-3 flex-wrap">
                    <LogIn className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                    <span className="text-sm font-semibold text-gray-700">Join with invite code</span>
                    <Input placeholder="ABCD12" value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())}
                        onKeyDown={e => e.key === 'Enter' && handleJoinByCode()}
                        className="w-28 font-mono uppercase text-center" maxLength={6} />
                    <Button onClick={handleJoinByCode} disabled={joiningCode || !inviteCode.trim()} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                        {joiningCode ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Join →'}
                    </Button>
                </motion.div>

                {/* ── Competitions ── */}
                <div className="space-y-6">
                    <p className="text-xs text-gray-400">Start a competition from <strong className="text-gray-600">Goals → Goal detail → Compete with Friends</strong>.</p>

                    {competitions.length === 0 ? (
                        <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-3xl">
                            <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                            <h3 className="text-lg font-bold text-gray-500 mb-1">No Competitions Yet</h3>
                            <p className="text-gray-400 text-sm">Open a goal and tap "Compete" to challenge friends.</p>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {activeComps.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                                        <h3 className="font-black text-gray-800 text-sm uppercase tracking-wide">Live Battles ({activeComps.length})</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {activeComps.map(c => (
                                            <CompCard key={c.id} comp={c} currentUserEmail={user?.email} onClick={() => setSelectedComp(c)} />
                                        ))}
                                    </div>
                                </div>
                            )}
                            {completedComps.length > 0 && (
                                <div>
                                    <h3 className="font-bold text-gray-400 text-sm uppercase tracking-wide mb-3">Settled ({completedComps.length})</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {completedComps.map(c => (
                                            <CompCard key={c.id} comp={c} currentUserEmail={user?.email} onClick={() => setSelectedComp(c)} />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Join setup dialog */}
            <AnimatePresence>
                {joinSetupChoice === 'prompt' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}
                            className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center space-y-4 border-2 border-indigo-100">
                            <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto">
                                <Trophy className="w-7 h-7 text-indigo-600" />
                            </div>
                            <h2 className="text-xl font-black text-gray-900">How do you compete?</h2>
                            <p className="text-sm text-gray-500">Use their sub-goal structure or your own path?</p>
                            <div className="space-y-3 text-left">
                                <button onClick={() => confirmJoin(false)}
                                    className="w-full p-4 border-2 border-indigo-200 rounded-2xl hover:bg-indigo-50 hover:border-indigo-400 transition-all">
                                    <p className="font-bold text-indigo-700 text-sm">📋 Mirror their structure</p>
                                    <p className="text-xs text-gray-500 mt-0.5">Same sub-goals. Fair head-to-head.</p>
                                </button>
                                <button onClick={() => confirmJoin(true)}
                                    className="w-full p-4 border-2 border-purple-200 rounded-2xl hover:bg-purple-50 hover:border-purple-400 transition-all">
                                    <p className="font-bold text-purple-700 text-sm">⚙️ Custom setup</p>
                                    <p className="text-xs text-gray-500 mt-0.5">Your own goal structure, compete on XP.</p>
                                </button>
                            </div>
                            <button onClick={() => { setJoinSetupChoice(null); setPendingJoinCode(null); }}
                                className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}