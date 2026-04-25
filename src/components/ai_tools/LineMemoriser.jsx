import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';
import ReactMarkdown from 'react-markdown';
import { Zap, Play, RotateCcw, Eye, EyeOff, CheckCircle2, Trophy, Target, Flame, Brain, ArrowRight, BookOpen, Save, Trash2, Coffee, HelpCircle, RotateCw, RefreshCcw } from 'lucide-react';

const MODES = { SETUP: 'setup', LEARNING: 'learning', CHUNK_TEST: 'chunk_test', FINAL_TEST: 'final_test', COMPLETE: 'complete' };

export default function LineMemoriser() {
    const { toast } = useToast();
    const [content, setContent] = useState('');
    const [subject, setSubject] = useState('');
    const [title, setTitle] = useState('');
    const [sentences, setSentences] = useState([]);
    const [savedSessions, setSavedSessions] = useState([]);
    const [mode, setMode] = useState(MODES.SETUP);
    const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
    const [showSentence, setShowSentence] = useState(true);
    const [userInput, setUserInput] = useState('');
    const [attempts, setAttempts] = useState({});
    const [masteredSentences, setMasteredSentences] = useState(new Set());
    const [chunkProgress, setChunkProgress] = useState(0);
    const [isChaining, setIsChaining] = useState(false);
    const [isFirstAttempt, setIsFirstAttempt] = useState(true);
    const [streak, setStreak] = useState(0);
    const [totalCorrect, setTotalCorrect] = useState(0);
    const [sessionStartTime, setSessionStartTime] = useState(null);
    const [currentSessionId, setCurrentSessionId] = useState(null);
    const [chunkSize] = useState(4);
    const [enableSkip] = useState(true);
    const [showMorePracticeDialog, setShowMorePracticeDialog] = useState(false);
    const [showSaveProgressDialog, setShowSaveProgressDialog] = useState(false);
    const [pendingExit, setPendingExit] = useState(false);
    const [feedbackDialog, setFeedbackDialog] = useState({ show: false, content: null, chunkText: '', userInput: '' });
    const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);
    const [user, setUser] = useState(null);
    const [userSubjects, setUserSubjects] = useState([]);

    useEffect(() => {
        const saved = localStorage.getItem('lineMemoriserSessions');
        if (saved) setSavedSessions(JSON.parse(saved));
        const init = async () => {
            const currentUser = await base44.auth.me();
            setUser(currentUser);
            const subjects = await base44.entities.UserSubject.filter({ created_by: currentUser.email, is_active: true }).catch(() => []);
            const unique = subjects.reduce((acc, s) => { if (!acc.find(x => x.subject_name === s.subject_name)) acc.push(s); return acc; }, []);
            setUserSubjects(unique);
            if (unique.length > 0) setSubject(unique[0].subject_name);
        };
        init();
    }, []);

    const processText = (text) => {
        if (!text.trim()) return [];
        let processed = text.trim().split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0).map(s => s.trim());
        if (processed.length === 1 && !/[.!?]/.test(text)) {
            processed = text.split('\n').filter(s => s.trim().length > 0).map(s => s.trim());
        }
        return processed;
    };

    const initializeSession = (sessionSentences, sessionId, sessionTitle, sessionSubject) => {
        if (!sessionSentences.length) { toast({ title: 'No text to memorize', variant: 'destructive' }); return; }
        setSentences(sessionSentences); setMode(MODES.LEARNING); setCurrentSentenceIndex(0);
        setShowSentence(true); setIsFirstAttempt(true); setAttempts({}); setMasteredSentences(new Set());
        setChunkProgress(0); setStreak(0); setTotalCorrect(0); setSessionStartTime(Date.now());
        setCurrentSessionId(sessionId || Date.now().toString()); setUserInput(''); setIsChaining(false);
        setTitle(sessionTitle || ''); setSubject(sessionSubject || '');
    };

    const checkAnswerWithAI = async (expectedText, userAnswer) => {
        try {
            const response = await base44.integrations.Core.InvokeLLM({
                prompt: `Compare these two texts. Ignore punctuation, capitalization, and minor typos. Is the meaning and word sequence 95%+ the same?\n\nExpected: "${expectedText}"\nUser wrote: "${userAnswer}"\n\nRespond with is_correct (boolean) and feedback (string, only if incorrect).`,
                response_json_schema: { type: 'object', properties: { is_correct: { type: 'boolean' }, feedback: { type: 'string' } }, required: ['is_correct'] }
            });
            return { isCorrect: response.is_correct, feedback: response.feedback || '' };
        } catch {
            const simple = expectedText.toLowerCase().replace(/[^a-z0-9\s]/g, '');
            const simpleInput = userAnswer.toLowerCase().replace(/[^a-z0-9\s]/g, '');
            return { isCorrect: simple === simpleInput, feedback: '' };
        }
    };

    const getCurrentChain = () => sentences.slice(0, currentSentenceIndex + 1);

    const checkAnswer = async () => {
        const expectedText = isChaining ? getCurrentChain().join(' ') : sentences[currentSentenceIndex];
        const currentKey = `${currentSentenceIndex}_${isChaining ? 'chain' : 'single'}`;
        toast({ title: 'Checking...', description: 'AI is validating your answer' });
        const result = await checkAnswerWithAI(expectedText, userInput);
        if (result.isCorrect) {
            const currentAttempts = attempts[currentKey] || 0;
            const newAttempts = { ...attempts, [currentKey]: currentAttempts + 1 };
            setAttempts(newAttempts);
            setStreak(prev => prev + 1); setTotalCorrect(prev => prev + 1);
            const requiredAttempts = streak > 5 ? 2 : 3;
            if (newAttempts[currentKey] >= requiredAttempts) { setShowMorePracticeDialog(true); }
            else {
                setShowSentence(false); setIsFirstAttempt(false); setUserInput('');
                toast({ title: `✓ Correct! ${requiredAttempts - newAttempts[currentKey]} more to master` });
            }
        } else {
            setStreak(0); setAttempts({ ...attempts, [`${currentSentenceIndex}_${isChaining ? 'chain' : 'single'}`]: 0 });
            setShowSentence(true); setIsFirstAttempt(false); setUserInput('');
            toast({ title: 'Not quite right', description: result.feedback || 'Study the text and try again', variant: 'destructive' });
        }
    };

    const handleMorePractice = (wantMore) => {
        setShowMorePracticeDialog(false);
        if (wantMore) {
            const key = `${currentSentenceIndex}_${isChaining ? 'chain' : 'single'}`;
            setAttempts(prev => ({ ...prev, [key]: 0 })); setShowSentence(false); setIsFirstAttempt(false); setUserInput('');
            return;
        }
        if (!isChaining) {
            setMasteredSentences(prev => new Set([...prev, currentSentenceIndex]));
            if (currentSentenceIndex === 0) {
                if (sentences.length > 1) { setCurrentSentenceIndex(1); setIsChaining(false); setShowSentence(true); setIsFirstAttempt(true); setUserInput(''); }
                else { setMode(MODES.FINAL_TEST); setShowSentence(false); setUserInput(''); }
                return;
            }
            setIsChaining(true); setShowSentence(false); setIsFirstAttempt(false); setUserInput('');
            toast({ title: `Line ${currentSentenceIndex + 1} mastered!`, description: 'Now practice with the chain' });
        } else {
            const shouldChunkTest = (currentSentenceIndex + 1) % chunkSize === 0 && currentSentenceIndex < sentences.length - 1;
            if (shouldChunkTest) {
                setMode(MODES.CHUNK_TEST); setChunkProgress(Math.floor(currentSentenceIndex / chunkSize)); setShowSentence(false); setUserInput('');
            } else if (currentSentenceIndex < sentences.length - 1) {
                setCurrentSentenceIndex(prev => prev + 1); setIsChaining(false); setShowSentence(true); setIsFirstAttempt(true); setUserInput('');
            } else {
                setMode(MODES.FINAL_TEST); setShowSentence(false); setUserInput('');
            }
        }
    };

    const handleChunkTest = async () => {
        const chunkStart = chunkProgress * chunkSize;
        const chunkEnd = Math.min(chunkStart + chunkSize, sentences.length);
        const chunkText = sentences.slice(chunkStart, chunkEnd).join(' ');
        const result = await checkAnswerWithAI(chunkText, userInput);
        if (result.isCorrect) {
            toast({ title: 'Chunk passed! 🎉' });
            if (chunkEnd === sentences.length) { setMode(MODES.FINAL_TEST); setShowSentence(false); }
            else { setCurrentSentenceIndex(chunkEnd); setIsChaining(false); setMode(MODES.LEARNING); setShowSentence(true); setIsFirstAttempt(true); }
        } else {
            setIsFeedbackLoading(true);
            setFeedbackDialog({ show: true, content: null, chunkText, userInput });
            try {
                const feedback = await base44.integrations.Core.InvokeLLM({ prompt: `Compare student's attempt with correct text. Be encouraging but precise about errors.\n\nCorrect: "${chunkText}"\nStudent: "${userInput}"\n\nProvide feedback in markdown.` });
                setFeedbackDialog(prev => ({ ...prev, content: feedback }));
            } catch { setFeedbackDialog(prev => ({ ...prev, content: 'Could not get AI feedback. Please review manually.' })); }
            finally { setIsFeedbackLoading(false); }
        }
        setUserInput('');
    };

    const handleFinalTest = async () => {
        const fullText = sentences.join(' ');
        const result = await checkAnswerWithAI(fullText, userInput);
        if (result.isCorrect) {
            setMode(MODES.COMPLETE);
            const newSessions = savedSessions.filter(s => s.id !== currentSessionId);
            setSavedSessions(newSessions); localStorage.setItem('lineMemoriserSessions', JSON.stringify(newSessions));
            toast({ title: '🏆 Perfect!' });
        } else {
            toast({ title: 'Almost!', description: 'Review the passage and try again', variant: 'destructive' });
            setMode(MODES.LEARNING); setCurrentSentenceIndex(0); setIsChaining(false); setShowSentence(false); setIsFirstAttempt(false);
        }
        setUserInput('');
    };

    const saveCurrentSession = async () => {
        if (!sentences.length || mode === MODES.SETUP || mode === MODES.COMPLETE) return;
        const sessionData = {
            id: currentSessionId, title: title || sentences[0].substring(0, 50), subject, sentences,
            currentSentenceIndex, attempts, masteredSentences: Array.from(masteredSentences), chunkProgress,
            streak, totalCorrect, sessionStartTime, isChaining, chunkSize, savedAt: new Date().toISOString(),
            progress: getProgressPercentage()
        };
        const newSavedSessions = savedSessions.filter(s => s.id !== currentSessionId);
        newSavedSessions.push(sessionData);
        setSavedSessions(newSavedSessions);
        localStorage.setItem('lineMemoriserSessions', JSON.stringify(newSavedSessions));
        toast({ title: 'Progress saved!' });
    };

    const resetSession = () => {
        setMode(MODES.SETUP); setCurrentSentenceIndex(0); setShowSentence(true); setIsFirstAttempt(true);
        setUserInput(''); setAttempts({}); setMasteredSentences(new Set()); setChunkProgress(0);
        setStreak(0); setTotalCorrect(0); setIsChaining(false); setCurrentSessionId(null); setContent(''); setTitle(''); setSentences([]);
    };

    const getProgressPercentage = () => {
        if (!sentences.length) return 0;
        if (mode === MODES.COMPLETE) return 100;
        let total = sentences.length > 0 ? 1 + 2 * Math.max(0, sentences.length - 1) : 0;
        let done = 0;
        masteredSentences.forEach(i => { done += i === 0 ? 1 : 2; });
        return total > 0 ? Math.floor((done / total) * 100) : 0;
    };

    const getCurrentDisplayText = () => {
        if (mode === MODES.CHUNK_TEST) { const s = chunkProgress * chunkSize; return sentences.slice(s, Math.min(s + chunkSize, sentences.length)).join(' '); }
        if (mode === MODES.FINAL_TEST) return sentences.join(' ');
        if (isChaining) return getCurrentChain().join(' ');
        return sentences[currentSentenceIndex] || '';
    };

    if (mode === MODES.SETUP) {
        return (
            <div className="space-y-5 max-w-3xl">
                {savedSessions.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100">
                            <div className="flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-pink-500" />
                                <h3 className="font-bold text-gray-900 text-sm">Continue Memorising</h3>
                            </div>
                        </div>
                        <div className="p-3 space-y-2">
                            {savedSessions.map(session => (
                                <div key={session.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-gray-800 truncate">{session.title}</p>
                                        <div className="flex items-center gap-3 mt-1">
                                            {session.subject && <Badge className="bg-pink-100 text-pink-700 border-0 text-xs">{session.subject}</Badge>}
                                            <span className="text-xs text-gray-400">{session.progress}% complete</span>
                                            <div className="flex-1 max-w-24"><Progress value={session.progress} className="h-1.5" /></div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 ml-3">
                                        <Button size="sm" onClick={() => {
                                            setSentences(session.sentences); setMode(MODES.LEARNING); setCurrentSentenceIndex(session.currentSentenceIndex);
                                            setShowSentence(false); setIsFirstAttempt(false); setAttempts(session.attempts);
                                            setMasteredSentences(new Set(session.masteredSentences)); setChunkProgress(session.chunkProgress);
                                            setStreak(session.streak); setTotalCorrect(session.totalCorrect); setSessionStartTime(session.sessionStartTime);
                                            setCurrentSessionId(session.id); setUserInput(''); setIsChaining(session.isChaining);
                                            setTitle(session.title || ''); setSubject(session.subject || '');
                                        }} className="h-8 text-xs bg-pink-600 hover:bg-pink-700">
                                            <Play className="w-3 h-3 mr-1" />Resume
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => {
                                            const n = savedSessions.filter(s => s.id !== session.id);
                                            setSavedSessions(n); localStorage.setItem('lineMemoriserSessions', JSON.stringify(n));
                                        }} className="h-8 text-red-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="bg-gradient-to-r from-pink-500 to-rose-600 px-5 py-4">
                        <h2 className="text-white font-bold text-lg">Line Memoriser</h2>
                        <p className="text-white/70 text-sm">Master any text through structured, adaptive memorization</p>
                    </div>
                    <div className="p-5 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Subject</label>
                                <Select value={subject} onValueChange={setSubject}>
                                    <SelectTrigger className="bg-gray-50 border-gray-200 h-10"><SelectValue placeholder="Select subject" /></SelectTrigger>
                                    <SelectContent>
                                        {userSubjects.map(s => <SelectItem key={s.id} value={s.subject_name}>{s.subject_name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Title</label>
                                <Input placeholder="e.g., Hamlet's Soliloquy" value={title} onChange={e => setTitle(e.target.value)} className="bg-gray-50 border-gray-200 h-10" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Text to Memorize</label>
                            <Textarea placeholder="Paste your essay, script, speech, or any text..." value={content} onChange={e => setContent(e.target.value)} className="min-h-36 bg-gray-50 border-gray-200 resize-none" />
                            <p className="text-xs text-gray-400">Text is automatically split into sentences for structured learning</p>
                        </div>
                        <Button onClick={() => { const p = processText(content); if (p.length) initializeSession(p, null, title, subject); else toast({ title: 'Please enter some text', variant: 'destructive' }); }}
                            disabled={!content.trim() || !title.trim() || !subject}
                            className="w-full bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 h-11 font-semibold shadow-lg">
                            <Play className="w-4 h-4 mr-2" />Start Memorising
                        </Button>
                        <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-100">
                            {[['📚', 'Break into sentences'], ['🔄', 'Spaced repetition'], ['🎯', 'Test full recall']].map(([icon, text]) => (
                                <div key={text} className="text-center p-3 bg-gray-50 rounded-xl">
                                    <div className="text-xl mb-1">{icon}</div>
                                    <p className="text-xs text-gray-500">{text}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 max-w-3xl">
            <Dialog open={showMorePracticeDialog} onOpenChange={setShowMorePracticeDialog}>
                <DialogContent>
                    <DialogHeader><DialogTitle className="flex items-center gap-2"><Trophy className="w-5 h-5 text-amber-500" />Nicely done!</DialogTitle></DialogHeader>
                    <p className="text-gray-600 text-sm">3 successful attempts! Do you want more practice or move on?</p>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => handleMorePractice(true)}><Coffee className="w-4 h-4 mr-2" />More Practice</Button>
                        <Button onClick={() => handleMorePractice(false)} className="bg-green-600 hover:bg-green-700"><ArrowRight className="w-4 h-4 mr-2" />Move On</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={feedbackDialog.show}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle className="flex items-center gap-2"><HelpCircle className="w-5 h-5 text-orange-500" />Feedback</DialogTitle></DialogHeader>
                    <div className="py-2 max-h-80 overflow-y-auto">
                        {isFeedbackLoading ? <div className="flex items-center gap-3 py-8 justify-center text-gray-500"><RotateCw className="w-5 h-5 animate-spin" /><span>Analysing...</span></div>
                            : <div className="prose prose-sm max-w-none"><ReactMarkdown>{feedbackDialog.content || ''}</ReactMarkdown></div>}
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => { setFeedbackDialog({ show: false, content: null, chunkText: '', userInput: '' }); const s = chunkProgress * chunkSize; setCurrentSentenceIndex(s); setIsChaining(false); setMode(MODES.LEARNING); setShowSentence(false); setIsFirstAttempt(false); }} disabled={isFeedbackLoading}><RotateCw className="w-4 h-4 mr-2" />Review Chunk</Button>
                        <Button onClick={() => { setFeedbackDialog({ show: false, content: null, chunkText: '', userInput: '' }); const next = Math.min((chunkProgress + 1) * chunkSize, sentences.length); if (next < sentences.length) { setCurrentSentenceIndex(next); setIsChaining(false); setMode(MODES.LEARNING); setShowSentence(true); setIsFirstAttempt(true); } else { setMode(MODES.FINAL_TEST); setShowSentence(false); } }} disabled={isFeedbackLoading}><ArrowRight className="w-4 h-4 mr-2" />Continue Anyway</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showSaveProgressDialog} onOpenChange={setShowSaveProgressDialog}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Save Progress?</DialogTitle></DialogHeader>
                    <p className="text-gray-600 text-sm">Save your progress to continue later?</p>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => { setShowSaveProgressDialog(false); if (pendingExit) { setPendingExit(false); resetSession(); } }} className="text-red-600 border-red-200 hover:bg-red-50">Don't Save</Button>
                        <Button onClick={async () => { await saveCurrentSession(); setShowSaveProgressDialog(false); if (pendingExit) { setPendingExit(false); resetSession(); } }} className="bg-blue-600 hover:bg-blue-700"><Save className="w-4 h-4 mr-2" />Save & Exit</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Header */}
            <div className="bg-gradient-to-r from-pink-500 to-rose-600 rounded-2xl text-white p-5">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h3 className="font-bold text-lg">{title}</h3>
                        {subject && <Badge className="bg-white/20 text-white border-0 text-xs mt-1">{subject}</Badge>}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { if (masteredSentences.size > 0 || totalCorrect > 0) { setPendingExit(true); setShowSaveProgressDialog(true); } else resetSession(); }} className="text-white/80 hover:text-white hover:bg-white/20 h-8 text-xs">
                        <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Exit
                    </Button>
                </div>
                <div className="grid grid-cols-4 gap-3 mb-3 text-center">
                    {[['%', getProgressPercentage(), 'Complete'], ['🔥', streak, 'Streak'], ['✓', totalCorrect, 'Correct'], ['📜', sentences.length, 'Lines']].map(([icon, val, label]) => (
                        <div key={label} className="bg-white/10 rounded-xl p-2">
                            <div className="text-lg font-black">{val}</div>
                            <div className="text-xs text-white/70">{label}</div>
                        </div>
                    ))}
                </div>
                <Progress value={getProgressPercentage()} className="h-2 bg-white/20" />
            </div>

            {/* Main */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
                    <div className="flex items-center gap-2">
                        {mode === MODES.LEARNING && <><Brain className="w-4 h-4 text-pink-500" /><span className="text-sm font-bold text-gray-800">{isChaining ? `Chain: Lines 1–${currentSentenceIndex + 1}` : `Line ${currentSentenceIndex + 1} of ${sentences.length}`}</span></>}
                        {mode === MODES.CHUNK_TEST && <><Target className="w-4 h-4 text-orange-500" /><span className="text-sm font-bold text-gray-800">Chunk Test</span></>}
                        {mode === MODES.FINAL_TEST && <><Trophy className="w-4 h-4 text-amber-500" /><span className="text-sm font-bold text-gray-800">Final Test</span></>}
                    </div>
                    <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setShowSentence(!showSentence)} className="h-7 text-xs">
                            {showSentence ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}{showSentence ? 'Hide' : 'Show'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={saveCurrentSession} className="h-7 text-xs border-blue-200 text-blue-600 hover:bg-blue-50">
                            <Save className="w-3 h-3 mr-1" />Save
                        </Button>
                    </div>
                </div>
                <div className="p-5 space-y-4">
                    <AnimatePresence>
                        {showSentence && (
                            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                                className="p-5 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                                <p className="text-base leading-relaxed text-gray-800 text-center font-medium">{getCurrentDisplayText()}</p>
                                {mode === MODES.LEARNING && (
                                    <div className="flex justify-center mt-3">
                                        <Badge className="bg-pink-100 text-pink-700 border-0 text-xs">
                                            {attempts[`${currentSentenceIndex}_${isChaining ? 'chain' : 'single'}`] || 0}/3 attempts
                                        </Badge>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <Textarea
                        placeholder={mode === MODES.FINAL_TEST ? "Recite the entire passage from memory..." : mode === MODES.CHUNK_TEST ? "Recite this chunk from memory..." : isChaining ? "Recite all lines from the beginning..." : "Recite this line from memory..."}
                        value={userInput} onChange={e => setUserInput(e.target.value)} className="min-h-28 resize-none border-gray-200 focus:border-pink-400"
                        onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); if (userInput.trim()) { if (mode === MODES.CHUNK_TEST) handleChunkTest(); else if (mode === MODES.FINAL_TEST) handleFinalTest(); else checkAnswer(); } } }}
                    />

                    <div className="flex gap-2 justify-center flex-wrap">
                        <Button onClick={async () => { if (mode === MODES.CHUNK_TEST) await handleChunkTest(); else if (mode === MODES.FINAL_TEST) await handleFinalTest(); else await checkAnswer(); }} disabled={!userInput.trim()} className="bg-green-600 hover:bg-green-700">
                            <CheckCircle2 className="w-4 h-4 mr-2" />Check Answer
                        </Button>
                        {enableSkip && mode === MODES.LEARNING && (
                            <Button variant="outline" onClick={() => {
                                const key = `${currentSentenceIndex}_${isChaining ? 'chain' : 'single'}`;
                                const n = { ...attempts, [key]: (attempts[key] || 0) + 1 };
                                setAttempts(n); setStreak(prev => prev + 1); setTotalCorrect(prev => prev + 1);
                                if (n[key] >= 3) { setShowMorePracticeDialog(true); } else { setShowSentence(false); setIsFirstAttempt(false); setUserInput(''); }
                            }} className="border-blue-200 text-blue-600 hover:bg-blue-50">
                                <ArrowRight className="w-4 h-4 mr-2" />I Know It
                            </Button>
                        )}
                        <Button variant="outline" onClick={() => setShowSentence(true)}>
                            <Eye className="w-4 h-4 mr-2" />Show Text
                        </Button>
                    </div>
                    <p className="text-xs text-center text-gray-400">Tip: Ctrl+Enter to check answer</p>
                </div>
            </div>

            {mode === MODES.COMPLETE && (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-8 text-center">
                        <Trophy className="w-14 h-14 text-amber-500 mx-auto mb-3" />
                        <h2 className="text-2xl font-black text-green-800 mb-2">Perfect Memorisation!</h2>
                        <p className="text-green-700 mb-6">You've mastered the entire passage!</p>
                        <div className="grid grid-cols-3 gap-3 mb-6">
                            {[[sentences.length, 'Lines Mastered'], [totalCorrect, 'Correct Attempts'], [`${sessionStartTime ? Math.floor((Date.now() - sessionStartTime) / 60000) : 0}m`, 'Time Taken']].map(([v, l]) => (
                                <div key={l} className="bg-white rounded-xl p-3 border border-green-200">
                                    <div className="text-xl font-black text-green-600">{v}</div>
                                    <div className="text-xs text-gray-600 mt-0.5">{l}</div>
                                </div>
                            ))}
                        </div>
                        <Button onClick={resetSession} className="bg-green-600 hover:bg-green-700"><RotateCcw className="w-4 h-4 mr-2" />New Session</Button>
                    </div>
                </motion.div>
            )}
        </div>
    );
}