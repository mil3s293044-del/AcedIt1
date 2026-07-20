import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  Target,
  TrendingUp,
  Calendar,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Sparkles,
  FileText,
  Star,
  Zap,
  Brain,
  Trophy,
  Flame,
  Edit,
  Circle,
  X,
  GripVertical
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

import SubjectFolderGridView from "./SubjectFolderGridView";

export default function SubjectFolder({ userSubjects: initialUserSubjects, user, onBack, initialSubjectCode }) {
  const [userSubjects, setUserSubjects] = useState(initialUserSubjects);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [goals, setGoals] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [studySessions, setStudySessions] = useState([]);
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [isAddingAssessment, setIsAddingAssessment] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Sync with parent props
  useEffect(() => {
    setUserSubjects(initialUserSubjects);
  }, [initialUserSubjects]);

  // Auto-select subject if coming from deep link (only on initial mount)
  useEffect(() => {
    if (initialSubjectCode && initialUserSubjects.length > 0) {
      const matchingSubject = initialUserSubjects.find(s => s.subject_code === initialSubjectCode);
      if (matchingSubject) {
        setSelectedSubject(matchingSubject);
      }
    }
  }, []);

  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    target_date: '',
    category: 'subject_milestone',
    priority: 'medium',
    milestone_type: 'content',
    sub_goals: []
  });
  
  const [editingGoal, setEditingGoal] = useState(null);
  const [newSubGoal, setNewSubGoal] = useState('');
  const [editSubGoal, setEditSubGoal] = useState('');
  const [showStudyScoreDialog, setShowStudyScoreDialog] = useState(false);
  const [targetStudyScore, setTargetStudyScore] = useState('');

  const [newAssessment, setNewAssessment] = useState({
    assessment_type: 'SAC',
    title: '',
    description: '',
    due_date: '',
    weight_percentage: 0,
    target_score: 0
  });

  useEffect(() => {
    if (selectedSubject && user) {
      loadSubjectData(selectedSubject);
    }
  }, [selectedSubject, user]);

  // Auto-refresh goal progress every 30 seconds
  useEffect(() => {
    if (!selectedSubject || !user || goals.length === 0) return;
    
    const refreshProgress = async () => {
      for (const goal of goals) {
        if (!goal.is_completed && goal.sub_goals?.some(sg => sg.type)) {
          try {
            await base44.functions.invoke('updateGoalProgress', { goal_id: goal.id });
          } catch (error) {
            console.error("Error auto-refreshing progress:", error);
          }
        }
      }
      await loadSubjectData(selectedSubject);
    };
    
    const interval = setInterval(refreshProgress, 30000);
    return () => clearInterval(interval);
  }, [selectedSubject, user, goals]);

  const loadSubjectData = async (subject) => {
    if (!subject || !user) return;
    
    try {
      const [goalsData, assessmentsData, sessionsData] = await Promise.all([
        base44.entities.Goal.filter({
          created_by: user.email,
          subject_code: subject.subject_code
        }).catch(err => {
          console.error("Error loading goals:", err);
          return [];
        }),
        base44.entities.SubjectAssessment.filter({
          created_by: user.email,
          subject_code: subject.subject_code
        }).catch(err => {
          console.error("Error loading assessments:", err);
          return [];
        }),
        base44.entities.StudyTechnique.filter({
          created_by: user.email,
          subject: subject.subject_name
        }, "-created_date", 10).catch(err => {
          console.error("Error loading sessions:", err);
          return [];
        })
      ]);

      setGoals(goalsData || []);
      setAssessments(assessmentsData || []);
      setStudySessions(sessionsData || []);
    } catch (error) {
      console.error("Error loading subject data:", error);
      setGoals([]);
      setAssessments([]);
      setStudySessions([]);
      toast({ 
        title: "Error loading data", 
        description: "Some subject data could not be loaded. Please try again.",
        variant: "destructive" 
      });
    }
  };

  // Normal distribution percentile calculation (mean=30, std=7)
  const getPercentileForScore = (score) => {
    const mean = 30;
    const std = 7;
    const z = (score - mean) / std;
    
    // Approximation of the cumulative distribution function (CDF) for normal distribution
    const erf = (x) => {
      const a1 =  0.254829592;
      const a2 = -0.284496736;
      const a3 =  1.421413741;
      const a4 = -1.453152027;
      const a5 =  1.061405429;
      const p  =  0.3275911;
      
      const sign = x < 0 ? -1 : 1;
      x = Math.abs(x);
      
      const t = 1.0 / (1.0 + p * x);
      const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
      
      return sign * y;
    };
    
    const cdf = 0.5 * (1 + erf(z / Math.sqrt(2)));
    return Math.min(99.9, Math.max(0.1, cdf * 100));
  };

  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  const handleAddGoal = async () => {
    if (!selectedSubject || !user) {
      toast({ title: "Error", description: "Subject information missing.", variant: "destructive" });
      return;
    }
    
    if (!newGoal.title.trim()) {
      toast({ title: "Missing Title", description: "Please enter a goal title.", variant: "destructive" });
      return;
    }

    if (!newGoal.target_date) {
      toast({ title: "Missing Target Date", description: "Please select a target date.", variant: "destructive" });
      return;
    }

    // Validate target date is not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(newGoal.target_date);
    if (targetDate < today) {
      toast({ title: "Invalid Date", description: "Target date cannot be in the past.", variant: "destructive" });
      return;
    }
    
    setIsGeneratingAI(true);
    try {
      // Generate AI sub-goals with XP
      const { data: aiGoalData } = await base44.functions.invoke('generateGoalWithAI', {
        title: newGoal.title,
        description: newGoal.title,
        target_date: newGoal.target_date,
        category: newGoal.category,
        subject_code: selectedSubject.subject_code,
        subject_name: selectedSubject.subject_name
      });

      const subGoalsWithIds = aiGoalData.sub_goals.map((sg, idx) => ({
        id: `sg-${Date.now()}-${idx}`,
        title: sg.title,
        completed: false,
        xp_reward: sg.xp_reward,
        steps: sg.steps || []
      }));
      
      // Build goal data with AI-generated content
      const goalData = {
        title: newGoal.title,
        description: '',
        target_date: newGoal.target_date,
        category: newGoal.category,
        priority: newGoal.priority,
        milestone_type: newGoal.milestone_type,
        sub_goals: subGoalsWithIds,
        subject_code: selectedSubject.subject_code,
        progress: 0,
        difficulty_level: aiGoalData.difficulty_level,
        total_xp_reward: aiGoalData.total_xp_reward,
        tips: aiGoalData.tips || [],
        is_ai_generated: true
      };
      
      if (newGoal.success_criteria?.trim()) {
        goalData.success_criteria = newGoal.success_criteria;
      }
      if (newGoal.motivation?.trim()) {
        goalData.motivation = newGoal.motivation;
      }
      
      await base44.entities.Goal.create(goalData);
      
      // Also add to Study Planner calendar if target_date is set
      if (newGoal.target_date) {
        try {
          await base44.entities.StudyPlan.create({
            title: newGoal.title,
            subject_name: selectedSubject.subject_name,
            subject_code: selectedSubject.subject_code,
            date: newGoal.target_date,
            start_time: "09:00",
            end_time: "10:00",
            notes: `Goal: ${newGoal.description || newGoal.title}`,
            is_completed: false,
            repeat_frequency: "never",
            study_type: "other"
          });
        } catch (calendarError) {
          console.error("Error adding goal to calendar:", calendarError);
        }
      }
      
      toast({ 
        title: "Goal Added!", 
        description: `AI-powered goal created with ${subGoalsWithIds.length} sub-goals and ${aiGoalData.total_xp_reward} XP reward!` 
      });
      setIsAddingGoal(false);
      setNewGoal({ title: '', description: '', target_date: '', category: 'subject_milestone', priority: 'medium', milestone_type: 'content', sub_goals: [] });
      setNewSubGoal('');
      setIsGeneratingAI(false);
      await loadSubjectData(selectedSubject);
    } catch (error) {
      console.error("Error adding goal:", error);
      setIsGeneratingAI(false);
      toast({ title: "Error", description: "Could not add goal. Please try again.", variant: "destructive" });
    }
  };

  const handleUpdateGoal = async () => {
    if (!editingGoal) return;
    
    try {
      // Recalculate progress based on sub-goals
      let updatedGoal = { ...editingGoal };
      if (updatedGoal.sub_goals && updatedGoal.sub_goals.length > 0) {
        const completedCount = updatedGoal.sub_goals.filter(sg => sg.completed).length;
        const progress = Math.round((completedCount / updatedGoal.sub_goals.length) * 100);
        updatedGoal.progress = progress;
        updatedGoal.is_completed = progress === 100;
      }
      
      await base44.entities.Goal.update(editingGoal.id, updatedGoal);
      toast({ title: "Goal Updated!" });
      setEditingGoal(null);
      await loadSubjectData(selectedSubject);
    } catch (error) {
      console.error("Error updating goal:", error);
      // Check if goal was deleted (404)
      if (error?.response?.status === 404 || error?.message?.includes('not found')) {
        toast({ title: "Goal no longer exists", description: "This goal may have been deleted. Refreshing...", variant: "destructive" });
        setEditingGoal(null);
        await loadSubjectData(selectedSubject);
      } else {
        toast({ title: "Error", description: "Could not update goal.", variant: "destructive" });
      }
    }
  };

  const handleSubGoalClick = async (goal, subGoal) => {
    // Refresh progress first
    try {
      await base44.functions.invoke('updateGoalProgress', { goal_id: goal.id });
      await loadSubjectData(selectedSubject);
    } catch (error) {
      console.error("Error updating progress:", error);
    }
    
    // Navigate to the relevant page
    if (subGoal.navigation) {
      const navigationMap = {
        'Study': createPageUrl('Study'),
        'Quizzes': createPageUrl('Quizzes'),
        'AITools': createPageUrl('AITools')
      };
      const path = navigationMap[subGoal.navigation];
      if (path) {
        navigate(path);
      }
    }
  };

  const handleSaveStudyScore = async () => {
    if (!selectedSubject || !targetStudyScore) return;
    
    try {
      const newScore = parseInt(targetStudyScore);
      await base44.entities.UserSubject.update(selectedSubject.id, {
        goal_study_score: newScore
      });
      toast({ title: "Study Score Target Saved!" });
      setShowStudyScoreDialog(false);
      
      // Update selected subject
      setSelectedSubject({ ...selectedSubject, goal_study_score: newScore });
      
      // Update userSubjects array so it persists when going back
      setUserSubjects(prev => prev.map(s => 
        s.id === selectedSubject.id ? { ...s, goal_study_score: newScore } : s
      ));
    } catch (error) {
      console.error("Error saving study score:", error);
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleAddAssessment = async () => {
    if (!selectedSubject || !user) {
      toast({ title: "Error", description: "Subject information missing.", variant: "destructive" });
      return;
    }
    
    try {
      await base44.entities.SubjectAssessment.create({
        ...newAssessment,
        subject_name: selectedSubject.subject_name,
        subject_code: selectedSubject.subject_code
      });
      
      // Also add to Study Planner calendar if due_date is set
      if (newAssessment.due_date) {
        try {
          await base44.entities.StudyPlan.create({
            title: newAssessment.title,
            subject_name: selectedSubject.subject_name,
            subject_code: selectedSubject.subject_code,
            date: newAssessment.due_date,
            start_time: "09:00",
            end_time: "10:00",
            notes: `${newAssessment.assessment_type}: ${newAssessment.description || newAssessment.title}`,
            is_completed: false,
            repeat_frequency: "never",
            study_type: "assignment"
          });
        } catch (calendarError) {
          console.error("Error adding assessment to calendar:", calendarError);
        }
      }
      
      toast({ title: "Assessment Added!", description: "Your assessment has been created and added to calendar." });
      setIsAddingAssessment(false);
      setNewAssessment({ assessment_type: 'SAC', title: '', description: '', due_date: '', weight_percentage: 0, target_score: 0 });
      await loadSubjectData(selectedSubject);
    } catch (error) {
      console.error("Error adding assessment:", error);
      toast({ title: "Error", description: "Could not add assessment. Please try again.", variant: "destructive" });
    }
  };

  const handleDeleteGoal = async (goalId) => {
    if (!selectedSubject || !user) return;
    
    try {
      // Find the goal first to get its details for calendar sync
      const goalToDelete = goals.find(g => g.id === goalId);
      
      await base44.entities.Goal.delete(goalId);
      
      // Also delete matching calendar event if target_date exists
      if (goalToDelete?.target_date) {
        try {
          const calendarEvents = await base44.entities.StudyPlan.filter({
            created_by: user.email,
            title: goalToDelete.title,
            date: goalToDelete.target_date
          });
          if (calendarEvents.length > 0) {
            await base44.entities.StudyPlan.delete(calendarEvents[0].id);
          }
        } catch (calendarError) {
          console.error("Error deleting from calendar:", calendarError);
        }
      }
      
      toast({ title: "Goal Deleted" });
      await loadSubjectData(selectedSubject);
    } catch (error) {
      console.error("Error deleting goal:", error);
      // If goal already deleted (404), just refresh
      if (error?.response?.status === 404 || error?.message?.includes('not found')) {
        await loadSubjectData(selectedSubject);
      } else {
        toast({ title: "Error", description: "Could not delete goal.", variant: "destructive" });
      }
    }
  };

  const handleDeleteAssessment = async (assessmentId) => {
    if (!selectedSubject) return;
    
    try {
      await base44.entities.SubjectAssessment.delete(assessmentId);
      toast({ title: "Assessment Deleted" });
      await loadSubjectData(selectedSubject);
    } catch (error) {
      console.error("Error deleting assessment:", error);
      toast({ title: "Error", description: "Could not delete assessment.", variant: "destructive" });
    }
  };

  const handleToggleGoalCompletion = async (goal) => {
    if (!selectedSubject) return;
    
    try {
      const newCompletedState = !goal.is_completed;
      
      // Update sub-goals to match if completing the whole goal
      let updatedSubGoals = goal.sub_goals;
      if (newCompletedState && goal.sub_goals && goal.sub_goals.length > 0) {
        updatedSubGoals = goal.sub_goals.map(sg => ({ ...sg, completed: true }));
      }
      
      await base44.entities.Goal.update(goal.id, {
        is_completed: newCompletedState,
        progress: newCompletedState ? 100 : goal.progress,
        sub_goals: updatedSubGoals
      });
      
      // Also update matching calendar event if target_date exists
      if (goal.target_date) {
        try {
          const calendarEvents = await base44.entities.StudyPlan.filter({
            created_by: user.email,
            title: goal.title,
            date: goal.target_date
          });
          if (calendarEvents.length > 0) {
            await base44.entities.StudyPlan.update(calendarEvents[0].id, {
              is_completed: newCompletedState
            });
          }
        } catch (calendarError) {
          console.error("Error syncing with calendar:", calendarError);
        }
      }
      
      await loadSubjectData(selectedSubject);
    } catch (error) {
      console.error("Error updating goal:", error);
      if (error?.response?.status === 404 || error?.message?.includes('not found')) {
        toast({ title: "Goal no longer exists", description: "Refreshing data...", variant: "destructive" });
        await loadSubjectData(selectedSubject);
      } else {
        toast({ title: "Error", description: "Could not update goal.", variant: "destructive" });
      }
    }
  };

  const handleToggleAssessmentCompletion = async (assessment) => {
    if (!selectedSubject) return;
    
    try {
      const newCompletedState = !assessment.is_completed;
      await base44.entities.SubjectAssessment.update(assessment.id, {
        is_completed: newCompletedState
      });
      
      // Also update matching calendar event if due_date exists
      if (assessment.due_date) {
        try {
          const calendarEvents = await base44.entities.StudyPlan.filter({
            created_by: user.email,
            title: assessment.title,
            date: assessment.due_date
          });
          if (calendarEvents.length > 0) {
            await base44.entities.StudyPlan.update(calendarEvents[0].id, {
              is_completed: newCompletedState
            });
          }
        } catch (calendarError) {
          console.error("Error syncing with calendar:", calendarError);
        }
      }
      
      await loadSubjectData(selectedSubject);
    } catch (error) {
      console.error("Error updating assessment:", error);
      toast({ title: "Error", description: "Could not update assessment.", variant: "destructive" });
    }
  };

  const totalStudyTime = studySessions.reduce((sum, session) => sum + (session.session_duration || 0), 0);
  const completedGoals = goals.filter((g) => g.is_completed).length;
  const completedAssessments = assessments.filter((a) => a.is_completed).length;
  const goalCompletionRate = goals.length > 0 ? completedGoals / goals.length * 100 : 0;

  return (
    <div className="space-y-4 lg:space-y-6">
      {selectedSubject ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="min-h-screen relative">

          {/* Animated Background */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                rotate: [0, 180, 360]
              }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10"
              style={{ backgroundColor: selectedSubject.color || '#3B82F6' }} />

            <motion.div
              animate={{
                scale: [1.2, 1, 1.2],
                rotate: [360, 180, 0]
              }}
              transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
              className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full opacity-10"
              style={{ backgroundColor: selectedSubject.color || '#3B82F6' }} />

          </div>

          <div className="relative z-10 p-4 lg:p-8 space-y-6">
            {/* Header with Back Button */}
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}>

              <Button
                variant="ghost"
                onClick={() => setSelectedSubject(null)}
                className="mb-6 hover:bg-surface/50 text-foreground">

                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to All Subjects
              </Button>
            </motion.div>

            {/* Hero Section */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", duration: 0.6 }}>

              <Card className="relative overflow-hidden border-0 shadow-2xl">
                {/* Gradient Background */}
                <div
                  className="absolute inset-0 opacity-20"
                  style={{
                    background: `linear-gradient(135deg, ${selectedSubject.color || '#3B82F6'} 0%, ${selectedSubject.color || '#3B82F6'}dd 50%, ${selectedSubject.color || '#3B82F6'}bb 100%)`
                  }} />


                {/* Animated Circles */}
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.05, 0.1] }}
                  transition={{ duration: 4, repeat: Infinity }}
                  className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl"
                  style={{ backgroundColor: selectedSubject.color || '#3B82F6' }} />

                <motion.div
                  animate={{ scale: [1.2, 1, 1.2], opacity: [0.05, 0.1, 0.05] }}
                  transition={{ duration: 5, repeat: Infinity }}
                  className="absolute bottom-0 left-0 w-96 h-96 rounded-full blur-3xl"
                  style={{ backgroundColor: selectedSubject.color || '#3B82F6' }} />


                <CardContent className="relative p-8 lg:p-12">
                  <div className="grid lg:grid-cols-2 gap-8">
                    {/* Left: Subject Info */}
                    <div>
                      <motion.div
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}>

                        <Badge
                          className="mb-4 font-semibold border-2"
                          style={{
                            backgroundColor: `${selectedSubject.color || '#3B82F6'}20`,
                            color: selectedSubject.color || '#3B82F6',
                            borderColor: `${selectedSubject.color || '#3B82F6'}40`
                          }}>

                          {selectedSubject.subject_code}
                        </Badge>
                        <h1 className="text-4xl lg:text-5xl font-black mb-3 leading-tight text-foreground">
                          {selectedSubject.subject_name}
                        </h1>
                        <p className="text-muted-foreground text-lg mb-6">
                          {selectedSubject.year_level}
                        </p>

                        <div
                        className="rounded-2xl p-4 border-2 cursor-pointer hover:shadow-lg transition-all overflow-hidden"
                        style={{
                        backgroundColor: `${selectedSubject.color || '#3B82F6'}10`,
                        borderColor: `${selectedSubject.color || '#3B82F6'}25`
                        }}
                        onClick={() => {
                        setTargetStudyScore(selectedSubject.goal_study_score?.toString() || '');
                        setShowStudyScoreDialog(true);
                        }}>

                        <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                        <Trophy className="w-5 h-5" style={{ color: selectedSubject.color || '#3B82F6' }} />
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Target Score</span>
                        </div>
                        <Edit className="w-3.5 h-3.5 text-muted-foreground/60" />
                        </div>
                        {selectedSubject.goal_study_score ? (
                        <div className="space-y-2">
                        <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-black text-foreground">{selectedSubject.goal_study_score}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                        Top <span className="font-bold" style={{ color: selectedSubject.color || '#3B82F6' }}>{(100 - getPercentileForScore(selectedSubject.goal_study_score)).toFixed(1)}%</span> · {getPercentileForScore(selectedSubject.goal_study_score).toFixed(0)}th percentile
                        </div>
                        </div>
                        ) : (
                        <p className="text-sm text-muted-foreground/60">Tap to set target</p>
                        )}
                        </div>
                      </motion.div>
                    </div>

                    {/* Right: Stats Grid */}
                    <motion.div
                      initial={{ x: 20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="grid grid-cols-2 gap-4">

                      <div
                        className="rounded-2xl p-6 border-2"
                        style={{
                          backgroundColor: `${selectedSubject.color || '#3B82F6'}10`,
                          borderColor: `${selectedSubject.color || '#3B82F6'}30`
                        }}>

                        <Clock className="w-8 h-8 mb-3" style={{ color: selectedSubject.color || '#3B82F6' }} />
                        <p className="text-3xl font-black mb-1 text-foreground">{Math.round(totalStudyTime / 60)}h</p>
                        <p className="text-sm text-muted-foreground">Total Study Time</p>
                      </div>

                      <div
                        className="rounded-2xl p-6 border-2"
                        style={{
                          backgroundColor: `${selectedSubject.color || '#3B82F6'}10`,
                          borderColor: `${selectedSubject.color || '#3B82F6'}30`
                        }}>

                        <Flame className="w-8 h-8 mb-3" style={{ color: selectedSubject.color || '#3B82F6' }} />
                        <p className="text-3xl font-black mb-1 text-foreground">{studySessions.length}</p>
                        <p className="text-sm text-muted-foreground">Study Sessions</p>
                      </div>

                      <div
                        className="rounded-2xl p-6 border-2"
                        style={{
                          backgroundColor: `${selectedSubject.color || '#3B82F6'}10`,
                          borderColor: `${selectedSubject.color || '#3B82F6'}30`
                        }}>

                        <Target className="w-8 h-8 mb-3" style={{ color: selectedSubject.color || '#3B82F6' }} />
                        <p className="text-3xl font-black mb-1 text-foreground">{completedGoals}/{goals.length}</p>
                        <p className="text-sm text-muted-foreground">Goals Completed</p>
                      </div>

                      <div
                        className="rounded-2xl p-6 border-2"
                        style={{
                          backgroundColor: `${selectedSubject.color || '#3B82F6'}10`,
                          borderColor: `${selectedSubject.color || '#3B82F6'}30`
                        }}>

                        <FileText className="w-8 h-8 mb-3" style={{ color: selectedSubject.color || '#3B82F6' }} />
                        <p className="text-3xl font-black mb-1 text-foreground">{completedAssessments}/{assessments.length}</p>
                        <p className="text-sm text-muted-foreground">Tasks Done</p>
                      </div>
                    </motion.div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Main Content Tabs */}
            <Tabs defaultValue="goals" className="space-y-4 lg:space-y-6">
              <TabsList className="grid w-full grid-cols-3 h-12 bg-surface rounded-xl shadow-md border">
                <TabsTrigger value="goals" className="text-base">Goals</TabsTrigger>
                <TabsTrigger value="assessments" className="text-base">Assessments</TabsTrigger>
                <TabsTrigger value="stats" className="text-base">Stats & Activity</TabsTrigger>
              </TabsList>

              <TabsContent value="goals" className="space-y-4">
                {/* Goals Column (now inside TabContent) */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="space-y-6"> {/* lg:col-span-2 removed */}

                  {/* Goals Section */}
                  <Card className="border-0 shadow-xl">
                    <CardHeader className="border-b bg-gradient-to-r from-indigo-50 to-purple-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                            <Target className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <CardTitle className="text-2xl">Goals</CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                              {completedGoals} of {goals.length} completed • {Math.round(goalCompletionRate)}%
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={() => setIsAddingGoal(true)}
                          size="lg"
                          className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg">

                          <Plus className="w-5 h-5 mr-2" />
                          New Goal
                        </Button>
                      </div>
                      {goals.length > 0 &&
                        <Progress value={goalCompletionRate} className="h-2 mt-4" />
                      }
                    </CardHeader>

                    <CardContent className="p-6">
                      {goals.length === 0 ?
                        <div className="text-center py-16">
                          <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Target className="w-10 h-10 text-indigo-600" />
                          </div>
                          <h3 className="text-xl font-bold text-foreground mb-2">No Goals Yet</h3>
                          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                            Start setting goals to track your progress and stay motivated!
                          </p>
                          <Button
                            onClick={() => setIsAddingGoal(true)}
                            className="bg-gradient-to-r from-indigo-600 to-purple-600">

                            <Sparkles className="w-4 h-4 mr-2" />
                            Create First Goal
                          </Button>
                        </div> :

                        <div className="space-y-3">
                        <AnimatePresence>
                        {goals.map((goal, index) => {
                        const hasSubGoals = goal.sub_goals && goal.sub_goals.length > 0;
                        const completedSubGoals = hasSubGoals ? goal.sub_goals.filter(sg => sg.completed).length : 0;
                        const subGoalProgress = hasSubGoals ? Math.round((completedSubGoals / goal.sub_goals.length) * 100) : 0;

                        return (
                        <motion.div
                          key={goal.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ delay: index * 0.05 }}
                          layout>

                          <Card className={`group hover:shadow-lg transition-all ${goal.is_completed ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200' : 'bg-surface hover:border-indigo-300'}`}>
                            <CardContent className="p-5">
                              <div className="flex items-start gap-4">
                                {!hasSubGoals ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Toggle goal completion"
                                    onClick={() => handleToggleGoalCompletion(goal)}
                                    className={`flex-shrink-0 h-10 w-10 rounded-full transition-all ${
                                      goal.is_completed ?
                                        'bg-emerald-500 hover:bg-emerald-600 text-white' :
                                        'border-2 border-border hover:border-indigo-500 hover:bg-indigo-50'}`
                                    }>
                                    {goal.is_completed && <CheckCircle2 className="w-6 h-6" />}
                                  </Button>
                                ) : (
                                  <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold ${
                                    goal.is_completed ? 'bg-emerald-500 text-white' : 'bg-indigo-100 text-indigo-700'
                                  }`}>
                                    {subGoalProgress}%
                                  </div>
                                )}

                                <div className="flex-1 min-w-0">
                                  <h4 className={`font-bold text-lg mb-1 ${goal.is_completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                    {goal.title}
                                  </h4>
                                  {goal.description &&
                                    <p className="text-sm text-muted-foreground mb-3">{goal.description}</p>
                                  }

                                  <div className="flex items-center gap-2 flex-wrap">
                                    {goal.target_date &&
                                      <Badge variant="outline" className="bg-surface/80">
                                        <Calendar className="w-3 h-3 mr-1" />
                                        {format(new Date(goal.target_date), 'MMM d, yyyy')}
                                      </Badge>
                                    }
                                    <Badge className={
                                      goal.priority === 'high' ? 'bg-red-100 text-red-700' :
                                        goal.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                                          'bg-blue-100 text-blue-700'
                                    }>
                                      {goal.priority}
                                    </Badge>
                                    {hasSubGoals && (
                                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                        {completedSubGoals}/{goal.sub_goals.length} sub-goals
                                      </Badge>
                                    )}
                                  </div>

                                  {/* Sub-goals list with nested structure */}
                                  {hasSubGoals && (
                                    <div className="mt-4 space-y-3">
                                      <div className="flex items-center justify-between mb-3">
                                        <Progress value={subGoalProgress} className="h-2 flex-1" />
                                        {goal.total_xp_reward > 0 && (
                                          <Badge variant="outline" className="ml-3 bg-amber-50 text-amber-700 border-amber-300">
                                            <Zap className="w-3 h-3 mr-1" />
                                            {goal.total_xp_reward} XP
                                          </Badge>
                                        )}
                                      </div>
                                      {goal.sub_goals.map((subGoal) => {
                                        const hasSubSubGoals = subGoal.sub_sub_goals && subGoal.sub_sub_goals.length > 0;

                                        return (
                                          <div key={subGoal.id} className="space-y-2">
                                            {/* Main sub-goal */}
                                            {hasSubSubGoals ? (
                                              <div className="p-3 rounded-lg border bg-gradient-to-r from-indigo-50 to-purple-50">
                                                <div className="flex items-center gap-2 mb-3">
                                                  {subGoal.completed ? (
                                                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                                  ) : (
                                                    <Circle className="w-5 h-5 text-indigo-400" />
                                                  )}
                                                  <span className={`font-semibold ${subGoal.completed ? 'line-through text-muted-foreground/60' : 'text-indigo-900'}`}>
                                                    {subGoal.title}
                                                  </span>
                                                </div>

                                                {/* Nested AI sub-sub-goals */}
                                                <div className="ml-7 space-y-2">
                                                  {subGoal.sub_sub_goals.map((subSubGoal) => {
                                                    const progressPercent = subSubGoal.target > 0 
                                                      ? Math.min(100, (subSubGoal.current_progress / subSubGoal.target) * 100)
                                                      : 0;

                                                    return (
                                                      <div
                                                        key={subSubGoal.id}
                                                        className="flex items-start gap-3 p-2 rounded-lg hover:bg-surface cursor-pointer border border-indigo-100 transition-all group bg-surface/50"
                                                        onClick={() => handleSubGoalClick(goal, subSubGoal)}
                                                      >
                                                        <div className="flex-shrink-0 mt-0.5">
                                                          {subSubGoal.completed ? (
                                                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                                          ) : (
                                                            <div className="w-4 h-4 rounded-full border-2 border-border group-hover:border-indigo-400" />
                                                          )}
                                                        </div>

                                                        <div className="flex-1 min-w-0 space-y-1.5">
                                                          <div className="flex items-start justify-between gap-2">
                                                            <span className={`text-xs font-medium ${subSubGoal.completed ? 'line-through text-muted-foreground/60' : 'text-muted-foreground'}`}>
                                                              {subSubGoal.title}
                                                            </span>
                                                            {subSubGoal.xp_reward > 0 && (
                                                              <Badge variant="secondary" className="text-xs flex-shrink-0 h-5">
                                                                +{subSubGoal.xp_reward} XP
                                                              </Badge>
                                                            )}
                                                          </div>

                                                          {/* Progress bar */}
                                                          {subSubGoal.type && subSubGoal.target > 0 && (
                                                            <div className="space-y-1">
                                                              <div className="flex items-center justify-between text-xs">
                                                                <span className="text-muted-foreground">
                                                                  {subSubGoal.current_progress?.toFixed(subSubGoal.type === 'study_hours' ? 1 : 0) || 0} / {subSubGoal.target}
                                                                  {subSubGoal.type === 'study_hours' ? ' hrs' : 
                                                                   subSubGoal.type === 'quiz_score' ? '%' :
                                                                   subSubGoal.type === 'quiz_count' ? ' quizzes' :
                                                                   subSubGoal.type === 'flashcard_reviews' ? ' reviews' :
                                                                   ' sessions'}
                                                                </span>
                                                                <span className="text-indigo-600 font-semibold text-xs">
                                                                  {Math.round(progressPercent)}%
                                                                </span>
                                                              </div>
                                                              <Progress value={progressPercent} className="h-1" />
                                                            </div>
                                                          )}
                                                        </div>

                                                        <div className="flex-shrink-0">
                                                          <div className="text-xs text-indigo-600 font-medium opacity-0 group-hover:opacity-100">→</div>
                                                        </div>
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              </div>
                                            ) : (
                                              /* Flat structure (no nesting) */
                                              <div 
                                                className="flex items-start gap-3 p-3 rounded-lg hover:bg-indigo-50 cursor-pointer border transition-all group"
                                                onClick={() => handleSubGoalClick(goal, subGoal)}
                                              >
                                                <div className="flex-shrink-0 mt-0.5">
                                                  {subGoal.completed ? (
                                                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                                  ) : (
                                                    <div className="w-5 h-5 rounded-full border-2 border-border group-hover:border-indigo-400" />
                                                  )}
                                                </div>

                                                <div className="flex-1 min-w-0 space-y-2">
                                                  <div className="flex items-start justify-between gap-2">
                                                    <span className={`text-sm font-medium ${subGoal.completed ? 'line-through text-muted-foreground/60' : 'text-muted-foreground group-hover:text-indigo-700'}`}>
                                                      {subGoal.title}
                                                    </span>
                                                    {subGoal.xp_reward > 0 && (
                                                      <Badge variant="secondary" className="text-xs flex-shrink-0">
                                                        +{subGoal.xp_reward} XP
                                                      </Badge>
                                                    )}
                                                  </div>

                                                  {subGoal.type && subGoal.target > 0 && (
                                                    <div className="space-y-1">
                                                      <div className="flex items-center justify-between text-xs">
                                                        <span className="text-muted-foreground">
                                                          {subGoal.current_progress?.toFixed(subGoal.type === 'study_hours' ? 1 : 0) || 0} / {subGoal.target}
                                                          {subGoal.type === 'study_hours' ? ' hours' : 
                                                           subGoal.type === 'quiz_score' ? '%' :
                                                           subGoal.type === 'quiz_count' ? ' quizzes' :
                                                           subGoal.type === 'flashcard_reviews' ? ' reviews' :
                                                           ' sessions'}
                                                        </span>
                                                        <span className="text-indigo-600 font-semibold">
                                                          {Math.round((subGoal.current_progress / subGoal.target) * 100)}%
                                                        </span>
                                                      </div>
                                                      <Progress value={(subGoal.current_progress / subGoal.target) * 100} className="h-1.5" />
                                                    </div>
                                                  )}
                                                </div>

                                                <div className="flex-shrink-0 mt-0.5">
                                                  <div className="text-xs text-indigo-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                                    Go →
                                                  </div>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>

                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Edit goal"
                                    onClick={() => setEditingGoal(goal)}
                                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/60 hover:text-indigo-600 hover:bg-indigo-50">
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Delete goal"
                                    onClick={() => handleDeleteGoal(goal.id)}
                                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/60 hover:text-red-600 hover:bg-red-50">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                        )})}
                        </AnimatePresence>
                        </div>
                      }
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>

              <TabsContent value="assessments" className="space-y-4">
                {/* Assessments Section (now inside TabContent) */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="space-y-6">

                  <Card className="border-0 shadow-xl">
                    <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-cyan-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg">
                            <FileText className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <CardTitle className="text-2xl">Assessments</CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                              {completedAssessments} of {assessments.length} completed
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={() => setIsAddingAssessment(true)}
                          size="lg"
                          className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-lg">

                          <Plus className="w-5 h-5 mr-2" />
                          New Task
                        </Button>
                      </div>
                    </CardHeader>

                    <CardContent className="p-6">
                      {assessments.length === 0 ?
                        <div className="text-center py-16">
                          <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <FileText className="w-10 h-10 text-blue-600" />
                          </div>
                          <h3 className="text-xl font-bold text-foreground mb-2">No Assessments</h3>
                          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                            Track your SACs, tests, and assignments here!
                          </p>
                          <Button
                            onClick={() => setIsAddingAssessment(true)}
                            className="bg-gradient-to-r from-blue-600 to-cyan-600">

                            <Sparkles className="w-4 h-4 mr-2" />
                            Add First Assessment
                          </Button>
                        </div> :

                        <div className="space-y-3">
                          <AnimatePresence>
                            {assessments.map((assessment, index) =>
                              <motion.div
                                key={assessment.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ delay: index * 0.05 }}
                                layout>

                                <Card className={`group hover:shadow-lg transition-all ${assessment.is_completed ? 'bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200' : 'bg-surface hover:border-blue-300'}`}>
                                  <CardContent className="p-5">
                                    <div className="flex items-start gap-4">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label="Toggle assessment completion"
                                        onClick={() => handleToggleAssessmentCompletion(assessment)}
                                        className={`flex-shrink-0 h-10 w-10 rounded-full transition-all ${
                                          assessment.is_completed ?
                                            'bg-blue-500 hover:bg-blue-600 text-white' :
                                            'border-2 border-border hover:border-blue-500 hover:bg-blue-50'}`
                                        }>

                                        {assessment.is_completed && <CheckCircle2 className="w-6 h-6" />}
                                      </Button>

                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                          <Badge className="bg-blue-100 text-blue-800 font-bold">
                                            {assessment.assessment_type}
                                          </Badge>
                                          {assessment.weight_percentage > 0 &&
                                            <Badge variant="outline" className="bg-surface/80">
                                              {assessment.weight_percentage}%
                                            </Badge>
                                          }
                                        </div>

                                        <h4 className={`font-bold text-lg mb-1 ${assessment.is_completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                          {assessment.title}
                                        </h4>
                                        {assessment.description &&
                                          <p className="text-sm text-muted-foreground mb-3">{assessment.description}</p>
                                        }

                                        <div className="flex items-center gap-4 text-sm">
                                          {assessment.due_date &&
                                            <div className="flex items-center gap-1 text-muted-foreground">
                                              <Calendar className="w-4 h-4" />
                                              <span>{format(new Date(assessment.due_date), 'MMM d')}</span>
                                            </div>
                                          }
                                          {assessment.target_score > 0 &&
                                            <div className="flex items-center gap-1 text-blue-600 font-semibold">
                                              <Target className="w-4 h-4" />
                                              <span>Target: {assessment.target_score}%</span>
                                            </div>
                                          }
                                          {assessment.actual_score > 0 &&
                                            <div className="flex items-center gap-1 text-emerald-600 font-bold">
                                              <Star className="w-4 h-4 fill-emerald-600" />
                                              <span>{assessment.actual_score}%</span>
                                            </div>
                                          }
                                        </div>
                                      </div>

                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label="Delete assessment"
                                        onClick={() => handleDeleteAssessment(assessment.id)}
                                        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/60 hover:text-red-600 hover:bg-red-50">

                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </CardContent>
                                </Card>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      }
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>

              <TabsContent value="stats" className="space-y-4">
                {/* Side Column - Recent Activity (now inside TabContent) */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="space-y-6">

                  {/* Recent Sessions */}
                  <Card className="border-0 shadow-xl">
                    <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-pink-50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                          <Zap className="w-5 h-5 text-white" />
                        </div>
                        <CardTitle className="text-lg">Recent Sessions</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4">
                      {studySessions.length === 0 ?
                        <div className="flex flex-col items-center text-center gap-3 py-8">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
                            <Brain className="w-6 h-6 text-purple-600" />
                          </div>
                          <div>
                            <p className="font-bold text-foreground">No sessions for {selectedSubject?.subject_name || 'this subject'}</p>
                            <p className="text-sm text-muted-foreground mt-1 max-w-[260px]">Knock out a quick study session — it'll appear here.</p>
                          </div>
                          <Link to={createPageUrl("Study")}>
                            <Button size="sm" className="gap-1.5 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700">
                              <Brain className="w-3.5 h-3.5" />
                              Start a session
                            </Button>
                          </Link>
                        </div> :

                        <div className="space-y-3">
                          {studySessions.slice(0, 5).map((session, index) =>
                            <motion.div
                              key={session.id}
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.1 }}
                              className="bg-gradient-to-r from-gray-50 to-white rounded-xl p-3 border border-border hover:shadow-md transition-all">

                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                  <Clock className="w-5 h-5 text-purple-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-sm text-foreground mb-1 capitalize">
                                    {session.technique_name?.replace('_', ' ')}
                                  </p>
                                  {session.topic &&
                                    <p className="text-xs text-muted-foreground mb-1 truncate">{session.topic}</p>
                                  }
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span className="font-medium">{session.session_duration}m</span>
                                    {session.date &&
                                      <>
                                        <span>•</span>
                                        <span>{format(new Date(session.date), 'MMM d')}</span>
                                      </>
                                    }
                                  </div>
                                </div>
                                {session.confidence_rating &&
                                  <div className="flex gap-0.5">
                                    {Array.from({ length: session.confidence_rating }).map((_, i) =>
                                      <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                                    )}
                                  </div>
                                }
                              </div>
                            </motion.div>
                          )}
                        </div>
                      }
                    </CardContent>
                  </Card>

                  {/* Quick Stats */}
                  <Card className="border-0 shadow-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3 mb-6">
                        <TrendingUp className="w-8 h-8" />
                        <h3 className="text-xl font-bold">Performance</h3>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm opacity-90 mb-1">Goal Completion</p>
                          <div className="flex items-end gap-2">
                            <span className="text-4xl font-black">{Math.round(goalCompletionRate)}%</span>
                          </div>
                          <Progress value={goalCompletionRate} className="h-2 mt-2 bg-surface/20" />
                        </div>
                        <div className="pt-4 border-t border-white/20">
                          <p className="text-sm opacity-90 mb-2">Study Streak</p>
                          <div className="flex items-center gap-2">
                            <Flame className="w-6 h-6 text-orange-300" />
                            <span className="text-3xl font-black">
                              {studySessions.length > 0 ? Math.min(studySessions.length, 7) : 0}
                            </span>
                            <span className="opacity-80">days</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Add Goal Dialog */}
          <Dialog open={isAddingGoal} onOpenChange={setIsAddingGoal}>
            <DialogContent className="max-w-full sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
              <DialogHeader className="flex-shrink-0 p-4 lg:p-6 pb-2">
                <DialogTitle className="text-xl lg:text-2xl flex items-center gap-2">
                  <Target className="w-6 h-6 text-indigo-600" />
                  Add New Goal
                </DialogTitle>
              </DialogHeader>
              <ScrollArea className="flex-1 px-4 lg:px-6 overflow-y-auto">
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Goal Title *</Label>
                    <Input
                      placeholder="e.g., Complete Unit 3 SAC, Master Organic Chemistry"
                      value={newGoal.title}
                      onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                      className="h-11" />
                  </div>

                  {/* Manual Sub-goals Section */}
                  <div className="space-y-3 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold">Your Sub-Goals <span className="text-xs text-muted-foreground/60">(optional - AI will break these down)</span></Label>
                      {newGoal.sub_goals.length > 0 && (
                        <Badge variant="outline" className="bg-purple-50 text-purple-700">
                          {newGoal.sub_goals.length}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <Input
                        value={newSubGoal}
                        onChange={(e) => setNewSubGoal(e.target.value)}
                        placeholder="e.g., Master Organic Chemistry..."
                        className="h-9"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && newSubGoal.trim()) {
                            setNewGoal({
                              ...newGoal,
                              sub_goals: [...newGoal.sub_goals, { title: newSubGoal.trim(), completed: false }]
                            });
                            setNewSubGoal('');
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (newSubGoal.trim()) {
                            setNewGoal({
                              ...newGoal,
                              sub_goals: [...newGoal.sub_goals, { title: newSubGoal.trim(), completed: false }]
                            });
                            setNewSubGoal('');
                          }
                        }}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    {newGoal.sub_goals.length > 0 && (
                      <div className="space-y-1.5 p-2 bg-secondary/50 rounded-lg max-h-32 overflow-y-auto">
                        {newGoal.sub_goals.map((sg, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-1.5 bg-surface rounded border text-sm">
                            <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                              {idx + 1}
                            </span>
                            <span className="flex-1 truncate">{sg.title}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Remove sub-goal"
                              className="h-5 w-5 text-muted-foreground/60 hover:text-red-500 flex-shrink-0"
                              onClick={() => {
                                setNewGoal({
                                  ...newGoal,
                                  sub_goals: newGoal.sub_goals.filter((_, i) => i !== idx)
                                });
                              }}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-muted-foreground">Success Criteria <span className="text-xs text-muted-foreground/60">(optional)</span></Label>
                      <Input
                        placeholder="e.g., Score 80%+ on practice test"
                        value={newGoal.success_criteria || ''}
                        onChange={(e) => setNewGoal({ ...newGoal, success_criteria: e.target.value })}
                        className="h-10" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-muted-foreground">Motivation <span className="text-xs text-muted-foreground/60">(optional)</span></Label>
                      <Input
                        placeholder="Why is this important?"
                        value={newGoal.motivation || ''}
                        onChange={(e) => setNewGoal({ ...newGoal, motivation: e.target.value })}
                        className="h-10" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Target Date *</Label>
                      <Input
                        type="date"
                        value={newGoal.target_date}
                        onChange={(e) => setNewGoal({ ...newGoal, target_date: e.target.value })}
                        className="h-10" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Priority</Label>
                      <Select
                        value={newGoal.priority}
                        onValueChange={(value) => setNewGoal({ ...newGoal, priority: value })}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">🔴 High</SelectItem>
                          <SelectItem value="medium">🟡 Medium</SelectItem>
                          <SelectItem value="low">🔵 Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Type</Label>
                      <Select
                        value={newGoal.milestone_type}
                        onValueChange={(value) => setNewGoal({ ...newGoal, milestone_type: value })}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="content">📚 Content</SelectItem>
                          <SelectItem value="assessment">📝 Assessment</SelectItem>
                          <SelectItem value="exam_prep">🎯 Exam Prep</SelectItem>
                          <SelectItem value="skills">💡 Skills</SelectItem>
                          <SelectItem value="research">🔍 Research</SelectItem>
                          <SelectItem value="testing">✅ Practice</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>


                </div>
              </ScrollArea>

              <DialogFooter className="flex-shrink-0 border-t p-4 gap-2">
                <Button variant="outline" onClick={() => setIsAddingGoal(false)} disabled={isGeneratingAI}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleAddGoal} 
                  className="bg-gradient-to-r from-purple-600 to-pink-600"
                  disabled={isGeneratingAI}
                >
                  {isGeneratingAI ? (
                    <>
                      <Sparkles className="w-4 h-4 mr-2 animate-pulse" />
                      Generating with AI...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Goal with AI
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Goal Dialog */}
          <Dialog open={!!editingGoal} onOpenChange={() => setEditingGoal(null)}>
            <DialogContent className="max-w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col p-0">
              <DialogHeader className="flex-shrink-0 p-4 lg:p-6 pb-0">
                <DialogTitle className="text-xl lg:text-2xl flex items-center gap-2">
                  <Edit className="w-6 h-6 text-indigo-600" />
                  Edit Goal
                </DialogTitle>
              </DialogHeader>
              {editingGoal && (
                <ScrollArea className="flex-1 px-4 lg:px-6">
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Goal Title *</Label>
                      <Input
                        value={editingGoal.title}
                        onChange={(e) => setEditingGoal({ ...editingGoal, title: e.target.value })}
                        className="h-11 lg:h-12"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Description</Label>
                      <Textarea
                        value={editingGoal.description || ''}
                        onChange={(e) => setEditingGoal({ ...editingGoal, description: e.target.value })}
                        rows={3}
                        className="resize-none"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">Target Date</Label>
                        <Input
                          type="date"
                          value={editingGoal.target_date || ''}
                          onChange={(e) => setEditingGoal({ ...editingGoal, target_date: e.target.value })}
                          className="h-11 lg:h-12"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">Priority</Label>
                        <Select
                          value={editingGoal.priority}
                          onValueChange={(value) => setEditingGoal({ ...editingGoal, priority: value })}
                        >
                          <SelectTrigger className="h-11 lg:h-12">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="high">🔴 High</SelectItem>
                            <SelectItem value="medium">🟡 Medium</SelectItem>
                            <SelectItem value="low">🔵 Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    {/* Edit Sub-goals - No deletion for AI-generated goals */}
                    {editingGoal.sub_goals && editingGoal.sub_goals.length > 0 && (
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold">
                          Sub-Goals {editingGoal.is_ai_generated && <span className="text-xs text-muted-foreground/60">(AI Generated - Drag to reorder)</span>}
                        </Label>
                        <div className="space-y-2">
                          {editingGoal.sub_goals.map((sg, idx) => (
                            <div key={sg.id} className="flex items-center gap-2 p-2 bg-secondary/50 rounded-lg">
                              <GripVertical className="w-4 h-4 text-muted-foreground/60 cursor-move" />
                              {sg.completed ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <Circle className="w-4 h-4 text-muted-foreground/60" />
                              )}
                              <span className={`flex-1 text-sm ${sg.completed ? 'line-through text-muted-foreground/60' : ''}`}>
                                {sg.title}
                              </span>
                              {sg.xp_reward > 0 && (
                                <Badge variant="secondary" className="text-xs">+{sg.xp_reward} XP</Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
              <DialogFooter className="flex-shrink-0 border-t p-4 lg:p-6 pt-4 gap-2">
                <Button variant="outline" onClick={() => setEditingGoal(null)}>Cancel</Button>
                <Button onClick={handleUpdateGoal} className="bg-gradient-to-r from-indigo-600 to-purple-600">
                  Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Study Score Dialog */}
          <Dialog open={showStudyScoreDialog} onOpenChange={setShowStudyScoreDialog}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Trophy className="w-6 h-6 text-amber-500" />
                  Set Target Study Score
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Target Study Score (0-50)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="50"
                    value={targetStudyScore}
                    onChange={(e) => setTargetStudyScore(e.target.value)}
                    placeholder="e.g., 40"
                    className="h-12 text-2xl font-bold text-center"
                  />
                </div>
                
                {targetStudyScore && parseInt(targetStudyScore) > 0 && (
                  <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-200">
                    <h4 className="font-bold text-indigo-900 mb-2">Normal Distribution Analysis</h4>
                    <p className="text-sm text-indigo-800">
                      A study score of <span className="font-bold">{targetStudyScore}</span> means you need to be in the <span className="font-bold text-indigo-600">{getPercentileForScore(parseInt(targetStudyScore)).toFixed(1)}th percentile</span>.
                    </p>
                    <p className="text-xs text-indigo-600 mt-2">
                      That's the top <span className="font-bold">{(100 - getPercentileForScore(parseInt(targetStudyScore))).toFixed(1)}%</span> of students (Mean: 30, SD: 7).
                    </p>
                    
                    {/* Visual bell curve - smooth Gaussian */}
                    <div className="mt-4 relative h-24">
                      <svg viewBox="0 0 200 70" className="w-full h-full" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="bellGradient2" x1="0%" y1="100%" x2="0%" y2="0%">
                            <stop offset="0%" stopColor="#c7d2fe" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.6" />
                          </linearGradient>
                        </defs>
                        {/* Smooth bell curve using actual Gaussian formula */}
                        <path
                          d={(() => {
                            const points = [];
                            const mean = 100; // center of SVG
                            const stdDev = 35; // spread
                            for (let x = 0; x <= 200; x += 2) {
                              const z = (x - mean) / stdDev;
                              const y = 65 - (55 * Math.exp(-0.5 * z * z));
                              points.push(`${x === 0 ? 'M' : 'L'} ${x} ${y}`);
                            }
                            return points.join(' ') + ' L 200 65 L 0 65 Z';
                          })()}
                          fill="url(#bellGradient2)"
                          stroke="#6366f1"
                          strokeWidth="2"
                        />
                        {/* Score marker line */}
                        {(() => {
                          const percentile = getPercentileForScore(parseInt(targetStudyScore));
                          const xPos = Math.min(195, Math.max(5, percentile * 2));
                          const z = (xPos - 100) / 35;
                          const yPos = 65 - (55 * Math.exp(-0.5 * z * z));
                          return (
                            <>
                              <line 
                                x1={xPos} 
                                y1={yPos} 
                                x2={xPos} 
                                y2="65" 
                                stroke="#4f46e5" 
                                strokeWidth="2"
                                strokeDasharray="4 2"
                              />
                              <circle 
                                cx={xPos} 
                                cy={yPos} 
                                r="5" 
                                fill="#4f46e5"
                                stroke="white"
                                strokeWidth="2"
                              />
                            </>
                          );
                        })()}
                        {/* X-axis */}
                        <line x1="0" y1="65" x2="200" y2="65" stroke="#cbd5e1" strokeWidth="1" />
                      </svg>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>9 (0%)</span>
                      <span>30 (50%)</span>
                      <span>50+ (100%)</span>
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowStudyScoreDialog(false)}>Cancel</Button>
                <Button onClick={handleSaveStudyScore} className="bg-gradient-to-r from-amber-500 to-orange-500">
                  Save Target
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Add Assessment Dialog */}
          <Dialog open={isAddingAssessment} onOpenChange={setIsAddingAssessment}>
            <DialogContent className="max-w-full sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
              <DialogHeader className="flex-shrink-0 p-4 lg:p-6 pb-2">
                <DialogTitle className="text-xl lg:text-2xl flex items-center gap-2">
                  <FileText className="w-6 h-6 text-blue-600" />
                  Add Assessment
                </DialogTitle>
              </DialogHeader>
              <ScrollArea className="flex-1 px-4 lg:px-6 overflow-y-auto">
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Assessment Title *</Label>
                    <Input
                      placeholder="e.g., Unit 3 SAC 1 - Cell Biology"
                      value={newAssessment.title}
                      onChange={(e) => setNewAssessment({ ...newAssessment, title: e.target.value })}
                      className="h-10" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Type *</Label>
                      <Select
                        value={newAssessment.assessment_type}
                        onValueChange={(value) => setNewAssessment({ ...newAssessment, assessment_type: value })}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SAC">📝 SAC</SelectItem>
                          <SelectItem value="SAT">🔬 SAT</SelectItem>
                          <SelectItem value="Test">📋 Test</SelectItem>
                          <SelectItem value="Assignment">📄 Assignment</SelectItem>
                          <SelectItem value="Exam">🎯 Exam</SelectItem>
                          <SelectItem value="Quiz">❓ Quiz</SelectItem>
                          <SelectItem value="Project">🎨 Project</SelectItem>
                          <SelectItem value="Presentation">🎤 Presentation</SelectItem>
                          <SelectItem value="Practical">🧪 Practical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Due Date *</Label>
                      <Input
                        type="date"
                        value={newAssessment.due_date}
                        onChange={(e) => setNewAssessment({ ...newAssessment, due_date: e.target.value })}
                        className="h-10" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Description <span className="text-xs text-muted-foreground/60">(optional)</span></Label>
                    <Textarea
                      placeholder="Topics covered, chapters, skills..."
                      value={newAssessment.description}
                      onChange={(e) => setNewAssessment({ ...newAssessment, description: e.target.value })}
                      rows={2}
                      className="resize-none" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Weight (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={newAssessment.weight_percentage}
                        onChange={(e) => setNewAssessment({ ...newAssessment, weight_percentage: parseFloat(e.target.value) || 0 })}
                        placeholder="e.g., 25"
                        className="h-10" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Target Score (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={newAssessment.target_score}
                        onChange={(e) => setNewAssessment({ ...newAssessment, target_score: parseFloat(e.target.value) || 0 })}
                        placeholder="e.g., 85"
                        className="h-10" />
                    </div>
                  </div>
                </div>
              </ScrollArea>
              <DialogFooter className="flex-shrink-0 border-t p-4 gap-2">
                <Button variant="outline" onClick={() => setIsAddingAssessment(false)}>Cancel</Button>
                <Button onClick={handleAddAssessment} className="bg-gradient-to-r from-blue-600 to-indigo-600">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Assessment
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </motion.div>
      ) : (
        <SubjectFolderGridView
          userSubjects={userSubjects}
          onSelectSubject={setSelectedSubject}
          onBack={onBack}
        />
      )}
    </div>
  );
}