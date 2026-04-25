import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { 
    Play, 
    Pause, 
    Square, 
    RotateCcw, 
    Coffee, 
    BookOpen,
    Minimize2,
    Lock,
    Unlock
} from "lucide-react";

export default function FullscreenTimer({ 
    timeLeft, 
    isRunning, 
    isBreak, 
    session, 
    formatTime,
    onToggle,
    onReset,
    onStop,
    onExitFullscreen
}) {
    const [isLocked, setIsLocked] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const hideControlsTimeoutRef = useRef(null);

    useEffect(() => {
        // Auto-hide controls after 3 seconds of no interaction
        const resetHideTimer = () => {
            setShowControls(true);
            clearTimeout(hideControlsTimeoutRef.current);
            hideControlsTimeoutRef.current = setTimeout(() => {
                if (!isLocked) {
                    setShowControls(false);
                }
            }, 3000);
        };

        resetHideTimer();
        
        const handleMouseMove = resetHideTimer;
        const handleKeyPress = resetHideTimer;

        if (!isLocked) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('keypress', handleKeyPress);
        }

        return () => {
            clearTimeout(hideControlsTimeoutRef.current);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('keypress', handleKeyPress);
        };
    }, [isLocked]);

    useEffect(() => {
        // Prevent page refresh, navigation, etc. when locked
        const handleBeforeUnload = (e) => {
            if (isLocked && isRunning) {
                e.preventDefault();
                e.returnValue = '';
            }
        };

        const handleKeyDown = (e) => {
            if (isLocked) {
                // Block most keyboard shortcuts
                if (e.ctrlKey || e.metaKey || e.altKey || e.key === 'F5') {
                    e.preventDefault();
                }
                // Block escape key
                if (e.key === 'Escape') {
                    e.preventDefault();
                }
            }
        };

        if (isLocked) {
            window.addEventListener('beforeunload', handleBeforeUnload);
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isLocked, isRunning]);

    const radius = 180;
    const circumference = 2 * Math.PI * radius;
    const progress = isRunning ? 100 : 0; // Simplified for now
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    const toggleLock = () => {
        setIsLocked(!isLocked);
        if (!isLocked) {
            setShowControls(true);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center text-white">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_50%)]" />
            </div>

            {/* Main Timer Display */}
            <div className="relative z-10 text-center">
                {/* Status Indicator */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-full text-lg font-medium backdrop-blur-sm ${
                        isBreak 
                            ? 'bg-green-500/20 text-green-300 border border-green-400/30'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
                    }`}>
                        {isBreak ? (
                            <>
                                <Coffee className="w-6 h-6" />
                                Break Time
                            </>
                        ) : (
                            <>
                                <BookOpen className="w-6 h-6" />
                                Focus Time
                            </>
                        )}
                    </div>
                </motion.div>

                {/* Circular Timer */}
                <div className="relative inline-block mb-12">
                    <svg
                        width={radius * 2 + 60}
                        height={radius * 2 + 60}
                        className="transform -rotate-90"
                    >
                        {/* Background circle */}
                        <circle
                            cx={radius + 30}
                            cy={radius + 30}
                            r={radius}
                            stroke="rgba(255,255,255,0.1)"
                            strokeWidth="12"
                            fill="none"
                        />
                        {/* Progress circle */}
                        <motion.circle
                            cx={radius + 30}
                            cy={radius + 30}
                            r={radius}
                            stroke={isBreak ? "#10B981" : "#3B82F6"}
                            strokeWidth="12"
                            fill="none"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            style={{
                                transition: 'stroke-dashoffset 1s linear'
                            }}
                        />
                    </svg>
                    
                    {/* Timer display */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <motion.div
                            key={timeLeft}
                            initial={{ scale: 1.05 }}
                            animate={{ scale: 1 }}
                            className="text-8xl lg:text-9xl font-bold mb-4"
                        >
                            {formatTime(timeLeft)}
                        </motion.div>
                        <div className="text-xl text-white/70">
                            Session {session}
                        </div>
                    </div>
                </div>

                {/* Motivational Text */}
                <motion.p
                    animate={{ 
                        opacity: isRunning ? [1, 0.7, 1] : 1,
                        scale: isRunning ? [1, 1.02, 1] : 1
                    }}
                    transition={{ 
                        duration: 3, 
                        repeat: isRunning ? Infinity : 0,
                        ease: "easeInOut"
                    }}
                    className="text-2xl text-white/80 mb-12 max-w-2xl"
                >
                    {isRunning 
                        ? (isBreak ? "Take a well-deserved break! Your mind needs rest to perform at its best 🧘‍♀️" : "Stay focused! Every minute of deep work builds your success 💪")
                        : (isBreak ? "Ready for your break?" : "Ready to dive deep into focused work?")
                    }
                </motion.p>
            </div>

            {/* Controls */}
            <AnimatePresence>
                {(showControls || isLocked) && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-20"
                    >
                        <div className="flex items-center gap-4 bg-black/30 backdrop-blur-lg rounded-2xl p-4 border border-white/20">
                            {/* Main Controls */}
                            <Button
                                onClick={onToggle}
                                size="lg"
                                className={`px-8 py-4 text-lg font-medium ${
                                    isRunning
                                        ? 'bg-red-500 hover:bg-red-600 text-white'
                                        : 'bg-green-500 hover:bg-green-600 text-white'
                                } shadow-lg`}
                            >
                                {isRunning ? (
                                    <>
                                        <Pause className="w-5 h-5 mr-2" />
                                        Pause
                                    </>
                                ) : (
                                    <>
                                        <Play className="w-5 h-5 mr-2" />
                                        Start
                                    </>
                                )}
                            </Button>

                            <Button
                                onClick={onReset}
                                variant="outline"
                                size="lg"
                                className="px-6 py-4 text-lg bg-white/10 border-white/20 text-white hover:bg-white/20"
                            >
                                <RotateCcw className="w-5 h-5 mr-2" />
                                Reset
                            </Button>

                            <Button
                                onClick={onStop}
                                variant="outline"
                                size="lg"
                                className="px-6 py-4 text-lg bg-white/10 border-white/20 text-white hover:bg-white/20"
                            >
                                <Square className="w-5 h-5 mr-2" />
                                Stop
                            </Button>

                            {/* Divider */}
                            <div className="w-px h-8 bg-white/20" />

                            {/* Lock/Unlock */}
                            <Button
                                onClick={toggleLock}
                                variant="outline"
                                size="lg"
                                className={`px-4 py-4 text-lg border-white/20 text-white hover:bg-white/20 ${
                                    isLocked ? 'bg-yellow-500/20' : 'bg-white/10'
                                }`}
                                title={isLocked ? "Unlock screen" : "Lock screen"}
                            >
                                {isLocked ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                            </Button>

                            {/* Exit Fullscreen */}
                            {!isLocked && (
                                <Button
                                    onClick={onExitFullscreen}
                                    variant="outline"
                                    size="lg"
                                    className="px-4 py-4 text-lg bg-white/10 border-white/20 text-white hover:bg-white/20"
                                    title="Exit fullscreen"
                                >
                                    <Minimize2 className="w-5 h-5" />
                                </Button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Lock Status Indicator */}
            {isLocked && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="fixed top-6 right-6 z-20"
                >
                    <div className="flex items-center gap-2 bg-yellow-500/20 text-yellow-300 px-4 py-2 rounded-full backdrop-blur-sm border border-yellow-400/30">
                        <Lock className="w-4 h-4" />
                        <span className="text-sm font-medium">Screen Locked</span>
                    </div>
                </motion.div>
            )}

            {/* Instructions */}
            {!isRunning && showControls && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="fixed top-6 left-6 z-20 text-white/60 text-sm max-w-xs"
                >
                    <p className="mb-2">🔒 <strong>Lock Screen:</strong> Prevents distractions and accidental exits</p>
                    <p>👆 <strong>Auto-hide:</strong> Controls fade after 3 seconds (move mouse to show)</p>
                </motion.div>
            )}
        </div>
    );
}