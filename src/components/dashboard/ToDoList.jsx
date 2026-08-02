import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { CheckCircle2, User, GraduationCap, Sparkles, ArrowRight } from 'lucide-react';

const ALL_TASKS = [
    { id: 'username_set', title: 'Set Your Username', description: 'Create a unique username for your profile.', link: createPageUrl('Settings'), icon: User },
    { id: 'subjects_selected', title: 'Select Your Subjects', description: 'Add at least one subject to get started.', link: createPageUrl('Subjects'), icon: GraduationCap },
];

export default function ToDoList({ user, userProfile, onUpdate }) {
    const [tasks, setTasks] = useState([]);
    const [completedCount, setCompletedCount] = useState(0);

    useEffect(() => {
        if (userProfile?.onboarding_tasks) {
            const taskStatus = userProfile.onboarding_tasks;
            const currentTasks = ALL_TASKS.map(task => ({
                ...task,
                isCompleted: taskStatus[task.id] || false,
            }));
            setTasks(currentTasks);
            setCompletedCount(currentTasks.filter(t => t.isCompleted).length);
        } else {
            // Initialize with all tasks incomplete
            const currentTasks = ALL_TASKS.map(task => ({
                ...task,
                isCompleted: false,
            }));
            setTasks(currentTasks);
            setCompletedCount(0);
        }
    }, [userProfile]);

    const progress = (completedCount / ALL_TASKS.length) * 100;
    
    // If all tasks are completed, don't render the component
    if (completedCount === ALL_TASKS.length) {
        return null;
    }

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200/50 hover:shadow-lg transition-all duration-300">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-xl flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <span className="text-xl">Welcome! Let's Get You Set Up</span>
                            <p className="text-sm font-normal text-muted-foreground mt-1">Complete these steps to personalize your experience</p>
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4 mb-6">
                        <Progress value={progress} className="w-full h-3" />
                        <span className="text-sm font-bold text-purple-700 whitespace-nowrap">{completedCount}/{ALL_TASKS.length}</span>
                    </div>
                    <div className="space-y-3">
                        {tasks.map((task, index) => {
                            const Icon = task.icon;
                            return (
                                <motion.div
                                    key={task.id}
                                    layout
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                                        task.isCompleted 
                                            ? 'bg-green-50 border border-green-200' 
                                            : 'bg-surface border border-border hover:border-purple-300 hover:shadow-md'
                                    }`}
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                        task.isCompleted 
                                            ? 'bg-green-100' 
                                            : 'bg-purple-100'
                                    }`}>
                                        {task.isCompleted ? (
                                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                                        ) : (
                                            <Icon className="w-5 h-5 text-purple-600" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`font-semibold ${task.isCompleted ? 'text-green-700 line-through' : 'text-foreground'}`}>
                                            {task.title}
                                        </p>
                                        <p className="text-sm text-muted-foreground">{task.description}</p>
                                    </div>
                                    {!task.isCompleted && task.link && (
                                        <Button asChild className="bg-purple-600 hover:bg-purple-700 flex-shrink-0">
                                            <Link to={task.link} className="flex items-center gap-2">
                                                Go <ArrowRight className="w-4 h-4" />
                                            </Link>
                                        </Button>
                                    )}
                                    {task.isCompleted && (
                                        <span className="text-sm font-medium text-green-600 flex-shrink-0">Done!</span>
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}