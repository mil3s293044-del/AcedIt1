import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Sparkles, CheckCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export default function AILoadingProgress({ 
    stage = 'starting',
    message = 'AI is working...',
    estimatedTime = 30,
    onComplete = null
}) {
    const [progress, setProgress] = useState(0);
    const [timeElapsed, setTimeElapsed] = useState(0);
    const [isCompleting, setIsCompleting] = useState(false);

    useEffect(() => {
        // Listen for task completion
        const handleComplete = () => {
            setIsCompleting(true);
            setProgress(100);
        };
        
        window.addEventListener('aiTaskComplete', handleComplete);
        return () => window.removeEventListener('aiTaskComplete', handleComplete);
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            setTimeElapsed(prev => prev + 1);
            
            // Dynamic progress calculation based on actual time elapsed vs estimated
            setProgress(prev => {
                if (isCompleting) return prev;
                
                const elapsedRatio = timeElapsed / estimatedTime;
                
                // Smooth adaptive progression based on time ratio
                // Accelerates as we approach estimated time, but never reaches 100% until completing
                const targetProgress = Math.min(95, (elapsedRatio / (elapsedRatio + 0.15)) * 100);
                
                // Smooth increment toward target
                const increment = Math.max(0.5, (targetProgress - prev) * 0.15);
                return Math.min(prev + increment, 95);
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [timeElapsed, estimatedTime, isCompleting]);

    // This effect handles completion - speeds up to 100% before showing results
    useEffect(() => {
        if (stage === 'completing' && !isCompleting) {
            setIsCompleting(true);
        }
        
        if (isCompleting && progress < 100) {
            // Rapid animation to 100% when AI completes
            const completeInterval = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 100) {
                        clearInterval(completeInterval);
                        return 100;
                    }
                    return Math.min(prev + 15, 100); // Fast increment for completion
                });
            }, 40); // Fast interval for smooth rapid animation
            
            return () => clearInterval(completeInterval);
        }
    }, [stage, isCompleting, progress]);

    const stages = {
        starting: { icon: Loader2, text: 'Starting...', color: 'text-blue-600' },
        processing: { icon: Sparkles, text: message, color: 'text-purple-600' },
        analyzing: { icon: Loader2, text: 'Analyzing content...', color: 'text-indigo-600' },
        generating: { icon: Sparkles, text: 'Generating results...', color: 'text-pink-600' },
        completing: { icon: CheckCircle, text: 'Almost done...', color: 'text-green-600' }
    };

    const currentStage = stages[stage] || stages.processing;
    const Icon = currentStage.icon;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        >
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
                <div className="text-center space-y-6">
                    <div className="flex justify-center">
                        <div className="relative">
                            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center">
                                <Icon className={`w-10 h-10 ${currentStage.color} ${Icon === Loader2 ? 'animate-spin' : ''}`} />
                            </div>
                            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500/20 to-indigo-500/20 animate-ping" />
                        </div>
                    </div>

                    <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">
                            {currentStage.text}
                        </h3>
                        <p className="text-sm text-gray-600">
                            This may take up to {estimatedTime} seconds
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Progress value={progress} className="h-3" />
                        <div className="flex justify-between text-xs text-gray-500">
                            <span>{Math.round(progress)}% complete</span>
                            <span>{timeElapsed}s elapsed</span>
                        </div>
                    </div>

                    <div className="text-xs text-gray-500 italic">
                        Please wait while AI processes your request...
                    </div>
                </div>
            </div>
        </motion.div>
    );
}