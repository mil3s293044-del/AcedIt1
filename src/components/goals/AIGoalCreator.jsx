import React, { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { Sparkles, Target, Calendar, CheckCircle2, Trophy, Zap, Loader2 } from "lucide-react";

export default function AIGoalCreator({ userSubjects, onGoalCreated, onCancel }) {
    const { toast } = useToast();
    const [isGenerating, setIsGenerating] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        target_date: '',
        category: 'academic',
        subject_code: ''
    });
    const [generatedGoal, setGeneratedGoal] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleGenerate = async () => {
        if (!formData.title || !formData.description || !formData.target_date) {
            toast({
                title: "Missing Information",
                description: "Please fill in title, description, and target date.",
                variant: "destructive"
            });
            return;
        }

        setIsGenerating(true);
        try {
            const { data } = await base44.functions.invoke('generateGoalWithAI', formData);

            setGeneratedGoal(data);
            toast({
                title: "Goal Generated!",
                description: "AI has created a personalized plan with sub-goals.",
            });
        } catch (error) {
            console.error("Error generating goal:", error);
            toast({
                title: "Generation Failed",
                description: error.message || "Could not generate goal. Please try again.",
                variant: "destructive"
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = async () => {
        if (!generatedGoal) return;

        setIsSaving(true);
        try {
            const goalData = {
                ...formData,
                sub_goals: generatedGoal.sub_goals,
                difficulty_level: generatedGoal.difficulty_level,
                total_xp_reward: generatedGoal.total_xp_reward,
                tips: generatedGoal.tips,
                progress: 0,
                is_completed: false
            };

            const newGoal = await base44.entities.Goal.create(goalData);

            toast({
                title: "Goal Created!",
                description: `Your goal has been saved with ${generatedGoal.sub_goals.length} sub-goals.`,
            });

            if (onGoalCreated) {
                onGoalCreated(newGoal);
            }
        } catch (error) {
            console.error("Error saving goal:", error);
            toast({
                title: "Save Failed",
                description: "Could not save the goal. Please try again.",
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    const getDifficultyColor = (difficulty) => {
        const colors = {
            easy: "bg-green-100 text-green-700 border-green-300",
            medium: "bg-blue-100 text-blue-700 border-blue-300",
            hard: "bg-orange-100 text-orange-700 border-orange-300",
            very_hard: "bg-red-100 text-red-700 border-red-300"
        };
        return colors[difficulty] || colors.medium;
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Sparkles className="w-6 h-6 text-purple-600" />
                        AI Goal Creator
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Goal Title *</Label>
                        <Input
                            id="title"
                            placeholder="e.g., Master VCE Chemistry Unit 3&4"
                            value={formData.title}
                            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description *</Label>
                        <Textarea
                            id="description"
                            placeholder="Describe your goal in detail..."
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            className="min-h-24"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="target_date">Target Date *</Label>
                            <Input
                                id="target_date"
                                type="date"
                                value={formData.target_date}
                                onChange={(e) => setFormData(prev => ({ ...prev, target_date: e.target.value }))}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="category">Category</Label>
                            <Select
                                value={formData.category}
                                onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="academic">Academic</SelectItem>
                                    <SelectItem value="subject_milestone">Subject Milestone</SelectItem>
                                    <SelectItem value="personal">Personal</SelectItem>
                                    <SelectItem value="skill">Skill Development</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {userSubjects && userSubjects.length > 0 && (
                        <div className="space-y-2">
                            <Label htmlFor="subject">Related Subject (Optional)</Label>
                            <Select
                                value={formData.subject_code}
                                onValueChange={(value) => setFormData(prev => ({ ...prev, subject_code: value }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a subject..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {userSubjects.map(subject => (
                                        <SelectItem key={subject.id} value={subject.subject_code}>
                                            {subject.subject_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <Button
                            onClick={handleGenerate}
                            disabled={isGenerating || !formData.title || !formData.description || !formData.target_date}
                            className="bg-purple-600 hover:bg-purple-700"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4 mr-2" />
                                    Generate with AI
                                </>
                            )}
                        </Button>

                        {onCancel && (
                            <Button variant="outline" onClick={onCancel}>
                                Cancel
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {generatedGoal && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                >
                    <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2">
                                    <Trophy className="w-6 h-6 text-purple-600" />
                                    Generated Goal Plan
                                </CardTitle>
                                <Badge className={getDifficultyColor(generatedGoal.difficulty_level)}>
                                    {generatedGoal.difficulty_level.replace('_', ' ').toUpperCase()}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* XP Rewards */}
                            <div className="grid grid-cols-2 gap-4 p-4 bg-white rounded-lg border">
                                <div className="text-center">
                                    <div className="flex items-center justify-center gap-2 mb-1">
                                        <Zap className="w-4 h-4 text-yellow-500" />
                                        <p className="text-sm text-gray-600">Sub-Goals XP</p>
                                    </div>
                                    <p className="text-2xl font-bold text-purple-600">
                                        {generatedGoal.sub_goals.reduce((sum, sg) => sum + sg.xp_reward, 0)} XP
                                    </p>
                                </div>
                                <div className="text-center">
                                    <div className="flex items-center justify-center gap-2 mb-1">
                                        <Trophy className="w-4 h-4 text-yellow-500" />
                                        <p className="text-sm text-gray-600">Completion Bonus</p>
                                    </div>
                                    <p className="text-2xl font-bold text-amber-600">
                                        {generatedGoal.total_xp_reward} XP
                                    </p>
                                </div>
                            </div>

                            {/* Sub-Goals */}
                            <div className="space-y-3">
                                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                                    <Target className="w-5 h-5 text-purple-600" />
                                    Sub-Goals ({generatedGoal.sub_goals.length})
                                </h4>
                                {generatedGoal.sub_goals.map((subGoal, index) => (
                                    <motion.div
                                        key={subGoal.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        className="flex items-center gap-3 p-3 bg-white rounded-lg border hover:shadow-sm transition-shadow"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                                            <span className="text-sm font-semibold text-purple-600">{index + 1}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900">{subGoal.title}</p>
                                        </div>
                                        <Badge variant="secondary" className="flex items-center gap-1">
                                            <Zap className="w-3 h-3" />
                                            {subGoal.xp_reward} XP
                                        </Badge>
                                    </motion.div>
                                ))}
                            </div>

                            {/* Tips */}
                            {generatedGoal.tips && generatedGoal.tips.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="font-semibold text-gray-900">Success Tips</h4>
                                    <ul className="space-y-2">
                                        {generatedGoal.tips.map((tip, index) => (
                                            <li key={index} className="flex gap-2 text-sm text-gray-700">
                                                <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                                                <span>{tip}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <Button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Trophy className="w-4 h-4 mr-2" />
                                        Save Goal & Start
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                </motion.div>
            )}
        </div>
    );
}