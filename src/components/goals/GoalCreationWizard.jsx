import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import {
    Target, Calendar, ChevronRight, ChevronLeft, Plus, Trash2,
    Sparkles, Trophy, Zap, Loader2, GripVertical, Lock, CheckCircle2,
    BookOpen, BarChart3, FileText, ClipboardList, Star, TrendingUp,
    Minus, Brain, Lightbulb, RefreshCw, PenLine, X, Check
} from "lucide-react";

const ASSESSMENT_TYPES = [
    { value: "SAC", label: "SAC", icon: "📝", desc: "School-Assessed Coursework" },
    { value: "Test", label: "Test", icon: "✏️", desc: "In-class test" },
    { value: "Exam", label: "Exam", icon: "🎓", desc: "End-of-year exam" },
    { value: "Assignment", label: "Assignment", icon: "📋", desc: "Take-home assignment" },
];

const STEPS = ["Details", "Sub-Goals", "Review"];

export default function GoalCreationWizard({ userSubjects, onGoalCreated, onCancel }) {
    const { toast } = useToast();
    const [step, setStep] = useState(0);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [generatedData, setGeneratedData] = useState(null);
    const [adjustedTargets, setAdjustedTargets] = useState({});

    const [form, setForm] = useState({
        title: "",
        subject_code: "",
        subject_name: "",
        assessment_type: "",
        target_score: 80,
        target_date: "",
        importance: 3,        // 1-5
        confidence: 3,        // 1-5
        success_criteria: "",
    });

    const [subGoals, setSubGoals] = useState([
        { id: `sg_${Date.now()}`, title: "" }
    ]);

    // Step 2 editing state
    const [editableHierarchy, setEditableHierarchy] = useState(null); // mirrors generatedData.sub_goals_hierarchy but editable
    const [regeneratingIdx, setRegeneratingIdx] = useState(null); // which sub-goal is being regenerated
    const [customInputs, setCustomInputs] = useState({}); // { sgIdx: "" } typed custom item text
    const [interpretingIdx, setInterpretingIdx] = useState(null); // which sg is being interpreted

    const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

    const canProceedStep0 = form.title && form.subject_code && form.assessment_type && form.target_date && form.success_criteria;
    const canProceedStep1 = subGoals.filter(sg => sg.title.trim()).length >= 1;

    const addSubGoal = () => {
        setSubGoals(prev => [...prev, { id: `sg_${Date.now()}`, title: "" }]);
    };

    const removeSubGoal = (id) => {
        setSubGoals(prev => prev.filter(sg => sg.id !== id));
    };

    const updateSubGoal = (id, title) => {
        setSubGoals(prev => prev.map(sg => sg.id === id ? { ...sg, title } : sg));
    };

    const handleGenerate = async () => {
        setIsGenerating(true);
        const validSubGoals = subGoals.filter(sg => sg.title.trim()).map(sg => sg.title.trim());
        try {
            const { data } = await base44.functions.invoke('generateGoalWithAI', {
                title: form.title,
                description: `${form.assessment_type} for ${form.subject_name}. Target: ${form.target_score}%. Success criteria: ${form.success_criteria}`,
                target_date: form.target_date,
                category: "subject_milestone",
                subject_code: form.subject_code,
                subject_name: form.subject_name,
                user_sub_goals: validSubGoals,
                assessment_type: form.assessment_type,
                target_score: form.target_score,
                importance: form.importance,
                confidence: form.confidence,
            });
            setGeneratedData(data);
            setAdjustedTargets({});
            // Deep clone the hierarchy for editable state
            setEditableHierarchy(JSON.parse(JSON.stringify(data.sub_goals_hierarchy || [])));
            setStep(2);
        } catch (err) {
            toast({ title: "AI Generation Failed", description: err.message, variant: "destructive" });
        } finally {
            setIsGenerating(false);
        }
    };

    // Updates a baked-in target number in the AI-generated title when user changes the slider
    const updateTitleWithTarget = (title, oldTarget, newTarget, type) => {
        if (!title || oldTarget === newTarget) return title;
        const patterns = {
            study_hours: { re: /(\d+\.?\d*)\s*(hour|hours|hr|hrs)/i, fmt: n => `${n} ${n === 1 ? 'hour' : 'hours'}` },
            quiz_count: { re: /(\d+)\s*(quiz|quizzes)/i, fmt: n => `${n} ${n === 1 ? 'quiz' : 'quizzes'}` },
            flashcard_reviews: { re: /(\d+)\s*(flashcard|flashcards|card|cards)/i, fmt: n => `${n} ${n === 1 ? 'flashcard' : 'flashcards'}` },
            study_sessions: { re: /(\d+)\s*(session|sessions)/i, fmt: n => `${n} ${n === 1 ? 'session' : 'sessions'}` },
            quiz_score: { re: /(\d+)\s*%/, fmt: n => `${n}%` },
        };
        const p = patterns[type];
        if (!p) return title;
        return title.replace(p.re, p.fmt(newTarget));
    };

    // XP scales linearly with how much target is vs base
    const getAdjustedXP = (baseXp, baseTarget, adjustedTarget, type) => {
        if (!baseTarget || baseTarget === 0) return baseXp;
        const ratio = adjustedTarget / baseTarget;
        // For quiz_score type, ratio doesn't scale XP the same way (it's a %)
        if (type === 'quiz_score') return Math.round(baseXp * Math.max(0.5, Math.min(2, ratio)));
        return Math.round(baseXp * Math.max(0.3, Math.min(3, ratio)));
    };

    const getAdjustedItem = (sgIdx, aiIdx, ai) => {
        const key = `${sgIdx}_${aiIdx}`;
        const adjustedTarget = adjustedTargets[key] !== undefined ? adjustedTargets[key] : ai.target;
        const adjustedXp = getAdjustedXP(ai.xp_reward, ai.target, adjustedTarget, ai.type);
        const adjustedTitle = updateTitleWithTarget(ai.title, ai.target, adjustedTarget, ai.type);
        return { ...ai, title: adjustedTitle, target: adjustedTarget, xp_reward: adjustedXp };
    };

    // ── Step 2 helpers ────────────────────────────────────────────

    const deleteAiItem = (sgIdx, aidx) => {
        setEditableHierarchy(prev => {
            const updated = JSON.parse(JSON.stringify(prev));
            updated[sgIdx].ai_sub_goals.splice(aidx, 1);
            return updated;
        });
        // Also clear any adjusted target for this item
        const key = `${sgIdx}_${aidx}`;
        setAdjustedTargets(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const regenerateSubGoal = async (sgIdx) => {
        setRegeneratingIdx(sgIdx);
        const sg = editableHierarchy[sgIdx];
        try {
            const { data } = await base44.functions.invoke('generateGoalWithAI', {
                title: form.title,
                description: `${form.assessment_type} for ${form.subject_name}. Target: ${form.target_score}%. Success criteria: ${form.success_criteria}`,
                target_date: form.target_date,
                category: "subject_milestone",
                subject_code: form.subject_code,
                subject_name: form.subject_name,
                user_sub_goals: [sg.title],
                assessment_type: form.assessment_type,
                target_score: form.target_score,
                importance: form.importance,
                confidence: form.confidence,
            });
            const newAiItems = data?.sub_goals_hierarchy?.[0]?.ai_sub_goals || [];
            setEditableHierarchy(prev => {
                const updated = JSON.parse(JSON.stringify(prev));
                updated[sgIdx].ai_sub_goals = newAiItems;
                return updated;
            });
            // Clear adjusted targets for this sub-goal
            setAdjustedTargets(prev => {
                const next = { ...prev };
                Object.keys(next).forEach(k => { if (k.startsWith(`${sgIdx}_`)) delete next[k]; });
                return next;
            });
            toast({ title: "Regenerated!", description: `New challenges for "${sg.title}"` });
        } catch (err) {
            toast({ title: "Regeneration Failed", description: err.message, variant: "destructive" });
        } finally {
            setRegeneratingIdx(null);
        }
    };

    const interpretCustomItem = async (sgIdx) => {
        const text = customInputs[sgIdx]?.trim();
        if (!text) return;
        setInterpretingIdx(sgIdx);
        try {
            const result = await base44.integrations.Core.InvokeLLM({
                prompt: `Convert this student study challenge into a structured trackable goal item for the subject "${form.subject_name}".

Challenge: "${text}"

Choose the BEST type from: study_hours, quiz_count, quiz_score, flashcard_reviews, study_sessions
Set a realistic numeric target and appropriate XP reward (50-300 XP).
Also provide the steps array with 2-3 short action steps.
Navigation should be one of: Study, Quizzes, AITools.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        title: { type: "string" },
                        type: { type: "string" },
                        target: { type: "number" },
                        xp_reward: { type: "number" },
                        steps: { type: "array", items: { type: "string" } },
                        navigation: { type: "string" },
                        subject_filter: { type: "string" }
                    }
                }
            });
            const newItem = {
                title: result.title || text,
                type: result.type || "study_hours",
                target: result.target || 2,
                xp_reward: result.xp_reward || 100,
                steps: result.steps || [],
                navigation: result.navigation || "Study",
                subject_filter: form.subject_name
            };
            setEditableHierarchy(prev => {
                const updated = JSON.parse(JSON.stringify(prev));
                updated[sgIdx].ai_sub_goals.push(newItem);
                return updated;
            });
            setCustomInputs(prev => ({ ...prev, [sgIdx]: "" }));
            toast({ title: "Challenge added!", description: newItem.title });
        } catch (err) {
            toast({ title: "Failed to interpret", description: err.message, variant: "destructive" });
        } finally {
            setInterpretingIdx(null);
        }
    };

    // ───────────────────────────────────────────────────────────────

    const handleSave = async () => {
        if (!generatedData) return;
        setIsSaving(true);

        // Build final sub_goals with adjusted targets/XP
        let finalSubGoals = [];
        const hierarchy = editableHierarchy || generatedData.sub_goals_hierarchy;
        if (hierarchy) {
            finalSubGoals = hierarchy.map((item, idx) => {
                const adjustedAiGoals = (item.ai_sub_goals || []).map((ai, aidx) => getAdjustedItem(idx, aidx, ai));
                const rawSubGoalXP = adjustedAiGoals.reduce((s, i) => s + (i.xp_reward || 0), 0);
                return {
                    id: `sg_${Date.now()}_${idx}`,
                    title: item.title,
                    completed: false,
                    xp_reward: Math.min(360, rawSubGoalXP),
                    steps: [],
                    type: "study_hours",
                    target: 1,
                    current_progress: 0,
                    navigation: "Study",
                    sub_sub_goals: adjustedAiGoals.map((ai, aidx) => ({
                        id: `ssg_${Date.now()}_${idx}_${aidx}`,
                        title: ai.title,
                        completed: false,
                        xp_reward: ai.xp_reward || 0,
                        steps: ai.steps || [],
                        type: ai.type,
                        target: ai.target,
                        current_progress: 0,
                        subject_filter: ai.subject_filter || form.subject_name,
                        navigation: ai.navigation || "Study",
                    }))
                };
            });
        } else if (generatedData.sub_goals) {
            finalSubGoals = generatedData.sub_goals;
        }

        try {
            const urgencyDays = Math.ceil((new Date(form.target_date) - new Date()) / 86400000);
            const goalData = {
                title: form.title,
                description: `${form.assessment_type} — Target: ${form.target_score}% | ${form.success_criteria}`,
                target_date: form.target_date,
                category: "subject_milestone",
                subject_code: form.subject_code,
                priority: form.importance >= 4 ? "high" : form.importance <= 2 ? "low" : "medium",
                milestone_type: "assessment",
                success_criteria: form.success_criteria,
                sub_goals: finalSubGoals,
                tips: generatedData.tips || [],
                total_xp_reward: Math.min(360, generatedData.total_xp_reward || 0),
                difficulty_level: generatedData.difficulty_level || "medium",
                is_ai_generated: true,
                progress: 0,
                is_completed: false,
                tracking_start_date: new Date().toISOString(),
            };

            const newGoal = await base44.entities.Goal.create(goalData);
            toast({ title: "Goal Created! 🎯", description: `${finalSubGoals.length} sub-goals set up with sequential progression.` });
            if (onGoalCreated) onGoalCreated(newGoal);
        } catch (err) {
            toast({ title: "Save Failed", description: err.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const importanceLabels = ["", "Low", "Moderate", "Important", "Very High", "Critical"];
    const confidenceLabels = ["", "Very Low", "Low", "Moderate", "Confident", "Very Confident"];

    return (
        <div className="max-w-2xl mx-auto">
            {/* Step Indicator */}
            <div className="flex items-center justify-center gap-2 mb-8">
                {STEPS.map((s, i) => (
                    <React.Fragment key={s}>
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
                            i === step ? "bg-purple-600 text-white" :
                            i < step ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
                        }`}>
                            {i < step ? <CheckCircle2 className="w-4 h-4" /> : <span>{i + 1}</span>}
                            {s}
                        </div>
                        {i < STEPS.length - 1 && <ChevronRight className="w-4 h-4 text-gray-300" />}
                    </React.Fragment>
                ))}
            </div>

            <AnimatePresence mode="wait">
                {/* STEP 0: Goal Details */}
                {step === 0 && (
                    <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-1">Goal Details</h2>
                            <p className="text-gray-500 text-sm">Define what you want to achieve and why it matters.</p>
                        </div>

                        <div className="space-y-2">
                            <Label>Goal Title *</Label>
                            <Input placeholder="e.g., Ace my Chemistry SAC on Organic Chemistry" value={form.title} onChange={e => set("title", e.target.value)} />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Subject *</Label>
                                <Select value={form.subject_code} onValueChange={v => {
                                    const subj = userSubjects.find(s => s.subject_code === v);
                                    set("subject_code", v);
                                    set("subject_name", subj?.subject_name || v);
                                }}>
                                    <SelectTrigger><SelectValue placeholder="Select subject..." /></SelectTrigger>
                                    <SelectContent>
                                        {userSubjects.map(s => (
                                            <SelectItem key={s.id} value={s.subject_code}>{s.subject_name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Deadline *</Label>
                                <Input type="date" value={form.target_date} min={new Date().toISOString().split('T')[0]} onChange={e => set("target_date", e.target.value)} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Assessment Type *</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {ASSESSMENT_TYPES.map(a => (
                                    <button key={a.value} onClick={() => set("assessment_type", a.value)}
                                        className={`p-3 rounded-xl border-2 text-left transition-all ${form.assessment_type === a.value ? "border-purple-500 bg-purple-50" : "border-gray-200 hover:border-gray-300"}`}>
                                        <div className="text-lg mb-0.5">{a.icon}</div>
                                        <div className="font-semibold text-sm text-gray-900">{a.label}</div>
                                        <div className="text-xs text-gray-500">{a.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label>Target Score: <span className="font-bold text-purple-600">{form.target_score}%</span></Label>
                            <Slider min={40} max={100} step={1} value={[form.target_score]} onValueChange={([v]) => set("target_score", v)} className="py-1" />
                            <div className="flex justify-between text-xs text-gray-400"><span>40%</span><span>100%</span></div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-3">
                                <Label>Importance: <span className="font-semibold text-orange-600">{importanceLabels[form.importance]}</span></Label>
                                <Slider min={1} max={5} step={1} value={[form.importance]} onValueChange={([v]) => set("importance", v)} />
                            </div>
                            <div className="space-y-3">
                                <Label>Confidence: <span className="font-semibold text-blue-600">{confidenceLabels[form.confidence]}</span></Label>
                                <Slider min={1} max={5} step={1} value={[form.confidence]} onValueChange={([v]) => set("confidence", v)} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Success Criteria *</Label>
                            <Textarea
                                placeholder="Describe exactly what success looks like. e.g., I can answer all SAC questions without notes, explain mechanisms clearly, and achieve ≥85% on practice tests..."
                                value={form.success_criteria}
                                onChange={e => set("success_criteria", e.target.value)}
                                className="min-h-24"
                            />
                        </div>

                        <div className="flex justify-between pt-2">
                            <Button variant="outline" onClick={onCancel}>Cancel</Button>
                            <Button onClick={() => setStep(1)} disabled={!canProceedStep0} className="bg-purple-600 hover:bg-purple-700">
                                Next: Sub-Goals <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                        </div>
                    </motion.div>
                )}

                {/* STEP 1: Sub-Goals */}
                {step === 1 && (
                    <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-1">Ordered Sub-Goals</h2>
                            <p className="text-gray-500 text-sm">Define the milestones required to achieve your goal. They unlock one at a time — top to bottom.</p>
                        </div>

                        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex gap-3">
                            <Lock className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-semibold text-purple-800">Sequential Progression</p>
                                <p className="text-xs text-purple-600">Only sub-goal #1 is active. Each one unlocks after the previous is completed. AI will generate action items under each.</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {subGoals.map((sg, idx) => (
                                <motion.div key={sg.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                    className="flex items-center gap-3 p-3 bg-white border-2 border-gray-200 rounded-xl hover:border-purple-300 transition-colors">
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <GripVertical className="w-4 h-4 text-gray-300" />
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-500"}`}>
                                            {idx === 0 ? "1" : <Lock className="w-3 h-3" />}
                                        </div>
                                    </div>
                                    <Input
                                        placeholder={`Sub-goal ${idx + 1} — e.g., ${idx === 0 ? "Master all key concepts and definitions" : idx === 1 ? "Complete 3 practice SACs" : "Review and fix weak spots"}`}
                                        value={sg.title}
                                        onChange={e => updateSubGoal(sg.id, e.target.value)}
                                        className="border-0 shadow-none focus-visible:ring-0 bg-transparent"
                                    />
                                    {subGoals.length > 1 && (
                                        <Button variant="ghost" size="icon" onClick={() => removeSubGoal(sg.id)} className="flex-shrink-0 text-gray-400 hover:text-red-500 w-8 h-8">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    )}
                                </motion.div>
                            ))}
                        </div>

                        <Button variant="outline" onClick={addSubGoal} className="w-full border-dashed border-2 border-gray-300 hover:border-purple-400 text-gray-600">
                            <Plus className="w-4 h-4 mr-2" /> Add Sub-Goal
                        </Button>

                        <div className="flex justify-between pt-2">
                            <Button variant="outline" onClick={() => setStep(0)}><ChevronLeft className="w-4 h-4 mr-1" /> Back</Button>
                            <Button
                                onClick={handleGenerate}
                                disabled={!canProceedStep1 || isGenerating}
                                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                            >
                                {isGenerating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating Plan...</> : <><Sparkles className="w-4 h-4 mr-2" />Generate AI Plan</>}
                            </Button>
                        </div>
                    </motion.div>
                )}

                {/* STEP 2: Review & Edit */}
                {step === 2 && generatedData && editableHierarchy && (() => {
                    const typeConfig = {
                        study_hours: { label: "Study Hours", unit: "hrs", min: 1, max: 100, step: 1 },
                        quiz_count: { label: "Quizzes", unit: "quizzes", min: 1, max: 50, step: 1 },
                        quiz_score: { label: "Quiz Score Target", unit: "%", min: 40, max: 100, step: 5 },
                        flashcard_reviews: { label: "Flashcard Reviews", unit: "cards", min: 10, max: 500, step: 10 },
                        study_sessions: { label: "Study Sessions", unit: "sessions", min: 1, max: 50, step: 1 },
                    };

                    // Live aggregate XP across all editable items
                    const totalAdjustedXP = editableHierarchy.reduce((total, sg, idx) => {
                        return total + (sg.ai_sub_goals || []).reduce((sum, ai, aidx) => {
                            return sum + getAdjustedItem(idx, aidx, ai).xp_reward;
                        }, 0);
                    }, 0);

                    const totalChallenges = editableHierarchy.reduce((t, sg) => t + (sg.ai_sub_goals?.length || 0), 0);

                    return (
                    <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-1">Review & Customise</h2>
                            <p className="text-gray-500 text-sm">Delete, regenerate, or add your own challenges. Adjust targets to control XP earned.</p>
                        </div>

                        {/* Live Summary Bar */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
                                <Target className="w-4 h-4 text-purple-600 mx-auto mb-1" />
                                <div className="text-lg font-black text-purple-700">{totalChallenges}</div>
                                <div className="text-xs text-gray-500">Challenges</div>
                            </div>
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                                <Zap className="w-4 h-4 text-amber-600 mx-auto mb-1" />
                                <div className="text-lg font-black text-amber-700">{totalAdjustedXP}</div>
                                <div className="text-xs text-gray-500">Total XP</div>
                            </div>
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                                <BarChart3 className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                                <div className="text-lg font-black text-blue-700 capitalize">{(generatedData.difficulty_level || "medium").replace("_"," ")}</div>
                                <div className="text-xs text-gray-500">Difficulty</div>
                            </div>
                        </div>

                        {/* XP notice */}
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
                            <Zap className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-800"><span className="font-semibold">More effort = more XP.</span> Delete challenges you don't want, regenerate a set, or type your own below each sub-goal.</p>
                        </div>

                        {/* Editable sub-goals */}
                        <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
                            {editableHierarchy.map((sg, idx) => (
                                <div key={idx} className={`border-2 rounded-xl overflow-hidden ${idx === 0 ? "border-purple-300" : "border-gray-200"}`}>
                                    {/* Sub-goal header with regenerate button */}
                                    <div className={`flex items-center gap-3 p-3 ${idx === 0 ? "bg-purple-50" : "bg-gray-50"}`}>
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${idx === 0 ? "bg-purple-600 text-white" : "bg-gray-300 text-gray-600"}`}>
                                            {idx === 0 ? idx + 1 : <Lock className="w-3 h-3" />}
                                        </div>
                                        <p className="font-semibold text-sm text-gray-900 flex-1">{sg.title}</p>
                                        <button
                                            onClick={() => regenerateSubGoal(idx)}
                                            disabled={regeneratingIdx === idx}
                                            className="flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-800 font-semibold bg-purple-100 hover:bg-purple-200 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            {regeneratingIdx === idx ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                            Regenerate
                                        </button>
                                        {idx === 0 && <Badge className="bg-purple-100 text-purple-700 border-purple-300 text-xs">Active</Badge>}
                                    </div>

                                    {/* Challenge items */}
                                    <div className="divide-y divide-gray-100">
                                        {(sg.ai_sub_goals || []).length === 0 && (
                                            <div className="px-4 py-3 text-xs text-gray-400 italic">No challenges yet — add one below.</div>
                                        )}
                                        {(sg.ai_sub_goals || []).map((ai, aidx) => {
                                            const key = `${idx}_${aidx}`;
                                            const currentTarget = adjustedTargets[key] !== undefined ? adjustedTargets[key] : ai.target;
                                            const currentXp = getAdjustedXP(ai.xp_reward, ai.target, currentTarget, ai.type);
                                            const currentTitle = updateTitleWithTarget(ai.title, ai.target, currentTarget, ai.type);
                                            const cfg = typeConfig[ai.type]
                                            return (
                                                <div key={aidx} className="px-4 py-3 bg-white space-y-2">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <span className="text-sm text-gray-800 font-medium flex-1">{currentTitle}</span>
                                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                                            <span className="text-xs text-amber-600 font-bold flex items-center gap-0.5"><Zap className="w-3 h-3" />{currentXp}</span>
                                                            <button
                                                                onClick={() => deleteAiItem(idx, aidx)}
                                                                className="w-5 h-5 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                            >
                                                                <X className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <button onClick={() => setAdjustedTargets(prev => ({...prev, [key]: Math.max(cfg.min, (currentTarget || cfg.min) - cfg.step)}))}
                                                            className="w-6 h-6 rounded-full border-2 border-gray-300 flex items-center justify-center text-gray-500 hover:border-purple-400 hover:text-purple-600 flex-shrink-0">
                                                            <Minus className="w-3 h-3" />
                                                        </button>
                                                        <div className="flex-1">
                                                            <Slider
                                                                min={cfg.min} max={cfg.max} step={cfg.step}
                                                                value={[currentTarget || cfg.min]}
                                                                onValueChange={([v]) => setAdjustedTargets(prev => ({...prev, [key]: v}))}
                                                            />
                                                        </div>
                                                        <button onClick={() => setAdjustedTargets(prev => ({...prev, [key]: Math.min(cfg.max, (currentTarget || cfg.min) + cfg.step)}))}
                                                            className="w-6 h-6 rounded-full border-2 border-gray-300 flex items-center justify-center text-gray-500 hover:border-purple-400 hover:text-purple-600 flex-shrink-0">
                                                            <Plus className="w-3 h-3" />
                                                        </button>
                                                        <span className="text-sm font-bold text-gray-700 w-20 text-right flex-shrink-0">{currentTarget} {cfg.unit}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>


                                </div>
                            ))}
                        </div>

                        {/* Tips */}
                        {generatedData.tips?.length > 0 && (
                            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
                                <p className="text-sm font-semibold text-green-800 flex items-center gap-2"><Lightbulb className="w-4 h-4" />AI Study Tips</p>
                                {generatedData.tips.slice(0, 3).map((tip, i) => (
                                    <p key={i} className="text-xs text-green-700 flex gap-2"><CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{tip}</p>
                                ))}
                            </div>
                        )}

                        <div className="flex justify-between pt-2">
                            <Button variant="outline" onClick={() => setStep(1)}><ChevronLeft className="w-4 h-4 mr-1" /> Back</Button>
                            <Button onClick={handleSave} disabled={isSaving || totalChallenges === 0} className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 font-semibold px-8">
                                {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <><Trophy className="w-4 h-4 mr-2" />Create Goal ({totalAdjustedXP} XP)</>}
                            </Button>
                        </div>
                    </motion.div>
                    );
                })()}
            </AnimatePresence>
        </div>
    );
}