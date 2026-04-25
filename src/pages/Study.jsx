import React, { useState, useEffect } from "react";
import { StudyTechnique, UserProfile, User, UserSubject } from "@/entities/all";
import { motion } from "framer-motion";
import {
    Clock,
    Brain,
    RefreshCw,
    PenTool,
    X,
    GraduationCap
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import PomodoroTimer from "../components/study/PomodoroTimer";
import { fireXPFeedback } from "../components/ranked/XPFeedback";
import { base44 } from "@/api/base44Client";
import SpacedRepetition from "../components/study/SpacedRepetition";
import ActiveRecall from "../components/study/ActiveRecall";
import BlurtingMethod from "../components/study/BlurtingMethod";
import ExamMode from "../components/study/ExamMode";
import HelpButton from "@/components/shared/HelpButton";

export default function Study() {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [userSubjects, setUserSubjects] = useState([]);
    const [recentSessions, setRecentSessions] = useState([]);
    const [activeTab, setActiveTab] = useState("pomodoro");
    const [isLoading, setIsLoading] = useState(true);
    const [authError, setAuthError] = useState(false);

    useEffect(() => {
        const init = async () => {
            try {
                const currentUser = await User.me();
                setUser(currentUser);
                setAuthError(false);
                loadData(currentUser.email);
            } catch (error) {
                console.error("Authentication error:", error);
                setAuthError(true);
                setIsLoading(false);
            }
        };
        init();
    }, []);

    useEffect(() => {
        const handleStartReview = (event) => {
            if (event.detail && event.detail.deckId) {
                setActiveTab("spaced_repetition");
                setTimeout(() => {
                    const reviewEvent = new CustomEvent('triggerDeckReview', {
                        detail: { deckId: event.detail.deckId }
                    });
                    window.dispatchEvent(reviewEvent);
                }, 300);
            }
        };

        window.addEventListener('startFlashcardReview', handleStartReview);
        return () => window.removeEventListener('startFlashcardReview', handleStartReview);
    }, []);

    useEffect(() => {
        const event = new CustomEvent('studyTechniqueChanged', {
            detail: { technique: activeTab }
        });
        window.dispatchEvent(event);
    }, [activeTab]);

    const loadData = async (userEmail) => {
        if (!userEmail) return;

        setIsLoading(true);
        try {
            const [profileData, sessionsData, subjectsData] = await Promise.all([
                UserProfile.filter({ created_by: userEmail }).then(data => data[0] || null),
                StudyTechnique.filter({ created_by: userEmail }, "-created_date", 20),
                UserSubject.filter({ created_by: userEmail, is_active: true })
            ]);
            setUserProfile(profileData);
            setRecentSessions(sessionsData || []);
            setUserSubjects(subjectsData || []);
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Real-time updates
    useEffect(() => {
        if (!user?.email) return;

        const unsubscribeTechnique = StudyTechnique.subscribe((event) => {
            if (event.data?.created_by === user.email) {
                setRecentSessions(prev => {
                    if (event.type === 'create') return [event.data, ...prev].slice(0, 20);
                    if (event.type === 'update') return prev.map(s => s.id === event.id ? event.data : s);
                    if (event.type === 'delete') return prev.filter(s => s.id !== event.id);
                    return prev;
                });
            }
        });

        const unsubscribeSubjects = UserSubject.subscribe((event) => {
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
            unsubscribeTechnique();
            unsubscribeSubjects();
        };
    }, [user]);

    const handleSessionComplete = async (sessionData) => {
        if (!user) return;
        try {
            await StudyTechnique.create({ ...sessionData });
            loadData(user.email);

            // Award XP: 1 XP per minute for pomodoro, active_recall, and blurting
            const mins = sessionData.session_duration || 0;
            if (mins >= 2) {
                const technique = sessionData.technique_name; // pomodoro, active_recall, blurting
                // Map technique names to awardXP source
                const sourceMap = {
                    pomodoro: 'study_session',
                    active_recall: 'active_recall',
                    blurting: 'blurting',
                };
                const source = sourceMap[technique] || 'study_session';
                const eventKey = `${source}_${user.email}_${Date.now()}`;
                const res = await base44.functions.invoke('awardXP', {
                    source,
                    event_key: eventKey,
                    duration_minutes: mins,
                });
                fireXPFeedback(res?.data ?? res, source);
            }
        } catch (error) {
            console.error("Error saving session:", error);
        }
    };



    const techniques = [
        {
            id: "pomodoro",
            name: "Pomodoro Timer",
            icon: Clock,
            color: "text-green-600",
            bg: "from-green-50 via-emerald-50 to-teal-50"
        },
        {
            id: "spaced_repetition",
            name: "Spaced Repetition",
            icon: RefreshCw,
            color: "text-blue-600",
            bg: "from-blue-50 via-cyan-50 to-sky-50"
        },
        {
            id: "active_recall",
            name: "Active Recall",
            icon: Brain,
            color: "text-purple-600",
            bg: "from-purple-50 via-violet-50 to-indigo-50"
        },
        {
            id: "blurting",
            name: "Blurting Method",
            icon: PenTool,
            color: "text-orange-600",
            bg: "from-orange-50 via-amber-50 to-yellow-50"
        },
        {
            id: "exam",
            name: "Revision Mode",
            icon: GraduationCap,
            color: "text-slate-700",
            bg: "from-slate-50 via-gray-50 to-zinc-50"
        }
    ];

    const techniqueComponents = {
        pomodoro: (
            <PomodoroTimer
                onSessionComplete={handleSessionComplete}
                userSubjects={userSubjects}
            />
        ),
        spaced_repetition: (
            <SpacedRepetition
                userSubjects={userSubjects}
            />
        ),
        active_recall: (
            <ActiveRecall
                onSessionComplete={handleSessionComplete}
                userSubjects={userSubjects}
            />
        ),
        blurting: (
            <BlurtingMethod
                onSessionComplete={handleSessionComplete}
                userSubjects={userSubjects}
            />
        ),
        exam: (
            <ExamMode
                userSubjects={userSubjects}
            />
        )
    };

    const currentTechnique = techniques.find(t => t.id === activeTab);

    if (authError) {
        return (
            <div className="p-4 lg:p-8 min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center">
                <Card className="max-w-md w-full">
                    <CardContent className="p-8 text-center">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <X className="w-8 h-8 text-red-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Connection Issue</h2>
                        <p className="text-gray-600 mb-6">
                            Unable to connect. Please check your internet connection and try again.
                        </p>
                        <Button
                            onClick={() => window.location.reload()}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            Retry
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (userSubjects.length === 0 && !isLoading) {
        return (
            <div className="px-4 lg:px-8 py-6 min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
                <div className="w-full max-w-[1400px] mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center mb-8"
                    >
                        <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
                            Study 📚
                        </h1>
                        <p className="text-gray-600 text-lg">
                            Master effective study methods and boost your learning
                        </p>
                    </motion.div>

                    <Card className="max-w-2xl mx-auto">
                        <CardContent className="p-8 text-center">
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Clock className="w-8 h-8 text-blue-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">
                                No Subjects Selected
                            </h2>
                            <p className="text-gray-600 mb-6">
                                To start studying, you need to select your subjects first. Head to the Subjects page and add your subjects to "My Subjects".
                            </p>
                            <Button
                                onClick={() => window.location.href = '/Subjects'}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                Go to Subjects
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen px-4 lg:px-8 py-6 transition-all duration-700 bg-gradient-to-br ${currentTechnique?.bg || 'from-slate-50 to-gray-50'}`}>
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-6"
                >
                    <div className="flex items-center justify-center gap-3 mb-1">
                        <h1 className="text-3xl lg:text-4xl font-bold text-gray-900">
                            Study 📚
                        </h1>
                        <HelpButton page="Study" />
                    </div>
                    <p className="text-gray-600">
                        Master effective study methods and boost your learning
                    </p>
                </motion.div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
                    <TabsList className="grid w-full grid-cols-5 bg-white/60 backdrop-blur-md p-2 h-auto shadow-lg rounded-2xl border border-white/20">
                        {techniques.map((technique) => {
                            const Icon = technique.icon;
                            return (
                                <TabsTrigger
                                    key={technique.id}
                                    value={technique.id}
                                    className="flex flex-col items-center gap-2 p-4 data-[state=active]:bg-white data-[state=active]:shadow-lg rounded-xl transition-all duration-300"
                                >
                                    <Icon className={`w-6 h-6 ${technique.color}`} />
                                    <span className="font-medium text-sm hidden sm:block">
                                        {technique.name}
                                    </span>
                                </TabsTrigger>
                            );
                        })}
                    </TabsList>

                    {Object.entries(techniqueComponents).map(([key, component]) => (
                        <TabsContent key={key} value={key}>
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4 }}
                            >
                                {component}
                            </motion.div>
                        </TabsContent>
                    ))}
                </Tabs>
        </div>
    );
}