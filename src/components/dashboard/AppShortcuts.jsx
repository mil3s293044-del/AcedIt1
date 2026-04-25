import React, { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
    Zap, 
    Settings, 
    Clock, 
    Brain, 
    RefreshCw, 
    PenTool,
    Flame,
    Target,
    BookOpen,
    GraduationCap,
    BarChart3,
    Calendar,
    X
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const availableShortcuts = [
    { id: "pomodoro", title: "Pomodoro Timer", url: createPageUrl("Study"), icon: Clock, color: "text-green-600" },
    { id: "flashcards", title: "Flashcards", url: createPageUrl("Study"), icon: RefreshCw, color: "text-blue-600" },
    { id: "active-recall", title: "Active Recall", url: createPageUrl("Study"), icon: Brain, color: "text-purple-600" },
    { id: "blurting", title: "Blurting Method", url: createPageUrl("Study"), icon: PenTool, color: "text-orange-600" },
    { id: "streaks", title: "Study Streaks", url: createPageUrl("Streaks"), icon: Flame, color: "text-red-600" },
    { id: "goals", title: "Goals & Planning", url: createPageUrl("Goals"), icon: Target, color: "text-indigo-600" },
    { id: "guides", title: "Study Guides", url: createPageUrl("Guides"), icon: BookOpen, color: "text-emerald-600" },
    { id: "subjects", title: "Subjects", url: createPageUrl("Subjects"), icon: GraduationCap, color: "text-blue-700" },
    { id: "dashboard", title: "Dashboard", url: createPageUrl("Dashboard"), icon: BarChart3, color: "text-gray-600" },
    { id: "planner", title: "Study Planner", url: createPageUrl("Goals?tab=planner"), icon: Calendar, color: "text-violet-600" }
];

export default function AppShortcuts() {
    const [shortcuts, setShortcuts] = useState([
        availableShortcuts[0], // Pomodoro Timer
        availableShortcuts[1]  // Flashcards
    ]);
    const [isEditing, setIsEditing] = useState(false);

    const updateShortcut = (index, shortcutId) => {
        const newShortcut = availableShortcuts.find(s => s.id === shortcutId);
        if (newShortcut) {
            const newShortcuts = [...shortcuts];
            newShortcuts[index] = newShortcut;
            setShortcuts(newShortcuts);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
        >
            <Card className="bg-gradient-to-br from-gray-50 to-slate-50 border-gray-200/50">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-gray-900">
                            <Zap className="w-5 h-5" />
                            Quick Shortcuts
                        </CardTitle>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsEditing(!isEditing)}
                        >
                            {isEditing ? <X className="w-4 h-4" /> : <Settings className="w-4 h-4" />}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {isEditing ? (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600">Choose your two favorite shortcuts:</p>
                            {shortcuts.map((shortcut, index) => (
                                <div key={index} className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">
                                        Shortcut {index + 1}
                                    </label>
                                    <Select
                                        value={shortcut.id}
                                        onValueChange={(value) => updateShortcut(index, value)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableShortcuts.map((option) => (
                                                <SelectItem key={option.id} value={option.id}>
                                                    {option.title}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {shortcuts.map((shortcut, index) => {
                                const Icon = shortcut.icon;
                                return (
                                    <motion.div
                                        key={shortcut.id}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        <Link to={shortcut.url}>
                                            <div className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
                                                <Icon className={`w-5 h-5 ${shortcut.color}`} />
                                                <span className="font-medium text-gray-900">{shortcut.title}</span>
                                            </div>
                                        </Link>
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