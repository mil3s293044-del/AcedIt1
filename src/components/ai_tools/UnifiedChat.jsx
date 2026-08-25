/**
 * UnifiedChat — the AI tools as one chatbot. Claude/ChatGPT layout: past
 * conversations in the left rail foldered by tool, a streaming markdown
 * thread, and a composer where the student picks the tool (persona) and
 * subject before sending. Conversations persist to AISavedResult
 * (input_data.messages) and reopen to continue. Every send carries the
 * tool's feature tag, so all tier caps apply unchanged.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Plus, Send, Square, Trash2, ChevronDown, ChevronRight, Paperclip,
    Loader2, History, X, Archive, Wand2
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { saveResult, deleteResult, loadSavedResults } from "@/lib/saveResult";
import { invokeLLMStream } from "@/lib/streamingAI";
import { useToast } from "@/components/ui/use-toast";
import { recordStudyAndGetStreak } from "@/components/shared/streakHelpers";
import MarkdownMath from "@/components/shared/MarkdownMath";
import { CHAT_TOOLS, toolById, defaultOptions, resolveChoices } from "./chatTools";
import CheatSheetArtifact from "./CheatSheetArtifact";
import ExamQuestionsArtifact from "./ExamQuestionsArtifact";
import LineMemoriserArtifact from "./LineMemoriserArtifact";
import { actionById } from "./chatActions";
import { todaysIntent } from "@/lib/studyIntent";
import { fmtDate } from "@/lib/safeDate";

const MAX_TURNS_IN_PROMPT = 12;

function agoLabel(iso) {
    if (!iso) return "";
    const days = Math.floor((Date.now() - new Date(iso)) / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    return fmtDate(iso, "d MMM");
}

function buildPrompt(tool, subjectName, toolOptions, messages, userText, files) {
    const transcript = messages.slice(-MAX_TURNS_IN_PROMPT)
        .map(m => `${m.role === "user" ? "Student" : "You"}: ${m.content}`)
        .join("\n\n");
    // Without this block the model treats attachments as decoration — it must
    // be told the documents are present and to ground the answer in them.
    const fileBlock = files?.length
        ? `ATTACHED DOCUMENTS: The student has attached ${files.map(f => `"${f.name}"`).join(", ")}. The full content is provided to you alongside this message. Read the attached content carefully and base your answer on it together with what the student writes — quote or reference specific parts where useful.\n\n`
        : "";
    return `${tool.system(subjectName, toolOptions)}

${fileBlock}${transcript ? `CONVERSATION SO FAR:\n${transcript}\n\n` : ""}Student: ${userText}

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
    // Documents already sent in this conversation — re-attached to every
    // request so follow-up questions ("what does section 2 say?") still see
    // the document, not just the first message.
    const [convFiles, setConvFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [streaming, setStreaming] = useState(false);
    const [runningAction, setRunningAction] = useState(null);

    const abortRef = useRef(null);
    const endRef = useRef(null);
    const fileRef = useRef(null);
    const convIdRef = useRef(null);

    useEffect(() => {
        base44.auth.me().then(async (u) => {
            setUser(u);
            if (!u?.email) return;
            const [subs, convs, profiles] = await Promise.all([
                base44.entities.UserSubject.filter({ created_by: u.email, is_active: true }).catch(() => []),
                loadSavedResults(null, u.email).catch(() => []),
                base44.entities.UserProfile.filter({ created_by: u.email }).catch(() => []),
            ]);
            // Open on the tool that fits what they said today is for. Safe to
            // set unconditionally — this runs once on mount, before any saved
            // conversation has been opened.
            const intent = todaysIntent(profiles?.[0]);
            const wanted = intent && toolById(intent.plan.tool);
            if (wanted?.id === intent.plan.tool) {
                setActiveTool(wanted.id);
                setToolOptions(defaultOptions(wanted));
            }
            const seen = new Set();
            setSubjects((subs || []).filter(s => !seen.has(s.subject_name) && seen.add(s.subject_name)));
            // Only chat-format rows join the sidebar (legacy saved results
            // live on the History page). Merge DB + localStorage.
            const allConvs = (convs || []).filter(c => Array.isArray(c.input_data?.messages) && c.input_data.messages.length);
            // Dedupe by id (might have both DB and local copies)
            const deduped = [];
            const seenIds = new Set();
            for (const c of allConvs) {
                if (!seenIds.has(c.id)) { seenIds.add(c.id); deduped.push(c); }
            }
            setConversations(deduped);
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
        setMessages([]); setInput(""); setAttachment(null); setConvFiles([]); setStreaming(false);
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
        setConvFiles(conv.input_data?.files || []);
        setAttachment(null);
        setStreaming(false); setSidebarOpen(false);
    };

    const deleteConversation = async (conv) => {
        try {
            await deleteResult(conv.tool_type || 'ai_chat', conv.id);
            setConversations(prev => prev.filter(c => c.id !== conv.id));
            if (conv.id === activeConvId) newChat();
        } catch { toast({ title: "Couldn't delete", variant: "destructive" }); }
    };

    const optsRef = useRef({});
    const filesRef = useRef([]);
    const persist = useCallback(async (finalMessages, usedTool, usedSubject) => {
        if (!user?.email) return;
        const flat = finalMessages.map(m => `${m.role === "user" ? "Student" : "AI"}: ${m.content}`).join("\n\n");
        const payload = {
            tool_type: usedTool.id,
            title: (finalMessages[0]?.content || "Chat").slice(0, 60),
            subject_name: usedSubject || null,
            content: flat.slice(0, 20000),
            input_data: { tool: usedTool.id, subject: usedSubject || null, options: optsRef.current, files: filesRef.current, messages: finalMessages },
            date_created: new Date().toISOString().split("T")[0],
        };
        try {
            if (convIdRef.current) {
                const { ok } = await saveResult('update', payload, convIdRef.current);
                if (ok) setConversations(prev => prev.map(c => c.id === convIdRef.current ? { ...c, ...payload } : c));
            } else {
                const { ok, id } = await saveResult('create', payload);
                if (ok && id) {
                    convIdRef.current = id;
                    setActiveConvId(id);
                    setConversations(prev => [{ ...payload, id, created_date: new Date().toISOString() }, ...prev]);
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
        const pending = attachment;
        // A document on its own is a valid message — no typed text required.
        if ((!text && !pending) || streaming) return;
        const usedTool = tool;
        const usedSubject = subjectName;
        const usedOptions = toolOptions;
        // Every request carries ALL of this conversation's documents, so the
        // AI can keep answering questions about them on later turns.
        const files = pending ? [...convFiles, { url: pending.url, name: pending.name }] : convFiles;
        setInput(""); setAttachment(null);
        if (pending) setConvFiles(files);

        const promptText = text || `I've attached "${pending.name}". Please read it and help me with it.`;
        const userMsg = { role: "user", content: pending ? `${text ? `${text}\n\n` : ""}📎 ${pending.name}` : text };
        const history = messages;
        setMessages(prev => [...prev, userMsg, { role: "assistant", content: "", streaming: true }]);
        setStreaming(true);
        recordStudyAndGetStreak().catch(() => {});

        // ── Artifact path ────────────────────────────────────────────────────
        // Some tool options build a real thing (a printable cheat sheet) rather
        // than prose. Those go out as ONE non-streaming JSON call — streaming a
        // schema response just shows the student half-formed JSON.
        const artifactSpec = usedTool.artifact?.(usedSubject, usedOptions);
        if (artifactSpec) {
            let artifact = null, failure = null;
            try {
                const res = await base44.integrations.Core.InvokeLLM({
                    feature: usedTool.feature,
                    fast: true,
                    prompt: artifactSpec.prompt(promptText, files.map(f => f.name)),
                    file_urls: files.length ? files.map(f => f.url) : undefined,
                    response_json_schema: artifactSpec.schema,
                });
                const rows = res?.items || res?.questions || res?.lines;
                if (rows?.length) {
                    artifact = { kind: artifactSpec.kind, pages: artifactSpec.pages, title: res.title || "", data: rows };
                } else {
                    failure = "I couldn't pull enough out of that. Try clearer material, or tell me the topic directly.";
                }
            } catch (e) {
                failure = e?.message || "That one got away — try sending again.";
            }
            const msg = artifact
                ? { role: "assistant", content: artifact.title || artifactSpec.done || "", artifact }
                : { role: "assistant", content: failure };
            const done = [...history, userMsg, msg];
            setMessages(done);
            setStreaming(false);
            if (artifact) { optsRef.current = usedOptions; filesRef.current = files; persist(done, usedTool, usedSubject); }
            return;
        }

        const controller = new AbortController();
        abortRef.current = controller;
        let finalText = "";
        try {
            await invokeLLMStream(
                {
                    feature: usedTool.feature,
                    prompt: buildPrompt(usedTool, usedSubject, usedOptions, history, promptText, files),
                    file_urls: files.length ? files.map(f => f.url) : undefined,
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
        if (finalText) { optsRef.current = usedOptions; filesRef.current = files; persist(finalMessages, usedTool, usedSubject); }
    };

    const stop = () => abortRef.current?.abort();

    // ── Follow-up actions ────────────────────────────────────────────────────
    // The standalone tools didn't just render — several finished by writing
    // something into the rest of the app (a Quiz you could sit, Flashcards for
    // Spaced Repetition). Offered once there's a reply to work from.
    const toolActions = (messages.length > 0 && !streaming
        ? (typeof tool.actions === "function" ? tool.actions(subjectName, toolOptions) : tool.actions) || []
        : []
    ).map(id => ({ id, ...actionById(id) })).filter(a => a.prompt);

    const runAction = async (id) => {
        const action = actionById(id);
        if (!action || runningAction) return;
        setRunningAction(id);
        try {
            const res = await base44.integrations.Core.InvokeLLM({
                feature: action.feature,
                fast: true,
                prompt: action.prompt(messages, subjectName),
                response_json_schema: action.schema,
            });
            const done = await action.apply(res, { subject: subjectName });
            toast(done);
        } catch (e) {
            toast({ title: "That didn't work", description: e?.message, variant: "destructive" });
        } finally {
            setRunningAction(null);
        }
    };

    // ── History drawer content ───────────────────────────────────────────────
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

    // ── Shared composer pieces — rendered centre-stage on a new chat, pinned
    // to the bottom once the conversation starts ─────────────────────────────
    const optionsRow = (tool.options || []).length > 0 ? (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
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
    ) : null;

    const fileChipsRow = (convFiles.length > 0 || attachment) ? (
        <div className="flex flex-wrap items-center gap-1.5 pb-2">
            {convFiles.map((f, i) => (
                <div key={`${f.url}-${i}`} className="inline-flex items-center gap-1.5 pill bg-primary/10 text-primary"
                    title="This document stays in the chat — the AI reads it with every message">
                    <Paperclip className="w-3 h-3" /> {f.name}
                    <button onClick={() => setConvFiles(prev => prev.filter((_, j) => j !== i))} aria-label={`Remove ${f.name} from this chat`}>
                        <X className="w-3 h-3" />
                    </button>
                </div>
            ))}
            {attachment && (
                <div className="inline-flex items-center gap-1.5 pill bg-secondary text-foreground">
                    <Paperclip className="w-3 h-3" /> {attachment.name}
                    <span className="text-[10px] text-muted-foreground">sends with next message</span>
                    <button onClick={() => setAttachment(null)} aria-label="Remove attachment"><X className="w-3 h-3" /></button>
                </div>
            )}
        </div>
    ) : null;

    const composerBox = (
        <div className="rounded-3xl border-2 border-border bg-background shadow-soft px-4 pt-3 pb-2 transition-colors focus-within:border-primary/50">
            <Textarea
                value={input}
                onChange={e => {
                    setInput(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
                }}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder={attachment ? `Ask about ${attachment.name} — or just hit send` : `Message ${tool.label}…`}
                rows={1}
                className="w-full min-h-[44px] max-h-40 resize-none border-0 bg-transparent py-0 pl-1 pr-0 shadow-none text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <div className="flex items-center gap-1.5 pt-1.5">
                <Select value={activeTool} onValueChange={selectTool} disabled={toolLocked}>
                    <SelectTrigger className="h-8 w-auto gap-1 rounded-lg border-0 bg-secondary/60 px-2.5 text-xs font-bold shadow-none focus:ring-0"
                        title={toolLocked ? "This chat belongs to one tool — start a New chat to switch" : "Choose your tool"}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {CHAT_TOOLS.map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={subjectName || "none"} onValueChange={(v) => setSubjectName(v === "none" ? "" : v)}>
                    <SelectTrigger className="h-8 w-auto gap-1 rounded-lg border-0 bg-secondary/60 px-2.5 text-xs font-bold shadow-none focus:ring-0 max-w-[130px] sm:max-w-none">
                        <SelectValue placeholder="Subject" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">No subject</SelectItem>
                        {subjects.map(s => <SelectItem key={s.id} value={s.subject_name}>{s.subject_name}</SelectItem>)}
                    </SelectContent>
                </Select>
                <div className="ml-auto flex items-center gap-1.5">
                    {tool.supportsFiles && (
                        <>
                            <input ref={fileRef} type="file" className="hidden" accept=".pdf,.docx,.pptx,.png,.jpg,.jpeg,.txt"
                                onChange={e => attachFile(e.target.files?.[0])} />
                            <button onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Attach a file"
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                            </button>
                        </>
                    )}
                    {streaming ? (
                        <Button onClick={stop} variant="outline" size="icon" aria-label="Stop generating"
                            className="w-9 h-9 rounded-full border-2 border-streak/40 text-streak flex-shrink-0">
                            <Square className="w-4 h-4" />
                        </Button>
                    ) : (
                        <Button onClick={send} disabled={!input.trim() && !attachment} size="icon" aria-label="Send message"
                            className="w-9 h-9 rounded-full flex-shrink-0">
                            <Send className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex h-full min-h-0 rounded-3xl border border-border bg-surface shadow-soft overflow-hidden">
            {/* ── Permanent history rail (desktop) — tinted, part of the panel ── */}
            <aside className="hidden md:flex flex-col w-64 flex-shrink-0 bg-secondary/30 border-r border-border p-3 min-h-0">
                {SidebarInner}
                <Link to="/AIToolsHistory"
                    className="mt-2 pt-2.5 border-t border-border inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
                    <Archive className="w-3.5 h-3.5" /> Saved results
                </Link>
            </aside>

            <div className="relative flex flex-col flex-1 min-w-0 min-h-0">
            {/* ── Context strip — mobile pills; on desktop only shows in-chat ── */}
            <div className={`flex items-center gap-2 px-3 sm:px-4 py-2 border-b border-border flex-shrink-0 ${messages.length === 0 ? "md:hidden" : ""}`}>
                <button onClick={() => setSidebarOpen(true)}
                    className="md:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface border border-border text-xs font-bold text-muted-foreground hover:text-foreground hover:shadow-soft transition-all">
                    <History className="w-3.5 h-3.5" /> View chats
                </button>
                <Link to="/AIToolsHistory"
                    className="md:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface border border-border text-xs font-bold text-muted-foreground hover:text-foreground hover:shadow-soft transition-all">
                    <Archive className="w-3.5 h-3.5" /> Saved results
                </Link>
                {messages.length > 0 && (
                    <>
                        <div className="hidden sm:flex items-center gap-1.5 mx-auto min-w-0">
                            <tool.icon className={`w-3.5 h-3.5 flex-shrink-0 ${tool.accentText}`} />
                            <p className="text-xs font-bold text-foreground truncate">{tool.label}</p>
                            {subjectName && <span className="text-xs text-muted-foreground truncate">· {subjectName}</span>}
                        </div>
                        <button onClick={newChat}
                            className="ml-auto sm:ml-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface border border-border text-xs font-bold text-muted-foreground hover:text-foreground hover:shadow-soft transition-all">
                            <Plus className="w-3.5 h-3.5" /> New chat
                        </button>
                    </>
                )}
            </div>

            {/* ── History drawer (mobile only — desktop has the permanent rail) ── */}
            <AnimatePresence>
                {sidebarOpen && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-foreground/40 md:hidden" onClick={() => setSidebarOpen(false)}>
                        <motion.div initial={{ x: -320 }} animate={{ x: 0 }} exit={{ x: -320 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className="w-80 max-w-[85vw] h-full bg-surface p-3 shadow-soft-lg" onClick={e => e.stopPropagation()}>
                            {SidebarInner}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Thread — the conversation IS the page ── */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                {messages.length === 0 ? (
                    <div className="min-h-full flex flex-col items-center justify-center text-center px-4 py-8">
                        <div className={`w-16 h-16 rounded-2xl ${tool.accentBg} flex items-center justify-center mb-4`}>
                            <tool.icon className={`w-8 h-8 ${tool.accentText}`} />
                        </div>
                        <h2 className="font-display font-extrabold text-foreground text-2xl sm:text-3xl mb-1.5">
                            What are we working on?
                        </h2>
                        <p className="text-sm text-muted-foreground max-w-sm mb-6">{tool.blurb}</p>

                        {/* The composer IS the call to action — centre stage on a new chat */}
                        <div className="w-full max-w-2xl text-left">
                            {fileChipsRow}
                            {composerBox}
                            {optionsRow && <div className="pt-2.5">{optionsRow}</div>}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full max-w-2xl mt-7">
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
                    <div className="max-w-3xl mx-auto px-3 sm:px-5 py-5 space-y-5">
                        {messages.map((m, i) => (
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
                                            {m.artifact?.kind === "cheat_sheet" && (
                                                <CheatSheetArtifact
                                                    initialItems={m.artifact.data}
                                                    subject={subjectName}
                                                    title={m.artifact.title}
                                                    defaultPages={m.artifact.pages || 1}
                                                />
                                            )}
                                            {m.artifact?.kind === "exam_questions" && (
                                                <ExamQuestionsArtifact
                                                    questions={m.artifact.data}
                                                    subject={subjectName}
                                                    title={m.artifact.title}
                                                />
                                            )}
                                            {m.artifact?.kind === "line_memoriser" && (
                                                <LineMemoriserArtifact
                                                    lines={m.artifact.data}
                                                    title={m.artifact.title}
                                                />
                                            )}
                                            {/* Follow-ups the old standalone tools ended with —
                                                offered on the latest reply only. */}
                                            {!m.streaming && m.role === "assistant" && i === messages.length - 1 && toolActions.length > 0 && (
                                                <div className="flex flex-wrap gap-2 mt-3">
                                                    {toolActions.map(a => (
                                                        <Button key={a.id} size="sm" variant="outline" disabled={!!runningAction}
                                                            onClick={() => runAction(a.id)}
                                                            className="rounded-xl gap-1.5 text-xs font-semibold">
                                                            {runningAction === a.id
                                                                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {a.busy}</>
                                                                : <><Wand2 className="w-3.5 h-3.5" /> {a.label}</>}
                                                        </Button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                        <div ref={endRef} />
                    </div>
                )}
            </div>

            {/* ── Composer — pinned to the bottom only once a chat is running ── */}
            {messages.length > 0 && (
                <div className="w-full px-3 sm:px-5 pb-3 pt-1 flex-shrink-0">
                    <div className="max-w-3xl mx-auto">
                        {optionsRow && <div className="pb-2">{optionsRow}</div>}
                        {fileChipsRow}
                        {composerBox}
                        <p className="text-[10px] text-muted-foreground/50 text-center pt-1.5">
                            Chats save automatically — daily AI limits apply per tool.
                        </p>
                    </div>
                </div>
            )}
            </div>
        </div>
    );
}
