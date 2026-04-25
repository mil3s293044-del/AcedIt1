import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Target, Calendar, Award, Zap, Edit } from "lucide-react";
import { StudyTechnique, SubjectAssessment } from "@/entities/all";
import { format, startOfWeek, endOfWeek, differenceInDays } from "date-fns";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

export default function StudyGoalsProgress({ user, userProfile }) {
    const [weeklyProgress, setWeeklyProgress] = useState({ current: 0, goal: 0 });
    const [upcomingAssessments, setUpcomingAssessments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [showEditGoal, setShowEditGoal] = useState(false);
    const [newWeeklyGoal, setNewWeeklyGoal] = useState(20);
    const { toast } = useToast();

    useEffect(() => {
        if (user?.email) {
            loadProgressData();
        }
    }, [user, userProfile]);

    const loadProgressData = async () => {
        if (!user?.email) return;
        
        setIsLoading(true);
        setHasError(false);
        
        try {
            const weekStart = startOfWeek(new Date());
            const weekEnd = endOfWeek(new Date());

            const sessionsPromise = StudyTechnique.filter({ 
                created_by: user.email,
                date: { $gte: format(weekStart, 'yyyy-MM-dd'), $lte: format(weekEnd, 'yyyy-MM-dd') }
            }).catch(() => []);

            const today = format(new Date(), 'yyyy-MM-dd');
            const assessmentsPromise = SubjectAssessment.filter({
                created_by: user.email,
                is_completed: false,
                due_date: { $gte: today }
            }, "due_date", 5).catch(() => []);

            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 8000)
            );

            const [sessions, assessments] = await Promise.race([
                Promise.all([sessionsPromise, assessmentsPromise]),
                timeoutPromise
            ]);

            const weeklyMinutes = sessions.reduce((sum, s) => sum + (s.session_duration || 0), 0);
            const weeklyGoalHours = userProfile?.weekly_study_goal_hours || 20;

            setWeeklyProgress({
                current: Math.floor(weeklyMinutes / 60),
                goal: weeklyGoalHours
            });

            setNewWeeklyGoal(weeklyGoalHours);

            const sortedAssessments = assessments
                .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
                .slice(0, 3);

            setUpcomingAssessments(sortedAssessments);

        } catch (error) {
            console.error("Error loading progress data:", error);
            setHasError(true);
            setWeeklyProgress({ current: 0, goal: userProfile?.weekly_study_goal_hours || 20 });
            setUpcomingAssessments([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveWeeklyGoal = async () => {
        if (newWeeklyGoal < 1 || newWeeklyGoal > 168) {
            toast({ title: "Invalid goal", description: "Please enter a goal between 1 and 168 hours.", variant: "destructive" });
            return;
        }

        try {
            await base44.auth.updateMe({ weekly_study_goal_hours: newWeeklyGoal });
            
            setWeeklyProgress(prev => ({ ...prev, goal: newWeeklyGoal }));
            setShowEditGoal(false);
            
            toast({ title: "Goal updated! 🎯", description: `New weekly goal: ${newWeeklyGoal} hours` });
        } catch (error) {
            console.error("Error updating goal:", error);
            toast({ title: "Error", description: "Could not update goal. Please try again.", variant: "destructive" });
        }
    };

    const weeklyPercentage = weeklyProgress.goal > 0 
        ? Math.min(100, Math.round((weeklyProgress.current / weeklyProgress.goal) * 100))
        : 0;

    const getProgressColor = (percentage) => {
        if (percentage >= 100) return "text-green-600";
        if (percentage >= 75) return "text-blue-600";
        if (percentage >= 50) return "text-yellow-600";
        return "text-orange-600";
    };

    const getProgressBarColor = (percentage) => {
        if (percentage >= 100) return "bg-green-500";
        if (percentage >= 75) return "bg-blue-500";
        if (percentage >= 50) return "bg-yellow-500";
        return "bg-orange-500";
    };

    if (isLoading) {
        return (
            <Card className="shadow-lg border-2 border-purple-100">
                <CardContent className="p-8 text-center">
                    <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full mx-auto"></div>
                    <p className="text-gray-600 mt-4 text-sm">Loading progress...</p>
                </CardContent>
            </Card>
        );
    }

    if (hasError) {
        return (
            <Card className="shadow-lg border-2 border-gray-100">
                <CardContent className="p-8 text-center">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Target className="w-6 h-6 text-gray-400" />
                    </div>
                    <p className="text-gray-600 text-sm">Unable to load progress data</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Weekly Study Goal */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <Card className="shadow-lg border-2 border-purple-100 overflow-hidden">
                    <div className="h-2 bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500" />
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
                                    <Target className="w-5 h-5 text-white" />
                                </div>
                                Weekly Study Goal
                            </CardTitle>
                            <div className="flex items-center gap-2">
                                <Badge className={getProgressColor(weeklyPercentage)}>
                                    {weeklyPercentage}%
                                </Badge>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setShowEditGoal(true)}
                                    className="h-8 w-8 text-gray-600 hover:text-purple-600"
                                >
                                    <Edit className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <div className="flex items-baseline justify-between mb-2">
                                <span className="text-sm text-gray-600">This Week's Progress</span>
                                <span className="text-lg font-bold text-gray-900">
                                    {weeklyProgress.current}h / {weeklyProgress.goal}h
                                </span>
                            </div>
                            <div className="relative">
                                <Progress value={weeklyPercentage} className="h-4" />
                                <div 
                                    className={`absolute inset-0 ${getProgressBarColor(weeklyPercentage)} rounded-full transition-all`}
                                    style={{ width: `${weeklyPercentage}%` }}
                                />
                            </div>
                        </div>

                        {weeklyPercentage >= 100 ? (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                                <Award className="w-6 h-6 text-green-600 flex-shrink-0" />
                                <div>
                                    <p className="font-semibold text-green-900">Goal Achieved! 🎉</p>
                                    <p className="text-sm text-green-700">You've hit your weekly study target!</p>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Zap className="w-4 h-4 text-blue-600" />
                                    <p className="font-semibold text-blue-900 text-sm">Keep Going!</p>
                                </div>
                                <p className="text-sm text-blue-700">
                                    {weeklyProgress.goal - weeklyProgress.current} hours left to reach your goal
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </motion.div>

            {/* Upcoming Assessments */}
            {upcomingAssessments.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <Card className="shadow-lg border-2 border-orange-100">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
                                    <Calendar className="w-5 h-5 text-white" />
                                </div>
                                Upcoming Deadlines
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {upcomingAssessments.map((assessment, index) => {
                                const daysUntil = differenceInDays(new Date(assessment.due_date), new Date());
                                const isUrgent = daysUntil <= 3;
                                
                                return (
                                    <motion.div
                                        key={assessment.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.1 + index * 0.05 }}
                                        className={`p-3 rounded-lg border-2 ${
                                            isUrgent 
                                                ? 'bg-red-50 border-red-200' 
                                                : 'bg-gray-50 border-gray-200'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <p className="font-semibold text-gray-900">{assessment.title}</p>
                                                <p className="text-sm text-gray-600">{assessment.subject_name}</p>
                                            </div>
                                            <Badge 
                                                className={isUrgent ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}
                                            >
                                                {daysUntil === 0 ? 'Today' : 
                                                 daysUntil === 1 ? 'Tomorrow' : 
                                                 `${daysUntil} days`}
                                            </Badge>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </CardContent>
                    </Card>
                </motion.div>
            )}

            {/* Edit Goal Dialog */}
            <Dialog open={showEditGoal} onOpenChange={setShowEditGoal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Target className="w-5 h-5 text-purple-600" />
                            Set Weekly Study Goal
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <label className="text-sm font-medium mb-2 block">
                                How many hours do you want to study per week?
                            </label>
                            <Input
                                type="number"
                                min="1"
                                max="168"
                                value={newWeeklyGoal}
                                onChange={(e) => setNewWeeklyGoal(parseInt(e.target.value) || 1)}
                                className="text-lg"
                            />
                            <p className="text-xs text-gray-500 mt-2">
                                Recommended: 15-30 hours per week for VCE students
                            </p>
                        </div>
                        
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm text-blue-900">
                                <strong>That's approximately:</strong>
                            </p>
                            <ul className="text-sm text-blue-800 mt-2 space-y-1">
                                <li>• {Math.round((newWeeklyGoal / 7) * 10) / 10} hours per day</li>
                                <li>• {Math.round((newWeeklyGoal / 5) * 10) / 10} hours per weekday (Mon-Fri)</li>
                            </ul>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowEditGoal(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveWeeklyGoal} className="bg-purple-600 hover:bg-purple-700">
                            Save Goal
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}