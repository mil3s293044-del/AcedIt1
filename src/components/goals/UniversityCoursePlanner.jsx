
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraduationCap, Sparkles, Target, Edit, XCircle, ArrowLeft } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { UserProfile, Goal, UniversityCourse } from "@/entities/all"; // Added UniversityCourse import
import { useToast } from "@/components/ui/use-toast";
import { InvokeLLM } from "@/integrations/Core";
import MountainView from "./MountainView";

export default function UniversityCoursePlanner({ user, userProfile, yearLevel, onProfileUpdate }) {
    const [courseName, setCourseName] = useState('');
    const [university, setUniversity] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
    const [courseMilestones, setCourseMilestones] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    // New state variables from the outline
    const [isEditingCourse, setIsEditingCourse] = useState(false);
    const [editedCourse, setEditedCourse] = useState(null);
    const [selectedCourse, setSelectedCourse] = useState(null); // This state would typically be set by a parent component or a route parameter

    useEffect(() => {
        if (userProfile?.goal_course_name) {
            setCourseName(userProfile.goal_course_name);
            setUniversity(userProfile.goal_university || '');
            setIsEditing(false);
        } else {
            setIsEditing(true);
        }
        loadCourseMilestones();
        // Potentially load university courses if the component is also responsible for a list
        // For now, loadUniversityCourses is a placeholder as no list management is specified in the outline.
    }, [userProfile]);

    // Placeholder function for loading university courses.
    // The outline implies this function would refresh a list from which 'selectedCourse' might originate.
    const loadUniversityCourses = async () => {
        console.log("Loading university courses... (Actual implementation to fetch courses is not provided in the outline)");
        // Example: If this component managed a list of courses:
        // try {
        //     const courses = await UniversityCourse.filter({});
        //     setAvailableCourses(courses); // Assuming an 'availableCourses' state
        // } catch (error) {
        //     console.error("Error loading university courses:", error);
        // }
    };

    const loadCourseMilestones = async () => {
        if (!user?.email) return;
        try {
            const goals = await Goal.filter({
                created_by: user.email,
                category: 'course_milestone'
            });
            setCourseMilestones(goals || []);
        } catch (error) {
            console.error("Error loading course milestones:", error);
        }
    };

    const handleMilestoneUpdate = async (updatedMilestone) => {
        try {
            await Goal.update(updatedMilestone.id, updatedMilestone);
            await loadCourseMilestones();
        } catch (error) {
            console.error("Error updating milestone:", error);
            toast({ title: "Failed to update milestone", variant: "destructive" });
        }
    };

    const handleMilestoneDelete = async (milestoneId) => {
        try {
            await Goal.delete(milestoneId);
            await loadCourseMilestones();
        } catch (error) {
            console.error("Error deleting milestone:", error);
            toast({ title: "Failed to delete milestone", variant: "destructive" });
        }
    };

    const handleSaveCourseGoal = async () => {
        if (!courseName || !user) return;
        setIsLoading(true);
        try {
            const profileData = {
                goal_course_name: courseName,
                goal_university: university,
            };
            if (userProfile?.id) {
                await UserProfile.update(userProfile.id, profileData);
            } else {
                // If userProfile doesn't exist, create one associated with the user
                await UserProfile.create({
                    user_id: user.id, // Assuming user has an id
                    email: user.email,
                    ...profileData
                });
            }
            onProfileUpdate();
            toast({ title: "Course Goal Set!", description: `Target: ${courseName}${university ? ` at ${university}` : ''}` });
            setIsEditing(false);
        } catch (error) {
            console.error("Error setting course goal:", error);
            toast({ title: "Error", description: "Failed to set course goal", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

     const handleClearGoal = async () => {
        if (!user || !userProfile?.id) return;
        setIsLoading(true);
        try {
            await UserProfile.update(userProfile.id, { goal_course_name: null, goal_university: null });
            setCourseName('');
            setUniversity('');
            onProfileUpdate();
            setIsEditing(true);
            toast({ title: "Course Goal Cleared" });
        } catch (error) {
            console.error("Error clearing goal:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerateCoursePlan = async () => {
         if (!courseName || !user) return;
        setIsGeneratingPlan(true);
        try {
            const response = await InvokeLLM({
                prompt: `I am a ${yearLevel} VCE student aiming to get into this course:

Course: ${courseName}
University: ${university || 'Any suitable university'}

Generate 10-15 specific milestones to help me gain entry. Make the plan specific to my current year level (${yearLevel}). Focus on:
1.  **Academic Prep**: Prerequisite subjects, high SAC scores.
2.  **ATAR Requirements**: Achieving a competitive ATAR.
3.  **Course-Specific Skills**: E.g., UCAT for Medicine, portfolio for Design.
4.  **Application Prep**: Personal statements, interviews (if applicable).
5.  **Experience Building**: Relevant work experience, volunteering.
6.  **Research & Planning**: University open days, detailed course research.

Return a JSON object with a key "course_milestones", which is an array. Each milestone object should have "title", "description", "target_date", "priority", "milestone_type", "success_criteria", and "action_items" (an array of {task: string, completed: boolean}).`,
                add_context_from_internet: true,
                response_json_schema: {
                    type: "object",
                    properties: {
                        course_milestones: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    title: { type: "string" },
                                    description: { type: "string" },
                                    target_date: { type: "string" },
                                    priority: { type: "string", enum: ["high", "medium", "low"] },
                                    milestone_type: { type: "string", enum: ["academic", "application", "experience", "research", "skills", "testing"] },
                                    success_criteria: { type: "string" },
                                    action_items: { type: "array", items: {type: "object", properties: {task: {type: "string"}, completed: {type: "boolean"}}} }
                                }
                            }
                        }
                    }
                }
            });

            if (response.course_milestones?.length > 0) {
                const milestonesToCreate = response.course_milestones.map(m => ({
                    ...m,
                    created_by: user.email, // Ensure created_by is set for new goals
                    category: 'course_milestone',
                    is_completed: false
                }));

                const existing = await Goal.filter({ created_by: user.email, category: 'course_milestone' });
                for (const item of existing) {
                    try { await Goal.delete(item.id); } catch(e) { console.warn(e); }
                }

                await Goal.bulkCreate(milestonesToCreate);
                await loadCourseMilestones();

                toast({
                    title: "Course Plan Generated!",
                    description: `Created ${milestonesToCreate.length} milestones for ${courseName}.`
                });
            }
        } catch (error) {
            console.error("Error generating plan:", error);
            toast({ title: "Generation Failed", variant: "destructive" });
        } finally {
            setIsGeneratingPlan(false);
        }
    };

    // New functions from the outline for editing a specific UniversityCourse entity
    const handleEditCourse = (course) => {
        setEditedCourse({ ...course });
        setIsEditingCourse(true);
    };

    const handleSaveCourse = async () => {
        try {
            // Assuming UniversityCourse entity exists and has an update method
            await UniversityCourse.update(editedCourse.id, editedCourse);
            toast({ title: "Course updated!", description: "Changes saved successfully." });
            setIsEditingCourse(false);
            await loadUniversityCourses(); // Call the placeholder function to simulate a refresh
            if (selectedCourse && selectedCourse.id === editedCourse.id) {
                setSelectedCourse(editedCourse); // Update selectedCourse if it was the one being edited
            }
        } catch (error) {
            console.error("Error updating course:", error);
            toast({ title: "Update failed", variant: "destructive" });
        }
    };

    // New rendering logic for selectedCourse from the outline
    // This block will render if a 'selectedCourse' is provided (e.g., via a prop or internal state)
    // and will act as an early return, replacing the main goal planner UI.
    if (selectedCourse) {
        return (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex items-center justify-between mb-6">
                    <Button variant="outline" onClick={() => { setSelectedCourse(null); setIsEditingCourse(false); }}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back
                    </Button>
                    {!isEditingCourse && (
                        <Button variant="outline" onClick={() => handleEditCourse(selectedCourse)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Course
                        </Button>
                    )}
                </div>

                {isEditingCourse ? (
                    <Card>
                        <CardHeader>
                            <CardTitle>Edit Course</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label htmlFor="edit-course-name">Course Name</Label>
                                <Input id="edit-course-name" placeholder="Course Name" value={editedCourse.name || ''} onChange={(e) => setEditedCourse({ ...editedCourse, name: e.target.value })} />
                            </div>
                            <div>
                                <Label htmlFor="edit-course-university">University</Label>
                                <Input id="edit-course-university" placeholder="University" value={editedCourse.university || ''} onChange={(e) => setEditedCourse({ ...editedCourse, university: e.target.value })} />
                            </div>
                            <div>
                                <Label htmlFor="edit-course-atar">Indicative ATAR</Label>
                                <Input id="edit-course-atar" type="number" placeholder="ATAR" value={editedCourse.indicative_atar || ''} onChange={(e) => setEditedCourse({ ...editedCourse, indicative_atar: parseFloat(e.target.value) || 0 })} />
                            </div>
                            <div>
                                <Label htmlFor="edit-course-description">Description</Label>
                                <Textarea id="edit-course-description" placeholder="Description" value={editedCourse.description || ''} onChange={(e) => setEditedCourse({ ...editedCourse, description: e.target.value })} rows={5} />
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setIsEditingCourse(false)}>Cancel</Button>
                                <Button onClick={handleSaveCourse} disabled={!editedCourse?.name || !editedCourse?.university}>Save</Button>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
                        <CardHeader>
                            <CardTitle>{selectedCourse.name}</CardTitle>
                            <p className="text-sm text-gray-600">{selectedCourse.university}</p>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-2xl font-bold">ATAR: {selectedCourse.indicative_atar || 'N/A'}</p>
                            <p>{selectedCourse.description || 'No description available.'}</p>
                        </CardContent>
                    </Card>
                )}
            </motion.div>
        );
    }

    // Existing rendering logic for the University Course Goal Planner
    return (
        <div className="space-y-6">
            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200/50">
                <CardHeader>
                     <CardTitle className="flex items-center justify-between text-green-900">
                        <div className="flex items-center gap-2">
                           <GraduationCap className="w-6 h-6" />
                           Set University Course Goal
                        </div>
                        {!isEditing && userProfile?.goal_course_name && (
                            <div className="flex gap-1">
                                <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}> <Edit className="w-4 h-4 mr-2" /> Edit</Button>
                                <Button variant="ghost" size="sm" onClick={handleClearGoal}><XCircle className="w-4 h-4 mr-2" /> Clear</Button>
                            </div>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isEditing ? (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="course-name">Course Name</Label>
                                    <Input
                                        id="course-name"
                                        value={courseName}
                                        onChange={(e) => setCourseName(e.target.value)}
                                        placeholder="e.g., Bachelor of Medicine"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="university">Preferred University (Optional)</Label>
                                    <Input
                                        id="university"
                                        value={university}
                                        onChange={(e) => setUniversity(e.target.value)}
                                        placeholder="e.g., Monash University"
                                    />
                                </div>
                            </div>
                            <div className="flex">
                                <Button onClick={handleSaveCourseGoal} disabled={isLoading || !courseName} className="bg-green-600 hover:bg-green-700">
                                    Save Course Goal
                                </Button>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-lg font-medium">{userProfile?.goal_course_name}</p>
                                <p className="text-sm text-gray-600">{userProfile?.goal_university}</p>
                            </div>
                            <Button onClick={handleGenerateCoursePlan} disabled={isGeneratingPlan} variant="outline" className="border-green-200">
                                <Sparkles className="w-4 h-4 mr-2" />
                                {isGeneratingPlan ? "Generating..." : "Generate AI Plan"}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {courseMilestones.length > 0 ? (
                <MountainView
                    goalLabel="Course"
                    goalValue={userProfile?.goal_course_name || ''}
                    milestones={courseMilestones}
                    onMilestoneUpdate={handleMilestoneUpdate}
                    onMilestoneDelete={handleMilestoneDelete}
                />
            ) : (
                <Card className="text-center py-12">
                    <CardContent>
                        <Target className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                            Set Your Course Goal
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
