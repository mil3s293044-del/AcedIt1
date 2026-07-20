import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Clock, Target, ChevronRight, ArrowLeft, Calendar, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from "date-fns";

// Helper function to format minutes into hours and minutes
const formatDuration = (minutes) => {
    if (!minutes || minutes === 0) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
};

export default function SubjectPerformance({ data }) {
    const [selectedSubject, setSelectedSubject] = useState(null);
    
    const userSubjects = data.subjects || [];
    
    const getSubjectMetrics = () => {
        if (userSubjects.length === 0) return [];

        const subjectMap = {};
        userSubjects.forEach(sub => {
            subjectMap[sub.subject_name] = {
                name: sub.subject_name,
                code: sub.subject_code,
                color: sub.color || '#6366F1',
                targetScore: sub.goal_study_score || null,
                studyTime: 0,
                sessions: 0,
                flashcards: 0,
                flashcardsMastered: 0,
                sessionDates: [],
                quizScores: [],
                quizDates: []
            };
        });

        // Process study technique sessions
        data.techniques.forEach(session => {
            if (!session.subject || !subjectMap[session.subject]) return;
            subjectMap[session.subject].studyTime += session.session_duration || 0;
            subjectMap[session.subject].sessions += 1;
            if (session.date) subjectMap[session.subject].sessionDates.push(session.date);
        });

        // Process Active Recall sessions
        (data.activeRecall || []).forEach(session => {
            if (!session.subject_name || !subjectMap[session.subject_name]) return;
            subjectMap[session.subject_name].studyTime += session.session_duration || 0;
            subjectMap[session.subject_name].sessions += 1;
            if (session.date) subjectMap[session.subject_name].sessionDates.push(session.date);
        });

        // Process Blurting sessions
        (data.blurting || []).forEach(session => {
            if (!session.subject_name || !subjectMap[session.subject_name]) return;
            subjectMap[session.subject_name].studyTime += session.session_duration || 0;
            subjectMap[session.subject_name].sessions += 1;
            if (session.date) subjectMap[session.subject_name].sessionDates.push(session.date);
        });

        // Process flashcards
        data.flashcards.forEach(card => {
            if (!card.subject_name || !subjectMap[card.subject_name]) return;
            subjectMap[card.subject_name].flashcards += 1;
            if (((card.review_count_good || 0) + (card.review_count_easy || 0)) >= 3) {
                subjectMap[card.subject_name].flashcardsMastered += 1;
            }
        });

        // Process quizzes - match by subject name in quiz title
        (data.quizzes || []).forEach(quiz => {
            const quizSubject = quiz.quiz_title?.split('-')[0]?.trim();
            Object.keys(subjectMap).forEach(subjectName => {
                if (quizSubject && subjectName.toLowerCase().includes(quizSubject.toLowerCase())) {
                    const score = quiz.adjusted_score ?? quiz.score;
                    subjectMap[subjectName].quizScores.push(score);
                    if (quiz.date) subjectMap[subjectName].quizDates.push({ date: quiz.date, score });
                }
            });
        });

        return Object.values(subjectMap).map(subject => {
            const totalMinutes = subject.studyTime;
            const avgQuizScore = subject.quizScores.length > 0 
                ? Math.round(subject.quizScores.reduce((a, b) => a + b, 0) / subject.quizScores.length)
                : null;
            
            // Calculate study frequency (unique days studied)
            const uniqueDays = new Set(subject.sessionDates).size;

            return {
                ...subject,
                totalMinutes,
                avgQuizScore,
                uniqueDays
            };
        }).sort((a, b) => b.totalMinutes - a.totalMinutes);
    };

    const subjectMetrics = getSubjectMetrics();

    // Chart data
    const chartData = subjectMetrics.map(subject => ({
        name: subject.name.length > 10 ? subject.name.substring(0, 10) + '...' : subject.name,
        minutes: subject.totalMinutes,
        fill: subject.color
    }));

    if (subjectMetrics.length === 0) {
        return (
            <Card>
                <CardContent className="p-12 text-center">
                    <BookOpen className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-foreground mb-2">No Subjects Added</h3>
                    <p className="text-muted-foreground">Add subjects in the Subjects section to see performance analytics</p>
                </CardContent>
            </Card>
        );
    }

    // Detail view for selected subject
    if (selectedSubject) {
        const subject = subjectMetrics.find(s => s.name === selectedSubject);
        if (!subject) return null;

        return (
            <div className="space-y-6">
                <Button 
                    variant="ghost" 
                    onClick={() => setSelectedSubject(null)}
                    className="gap-2 text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to All Subjects
                </Button>

                <Card className="border-t-4" style={{ borderTopColor: subject.color }}>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-2xl">{subject.name}</CardTitle>
                                {subject.targetScore && (
                                    <p className="text-muted-foreground mt-1">Target Study Score: {subject.targetScore}/50</p>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                            <div className="text-center p-4 bg-blue-50 rounded-xl">
                                <Clock className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                                <p className="text-2xl font-bold text-foreground">{formatDuration(subject.totalMinutes)}</p>
                                <p className="text-sm text-muted-foreground">Total Study Time</p>
                            </div>
                            <div className="text-center p-4 bg-purple-50 rounded-xl">
                                <Target className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                                <p className="text-2xl font-bold text-foreground">{subject.sessions}</p>
                                <p className="text-sm text-muted-foreground">Study Sessions</p>
                            </div>
                            <div className="text-center p-4 bg-green-50 rounded-xl">
                                <Calendar className="w-6 h-6 text-green-600 mx-auto mb-2" />
                                <p className="text-2xl font-bold text-foreground">{subject.uniqueDays}</p>
                                <p className="text-sm text-muted-foreground">Days Studied</p>
                            </div>
                            <div className="text-center p-4 bg-orange-50 rounded-xl">
                                <TrendingUp className="w-6 h-6 text-orange-600 mx-auto mb-2" />
                                <p className="text-2xl font-bold text-foreground">
                                    {subject.avgQuizScore !== null ? `${subject.avgQuizScore}%` : '-'}
                                </p>
                                <p className="text-sm text-muted-foreground">Avg Quiz Score</p>
                            </div>
                        </div>

                        {/* Quiz History */}
                        {subject.quizDates.length > 0 && (
                            <div className="mb-6">
                                <h4 className="font-semibold text-foreground mb-3">Quiz Performance</h4>
                                <div className="space-y-2">
                                    {subject.quizDates.slice(-5).reverse().map((quiz, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                                            <span className="text-sm text-muted-foreground">
                                                {format(new Date(quiz.date), 'MMM d, yyyy')}
                                            </span>
                                            <span className={`font-semibold ${
                                                quiz.score >= 80 ? 'text-green-600' :
                                                quiz.score >= 60 ? 'text-yellow-600' :
                                                'text-red-600'
                                            }`}>
                                                {quiz.score}%
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Flashcards */}
                        {subject.flashcards > 0 && (
                            <div>
                                <h4 className="font-semibold text-foreground mb-3">Flashcards</h4>
                                <div className="flex items-center gap-4 p-4 bg-purple-50 rounded-lg">
                                    <div className="flex-1">
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className="text-muted-foreground">Mastered</span>
                                            <span className="font-semibold">{subject.flashcardsMastered} / {subject.flashcards}</span>
                                        </div>
                                        <div className="h-2 bg-purple-100 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-purple-500 rounded-full"
                                                style={{ width: `${(subject.flashcardsMastered / subject.flashcards) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Main grid view
    return (
        <div className="space-y-6">
            {/* Subject Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {subjectMetrics.map((subject) => (
                    <Card 
                        key={subject.name} 
                        className="cursor-pointer hover:shadow-lg transition-all duration-200 group border-l-4"
                        style={{ borderLeftColor: subject.color }}
                        onClick={() => setSelectedSubject(subject.name)}
                    >
                        <CardContent className="p-5">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-foreground truncate">{subject.name}</h3>
                                    {subject.targetScore && (
                                        <p className="text-xs text-muted-foreground">Target: {subject.targetScore}/50</p>
                                    )}
                                </div>
                                <ChevronRight className="w-5 h-5 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <p className="text-xl font-bold text-foreground">{formatDuration(subject.totalMinutes)}</p>
                                    <p className="text-xs text-muted-foreground">Study Time</p>
                                </div>
                                <div>
                                    <p className="text-xl font-bold text-foreground">{subject.sessions}</p>
                                    <p className="text-xs text-muted-foreground">Sessions</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Study Time Chart */}
            {chartData.some(d => d.minutes > 0) && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <TrendingUp className="w-5 h-5 text-indigo-600" />
                            Study Time Distribution
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `${Math.round(value / 60)}h`} />
                                <Tooltip 
                                    contentStyle={{ 
                                        backgroundColor: 'white', 
                                        border: '1px solid #E5E7EB',
                                        borderRadius: '8px'
                                    }}
                                    formatter={(value) => [formatDuration(value), 'Study Time']}
                                />
                                <Bar dataKey="minutes" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}