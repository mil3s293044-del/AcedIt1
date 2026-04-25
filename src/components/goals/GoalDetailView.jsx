import React, { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import {
    ArrowLeft, Zap, Trophy, Calendar, Target, Flame,
    Star, Swords, RefreshCw, Loader2
} from "lucide-react";
import CreateCompetitionDialog from "@/components/competition/CreateCompetitionDialog";
import SubGoalCard from "./SubGoalCard";

const URGENCY_COLORS = {
    overdue: "text-red-600 bg-red-50 border-red-200",
    critical: "text-orange-600 bg-orange-50 border-orange-200",
    soon: "text-yellow-600 bg-yellow-50 border-yellow-200",
    normal: "text-green-600 bg-green-50 border-green-200",
};

function getUrgency(targetDate) {
    if (!targetDate) return "normal";
    const days = Math.ceil((new Date(targetDate) - new Date()) / 86400000);
    if (days < 0) return "overdue";
    if (days <= 3) return "critical";
    if (days <= 7) return "soon";
    return "normal";
}

function getDaysUntil(targetDate) {
    if (!targetDate) return null;
    const days = Math.ceil((new Date(targetDate) - new Date()) / 86400000);
    if (days < 0) return `${Math.abs(days)} days overdue`;
    if (days === 0) return "Due today!";
    if (days === 1) return "Due tomorrow";
    return `${days} days left`;
}

export default function GoalDetailView({ goal, onBack, onGoalUpdated }) {
    const { toast } = useToast();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showCompeteDialog, setShowCompeteDialog] = useState(false);

    const syncProgress = React.useCallback((silent = false) => {
        const hasTracked = (goal.sub_goals || []).some(sg =>
            (sg.type && sg.type !== 'manual') ||
            (sg.sub_sub_goals || []).some(ssg => ssg.type && ssg.type !== 'manual')
        );
        if (!hasTracked || goal.is_completed) return;
        base44.functions.invoke('updateGoalProgress', { goal_id: goal.id })
            .then(res => {
                const data = res?.data ?? res;
                if (data?.updated_sub_goals && onGoalUpdated) {
                    onGoalUpdated({ ...goal, sub_goals: data.updated_sub_goals, progress: data.overall_progress });
                    if (!silent) {
                        toast({ title: "Progress updated ✓" });
                    }
                }
            })
            .catch(() => {});
    }, [goal.id, goal.is_completed]);

    // Auto-sync on mount
    React.useEffect(() => {
        syncProgress(true);
    }, [goal.id]);

    // Listen for pomodoro sessions saved — immediately re-sync progress
    React.useEffect(() => {
        const handler = () => syncProgress(true);
        window.addEventListener('studySessionSaved', handler);
        return () => window.removeEventListener('studySessionSaved', handler);
    }, [syncProgress]);

    const subGoals = goal.sub_goals || [];
    const activeIndex = subGoals.findIndex(sg => !sg.completed);
    const completedCount = subGoals.filter(sg => sg.completed).length;
    const overallProgress = subGoals.length > 0 ? Math.round((completedCount / subGoals.length) * 100) : 0;
    const urgency = getUrgency(goal.target_date);
    const daysLeft = getDaysUntil(goal.target_date);

    const totalXP = subGoals.reduce((sum, sg) => {
        const subItems = sg.sub_sub_goals || [];
        return sum + (subItems.length > 0
            ? subItems.reduce((s, i) => s + (i.xp_reward || 0), 0)
            : (sg.xp_reward || 0));
    }, 0) + (goal.total_xp_reward || 0);

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

    const handleRefreshProgress = async () => {
        setIsRefreshing(true);
        try {
            const res = await base44.functions.invoke('updateGoalProgress', { goal_id: goal.id });
            const data = res?.data ?? res;
            if (data?.updated_sub_goals) {
                const updated = { ...goal, sub_goals: data.updated_sub_goals, progress: data.overall_progress };
                if (onGoalUpdated) onGoalUpdated(updated);

                const newlyCompleted = data.updated_sub_goals.filter((sg, i) => sg.completed && !subGoals[i]?.completed);
                if (newlyCompleted.length > 0) {
                    toast({ title: `🎉 ${newlyCompleted.length} sub-goal(s) completed!`, description: "Your AcedIt activity unlocked new progress." });
                } else {
                    toast({ title: "Progress refreshed ✓", description: "Your AcedIt stats have been synced." });
                }

                // Sync competition
                try {
                    await base44.functions.invoke('updateCompetitionProgress', {
                        goal_id: goal.id,
                        sub_goals_completed: data.updated_sub_goals.filter(sg => sg.completed).length,
                        progress_percent: data.overall_progress,
                    });
                } catch (_) {}
            }
        } catch (err) {
            toast({ title: "Refresh failed", description: err.message, variant: "destructive" });
        } finally {
            setIsRefreshing(false);
        }
    };

    const PRIORITY_COLORS = { high: "bg-red-100 text-red-700", medium: "bg-yellow-100 text-yellow-700", low: "bg-gray-100 text-gray-600" };
    const DIFF_COLORS = { easy: "bg-green-100 text-green-700", medium: "bg-blue-100 text-blue-700", hard: "bg-orange-100 text-orange-700", very_hard: "bg-red-100 text-red-700" };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start gap-4">
                <Button variant="ghost" size="icon" onClick={onBack} className="flex-shrink-0 mt-1">
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                        {goal.priority && <Badge className={`${PRIORITY_COLORS[goal.priority]} text-xs border-0`}>{goal.priority} priority</Badge>}
                        {goal.difficulty_level && <Badge className={`${DIFF_COLORS[goal.difficulty_level]} text-xs border-0`}>{goal.difficulty_level?.replace("_", " ")}</Badge>}
                        {goal.is_completed && <Badge className="bg-green-100 text-green-700 text-xs border-0">✓ Completed</Badge>}
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 leading-tight">{goal.title}</h1>
                    {goal.description && <p className="text-sm text-gray-500 mt-1">{goal.description}</p>}
                </div>
                {/* Refresh button */}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshProgress}
                    disabled={isRefreshing || goal.is_completed}
                    className="flex-shrink-0 border-purple-200 text-purple-700 hover:bg-purple-50"
                >
                    {isRefreshing
                        ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Syncing...</>
                        : <><RefreshCw className="w-4 h-4 mr-1.5" />Sync Progress</>
                    }
                </Button>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
                    <Trophy className="w-4 h-4 text-purple-600 mx-auto mb-1" />
                    <div className="text-lg font-black text-purple-700">{overallProgress}%</div>
                    <div className="text-xs text-gray-500">Progress</div>
                </div>
                <div className={`border rounded-xl p-3 text-center ${URGENCY_COLORS[urgency]}`}>
                    <Calendar className="w-4 h-4 mx-auto mb-1" />
                    <div className="text-sm font-bold leading-tight">{daysLeft || "—"}</div>
                    <div className="text-xs opacity-70">Deadline</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                    <Zap className="w-4 h-4 text-amber-600 mx-auto mb-1" />
                    <div className="text-lg font-black text-amber-700">{earnedXP}</div>
                    <div className="text-xs text-gray-500">XP Earned</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                    <Star className="w-4 h-4 text-green-600 mx-auto mb-1" />
                    <div className="text-lg font-black text-green-700">{totalXP}</div>
                    <div className="text-xs text-gray-500">Total XP</div>
                </div>
            </div>

            {/* Overall Progress Bar */}
            <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 font-medium">{completedCount} / {subGoals.length} sub-goals complete</span>
                    <span className="text-purple-700 font-bold">{overallProgress}%</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${overallProgress}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                </div>
            </div>

            {/* Auto-tracking info banner */}
            {!goal.is_completed && (
                <div className="flex items-start gap-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
                    <RefreshCw className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-blue-800">Objectives are auto-tracked from your AcedIt activity</p>
                        <p className="text-xs text-blue-600 mt-0.5">Study, take quizzes, and review flashcards in AcedIt — then hit <strong>Sync Progress</strong> to see your latest results. Sub-goals complete automatically when all objectives are met.</p>
                    </div>
                </div>
            )}

            {/* Completion bonus */}
            {!goal.is_completed && (
                <div className="flex items-center gap-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4">
                    <Flame className="w-5 h-5 text-orange-500 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-bold text-orange-800">Goal Completion Bonus</p>
                        <p className="text-xs text-orange-600">Finish all sub-goals to earn <strong>{goal.total_xp_reward || 0} XP</strong> bonus!</p>
                    </div>
                </div>
            )}

            {/* Sub-Goals */}
            <div className="space-y-3">
                <h3 className="font-bold text-gray-900 flex items-center gap-2"><Target className="w-5 h-5 text-purple-600" />Sub-Goals</h3>
                {subGoals.length === 0 && (
                    <p className="text-gray-400 text-sm text-center py-8">No sub-goals defined.</p>
                )}
                {subGoals.map((sg, idx) => (
                    <SubGoalCard
                        key={sg.id}
                        subGoal={{ ...sg, _goal: goal }}
                        index={idx}
                        activeIndex={activeIndex === -1 ? subGoals.length : activeIndex}
                        goal={goal}
                    />
                ))}
            </div>

            {/* Success Criteria */}
            {goal.success_criteria && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-1">
                    <p className="text-sm font-bold text-blue-800">Success Criteria</p>
                    <p className="text-sm text-blue-700">{goal.success_criteria}</p>
                </div>
            )}

            {/* Compete CTA */}
            {!goal.is_completed && (
                <div className="flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-2xl p-4">
                    <div>
                        <p className="font-bold text-indigo-900 flex items-center gap-2"><Swords className="w-4 h-4" /> Compete with Friends</p>
                        <p className="text-xs text-indigo-600 mt-0.5">Race to complete this goal and earn bonus XP</p>
                    </div>
                    <Button
                        onClick={() => setShowCompeteDialog(true)}
                        className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 flex-shrink-0"
                        size="sm"
                    >
                        <Trophy className="w-4 h-4 mr-2" /> Compete
                    </Button>
                </div>
            )}

            <CreateCompetitionDialog
                open={showCompeteDialog}
                onClose={() => setShowCompeteDialog(false)}
                goal={goal}
                onCreated={() => toast({ title: "Competition started! 🏆" })}
            />
        </div>
    );
}