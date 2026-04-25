import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar, Plus, Edit, Trash2, CheckCircle2 } from "lucide-react";
import { format, parse } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import TimePicker from "@/components/shared/TimePicker";

const activityConfig = {
    lecture_review: { bg: "bg-blue-500/10", text: "text-blue-700", border: "border-blue-200/50", dot: "bg-blue-500", label: "Lecture Review" },
    homework: { bg: "bg-purple-500/10", text: "text-purple-700", border: "border-purple-200/50", dot: "bg-purple-500", label: "Homework" },
    practice_problems: { bg: "bg-emerald-500/10", text: "text-emerald-700", border: "border-emerald-200/50", dot: "bg-emerald-500", label: "Practice" },
    reading: { bg: "bg-amber-500/10", text: "text-amber-700", border: "border-amber-200/50", dot: "bg-amber-500", label: "Reading" },
    revision: { bg: "bg-pink-500/10", text: "text-pink-700", border: "border-pink-200/50", dot: "bg-pink-500", label: "Revision" },
    quiz_prep: { bg: "bg-indigo-500/10", text: "text-indigo-700", border: "border-indigo-200/50", dot: "bg-indigo-500", label: "Quiz Prep" },
    exam: { bg: "bg-red-500/10", text: "text-red-700", border: "border-red-200/50", dot: "bg-red-500", label: "Exam" },
    assignment: { bg: "bg-orange-500/10", text: "text-orange-700", border: "border-orange-200/50", dot: "bg-orange-500", label: "Assignment" },
    other: { bg: "bg-slate-500/10", text: "text-slate-700", border: "border-slate-200/50", dot: "bg-slate-500", label: "Other" }
};

export default function DayCalendar({ user, userProfile }) {
    const [todayEvents, setTodayEvents] = useState([]);
    const [isAddingEvent, setIsAddingEvent] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null);
    const [userSubjects, setUserSubjects] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    
    const canAccessPlanner = userProfile?.subscription_tier === 'premium';

    const [newEvent, setNewEvent] = useState({
        title: "",
        subject_name: "",
        subject_code: "",
        start_time: "09:00",
        end_time: "10:00",
        study_type: "lecture_review",
        notes: ""
    });

    useEffect(() => {
        if (user?.email) {
            loadData();
        }
    }, [user]);

    // Real-time updates for study plans and subjects
    useEffect(() => {
        if (!user?.email) return;

        const unsubscribePlan = base44.entities.StudyPlan.subscribe((event) => {
            if (event.data?.created_by === user.email) {
                const today = format(new Date(), 'yyyy-MM-dd');
                
                if (event.type === 'create' && event.data.date === today) {
                    setTodayEvents(prev => {
                        const updated = [event.data, ...prev];
                        return updated.sort((a, b) => {
                            const timeA = parse(a.start_time, 'HH:mm', new Date());
                            const timeB = parse(b.start_time, 'HH:mm', new Date());
                            return timeA - timeB;
                        });
                    });
                } else if (event.type === 'update') {
                    setTodayEvents(prev => prev.map(e => e.id === event.id ? event.data : e));
                } else if (event.type === 'delete') {
                    setTodayEvents(prev => prev.filter(e => e.id !== event.id));
                }
            }
        });

        const unsubscribeSubjects = base44.entities.UserSubject.subscribe((event) => {
            if (event.data?.created_by === user.email) {
                if (event.type === 'create') {
                    setUserSubjects(prev => [...prev, event.data]);
                } else if (event.type === 'update') {
                    setUserSubjects(prev => prev.map(s => s.id === event.id ? event.data : s));
                } else if (event.type === 'delete') {
                    setUserSubjects(prev => prev.filter(s => s.id !== event.id));
                }
            }
        });

        return () => {
            unsubscribePlan();
            unsubscribeSubjects();
        };
    }, [user]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const today = format(new Date(), 'yyyy-MM-dd');
            // Sequential loading with error handling for rate limits
            const events = await base44.entities.StudyPlan.filter({ created_by: user.email, date: today }).catch(err => {
                if (err.message?.includes('Rate limit')) return [];
                throw err;
            });
            
            await new Promise(resolve => setTimeout(resolve, 150));
            
            const subjects = await base44.entities.UserSubject.filter({ created_by: user.email, is_active: true }).catch(err => {
                if (err.message?.includes('Rate limit')) return [];
                throw err;
            });

            const sortedEvents = (events || []).sort((a, b) => {
                const timeA = parse(a.start_time, 'HH:mm', new Date());
                const timeB = parse(b.start_time, 'HH:mm', new Date());
                return timeA - timeB;
            });

            setTodayEvents(sortedEvents);
            setUserSubjects(subjects || []);
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddEvent = async () => {
        if (!newEvent.title?.trim() || !newEvent.start_time || !newEvent.end_time) {
            toast({ title: "Missing fields", description: "Please fill in title, start time, and end time.", variant: "destructive" });
            return;
        }

        const eventData = {
            title: newEvent.title,
            subject_name: newEvent.subject_name || "",
            subject_code: newEvent.subject_code || "",
            date: format(new Date(), 'yyyy-MM-dd'),
            start_time: newEvent.start_time,
            end_time: newEvent.end_time,
            study_type: newEvent.study_type || "lecture_review",
            notes: newEvent.notes || "",
            is_completed: false
        };

        // Close dialog first to prevent glitches
        setIsAddingEvent(false);
        setNewEvent({
            title: "",
            subject_name: "",
            subject_code: "",
            start_time: "09:00",
            end_time: "10:00",
            study_type: "lecture_review",
            notes: ""
        });

        try {
            await base44.entities.StudyPlan.create(eventData);
            toast({ title: "Event added!" });
        } catch (error) {
            console.error("Error adding event:", error);
            toast({ title: "Error", description: "Could not add event.", variant: "destructive" });
        }
    };

    const handleUpdateEvent = async () => {
        if (!editingEvent) return;

        try {
            await base44.entities.StudyPlan.update(editingEvent.id, {
                title: editingEvent.title,
                subject_name: editingEvent.subject_name || "",
                subject_code: editingEvent.subject_code || "",
                start_time: editingEvent.start_time,
                end_time: editingEvent.end_time,
                study_type: editingEvent.study_type || "lecture_review",
                notes: editingEvent.notes || ""
            });

            toast({ title: "Event updated!" });
            setEditingEvent(null);
        } catch (error) {
            console.error("Error updating event:", error);
            toast({ title: "Error", description: "Could not update event.", variant: "destructive" });
        }
    };

    const handleDeleteEvent = async (eventId) => {
        if (!confirm("Delete this event?")) return;

        try {
            await base44.entities.StudyPlan.delete(eventId);
            toast({ title: "Event deleted" });
            // Manually update state as fallback
            setTodayEvents(prev => prev.filter(e => e.id !== eventId));
        } catch (error) {
            console.error("Error deleting event:", error);
            toast({ title: "Error", description: error.message || "Could not delete event.", variant: "destructive" });
        }
    };

    const handleToggleComplete = async (event) => {
        try {
            await base44.entities.StudyPlan.update(event.id, {
                is_completed: !event.is_completed
            });
        } catch (error) {
            console.error("Error updating event:", error);
            toast({ title: "Error", description: "Could not update event.", variant: "destructive" });
        }
    };

    const completedCount = todayEvents.filter(e => e.is_completed).length;
    const totalCount = todayEvents.length;

    if (isLoading) {
        return (
            <Card className="overflow-hidden bg-white/80 backdrop-blur-sm border-0 shadow-xl">
                <CardContent className="p-8 text-center">
                    <div className="animate-spin w-8 h-8 border-3 border-purple-200 border-t-purple-600 rounded-full mx-auto"></div>
                    <p className="text-gray-500 mt-4 text-sm">Loading schedule...</p>
                </CardContent>
            </Card>
        );
    }

    if (!canAccessPlanner) {
        return (
            <Card className="overflow-hidden bg-white/80 backdrop-blur-sm border-0 shadow-xl">
                <div className="h-1.5 bg-gradient-to-r from-purple-500 to-pink-500" />
                <CardContent className="p-8 text-center">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Calendar className="w-6 h-6 text-purple-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Study Planner</h3>
                    <p className="text-gray-600 text-sm">Available with Premium</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <Card className="overflow-hidden bg-white/80 backdrop-blur-sm border-0 shadow-xl">
                <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
                                <Calendar className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <CardTitle className="text-lg font-bold text-gray-900">Today's Schedule</CardTitle>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    {format(new Date(), 'EEEE, MMMM d')}
                                </p>
                            </div>
                        </div>
                        <Button
                            onClick={() => setIsAddingEvent(true)}
                            size="sm"
                            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-md shadow-indigo-200/50 rounded-xl"
                            disabled={!canAccessPlanner}
                        >
                            <Plus className="w-4 h-4 mr-1.5" />
                            Add
                        </Button>
                    </div>
                    {totalCount > 0 && (
                        <div className="mt-4">
                            <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                                <span>{completedCount} of {totalCount} completed</span>
                                <span>{Math.round((completedCount / totalCount) * 100)}%</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <motion.div 
                                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(completedCount / totalCount) * 100}%` }}
                                    transition={{ duration: 0.5, ease: "easeOut" }}
                                />
                            </div>
                        </div>
                    )}
                </CardHeader>
                <CardContent className="pt-0">
                    {todayEvents.length === 0 ? (
                        <div className="text-center py-10">
                            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl flex items-center justify-center">
                                <Calendar className="w-8 h-8 text-gray-300" />
                            </div>
                            <p className="font-semibold text-gray-700 mb-1">No events today</p>
                            <p className="text-sm text-gray-400 mb-5">Plan your study sessions</p>
                            <Button
                                onClick={() => setIsAddingEvent(true)}
                                variant="outline"
                                className="rounded-xl border-dashed border-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Add your first event
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {todayEvents.map((event, index) => {
                                const config = activityConfig[event.study_type] || activityConfig.other;
                                return (
                                    <motion.div
                                        key={event.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.03 }}
                                        className={`group relative p-3.5 rounded-xl border transition-all duration-200 hover:shadow-md ${
                                            event.is_completed 
                                                ? 'bg-emerald-50/50 border-emerald-200/50' 
                                                : `${config.bg} ${config.border}`
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => handleToggleComplete(event)}
                                                className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                                    event.is_completed
                                                        ? 'bg-emerald-500 border-emerald-500 shadow-sm'
                                                        : `border-gray-300 hover:border-emerald-400 hover:bg-emerald-50`
                                                }`}
                                            >
                                                {event.is_completed && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                            </button>
                                            
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                                        event.is_completed 
                                                            ? 'bg-emerald-100 text-emerald-700' 
                                                            : `${config.bg} ${config.text}`
                                                    }`}>
                                                        {event.start_time} - {event.end_time}
                                                    </span>
                                                    {!event.is_completed && (
                                                        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                                                    )}
                                                </div>
                                                <p className={`font-medium text-sm truncate ${
                                                    event.is_completed ? 'line-through text-gray-400' : 'text-gray-800'
                                                }`}>
                                                    {event.title}
                                                </p>
                                                {event.subject_name && (
                                                    <p className="text-xs text-gray-500 truncate">{event.subject_name}</p>
                                                )}
                                            </div>

                                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setEditingEvent(event)}
                                                    className="h-7 w-7 rounded-lg hover:bg-white/80"
                                                >
                                                    <Edit className="w-3.5 h-3.5 text-gray-500" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDeleteEvent(event.id)}
                                                    className="h-7 w-7 rounded-lg hover:bg-red-50"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                                </Button>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Add Event Dialog */}
            {isAddingEvent && (
                <Dialog open={true} onOpenChange={(open) => !open && setIsAddingEvent(false)}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Add Study Event</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div>
                                <Label>Title</Label>
                                <Input
                                    value={newEvent.title}
                                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                                    placeholder="e.g., Biology revision"
                                />
                            </div>
                            <div>
                                <Label>Subject (optional)</Label>
                                <Select
                                    value={newEvent.subject_name}
                                    onValueChange={(value) => {
                                        const subject = userSubjects.find(s => s.subject_name === value);
                                        setNewEvent({
                                            ...newEvent,
                                            subject_name: value,
                                            subject_code: subject?.subject_code || ""
                                        });
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select subject" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {userSubjects.map(subject => (
                                            <SelectItem key={subject.id} value={subject.subject_name}>
                                                {subject.subject_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Start Time</Label>
                                    <Input
                                        type="time"
                                        value={newEvent.start_time}
                                        onChange={(e) => setNewEvent({ ...newEvent, start_time: e.target.value })}
                                        className="w-full"
                                    />
                                </div>
                                <div>
                                    <Label>End Time</Label>
                                    <Input
                                        type="time"
                                        value={newEvent.end_time}
                                        onChange={(e) => setNewEvent({ ...newEvent, end_time: e.target.value })}
                                        className="w-full"
                                    />
                                </div>
                            </div>
                            <div>
                                <Label>Activity Type</Label>
                                <Select
                                    value={newEvent.study_type}
                                    onValueChange={(value) => setNewEvent({ ...newEvent, study_type: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="lecture_review">Lecture Review</SelectItem>
                                        <SelectItem value="homework">Homework</SelectItem>
                                        <SelectItem value="practice_problems">Practice Problems</SelectItem>
                                        <SelectItem value="reading">Reading</SelectItem>
                                        <SelectItem value="revision">Revision</SelectItem>
                                        <SelectItem value="quiz_prep">Quiz Prep</SelectItem>
                                        <SelectItem value="exam">Exam</SelectItem>
                                        <SelectItem value="assignment">Assignment</SelectItem>
                                        <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Notes (optional)</Label>
                                <Textarea
                                    value={newEvent.notes}
                                    onChange={(e) => setNewEvent({ ...newEvent, notes: e.target.value })}
                                    placeholder="Add any additional notes..."
                                    rows={3}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsAddingEvent(false)}>Cancel</Button>
                            <Button onClick={handleAddEvent}>Add Event</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {/* Edit Event Dialog */}
            {editingEvent && (
                <Dialog open={true} onOpenChange={(open) => !open && setEditingEvent(null)}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Edit Event</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div>
                                <Label>Title</Label>
                                <Input
                                    value={editingEvent.title}
                                    onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label>Subject</Label>
                                <Select 
                                    value={editingEvent.subject_name}
                                    onValueChange={(value) => {
                                        const subject = userSubjects.find(s => s.subject_name === value);
                                        setEditingEvent({
                                            ...editingEvent,
                                            subject_name: value,
                                            subject_code: subject?.subject_code || ""
                                        });
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {userSubjects.map(subject => (
                                            <SelectItem key={subject.id} value={subject.subject_name}>
                                                {subject.subject_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Start Time</Label>
                                    <Input
                                        type="time"
                                        value={editingEvent.start_time}
                                        onChange={(e) => setEditingEvent({ ...editingEvent, start_time: e.target.value })}
                                        className="w-full"
                                    />
                                </div>
                                <div>
                                    <Label>End Time</Label>
                                    <Input
                                        type="time"
                                        value={editingEvent.end_time}
                                        onChange={(e) => setEditingEvent({ ...editingEvent, end_time: e.target.value })}
                                        className="w-full"
                                    />
                                </div>
                            </div>
                            <div>
                                <Label>Activity Type</Label>
                                <Select
                                    value={editingEvent.study_type}
                                    onValueChange={(value) => setEditingEvent({ ...editingEvent, study_type: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="lecture_review">Lecture Review</SelectItem>
                                        <SelectItem value="homework">Homework</SelectItem>
                                        <SelectItem value="practice_problems">Practice Problems</SelectItem>
                                        <SelectItem value="reading">Reading</SelectItem>
                                        <SelectItem value="revision">Revision</SelectItem>
                                        <SelectItem value="quiz_prep">Quiz Prep</SelectItem>
                                        <SelectItem value="exam">Exam</SelectItem>
                                        <SelectItem value="assignment">Assignment</SelectItem>
                                        <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Notes</Label>
                                <Textarea
                                    value={editingEvent.notes || ""}
                                    onChange={(e) => setEditingEvent({ ...editingEvent, notes: e.target.value })}
                                    rows={3}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setEditingEvent(null)}>Cancel</Button>
                            <Button onClick={handleUpdateEvent}>Save Changes</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}