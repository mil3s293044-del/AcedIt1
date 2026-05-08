import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Globe, Users, Clock, Bell, Check, X, Flame, Zap, Trophy, Crown, Star, UserPlus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { getRankFromXP } from "@/components/shared/xpSystem";
import { Friendship } from "@/entities/all";

const fmtTime = (m) => {
    if (!m) return "0h";
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h${m % 60 > 0 ? ` ${m % 60}m` : ''}`;
};

const getRankStyle = (index) => {
    const styles = [
        { bg: "bg-gradient-to-r from-yellow-50 to-amber-50", border: "border-l-4 border-l-yellow-500", badge: "from-yellow-400 to-amber-500", text: "text-yellow-700" },
        { bg: "bg-gradient-to-r from-slate-50 to-gray-100", border: "border-l-4 border-l-slate-400", badge: "from-slate-400 to-gray-500", text: "text-slate-600" },
        { bg: "bg-gradient-to-r from-orange-50 to-amber-50", border: "border-l-4 border-l-orange-400", badge: "from-orange-400 to-amber-500", text: "text-orange-700" },
    ];
    return styles[index] || { bg: "bg-white", border: "border-l-4 border-l-indigo-200", badge: "from-indigo-400 to-purple-500", text: "text-indigo-600" };
};

const LeaderboardRow = ({ user: u, index, currentUserEmail, metric }) => {
    const style = getRankStyle(index);
    const isCurrentUser = u.user_email === currentUserEmail;
    const isTopThree = index < 3;
    const rank = getRankFromXP(u.total_xp || 0);
    const displayName = (u.is_anonymous && u.user_email !== currentUserEmail)
        ? `Anonymous #${u.id?.slice(-4) || '????'}`
        : (u.username || u.user_name || "Student");

    const mainValue = metric === 'study_hours'
        ? fmtTime(u.total_study_time || 0)
        : metric === 'streak'
        ? `${u.streak_days || 0}d`
        : (u.total_xp || 0).toLocaleString();
    const mainLabel = metric === 'study_hours' ? 'study time' : metric === 'streak' ? 'streak' : 'total XP';
    const mainIcon = metric === 'study_hours' ? <Clock className="w-3.5 h-3.5 text-blue-500" /> : metric === 'streak' ? <Flame className="w-3.5 h-3.5 text-orange-500" /> : <Zap className="w-3.5 h-3.5 text-amber-500" />;

    return (
        <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.02 }}>
            <div className={`${style.bg} ${style.border} rounded-xl p-3.5 flex items-center gap-3 ${isCurrentUser ? 'ring-2 ring-purple-400 ring-offset-1' : ''} transition-shadow hover:shadow-md`}>
                <div className={`w-9 h-9 bg-gradient-to-br ${style.badge} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
                    {isTopThree ? <Crown className="w-4 h-4 text-white" /> : <span className="text-white font-bold text-xs">{index + 1}</span>}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900 text-sm truncate">{displayName}</p>
                        {isCurrentUser && <Badge className="bg-purple-100 text-purple-700 text-xs border-0 shrink-0">You</Badge>}
                        <span className="text-sm">{rank.emoji}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                        {u.streak_days > 0 && metric !== 'streak' && (
                            <div className="flex items-center gap-0.5 text-orange-500 text-xs font-medium">
                                <Flame className="w-3 h-3" />{u.streak_days}d
                            </div>
                        )}
                        <span className="text-xs text-gray-400 hidden sm:inline truncate">{rank.name}</span>
                    </div>
                </div>

                <div className="text-right flex-shrink-0">
                    <div className="flex items-center gap-1 justify-end">
                        {mainIcon}
                        <p className={`text-base font-bold ${style.text}`}>{mainValue}</p>
                    </div>
                    <p className="text-xs text-gray-400">{mainLabel}</p>
                </div>
            </div>
        </motion.div>
    );
};

const BoardList = ({ users, currentUserEmail, metric = 'xp', emptyLabel = "No users yet" }) => (
    <div className="space-y-2">
        {users.map((u, i) => (
            <LeaderboardRow key={u.id || u.user_email} user={u} index={i} currentUserEmail={currentUserEmail} metric={metric} />
        ))}
        {users.length === 0 && (
            <div className="bg-gray-50 rounded-xl p-12 text-center">
                <Trophy className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 text-sm">{emptyLabel}</p>
            </div>
        )}
    </div>
);

const FriendRequests = ({ requests, onAccept, onDecline }) => {
    if (!requests?.length) return (
        <div className="text-center py-6 text-gray-500">
            <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No pending requests</p>
        </div>
    );
    return (
        <div className="space-y-3">
            {requests.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-xl border border-yellow-200">
                    <div>
                        <p className="font-semibold text-gray-900 text-sm">{r.requester_name}</p>
                        <p className="text-xs text-gray-500">{r.requester_username ? `@${r.requester_username}` : r.requester_email}</p>
                    </div>
                    <div className="flex gap-2">
                        <Button size="sm" onClick={() => onAccept(r)} className="bg-green-600 hover:bg-green-700 h-8 text-xs">
                            <Check className="w-3 h-3 mr-1" /> Accept
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => onDecline(r)} className="text-red-600 h-8 text-xs">
                            <X className="w-3 h-3 mr-1" /> Decline
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default function LeaderboardComponent() {
    const [globalXP, setGlobalXP] = useState([]);
    const [globalHours, setGlobalHours] = useState([]);
    const [globalStreaks, setGlobalStreaks] = useState([]);
    const [friendsBoard, setFriendsBoard] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [friendRequests, setFriendRequests] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showRequests, setShowRequests] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        const load = async () => {
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

                // Sort by XP
                const byXP = [...lbEntries].sort((a, b) => (b.total_xp || 0) - (a.total_xp || 0)).filter(e => (e.total_xp || 0) > 0);
                setGlobalXP(byXP);

                // Sort by study hours
                const byHours = [...lbEntries].sort((a, b) => (b.total_study_time || 0) - (a.total_study_time || 0)).filter(e => (e.total_study_time || 0) > 0);
                setGlobalHours(byHours);

                // Sort by streak
                const byStreak = [...lbEntries].sort((a, b) => (b.streak_days || 0) - (a.streak_days || 0)).filter(e => (e.streak_days || 0) > 0);
                setGlobalStreaks(byStreak);

                // Friend list
                const myFriendships = friendships.filter(f => f.status === 'accepted' && (f.requester_email === user.email || f.recipient_email === user.email));
                const friendEmails = new Set(myFriendships.map(f => f.requester_email === user.email ? f.recipient_email : f.requester_email));
                friendEmails.add(user.email);
                setFriendsBoard(byXP.filter(e => friendEmails.has(e.user_email)));

                // Pending requests
                setFriendRequests(friendships.filter(f => f.recipient_email === user.email && f.status === 'pending'));

                // Sync own leaderboard entry (include study time)
                if (profile) {
                    const totalStudyMins = studySessions.reduce((s, x) => s + (x.session_duration || 0), 0);
                    const lbData = {
                        user_email: user.email,
                        user_name: user.full_name,
                        username: profile.username || "",
                        total_xp: profile.total_xp || 0,
                        season_xp: profile.season_xp || 0,
                        level: profile.current_level || 1,
                        streak_days: profile.streak_days || 0,
                        total_study_time: totalStudyMins,
                        is_anonymous: profile.is_anonymous_on_leaderboard || false,
                        last_updated: new Date().toISOString(),
                    };
                    const existing = lbEntries.find(e => e.user_email === user.email);
                    if (existing) {
                        base44.entities.Leaderboard.update(existing.id, lbData).catch(() => {});
                    } else {
                        base44.entities.Leaderboard.create(lbData).catch(() => {});
                    }
                }
            } catch (e) {
                console.error("Leaderboard load error:", e);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    const handleAccept = async (req) => {
        await Friendship.update(req.id, { status: 'accepted' });
        toast({ title: "Friend accepted!", description: `You're now friends with ${req.requester_name}.` });
        setFriendRequests(p => p.filter(r => r.id !== req.id));
        const entry = globalXP.find(e => e.user_email === req.requester_email);
        if (entry) setFriendsBoard(p => [...p, entry].sort((a, b) => (b.total_xp || 0) - (a.total_xp || 0)));
    };

    const handleDecline = async (req) => {
        await Friendship.update(req.id, { status: 'declined' });
        toast({ title: "Request declined" });
        setFriendRequests(p => p.filter(r => r.id !== req.id));
    };

    if (isLoading) return (
        <div className="space-y-2">
            {[1,2,3,4,5].map(i => (
                <div key={i} className="bg-white rounded-xl p-4 animate-pulse flex items-center gap-4">
                    <div className="w-9 h-9 bg-gray-200 rounded-xl" />
                    <div className="flex-1"><div className="h-4 bg-gray-200 rounded w-32 mb-2" /><div className="h-3 bg-gray-100 rounded w-20" /></div>
                    <div className="h-5 bg-gray-200 rounded w-16" />
                </div>
            ))}
        </div>
    );

    return (
        <div className="space-y-4">
            {friendRequests.length > 0 && (
                <div className="flex justify-end">
                    <Button onClick={() => setShowRequests(true)} variant="outline" size="sm" className="relative text-xs">
                        <Bell className="w-3.5 h-3.5 mr-1.5" /> Friend Requests
                        <Badge className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-1.5 min-w-[18px] h-4.5 rounded-full">{friendRequests.length}</Badge>
                    </Button>
                </div>
            )}

            <Tabs defaultValue="xp">
                <TabsList className="grid w-full grid-cols-4 bg-white/60 backdrop-blur-sm p-1.5 border border-gray-200 shadow-sm h-auto">
                    <TabsTrigger value="friends" className="flex items-center gap-1.5 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg text-xs font-medium">
                        <Users className="w-3.5 h-3.5" /> Friends
                    </TabsTrigger>
                    <TabsTrigger value="xp" className="flex items-center gap-1.5 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg text-xs font-medium">
                        <Zap className="w-3.5 h-3.5" /> XP
                    </TabsTrigger>
                    <TabsTrigger value="streaks" className="flex items-center gap-1.5 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg text-xs font-medium">
                        <Flame className="w-3.5 h-3.5" /> Streaks
                    </TabsTrigger>
                    <TabsTrigger value="hours" className="flex items-center gap-1.5 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg text-xs font-medium">
                        <Clock className="w-3.5 h-3.5" /> Hours
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="friends" className="mt-3">
                    {friendsBoard.length > 0
                        ? <BoardList users={friendsBoard} currentUserEmail={currentUser?.email} metric="xp" />
                        : (
                            <div className="bg-gray-50 rounded-xl p-12 flex flex-col items-center text-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                                    <Users className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-base font-semibold text-gray-800">No friends on the board yet</h3>
                                    <p className="text-gray-500 text-sm mt-1 max-w-xs">Add a friend or two and you'll race them right here.</p>
                                </div>
                                <Link to={createPageUrl("Friends")}>
                                    <Button size="sm" className="gap-1.5">
                                        <UserPlus className="w-3.5 h-3.5" />
                                        Add friends
                                    </Button>
                                </Link>
                            </div>
                        )}
                </TabsContent>

                <TabsContent value="xp" className="mt-3">
                    <BoardList users={globalXP} currentUserEmail={currentUser?.email} metric="xp" emptyLabel="No XP data yet — start studying!" />
                </TabsContent>

                <TabsContent value="streaks" className="mt-3">
                    <div className="mb-3 p-3 bg-orange-50 border border-orange-200 rounded-xl text-xs text-orange-700 flex items-center gap-2">
                        <Flame className="w-4 h-4 flex-shrink-0" />
                        <span>Longer streaks earn XP multipliers: 3d=1.1×, 7d=1.25×, 14d=1.5×, 30d=2.0×</span>
                    </div>
                    <BoardList users={globalStreaks} currentUserEmail={currentUser?.email} metric="streak" emptyLabel="No streak data yet — study every day!" />
                </TabsContent>

                <TabsContent value="hours" className="mt-3">
                    <BoardList users={globalHours} currentUserEmail={currentUser?.email} metric="study_hours" emptyLabel="No study hours data yet — start studying!" />
                </TabsContent>
            </Tabs>

            <Dialog open={showRequests} onOpenChange={setShowRequests}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Friend Requests</DialogTitle></DialogHeader>
                    <div className="py-2">
                        <FriendRequests requests={friendRequests} onAccept={handleAccept} onDecline={handleDecline} />
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}