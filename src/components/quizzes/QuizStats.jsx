
import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge"; // New import
import { Target, Clock, BarChart2 } from "lucide-react"; // BarChart2 new, Trophy removed

export default function QuizStats({ attempts = [] }) { // Provide default empty array for robustness
    const totalAttempts = attempts.length;

    if (totalAttempts === 0) {
        // Return null if there are no attempts, as per the outline's instruction.
        // This means the component won't render anything in this case.
        return null;
    }

    // Display the adjusted score (auto + self-marked) so the stats match
    // what the student sees on the results page.
    const effectiveScore = (a) => (typeof a.adjusted_score === "number" ? a.adjusted_score : a.score);

    const averageScore = Math.round(attempts.reduce((sum, a) => sum + effectiveScore(a), 0) / totalAttempts);
    const totalTimeMinutes = Math.floor(attempts.reduce((sum, a) => sum + (a.time_taken || 0), 0) / 60);

    // Calculate category-specific statistics
    const categoryStats = attempts.reduce((acc, attempt) => {
        const category = attempt.quiz_category || 'uncategorized'; // Handle potential missing category
        if (!acc[category]) {
            acc[category] = { count: 0, totalScore: 0 };
        }
        acc[category].count++;
        acc[category].totalScore += effectiveScore(attempt);
        return acc;
    }, {});

    // Determine the best performing category
    const bestCategory = Object.entries(categoryStats).reduce((best, [name, data]) => {
        const avg = data.totalScore / data.count;
        if (avg > best.score) {
            return { name, score: avg };
        }
        return best;
    }, { name: 'N/A', score: 0 }); // Default value for best category if none found

    // Round best category score for display
    const bestCategoryScore = Math.round(bestCategory.score);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
        >
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-blue-900">
                        <BarChart2 className="w-5 h-5" /> {/* Changed icon from Trophy to BarChart2 */}
                        Your Quiz Stats
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                        {/* Quizzes Taken */}
                        <div className="text-center">
                            <div className="text-2xl font-bold text-blue-900">{totalAttempts}</div>
                            <div className="text-xs text-blue-700">Quizzes Taken</div>
                        </div>
                        {/* Average Score */}
                        <div className="text-center">
                            <div className="text-2xl font-bold text-blue-900">{averageScore}%</div>
                            <div className="text-xs text-blue-700">Average Score</div>
                        </div>
                        {/* Total Time Spent (new stat) */}
                        <div className="text-center">
                            <div className="text-2xl font-bold text-blue-900 flex items-center justify-center gap-1">
                                <Clock className="w-5 h-5 text-blue-600" />
                                {totalTimeMinutes}m
                            </div>
                            <div className="text-xs text-blue-700">Total Time Spent</div>
                        </div>
                        {/* Best Category (new stat) */}
                        <div className="text-center">
                            <div className="text-lg font-bold text-blue-900">
                                <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
                                    <Target className="w-4 h-4 mr-1" />
                                    {bestCategory.name}
                                </Badge>
                                <span className="ml-2 text-2xl">{bestCategoryScore}%</span>
                            </div>
                            <div className="text-xs text-blue-700">Best Category</div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}
