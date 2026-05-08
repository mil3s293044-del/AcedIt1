import React, { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import {
    ArrowLeft, Zap, Trophy, Calendar, Target, Flame,
    Star, Swords, RefreshCw, Loader2, CheckCircle2
} from "lucide-react";
import CreateCompetitionDialog from "@/components/competition/CreateCompetitionDialog";
import SubGoalCard from "./SubGoalCard";
import { GoalCompetition } from "@/entities/all";

const URGENCY_CLASSES = {
    overdue:  "text-streak bg-streak/10 border-streak/30",
    critical: "text-streak bg-streak/10 border-streak/20",
    soon:     "text-xp bg-xp/10 border-xp/20",
    normal:   "text-primary bg-primary/10 border-primary/20",
};

const PRIORITY_CLASSES = {
    high:   "bg-streak/15 text-streak",
    medium: "bg-xp/15 text-xp",
    low:    "bg-secondary text-muted-foreground",
};

const DIFF_CLASSES = {
    easy:      "bg-primary/15 text-primary",
    medium:    "bg-chart-3/15 text-chart-3",
    hard:      "bg-xp/15 text-xp",
    very_hard: "bg-streak/15 text-streak",
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
    const [activeCompetition, setActiveCompetition] = useState(null);

    // Look up an existing active/pending competition for this goal so we can
    // hide the "Compete" CTA once one exists. Prevents the second-click 409
    // from createGoalCompetition.
    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const comps = await GoalCompetition.filter({ goal_id: goal.id });
                if (cancelled) return;
                const active = (comps || []).find(
                    (c) => c.status === "active" || c.status === "pending",
                );
                setActiveCompetition(active || null);
            } catch (e) {
                if (!cancelled) console.warn("[GoalDetailView] competition lookup failed:", e?.message);
            }
        })();
        return () => { cancelled = true; };
    }, [goal.id]);

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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start gap-4">
                <Button variant="ghost" size="icon" onClick={onBack} className="flex-shrink-0 mt-1">
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                        {goal.priority && <span className={`pill ${PRIORITY_CLASSES[goal.priority]}`}>{goal.priority} priority</span>}
                        {goal.difficulty_level && <span className={`pill ${DIFF_CLASSES[goal.difficulty_level]}`}>{goal.difficulty_level?.replace("_", " ")}</span>}
                        {goal.is_completed && (
                            <span className="pill bg-primary/15 text-primary gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Completed
                            </span>
                        )}
                    </div>
                    <h1 className="text-2xl font-bold text-foreground leading-tight">{goal.title}</h1>
                    {goal.description && <p className="text-sm text-muted-foreground mt-1">{goal.description}</p>}
                </div>
                {/* Refresh button */}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshProgress}
                    disabled={isRefreshing || goal.is_completed}
                    className="flex-shrink-0 border-chart-4/30 text-chart-4 hover:bg-chart-4/10"
                >
                    {isRefreshing
                        ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Syncing...</>
                        : <><RefreshCw className="w-4 h-4 mr-1.5" />Sync Progress</>
                    }
                </Button>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="card-soft bg-chart-3/10 border-chart-3/20 p-3 text-center">
                    <Trophy className="w-4 h-4 text-chart-3 mx-auto mb-1" />
                    <div className="text-lg font-black text-chart-3">{overallProgress}%</div>
                    <div className="text-xs text-muted-foreground">Progress</div>
                </div>
                <div className={`card-soft p-3 text-center ${URGENCY_CLASSES[urgency]}`}>
                    <Calendar className="w-4 h-4 mx-auto mb-1" />
                    <div className="text-sm font-bold leading-tight">{daysLeft || "—"}</div>
                    <div className="text-xs opacity-70">Deadline</div>
                </div>
                <div className="card-soft bg-xp/10 border-xp/20 p-3 text-center">
                    <Zap className="w-4 h-4 text-xp mx-auto mb-1" />
                    <div className="text-lg font-black text-xp">{earnedXP}</div>
                    <div className="text-xs text-muted-foreground">XP Earned</div>
                </div>
                <div className="card-soft bg-primary/10 border-primary/20 p-3 text-center">
                    <Star className="w-4 h-4 text-primary mx-auto mb-1" />
                    <div className="text-lg font-black text-primary">{totalXP}</div>
                    <div className="text-xs text-muted-foreground">Total XP</div>
                </div>
            </div>

            {/* Overall Progress Bar */}
            <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground font-medium">{completedCount} / {subGoals.length} sub-goals complete</span>
                    <span className="text-chart-3 font-bold">{overallProgress}%</span>
                </div>
                <div className="h-3 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-chart-3 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${overallProgress}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                </div>
            </div>

            {/* Auto-tracking info banner */}
            {!goal.is_completed && (
                <div className="flex items-start gap-3 bg-chart-3/5 border border-chart-3/20 rounded-xl p-4">
                    <RefreshCw className="w-5 h-5 text-chart-3 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-foreground">Objectives are auto-tracked from your AcedIt activity</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Study, take quizzes, and review flashcards in AcedIt — then hit <strong>Sync Progress</strong> to see your latest results. Sub-goals complete automatically when all objectives are met.</p>
                    </div>
                </div>
            )}

            {/* Completion bonus */}
            {!goal.is_completed && (
                <div className="flex items-center gap-3 bg-xp/5 border border-xp/20 rounded-xl p-4">
                    <Flame className="w-5 h-5 text-xp flex-shrink-0" />
                    <div>
                        <p className="text-sm font-bold text-foreground">Goal Completion Bonus</p>
                        <p className="text-xs text-muted-foreground">Finish all sub-goals to earn <strong>{goal.total_xp_reward || 0} XP</strong> bonus!</p>
                    </div>
                </div>
            )}

            {/* Sub-Goals */}
            <div className="space-y-3">
                <h3 className="font-bold text-foreground flex items-center gap-2"><Target className="w-5 h-5 text-chart-3" />Sub-Goals</h3>
                {subGoals.length === 0 && (
                    <p className="text-muted-foreground/60 text-sm text-center py-8">No sub-goals defined.</p>
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
                <div className="bg-chart-3/5 border border-chart-3/20 rounded-xl p-4 space-y-1">
                    <p className="text-sm font-bold text-foreground">Success Criteria</p>
                    <p className="text-sm text-muted-foreground">{goal.success_criteria}</p>
                </div>
            )}

            {/* Compete CTA — hide entirely once an active competition exists for this goal */}
            {!goal.is_completed && !activeCompetition && (
                <div className="flex items-center justify-between bg-chart-4/10 border-2 border-chart-4/20 rounded-2xl p-4">
                    <div>
                        <p className="font-bold text-foreground flex items-center gap-2"><Swords className="w-4 h-4 text-chart-4" /> Compete with Friends</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Race to complete this goal and earn bonus XP</p>
                    </div>
                    <Button
                        onClick={() => setShowCompeteDialog(true)}
                        className="bg-chart-4 text-white hover:bg-chart-4/90 flex-shrink-0"
                        size="sm"
                    >
                        <Trophy className="w-4 h-4 mr-2" /> Compete
                    </Button>
                </div>
            )}
            {!goal.is_completed && activeCompetition && (
                <div className="flex items-center justify-between bg-chart-4/5 border border-chart-4/20 rounded-2xl p-4">
                    <div>
                        <p className="font-bold text-foreground flex items-center gap-2"><Swords className="w-4 h-4 text-chart-4" /> Competition in progress</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Invite code: <span className="font-mono font-semibold">{activeCompetition.invite_code || "—"}</span></p>
                    </div>
                </div>
            )}

            <CreateCompetitionDialog
                open={showCompeteDialog}
                onClose={() => setShowCompeteDialog(false)}
                goal={goal}
                onCreated={(competition) => {
                    toast({ title: "Competition started!" });
                    if (competition) setActiveCompetition(competition);
                }}
            />
        </div>
    );
}
