import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { Lock, Unlock, X, Target, GraduationCap, Edit, Calculator, ExternalLink, Sparkles, Trophy, University as UniversityIcon, TrendingUp } from "lucide-react";
import { moderationPresets } from "@/components/shared/contentModeration";

import SubjectFolder from "./SubjectFolder";

export default function GoalsMountain({ initialSubjectCode }) {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [userSubjects, setUserSubjects] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDoorsOpen, setIsDoorsOpen] = useState(!!initialSubjectCode);
    const [isEditingGoals, setIsEditingGoals] = useState(false);
    const [editedGoals, setEditedGoals] = useState({
        goal_atar: '',
        goal_course_name: '',
        goal_university: ''
    });
    const { toast } = useToast();

    useEffect(() => {
        const init = async () => {
            try {
                const currentUser = await base44.auth.me();
                setUser(currentUser);
                await loadData(currentUser.email);
            } catch (error) {
                console.error("User not logged in:", error);
                setIsLoading(false);
            }
        };
        init();
    }, []);

    // Real-time updates for user profile and subjects
    useEffect(() => {
        if (!user?.email) return;

        const unsubscribeProfile = base44.entities.UserProfile.subscribe((event) => {
            if (event.data?.created_by === user.email && event.type === 'update') {
                setUserProfile(event.data);
                setEditedGoals({
                    goal_atar: event.data.goal_atar || '',
                    goal_course_name: event.data.goal_course_name || '',
                    goal_university: event.data.goal_university || ''
                });
            }
        });

        const unsubscribeSubjects = base44.entities.UserSubject.subscribe((event) => {
            if (event.data?.created_by === user.email) {
                setUserSubjects(prev => {
                    if (event.type === 'create') return [...prev, event.data];
                    if (event.type === 'update') return prev.map(s => s.id === event.id ? event.data : s);
                    if (event.type === 'delete') return prev.filter(s => s.id !== event.id);
                    return prev;
                });
            }
        });

        return () => {
            unsubscribeProfile();
            unsubscribeSubjects();
        };
    }, [user]);

    const loadData = async (userEmail) => {
        setIsLoading(true);
        try {
            const [profileData, subjectsData] = await Promise.all([
                base44.entities.UserProfile.filter({ created_by: userEmail }).then(data => data[0] || null),
                base44.entities.UserSubject.filter({ created_by: userEmail })
            ]);
            
            setUserProfile(profileData);
            setUserSubjects(subjectsData || []);
            
            setEditedGoals({
                goal_atar: profileData?.goal_atar || '',
                goal_course_name: profileData?.goal_course_name || '',
                goal_university: profileData?.goal_university || ''
            });
        } catch (error) {
            console.error("Error loading data:", error);
            toast({ title: "Error", description: "Could not load goal data.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveGoals = async () => {
        if (!user) return;

        // ADDED: Content moderation for course and university names
        try {
            const moderationResult = await moderationPresets.goal(
                editedGoals.goal_course_name || '', 
                editedGoals.goal_university || ''
            );
            
            if (!moderationResult.isAllowed) {
                toast({ 
                    title: "Content Policy Violation", 
                    description: "This action cannot be completed due to a violation of our community guidelines. Please ensure your input is appropriate.",
                    variant: "destructive" 
                });
                return;
            }
        } catch (error) {
            console.error("Moderation error:", error);
            toast({ 
                title: "Moderation Error", 
                description: "An error occurred during content moderation. Please try again.",
                variant: "destructive" 
            });
            return;
        }

        try {
            const goalData = {
                goal_atar: parseFloat(editedGoals.goal_atar) || null,
                goal_course_name: editedGoals.goal_course_name || null,
                goal_university: editedGoals.goal_university || null
            };

            let updatedProfile = userProfile;
            
            // Mark goals_set as complete in onboarding if at least one goal is set
            const hasGoal = goalData.goal_atar || goalData.goal_course_name || goalData.goal_university;
            
            if (updatedProfile?.id) {
                const updateData = { ...goalData };
                if (hasGoal) {
                    const updatedTasks = { ...(updatedProfile.onboarding_tasks || {}), goals_set: true };
                    updateData.onboarding_tasks = updatedTasks;
                }
                updatedProfile = await base44.entities.UserProfile.update(updatedProfile.id, updateData);
            } else {
                const createData = { ...goalData, created_by: user.email };
                if (hasGoal) {
                    createData.onboarding_tasks = { goals_set: true };
                }
                updatedProfile = await base44.entities.UserProfile.create(createData);
            }
            
            setUserProfile(updatedProfile);
            setIsEditingGoals(false);
            toast({ title: "Goals Updated!", description: "Your ATAR and course goals have been saved." });

        } catch (error) {
            console.error("Error saving goals:", error);
            toast({ title: "Error", description: "Could not save goals.", variant: "destructive" });
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                <p className="ml-4 text-muted-foreground">Loading your goals...</p>
            </div>
        );
    }

    return (
        <div className="relative min-h-[700px] overflow-hidden rounded-3xl pb-8">
            {/* Revealed Content */}
            <AnimatePresence>
                {isDoorsOpen && (
                    <motion.div
                        className="relative z-20 h-full"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1, transition: { delay: 0.5, duration: 0.6 } }}
                        exit={{ opacity: 0, transition: { duration: 0.3 } }}
                    >
                        <SubjectFolder 
                            userSubjects={userSubjects} 
                            user={user}
                            initialSubjectCode={initialSubjectCode}
                            onBack={async () => {
                                setIsDoorsOpen(false);
                                // Reload subjects to get updated study scores
                                if (user?.email) {
                                    const subjectsData = await base44.entities.UserSubject.filter({ created_by: user.email });
                                    setUserSubjects(subjectsData || []);
                                }
                            }}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* Animated Doors Layer */}
            <div 
                className={`absolute inset-0 z-10 ${!isDoorsOpen ? 'cursor-pointer' : 'pointer-events-none'}`}
                onClick={() => !isDoorsOpen && setIsDoorsOpen(true)}
            >
                {/* Left Door */}
                <motion.div
                    className="absolute top-0 left-0 w-1/2 h-full bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 shadow-2xl"
                    initial={false}
                    animate={{ x: isDoorsOpen ? '-100%' : '0%' }}
                    transition={{ duration: 1, ease: [0.76, 0, 0.24, 1] }}
                >
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNnoiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSIuNSIgc3Ryb2tlLW9wYWNpdHk9Ii4xIi8+PC9nPjwvc3ZnPg==')] opacity-10"></div>
                </motion.div>
                
                {/* Right Door */}
                <motion.div
                    className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-bl from-indigo-600 via-purple-600 to-pink-600 shadow-2xl"
                    initial={false}
                    animate={{ x: isDoorsOpen ? '100%' : '0%' }}
                    transition={{ duration: 1, ease: [0.76, 0, 0.24, 1] }}
                >
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNnoiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSIuNSIgc3Ryb2tlLW9wYWNpdHk9Ii4xIi8+PC9nPjwvc3ZnPg==')] opacity-10"></div>
                </motion.div>

                {/* Center Split Line Effect */}
                <motion.div
                    className="absolute top-0 left-1/2 w-1 h-full bg-surface/20 blur-sm"
                    initial={false}
                    animate={{ 
                        scaleY: isDoorsOpen ? 0 : 1,
                        opacity: isDoorsOpen ? 0 : 1 
                    }}
                    transition={{ duration: 0.8 }}
                />
            </div>
            
            {/* Content on top of doors (visible when closed) */}
            <AnimatePresence>
                {!isDoorsOpen && (
                    <motion.div
                        className="absolute inset-0 z-20 flex flex-col items-center justify-center text-white pointer-events-none p-6"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1, transition: { delay: 0.3, duration: 0.6 } }}
                        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.3 } }}
                    >
                        {/* Decorative Elements */}
                        <motion.div 
                            className="absolute top-10 left-10 w-20 h-20 rounded-full bg-surface/10 blur-2xl"
                            animate={{ 
                                scale: [1, 1.2, 1],
                                opacity: [0.3, 0.5, 0.3]
                            }}
                            transition={{ duration: 4, repeat: Infinity }}
                        />
                        <motion.div 
                            className="absolute bottom-10 right-10 w-32 h-32 rounded-full bg-surface/10 blur-3xl"
                            animate={{ 
                                scale: [1, 1.3, 1],
                                opacity: [0.3, 0.5, 0.3]
                            }}
                            transition={{ duration: 5, repeat: Infinity, delay: 1 }}
                        />

                        {/* Main Content */}
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.5 }}
                            className="relative z-10 text-center max-w-4xl"
                        >
                            {/* Icon */}
                            <motion.div 
                                className="mb-8 inline-block"
                                animate={{ 
                                    rotate: [0, 5, -5, 0],
                                    scale: [1, 1.05, 1]
                                }}
                                transition={{ duration: 6, repeat: Infinity }}
                            >
                                <div className="relative">
                                    <div className="absolute inset-0 bg-surface/20 rounded-3xl blur-xl"></div>
                                    <div className="relative bg-surface/10 backdrop-blur-sm rounded-3xl p-6 border border-white/20">
                                        <Trophy className="w-16 h-16" />
                                    </div>
                                </div>
                            </motion.div>

                            {/* Title */}
                            <motion.h1 
                                className="text-5xl lg:text-6xl font-black mb-6 tracking-tight"
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.6 }}
                            >
                                <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/90">
                                    Your Ultimate Goal
                                </span>
                            </motion.h1>
                            
                            {/* Goals Display */}
                            <motion.div 
                                className="flex flex-col lg:flex-row items-center justify-center gap-8 mb-10"
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.7 }}
                            >
                                {/* ATAR Goal */}
                                <div className="relative group">
                                    <div className="absolute inset-0 bg-surface/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all"></div>
                                    <div className="relative bg-surface/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 min-w-[200px]">
                                        <div className="flex items-center justify-center gap-2 mb-3">
                                            <TrendingUp className="w-5 h-5 text-emerald-300" />
                                            <h2 className="text-sm font-bold tracking-wider uppercase text-white/80">Target ATAR</h2>
                                        </div>
                                        <p className="text-7xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-white to-white/80">
                                            {userProfile?.goal_atar || '--'}
                                        </p>
                                    </div>
                                </div>

                                {/* Divider */}
                                <div className="hidden lg:block w-px h-32 bg-gradient-to-b from-transparent via-white/30 to-transparent"></div>

                                {/* Course Goal */}
                                <div className="relative group max-w-md">
                                    <div className="absolute inset-0 bg-surface/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all"></div>
                                    <div className="relative bg-surface/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
                                        <div className="flex items-center justify-center gap-2 mb-4">
                                            <GraduationCap className="w-5 h-5 text-blue-300" />
                                            <h2 className="text-sm font-bold tracking-wider uppercase text-white/80">Target Course</h2>
                                        </div>
                                        <p className="text-2xl font-bold mb-2 leading-tight">
                                            {userProfile?.goal_course_name || 'Not Set'}
                                        </p>
                                        {userProfile?.goal_university && (
                                            <div className="flex items-center justify-center gap-2 text-white/80">
                                                <UniversityIcon className="w-4 h-4" />
                                                <p className="text-sm">{userProfile.goal_university}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>

                            {/* Action Buttons */}
                            <motion.div 
                                className="flex flex-col sm:flex-row gap-4 justify-center pointer-events-auto"
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.8 }}
                            >
                                <Button
                                    variant="secondary"
                                    size="lg"
                                    className="bg-surface/20 border-white/30 backdrop-blur-md hover:bg-surface/30 text-white font-semibold shadow-xl hover:shadow-2xl transition-all group"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsEditingGoals(true);
                                    }}
                                >
                                    <Edit className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform" />
                                    Edit Goals
                                </Button>
                                
                                <Button
                                    variant="secondary"
                                    size="lg"
                                    className="bg-surface/20 border-white/30 backdrop-blur-md hover:bg-surface/30 text-white font-semibold shadow-xl hover:shadow-2xl transition-all group"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        window.open('https://atar-calculator.deakin.edu.au/', '_blank');
                                    }}
                                >
                                    <Calculator className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                                    ATAR Calculator
                                    <ExternalLink className="w-4 h-4 ml-2 opacity-70" />
                                </Button>

                                <Button
                                    size="lg"
                                    className="bg-surface text-indigo-600 hover:bg-surface/90 font-bold shadow-xl hover:shadow-2xl transition-all group"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsDoorsOpen(true);
                                    }}
                                >
                                    <Unlock className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                                    Open Subject Planning
                                </Button>
                            </motion.div>

                            {/* Hint Text */}
                            <motion.p
                                className="mt-8 text-white/60 text-sm flex items-center justify-center gap-2"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 1 }}
                            >
                                <Sparkles className="w-4 h-4" />
                                Click anywhere to open subject planning
                            </motion.p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Edit Goals Modal */}
            <AnimatePresence>
                {isEditingGoals && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setIsEditingGoals(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="bg-surface rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-surface/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                                            <Target className="w-6 h-6 text-white" />
                                        </div>
                                        <h3 className="text-2xl font-bold text-white">Edit Your Goals</h3>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label="Close dialog"
                                        onClick={() => setIsEditingGoals(false)}
                                        className="text-white/80 hover:text-white hover:bg-surface/20 rounded-xl"
                                    >
                                        <X className="w-5 h-5" />
                                    </Button>
                                </div>
                            </div>
                            
                            {/* Content */}
                            <div className="p-6 space-y-6">
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-indigo-600" />
                                        Target ATAR
                                    </Label>
                                    <Input
                                        type="number"
                                        min="30"
                                        max="99.95"
                                        step="0.05"
                                        placeholder="95.00"
                                        value={editedGoals.goal_atar}
                                        onChange={(e) => setEditedGoals(prev => ({ ...prev, goal_atar: e.target.value }))}
                                        className="h-12 text-lg border-2 focus:border-indigo-500 rounded-xl"
                                    />
                                </div>
                                
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                                        <GraduationCap className="w-4 h-4 text-indigo-600" />
                                        Target Course
                                    </Label>
                                    <Input
                                        placeholder="e.g., Bachelor of Medicine"
                                        value={editedGoals.goal_course_name}
                                        onChange={(e) => setEditedGoals(prev => ({ ...prev, goal_course_name: e.target.value }))}
                                        className="h-12 border-2 focus:border-indigo-500 rounded-xl"
                                    />
                                </div>
                                
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                                        <UniversityIcon className="w-4 h-4 text-indigo-600" />
                                        Preferred University
                                    </Label>
                                    <Input
                                        placeholder="e.g., University of Melbourne"
                                        value={editedGoals.goal_university}
                                        onChange={(e) => setEditedGoals(prev => ({ ...prev, goal_university: e.target.value }))}
                                        className="h-12 border-2 focus:border-indigo-500 rounded-xl"
                                    />
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex justify-end gap-3 p-6 bg-secondary/50 border-t">
                                <Button 
                                    variant="outline" 
                                    onClick={() => setIsEditingGoals(false)}
                                    className="rounded-xl"
                                >
                                    Cancel
                                </Button>
                                <Button 
                                    onClick={handleSaveGoals}
                                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-xl font-semibold shadow-lg"
                                >
                                    <Sparkles className="w-4 h-4 mr-2" />
                                    Save Goals
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* Close Button */}
            <AnimatePresence>
                {isDoorsOpen && (
                    <motion.div
                        className="fixed top-6 right-6 z-50"
                        initial={{ opacity: 0, scale: 0.8, rotate: -90 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0, transition: { delay: 0.6, type: "spring", damping: 15 } }}
                        exit={{ opacity: 0, scale: 0.8, rotate: 90 }}
                    >
                        <Button
                            onClick={() => setIsDoorsOpen(false)}
                            size="lg"
                            className="rounded-full shadow-2xl bg-surface text-indigo-600 hover:bg-secondary/50 font-bold border-2 border-indigo-200 hover:border-indigo-300 transition-all group"
                        >
                            <Lock className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                            Close Planning
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}