
import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, BookOpen, Brain, Eye, FileText } from "lucide-react";
import { format } from "date-fns";

const techniqueIcons = {
    pomodoro: Clock,
    focused_study: BookOpen,
    review: Eye,
    quiz: Brain,
    reading: FileText
};

const techniqueColors = {
    pomodoro: "bg-green-100 text-green-800 border-green-200",
    focused_study: "bg-blue-100 text-blue-800 border-blue-200",
    review: "bg-purple-100 text-purple-800 border-purple-200",
    quiz: "bg-pink-100 text-pink-800 border-pink-200",
    reading: "bg-orange-100 text-orange-800 border-orange-200"
};

export default function RecentSessions({ sessions = [], isLoading }) {
    const recentSessions = sessions.slice(0, 5);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
        >
            <Card className="bg-white/70 backdrop-blur-sm border-gray-200/50 hover:shadow-lg transition-all duration-300">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-green-600" />
                        Recent Study Sessions
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="animate-pulse flex items-center gap-4">
                                    <div className="w-10 h-10 bg-gray-200 rounded-lg" />
                                    <div className="flex-1">
                                        <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
                                        <div className="h-3 bg-gray-200 rounded w-1/4" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : recentSessions.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                            <p>No study sessions yet</p>
                            <p className="text-sm">Start your first session to see progress!</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {recentSessions.map((session, index) => {
                                const TechniqueIcon = techniqueIcons[session.technique] || BookOpen;
                                
                                return (
                                    <motion.div
                                        key={session.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50/50 transition-colors duration-200"
                                    >
                                        <div className="w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                                            <TechniqueIcon className="w-5 h-5 text-gray-600" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-medium text-gray-900">{session.subject}</h4>
                                                <Badge 
                                                    variant="secondary" 
                                                    className={`text-xs ${techniqueColors[session.technique] || 'bg-gray-100 text-gray-800'}`}
                                                >
                                                    {(session.technique || '').replace(/_/g, ' ')}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-4 text-sm text-gray-500">
                                                <span>{session.duration_minutes} min</span>
                                                <span>•</span>
                                                <span>{format(new Date(session.date), "MMM d")}</span>
                                                {session.productivity_rating && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="flex items-center gap-1">
                                                            {"⭐".repeat(session.productivity_rating)}
                                                        </span>
                                                    </>
                                                )}
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
    );
}
