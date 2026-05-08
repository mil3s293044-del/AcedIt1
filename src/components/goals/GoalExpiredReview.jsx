import React, { useState } from "react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Trophy, X, Target, Zap, Check, Calendar, Clock } from "lucide-react";
import { format } from "date-fns";

export default function GoalExpiredReview({ goal, onClose, onResolved }) {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const subGoals = goal.sub_goals || [];
    const completedMilestones = subGoals.filter(sg => sg.completed).length;
    const totalMilestones = subGoals.length;
    const progressPct = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : (goal.progress || 0);

    const earnedXP = subGoals.reduce((sum, sg) => {
        if (sg.completed) {
            const subItems = sg.sub_sub_goals || [];
            return sum + (subItems.length > 0
                ? subItems.reduce((s, i) => s + (i.xp_reward || 0), 0)
                : (sg.xp_reward || 0));
        }
        const subItems = (sg.sub_sub_goals || []).filter(i => i.completed);
        return sum + subItems.reduce((s, i) => s + (i.xp_reward || 0), 0);
    }, 0);

    const totalXP = subGoals.reduce((sum, sg) => {
        const subItems = sg.sub_sub_goals || [];
        return sum + (subItems.length > 0
            ? subItems.reduce((s, i) => s + (i.xp_reward || 0), 0)
            : (sg.xp_reward || 0));
    }, 0) + (goal.total_xp_reward || 0);

    const daysOverdue = goal.target_date
        ? Math.abs(Math.ceil((new Date(goal.target_date) - new Date()) / 86400000))
        : null;

    const handleResolve = async (outcome) => {
        setIsSaving(true);
        try {
            await base44.entities.Goal.update(goal.id, {
                is_completed: true,
                outcome: outcome,
            });
            toast({
                title: outcome === "achieved" ? "🎉 Goal marked as achieved!" : "Goal marked as not met",
                description: outcome === "achieved"
                    ? "Great work on completing your goal!"
                    : "Keep pushing — every attempt is progress.",
            });
            onResolved({ ...goal, is_completed: true, outcome });
        } catch (err) {
            toast({ title: "Error saving", description: err.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <Clock className="w-5 h-5 text-streak" />
                        Time's Up — How Did It Go?
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div>
                        <p className="font-bold text-foreground text-base leading-snug">{goal.title}</p>
                        {goal.target_date && (
                            <p className="text-xs text-streak mt-1">
                                Deadline was {format(new Date(goal.target_date), "MMM d, yyyy")}
                                {daysOverdue ? ` · ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} ago` : ""}
                            </p>
                        )}
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2">
                        <div className="bg-chart-3/10 border border-chart-3/20 rounded-xl p-3 text-center">
                            <Target className="w-4 h-4 text-chart-3 mx-auto mb-1" />
                            <div className="text-lg font-black text-chart-3">{progressPct}%</div>
                            <div className="text-xs text-muted-foreground">Progress</div>
                        </div>
                        <div className="bg-chart-4/10 border border-chart-4/20 rounded-xl p-3 text-center">
                            <Check className="w-4 h-4 text-chart-4 mx-auto mb-1" />
                            <div className="text-lg font-black text-chart-4">{completedMilestones}<span className="text-sm font-normal text-muted-foreground/60">/{totalMilestones}</span></div>
                            <div className="text-xs text-muted-foreground">Milestones</div>
                        </div>
                        <div className="bg-xp/10 border border-xp/20 rounded-xl p-3 text-center">
                            <Zap className="w-4 h-4 text-xp mx-auto mb-1" />
                            <div className="text-lg font-black text-xp">{earnedXP}<span className="text-xs font-normal text-muted-foreground/60">/{totalXP}</span></div>
                            <div className="text-xs text-muted-foreground">XP Earned</div>
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div>
                        <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
                            <div
                                className="h-full bg-chart-3 rounded-full transition-all"
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>
                    </div>

                    {/* Success criteria */}
                    {goal.success_criteria && (
                        <div className="bg-chart-3/10 border border-chart-3/20 rounded-xl p-3">
                            <p className="text-xs font-bold text-chart-3 mb-1">Your Success Criteria</p>
                            <p className="text-xs text-foreground">{goal.success_criteria}</p>
                        </div>
                    )}

                    <p className="text-sm text-muted-foreground font-medium text-center">Did you achieve this goal?</p>

                    {/* Decision buttons */}
                    <div className="grid grid-cols-2 gap-3">
                        <Button
                            onClick={() => handleResolve("achieved")}
                            disabled={isSaving}
                            className="btn-3d bg-primary hover:bg-primary text-primary-foreground h-14 flex-col gap-1"
                        >
                            <Trophy className="w-5 h-5" />
                            <span className="text-xs font-bold">Yes, I achieved it!</span>
                        </Button>
                        <Button
                            onClick={() => handleResolve("failed")}
                            disabled={isSaving}
                            variant="outline"
                            className="border-2 border-streak/30 text-streak hover:bg-streak/10 h-14 flex-col gap-1"
                        >
                            <X className="w-5 h-5" />
                            <span className="text-xs font-bold">Goal wasn't met</span>
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
