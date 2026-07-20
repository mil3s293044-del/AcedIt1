
import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
// isSameDay kept as per outline, though not directly used in the new calendar rendering

export default function StreakCalendar({ streaks = [], isLoading }) {
    const studiedDays = streaks.map(s => new Date(s.date));

    // The getDayStatus and renderCalendar functions are removed as the Calendar component from shadcn/ui
    // handles the date rendering and marking of specific days using its props.

    // Calculate current streak based on completed entries, preserving existing logic.
    const currentStreak = streaks.filter(s => s.completed).length;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
        >
            <Card className="bg-gradient-to-br from-orange-50 to-red-50 border-orange-200/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-orange-900">
                        <Flame className="w-5 h-5" />
                        Study Streak
                        <span className="ml-auto text-2xl font-bold">{currentStreak}</span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="grid grid-cols-7 gap-2">
                            {/* This loading state is for a 14-day grid, kept as per original structure */}
                            {Array(14).fill(0).map((_, i) => (
                                <div key={i} className="w-8 h-8 bg-secondary rounded-lg animate-pulse" />
                            ))}
                        </div>
                    ) : (
                        <>
                            {/* Replaced the custom 14-day grid with the shadcn/ui Calendar component */}
                            <Calendar
                                mode="multiple" // Allows selecting multiple dates
                                selected={studiedDays} // Marks the days from the streaks array
                                className="rounded-md border p-4" // Basic styling for the calendar
                                numberOfMonths={1} // Display only one month at a time
                            />
                            <div className="flex items-center justify-between text-sm mt-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-green-500 rounded-sm" />
                                    <span className="text-muted-foreground">Completed</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-secondary rounded-sm" />
                                    <span className="text-muted-foreground">No activity</span>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    );
}
