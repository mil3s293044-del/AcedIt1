import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';
import { FEATURES, checkLiveTier } from '@/lib/tierAccess';
import { recordStudyAndGetStreak } from "@/components/shared/streakHelpers";
import { Wand2, Clock, Play, Save, RotateCcw, CheckCircle, Lightbulb, AlertCircle, Calendar, Trash2, FolderOpen, Eye, Loader2 } from 'lucide-react';

export default function BlurtingMethod({ onSessionComplete }) {
    const [phase, setPhase] = useState('setup');
    const [subject, setSubject] = useState('');
    const [topic, setTopic] = useState('');
    const [duration, setDuration] = useState(15);
    const [timeLeft, setTimeLeft] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [blurtedText, setBlurtedText] = useState('');
    const [aiFeedback, setAiFeedback] = useState(null);
    const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
    const [userSubjects, setUserSubjects] = useState([]);
    const [user, setUser] = useState(null);
    const [savedSessions, setSavedSessions] = useState([]);
    const [viewingSession, setViewingSession] = useState(null);
    const { toast } = useToast();

    useEffect(() => {
        const loadData = async () => {
            try {
                const currentUser = await base44.auth.me();
                setUser(currentUser);
                
                const [subjects, sessions] = await Promise.all([
                    base44.entities.UserSubject.filter({ created_by: currentUser.email, is_active: true }).catch(() => []),
                    base44.entities.BlurtingSession.filter({ created_by: currentUser.email }, '-date').catch(() => [])
                ]);
                
                const uniqueSubjects = subjects.reduce((acc, current) => {
                    const exists = acc.find(item => item.subject_name === current.subject_name);
                    if (!exists) acc.push(current);
                    return acc;
                }, []);
                
                setUserSubjects(uniqueSubjects || []);
                setSavedSessions(sessions || []);
            } catch (error) {
                console.error("Error loading data:", error);
                setUserSubjects([]);
                setSavedSessions([]);
            }
        };
        loadData();
    }, []);

    useEffect(() => {
        let interval = null;
        if (isRunning && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft(time => time - 1);
            }, 1000);
        } else if (timeLeft === 0 && isRunning) {
            setIsRunning(false);
        }
        return () => clearInterval(interval);
    }, [isRunning, timeLeft]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleStart = () => {
        if (!subject || !topic) {
            toast({ title: 'Missing information', description: 'Please select a subject and enter a topic.', variant: 'destructive' });
            return;
        }
        setTimeLeft(duration * 60);
        setIsRunning(true);
        setPhase('blurting');
    };

    const handleFinishBlurting = () => {
        setIsRunning(false);
        setPhase('review');
    };

    const handleGetFeedback = async () => {
        if (!blurtedText.trim()) {
            toast({ title: 'No content', description: 'Please write something before getting feedback.', variant: 'destructive' });
            return;
        }

        const access = await checkLiveTier(FEATURES.BLURTING);
        if (!access.allowed) {
            toast({
                title: access.upgradeRequired ? "Premium feature" : "Daily limit reached",
                description: access.reason,
                variant: "destructive",
            });
            return;
        }

        setIsGeneratingFeedback(true);
        try {
            const response = await base44.integrations.Core.InvokeLLM({
                feature: "blurting",
                prompt: `Review this blurting session for ${subject} - ${topic}:

Student's blurted content:
${blurtedText}

Please provide comprehensive feedback including:
1. Overall assessment of their understanding
2. Key concepts they covered well
3. Important points they may have missed
4. Suggestions for improvement
5. A completeness score (0-100%)

Format your response as JSON.`,
                response_json_schema: {
                    type: 'object',
                    properties: {
                        overall_assessment: { type: 'string' },
                        strengths: { type: 'array', items: { type: 'string' } },
                        gaps: { type: 'array', items: { type: 'string' } },
                        suggestions: { type: 'array', items: { type: 'string' } },
                        completeness_score: { type: 'number' }
                    }
                }
            });

            setAiFeedback(response);
            recordStudyAndGetStreak().catch(() => {});
            toast({ title: 'Feedback generated!', description: 'Review your AI-powered feedback below.' });
        } catch (error) {
            console.error("Error generating feedback:", error);
            toast({ title: 'Feedback failed', description: 'Could not generate feedback. Please try again.', variant: 'destructive' });
        } finally {
            setIsGeneratingFeedback(false);
        }
    };

    const handleSave = async () => {
        if (!user) return;

        try {
            await base44.entities.BlurtingSession.create({
                subject_name: subject,
                topic: topic,
                blurted_text: blurtedText,
                ai_feedback: JSON.stringify(aiFeedback),
                session_duration: duration,
                date: new Date().toISOString().split('T')[0]
            });

            toast({ title: 'Session saved!', description: 'Your blurting session has been saved.' });
            
            const sessions = await base44.entities.BlurtingSession.filter({ created_by: user.email }, '-date');
            setSavedSessions(sessions || []);
            
            if (onSessionComplete) {
                onSessionComplete({
                    technique: 'blurting',
                    subject,
                    topic,
                    duration,
                    xp_earned: Math.floor(duration * 10)
                });
            }
        } catch (error) {
            console.error("Error saving session:", error);
            toast({ title: 'Save failed', variant: 'destructive' });
        }
    };

    const handleReset = () => {
        setPhase('setup');
        setSubject('');
        setTopic('');
        setDuration(15);
        setTimeLeft(0);
        setIsRunning(false);
        setBlurtedText('');
        setAiFeedback(null);
    };

    const handleDeleteSession = async (sessionId) => {
        try {
            await base44.entities.BlurtingSession.delete(sessionId);
            toast({ title: 'Deleted', description: 'Session removed from history.' });
            const sessions = await base44.entities.BlurtingSession.filter({ created_by: user.email }, '-date');
            setSavedSessions(sessions || []);
        } catch (error) {
            console.error("Error deleting session:", error);
            toast({ title: 'Delete failed', variant: 'destructive' });
        }
    };

    const handleViewSession = (session) => {
        setViewingSession(session);
    };

    if (userSubjects.length === 0) {
        return (
            <Card className="max-w-2xl mx-auto shadow-xl">
                <CardContent className="p-8 text-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Wand2 className="w-10 h-10 text-purple-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">No Subjects Selected</h2>
                    <p className="text-gray-600 mb-6 leading-relaxed">
                        To use the Blurting Method, you need to select your subjects first. Head to the Subjects page and add your subjects to "My Subjects".
                    </p>
                    <Button 
                        onClick={() => window.location.href = '/Subjects'}
                        className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white shadow-lg"
                    >
                        Go to Subjects
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Main Session Card */}
            <Card className="shadow-xl border-2 border-purple-100">
                <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50 border-b-2 border-purple-100">
                    <CardTitle className="text-2xl flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                            <Wand2 className="w-6 h-6 text-white" />
                        </div>
                        Blurting Method
                    </CardTitle>
                    <p className="text-gray-600 mt-2">Write everything you know about a topic from memory, then review and identify gaps.</p>
                </CardHeader>
                <CardContent className="p-6">
                    {phase === 'setup' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700">Subject</label>
                                    <Select value={subject} onValueChange={setSubject}>
                                        <SelectTrigger className="border-2">
                                            <SelectValue placeholder="Select subject" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {userSubjects.map(sub => (
                                                <SelectItem key={sub.id} value={sub.subject_name}>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: sub.color || '#8B5CF6' }} />
                                                        {sub.subject_name}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700">Duration (minutes)</label>
                                    <Select value={duration.toString()} onValueChange={(val) => setDuration(parseInt(val))}>
                                        <SelectTrigger className="border-2">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="10">10 minutes</SelectItem>
                                            <SelectItem value="15">15 minutes</SelectItem>
                                            <SelectItem value="20">20 minutes</SelectItem>
                                            <SelectItem value="30">30 minutes</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Topic</label>
                                <Input
                                    placeholder="e.g., The French Revolution"
                                    value={topic}
                                    onChange={(e) => setTopic(e.target.value)}
                                    className="border-2"
                                />
                            </div>

                            <Button onClick={handleStart} className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 shadow-lg h-12 text-base">
                                <Play className="w-5 h-5 mr-2" />
                                Start Blurting Session
                            </Button>
                        </div>
                    )}

                    {phase === 'blurting' && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-6"
                        >
                            <div className="text-center">
                                <div className="inline-flex items-center gap-3 bg-gradient-to-r from-purple-50 to-indigo-50 px-6 py-3 rounded-2xl border-2 border-purple-200 mb-4">
                                    <Clock className="w-5 h-5 text-purple-600" />
                                    <span className="text-3xl font-bold text-gray-900">{formatTime(timeLeft)}</span>
                                </div>
                                <h3 className="text-xl font-semibold text-gray-900 mb-2">{subject} - {topic}</h3>
                                <p className="text-gray-600">Write everything you remember about this topic</p>
                            </div>

                            <Textarea
                                value={blurtedText}
                                onChange={(e) => setBlurtedText(e.target.value)}
                                placeholder="Start writing everything you know about the topic..."
                                className="min-h-96 border-2 text-base"
                            />

                            <Button onClick={handleFinishBlurting} className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 shadow-lg h-12">
                                <CheckCircle className="w-5 h-5 mr-2" />
                                Finish & Get Feedback
                            </Button>
                        </motion.div>
                    )}

                    {phase === 'review' && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-6"
                        >
                            <div className="text-center">
                                <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <CheckCircle className="w-8 h-8 text-green-600" />
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-2">Session Complete!</h3>
                                <p className="text-gray-600">Review what you wrote and get AI feedback</p>
                            </div>

                            <Card className="bg-gradient-to-br from-gray-50 to-white border-2">
                                <CardHeader>
                                    <CardTitle className="text-lg">Your Blurted Content</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="prose prose-sm max-w-none">
                                        <p className="whitespace-pre-wrap text-gray-700">{blurtedText}</p>
                                    </div>
                                </CardContent>
                            </Card>

                            {!aiFeedback && (
                                <Button 
                                    onClick={handleGetFeedback} 
                                    disabled={isGeneratingFeedback}
                                    className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg h-12"
                                >
                                    {isGeneratingFeedback ? (
                                        <>
                                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                            Generating Feedback...
                                        </>
                                    ) : (
                                        <>
                                            <Wand2 className="w-5 h-5 mr-2" />
                                            Get AI Feedback
                                        </>
                                    )}
                                </Button>
                            )}

                            {aiFeedback && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="space-y-4"
                                >
                                    {aiFeedback.completeness_score !== undefined && (
                                        <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200">
                                            <CardContent className="p-6">
                                                <div className="text-center">
                                                    <div className="text-5xl font-bold text-purple-600 mb-2">
                                                        {aiFeedback.completeness_score}%
                                                    </div>
                                                    <p className="text-gray-700 font-medium">Completeness Score</p>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}

                                    {aiFeedback.overall_assessment && (
                                        <Card className="border-2 border-blue-200">
                                            <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50">
                                                <CardTitle className="flex items-center gap-2 text-lg">
                                                    <CheckCircle className="w-5 h-5 text-blue-600" />
                                                    Overall Assessment
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-5">
                                                <p className="text-gray-700 leading-relaxed">{aiFeedback.overall_assessment}</p>
                                            </CardContent>
                                        </Card>
                                    )}

                                    {aiFeedback.strengths?.length > 0 && (
                                        <Card className="border-2 border-green-200">
                                            <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
                                                <CardTitle className="flex items-center gap-2 text-lg">
                                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                                    What You Did Well
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-5">
                                                <ul className="space-y-2">
                                                    {aiFeedback.strengths.map((strength, idx) => (
                                                        <li key={idx} className="flex items-start gap-3 text-gray-700">
                                                            <span className="text-green-600 mt-0.5">✓</span>
                                                            <span>{strength}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </CardContent>
                                        </Card>
                                    )}

                                    {aiFeedback.gaps?.length > 0 && (
                                        <Card className="border-2 border-orange-200">
                                            <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50">
                                                <CardTitle className="flex items-center gap-2 text-lg">
                                                    <AlertCircle className="w-5 h-5 text-orange-600" />
                                                    Areas to Review
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-5">
                                                <ul className="space-y-2">
                                                    {aiFeedback.gaps.map((gap, idx) => (
                                                        <li key={idx} className="flex items-start gap-3 text-gray-700">
                                                            <span className="text-orange-600 mt-0.5">!</span>
                                                            <span>{gap}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </CardContent>
                                        </Card>
                                    )}

                                    {aiFeedback.suggestions?.length > 0 && (
                                        <Card className="border-2 border-blue-200">
                                            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
                                                <CardTitle className="flex items-center gap-2 text-lg">
                                                    <Lightbulb className="w-5 h-5 text-blue-600" />
                                                    Suggestions for Improvement
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-5">
                                                <ul className="space-y-2">
                                                    {aiFeedback.suggestions.map((suggestion, idx) => (
                                                        <li key={idx} className="flex items-start gap-3 text-gray-700">
                                                            <span className="text-blue-600 mt-0.5">→</span>
                                                            <span>{suggestion}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </CardContent>
                                        </Card>
                                    )}

                                    <div className="flex gap-3">
                                        <Button onClick={handleSave} className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg">
                                            <Save className="w-5 h-5 mr-2" />
                                            Save Session
                                        </Button>
                                        <Button onClick={handleReset} variant="outline" className="flex-1 border-2">
                                            <RotateCcw className="w-5 h-5 mr-2" />
                                            New Session
                                        </Button>
                                    </div>
                                </motion.div>
                            )}
                        </motion.div>
                    )}
                </CardContent>
            </Card>

            {/* Saved Sessions History */}
            {savedSessions.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <Card className="shadow-xl border-2 border-purple-100 bg-gradient-to-br from-purple-50/50 to-indigo-50/50">
                        <CardHeader className="border-b-2 border-purple-100 bg-white/50">
                            <CardTitle className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                                    <FolderOpen className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <span className="text-xl">Session History</span>
                                    <p className="text-sm font-normal text-gray-600 mt-1">
                                        {savedSessions.length} session{savedSessions.length !== 1 ? 's' : ''} saved
                                    </p>
                                </div>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="space-y-3">
                                {savedSessions.map((session, idx) => (
                                    <motion.div
                                        key={session.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="bg-white rounded-xl p-5 border-2 border-purple-200 hover:shadow-md transition-all"
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex-1">
                                                <h4 className="font-bold text-gray-900 text-lg mb-1">{session.topic}</h4>
                                                <div className="flex items-center gap-3 text-sm text-gray-600">
                                                    <span className="font-medium">{session.subject_name}</span>
                                                    <span>•</span>
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {session.session_duration} min
                                                    </span>
                                                    <span>•</span>
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="w-3 h-3" />
                                                        {session.date}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleViewSession(session)}
                                                    className="text-purple-600 hover:text-purple-700 hover:bg-purple-100"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDeleteSession(session.id)}
                                                    className="text-red-600 hover:text-red-700 hover:bg-red-100"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="prose prose-sm max-w-none bg-gray-50 p-4 rounded-lg border border-gray-200">
                                            <p className="text-gray-700 line-clamp-2">{session.blurted_text}</p>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            )}

            {/* View Session Dialog */}
            <Dialog open={!!viewingSession} onOpenChange={() => setViewingSession(null)}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold">{viewingSession?.topic}</DialogTitle>
                        <div className="flex items-center gap-2 text-sm text-gray-600 mt-2">
                            <Badge className="bg-purple-100 text-purple-800">{viewingSession?.subject_name}</Badge>
                            <span>•</span>
                            <span>{viewingSession?.session_duration} minutes</span>
                            <span>•</span>
                            <span>{viewingSession?.date}</span>
                        </div>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <h4 className="font-semibold text-gray-900 mb-2">Your Blurted Content:</h4>
                            <div className="prose prose-sm max-w-none bg-gray-50 p-4 rounded-lg border-2 border-gray-200">
                                <p className="whitespace-pre-wrap text-gray-700">{viewingSession?.blurted_text}</p>
                            </div>
                        </div>
                        {viewingSession?.ai_feedback && (
                            <div>
                                <h4 className="font-semibold text-gray-900 mb-2">AI Feedback:</h4>
                                <div className="prose prose-sm max-w-none bg-purple-50 p-4 rounded-lg border-2 border-purple-200">
                                    <pre className="whitespace-pre-wrap text-gray-700 font-sans">
                                        {JSON.stringify(JSON.parse(viewingSession.ai_feedback), null, 2)}
                                    </pre>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}