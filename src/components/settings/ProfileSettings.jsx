import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { User as UserIcon, Globe, EyeOff } from 'lucide-react';
import { User, UserProfile, StudyTechnique, QuizAttempt } from '@/entities/all';
import { useToast } from '@/components/ui/use-toast';
import {
    BedDouble, Book, MousePointerClick, Layers,
    Highlighter, BrainCircuit, Timer, Rocket
} from "lucide-react";

const ranks = [
    { name: "Slackademic", minHours: 0, maxHours: 5, color: "gray", icon: BedDouble },
    { name: "Barely Literate Bandit", minHours: 5, maxHours: 10, color: "stone", icon: Book },
    { name: "Wikipedia Warrior", minHours: 10, maxHours: 20, color: "orange", icon: MousePointerClick },
    { name: "Flash Card Finesser", minHours: 20, maxHours: 30, color: "amber", icon: Layers },
    { name: "Highlighter Hoarder", minHours: 30, maxHours: 50, color: "lime", icon: Highlighter },
    { name: "Grind Gremlin", minHours: 50, maxHours: 100, color: "emerald", icon: BrainCircuit },
    { name: "Pomodoro Prodigy", minHours: 100, maxHours: 200, color: "cyan", icon: Timer },
    { name: "Academic Weapon", minHours: 200, maxHours: Infinity, color: "violet", icon: Rocket }
];

const getRankDetails = (totalHours) => {
    return ranks.find(r => totalHours >= r.minHours && totalHours < r.maxHours) || ranks[ranks.length - 1];
};

export default function ProfileSettings() {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [rank, setRank] = useState(ranks[0]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAnonymous, setIsAnonymous] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        const loadData = async () => {
            try {
                const currentUser = await User.me();
                setUser(currentUser);

                const [profile, studySessions, quizAttempts] = await Promise.all([
                    UserProfile.filter({ created_by: currentUser.email }).then(data => data[0] || null),
                    StudyTechnique.filter({ created_by: currentUser.email }),
                    QuizAttempt.filter({ created_by: currentUser.email })
                ]);
                
                setUserProfile(profile);
                setIsAnonymous(profile?.is_anonymous_on_leaderboard || false);
                
                let totalTime = 0;
                studySessions.forEach(s => totalTime += s.session_duration || 0);
                quizAttempts.forEach(a => totalTime += a.time_taken ? Math.ceil(a.time_taken / 60) : 5);

                const totalHours = totalTime / 60;
                setRank(getRankDetails(totalHours));

            } catch (error) {
                console.error("Failed to load user data", error);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    const handleAnonymousToggle = async (checked) => {
        try {
            setIsAnonymous(checked);
            
            if (userProfile) {
                // CRITICAL: Only update the specific field — never overwrite XP or level data
                await UserProfile.update(userProfile.id, { 
                    is_anonymous_on_leaderboard: checked 
                });
            } else {
                // Only create with safe defaults — never wipe XP
                await UserProfile.create({ 
                    is_anonymous_on_leaderboard: checked,
                    total_xp: 0, season_xp: 0, current_level: 1
                });
            }
            
            toast({ 
                title: checked ? "Anonymous mode enabled" : "Anonymous mode disabled",
                description: checked 
                    ? "Your name will be hidden on the global leaderboard" 
                    : "Your name will be visible on the global leaderboard"
            });
        } catch (error) {
            console.error("Error updating anonymous setting:", error);
            setIsAnonymous(!checked); // Revert on error
            toast({ 
                title: "Error", 
                description: "Could not update anonymous setting. Please try again.",
                variant: "destructive"
            });
        }
    };

    if (isLoading) {
        return (
            <Card className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-sm border-gray-200/50 dark:border-slate-700/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><UserIcon className="w-5 h-5"/> Profile</CardTitle>
                </CardHeader>
                <CardContent className="animate-pulse">
                    <div className="h-8 bg-gray-200 dark:bg-slate-700 rounded w-3/4"></div>
                    <div className="h-6 bg-gray-200 dark:bg-slate-700 rounded w-1/2 mt-4"></div>
                </CardContent>
            </Card>
        )
    }

    const RankIcon = rank.icon;

    return (
        <Card className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-sm border-gray-200/50 dark:border-slate-700/50">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><UserIcon className="w-5 h-5"/> Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Username</p>
                    <p className="font-semibold text-lg">{user?.full_name}</p>
                </div>
                <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Current Rank</p>
                    <div className="flex items-center gap-2">
                        <RankIcon className={`w-5 h-5 text-${rank.color}-600`} />
                        <p className="font-semibold text-lg">{rank.name}</p>
                    </div>
                </div>
                <div className="pt-4 border-t">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="anonymous-leaderboard" className="flex items-center gap-2">
                            {isAnonymous ? <EyeOff className="w-4 h-4"/> : <Globe className="w-4 h-4"/>}
                            <div>
                                <div>Anonymous on Global Leaderboard</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 font-normal">
                                    Hide your name from the global leaderboard
                                </div>
                            </div>
                        </Label>
                        <Switch
                            id="anonymous-leaderboard"
                            checked={isAnonymous}
                            onCheckedChange={handleAnonymousToggle}
                        />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}