import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
    BarChart3, 
    Clock
} from "lucide-react";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";

export default function StudyAnalytics({ sessions = [], userProfile, isLoading }) {
    const analytics = useMemo(() => {
        if (!sessions || sessions.length === 0) {
            return {
                totalMinutes: 0,
                weeklyData: []
            };
        }

        const totalMinutes = sessions.reduce((sum, session) => sum + (session.session_duration || 0), 0);

        // Weekly data for chart
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
        const weeklyData = [];
        for (let i = 0; i < 7; i++) {
            const date = addDays(weekStart, i);
            const dayMinutes = sessions.filter(session => 
                session.date && isSameDay(new Date(session.date), date)
            ).reduce((sum, session) => sum + (session.session_duration || 0), 0);
            
            weeklyData.push({
                day: format(date, "EEE"),
                minutes: dayMinutes,
                hours: Math.round(dayMinutes / 60 * 10) / 10
            });
        }

        return {
            totalMinutes,
            weeklyData
        };
    }, [sessions]);

    if (isLoading) {
        return (
            <Card className="shadow-lg rounded-2xl animate-pulse">
                <CardContent className="p-6">
                    <div className="h-32 bg-secondary rounded" />
                </CardContent>
            </Card>
        );
    }

    // Don't show the card if there are no sessions
    if (sessions.length === 0) {
        return null;
    }

    return (
        <Card className="shadow-lg rounded-2xl">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-indigo-600" />
                    Study Activity
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Daily Activity Chart */}
                <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-4">This Week</h3>
                    <div className="flex items-end justify-between gap-2 h-32">
                        {analytics.weeklyData.map((day, index) => {
                            const maxMinutes = Math.max(...analytics.weeklyData.map(d => d.minutes), 1);
                            const heightPercent = (day.minutes / maxMinutes) * 100;
                            
                            return (
                                <div key={index} className="flex-1 flex flex-col items-center gap-2">
                                    <div className="w-full flex flex-col items-center justify-end h-24">
                                        {day.minutes > 0 && (
                                            <motion.div
                                                initial={{ height: 0 }}
                                                animate={{ height: `${heightPercent}%` }}
                                                transition={{ delay: index * 0.1 }}
                                                className="w-full bg-gradient-to-t from-indigo-500 to-purple-500 rounded-t-lg min-h-[4px]"
                                                title={`${day.hours}h`}
                                            />
                                        )}
                                    </div>
                                    <div className="text-center">
                                        <div className="text-xs font-medium text-muted-foreground">{day.day}</div>
                                        <div className="text-xs text-muted-foreground">{day.hours}h</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Total Time */}
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                            <Clock className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Study Time</p>
                            <p className="text-2xl font-bold text-foreground">
                                {Math.round(analytics.totalMinutes / 60)}h
                            </p>
                        </div>
                    </div>
                    <Badge className="bg-indigo-100 text-indigo-800">
                        {sessions.length} sessions
                    </Badge>
                </div>
            </CardContent>
        </Card>
    );
}