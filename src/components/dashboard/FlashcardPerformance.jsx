import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, TrendingUp, ChevronRight, Award, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Flashcard } from "@/entities/all";
import { format, subDays } from "date-fns";

export default function FlashcardPerformance({ user }) {
    const [performance, setPerformance] = useState({
        totalCards: 0,
        cardsReviewed: 0,
        averageSuccessRate: 0,
        strengths: [],
        weaknesses: [],
        dueToday: 0,
        streak: 0
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (user?.email) {
            loadPerformanceData();
        }
    }, [user]);

    const loadPerformanceData = async () => {
        setIsLoading(true);
        try {
            // Add delay and catch rate limit errors gracefully
            const allCards = await Flashcard.filter({ created_by: user.email, is_active: true }).catch(err => {
                if (err.message?.includes('Rate limit')) {
                    console.log('Rate limit hit - showing cached data');
                    return [];
                }
                throw err;
            });
            const today = format(new Date(), 'yyyy-MM-dd');

            // Calculate overall stats
            const totalCards = allCards.length;
            const reviewedCards = allCards.filter(c => c.total_reviews > 0);
            const cardsReviewedCount = reviewedCards.length;
            
            const avgSuccessRate = cardsReviewedCount > 0
                ? Math.round(
                    (reviewedCards.reduce((sum, c) => 
                        sum + (c.total_reviews > 0 ? (((c.review_count_good || 0) + (c.review_count_easy || 0)) / c.total_reviews) : 0), 0
                    ) / cardsReviewedCount) * 100
                )
                : 0;

            // Calculate due cards
            const dueCards = allCards.filter(c => c.next_review_date && c.next_review_date <= today).length;

            // Group by subject and calculate performance
            const subjectPerformance = {};
            allCards.forEach(card => {
                const subject = card.subject_name;
                if (!subjectPerformance[subject]) {
                    subjectPerformance[subject] = {
                        name: subject,
                        cards: [],
                        totalReviews: 0,
                        successfulReviews: 0
                    };
                }
                subjectPerformance[subject].cards.push(card);
                subjectPerformance[subject].totalReviews += card.total_reviews || 0;
                subjectPerformance[subject].successfulReviews += (card.review_count_good || 0) + (card.review_count_easy || 0);
            });

            // Calculate success rates per subject
            const subjectStats = Object.values(subjectPerformance)
                .filter(s => s.totalReviews > 0)
                .map(s => ({
                    name: s.name,
                    successRate: Math.round((s.successfulReviews / s.totalReviews) * 100),
                    totalCards: s.cards.length,
                    averageEaseFactor: s.cards.reduce((sum, c) => sum + (c.easiness_factor || 2.5), 0) / s.cards.length
                }));

            // Identify strengths (success rate >= 80%)
            const strengths = subjectStats
                .filter(s => s.successRate >= 80)
                .sort((a, b) => b.successRate - a.successRate)
                .slice(0, 3);

            // Identify weaknesses (success rate < 60%)
            const weaknesses = subjectStats
                .filter(s => s.successRate < 60)
                .sort((a, b) => a.successRate - b.successRate)
                .slice(0, 3);

            // Calculate study streak (consecutive days with reviews in last 7 days)
            let streak = 0;
            for (let i = 0; i < 7; i++) {
                const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
                const hasReviews = allCards.some(c => c.last_reviewed_date === date);
                if (hasReviews) {
                    streak++;
                } else if (i > 0) {
                    break;
                }
            }

            setPerformance({
                totalCards,
                cardsReviewed: cardsReviewedCount,
                averageSuccessRate: avgSuccessRate,
                strengths,
                weaknesses,
                dueToday: dueCards,
                streak
            });

        } catch (error) {
            console.error("Error loading flashcard performance:", error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <Card className="shadow-lg border-2 border-purple-100">
                <CardContent className="p-8 text-center">
                    <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full mx-auto"></div>
                    <p className="text-muted-foreground mt-4 text-sm">Loading performance...</p>
                </CardContent>
            </Card>
        );
    }

    if (performance.totalCards === 0) {
        return (
            <Card className="shadow-lg border-2 border-purple-100">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Brain className="w-5 h-5 text-purple-600" />
                        Flashcard Performance
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-center py-8">
                    <Brain className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-muted-foreground mb-4">No flashcards yet</p>
                    <Link to={createPageUrl("Study")}>
                        <Button className="bg-gradient-to-r from-purple-600 to-indigo-600">
                            Create Flashcards
                        </Button>
                    </Link>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="shadow-lg border-2 border-purple-100">
            <div className="h-2 bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500" />
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
                        <Brain className="w-5 h-5 text-white" />
                    </div>
                    Flashcard Performance
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Overview Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">{performance.totalCards}</div>
                        <div className="text-xs text-muted-foreground">Total Cards</div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{performance.cardsReviewed}</div>
                        <div className="text-xs text-muted-foreground">Reviewed</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{performance.averageSuccessRate}%</div>
                        <div className="text-xs text-muted-foreground">Success Rate</div>
                    </div>
                    <div className="text-center p-4 bg-orange-50 rounded-lg">
                        <div className="text-2xl font-bold text-orange-600">{performance.dueToday}</div>
                        <div className="text-xs text-muted-foreground">Due Today</div>
                    </div>
                </div>

                {/* Study Streak */}
                {performance.streak > 0 && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-lg p-4"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                                <Award className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <p className="font-bold text-orange-900">
                                    {performance.streak} Day Streak! 🔥
                                </p>
                                <p className="text-sm text-orange-700">Keep reviewing to maintain your streak</p>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Strengths */}
                {performance.strengths.length > 0 && (
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <TrendingUp className="w-5 h-5 text-green-600" />
                            <h3 className="font-semibold text-foreground">Your Strengths</h3>
                        </div>
                        <div className="space-y-2">
                            {performance.strengths.map((strength, index) => (
                                <motion.div
                                    key={strength.name}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                                        <span className="font-medium text-foreground">{strength.name}</span>
                                        <Badge variant="outline" className="text-xs bg-surface">
                                            {strength.totalCards} cards
                                        </Badge>
                                    </div>
                                    <Badge className="bg-green-100 text-green-800 border-green-200">
                                        {strength.successRate}%
                                    </Badge>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Weaknesses */}
                {performance.weaknesses.length > 0 && (
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <AlertCircle className="w-5 h-5 text-orange-600" />
                            <h3 className="font-semibold text-foreground">Areas to Focus On</h3>
                        </div>
                        <div className="space-y-2">
                            {performance.weaknesses.map((weakness, index) => (
                                <motion.div
                                    key={weakness.name}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg"
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-orange-500 rounded-full" />
                                        <span className="font-medium text-foreground">{weakness.name}</span>
                                        <Badge variant="outline" className="text-xs bg-surface">
                                            {weakness.totalCards} cards
                                        </Badge>
                                    </div>
                                    <Badge className="bg-orange-100 text-orange-800 border-orange-200">
                                        {weakness.successRate}%
                                    </Badge>
                                </motion.div>
                            ))}
                        </div>
                        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-sm text-blue-900">
                                💡 <strong>Tip:</strong> Focus your next study session on these subjects to improve your retention!
                            </p>
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                    {performance.dueToday > 0 && (
                        <Link to={createPageUrl("Study")} className="flex-1">
                            <Button className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600">
                                Review Now ({performance.dueToday})
                            </Button>
                        </Link>
                    )}
                    <Link to={createPageUrl("Study")} className="flex-1">
                        <Button variant="outline" className="w-full">
                            View All Decks
                            <ChevronRight className="w-4 h-4 ml-2" />
                        </Button>
                    </Link>
                </div>
            </CardContent>
        </Card>
    );
}