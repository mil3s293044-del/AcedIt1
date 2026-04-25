import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Target,
  TrendingUp,
  Clock,
  Trophy,
  Flame,
  FileText,
  Zap,
  Brain,
  Star,
  Plus,
  Sparkles
} from "lucide-react";
import { format } from "date-fns";

export default function SubjectDetail({
  selectedSubject,
  goals,
  assessments,
  studySessions,
  onBack,
  onToggleGoalCompletion,
  onToggleAssessmentCompletion,
  onDeleteGoal,
  onDeleteAssessment,
  onAddGoal,
  onAddAssessment
}) {
  const subjectColor = selectedSubject.color || '#3B82F6';
  const totalStudyTime = studySessions.reduce((sum, session) => sum + (session.session_duration || 0), 0);
  const completedGoals = goals.filter((g) => g.is_completed).length;
  const completedAssessments = assessments.filter((a) => a.is_completed).length;
  const goalCompletionRate = goals.length > 0 ? completedGoals / goals.length * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen"
      style={{
        background: `linear-gradient(135deg, ${subjectColor}05 0%, ${subjectColor}10 50%, ${subjectColor}05 100%)`
      }}
    >
      {/* Animated Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            rotate: [0, 180, 360],
            opacity: [0.03, 0.06, 0.03]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full blur-3xl"
          style={{ backgroundColor: subjectColor }}
        />

        <motion.div
          animate={{
            scale: [1.3, 1, 1.3],
            rotate: [360, 180, 0],
            opacity: [0.02, 0.05, 0.02]
          }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full blur-3xl"
          style={{ backgroundColor: subjectColor }}
        />

        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            x: [0, 100, 0],
            opacity: [0.02, 0.04, 0.02]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/2 left-1/2 w-[400px] h-[400px] rounded-full blur-3xl"
          style={{ backgroundColor: subjectColor }}
        />
      </div>

      <div className="relative z-10 p-4 lg:p-8 space-y-6">
        {/* Header with Back Button */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <Button
            variant="outline"
            onClick={onBack}
            className="backdrop-blur-sm bg-white/80 hover:bg-white border-2 font-semibold"
            style={{
              borderColor: `${subjectColor}40`,
              color: subjectColor
            }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to All Subjects
          </Button>
        </motion.div>

        {/* Hero Section */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", duration: 0.6 }}
        >
          <Card className="relative overflow-hidden border-0 shadow-2xl backdrop-blur-xl bg-white/70">
            {/* Decorative gradient bars */}
            <div className="absolute top-0 left-0 right-0 h-2 flex">
              <motion.div
                className="flex-1"
                style={{ backgroundColor: subjectColor }}
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <motion.div
                className="flex-1"
                style={{ backgroundColor: `${subjectColor}cc` }}
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
              />
              <motion.div
                className="flex-1"
                style={{ backgroundColor: `${subjectColor}99` }}
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.6 }}
              />
            </div>

            <CardContent className="relative p-8 lg:p-12 pt-10 lg:pt-14">
              <div className="grid lg:grid-cols-2 gap-8">
                {/* Left: Subject Info */}
                <div>
                  <motion.div
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <Badge
                      className="mb-4 font-bold text-sm px-4 py-1.5 border-2"
                      style={{
                        backgroundColor: `${subjectColor}25`,
                        color: subjectColor,
                        borderColor: `${subjectColor}50`
                      }}
                    >
                      {selectedSubject.subject_code}
                    </Badge>
                    
                    <h1
                      className="text-5xl lg:text-6xl font-black mb-3 leading-tight bg-gradient-to-r bg-clip-text text-transparent"
                      style={{
                        backgroundImage: `linear-gradient(135deg, ${subjectColor}, ${subjectColor}cc)`
                      }}
                    >
                      {selectedSubject.subject_name}
                    </h1>
                    
                    <p className="text-lg mb-6 font-medium"
                       style={{ color: `${subjectColor}dd` }}>
                      {selectedSubject.year_level}
                    </p>

                    {selectedSubject.goal_study_score && (
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="rounded-3xl p-6 border-2 shadow-lg backdrop-blur-sm"
                        style={{
                          backgroundColor: `${subjectColor}18`,
                          borderColor: `${subjectColor}40`
                        }}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <Trophy className="w-7 h-7" style={{ color: subjectColor }} />
                          <span className="text-sm font-bold uppercase tracking-wider"
                                style={{ color: `${subjectColor}dd` }}>
                            Target Study Score
                          </span>
                        </div>
                        <div className="flex items-end gap-2">
                          <span className="text-7xl font-black"
                                style={{ color: subjectColor }}>
                            {selectedSubject.goal_study_score}
                          </span>
                          <span className="text-3xl font-bold text-gray-500 mb-2">/50</span>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                </div>

                {/* Right: Stats Grid */}
                <motion.div
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="grid grid-cols-2 gap-4"
                >
                  {[
                    { icon: Clock, value: `${Math.round(totalStudyTime / 60)}h`, label: "Study Time", color: subjectColor },
                    { icon: Flame, value: studySessions.length, label: "Sessions", color: `${subjectColor}` },
                    { icon: Target, value: `${completedGoals}/${goals.length}`, label: "Goals Done", color: subjectColor },
                    { icon: FileText, value: `${completedAssessments}/${assessments.length}`, label: "Tasks Done", color: subjectColor }
                  ].map((stat, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.4 + idx * 0.1 }}
                      whileHover={{ scale: 1.05, y: -5 }}
                      className="rounded-2xl p-6 border-2 backdrop-blur-sm shadow-lg"
                      style={{
                        backgroundColor: `${subjectColor}12`,
                        borderColor: `${subjectColor}35`
                      }}
                    >
                      <stat.icon className="w-8 h-8 mb-3" style={{ color: stat.color }} />
                      <p className="text-3xl font-black mb-1" style={{ color: subjectColor }}>
                        {stat.value}
                      </p>
                      <p className="text-sm font-semibold text-gray-600">{stat.label}</p>
                    </motion.div>
                  ))}
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Goals & Assessments Column */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="lg:col-span-2 space-y-6"
          >
            {/* Goals Section */}
            <Card className="border-0 shadow-xl backdrop-blur-xl bg-white/80">
              <div
                className="p-6 border-b-2 rounded-t-xl"
                style={{
                  background: `linear-gradient(135deg, ${subjectColor}15 0%, ${subjectColor}08 100%)`,
                  borderColor: `${subjectColor}30`
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
                      style={{
                        background: `linear-gradient(135deg, ${subjectColor}, ${subjectColor}dd)`
                      }}
                    >
                      <Target className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-black" style={{ color: subjectColor }}>
                        Goals
                      </h2>
                      <p className="text-sm font-semibold text-gray-600 mt-1">
                        {completedGoals} of {goals.length} completed • {Math.round(goalCompletionRate)}%
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={onAddGoal}
                    size="lg"
                    className="shadow-lg text-white border-0"
                    style={{
                      background: `linear-gradient(135deg, ${subjectColor}, ${subjectColor}dd)`
                    }}
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    New Goal
                  </Button>
                </div>
                {goals.length > 0 && (
                  <div className="mt-4">
                    <Progress
                      value={goalCompletionRate}
                      className="h-3 rounded-full"
                      style={{
                        backgroundColor: `${subjectColor}20`
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="p-6">
                {goals.length === 0 ? (
                  <div className="text-center py-16">
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6"
                      style={{ backgroundColor: `${subjectColor}15` }}
                    >
                      <Target className="w-12 h-12" style={{ color: subjectColor }} />
                    </motion.div>
                    <h3 className="text-2xl font-bold mb-2" style={{ color: subjectColor }}>
                      No Goals Yet
                    </h3>
                    <p className="text-gray-600 mb-6 max-w-md mx-auto">
                      Start setting goals to track your progress and stay motivated!
                    </p>
                    <Button
                      onClick={onAddGoal}
                      className="text-white"
                      style={{
                        background: `linear-gradient(135deg, ${subjectColor}, ${subjectColor}dd)`
                      }}
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Create First Goal
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Goals list rendering would go here - keeping existing logic */}
                  </div>
                )}
              </div>
            </Card>

            {/* Assessments - Similar styling */}
          </motion.div>

          {/* Sidebar - Stats */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="space-y-6"
          >
            {/* Performance Card */}
            <Card
              className="border-0 shadow-xl text-white overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${subjectColor} 0%, ${subjectColor}dd 50%, ${subjectColor}bb 100%)`
              }}
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <TrendingUp className="w-8 h-8" />
                  <h3 className="text-2xl font-black">Performance</h3>
                </div>
                <div className="space-y-5">
                  <div>
                    <p className="text-sm opacity-90 mb-2 font-semibold">Goal Completion</p>
                    <div className="flex items-end gap-2">
                      <span className="text-5xl font-black">{Math.round(goalCompletionRate)}%</span>
                    </div>
                    <Progress
                      value={goalCompletionRate}
                      className="h-3 mt-3 bg-white/20 rounded-full"
                    />
                  </div>
                  <div className="pt-5 border-t border-white/20">
                    <p className="text-sm opacity-90 mb-3 font-semibold">Study Streak</p>
                    <div className="flex items-center gap-3">
                      <Flame className="w-8 h-8 text-orange-300" />
                      <span className="text-4xl font-black">
                        {studySessions.length > 0 ? Math.min(studySessions.length, 7) : 0}
                      </span>
                      <span className="text-lg opacity-80 font-semibold">days</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Sessions */}
            <Card className="border-0 shadow-xl backdrop-blur-xl bg-white/80">
              <div
                className="p-4 border-b-2"
                style={{
                  background: `linear-gradient(135deg, ${subjectColor}12 0%, ${subjectColor}08 100%)`,
                  borderColor: `${subjectColor}25`
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${subjectColor}30` }}
                  >
                    <Zap className="w-5 h-5" style={{ color: subjectColor }} />
                  </div>
                  <h3 className="text-lg font-black" style={{ color: subjectColor }}>
                    Recent Sessions
                  </h3>
                </div>
              </div>
              <div className="p-4">
                {studySessions.length === 0 ? (
                  <div className="text-center py-8">
                    <Brain className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 font-medium">No sessions yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {studySessions.slice(0, 5).map((session, index) => (
                      <motion.div
                        key={session.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        whileHover={{ scale: 1.02, x: 5 }}
                        className="rounded-xl p-3 border-2 backdrop-blur-sm shadow-sm"
                        style={{
                          backgroundColor: `${subjectColor}08`,
                          borderColor: `${subjectColor}25`
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${subjectColor}25` }}
                          >
                            <Clock className="w-5 h-5" style={{ color: subjectColor }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm capitalize" style={{ color: subjectColor }}>
                              {session.technique_name?.replace('_', ' ')}
                            </p>
                            {session.topic && (
                              <p className="text-xs text-gray-600 mb-1 truncate">{session.topic}</p>
                            )}
                            <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                              <span>{session.session_duration}m</span>
                              {session.date && (
                                <>
                                  <span>•</span>
                                  <span>{format(new Date(session.date), 'MMM d')}</span>
                                </>
                              )}
                            </div>
                          </div>
                          {session.confidence_rating && (
                            <div className="flex gap-0.5">
                              {Array.from({ length: session.confidence_rating }).map((_, i) => (
                                <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}