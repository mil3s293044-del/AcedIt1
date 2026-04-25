import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Calculator, Loader2, Send, Upload, X, History, Eye, Trash2, FileText, Printer, Play, Save, Maximize2, Minimize2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import AILoadingProgress from "../shared/AILoadingProgress";
import { recordStudyAndGetStreak } from "@/components/shared/streakHelpers";
import { LatexBlock, LatexInline, processLatexContent } from "@/components/shared/LatexRenderer";

const SUBJECTS = {
    foundation: { name: "Foundation Mathematics", color: "from-blue-500 to-cyan-600", topics: ["Number & Algebra", "Data & Statistics", "Measurement", "Space & Shape"] },
    general: { name: "General Mathematics", color: "from-green-500 to-emerald-600", topics: ["Algebra & Functions", "Discrete Mathematics", "Data Analysis", "Recursion & Financial Modelling"] },
    methods: { name: "Mathematical Methods", color: "from-violet-500 to-indigo-600", topics: ["Functions", "Calculus", "Algebra", "Probability & Statistics"] },
    specialist: { name: "Specialist Mathematics", color: "from-red-500 to-orange-600", topics: ["Functions & Graphs", "Vectors", "Calculus", "Mechanics", "Complex Numbers"] }
};

const getPrompt = (subject, topic, isTechFree) => `You are an expert VCE ${subject} examiner and tutor. Calculator: ${isTechFree ? 'TECH-FREE (show ALL hand working)' : 'CAS ACTIVE (guide calculator use)'}.${topic ? ` Topic: ${topic}.` : ''}

CRITICAL: ALL math MUST use LaTeX. NEVER plain text math.
- Inline: $expression$ | Display: $$expression$$
- ✅ $x^2 + 3x$  ❌ x^2 + 3x

RESPONSE FORMAT:
**Understanding** — what the question asks
**Strategy** — approach before calculations
**Working** — step-by-step with LaTeX headings
**Final Answer** — boxed/clear
**Key Points** — 2-3 important concepts
**Exam Tips** — VCE-specific advice
**Practice Questions**
[PRACTICE_START]Q1 (with LaTeX)[PRACTICE_END]
[PRACTICE_START]Q2 (with LaTeX)[PRACTICE_END]
[PRACTICE_START]Q3 (with LaTeX)[PRACTICE_END]

Be rigorous, supportive, and exam-focused.`;

const parsePractice = (content) => {
    const qs = [];
    const regex = /\[PRACTICE_START\]([\s\S]*?)\[PRACTICE_END\]/g;
    let m;
    while ((m = regex.exec(content)) !== null) qs.push(m[1].trim());
    return qs;
};

const parseSummary = (content) => {
    const m = content.match(/\[SUMMARY_START\]([\s\S]*?)\[SUMMARY_END\]/);
    return m ? m[1].trim() : null;
};

const renderLatex = (text) => processLatexContent(text).map((part, i) => {
    if (part.type === 'display') return <LatexBlock key={i}>{part.content}</LatexBlock>;
    if (part.type === 'inline') return <LatexInline key={i}>{part.content}</LatexInline>;
    const parts = part.content.split(/(\*\*.*?\*\*)/g);
    return parts.map((p, j) => { const bm = p.match(/^\*\*(.*?)\*\*$/); return bm ? <strong key={j} className="font-bold text-violet-800">{bm[1]}</strong> : <span key={j}>{p}</span>; });
});

export default function MathTutor() {
    const [selectedSubject, setSelectedSubject] = useState("methods");
    const [selectedTopic, setSelectedTopic] = useState("");
    const [isTechFree, setIsTechFree] = useState(true);
    const [chatInput, setChatInput] = useState("");
    const [uploadedImage, setUploadedImage] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [chatMessages, setChatMessages] = useState([]);
    const [savedResults, setSavedResults] = useState([]);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [viewingResult, setViewingResult] = useState(null);
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
    const [saveTitle, setSaveTitle] = useState("");
    const [loadedResultId, setLoadedResultId] = useState(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const fileInputRef = useRef(null);
    const messagesEndRef = useRef(null);
    const autoSaveRef = useRef(null);
    const { toast } = useToast();

    useEffect(() => {
        loadHistory();
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    useEffect(() => {
        if (!loadedResultId || !chatMessages.length) { clearInterval(autoSaveRef.current); return; }
        autoSaveRef.current = setInterval(async () => {
            await base44.entities.AISavedResult.update(loadedResultId, { content: chatMessages.map(m => `${m.role === 'student' ? 'Student' : 'Tutor'}: ${m.content}`).join('\n\n'), input_data: { subject: selectedSubject, topic: selectedTopic, isTechFree, messages: chatMessages } }).catch(() => {});
        }, 30000);
        return () => clearInterval(autoSaveRef.current);
    }, [loadedResultId, chatMessages]);

    const loadHistory = async () => {
        const user = await base44.auth.me();
        const results = await base44.entities.AISavedResult.filter({ created_by: user.email, tool_type: 'math_tutor' }, '-date_created').catch(() => []);
        setSavedResults(results || []);
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setUploadedImage(file_url);
        toast({ title: 'Image attached!' });
    };

    const handleSend = async () => {
        if (!chatInput.trim() && !uploadedImage) return;
        const userMsg = { role: 'student', content: chatInput || 'See attached image', image: uploadedImage };
        setChatMessages(prev => [...prev, userMsg]);
        setChatInput(''); setUploadedImage(null); setIsGenerating(true);
        try {
            const recentChat = chatMessages.slice(-6).map(m => `${m.role === 'student' ? 'Student' : 'Tutor'}: ${m.content}`).join('\n\n');
            const prompt = getPrompt(SUBJECTS[selectedSubject].name, selectedTopic, isTechFree);
            const response = await base44.integrations.Core.InvokeLLM({
                prompt: `${prompt}\n\n${recentChat ? `Previous conversation:\n${recentChat}\n\n` : ''}Student's Question: ${chatInput || 'Student uploaded a math problem image.'}`,
                file_urls: userMsg.image ? [userMsg.image] : undefined
            });
            const content = response.replace(/\[PRACTICE_START\][\s\S]*?\[PRACTICE_END\]/g, '').replace(/\[SUMMARY_START\][\s\S]*?\[SUMMARY_END\]/g, '').trim();
            const practiceQuestions = parsePractice(response);
            const summarySheet = parseSummary(response);
            setChatMessages(prev => [...prev, { role: 'tutor', content, practiceQuestions, summarySheet }]);
            recordStudyAndGetStreak().catch(() => {});
        } catch { toast({ title: 'Send failed', variant: 'destructive' }); }
        finally { setIsGenerating(false); }
    };

    const handleSave = async () => {
        if (!chatMessages.length) return;
        const conversationText = chatMessages.map(m => `${m.role === 'student' ? 'Student' : 'Tutor'}: ${m.content}`).join('\n\n');
        const data = { tool_type: "math_tutor", title: saveTitle || "Math Session", subject_name: SUBJECTS[selectedSubject].name, topic: selectedSubject, content: conversationText, input_data: { subject: selectedSubject, topic: selectedTopic, isTechFree, messages: chatMessages }, date_created: new Date().toISOString().split('T')[0] };
        if (loadedResultId) await base44.entities.AISavedResult.update(loadedResultId, data);
        else await base44.entities.AISavedResult.create(data);
        toast({ title: 'Saved!' }); setIsSaveDialogOpen(false); setSaveTitle(''); setChatMessages([]); setLoadedResultId(null); await loadHistory();
    };

    const resetChat = () => { setChatMessages([]); setChatInput(''); setUploadedImage(null); setLoadedResultId(null); };

    const subject = SUBJECTS[selectedSubject];

    return (
        <div className={`space-y-4 ${isFullscreen ? 'fixed inset-0 z-50 bg-white p-4 overflow-auto' : 'max-w-3xl'}`}>
            {isGenerating && !isFullscreen && <AILoadingProgress stage="generating" message="AI Math Tutor is solving..." estimatedTime={25} />}

            {/* Subject selector */}
            <div className="grid grid-cols-4 gap-2">
                {Object.entries(SUBJECTS).map(([key, s]) => (
                    <button key={key} onClick={() => { if (chatMessages.length > 0 && key !== selectedSubject) { if (!window.confirm('Start new subject? Current chat will be lost.')) return; resetChat(); } setSelectedSubject(key); setSelectedTopic(''); }}
                        className={`p-2.5 rounded-xl border-2 text-xs font-bold transition-all text-center ${selectedSubject === key ? `border-transparent bg-gradient-to-r ${s.color} text-white shadow-lg` : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'}`}>
                        {key === 'foundation' ? 'Foundation' : key === 'general' ? 'General' : key === 'methods' ? 'Methods' : 'Specialist'}
                    </button>
                ))}
            </div>

            {/* Settings */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-4 py-3 flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Topic</label>
                    <Select value={selectedTopic} onValueChange={setSelectedTopic}>
                        <SelectTrigger className="h-8 w-40 text-xs border-gray-200 bg-gray-50"><SelectValue placeholder="All topics" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value={null}>All Topics</SelectItem>
                            {subject.topics.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                    <span className={`text-xs font-bold ${isTechFree ? 'text-red-600' : 'text-gray-400'}`}>Tech-Free</span>
                    <Switch checked={!isTechFree} onCheckedChange={c => setIsTechFree(!c)} />
                    <span className={`text-xs font-bold ${!isTechFree ? 'text-green-600' : 'text-gray-400'}`}>CAS</span>
                </div>
                <div className="flex gap-2">
                    {chatMessages.length > 0 && <Button size="sm" variant="outline" onClick={() => { setSaveTitle(chatMessages[0]?.content?.slice(0, 50) || 'Math Session'); setIsSaveDialogOpen(true); }} className="h-8 text-xs border-green-200 text-green-700 hover:bg-green-50"><Save className="w-3 h-3 mr-1" />Save</Button>}
                    <Button size="sm" variant="outline" onClick={() => setIsHistoryOpen(true)} className="h-8 text-xs"><History className="w-3 h-3" /></Button>
                    <Button size="sm" variant="outline" onClick={() => setIsFullscreen(!isFullscreen)} className="h-8 text-xs">{isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}</Button>
                </div>
            </div>

            {/* Chat */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className={`flex flex-col px-4 py-2 border-b border-gray-100 bg-gradient-to-r ${subject.color} text-white`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Calculator className="w-4 h-4" />
                            <span className="font-bold text-sm">{subject.name}</span>
                            {selectedTopic && <Badge className="bg-white/20 text-white border-0 text-xs">{selectedTopic}</Badge>}
                        </div>
                        <Badge className={`${isTechFree ? 'bg-red-500/30' : 'bg-green-500/30'} text-white border-0 text-xs`}>{isTechFree ? 'TECH-FREE' : 'CAS'}</Badge>
                    </div>
                </div>

                <div className={`overflow-y-auto space-y-4 p-4 bg-gray-50 ${isFullscreen ? 'flex-1' : 'max-h-[460px]'}`}>
                    {chatMessages.length === 0 ? (
                        <div className="text-center py-12">
                            <div className={`w-14 h-14 bg-gradient-to-br ${subject.color} rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg`}>
                                <Calculator className="w-7 h-7 text-white" />
                            </div>
                            <h3 className="font-bold text-gray-900 text-base mb-1">Start Your VCE Math Session</h3>
                            <p className="text-sm text-gray-500 max-w-xs mx-auto mb-4">Ask any {subject.name} question. Get exam-standard solutions with full working.</p>
                            <div className="flex flex-wrap gap-2 justify-center">
                                {['Step-by-step solutions', 'VCE exam format', 'Practice questions', isTechFree ? 'Manual working' : 'CAS strategies'].map(t => (
                                    <Badge key={t} variant="outline" className="text-xs bg-white">{t}</Badge>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <>
                            {chatMessages.map((msg, idx) => (
                                <motion.div key={idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                                    <div className={`flex ${msg.role === 'student' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${msg.role === 'student' ? `bg-gradient-to-r ${subject.color} text-white` : 'bg-white border border-gray-200 shadow-sm'}`}>
                                            {msg.image && <img src={msg.image} alt="Q" className="max-w-xs rounded-xl mb-3 border" />}
                                            {msg.role === 'tutor' ? (
                                                <div className="text-sm leading-relaxed space-y-2">
                                                    {msg.content.split('\n\n').map((para, i) => {
                                                        const headerMatch = para.match(/^\*\*(.*?)\*\*$/);
                                                        if (headerMatch) return <div key={i} className="mt-4 mb-1 pb-1.5 border-b-2 border-violet-100"><p className="text-sm font-bold text-violet-900">{headerMatch[1]}</p></div>;
                                                        return <div key={i} className="leading-relaxed">{renderLatex(para)}</div>;
                                                    })}
                                                </div>
                                            ) : (
                                                <p className="text-sm whitespace-pre-wrap font-medium">{msg.content}</p>
                                            )}
                                        </div>
                                    </div>

                                    {msg.role === 'tutor' && msg.summarySheet && (
                                        <div className="flex justify-start">
                                            <div className="max-w-[90%] bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden shadow-sm">
                                                <div className="flex items-center justify-between bg-amber-500 px-4 py-2">
                                                    <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-white" /><span className="font-bold text-white text-sm">Summary Sheet</span></div>
                                                    <button onClick={() => { const w = window.open('', '_blank'); w.document.write(`<html><head><title>Summary</title></head><body>${msg.summarySheet}</body></html>`); w.document.close(); setTimeout(() => w.print(), 500); }} className="px-3 py-1 bg-white text-amber-700 rounded-lg text-xs font-semibold hover:bg-amber-50 flex items-center gap-1"><Printer className="w-3 h-3" />Print</button>
                                                </div>
                                                <div className="p-3 max-h-64 overflow-y-auto text-sm space-y-1">{renderLatex(msg.summarySheet)}</div>
                                            </div>
                                        </div>
                                    )}

                                    {msg.role === 'tutor' && msg.practiceQuestions?.length > 0 && (
                                        <div className="flex justify-start">
                                            <div className="max-w-[90%] space-y-2">
                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide ml-1">Practice Questions</p>
                                                {msg.practiceQuestions.map((q, qi) => (
                                                    <motion.button key={qi} whileHover={{ x: 4 }} onClick={() => setChatInput(q)}
                                                        className="w-full text-left px-4 py-3 bg-white hover:bg-violet-50 border-2 border-gray-200 hover:border-violet-300 rounded-xl text-sm transition-all shadow-sm">
                                                        <div className="flex items-start gap-3">
                                                            <span className="flex-shrink-0 w-6 h-6 bg-violet-100 text-violet-700 rounded-lg flex items-center justify-center text-xs font-black">{qi + 1}</span>
                                                            <div className="flex-1 leading-relaxed text-gray-800">{renderLatex(q)}</div>
                                                        </div>
                                                    </motion.button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                            {isGenerating && (
                                <div className="flex justify-start">
                                    <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 flex items-center gap-2 shadow-sm">
                                        <div className="flex gap-1">{[0,1,2].map(i => <motion.div key={i} className="w-2 h-2 bg-violet-400 rounded-full" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />)}</div>
                                        <span className="text-xs text-gray-400">Solving...</span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </>
                    )}
                </div>

                {/* Input */}
                <div className="border-t border-gray-200 p-3 bg-white">
                    {uploadedImage && (
                        <div className="relative inline-block mb-2">
                            <img src={uploadedImage} alt="Upload" className="max-h-20 rounded-xl border" />
                            <button onClick={() => setUploadedImage(null)} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"><X className="w-3 h-3" /></button>
                        </div>
                    )}
                    <div className="flex gap-2">
                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isGenerating} className="h-10 w-10 p-0 flex-shrink-0"><Upload className="w-4 h-4" /></Button>
                        <Textarea value={chatInput} onChange={e => setChatInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                            placeholder={`Ask your ${subject.name} question... (Enter to send, Shift+Enter for new line)`}
                            rows={2} disabled={isGenerating} className="flex-1 resize-none border-gray-200 focus:border-violet-400 text-sm" />
                        <Button onClick={handleSend} disabled={isGenerating || (!chatInput.trim() && !uploadedImage)}
                            className={`bg-gradient-to-r ${subject.color} hover:opacity-90 flex-shrink-0 h-10 w-10 p-0`}>
                            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </Button>
                    </div>
                </div>
            </div>

            {/* History Dialog */}
            <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                <DialogContent className="max-w-2xl max-h-[70vh] overflow-y-auto">
                    <DialogHeader><DialogTitle className="flex items-center gap-2"><History className="w-5 h-5 text-violet-600" />Math Tutor History</DialogTitle></DialogHeader>
                    <div className="space-y-2">
                        {savedResults.filter(r => r.topic === selectedSubject).length === 0 ? (
                            <p className="text-center text-gray-400 py-8">No saved sessions for this subject</p>
                        ) : savedResults.filter(r => r.topic === selectedSubject).map(r => (
                            <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-800 truncate">{r.title}</p>
                                    <p className="text-xs text-gray-400">{r.subject_name} • {r.date_created}</p>
                                </div>
                                <div className="flex gap-1.5 ml-2">
                                    <Button size="sm" onClick={() => { if (r.input_data?.messages) { setChatMessages(r.input_data.messages); if (r.input_data.subject) setSelectedSubject(r.input_data.subject); if (r.input_data.topic) setSelectedTopic(r.input_data.topic); if (r.input_data.isTechFree !== undefined) setIsTechFree(r.input_data.isTechFree); setLoadedResultId(r.id); setIsHistoryOpen(false); toast({ title: 'Session loaded!', description: 'Progress will autosave.' }); } }} className="h-7 text-xs bg-violet-600 hover:bg-violet-700">
                                        <Play className="w-3 h-3 mr-1" />Resume
                                    </Button>
                                    <button onClick={() => setViewingResult(r)} className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg"><Eye className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => base44.entities.AISavedResult.delete(r.id).then(loadHistory)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Save Session</DialogTitle></DialogHeader>
                    <Input value={saveTitle} onChange={e => setSaveTitle(e.target.value)} placeholder="Session title..." />
                    <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} className="bg-violet-600 hover:bg-violet-700">Save & Exit</Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={!!viewingResult} onOpenChange={() => setViewingResult(null)}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>{viewingResult?.title}</DialogTitle></DialogHeader>
                    <div className="text-sm whitespace-pre-wrap text-gray-700">{viewingResult?.content}</div>
                </DialogContent>
            </Dialog>
        </div>
    );
}