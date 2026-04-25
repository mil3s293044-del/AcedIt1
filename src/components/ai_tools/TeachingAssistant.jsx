import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';
import ReactMarkdown from 'react-markdown';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Send, Loader2, GraduationCap, Brain, Upload, Sparkles, Save, Trash2, Eye, MessageCircle, BookOpen, FolderOpen, ChevronDown } from 'lucide-react';
import { moderationPresets } from '@/components/shared/contentModeration';
import AILoadingProgress from '../shared/AILoadingProgress';
import { recordStudyAndGetStreak } from "@/components/shared/streakHelpers";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function TeachingAssistant() {
    const [mode, setMode] = useState('concept');
    const [uploadedFile, setUploadedFile] = useState(null);
    const [subject, setSubject] = useState('');
    const [topic, setTopic] = useState('');
    const [userSubjects, setUserSubjects] = useState([]);
    const [user, setUser] = useState(null);
    const [savedSessions, setSavedSessions] = useState([]);
    const [messages, setMessages] = useState([]);
    const [userInput, setUserInput] = useState('');
    const [isAIThinking, setIsAIThinking] = useState(false);
    const [conversationContext, setConversationContext] = useState('');
    const [hasStarted, setHasStarted] = useState(false);
    const [loadedResultId, setLoadedResultId] = useState(null);
    const [showHistory, setShowHistory] = useState(false);
    const [viewingSession, setViewingSession] = useState(null);
    const [showQuizDialog, setShowQuizDialog] = useState(false);
    const [quizTitle, setQuizTitle] = useState('');
    const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
    const messagesEndRef = useRef(null);
    const autoSaveRef = useRef(null);
    const { toast } = useToast();

    useEffect(() => {
        const init = async () => {
            const currentUser = await base44.auth.me();
            setUser(currentUser);
            const [results, subjects] = await Promise.all([
                base44.entities.AISavedResult.filter({ created_by: currentUser.email, tool_type: 'teaching_assistant' }, '-date_created').catch(() => []),
                base44.entities.UserSubject.filter({ created_by: currentUser.email, is_active: true }).catch(() => [])
            ]);
            setSavedSessions(results || []);
            setUserSubjects(subjects || []);
        };
        init();
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (!loadedResultId || !messages.length) return;
        autoSaveRef.current = setInterval(async () => {
            await base44.entities.AISavedResult.update(loadedResultId, { content: JSON.stringify({ messages, mode }), input_data: { mode, message_count: messages.length } }).catch(() => {});
        }, 30000);
        return () => clearInterval(autoSaveRef.current);
    }, [loadedResultId, messages, mode]);

    const startSession = async () => {
        if (!topic.trim() || !subject) { toast({ title: 'Please enter a topic and subject', variant: 'destructive' }); return; }
        if (mode === 'document' && !uploadedFile) { toast({ title: 'Please upload a file', variant: 'destructive' }); return; }
        try { const m = await moderationPresets.aiPrompt(topic); if (!m.isAllowed) { toast({ title: 'Content policy violation', variant: 'destructive' }); return; } } catch {}
        setIsAIThinking(true);
        try {
            let context;
            if (mode === 'document') {
                const { file_url } = await base44.integrations.Core.UploadFile({ file: uploadedFile });
                const ext = uploadedFile.name.split('.').pop()?.toLowerCase();
                if (ext === 'docx' || ext === 'pptx') {
                    const textResult = await base44.functions.invoke('extractDocumentText', { file_url });
                    context = await base44.integrations.Core.InvokeLLM({ prompt: `Summarise key concepts from this ${subject} document for a VCE student:\n\n${textResult.data?.text || ''}` });
                } else {
                    context = await base44.integrations.Core.InvokeLLM({ prompt: `Extract and summarise key concepts from this ${subject} document for a VCE student.`, file_urls: [file_url] });
                }
            } else {
                context = await base44.integrations.Core.InvokeLLM({ prompt: `Create a comprehensive educational overview of "${topic}" for a VCE Year 12 ${subject} student. Cover core concepts, principles, examples, and common misconceptions.`, add_context_from_internet: true });
            }
            setConversationContext(context);
            setMessages([{ role: 'assistant', content: `# Let's explore **${topic}**! 🎓\n\nI'm your AI tutor for this session. I'll guide you through the material with questions and explanations.\n\n**To start:** What do you already know about **${topic}**? Share anything — even if you're unsure!`, timestamp: new Date().toISOString() }]);
            setHasStarted(true);
            recordStudyAndGetStreak().catch(() => {});
        } catch (e) { toast({ title: 'Error starting session', description: e.message, variant: 'destructive' }); }
        finally { setIsAIThinking(false); }
    };

    const handleSendMessage = async () => {
        if (!userInput.trim() || isAIThinking) return;
        try { const m = await moderationPresets.aiPrompt(userInput); if (!m.isAllowed) { toast({ title: 'Message not sent', variant: 'destructive' }); return; } } catch {}
        setIsAIThinking(true);
        const userMsg = { role: 'user', content: userInput, timestamp: new Date().toISOString() };
        setMessages(prev => [...prev, userMsg]);
        setUserInput('');
        try {
            const history = messages.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n');
            const response = await base44.integrations.Core.InvokeLLM({
                prompt: `You are an expert adaptive tutor for VCE ${subject}, teaching "${topic}".

Knowledge base: ${conversationContext}

Recent conversation: ${history}

Student's response: ${userInput}

Instructions:
- Be conversational and encouraging
- If they answer correctly: praise specifically what's right, deepen with a follow-up
- If they're wrong or confused: gently correct, explain simply, give an analogy
- Always end with a question to keep them engaged
- Use the Socratic method — guide them to discover understanding
- Keep responses concise (3-5 sentences max before the question)

Respond in markdown.`
            });
            setMessages(prev => [...prev, { role: 'assistant', content: response, timestamp: new Date().toISOString() }]);
        } catch { toast({ title: 'Error', variant: 'destructive' }); }
        finally { setIsAIThinking(false); }
    };

    const saveSession = async () => {
        if (!user || !messages.length) return;
        try {
            if (loadedResultId) {
                await base44.entities.AISavedResult.update(loadedResultId, { content: JSON.stringify({ messages, mode }), input_data: { mode, message_count: messages.length } });
            } else {
                const r = await base44.entities.AISavedResult.create({ tool_type: 'teaching_assistant', subject_name: subject, topic, title: `${topic} — ${subject}`, content: JSON.stringify({ messages, mode }), input_data: { mode, message_count: messages.length }, date_created: new Date().toISOString().split('T')[0] });
                setLoadedResultId(r.id);
            }
            toast({ title: 'Session saved!' });
            setQuizTitle(`${topic} — Practice Quiz`);
            setShowQuizDialog(true);
        } catch { toast({ title: 'Save failed', variant: 'destructive' }); }
    };

    const generateQuiz = async () => {
        setShowQuizDialog(false);
        setIsGeneratingQuiz(true);
        try {
            const conversationText = messages.map(m => `${m.role === 'user' ? 'Student' : 'AI'}: ${m.content}`).join('\n\n');
            const response = await base44.integrations.Core.InvokeLLM({
                prompt: `Based on this teaching conversation about "${topic}", create 10 quiz questions.\n\n${conversationText}\n\nMix 7 MCQ (4 options each, correct_answer index 0-3) and 3 short answer (with model_answer and marks). Test genuine understanding.`,
                response_json_schema: { type: 'object', properties: { questions: { type: 'array', items: { type: 'object', properties: { type: { type: 'string' }, question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, correct_answer: { type: 'number' }, model_answer: { type: 'string' }, marks: { type: 'number' }, explanation: { type: 'string' } } } } } }
            });
            const cleaned = (response.questions || []).map(q => q.type === 'mcq' ? { type: 'mcq', question: q.question, options: q.options, correct_answer: q.correct_answer, explanation: q.explanation } : { type: 'short_answer', question: q.question, model_answer: q.model_answer, marks: q.marks, explanation: q.explanation });
            await base44.entities.Quiz.create({ title: quizTitle, subject, questions: cleaned, difficulty: 'intermediate', category: 'subject_content' });
            toast({ title: '🎉 Quiz created!', description: 'Find it in your Quizzes page.' });
        } catch { toast({ title: 'Quiz generation failed', variant: 'destructive' }); }
        finally { setIsGeneratingQuiz(false); }
    };

    if (!hasStarted) return (
        <div className="space-y-5 max-w-3xl">
            {isGeneratingQuiz && <AILoadingProgress stage="generating" message="Creating your quiz..." estimatedTime={30} />}

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-4">
                    <h2 className="text-white font-bold text-lg">Teaching Assistant</h2>
                    <p className="text-white/70 text-sm">Learn by explaining — AI will question and guide you to mastery</p>
                </div>
                <div className="p-5 space-y-4">
                    <Tabs value={mode} onValueChange={setMode}>
                        <TabsList className="grid w-full grid-cols-2 bg-gray-100">
                            <TabsTrigger value="concept" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                <Brain className="w-3.5 h-3.5 mr-1.5" />Learn a Concept
                            </TabsTrigger>
                            <TabsTrigger value="document" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                <Upload className="w-3.5 h-3.5 mr-1.5" />Study My Notes
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="concept" className="mt-4 space-y-3">
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                                <p className="text-xs text-amber-800 font-medium">💡 Type any concept — the AI creates an educational session and quizzes you through it</p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Subject</label>
                                    <Select value={subject} onValueChange={setSubject}><SelectTrigger className="bg-gray-50 border-gray-200 h-10"><SelectValue placeholder="Select subject" /></SelectTrigger><SelectContent>{userSubjects.map(s => <SelectItem key={s.id} value={s.subject_name}>{s.subject_name}</SelectItem>)}</SelectContent></Select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">What do you want to learn?</label>
                                    <Input placeholder="e.g., Photosynthesis, WWII causes..." value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => e.key === 'Enter' && startSession()} className="bg-gray-50 border-gray-200 h-10" />
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="document" className="mt-4 space-y-3">
                            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
                                <p className="text-xs text-orange-800 font-medium">📄 Upload your notes — AI analyses them and quizzes you on the content</p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Subject</label>
                                    <Select value={subject} onValueChange={setSubject}><SelectTrigger className="bg-gray-50 border-gray-200 h-10"><SelectValue placeholder="Select subject" /></SelectTrigger><SelectContent>{userSubjects.map(s => <SelectItem key={s.id} value={s.subject_name}>{s.subject_name}</SelectItem>)}</SelectContent></Select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Topic Name</label>
                                    <Input placeholder="e.g., Cell Biology" value={topic} onChange={e => setTopic(e.target.value)} className="bg-gray-50 border-gray-200 h-10" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">Upload Notes</label>
                                <Button asChild variant="outline" className="w-full h-12 border-dashed border-2 border-gray-300 hover:border-amber-300 hover:bg-amber-50">
                                    <label className="cursor-pointer flex items-center gap-2">
                                        <Upload className="w-4 h-4 text-gray-400" />
                                        <span className="text-sm text-gray-600">{uploadedFile ? uploadedFile.name : 'Choose PDF, DOCX, or PPTX'}</span>
                                        <input type="file" className="hidden" accept=".pdf,.txt,.docx,.pptx" onChange={e => setUploadedFile(e.target.files?.[0])} />
                                    </label>
                                </Button>
                            </div>
                        </TabsContent>
                    </Tabs>

                    <Button onClick={startSession} disabled={isAIThinking || !topic.trim() || !subject || (mode === 'document' && !uploadedFile)}
                        className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 h-11 font-semibold shadow-lg">
                        {isAIThinking ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Preparing Session...</> : <><GraduationCap className="w-4 h-4 mr-2" />Start Learning Session</>}
                    </Button>
                </div>
            </div>

            {savedSessions.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <button onClick={() => setShowHistory(!showHistory)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-2">
                            <FolderOpen className="w-4 h-4 text-gray-400" />
                            <span className="font-semibold text-gray-700 text-sm">Previous Sessions</span>
                            <Badge className="bg-gray-100 text-gray-600 border-0 text-xs">{savedSessions.length}</Badge>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence>
                        {showHistory && (
                            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden border-t border-gray-100">
                                <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
                                    {savedSessions.map(s => (
                                        <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-gray-800 truncate">{s.topic}</p>
                                                <p className="text-xs text-gray-400">{s.subject_name} • {s.date_created}</p>
                                            </div>
                                            <div className="flex gap-1.5 ml-2">
                                                <Button size="sm" onClick={() => { try { const d = JSON.parse(s.content); setMessages(d.messages || []); setMode(d.mode || 'concept'); setSubject(s.subject_name); setTopic(s.topic); setHasStarted(true); setLoadedResultId(s.id); if (d.messages?.length) setConversationContext(d.messages.map(m => m.content).join('\n')); toast({ title: 'Session resumed!' }); } catch { toast({ title: 'Could not resume', variant: 'destructive' }); } }} className="h-7 text-xs bg-amber-600 hover:bg-amber-700">
                                                    <MessageCircle className="w-3 h-3 mr-1" />Resume
                                                </Button>
                                                <button onClick={() => base44.entities.AISavedResult.delete(s.id).then(() => setSavedSessions(prev => prev.filter(x => x.id !== s.id)))} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            <Dialog open={showQuizDialog} onOpenChange={setShowQuizDialog}>
                <DialogContent>
                    <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-amber-500" />Create a Quiz?</DialogTitle><DialogDescription>Turn this session into a practice quiz</DialogDescription></DialogHeader>
                    <Input value={quizTitle} onChange={e => setQuizTitle(e.target.value)} placeholder="Quiz title..." />
                    <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => setShowQuizDialog(false)}>Skip</Button>
                        <Button onClick={generateQuiz} disabled={!quizTitle.trim()} className="bg-amber-600 hover:bg-amber-700"><Sparkles className="w-4 h-4 mr-2" />Create Quiz</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );

    return (
        <div className="space-y-4 max-w-3xl">
            {isGeneratingQuiz && <AILoadingProgress stage="generating" message="Creating your quiz..." estimatedTime={30} />}

            {/* Session header */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center">
                            <GraduationCap className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="font-bold text-gray-900 text-sm">{topic}</p>
                            <div className="flex items-center gap-2">
                                <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">{subject}</Badge>
                                <Badge className="bg-gray-100 text-gray-600 border-0 text-xs">{messages.length} messages</Badge>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={saveSession} className="h-8 text-xs"><Save className="w-3 h-3 mr-1" />Save</Button>
                        <Button size="sm" variant="outline" onClick={() => { setHasStarted(false); setMessages([]); setConversationContext(''); setTopic(''); setLoadedResultId(null); }} className="h-8 text-xs text-red-500 border-red-200 hover:bg-red-50">End</Button>
                    </div>
                </div>
            </div>

            {/* Chat */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="h-[420px] overflow-y-auto p-4 space-y-3 bg-gray-50">
                    {messages.map((msg, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[82%] rounded-2xl px-4 py-3 ${msg.role === 'user' ? 'bg-amber-600 text-white' : 'bg-white border border-gray-200 shadow-sm'}`}>
                                {msg.role === 'assistant' ? (
                                    <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-p:my-1 prose-li:text-gray-700 prose-strong:text-gray-900">
                                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                                    </div>
                                ) : <p className="text-sm leading-relaxed">{msg.content}</p>}
                            </div>
                        </motion.div>
                    ))}
                    {isAIThinking && (
                        <div className="flex justify-start">
                            <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 flex items-center gap-2">
                                <div className="flex gap-1">{[0,1,2].map(i => <motion.div key={i} className="w-2 h-2 bg-amber-400 rounded-full" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />)}</div>
                                <span className="text-xs text-gray-400">AI is thinking...</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
                <div className="border-t border-gray-200 p-3 bg-white">
                    <div className="flex gap-2">
                        <Textarea value={userInput} onChange={e => setUserInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                            placeholder="Type your answer or ask a question... (Enter to send)"
                            rows={2} disabled={isAIThinking} className="resize-none border-gray-200 focus:border-amber-400 text-sm flex-1" />
                        <Button onClick={handleSendMessage} disabled={!userInput.trim() || isAIThinking} className="bg-amber-600 hover:bg-amber-700 self-end h-10">
                            {isAIThinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}