import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
    Download
} from "lucide-react";
import DataExportModal from "@/components/shared/DataExportModal";
import HelpButton from "@/components/shared/HelpButton";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Loader2 } from "lucide-react";

export default function Settings() {
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

    const getRankBadge = (level) => {
        if (level >= 50) return { text: "Master Scholar", color: "bg-purple-100 text-purple-800", icon: "👑" };
        if (level >= 30) return { text: "Expert Learner", color: "bg-blue-100 text-blue-800", icon: "🎓" };
        if (level >= 20) return { text: "Advanced Student", color: "bg-green-100 text-green-800", icon: "📚" };
        if (level >= 10) return { text: "Study Enthusiast", color: "bg-yellow-100 text-yellow-800", icon: "⭐" };
        return { text: "Beginner", color: "bg-gray-100 text-gray-800", icon: "🌱" };
    };

    const getTierInfo = (tier) => {
        const tiers = {
            free: { name: "Free", color: "bg-gray-100 text-gray-800", icon: "🆓" },
            pro: { name: "Pro", color: "bg-blue-100 text-blue-800", icon: "⭐" },
            premium: { name: "Premium", color: "bg-purple-100 text-purple-800", icon: "👑" }
        };
        return tiers[tier] || tiers.free;
    };

    if (isLoading) {
        return (
            <div className="p-4 lg:p-8">
                <div className="max-w-4xl mx-auto space-y-6">
                    {Array(4).fill(0).map((_, i) => (
                        <Card key={i} className="animate-pulse">
                            <CardContent className="p-6">
                                <div className="h-32 bg-gray-200 rounded" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="p-4 lg:p-8">
                <div className="max-w-4xl mx-auto">
                    <Alert className="bg-red-50 border-red-200">
                        <AlertDescription className="text-red-800">
                            Unable to load user data. Please try logging out and back in.
                        </AlertDescription>
                    </Alert>
                </div>
            </div>
        );
    }

    const rankInfo = getRankBadge(userProfile?.level || 1);
    const tierInfo = getTierInfo(userProfile?.subscription_tier || 'free');
    const hasActiveSubscription = userProfile?.subscription_tier && userProfile.subscription_tier !== 'free';

    return (
        <div className="p-4 lg:p-8">
            <div className="max-w-4xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-3xl lg:text-4xl font-bold text-gray-900">
                            Settings ⚙️
                        </h1>
                        <HelpButton page="Settings" />
                    </div>
                    <p className="text-gray-600 text-lg">
                        Manage your account and app preferences
                    </p>
                </motion.div>

                <div className="grid gap-6">
                    {/* Account Information */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <Card className="bg-white/70 backdrop-blur-sm border-gray-200/50">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-gray-900">
                                    <UserIcon className="w-5 h-5" />
                                    Account Information
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-gray-700">Full Name</Label>
                                        <Input 
                                            value={user.full_name || ""} 
                                            disabled 
                                            className="bg-gray-50 text-gray-900"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-gray-700 flex items-center gap-2">
                                            <Mail className="w-4 h-4" />
                                            Email Address
                                        </Label>
                                        <Input 
                                            value={user.email || ""} 
                                            disabled 
                                            className="bg-gray-50 text-gray-900"
                                        />
                                    </div>
                                </div>

                                {/* Username Section */}
                                <div className="space-y-2">
                                    <Label className="text-gray-700 flex items-center gap-2">
                                        <AtSign className="w-4 h-4" />
                                        Username
                                    </Label>
                                    <div className="flex gap-2">
                                        <Input 
                                            value={username} 
                                            onChange={(e) => setUsername(e.target.value)}
                                            disabled={!isUsernameEditing}
                                            placeholder="Choose a unique username"
                                            className={`${!isUsernameEditing ? 'bg-gray-50' : ''} text-gray-900`}
                                        />
                                        {isUsernameEditing ? (
                                            <div className="flex gap-2">
                                                <Button 
                                                    onClick={saveUsername} 
                                                    disabled={isSaving}
                                                    size="sm"
                                                >
                                                    <Save className="w-4 h-4 mr-1" />
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
                                            <Button 
                                                onClick={() => setIsUsernameEditing(true)} 
                                                variant="outline"
                                                size="sm"
                                            >
                                                Edit
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>



                    {/* Subscription Management */}
                    {hasActiveSubscription && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15 }}
                        >
                            <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-gray-900">
                                        <CreditCard className="w-5 h-5" />
                                        Subscription
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <Badge className={`${tierInfo.color} text-sm`}>
                                                    {tierInfo.icon} {tierInfo.name}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-gray-600">
                                                Manage your subscription, billing, and payment methods
                                            </p>
                                        </div>
                                        <Button
                                            onClick={handleManageSubscription}
                                            disabled={isLoadingPortal}
                                            variant="outline"
                                        >
                                            {isLoadingPortal ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                    Loading...
                                                </>
                                            ) : (
                                                <>
                                                    <CreditCard className="w-4 h-4 mr-2" />
                                                    Manage
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}

                    {/* Privacy Settings */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <Card className="bg-white/70 backdrop-blur-sm border-gray-200/50">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-gray-900">
                                    <Shield className="w-5 h-5" />
                                    Privacy Settings
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {isAnonymous ? <EyeOff className="w-5 h-5 text-gray-600" /> : <Eye className="w-5 h-5 text-blue-600" />}
                                        <div>
                                            <Label htmlFor="anonymous-mode" className="text-gray-900 font-medium">
                                                Anonymous on Leaderboard
                                            </Label>
                                            <p className="text-sm text-gray-600">
                                                Hide your name on the global leaderboard
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
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Data Export */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                        <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-gray-900">
                                    <Download className="w-5 h-5 text-indigo-600" />
                                    Export My Data
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-600">Download your study sessions, quiz attempts, flashcards, goals and more as CSV or PDF.</p>
                                    </div>
                                    <Button onClick={() => setShowExport(true)} className="bg-indigo-600 hover:bg-indigo-700 ml-4 shrink-0">
                                        <Download className="w-4 h-4 mr-2" />Export
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                        <DataExportModal open={showExport} onClose={() => setShowExport(false)} />
                    </motion.div>

                    {/* Account Security */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        <Card className="bg-white/70 backdrop-blur-sm border-gray-200/50">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-gray-900">
                                    <Key className="w-5 h-5" />
                                    Account Security
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Alert className="mb-4 bg-blue-50 border-blue-200">
                                    <Info className="w-4 h-4 text-blue-600" />
                                    <AlertDescription className="text-blue-800">
                                        Your account is secured through Google authentication. To change your password or email, 
                                        please update them in your Google account settings.
                                    </AlertDescription>
                                </Alert>
                                
                                <div className="space-y-3">
                                    <Button 
                                        variant="outline" 
                                        className="w-full justify-start"
                                        onClick={() => window.open("https://myaccount.google.com/security", "_blank")}
                                    >
                                        <Key className="w-4 h-4 mr-2" />
                                        Manage Google Account Security
                                    </Button>
                                    
                                    <Button 
                                        variant="outline" 
                                        className="w-full justify-start text-red-600 border-red-200 hover:bg-red-50"
                                        onClick={async () => {
                                            if (window.confirm("Are you sure you want to sign out?")) {
                                                try {
                                                    await base44.auth.logout();
                                                } catch (error) {
                                                    console.error("Logout error:", error);
                                                }
                                            }
                                        }}
                                    >
                                        Sign Out
                                    </Button>
                                    
                                    <Button 
                                        variant="outline" 
                                        className="w-full justify-start text-red-700 border-red-300 hover:bg-red-100 font-semibold"
                                        onClick={async () => {
                                            const confirmed = window.confirm(
                                                "⚠️ DELETE ACCOUNT - This action is PERMANENT!\n\n" +
                                                "This will permanently delete:\n" +
                                                "• Your profile and all settings\n" +
                                                "• All study sessions and progress\n" +
                                                "• All flashcards and quizzes\n" +
                                                "• All goals and assessments\n" +
                                                "• All saved AI results\n" +
                                                "• All friendships and group memberships\n\n" +
                                                "This cannot be undone. Are you absolutely sure?"
                                            );
                                            
                                            if (confirmed) {
                                                const doubleConfirm = window.confirm(
                                                    "FINAL CONFIRMATION\n\n" +
                                                    "Type OK to confirm you want to delete your account and ALL data permanently."
                                                );
                                                
                                                if (doubleConfirm) {
                                                    try {
                                                        // Delete all user data
                                                        const userEmail = user.email;
                                                        
                                                        // Get all entities owned by user and delete them
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
                                                        
                                                        // Delete all records including leaderboard entry
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
                                                            ...aiResults.map(r => base44.entities.AISavedResult.delete(r.id)),
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
                                                        
                                                        // Logout after deletion
                                                        await base44.auth.logout();
                                                    } catch (error) {
                                                        console.error("Error deleting account:", error);
                                                        toast({ 
                                                            title: "Error", 
                                                            description: "Could not delete account. Please try again.",
                                                            variant: "destructive" 
                                                        });
                                                    }
                                                }
                                            }
                                        }}
                                    >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Delete Account Permanently
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}