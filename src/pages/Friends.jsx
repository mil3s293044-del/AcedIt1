import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Users, UserPlus, UserMinus, Inbox, Check, X, Mail,
    Sparkles, Send, Loader2, FileText, Brain, Share2, Gift,
    Search, ArrowRight,
    Heart, Trophy
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import HelpButton from "@/components/shared/HelpButton";
import FriendsLeaderboard from "@/components/friends/FriendsLeaderboard";

// ── Coach voice (chill + motivational, social) ────────────────────────────
function getCoachLine({ name, hour, friendCount, pendingCount, sharedCount }) {
    const period = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : hour < 21 ? "Evening" : "Late night";
    if (friendCount === 0 && pendingCount === 0) {
        return `${period}, ${name}. Studying alone? Add a friend — leaderboards get fun fast.`;
    }
    if (pendingCount > 0) {
        return `${period}, ${name}. ${pendingCount} friend request${pendingCount === 1 ? '' : 's'} waiting on you.`;
    }
    if (sharedCount > 0) {
        return `${period}, ${name}. ${sharedCount} new shared item${sharedCount === 1 ? '' : 's'} from your friends.`;
    }
    if (friendCount >= 10) {
        return `${period}, ${name}. Solid crew of ${friendCount}. You're not studying alone.`;
    }
    if (friendCount > 0) {
        return `${period}, ${name}. ${friendCount} friend${friendCount === 1 ? '' : 's'} along for the ride.`;
    }
    return `${period}, ${name}. Let's grow your study crew.`;
}

// ── Avatar ─────────────────────────────────────────────────────────
// Static class strings for Tailwind JIT — do NOT interpolate.
const Avatar = ({ name, size = "md" }) => {
    const initials = (name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
    const colors = ['bg-chart-3', 'bg-chart-4', 'bg-primary', 'bg-xp', 'bg-streak'];
    const color = colors[(name || "").charCodeAt(0) % colors.length];
    const sz = size === "sm" ? "w-9 h-9 text-sm" : "w-12 h-12 text-base";
    return (
        <div className={`${sz} rounded-2xl ${color} text-white flex items-center justify-center font-bold flex-shrink-0 shadow-soft`}>
            {initials}
        </div>
    );
};

// ── Skeleton ────────────────────────────────────────────────────────
const Skeleton = ({ className }) => (
    <div className={`animate-pulse bg-secondary/50 rounded-xl ${className}`} />
);

const FriendSkeleton = () => (
    <div className="flex items-center gap-3 p-4 rounded-2xl border border-border bg-surface">
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

const FEATURED_THEME = {
    primary:   { bg: "bg-primary/10",   border: "border-primary/25",   iconBg: "bg-primary/15",   iconText: "text-primary"   },
    streak:    { bg: "bg-streak/10",    border: "border-streak/25",    iconBg: "bg-streak/15",    iconText: "text-streak"    },
    xp:        { bg: "bg-xp/10",        border: "border-xp/25",        iconBg: "bg-xp/15",        iconText: "text-xp"        },
    "chart-3": { bg: "bg-chart-3/10",   border: "border-chart-3/25",   iconBg: "bg-chart-3/15",   iconText: "text-chart-3"   },
    "chart-4": { bg: "bg-chart-4/10",   border: "border-chart-4/25",   iconBg: "bg-chart-4/15",   iconText: "text-chart-4"   },
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
            toast({ title: "Friend request sent!" });
            setFriendEmail("");
            setShowAddFriend(false);
            await loadData(user);
        } catch {
            toast({ title: "Could not send request", variant: "destructive" });
        } finally {
            setIsAddingFriend(false);
        }
    };

    const handleAcceptRequest = async (req) => {
        await base44.entities.Friendship.update(req.id, { status: 'accepted' });
        toast({ title: `Now friends with ${req.requester_name}!` });
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
            toast({ title: `Shared ${total} item${total > 1 ? 's' : ''} with ${sharingToFriend.full_name}!` });
            setSharingToFriend(null);
            setSelectedQuizzes([]); setSelectedDecks([]); setShareMessage("");
        } catch {
            toast({ title: "Share failed", variant: "destructive" });
        } finally {
            setIsSharing(false);
        }
    };

    const handleAcceptQuiz = async (sq) => {
        await base44.entities.Quiz.create({ title: sq.quiz_data.title, subject: sq.quiz_data.subject, questions: sq.quiz_data.questions, difficulty: sq.quiz_data.difficulty, category: sq.quiz_data.category });
        await base44.entities.SharedQuiz.update(sq.id, { status: 'accepted' });
        toast({ title: `"${sq.quiz_title}" added to your quizzes!` });
        await loadData(user);
    };

    const handleAcceptFlashcards = async (sf) => {
        const newDeckId = `deck_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        await Promise.all(sf.flashcard_data.map(c =>
            base44.entities.Flashcard.create({ ...c, deck_id: newDeckId, is_active: true, session_skip_count: 0, review_count_again: 0, review_count_hard: 0, review_count_good: 0, review_count_easy: 0, consecutive_good: 0, consecutive_easy: 0, is_weak_spot: false })
        ));
        await base44.entities.SharedFlashcard.update(sf.id, { status: 'accepted' });
        toast({ title: `${sf.flashcard_data.length} flashcards imported!` });
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

    // ── Derived stats for hero / coach / featured ─────────────────────
    const friendCount = friends.length;
    const pendingCount = pendingRequests.length;
    const sentCount = sentRequests.length;
    const sharedQuizCount = sharedQuizzes.length;
    const sharedFlashcardCount = sharedFlashcards.length;
    const inboxCount = pendingCount + totalShared;

    const firstName = userProfile?.username || user?.full_name?.split(' ')[0] || 'friend';
    const hour = new Date().getHours();
    const coachLine = useMemo(() => getCoachLine({
        name: firstName,
        hour,
        friendCount,
        pendingCount,
        sharedCount: totalShared,
    }), [firstName, hour, friendCount, pendingCount, totalShared]);

    // Featured panel — state-aware
    const featured = useMemo(() => {
        if (isLoading) return null;
        if (pendingCount > 0) {
            const req = pendingRequests[0];
            return {
                kind: 'request',
                label: pendingCount === 1 ? "Friend request" : `${pendingCount} friend requests`,
                title: pendingCount === 1
                    ? `${req.requester_name} sent you a friend request`
                    : `${req.requester_name} and ${pendingCount - 1} other${pendingCount - 1 === 1 ? '' : 's'} want to connect`,
                sub: "Accept to start sharing quizzes and flashcards.",
                accent: "primary",
                icon: UserPlus,
                req,
            };
        }
        if (totalShared > 0) {
            const kindLabel = sharedQuizCount > 0 && sharedFlashcardCount > 0
                ? "quizzes & flashcards"
                : sharedQuizCount > 0 ? `quiz${sharedQuizCount === 1 ? '' : 'zes'}` : `flashcard deck${sharedFlashcardCount === 1 ? '' : 's'}`;
            return {
                kind: 'shared',
                label: "Shared with you",
                title: `${totalShared} ${kindLabel} waiting in your inbox`,
                sub: "Friends sent you study material — import what you want.",
                accent: "xp",
                icon: Gift,
            };
        }
        if (friendCount === 0) {
            return {
                kind: 'empty',
                label: "Studying solo?",
                title: "Get on the leaderboard with your friends",
                sub: "Add a friend by email and start sharing quizzes.",
                accent: "chart-3",
                icon: Users,
            };
        }
        // Has friends, no pending action — preview crew
        return {
            kind: 'crew',
            label: "Your crew",
            title: friendCount === 1 ? `You and 1 friend studying together` : `${friendCount} friends studying alongside you`,
            sub: "Share a quiz or flashcard deck — give someone a boost.",
            accent: "chart-4",
            icon: Heart,
        };
    }, [isLoading, pendingCount, pendingRequests, totalShared, sharedQuizCount, sharedFlashcardCount, friendCount]);

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-6xl mx-auto px-4 lg:px-8 py-6 lg:py-10 space-y-6 lg:space-y-8">

                {/* ── COACH STRIP ─────────────────────────────────────── */}
                <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-xs">
                            <span className="font-bold text-muted-foreground uppercase tracking-wider">Social</span>
                            {friendCount > 0 && (
                                <>
                                    <span className="text-muted-foreground/40">·</span>
                                    <span className="inline-flex items-center gap-1 font-extrabold text-chart-3">
                                        <Users className="w-3.5 h-3.5" /> {friendCount} friend{friendCount === 1 ? '' : 's'}
                                    </span>
                                </>
                            )}
                            {pendingCount > 0 && (
                                <>
                                    <span className="text-muted-foreground/40">·</span>
                                    <span className="inline-flex items-center gap-1 font-extrabold text-streak">
                                        <Inbox className="w-3.5 h-3.5" /> {pendingCount} request{pendingCount === 1 ? '' : 's'}
                                    </span>
                                </>
                            )}
                            {totalShared > 0 && (
                                <>
                                    <span className="text-muted-foreground/40">·</span>
                                    <span className="inline-flex items-center gap-1 font-extrabold text-xp">
                                        <Sparkles className="w-3.5 h-3.5" /> {totalShared} shared
                                    </span>
                                </>
                            )}
                        </div>
                        <HelpButton page="Friends" />
                    </div>
                    <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                        {coachLine}
                    </h1>
                </motion.section>

                {/* ── HERO ROW: Crew (3/5) + Inbox (2/5) ──────────────── */}
                <motion.section
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05, duration: 0.4 }}
                    className="grid grid-cols-1 md:grid-cols-5 gap-5 lg:gap-6"
                >
                    {/* Your crew */}
                    <div className="md:col-span-3">
                        {friendCount > 0 ? (
                            <div className="relative overflow-hidden rounded-3xl bg-chart-3/10 border-2 border-chart-3/25 p-6 lg:p-8 h-full">
                                <Users className="absolute -top-6 -right-6 w-32 h-32 text-chart-3/10 pointer-events-none" />
                                <div className="relative">
                                    <div className="flex items-start justify-between mb-2">
                                        <p className="stat-label text-chart-3/80">Your crew</p>
                                        <Button
                                            size="sm"
                                            onClick={() => setShowAddFriend(true)}
                                            className="bg-chart-3 hover:bg-chart-3/90 text-white rounded-xl gap-1.5 -mr-1 -mt-1"
                                        >
                                            <UserPlus className="w-3.5 h-3.5" /> Add friend
                                        </Button>
                                    </div>
                                    <div className="flex items-baseline gap-3 mb-4">
                                        <span
                                            className="font-display font-extrabold text-chart-3 leading-none"
                                            style={{ fontSize: 'clamp(3.5rem, 10vw, 6rem)' }}
                                        >
                                            {friendCount}
                                        </span>
                                        <span className="font-display font-extrabold text-chart-3/50 text-2xl lg:text-3xl">
                                            {friendCount === 1 ? 'friend' : 'friends'}
                                        </span>
                                    </div>
                                    {/* Avatar pile */}
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="flex -space-x-2">
                                            {friends.slice(0, 5).map((f) => (
                                                <div key={f.email} className="ring-2 ring-chart-3/10 rounded-2xl">
                                                    <Avatar name={f.full_name} size="sm" />
                                                </div>
                                            ))}
                                        </div>
                                        {friendCount > 5 && (
                                            <span className="text-sm font-bold text-muted-foreground ml-1">
                                                +{friendCount - 5} more
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-foreground text-sm lg:text-base max-w-md font-medium leading-snug">
                                        {friendCount >= 10
                                            ? "Solid crew. Your study circle is locked in."
                                            : friendCount >= 3
                                                ? "Nice group. Keep growing the crew."
                                                : "Off to a good start — add a few more to fill out the leaderboard."}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-3xl bg-secondary/40 border-2 border-dashed border-border p-6 lg:p-8 text-center h-full flex flex-col items-center justify-center">
                                <Users className="w-12 h-12 text-muted-foreground/30 mb-3" />
                                <h2 className="font-display font-extrabold text-foreground text-xl lg:text-2xl mb-2">
                                    Build your study crew
                                </h2>
                                <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-5">
                                    Add a friend by email — share quizzes, share flashcards, climb the leaderboard together.
                                </p>
                                <Button onClick={() => setShowAddFriend(true)} className="bg-chart-3 hover:bg-chart-3/90 text-white">
                                    <UserPlus className="w-4 h-4" /> Add your first friend
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Inbox */}
                    <div className="md:col-span-2">
                        <div className="rounded-3xl bg-primary/10 border-2 border-primary/25 p-6 h-full flex flex-col">
                            <div className="flex items-center gap-2 mb-2">
                                <Inbox className="w-4 h-4 text-primary" />
                                <p className="stat-label text-primary/80">Inbox</p>
                            </div>
                            <p className="font-display font-extrabold text-foreground leading-none" style={{ fontSize: 'clamp(2.25rem, 5.5vw, 3rem)' }}>
                                {isLoading ? '—' : inboxCount}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2 leading-snug">
                                {inboxCount === 0
                                    ? "All caught up — nothing waiting."
                                    : pendingCount > 0 && totalShared > 0
                                        ? "Requests and shared items waiting."
                                        : pendingCount > 0
                                            ? "Friend requests waiting on you."
                                            : "Friends sent you study material."}
                            </p>
                            <div className="space-y-2.5 mt-4 pt-4 border-t-2 border-primary/15">
                                <div className="flex items-baseline justify-between">
                                    <p className="text-xs font-bold text-muted-foreground inline-flex items-center gap-1.5">
                                        <UserPlus className="w-3 h-3" /> Friend requests
                                    </p>
                                    <p className={`text-xs font-bold ${pendingCount > 0 ? 'text-streak' : 'text-foreground'}`}>{pendingCount}</p>
                                </div>
                                <div className="flex items-baseline justify-between">
                                    <p className="text-xs font-bold text-muted-foreground inline-flex items-center gap-1.5">
                                        <FileText className="w-3 h-3" /> Shared quizzes
                                    </p>
                                    <p className={`text-xs font-bold ${sharedQuizCount > 0 ? 'text-xp' : 'text-foreground'}`}>{sharedQuizCount}</p>
                                </div>
                                <div className="flex items-baseline justify-between">
                                    <p className="text-xs font-bold text-muted-foreground inline-flex items-center gap-1.5">
                                        <Brain className="w-3 h-3" /> Shared decks
                                    </p>
                                    <p className={`text-xs font-bold ${sharedFlashcardCount > 0 ? 'text-xp' : 'text-foreground'}`}>{sharedFlashcardCount}</p>
                                </div>
                                {sentCount > 0 && (
                                    <div className="flex items-baseline justify-between">
                                        <p className="text-xs font-bold text-muted-foreground inline-flex items-center gap-1.5">
                                            <Send className="w-3 h-3" /> Sent (pending)
                                        </p>
                                        <p className="text-xs font-bold text-chart-3">{sentCount}</p>
                                    </div>
                                )}
                            </div>
                            {inboxCount > 0 && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="mt-4 w-full"
                                    onClick={() => setActiveTab(pendingCount > 0 ? 'requests' : 'shared')}
                                >
                                    Open inbox <ArrowRight className="w-3.5 h-3.5" />
                                </Button>
                            )}
                        </div>
                    </div>
                </motion.section>

                {/* ── FEATURED PANEL ──────────────────────────────────── */}
                {featured && (
                    <motion.section
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <div className={`rounded-2xl ${FEATURED_THEME[featured.accent].bg} border-2 ${FEATURED_THEME[featured.accent].border} p-5 lg:p-6`}>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                {featured.kind === 'request' && featured.req ? (
                                    <Avatar name={featured.req.requester_name} />
                                ) : (
                                    <div className={`w-12 h-12 rounded-xl ${FEATURED_THEME[featured.accent].iconBg} flex items-center justify-center flex-shrink-0`}>
                                        <featured.icon className={`w-6 h-6 ${FEATURED_THEME[featured.accent].iconText}`} />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="stat-label mb-1">Today on Friends · {featured.label}</p>
                                    <h2 className="font-display font-extrabold text-foreground text-base lg:text-lg leading-snug">
                                        {featured.title}
                                    </h2>
                                    <p className="text-muted-foreground text-sm mt-0.5">{featured.sub}</p>
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto flex-shrink-0">
                                    {featured.kind === 'request' && featured.req ? (
                                        <>
                                            <Button
                                                onClick={() => handleAcceptRequest(featured.req)}
                                                className="flex-1 sm:flex-initial bg-primary hover:bg-primary/90 text-white"
                                            >
                                                <Check className="w-4 h-4" /> Accept
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={() => handleDeclineRequest(featured.req)}
                                                className="flex-1 sm:flex-initial"
                                            >
                                                Ignore
                                            </Button>
                                        </>
                                    ) : featured.kind === 'shared' ? (
                                        <Button
                                            onClick={() => setActiveTab('shared')}
                                            className="w-full sm:w-auto"
                                        >
                                            Open inbox <ArrowRight className="w-4 h-4" />
                                        </Button>
                                    ) : featured.kind === 'empty' ? (
                                        <Button
                                            onClick={() => setShowAddFriend(true)}
                                            className="w-full sm:w-auto bg-chart-3 hover:bg-chart-3/90 text-white"
                                        >
                                            <UserPlus className="w-4 h-4" /> Add friends
                                        </Button>
                                    ) : (
                                        <Button
                                            onClick={() => setActiveTab('friends')}
                                            variant="outline"
                                            className="w-full sm:w-auto"
                                        >
                                            See your crew <ArrowRight className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.section>
                )}

                {/* ── Main Tabs ──────────────────────────────────────── */}
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
                        <TabsList className="grid w-full grid-cols-5 h-auto p-1.5 rounded-2xl bg-surface border-2 border-border shadow-soft">
                            {[
                                { value: "friends", label: "Friends", icon: Users },
                                { value: "ladder", label: "Ladder", icon: Trophy },
                                { value: "requests", label: "Requests", icon: Inbox, count: pendingRequests.length },
                                { value: "shared", label: "Shared", icon: Sparkles, count: totalShared },
                                { value: "sent", label: "Sent", icon: Send },
                            ].map(tab => (
                                <TabsTrigger key={tab.value} value={tab.value}
                                    className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs lg:text-sm font-bold text-muted-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-soft transition-all relative">
                                    <tab.icon className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">{tab.label}</span>
                                    {tab.count > 0 && (
                                        <span className="bg-streak text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
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
                                    <div className="w-16 h-16 bg-chart-3/10 rounded-3xl flex items-center justify-center mx-auto mb-4">
                                        <Users className="w-8 h-8 text-chart-3" />
                                    </div>
                                    <h3 className="font-bold text-foreground text-lg mb-1">No friends yet</h3>
                                    <p className="text-muted-foreground text-sm mb-4">Add friends to study together and share resources</p>
                                    <Button onClick={() => setShowAddFriend(true)}
                                        className="bg-chart-3 hover:bg-chart-3/90 text-white rounded-2xl gap-2">
                                        <UserPlus className="w-4 h-4" /> Add First Friend
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {friends.map((friend, i) => (
                                        <motion.div key={friend.email}
                                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                                            className="card-soft flex items-center gap-4 p-4 hover:border-chart-3/40 transition-all group">
                                            <Avatar name={friend.full_name} />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-foreground truncate">{friend.full_name}</p>
                                                <p className="text-sm text-muted-foreground/60">{friend.username ? `@${friend.username}` : friend.email}</p>
                                            </div>
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button size="sm" variant="outline"
                                                    onClick={() => { setSharingToFriend(friend); setSelectedQuizzes([]); setSelectedDecks([]); setShareMessage(""); }}
                                                    className="rounded-xl border-chart-4/30 text-chart-4 hover:bg-chart-4/10 gap-1.5 text-xs">
                                                    <Gift className="w-3.5 h-3.5" /> Share
                                                </Button>
                                                <Button size="icon" variant="ghost" aria-label="Remove friend"
                                                    onClick={() => handleRemoveFriend(friend.email)}
                                                    className="rounded-xl text-muted-foreground/60 hover:text-streak hover:bg-streak/10 w-8 h-8">
                                                    <UserMinus className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                            {/* Mobile share button */}
                                            <Button size="sm" variant="outline"
                                                onClick={() => { setSharingToFriend(friend); setSelectedQuizzes([]); setSelectedDecks([]); setShareMessage(""); }}
                                                className="sm:hidden rounded-xl border-chart-4/30 text-chart-4 hover:bg-chart-4/10 gap-1.5 text-xs">
                                                <Gift className="w-3.5 h-3.5" />
                                            </Button>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </TabsContent>

                        {/* Ladder Tab — season-XP ranking of you + friends */}
                        <TabsContent value="ladder" className="mt-4">
                            {isLoading ? (
                                <div className="space-y-3">
                                    {[1, 2, 3].map(i => <FriendSkeleton key={i} />)}
                                </div>
                            ) : friends.length === 0 ? (
                                <div className="text-center py-16">
                                    <div className="w-16 h-16 bg-xp/10 rounded-3xl flex items-center justify-center mx-auto mb-4">
                                        <Trophy className="w-8 h-8 text-xp" />
                                    </div>
                                    <h3 className="font-bold text-foreground text-lg mb-1">The ladder needs rivals</h3>
                                    <p className="text-muted-foreground text-sm mb-4">Add a friend and see who tops the season.</p>
                                    <Button onClick={() => setShowAddFriend(true)}
                                        className="bg-xp hover:bg-xp/90 text-white rounded-2xl gap-2">
                                        <UserPlus className="w-4 h-4" /> Add a Friend
                                    </Button>
                                </div>
                            ) : (
                                <FriendsLeaderboard
                                    friends={friends}
                                    currentUserEmail={user?.email}
                                    currentUserName={userProfile?.display_name || user?.full_name || user?.email}
                                />
                            )}
                        </TabsContent>

                        {/* Requests Tab */}
                        <TabsContent value="requests" className="mt-4">
                            {isLoading ? (
                                <div className="space-y-3">{[1, 2].map(i => <FriendSkeleton key={i} />)}</div>
                            ) : pendingRequests.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="w-14 h-14 bg-streak/10 rounded-3xl flex items-center justify-center mx-auto mb-3">
                                        <Inbox className="w-7 h-7 text-streak" />
                                    </div>
                                    <p className="font-semibold text-muted-foreground">All caught up!</p>
                                    <p className="text-sm text-muted-foreground/60">No pending friend requests</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {pendingRequests.map((req, i) => (
                                        <motion.div key={req.id}
                                            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                                            className="flex items-center gap-4 p-4 bg-streak/10 rounded-2xl border border-border">
                                            <Avatar name={req.requester_name} />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-foreground truncate">{req.requester_name}</p>
                                                <p className="text-sm text-muted-foreground/60">{req.requester_username ? `@${req.requester_username}` : req.requester_email}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button size="sm" onClick={() => handleAcceptRequest(req)}
                                                    className="bg-primary hover:bg-primary/90 text-white rounded-xl gap-1.5 text-xs">
                                                    <Check className="w-3.5 h-3.5" /> Accept
                                                </Button>
                                                <Button size="sm" variant="ghost" onClick={() => handleDeclineRequest(req)}
                                                    className="text-muted-foreground/60 hover:text-streak rounded-xl">
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
                                    <div className="w-14 h-14 bg-chart-4/10 rounded-3xl flex items-center justify-center mx-auto mb-3">
                                        <Sparkles className="w-7 h-7 text-chart-4" />
                                    </div>
                                    <p className="font-semibold text-muted-foreground">Nothing shared yet</p>
                                    <p className="text-sm text-muted-foreground/60">When friends share quizzes or flashcards, they'll appear here</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {sharedQuizzes.map((sq, i) => (
                                        <motion.div key={sq.id}
                                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                                            className="card-soft p-4 hover:border-chart-4/40 transition-all">
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 bg-chart-4/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                                    <FileText className="w-5 h-5 text-chart-4" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-foreground truncate">{sq.quiz_title}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="pill bg-chart-4/15 text-chart-4">From {sq.shared_by_name}</span>
                                                        <span className="text-xs text-muted-foreground/60">{sq.quiz_data?.questions?.length || 0} questions</span>
                                                    </div>
                                                    {sq.message && <p className="text-xs text-muted-foreground mt-1.5 italic">"{sq.message}"</p>}
                                                </div>
                                                <div className="flex gap-2 flex-shrink-0">
                                                    <Button size="sm" onClick={() => handleAcceptQuiz(sq)}
                                                        className="bg-primary hover:bg-primary/90 text-white rounded-xl gap-1 text-xs">
                                                        <Check className="w-3 h-3" /> Import
                                                    </Button>
                                                    <Button size="sm" variant="ghost" onClick={async () => {
                                                        await base44.entities.SharedQuiz.update(sq.id, { status: 'declined' });
                                                        await loadData(user);
                                                    }} className="text-muted-foreground/60 hover:text-streak rounded-xl">
                                                        <X className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                    {sharedFlashcards.map((sf, i) => (
                                        <motion.div key={sf.id}
                                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: (sharedQuizzes.length + i) * 0.04 }}
                                            className="card-soft p-4 hover:border-chart-4/40 transition-all">
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 bg-chart-4/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                                    <Brain className="w-5 h-5 text-chart-4" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-foreground truncate">{sf.deck_name}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="pill bg-chart-4/15 text-chart-4">From {sf.shared_by_name}</span>
                                                        <span className="text-xs text-muted-foreground/60">{sf.flashcard_data?.length || 0} cards</span>
                                                    </div>
                                                    {sf.message && <p className="text-xs text-muted-foreground mt-1.5 italic">"{sf.message}"</p>}
                                                </div>
                                                <div className="flex gap-2 flex-shrink-0">
                                                    <Button size="sm" onClick={() => handleAcceptFlashcards(sf)}
                                                        className="bg-primary hover:bg-primary/90 text-white rounded-xl gap-1 text-xs">
                                                        <Check className="w-3 h-3" /> Import
                                                    </Button>
                                                    <Button size="sm" variant="ghost" onClick={async () => {
                                                        await base44.entities.SharedFlashcard.update(sf.id, { status: 'declined' });
                                                        await loadData(user);
                                                    }} className="text-muted-foreground/60 hover:text-streak rounded-xl">
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
                                    <div className="w-14 h-14 bg-chart-3/10 rounded-3xl flex items-center justify-center mx-auto mb-3">
                                        <Send className="w-7 h-7 text-chart-3" />
                                    </div>
                                    <p className="font-semibold text-muted-foreground">No sent requests</p>
                                    <p className="text-sm text-muted-foreground/60">Add a friend to get started</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {sentRequests.map((req, i) => (
                                        <motion.div key={req.id}
                                            initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                                            className="flex items-center gap-4 p-4 bg-chart-3/10 rounded-2xl border border-border">
                                            <Avatar name={req.recipient_name} />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-foreground truncate">{req.recipient_name}</p>
                                                <p className="text-sm text-muted-foreground/60">{req.recipient_email}</p>
                                            </div>
                                            <span className="pill bg-chart-3/15 text-chart-3">Pending</span>
                                            <Button size="sm" variant="ghost" onClick={() => handleCancelRequest(req)}
                                                className="text-muted-foreground hover:text-streak rounded-xl text-xs">
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
                            <div className="w-8 h-8 bg-chart-3/10 rounded-xl flex items-center justify-center">
                                <UserPlus className="w-4 h-4 text-chart-3" />
                            </div>
                            Add a Friend
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">Enter their email to send a friend request.</p>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                        <Input
                            placeholder="friend@example.com"
                            value={friendEmail}
                            onChange={e => setFriendEmail(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddFriend()}
                            className="pl-10 rounded-xl border-border focus:border-chart-3"
                            type="email"
                            autoFocus
                        />
                    </div>
                    <div className="flex gap-2 pt-1">
                        <Button variant="outline" onClick={() => setShowAddFriend(false)} className="flex-1 rounded-xl">Cancel</Button>
                        <Button onClick={handleAddFriend} disabled={isAddingFriend || !friendEmail.trim()}
                            className="flex-1 bg-chart-3 hover:bg-chart-3/90 text-white rounded-xl gap-2">
                            {isAddingFriend ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            Send Request
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Share Dialog ── */}
            <Dialog open={!!sharingToFriend} onOpenChange={() => { setSharingToFriend(null); setSelectedQuizzes([]); setSelectedDecks([]); setShareMessage(""); setQuizSearch(""); setDeckSearch(""); }}>
                <DialogContent className="max-w-lg max-h-[90vh] flex flex-col rounded-3xl">
                    <DialogHeader className="flex-shrink-0 pb-2 border-b border-border">
                        <DialogTitle className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-chart-4/10 rounded-xl flex items-center justify-center">
                                <Gift className="w-4 h-4 text-chart-4" />
                            </div>
                            Share with {sharingToFriend?.full_name}
                        </DialogTitle>
                    </DialogHeader>

                    <Tabs defaultValue="quizzes" className="flex-1 flex flex-col min-h-0 mt-3">
                        <TabsList className="bg-secondary rounded-xl p-0.5 h-9 flex-shrink-0">
                            <TabsTrigger value="quizzes" className="rounded-lg text-xs data-[state=active]:bg-surface data-[state=active]:shadow-soft flex-1 gap-1.5">
                                <FileText className="w-3.5 h-3.5" /> Quizzes
                                {selectedQuizzes.length > 0 && <span className="bg-chart-4 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs font-bold">{selectedQuizzes.length}</span>}
                            </TabsTrigger>
                            <TabsTrigger value="flashcards" className="rounded-lg text-xs data-[state=active]:bg-surface data-[state=active]:shadow-soft flex-1 gap-1.5">
                                <Brain className="w-3.5 h-3.5" /> Flashcard Decks
                                {selectedDecks.length > 0 && <span className="bg-chart-4 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs font-bold">{selectedDecks.length}</span>}
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="quizzes" className="flex-1 flex flex-col min-h-0 mt-3 space-y-2">
                            <div className="relative flex-shrink-0">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
                                <Input placeholder="Search quizzes..." value={quizSearch} onChange={e => setQuizSearch(e.target.value)}
                                    className="pl-9 h-8 text-sm rounded-xl border-border" />
                            </div>
                            <ScrollArea className="flex-1 h-52">
                                <div className="space-y-1.5 pr-2">
                                    {filteredQuizzes.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground/60 text-sm">
                                            {quizSearch ? "No matching quizzes" : "No quizzes to share yet"}
                                        </div>
                                    ) : filteredQuizzes.map(quiz => (
                                        <label key={quiz.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${selectedQuizzes.includes(quiz.id) ? 'bg-chart-4/10 border-chart-4/30' : 'bg-secondary/50 border-transparent hover:bg-secondary'}`}>
                                            <Checkbox checked={selectedQuizzes.includes(quiz.id)}
                                                onCheckedChange={c => setSelectedQuizzes(prev => c ? [...prev, quiz.id] : prev.filter(id => id !== quiz.id))} />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm text-foreground truncate">{quiz.title}</p>
                                                <p className="text-xs text-muted-foreground/60">{quiz.subject} · {quiz.questions?.length || 0} questions</p>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </ScrollArea>
                        </TabsContent>

                        <TabsContent value="flashcards" className="flex-1 flex flex-col min-h-0 mt-3 space-y-2">
                            <div className="relative flex-shrink-0">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
                                <Input placeholder="Search decks..." value={deckSearch} onChange={e => setDeckSearch(e.target.value)}
                                    className="pl-9 h-8 text-sm rounded-xl border-border" />
                            </div>
                            <ScrollArea className="flex-1 h-52">
                                <div className="space-y-1.5 pr-2">
                                    {filteredDecks.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground/60 text-sm">
                                            {deckSearch ? "No matching decks" : "No flashcard decks to share yet"}
                                        </div>
                                    ) : filteredDecks.map(deck => (
                                        <label key={deck.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${selectedDecks.includes(deck.id) ? 'bg-chart-4/10 border-chart-4/30' : 'bg-secondary/50 border-transparent hover:bg-secondary'}`}>
                                            <Checkbox checked={selectedDecks.includes(deck.id)}
                                                onCheckedChange={c => setSelectedDecks(prev => c ? [...prev, deck.id] : prev.filter(id => id !== deck.id))} />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm text-foreground truncate">{deck.subject_name} — {deck.topic}</p>
                                                <p className="text-xs text-muted-foreground/60">{deck.unit} · {deck.cards.length} cards</p>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </ScrollArea>
                        </TabsContent>
                    </Tabs>

                    <div className="flex-shrink-0 space-y-3 pt-3 border-t border-border mt-3">
                        <textarea
                            value={shareMessage}
                            onChange={e => setShareMessage(e.target.value)}
                            placeholder="Add a message (optional)..."
                            rows={2}
                            className="w-full text-sm rounded-xl border border-border bg-surface p-3 resize-none focus:outline-none focus:border-chart-4"
                        />
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setSharingToFriend(null)} className="flex-1 rounded-xl text-sm">Cancel</Button>
                            <Button onClick={handleShare} disabled={isSharing || (selectedQuizzes.length === 0 && selectedDecks.length === 0)}
                                className="flex-1 bg-chart-4 hover:bg-chart-4/90 text-white rounded-xl text-sm gap-2">
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
