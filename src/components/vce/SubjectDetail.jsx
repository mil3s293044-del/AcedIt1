
import React from "react";
import { Button } from "@/components/ui/button";
import {
    ArrowLeft,
    BookOpen,
    Target,
    BarChart3,
    Lightbulb,
    CheckCircle,
    TrendingUp,
    Users,
    Clock,
    Calculator,
    Edit2,
    Trash2
} from "lucide-react";

// Static lookup for subject.color values → full Tailwind class strings (avoid JIT interpolation pitfalls)
const SUBJECT_COLOR_CLASSES = {
    primary:   { bg: "bg-primary",   bgSoft: "bg-primary/10",   text: "text-primary",   ring: "ring-primary/20" },
    xp:        { bg: "bg-xp",        bgSoft: "bg-xp/10",        text: "text-xp",        ring: "ring-xp/20" },
    streak:    { bg: "bg-streak",    bgSoft: "bg-streak/10",    text: "text-streak",    ring: "ring-streak/20" },
    "chart-3": { bg: "bg-chart-3",   bgSoft: "bg-chart-3/10",   text: "text-chart-3",   ring: "ring-chart-3/20" },
    "chart-4": { bg: "bg-chart-4",   bgSoft: "bg-chart-4/10",   text: "text-chart-4",   ring: "ring-chart-4/20" },
};

const DIFFICULTY_PILL = {
    beginner:     "bg-primary/10 text-primary",
    intermediate: "bg-xp/10 text-xp",
    advanced:     "bg-streak/10 text-streak",
};

const SCALING_PILL = {
    high_scaling:     "bg-primary/10 text-primary",
    moderate_scaling: "bg-xp/10 text-xp",
    low_scaling:      "bg-streak/10 text-streak",
};

export default function SubjectDetail({ subject, onBack, onEdit, onDelete }) {
    const getDifficultyColor = (level) => {
        return DIFFICULTY_PILL[level] || "bg-secondary text-muted-foreground";
    };

    const getScalingColor = (reputation) => {
        if (!reputation) return "bg-secondary text-muted-foreground";
        return SCALING_PILL[reputation] || "bg-secondary text-muted-foreground";
    };

    // Safe helper function to format text
    const formatText = (text) => {
        return text ? text.replace(/_/g, ' ') : 'N/A';
    };

    const headerColor = SUBJECT_COLOR_CLASSES[subject.color] || SUBJECT_COLOR_CLASSES["chart-4"];

    return (
        <div className="p-4 lg:p-8">
            <div className="max-w-4xl mx-auto">
                <Button variant="outline" onClick={onBack} className="mb-6">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Subjects
                </Button>

                <div className="card-soft">
                    <div className="p-6">
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="flex items-start gap-4 mb-6">
                                    <div
                                        className={`w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 ${headerColor.bg}`}
                                    >
                                        <BookOpen className="w-8 h-8 text-white" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h1 className="text-3xl font-bold text-foreground">
                                                {subject.name || "Unknown Subject"}
                                            </h1>
                                            <span className="pill bg-secondary text-foreground font-mono">
                                                {subject.code || "N/A"}
                                            </span>
                                            {subject.is_private && (
                                                <span className="pill bg-chart-4 text-white">Private</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 mb-4 flex-wrap">
                                            <span className={`pill ${getDifficultyColor(subject.difficulty_level)}`}>
                                                {subject.difficulty_level || 'intermediate'} level
                                            </span>
                                            {subject.scaling_info && (
                                                <span className={`pill ${getScalingColor(subject.scaling_info.difficulty_reputation)}`}>
                                                    Scaling: {subject.scaling_info.scaling_factor || 'Unknown'}
                                                </span>
                                            )}
                                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                                <Users className="w-4 h-4" />
                                                <span>Popular choice</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                                <Clock className="w-4 h-4" />
                                                <span>2 year program</span>
                                            </div>
                                        </div>
                                        <p className="text-lg text-muted-foreground leading-relaxed">
                                            {subject.overview || "No overview available."}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            {(onEdit || onDelete) && (
                                <div className="flex gap-2">
                                    {onEdit && (
                                        <Button variant="outline" size="sm" onClick={onEdit}>
                                            <Edit2 className="w-4 h-4 mr-2" />
                                            Edit
                                        </Button>
                                    )}
                                    {onDelete && (
                                        <Button variant="destructive" size="sm" onClick={onDelete}>
                                            <Trash2 className="w-4 h-4 mr-2" />
                                            Delete
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* All content previously directly under motion.div, now inside content wrapper */}
                    <div className="p-6 pt-0">
                        <div className="grid lg:grid-cols-3 gap-6">
                            {/* Main Content */}
                            <div className="lg:col-span-2 space-y-6">
                                {/* Study Design Summary */}
                                {subject.study_design_summary && (
                                    <div className="card-soft">
                                        <div className="p-6 pb-3">
                                            <h3 className="font-display font-extrabold text-foreground flex items-center gap-2">
                                                <Target className="w-5 h-5 text-chart-3" />
                                                Study Design Summary
                                            </h3>
                                        </div>
                                        <div className="p-6 pt-0">
                                            <div className="prose prose-sm max-w-none">
                                                <p className="text-muted-foreground leading-relaxed">
                                                    {subject.study_design_summary}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Assessment Structure */}
                                {subject.assessment_structure && subject.assessment_structure.length > 0 && (
                                    <div className="card-soft">
                                        <div className="p-6 pb-3">
                                            <h3 className="font-display font-extrabold text-foreground flex items-center gap-2">
                                                <BarChart3 className="w-5 h-5 text-primary" />
                                                Assessment Structure
                                            </h3>
                                        </div>
                                        <div className="p-6 pt-0">
                                            <div className="space-y-4">
                                                {subject.assessment_structure.map((assessment, index) => (
                                                    <div key={index} className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
                                                        <div className="flex-1">
                                                            <h4 className="font-medium text-foreground mb-1">
                                                                {assessment.component || "Assessment Component"}
                                                            </h4>
                                                            <p className="text-sm text-muted-foreground">
                                                                {assessment.description || "No description available."}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="text-right">
                                                                <div className="text-2xl font-bold text-foreground">
                                                                    {assessment.percentage || 0}%
                                                                </div>
                                                            </div>
                                                            <div
                                                                className="w-2 h-12 bg-chart-3 rounded-full"
                                                                style={{ height: `${Math.max((assessment.percentage || 0) / 2, 12)}px` }}
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Scaling Information */}
                                {subject.scaling_info && (
                                    <div className="card-soft bg-chart-4/5 border-chart-4/20">
                                        <div className="p-6 pb-3">
                                            <h3 className="font-display font-extrabold flex items-center gap-2 text-chart-4">
                                                <Calculator className="w-5 h-5" />
                                                Scaling & Study Score Information
                                            </h3>
                                        </div>
                                        <div className="p-6 pt-0">
                                            <div className="grid md:grid-cols-2 gap-6">
                                                <div>
                                                    <h4 className="font-semibold text-chart-4 mb-2">Scaling Factor</h4>
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <span className="text-3xl font-bold text-chart-4">
                                                            {subject.scaling_info.scaling_factor || "Unknown"}
                                                        </span>
                                                        <span className={`pill ${getScalingColor(subject.scaling_info.difficulty_reputation)}`}>
                                                            {formatText(subject.scaling_info.difficulty_reputation)}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-foreground">
                                                        {subject.scaling_info.scaling_description || "No scaling information available."}
                                                    </p>
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-chart-4 mb-2">Average Scaled Study Score</h4>
                                                    <div className="text-3xl font-bold text-chart-4 mb-3">
                                                        {subject.scaling_info.mean_study_score || "N/A"}
                                                    </div>
                                                    <p className="text-sm text-foreground">
                                                        This is the average scaled study score achieved by students in this subject.
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="mt-4 p-3 bg-surface/70 rounded-lg">
                                                <p className="text-xs text-muted-foreground">
                                                    💡 <strong>Remember:</strong> Scaling is based on the academic strength of students taking the subject. Choose subjects you're genuinely interested in and can perform well in!
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Study Tips */}
                                {subject.study_tips && subject.study_tips.length > 0 && (
                                    <div className="card-soft">
                                        <div className="p-6 pb-3">
                                            <h3 className="font-display font-extrabold text-foreground flex items-center gap-2">
                                                <Lightbulb className="w-5 h-5 text-xp" />
                                                Study Tips & Strategies
                                            </h3>
                                        </div>
                                        <div className="p-6 pt-0">
                                            <div className="grid gap-3">
                                                {subject.study_tips.map((tip, index) => (
                                                    <div key={index} className="flex items-start gap-3 p-3 bg-xp/5 rounded-lg border border-xp/20">
                                                        <CheckCircle className="w-5 h-5 text-xp mt-0.5 flex-shrink-0" />
                                                        <p className="text-foreground">{tip || "Study tip not available."}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Sidebar */}
                            <div className="space-y-6">
                                {/* Key Skills */}
                                {subject.key_skills && subject.key_skills.length > 0 && (
                                    <div className="card-soft">
                                        <div className="p-6 pb-3">
                                            <h3 className="font-display font-extrabold text-foreground flex items-center gap-2 text-lg">
                                                <TrendingUp className="w-5 h-5 text-chart-4" />
                                                Key Skills
                                            </h3>
                                        </div>
                                        <div className="p-6 pt-0">
                                            <div className="space-y-2">
                                                {subject.key_skills.map((skill, index) => (
                                                    <div key={index} className="flex items-center gap-2">
                                                        <div className="w-2 h-2 bg-chart-4 rounded-full" />
                                                        <span className="text-sm text-muted-foreground">{skill || "Skill not specified"}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Prerequisites */}
                                {subject.prerequisites && subject.prerequisites.length > 0 && (
                                    <div className="card-soft">
                                        <div className="p-6 pb-3">
                                            <h3 className="font-display font-extrabold text-foreground flex items-center gap-2 text-lg">
                                                <BookOpen className="w-5 h-5 text-chart-3" />
                                                Prerequisites
                                            </h3>
                                        </div>
                                        <div className="p-6 pt-0">
                                            <div className="space-y-2">
                                                {subject.prerequisites.map((prereq, index) => (
                                                    <span key={index} className="pill border border-border text-foreground mr-2 mb-2">
                                                        {prereq || "No prerequisite specified"}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Career Pathways */}
                                {subject.career_pathways && subject.career_pathways.length > 0 && (
                                    <div className="card-soft bg-chart-4/5 border-chart-4/20">
                                        <div className="p-6 pb-3">
                                            <h3 className="font-display font-extrabold flex items-center gap-2 text-lg text-chart-4">
                                                <Users className="w-5 h-5" />
                                                Career Pathways
                                            </h3>
                                        </div>
                                        <div className="p-6 pt-0">
                                            <div className="space-y-2">
                                                {subject.career_pathways.map((career, index) => (
                                                    <div key={index} className="flex items-center gap-2">
                                                        <div className="w-2 h-2 bg-chart-4 rounded-full" />
                                                        <span className="text-sm text-foreground">{career || "Career path not specified"}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="mt-4 p-3 bg-surface/70 rounded-lg">
                                                <p className="text-xs text-muted-foreground">
                                                    💡 These are just some of the many career opportunities available. Talk to a career counselor for personalized advice!
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
