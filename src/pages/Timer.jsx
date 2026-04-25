import React, { useState, useEffect, useRef } from "react";
import { StudySession, StudyStreak } from "@/entities/all";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Settings, 
    Coffee,
    Timer as TimerIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";

import TimerDisplay from "../components/timer/TimerDisplay";
import TimerControls from "../components/timer/TimerControls";
import FullscreenTimer from "../components/timer/FullscreenTimer"; // New Import
import SessionForm from "../components/timer/SessionForm";

export default function Timer() {
    const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes in seconds
    const [isRunning, setIsRunning] = useState(false);
    const [isBreak, setIsBreak] = useState(false);
    const [session, setSession] = useState(1);
    const [showSettings, setShowSettings] = useState(false);
    const [showSessionForm, setShowSessionForm] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false); // New State
    
    // Timer settings
    const [settings, setSettings] = useState({
        workTime: 25,
        shortBreak: 5,
        longBreak: 15,
        sessionsUntilLongBreak: 4
    });

    const [completedSession, setCompletedSession] = useState(null);
    const intervalRef = useRef(null);
    const audioRef = useRef(null);
    const elapsedSecondsRef = useRef(0);

    useEffect(() => {
        if (isRunning && timeLeft > 0) {
            intervalRef.current = setInterval(() => {
                setTimeLeft(prev => prev - 1);
                if (!isBreak) {
                    elapsedSecondsRef.current += 1;
                    // Fire XP animation every 60 seconds of focus time
                    if (elapsedSecondsRef.current % 60 === 0) {
                        window.dispatchEvent(new CustomEvent('xp_awarded', { detail: { xp: 1, source: 'study_session' } }));
                    }
                }
            }, 1000);
        } else if (timeLeft === 0) {
            handleTimerComplete();
        } else {
            clearInterval(intervalRef.current);
        }

        return () => clearInterval(intervalRef.current);
    }, [isRunning, timeLeft]);

    // New Functions for Fullscreen
    const enterFullscreen = () => {
        setIsFullscreen(true);
        // Request fullscreen API if available
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        }
    };

    const exitFullscreen = () => {
        setIsFullscreen(false);
        // Exit fullscreen API if available
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    };

    const handleTimerComplete = () => {
        setIsRunning(false);
        playNotificationSound();
        
        if (!isBreak) {
            // Work session completed
            setCompletedSession({
                duration: settings.workTime,
                type: 'work'
            });
            setShowSessionForm(true);
            
            // Start break
            const isLongBreak = session % settings.sessionsUntilLongBreak === 0;
            setTimeLeft((isLongBreak ? settings.longBreak : settings.shortBreak) * 60);
            setIsBreak(true);
        } else {
            // Break completed
            setSession(prev => prev + 1);
            setTimeLeft(settings.workTime * 60);
            setIsBreak(false);
        }
    };

    const playNotificationSound = () => {
        // Create a simple notification sound
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    };

    const toggleTimer = () => {
        setIsRunning(prev => !prev);
    };

    const resetTimer = () => {
        setIsRunning(false);
        setTimeLeft(isBreak ? 
            (session % settings.sessionsUntilLongBreak === 0 ? settings.longBreak : settings.shortBreak) * 60 :
            settings.workTime * 60
        );
    };

    const stopTimer = () => {
        setIsRunning(false);
        setTimeLeft(settings.workTime * 60);
        setIsBreak(false);
        setSession(1);
    };

    const saveSession = async (sessionData) => {
        try {
            await StudySession.create({
                ...sessionData,
                duration_minutes: completedSession.duration,
                technique: "pomodoro",
                date: format(new Date(), "yyyy-MM-dd")
            });

            // Update streak
            const today = format(new Date(), "yyyy-MM-dd");
            const existingStreak = await StudyStreak.filter({ date: today }).then(data => data[0]);
            
            if (!existingStreak) {
                await StudyStreak.create({
                    date: today,
                    completed: true,
                    study_minutes: completedSession.duration,
                    goal_minutes: 30
                });
            } else {
                await StudyStreak.update(existingStreak.id, {
                    study_minutes: (existingStreak.study_minutes || 0) + completedSession.duration
                });
            }

            setShowSessionForm(false);
            setCompletedSession(null);
        } catch (error) {
            console.error("Error saving session:", error);
        }
    };

    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    const progress = isBreak ? 
        (((session % settings.sessionsUntilLongBreak === 0 ? settings.longBreak : settings.shortBreak) * 60 - timeLeft) / ((session % settings.sessionsUntilLongBreak === 0 ? settings.longBreak : settings.shortBreak) * 60)) * 100 :
        ((settings.workTime * 60 - timeLeft) / (settings.workTime * 60)) * 100;

    // Show fullscreen timer if enabled
    if (isFullscreen) {
        return (
            <FullscreenTimer
                timeLeft={timeLeft}
                isRunning={isRunning}
                isBreak={isBreak}
                session={session}
                formatTime={formatTime}
                onToggle={toggleTimer}
                onReset={resetTimer}
                onStop={stopTimer}
                onExitFullscreen={exitFullscreen}
            />
        );
    }

    return (
        <div className="p-4 lg:p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-8"
                >
                    <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
                        Pomodoro Timer ⏰
                    </h1>
                    <p className="text-gray-600 text-lg">
                        Stay focused with the proven Pomodoro Technique
                    </p>
                </motion.div>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Timer Display */}
                    <div className="lg:col-span-2">
                        <TimerDisplay
                            timeLeft={timeLeft}
                            isRunning={isRunning}
                            isBreak={isBreak}
                            session={session}
                            progress={progress}
                            formatTime={formatTime}
                        />
                        
                        <TimerControls
                            isRunning={isRunning}
                            onToggle={toggleTimer}
                            onReset={resetTimer}
                            onStop={stopTimer}
                        />

                        {/* Fullscreen Button */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex justify-center mt-6"
                        >
                            <Button
                                onClick={enterFullscreen}
                                className="bg-indigo-600 hover:bg-indigo-700 px-8 py-3"
                                size="lg"
                            >
                                🚀 Enter Focus Mode
                            </Button>
                        </motion.div>
                    </div>

                    {/* Side Panel */}
                    <div className="space-y-6">
                        {/* Session Info */}
                        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200/50">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-blue-900">
                                    <TimerIcon className="w-5 h-5" />
                                    Session {session}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-600">Current:</span>
                                        <span className="font-medium text-gray-900">
                                            {isBreak ? 
                                                (session % settings.sessionsUntilLongBreak === 0 ? 'Long Break' : 'Short Break') :
                                                'Focus Time'
                                            }
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-600">Next long break:</span>
                                        <span className="font-medium text-gray-900">
                                            {settings.sessionsUntilLongBreak - (session % settings.sessionsUntilLongBreak || settings.sessionsUntilLongBreak)} sessions
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Settings */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Settings className="w-5 h-5" />
                                    Timer Settings
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Work Time (minutes)</Label>
                                    <Input
                                        type="number"
                                        value={settings.workTime}
                                        onChange={(e) => setSettings(prev => ({
                                            ...prev,
                                            workTime: parseInt(e.target.value) || 25
                                        }))}
                                        min="1"
                                        max="60"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Short Break (minutes)</Label>
                                    <Input
                                        type="number"
                                        value={settings.shortBreak}
                                        onChange={(e) => setSettings(prev => ({
                                            ...prev,
                                            shortBreak: parseInt(e.target.value) || 5
                                        }))}
                                        min="1"
                                        max="30"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Long Break (minutes)</Label>
                                    <Input
                                        type="number"
                                        value={settings.longBreak}
                                        onChange={(e) => setSettings(prev => ({
                                            ...prev,
                                            longBreak: parseInt(e.target.value) || 15
                                        }))}
                                        min="1"
                                        max="60"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Tips */}
                        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200/50">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-green-900">
                                    <Coffee className="w-5 h-5" />
                                    Pomodoro Tips
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm text-green-800">
                                <p>• Focus on one task during work sessions</p>
                                <p>• Take breaks away from your screen</p>
                                <p>• Stay hydrated and stretch</p>
                                <p>• Turn off notifications during focus time</p>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Session Form Modal */}
                <AnimatePresence>
                    {showSessionForm && completedSession && (
                        <SessionForm
                            onSave={saveSession}
                            onCancel={() => {
                                setShowSessionForm(false);
                                setCompletedSession(null);
                            }}
                            duration={completedSession.duration}
                        />
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}