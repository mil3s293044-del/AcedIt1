import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Send, Upload, X, History, Eye, Trash2, FileText, Printer, Play, Save, Maximize2, Minimize2, Square, Plus, Sigma } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { recordStudyAndGetStreak } from "@/components/shared/streakHelpers";
import MarkdownMath from "@/components/shared/MarkdownMath";
import MathText from "@/components/shared/LatexRenderer";
import { getExaminerPrompt } from "@/lib/subjectExaminerPrompts";
import { invokeLLMStream } from "@/lib/streamingAI";
import useStickToBottom from "@/lib/useStickToBottom";

// Each subject gets one design-system token (no rainbow gradients).
// `accentText`/`accentBg`/`accentSolid` map to the same color family for the
// selected button, chat header bar, and student message bubble.
const SUBJECTS = {
    foundation: { name: "Foundation Mathematics", accentText: "text-chart-3", accentBg: "bg-chart-3/10", accentSolid: "bg-chart-3", topics: ["Number & Algebra", "Data & Statistics", "Measurement", "Space & Shape"] },
    general:    { name: "General Mathematics",    accentText: "text-primary", accentBg: "bg-primary/10", accentSolid: "bg-primary", topics: ["Algebra & Functions", "Discrete Mathematics", "Data Analysis", "Recursion & Financial Modelling"] },
    methods:    { name: "Mathematical Methods",   accentText: "text-chart-4", accentBg: "bg-chart-4/10", accentSolid: "bg-chart-4", topics: ["Functions", "Calculus", "Algebra", "Probability & Statistics"] },
    specialist: { name: "Specialist Mathematics", accentText: "text-streak",  accentBg: "bg-streak/10",  accentSolid: "bg-streak",  topics: ["Functions & Graphs", "Vectors", "Calculus", "Mechanics", "Complex Numbers"] }
};

const getPrompt = (subject, topic, isTechFree) => `${getExaminerPrompt(subject)}

You are an expert VCE ${subject} examiner and tutor. Calculator: ${isTechFree ? 'TECH-FREE (show ALL hand working)' : 'CAS ACTIVE (guide calculator use)'}.${topic ? ` Topic: ${topic}.` : ''}

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
    // Stick-to-bottom scroll inside the chat container only — replaces the
    // old scrollIntoView pattern that walked up to the document and scrolled
    // the whole PAGE during streaming.
    const { containerRef: chatContainerRef } = useStickToBottom([chatMessages]);
    const autoSaveRef = useRef(null);
    const abortRef = useRef(null);
    const { toast } = useToast();

    useEffect(() => {
        loadHistory();
    }, []);

    // Old scrollIntoView pattern removed — useStickToBottom (above) handles
    // scrolling inside the chat container without dragging the whole page.

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
        // Push the student message + an empty tutor placeholder so the bubble
        // appears immediately and tokens stream into it.
        setChatMessages(prev => [...prev, userMsg, { role: 'tutor', content: '', streaming: true }]);
        setChatInput(''); setUploadedImage(null); setIsGenerating(true);

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            const recentChat = chatMessages.slice(-6).map(m => `${m.role === 'student' ? 'Student' : 'Tutor'}: ${m.content}`).join('\n\n');
            const prompt = getPrompt(SUBJECTS[selectedSubject].name, selectedTopic, isTechFree);
            const fullPrompt = `${prompt}\n\n${recentChat ? `Previous conversation:\n${recentChat}\n\n` : ''}Student's Question: ${userMsg.content}`;

            const stripMarkers = (text) => text
                .replace(/\[PRACTICE_START\][\s\S]*?\[PRACTICE_END\]/g, '')
                .replace(/\[SUMMARY_START\][\s\S]*?\[SUMMARY_END\]/g, '')
                .trim();

            await invokeLLMStream(
                {
                    feature: "ai_chat",
                    prompt: fullPrompt,
                    file_urls: userMsg.image ? [userMsg.image] : undefined,
                },
                (_delta, soFar) => {
                    // Replace the placeholder's content as text streams in
                    setChatMessages(prev => {
                        const next = [...prev];
                        const last = next[next.length - 1];
                        if (last?.role === 'tutor') {
                            next[next.length - 1] = { ...last, content: stripMarkers(soFar), streaming: true };
                        }
                        return next;
                    });
                },
                { signal: controller.signal }
            );

            // Final pass once the stream completes — extract practice + summary
            setChatMessages(prev => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === 'tutor') {
                    const fullText = (last.content || '');
                    next[next.length - 1] = {
                        role: 'tutor',
                        content: stripMarkers(fullText),
                        practiceQuestions: parsePractice(fullText),
                        summarySheet: parseSummary(fullText),
                        streaming: false,
                    };
                }
                return next;
            });

            recordStudyAndGetStreak().catch(() => {});
        } catch (err) {
            if (err?.name === 'AbortError') {
                // User clicked Stop — keep whatever streamed in, mark as not streaming
                setChatMessages(prev => {
                    const next = [...prev];
                    const last = next[next.length - 1];
                    if (last?.role === 'tutor') {
                        next[next.length - 1] = { ...last, streaming: false, stopped: true };
                    }
                    return next;
                });
            } else {
                toast({ title: 'Send failed', description: err?.message, variant: 'destructive' });
                // Drop the empty tutor placeholder on real failure
                setChatMessages(prev => prev[prev.length - 1]?.role === 'tutor' && !prev[prev.length - 1].content ? prev.slice(0, -1) : prev);
            }
        } finally {
            setIsGenerating(false);
            abortRef.current = null;
        }
    };

    const handleStop = () => {
        abortRef.current?.abort();
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

    // True when the tutor is generating BUT no tokens have arrived yet —
    // shows the bouncing dots only during initial wait, then hides them as
    // streamed text starts replacing the placeholder.
    const lastMsg = chatMessages[chatMessages.length - 1];
    const showTypingDots = isGenerating && lastMsg?.role === 'tutor' && !lastMsg?.content;

    return (
        <div className={`flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-background p-4' : 'h-[calc(100vh-220px)] min-h-[520px]'}`}>
            {/* Compact control bar — subject + topic condensed into dropdowns */}
            <div className="flex items-center gap-2 flex-wrap flex-shrink-0 pb-3">
                <Select value={selectedSubject} onValueChange={(key) => { if (chatMessages.length > 0 && key !== selectedSubject) { if (!window.confirm('Start a new subject? The current chat will be cleared.')) return; resetChat(); } setSelectedSubject(key); setSelectedTopic(''); }}>
                    <SelectTrigger className="h-9 w-[185px] text-xs font-bold rounded-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {Object.entries(SUBJECTS).map(([key, s]) => <SelectItem key={key} value={key} className="text-xs">{s.name}</SelectItem>)}
                    </SelectContent>
                </Select>

                <Select value={selectedTopic} onValueChange={setSelectedTopic}>
                    <SelectTrigger className="h-9 w-[150px] text-xs rounded-full"><SelectValue placeholder="All topics" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value={null}>All topics</SelectItem>
                        {subject.topics.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
                    </SelectContent>
                </Select>

                <div className="flex items-center gap-2 h-9 px-3 rounded-full border border-border bg-surface">
                    <span className={`text-xs font-bold ${isTechFree ? 'text-streak' : 'text-muted-foreground/60'}`}>Tech-Free</span>
                    <Switch checked={!isTechFree} onCheckedChange={c => setIsTechFree(!c)} />
                    <span className={`text-xs font-bold ${!isTechFree ? 'text-primary' : 'text-muted-foreground/60'}`}>CAS</span>
                </div>

                <div className="flex items-center gap-1.5 ml-auto">
                    {chatMessages.length > 0 && <Button size="sm" variant="ghost" onClick={resetChat} disabled={isGenerating} className="h-9 px-2.5 text-xs text-muted-foreground"><Plus className="w-3.5 h-3.5 mr-1" />New</Button>}
                    {chatMessages.length > 0 && <Button size="sm" variant="outline" disabled={isGenerating} onClick={() => { setSaveTitle(chatMessages[0]?.content?.slice(0, 50) || 'Math Session'); setIsSaveDialogOpen(true); }} className="h-9 w-9 p-0" title="Save session"><Save className="w-4 h-4" /></Button>}
                    <Button size="sm" variant="outline" onClick={() => setIsHistoryOpen(true)} className="h-9 w-9 p-0" title="History"><History className="w-4 h-4" /></Button>
                    <Button size="sm" variant="outline" onClick={() => setIsFullscreen(!isFullscreen)} className="h-9 w-9 p-0" title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>{isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}</Button>
                </div>
            </div>

            {/* Conversation — Claude-style: avatar + flowing answer, user bubbles right */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto w-full px-1 py-2">
                    {chatMessages.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                                <Sigma className="w-7 h-7 text-primary" />
                            </div>
                            <h3 className="font-display font-extrabold text-foreground text-xl mb-1.5">Start your {subject.name} session</h3>
                            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">Ask any question — get exam-standard working with full LaTeX formatting.</p>
                            <div className="flex flex-wrap gap-2 justify-center">
                                {['Step-by-step solutions', 'VCE exam format', 'Practice questions', isTechFree ? 'Manual working' : 'CAS strategies'].map(t => (
                                    <span key={t} className="pill bg-secondary text-muted-foreground">{t}</span>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {chatMessages.map((msg, idx) => (
                                <motion.div key={idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                                    {msg.role === 'student' ? (
                                        <div className="flex justify-end">
                                            <div className="max-w-[80%] rounded-2xl rounded-br-md bg-secondary px-4 py-2.5">
                                                {msg.image && <img src={msg.image} alt="Q" className="max-w-xs rounded-xl mb-2 border border-border" />}
                                                <MathText className="text-sm whitespace-pre-wrap text-foreground">{msg.content}</MathText>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex gap-3">
                                            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                <Sigma className="w-4 h-4 text-primary" />
                                            </div>
                                            <div className="flex-1 min-w-0 space-y-3 pt-0.5">
                                                <MarkdownMath className="text-sm leading-relaxed text-foreground" isStreaming={!!msg.streaming}>{msg.content}</MarkdownMath>

                                                {msg.summarySheet && (
                                                    <div className="rounded-xl border border-xp/30 bg-xp/5 overflow-hidden">
                                                        <div className="flex items-center justify-between bg-xp/15 px-4 py-2">
                                                            <div className="flex items-center gap-2">
                                                                <FileText className="w-4 h-4 text-xp" />
                                                                <span className="font-bold text-foreground text-sm">Summary Sheet</span>
                                                            </div>
                                                            <button onClick={() => { const w = window.open('', '_blank'); w.document.write(`<html><head><title>Summary</title></head><body>${msg.summarySheet}</body></html>`); w.document.close(); setTimeout(() => w.print(), 500); }} className="px-3 py-1 bg-surface text-xp rounded-lg text-xs font-semibold hover:bg-xp/10 flex items-center gap-1 border border-xp/30">
                                                                <Printer className="w-3 h-3" /> Print
                                                            </button>
                                                        </div>
                                                        <div className="p-3 max-h-64 overflow-y-auto text-sm space-y-1 text-foreground"><MarkdownMath>{msg.summarySheet}</MarkdownMath></div>
                                                    </div>
                                                )}

                                                {msg.practiceQuestions?.length > 0 && (
                                                    <div className="space-y-2">
                                                        <p className="stat-label ml-0.5">Practice Questions</p>
                                                        {msg.practiceQuestions.map((q, qi) => (
                                                            <motion.button
                                                                key={qi}
                                                                whileHover={{ x: 3 }}
                                                                onClick={() => setChatInput(q)}
                                                                className="w-full text-left px-4 py-3 bg-surface hover:bg-primary/5 border border-border hover:border-primary/40 rounded-xl text-sm transition-all"
                                                            >
                                                                <div className="flex items-start gap-3">
                                                                    <span className="flex-shrink-0 w-6 h-6 bg-primary/10 text-primary rounded-lg flex items-center justify-center text-xs font-black">{qi + 1}</span>
                                                                    <div className="flex-1 leading-relaxed text-foreground"><MathText>{q}</MathText></div>
                                                                </div>
                                                            </motion.button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                            {showTypingDots && (
                                <div className="flex gap-3">
                                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                        <Sigma className="w-4 h-4 text-primary" />
                                    </div>
                                    <div className="flex items-center gap-1 pt-2.5">
                                        {[0,1,2].map(i => <motion.div key={i} className="w-2 h-2 bg-primary rounded-full" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />)}
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>
            </div>

            {/* Composer — single rounded container, Claude-style */}
            <div className="flex-shrink-0 pt-3">
                <div className="max-w-3xl mx-auto w-full">
                    <div className="rounded-2xl border border-border bg-surface shadow-soft focus-within:border-primary/50 transition-colors overflow-hidden">
                        {uploadedImage && (
                            <div className="relative inline-block m-3 mb-0">
                                <img src={uploadedImage} alt="Upload" className="max-h-24 rounded-xl border border-border" />
                                <button onClick={() => setUploadedImage(null)} className="absolute -top-2 -right-2 w-5 h-5 bg-streak text-white rounded-full flex items-center justify-center"><X className="w-3 h-3" /></button>
                            </div>
                        )}
                        <Textarea value={chatInput} onChange={e => setChatInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                            placeholder={`Ask your ${subject.name} question…`}
                            rows={1} disabled={isGenerating}
                            className="min-h-[48px] max-h-40 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 text-sm px-4 pt-3.5" />
                        <div className="flex items-center justify-between px-2.5 pb-2.5">
                            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                            <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isGenerating} className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" title="Attach image"><Upload className="w-4 h-4" /></Button>
                            {isGenerating ? (
                                <Button onClick={handleStop} variant="destructive" className="h-8 w-8 p-0 rounded-full" title="Stop generating"><Square className="w-3.5 h-3.5" /></Button>
                            ) : (
                                <Button onClick={handleSend} disabled={!chatInput.trim() && !uploadedImage} className="h-8 w-8 p-0 rounded-full" title="Send"><Send className="w-4 h-4" /></Button>
                            )}
                        </div>
                    </div>
                    <p className="text-[11px] text-center text-muted-foreground mt-1.5">Enter to send · Shift+Enter for new line · {isTechFree ? 'Tech-Free mode' : 'CAS mode'}</p>
                </div>
            </div>

            {/* History Dialog */}
            <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                <DialogContent className="max-w-2xl max-h-[70vh] overflow-y-auto">
                    <DialogHeader><DialogTitle className="flex items-center gap-2"><History className="w-5 h-5 text-primary" />Math Tutor History</DialogTitle></DialogHeader>
                    <div className="space-y-2">
                        {savedResults.filter(r => r.topic === selectedSubject).length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">No saved sessions for this subject</p>
                        ) : savedResults.filter(r => r.topic === selectedSubject).map(r => (
                            <div key={r.id} className="flex items-center justify-between p-3 bg-secondary rounded-xl">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-foreground truncate">{r.title}</p>
                                    <p className="text-xs text-muted-foreground">{r.subject_name} • {r.date_created}</p>
                                </div>
                                <div className="flex gap-1.5 ml-2">
                                    <Button size="sm" onClick={() => { if (r.input_data?.messages) { setChatMessages(r.input_data.messages); if (r.input_data.subject) setSelectedSubject(r.input_data.subject); if (r.input_data.topic) setSelectedTopic(r.input_data.topic); if (r.input_data.isTechFree !== undefined) setIsTechFree(r.input_data.isTechFree); setLoadedResultId(r.id); setIsHistoryOpen(false); toast({ title: 'Session loaded!', description: 'Progress will autosave.' }); } }} className="h-7 text-xs bg-primary hover:bg-primary">
                                        <Play className="w-3 h-3 mr-1" />Resume
                                    </Button>
                                    <button onClick={() => setViewingResult(r)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg"><Eye className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => base44.entities.AISavedResult.delete(r.id).then(loadHistory)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
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
                        <Button onClick={handleSave} className="bg-primary hover:bg-primary">Save & Exit</Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={!!viewingResult} onOpenChange={() => setViewingResult(null)}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>{viewingResult?.title}</DialogTitle></DialogHeader>
                    <div className="text-sm text-foreground"><MarkdownMath>{viewingResult?.content || ''}</MarkdownMath></div>
                </DialogContent>
            </Dialog>
        </div>
    );
}