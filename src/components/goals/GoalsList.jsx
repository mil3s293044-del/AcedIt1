import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import GoalExpiredReview from "./GoalExpiredReview";
import {
    Plus, Target, Calendar, Zap, ChevronRight,
    Trash2, CheckCircle2, Lock, Loader2, ChevronDown, BookOpen, Star, Trophy, XCircle, Clock
} from "lucide-react";

const CATEGORY_COLORS = {
    academic: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200", dot: "bg-blue-500" },
    personal: { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-200", dot: "bg-purple-500" },
    career: { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
    atar_milestone: { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500" },
    subject_milestone: { bg: "bg-indigo-100", text: "text-indigo-700", border: "border-indigo-200", dot: "bg-indigo-500" },
    course_milestone: { bg: "bg-pink-100", text: "text-pink-700", border: "border-pink-200", dot: "bg-pink-500" },
};

const PRIORITY_DOT = { high: "bg-red-500", medium: "bg-yellow-500", low: "bg-gray-400" };

function isExpired(targetDate) {
    if (!targetDate) return false;
    return new Date(targetDate) < new Date();
}

function getDaysText(targetDate, isCompleted) {
    if (!targetDate) return null;
    const days = Math.ceil((new Date(targetDate) - new Date()) / 86400000);
    if (days < 0) {
        if (isCompleted) return null;
        return { text: "Time's up", color: "text-amber-600", isExpired: true };
    }
    if (days === 0) return { text: "Due today", color: "text-orange-600" };
    if (days === 1) return { text: "Due tomorrow", color: "text-orange-500" };
    if (days <= 7) return { text: `${days} days left`, color: "text-yellow-600" };
    return { text: `${days} days left`, color: "text-gray-400" };
}

function GoalCard({ goal, onSelect, onDelete }) {
    const subGoals = goal.sub_goals || [];
    const completedSubs = subGoals.filter(sg => sg.completed).length;
    const progress = goal.progress || 0;
    const activeSubGoal = subGoals.find(sg => !sg.completed);
    const daysInfo = getDaysText(goal.target_date, goal.is_completed);
    const xpTotal = subGoals.reduce((s, sg) => {
        const items = sg.sub_sub_goals || [];
        return s + (items.length > 0 ? items.reduce((a, i) => a + (i.xp_reward || 0), 0) : (sg.xp_reward || 0));
    }, 0) + (goal.total_xp_reward || 0);

    const urgencyBorder = goal.is_completed
        ? (goal.outcome === 'failed' ? 'border-red-200' : 'border-green-200')
        : daysInfo?.isExpired ? 'border-amber-200'
        : daysInfo?.color === "text-orange-600" ? "border-orange-200" : "border-gray-200";

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            onClick={() => onSelect(goal)}
            className={`group cursor-pointer bg-white rounded-2xl border-2 ${urgencyBorder} p-4 hover:shadow-md hover:border-indigo-200 transition-all`}
        >
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                    {goal.is_completed
                        ? goal.outcome === 'failed'
                            ? <XCircle className="w-5 h-5 text-red-500" />
                            : <CheckCircle2 className="w-5 h-5 text-green-500" />
                        : daysInfo?.isExpired
                            ? <Clock className="w-4 h-4 text-amber-500 mt-0.5" />
                            : <div className={`w-3 h-3 rounded-full mt-1 ${PRIORITY_DOT[goal.priority] || "bg-gray-400"}`} />
                    }
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-bold text-gray-900 text-sm leading-tight group-hover:text-indigo-700 transition-colors">{goal.title}</h3>
                        <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={e => { e.stopPropagation(); onDelete(goal.id); }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-red-500 text-gray-300 rounded">
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 transition-colors" />
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mb-3">
                        {goal.is_completed && goal.outcome && (
                            <span className={`text-xs font-bold flex items-center gap-1 ${
                                goal.outcome === 'achieved' ? 'text-green-600' : 'text-red-500'
                            }`}>
                                {goal.outcome === 'achieved' ? <Trophy className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                {goal.outcome === 'achieved' ? 'Achieved' : 'Not met'}
                            </span>
                        )}
                        {!goal.is_completed && daysInfo && (
                            <span className={`text-xs font-semibold flex items-center gap-1 ${daysInfo.color}`}>
                                <Calendar className="w-3 h-3" />{daysInfo.text}
                            </span>
                        )}
                        {xpTotal > 0 && (
                            <span className="text-xs text-amber-600 font-semibold flex items-center gap-1">
                                <Zap className="w-3 h-3" />{xpTotal} XP
                            </span>
                        )}
                        {goal.is_ai_generated && (
                            <span className="text-xs text-purple-600 font-semibold flex items-center gap-1">
                                <Star className="w-3 h-3" />AI
                            </span>
                        )}
                    </div>

                    {subGoals.length > 0 && (
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-xs text-gray-400">
                                <span>{completedSubs}/{subGoals.length} milestones</span>
                                <span className="font-bold text-indigo-600">{progress}%</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${goal.is_completed ? 'bg-green-400' : 'bg-gradient-to-r from-indigo-400 to-purple-500'}`}
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {activeSubGoal && !goal.is_completed && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 rounded-lg px-2 py-1.5">
                            <Lock className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                            <span className="font-medium text-indigo-600">Next:</span>
                            <span className="truncate">{activeSubGoal.title}</span>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

function SubjectGroup({ groupName, goals, color, onSelectGoal, onDelete, defaultOpen = true }) {
    const [open, setOpen] = useState(defaultOpen);
    const active = goals.filter(g => !g.is_completed).length;

    return (
        <div className="space-y-2">
            <button onClick={() => setOpen(o => !o)}
                className="w-full flex items-center gap-2.5 py-2 group">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${color?.dot || 'bg-gray-400'}`} />
                <span className="font-bold text-gray-800 text-sm flex-1 text-left">{groupName}</span>
                {active > 0 && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${color?.bg || 'bg-gray-100'} ${color?.text || 'text-gray-600'}`}>
                        {active} active
                    </span>
                )}
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-2 overflow-hidden pl-4"
                    >
                        {goals.map(goal => (
                            <GoalCard key={goal.id} goal={goal} onSelect={onSelectGoal} onDelete={onDelete} />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default function GoalsList({ userSubjects, onSelectGoal, onCreateGoal }) {
    const { toast } = useToast();
    const [goals, setGoals] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState("active");
    const [expiredGoal, setExpiredGoal] = useState(null);

    useEffect(() => {
        loadGoals();
        const unsub = base44.entities.Goal.subscribe((event) => {
            setGoals(prev => {
                if (event.type === "create") return [event.data, ...prev];
                if (event.type === "update") return prev.map(g => g.id === event.id ? event.data : g);
                if (event.type === "delete") return prev.filter(g => g.id !== event.id);
                return prev;
            });
        });
        return () => unsub();
    }, []);

    const loadGoals = async () => {
        setIsLoading(true);
        try {
            const user = await base44.auth.me();
            const data = await base44.entities.Goal.filter({ created_by: user.email }, "-created_date", 100);
            setGoals(data || []);
        } catch (err) {
            toast({ title: "Could not load goals", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (goalId) => {
        if (!confirm("Delete this goal? This cannot be undone.")) return;
        await base44.entities.Goal.delete(goalId);
        toast({ title: "Goal deleted" });
    };

    const handleGoalClick = (goal) => {
        // If expired but not yet resolved, show review modal instead of detail view
        if (!goal.is_completed && isExpired(goal.target_date)) {
            setExpiredGoal(goal);
            return;
        }
        onSelectGoal(goal);
    };

    const handleExpiredResolved = (updatedGoal) => {
        setGoals(prev => prev.map(g => g.id === updatedGoal.id ? updatedGoal : g));
        setExpiredGoal(null);
    };

    const filtered = goals.filter(g => {
        if (filter === "active") return !g.is_completed;
        if (filter === "completed") return g.is_completed;
        return true;
    });

    // In active view, expired-but-unresolved goals stay visible (time's up state)

    // Group by subject_code first, then by category for non-subject goals
    const grouped = {};
    const subjectNames = {};
    (userSubjects || []).forEach(s => { subjectNames[s.subject_code] = s.subject_name; });

    filtered.forEach(goal => {
        let groupKey;
        if (goal.subject_code) {
            groupKey = `subject:${goal.subject_code}`;
        } else {
            groupKey = `cat:${goal.category || 'academic'}`;
        }
        if (!grouped[groupKey]) grouped[groupKey] = [];
        grouped[groupKey].push(goal);
    });

    // Sort groups: subjects first (alphabetically), then categories
    const sortedGroups = Object.keys(grouped).sort((a, b) => {
        const aIsSubject = a.startsWith('subject:');
        const bIsSubject = b.startsWith('subject:');
        if (aIsSubject && !bIsSubject) return -1;
        if (!aIsSubject && bIsSubject) return 1;
        return a.localeCompare(b);
    });

    const getGroupLabel = (key) => {
        if (key.startsWith('subject:')) {
            const code = key.replace('subject:', '');
            return subjectNames[code] || code;
        }
        const cat = key.replace('cat:', '');
        return cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    };

    const getGroupColor = (key) => {
        if (key.startsWith('subject:')) return CATEGORY_COLORS['subject_milestone'];
        const cat = key.replace('cat:', '');
        return CATEGORY_COLORS[cat] || CATEGORY_COLORS['academic'];
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    const activeCount = goals.filter(g => !g.is_completed).length;
    const completedCount = goals.filter(g => g.is_completed).length;

    return (
        <>
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-gray-900">My Goals</h2>
                    <p className="text-xs text-gray-400">{activeCount} active · {completedCount} completed</p>
                </div>
                <Button onClick={onCreateGoal} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
                    <Plus className="w-4 h-4 mr-1.5" /> New Goal
                </Button>
            </div>

            {/* Filter Pills */}
            <div className="flex gap-2">
                {[
                    { id: "active", label: "Active", count: activeCount },
                    { id: "completed", label: "Done", count: completedCount },
                    { id: "all", label: "All", count: goals.length },
                ].map(f => (
                    <button key={f.id} onClick={() => setFilter(f.id)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                            filter === f.id ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}>
                        {f.label}
                        <span className={`text-xs ${filter === f.id ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'} px-1.5 py-0.5 rounded-full font-black`}>
                            {f.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Goals grouped */}
            {filtered.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
                    <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Target className="w-7 h-7 text-indigo-400" />
                    </div>
                    <h3 className="font-bold text-gray-700 mb-1">{filter === "completed" ? "No completed goals yet" : "No active goals"}</h3>
                    <p className="text-gray-400 text-sm mb-4">{filter !== "completed" && "Create your first goal to get started."}</p>
                    {filter !== "completed" && (
                        <Button onClick={onCreateGoal} className="bg-indigo-600 hover:bg-indigo-700">
                            <Plus className="w-4 h-4 mr-2" /> Create Goal
                        </Button>
                    )}
                </div>
            ) : (
                <div className="space-y-5">
                    {sortedGroups.map((groupKey, i) => (
                        <SubjectGroup
                            key={groupKey}
                            groupName={getGroupLabel(groupKey)}
                            goals={grouped[groupKey]}
                            color={getGroupColor(groupKey)}
                            onSelectGoal={handleGoalClick}
                            onDelete={handleDelete}
                            defaultOpen={i < 3}
                        />
                    ))}
                </div>
            )}
        </div>

        {expiredGoal && (
            <GoalExpiredReview
                goal={expiredGoal}
                onClose={() => setExpiredGoal(null)}
                onResolved={handleExpiredResolved}
            />
        )}
        </>
    );
}