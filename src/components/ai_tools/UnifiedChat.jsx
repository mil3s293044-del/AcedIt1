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
    History, X, Archive, Wand2, Lock, ArrowLeft, Copy, Check, RotateCcw, Pencil, Search
} from "lucide-react";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { saveResult, deleteResult, loadSavedResults } from "@/lib/saveResult";
import { chatRows } from "@/lib/aiChats";
import { labelForTool } from "@/lib/toolLabels";
import ChatWelcome from "./ChatWelcome";
import { invokeLLMStream } from "@/lib/streamingAI";
import { useToast } from "@/components/ui/use-toast";
import { recordStudyAndGetStreak } from "@/components/shared/streakHelpers";
import MarkdownMath from "@/components/shared/MarkdownMath";
import { CHAT_TOOLS, toolById, defaultOptions, resolveChoices, buildArtifactHistory } from "./chatTools";
import CheatSheetArtifact from "./CheatSheetArtifact";
import ExamQuestionsArtifact from "./ExamQuestionsArtifact";
import LineMemoriserArtifact from "./LineMemoriserArtifact";
import { actionById } from "./chatActions";
import { todaysIntent } from "@/lib/studyIntent";
import { fmtDate } from "@/lib/safeDate";
import AceShuffle from "@/components/ace/AceShuffle";

const MAX_TURNS_IN_PROMPT = 12;
/** Chats before the history search box is worth the space it takes. */
const HISTORY_SEARCH_AT = 6;

/**
 * One control under a message.
 *
 * ICON PLUS LABEL, not an icon alone. A bare glyph under a paragraph is a
 * guess — this app's own rule is that an icon earns its place by carrying
 * something the text does not, and here the text is what says what happens.
 * The label is `sr-only` at the smallest width only because three words beside
 * two glyphs wrap the row on a phone; the `aria-label` carries it either way.
 */
function RowAction({ label, icon: Icon, onClick, disabled = false, done = false }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            title={label}
            className={`inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-[11px] font-bold
                transition-colors disabled:opacity-40
                ${done
                    ? "text-[var(--console-accent-ink)]"
                    : "text-[var(--console-ink-faint)] hover:text-[var(--console-ink)] hover:bg-[var(--console-panel-2)]"}`}
        >
            <Icon className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">{done ? "Copied" : label}</span>
        </button>
    );
}

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

export default function UnifiedChat({
    locked = false,
    // ── OPENED ON SOMETHING ─────────────────────────────────────────────────
    // The dashboard opens this component already pointed at a tool — from a
    // direction card, or from a tool in the toolkit. These take precedence over
    // the `?tool=` deep link below, because a prop is the more specific
    // instruction: the student pressed something on this screen, and the URL is
    // whatever they arrived on.
    startTool = null,
    startSubject = "",
    startSeed = "",
    // An EXISTING conversation to reopen, which is what makes the Recent list
    // a way back into work rather than a transcript. Hydrated once on mount.
    startConversation = null,
    // Told the row id the moment one exists, so the dashboard's Recent list is
    // current when the student comes back out without waiting for a reload.
    onSaved = null,
    onExit = null,
    exitLabel = "",
    // ── WHAT THE EMPTY STATE SHOWS ──────────────────────────────────────────
    // The direction cards are counted by the PAGE, which already loads the rows
    // for them — the chat is handed the result rather than reading five tables
    // of its own, which would be the second copy of a read this codebase keeps
    // deleting. Empty is a real answer and the commonest one on a new account.
    cards = [],
    usage = {},
    briefLoading = false,
    onOpenCard = null,
} = {}) {
    const { toast } = useToast();
    const [user, setUser] = useState(null);
    const [subjects, setSubjects] = useState([]);
    const [conversations, setConversations] = useState([]);
    const [openFolders, setOpenFolders] = useState({});
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [historyQuery, setHistoryQuery] = useState("");

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
            // ── A DEEP LINK BEATS THE INTENT ────────────────────────────
            // `/AITools?tool=<id>&q=<first message>` is how every screen that
            // KNOWS what is wrong hands over — the mistake bank with the exact
            // criterion, the subject hub with the course gap, the brief below.
            // It is read before the intent because it is more specific: an
            // intent is what today is broadly for, and a link is a student
            // having just pressed something about one thing.
            //
            // The tool id is CHECKED against the catalogue rather than trusted,
            // so a stale or hand-edited link lands on the default tool instead
            // of an empty switcher.
            // `toolById` FALLS BACK TO THE FIRST TOOL rather than returning
            // null, so testing its result for truthiness would make every visit
            // look like a deep link and silently kill the intent default below.
            // The param is matched against the catalogue directly instead.
            // A PROP BEATS THE URL. The dashboard already decided which tool
            // this is; the query string is only how a link from another screen
            // asks for one, and both land in the same branch below so there is
            // one opening behaviour rather than two.
            const params = new URLSearchParams(window.location.search);
            const wantedId = startTool || params.get("tool") || "";
            const linked = CHAT_TOOLS.find((t) => t.id === wantedId) || null;
            const intent = todaysIntent(profiles?.[0]);
            const wanted = intent && toolById(intent.plan.tool);
            // `intent` is null on any day the student hasn't set one (the
            // common case) — the old `intent.plan.tool` on the right of this
            // comparison dereferenced it unconditionally, throwing inside
            // this .then() and aborting the whole effect silently (the outer
            // catch swallows it with no log). Everything below this line —
            // subjects, and critically setConversations() — never ran, which
            // is why the sidebar looked permanently empty regardless of what
            // had actually been saved.
            // ── A CONVERSATION IS REOPENED, NOT RESTARTED ───────────────
            // That is the whole promise of the Recent list: "I still do not get
            // part b" has to land in the conversation that explained part b,
            // not in a second thread about it. Hydrated inline rather than through
            // `openConversation` below, which is a `const` declared further
            // down — it is bound by the time an effect runs, but a function
            // this effect depends on being hoisted is a TDZ crash one reorder
            // away, which is the class `hookDeps.test.mjs` exists for.
            if (startConversation?.input_data?.messages?.length) {
                const c = startConversation;
                convIdRef.current = c.id;
                setActiveConvId(c.id);
                const ct = CHAT_TOOLS.find((t) => t.id === c.tool_type) || CHAT_TOOLS[0];
                setActiveTool(ct.id);
                setSubjectName(c.input_data?.subject || startSubject || "");
                setToolOptions({ ...defaultOptions(ct), ...(c.input_data?.options || {}) });
                setMessages(c.input_data.messages);
                setConvFiles(c.input_data?.files || []);
            } else if (linked) {
                setActiveTool(linked.id);
                // The subject rides in the link too, because a tool opened for
                // "Chemistry" with the subject picker still on its default is
                // the half-wired shape this app has met over and over: it
                // landed on the right page and the thing it promised to open
                // did not open.
                const subject = startSubject || params.get("subject") || "";
                // ── THE SUBJECT GOES IN `subjectName`, NOT THE OPTIONS ──────
                // Every tool's `system(s, o)` reads the subject off `s`, which
                // is `subjectName`, and `subjectBlock(s)` is what loads that
                // study's VCAA EXAMINER PROFILE. Setting it on `toolOptions`
                // alone — which is what this did — landed on the right tool
                // with the subject nowhere the prompt could see it, so a tool
                // opened on a Chemistry question ran the general VCE preamble
                // instead of the Chemistry profile. The same half-wired shape
                // the comment above warns about, in the line below it, and the
                // identical failure `markingPrompt.js` records about the marker
                // being told to be an examiner and shown none of the rules.
                if (subject) setSubjectName(subject);
                setToolOptions({
                    ...defaultOptions(linked),
                    ...(subject ? { subject } : {}),
                });
                // THE SEED IS PUT IN THE COMPOSER, NOT SENT. A link that spends
                // a chip before the student has read the screen would be the
                // one action in the app that costs them something they did not
                // press — megaUpload's rule that the price is on screen before
                // it is spent. They can edit it, and they can delete it.
                const seed = startSeed || params.get("q") || "";
                if (seed) setInput(seed);
            } else if (intent && wanted?.id === intent.plan.tool) {
                setActiveTool(wanted.id);
                setToolOptions(defaultOptions(wanted));
            }
            const seen = new Set();
            setSubjects((subs || []).filter(s => !seen.has(s.subject_name) && seen.add(s.subject_name)));
            // Only chat-format rows join the sidebar (legacy saved results
            // live on the History page). Merge DB + localStorage.
            // ONE PREDICATE, shared with the dashboard's Recent list
            // (`aiChats.js`). Two copies would let the sidebar and that list
            // disagree about what the student has, on two lists of one table.
            const allConvs = chatRows(convs);
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
        flushPersistRef.current();
        abortRef.current?.abort();
        setActiveConvId(null); convIdRef.current = null;
        setMessages([]); setInput(""); setAttachment(null); setConvFiles([]); setStreaming(false);
        setToolOptions(defaultOptions(tool));
        setSidebarOpen(false);
    };

    const openConversation = (conv) => {
        flushPersistRef.current();
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
    // REFS, NOT THE CLOSURE. `persist` runs in the same tick a send completes
    // and is memoised on `user` alone; reading `onSaved` through the closure
    // would call whichever handler was mounted when that callback was built.
    // The same trap `startFromSuggestion` and the pomodoro commit both record.
    const onSavedRef = useRef(onSaved);
    useEffect(() => { onSavedRef.current = onSaved; }, [onSaved]);
    const persist = useCallback(async (finalMessages, usedTool, usedSubject) => {
        if (!user?.email) return;
        const flat = finalMessages.map(m => `${m.role === "user" ? "Student" : "AI"}: ${m.content}`).join("\n\n");
        const payload = {
            tool_type: usedTool.id,
            title: (finalMessages[0]?.content || "Chat").slice(0, 60),
            subject_name: usedSubject || null,
            content: flat.slice(0, 20000),
            input_data: {
                tool: usedTool.id, subject: usedSubject || null,
                options: optsRef.current, files: filesRef.current, messages: finalMessages,
            },
            date_created: new Date().toISOString().split("T")[0],
        };
        try {
            if (convIdRef.current) {
                const { ok } = await saveResult('update', payload, convIdRef.current);
                if (ok) {
                    const id = convIdRef.current;
                    setConversations(prev => prev.map(c => c.id === id ? { ...c, ...payload } : c));
                    onSavedRef.current?.({ ...payload, id });
                }
            } else {
                const { ok, id } = await saveResult('create', payload);
                if (ok && id) {
                    convIdRef.current = id;
                    setActiveConvId(id);
                    const row = { ...payload, id, created_date: new Date().toISOString() };
                    setConversations(prev => [row, ...prev]);
                    onSavedRef.current?.(row);
                }
            }
        } catch (e) { console.error("Chat persist failed:", e); }
    }, [user]);

    // ── Save-on-exit safety net ──────────────────────────────────────────────
    // persist() above already autosaves after every completed AI reply, which
    // covers the normal case. This catches what a per-turn autosave can't:
    // starting a New chat, opening a different saved conversation, or
    // navigating away from the page entirely (unmount) while the current
    // thread has messages that finished but haven't been flushed yet. It
    // deliberately skips a conversation that's still streaming or ends on a
    // dangling partial reply — there's nothing finished to save, and the
    // in-flight turn will persist itself once it completes.
    const flushPersist = useCallback(() => {
        if (streaming) return;
        if (messages.length === 0) return;
        if (messages.some(m => m.streaming)) return;
        persist(messages, tool, subjectName);
    }, [streaming, messages, tool, subjectName, persist]);

    // Read via a ref everywhere flushPersist is called from a closure that
    // was created on an earlier render (newChat/openConversation above, and
    // the unmount cleanup below) — otherwise those calls would flush whatever
    // messages/tool/subject existed when THAT closure was made, not what's
    // actually on screen right now.
    const flushPersistRef = useRef(flushPersist);
    useEffect(() => { flushPersistRef.current = flushPersist; }, [flushPersist]);

    // "Exits their chat" without clicking New chat or another conversation —
    // i.e. navigates elsewhere in the app. React runs this cleanup when the
    // route change unmounts UnifiedChat, which is the one moment nothing else
    // in this component gets a chance to save first.
    useEffect(() => () => { flushPersistRef.current(); }, []);

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

    /**
     * Send a turn.
     *
     * ─── REGENERATE AND EDIT ARE THE SAME SEND ──────────────────────────────
     * Both rewind the thread and run a turn again, so neither gets a second
     * copy of this function — which carries the artifact branch, the file
     * re-attachment, the streaming loop and the save. A second copy is how one
     * path quietly stops attaching documents, or stops saving.
     *
     * `forced` is the prompt text and `forcedHistory` the thread it runs
     * against. With neither, it is an ordinary send off the composer.
     */
    const send = async ({ text: forced = null, history: forcedHistory = null } = {}) => {
        const text = forced != null ? String(forced).trim() : input.trim();
        const pending = forced != null ? null : attachment;
        // A document on its own is a valid message — no typed text required.
        if ((!text && !pending) || streaming) return;
        const usedTool = tool;
        const usedSubject = subjectName;
        const usedOptions = toolOptions;
        // Every request carries ALL of this conversation's documents, so the
        // AI can keep answering questions about them on later turns.
        const files = pending ? [...convFiles, { url: pending.url, name: pending.name }] : convFiles;
        // A REGENERATE MUST NOT EAT A DRAFT. The composer is only cleared when
        // the send came from it; pressing regenerate while half a follow-up is
        // typed would otherwise delete it with nothing to undo.
        if (forced == null) { setInput(""); setAttachment(null); }
        if (pending) setConvFiles(files);

        const promptText = text || `I've attached "${pending.name}". Please read it and help me with it.`;
        const userMsg = { role: "user", content: pending ? `${text ? `${text}\n\n` : ""} ${pending.name}` : text };
        const history = forcedHistory || messages;
        // Set from `history` rather than `prev`: a regenerate has already
        // decided what the thread is, and appending to `prev` would leave the
        // reply it is replacing sitting above the new one.
        setMessages([...history, userMsg, { role: "assistant", content: "", streaming: true }]);
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
                    prompt: artifactSpec.prompt(promptText, files.map(f => f.name), buildArtifactHistory(history)),
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

    /* ── Copy ──────────────────────────────────────────────────────────────
       The single most-used control in any chat and this one had none at all.
       `navigator.clipboard` is unavailable on an insecure origin and throws
       when the document is not focused, so the failure is REPORTED rather than
       swallowed — a tick that never appears reads as a dead button. */
    const [copiedAt, setCopiedAt] = useState(-1);
    const copyTimer = useRef(null);
    useEffect(() => () => clearTimeout(copyTimer.current), []);

    const copyMessage = useCallback(async (index, text) => {
        try {
            await navigator.clipboard.writeText(String(text || ""));
            setCopiedAt(index);
            clearTimeout(copyTimer.current);
            copyTimer.current = setTimeout(() => setCopiedAt(-1), 1600);
        } catch {
            toast({ title: "Could not copy", description: "Your browser blocked it — select the text and copy it instead." });
        }
    }, [toast]);

    /* ── Regenerate ────────────────────────────────────────────────────────
       Runs the LAST user turn again against the thread that preceded it. It
       costs a chip like any other send, which is why it is a labelled control
       rather than an icon: the price has to be legible before the press, the
       rule megaUpload keeps about the one action whose cost is not fixed. */
    const lastUserIndex = useCallback((list) => {
        for (let i = list.length - 1; i >= 0; i -= 1) if (list[i]?.role === "user") return i;
        return -1;
    }, []);

    const regenerate = useCallback(() => {
        if (streaming) return;
        const i = lastUserIndex(messages);
        if (i < 0) return;
        send({ text: messages[i].content, history: messages.slice(0, i) });
    }, [messages, streaming, lastUserIndex]);

    /* ── Edit and resend ───────────────────────────────────────────────────
       Truncates to before that turn and runs it again, the way ChatGPT does —
       so the thread stays a single line of reasoning rather than growing a
       correction the model has already read. The draft lives in its own state
       and NEVER in `input`, or cancelling an edit would leave the composer
       holding a message already in the thread. */
    const [editing, setEditing] = useState(-1);
    const [editDraft, setEditDraft] = useState("");

    const beginEdit = useCallback((index, text) => {
        setEditing(index);
        setEditDraft(String(text || ""));
    }, []);

    const commitEdit = useCallback(() => {
        const text = editDraft.trim();
        const i = editing;
        setEditing(-1); setEditDraft("");
        if (i < 0 || !text || streaming) return;
        send({ text, history: messages.slice(0, i) });
    }, [editDraft, editing, messages, streaming]);

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
    /* ── SEARCHING THE HISTORY ─────────────────────────────────────────────
       It matches the TITLE and the tool's NAME, which are the two things a
       student actually remembers about a chat they want back. It does NOT
       search message bodies: the rows are already loaded so it could, and a
       hit buried in turn nine would show a title that does not contain the
       word — a result the student cannot see the reason for.

       A query that matches nothing says so rather than rendering an empty
       drawer that reads as "you have no chats", which is a different and
       much more alarming claim. */
    const query = historyQuery.trim().toLowerCase();
    const folders = CHAT_TOOLS
        .map(t => ({
            tool: t,
            convs: conversations.filter(c => {
                if (c.tool_type !== t.id) return false;
                if (!query) return true;
                return `${c.title || ""} ${t.label}`.toLowerCase().includes(query);
            }),
        }))
        .filter(f => f.convs.length > 0);

    const SidebarInner = (
        <div className="flex flex-col h-full">
            <Button onClick={newChat} className="w-full gap-1.5 mb-3 rounded-xl font-bold">
                <Plus className="w-4 h-4" /> New chat
            </Button>

            {/* The box appears only once there is enough history to need it —
                a search field over three chats is a control with nothing to do,
                and it takes the space the list wants. */}
            {conversations.length >= HISTORY_SEARCH_AT && (
                <div className="relative mb-2">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2
                        text-[var(--console-ink-faint)]" aria-hidden="true" />
                    <input
                        type="search"
                        value={historyQuery}
                        onChange={(e) => setHistoryQuery(e.target.value)}
                        placeholder="Search your chats"
                        aria-label="Search your chats"
                        className="w-full rounded-lg border border-[var(--console-line)] bg-[var(--console-panel-2)]
                            py-1.5 pl-8 pr-2 text-xs text-[var(--console-ink)]
                            placeholder:text-[var(--console-ink-faint)]
                            focus:border-[var(--console-accent-ink)] focus:outline-none"
                    />
                </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                {folders.length === 0 && (
                    <p className="text-xs text-[var(--console-ink-faint)] text-center py-6 px-2">
                        {query
                            ? `Nothing matches “${historyQuery.trim()}”.`
                            : "Your chats will collect here, sorted by tool."}
                    </p>
                )}
                {folders.map(({ tool: t, convs }) => {
                    const open = openFolders[t.id] !== false;
                    const Icon = t.icon;
                    return (
                        <div key={t.id}>
                            <button onClick={() => setOpenFolders(p => ({ ...p, [t.id]: !open }))}
                                className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide text-[var(--console-ink-faint)] hover:bg-[var(--console-panel-2)] transition-colors">
                                {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                <Icon className={`w-3.5 h-3.5 ${t.accentText}`} />
                                {t.label}
                                <span className="ml-auto font-bold text-[var(--console-ink-faint)]">{convs.length}</span>
                            </button>
                            {open && convs.map(c => (
                                <div key={c.id}
                                    className={`group flex items-center gap-1.5 rounded-lg pl-7 pr-1.5 py-1.5 cursor-pointer transition-colors ${
                                        c.id === activeConvId ? "bg-[var(--console-panel-2)]" : "hover:bg-[var(--console-panel-2)]"
                                    }`}
                                    onClick={() => openConversation(c)}>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-[var(--console-ink)] truncate">{c.title || "Chat"}</p>
                                        <p className="text-[10px] text-[var(--console-ink-faint)]">{agoLabel(c.created_date)}{c.subject_name ? ` · ${c.subject_name}` : ""}</p>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); deleteConversation(c); }} aria-label="Delete chat"
                                        className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-md flex items-center justify-center text-[var(--console-ink-faint)] hover:text-streak hover:bg-streak/10 transition-all flex-shrink-0">
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
                    <span className="text-[10px] font-black uppercase tracking-wide text-[var(--console-ink-faint)]">{group.label}</span>
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
                                    : "bg-[var(--console-panel)] border-[var(--console-line)] text-[var(--console-ink-faint)] hover:text-[var(--console-ink)]"
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
                <div className="inline-flex items-center gap-1.5 pill bg-[var(--console-panel-2)] text-[var(--console-ink)]">
                    <Paperclip className="w-3 h-3" /> {attachment.name}
                    <span className="text-[10px] text-[var(--console-ink-faint)]">sends with next message</span>
                    <button onClick={() => setAttachment(null)} aria-label="Remove attachment"><X className="w-3 h-3" /></button>
                </div>
            )}
        </div>
    ) : null;

    /**
     * The upgrade strip a free student gets where the composer would be.
     *
     * It REPLACES the composer rather than disabling it. A greyed-out textarea
     * with a lock on it invites somebody to type into a box that will refuse
     * them, and a disabled control that does not say why is the paper-cut this
     * codebase has already recorded about Active Recall's generate button.
     */
    const upgradeBox = (
        <Link
            to={createPageUrl("Subscription")}
            className="block rounded-3xl border-2 border-primary/30 bg-primary/5 px-4 py-4
                text-left transition-colors hover:border-primary/50"
        >
            <p className="font-bold text-[var(--console-ink)] text-sm inline-flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                The tools are Premium
            </p>
            <p className="text-[13px] text-[var(--console-ink-faint)] mt-1 leading-snug">
                What is above is yours either way &mdash; it is counted off your own
                work. $5 a week unlocks the {CHAT_TOOLS.length} tools that act on it.
            </p>
        </Link>
    );

    const composerBox = (
        <div className="rounded-3xl border-2 border-[var(--console-line)] bg-[var(--console-ground)] shadow-soft px-4 pt-3 pb-2 transition-colors focus-within:border-primary/50">
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
                    <SelectTrigger className="h-8 w-auto gap-1 rounded-lg border-0 bg-[var(--console-panel-2)] px-2.5 text-xs font-bold shadow-none focus:ring-0"
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
                    <SelectTrigger className="h-8 w-auto gap-1 rounded-lg border-0 bg-[var(--console-panel-2)] px-2.5 text-xs font-bold shadow-none focus:ring-0 max-w-[130px] sm:max-w-none">
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
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--console-ink-faint)] hover:text-[var(--console-ink)] hover:bg-[var(--console-panel-2)] transition-colors">
                                {uploading ? <AceShuffle size="sm" /> : <Paperclip className="w-4 h-4" />}
                            </button>
                        </>
                    )}
                    {streaming ? (
                        <Button onClick={stop} variant="outline" size="icon" aria-label="Stop generating"
                            className="w-9 h-9 rounded-full border-2 border-streak/40 text-streak flex-shrink-0">
                            <Square className="w-4 h-4" />
                        </Button>
                    ) : (
                        <Button onClick={() => send()} disabled={!input.trim() && !attachment} size="icon" aria-label="Send message"
                            className="w-9 h-9 rounded-full flex-shrink-0">
                            <Send className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex h-full min-h-0 rounded-3xl border border-[var(--console-line)] bg-[var(--console-panel)] shadow-soft overflow-hidden">
            {/* ── Permanent history rail (desktop) — tinted, part of the panel ── */}
            <aside className="hidden md:flex flex-col w-64 flex-shrink-0 bg-[var(--console-panel-2)] border-r border-[var(--console-line)] p-3 min-h-0">
                {SidebarInner}
                <Link to="/AIToolsHistory"
                    className="mt-2 pt-2.5 border-t border-[var(--console-line)] inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-bold text-[var(--console-ink-faint)] hover:text-[var(--console-ink)] hover:bg-[var(--console-panel-2)] transition-colors">
                    <Archive className="w-3.5 h-3.5" /> Saved results
                </Link>
            </aside>

            <div className="relative flex flex-col flex-1 min-w-0 min-h-0">
            {/* ── Context strip — mobile pills; on desktop only shows in-chat ── */}
            {/* ── THE WAY BACK TO THE DASHBOARD ───────────────────────────
                A chat opened from the dashboard needs a way out of it that is
                not the browser's back button, and it names what it returns TO
                rather than saying "back". Only drawn when something opened this
                with an exit; reached by a deep link from another screen the
                chat is the page and has nothing to exit to. */}
            {onExit && (
                <div className="flex items-center gap-2 px-3 sm:px-4 pt-2 flex-shrink-0">
                    <button
                        type="button"
                        onClick={onExit}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--console-ink-faint)]
                            hover:text-[var(--console-ink)] transition-colors min-w-0"
                    >
                        <ArrowLeft className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{exitLabel || "AI Tools"}</span>
                    </button>
                </div>
            )}
            <div className={`flex items-center gap-2 px-3 sm:px-4 py-2 border-b border-[var(--console-line)] flex-shrink-0 ${messages.length === 0 && !onExit ? "md:hidden" : ""}`}>
                <button onClick={() => setSidebarOpen(true)}
                    className="md:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--console-panel)] border border-[var(--console-line)] text-xs font-bold text-[var(--console-ink-faint)] hover:text-[var(--console-ink)] hover:shadow-soft transition-all">
                    <History className="w-3.5 h-3.5" /> View chats
                </button>
                <Link to="/AIToolsHistory"
                    className="md:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--console-panel)] border border-[var(--console-line)] text-xs font-bold text-[var(--console-ink-faint)] hover:text-[var(--console-ink)] hover:shadow-soft transition-all">
                    <Archive className="w-3.5 h-3.5" /> Saved results
                </Link>
                {messages.length > 0 && (
                    <>
                        <div className="hidden sm:flex items-center gap-1.5 mx-auto min-w-0">
                            <tool.icon className={`w-3.5 h-3.5 flex-shrink-0 ${tool.accentText}`} />
                            <p className="text-xs font-bold text-[var(--console-ink)] truncate">{tool.label}</p>
                            {subjectName && <span className="text-xs text-[var(--console-ink-faint)] truncate">· {subjectName}</span>}
                        </div>
                        <button onClick={newChat}
                            className="ml-auto sm:ml-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--console-panel)] border border-[var(--console-line)] text-xs font-bold text-[var(--console-ink-faint)] hover:text-[var(--console-ink)] hover:shadow-soft transition-all">
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
                            className="w-80 max-w-[85vw] h-full bg-[var(--console-panel)] p-3 shadow-soft-lg" onClick={e => e.stopPropagation()}>
                            {SidebarInner}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Thread — the conversation IS the page ── */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                {messages.length === 0 ? (
                    /* THE WELCOME IS THE OLD DASHBOARD'S JOB, INSIDE THE CHAT.
                       The composer is passed down rather than rebuilt, so there
                       is exactly one of it and the empty state cannot drift
                       from the one a student types into on every later turn. */
                    <ChatWelcome
                        tool={tool}
                        tools={CHAT_TOOLS}
                        cards={cards}
                        usage={usage}
                        locked={locked}
                        loading={briefLoading}
                        labelFor={labelForTool}
                        onOpenCard={onOpenCard}
                        onPickTool={selectTool}
                    >
                        {fileChipsRow}
                        {locked ? upgradeBox : composerBox}
                        {!locked && optionsRow && <div className="pt-2.5">{optionsRow}</div>}
                    </ChatWelcome>
                ) : (
                    <div className="max-w-3xl mx-auto px-3 sm:px-5 py-5 space-y-5">
                        {messages.map((m, i) => (
                            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                                {m.role === "user" ? (
                                    editing === i ? (
                                        /* ── Editing this turn ───────────────
                                           Full measure rather than the bubble's
                                           70%: a box you are typing into needs
                                           the width, and the thread below is
                                           about to be replaced anyway. */
                                        <div className="w-full max-w-[85%] rounded-2xl border border-[var(--console-accent-ink)]
                                            bg-[var(--console-panel)] p-2.5">
                                            <Textarea
                                                value={editDraft}
                                                autoFocus
                                                onChange={(e) => setEditDraft(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitEdit(); }
                                                    if (e.key === "Escape") { setEditing(-1); setEditDraft(""); }
                                                }}
                                                rows={2}
                                                className="w-full resize-none border-0 bg-transparent p-0 text-sm shadow-none
                                                    text-[var(--console-ink)] focus-visible:ring-0 focus-visible:ring-offset-0"
                                            />
                                            <div className="mt-2 flex items-center justify-end gap-2">
                                                <button type="button"
                                                    onClick={() => { setEditing(-1); setEditDraft(""); }}
                                                    className="rounded-lg px-2.5 py-1 text-xs font-bold
                                                        text-[var(--console-ink-faint)] hover:text-[var(--console-ink)]">
                                                    Cancel
                                                </button>
                                                <button type="button"
                                                    onClick={commitEdit}
                                                    disabled={!editDraft.trim() || streaming}
                                                    className="rounded-lg bg-[var(--console-accent)] px-3 py-1 text-xs font-bold
                                                        text-[var(--console-on-accent)] disabled:opacity-50">
                                                    Send again
                                                </button>
                                            </div>
                                            {/* THE REST OF THE THREAD GOES. Said
                                                before the press, not after. */}
                                            <p className="mt-1.5 text-right text-[10px] text-[var(--console-ink-faint)]">
                                                Replies after this one are replaced.
                                            </p>
                                        </div>
                                    ) : (
                                    <div className="group max-w-[85%] sm:max-w-[70%]">
                                        <div className="rounded-2xl rounded-br-md border border-[var(--console-line)] bg-[var(--console-panel-2)] px-4 py-2.5 text-sm text-[var(--console-ink)] whitespace-pre-wrap">
                                            {m.content}
                                        </div>
                                        {!locked && !streaming && (
                                            <div className="mt-1 flex justify-end gap-0.5 opacity-0 transition-opacity
                                                group-hover:opacity-100 focus-within:opacity-100">
                                                <RowAction label="Copy" onClick={() => copyMessage(i, m.content)}
                                                    icon={copiedAt === i ? Check : Copy} done={copiedAt === i} />
                                                <RowAction label="Edit" icon={Pencil}
                                                    onClick={() => beginEdit(i, m.content)} />
                                            </div>
                                        )}
                                    </div>
                                    )
                                ) : (
                                    <div className="group max-w-[95%] sm:max-w-[85%] flex gap-2.5">
                                        <div className={`w-7 h-7 rounded-lg ${tool.accentBg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                                            <tool.icon className={`w-3.5 h-3.5 ${tool.accentText}`} />
                                        </div>
                                        <div className="min-w-0 text-sm text-[var(--console-ink)] leading-relaxed prose-sm">
                                            {m.content
                                                ? <MarkdownMath isStreaming={!!m.streaming}>{m.content}</MarkdownMath>
                                                : <span className="inline-flex items-center gap-1.5 text-[var(--console-ink-faint)]"><AceShuffle size="sm" /> Thinking…</span>}
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
                                            {/* ── Copy, and run it again ──────────────────
                                                Appear on hover so a finished thread reads as
                                                prose rather than as a column of toolbars, and
                                                `focus-within` keeps them reachable by keyboard,
                                                which hover alone never is. Regenerate is on the
                                                LAST reply only: re-running a turn from the
                                                middle would silently discard everything after
                                                it, which is what Edit is for and says so. */}
                                            {!m.streaming && m.content && !locked && (
                                                <div className="mt-2 flex items-center gap-0.5 opacity-0 transition-opacity
                                                    group-hover:opacity-100 focus-within:opacity-100">
                                                    <RowAction label="Copy" onClick={() => copyMessage(i, m.content)}
                                                        icon={copiedAt === i ? Check : Copy} done={copiedAt === i} />
                                                    {i === messages.length - 1 && (
                                                        <RowAction label="Try again" icon={RotateCcw}
                                                            onClick={regenerate} disabled={streaming} />
                                                    )}
                                                </div>
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
                                                                ? <><AceShuffle size="sm" /> {a.busy}</>
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
                        {!locked && optionsRow && <div className="pb-2">{optionsRow}</div>}
                        {fileChipsRow}
                        {locked ? upgradeBox : composerBox}
                        {/* "daily AI limits apply per tool" described the eleven
                            per-feature daily counters chips.js replaced — they
                            were sized independently of the dollar ceiling and
                            permitted 4.5x what it allowed, which is the whole
                            argument that file opens with. There is one weekly
                            stack now, and a line describing the limit a student
                            is NOT subject to is the copy drift this codebase
                            keeps finding. */}
                        <p className="text-[10px] text-[var(--console-ink-faint)] text-center pt-1.5">
                            Chats save automatically — each send spends from this week&apos;s chips.
                        </p>
                    </div>
                </div>
            )}
            </div>
        </div>
    );
}
