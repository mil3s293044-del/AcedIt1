import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Send, Lock, Flame, Zap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import MarkdownMath from "@/components/shared/MarkdownMath";
import { streamAce } from "@/lib/aiClient";
import { TierBlockedError } from "@/lib/aiClient";
import { isPremium } from "@/lib/tierAccess";
import { createPageUrl } from "@/utils";

// ─── Ace — floating premium study companion ─────────────────────────────────
// A clean, on-brand chat buddy mounted globally. Premium users can ask Ace
// anything about their study; free users see an upgrade prompt. Runs on a
// cheap server-side model but bills into the weekly AI budget.

const SUGGESTIONS = [
    "How should I plan my revision this week?",
    "I'm feeling unmotivated — help me start.",
    "Quiz me on something to warm up.",
    "How do I write a better essay intro?",
];

// Small avatar used in the FAB + header. Clean gradient mark, no mascot art.
function AceMark({ className = "w-6 h-6" }) {
    return (
        <div
            className={`relative grid place-items-center rounded-full ${className}`}
            style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--xp)))" }}
        >
            <Sparkles className="w-1/2 h-1/2 text-white" strokeWidth={2.5} />
        </div>
    );
}

export default function AceCompanion({ userProfile }) {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState([]); // {role, content}
    const [input, setInput] = useState("");
    const [streaming, setStreaming] = useState(false);
    const [error, setError] = useState(null);
    const [blocked, setBlocked] = useState(null); // {message} when tier-blocked mid-chat
    const scrollRef = useRef(null);
    const inputRef = useRef(null);
    const abortRef = useRef(null);

    const premium = isPremium(userProfile);

    const context = useMemo(() => {
        const p = userProfile || {};
        const ctx = {
            name: p.username || p.full_name || p.display_name || "",
            streak: p.streak_days ?? p.current_streak ?? 0,
            xp: p.total_xp ?? 0,
        };
        if (Array.isArray(p.subjects)) {
            ctx.subjects = p.subjects
                .map((s) => (typeof s === "string" ? s : s?.name || s?.subject || s?.title))
                .filter(Boolean);
        }
        return ctx;
    }, [userProfile]);

    // Auto-scroll to the newest message as it streams.
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages, streaming]);

    useEffect(() => {
        if (open && premium) setTimeout(() => inputRef.current?.focus(), 250);
    }, [open, premium]);

    const send = useCallback(async (text) => {
        const content = (text ?? input).trim();
        if (!content || streaming) return;

        setError(null);
        setBlocked(null);
        setInput("");

        const history = [...messages, { role: "user", content }];
        // Add the user turn + an empty assistant turn we'll stream into.
        setMessages([...history, { role: "assistant", content: "" }]);
        setStreaming(true);

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            await streamAce(
                history,
                context,
                (_delta, soFar) => {
                    setMessages((prev) => {
                        const next = [...prev];
                        next[next.length - 1] = { role: "assistant", content: soFar };
                        return next;
                    });
                },
                { signal: controller.signal },
            );
        } catch (err) {
            if (err?.name === "AbortError") {
                // User stopped — drop the trailing empty assistant bubble.
                setMessages((prev) => {
                    const next = [...prev];
                    if (next.length && next[next.length - 1].role === "assistant" && !next[next.length - 1].content) {
                        next.pop();
                    }
                    return next;
                });
            } else if (err instanceof TierBlockedError) {
                // Remove the empty assistant bubble and show an inline block.
                setMessages((prev) => prev.slice(0, -1));
                setBlocked({ message: err.message, upgradeRequired: err.upgradeRequired });
            } else {
                setMessages((prev) => prev.slice(0, -1));
                setError(err?.message || "Ace had trouble responding. Try again.");
            }
        } finally {
            setStreaming(false);
            abortRef.current = null;
        }
    }, [input, streaming, messages, context]);

    const stop = useCallback(() => {
        try { abortRef.current?.abort(); } catch { /* noop */ }
    }, []);

    const onKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    };

    return (
        <>
            {/* Floating action button */}
            <AnimatePresence>
                {!open && (
                    <motion.button
                        key="ace-fab"
                        initial={{ opacity: 0, scale: 0.6, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.6, y: 10 }}
                        transition={{ type: "spring", stiffness: 380, damping: 24 }}
                        whileHover={{ scale: 1.06 }}
                        whileTap={{ scale: 0.94 }}
                        onClick={() => setOpen(true)}
                        aria-label="Open Ace, your study companion"
                        className="fixed right-4 md:right-6 bottom-24 md:bottom-6 z-40 flex items-center gap-2 pl-2 pr-4 py-2 rounded-full shadow-soft bg-surface border border-border hover:shadow-lg transition-shadow"
                    >
                        <AceMark className="w-9 h-9" />
                        <span className="font-display font-extrabold text-sm text-foreground">Ace</span>
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Chat panel */}
            <AnimatePresence>
                {open && (
                    <>
                        {/* Backdrop (mobile) */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setOpen(false)}
                            className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-[2px] md:bg-transparent md:backdrop-blur-0 md:pointer-events-none"
                        />

                        <motion.div
                            key="ace-panel"
                            initial={{ opacity: 0, y: 24, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 24, scale: 0.96 }}
                            transition={{ type: "spring", stiffness: 320, damping: 26 }}
                            className="fixed z-50 right-0 bottom-0 left-0 md:left-auto md:right-6 md:bottom-6 md:w-[400px] h-[78vh] md:h-[600px] md:max-h-[80vh] flex flex-col bg-surface border border-border rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden"
                        >
                            {/* Header */}
                            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface">
                                <AceMark className="w-10 h-10" />
                                <div className="flex-1 min-w-0">
                                    <p className="font-display font-extrabold text-foreground leading-tight">Ace</p>
                                    <p className="text-xs text-muted-foreground leading-tight">Your study companion</p>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="rounded-xl">
                                    <X className="w-5 h-5" />
                                </Button>
                            </div>

                            {/* Body */}
                            {!premium ? (
                                <UpgradeView onUpgrade={() => { setOpen(false); navigate(createPageUrl("Subscription")); }} />
                            ) : (
                                <>
                                    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                                        {messages.length === 0 && (
                                            <Welcome name={context.name} streak={context.streak} xp={context.xp} onPick={(q) => send(q)} />
                                        )}

                                        {messages.map((m, i) => (
                                            <MessageBubble
                                                key={i}
                                                role={m.role}
                                                content={m.content}
                                                streaming={streaming && i === messages.length - 1 && m.role === "assistant"}
                                            />
                                        ))}

                                        {blocked && (
                                            <div className="rounded-2xl border border-xp/30 bg-xp/5 p-4 text-center">
                                                <p className="text-sm text-foreground font-semibold mb-2">{blocked.message}</p>
                                                {blocked.upgradeRequired && (
                                                    <Button size="sm" onClick={() => { setOpen(false); navigate(createPageUrl("Subscription")); }} className="rounded-xl">
                                                        Upgrade
                                                    </Button>
                                                )}
                                            </div>
                                        )}

                                        {error && (
                                            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-center">
                                                <p className="text-sm text-destructive">{error}</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Composer */}
                                    <div className="border-t border-border p-3 bg-surface">
                                        <div className="flex items-end gap-2 rounded-2xl border border-border bg-secondary/40 px-3 py-2 focus-within:border-primary/50 transition-colors">
                                            <textarea
                                                ref={inputRef}
                                                value={input}
                                                onChange={(e) => setInput(e.target.value)}
                                                onKeyDown={onKeyDown}
                                                rows={1}
                                                placeholder="Ask Ace anything about your study…"
                                                className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none max-h-28 leading-relaxed py-1"
                                            />
                                            {streaming ? (
                                                <Button size="icon" variant="ghost" onClick={stop} className="rounded-xl flex-shrink-0" aria-label="Stop">
                                                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                                                </Button>
                                            ) : (
                                                <Button
                                                    size="icon"
                                                    onClick={() => send()}
                                                    disabled={!input.trim()}
                                                    className="rounded-xl flex-shrink-0"
                                                    aria-label="Send"
                                                >
                                                    <Send className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground text-center mt-1.5">
                                            Ace can make mistakes — double-check anything important.
                                        </p>
                                    </div>
                                </>
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}

function MessageBubble({ role, content, streaming }) {
    const isUser = role === "user";
    return (
        <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
            <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                    isUser
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-secondary text-foreground rounded-bl-md"
                }`}
            >
                {isUser ? (
                    <p className="whitespace-pre-wrap leading-relaxed">{content}</p>
                ) : content ? (
                    <MarkdownMath isStreaming={streaming}>{content}</MarkdownMath>
                ) : (
                    <span className="inline-flex gap-1 py-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                )}
            </div>
        </div>
    );
}

function Welcome({ name, streak, xp, onPick }) {
    const first = (name || "").split(" ")[0];
    return (
        <div className="text-center pt-2">
            <AceMark className="w-16 h-16 mx-auto mb-3" />
            <h3 className="font-display font-extrabold text-foreground text-lg">
                Hey{first ? ` ${first}` : ""}, I'm Ace 👋
            </h3>
            <p className="text-sm text-muted-foreground mt-1 px-4">
                Your study buddy. Ask me about revision, exam technique, staying motivated — anything.
            </p>

            {(streak > 0 || xp > 0) && (
                <div className="flex items-center justify-center gap-2 mt-3">
                    {streak > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-streak bg-streak/10 rounded-full px-2.5 py-1">
                            <Flame className="w-3.5 h-3.5" /> {streak} day streak
                        </span>
                    )}
                    {xp > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-xp bg-xp/10 rounded-full px-2.5 py-1">
                            <Zap className="w-3.5 h-3.5" /> {xp} XP
                        </span>
                    )}
                </div>
            )}

            <div className="mt-5 space-y-2 text-left">
                {SUGGESTIONS.map((q) => (
                    <button
                        key={q}
                        onClick={() => onPick(q)}
                        className="w-full text-left text-sm text-foreground bg-secondary/60 hover:bg-secondary rounded-xl px-3.5 py-2.5 transition-colors"
                    >
                        {q}
                    </button>
                ))}
            </div>
        </div>
    );
}

function UpgradeView({ onUpgrade }) {
    return (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-8">
            <div className="relative mb-4">
                <AceMark className="w-20 h-20" />
                <div className="absolute -bottom-1 -right-1 grid place-items-center w-8 h-8 rounded-full bg-surface border border-border">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                </div>
            </div>
            <h3 className="font-display font-extrabold text-foreground text-xl">Meet Ace</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-xs">
                Your personal study companion — ask anything about revision, exams, motivation, and your subjects.
                Ace is a Premium perk.
            </p>
            <Button onClick={onUpgrade} className="rounded-xl mt-5 font-bold gap-1.5">
                <Sparkles className="w-4 h-4" /> Unlock Ace with Premium
            </Button>
        </div>
    );
}
