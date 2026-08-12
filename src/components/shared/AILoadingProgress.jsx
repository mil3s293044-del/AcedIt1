import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import AceBody from '@/components/ace/AceBody';
import { Progress } from '@/components/ui/progress';

export default function AILoadingProgress({ 
    stage = 'starting',
    message = 'AI is working...',
    estimatedTime = 30,
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

    // Only the text is read now — Ace fills the slot the per-stage icon and
    // colour used to occupy, so keeping them would be a table half-used.
    const stages = {
        starting:   { text: 'Starting...' },
        processing: { text: message },
        analyzing:  { text: 'Analyzing content...' },
        generating: { text: 'Generating results...' },
        completing: { text: 'Almost done...' },
    };

    const currentStage = stages[stage] || stages.processing;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        >
            <div className="bg-surface rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
                <div className="text-center space-y-6">
                    {/* Ten to forty seconds is the longest wait in the
                        product, and it had the most generic possible thing in
                        it. He tosses cards while the model works; when the
                        stage says it's reasoning about the student's own
                        content he switches to thinking, because that's the
                        honest read of what's happening. */}
                    <div className="flex justify-center" data-ace-ai={stage}>
                        <AceBody className="w-32 sm:w-36"
                            pose={stage === "analyzing" ? "think" : "toss"}
                            title="Ace" />
                    </div>

                    <div>
                        <h3 className="text-xl font-bold text-foreground mb-2">
                            {currentStage.text}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            This may take up to {estimatedTime} seconds
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Progress value={progress} className="h-3" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{Math.round(progress)}% complete</span>
                            <span>{timeElapsed}s elapsed</span>
                        </div>
                    </div>

                    <div className="text-xs text-muted-foreground italic">
                        Please wait while AI processes your request...
                    </div>
                </div>
            </div>
        </motion.div>
    );
}