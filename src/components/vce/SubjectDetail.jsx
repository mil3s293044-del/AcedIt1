
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

export default function SubjectDetail({ subject, onBack, onEdit, onDelete }) {
    const getDifficultyColor = (level) => {
        switch (level) {
            case "beginner": return "bg-green-100 text-green-800 border-green-200";
            case "intermediate": return "bg-yellow-100 text-yellow-800 border-yellow-200";
            case "advanced": return "bg-red-100 text-red-800 border-red-200";
            default: return "bg-gray-100 text-gray-800 border-gray-200";
        }
    };

    const getScalingColor = (reputation) => {
        if (!reputation) return "bg-gray-100 text-gray-800 border-gray-200";

        switch (reputation) {
            case "high_scaling": return "bg-green-100 text-green-800 border-green-200";
            case "moderate_scaling": return "bg-yellow-100 text-yellow-800 border-yellow-200";
            case "low_scaling": return "bg-orange-100 text-orange-800 border-orange-200";
            default: return "bg-gray-100 text-gray-800 border-gray-200";
        }
    };

    // Safe helper function to format text
    const formatText = (text) => {
        return text ? text.replace(/_/g, ' ') : 'N/A';
    };

    return (
        <div className="p-4 lg:p-8">
            <div className="max-w-4xl mx-auto">
                <Button variant="outline" onClick={onBack} className="mb-6">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Subjects
                </Button>

                <Card>
                    <CardHeader>
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="flex items-start gap-4 mb-6">
                                    <div 
                                        className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0"
                                        style={{ backgroundColor: subject.color || '#3B82F6' }}
                                    >
                                        <BookOpen className="w-8 h-8 text-white" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h1 className="text-3xl font-bold text-gray-900">
                                                {subject.name || "Unknown Subject"}
                                            </h1>
                                            <Badge variant="secondary" className="text-sm font-mono">
                                                {subject.code || "N/A"}
                                            </Badge>
                                            {subject.is_private && (
                                                <Badge className="bg-purple-600 text-white hover:bg-purple-700">Private</Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 mb-4 flex-wrap">
                                            <Badge
                                                variant="secondary"
                                                className={getDifficultyColor(subject.difficulty_level)}
                                            >
                                                {subject.difficulty_level || 'intermediate'} level
                                            </Badge>
                                            {subject.scaling_info && (
                                                <Badge
                                                    variant="secondary"
                                                    className={getScalingColor(subject.scaling_info.difficulty_reputation)}
                                                >
                                                    Scaling: {subject.scaling_info.scaling_factor || 'Unknown'}
                                                </Badge>
                                            )}
                                            <div className="flex items-center gap-1 text-sm text-gray-600">
                                                <Users className="w-4 h-4" />
                                                <span>Popular choice</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-sm text-gray-600">
                                                <Clock className="w-4 h-4" />
                                                <span>2 year program</span>
                                            </div>
                                        </div>
                                        <p className="text-lg text-gray-700 leading-relaxed">
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
                    </CardHeader>

                    {/* All content previously directly under motion.div, now inside CardContent */}
                    <CardContent className="p-6 pt-0">
                        <div className="grid lg:grid-cols-3 gap-6">
                            {/* Main Content */}
                            <div className="lg:col-span-2 space-y-6">
                                {/* Study Design Summary */}
                                {subject.study_design_summary && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2">
                                                <Target className="w-5 h-5 text-blue-600" />
                                                Study Design Summary
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="prose prose-sm max-w-none">
                                                <p className="text-gray-700 leading-relaxed">
                                                    {subject.study_design_summary}
                                                </p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Assessment Structure */}
                                {subject.assessment_structure && subject.assessment_structure.length > 0 && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2">
                                                <BarChart3 className="w-5 h-5 text-green-600" />
                                                Assessment Structure
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-4">
                                                {subject.assessment_structure.map((assessment, index) => (
                                                    <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                                        <div className="flex-1">
                                                            <h4 className="font-medium text-gray-900 mb-1">
                                                                {assessment.component || "Assessment Component"}
                                                            </h4>
                                                            <p className="text-sm text-gray-600">
                                                                {assessment.description || "No description available."}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="text-right">
                                                                <div className="text-2xl font-bold text-gray-900">
                                                                    {assessment.percentage || 0}%
                                                                </div>
                                                            </div>
                                                            <div
                                                                className="w-2 h-12 bg-gradient-to-t from-blue-200 to-blue-500 rounded-full"
                                                                style={{ height: `${Math.max((assessment.percentage || 0) / 2, 12)}px` }}
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Scaling Information */}
                                {subject.scaling_info && (
                                    <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200/50">
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2 text-purple-900">
                                                <Calculator className="w-5 h-5" />
                                                Scaling & Study Score Information
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="grid md:grid-cols-2 gap-6">
                                                <div>
                                                    <h4 className="font-semibold text-purple-900 mb-2">Scaling Factor</h4>
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <span className="text-3xl font-bold text-purple-900">
                                                            {subject.scaling_info.scaling_factor || "Unknown"}
                                                        </span>
                                                        <Badge className={getScalingColor(subject.scaling_info.difficulty_reputation)}>
                                                            {formatText(subject.scaling_info.difficulty_reputation)}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-sm text-purple-800">
                                                        {subject.scaling_info.scaling_description || "No scaling information available."}
                                                    </p>
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-purple-900 mb-2">Average Scaled Study Score</h4>
                                                    <div className="text-3xl font-bold text-purple-900 mb-3">
                                                        {subject.scaling_info.mean_study_score || "N/A"}
                                                    </div>
                                                    <p className="text-sm text-purple-800">
                                                        This is the average scaled study score achieved by students in this subject.
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="mt-4 p-3 bg-white/70 rounded-lg">
                                                <p className="text-xs text-purple-700">
                                                    💡 <strong>Remember:</strong> Scaling is based on the academic strength of students taking the subject. Choose subjects you're genuinely interested in and can perform well in!
                                                </p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Study Tips */}
                                {subject.study_tips && subject.study_tips.length > 0 && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2">
                                                <Lightbulb className="w-5 h-5 text-yellow-600" />
                                                Study Tips & Strategies
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="grid gap-3">
                                                {subject.study_tips.map((tip, index) => (
                                                    <div key={index} className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200/50">
                                                        <CheckCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                                                        <p className="text-gray-700">{tip || "Study tip not available."}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>

                            {/* Sidebar */}
                            <div className="space-y-6">
                                {/* Key Skills */}
                                {subject.key_skills && subject.key_skills.length > 0 && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2 text-lg">
                                                <TrendingUp className="w-5 h-5 text-purple-600" />
                                                Key Skills
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-2">
                                                {subject.key_skills.map((skill, index) => (
                                                    <div key={index} className="flex items-center gap-2">
                                                        <div className="w-2 h-2 bg-purple-500 rounded-full" />
                                                        <span className="text-sm text-gray-700">{skill || "Skill not specified"}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Prerequisites */}
                                {subject.prerequisites && subject.prerequisites.length > 0 && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2 text-lg">
                                                <BookOpen className="w-5 h-5 text-blue-600" />
                                                Prerequisites
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-2">
                                                {subject.prerequisites.map((prereq, index) => (
                                                    <Badge key={index} variant="outline" className="mr-2 mb-2">
                                                        {prereq || "No prerequisite specified"}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Career Pathways */}
                                {subject.career_pathways && subject.career_pathways.length > 0 && (
                                    <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200/50">
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2 text-lg text-indigo-900">
                                                <Users className="w-5 h-5" />
                                                Career Pathways
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-2">
                                                {subject.career_pathways.map((career, index) => (
                                                    <div key={index} className="flex items-center gap-2">
                                                        <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                                                        <span className="text-sm text-indigo-800">{career || "Career path not specified"}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="mt-4 p-3 bg-white/70 rounded-lg">
                                                <p className="text-xs text-indigo-700">
                                                    💡 These are just some of the many career opportunities available. Talk to a career counselor for personalized advice!
                                                </p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
