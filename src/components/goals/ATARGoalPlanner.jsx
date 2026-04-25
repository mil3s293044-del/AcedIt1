import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Target, Sparkles, Edit, XCircle } from "lucide-react";
import { UserProfile, Goal } from "@/entities/all";
import { useToast } from "@/components/ui/use-toast";
import { InvokeLLM } from "@/integrations/Core";
import MountainView from "./MountainView";

export default function ATARGoalPlanner({ user, userProfile, userSubjects, yearLevel, onProfileUpdate }) {
    const [targetATAR, setTargetATAR] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
    const [milestones, setMilestones] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (userProfile?.goal_atar) {
            setTargetATAR(userProfile.goal_atar.toString());
            setIsEditing(false);
        } else {
            setIsEditing(true);
        }
        loadATARMilestones();
    }, [userProfile]);

    const loadATARMilestones = async () => {
        if (!user?.email) return;
        setIsLoading(true);
        try {
            const goals = await Goal.filter({ 
                created_by: user.email, 
                category: 'atar_milestone' 
            }, '-created_date');
            setMilestones(goals || []);
        } catch (error) {
            console.error("Error loading ATAR milestones:", error);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleMilestoneUpdate = async (updatedMilestone) => {
        try {
            await Goal.update(updatedMilestone.id, updatedMilestone);
            await loadATARMilestones(); // Reload to reflect changes
        } catch (error) {
            console.error("Error updating milestone:", error);
            toast({ title: "Failed to update milestone", variant: "destructive" });
        }
    };
    
    const handleMilestoneDelete = async (milestoneId) => {
        try {
            await Goal.delete(milestoneId);
            await loadATARMilestones();
        } catch (error) {
            console.error("Error deleting milestone:", error);
            toast({ title: "Failed to delete milestone", variant: "destructive" });
        }
    };

    const handleSetATARGoal = async () => {
        if (!targetATAR || !user) return;
        
        const atarValue = parseFloat(targetATAR);
        if (atarValue < 30 || atarValue > 99.95) {
            toast({ 
                title: "Invalid ATAR", 
                description: "ATAR must be between 30.00 and 99.95", 
                variant: "destructive" 
            });
            return;
        }

        setIsLoading(true);
        try {
            const profileData = { goal_atar: atarValue };
            
            if (userProfile?.id) {
                await UserProfile.update(userProfile.id, profileData);
            } else {
                await UserProfile.create(profileData);
            }
            
            onProfileUpdate();
            toast({ title: "ATAR Goal Set!", description: `Target ATAR: ${atarValue}` });
            setIsEditing(false);
        } catch (error) {
            console.error("Error setting ATAR goal:", error);
            toast({ title: "Error", description: "Failed to set ATAR goal", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleClearGoal = async () => {
        if (!user || !userProfile?.id) return;
        setIsLoading(true);
        try {
            await UserProfile.update(userProfile.id, { goal_atar: null });
            setTargetATAR('');
            onProfileUpdate();
            setIsEditing(true);
            toast({ title: "ATAR Goal Cleared" });
        } catch (error) {
            console.error("Error clearing goal:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerateATARPlan = async () => {
        if (!targetATAR || !user) return;

        setIsGeneratingPlan(true);
        try {
            const subjectsList = userSubjects.map(s => s.subject_name).join(', ') || 'General subjects';
            
            const response = await InvokeLLM({
                prompt: `I am a VCE student in ${yearLevel}. My target ATAR is ${targetATAR} and my subjects are: ${subjectsList}. Create a comprehensive ATAR achievement plan for me.

Generate 8-12 specific, time-bound milestones. Given I am in ${yearLevel}, make the milestones relevant (e.g., for Year 10, focus on building foundations; for Year 12, focus on exam performance).

Focus on:
1. **Study Schedule Milestones** (e.g., "Establish 15+ hour weekly study routine by end of Term 1")
2. **Assessment Performance Targets** (e.g., "Achieve 85%+ on all SACs")
3. **Knowledge Mastery Goals** (e.g., "Complete full review of Units 1&2 content by start of Year 12")
4. **Exam Preparation Milestones** (e.g., "Complete 5+ practice exams per subject before final exams")
5. **Skill Development Goals** (e.g., "Master essay writing techniques for English by Term 2")

Each milestone should be:
- Specific and measurable
- Time-bound with realistic deadlines
- Directly contributing to ATAR improvement
- Appropriate for a ${yearLevel} student aiming for a ${targetATAR} ATAR.`,
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
                                    target_date: { type: "string" },
                                    priority: { type: "string", enum: ["high", "medium", "low"] },
                                    category: { type: "string", enum: ["study_habits", "assessment", "knowledge", "exam_prep", "skills"] },
                                    success_criteria: { type: "string" },
                                    action_items: { type: "array", items: {type: "object", properties: {task: {type: "string"}, completed: {type: "boolean"}}} }
                                }
                            }
                        }
                    }
                }
            });

            if (response.milestones?.length > 0) {
                const milestonesToCreate = response.milestones.map(milestone => ({
                    ...milestone,
                    category: 'atar_milestone',
                    is_completed: false
                }));

                const existingMilestones = await Goal.filter({ 
                    created_by: user.email, 
                    category: 'atar_milestone' 
                });
                
                for (const existing of existingMilestones) {
                    try { await Goal.delete(existing.id); } catch (e) { console.warn(e); }
                }

                await Goal.bulkCreate(milestonesToCreate);
                await loadATARMilestones();
                
                toast({ 
                    title: "ATAR Plan Generated!", 
                    description: `Created ${response.milestones.length} personalized milestones for a ${yearLevel} student.`
                });
            }
        } catch (error) {
            console.error("Error generating ATAR plan:", error);
            toast({ title: "Generation Failed", variant: "destructive" });
        } finally {
            setIsGeneratingPlan(false);
        }
    };

    return (
        <div className="space-y-6">
            <Card className="bg-gradient-to-br from-red-50 to-pink-50 border-red-200/50">
                <CardHeader>
                    <CardTitle className="flex items-center justify-between text-red-900">
                        <div className="flex items-center gap-2">
                           <Target className="w-6 h-6" />
                            Set Your ATAR Goal
                        </div>
                        {!isEditing && userProfile?.goal_atar && (
                            <div className="flex gap-1">
                                <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}> <Edit className="w-4 h-4 mr-2" /> Edit</Button>
                                <Button variant="ghost" size="sm" onClick={handleClearGoal}><XCircle className="w-4 h-4 mr-2" /> Clear</Button>
                            </div>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                     {isEditing ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="atar-goal">Target ATAR</Label>
                                <Input
                                    id="atar-goal"
                                    type="number"
                                    min="30"
                                    max="99.95"
                                    step="0.05"
                                    value={targetATAR}
                                    onChange={(e) => setTargetATAR(e.target.value)}
                                    placeholder="e.g., 95.00"
                                    disabled={isLoading}
                                />
                            </div>
                            <div className="flex items-end">
                                <Button 
                                    onClick={handleSetATARGoal} 
                                    disabled={isLoading || !targetATAR}
                                    className="bg-red-600 hover:bg-red-700"
                                >
                                    Set Goal
                                </Button>
                            </div>
                        </div>
                     ) : (
                         <div className="flex items-center justify-between">
                            <p className="text-lg">Your Target ATAR: <Badge className="text-lg bg-white text-red-800">{userProfile?.goal_atar}</Badge></p>
                             <Button 
                                onClick={handleGenerateATARPlan} 
                                disabled={isGeneratingPlan}
                                variant="outline"
                                className="border-red-200"
                            >
                                <Sparkles className="w-4 h-4 mr-2" />
                                {isGeneratingPlan ? "Generating..." : "Generate AI Plan"}
                            </Button>
                         </div>
                     )}
                </CardContent>
            </Card>

            {milestones.length > 0 ? (
                 <MountainView 
                    goalLabel="ATAR"
                    goalValue={userProfile?.goal_atar || ''}
                    milestones={milestones}
                    onMilestoneUpdate={handleMilestoneUpdate}
                    onMilestoneDelete={handleMilestoneDelete}
                 />
            ) : (
                <Card className="text-center py-12">
                    <CardContent>
                        <Target className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                            Set Your ATAR Goal
                        </h3>
                        <p className="text-gray-600 mb-6">
                           Once your goal is set, click 'Generate AI Plan' to create your Mountain to Success.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}