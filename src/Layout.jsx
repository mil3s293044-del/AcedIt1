import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import OnboardingModal from "@/components/onboarding/OnboardingModal";
import { useToast } from "@/components/ui/use-toast";
import { createPageUrl } from "@/utils";
import { Clock, Coffee, Move } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster } from "@/components/ui/toaster";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import UpgradeModal from "@/components/shared/UpgradeModal";
import XPFeedback from "@/components/ranked/XPFeedback";
import StreakCelebration from "@/components/ranked/StreakCelebration";
import StakesStrip from "@/components/arena/StakesStrip";
import TopNav from "@/components/layout/TopNav";
import BottomNav from "@/components/layout/BottomNav";
import SideRail from "@/components/layout/SideRail";
import AceCompanion from "@/components/ace/AceCompanion";

const FloatingTimer = React.memo(({ currentTime, timerPosition, isDragging, handleMouseDown, timerRef, formatTime }) => (
    <motion.div
        ref={timerRef}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        style={{
            position: 'fixed',
            left: `${timerPosition.x}px`,
            top: `${timerPosition.y}px`,
            cursor: isDragging ? 'grabbing' : 'grab',
            zIndex: 99
        }}
        onMouseDown={handleMouseDown}
        className="touch-none"
    >
        <Card className={`bg-surface/95 backdrop-blur-sm border-2 ${isDragging ? 'border-purple-400 shadow-2xl' : 'border-purple-200 shadow-lg hover:shadow-xl'} transition-all select-none`}>
            <CardContent className="p-3 timer-content">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <Move className="w-4 h-4 text-purple-400" />
                        {currentTime.isBreak ? (
                            <Coffee className="w-4 h-4 text-purple-500" />
                        ) : (
                            <Clock className="w-4 h-4 text-purple-500" />
                        )}
                    </div>
                    <Link to={createPageUrl("Study")} className="flex-1" onClick={(e) => e.stopPropagation()}>
                        <div>
                            <div className="font-mono font-bold text-lg text-foreground">
                                {formatTime(currentTime.timeLeft)}
                            </div>
                            <div className="text-xs text-gray-600">
                                {currentTime.isBreak ? 'Break Time' : `Session #${currentTime.session}`}
                            </div>
                            {currentTime.subject && !currentTime.isBreak && (
                                <div className="text-xs text-gray-500 truncate max-w-32">
                                    {currentTime.subject}
                                </div>
                            )}
                        </div>
                    </Link>
                </div>
            </CardContent>
        </Card>
    </motion.div>
));

FloatingTimer.displayName = 'FloatingTimer';

export default function Layout({ children, currentPageName }) {
    const location = useLocation();
    const navigate = useNavigate();
    const [globalTimer, setGlobalTimer] = useState(null);
    const [currentTime, setCurrentTime] = useState(null);
    const [timerPosition, setTimerPosition] = useState(() => {
        const saved = localStorage.getItem('timerPosition');
        return saved ? JSON.parse(saved) : { x: window.innerWidth - 220, y: 70 };
    });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const timerRef = useRef(null);
    const [userProfile, setUserProfile] = useState(null);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [blockedFeature, setBlockedFeature] = useState(null);
    const [navigationGuard, setNavigationGuard] = useState({ show: false, targetUrl: null, onSave: null });
    const [pendingNavigation, setPendingNavigation] = useState(null);
    const [showOnboarding, setShowOnboarding] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        const loadUserProfile = async () => {
            try {
                const user = await base44.auth.me();
                const profiles = await base44.entities.UserProfile.filter({ created_by: user.email });
                let profile = profiles[0] || null;

                // Silently expire premium if past expiry date
                if (profile && profile.subscription_tier === 'premium' && profile.subscription_expires_at) {
                    if (new Date(profile.subscription_expires_at) < new Date()) {
                        profile = await base44.entities.UserProfile.update(profile.id, {
                            subscription_tier: 'free',
                            user_role: 'free_user',
                            subscription_expires_at: null,
                            ai_credits: 500,
                        });
                    }
                }

                // Expire trial if trial_ends_at has passed
                if (profile && profile.trial_active && profile.trial_ends_at) {
                    if (new Date(profile.trial_ends_at) < new Date()) {
                        profile = await base44.entities.UserProfile.update(profile.id, {
                            trial_active: false,
                            subscription_active: false,
                        });
                    }
                }

                setUserProfile(profile);

                // Best-effort ban check. RLS may block reads of other users'
                // rate-limit rows; that's fine — server.mjs enforces bans on
                // every AI call, so a missed read here just defers detection.
                let rlRecord = null;
                try {
                    const records = await base44.entities.AIRateLimit.filter({ user_email: user.email });
                    rlRecord = records[0];
                } catch {}
                if (rlRecord?.is_frozen && rlRecord?.freeze_reason === 'banned_account') {
                    navigate("/Suspended");
                    return;
                }

                // Onboarding + subscription gates intentionally removed for v1 launch:
                //   • Free users keep access to free-tier features. Premium-only
                //     features are gated at the page level via <RequirePremium>
                //     (e.g. /AITools) — no app-wide blanket block.
                //   • Onboarding modal disabled until we redesign the flow.
                // If you ever want either back, uncomment the original blocks
                // in git history (commit `Add SAC mode, skeleton loading, ...`).
                if (profile && profile.subscription_active && !profile.onboarding_completed) {
                    // Keep the data clean: any active-subscription user without
                    // an onboarding flag gets it set silently (no UI prompt).
                    await base44.entities.UserProfile.update(profile.id, {
                        onboarding_completed: true,
                        onboarding_completed_at: new Date().toISOString(),
                    });
                }
            } catch (error) {
                console.error("Error loading user profile:", error);
            }
        };
        loadUserProfile();
    }, []);

    useEffect(() => {
        const handleTimerStateChange = (event) => {
            try { setGlobalTimer(event.detail); } catch {}
        };
        const checkInitialTimerState = () => {
            try {
                const savedState = localStorage.getItem('globalTimerState');
                if (savedState) {
                    const state = JSON.parse(savedState);
                    if (state?.isActive) setGlobalTimer(state);
                }
            } catch {
                localStorage.removeItem('globalTimerState');
                localStorage.removeItem('pomodoroTimerState');
            }
        };
        window.addEventListener('timerStateChanged', handleTimerStateChange);
        checkInitialTimerState();
        return () => window.removeEventListener('timerStateChanged', handleTimerStateChange);
    }, []);

    useEffect(() => {
        if (!globalTimer?.isActive || !globalTimer?.isRunning) {
            setCurrentTime(null);
            return;
        }
        const updateTimer = () => {
            try {
                const savedState = localStorage.getItem('pomodoroTimerState');
                if (!savedState) { setCurrentTime(null); setGlobalTimer(null); return; }
                const state = JSON.parse(savedState);
                if (!state?.isRunning || state.timeLeft <= 0) {
                    setCurrentTime(null); setGlobalTimer(null);
                    localStorage.removeItem('pomodoroTimerState');
                    localStorage.removeItem('globalTimerState');
                    return;
                }
                const now = Date.now();
                const timeSinceUpdate = Math.floor((now - (state.lastUpdated || now)) / 1000);
                const actualTimeLeft = Math.max(0, state.timeLeft - timeSinceUpdate);
                if (actualTimeLeft > 0) {
                    setCurrentTime({ timeLeft: actualTimeLeft, isBreak: state.isBreak || false, session: state.session, subject: state.selectedSubject });
                } else {
                    setCurrentTime(null); setGlobalTimer(null);
                    localStorage.removeItem('pomodoroTimerState');
                    localStorage.removeItem('globalTimerState');
                }
            } catch {
                setCurrentTime(null); setGlobalTimer(null);
            }
        };
        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [globalTimer]);

    const handleMouseDown = useCallback((e) => {
        if (e.target.closest('.timer-content a')) return;
        setIsDragging(true);
        setDragStart({ x: e.clientX - timerPosition.x, y: e.clientY - timerPosition.y });
    }, [timerPosition.x, timerPosition.y]);

    useEffect(() => {
        if (!isDragging) return;
        const handleMouseMove = (e) => {
            const newX = e.clientX - dragStart.x;
            const newY = e.clientY - dragStart.y;
            const timerWidth = timerRef.current?.offsetWidth || 200;
            const timerHeight = timerRef.current?.offsetHeight || 100;
            setTimerPosition({
                x: Math.max(16, Math.min(newX, window.innerWidth - timerWidth - 16)),
                y: Math.max(16, Math.min(newY, window.innerHeight - timerHeight - 16))
            });
        };
        const handleMouseUp = () => {
            setIsDragging(false);
            localStorage.setItem('timerPosition', JSON.stringify(timerPosition));
        };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragStart, timerPosition]);

    const formatTime = useCallback((seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }, []);

    const showFloatingTimer = currentTime?.timeLeft > 0 && !location.pathname.includes(createPageUrl("Study"));

    return (
        <div className="min-h-screen bg-background relative">
            <SideRail />
            <TopNav />

            <AnimatePresence>
                {showFloatingTimer && (
                    <FloatingTimer
                        currentTime={currentTime}
                        timerPosition={timerPosition}
                        isDragging={isDragging}
                        handleMouseDown={handleMouseDown}
                        timerRef={timerRef}
                        formatTime={formatTime}
                    />
                )}
            </AnimatePresence>

            <main className="text-foreground w-full pb-20 md:pb-0 md:pl-16">
                <StakesStrip />
                {children}
            </main>

            <BottomNav />

            <Toaster />

            {/* Navigation Guard Dialog */}
            <Dialog open={navigationGuard.show} onOpenChange={(open) => {
                if (!open) {
                    setNavigationGuard({ show: false, targetUrl: null, onSave: null });
                    setPendingNavigation(null);
                }
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>You have unsaved work</DialogTitle>
                    </DialogHeader>
                    <p className="text-gray-600">Your current work will be lost if you leave without saving.</p>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" onClick={() => {
                            setNavigationGuard({ show: false, targetUrl: null, onSave: null });
                            setPendingNavigation(null);
                        }}>Go Back</Button>
                        <Button variant="destructive" onClick={() => {
                            setNavigationGuard({ show: false, targetUrl: null, onSave: null });
                            if (pendingNavigation) { navigate(pendingNavigation); setPendingNavigation(null); }
                        }}>Don't Save & Continue</Button>
                    </div>
                </DialogContent>
            </Dialog>

            <UpgradeModal
                isOpen={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                feature={blockedFeature}
                requiredTier="premium"
                userProfile={userProfile}
                isBlocking={false}
            />
            <XPFeedback />
            <StreakCelebration />

            <AceCompanion userProfile={userProfile} />

            {showOnboarding && (
                <OnboardingModal
                    userProfile={userProfile || {}}
                    onComplete={async (completedData) => {
                        if (userProfile?.id) {
                            await base44.entities.UserProfile.update(userProfile.id, {
                                onboarding_completed: true,
                                onboarding_completed_at: new Date().toISOString()
                            });
                        }
                        setShowOnboarding(false);
                        setUserProfile(prev => ({ ...(prev || {}), ...completedData, onboarding_completed: true }));
                        const name = completedData.display_name || completedData.username || "";
                        toast({ title: `Welcome to AcedIt${name ? `, ${name}` : ""}! 🎓` });
                        navigate("/Dashboard");
                    }}
                />
            )}
        </div>
    );
}