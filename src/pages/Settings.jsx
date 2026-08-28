import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { deleteResult } from "@/lib/saveResult";
import { useAuth } from "@/lib/AuthContext";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
    User as UserIcon,
    Shield,
    Eye,
    EyeOff,
    Mail,
    Key,
    Info,
    AtSign,
    Save,
    Trash2,
    Download,
    CreditCard,
    Loader2,
    Crown,
    Sparkles,
    LogOut,
    AlertTriangle,
    ExternalLink,
    GraduationCap
} from "lucide-react";
import DataExportModal from "@/components/shared/DataExportModal";
import HelpButton from "@/components/shared/HelpButton";
import { useToast } from "@/components/ui/use-toast";
import AppearanceSettings from "@/components/settings/AppearanceSettings";

const TIER_META = {
    free:    { label: "Free",    icon: Sparkles, accent: "muted-foreground", bg: "bg-secondary",       text: "text-foreground" },
    pro:     { label: "Pro",     icon: Sparkles, accent: "chart-3",          bg: "bg-chart-3/10",       text: "text-chart-3" },
    premium: { label: "Premium", icon: Crown,    accent: "chart-4",          bg: "bg-chart-4/10",       text: "text-chart-4" },
};

export default function Settings() {
    const { logout } = useAuth();
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [username, setUsername] = useState("");
    const [isUsernameEditing, setIsUsernameEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingPortal, setIsLoadingPortal] = useState(false);
    const [showExport, setShowExport] = useState(false);
    const { toast } = useToast();
    const navigate = useNavigate();

    const loadUserData = useCallback(async () => {
        try {
            const currentUser = await base44.auth.me();
            setUser(currentUser);

            const profiles = await base44.entities.UserProfile.filter({ created_by: currentUser.email });
            const profile = profiles[0] || null;
            setUserProfile(profile);
            setIsAnonymous(profile?.is_anonymous_on_leaderboard || false);
            setUsername(profile?.username || "");

        } catch (error) {
            console.error("Error loading user data:", error);
            toast({
                title: "Error loading settings",
                description: "Please try refreshing the page.",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        loadUserData();
    }, [loadUserData]);

    const saveUsername = async () => {
        if (!username.trim()) {
            toast({ title: "Username cannot be empty", variant: "destructive" });
            return;
        }

        if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
            toast({
                title: "Invalid username",
                description: "Username must be 3-20 characters long and contain only letters, numbers, and underscores.",
                variant: "destructive"
            });
            return;
        }

        setIsSaving(true);
        try {
            const allProfiles = await base44.entities.UserProfile.list();
            const existingProfile = allProfiles.find(p => p.username === username && p.created_by !== user.email);

            if (existingProfile) {
                toast({
                    title: "Username taken",
                    description: "This username is already in use. Please choose another.",
                    variant: "destructive"
                });
                setIsSaving(false);
                return;
            }

            // Always re-fetch the latest profile to avoid stale data — NEVER overwrite XP fields
            const freshProfiles = await base44.entities.UserProfile.filter({ created_by: user.email });
            let profileToUpdate = freshProfiles[0] || userProfile;

            if (!profileToUpdate) {
                // Only create if truly no profile exists — use minimal fields, never touch XP
                profileToUpdate = await base44.entities.UserProfile.create({ created_by: user.email, total_xp: 0, season_xp: 0, current_level: 1 });
            }

            // CRITICAL: Only update username and onboarding_tasks — never touch total_xp, season_xp, current_level, streak_days, or any XP field
            const updatedTasks = { ...(profileToUpdate.onboarding_tasks || {}), username_set: true };
            await base44.entities.UserProfile.update(profileToUpdate.id, {
                username: username,
                onboarding_tasks: updatedTasks
            });

            setIsUsernameEditing(false);
            toast({ title: "Username saved successfully!" });
            await loadUserData();

        } catch (error) {
            console.error("Error saving username:", error);
            toast({
                title: "Error saving username",
                description: "Please try again later.",
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    const toggleAnonymous = async (checked) => {
        setIsSaving(true);
        try {
            setIsAnonymous(checked);

            // Re-fetch latest profile to avoid stale reference — never create a blank profile that could lose XP
            const freshProfiles = await base44.entities.UserProfile.filter({ created_by: user.email });
            const freshProfile = freshProfiles[0] || userProfile;
            if (freshProfile) {
                await base44.entities.UserProfile.update(freshProfile.id, {
                    is_anonymous_on_leaderboard: checked
                });
            } else {
                // Only create if truly no profile exists — preserve XP defaults
                await base44.entities.UserProfile.create({
                    is_anonymous_on_leaderboard: checked,
                    total_xp: 0, season_xp: 0, current_level: 1
                });
            }

            // Also update the leaderboard entry to reflect the change immediately
            try {
                const leaderboardEntries = await base44.entities.Leaderboard.filter({ user_email: user.email });
                if (leaderboardEntries.length > 0) {
                    await base44.entities.Leaderboard.update(leaderboardEntries[0].id, {
                        is_anonymous: checked
                    });
                }
            } catch (leaderboardError) {
                console.error("Error updating leaderboard entry:", leaderboardError);
            }

            toast({
                title: checked ? "Anonymous mode enabled" : "Anonymous mode disabled",
                description: checked
                    ? "You will appear as 'Anonymous User' on the global leaderboard."
                    : "Your username will be visible on the global leaderboard."
            });

        } catch (error) {
            console.error("Error updating anonymity setting:", error);
            setIsAnonymous(!checked);
            toast({
                title: "Error updating setting",
                description: "Please try again later.",
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleManageSubscription = async () => {
        setIsLoadingPortal(true);
        try {
            const response = await base44.functions.invoke('stripePortal', {
                returnUrl: `${window.location.origin}${window.location.pathname}`
            });
            const portalUrl = response?.portalUrl || response?.data?.portalUrl;
            if (portalUrl) {
                window.location.href = portalUrl;
            }
        } catch (error) {
            console.error("Portal error:", error);
            toast({
                title: "Error",
                description: "Could not open subscription management. Please try again.",
                variant: "destructive"
            });
            setIsLoadingPortal(false);
        }
    };

    const handleDeleteAccount = async () => {
        const confirmed = window.confirm(
            "⚠ DELETE ACCOUNT - This action is PERMANENT!\n\n" +
            "This will permanently delete:\n" +
            "• Your profile and all settings\n" +
            "• All study sessions and progress\n" +
            "• All flashcards and quizzes\n" +
            "• All goals and assessments\n" +
            "• All saved AI results\n" +
            "• All friendships and group memberships\n\n" +
            "This cannot be undone. Are you absolutely sure?"
        );

        if (!confirmed) return;

        const doubleConfirm = window.confirm(
            "FINAL CONFIRMATION\n\n" +
            "Type OK to confirm you want to delete your account and ALL data permanently."
        );

        if (!doubleConfirm) return;

        try {
            const userEmail = user.email;

            const [
                userProfiles,
                studySessions,
                studyTechniques,
                studyStreaks,
                flashcards,
                quizzes,
                quizAttempts,
                goals,
                assessments,
                userSubjects,
                studyPlans,
                aiResults,
                friendshipsReq,
                friendshipsRec,
                sharedQuizzes,
                sharedFlashcards,
                sharedAIResults,
                activeRecallSessions,
                blurtingSessions,
                pastPaperAttempts,
                dailyTimetables,
                leaderboardEntries
            ] = await Promise.all([
                base44.entities.UserProfile.filter({ created_by: userEmail }),
                base44.entities.StudySession.filter({ created_by: userEmail }),
                base44.entities.StudyTechnique.filter({ created_by: userEmail }),
                base44.entities.StudyStreak.filter({ created_by: userEmail }),
                base44.entities.Flashcard.filter({ created_by: userEmail }),
                base44.entities.Quiz.filter({ created_by: userEmail }),
                base44.entities.QuizAttempt.filter({ created_by: userEmail }),
                base44.entities.Goal.filter({ created_by: userEmail }),
                base44.entities.SubjectAssessment.filter({ created_by: userEmail }),
                base44.entities.UserSubject.filter({ created_by: userEmail }),
                base44.entities.StudyPlan.filter({ created_by: userEmail }),
                base44.entities.AISavedResult.filter({ created_by: userEmail }),
                base44.entities.Friendship.filter({ requester_email: userEmail }),
                base44.entities.Friendship.filter({ recipient_email: userEmail }),
                base44.entities.SharedQuiz.filter({ shared_with_email: userEmail }),
                base44.entities.SharedFlashcard.filter({ recipient_email: userEmail }),
                base44.entities.SharedAIResult.filter({ recipient_email: userEmail }),
                base44.entities.ActiveRecallSession.filter({ created_by: userEmail }),
                base44.entities.BlurtingSession.filter({ created_by: userEmail }),
                base44.entities.PastPaperAttempt.filter({ created_by: userEmail }),
                base44.entities.DailyTimetable.filter({ created_by: userEmail }),
                base44.entities.Leaderboard.filter({ user_email: userEmail })
            ]);

            const deletePromises = [
                ...userProfiles.map(r => base44.entities.UserProfile.delete(r.id)),
                ...studySessions.map(r => base44.entities.StudySession.delete(r.id)),
                ...studyTechniques.map(r => base44.entities.StudyTechnique.delete(r.id)),
                ...studyStreaks.map(r => base44.entities.StudyStreak.delete(r.id)),
                ...flashcards.map(r => base44.entities.Flashcard.delete(r.id)),
                ...quizzes.map(r => base44.entities.Quiz.delete(r.id)),
                ...quizAttempts.map(r => base44.entities.QuizAttempt.delete(r.id)),
                ...goals.map(r => base44.entities.Goal.delete(r.id)),
                ...assessments.map(r => base44.entities.SubjectAssessment.delete(r.id)),
                ...userSubjects.map(r => base44.entities.UserSubject.delete(r.id)),
                ...studyPlans.map(r => base44.entities.StudyPlan.delete(r.id)),
                ...aiResults.map(r => deleteResult('ai_saved_results', r.id)),
                ...friendshipsReq.map(r => base44.entities.Friendship.delete(r.id)),
                ...friendshipsRec.map(r => base44.entities.Friendship.delete(r.id)),
                ...sharedQuizzes.map(r => base44.entities.SharedQuiz.delete(r.id)),
                ...sharedFlashcards.map(r => base44.entities.SharedFlashcard.delete(r.id)),
                ...sharedAIResults.map(r => base44.entities.SharedAIResult.delete(r.id)),
                ...activeRecallSessions.map(r => base44.entities.ActiveRecallSession.delete(r.id)),
                ...blurtingSessions.map(r => base44.entities.BlurtingSession.delete(r.id)),
                ...pastPaperAttempts.map(r => base44.entities.PastPaperAttempt.delete(r.id)),
                ...dailyTimetables.map(r => base44.entities.DailyTimetable.delete(r.id)),
                ...leaderboardEntries.map(r => base44.entities.Leaderboard.delete(r.id))
            ];

            await Promise.all(deletePromises);

            toast({
                title: "Account Deleted",
                description: "All your data has been permanently deleted."
            });

            await logout();
        } catch (error) {
            console.error("Error deleting account:", error);
            toast({
                title: "Error",
                description: "Could not delete account. Please try again.",
                variant: "destructive"
            });
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background">
                <div className="max-w-4xl mx-auto px-4 lg:px-8 py-8 space-y-4">
                    {Array(4).fill(0).map((_, i) => (
                        <div key={i} className="card-soft p-6 animate-pulse">
                            <div className="h-32 bg-secondary/50 rounded-xl" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-background">
                <div className="max-w-4xl mx-auto px-4 lg:px-8 py-8">
                    <div className="card-soft p-6 border-streak/30 bg-streak/5">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-streak flex-shrink-0 mt-0.5" />
                            <p className="text-foreground text-sm">
                                Unable to load user data. Please try logging out and back in.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const tier = userProfile?.subscription_tier || 'free';
    const tierMeta = TIER_META[tier] || TIER_META.free;
    const TierIcon = tierMeta.icon;
    const hasActiveSubscription = tier !== 'free';

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-4xl mx-auto px-4 lg:px-8 py-6 lg:py-8 space-y-6">

                {/* ── HERO ──────────────────────────────────────────────── */}
                <motion.section
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35 }}
                >
                    <div className="flex items-start justify-between mb-1">
                        <p className="text-sm text-muted-foreground font-medium">Account</p>
                        <HelpButton page="Settings" />
                    </div>
                    <h1 className="font-display text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground">
                        Settings
                    </h1>
                    <p className="text-muted-foreground mt-2 text-sm lg:text-base">
                        Manage your account, subscription, and privacy.
                    </p>
                </motion.section>

                {/* ── ACCOUNT INFORMATION ──────────────────────────────── */}
                <motion.section
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="card-soft p-6"
                >
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <UserIcon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="font-display font-extrabold text-foreground text-base">Account information</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">Your name, email, and public username.</p>
                        </div>
                    </div>

                    <div className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Full name</Label>
                                <Input
                                    value={user.full_name || ""}
                                    disabled
                                    className="bg-secondary/50"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                                    <Mail className="w-3.5 h-3.5" />
                                    Email
                                </Label>
                                <Input
                                    value={user.email || ""}
                                    disabled
                                    className="bg-secondary/50"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                                <AtSign className="w-3.5 h-3.5" />
                                Username
                            </Label>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <Input
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    disabled={!isUsernameEditing}
                                    placeholder="Choose a unique username"
                                    className={!isUsernameEditing ? 'bg-secondary/50' : ''}
                                />
                                {isUsernameEditing ? (
                                    <div className="flex gap-2">
                                        <Button onClick={saveUsername} disabled={isSaving} size="sm">
                                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            Save
                                        </Button>
                                        <Button
                                            onClick={() => {
                                                setIsUsernameEditing(false);
                                                setUsername(userProfile?.username || "");
                                            }}
                                            variant="outline"
                                            size="sm"
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                ) : (
                                    <Button onClick={() => setIsUsernameEditing(true)} variant="outline" size="sm">
                                        Edit
                                    </Button>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">3–20 characters. Letters, numbers, and underscores only.</p>
                        </div>
                    </div>
                </motion.section>

                {/* ── STUDY SETUP ──────────────────────────────────────── */}
                <motion.section
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 }}
                    className="card-soft p-6"
                >
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <GraduationCap className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="font-display font-extrabold text-foreground text-base">Study setup</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">Year level, subjects and goals.</p>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <p className="text-sm text-muted-foreground max-w-md">
                            Retake the setup wizard to update your year level, subjects and ATAR goal in one pass — the same one you saw when you signed up.
                        </p>
                        <Button onClick={() => navigate("/onboarding")} variant="outline" className="flex-shrink-0">
                            Retake study setup
                        </Button>
                    </div>
                </motion.section>

                {/* ── SUBSCRIPTION ─────────────────────────────────────── */}
                {hasActiveSubscription && (
                    <motion.section
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="card-soft p-6"
                    >
                        <div className="flex items-center gap-3 mb-5">
                            <div className={`w-10 h-10 rounded-xl ${tierMeta.bg} flex items-center justify-center flex-shrink-0`}>
                                <CreditCard className={`w-5 h-5 ${tierMeta.text}`} />
                            </div>
                            <div>
                                <h2 className="font-display font-extrabold text-foreground text-base">Subscription</h2>
                                <p className="text-xs text-muted-foreground mt-0.5">Plan, billing, and payment methods.</p>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <span className={`pill ${tierMeta.bg} ${tierMeta.text} gap-1.5`}>
                                    <TierIcon className="w-3.5 h-3.5" />
                                    {tierMeta.label} plan
                                </span>
                                <span className="text-sm text-muted-foreground hidden sm:inline">
                                    Active
                                </span>
                            </div>
                            <Button
                                onClick={handleManageSubscription}
                                disabled={isLoadingPortal}
                                variant="outline"
                            >
                                {isLoadingPortal ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Loading…
                                    </>
                                ) : (
                                    <>
                                        Manage
                                        <ExternalLink className="w-3.5 h-3.5" />
                                    </>
                                )}
                            </Button>
                        </div>
                    </motion.section>
                )}

                {/* ── PRIVACY ──────────────────────────────────────────── */}
                <motion.section
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="card-soft p-6"
                >
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 rounded-xl bg-chart-3/10 flex items-center justify-center flex-shrink-0">
                            <Shield className="w-5 h-5 text-chart-3" />
                        </div>
                        <div>
                            <h2 className="font-display font-extrabold text-foreground text-base">Privacy</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">Control how you appear to others.</p>
                        </div>
                    </div>

                    <div className="flex items-start justify-between gap-4 p-4 rounded-xl border-2 border-border bg-background/40">
                        <div className="flex items-start gap-3 min-w-0">
                            {isAnonymous
                                ? <EyeOff className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                                : <Eye className="w-5 h-5 text-chart-3 flex-shrink-0 mt-0.5" />
                            }
                            <div className="min-w-0">
                                <Label htmlFor="anonymous-mode" className="text-foreground font-bold text-sm block">
                                    Anonymous on leaderboard
                                </Label>
                                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                                    Hide your name on the global leaderboard. You'll appear as "Anonymous User".
                                </p>
                            </div>
                        </div>
                        <Switch
                            id="anonymous-mode"
                            checked={isAnonymous}
                            onCheckedChange={toggleAnonymous}
                            disabled={isSaving}
                        />
                    </div>
                </motion.section>

                {/* ── DATA EXPORT ──────────────────────────────────────── */}
                <motion.section
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="card-soft p-6"
                >
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 rounded-xl bg-chart-4/10 flex items-center justify-center flex-shrink-0">
                            <Download className="w-5 h-5 text-chart-4" />
                        </div>
                        <div>
                            <h2 className="font-display font-extrabold text-foreground text-base">Export your data</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">Download everything you've created.</p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Study sessions, quiz attempts, flashcards, goals and more — as CSV or PDF.
                        </p>
                        <Button onClick={() => setShowExport(true)} className="flex-shrink-0">
                            <Download className="w-4 h-4" />
                            Export
                        </Button>
                    </div>
                    <DataExportModal open={showExport} onClose={() => setShowExport(false)} />
                </motion.section>

                {/* ── ACCOUNT SECURITY ─────────────────────────────────── */}
                <motion.section
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="card-soft p-6"
                >
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 rounded-xl bg-xp/10 flex items-center justify-center flex-shrink-0">
                            <Key className="w-5 h-5 text-xp" />
                        </div>
                        <div>
                            <h2 className="font-display font-extrabold text-foreground text-base">Account security</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">Sign out, manage credentials, or close your account.</p>
                        </div>
                    </div>

                    <div className="rounded-xl bg-chart-3/5 border-2 border-chart-3/20 p-4 mb-4 flex items-start gap-3">
                        <Info className="w-4 h-4 text-chart-3 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-foreground leading-relaxed">
                            Your account uses Google sign-in. Change your password or email from your{' '}
                            <a
                                href="https://myaccount.google.com/security"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-bold text-chart-3 hover:underline"
                            >
                                Google account security
                            </a>{' '}
                            page.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Button
                            variant="outline"
                            className="w-full justify-start"
                            onClick={() => window.open("https://myaccount.google.com/security", "_blank")}
                        >
                            <Key className="w-4 h-4" />
                            Manage Google account security
                            <ExternalLink className="w-3.5 h-3.5 ml-auto text-muted-foreground" />
                        </Button>

                        <Button
                            variant="outline"
                            className="w-full justify-start"
                            onClick={async () => {
                                if (window.confirm("Are you sure you want to sign out?")) {
                                    try {
                                        await logout();
                                    } catch (error) {
                                        console.error("Logout error:", error);
                                    }
                                }
                            }}
                        >
                            <LogOut className="w-4 h-4" />
                            Sign out
                        </Button>
                    </div>
                </motion.section>

                {/* ── APPEARANCE ───────────────────────────────────────── */}
                {/* This panel has existed for months, with a working toggle in
                    it and no importer anywhere, so it was never once on screen.
                    It sits above the danger zone rather than below it: picking
                    a theme is the most harmless thing on this page and deleting
                    your account is the least, and they should not be neighbours. */}
                <AppearanceSettings delay={0.28} />

                {/* ── DANGER ZONE ──────────────────────────────────────── */}
                <motion.section
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.34 }}
                    className="card-soft p-6 border-streak/30 bg-streak/5"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-streak/10 flex items-center justify-center flex-shrink-0">
                            <AlertTriangle className="w-5 h-5 text-streak" />
                        </div>
                        <div>
                            <h2 className="font-display font-extrabold text-foreground text-base">Danger zone</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">Permanent and irreversible.</p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <p className="text-sm text-foreground leading-relaxed">
                            Delete your account and every record tied to it. This can't be undone.
                        </p>
                        <Button variant="destructive" onClick={handleDeleteAccount} className="flex-shrink-0">
                            <Trash2 className="w-4 h-4" />
                            Delete account
                        </Button>
                    </div>
                </motion.section>
            </div>
        </div>
    );
}
