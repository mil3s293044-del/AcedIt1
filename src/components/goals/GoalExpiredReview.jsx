import React, { useState } from "react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Trophy, XCircle, Target, Zap, CheckCircle2, Calendar, Star } from "lucide-react";
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
                        <Calendar className="w-5 h-5 text-amber-500" />
                        Time's Up — How Did It Go?
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div>
                        <p className="font-bold text-gray-900 text-base leading-snug">{goal.title}</p>
                        {goal.target_date && (
                            <p className="text-xs text-amber-600 mt-1">
                                Deadline was {format(new Date(goal.target_date), "MMM d, yyyy")}
                                {daysOverdue ? ` · ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} ago` : ""}
                            </p>
                        )}
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2">
                        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
                            <Target className="w-4 h-4 text-purple-600 mx-auto mb-1" />
                            <div className="text-lg font-black text-purple-700">{progressPct}%</div>
                            <div className="text-xs text-gray-500">Progress</div>
                        </div>
                        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-center">
                            <CheckCircle2 className="w-4 h-4 text-indigo-600 mx-auto mb-1" />
                            <div className="text-lg font-black text-indigo-700">{completedMilestones}<span className="text-sm font-normal text-gray-400">/{totalMilestones}</span></div>
                            <div className="text-xs text-gray-500">Milestones</div>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                            <Zap className="w-4 h-4 text-amber-600 mx-auto mb-1" />
                            <div className="text-lg font-black text-amber-700">{earnedXP}<span className="text-xs font-normal text-gray-400">/{totalXP}</span></div>
                            <div className="text-xs text-gray-500">XP Earned</div>
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div>
                        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-purple-400 to-indigo-500 rounded-full transition-all"
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>
                    </div>

                    {/* Success criteria */}
                    {goal.success_criteria && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                            <p className="text-xs font-bold text-blue-800 mb-1">Your Success Criteria</p>
                            <p className="text-xs text-blue-700">{goal.success_criteria}</p>
                        </div>
                    )}

                    <p className="text-sm text-gray-600 font-medium text-center">Did you achieve this goal?</p>

                    {/* Decision buttons */}
                    <div className="grid grid-cols-2 gap-3">
                        <Button
                            onClick={() => handleResolve("achieved")}
                            disabled={isSaving}
                            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white h-14 flex-col gap-1"
                        >
                            <Trophy className="w-5 h-5" />
                            <span className="text-xs font-bold">Yes, I achieved it!</span>
                        </Button>
                        <Button
                            onClick={() => handleResolve("failed")}
                            disabled={isSaving}
                            variant="outline"
                            className="border-2 border-red-200 text-red-600 hover:bg-red-50 h-14 flex-col gap-1"
                        >
                            <XCircle className="w-5 h-5" />
                            <span className="text-xs font-bold">Goal wasn't met</span>
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}