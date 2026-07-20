
import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";

export default function WeeklyProgress({ sessions = [], isLoading }) {
    const getWeeklyData = () => {
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday start
        const weekData = [];
        
        for (let i = 0; i < 7; i++) {
            const date = addDays(weekStart, i);
            const dayName = format(date, "EEE");
            
            const dayMinutes = (sessions || []).filter(session => 
                session && session.date && isSameDay(new Date(session.date), date)
            ).reduce((sum, session) => sum + (session.session_duration || 0), 0);
            
            weekData.push({
                day: dayName,
                minutes: dayMinutes,
                hours: dayMinutes / 60
            });
        }
        
        return weekData;
    };

    const weeklyData = getWeeklyData();
    const totalWeekMinutes = weeklyData.reduce((sum, day) => sum + day.minutes, 0);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
        >
            <Card className="bg-surface/70 backdrop-blur-sm border-border/50 hover:shadow-lg transition-all duration-300">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-blue-600" />
                        Weekly Progress
                        <span className="ml-auto text-sm font-normal text-muted-foreground">
                            {Math.round(totalWeekMinutes / 60)}h this week
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="h-64 flex items-center justify-center">
                            <div className="animate-pulse text-muted-foreground/60">Loading chart...</div>
                        </div>
                    ) : (
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={weeklyData}>
                                    <XAxis 
                                        dataKey="day" 
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 12, fill: '#6B7280' }}
                                    />
                                    <YAxis 
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 12, fill: '#6B7280' }}
                                    />
                                    <Tooltip 
                                        content={({ active, payload, label }) => {
                                            if (active && payload && payload.length) {
                                                return (
                                                    <div className="bg-surface p-3 rounded-lg shadow-lg border border-border">
                                                        <p className="font-medium">{label}</p>
                                                        <p className="text-blue-600">
                                                            {Math.round(payload[0].value)} minutes
                                                        </p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Bar 
                                        dataKey="minutes" 
                                        fill="#3B82F6"
                                        radius={[4, 4, 0, 0]}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    );
}
