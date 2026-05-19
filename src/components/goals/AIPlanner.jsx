import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Wand2, Sparkles } from 'lucide-react';
import { UserSubject } from '@/entities/all';
import { useToast } from '@/components/ui/use-toast';
import { InvokeLLM } from '@/integrations/Core';

export default function AIPlanner({ onPlanGenerated, isGenerating, user }) {
    const [userSubjects, setUserSubjects] = useState([]);
    const [weeklyGoals, setWeeklyGoals] = useState({});
    const [prioritySubjects, setPrioritySubjects] = useState([]);
    const [maxSessionsPerDay, setMaxSessionsPerDay] = useState(4);
    const [specialInstructions, setSpecialInstructions] = useState('');
    const { toast } = useToast();

    useEffect(() => {
        const loadSubjects = async () => {
            if (user?.email) {
                const subjects = await UserSubject.filter({ created_by: user.email });
                setUserSubjects(subjects || []);
                const initialGoals = {};
                (subjects || []).forEach(s => {
                    initialGoals[s.subject_code] = 5; // Default 5 hours
                });
                setWeeklyGoals(initialGoals);
            }
        };
        loadSubjects();
    }, [user]);

    const handleGoalChange = (subjectCode, hours) => {
        setWeeklyGoals(prev => ({ ...prev, [subjectCode]: hours }));
    };

    const handlePriorityChange = (subjectCode, checked) => {
        setPrioritySubjects(prev => 
            checked ? [...prev, subjectCode] : prev.filter(code => code !== subjectCode)
        );
    };

    const handleGeneratePlan = async () => {
        if (userSubjects.length === 0) {
            toast({ title: "No Subjects Found", description: "Please add subjects in the 'Subjects' tab first.", variant: "destructive" });
            return;
        }

        const goalString = userSubjects.map(s => `- ${s.subject_name}: ${weeklyGoals[s.subject_code] || 0} hours`).join('\n');
        const priorityString = userSubjects.filter(s => prioritySubjects.includes(s.subject_code)).map(s => s.subject_name).join(', ') || 'None';

        try {
            const response = await InvokeLLM({
                feature: "goal_ai_gen",
                prompt: `You are an expert VCE study planner. Create a highly optimized and realistic weekly study schedule based on these constraints:

**Subjects & Weekly Hour Goals:**
${goalString}

**Daily & Priority Constraints:**
- Maximum study sessions per day: ${maxSessionsPerDay}
- Prioritize these subjects for peak focus times: ${priorityString}

**Scheduling Rules:**
- Schedule study blocks on weekdays (Mon-Fri) between 3:00 PM - 10:00 PM.
- Schedule study blocks on weekends (Sat-Sun) between 9:00 AM - 10:00 PM.
- Each study session must be 45-90 minutes long.
- MANDATORY: Include a 15-minute break after each study session.
- Include a 1-hour dinner break around 6:00 PM or 7:00 PM.
- Distribute hours for each subject across the week to support spaced repetition. Don't cram all hours for one subject into one or two days.

**Student's Special Instructions (IMPORTANT):**
- "${specialInstructions || 'No special instructions.'}"

**Output Format (Strict):**
Return a JSON object with a single key "weekly_plan". The value should be an array of event objects for the entire week. Each event object must have:
- "day": (String) Full day name, e.g., "Monday".
- "start_time": (String) In "HH:MM" format.
- "end_time": (String) In "HH:MM" format.
- "activity": (String) Description, e.g., "Study: Chemistry" or "Break".
- "subject_name": (String) The subject name for study sessions, or null for non-study events.`,
                add_context_from_internet: false,
                response_json_schema: {
                    type: "object",
                    properties: {
                        weekly_plan: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    day: { type: "string" },
                                    start_time: { type: "string" },
                                    end_time: { type: "string" },
                                    activity: { type: "string" },
                                    subject_name: { type: "string" }
                                },
                                required: ["day", "start_time", "end_time", "activity"]
                            }
                        }
                    },
                    required: ["weekly_plan"]
                }
            });

            if (!response || !response.weekly_plan) {
                throw new Error("AI returned an invalid response.");
            }

            onPlanGenerated(response.weekly_plan);

        } catch (error) {
            console.error("Error generating AI plan:", error);
            toast({ title: "Generation Failed", description: "The AI couldn't create a schedule. Please try simplifying your instructions or try again.", variant: "destructive" });
        }
    };

    return (
        <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200/50">
            <CardHeader>
                <CardTitle className="flex items-center gap-3 text-purple-900">
                    <Wand2 className="w-6 h-6" />
                    AI-Powered Study Planner
                </CardTitle>
                <p className="text-purple-700">Tell the AI your goals, and it will generate an optimized weekly schedule for you.</p>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Subject Goals */}
                <div>
                    <Label className="text-lg font-semibold text-purple-800">1. Weekly Subject Goals</Label>
                    <div className="mt-2 space-y-4">
                        {userSubjects.map(subject => (
                            <div key={subject.subject_code}>
                                <div className="flex items-center justify-between mb-2">
                                    <Label htmlFor={`priority-${subject.subject_code}`} className="flex items-center gap-2 text-sm">
                                        <Checkbox
                                            id={`priority-${subject.subject_code}`}
                                            onCheckedChange={(checked) => handlePriorityChange(subject.subject_code, checked)}
                                        />
                                        {subject.subject_name}
                                    </Label>
                                    <Badge variant="outline" className="w-24 justify-center text-xs">
                                        {weeklyGoals[subject.subject_code] || 0} hours/week
                                    </Badge>
                                </div>
                                <Slider
                                    value={[weeklyGoals[subject.subject_code] || 0]}
                                    onValueChange={([value]) => handleGoalChange(subject.subject_code, value)}
                                    min={0}
                                    max={15}
                                    step={1}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Daily Limits */}
                <div>
                    <Label className="text-lg font-semibold text-purple-800">2. Daily Pace</Label>
                    <div className="mt-2 space-y-2">
                        <div className="flex justify-between items-center">
                            <Label className="text-sm">Max study sessions per day</Label>
                             <Badge variant="outline" className="w-24 justify-center">{maxSessionsPerDay} sessions</Badge>
                        </div>
                        <Slider
                            value={[maxSessionsPerDay]}
                            onValueChange={([val]) => setMaxSessionsPerDay(val)}
                            min={1} max={8} step={1}
                        />
                    </div>
                </div>

                {/* Special Instructions */}
                <div>
                    <Label htmlFor="special-instructions" className="text-lg font-semibold text-purple-800">3. Special Instructions</Label>
                    <Textarea
                        id="special-instructions"
                        value={specialInstructions}
                        onChange={(e) => setSpecialInstructions(e.target.value)}
                        placeholder="e.g., I have football practice on Tuesdays and Thursdays from 4-6 PM. I prefer not to study on Saturday evenings."
                        className="mt-2"
                    />
                </div>

                <div className="pt-4 flex justify-end">
                    <Button
                        onClick={handleGeneratePlan}
                        disabled={isGenerating}
                        className="bg-purple-600 hover:bg-purple-700 w-full sm:w-auto"
                        size="lg"
                    >
                        <Sparkles className="w-5 h-5 mr-2" />
                        {isGenerating ? "Generating Your Plan..." : "Generate My Weekly Plan"}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}