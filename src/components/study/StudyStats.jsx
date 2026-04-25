
import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, BookOpen, Brain, Eye, FileText, Award, TrendingUp, RefreshCw, PenTool } from "lucide-react";
import { format, startOfWeek, endOfWeek, subDays } from "date-fns";

const techniqueIcons = {
    pomodoro: Clock,
    spaced_repetition: RefreshCw,
    active_recall: Brain,
    blurting: PenTool,
    focused_study: BookOpen,
    review: Eye,
    quiz: Brain,
    reading: FileText
};

const techniqueColors = {
    pomodoro: "bg-green-100 text-green-800 border-green-200",
    spaced_repetition: "bg-blue-100 text-blue-800 border-blue-200",
    active_recall: "bg-purple-100 text-purple-800 border-purple-200",
    blurting: "bg-orange-100 text-orange-800 border-orange-200",
    focused_study: "bg-indigo-100 text-indigo-800 border-indigo-200",
    review: "bg-pink-100 text-pink-800 border-pink-200",
    quiz: "bg-red-100 text-red-800 border-red-200",
    reading: "bg-yellow-100 text-yellow-800 border-yellow-200"
};

export default function StudyStats({ userProfile, recentSessions = [], isLoading }) {
    const calculateStats = () => {
        const now = new Date();
        const weekStart = startOfWeek(now, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
        const last7Days = subDays(now, 7);
        
        // This week's sessions
        const thisWeekSessions = recentSessions.filter(session => {
            const sessionDate = new Date(session.date);
            return sessionDate >= weekStart && sessionDate <= weekEnd;
        });
        
        // Last 7 days for daily average
        const recent7DaysSessions = recentSessions.filter(session => {
            const sessionDate = new Date(session.date);
            return sessionDate >= last7Days;
        });
        
        const totalMinutes = recentSessions.reduce((sum, s) => sum + (s.session_duration || 0), 0);
        const weekMinutes = thisWeekSessions.reduce((sum, s) => sum + (s.session_duration || 0), 0);
        const dailyAverage = recent7DaysSessions.length > 0 ? 
            Math.round(recent7DaysSessions.reduce((sum, s) => sum + (s.session_duration || 0), 0) / 7) : 0;
        
        // Technique usage
        const techniqueUsage = recentSessions.reduce((acc, session) => {
            const technique = session.technique_name || 'unknown';
            if (!acc[technique]) acc[technique] = { count: 0, minutes: 0 };
            acc[technique].count++;
            acc[technique].minutes += session.session_duration || 0;
            return acc;
        }, {});
        
        const mostUsedTechnique = Object.entries(techniqueUsage).length > 0 
            ? Object.entries(techniqueUsage).reduce((a, b) => 
                techniqueUsage[a[0]].minutes > techniqueUsage[b[0]].minutes ? a : b
              )[0] 
            : null;

        return {
            totalHours: Math.floor(totalMinutes / 60),
            weekMinutes,
            dailyAverage,
            totalSessions: recentSessions.length,
            mostUsedTechnique,
            techniqueUsage
        };
    };

    const stats = calculateStats();

    return (
        <div className="space-y-6">
            {/* Profile Card */}
            {userProfile && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200/50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-indigo-900">
                                <Award className="w-5 h-5" />
                                Your Progress
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-indigo-700">Study Streak</span>
                                <Badge className="bg-orange-200 text-orange-800">
                                    {userProfile.streak_days || 0} days
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            )}

            {/* Study Statistics */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
            >
                <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-blue-900">
                            <TrendingUp className="w-5 h-5" />
                            Study Analytics
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="text-center p-3 bg-white rounded-lg border border-blue-200/50">
                                <div className="text-2xl font-bold text-blue-900">{stats.totalHours}h</div>
                                <div className="text-xs text-blue-700">Total Hours</div>
                            </div>
                            <div className="text-center p-3 bg-white rounded-lg border border-blue-200/50">
                                <div className="text-2xl font-bold text-blue-900">{Math.floor(stats.weekMinutes / 60)}h</div>
                                <div className="text-xs text-blue-700">This Week</div>
                            </div>
                            <div className="text-center p-3 bg-white rounded-lg border border-blue-200/50">
                                <div className="text-2xl font-bold text-blue-900">{stats.dailyAverage}m</div>
                                <div className="text-xs text-blue-700">Daily Avg</div>
                            </div>
                            <div className="text-center p-3 bg-white rounded-lg border border-blue-200/50">
                                <div className="text-2xl font-bold text-blue-900">{stats.totalSessions}</div>
                                <div className="text-xs text-blue-700">Sessions</div>
                            </div>
                        </div>
                        
                        {stats.mostUsedTechnique && (
                            <div className="text-center">
                                <p className="text-sm text-blue-700 mb-2">Favorite Technique:</p>
                                <Badge className={techniqueColors[stats.mostUsedTechnique] || 'bg-gray-100 text-gray-800'}>
                                    {stats.mostUsedTechnique.replace(/_/g,  ' ')}
                                </Badge>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </motion.div>

            {/* Recent Sessions */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
            >
                <Card className="bg-white/70 backdrop-blur-sm border-gray-200/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="w-5 h-5 text-green-600" />
                            Recent Sessions
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="space-y-3">
                                {Array(3).fill(0).map((_, i) => (
                                    <div key={i} className="animate-pulse flex items-center gap-3">
                                        <div className="w-8 h-8 bg-gray-200 rounded-lg" />
                                        <div className="flex-1">
                                            <div className="h-4 bg-gray-200 rounded w-3/4 mb-1" />
                                            <div className="h-3 bg-gray-200 rounded w-1/2" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : recentSessions.length === 0 ? (
                            <div className="text-center py-6 text-gray-500">
                                <Clock className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                                <p className="text-sm">No study sessions yet</p>
                                <p className="text-xs">Start your first session above!</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {recentSessions.slice(0, 5).map((session, index) => {
                                    const TechniqueIcon = techniqueIcons[session.technique_name] || BookOpen;
                                    
                                    return (
                                        <motion.div
                                            key={session.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.1 }}
                                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50/50 transition-colors"
                                        >
                                            <div className="w-8 h-8 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                                                <TechniqueIcon className="w-4 h-4 text-gray-600" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-medium text-gray-900 text-sm">{session.subject}</span>
                                                    <Badge 
                                                        variant="secondary" 
                                                        className={`text-xs ${techniqueColors[session.technique_name] || 'bg-gray-100 text-gray-800'}`}
                                                    >
                                                        {(session.technique_name || '').replace(/_/g, ' ')}
                                                    </Badge>
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {session.session_duration}min • {format(new Date(session.date), "MMM d")}
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}
