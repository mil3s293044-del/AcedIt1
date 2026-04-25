import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
    Users, UserPlus, UserMinus, Inbox, Check, X, Mail,
    Sparkles, Send, Loader2, FileText, Brain, Share2, Gift,
    Search, Flame, Clock, ChevronRight, Package
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { isPremium } from "@/components/shared/subscriptionHelpers";
import HelpButton from "@/components/shared/HelpButton";

// ── Avatar ─────────────────────────────────────────────────────────
const Avatar = ({ name, size = "md" }) => {
    const initials = (name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
    const colors = ["from-pink-400 to-rose-500", "from-violet-400 to-purple-500", "from-blue-400 to-indigo-500", "from-emerald-400 to-teal-500", "from-amber-400 to-orange-500"];
    const color = colors[(name || "").charCodeAt(0) % colors.length];
    const sz = size === "sm" ? "w-9 h-9 text-sm" : "w-12 h-12 text-base";
    return (
        <div className={`${sz} rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center font-bold text-white flex-shrink-0 shadow-md`}>
            {initials}
        </div>
    );
};

// ── Skeleton ────────────────────────────────────────────────────────
const Skeleton = ({ className }) => (
    <div className={`animate-pulse bg-gray-100 rounded-xl ${className}`} />
);

const FriendSkeleton = () => (
    <div className="flex items-center gap-3 p-4 rounded-2xl border border-gray-100 bg-white">
        <Skeleton className="w-12 h-12 rounded-2xl" />
        <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-8 w-24 rounded-xl" />
    </div>
);

const formatTime = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
};

export default function Friends() {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [friends, setFriends] = useState([]);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [sentRequests, setSentRequests] = useState([]);
    const [sharedQuizzes, setSharedQuizzes] = useState([]);
    const [sharedFlashcards, setSharedFlashcards] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("friends");

    // Add friend
    const [showAddFriend, setShowAddFriend] = useState(false);
    const [friendEmail, setFriendEmail] = useState("");
    const [isAddingFriend, setIsAddingFriend] = useState(false);

    // Share
    const [sharingToFriend, setSharingToFriend] = useState(null);
    const [myQuizzes, setMyQuizzes] = useState([]);
    const [myFlashcardDecks, setMyFlashcardDecks] = useState([]);
    const [selectedQuizzes, setSelectedQuizzes] = useState([]);
    const [selectedDecks, setSelectedDecks] = useState([]);
    const [quizSearch, setQuizSearch] = useState("");
    const [deckSearch, setDeckSearch] = useState("");
    const [shareMessage, setShareMessage] = useState("");
    const [isSharing, setIsSharing] = useState(false);

    const { toast } = useToast();

    const loadData = useCallback(async (currentUser) => {
        try {
            // Load friendships & shared items in parallel — NO full user/profile list fetches
            const [
                friendshipsAsRequester,
                friendshipsAsRecipient,
                profileData,
                sharedQuizzesData,
                sharedFlashcardsData,
                quizzesData,
                flashcardsData,
            ] = await Promise.all([
                base44.entities.Friendship.filter({ requester_email: currentUser.email }).catch(() => []),
                base44.entities.Friendship.filter({ recipient_email: currentUser.email }).catch(() => []),
                base44.entities.UserProfile.filter({ created_by: currentUser.email }).catch(() => []),
                base44.entities.SharedQuiz.filter({ shared_with_email: currentUser.email, status: 'pending' }).catch(() => []),
                base44.entities.SharedFlashcard.filter({ shared_with_email: currentUser.email, status: 'pending' }).catch(() => []),
                base44.entities.Quiz.filter({ created_by: currentUser.email }).catch(() => []),
                base44.entities.Flashcard.filter({ created_by: currentUser.email, is_active: true }).catch(() => []),
            ]);

            setUserProfile(profileData[0] || {});
            setSharedQuizzes(sharedQuizzesData || []);
            setSharedFlashcards(sharedFlashcardsData || []);
            setMyQuizzes(quizzesData || []);

            // Group flashcards into decks
            const deckMap = {};
            (flashcardsData || []).forEach(card => {
                const key = `${card.subject_name || 'Other'}_${card.topic || 'General'}`;
                if (!deckMap[key]) {
                    deckMap[key] = {
                        id: card.deck_id || key,
                        subject_name: card.subject_name || 'Other',
                        topic: card.topic || 'General',
                        unit: card.unit || 'General',
                        cards: []
                    };
                }
                deckMap[key].cards.push(card);
            });
            setMyFlashcardDecks(Object.values(deckMap));

            // Build friends list from friendship records directly (no extra User.list call)
            const allFriendships = [...(friendshipsAsRequester || []), ...(friendshipsAsRecipient || [])];
            const accepted = allFriendships.filter(f => f.status === 'accepted');
            const pending = allFriendships.filter(f => f.recipient_email === currentUser.email && f.status === 'pending');
            const sent = allFriendships.filter(f => f.requester_email === currentUser.email && f.status === 'pending');

            const friendsData = accepted.map(f => {
                const iAm = f.requester_email === currentUser.email ? 'requester' : 'recipient';
                return {
                    id: f.id,
                    email: iAm === 'requester' ? f.recipient_email : f.requester_email,
                    full_name: iAm === 'requester' ? (f.recipient_name || f.recipient_email) : (f.requester_name || f.requester_email),
                    username: iAm === 'requester' ? (f.recipient_username || '') : (f.requester_username || ''),
                    streak_days: 0,
                    total_study_time: 0,
                };
            });

            setFriends(friendsData);
            setPendingRequests(pending);
            setSentRequests(sent);
        } catch (err) {
            console.error("Friends load error:", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        const init = async () => {
            const currentUser = await base44.auth.me();
            setUser(currentUser);
            await loadData(currentUser);
        };
        init();
    }, [loadData]);

    const handleAddFriend = async () => {
        const identifier = friendEmail.trim().toLowerCase();
        if (!identifier) return;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
            toast({ title: "Enter a valid email address", variant: "destructive" });
            return;
        }
        if (identifier === user.email.toLowerCase()) {
            toast({ title: "You can't add yourself", variant: "destructive" });
            return;
        }
        setIsAddingFriend(true);
        try {
            const [existA, existB] = await Promise.all([
                base44.entities.Friendship.filter({ requester_email: user.email, recipient_email: identifier }),
                base44.entities.Friendship.filter({ requester_email: identifier, recipient_email: user.email }),
            ]);
            const existing = [...(existA || []), ...(existB || [])][0];
            if (existing) {
                toast({ title: existing.status === 'accepted' ? "Already friends!" : "Request already pending" });
                setIsAddingFriend(false);
                return;
            }
            let targetProfile = null;
            try { targetProfile = (await base44.entities.UserProfile.filter({ created_by: identifier }))[0]; } catch (_) {}
            await base44.entities.Friendship.create({
                requester_email: user.email,
                requester_name: user.full_name,
                requester_username: userProfile?.username || "",
                recipient_email: identifier,
                recipient_name: targetProfile?.username || identifier.split('@')[0],
                recipient_username: targetProfile?.username || "",
                status: 'pending'
            });
            toast({ title: "Friend request sent! 🎉" });
            setFriendEmail("");
            setShowAddFriend(false);
            await loadData(user);
        } catch (err) {
            toast({ title: "Could not send request", variant: "destructive" });
        } finally {
            setIsAddingFriend(false);
        }
    };

    const handleAcceptRequest = async (req) => {
        await base44.entities.Friendship.update(req.id, { status: 'accepted' });
        toast({ title: `Now friends with ${req.requester_name}! 🎉` });
        await loadData(user);
    };

    const handleDeclineRequest = async (req) => {
        await base44.entities.Friendship.update(req.id, { status: 'declined' });
        await loadData(user);
    };

    const handleCancelRequest = async (req) => {
        await base44.entities.Friendship.delete(req.id);
        toast({ title: "Request cancelled" });
        await loadData(user);
    };

    const handleRemoveFriend = async (friendEmail) => {
        if (!confirm("Remove this friend?")) return;
        const [a, b] = await Promise.all([
            base44.entities.Friendship.filter({ requester_email: user.email, recipient_email: friendEmail }),
            base44.entities.Friendship.filter({ requester_email: friendEmail, recipient_email: user.email }),
        ]);
        const f = [...(a || []), ...(b || [])][0];
        if (f) {
            await base44.entities.Friendship.delete(f.id);
            toast({ title: "Friend removed" });
            await loadData(user);
        }
    };

    const handleShare = async () => {
        if (!selectedQuizzes.length && !selectedDecks.length) {
            toast({ title: "Select something to share", variant: "destructive" });
            return;
        }
        setIsSharing(true);
        try {
            const promises = [
                ...selectedQuizzes.map(id => {
                    const quiz = myQuizzes.find(q => q.id === id);
                    if (!quiz) return null;
                    return base44.entities.SharedQuiz.create({
                        quiz_id: quiz.id, quiz_title: quiz.title,
                        shared_by_email: user.email, shared_by_name: user.full_name,
                        shared_with_email: sharingToFriend.email, shared_with_name: sharingToFriend.full_name,
                        quiz_data: { title: quiz.title, subject: quiz.subject, questions: quiz.questions, difficulty: quiz.difficulty, category: quiz.category },
                        message: shareMessage, status: "pending"
                    });
                }),
                ...selectedDecks.map(id => {
                    const deck = myFlashcardDecks.find(d => d.id === id);
                    if (!deck) return null;
                    return base44.entities.SharedFlashcard.create({
                        deck_id: deck.id, deck_name: `${deck.subject_name} - ${deck.topic}`,
                        shared_by_email: user.email, shared_by_name: user.full_name,
                        shared_with_email: sharingToFriend.email, shared_with_name: sharingToFriend.full_name,
                        flashcard_data: deck.cards.map(c => ({ subject_name: c.subject_name, subject_code: c.subject_code, unit: c.unit, topic: c.topic, question: c.question, answer: c.answer })),
                        message: shareMessage, status: "pending"
                    });
                }),
            ].filter(Boolean);
            await Promise.all(promises);
            const total = selectedQuizzes.length + selectedDecks.length;
            toast({ title: `Shared ${total} item${total > 1 ? 's' : ''} with ${sharingToFriend.full_name}! 🎁` });
            setSharingToFriend(null);
            setSelectedQuizzes([]); setSelectedDecks([]); setShareMessage("");
        } catch (err) {
            toast({ title: "Share failed", variant: "destructive" });
        } finally {
            setIsSharing(false);
        }
    };

    const handleAcceptQuiz = async (sq) => {
        await base44.entities.Quiz.create({ title: sq.quiz_data.title, subject: sq.quiz_data.subject, questions: sq.quiz_data.questions, difficulty: sq.quiz_data.difficulty, category: sq.quiz_data.category });
        await base44.entities.SharedQuiz.update(sq.id, { status: 'accepted' });
        toast({ title: `"${sq.quiz_title}" added to your quizzes! ✅` });
        await loadData(user);
    };

    const handleAcceptFlashcards = async (sf) => {
        const newDeckId = `deck_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        await Promise.all(sf.flashcard_data.map(c =>
            base44.entities.Flashcard.create({ ...c, deck_id: newDeckId, is_active: true, session_skip_count: 0, review_count_again: 0, review_count_hard: 0, review_count_good: 0, review_count_easy: 0, consecutive_good: 0, consecutive_easy: 0, is_weak_spot: false })
        ));
        await base44.entities.SharedFlashcard.update(sf.id, { status: 'accepted' });
        toast({ title: `${sf.flashcard_data.length} flashcards imported! ✅` });
        await loadData(user);
    };

    const filteredQuizzes = useMemo(() => myQuizzes.filter(q =>
        q.title.toLowerCase().includes(quizSearch.toLowerCase()) ||
        (q.subject || '').toLowerCase().includes(quizSearch.toLowerCase())
    ), [myQuizzes, quizSearch]);

    const filteredDecks = useMemo(() => myFlashcardDecks.filter(d =>
        d.topic.toLowerCase().includes(deckSearch.toLowerCase()) ||
        d.subject_name.toLowerCase().includes(deckSearch.toLowerCase())
    ), [myFlashcardDecks, deckSearch]);

    const totalShared = sharedQuizzes.length + sharedFlashcards.length;
    const totalNotifs = pendingRequests.length + totalShared;

    return (
        <div className="p-4 lg:p-8 min-h-screen">
            <div className="max-w-5xl mx-auto space-y-6">

                {/* ── Header ── */}
                <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div>
                            <h1 className="text-3xl font-black text-gray-900">Friends</h1>
                            <p className="text-gray-500 text-sm mt-0.5">Study together, grow together</p>
                        </div>
                        <HelpButton page="Friends" />
                    </div>
                    <Button onClick={() => setShowAddFriend(true)}
                        className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white shadow-lg shadow-pink-500/30 rounded-2xl gap-2">
                        <UserPlus className="w-4 h-4" /> Add Friend
                    </Button>
                </motion.div>

                {/* ── Stats Row ── */}
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                    className="grid grid-cols-3 gap-4">
                    {[
                        { label: "Friends", value: isLoading ? "—" : friends.length, icon: Users, color: "text-pink-600", bg: "bg-pink-50" },
                        { label: "Requests", value: isLoading ? "—" : pendingRequests.length, icon: Inbox, color: "text-amber-600", bg: "bg-amber-50", alert: pendingRequests.length > 0 },
                        { label: "Incoming", value: isLoading ? "—" : totalShared, icon: Package, color: "text-violet-600", bg: "bg-violet-50", alert: totalShared > 0 },
                    ].map(s => (
                        <div key={s.label} className={`${s.bg} rounded-2xl p-4 flex items-center gap-3 relative border border-white`}>
                            <s.icon className={`w-5 h-5 ${s.color} flex-shrink-0`} />
                            <div>
                                <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                                <p className="text-xs text-gray-500 font-medium">{s.label}</p>
                            </div>
                            {s.alert && <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />}
                        </div>
                    ))}
                </motion.div>

                {/* ── Main Tabs ── */}
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="bg-gray-100/80 rounded-2xl p-1 h-auto gap-1">
                            {[
                                { value: "friends", label: "Friends", icon: Users },
                                { value: "requests", label: "Requests", icon: Inbox, count: pendingRequests.length },
                                { value: "shared", label: "Shared with me", icon: Sparkles, count: totalShared },
                                { value: "sent", label: "Sent", icon: Send },
                            ].map(tab => (
                                <TabsTrigger key={tab.value} value={tab.value}
                                    className="rounded-xl px-4 py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm relative gap-1.5">
                                    <tab.icon className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">{tab.label}</span>
                                    {tab.count > 0 && (
                                        <span className="bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                                            {tab.count}
                                        </span>
                                    )}
                                </TabsTrigger>
                            ))}
                        </TabsList>

                        {/* Friends Tab */}
                        <TabsContent value="friends" className="mt-4">
                            {isLoading ? (
                                <div className="space-y-3">
                                    {[1, 2, 3].map(i => <FriendSkeleton key={i} />)}
                                </div>
                            ) : friends.length === 0 ? (
                                <div className="text-center py-16">
                                    <div className="w-16 h-16 bg-pink-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
                                        <Users className="w-8 h-8 text-pink-400" />
                                    </div>
                                    <h3 className="font-bold text-gray-900 text-lg mb-1">No friends yet</h3>
                                    <p className="text-gray-500 text-sm mb-4">Add friends to study together and share resources</p>
                                    <Button onClick={() => setShowAddFriend(true)}
                                        className="bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-2xl gap-2">
                                        <UserPlus className="w-4 h-4" /> Add First Friend
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {friends.map((friend, i) => (
                                        <motion.div key={friend.email}
                                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                                            className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100 hover:border-pink-200 hover:shadow-md transition-all group">
                                            <Avatar name={friend.full_name} />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-gray-900 truncate">{friend.full_name}</p>
                                                <p className="text-sm text-gray-400">{friend.username ? `@${friend.username}` : friend.email}</p>
                                            </div>
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button size="sm" variant="outline"
                                                    onClick={() => { setSharingToFriend(friend); setSelectedQuizzes([]); setSelectedDecks([]); setShareMessage(""); }}
                                                    className="rounded-xl border-violet-200 text-violet-600 hover:bg-violet-50 gap-1.5 text-xs">
                                                    <Gift className="w-3.5 h-3.5" /> Share
                                                </Button>
                                                <Button size="icon" variant="ghost"
                                                    onClick={() => handleRemoveFriend(friend.email)}
                                                    className="rounded-xl text-gray-300 hover:text-red-400 hover:bg-red-50 w-8 h-8">
                                                    <UserMinus className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                            {/* Mobile share button */}
                                            <Button size="sm" variant="outline"
                                                onClick={() => { setSharingToFriend(friend); setSelectedQuizzes([]); setSelectedDecks([]); setShareMessage(""); }}
                                                className="sm:hidden rounded-xl border-violet-200 text-violet-600 hover:bg-violet-50 gap-1.5 text-xs">
                                                <Gift className="w-3.5 h-3.5" />
                                            </Button>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </TabsContent>

                        {/* Requests Tab */}
                        <TabsContent value="requests" className="mt-4">
                            {isLoading ? (
                                <div className="space-y-3">{[1, 2].map(i => <FriendSkeleton key={i} />)}</div>
                            ) : pendingRequests.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="w-14 h-14 bg-amber-50 rounded-3xl flex items-center justify-center mx-auto mb-3">
                                        <Inbox className="w-7 h-7 text-amber-300" />
                                    </div>
                                    <p className="font-semibold text-gray-700">All caught up!</p>
                                    <p className="text-sm text-gray-400">No pending friend requests</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {pendingRequests.map((req, i) => (
                                        <motion.div key={req.id}
                                            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                                            className="flex items-center gap-4 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                                            <Avatar name={req.requester_name} />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-gray-900 truncate">{req.requester_name}</p>
                                                <p className="text-sm text-gray-400">{req.requester_username ? `@${req.requester_username}` : req.requester_email}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button size="sm" onClick={() => handleAcceptRequest(req)}
                                                    className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl gap-1.5 text-xs">
                                                    <Check className="w-3.5 h-3.5" /> Accept
                                                </Button>
                                                <Button size="sm" variant="ghost" onClick={() => handleDeclineRequest(req)}
                                                    className="text-gray-400 hover:text-red-500 rounded-xl">
                                                    <X className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </TabsContent>

                        {/* Shared Tab */}
                        <TabsContent value="shared" className="mt-4">
                            {isLoading ? (
                                <div className="space-y-3">{[1, 2].map(i => <FriendSkeleton key={i} />)}</div>
                            ) : totalShared === 0 ? (
                                <div className="text-center py-12">
                                    <div className="w-14 h-14 bg-violet-50 rounded-3xl flex items-center justify-center mx-auto mb-3">
                                        <Sparkles className="w-7 h-7 text-violet-300" />
                                    </div>
                                    <p className="font-semibold text-gray-700">Nothing shared yet</p>
                                    <p className="text-sm text-gray-400">When friends share quizzes or flashcards, they'll appear here</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {sharedQuizzes.map((sq, i) => (
                                        <motion.div key={sq.id}
                                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                                            className="p-4 bg-white rounded-2xl border border-violet-100 hover:border-violet-200 transition-all">
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 bg-gradient-to-br from-violet-100 to-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                                    <FileText className="w-5 h-5 text-violet-600" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-gray-900 truncate">{sq.quiz_title}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Badge className="bg-violet-100 text-violet-700 border-0 text-xs">From {sq.shared_by_name}</Badge>
                                                        <span className="text-xs text-gray-400">{sq.quiz_data?.questions?.length || 0} questions</span>
                                                    </div>
                                                    {sq.message && <p className="text-xs text-gray-500 mt-1.5 italic">"{sq.message}"</p>}
                                                </div>
                                                <div className="flex gap-2 flex-shrink-0">
                                                    <Button size="sm" onClick={() => handleAcceptQuiz(sq)}
                                                        className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl gap-1 text-xs">
                                                        <Check className="w-3 h-3" /> Import
                                                    </Button>
                                                    <Button size="sm" variant="ghost" onClick={async () => {
                                                        await base44.entities.SharedQuiz.update(sq.id, { status: 'declined' });
                                                        await loadData(user);
                                                    }} className="text-gray-300 hover:text-red-400 rounded-xl">
                                                        <X className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                    {sharedFlashcards.map((sf, i) => (
                                        <motion.div key={sf.id}
                                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: (sharedQuizzes.length + i) * 0.04 }}
                                            className="p-4 bg-white rounded-2xl border border-blue-100 hover:border-blue-200 transition-all">
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                                    <Brain className="w-5 h-5 text-blue-600" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-gray-900 truncate">{sf.deck_name}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">From {sf.shared_by_name}</Badge>
                                                        <span className="text-xs text-gray-400">{sf.flashcard_data?.length || 0} cards</span>
                                                    </div>
                                                    {sf.message && <p className="text-xs text-gray-500 mt-1.5 italic">"{sf.message}"</p>}
                                                </div>
                                                <div className="flex gap-2 flex-shrink-0">
                                                    <Button size="sm" onClick={() => handleAcceptFlashcards(sf)}
                                                        className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl gap-1 text-xs">
                                                        <Check className="w-3 h-3" /> Import
                                                    </Button>
                                                    <Button size="sm" variant="ghost" onClick={async () => {
                                                        await base44.entities.SharedFlashcard.update(sf.id, { status: 'declined' });
                                                        await loadData(user);
                                                    }} className="text-gray-300 hover:text-red-400 rounded-xl">
                                                        <X className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </TabsContent>

                        {/* Sent Tab */}
                        <TabsContent value="sent" className="mt-4">
                            {isLoading ? (
                                <div className="space-y-3">{[1].map(i => <FriendSkeleton key={i} />)}</div>
                            ) : sentRequests.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="w-14 h-14 bg-blue-50 rounded-3xl flex items-center justify-center mx-auto mb-3">
                                        <Send className="w-7 h-7 text-blue-300" />
                                    </div>
                                    <p className="font-semibold text-gray-700">No sent requests</p>
                                    <p className="text-sm text-gray-400">Add a friend to get started</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {sentRequests.map((req, i) => (
                                        <motion.div key={req.id}
                                            initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                                            className="flex items-center gap-4 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                                            <Avatar name={req.recipient_name} />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-gray-900 truncate">{req.recipient_name}</p>
                                                <p className="text-sm text-gray-400">{req.recipient_email}</p>
                                            </div>
                                            <Badge className="bg-blue-100 text-blue-600 border-0 text-xs">Pending</Badge>
                                            <Button size="sm" variant="ghost" onClick={() => handleCancelRequest(req)}
                                                className="text-gray-400 hover:text-red-400 rounded-xl text-xs">
                                                Cancel
                                            </Button>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </motion.div>
            </div>

            {/* ── Add Friend Dialog ── */}
            <Dialog open={showAddFriend} onOpenChange={setShowAddFriend}>
                <DialogContent className="sm:max-w-sm rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg">
                            <div className="w-8 h-8 bg-pink-100 rounded-xl flex items-center justify-center">
                                <UserPlus className="w-4 h-4 text-pink-600" />
                            </div>
                            Add a Friend
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-gray-500">Enter their email to send a friend request.</p>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                            placeholder="friend@example.com"
                            value={friendEmail}
                            onChange={e => setFriendEmail(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddFriend()}
                            className="pl-10 rounded-xl border-gray-200 focus:border-pink-400"
                            type="email"
                            autoFocus
                        />
                    </div>
                    <div className="flex gap-2 pt-1">
                        <Button variant="outline" onClick={() => setShowAddFriend(false)} className="flex-1 rounded-xl">Cancel</Button>
                        <Button onClick={handleAddFriend} disabled={isAddingFriend || !friendEmail.trim()}
                            className="flex-1 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl gap-2">
                            {isAddingFriend ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            Send Request
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Share Dialog ── */}
            <Dialog open={!!sharingToFriend} onOpenChange={() => { setSharingToFriend(null); setSelectedQuizzes([]); setSelectedDecks([]); setShareMessage(""); setQuizSearch(""); setDeckSearch(""); }}>
                <DialogContent className="max-w-lg max-h-[90vh] flex flex-col rounded-3xl">
                    <DialogHeader className="flex-shrink-0 pb-2 border-b">
                        <DialogTitle className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-violet-100 rounded-xl flex items-center justify-center">
                                <Gift className="w-4 h-4 text-violet-600" />
                            </div>
                            Share with {sharingToFriend?.full_name}
                        </DialogTitle>
                    </DialogHeader>

                    <Tabs defaultValue="quizzes" className="flex-1 flex flex-col min-h-0 mt-3">
                        <TabsList className="bg-gray-100 rounded-xl p-0.5 h-9 flex-shrink-0">
                            <TabsTrigger value="quizzes" className="rounded-lg text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm flex-1 gap-1.5">
                                <FileText className="w-3.5 h-3.5" /> Quizzes
                                {selectedQuizzes.length > 0 && <span className="bg-violet-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs font-bold">{selectedQuizzes.length}</span>}
                            </TabsTrigger>
                            <TabsTrigger value="flashcards" className="rounded-lg text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm flex-1 gap-1.5">
                                <Brain className="w-3.5 h-3.5" /> Flashcard Decks
                                {selectedDecks.length > 0 && <span className="bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs font-bold">{selectedDecks.length}</span>}
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="quizzes" className="flex-1 flex flex-col min-h-0 mt-3 space-y-2">
                            <div className="relative flex-shrink-0">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <Input placeholder="Search quizzes..." value={quizSearch} onChange={e => setQuizSearch(e.target.value)}
                                    className="pl-9 h-8 text-sm rounded-xl border-gray-200" />
                            </div>
                            <ScrollArea className="flex-1 h-52">
                                <div className="space-y-1.5 pr-2">
                                    {filteredQuizzes.length === 0 ? (
                                        <div className="text-center py-8 text-gray-400 text-sm">
                                            {quizSearch ? "No matching quizzes" : "No quizzes to share yet"}
                                        </div>
                                    ) : filteredQuizzes.map(quiz => (
                                        <label key={quiz.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${selectedQuizzes.includes(quiz.id) ? 'bg-violet-50 border-violet-200' : 'bg-gray-50 border-transparent hover:bg-gray-100'}`}>
                                            <Checkbox checked={selectedQuizzes.includes(quiz.id)}
                                                onCheckedChange={c => setSelectedQuizzes(prev => c ? [...prev, quiz.id] : prev.filter(id => id !== quiz.id))} />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm text-gray-900 truncate">{quiz.title}</p>
                                                <p className="text-xs text-gray-400">{quiz.subject} · {quiz.questions?.length || 0} questions</p>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </ScrollArea>
                        </TabsContent>

                        <TabsContent value="flashcards" className="flex-1 flex flex-col min-h-0 mt-3 space-y-2">
                            <div className="relative flex-shrink-0">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <Input placeholder="Search decks..." value={deckSearch} onChange={e => setDeckSearch(e.target.value)}
                                    className="pl-9 h-8 text-sm rounded-xl border-gray-200" />
                            </div>
                            <ScrollArea className="flex-1 h-52">
                                <div className="space-y-1.5 pr-2">
                                    {filteredDecks.length === 0 ? (
                                        <div className="text-center py-8 text-gray-400 text-sm">
                                            {deckSearch ? "No matching decks" : "No flashcard decks to share yet"}
                                        </div>
                                    ) : filteredDecks.map(deck => (
                                        <label key={deck.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${selectedDecks.includes(deck.id) ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-transparent hover:bg-gray-100'}`}>
                                            <Checkbox checked={selectedDecks.includes(deck.id)}
                                                onCheckedChange={c => setSelectedDecks(prev => c ? [...prev, deck.id] : prev.filter(id => id !== deck.id))} />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm text-gray-900 truncate">{deck.subject_name} — {deck.topic}</p>
                                                <p className="text-xs text-gray-400">{deck.unit} · {deck.cards.length} cards</p>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </ScrollArea>
                        </TabsContent>
                    </Tabs>

                    <div className="flex-shrink-0 space-y-3 pt-3 border-t mt-3">
                        <textarea
                            value={shareMessage}
                            onChange={e => setShareMessage(e.target.value)}
                            placeholder="Add a message (optional)..."
                            rows={2}
                            className="w-full text-sm rounded-xl border border-gray-200 p-3 resize-none focus:outline-none focus:border-violet-400"
                        />
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setSharingToFriend(null)} className="flex-1 rounded-xl text-sm">Cancel</Button>
                            <Button onClick={handleShare} disabled={isSharing || (selectedQuizzes.length === 0 && selectedDecks.length === 0)}
                                className="flex-1 bg-gradient-to-r from-violet-500 to-pink-500 text-white rounded-xl text-sm gap-2">
                                {isSharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                                Share {selectedQuizzes.length + selectedDecks.length > 0 ? `(${selectedQuizzes.length + selectedDecks.length})` : ''}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}