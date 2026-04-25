import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle2, Circle, Calendar } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const activityColors = {
    lecture_review: "bg-blue-100 text-blue-800 border-blue-200",
    homework: "bg-green-100 text-green-800 border-green-200",
    practice_problems: "bg-yellow-100 text-yellow-800 border-yellow-200",
    reading: "bg-purple-100 text-purple-800 border-purple-200",
    revision: "bg-orange-100 text-orange-800 border-orange-200",
    quiz_prep: "bg-pink-100 text-pink-800 border-pink-200",
    exam: "bg-red-100 text-red-800 border-red-200",
    assignment: "bg-indigo-100 text-indigo-800 border-indigo-200"
};

export default function TodaysTimetable({ user }) {
    const [todayActivities, setTodayActivities] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (user) {
            loadTodaysTimetable();
        }
    }, [user]);

    const loadTodaysTimetable = async () => {
        setIsLoading(true);
        try {
            // Load from StudyPlan entity (study planner events)
            const { StudyPlan } = await import('@/entities/StudyPlan');
            const today = format(new Date(), 'yyyy-MM-dd');
            const activities = await StudyPlan.filter({ 
                date: today,
                created_by: user.email 
            }, "start_time");
            setTodayActivities(activities || []);
        } catch (error) {
            console.error("Error loading today's timetable:", error);
            setTodayActivities([]);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleActivityComplete = async (activity) => {
        try {
            const { StudyPlan } = await import('@/entities/StudyPlan');
            await StudyPlan.update(activity.id, {
                is_completed: !activity.is_completed
            });
            loadTodaysTimetable();
        } catch (error) {
            console.error("Error updating activity:", error);
        }
    };

    const getCurrentActivity = () => {
        const now = new Date();
        const currentTime = format(now, 'HH:mm');
        
        return todayActivities.find(activity => {
            return currentTime >= activity.start_time && currentTime <= activity.end_time;
        });
    };

    const getNextActivity = () => {
        const now = new Date();
        const currentTime = format(now, 'HH:mm');
        
        return todayActivities.find(activity => {
            return currentTime < activity.start_time;
        });
    };

    const currentActivity = getCurrentActivity();
    const nextActivity = getNextActivity();

    if (isLoading) {
        return (
            <Card className="bg-white/70 backdrop-blur-sm border-gray-200/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-blue-600" />
                        Today's Schedule
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="animate-pulse space-y-3">
                        {Array(3).fill(0).map((_, i) => (
                            <div key={i} className="h-16 bg-gray-200 rounded-lg" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
        >
            <Card className="bg-white/70 backdrop-blur-sm border-gray-200/50 hover:shadow-lg transition-all duration-300">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-blue-600" />
                            Today's Schedule
                        </CardTitle>
                        <Link to={createPageUrl("Goals?tab=planner")}>
                            <Button variant="outline" size="sm">
                                Edit Schedule
                            </Button>
                        </Link>
                    </div>
                </CardHeader>
                <CardContent>
                    {todayActivities.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p className="mb-2">No schedule set for today</p>
                            <Link to={createPageUrl("Goals?tab=planner")}>
                                <Button variant="outline" size="sm">
                                    Create Schedule
                                </Button>
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {/* Current Activity */}
                            {currentActivity && (
                                <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                                        <span className="text-sm font-medium text-blue-800">Current Activity</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-medium text-blue-900">{currentActivity.title}</h4>
                                            <p className="text-sm text-blue-700">
                                                {currentActivity.start_time} - {currentActivity.end_time}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge className={activityColors[currentActivity.study_type] || activityColors.lecture_review}>
                                                {currentActivity.study_type?.replace(/_/g, ' ')}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Next Activity */}
                            {nextActivity && !currentActivity && (
                                <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Clock className="w-4 h-4 text-green-600" />
                                        <span className="text-sm font-medium text-green-800">Coming Up</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-medium text-green-900">{nextActivity.title}</h4>
                                            <p className="text-sm text-green-700">
                                                {nextActivity.start_time} - {nextActivity.end_time}
                                            </p>
                                        </div>
                                        <Badge className={activityColors[nextActivity.study_type] || activityColors.lecture_review}>
                                            {nextActivity.study_type?.replace(/_/g, ' ')}
                                        </Badge>
                                    </div>
                                </div>
                            )}

                            {/* All Activities */}
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {todayActivities.map((activity, index) => (
                                    <div 
                                        key={activity.id} 
                                        className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-200 ${
                                            activity.is_completed 
                                                ? 'bg-gray-50 border-gray-200 opacity-75' 
                                                : 'bg-white border-gray-200 hover:shadow-sm'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => toggleActivityComplete(activity)}
                                                className="text-gray-400 hover:text-green-600 transition-colors"
                                            >
                                                {activity.is_completed ? (
                                                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                                                ) : (
                                                    <Circle className="w-5 h-5" />
                                                )}
                                            </button>
                                            <div>
                                                <h4 className={`font-medium ${activity.is_completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                                                    {activity.title}
                                                </h4>
                                                <p className="text-sm text-gray-500">
                                                    {activity.start_time} - {activity.end_time}
                                                    {activity.subject_name && ` • ${activity.subject_name}`}
                                                </p>
                                            </div>
                                        </div>
                                        <Badge className={activityColors[activity.study_type] || activityColors.lecture_review} variant="outline">
                                            {activity.study_type?.replace(/_/g, ' ')}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    );
}