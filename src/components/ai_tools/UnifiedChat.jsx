/**
 * UnifiedChat — the AI tools as one chatbot, and the whole of /AITools.
 *
 * Past conversations down the left edge by date, a streaming markdown thread,
 * and a composer where the student picks the tool and the subject. Chats
 * persist to AISavedResult (`input_data.messages`) and reopen to continue.
 * Every send carries the tool's feature tag, so every chip price applies
 * unchanged.
 *
 * ─── FULL-BLEED, NOT A PANEL IN A ROOM ──────────────────────────────────────
 * It was a rounded, bordered card with its own rail, set inside a padded
 * lattice page — a box in a box, with the lattice showing only in the margins
 * around it. The history is the page's left edge now and the conversation
 * fills the rest, which is how every chat a student already uses is laid out.
 *
 * ─── WHAT A PHONE COULD NOT DO ──────────────────────────────────────────────
 * Copy, Edit and Try again were `opacity-0` until hovered, which on a touch
 * screen is never — the single most-used control in any chat did not exist
 * for most of the traffic. They are visible on any device without hover, and
 * on the latest reply everywhere. The `[@media(hover:hover)]` variant is what
 * draws that line; a plain `group-hover` cannot tell a phone from a laptop.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Textarea } from "@/components/ui/textarea";
import {
    ArrowUp, ArrowDown, Square, Paperclip, X, Wand2, Lock, Copy, Check, RotateCcw, Pencil,
    Plus, PanelLeft, ChevronDown, SlidersHorizontal,
} from "lucide-react";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { saveResult, deleteResult, loadSavedResults } from "@/lib/saveResult";
import { chatRows, clipTitle } from "@/lib/aiChats";
import { openingTool, followUpsFor, slashQuery, strandFor, FALLBACK_TOOL } from "@/lib/chatModel";
import { priceOf, stackOf } from "@/lib/chips";
import { tierOf } from "@/lib/aiModels";
import { priceLabel } from "@/lib/pricing";
import { shortSubject } from "@/lib/subjectShort";
import { acceptFiles, STUDY_ACCEPT } from "@/lib/pickFiles";
import { labelForTool } from "@/lib/toolLabels";
import ChatWelcome from "./ChatWelcome";
import ChatHistory from "./ChatHistory";
import ToolPalette from "./ToolPalette";
import ComposerSetup, { visibleGroups } from "./ComposerSetup";
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
import AceShuffle from "@/components/ace/AceShuffle";
import { useMedia } from "@/hooks/useMedia";

const MAX_TURNS_IN_PROMPT = 12;
/** How close to the bottom still counts as "at the bottom", so streaming keeps following. */
const STICK_PX = 96;

/**
 * Faded until hover on a device WITH hover; always there on one without. One
 * string, so every message control is reachable the same way.
 */
const HOVER_REVEAL = "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-within:opacity-100";

/**
 * One control under a message. ICON PLUS LABEL: a bare glyph under a paragraph
 * is a guess. The label hides at the smallest width only because three words
 * beside two glyphs wrap the row on a phone; the `aria-label` carries it.
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

/**
 * A tool's starting options for a subject. A maths subject IS a strand, so it
 * sets the strand rather than sitting beside a strand that disagrees with it.
 */
function optionsFor(tool, subject) {
    const base = defaultOptions(tool);
    const strand = strandFor(subject);
    if (strand && (tool.options || []).some((g) => g.key === "strand")) base.strand = strand;
    return base;
}

export default function UnifiedChat({
    locked = false,
    // ── OPENED ON SOMETHING ─────────────────────────────────────────────────
    // A suggestion on the welcome re-keys this component with these set. They
    // beat the `?tool=` deep link, because the student pressed something on
    // this screen and the URL is whatever they arrived on.
    startTool = null,
    startSubject = "",
    startSeed = "",
    // An EXISTING conversation to reopen. Hydrated once on mount.
    startConversation = null,
    // The page works out the opening tool from rows it already loaded, so the
    // first paint is already the right one rather than Study Coach for a frame.
    defaultTool = null,
    // Told the row the moment one exists.
    onSaved = null,
    // ── WHAT THE EMPTY STATE SHOWS ──────────────────────────────────────────
    // Counted by the PAGE, which already loads the rows for them.
    cards = [],
    usage = {},
    briefLoading = false,
    firstName = "",
    onOpenCard = null,
} = {}) {
    const { toast } = useToast();
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [subjects, setSubjects] = useState([]);
    const [conversations, setConversations] = useState([]);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const [activeConvId, setActiveConvId] = useState(null);
    const [activeTool, setActiveTool] = useState(() => {
        const first = [startTool, defaultTool].find((id) => CHAT_TOOLS.some((t) => t.id === id));
        return first || FALLBACK_TOOL;
    });
    const [toolOptions, setToolOptions] = useState(() => defaultOptions(toolById(activeTool)));
    const [subjectName, setSubjectName] = useState("");
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [attachment, setAttachment] = useState(null);
    // Documents already sent in this conversation — re-attached to every
    // request so a follow-up ("what does section 2 say?") still sees them.
    const [convFiles, setConvFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [streaming, setStreaming] = useState(false);
    const [runningAction, setRunningAction] = useState(null);
    // "chip" when opened from the tool chip, "slash" when typed, else null.
    const [palette, setPalette] = useState(null);
    const [setupOpen, setSetupOpen] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    // Chips this session has spent, so the count under the composer moves with
    // the sends rather than sitting on whatever the profile said at load.
    const [spentHere, setSpentHere] = useState(0);

    const abortRef = useRef(null);
    const fileRef = useRef(null);
    const inputRef = useRef(null);
    const composerRef = useRef(null);
    const paletteRef = useRef(null);
    const convIdRef = useRef(null);
    const scrollRef = useRef(null);
    const threadRef = useRef(null);
    const stickRef = useRef(true);
    const [atBottom, setAtBottom] = useState(true);
    // The `/` hint rides in the placeholder only where it fits on one line and
    // where there is a keyboard to type it on. At 390 it wrapped and clipped.
    const roomy = useMedia("(min-width: 640px)");

    useEffect(() => {
        base44.auth.me().then(async (u) => {
            setUser(u);
            if (!u?.email) return;
            const [subs, convs, profiles] = await Promise.all([
                base44.entities.UserSubject.filter({ created_by: u.email, is_active: true }).catch(() => []),
                loadSavedResults(null, u.email).catch(() => []),
                base44.entities.UserProfile.filter({ created_by: u.email }).catch(() => []),
            ]);
            const me = profiles?.[0] || null;
            setProfile(me);
            const params = new URLSearchParams(window.location.search);
            // ONE PREDICATE, shared with `toolUsage` and the history rail.
            const allConvs = chatRows(convs);

            // ── WHICH TOOL ─────────────────────────────────────────────────
            // A reopened conversation, then a link somebody pressed (a prop
            // beats the URL), then what today is for, then the tool they used
            // last, then Study Coach. `openingTool` checks every candidate
            // against the catalogue — `toolById` falls back to the first tool
            // rather than returning null, so trusting it here would make every
            // stale link look valid. It used to be `CHAT_TOOLS[0]` for
            // everybody, which is Math Tutor for a Legal Studies student.
            const intent = todaysIntent(me);
            const opening = openingTool({
                conversation: startConversation?.input_data?.messages?.length ? startConversation.tool_type : null,
                link: startTool || params.get("tool"),
                intent: intent?.plan?.tool || null,
                rows: allConvs,
            });

            if (startConversation?.input_data?.messages?.length) {
                // ── A CONVERSATION IS REOPENED, NOT RESTARTED ───────────────
                // Hydrated inline rather than through `openConversation`, a
                // `const` declared further down: depending on it being bound is
                // a TDZ crash one reorder away (`hookDeps.test.mjs`).
                const c = startConversation;
                convIdRef.current = c.id;
                setActiveConvId(c.id);
                const ct = toolById(opening.why === "conversation" ? opening.id : c.tool_type);
                setActiveTool(ct.id);
                setSubjectName(c.input_data?.subject || startSubject || "");
                setToolOptions({ ...defaultOptions(ct), ...(c.input_data?.options || {}) });
                setMessages(c.input_data.messages);
                setConvFiles(c.input_data?.files || []);
            } else {
                const t = toolById(opening.id);
                setActiveTool(t.id);
                if (opening.why === "link") {
                    // ── THE SUBJECT GOES IN `subjectName`, NOT THE OPTIONS ──
                    // Every tool's `system(s, o)` reads the subject off `s`, and
                    // `subjectBlock(s)` is what loads that study's VCAA examiner
                    // profile. Set on the options alone it reached nothing the
                    // prompt reads — the half-wired shape this app keeps meeting.
                    const subject = startSubject || params.get("subject") || "";
                    if (subject) setSubjectName(subject);
                    setToolOptions(optionsFor(t, subject));
                    // THE SEED IS PUT IN THE COMPOSER, NOT SENT. A link that
                    // spends a chip before the student has read the screen
                    // would cost them something they did not press.
                    const seed = startSeed || params.get("q") || "";
                    if (seed) setInput(seed);
                } else {
                    setToolOptions(optionsFor(t, ""));
                }
            }
            const seen = new Set();
            setSubjects((subs || []).filter(s => !seen.has(s.subject_name) && seen.add(s.subject_name)));
            const deduped = [];
            const seenIds = new Set();
            for (const c of allConvs) {
                if (!seenIds.has(c.id)) { seenIds.add(c.id); deduped.push(c); }
            }
            setConversations(deduped);
        }).catch(() => {});
    }, []);

    const tool = toolById(activeTool);
    const tier = tierOf(profile?.ai_model_preference);
    const price = priceOf(tool.feature, tier);
    const stack = profile ? stackOf(profile) : null;
    const chipsLeft = stack ? Math.max(0, stack.remaining - spentHere) : null;
    const focusInput = () => requestAnimationFrame(() => inputRef.current?.focus());

    /* ── Following the conversation down ───────────────────────────────────
       It used to `scrollIntoView` on every token, so a student who scrolled up
       to reread something was dragged back down twenty times a second. It
       follows only while they are at the bottom, and a "Latest" button appears
       when they are not. */
    const onScroll = () => {
        const el = scrollRef.current;
        if (!el) return;
        const near = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_PX;
        stickRef.current = near;
        setAtBottom(near);
    };
    useEffect(() => {
        const el = scrollRef.current;
        if (!el || !messages.length || !stickRef.current) return;
        el.scrollTop = el.scrollHeight;
    }, [messages]);
    // KaTeX and the follow-up row arrive AFTER the last message change, so the
    // thread grows once nothing is left to trigger the effect above — and the
    // final lines of a reply sat under the composer. A resize is what follows
    // them, still only while the student is at the bottom.
    const hasThread = messages.length > 0;
    useEffect(() => {
        const inner = threadRef.current;
        const el = scrollRef.current;
        if (!inner || !el || typeof ResizeObserver === "undefined") return undefined;
        const ro = new ResizeObserver(() => { if (stickRef.current) el.scrollTop = el.scrollHeight; });
        ro.observe(inner);
        return () => ro.disconnect();
    }, [hasThread]);
    const jumpToLatest = () => {
        const el = scrollRef.current;
        if (!el) return;
        stickRef.current = true;
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    };

    const resetThread = () => {
        abortRef.current?.abort();
        setActiveConvId(null); convIdRef.current = null;
        setMessages([]); setAttachment(null); setConvFiles([]); setStreaming(false);
        stickRef.current = true; setAtBottom(true);
    };

    const newChat = () => {
        flushPersistRef.current();
        resetThread();
        setInput("");
        setToolOptions(optionsFor(tool, subjectName));
        setSidebarOpen(false);
        setPalette(null); setSetupOpen(false);
        focusInput();
    };

    /**
     * Choose a tool. MID-CHAT IT STARTS A NEW ONE: a conversation belongs to
     * one tool, so switching cannot re-point the thread on screen — and the
     * palette says so above the list before the choice is made. The draft
     * survives; a slash command does not, because it was never a message.
     */
    const pickTool = (id) => {
        const next = CHAT_TOOLS.find((t) => t.id === id);
        const fromSlash = palette === "slash";
        setPalette(null);
        if (fromSlash) setInput("");
        if (!next) return;
        if (id !== activeTool || messages.length > 0) {
            if (messages.length > 0) { flushPersistRef.current(); resetThread(); }
            setActiveTool(id);
            setToolOptions(optionsFor(next, subjectName));
        }
        focusInput();
    };

    const chooseSubject = (name) => {
        setSubjectName(name);
        const strand = strandFor(name);
        if (strand && (tool.options || []).some((g) => g.key === "strand")) {
            setToolOptions((prev) => ({ ...prev, strand }));
        }
    };

    const chooseOption = (key, value) => {
        setToolOptions((prev) => {
            const next = { ...prev, [key]: value };
            if (key === "section") next.focus = "general";
            return next;
        });
    };

    const openConversation = (conv) => {
        flushPersistRef.current();
        abortRef.current?.abort();
        setActiveConvId(conv.id); convIdRef.current = conv.id;
        const t = toolById(CHAT_TOOLS.some(x => x.id === conv.tool_type) ? conv.tool_type : FALLBACK_TOOL);
        setActiveTool(t.id);
        setSubjectName(conv.input_data?.subject || "");
        setToolOptions({ ...defaultOptions(t), ...(conv.input_data?.options || {}) });
        setMessages(conv.input_data.messages);
        setConvFiles(conv.input_data?.files || []);
        setAttachment(null);
        setStreaming(false); setSidebarOpen(false);
        setPalette(null); setSetupOpen(false);
        stickRef.current = true;
    };

    const deleteConversation = async (conv) => {
        try {
            await deleteResult(conv.tool_type || "ai_chat", conv.id);
            setConversations(prev => prev.filter(c => c.id !== conv.id));
            if (conv.id === activeConvId) newChat();
        } catch { toast({ title: "Couldn't delete that chat", variant: "destructive" }); }
    };

    const optsRef = useRef({});
    const filesRef = useRef([]);
    // REFS, NOT THE CLOSURE. `persist` is memoised on `user` alone; reading
    // `onSaved` through the closure would call a stale handler.
    const onSavedRef = useRef(onSaved);
    useEffect(() => { onSavedRef.current = onSaved; }, [onSaved]);
    const persist = useCallback(async (finalMessages, usedTool, usedSubject) => {
        if (!user?.email) return;
        const flat = finalMessages.map(m => `${m.role === "user" ? "Student" : "AI"}: ${m.content}`).join("\n\n");
        const payload = {
            tool_type: usedTool.id,
            // CUT ON A WORD. A sixty-character slice stored "…with a worked"
            // as a title, which reads as a rendering fault in the rail.
            title: clipTitle(finalMessages.find(m => m.role === "user")?.content || "Chat") || "Chat",
            subject_name: usedSubject || null,
            content: flat.slice(0, 20000),
            input_data: {
                tool: usedTool.id, subject: usedSubject || null,
                options: optsRef.current, files: filesRef.current, messages: finalMessages,
            },
            date_created: new Date().toISOString().split("T")[0],
        };
        const now = new Date().toISOString();
        try {
            if (convIdRef.current) {
                const { ok } = await saveResult("update", payload, convIdRef.current);
                if (ok) {
                    const id = convIdRef.current;
                    setConversations(prev => prev.map(c => c.id === id ? { ...c, ...payload, updated_date: now } : c));
                    onSavedRef.current?.({ ...payload, id, updated_date: now });
                }
            } else {
                const { ok, id } = await saveResult("create", payload);
                if (ok && id) {
                    convIdRef.current = id;
                    setActiveConvId(id);
                    const row = { ...payload, id, created_date: now, updated_date: now };
                    setConversations(prev => [row, ...prev]);
                    onSavedRef.current?.(row);
                }
            }
        } catch (e) { console.error("Chat persist failed:", e); }
    }, [user]);

    // ── Save-on-exit safety net ──────────────────────────────────────────────
    // persist() already saves after every completed reply. This catches a New
    // chat, another conversation opened, or the page left mid-thread. It skips
    // a thread still streaming — the in-flight turn persists itself.
    const flushPersist = useCallback(() => {
        if (streaming) return;
        if (messages.length === 0) return;
        if (messages.some(m => m.streaming)) return;
        persist(messages, tool, subjectName);
    }, [streaming, messages, tool, subjectName, persist]);

    // Read through a ref from every closure built on an earlier render.
    const flushPersistRef = useRef(flushPersist);
    useEffect(() => { flushPersistRef.current = flushPersist; }, [flushPersist]);
    useEffect(() => () => { flushPersistRef.current(); }, []);

    /**
     * Attach one file. Photos are RESIZED first (`acceptFiles`), the rule every
     * other upload surface keeps: Claude downsamples to ~2000px on arrival, so
     * the megapixels in a phone photo only ever cost upload time and the
     * chance of being refused.
     */
    const attachFile = async (file) => {
        if (!file) return;
        if (!tool.supportsFiles) {
            toast({ title: `${tool.label} works from what you type`, description: "Switch to a tool that reads files to attach one." });
            return;
        }
        setUploading(true);
        try {
            const [ready] = await acceptFiles([file], { toast });
            if (!ready) return;
            const r = await base44.integrations.Core.UploadFile({ file: ready });
            setAttachment({ url: r.file_url, name: ready.name });
        } catch (e) {
            toast({ title: "Upload failed", description: e.message, variant: "destructive" });
        } finally { setUploading(false); }
    };

    /**
     * Send a turn.
     *
     * REGENERATE, EDIT AND A FOLLOW-UP ARE THE SAME SEND. Each runs a turn, so
     * none gets a second copy of this function — which carries the artifact
     * branch, the file re-attachment, the streaming loop and the save. A second
     * copy is how one path quietly stops attaching documents, or saving.
     */
    const send = async ({ text: forced = null, history: forcedHistory = null } = {}) => {
        const text = forced != null ? String(forced).trim() : input.trim();
        const pending = forced != null ? null : attachment;
        if ((!text && !pending) || streaming || locked) return;
        const usedTool = tool;
        const usedSubject = subjectName;
        const usedOptions = toolOptions;
        const usedPrice = price;
        const files = pending ? [...convFiles, { url: pending.url, name: pending.name }] : convFiles;
        // A REGENERATE MUST NOT EAT A DRAFT.
        if (forced == null) { setInput(""); setAttachment(null); }
        if (pending) setConvFiles(files);
        setPalette(null); setSetupOpen(false);

        const promptText = text || `I've attached "${pending.name}". Please read it and help me with it.`;
        const userMsg = { role: "user", content: pending ? `${text ? `${text}\n\n` : ""}Attached: ${pending.name}` : text };
        const history = forcedHistory || messages;
        stickRef.current = true;
        setMessages([...history, userMsg, { role: "assistant", content: "", streaming: true }]);
        setStreaming(true);
        recordStudyAndGetStreak().catch(() => {});

        // ── Artifact path ────────────────────────────────────────────────────
        // A tool option that builds a real thing (a printable cheat sheet) goes
        // out as ONE non-streaming JSON call — streaming a schema response just
        // shows the student half-formed JSON.
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
                : { role: "assistant", content: failure, failed: true };
            const done = [...history, userMsg, msg];
            setMessages(done);
            setStreaming(false);
            if (artifact) {
                setSpentHere((n) => n + usedPrice);
                optsRef.current = usedOptions; filesRef.current = files; persist(done, usedTool, usedSubject);
            }
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
        const finalMessages = [...history, userMsg, finalText
            ? { role: "assistant", content: finalText }
            : { role: "assistant", content: "…", failed: true }];
        setMessages(finalMessages);
        setStreaming(false);
        if (finalText) {
            setSpentHere((n) => n + usedPrice);
            optsRef.current = usedOptions; filesRef.current = files; persist(finalMessages, usedTool, usedSubject);
        }
    };

    const stop = () => abortRef.current?.abort();

    /* ── Copy ──────────────────────────────────────────────────────────────
       `navigator.clipboard` is unavailable on an insecure origin and throws
       when the document is not focused, so a failure is REPORTED — a tick
       that never appears reads as a dead button. */
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

    /* ── Try again ─────────────────────────────────────────────────────────
       Runs the LAST user turn again against the thread before it, on the last
       reply only: re-running a turn from the middle would silently discard
       everything after it, which is what Edit is for and says so. */
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
       Truncates to before that turn and runs it again. The draft lives in its
       own state and NEVER in `input`, or cancelling an edit would leave the
       composer holding a message already in the thread. */
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
    // Several tools finish by writing something into the rest of the app (a
    // Quiz, Flashcards). Offered once there is a reply to work from.
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

    const followUps = followUpsFor(tool.id);

    // ── The composer's input: a message, or a `/` command ───────────────────
    const onInput = (e) => {
        const value = e.target.value;
        setInput(value);
        e.target.style.height = "auto";
        e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
        if (slashQuery(value) != null) { setPalette("slash"); setSetupOpen(false); }
        else if (palette === "slash") setPalette(null);
    };

    const onComposerKey = (e) => {
        if (palette === "slash") {
            if (paletteRef.current?.handleKey(e)) {
                e.preventDefault();
                if (e.key === "Escape") setInput("");
                return;
            }
        }
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    };

    const onPaste = (e) => {
        const files = e.clipboardData?.files;
        if (files && files.length > 0 && tool.supportsFiles) {
            e.preventDefault();
            attachFile(files[0]);
        }
    };

    /* ── Dropping a file anywhere on the conversation ──────────────────────
       The drop is ALWAYS taken, even for a tool that does not read files:
       a file dropped on a page that does not prevent it is opened by the
       browser in place of the app, and the chat is gone. */
    const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes("Files");
    const onDragOver = (e) => {
        if (!hasFiles(e) || locked) return;
        e.preventDefault();
        if (!dragOver) setDragOver(true);
    };
    const onDragLeave = (e) => {
        if (e.currentTarget.contains(e.relatedTarget)) return;
        setDragOver(false);
    };
    const onDrop = (e) => {
        if (!hasFiles(e) || locked) return;
        e.preventDefault();
        setDragOver(false);
        attachFile(e.dataTransfer.files?.[0]);
    };

    // ── What the setup chip says ─────────────────────────────────────────────
    // The subject, or the strand Math Tutor will use without one, then only the
    // settings moved off their default — a chip reading "Chemistry · Standard ·
    // Just explain" is a sentence of defaults nobody chose.
    const setupLabel = useMemo(() => {
        const bits = [];
        const groups = visibleGroups(tool, subjectName);
        const strandGroup = groups.find((g) => g.key === "strand");
        if (subjectName) bits.push(shortSubject(subjectName));
        else if (strandGroup) {
            const c = resolveChoices(strandGroup, toolOptions).find((x) => x.value === toolOptions.strand);
            bits.push(c ? shortSubject(c.label) : "Any subject");
        } else bits.push("Any subject");
        for (const g of groups) {
            if (g.key === "strand" || toolOptions[g.key] === g.default) continue;
            const c = resolveChoices(g, toolOptions).find((x) => x.value === toolOptions[g.key]);
            if (c) bits.push(c.label);
        }
        return bits.join(" · ");
    }, [tool, subjectName, toolOptions]);

    const placement = messages.length === 0 ? "down" : "up";

    /**
     * The upgrade strip a free student gets where the composer would be.
     * It REPLACES the composer rather than disabling it: a greyed-out box with
     * a lock on it invites somebody to type into something that will refuse.
     */
    const upgradeBox = (
        <Link
            to={createPageUrl("Subscription")}
            className="block rounded-2xl border border-[rgb(var(--console-accent-rgb)/0.45)]
                bg-[rgb(var(--console-accent-rgb)/0.08)] px-4 py-4 text-left transition-colors
                hover:border-[var(--console-accent-ink)]"
        >
            <p className="inline-flex items-center gap-2 text-sm font-bold text-[var(--console-ink)]">
                <Lock className="h-3.5 w-3.5 text-[var(--console-accent-ink)]" aria-hidden="true" />
                The tools are Premium
            </p>
            {/* It said "what is above" — written when the suggestions sat over
                the composer. They are BELOW it, so the sentence now points at
                them by what they are rather than by where they are. */}
            <p className="mt-1 text-[13px] leading-snug text-[var(--console-ink-dim)]">
                The suggestions from your own work are yours either way. {priceLabel()} a week unlocks
                the {CHAT_TOOLS.length} tools that act on them.
            </p>
        </Link>
    );

    const ToolIcon = tool.icon;
    const composerBox = (
        <div ref={composerRef} className="relative">
            {palette && (
                <ToolPalette
                    ref={paletteRef}
                    tools={CHAT_TOOLS}
                    activeId={activeTool}
                    query={palette === "slash" ? (slashQuery(input) ?? "") : null}
                    placement={placement}
                    anchorRef={composerRef}
                    note={messages.length > 0 ? "Picking a tool starts a new chat. This one is saved." : ""}
                    onPick={pickTool}
                    onClose={() => setPalette(null)}
                />
            )}
            {setupOpen && (
                <ComposerSetup
                    tool={tool}
                    options={toolOptions}
                    subject={subjectName}
                    subjects={subjects.map((s) => s.subject_name)}
                    placement={placement}
                    anchorRef={composerRef}
                    shortName={shortSubject}
                    onSubject={chooseSubject}
                    onOption={chooseOption}
                    onClose={() => setSetupOpen(false)}
                />
            )}
            <div className="rounded-2xl border border-[var(--console-line)] bg-[var(--console-panel)] shadow-soft
                transition-colors focus-within:border-[rgb(var(--console-accent-rgb)/0.6)]">
                {(convFiles.length > 0 || attachment) && (
                    <div className="flex flex-wrap items-center gap-1.5 px-3 pt-3">
                        {convFiles.map((f, i) => (
                            <span key={`${f.url}-${i}`}
                                className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-[var(--console-line)]
                                    bg-[var(--console-panel-2)] px-2 py-1 text-[11.5px] font-semibold text-[var(--console-ink-dim)]"
                                title="This document stays in the chat — every message is answered with it">
                                <Paperclip className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                                <span className="truncate">{f.name}</span>
                                <button type="button" onClick={() => setConvFiles(prev => prev.filter((_, j) => j !== i))}
                                    aria-label={`Remove ${f.name} from this chat`}
                                    className="text-[var(--console-ink-faint)] hover:text-[var(--console-ink)]">
                                    <X className="h-3 w-3" />
                                </button>
                            </span>
                        ))}
                        {attachment && (
                            <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-[rgb(var(--console-accent-rgb)/0.45)]
                                bg-[rgb(var(--console-accent-rgb)/0.08)] px-2 py-1 text-[11.5px] font-semibold text-[var(--console-ink)]">
                                <Paperclip className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                                <span className="truncate">{attachment.name}</span>
                                <span className="hidden sm:inline text-[10.5px] font-normal text-[var(--console-ink-faint)]">goes with your next message</span>
                                <button type="button" onClick={() => setAttachment(null)} aria-label="Remove attachment"
                                    className="text-[var(--console-ink-faint)] hover:text-[var(--console-ink)]">
                                    <X className="h-3 w-3" />
                                </button>
                            </span>
                        )}
                    </div>
                )}
                <Textarea
                    ref={inputRef}
                    value={input}
                    onChange={onInput}
                    onKeyDown={onComposerKey}
                    onPaste={onPaste}
                    placeholder={attachment
                        ? `Ask about ${attachment.name}, or just send it`
                        : `Message ${tool.label}…${roomy ? "  Type / to switch tool" : ""}`}
                    rows={1}
                    aria-label={`Message ${tool.label}`}
                    className="min-h-[52px] max-h-[200px] w-full resize-none border-0 bg-transparent px-4 pb-1 pt-3.5
                        text-[15px] leading-relaxed text-[var(--console-ink)] shadow-none
                        placeholder:text-[var(--console-ink-faint)]
                        focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <div className="flex items-center gap-1.5 px-2.5 pb-2.5 pt-1">
                    {/* ── THE TOOL, AS ONE CHIP ───────────────────────────────
                        It opens the palette. It used to be a dropdown that went
                        DISABLED once a chat began, which is the one moment
                        somebody notices they picked the wrong one. */}
                    <button
                        type="button"
                        onClick={() => { setSetupOpen(false); setPalette((p) => (p === "chip" ? null : "chip")); }}
                        aria-expanded={palette === "chip"}
                        aria-haspopup="listbox"
                        className={`inline-flex h-8 max-w-[11rem] flex-shrink-0 items-center gap-1.5 rounded-lg px-2 sm:max-w-none sm:px-2.5
                            text-[12.5px] font-bold transition-colors
                            ${palette ? "bg-[var(--console-panel-2)] text-[var(--console-ink)]"
                                : "text-[var(--console-ink)] hover:bg-[var(--console-panel-2)]"}`}
                    >
                        <ToolIcon className={`h-3.5 w-3.5 flex-shrink-0 ${tool.accentText}`} aria-hidden="true" />
                        <span className="truncate">{tool.label}</span>
                        <ChevronDown className="hidden h-3 w-3 flex-shrink-0 text-[var(--console-ink-faint)] sm:block" aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        onClick={() => { setPalette(null); setSetupOpen((o) => !o); }}
                        aria-expanded={setupOpen}
                        title="Subject and settings"
                        className={`inline-flex h-8 min-w-0 items-center gap-1.5 rounded-lg px-2 text-[12.5px] font-semibold
                            transition-colors sm:px-2.5
                            ${setupOpen ? "bg-[var(--console-panel-2)] text-[var(--console-ink)]"
                                : "text-[var(--console-ink-dim)] hover:bg-[var(--console-panel-2)] hover:text-[var(--console-ink)]"}`}
                    >
                        <SlidersHorizontal className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                        <span className="truncate">{setupLabel}</span>
                    </button>
                    <div className="ml-auto flex flex-shrink-0 items-center gap-1">
                        {tool.supportsFiles && (
                            <>
                                <input ref={fileRef} type="file" className="hidden" accept={STUDY_ACCEPT}
                                    onChange={e => { attachFile(e.target.files?.[0]); e.target.value = ""; }} />
                                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                                    aria-label="Attach a file" title="Attach a file — or drop one on the chat"
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--console-ink-faint)]
                                        transition-colors hover:bg-[var(--console-panel-2)] hover:text-[var(--console-ink)]">
                                    {uploading ? <AceShuffle size="sm" /> : <Paperclip className="h-4 w-4" />}
                                </button>
                            </>
                        )}
                        {/* ── THE PRICE IS ON SCREEN BEFORE IT IS SPENT ────────
                            megaUpload's rule. "Each send spends from this week's
                            chips" named no number, and the tools cost different
                            amounts — Math Tutor 8, Exam Questions 15. */}
                        <span
                            className={`hidden px-1 text-[11px] font-bold tabular-nums sm:inline
                                ${chipsLeft != null && chipsLeft < price ? "text-streak" : "text-[var(--console-ink-faint)]"}`}
                            title={`Each message to ${tool.label} costs ${price} chips`}
                        >
                            {price} chips
                        </span>
                        {streaming ? (
                            <button type="button" onClick={stop} aria-label="Stop generating"
                                className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-streak/50 text-streak">
                                <Square className="h-3.5 w-3.5" fill="currentColor" />
                            </button>
                        ) : (
                            <button type="button" onClick={() => send()} disabled={!input.trim() && !attachment}
                                aria-label="Send message"
                                className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--console-accent)]
                                    text-[var(--console-on-accent)] transition-opacity disabled:opacity-35">
                                <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.5} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    const lastIndex = messages.length - 1;

    return (
        <div className="flex h-full min-h-0">
            {/* ── History: the page's left edge on a wide screen ── */}
            <aside className="hidden md:flex w-[264px] flex-shrink-0 flex-col border-r border-[var(--console-line)]
                bg-[var(--console-panel)] min-h-0">
                <ChatHistory
                    rows={conversations}
                    activeId={activeConvId}
                    onOpen={openConversation}
                    onDelete={deleteConversation}
                    onNew={newChat}
                />
            </aside>

            {/* ── History drawer on a phone ── */}
            <AnimatePresence>
                {sidebarOpen && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)}>
                        <motion.div initial={{ x: -320 }} animate={{ x: 0 }} exit={{ x: -320 }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className="h-full w-80 max-w-[85vw] bg-[var(--console-panel)] shadow-soft-lg"
                            onClick={e => e.stopPropagation()}>
                            <ChatHistory
                                rows={conversations}
                                activeId={activeConvId}
                                onOpen={openConversation}
                                onDelete={deleteConversation}
                                onNew={newChat}
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <section
                className="relative flex min-h-0 min-w-0 flex-1 flex-col"
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
            >
                {/* ── ONE ROW OF CHROME ────────────────────────────────────────
                    On a phone it was three bordered buttons that wrapped to two
                    lines each at 390. It is the drawer, the title and New chat,
                    on one line; a wide screen has the rail and draws this only
                    once there is a conversation to name. */}
                <header className={`flex h-12 flex-shrink-0 items-center gap-1 border-b border-[var(--console-line)] px-2 sm:px-4
                    ${messages.length === 0 ? "md:hidden" : ""}`}>
                    <button type="button" onClick={() => setSidebarOpen(true)} aria-label="Open your chats"
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--console-ink-dim)]
                            hover:bg-[var(--console-panel-2)] md:hidden">
                        <PanelLeft className="h-[18px] w-[18px]" />
                    </button>
                    <div className="flex min-w-0 flex-1 items-center justify-center gap-2 md:justify-start">
                        {messages.length > 0 ? (
                            <>
                                <ToolIcon className={`h-4 w-4 flex-shrink-0 ${tool.accentText}`} aria-hidden="true" />
                                <p className="truncate text-[13px] font-bold text-[var(--console-ink)]">{tool.label}</p>
                                {subjectName && (
                                    <span className="hidden truncate text-[13px] text-[var(--console-ink-faint)] sm:inline">· {subjectName}</span>
                                )}
                            </>
                        ) : (
                            <p className="text-[13px] font-bold text-[var(--console-ink)]">New chat</p>
                        )}
                    </div>
                    <button type="button" onClick={newChat} aria-label="New chat"
                        className={`flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-bold text-[var(--console-ink-dim)]
                            hover:bg-[var(--console-panel-2)] hover:text-[var(--console-ink)]
                            ${messages.length === 0 ? "invisible" : ""}`}>
                        <Plus className="h-4 w-4" />
                        <span className="hidden sm:inline">New chat</span>
                    </button>
                </header>

                {/* ── Thread — the conversation IS the page ── */}
                <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
                    {messages.length === 0 ? (
                        /* The composer is passed down rather than rebuilt, so
                           there is exactly one of it and the empty state cannot
                           drift from the one typed into on every later turn. */
                        <ChatWelcome
                            tool={tool}
                            tools={CHAT_TOOLS}
                            cards={cards}
                            usage={usage}
                            locked={locked}
                            loading={briefLoading}
                            firstName={firstName}
                            price={locked ? null : price}
                            labelFor={labelForTool}
                            onOpenCard={onOpenCard}
                            onPickTool={pickTool}
                        >
                            {locked ? upgradeBox : composerBox}
                        </ChatWelcome>
                    ) : (
                        <div ref={threadRef} className="mx-auto max-w-3xl space-y-7 px-4 pb-6 pt-6">
                            {messages.map((m, i) => (
                                m.role === "user" ? (
                                    <div key={i} className="flex justify-end">
                                        {editing === i ? (
                                            /* Full measure: a box you are typing into needs the
                                               width, and the thread below it is about to go. */
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
                                                    <button type="button" onClick={() => { setEditing(-1); setEditDraft(""); }}
                                                        className="rounded-lg px-2.5 py-1 text-xs font-bold text-[var(--console-ink-faint)] hover:text-[var(--console-ink)]">
                                                        Cancel
                                                    </button>
                                                    <button type="button" onClick={commitEdit} disabled={!editDraft.trim() || streaming}
                                                        className="rounded-lg bg-[var(--console-accent)] px-3 py-1 text-xs font-bold
                                                            text-[var(--console-on-accent)] disabled:opacity-50">
                                                        Send again · {price} chips
                                                    </button>
                                                </div>
                                                {/* THE REST OF THE THREAD GOES. Said before the press. */}
                                                <p className="mt-1.5 text-right text-[10.5px] text-[var(--console-ink-faint)]">
                                                    Replies after this one are replaced.
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="group max-w-[88%] sm:max-w-[75%]">
                                                <div className="whitespace-pre-wrap rounded-2xl rounded-br-md border border-[var(--console-line)]
                                                    bg-[var(--console-panel)] px-4 py-2.5 text-[14.5px] leading-relaxed text-[var(--console-ink)]">
                                                    {m.content}
                                                </div>
                                                {!locked && !streaming && (
                                                    <div className={`mt-1 flex justify-end gap-0.5 transition-opacity ${HOVER_REVEAL}`}>
                                                        <RowAction label="Copy" onClick={() => copyMessage(i, m.content)}
                                                            icon={copiedAt === i ? Check : Copy} done={copiedAt === i} />
                                                        <RowAction label="Edit" icon={Pencil} onClick={() => beginEdit(i, m.content)} />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div key={i} className="group">
                                        {/* WHO IS SPEAKING. The tool's own hue is right here,
                                            where it names the speaker; it is the phase on the
                                            welcome, which lists all twelve at once. */}
                                        <div className="mb-2 flex items-center gap-2">
                                            <span className={`flex h-6 w-6 items-center justify-center rounded-md ${tool.accentBg}`}>
                                                <ToolIcon className={`h-3.5 w-3.5 ${tool.accentText}`} aria-hidden="true" />
                                            </span>
                                            <span className="text-[12.5px] font-bold text-[var(--console-ink-dim)]">{tool.label}</span>
                                        </div>
                                        <div className="min-w-0 text-[15px] leading-relaxed text-[var(--console-ink)] sm:pl-8">
                                            {m.content
                                                ? <MarkdownMath isStreaming={!!m.streaming}>{m.content}</MarkdownMath>
                                                : <span className="inline-flex items-center gap-2 text-[var(--console-ink-faint)]"><AceShuffle size="sm" /> Thinking…</span>}
                                            {m.artifact?.kind === "cheat_sheet" && (
                                                <CheatSheetArtifact initialItems={m.artifact.data} subject={subjectName}
                                                    title={m.artifact.title} defaultPages={m.artifact.pages || 1} />
                                            )}
                                            {m.artifact?.kind === "exam_questions" && (
                                                <ExamQuestionsArtifact questions={m.artifact.data} subject={subjectName} title={m.artifact.title} />
                                            )}
                                            {m.artifact?.kind === "line_memoriser" && (
                                                <LineMemoriserArtifact lines={m.artifact.data} title={m.artifact.title} />
                                            )}

                                            {/* ── Copy, and run it again ─────────────────────────
                                                On the latest reply the row is ALWAYS there; on
                                                older ones it reveals on hover where there is a
                                                hover, and is simply there on a phone. */}
                                            {!m.streaming && m.content && !locked && (
                                                <div className={`mt-2 flex items-center gap-0.5 transition-opacity
                                                    ${i === lastIndex ? "" : HOVER_REVEAL}`}>
                                                    <RowAction label="Copy" onClick={() => copyMessage(i, m.content)}
                                                        icon={copiedAt === i ? Check : Copy} done={copiedAt === i} />
                                                    {i === lastIndex && (
                                                        <RowAction label="Try again" icon={RotateCcw} onClick={regenerate} disabled={streaming} />
                                                    )}
                                                </div>
                                            )}

                                            {/* ── WHAT TO ASK NEXT ──────────────────────────────
                                                A fixed list per tool (`FOLLOW_UPS`), in the
                                                student's own voice because a tap SENDS it — and
                                                so the price is printed on the row, before it. */}
                                            {i === lastIndex && !m.streaming && !m.failed && m.content && !locked && followUps.length > 0 && (
                                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                                    <span className="text-[11px] font-bold text-[var(--console-ink-faint)]">
                                                        Next · {price} chips{followUps.length > 1 ? " each" : ""}
                                                    </span>
                                                    {followUps.map((f) => (
                                                        <button key={f.id} type="button" disabled={streaming}
                                                            onClick={() => send({ text: f.text })}
                                                            title={f.text}
                                                            className="rounded-full border border-[var(--console-line)] bg-[var(--console-panel)]
                                                                px-3 py-1.5 text-[12.5px] font-semibold text-[var(--console-ink)] transition-colors
                                                                hover:border-[rgb(var(--console-accent-rgb)/0.6)] disabled:opacity-50">
                                                            {f.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Things the old standalone tools ended with —
                                                writing a quiz or a deck into the rest of the app. */}
                                            {i === lastIndex && !m.streaming && toolActions.length > 0 && !locked && (
                                                <div className="mt-2.5 flex flex-wrap gap-2">
                                                    {toolActions.map(a => (
                                                        <button key={a.id} type="button" disabled={!!runningAction}
                                                            onClick={() => runAction(a.id)}
                                                            className="inline-flex items-center gap-1.5 rounded-xl border border-[rgb(var(--console-accent-rgb)/0.45)]
                                                                px-3 py-1.5 text-[12.5px] font-bold text-[var(--console-accent-ink)]
                                                                transition-colors hover:bg-[rgb(var(--console-accent-rgb)/0.08)] disabled:opacity-50">
                                                            {runningAction === a.id
                                                                ? <><AceShuffle size="sm" /> {a.busy}</>
                                                                : <><Wand2 className="h-3.5 w-3.5" /> {a.label}</>}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Composer — pinned once a chat is running ── */}
                {messages.length > 0 && (
                    <div className="relative w-full flex-shrink-0 px-3 pb-3 pt-1 sm:px-5">
                        {!atBottom && (
                            <button type="button" onClick={jumpToLatest}
                                className="absolute bottom-full left-1/2 mb-1 inline-flex -translate-x-1/2 items-center gap-1.5
                                    rounded-full border border-[var(--console-line)] bg-[var(--console-panel)] px-3 py-1.5
                                    text-[12px] font-bold text-[var(--console-ink)] shadow-soft">
                                <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" /> Latest
                            </button>
                        )}
                        <div className="mx-auto max-w-3xl">
                            {locked ? upgradeBox : composerBox}
                            {/* On a phone the price leaves the composer's row, where
                                a bare "8" beside a paperclip said nothing, and is
                                said here in words. */}
                            {!locked && (
                                <p className="pt-1.5 text-center text-[10.5px] text-[var(--console-ink-faint)]">
                                    <span className="hidden sm:inline">Saved as you go</span>
                                    <span className="sm:hidden">{price} chips a message</span>
                                    {chipsLeft != null && <> · {chipsLeft} chips left this week</>}
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Drop anywhere ── */}
                {dragOver && (
                    <div className="pointer-events-none absolute inset-2 z-40 flex items-center justify-center rounded-2xl border-2
                        border-dashed border-[var(--console-accent-ink)] bg-[rgb(var(--console-accent-rgb)/0.08)]">
                        <p className="rounded-xl bg-[var(--console-panel)] px-4 py-2.5 text-sm font-bold text-[var(--console-ink)] shadow-soft">
                            {tool.supportsFiles ? `Drop to attach it for ${tool.label}` : `${tool.label} works from what you type`}
                        </p>
                    </div>
                )}
            </section>
        </div>
    );
}
