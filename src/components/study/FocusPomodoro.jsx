import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
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
                    className={`inline-flex items-center gap-4 px-8 py-4 rounded-full text-2xl font-medium mb-16 ${
                        isBreak 
                            ? 'bg-orange-500/20 text-orange-200 border-2 border-orange-500/40'
                            : 'bg-green-500/20 text-green-200 border-2 border-green-500/40'
                    }`}
                >
                    {isBreak ? (
                        <>
                            <Coffee className="w-8 h-8" />
                            Break Time
                        </>
                    ) : (
                        <>
                            <BookOpen className="w-8 h-8" />
                            Focus Time
                        </>
                    )}
                </motion.div>

                {/* Massive Timer Display */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3, type: "spring", stiffness: 100 }}
                    className="text-center mb-16"
                >
                    {/* Huge Circular Progress */}
                    <div className="relative inline-block mb-12">
                        <svg width="500" height="500" className="transform -rotate-90">
                            <circle
                                cx="250"
                                cy="250"
                                r="220"
                                stroke="currentColor"
                                strokeWidth="12"
                                fill="none"
                                className="text-slate-700/50"
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
                            <div className="text-9xl font-bold text-white mb-6 tracking-wider">
                                {formatTime(timeLeft)}
                            </div>
                            <div className="flex items-center gap-4 text-slate-300">
                                <TimerIcon className="w-8 h-8" />
                                <span className="text-3xl font-medium">Session {session}</span>
                            </div>
                        </div>
                    </div>

                    {/* Motivational Text */}
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 }}
                        className="text-4xl text-slate-200 mb-16 max-w-4xl leading-relaxed"
                    >
                        {isRunning 
                            ? (isBreak ? "Take a well-deserved break! 🧘‍♀️" : "Deep focus mode activated. You've got this! 💪")
                            : (isBreak ? "Ready for your break?" : "Ready to enter the zone?")
                        }
                    </motion.p>
                </motion.div>

                {/* Large Control Buttons */}
                <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="flex items-center justify-center gap-8"
                >
                    <Button
                        onClick={toggleTimer}
                        size="lg"
                        className={`px-16 py-8 text-2xl font-semibold rounded-3xl transition-all duration-300 shadow-2xl ${
                            isRunning
                                ? 'bg-red-500 hover:bg-red-400 text-white hover:scale-105'
                                : 'bg-green-500 hover:bg-green-400 text-white hover:scale-105'
                        }`}
                    >
                        {isRunning ? <Pause className="w-10 h-10 mr-4" /> : <Play className="w-10 h-10 mr-4" />}
                        {isRunning ? 'Pause' : 'Start'}
                    </Button>
                    
                    <Button 
                        onClick={resetTimer} 
                        variant="outline" 
                        size="lg"
                        className="px-12 py-8 text-xl rounded-3xl border-2 border-slate-400 text-slate-200 hover:bg-slate-700/50 hover:text-white hover:scale-105 transition-all duration-300"
                    >
                        <RotateCcw className="w-8 h-8 mr-4" />
                        Reset
                    </Button>
                    
                    <Button 
                        onClick={stopTimer} 
                        variant="outline" 
                        size="lg"
                        className="px-12 py-8 text-xl rounded-3xl border-2 border-slate-400 text-slate-200 hover:bg-slate-700/50 hover:text-white hover:scale-105 transition-all duration-300"
                    >
                        <Square className="w-8 h-8 mr-4" />
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