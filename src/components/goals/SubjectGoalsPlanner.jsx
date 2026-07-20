
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Sparkles, Target, Wand2, RefreshCw } from "lucide-react";
import { User, UserSubject, Goal } from "@/entities/all"; // Added User and Goal imports
import { useToast } from "@/components/ui/use-toast";
import { FEATURES, checkLiveTier } from "@/lib/tierAccess";
import { InvokeLLM } from "@/integrations/Core";
import MountainView from "./MountainView";

export default function SubjectGoalsPlanner() {
    const [user, setUser] = useState(null);
    const [userSubjects, setUserSubjects] = useState([]);
    const [subjectGoals, setSubjectGoals] = useState({}); // Existing state for study score targets
    const [isAIGenerating, setIsAIGenerating] = useState(null); // Renamed from isGenerating to isAIGenerating
    const [subjectPlans, setSubjectPlans] = useState({}); // New state for locally generated subject plans
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    // States added per outline for potential future Goal entity management UI
    const [goals, setGoals] = useState([]);
    const [isCreating, setIsCreating] = useState(false);
    const [editingGoal, setEditingGoal] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        subject_code: '', // Note: subject_code needs to be managed if this form is for subject-specific goals
        target_date: '',
        milestone_type: 'content',
        priority: 'medium',
        category: 'subject_milestone',
        action_items: [],
        success_criteria: '',
        tips: []
    });

    useEffect(() => {
        const init = async () => {
            try {
                const currentUser = await User.me();
                setUser(currentUser);
                if (currentUser?.email) {
                    await loadData(currentUser.email);
                } else {
                    console.warn("User email not found, cannot load data.");
                }
            } catch (error) {
                console.error("Error initializing:", error);
                toast({
                    title: "Error loading user data",
                    description: "Failed to retrieve user information. Please try again.",
                    variant: "destructive",
                });
            }
        };
        init();
    }, []);

    const loadData = async (userEmail) => {
        try {
            // Note: The outline requested Goal.filter for 'subject_milestone',
            // but the current component's AI plans are stored in local state (subjectPlans).
            // This `goals` state might be for a different type of goal/milestone management.
            const [goalsData, subjectsData] = await Promise.all([
                Goal.filter({ created_by: userEmail, category: 'subject_milestone' }, '-created_date'),
                UserSubject.filter({ created_by: userEmail })
            ]);
            setGoals(goalsData || []);
            setUserSubjects(subjectsData || []);
        } catch (error) {
            console.error("Error loading data:", error);
            toast({
                title: "Error loading subjects and goals",
                description: "Failed to retrieve your study data. Please try again.",
                variant: "destructive",
            });
        }
    };

    useEffect(() => {
        const goals = {};
        userSubjects.forEach(subject => {
            goals[subject.subject_code] = subject.goal_study_score || '';
        });
        setSubjectGoals(goals);
    }, [userSubjects]);

    const handleGoalChange = (subjectCode, value) => {
        setSubjectGoals(prev => ({ ...prev, [subjectCode]: value }));
    };

    const handleSaveSubjectGoals = async () => {
        if (!user || !user.email) {
            toast({
                title: "Authentication Error",
                description: "You must be logged in to save goals.",
                variant: "destructive"
            });
            return;
        }

        setIsLoading(true);
        try {
            const updatePromises = userSubjects.map(async (subject) => {
                const goalScore = parseInt(subjectGoals[subject.subject_code]);
                // Check if goalScore is a valid number between 0 and 50
                if (!isNaN(goalScore) && goalScore >= 0 && goalScore <= 50) {
                    return UserSubject.update(subject.id, {
                        goal_study_score: goalScore
                    });
                }
                // If goalScore is invalid or empty, set to null
                if (subjectGoals[subject.subject_code] === '' || isNaN(goalScore) || goalScore < 0 || goalScore > 50) {
                    return UserSubject.update(subject.id, {
                        goal_study_score: null
                    });
                }
                return Promise.resolve(); // Should not reach here if all cases are covered
            });

            await Promise.all(updatePromises);
            // Refresh userSubjects state after saving to reflect changes
            if (user?.email) {
                await loadData(user.email);
            }
            toast({ title: "Subject Goals Saved!", description: "Your study score targets have been updated." });
        } catch (error) {
            console.error("Error saving subject goals:", error);
            toast({ title: "Error", description: "Failed to save subject goals", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const generateSubjectPlan = async (subject) => {
        const access = await checkLiveTier(FEATURES.GOAL_AI_GEN);
        if (!access.allowed) {
            toast({
                title: access.upgradeRequired ? "Premium feature" : "Daily limit reached",
                description: access.reason,
                variant: "destructive",
            });
            return;
        }

        setIsAIGenerating(subject.subject_code);
        try {
            // Determine an overall year level for context, fallback to first subject's year level or default
            const overallYearLevel = userSubjects.length > 0 && userSubjects[0].year_level
                ? userSubjects[0].year_level
                : "Year 12 Units 3&4";

            // Determine the specific year level for the subject or fall back to overall
            const yearLevelInfo = subject.year_level || overallYearLevel;

            const isUnits34 = yearLevelInfo.includes("3&4");
            const isUnits12 = yearLevelInfo.includes("1&2");
            const isYear10 = yearLevelInfo.includes("Year 10");

            let contextPrompt = "";
            if (isUnits34) {
                contextPrompt = "This is a Year 12 Units 3&4 subject, so focus on SACs, exam preparation, and achieving the target study score for ATAR calculation.";
            } else if (isUnits12) {
                contextPrompt = "This is a Year 11 Units 1&2 subject, so focus on building foundational knowledge, school assessments, and preparing for Units 3&4.";
            } else if (isYear10) {
                contextPrompt = "This is a Year 10 subject, so focus on building basic understanding, regular assessments, and preparing for VCE.";
            }

            const response = await InvokeLLM({
                feature: "goal_ai_gen",
                prompt: `You are an expert VCE study planner. Create a personalized roadmap for achieving a study score of ${subject.goal_study_score || 35} in ${subject.subject_name} (${subject.subject_code}).

${contextPrompt}

Student Context:
- Current Year Level: ${yearLevelInfo}
- Subject: ${subject.subject_name} (${subject.subject_code})
- Target Study Score: ${subject.goal_study_score || 35}
- Overall Year Level: ${overallYearLevel}

Create 6-8 specific, actionable milestones that will help achieve this study score. Each milestone should be:
- Specific to the subject and year level
- Realistic and achievable
- Include 3-5 concrete action items
- Appropriate for the student's current year level

For Year 10: Focus on foundational learning and preparation
For Year 11 Units 1&2: Focus on content mastery and skill building  
For Year 12 Units 3&4: Focus on SACs, exam prep, and study score optimization

Return a JSON object with a "milestones" array.`,
                add_context_from_internet: true,
                response_json_schema: {
                    type: "object",
                    properties: {
                        milestones: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    title: { type: "string" },
                                    description: { type: "string" },
                                    action_items: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            properties: {
                                                task: { type: "string" },
                                                completed: { type: "boolean", default: false }
                                            }
                                        }
                                    },
                                    is_completed: { type: "boolean", default: false },
                                    milestone_type: { type: "string" }
                                }
                            }
                        }
                    }
                }
            });

            if (response?.milestones) {
                setSubjectPlans(prev => ({
                    ...prev,
                    [subject.subject_code]: response.milestones
                }));
                toast({
                    title: "Subject Plan Generated!",
                    description: `Created personalized milestones for ${subject.subject_name}`
                });
            } else {
                toast({
                    title: "No Plan Generated",
                    description: "The AI did not return a valid plan. Please try again or adjust your target.",
                    variant: "destructive"
                });
            }
        } catch (error) {
            console.error("Error generating subject plan:", error);
            toast({
                title: "Error",
                description: "Failed to generate study plan. Please try again.",
                variant: "destructive"
            });
        } finally {
            setIsAIGenerating(null);
        }
    };

    if (userSubjects.length === 0) {
        return (
            <Card className="max-w-2xl mx-auto">
                <CardContent className="p-8 text-center">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Target className="w-8 h-8 text-blue-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">
                        No Subjects Selected
                    </h2>
                    <p className="text-muted-foreground mb-6">
                        To set subject goals, you need to select your subjects first. Head to the Subjects page and add your subjects to "My Subjects".
                    </p>
                    <Button
                        onClick={() => window.location.href = '/Subjects'}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        Go to Subjects
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-blue-900">
                        <BookOpen className="w-6 h-6" />
                        Set Subject Study Score Goals
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {userSubjects.length === 0 ? (
                        <p className="text-muted-foreground">Please add your subjects first.</p>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {userSubjects.map(subject => (
                                    <div key={subject.id} className="space-y-2">
                                        <Label htmlFor={`goal-${subject.subject_code}`}>{subject.subject_name}</Label>
                                        <Input
                                            id={`goal-${subject.subject_code}`}
                                            type="number" min="0" max="50"
                                            value={subjectGoals[subject.subject_code] || ''}
                                            onChange={(e) => handleGoalChange(subject.subject_code, e.target.value)}
                                            placeholder="Target score (0-50)"
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={handleSaveSubjectGoals} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">Save Goals</Button>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            <div className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-yellow-500" />
                    Your Personalized Study Plans
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {userSubjects.map(subject => {
                        const hasPlan = subjectPlans[subject.subject_code];
                        // Using subject's year_level or a general fallback for display
                        const yearLevelDisplay = subject.year_level || "Year 12 Units 3&4";

                        return (
                            <Card key={subject.subject_code} className="bg-surface border-border">
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-lg">{subject.subject_name}</CardTitle>
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                <Badge variant="outline" className="bg-blue-50 text-blue-700">
                                                    {subject.subject_code}
                                                </Badge>
                                                <Badge variant="outline" className="bg-green-50 text-green-700">
                                                    {yearLevelDisplay}
                                                </Badge>
                                                <Badge className="bg-purple-100 text-purple-800">
                                                    Target: {subject.goal_study_score || "Not Set"}
                                                </Badge>
                                            </div>
                                        </div>

                                        {!hasPlan ? (
                                            <Button
                                                onClick={() => generateSubjectPlan(subject)}
                                                disabled={isAIGenerating === subject.subject_code || !subject.goal_study_score}
                                                size="sm"
                                                className="shrink-0"
                                            >
                                                {isAIGenerating === subject.subject_code ? (
                                                    <>
                                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                                                        Generating...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Wand2 className="w-4 h-4 mr-2" />
                                                        Generate Plan
                                                    </>
                                                )}
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="outline"
                                                onClick={() => generateSubjectPlan(subject)}
                                                disabled={isAIGenerating === subject.subject_code}
                                                size="sm"
                                                className="shrink-0"
                                            >
                                                <RefreshCw className="w-4 h-4 mr-2" />
                                                {isAIGenerating === subject.subject_code ? "Regenerating..." : "Regenerate"}
                                            </Button>
                                        )}
                                    </div>
                                </CardHeader>

                                {hasPlan ? (
                                    <CardContent>
                                        <MountainView
                                            goalLabel={`${subject.subject_name} Study Score`}
                                            goalValue={`${subject.goal_study_score || 'N/A'}/50`}
                                            milestones={subjectPlans[subject.subject_code] || []}
                                            onMilestoneUpdate={(updatedMilestone) => {
                                                const updatedMilestones = (subjectPlans[subject.subject_code] || []).map(m =>
                                                    m.title === updatedMilestone.title ? updatedMilestone : m // Assuming title is unique for now
                                                );
                                                setSubjectPlans(prev => ({
                                                    ...prev,
                                                    [subject.subject_code]: updatedMilestones
                                                }));
                                            }}
                                        />
                                    </CardContent>
                                ) : (
                                    <CardContent className="text-center py-6">
                                        <Target className="w-12 h-12 mx-auto text-muted-foreground/40 mb-2" />
                                        <h3 className="text-md font-semibold text-foreground mb-1">
                                            No plan generated for {subject.subject_name}
                                        </h3>
                                        <p className="text-muted-foreground text-sm">
                                            Set a target score and click 'Generate Plan' above.
                                        </p>
                                    </CardContent>
                                )}
                            </Card>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
