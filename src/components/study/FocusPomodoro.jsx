import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import AceBody from "@/components/ace/AceBody";
import { BREAK, FOCUS_START, pick } from "@/lib/aceVoice";
import { 
    Play, 
    Pause, 
    Square, 
    RotateCcw, 
    Coffee, 
    BookOpen,
    Timer as TimerIcon,
    Minimize
} from 'lucide-react';

export default function FocusPomodoro({ 
    timeLeft, 
    isRunning, 
    isBreak, 
    session, 
    progress,
    toggleTimer,
    resetTimer,
    stopTimer,
    formatTime,
    onExit 
}) {
    // Seeded by which break this is, so it holds still for the whole five
    // minutes instead of changing on every tick of the timer.
    const breakLine = React.useMemo(
        () => pick(BREAK, `break-${session}`), [session]);
    // His voice, without his face. The one line on the focus screen was
    // "Deep focus mode activated. You've got this! 💪" every single session;
    // these are the same reassurance in a voice that's stepping back.
    const focusLine = React.useMemo(
        () => pick(FOCUS_START, `focus-${session}`), [session]);

    return (
        <div className="w-full h-full bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex flex-col relative overflow-hidden">
            {/* Animated Background */}
            <div className="absolute inset-0 opacity-10">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute top-3/4 right-1/4 w-96 h-96 bg-green-500 rounded-full blur-3xl animate-pulse delay-1000"></div>
            </div>

            {/* Exit Button */}
            <div className="absolute top-8 right-8 z-20">
                <Button 
                    variant="ghost" 
                    onClick={onExit}
                    size="lg"
                    className="text-slate-300 hover:text-white hover:bg-slate-700/50 bg-slate-800/30 backdrop-blur-sm border border-slate-600/50 px-6 py-3 text-lg"
                >
                    <Minimize className="w-6 h-6 mr-3" />
                    Exit Focus
                </Button>
            </div>

            {/* Main Content - Full Screen */}
            <div className="flex-1 flex flex-col items-center justify-center text-white px-8 relative z-10">
                
                {/* Status Badge */}
                <motion.div
                    initial={{ opacity: 0, y: -30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`inline-flex items-center gap-4 px-6 sm:px-8 py-3 sm:py-4 rounded-full text-xl sm:text-2xl font-medium mb-5 sm:mb-8 ${
                        isBreak 
                            ? 'bg-orange-500/20 text-orange-200 border-2 border-orange-500/40'
                            : 'bg-green-500/20 text-green-200 border-2 border-green-500/40'
                    }`}
                >
                    {isBreak ? (
                        <>
                            <Coffee className="w-6 h-6 sm:w-8 sm:h-8" />
                            Break Time
                        </>
                    ) : (
                        <>
                            <BookOpen className="w-6 h-6 sm:w-8 sm:h-8" />
                            Focus Time
                        </>
                    )}
                </motion.div>

                {/* Massive Timer Display */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3, type: "spring", stiffness: 100 }}
                    className="text-center mb-6 sm:mb-10"
                >
                    {/* Circular progress, sized off the viewport rather than a
                        hardcoded 500px.

                        Focus and break want different sizes because they want
                        different things looked at. During focus the timer IS
                        the screen. During a break the timer is a formality and
                        the instruction underneath it is the point — at 500px
                        fixed, Ace and his line fell off the bottom of a laptop
                        entirely, which made the whole break screen pointless. */}
                    <div className="relative inline-block mb-6 sm:mb-8">
                        <svg viewBox="0 0 500 500" aria-hidden="true"
                            className={`transform -rotate-90 ${isBreak
                                ? "w-[min(36vh,78vw,320px)] h-[min(36vh,78vw,320px)]"
                                : "w-[min(52vh,78vw,460px)] h-[min(52vh,78vw,460px)]"}`}>
                            <circle
                                cx="250"
                                cy="250"
                                r="220"
                                stroke="currentColor"
                                strokeWidth="12"
                                fill="none"
                                className="text-muted-foreground/50"
                            />
                            <motion.circle
                                cx="250"
                                cy="250"
                                r="220"
                                stroke="currentColor"
                                strokeWidth="12"
                                fill="none"
                                strokeLinecap="round"
                                strokeDasharray={2 * Math.PI * 220}
                                strokeDashoffset={2 * Math.PI * 220 * (1 - progress / 100)}
                                className={isBreak ? "text-orange-400" : "text-green-400"}
                                style={{ transition: 'stroke-dashoffset 1s linear' }}
                            />
                        </svg>
                        
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <div className={`font-bold text-white tracking-wider ${isBreak
                                ? "text-5xl sm:text-6xl mb-2"
                                : "text-7xl sm:text-9xl mb-4 sm:mb-6"}`}>
                                {formatTime(timeLeft)}
                            </div>
                            <div className={`flex items-center text-slate-300 ${isBreak ? "gap-2" : "gap-3 sm:gap-4"}`}>
                                <TimerIcon className={isBreak ? "w-5 h-5" : "w-6 h-6 sm:w-8 sm:h-8"} />
                                <span className={`font-medium ${isBreak ? "text-lg" : "text-2xl sm:text-3xl"}`}>
                                    Session {session}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* The break belongs to Ace. It's five minutes of dead
                        screen — the biggest uninterrupted space in the product
                        — and it used to say "Take a well-deserved break!" and
                        nothing else.

                        Focus does NOT belong to him. Not one pixel. A mascot
                        bouncing next to a running timer sabotages the exact
                        thing the timer exists to protect, and it's the fastest
                        way to have someone switch the whole lot off. */}
                    {isBreak && isRunning ? (
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            data-ace-break
                            className="flex flex-col items-center gap-3 sm:gap-4 max-w-3xl"
                        >
                            <AceBody className="w-28 sm:w-36" pose="sleep" title="Ace"
                                tone="fill-white" card="fill-slate-900" cardStroke="stroke-slate-900" />
                            <p className="text-lg sm:text-2xl text-slate-200 leading-snug text-center">
                                {breakLine}
                            </p>
                        </motion.div>
                    ) : (
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.6 }}
                            className="text-xl sm:text-3xl text-slate-200 max-w-4xl leading-snug text-center"
                        >
                            {isRunning
                                ? focusLine
                                : (isBreak ? "Ready for your break?" : "Ready to enter the zone?")
                            }
                        </motion.p>
                    )}
                </motion.div>

                {/* Large Control Buttons */}
                <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="flex items-center justify-center gap-3 sm:gap-6 flex-wrap"
                >
                    <Button
                        onClick={toggleTimer}
                        size="lg"
                        className={`px-8 sm:px-14 py-5 sm:py-7 text-lg sm:text-2xl font-semibold rounded-3xl transition-all duration-300 shadow-2xl ${
                            isRunning
                                ? 'bg-red-600 hover:bg-red-500 text-white hover:scale-105'
                                : 'bg-green-600 hover:bg-green-500 text-white hover:scale-105'
                        }`}
                    >
                        {isRunning
                            ? <Pause className="w-7 h-7 sm:w-9 sm:h-9 mr-3" />
                            : <Play className="w-7 h-7 sm:w-9 sm:h-9 mr-3" />}
                        {isRunning ? 'Pause' : 'Start'}
                    </Button>
                    
                    <Button 
                        onClick={resetTimer} 
                        variant="outline" 
                        size="lg"
                        className="px-6 sm:px-10 py-5 sm:py-7 text-base sm:text-xl rounded-3xl border-2 border-slate-400 bg-slate-800/40 backdrop-blur-sm text-slate-200 hover:bg-slate-700/60 hover:text-white hover:scale-105 transition-all duration-300"
                    >
                        <RotateCcw className="w-6 h-6 sm:w-7 sm:h-7 mr-3" />
                        Reset
                    </Button>
                    
                    <Button 
                        onClick={stopTimer} 
                        variant="outline" 
                        size="lg"
                        className="px-6 sm:px-10 py-5 sm:py-7 text-base sm:text-xl rounded-3xl border-2 border-slate-400 bg-slate-800/40 backdrop-blur-sm text-slate-200 hover:bg-slate-700/60 hover:text-white hover:scale-105 transition-all duration-300"
                    >
                        <Square className="w-6 h-6 sm:w-7 sm:h-7 mr-3" />
                        Stop
                    </Button>
                </motion.div>
            </div>

            {/* Progress Bar at Bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-2 bg-slate-800">
                <motion.div
                    className={`h-full ${isBreak ? 'bg-orange-400' : 'bg-green-400'}`}
                    style={{ width: `${progress}%` }}
                    transition={{ duration: 1 }}
                />
            </div>
        </div>
    );
}