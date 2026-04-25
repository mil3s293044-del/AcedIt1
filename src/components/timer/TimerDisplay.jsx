import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Coffee, BookOpen, Timer } from "lucide-react";

export default function TimerDisplay({ 
    timeLeft, 
    isRunning, 
    isBreak, 
    session, 
    progress, 
    formatTime 
}) {
    const radius = 120;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8"
        >
            <Card className="bg-white/70 backdrop-blur-sm border-gray-200/50 hover:shadow-xl transition-all duration-500">
                <CardContent className="p-8 lg:p-12">
                    <div className="text-center">
                        {/* Status Indicator */}
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-6"
                        >
                            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
                                isBreak 
                                    ? 'bg-green-100 text-green-800 border border-green-200'
                                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                            }`}>
                                {isBreak ? (
                                    <>
                                        <Coffee className="w-4 h-4" />
                                        Break Time
                                    </>
                                ) : (
                                    <>
                                        <BookOpen className="w-4 h-4" />
                                        Focus Time
                                    </>
                                )}
                            </div>
                        </motion.div>

                        {/* Circular Timer */}
                        <div className="relative inline-block mb-6">
                            <svg
                                width={radius * 2 + 40}
                                height={radius * 2 + 40}
                                className="transform -rotate-90"
                            >
                                {/* Background circle */}
                                <circle
                                    cx={radius + 20}
                                    cy={radius + 20}
                                    r={radius}
                                    stroke="currentColor"
                                    strokeWidth="8"
                                    fill="none"
                                    className="text-gray-200"
                                />
                                {/* Progress circle */}
                                <motion.circle
                                    cx={radius + 20}
                                    cy={radius + 20}
                                    r={radius}
                                    stroke="currentColor"
                                    strokeWidth="8"
                                    fill="none"
                                    strokeLinecap="round"
                                    strokeDasharray={circumference}
                                    strokeDashoffset={strokeDashoffset}
                                    className={isBreak ? "text-green-500" : "text-blue-500"}
                                    style={{
                                        transition: 'stroke-dashoffset 1s linear'
                                    }}
                                />
                            </svg>
                            
                            {/* Timer display */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <motion.div
                                    key={timeLeft}
                                    initial={{ scale: 1.1 }}
                                    animate={{ scale: 1 }}
                                    className="text-4xl lg:text-5xl font-bold text-gray-900 mb-2"
                                >
                                    {formatTime(timeLeft)}
                                </motion.div>
                                <div className="flex items-center gap-2 text-gray-500">
                                    <Timer className="w-4 h-4" />
                                    <span className="text-sm">Session {session}</span>
                                </div>
                            </div>
                        </div>

                        {/* Status Text */}
                        <motion.p
                            animate={{ 
                                opacity: isRunning ? [1, 0.5, 1] : 1,
                                scale: isRunning ? [1, 1.05, 1] : 1
                            }}
                            transition={{ 
                                duration: 2, 
                                repeat: isRunning ? Infinity : 0,
                                ease: "easeInOut"
                            }}
                            className="text-lg text-gray-600"
                        >
                            {isRunning 
                                ? (isBreak ? "Take a well-deserved break! 🧘‍♀️" : "Stay focused! You've got this! 💪")
                                : (isBreak ? "Ready for your break?" : "Ready to focus?")
                            }
                        </motion.p>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}