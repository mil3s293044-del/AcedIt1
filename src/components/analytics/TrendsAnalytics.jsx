import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Calendar, Activity, Timer, Brain, Layers, BookOpen } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts';
import { format, eachDayOfInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';

// Helper function to format minutes into hours and minutes
const formatDuration = (minutes) => {
    if (!minutes || minutes === 0) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
};

export default function TrendsAnalytics({ data, timeRange }) {
    // Prepare daily study time data
    const getDailyData = () => {
        const today = new Date();
        let interval;

        if (timeRange === "week") {
            interval = eachDayOfInterval({
                start: startOfWeek(today),
                end: endOfWeek(today)
            });
        } else if (timeRange === "month") {
            interval = eachDayOfInterval({
                start: startOfMonth(today),
                end: endOfMonth(today)
            });
        } else {
            interval = eachDayOfInterval({
                start: subDays(today, 30),
                end: today
            });
        }

        return interval.map(date => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const daySessions = data.techniques.filter(s => s.date === dateStr);
            const dayMinutes = daySessions.reduce((sum, s) => sum + (s.session_duration || 0), 0);
            
            return {
                date: format(date, 'MMM d'),
                hours: Math.round(dayMinutes / 60 * 10) / 10,
                sessions: daySessions.length
            };
        });
    };

    const dailyData = getDailyData();

    // Calculate performance trends
    const getPerformanceTrend = () => {
        const recentQuizzes = data.quizzes.slice(-10);
        if (recentQuizzes.length < 2) return null;

        const firstHalf = recentQuizzes.slice(0, Math.floor(recentQuizzes.length / 2));
        const secondHalf = recentQuizzes.slice(Math.floor(recentQuizzes.length / 2));

        const firstAvg = firstHalf.reduce((sum, q) => sum + q.score, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, q) => sum + q.score, 0) / secondHalf.length;

        return {
            change: Math.round((secondAvg - firstAvg) * 10) / 10,
            improving: secondAvg > firstAvg,
            firstAvg: Math.round(firstAvg),
            secondAvg: Math.round(secondAvg)
        };
    };

    const perfTrend = getPerformanceTrend();

    // Quiz score trend over time
    const quizTrendData = data.quizzes.map((quiz, index) => ({
        name: `Quiz ${index + 1}`,
        score: quiz.score,
        date: quiz.date
    }));

    // Study consistency (days studied vs total days)
    const getDaysStudied = () => {
        const uniqueDates = [...new Set(data.techniques.map(s => s.date))];
        return uniqueDates.length;
    };

    const daysStudied = getDaysStudied();
    const totalDays = dailyData.length;
    const consistency = Math.round((daysStudied / totalDays) * 100);

    // Calculate study technique breakdown
    const getTechniqueBreakdown = () => {
        // Pomodoro sessions
        const pomodoroSessions = data.techniques.filter(t => t.technique_name === 'pomodoro');
        const pomodoroMinutes = pomodoroSessions.reduce((sum, s) => sum + (s.session_duration || 0), 0);

        // Spaced Repetition sessions
        const spacedRepSessions = data.techniques.filter(t => t.technique_name === 'spaced_repetition');
        const spacedRepMinutes = spacedRepSessions.reduce((sum, s) => sum + (s.session_duration || 0), 0);

        // Active Recall sessions
        const activeRecallSessions = data.activeRecall || [];
        const activeRecallMinutes = activeRecallSessions.reduce((sum, s) => sum + (s.session_duration || 0), 0);

        // Blurting sessions
        const blurtingSessions = data.blurting || [];
        const blurtingMinutes = blurtingSessions.reduce((sum, s) => sum + (s.session_duration || 0), 0);

        // Quiz time
        const quizSessions = data.quizzes || [];
        const quizMinutes = Math.round(quizSessions.reduce((sum, q) => sum + ((q.time_taken || 0) / 60), 0));

        return [
            { 
                name: 'Pomodoro Timer', 
                minutes: pomodoroMinutes, 
                sessions: pomodoroSessions.length,
                color: '#10B981',
                icon: Timer
            },
            { 
                name: 'Spaced Repetition', 
                minutes: spacedRepMinutes, 
                sessions: spacedRepSessions.length,
                color: '#6366F1',
                icon: Layers
            },
            { 
                name: 'Active Recall', 
                minutes: activeRecallMinutes, 
                sessions: activeRecallSessions.length,
                color: '#8B5CF6',
                icon: Brain
            },
            { 
                name: 'Blurting', 
                minutes: blurtingMinutes, 
                sessions: blurtingSessions.length,
                color: '#F59E0B',
                icon: BookOpen
            },
            { 
                name: 'Quizzes', 
                minutes: quizMinutes, 
                sessions: quizSessions.length,
                color: '#EC4899',
                icon: Activity
            }
        ];
    };

    const techniqueBreakdown = getTechniqueBreakdown();
    const totalStudyMinutes = techniqueBreakdown.reduce((sum, t) => sum + t.minutes, 0);

    return (
        <div className="space-y-6">
            {/* Trend Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-2 border-blue-200">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                                <Activity className="w-6 h-6 text-blue-600" />
                            </div>
                            <Badge className={consistency >= 70 ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"}>
                                {consistency >= 70 ? "Great!" : "Needs Work"}
                            </Badge>
                        </div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-1">Study Consistency</h3>
                        <p className="text-3xl font-bold text-foreground">{consistency}%</p>
                        <p className="text-sm text-muted-foreground mt-1">
                            {daysStudied} out of {totalDays} days
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-2 border-purple-200">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                                {perfTrend?.improving ? (
                                    <TrendingUp className="w-6 h-6 text-green-600" />
                                ) : (
                                    <TrendingDown className="w-6 h-6 text-orange-600" />
                                )}
                            </div>
                            <Badge className={perfTrend?.improving ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"}>
                                {perfTrend?.improving ? "Improving" : "Declining"}
                            </Badge>
                        </div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-1">Performance Trend</h3>
                        <p className="text-3xl font-bold text-foreground">
                            {perfTrend?.change > 0 ? '+' : ''}{perfTrend?.change || 0}%
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                            {perfTrend ? `${perfTrend.firstAvg}% → ${perfTrend.secondAvg}%` : 'Not enough data'}
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-2 border-indigo-200">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                                <Calendar className="w-6 h-6 text-indigo-600" />
                            </div>
                            <Badge className="bg-indigo-100 text-indigo-800">
                                {timeRange === 'week' ? 'This Week' : timeRange === 'month' ? 'This Month' : 'Period'}
                            </Badge>
                        </div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-1">Total Sessions</h3>
                        <p className="text-3xl font-bold text-foreground">
                            {data.techniques.length + data.activeRecall.length + data.blurting.length}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                            Across all techniques
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Daily Study Time Chart */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Activity className="w-5 h-5 text-blue-600" />
                        Daily Study Time
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={dailyData}>
                            <defs>
                                <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                            <XAxis 
                                dataKey="date" 
                                tick={{ fontSize: 12 }}
                                angle={-45}
                                textAnchor="end"
                                height={60}
                            />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: 'white', 
                                    border: '1px solid #E5E7EB',
                                    borderRadius: '8px'
                                }}
                                formatter={(value, name) => [
                                    name === 'hours' ? formatDuration(value * 60) : `${value} sessions`,
                                    name === 'hours' ? 'Study Time' : 'Sessions'
                                ]}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="hours" 
                                stroke="#6366F1" 
                                fillOpacity={1} 
                                fill="url(#colorHours)" 
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Study Technique Breakdown */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Brain className="w-5 h-5 text-purple-600" />
                        Study Technique Breakdown
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Technique Cards */}
                        <div className="space-y-3">
                            {techniqueBreakdown.map((technique) => {
                                const Icon = technique.icon;
                                const percentage = totalStudyMinutes > 0 
                                    ? Math.round((technique.minutes / totalStudyMinutes) * 100) 
                                    : 0;
                                
                                return (
                                    <div key={technique.name} className="p-4 bg-secondary/50 rounded-xl">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-3">
                                                <div 
                                                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                                                    style={{ backgroundColor: `${technique.color}20` }}
                                                >
                                                    <Icon className="w-5 h-5" style={{ color: technique.color }} />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-foreground">{technique.name}</p>
                                                    <p className="text-xs text-muted-foreground">{technique.sessions} sessions</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-foreground">{formatDuration(technique.minutes)}</p>
                                                <p className="text-xs text-muted-foreground">{percentage}% of total</p>
                                            </div>
                                        </div>
                                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                            <div 
                                                className="h-full rounded-full transition-all duration-500"
                                                style={{ 
                                                    width: `${percentage}%`,
                                                    backgroundColor: technique.color
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Bar Chart */}
                        <div>
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart 
                                    data={techniqueBreakdown.filter(t => t.minutes > 0)} 
                                    layout="vertical"
                                    margin={{ left: 20, right: 20 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                    <XAxis type="number" tick={{ fontSize: 12 }} />
                                    <YAxis 
                                        type="category" 
                                        dataKey="name" 
                                        tick={{ fontSize: 11 }}
                                        width={100}
                                    />
                                    <Tooltip 
                                        contentStyle={{ 
                                            backgroundColor: 'white', 
                                            border: '1px solid #E5E7EB',
                                            borderRadius: '8px'
                                        }}
                                        formatter={(value, name, props) => [
                                            formatDuration(value),
                                            'Study Time'
                                        ]}
                                    />
                                    <Bar 
                                        dataKey="minutes" 
                                        radius={[0, 6, 6, 0]}
                                        fill="#6366F1"
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Total Summary */}
                    <div className="mt-4 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-indigo-700">Total Study Time</p>
                                <p className="text-2xl font-bold text-indigo-900">{formatDuration(totalStudyMinutes)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-medium text-indigo-700">Total Sessions</p>
                                <p className="text-2xl font-bold text-indigo-900">
                                    {techniqueBreakdown.reduce((sum, t) => sum + t.sessions, 0)}
                                </p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Quiz Performance Over Time */}
            {quizTrendData.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-purple-600" />
                            Quiz Performance Trend
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={quizTrendData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                <XAxis 
                                    dataKey="name" 
                                    tick={{ fontSize: 12 }}
                                />
                                <YAxis 
                                    domain={[0, 100]} 
                                    tick={{ fontSize: 12 }}
                                    label={{ value: 'Score (%)', angle: -90, position: 'insideLeft' }}
                                />
                                <Tooltip 
                                    contentStyle={{ 
                                        backgroundColor: 'white', 
                                        border: '1px solid #E5E7EB',
                                        borderRadius: '8px'
                                    }}
                                    formatter={(value) => [`${value}%`, 'Score']}
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="score" 
                                    stroke="#8B5CF6" 
                                    strokeWidth={3}
                                    dot={{ r: 4, fill: '#8B5CF6' }}
                                    activeDot={{ r: 6 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            {/* Recommendations */}
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200">
                <CardHeader>
                    <CardTitle>Recommendations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {/* Study Consistency */}
                    <div className="flex items-start gap-3 p-3 bg-surface rounded-lg">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                        <div>
                            <p className="font-semibold text-foreground">Study Consistency</p>
                            <p className="text-sm text-muted-foreground">
                                {consistency >= 70 
                                    ? "Excellent! You're maintaining a consistent study schedule."
                                    : consistency >= 50
                                    ? "Good progress, but try to study more regularly for better results."
                                    : "Your study schedule needs more consistency. Aim to study at least 5 days a week."}
                            </p>
                        </div>
                    </div>

                    {/* Performance Trend */}
                    {perfTrend && (
                        <div className="flex items-start gap-3 p-3 bg-surface rounded-lg">
                            <div className={`w-2 h-2 rounded-full mt-2 ${perfTrend.improving ? 'bg-green-500' : 'bg-orange-500'}`}></div>
                            <div>
                                <p className="font-semibold text-foreground">Performance</p>
                                <p className="text-sm text-muted-foreground">
                                    {perfTrend.improving
                                        ? `Great work! Your quiz scores have improved by ${perfTrend.change}%. Keep up the momentum!`
                                        : `Your scores have dropped by ${Math.abs(perfTrend.change)}%. Consider reviewing weak topics and adjusting your study methods.`}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Subject Balance Recommendation */}
                    {(() => {
                        const subjectHours = {};
                        data.techniques.forEach(s => {
                            if (s.subject) {
                                subjectHours[s.subject] = (subjectHours[s.subject] || 0) + (s.session_duration || 0);
                            }
                        });
                        (data.activeRecall || []).forEach(s => {
                            if (s.subject_name) {
                                subjectHours[s.subject_name] = (subjectHours[s.subject_name] || 0) + (s.session_duration || 0);
                            }
                        });
                        (data.blurting || []).forEach(s => {
                            if (s.subject_name) {
                                subjectHours[s.subject_name] = (subjectHours[s.subject_name] || 0) + (s.session_duration || 0);
                            }
                        });

                        const subjects = Object.entries(subjectHours);
                        if (subjects.length < 2) return null;

                        const total = subjects.reduce((sum, [, mins]) => sum + mins, 0);
                        if (total === 0) return null;

                        const sorted = subjects.sort((a, b) => b[1] - a[1]);
                        const highest = sorted[0];
                        const lowest = sorted[sorted.length - 1];
                        
                        const highestPercent = Math.round((highest[1] / total) * 100);
                        const lowestPercent = Math.round((lowest[1] / total) * 100);

                        // Only show if there's a significant imbalance (top subject > 50% or lowest < 10%)
                        if (highestPercent <= 50 && lowestPercent >= 10) return null;

                        return (
                            <div className="flex items-start gap-3 p-3 bg-surface rounded-lg">
                                <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                                <div>
                                    <p className="font-semibold text-foreground">Balance Your Subjects</p>
                                    <p className="text-sm text-muted-foreground">
                                        {highestPercent > 50 
                                            ? `You're spending ${highestPercent}% of your time on ${highest[0]}. Consider distributing your study time more evenly across subjects.`
                                            : `${lowest[0]} is getting very little attention (only ${lowestPercent}% of your study time). Try to allocate more sessions to this subject.`
                                        }
                                    </p>
                                </div>
                            </div>
                        );
                    })()}
                </CardContent>
            </Card>
        </div>
    );
}