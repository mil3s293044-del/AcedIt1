import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Brain, Clock, Target, TrendingUp, BookOpen, Zap, Calendar, Award } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

export default function StudyRecommendations({ data, userProfile, user }) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [aiRecommendations, setAiRecommendations] = useState(null);
    const { toast } = useToast();

    // Generate personalized recommendations
    const getRecommendations = () => {
        const recommendations = [];

        // Calculate overall stats
        const totalStudyTime = data.techniques.reduce((sum, t) => sum + (t.session_duration || 0), 0);
        const avgSessionLength = data.techniques.length > 0 
            ? totalStudyTime / data.techniques.length 
            : 0;
        
        const techniqueUsage = {
            pomodoro: data.techniques.filter(t => t.technique_name === 'pomodoro').length,
            spaced_repetition: data.flashcards.filter(f => f.totalReviews > 0).length,
            active_recall: data.activeRecall.length,
            blurting: data.blurting.length
        };

        // Recommendation 1: Session length optimization
        if (avgSessionLength > 0) {
            if (avgSessionLength < 20) {
                recommendations.push({
                    title: "Increase Session Length",
                    description: "Your average session is only " + Math.round(avgSessionLength) + " minutes. Try extending to 25-30 minutes for better focus and retention.",
                    icon: Clock,
                    color: "text-blue-600",
                    bgColor: "bg-blue-50",
                    priority: "high",
                    action: "Use the Pomodoro Timer for structured 25-minute sessions"
                });
            } else if (avgSessionLength > 90) {
                recommendations.push({
                    title: "Take More Breaks",
                    description: "Your sessions average " + Math.round(avgSessionLength) + " minutes. Long sessions without breaks can reduce effectiveness. Try the Pomodoro technique.",
                    icon: Clock,
                    color: "text-orange-600",
                    bgColor: "bg-orange-50",
                    priority: "medium",
                    action: "Break study into 25-50 minute chunks with 5-10 minute breaks"
                });
            }
        }

        // Recommendation 2: Technique diversity
        const usedTechniques = Object.values(techniqueUsage).filter(v => v > 0).length;
        if (usedTechniques < 2) {
            recommendations.push({
                title: "Diversify Study Techniques",
                description: "You're only using " + usedTechniques + " study technique(s). Research shows using multiple methods improves retention.",
                icon: Brain,
                color: "text-purple-600",
                bgColor: "bg-purple-50",
                priority: "high",
                action: "Try Active Recall or Spaced Repetition this week"
            });
        }

        // Recommendation 3: Spaced repetition usage
        if (techniqueUsage.spaced_repetition === 0 && data.subjects.length > 0) {
            recommendations.push({
                title: "Start Using Flashcards",
                description: "You haven't created any flashcards yet. Spaced repetition is one of the most effective study methods.",
                icon: Brain,
                color: "text-purple-600",
                bgColor: "bg-purple-50",
                priority: "high",
                action: "Create 10-15 flashcards for your weakest topic"
            });
        }

        // Recommendation 4: Quiz performance
        if (data.quizzes.length > 0) {
            const avgQuizScore = data.quizzes.reduce((sum, q) => sum + q.score, 0) / data.quizzes.length;
            if (avgQuizScore < 70) {
                recommendations.push({
                    title: "Focus on Active Recall",
                    description: "Your quiz average is " + Math.round(avgQuizScore) + "%. Active recall can help identify knowledge gaps.",
                    icon: Target,
                    color: "text-red-600",
                    bgColor: "bg-red-50",
                    priority: "high",
                    action: "Practice 3 Active Recall sessions on weak topics this week"
                });
            }
        }

        // Recommendation 5: Study consistency
        const uniqueStudyDays = [...new Set(data.techniques.map(t => t.date))].length;
        if (uniqueStudyDays < 5) {
            recommendations.push({
                title: "Improve Study Consistency",
                description: "You've only studied on " + uniqueStudyDays + " days recently. Consistent daily practice is more effective than cramming.",
                icon: Calendar,
                color: "text-indigo-600",
                bgColor: "bg-indigo-50",
                priority: "high",
                action: "Aim for at least 30 minutes of study every day"
            });
        }

        // Recommendation 6: Time management
        if (userProfile?.goal_atar && totalStudyTime < 300) { // Less than 5 hours per week
            recommendations.push({
                title: "Increase Study Time",
                description: "With your ATAR goal of " + userProfile.goal_atar + ", you should aim for at least 2-3 hours of study per day.",
                icon: TrendingUp,
                color: "text-green-600",
                bgColor: "bg-green-50",
                priority: "medium",
                action: "Schedule dedicated study blocks in your calendar"
            });
        }

        // Recommendation 7: Subject balance
        const subjectTime = {};
        data.techniques.forEach(t => {
            if (t.subject) {
                subjectTime[t.subject] = (subjectTime[t.subject] || 0) + (t.session_duration || 0);
            }
        });
        
        const subjects = Object.keys(subjectTime);
        if (subjects.length > 1) {
            const times = Object.values(subjectTime);
            const maxTime = Math.max(...times);
            const minTime = Math.min(...times);
            
            if (maxTime > minTime * 3) {
                recommendations.push({
                    title: "Balance Subject Study Time",
                    description: "You're spending significantly more time on some subjects. Try to distribute your time more evenly.",
                    icon: BookOpen,
                    color: "text-blue-600",
                    bgColor: "bg-blue-50",
                    priority: "medium",
                    action: "Dedicate specific days to different subjects"
                });
            }
        }

        // Recommendation 8: Confidence tracking
        const lowConfidenceSessions = data.techniques.filter(t => t.confidence_rating && t.confidence_rating < 3);
        if (lowConfidenceSessions.length > data.techniques.length * 0.3) {
            recommendations.push({
                title: "Address Low Confidence Areas",
                description: "You've rated " + lowConfidenceSessions.length + " sessions with low confidence. These need extra attention.",
                icon: Award,
                color: "text-orange-600",
                bgColor: "bg-orange-50",
                priority: "high",
                action: "Review and practice the topics where you felt least confident"
            });
        }

        return recommendations.sort((a, b) => {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
    };

    const recommendations = getRecommendations();

    const handleGenerateAI = async () => {
        setIsGenerating(true);
        try {
            const studySummary = {
                totalHours: Math.round(data.techniques.reduce((sum, t) => sum + (t.session_duration || 0), 0) / 60),
                techniques: {
                    pomodoro: data.techniques.filter(t => t.technique_name === 'pomodoro').length,
                    flashcards: data.flashcards.length,
                    activeRecall: data.activeRecall.length,
                    blurting: data.blurting.length
                },
                avgQuizScore: data.quizzes.length > 0 
                    ? Math.round(data.quizzes.reduce((sum, q) => sum + q.score, 0) / data.quizzes.length)
                    : null,
                subjects: data.subjects.map(s => s.subject_name),
                goalATAR: userProfile?.goal_atar,
                yearLevel: userProfile?.year_level
            };

            const prompt = `As a VCE study advisor, analyze this student's study data and provide 5 specific, actionable recommendations to improve their performance:

Study Summary:
- Total Study Time: ${studySummary.totalHours} hours
- Study Techniques Used: ${Object.entries(studySummary.techniques).filter(([_, v]) => v > 0).map(([k, v]) => `${k} (${v})`).join(', ')}
- Average Quiz Score: ${studySummary.avgQuizScore || 'No quizzes taken'}%
- Subjects: ${studySummary.subjects.join(', ')}
- Goal ATAR: ${studySummary.goalATAR || 'Not set'}
- Year Level: ${studySummary.yearLevel || 'Not specified'}

Please provide:
1. Top 5 personalized recommendations with specific actions
2. Explain WHY each recommendation will help
3. Provide concrete examples or strategies
4. Consider their goal ATAR and current performance

Format as clear, numbered recommendations.`;

            const response = await base44.integrations.Core.InvokeLLM({ prompt });
            setAiRecommendations(response);
            toast({ title: "AI Recommendations Generated! 🤖" });
        } catch (error) {
            console.error("Error generating AI recommendations:", error);
            toast({ title: "Failed to generate AI recommendations", variant: "destructive" });
        } finally {
            setIsGenerating(false);
        }
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'high': return 'bg-red-100 text-red-800';
            case 'medium': return 'bg-orange-100 text-orange-800';
            default: return 'bg-blue-100 text-blue-800';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header with AI Button */}
            <Card className="bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 text-white border-0">
                <CardContent className="p-8">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
                                <Sparkles className="w-8 h-8" />
                                Personalized Study Recommendations
                            </h2>
                            <p className="text-white/90 text-lg mb-4">
                                AI-powered insights based on your study patterns and performance
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={handleGenerateAI}
                        disabled={isGenerating}
                        className="bg-white text-purple-600 hover:bg-white/90 font-semibold"
                        size="lg"
                    >
                        {isGenerating ? (
                            <>
                                <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                                Generating...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-5 h-5 mr-2" />
                                Generate AI Recommendations
                            </>
                        )}
                    </Button>
                </CardContent>
            </Card>

            {/* AI Generated Recommendations */}
            {aiRecommendations && (
                <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-purple-600" />
                            AI Study Coach Recommendations
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="prose prose-sm max-w-none bg-white rounded-lg p-6">
                            <div className="whitespace-pre-wrap">{aiRecommendations}</div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Smart Recommendations */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {recommendations.map((rec, index) => {
                    const Icon = rec.icon;
                    return (
                        <Card key={index} className="hover:shadow-xl transition-all duration-300 border-2">
                            <CardHeader>
                                <div className="flex items-start justify-between mb-2">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${rec.bgColor}`}>
                                        <Icon className={`w-6 h-6 ${rec.color}`} />
                                    </div>
                                    <Badge className={getPriorityColor(rec.priority)}>
                                        {rec.priority.toUpperCase()}
                                    </Badge>
                                </div>
                                <CardTitle className="text-lg">{rec.title}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <p className="text-gray-600">{rec.description}</p>
                                <div className="p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-100">
                                    <p className="text-sm font-semibold text-indigo-900 mb-1">Action Step:</p>
                                    <p className="text-sm text-indigo-700">{rec.action}</p>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* General Study Tips */}
            <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-blue-600" />
                        Evidence-Based Study Tips
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-white rounded-lg">
                        <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                            <span className="text-2xl">🧠</span>
                            Spaced Repetition
                        </h4>
                        <p className="text-sm text-gray-600">
                            Review material at increasing intervals (1 day, 3 days, 1 week, 1 month) for optimal retention.
                        </p>
                    </div>
                    
                    <div className="p-4 bg-white rounded-lg">
                        <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                            <span className="text-2xl">⏰</span>
                            Pomodoro Technique
                        </h4>
                        <p className="text-sm text-gray-600">
                            Work in 25-minute focused bursts with 5-minute breaks. This maintains concentration and prevents burnout.
                        </p>
                    </div>

                    <div className="p-4 bg-white rounded-lg">
                        <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                            <span className="text-2xl">✍️</span>
                            Active Recall
                        </h4>
                        <p className="text-sm text-gray-600">
                            Test yourself without looking at notes. This strengthens memory more than passive reading.
                        </p>
                    </div>

                    <div className="p-4 bg-white rounded-lg">
                        <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                            <span className="text-2xl">🎯</span>
                            Interleaving
                        </h4>
                        <p className="text-sm text-gray-600">
                            Mix different subjects or topics in one session rather than blocking similar content together.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}