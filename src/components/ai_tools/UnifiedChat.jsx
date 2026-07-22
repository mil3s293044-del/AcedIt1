/**
 * UnifiedChat — the AI tools as one chatbot. Claude/ChatGPT layout: past
 * conversations in the left rail foldered by tool, a streaming markdown
 * thread, and a composer where the student picks the tool (persona) and
 * subject before sending. Conversations persist to AISavedResult
 * (input_data.messages) and reopen to continue. Every send carries the
 * tool's feature tag, so all tier caps apply unchanged.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Plus, Send, Square, Trash2, ChevronDown, ChevronRight, Paperclip,
    Loader2, History, X, MessageSquare
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { invokeLLMStream } from "@/lib/streamingAI";
import { useToast } from "@/components/ui/use-toast";
import { recordStudyAndGetStreak } from "@/components/shared/streakHelpers";
import MarkdownMath from "@/components/shared/MarkdownMath";
import { format } from "date-fns";
import { CHAT_TOOLS, toolById, defaultOptions, resolveChoices } from "./chatTools";

const MAX_TURNS_IN_PROMPT = 12;

function agoLabel(iso) {
    if (!iso) return "";
    const days = Math.floor((Date.now() - new Date(iso)) / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    return format(new Date(iso), "d MMM");
}

function buildPrompt(tool, subjectName, toolOptions, messages, userText) {
    const transcript = messages.slice(-MAX_TURNS_IN_PROMPT)
        .map(m => `${m.role === "user" ? "Student" : "You"}: ${m.content}`)
        .join("\n\n");
    return `${tool.system(subjectName, toolOptions)}

${transcript ? `CONVERSATION SO FAR:\n${transcript}\n\n` : ""}Student: ${userText}

Respond as the ${tool.label} directly to the student. Markdown formatting.`;
}

export default function UnifiedChat() {
    const { toast } = useToast();
    const [user, setUser] = useState(null);
    const [subjects, setSubjects] = useState([]);
    const [conversations, setConversations] = useState([]);
    const [openFolders, setOpenFolders] = useState({});
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const [activeConvId, setActiveConvId] = useState(null);
    const [activeTool, setActiveTool] = useState(CHAT_TOOLS[0].id);
    const [toolOptions, setToolOptions] = useState(() => defaultOptions(CHAT_TOOLS[0]));
    const [subjectName, setSubjectName] = useState("");
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [attachment, setAttachment] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [streaming, setStreaming] = useState(false);

    const abortRef = useRef(null);
    const endRef = useRef(null);
    const fileRef = useRef(null);
    const convIdRef = useRef(null);

    useEffect(() => {
        base44.auth.me().then(async (u) => {
            setUser(u);
            if (!u?.email) return;
            const [subs, convs] = await Promise.all([
                base44.entities.UserSubject.filter({ created_by: u.email, is_active: true }).catch(() => []),
                base44.entities.AISavedResult.filter({ created_by: u.email }, "-created_date", 120).catch(() => []),
            ]);
            const seen = new Set();
            setSubjects((subs || []).filter(s => !seen.has(s.subject_name) && seen.add(s.subject_name)));
            // Only chat-format rows join the sidebar (legacy saved results
            // live on the History page).
            setConversations((convs || []).filter(c => Array.isArray(c.input_data?.messages) && c.input_data.messages.length));
        }).catch(() => {});
    }, []);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, [messages]);

    const tool = toolById(activeTool);
    const toolLocked = messages.length > 0;

    const selectTool = (id) => {
        if (toolLocked && id !== activeTool) {
            toast({ title: "This chat belongs to " + tool.label, description: "Start a New chat to use a different tool — it keeps each conversation focused." });
            return;
        }
        if (id !== activeTool) {
            setActiveTool(id);
            setToolOptions(defaultOptions(toolById(id)));
        }
    };

    const newChat = () => {
        abortRef.current?.abort();
        setActiveConvId(null); convIdRef.current = null;
        setMessages([]); setInput(""); setAttachment(null); setStreaming(false);
        setToolOptions(defaultOptions(tool));
        setSidebarOpen(false);
    };

    const openConversation = (conv) => {
        abortRef.current?.abort();
        setActiveConvId(conv.id); convIdRef.current = conv.id;
        setActiveTool(conv.tool_type && CHAT_TOOLS.some(t => t.id === conv.tool_type) ? conv.tool_type : CHAT_TOOLS[0].id);
        setSubjectName(conv.input_data?.subject || "");
        const t = toolById(conv.tool_type);
        setToolOptions({ ...defaultOptions(t), ...(conv.input_data?.options || {}) });
        setMessages(conv.input_data.messages);
        setStreaming(false); setSidebarOpen(false);
    };

    const deleteConversation = async (conv) => {
        try {
            await base44.entities.AISavedResult.delete(conv.id);
            setConversations(prev => prev.filter(c => c.id !== conv.id));
            if (conv.id === activeConvId) newChat();
        } catch { toast({ title: "Couldn't delete", variant: "destructive" }); }
    };

    const optsRef = useRef({});
    const persist = useCallback(async (finalMessages, usedTool, usedSubject) => {
        if (!user?.email) return;
        const flat = finalMessages.map(m => `${m.role === "user" ? "Student" : "AI"}: ${m.content}`).join("\n\n");
        const payload = {
            tool_type: usedTool.id,
            title: (finalMessages[0]?.content || "Chat").slice(0, 60),
            subject_name: usedSubject || null,
            content: flat.slice(0, 20000),
            input_data: { tool: usedTool.id, subject: usedSubject || null, options: optsRef.current, messages: finalMessages },
            date_created: new Date().toISOString().split("T")[0],
        };
        try {
            if (convIdRef.current) {
                await base44.entities.AISavedResult.update(convIdRef.current, payload);
                setConversations(prev => prev.map(c => c.id === convIdRef.current ? { ...c, ...payload } : c));
            } else {
                const created = await base44.entities.AISavedResult.create(payload);
                if (created?.id) {
                    convIdRef.current = created.id;
                    setActiveConvId(created.id);
                    setConversations(prev => [{ ...payload, id: created.id, created_date: new Date().toISOString() }, ...prev]);
                }
            }
        } catch (e) { console.error("Chat persist failed:", e); }
    }, [user]);

    const attachFile = async (file) => {
        if (!file) return;
        setUploading(true);
        try {
            const r = await base44.integrations.Core.UploadFile({ file });
            setAttachment({ url: r.file_url, name: file.name });
        } catch (e) {
            toast({ title: "Upload failed", description: e.message, variant: "destructive" });
        } finally { setUploading(false); }
    };

    const send = async () => {
        const text = input.trim();
        if (!text || streaming) return;
        const usedTool = tool;
        const usedSubject = subjectName;
        const usedOptions = toolOptions;
        const fileUrl = attachment?.url;
        setInput(""); setAttachment(null);

        const userMsg = { role: "user", content: fileUrl ? `${text}\n\n[attached: ${attachment.name}]` : text };
        const history = messages;
        setMessages(prev => [...prev, userMsg, { role: "assistant", content: "", streaming: true }]);
        setStreaming(true);
        recordStudyAndGetStreak().catch(() => {});

        const controller = new AbortController();
        abortRef.current = controller;
        let finalText = "";
        try {
            await invokeLLMStream(
                {
                    feature: usedTool.feature,
                    prompt: buildPrompt(usedTool, usedSubject, usedOptions, history, text),
                    file_urls: fileUrl ? [fileUrl] : undefined,
                },
                (_d, soFar) => {
                    finalText = soFar;
                    setMessages(prev => {
                        const next = [...prev];
                        next[next.length - 1] = { role: "assistant", content: soFar, streaming: true };
                        return next;
                    });
                },
                { signal: controller.signal },
            );
        } catch (e) {
            if (e.name !== "AbortError") {
                toast({ title: "That one got away", description: e.message || "Try sending again.", variant: "destructive" });
            }
        }
        const finalMessages = [...history, userMsg, { role: "assistant", content: finalText || "…" }];
        setMessages(finalMessages);
        setStreaming(false);
        if (finalText) { optsRef.current = usedOptions; persist(finalMessages, usedTool, usedSubject); }
    };

    const stop = () => abortRef.current?.abort();

    // ── Sidebar content (shared desktop rail + mobile sheet) ────────────────
    const folders = CHAT_TOOLS
        .map(t => ({ tool: t, convs: conversations.filter(c => c.tool_type === t.id) }))
        .filter(f => f.convs.length > 0);

    const SidebarInner = (
        <div className="flex flex-col h-full">
            <Button onClick={newChat} className="w-full gap-1.5 mb-3 rounded-xl font-bold">
                <Plus className="w-4 h-4" /> New chat
            </Button>
            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                {folders.length === 0 && (
                    <p className="text-xs text-muted-foreground/60 text-center py-6 px-2">
                        Your chats will collect here, sorted by tool.
                    </p>
                )}
                {folders.map(({ tool: t, convs }) => {
                    const open = openFolders[t.id] !== false;
                    const Icon = t.icon;
                    return (
                        <div key={t.id}>
                            <button onClick={() => setOpenFolders(p => ({ ...p, [t.id]: !open }))}
                                className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide text-muted-foreground hover:bg-secondary/60 transition-colors">
                                {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                <Icon className={`w-3.5 h-3.5 ${t.accentText}`} />
                                {t.label}
                                <span className="ml-auto font-bold text-muted-foreground/50">{convs.length}</span>
                            </button>
                            {open && convs.map(c => (
                                <div key={c.id}
                                    className={`group flex items-center gap-1.5 rounded-lg pl-7 pr-1.5 py-1.5 cursor-pointer transition-colors ${
                                        c.id === activeConvId ? "bg-secondary" : "hover:bg-secondary/60"
                                    }`}
                                    onClick={() => openConversation(c)}>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-foreground truncate">{c.title || "Chat"}</p>
                                        <p className="text-[10px] text-muted-foreground/60">{agoLabel(c.created_date)}{c.subject_name ? ` · ${c.subject_name}` : ""}</p>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); deleteConversation(c); }} aria-label="Delete chat"
                                        className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground/40 hover:text-streak hover:bg-streak/10 transition-all flex-shrink-0">
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className="flex h-full min-h-0 gap-0 md:gap-3">
            {/* Desktop rail */}
            <aside className="hidden md:flex flex-col w-64 flex-shrink-0 card-soft p-3">
                {SidebarInner}
            </aside>

            {/* Mobile sheet */}
            <AnimatePresence>
                {sidebarOpen && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-foreground/40 md:hidden" onClick={() => setSidebarOpen(false)}>
                        <motion.div initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className="w-72 h-full bg-surface p-3 shadow-soft-lg" onClick={e => e.stopPropagation()}>
                            {SidebarInner}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Thread + composer */}
            <div className="flex-1 min-w-0 flex flex-col card-soft overflow-hidden">
                {/* Thread header */}
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
                    <button onClick={() => setSidebarOpen(true)} aria-label="Chat history"
                        className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary">
                        <History className="w-4 h-4" />
                    </button>
                    <tool.icon className={`w-4 h-4 ${tool.accentText}`} />
                    <p className="font-bold text-foreground text-sm truncate">{tool.label}</p>
                    {subjectName && <span className="pill bg-secondary text-muted-foreground hidden sm:inline-block">{subjectName}</span>}
                    {messages.length > 0 && (
                        <Button onClick={newChat} size="sm" variant="ghost" className="ml-auto text-xs gap-1 text-muted-foreground">
                            <Plus className="w-3.5 h-3.5" /> New
                        </Button>
                    )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center px-4">
                            <div className={`w-14 h-14 rounded-2xl ${tool.accentBg} flex items-center justify-center mb-3`}>
                                <tool.icon className={`w-7 h-7 ${tool.accentText}`} />
                            </div>
                            <h2 className="font-display font-extrabold text-foreground text-xl mb-1">{tool.label}</h2>
                            <p className="text-sm text-muted-foreground max-w-sm mb-6">{tool.blurb}</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full max-w-2xl">
                                {CHAT_TOOLS.map(t => {
                                    const Icon = t.icon;
                                    return (
                                        <button key={t.id} onClick={() => selectTool(t.id)}
                                            className={`flex flex-col items-start gap-1.5 rounded-xl border-2 p-3 text-left transition-all ${
                                                t.id === activeTool ? `${t.accentBg} border-current ${t.accentText}` : "bg-surface border-border hover:border-muted-foreground/40"
                                            }`}>
                                            <Icon className={`w-4 h-4 ${t.accentText}`} />
                                            <span className={`text-xs font-bold ${t.id === activeTool ? t.accentText : "text-foreground"}`}>{t.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        messages.map((m, i) => (
                            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                                {m.role === "user" ? (
                                    <div className={`max-w-[85%] sm:max-w-[70%] rounded-2xl rounded-br-md px-4 py-2.5 ${tool.accentSolid} text-white text-sm whitespace-pre-wrap`}>
                                        {m.content}
                                    </div>
                                ) : (
                                    <div className="max-w-[95%] sm:max-w-[85%] flex gap-2.5">
                                        <div className={`w-7 h-7 rounded-lg ${tool.accentBg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                                            <tool.icon className={`w-3.5 h-3.5 ${tool.accentText}`} />
                                        </div>
                                        <div className="min-w-0 text-sm text-foreground leading-relaxed prose-sm">
                                            {m.content
                                                ? <MarkdownMath isStreaming={!!m.streaming}>{m.content}</MarkdownMath>
                                                : <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking…</span>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                    <div ref={endRef} />
                </div>

                {/* Composer */}
                <div className="border-t border-border p-3 space-y-2">
                    {/* Tool chips — locked to one tool per conversation */}
                    <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                        {CHAT_TOOLS.map(t => {
                            const Icon = t.icon;
                            const selected = t.id === activeTool;
                            const locked = toolLocked && !selected;
                            return (
                                <button key={t.id} onClick={() => selectTool(t.id)}
                                    aria-disabled={locked}
                                    title={locked ? "Start a new chat to switch tools" : undefined}
                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border-2 whitespace-nowrap transition-all flex-shrink-0 ${
                                        selected ? `${t.accentSolid} border-transparent text-white shadow-soft` :
                                        locked ? "bg-surface border-border text-muted-foreground/40 cursor-not-allowed" :
                                        "bg-surface border-border text-muted-foreground hover:text-foreground"
                                    }`}>
                                    <Icon className="w-3.5 h-3.5" /> {t.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Per-tool options — the old sub-categories, as chips */}
                    {(tool.options || []).length > 0 && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                            {(tool.options || []).map(group => (
                                <div key={group.key} className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-black uppercase tracking-wide text-muted-foreground/60">{group.label}</span>
                                    {resolveChoices(group, toolOptions).map(c => (
                                        <button key={c.value}
                                            onClick={() => setToolOptions(prev => {
                                                const next = { ...prev, [group.key]: c.value };
                                                if (group.key === "section") next.focus = "general";
                                                return next;
                                            })}
                                            className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                                                toolOptions[group.key] === c.value
                                                    ? `${tool.accentBg} ${tool.accentText} border-current`
                                                    : "bg-surface border-border text-muted-foreground hover:text-foreground"
                                            }`}>
                                            {c.label}
                                        </button>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}

                    {attachment && (
                        <div className="inline-flex items-center gap-1.5 pill bg-secondary text-foreground">
                            <Paperclip className="w-3 h-3" /> {attachment.name}
                            <button onClick={() => setAttachment(null)} aria-label="Remove attachment"><X className="w-3 h-3" /></button>
                        </div>
                    )}

                    <div className="flex items-end gap-2">
                        <Select value={subjectName || "none"} onValueChange={(v) => setSubjectName(v === "none" ? "" : v)}>
                            <SelectTrigger className="w-32 sm:w-40 h-10 text-xs flex-shrink-0">
                                <SelectValue placeholder="Subject" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">No subject</SelectItem>
                                {subjects.map(s => <SelectItem key={s.id} value={s.subject_name}>{s.subject_name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        {tool.supportsFiles && (
                            <>
                                <input ref={fileRef} type="file" className="hidden" accept=".pdf,.docx,.pptx,.png,.jpg,.jpeg,.txt"
                                    onChange={e => attachFile(e.target.files?.[0])} />
                                <Button onClick={() => fileRef.current?.click()} disabled={uploading} variant="outline" size="icon"
                                    aria-label="Attach a file" className="h-10 w-10 rounded-xl border-2 flex-shrink-0">
                                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                                </Button>
                            </>
                        )}
                        <Textarea
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                            placeholder={`Message ${tool.label}…`}
                            rows={1}
                            className="flex-1 min-h-[40px] max-h-36 resize-none rounded-xl text-sm"
                        />
                        {streaming ? (
                            <Button onClick={stop} variant="outline" size="icon" aria-label="Stop generating"
                                className="h-10 w-10 rounded-xl border-2 border-streak/40 text-streak flex-shrink-0">
                                <Square className="w-4 h-4" />
                            </Button>
                        ) : (
                            <Button onClick={send} disabled={!input.trim()} size="icon" aria-label="Send message"
                                className="h-10 w-10 rounded-xl flex-shrink-0">
                                <Send className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                    <p className="text-[10px] text-muted-foreground/50 text-center flex items-center justify-center gap-1">
                        <MessageSquare className="w-3 h-3" /> Chats save automatically — daily AI limits apply per tool.
                    </p>
                </div>
            </div>
        </div>
    );
}
