import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Plus, Map, Sparkles, Brain, Target, ChevronRight, Clock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import RoadmapForm from "@/components/roadmap/RoadmapForm";
import RoadmapDisplay from "@/components/roadmap/RoadmapDisplay";
import { isPremium } from "@/components/shared/subscriptionHelpers";
import EmptyState from "@/components/shared/EmptyState";
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
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="p-4 lg:p-8 min-h-screen bg-background">
            {/* Back button for form/display */}
            {view !== "landing" && (
                <button
                    onClick={() => setView("landing")}
                    className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground mb-6 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to Roadmaps
                </button>
            )}

            {view === "landing" && <LandingView roadmaps={roadmaps} userProfile={userProfile} onNew={handleNewRoadmap} onOpen={handleOpenRoadmap} />}

            {view === "form" && (
                <div className="max-w-2xl mx-auto">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/15 flex items-center justify-center shadow-soft">
                            <Map className="w-6 h-6 text-primary" strokeWidth={2.5} />
                        </div>
                        <div>
                            <h2 className="font-display font-extrabold text-2xl text-foreground tracking-tight">New Study Roadmap</h2>
                            <p className="text-sm text-muted-foreground">Fill in your assessment details — AI will do the rest</p>
                        </div>
                    </div>
                    <RoadmapForm onGenerated={handleRoadmapGenerated} userProfile={userProfile} />
                </div>
            )}

            {view === "display" && activeRoadmap && (
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                        <div className="min-w-0">
                            <h2 className="font-display font-extrabold text-2xl text-foreground tracking-tight truncate">
                                {activeRoadmap.subject}
                            </h2>
                            <p className="text-sm text-muted-foreground truncate">
                                {activeRoadmap.topic} · {activeRoadmap.assessment_type}
                            </p>
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
        <div className="max-w-4xl mx-auto space-y-8">
            {/* Hero — Direction A: subtle gradient + soft borders, no high-contrast gradient blast */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/8 via-primary/5 to-surface border border-primary/15 shadow-soft p-8 lg:p-10">
                <Map className="absolute -top-6 -right-6 w-40 h-40 text-primary/[0.06] pointer-events-none" />
                <div className="relative z-10 max-w-2xl">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                            <Map className="w-6 h-6 text-primary" strokeWidth={2.5} />
                        </div>
                        <div>
                            <p className="stat-label text-primary/80 mb-0.5">AI + Study Science</p>
                            <h1 className="font-display font-extrabold text-3xl lg:text-4xl text-foreground tracking-tight leading-none">
                                Study Roadmap
                            </h1>
                        </div>
                    </div>
                    <p className="text-foreground text-base lg:text-lg leading-relaxed mb-6 max-w-xl">
                        Tell AcedIt what you're studying and when your assessment is — it'll generate a personalised, day-by-day plan using your quiz history, flashcard performance, and cognitive science principles.
                    </p>
                    <Button
                        onClick={onNew}
                        size="lg"
                        className="btn-3d bg-primary text-primary-foreground hover:bg-primary"
                    >
                        <Sparkles className="w-5 h-5 mr-2" />
                        {roadmaps.length === 0 ? "Generate my first roadmap" : "Create new roadmap"}
                    </Button>
                    {!userIsPremium && (
                        <p className="text-muted-foreground text-xs mt-4 leading-relaxed">
                            Free: 1 roadmap · day 1 only &nbsp;|&nbsp; Premium: unlimited roadmaps, full plan, confidence tracking.
                        </p>
                    )}
                </div>
            </div>

            {/* Feature highlights — Direction A: neutral cards, single accent per feature.
                Static Tailwind classes only (JIT can't see template strings). */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                    { icon: Brain,  title: "Weak-area detection",   desc: "Scans your quiz scores and flashcards to find gaps before building the plan.",  iconWrap: "bg-chart-4/10 border-chart-4/15", iconText: "text-chart-4" },
                    { icon: Target, title: "Day-by-day plan",       desc: "Sequenced with cognitive-load theory, spaced repetition, and retrieval practice.", iconWrap: "bg-primary/10 border-primary/15", iconText: "text-primary" },
                    { icon: Clock,  title: "Confidence checkpoints", desc: "Rate your confidence each day — the plan adapts with consolidation days.",     iconWrap: "bg-chart-3/10 border-chart-3/15", iconText: "text-chart-3" },
                ].map((f) => (
                    <div key={f.title} className="card-soft p-5 transition-colors hover:border-primary/20">
                        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-3 ${f.iconWrap}`}>
                            <f.icon className={`w-5 h-5 ${f.iconText}`} strokeWidth={2.5} />
                        </div>
                        <p className="font-display font-extrabold text-foreground text-sm mb-1">{f.title}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                    </div>
                ))}
            </div>

            {/* Past roadmaps */}
            {roadmaps.length === 0 ? (
                <EmptyState
                    icon={Map}
                    title="No roadmaps yet"
                    description="Pick a subject and assessment date, and AI will build the rest."
                    tone="muted"
                    size="sm"
                />
            ) : (
                <div>
                    <h2 className="font-display font-extrabold text-foreground text-lg mb-3">Your roadmaps</h2>
                    <div className="space-y-2">
                        {roadmaps.map(r => (
                            <button
                                key={r.id}
                                onClick={() => onOpen(r)}
                                className="w-full text-left card-soft card-soft-hover p-4 flex items-center justify-between gap-4 group"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center flex-shrink-0">
                                        <Map className="w-5 h-5 text-primary" strokeWidth={2.5} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-foreground text-sm truncate">{r.subject}</p>
                                        <p className="text-xs text-muted-foreground truncate">{r.topic}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="pill bg-primary/10 text-primary text-[10px] hidden sm:inline-flex">{r.assessment_type}</span>
                                    <span className="pill bg-muted text-muted-foreground text-[10px]">{r.days_until}d</span>
                                    <span className="text-xs text-muted-foreground hidden sm:block">{r.created_date ? format(new Date(r.created_date), "d MMM") : ""}</span>
                                    <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-primary transition-colors" />
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
