import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Plus, Map, Sparkles, Brain, Target, ChevronRight, Clock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import RoadmapForm from "@/components/roadmap/RoadmapForm";
import RoadmapDisplay from "@/components/roadmap/RoadmapDisplay";
import { isPremium } from "@/components/shared/subscriptionHelpers";
import { format } from "date-fns";

// "landing" | "form" | "display"
export default function StudyRoadmap() {
    const [view, setView] = useState("landing");
    const [roadmaps, setRoadmaps] = useState([]);
    const [activeRoadmap, setActiveRoadmap] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [userProfile, setUserProfile] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const user = await base44.auth.me();
            const [allRoadmaps, profiles] = await Promise.all([
                base44.entities.StudyRoadmap.list("-created_date", 10),
                base44.entities.UserProfile.filter({ created_by: user.email })
            ]);
            setUserProfile(profiles[0] || null);
            setRoadmaps(allRoadmaps);
        } catch (e) {
            // ignore
        } finally {
            setIsLoading(false);
        }
    };

    const handleRoadmapGenerated = (newRoadmap) => {
        setActiveRoadmap(newRoadmap);
        setRoadmaps(prev => [newRoadmap, ...prev]);
        setView("display");
    };

    const handleNewRoadmap = () => {
        if (!isPremium(userProfile) && roadmaps.length > 0) {
            navigate(createPageUrl("Subscription"));
            return;
        }
        setView("form");
    };

    const handleOpenRoadmap = (roadmap) => {
        setActiveRoadmap(roadmap);
        setView("display");
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-96">
                <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
            </div>
        );
    }

    return (
        <div className="p-4 lg:p-8 min-h-screen">
            {/* Back button for form/display */}
            {view !== "landing" && (
                <button
                    onClick={() => setView("landing")}
                    className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to Roadmaps
                </button>
            )}

            {view === "landing" && <LandingView roadmaps={roadmaps} userProfile={userProfile} onNew={handleNewRoadmap} onOpen={handleOpenRoadmap} />}
            {view === "form" && (
                <div className="max-w-2xl mx-auto">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-gradient-to-r from-teal-500 to-emerald-500 rounded-xl flex items-center justify-center shadow">
                            <Map className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">New Study Roadmap</h2>
                            <p className="text-sm text-gray-500">Fill in your assessment details — AI will do the rest</p>
                        </div>
                    </div>
                    <RoadmapForm onGenerated={handleRoadmapGenerated} userProfile={userProfile} />
                </div>
            )}
            {view === "display" && activeRoadmap && (
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">{activeRoadmap.subject}</h2>
                            <p className="text-sm text-gray-500">{activeRoadmap.topic} · {activeRoadmap.assessment_type}</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleNewRoadmap}>
                            <Plus className="w-4 h-4 mr-1" /> New Roadmap
                        </Button>
                    </div>
                    <RoadmapDisplay
                        roadmap={activeRoadmap}
                        userProfile={userProfile}
                        onConfidenceUpdate={(updated) => setActiveRoadmap(updated)}
                    />
                </div>
            )}
        </div>
    );
}

function LandingView({ roadmaps, userProfile, onNew, onOpen }) {
    const userIsPremium = isPremium(userProfile);

    return (
        <div className="max-w-4xl mx-auto">
            {/* Hero */}
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-teal-600 via-emerald-600 to-cyan-700 p-8 lg:p-12 mb-8 text-white shadow-xl">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 20%, white 1px, transparent 1px), radial-gradient(circle at 20% 80%, white 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
                <div className="relative z-10 max-w-2xl">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                            <Map className="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl lg:text-4xl font-bold">Study Roadmap</h1>
                            <p className="text-teal-100 text-sm">Powered by AI + Study Science</p>
                        </div>
                    </div>
                    <p className="text-teal-50 text-base lg:text-lg leading-relaxed mb-6">
                        Tell AcedIt what you're studying and when your assessment is — it'll generate a personalised, day-by-day study plan using your quiz history, flashcard performance, and cognitive science principles.
                    </p>
                    <Button
                        onClick={onNew}
                        size="lg"
                        className="bg-white text-teal-700 hover:bg-teal-50 font-bold shadow-lg"
                    >
                        <Sparkles className="w-5 h-5 mr-2" />
                        {roadmaps.length === 0 ? "Generate My First Roadmap" : "Create New Roadmap"}
                    </Button>
                    {!userIsPremium && (
                        <p className="text-teal-200 text-xs mt-3">Free: 1 roadmap · Day 1 only &nbsp;|&nbsp; Premium: Unlimited roadmaps + full plan + confidence tracking</p>
                    )}
                </div>
            </div>

            {/* Feature highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                {[
                    { icon: Brain, title: "Weak Area Detection", desc: "Scans your quiz scores and flashcard history to find gaps before building the plan", color: "text-purple-600", bg: "bg-purple-50" },
                    { icon: Target, title: "Day-by-Day Plan", desc: "Sequenced using cognitive load theory, spaced repetition, and retrieval practice research", color: "text-teal-600", bg: "bg-teal-50" },
                    { icon: Clock, title: "Confidence Checkpoints", desc: "Rate your confidence each day — the plan adapts automatically with consolidation days", color: "text-emerald-600", bg: "bg-emerald-50" },
                ].map(f => (
                    <Card key={f.title} className="border-0 shadow-sm">
                        <CardContent className="p-5">
                            <div className={`w-10 h-10 ${f.bg} rounded-xl flex items-center justify-center mb-3`}>
                                <f.icon className={`w-5 h-5 ${f.color}`} />
                            </div>
                            <p className="font-semibold text-gray-900 text-sm mb-1">{f.title}</p>
                            <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Past roadmaps */}
            {roadmaps.length > 0 && (
                <div>
                    <h2 className="text-lg font-bold text-gray-900 mb-3">Your Roadmaps</h2>
                    <div className="space-y-2">
                        {roadmaps.map(r => (
                            <button
                                key={r.id}
                                onClick={() => onOpen(r)}
                                className="w-full text-left"
                            >
                                <Card className="hover:shadow-md transition-shadow border border-gray-200 hover:border-teal-300">
                                    <CardContent className="p-4 flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
                                                <Map className="w-5 h-5 text-white" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-semibold text-gray-900 truncate">{r.subject}</p>
                                                <p className="text-xs text-gray-500 truncate">{r.topic}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <Badge className="bg-teal-100 text-teal-700 border-0 hidden sm:flex">{r.assessment_type}</Badge>
                                            <Badge className="bg-gray-100 text-gray-600 border-0">{r.days_until}d</Badge>
                                            <span className="text-xs text-gray-400 hidden sm:block">{r.created_date ? format(new Date(r.created_date), "d MMM") : ""}</span>
                                            <ChevronRight className="w-4 h-4 text-gray-400" />
                                        </div>
                                    </CardContent>
                                </Card>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}