import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Coins, Infinity, Loader2, Crown, Calendar } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { differenceInDays, differenceInHours, differenceInMinutes, format } from "date-fns";

export default function CreditsDisplay() {
    const location = useLocation();
    const [userProfile, setUserProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadProfile();
        
        // Refresh credits when returning to the app
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                loadProfile();
            }
        };
        
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        // Refresh every 30 seconds
        const interval = setInterval(loadProfile, 30000);
        
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            clearInterval(interval);
        };
    }, []);

    const loadProfile = async () => {
        try {
            const user = await base44.auth.me();
            const profiles = await base44.entities.UserProfile.filter({ created_by: user.email });
            const profile = profiles[0];
            
            if (profile) {
                // Check if credits need to be renewed
                const now = new Date();
                const resetDate = profile.credits_reset_date ? new Date(profile.credits_reset_date) : null;
                
                // If reset date has passed or doesn't exist, renew credits
                if (!resetDate || now >= resetDate) {
                    const newResetDate = new Date();
                    newResetDate.setDate(newResetDate.getDate() + 14); // 2 weeks from now
                    
                    await base44.entities.UserProfile.update(profile.id, {
                        ai_credits: 500,
                        credits_reset_date: newResetDate.toISOString()
                    });
                    
                    // Reload to get updated profile
                    const updatedProfiles = await base44.entities.UserProfile.filter({ created_by: user.email });
                    setUserProfile(updatedProfiles[0]);
                } else {
                    // Cap credits at 500
                    if (profile.ai_credits > 500) {
                        await base44.entities.UserProfile.update(profile.id, {
                            ai_credits: 500
                        });
                        const updatedProfiles = await base44.entities.UserProfile.filter({ created_by: user.email });
                        setUserProfile(updatedProfiles[0]);
                    } else {
                        setUserProfile(profile);
                    }
                }
            } else {
                setUserProfile(null);
            }
        } catch (error) {
            console.error("Error loading profile:", error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/90 backdrop-blur-sm border border-gray-200 shadow-lg">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            </div>
        );
    }

    const isPremium = userProfile?.subscription_tier === 'premium';
    const credits = userProfile?.ai_credits || 0;
    const resetDate = userProfile?.credits_reset_date;

    const getTimeUntilReset = () => {
        if (!resetDate) return { short: null, long: null };
        
        const reset = new Date(resetDate);
        const now = new Date();
        const days = differenceInDays(reset, now);
        const hours = differenceInHours(reset, now) % 24;
        const minutes = differenceInMinutes(reset, now) % 60;
        
        let short = '';
        let long = '';
        
        if (days > 0) {
            short = `${days}d ${hours}h`;
            long = `${days} ${days === 1 ? 'day' : 'days'} and ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
        } else if (hours > 0) {
            short = `${hours}h ${minutes}m`;
            long = `${hours} ${hours === 1 ? 'hour' : 'hours'} and ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
        } else {
            short = `${minutes}m`;
            long = `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
        }
        
        return { short, long };
    };

    const timeUntilReset = getTimeUntilReset();

    const isDashboard = location.pathname === '/dashboard' || location.pathname === '/';

    return (
        <Popover>
            <PopoverTrigger asChild>
                {isDashboard ? (
                    <button className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity w-full">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                            {isPremium ? (
                                <Crown className="w-5 h-5 text-white" />
                            ) : (
                                <Coins className="w-5 h-5 text-white" />
                            )}
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">
                                {isPremium ? '∞' : credits}
                            </p>
                            <p className="text-white/70 text-xs">
                                {isPremium ? 'Premium' : 'AI Credits'}
                            </p>
                        </div>
                    </button>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="w-full"
                    >
                        <Card className="cursor-pointer hover:shadow-lg transition-all duration-300 border border-yellow-300 bg-gradient-to-br from-yellow-50 to-orange-50">
                            <CardContent className="p-2 px-2.5">
                                <div className="flex items-center gap-2">
                                    {isPremium ? (
                                        <>
                                            <Crown className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                                            <div className="flex items-center gap-1">
                                                <Infinity className="w-4 h-4 text-yellow-600" />
                                                <span className="font-bold text-yellow-700 text-xs">Credits</span>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <Coins className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                                            <span className="font-bold text-yellow-700 text-sm">{credits}</span>
                                        </>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </PopoverTrigger>
            <PopoverContent className="w-72 p-4" align="start" side="right">
                <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b">
                        <Coins className="w-5 h-5 text-yellow-600" />
                        <h4 className="font-bold text-gray-900">AI Credits</h4>
                    </div>
                    
                    {isPremium ? (
                        <div className="text-center py-4">
                            <Infinity className="w-12 h-12 text-yellow-600 mx-auto mb-2" />
                            <p className="font-bold text-gray-900 text-lg">Unlimited Credits</p>
                            <p className="text-sm text-gray-600 mt-1">You have Premium access</p>
                        </div>
                    ) : (
                        <>
                            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg p-4 border border-yellow-200">
                                <div className="text-center">
                                    <div className="text-4xl font-bold text-yellow-600 mb-1">
                                        {credits}
                                    </div>
                                    <p className="text-sm text-gray-700">Credits Available</p>
                                </div>
                            </div>
                            
                            {resetDate && timeUntilReset.long && (
                                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                                    <p className="text-sm font-semibold text-blue-900 mb-2">
                                        Your credits renew in {timeUntilReset.long}
                                    </p>
                                    <div className="flex items-center gap-2 text-xs text-blue-700">
                                        <Calendar className="w-3 h-3" />
                                        <span>Renewal: {format(new Date(resetDate), 'MMM d, yyyy')}</span>
                                    </div>
                                </div>
                            )}
                            
                            <div className="text-xs text-gray-600 space-y-1 pt-2 border-t">
                                <p>• Flashcards: 100 credits</p>
                                <p>• Quizzes: 100 credits</p>
                                <p className="pt-1 text-gray-500">Resets to 500 every 2 weeks (Max: 500)</p>
                            </div>
                        </>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}