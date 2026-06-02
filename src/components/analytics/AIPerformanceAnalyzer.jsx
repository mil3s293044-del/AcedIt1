import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Sparkles,
    Target,
    Clock,
    Brain,
    TrendingUp,
    CheckCircle2,
    AlertTriangle,
    Loader2,
    BookOpen,
    Calendar,
    BarChart3,
    Lightbulb,
    ArrowRight,
    ChevronDown,
    ChevronUp
} from "lucide-react";
import { base44 } from "@/api/base44Client";

// Static token lookup tables (avoid Tailwind JIT dynamic interpolation gotchas).
const gradeStyles = {
    'A+': { tile: 'bg-primary',   tint: 'bg-primary/10',   border: 'border-primary/30',   text: 'text-primary'   },
    'A':  { tile: 'bg-primary',   tint: 'bg-primary/10',   border: 'border-primary/30',   text: 'text-primary'   },
    'B+': { tile: 'bg-primary',   tint: 'bg-primary/10',   border: 'border-primary/30',   text: 'text-primary'   },
    'B':  { tile: 'bg-primary',   tint: 'bg-primary/10',   border: 'border-primary/30',   text: 'text-primary'   },
    'C+': { tile: 'bg-xp',        tint: 'bg-xp/10',        border: 'border-xp/30',        text: 'text-xp'        },
    'C':  { tile: 'bg-xp',        tint: 'bg-xp/10',        border: 'border-xp/30',        text: 'text-xp'        },
    'D':  { tile: 'bg-streak',    tint: 'bg-streak/10',    border: 'border-streak/30',    text: 'text-streak'    },
    'F':  { tile: 'bg-streak',    tint: 'bg-streak/10',    border: 'border-streak/30',    text: 'text-streak'    },
};

const fallbackGrade = { tile: 'bg-secondary', tint: 'bg-secondary/50', border: 'border-border', text: 'text-muted-foreground' };

const metricBarTokens = {
    high:    { tile: 'bg-primary',  bar: '[&>div]:bg-primary'  },
    good:    { tile: 'bg-primary',  bar: '[&>div]:bg-primary'  },
    mid:     { tile: 'bg-xp',       bar: '[&>div]:bg-xp'       },
    low:     { tile: 'bg-streak',   bar: '[&>div]:bg-streak'   },
    crit:    { tile: 'bg-streak',   bar: '[&>div]:bg-streak'   },
};

const MetricCard = ({ label, score, maxScore, icon: Icon, description }) => {
    const percentage = Math.round((score / maxScore) * 100);
    const tokenKey =
        percentage >= 80 ? 'high' :
        percentage >= 60 ? 'good' :
        percentage >= 40 ? 'mid'  :
        percentage >= 20 ? 'low'  : 'crit';
    const t = metricBarTokens[tokenKey];

    return (
        <div className="bg-secondary/50 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-lg ${t.tile} flex items-center justify-center`}>
                    <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                    <p className="font-medium text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                </div>
                <span className="text-lg font-bold text-foreground">{score}/{maxScore}</span>
            </div>
            <Progress value={percentage} className={`h-2 ${t.bar}`} />
        </div>
    );
};

export default function AIPerformanceAnalyzer({ data, userProfile }) {
    const [selectedSubject, setSelectedSubject] = useState(null);
    const [analysis, setAnalysis] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [expandedFeedback, setExpandedFeedback] = useState({});

    const subjects = data.subjects || [];

    useEffect(() => {
        if (subjects.length > 0 && !selectedSubject) {
            setSelectedSubject(subjects[0].subject_name);
        }
    }, [subjects]);

    const gatherSubjectData = (subjectName) => {
        const subject = subjects.find(s => s.subject_name === subjectName);
        if (!subject) return null;

        // Study sessions for this subject
        const studySessions = data.techniques.filter(t => t.subject === subjectName);
        const activeRecallSessions = (data.activeRecall || []).filter(s => s.subject_name === subjectName);
        const blurtingSessions = (data.blurting || []).filter(s => s.subject_name === subjectName);

        // Total study time
        const totalStudyMinutes =
            studySessions.reduce((sum, s) => sum + (s.session_duration || 0), 0) +
            activeRecallSessions.reduce((sum, s) => sum + (s.session_duration || 0), 0) +
            blurtingSessions.reduce((sum, s) => sum + (s.session_duration || 0), 0);

        // Unique study days
        const allDates = [
            ...studySessions.map(s => s.date),
            ...activeRecallSessions.map(s => s.date),
            ...blurtingSessions.map(s => s.date)
        ].filter(Boolean);
        const uniqueDays = new Set(allDates).size;

        // Technique diversity
        const techniques = new Set();
        studySessions.forEach(s => techniques.add(s.technique_name));
        if (activeRecallSessions.length > 0) techniques.add('active_recall');
        if (blurtingSessions.length > 0) techniques.add('blurting');

        // Flashcards for this subject
        const flashcards = data.flashcards.filter(f => f.subject_name === subjectName);
        const masteredFlashcards = flashcards.filter(f => ((f.review_count_good || 0) + (f.review_count_easy || 0)) >= 3);

        // Quiz performance
        const quizzes = (data.quizzes || []).filter(q =>
            q.quiz_title?.toLowerCase().includes(subjectName.toLowerCase())
        );
        const avgQuizScore = quizzes.length > 0
            ? Math.round(quizzes.reduce((sum, q) => sum + (q.score || 0), 0) / quizzes.length)
            : null;

        return {
            subject,
            goalStudyScore: subject.goal_study_score || null,
            totalStudyMinutes,
            totalStudyHours: Math.round(totalStudyMinutes / 60 * 10) / 10,
            uniqueDays,
            totalSessions: studySessions.length + activeRecallSessions.length + blurtingSessions.length,
            techniqueCount: techniques.size,
            techniques: Array.from(techniques),
            flashcardCount: flashcards.length,
            masteredFlashcards: masteredFlashcards.length,
            quizCount: quizzes.length,
            avgQuizScore,
            priority: subject.priority || 'medium'
        };
    };

    const analyzePerformance = async () => {
        if (!selectedSubject) return;

        setIsAnalyzing(true);
        setAnalysis(null);

        try {
            const subjectData = gatherSubjectData(selectedSubject);
            if (!subjectData) {
                setIsAnalyzing(false);
                return;
            }

            // Calculate all subjects data for comparison
            const allSubjectsData = subjects.map(s => ({
                name: s.subject_name,
                studyMinutes: data.techniques.filter(t => t.subject === s.subject_name)
                    .reduce((sum, t) => sum + (t.session_duration || 0), 0) +
                    (data.activeRecall || []).filter(ar => ar.subject_name === s.subject_name)
                    .reduce((sum, s) => sum + (s.session_duration || 0), 0) +
                    (data.blurting || []).filter(b => b.subject_name === s.subject_name)
                    .reduce((sum, s) => sum + (s.session_duration || 0), 0),
                goalScore: s.goal_study_score
            }));

            const totalStudyAcrossSubjects = allSubjectsData.reduce((sum, s) => sum + s.studyMinutes, 0);
            const subjectPercentage = totalStudyAcrossSubjects > 0
                ? Math.round((subjectData.totalStudyMinutes / totalStudyAcrossSubjects) * 100)
                : 0;

            const prompt = `Analyze this VCE student's performance for ${selectedSubject} and provide detailed, actionable feedback.

STUDENT DATA FOR ${selectedSubject}:
- Target Study Score: ${subjectData.goalStudyScore ? subjectData.goalStudyScore + '/50' : 'Not set'}
- Subject Priority: ${subjectData.priority}
- Total Study Time: ${subjectData.totalStudyHours} hours
- Days Studied: ${subjectData.uniqueDays} days
- Total Sessions: ${subjectData.totalSessions}
- Study Techniques Used: ${subjectData.techniques.length > 0 ? subjectData.techniques.join(', ') : 'None recorded'}
- Technique Variety: ${subjectData.techniqueCount} different techniques
- Flashcards Created: ${subjectData.flashcardCount}
- Flashcards Mastered: ${subjectData.masteredFlashcards}
- Quizzes Completed: ${subjectData.quizCount}
- Average Quiz Score: ${subjectData.avgQuizScore !== null ? subjectData.avgQuizScore + '%' : 'No quizzes'}
- Time Allocation: ${subjectPercentage}% of total study time across all subjects

CONTEXT:
- This is for a VCE study app where students track their study
- The student can use Pomodoro timer, Spaced Repetition flashcards, Active Recall, Blurting method, and take quizzes
- Study scores range from 0-50 (30 is average, 40+ is excellent)

Provide analysis in the following format - be specific and mention actual numbers from the data:

1. METRICS (score each out of 10):
- goal_setting: How well have they defined their target? (consider if goal is set and if it's realistic)
- time_management: Are they studying consistently? (look at days studied vs total time)
- study_volume: Is the total study time appropriate for their goal?
- technique_diversity: Are they using multiple study methods?
- retention_focus: Are they using flashcards/spaced repetition effectively?
- assessment_practice: Are they doing enough quizzes and how are they performing?

2. OVERALL_GRADE: Give an overall letter grade (A+, A, B+, B, C+, C, D, or F)

3. FEEDBACK for each metric area - provide:
- What they're doing well (be specific with numbers)
- What needs improvement
- One actionable tip they can implement TODAY on the app

4. PRIORITY_ACTIONS: List 3 most important things they should focus on immediately`;

            const response = await base44.integrations.Core.InvokeLLM({
                prompt,
                response_json_schema: {
                    type: "object",
                    properties: {
                        metrics: {
                            type: "object",
                            properties: {
                                goal_setting: { type: "number" },
                                time_management: { type: "number" },
                                study_volume: { type: "number" },
                                technique_diversity: { type: "number" },
                                retention_focus: { type: "number" },
                                assessment_practice: { type: "number" }
                            }
                        },
                        overall_grade: { type: "string" },
                        feedback: {
                            type: "object",
                            properties: {
                                goal_setting: {
                                    type: "object",
                                    properties: {
                                        strengths: { type: "string" },
                                        improvements: { type: "string" },
                                        action: { type: "string" }
                                    }
                                },
                                time_management: {
                                    type: "object",
                                    properties: {
                                        strengths: { type: "string" },
                                        improvements: { type: "string" },
                                        action: { type: "string" }
                                    }
                                },
                                study_volume: {
                                    type: "object",
                                    properties: {
                                        strengths: { type: "string" },
                                        improvements: { type: "string" },
                                        action: { type: "string" }
                                    }
                                },
                                technique_diversity: {
                                    type: "object",
                                    properties: {
                                        strengths: { type: "string" },
                                        improvements: { type: "string" },
                                        action: { type: "string" }
                                    }
                                },
                                retention_focus: {
                                    type: "object",
                                    properties: {
                                        strengths: { type: "string" },
                                        improvements: { type: "string" },
                                        action: { type: "string" }
                                    }
                                },
                                assessment_practice: {
                                    type: "object",
                                    properties: {
                                        strengths: { type: "string" },
                                        improvements: { type: "string" },
                                        action: { type: "string" }
                                    }
                                }
                            }
                        },
                        priority_actions: {
                            type: "array",
                            items: { type: "string" }
                        }
                    },
                    required: ["metrics", "overall_grade", "feedback", "priority_actions"]
                }
            });

            setAnalysis({
                ...response,
                subjectData
            });

        } catch (error) {
            console.error("Error analyzing performance:", error);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const toggleFeedback = (key) => {
        setExpandedFeedback(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const metricLabels = {
        goal_setting: { label: 'Goal Setting', icon: Target, desc: 'Clear targets and planning' },
        time_management: { label: 'Time Management', icon: Calendar, desc: 'Consistency and scheduling' },
        study_volume: { label: 'Study Volume', icon: Clock, desc: 'Total time invested' },
        technique_diversity: { label: 'Technique Diversity', icon: Brain, desc: 'Variety in study methods' },
        retention_focus: { label: 'Retention Focus', icon: BookOpen, desc: 'Flashcards and spaced repetition' },
        assessment_practice: { label: 'Assessment Practice', icon: BarChart3, desc: 'Quiz performance and practice' }
    };

    if (subjects.length === 0) {
        return (
            <div className="card-soft">
                <div className="p-12 text-center">
                    <Sparkles className="w-16 h-16 text-muted-foreground/60 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-foreground mb-2">No Subjects Added</h3>
                    <p className="text-muted-foreground">Add subjects in the Subjects page to get AI performance analysis</p>
                </div>
            </div>
        );
    }

    const gradeStyle = gradeStyles[analysis?.overall_grade] || fallbackGrade;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="card-soft bg-chart-4/10 border-chart-4/20">
                <div className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-chart-4/20 rounded-xl flex items-center justify-center">
                                <Brain className="w-7 h-7 text-chart-4" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-foreground">AI Performance Analyzer</h2>
                                <p className="text-muted-foreground">Get personalized insights and actionable feedback</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Select value={selectedSubject || ''} onValueChange={setSelectedSubject}>
                                <SelectTrigger className="w-48 bg-surface border-border text-foreground">
                                    <SelectValue placeholder="Select subject" />
                                </SelectTrigger>
                                <SelectContent>
                                    {subjects.map(s => (
                                        <SelectItem key={s.id} value={s.subject_name}>
                                            {s.subject_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button
                                onClick={analyzePerformance}
                                disabled={isAnalyzing || !selectedSubject}
                                className="bg-chart-4 text-white hover:bg-chart-4/90"
                            >
                                {isAnalyzing ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Analyzing...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4 mr-2" />
                                        Analyze
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Analysis Results */}
            {analysis && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                >
                    {/* Overall Grade Card */}
                    <div className={`card-soft ${gradeStyle.tint} ${gradeStyle.border}`}>
                        <div className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground mb-1">Overall Performance Grade</p>
                                    <h3 className="text-xl font-semibold text-foreground">{selectedSubject}</h3>
                                    {analysis.subjectData.goalStudyScore && (
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Target: {analysis.subjectData.goalStudyScore}/50 Study Score
                                        </p>
                                    )}
                                </div>
                                <div className={`w-20 h-20 ${gradeStyle.tile} rounded-2xl flex items-center justify-center shadow-soft`}>
                                    <span className="text-3xl font-black text-white">{analysis.overall_grade}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="card-soft">
                        <div className="p-6 pb-3">
                            <div className="flex items-center gap-2 font-semibold text-foreground">
                                <TrendingUp className="w-5 h-5 text-chart-4" />
                                Performance Metrics
                            </div>
                        </div>
                        <div className="px-6 pb-6 space-y-3">
                            {Object.entries(analysis.metrics).map(([key, score]) => (
                                <MetricCard
                                    key={key}
                                    label={metricLabels[key]?.label || key}
                                    score={score}
                                    maxScore={10}
                                    icon={metricLabels[key]?.icon || Target}
                                    description={metricLabels[key]?.desc || ''}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Priority Actions */}
                    <div className="card-soft bg-xp/10 border-xp/30">
                        <div className="p-6 pb-3">
                            <div className="flex items-center gap-2 font-semibold text-foreground">
                                <Lightbulb className="w-5 h-5 text-xp" />
                                Priority Actions
                            </div>
                        </div>
                        <div className="px-6 pb-6">
                            <div className="space-y-3">
                                {analysis.priority_actions.map((action, idx) => (
                                    <div key={idx} className="flex items-start gap-3 p-3 bg-surface rounded-lg border border-xp/20">
                                        <div className="w-7 h-7 rounded-full bg-xp text-white flex items-center justify-center flex-shrink-0 text-sm font-bold">
                                            {idx + 1}
                                        </div>
                                        <p className="text-foreground text-sm">{action}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Detailed Feedback */}
                    <div className="card-soft">
                        <div className="p-6 pb-3">
                            <div className="flex items-center gap-2 font-semibold text-foreground">
                                <CheckCircle2 className="w-5 h-5 text-primary" />
                                Detailed Feedback
                            </div>
                        </div>
                        <div className="px-6 pb-6 space-y-3">
                            {Object.entries(analysis.feedback).map(([key, fb]) => (
                                <div key={key} className="border border-border rounded-xl overflow-hidden">
                                    <button
                                        onClick={() => toggleFeedback(key)}
                                        className="w-full flex items-center justify-between p-4 bg-secondary/50 hover:bg-secondary transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            {React.createElement(metricLabels[key]?.icon || Target, { className: "w-5 h-5 text-chart-4" })}
                                            <span className="font-medium text-foreground">{metricLabels[key]?.label || key}</span>
                                            <span className="pill bg-chart-4/10 text-chart-4 text-[11px] py-0.5">
                                                {analysis.metrics[key]}/10
                                            </span>
                                        </div>
                                        {expandedFeedback[key] ? (
                                            <ChevronUp className="w-5 h-5 text-muted-foreground/60" />
                                        ) : (
                                            <ChevronDown className="w-5 h-5 text-muted-foreground/60" />
                                        )}
                                    </button>
                                    {expandedFeedback[key] && (
                                        <div className="p-4 space-y-4 bg-surface">
                                            <div className="flex items-start gap-3">
                                                <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                                                    <CheckCircle2 className="w-4 h-4 text-primary" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-primary mb-1">Strengths</p>
                                                    <p className="text-sm text-muted-foreground">{fb.strengths}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-6 h-6 rounded-full bg-streak/15 flex items-center justify-center flex-shrink-0">
                                                    <AlertTriangle className="w-4 h-4 text-streak" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-streak mb-1">Areas to Improve</p>
                                                    <p className="text-sm text-muted-foreground">{fb.improvements}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3 p-3 bg-chart-4/10 rounded-lg">
                                                <ArrowRight className="w-5 h-5 text-chart-4 flex-shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="text-sm font-medium text-chart-4 mb-1">Action Step</p>
                                                    <p className="text-sm text-foreground">{fb.action}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Empty state when no analysis */}
            {!analysis && !isAnalyzing && (
                <div className="card-soft bg-secondary/50 border-dashed border-2 border-border">
                    <div className="p-12 text-center">
                        <Sparkles className="w-12 h-12 text-muted-foreground/60 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-foreground mb-2">Ready to Analyze</h3>
                        <p className="text-muted-foreground mb-4">Select a subject and click "Analyze" to get AI-powered performance insights</p>
                    </div>
                </div>
            )}
        </div>
    );
}
