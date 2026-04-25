import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Target, CalendarIcon, GraduationCap, TrendingUp, Edit2, Check, X, ChevronRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { moderationPresets } from "@/components/shared/contentModeration";
import { useToast } from "@/components/ui/use-toast";

import GoalsList from "../components/goals/GoalsList";
import GoalCreationWizard from "../components/goals/GoalCreationWizard";
import GoalDetailView from "../components/goals/GoalDetailView";
import InteractiveCalendar from "../components/goals/InteractiveCalendar";
import HelpButton from "@/components/shared/HelpButton";

function ATARBanner({ userProfile, onSaved }) {
    const { toast } = useToast();
    const [isEditing, setIsEditing] = useState(false);
    const [form, setForm] = useState({
        goal_atar: userProfile?.goal_atar || "",
        goal_course_name: userProfile?.goal_course_name || "",
        goal_university: userProfile?.goal_university || "",
    });
    const [saving, setSaving] = useState(false);

    const hasGoal = userProfile?.goal_atar || userProfile?.goal_course_name;

    const handleSave = async () => {
        setSaving(true);
        try {
            const modResult = await moderationPresets.goal(form.goal_course_name || '', form.goal_university || '');
            if (!modResult.isAllowed) {
                toast({ title: "Content Policy Violation", variant: "destructive" });
                return;
            }
            const data = {
                goal_atar: parseFloat(form.goal_atar) || null,
                goal_course_name: form.goal_course_name || null,
                goal_university: form.goal_university || null,
                onboarding_tasks: { ...(userProfile?.onboarding_tasks || {}), goals_set: true },
            };
            if (userProfile?.id) {
                await base44.entities.UserProfile.update(userProfile.id, data);
            } else {
                await base44.entities.UserProfile.create(data);
            }
            onSaved({ ...(userProfile || {}), ...data });
            setIsEditing(false);
            toast({ title: "Goals saved!" });
        } catch (e) {
            toast({ title: "Could not save", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    if (!hasGoal && !isEditing) {
        return (
            <button onClick={() => setIsEditing(true)}
                className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 hover:border-indigo-300 transition-all text-left">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <GraduationCap className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                    <p className="text-sm font-semibold text-indigo-700">Set your ATAR & university goal</p>
                    <p className="text-xs text-gray-500">Tap to set your target ATAR, course, and university</p>
                </div>
                <ChevronRight className="w-4 h-4 text-indigo-400 ml-auto" />
            </button>
        );
    }

    if (isEditing) {
        return (
            <div className="bg-white rounded-2xl border border-indigo-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <p className="font-semibold text-gray-900 text-sm">Your Big Goal</p>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsEditing(false)}>
                        <X className="w-4 h-4" />
                    </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                        <Label className="text-xs text-gray-500 mb-1 block">Target ATAR</Label>
                        <Input type="number" min="30" max="99.95" step="0.05" placeholder="e.g. 95.00"
                            value={form.goal_atar} onChange={e => setForm(p => ({ ...p, goal_atar: e.target.value }))}
                            className="h-9 text-sm" />
                    </div>
                    <div>
                        <Label className="text-xs text-gray-500 mb-1 block">Target Course</Label>
                        <Input placeholder="e.g. Bachelor of Medicine"
                            value={form.goal_course_name} onChange={e => setForm(p => ({ ...p, goal_course_name: e.target.value }))}
                            className="h-9 text-sm" />
                    </div>
                    <div>
                        <Label className="text-xs text-gray-500 mb-1 block">University</Label>
                        <Input placeholder="e.g. University of Melbourne"
                            value={form.goal_university} onChange={e => setForm(p => ({ ...p, goal_university: e.target.value }))}
                            className="h-9 text-sm" />
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-3">
                    <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
                        <Check className="w-3.5 h-3.5 mr-1.5" /> Save Goal
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-4 text-white flex items-center gap-4">
            <div className="flex items-center gap-4 flex-1 flex-wrap">
                {userProfile?.goal_atar && (
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-white/70" />
                        <div>
                            <p className="text-white/70 text-xs">Target ATAR</p>
                            <p className="text-xl font-black">{userProfile.goal_atar}</p>
                        </div>
                    </div>
                )}
                {userProfile?.goal_course_name && (
                    <>
                        <div className="w-px h-8 bg-white/20 hidden sm:block" />
                        <div>
                            <p className="text-white/70 text-xs">Target Course</p>
                            <p className="font-bold text-sm leading-tight">{userProfile.goal_course_name}</p>
                            {userProfile?.goal_university && <p className="text-white/70 text-xs">{userProfile.goal_university}</p>}
                        </div>
                    </>
                )}
            </div>
            <Button variant="ghost" size="sm"
                onClick={() => { setForm({ goal_atar: userProfile?.goal_atar || "", goal_course_name: userProfile?.goal_course_name || "", goal_university: userProfile?.goal_university || "" }); setIsEditing(true); }}
                className="text-white/80 hover:text-white hover:bg-white/10 flex-shrink-0">
                <Edit2 className="w-3.5 h-3.5 mr-1.5" /> Edit
            </Button>
        </div>
    );
}

export default function Goals() {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [userSubjects, setUserSubjects] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [goalsView, setGoalsView] = useState("list");
    const [selectedGoal, setSelectedGoal] = useState(null);

    useEffect(() => {
        const init = async () => {
            try {
                const currentUser = await base44.auth.me();
                setUser(currentUser);
                const [profile, subjects] = await Promise.all([
                    base44.entities.UserProfile.filter({ created_by: currentUser.email }).then(d => d[0] || null),
                    base44.entities.UserSubject.filter({ created_by: currentUser.email }),
                ]);
                setUserProfile(profile);
                setUserSubjects(subjects || []);
            } catch (e) {
                console.error("Init error:", e);
            } finally {
                setIsLoading(false);
            }
        };
        init();
    }, []);

    // Keep selectedGoal in sync with real-time updates
    useEffect(() => {
        if (!selectedGoal) return;
        const unsub = base44.entities.Goal.subscribe((event) => {
            if (event.type === 'update' && event.id === selectedGoal.id) {
                setSelectedGoal(event.data);
            }
        });
        return () => unsub();
    }, [selectedGoal?.id]);

    if (isLoading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="px-4 lg:px-8 py-6">
            <div className="w-full max-w-[1400px] mx-auto space-y-5">
                <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Goals & Planning 🎯</h1>
                        <HelpButton page="Goals" />
                    </div>
                    <p className="text-gray-500 text-sm mt-1">Set goals, track progress, and plan your study schedule</p>
                </motion.div>

                <ATARBanner userProfile={userProfile} onSaved={setUserProfile} />

                <Tabs defaultValue="goals" className="space-y-5">
                    <TabsList className="grid w-full grid-cols-2 bg-white/60 backdrop-blur-sm p-1.5 h-auto border border-gray-200 shadow-sm rounded-xl">
                        <TabsTrigger value="goals"
                            onClick={() => { if (goalsView !== "list" && goalsView !== "create" && goalsView !== "detail") setGoalsView("list"); }}
                            className="flex items-center gap-1.5 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg text-sm font-medium">
                            <Target className="w-4 h-4" /> Goals
                        </TabsTrigger>
                        <TabsTrigger value="planner"
                            className="flex items-center gap-1.5 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg text-sm font-medium">
                            <CalendarIcon className="w-4 h-4" /> Study Planner
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="goals" className="space-y-4">
                        <AnimatePresence mode="wait">
                            {goalsView === "list" && (
                                <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                    <GoalsList
                                        userSubjects={userSubjects}
                                        onSelectGoal={(goal) => { setSelectedGoal(goal); setGoalsView("detail"); }}
                                        onCreateGoal={() => setGoalsView("create")}
                                    />
                                </motion.div>
                            )}

                            {goalsView === "create" && (
                                <motion.div key="create" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
                                    <div className="bg-white rounded-2xl p-6 shadow-sm border">
                                        <GoalCreationWizard
                                            userSubjects={userSubjects}
                                            onGoalCreated={(goal) => { setSelectedGoal(goal); setGoalsView("detail"); }}
                                            onCancel={() => setGoalsView("list")}
                                        />
                                    </div>
                                </motion.div>
                            )}

                            {goalsView === "detail" && selectedGoal && (
                                <motion.div key="detail" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
                                    <div className="bg-white rounded-2xl p-6 shadow-sm border">
                                        <GoalDetailView
                                            goal={selectedGoal}
                                            onBack={() => setGoalsView("list")}
                                            onGoalUpdated={(updated) => setSelectedGoal(updated)}
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </TabsContent>

                    <TabsContent value="planner">
                        <InteractiveCalendar user={user} />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}