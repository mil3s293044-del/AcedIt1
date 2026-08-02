import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, TrendingDown, BookOpen, Brain, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function WeakTopics({ data }) {
    // Identify weak topics from different sources
    const getWeakTopics = () => {
        const topics = [];

        // From flashcards - low success rate
        const flashcardTopics = {};
        data.flashcards.forEach(card => {
            const key = `${card.subject_name}:${card.topic}`;
            if (!flashcardTopics[key]) {
                flashcardTopics[key] = {
                    subject: card.subject_name,
                    topic: card.topic,
                    total: 0,
                    successful: 0,
                    type: 'flashcards'
                };
            }
            flashcardTopics[key].total += card.total_reviews || 0;
            flashcardTopics[key].successful += (card.review_count_good || 0) + (card.review_count_easy || 0);
        });

        Object.values(flashcardTopics).forEach(topic => {
            if (topic.total >= 3) { // Only consider if reviewed at least 3 times
                const successRate = (topic.successful / topic.total) * 100;
                if (successRate < 60) {
                    topics.push({
                        ...topic,
                        score: Math.round(successRate),
                        reason: 'Low flashcard retention rate',
                        severity: successRate < 40 ? 'high' : 'medium'
                    });
                }
            }
        });

        // From study sessions - low confidence ratings
        const sessionTopics = {};
        data.techniques.forEach(session => {
            if (!session.topic || !session.confidence_rating) return;
            const key = `${session.subject}:${session.topic}`;
            if (!sessionTopics[key]) {
                sessionTopics[key] = {
                    subject: session.subject,
                    topic: session.topic,
                    ratings: [],
                    type: 'sessions'
                };
            }
            sessionTopics[key].ratings.push(session.confidence_rating);
        });

        Object.values(sessionTopics).forEach(topic => {
            if (topic.ratings.length >= 2) {
                const avgRating = topic.ratings.reduce((a, b) => a + b, 0) / topic.ratings.length;
                if (avgRating < 3) {
                    topics.push({
                        ...topic,
                        score: Math.round((avgRating / 5) * 100),
                        reason: 'Low confidence in study sessions',
                        severity: avgRating < 2 ? 'high' : 'medium'
                    });
                }
            }
        });

        // From active recall - topics with many questions wrong
        const recallTopics = {};
        data.activeRecall.forEach(session => {
            const key = `${session.subject_name}:${session.topic}`;
            if (!recallTopics[key]) {
                recallTopics[key] = {
                    subject: session.subject_name,
                    topic: session.topic,
                    sessions: 0,
                    type: 'active_recall'
                };
            }
            recallTopics[key].sessions += 1;
        });

        Object.values(recallTopics).forEach(topic => {
            if (topic.sessions >= 3) {
                topics.push({
                    ...topic,
                    score: Math.max(30, 100 - (topic.sessions * 10)), // More sessions might indicate difficulty
                    reason: 'Repeated active recall practice needed',
                    severity: 'medium'
                });
            }
        });

        // Remove duplicates and sort by severity and score
        const uniqueTopics = [];
        const seen = new Set();
        
        topics.forEach(topic => {
            const key = `${topic.subject}:${topic.topic}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueTopics.push(topic);
            }
        });

        return uniqueTopics.sort((a, b) => {
            if (a.severity !== b.severity) {
                return a.severity === 'high' ? -1 : 1;
            }
            return a.score - b.score;
        });
    };

    const weakTopics = getWeakTopics();

    const getSeverityColor = (severity) => {
        switch (severity) {
            case 'high': return 'bg-red-100 text-red-800 border-red-200';
            case 'medium': return 'bg-orange-100 text-orange-800 border-orange-200';
            default: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        }
    };

    const getSeverityIcon = (severity) => {
        switch (severity) {
            case 'high': return '🔴';
            case 'medium': return '🟡';
            default: return '🟢';
        }
    };

    const getTypeIcon = (type) => {
        switch (type) {
            case 'flashcards': return Brain;
            case 'sessions': return BookOpen;
            case 'active_recall': return Target;
            default: return AlertCircle;
        }
    };

    if (weakTopics.length === 0) {
        return (
            <Card className="border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
                <CardContent className="p-12 text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Target className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-foreground mb-2">Great Job! 🎉</h3>
                    <p className="text-muted-foreground text-lg mb-4">
                        No weak topics identified. You're performing well across all subjects!
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Keep up the consistent study habits and continue reviewing regularly.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Summary Card */}
            <Card className="border-2 border-orange-200 bg-gradient-to-r from-orange-50 to-red-50">
                <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-orange-100 rounded-xl flex items-center justify-center">
                            <AlertCircle className="w-8 h-8 text-orange-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-2xl font-bold text-foreground mb-1">
                                {weakTopics.length} Topics Need Attention
                            </h3>
                            <p className="text-muted-foreground">
                                Focus on these areas to improve your overall performance
                            </p>
                        </div>
                        <div className="text-right">
                            <div className="text-3xl font-bold text-orange-600">
                                {weakTopics.filter(t => t.severity === 'high').length}
                            </div>
                            <div className="text-sm text-muted-foreground">High Priority</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Weak Topics List */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {weakTopics.map((topic, index) => {
                    const TypeIcon = getTypeIcon(topic.type);
                    return (
                        <Card key={`${topic.subject}-${topic.topic}-${index}`} className="hover:shadow-xl transition-all duration-300">
                            <CardHeader>
                                <div className="flex items-start justify-between mb-2">
                                    <Badge className={getSeverityColor(topic.severity)} variant="outline">
                                        {getSeverityIcon(topic.severity)} {topic.severity.toUpperCase()} PRIORITY
                                    </Badge>
                                    <TypeIcon className="w-5 h-5 text-muted-foreground/60" />
                                </div>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <TrendingDown className="w-5 h-5 text-red-500" />
                                    {topic.topic}
                                </CardTitle>
                                <Badge variant="outline" className="w-fit text-xs">
                                    {topic.subject}
                                </Badge>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <div className="flex items-center justify-between text-sm mb-2">
                                        <span className="text-muted-foreground">Performance Score</span>
                                        <span className="font-bold text-red-600">{topic.score}%</span>
                                    </div>
                                    <Progress value={topic.score} className="h-2" />
                                </div>

                                <div className="p-3 bg-secondary/50 rounded-lg">
                                    <p className="text-sm text-muted-foreground">
                                        <span className="font-semibold">Issue:</span> {topic.reason}
                                    </p>
                                </div>

                                <div className="flex gap-2">
                                    <Link to={createPageUrl("Study")} className="flex-1">
                                        <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600" size="sm">
                                            <Brain className="w-4 h-4 mr-2" />
                                            Practice Now
                                        </Button>
                                    </Link>
                                    <Link to={createPageUrl("Subjects")} className="flex-1">
                                        <Button variant="outline" className="w-full" size="sm">
                                            <BookOpen className="w-4 h-4 mr-2" />
                                            Review Material
                                        </Button>
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Action Plan */}
            <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Target className="w-5 h-5 text-blue-600" />
                        Recommended Action Plan
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-start gap-3 p-3 bg-surface rounded-lg">
                        <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs font-bold text-red-600">1</span>
                        </div>
                        <div>
                            <p className="font-semibold text-foreground">Focus on High Priority Topics First</p>
                            <p className="text-sm text-muted-foreground">
                                Start with the {weakTopics.filter(t => t.severity === 'high').length} high-priority topics. Dedicate at least 30 minutes per topic.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-surface rounded-lg">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs font-bold text-blue-600">2</span>
                        </div>
                        <div>
                            <p className="font-semibold text-foreground">Use Active Learning Techniques</p>
                            <p className="text-sm text-muted-foreground">
                                Try the Active Recall or Blurting Method for these topics to identify knowledge gaps.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-surface rounded-lg">
                        <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs font-bold text-green-600">3</span>
                        </div>
                        <div>
                            <p className="font-semibold text-foreground">Review and Test Regularly</p>
                            <p className="text-sm text-muted-foreground">
                                Create flashcards and take practice quizzes to reinforce your understanding.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}