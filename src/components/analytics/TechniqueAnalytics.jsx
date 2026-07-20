import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, Brain, Zap, FileText, TrendingUp, Award, HelpCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const TECHNIQUE_COLORS = {
    pomodoro: "#10B981",
    spaced_repetition: "#8B5CF6",
    active_recall: "#F59E0B",
    blurting: "#3B82F6",
    quizzes: "#EC4899"
};

const TECHNIQUE_ICONS = {
    pomodoro: Clock,
    spaced_repetition: Brain,
    active_recall: Zap,
    blurting: FileText,
    quizzes: HelpCircle
};

export default function TechniqueAnalytics({ data }) {
    // Calculate stats for each technique
    const pomodoroSessions = data.techniques.filter(t => t.technique_name === "pomodoro");
    const spacedRepSessions = data.flashcards;
    const activeRecallSessions = data.activeRecall;
    const blurtingSessions = data.blurting;
    const quizSessions = data.quizzes || [];

    const techniqueStats = [
        {
            name: "Pomodoro Timer",
            key: "pomodoro",
            sessions: pomodoroSessions.length,
            totalMinutes: pomodoroSessions.reduce((sum, s) => sum + (s.session_duration || 0), 0),
            avgConfidence: pomodoroSessions.length > 0 
                ? Math.round(pomodoroSessions.reduce((sum, s) => sum + (s.confidence_rating || 3), 0) / pomodoroSessions.length * 10) / 10
                : 0,
            subjects: [...new Set(pomodoroSessions.map(s => s.subject))].length
        },
        {
            name: "Spaced Repetition",
            key: "spaced_repetition",
            sessions: spacedRepSessions.filter(f => f.total_reviews > 0).length,
            totalMinutes: spacedRepSessions.length * 2, // Estimate 2 min per card
            avgConfidence: spacedRepSessions.length > 0
                ? Math.round((spacedRepSessions.filter(f => ((f.review_count_good || 0) + (f.review_count_easy || 0)) > 2).length / spacedRepSessions.length) * 100)
                : 0,
            subjects: [...new Set(spacedRepSessions.map(s => s.subject_name))].length
        },
        {
            name: "Active Recall",
            key: "active_recall",
            sessions: activeRecallSessions.length,
            totalMinutes: activeRecallSessions.reduce((sum, s) => sum + (s.session_duration || 0), 0),
            avgConfidence: activeRecallSessions.length > 0
                ? Math.round(activeRecallSessions.reduce((sum, s) => sum + (s.questions?.length || 0), 0) / activeRecallSessions.length * 10)
                : 0,
            subjects: [...new Set(activeRecallSessions.map(s => s.subject_name))].length
        },
        {
            name: "Blurting Method",
            key: "blurting",
            sessions: blurtingSessions.length,
            totalMinutes: blurtingSessions.reduce((sum, s) => sum + (s.session_duration || 0), 0),
            avgConfidence: blurtingSessions.length > 0
                ? Math.round(blurtingSessions.reduce((sum, s) => sum + (s.blurted_text?.length || 0), 0) / blurtingSessions.length / 100)
                : 0,
            subjects: [...new Set(blurtingSessions.map(s => s.subject_name))].length
        },
        {
            name: "Quizzes",
            key: "quizzes",
            sessions: quizSessions.length,
            totalMinutes: Math.round(quizSessions.reduce((sum, q) => sum + ((q.time_taken || 0) / 60), 0)),
            avgConfidence: quizSessions.length > 0
                ? Math.round(quizSessions.reduce((sum, q) => sum + (q.score || 0), 0) / quizSessions.length)
                : 0,
            subjects: quizSessions.length, // Show total quizzes taken
            isQuiz: true
        }
    ];

    // Data for bar chart
    const chartData = techniqueStats.map(stat => ({
        name: stat.name,
        hours: Math.round(stat.totalMinutes / 60 * 10) / 10,
        sessions: stat.sessions
    }));

    // Data for pie chart
    const pieData = techniqueStats
        .filter(stat => stat.totalMinutes > 0)
        .map(stat => ({
            name: stat.name,
            value: stat.totalMinutes,
            color: TECHNIQUE_COLORS[stat.key]
        }));

    return (
        <div className="space-y-6">
            {/* Technique Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {techniqueStats.map((stat, index) => {
                    const Icon = TECHNIQUE_ICONS[stat.key];
                    return (
                        <motion.div
                            key={stat.key}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <Card className="hover:shadow-xl transition-all duration-300">
                                <CardHeader>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div 
                                            className="w-10 h-10 rounded-xl flex items-center justify-center"
                                            style={{ backgroundColor: `${TECHNIQUE_COLORS[stat.key]}20` }}
                                        >
                                            <Icon className="w-5 h-5" style={{ color: TECHNIQUE_COLORS[stat.key] }} />
                                        </div>
                                        <CardTitle className="text-lg">{stat.name}</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <div className="flex items-center justify-between text-sm mb-2">
                                            <span className="text-muted-foreground">{stat.isQuiz ? 'Quizzes Taken' : 'Sessions'}</span>
                                            <span className="font-bold text-foreground">{stat.sessions}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm mb-2">
                                            <span className="text-muted-foreground">Study Time</span>
                                            <span className="font-bold text-foreground">
                                                {stat.totalMinutes >= 60 
                                                    ? `${Math.round(stat.totalMinutes / 60 * 10) / 10}h` 
                                                    : `${stat.totalMinutes}m`}
                                            </span>
                                        </div>
                                        {!stat.isQuiz && (
                                            <div className="flex items-center justify-between text-sm mb-2">
                                                <span className="text-muted-foreground">Subjects</span>
                                                <span className="font-bold text-foreground">{stat.subjects}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between text-sm mb-2">
                                            <span className="text-muted-foreground">
                                                {stat.key === 'spaced_repetition' || stat.key === 'quizzes' ? 'Avg Score' : 'Performance'}
                                            </span>
                                            <span className="font-bold" style={{ color: TECHNIQUE_COLORS[stat.key] }}>
                                                {stat.avgConfidence}{stat.key === 'spaced_repetition' || stat.key === 'quizzes' ? '%' : '/5'}
                                            </span>
                                        </div>
                                        <Progress 
                                            value={stat.key === 'spaced_repetition' || stat.key === 'quizzes' ? stat.avgConfidence : (stat.avgConfidence / 5) * 100} 
                                            className="h-2"
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    );
                })}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bar Chart - Study Hours */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-indigo-600" />
                            Study Hours by Technique
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                <XAxis 
                                    dataKey="name" 
                                    tick={{ fontSize: 12 }}
                                    angle={-45}
                                    textAnchor="end"
                                    height={80}
                                />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip 
                                    contentStyle={{ 
                                        backgroundColor: 'white', 
                                        border: '1px solid #E5E7EB',
                                        borderRadius: '8px'
                                    }}
                                />
                                <Bar dataKey="hours" fill="#6366F1" radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Pie Chart - Time Distribution */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Award className="w-5 h-5 text-purple-600" />
                            Time Distribution
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {pieData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        outerRadius={100}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        contentStyle={{ 
                                            backgroundColor: 'white', 
                                            border: '1px solid #E5E7EB',
                                            borderRadius: '8px'
                                        }}
                                        formatter={(value) => `${Math.round(value / 60)} hours`}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                                No data available for this period
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Insights */}
            <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Brain className="w-5 h-5 text-indigo-600" />
                        Technique Insights
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {techniqueStats
                        .sort((a, b) => b.totalMinutes - a.totalMinutes)
                        .slice(0, 3)
                        .map((stat, index) => (
                            <div key={stat.key} className="flex items-center gap-3 p-3 bg-surface rounded-lg">
                                <Badge className="text-lg font-bold">{index + 1}</Badge>
                                <div className="flex-1">
                                    <p className="font-semibold text-foreground">{stat.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {stat.sessions} sessions • {Math.round(stat.totalMinutes / 60)}h total
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-semibold" style={{ color: TECHNIQUE_COLORS[stat.key] }}>
                                        Most Used
                                    </p>
                                </div>
                            </div>
                        ))}
                </CardContent>
            </Card>
        </div>
    );
}