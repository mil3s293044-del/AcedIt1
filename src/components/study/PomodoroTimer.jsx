import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Play, Pause, RotateCcw, BookOpen, Coffee, Settings, Maximize, X, Zap, Clock } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { recordStudyAndGetStreak } from "@/components/shared/streakHelpers";

// Static class lookup so Tailwind JIT can see every class string.
// `accentVar` is the CSS variable used for inline `style` color/filter
// (SVG stroke + drop-shadow filters need a real color value, not a class).
const COLOR_SCHEMES = {
    work: {
        token: "primary",
        ring: "text-primary",
        timerText: "text-primary",
        button: "bg-primary hover:bg-primary/90",
        badge: "bg-primary/10 text-primary border-primary/20",
        tile10: "bg-primary/10",
        tile5: "bg-primary/5",
        focusBg: "bg-primary/10",
        accentVar: "hsl(var(--primary))",
    },
    shortBreak: {
        token: "chart-3",
        ring: "text-chart-3",
        timerText: "text-chart-3",
        button: "bg-chart-3 hover:bg-chart-3/90",
        badge: "bg-chart-3/10 text-chart-3 border-chart-3/20",
        tile10: "bg-chart-3/10",
        tile5: "bg-chart-3/5",
        focusBg: "bg-chart-3/10",
        accentVar: "hsl(var(--chart-3))",
    },
    longBreak: {
        token: "chart-4",
        ring: "text-chart-4",
        timerText: "text-chart-4",
        button: "bg-chart-4 hover:bg-chart-4/90",
        badge: "bg-chart-4/10 text-chart-4 border-chart-4/20",
        tile10: "bg-chart-4/10",
        tile5: "bg-chart-4/5",
        focusBg: "bg-chart-4/10",
        accentVar: "hsl(var(--chart-4))",
    },
};

// Display only — the award itself is calculated server-side in
// calcStudySessionXP. Keep the two in step.
const XP_PER_MINUTE = 4;

export default function PomodoroTimer({ onSessionComplete, userSubjects: initialUserSubjects = [] }) {
    const [settings, setSettings] = useState({
        workTime: 25,
        shortBreak: 5,
        longBreak: 15,
        sessionsBeforeLongBreak: 4,
    });
    const [userSubjects, setUserSubjects] = useState(initialUserSubjects);

    const [isBreak, setIsBreak] = useState(false);
    const [session, setSession] = useState(1);
    const [timeLeft, setTimeLeft] = useState(25 * 60);
    const [isRunning, setIsRunning] = useState(false);
    const [selectedSubject, setSelectedSubject] = useState("");
    const [topic, setTopic] = useState("");
    const [isFocusMode, setIsFocusMode] = useState(false);
    const [showFocusPrompt, setShowFocusPrompt] = useState(false);
    const [hasBeenStarted, setHasBeenStarted] = useState(false);
    // ── Attention telemetry ─────────────────────────────────────────────────
    // The app has never recorded anything about a session except its length,
    // so nothing could say whether focus held. These two facts — how often the
    // student paused, and whether the timer ran out or was stopped early — are
    // the difference between "you studied 25 minutes" and "you studied 25
    // minutes across four restarts". Written to StudyTechnique.extra, which is
    // an existing jsonb column, so no migration. It only describes sessions
    // from here on: Analytics says so rather than pretending the history is
    // missing by accident.
    const pausesRef = useRef(0);
    const [showSettings, setShowSettings] = useState(false);

    const intervalRef = useRef(null);
    const focusModeRef = useRef(null);
    const isResettingRef = useRef(false);
    const { toast } = useToast();

    const isLongBreak = useCallback((sessionNum) => {
        return sessionNum % settings.sessionsBeforeLongBreak === 0;
    }, [settings.sessionsBeforeLongBreak]);

    // Initialize or update timeLeft based on current mode and settings
    useEffect(() => {
        if (isRunning || hasBeenStarted) return;

        if (isBreak) {
            const breakTime = isLongBreak(session - 1) ? settings.longBreak : settings.shortBreak;
            setTimeLeft(breakTime * 60);
        } else {
            setTimeLeft(settings.workTime * 60);
        }
    }, [settings, isBreak, session, isRunning, hasBeenStarted, isLongBreak]);

    // Update global timer state whenever timer state changes
    useEffect(() => {
        const globalTimerState = {
            isActive: hasBeenStarted && (isRunning || timeLeft > 0),
            timeLeft,
            isRunning,
            isBreak,
            session,
            selectedSubject,
            topic,
            lastUpdated: Date.now()
        };

        localStorage.setItem('globalTimerState', JSON.stringify(globalTimerState));
        window.dispatchEvent(new CustomEvent('timerStateChanged', { detail: globalTimerState }));
    }, [hasBeenStarted, isRunning, timeLeft, isBreak, session, selectedSubject, topic]);

    // Load user subjects on mount
    useEffect(() => {
        const loadSubjects = async () => {
            try {
                const currentUser = await base44.auth.me();

                const subjects = await base44.entities.UserSubject.filter({
                    created_by: currentUser.email,
                    is_active: true
                });

                const uniqueSubjects = subjects.reduce((acc, current) => {
                    const exists = acc.find(item => item.subject_name === current.subject_name);
                    if (!exists) {
                        acc.push(current);
                    }
                    return acc;
                }, []);

                setUserSubjects(uniqueSubjects || []);
            } catch (error) {
                console.error("Error loading subjects:", error);
            }
        };
        loadSubjects();
    }, []);

    // Restore timer state from localStorage on initial load
    useEffect(() => {
        const savedTimerState = localStorage.getItem('pomodoroTimerState');
        if (savedTimerState) {
            try {
                const state = JSON.parse(savedTimerState);
                const now = Date.now();
                const timePassed = Math.floor((now - state.lastUpdated) / 1000);

                const currentSettings = state.settings || {
                    workTime: 25,
                    shortBreak: 5,
                    longBreak: 15,
                    sessionsBeforeLongBreak: 4,
                };
                setSettings(currentSettings);

                setSession(state.session || 1);
                setIsBreak(state.isBreak || false);
                setHasBeenStarted(true);
                setSelectedSubject(state.selectedSubject || "");
                setTopic(state.topic || "");

                if (state.isRunning && state.timeLeft > timePassed) {
                    setTimeLeft(state.timeLeft - timePassed);
                    setIsRunning(true);
                } else {
                    setTimeLeft(state.timeLeft || 25 * 60);
                    setIsRunning(false);
                }
            } catch (error) {
                console.error("Error restoring timer state:", error);
                localStorage.removeItem('pomodoroTimerState');
            }
        }
    }, []);

    useEffect(() => {
        if (hasBeenStarted) {
            const timerState = {
                timeLeft,
                isRunning,
                isBreak,
                session,
                selectedSubject,
                topic,
                settings,
                lastUpdated: Date.now()
            };
            localStorage.setItem('pomodoroTimerState', JSON.stringify(timerState));
        }
    }, [timeLeft, isRunning, isBreak, session, selectedSubject, topic, settings, hasBeenStarted]);

    const saveSession = useCallback(async (durationMinutes, { completed = true } = {}) => {
        // Starting is already gated on picking a subject, so this normally
        // holds. It can still come back empty when the timer is restored from
        // localStorage in a new tab, and dropping the session there would lose
        // real study time silently — bank it against General instead.
        if (durationMinutes < 1) return;
        const subject = selectedSubject || "General";
        // Update streak on every completed session
        recordStudyAndGetStreak().catch(() => {});
        try {
            await onSessionComplete({
                technique_name: "pomodoro",
                session_duration: Math.round(durationMinutes),
                subject,
                topic: topic || "Focus Session",
                date: format(new Date(), "yyyy-MM-dd"),
                extra: {
                    pauses: pausesRef.current,
                    completed,
                    planned_minutes: settings.workTime || 25,
                },
            });
            pausesRef.current = 0;
            // Dispatch event so goals page can pick up new study time instantly
            window.dispatchEvent(new CustomEvent('studySessionSaved', {
                detail: { subject, duration_minutes: Math.round(durationMinutes) }
            }));
        } catch (error) {
            console.error("Error saving session:", error);
            toast({
                title: "Session Save Failed",
                description: "Your session couldn't be saved, but you can continue studying.",
                variant: "destructive"
            });
        }
    }, [onSessionComplete, settings, selectedSubject, topic, toast]);

    const saveCompletedSession = useCallback(async () => {
        await saveSession(settings.workTime || 25);
    }, [saveSession, settings.workTime]);

    const handleTimerComplete = useCallback(async () => {
        setIsRunning(false);
        setHasBeenStarted(false);

        if (isBreak) {
            toast({
                title: "Break over!",
                description: "Time to get back to work. Let's focus!"
            });
            setIsBreak(false);
        } else {
            await saveCompletedSession();

            const currentSession = session;
            const nextSession = currentSession + 1;
            setSession(nextSession);
            setIsBreak(true);

            if (isLongBreak(currentSession)) {
                toast({
                    title: "Work session complete!",
                    description: `Great job! Time for a long break (${settings.longBreak} minutes).`
                });
            } else {
                toast({
                    title: "Work session complete!",
                    description: `Good work! Take a short break (${settings.shortBreak} minutes).`
                });
            }
        }
    }, [isBreak, selectedSubject, saveCompletedSession, session, settings.longBreak, settings.shortBreak, isLongBreak, toast]);

    // Timer countdown effect using timestamps for accuracy across tabs and background
    useEffect(() => {
        if (isRunning && timeLeft > 0) {
            const savedState = localStorage.getItem('pomodoroTimerState');
            const state = savedState ? JSON.parse(savedState) : null;
            const lastUpdate = state?.lastUpdated || Date.now();
            const expectedEndTime = lastUpdate + (timeLeft * 1000);

            intervalRef.current = setInterval(() => {
                const now = Date.now();
                const remaining = Math.max(0, Math.ceil((expectedEndTime - now) / 1000));

                setTimeLeft(remaining);

                // Update localStorage with current timestamp
                const currentState = localStorage.getItem('pomodoroTimerState');
                if (currentState) {
                    const parsed = JSON.parse(currentState);
                    parsed.lastUpdated = now;
                    parsed.timeLeft = remaining;
                    localStorage.setItem('pomodoroTimerState', JSON.stringify(parsed));
                }

                if (remaining <= 0) {
                    clearInterval(intervalRef.current);
                    handleTimerComplete();
                }
            }, 100); // Check every 100ms for smoother updates
        } else {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isRunning, handleTimerComplete]);

    // Sync timer when page becomes visible after being hidden
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden && isRunning) {
                const savedState = localStorage.getItem('pomodoroTimerState');
                if (savedState) {
                    const state = JSON.parse(savedState);
                    const now = Date.now();
                    const elapsed = Math.floor((now - state.lastUpdated) / 1000);
                    const newTimeLeft = Math.max(0, state.timeLeft - elapsed);

                    setTimeLeft(newTimeLeft);

                    if (newTimeLeft <= 0) {
                        handleTimerComplete();
                    }
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [isRunning, handleTimerComplete]);

    const enterFullscreen = () => {
        const elem = focusModeRef.current;
        if (elem) {
            if (elem.requestFullscreen) elem.requestFullscreen();
            else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
            else if (elem.msRequestFullscreen) elem.msRequestFullscreen();
        }
    };

    const exitFullscreen = () => {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        else if (document.msExitFullscreen) document.msExitFullscreen();
    };

    useEffect(() => {
        if (isFocusMode) enterFullscreen();
    }, [isFocusMode]);

    const handleStartSession = (inFocus) => {
        setIsRunning(true);
        setHasBeenStarted(true);
        setShowFocusPrompt(false);
        if (inFocus) setIsFocusMode(true);
    };

    const toggleTimer = () => {
        if (isRunning) {
            // Pausing a break isn't an attention signal — only work counts.
            if (!isBreak) pausesRef.current += 1;
            setIsRunning(false);
        } else {
            // In focus mode, allow starting without subject check (subject already selected)
            if (!selectedSubject && !hasBeenStarted && !isBreak && !isFocusMode) {
                toast({ title: "Select a Subject", description: "Please select a subject before starting.", variant: "destructive" });
                return;
            }
            if (hasBeenStarted) {
                setIsRunning(true);
            } else {
                // If already in focus mode, just start directly
                if (isFocusMode) {
                    setIsRunning(true);
                    setHasBeenStarted(true);
                } else if (!isBreak) {
                    setShowFocusPrompt(true);
                } else {
                    setIsRunning(true);
                    setHasBeenStarted(true);
                }
            }
        }
    };

    const resetTimer = useCallback(async () => {
        // Guard against multiple rapid clicks saving XP multiple times
        if (isResettingRef.current) return;
        isResettingRef.current = true;

        // Work out what was studied, then stop everything *before* saving.
        // Saving is a round trip, and it re-loads the Study page underneath us;
        // anything left until after the await was running on borrowed time and
        // could be stranded mid-reset, which is how a reset used to leave the
        // header clock still counting.
        const totalWorkSeconds = (settings.workTime || 25) * 60;
        const elapsedMinutes = (hasBeenStarted && !isBreak)
            ? Math.floor((totalWorkSeconds - timeLeft) / 60)
            : 0;

        setIsRunning(false);
        setHasBeenStarted(false);
        setSession(1);
        setIsBreak(false);
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        localStorage.removeItem('pomodoroTimerState');
        localStorage.removeItem('globalTimerState');
        window.dispatchEvent(new CustomEvent('timerStateChanged', { detail: { isActive: false } }));

        // Now bank whatever was studied. Resetting ten minutes in still pays
        // for those ten minutes.
        if (elapsedMinutes >= 1) {
            toast({
                title: `${elapsedMinutes}m logged · +${elapsedMinutes * XP_PER_MINUTE} XP`,
                description: `Saved to ${selectedSubject || "General"}.`,
            });
            // Stopped early — which is exactly the thing worth recording.
            try { await saveSession(elapsedMinutes, { completed: false }); } catch { /* saveSession toasts its own failure */ }
        }
        isResettingRef.current = false;
    }, [hasBeenStarted, isBreak, selectedSubject, settings.workTime, timeLeft, saveSession, toast]);

    const skipBreak = () => {
        setIsRunning(false);
        setHasBeenStarted(false);
        setIsBreak(false);
        toast({ title: "Break skipped", description: "Ready for the next work session!" });
    };

    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    const getCurrentSegmentTime = () => {
        if (isBreak) {
            return isLongBreak(session - 1) ? settings.longBreak : settings.shortBreak;
        }
        return settings.workTime;
    };

    const baseTime = getCurrentSegmentTime() * 60;
    const progress = baseTime > 0 ? ((baseTime - timeLeft) / baseTime) * 100 : 0;

    const StatusIcon = isBreak ? Coffee : Zap;
    const statusText = isBreak
        ? (isLongBreak(session - 1) ? `Long Break` : `Short Break`)
        : `Focus Session #${session}`;

    const getButtonText = () => {
        if (!hasBeenStarted) {
            return isBreak ? "Start Break" : "Start Focus";
        }
        return isRunning ? "Pause" : "Resume";
    };

    const handleSettingsChange = (key, value) => {
        let numValue;
        if (value === '' || value === null || value === undefined) {
            numValue = '';
        } else {
            numValue = parseInt(value);
            if (isNaN(numValue) || numValue < 1) numValue = 1;
            if (numValue > 999) numValue = 999;
        }

        setSettings(prevSettings => ({
            ...prevSettings,
            [key]: numValue,
        }));
    };

    const handleInputBlur = (key) => {
        let currentValue = settings[key] || '';
        const defaultValues = {
            workTime: 25,
            shortBreak: 5,
            longBreak: 15,
            sessionsBeforeLongBreak: 4
        };
        const defaultValue = defaultValues[key];

        if (currentValue === '' || isNaN(currentValue) || currentValue < 1) {
            handleSettingsChange(key, defaultValue);
        }
    };

    const getColorScheme = () => {
        if (isBreak) {
            if (isLongBreak(session - 1)) {
                return COLOR_SCHEMES.longBreak;
            } else {
                return COLOR_SCHEMES.shortBreak;
            }
        } else {
            return COLOR_SCHEMES.work;
        }
    };

    const colorScheme = getColorScheme();

    if (isFocusMode) {
        return (
            <div ref={focusModeRef} className="fixed inset-0 z-[10000] bg-foreground">
                <div className={`absolute inset-0 ${colorScheme.focusBg}`}></div>
                <div className="relative z-20 p-6 flex items-center justify-end">
                    <Button
                        onClick={() => {
                            exitFullscreen();
                            setIsFocusMode(false);
                        }}
                        variant="ghost"
                        className="bg-surface/10 border-surface/20 text-surface hover:bg-surface/20"
                    >
                        <X className="w-4 h-4 mr-2" />
                        Exit Focus Mode
                    </Button>
                </div>
                <div className="relative z-10 p-8 h-[calc(100vh-100px)] overflow-auto flex items-center justify-center">
                    <div className="bg-surface/5 backdrop-blur-sm rounded-3xl border border-surface/10 p-12 shadow-soft">
                        <div className="flex flex-col items-center space-y-8">
                            <div className="relative w-80 h-80 flex items-center justify-center">
                                <svg className="absolute w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                    <circle
                                        className="stroke-current text-surface/10"
                                        strokeWidth="3"
                                        cx="50"
                                        cy="50"
                                        r="45"
                                        fill="transparent"
                                    />
                                    <motion.circle
                                        key={`${isBreak}-${session}`} // Added key for re-animation
                                        className="stroke-current"
                                        strokeWidth="3"
                                        strokeLinecap="round"
                                        cx="50" cy="50" r="45"
                                        fill="transparent"
                                        strokeDasharray="282.743"
                                        strokeDashoffset={282.743 - (progress / 100) * 282.743}
                                        initial={{ strokeDashoffset: 282.743 }}
                                        animate={{ strokeDashoffset: 282.743 - (progress / 100) * 282.743 }}
                                        transition={{ duration: 1 }}
                                        style={{ color: colorScheme.accentVar, filter: `drop-shadow(0 0 8px ${colorScheme.accentVar})` }}
                                    />
                                </svg>
                                <div className="text-center">
                                    <h2 className="text-7xl font-bold tracking-tighter text-surface mb-2">{formatTime(timeLeft)}</h2>
                                    <p className="text-surface/70 text-lg mb-2">Time Remaining</p>
                                    <p className="font-semibold text-xl" style={{ color: colorScheme.accentVar }}>
                                        {isBreak ? (isLongBreak(session - 1) ? 'Long Break' : 'Short Break') : 'Work Time'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <Button onClick={toggleTimer} size="lg" className={`w-40 text-lg ${colorScheme.button} text-white shadow-soft`}>
                                    {isRunning ? <Pause className="w-6 h-6 mr-2" /> : <Play className="w-6 h-6 mr-2" />}
                                    {getButtonText()}
                                </Button>
                                <Button onClick={resetTimer} aria-label="Reset timer" variant="outline" size="lg" className="bg-surface/10 border-surface/20 hover:bg-surface/20 text-surface">
                                    <RotateCcw className="w-6 h-6" />
                                </Button>
                                {isBreak && (
                                    <Button onClick={skipBreak} variant="outline" size="lg" className="bg-surface/10 border-surface/20 hover:bg-surface/20 text-surface">
                                        Skip Break
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="card-soft overflow-hidden relative">
                {/* Solid token tint overlay (replaces gradient) */}
                <div className={`absolute inset-0 opacity-50 pointer-events-none ${colorScheme.tile5}`} />

                <div className={`h-1 ${colorScheme.tile10}`} />

                <div className="pb-6 relative z-10 p-6">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-4">
                            <div className={`w-14 h-14 rounded-2xl ${colorScheme.tile10} flex items-center justify-center`}>
                                <Clock className={`w-7 h-7 ${colorScheme.timerText}`} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-foreground">
                                    Pomodoro Timer
                                </h3>
                                <p className="text-sm text-muted-foreground mt-0.5">Focus and productivity timer</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className={`pill px-5 py-2.5 border-2 ${colorScheme.badge} text-sm`}>
                                <StatusIcon className="w-5 h-5" />
                                <span className="font-bold text-sm">{statusText}</span>
                            </div>
                            {hasBeenStarted && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setIsFocusMode(true);
                                        enterFullscreen();
                                    }}
                                    className="rounded-xl border-2 hover:bg-secondary"
                                >
                                    <Maximize className="w-4 h-4 mr-2" />
                                    Focus Mode
                                </Button>
                            )}
                            {!isRunning && !isBreak && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Open timer settings"
                                    onClick={() => setShowSettings(true)}
                                    className="w-10 h-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary"
                                >
                                    <Settings className="w-5 h-5" />
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="pb-10 relative z-10 px-6">
                    <div className="flex flex-col items-center space-y-10">
                        {/* Timer Circle */}
                        <div className="relative w-80 h-80 flex items-center justify-center">
                            <svg className="absolute w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                <circle
                                    className="stroke-current text-secondary"
                                    strokeWidth="3"
                                    cx="50"
                                    cy="50"
                                    r="45"
                                    fill="transparent"
                                />
                                <motion.circle
                                    key={`${isBreak}-${session}`}
                                    className="stroke-current"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    cx="50" cy="50" r="45"
                                    fill="transparent"
                                    strokeDasharray="282.743"
                                    strokeDashoffset={282.743 - (progress / 100) * 282.743}
                                    initial={{ strokeDashoffset: 282.743 }}
                                    animate={{ strokeDashoffset: 282.743 - (progress / 100) * 282.743 }}
                                    transition={{ duration: 1 }}
                                    style={{
                                        color: colorScheme.accentVar,
                                        filter: `drop-shadow(0 0 12px ${colorScheme.accentVar})`
                                    }}
                                />
                            </svg>
                            <div className="text-center">
                                <motion.h2
                                    key={timeLeft}
                                    initial={{ scale: 1.05 }}
                                    animate={{ scale: 1 }}
                                    className={`text-7xl font-bold tracking-tighter mb-3 ${colorScheme.timerText}`}
                                >
                                    {formatTime(timeLeft)}
                                </motion.h2>
                                <p className="text-muted-foreground text-base font-medium mb-3">Time Remaining</p>
                                <div className={`pill px-4 py-2 ${colorScheme.badge}`}>
                                    <StatusIcon className="w-4 h-4" />
                                    <span className="font-bold text-sm">
                                        {isBreak ? (isLongBreak(session - 1) ? 'Long Break' : 'Short Break') : 'Work Time'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Control Buttons */}
                        <div className="flex items-center gap-3">
                            <Button
                                onClick={toggleTimer}
                                size="lg"
                                className={`w-44 text-base font-semibold ${colorScheme.button} text-white shadow-soft transition-all rounded-2xl h-14`}
                            >
                                {isRunning ? <Pause className="w-5 h-5 mr-2" /> : <Play className="w-5 h-5 mr-2" />}
                                {getButtonText()}
                            </Button>
                            <Button
                                onClick={resetTimer}
                                aria-label="Reset timer"
                                variant="outline"
                                size="lg"
                                className="w-14 h-14 rounded-2xl hover:bg-secondary border-2"
                            >
                                <RotateCcw className="w-5 h-5" />
                            </Button>
                            {isBreak && (
                                <Button
                                    onClick={skipBreak}
                                    variant="outline"
                                    size="lg"
                                    className="rounded-2xl hover:bg-secondary border-2 h-14 px-6"
                                >
                                    Skip Break
                                </Button>
                            )}
                        </div>

                        {/* Subject and Topic Selection - Only show when not running and not in break mode */}
                        {!isRunning && !isBreak && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="w-full max-w-2xl space-y-4"
                            >
                                <div className="card-soft">
                                    <div className="p-6 space-y-4">
                                        <h3 className="font-bold text-base text-foreground mb-4 flex items-center gap-2">
                                            <BookOpen className="w-5 h-5 text-muted-foreground" />
                                            Session Details
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-sm font-semibold text-muted-foreground">Subject *</Label>
                                                <Select onValueChange={setSelectedSubject} value={selectedSubject}>
                                                    <SelectTrigger className="h-12 rounded-xl border-2">
                                                        <SelectValue placeholder="Select a subject" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {userSubjects.map(sub => (
                                                            <SelectItem key={sub.id} value={sub.subject_name}>
                                                                {sub.subject_name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-sm font-semibold text-muted-foreground">Topic (Optional)</Label>
                                                <Input
                                                    value={topic}
                                                    onChange={(e) => setTopic(e.target.value)}
                                                    placeholder="e.g., Chapter 3 Review"
                                                    className="h-12 rounded-xl border-2"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* Break Message */}
                        {isBreak && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="card-soft text-center p-8 max-w-md"
                                style={{ borderColor: colorScheme.accentVar }}
                            >
                                <div className={`w-16 h-16 rounded-2xl ${colorScheme.tile10} flex items-center justify-center mx-auto mb-4`}>
                                    <Coffee className={`w-8 h-8 ${colorScheme.timerText}`} />
                                </div>
                                <h3 className="text-2xl font-bold text-foreground mb-3">
                                    {isLongBreak(session - 1) ? 'Long Break Time!' : 'Short Break Time!'}
                                </h3>
                                <p className="text-muted-foreground leading-relaxed">
                                    {isLongBreak(session - 1)
                                        ? 'Take a longer rest - walk around, stretch, or grab a snack.'
                                        : 'Quick break - hydrate, stretch, or rest your eyes.'
                                    }
                                </p>
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>

            {/* Settings Dialog */}
            <Dialog open={showSettings} onOpenChange={setShowSettings}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-2xl">Timer Settings</DialogTitle>
                        <DialogDescription>Customize your Pomodoro timer intervals</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Work Time (minutes)</Label>
                            <Input
                                type="number"
                                value={settings.workTime || ''}
                                onChange={(e) => handleSettingsChange('workTime', e.target.value)}
                                onBlur={() => handleInputBlur('workTime')}
                                min="1"
                                placeholder="25"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Short Break (minutes)</Label>
                            <Input
                                type="number"
                                value={settings.shortBreak || ''}
                                onChange={(e) => handleSettingsChange('shortBreak', e.target.value)}
                                onBlur={() => handleInputBlur('shortBreak')}
                                min="1"
                                placeholder="5"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Long Break (minutes)</Label>
                            <Input
                                type="number"
                                value={settings.longBreak || ''}
                                onChange={(e) => handleSettingsChange('longBreak', e.target.value)}
                                onBlur={() => handleInputBlur('longBreak')}
                                min="1"
                                placeholder="15"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Sessions Before Long Break</Label>
                            <Input
                                type="number"
                                value={settings.sessionsBeforeLongBreak || ''}
                                onChange={(e) => handleSettingsChange('sessionsBeforeLongBreak', e.target.value)}
                                onBlur={() => handleInputBlur('sessionsBeforeLongBreak')}
                                min="1"
                                placeholder="4"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setShowSettings(false)} className="bg-primary hover:bg-primary/90">
                            Save Settings
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Focus Mode Prompt */}
            <Dialog open={showFocusPrompt} onOpenChange={setShowFocusPrompt}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-2xl">Enter Focus Mode?</DialogTitle>
                        <DialogDescription>
                            Would you like to enter a distraction-free fullscreen focus session?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:justify-end">
                        <Button variant="outline" onClick={() => handleStartSession(false)}>Continue Normally</Button>
                        <Button onClick={() => handleStartSession(true)} className="bg-primary hover:bg-primary/90">
                            <Maximize className="w-4 h-4 mr-2" />
                            Enter Focus Mode
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
