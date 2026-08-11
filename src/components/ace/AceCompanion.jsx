/**
 * Ace — the ace of spades, and the only thing in the app whose job is
 * explaining the app.
 *
 * Two things changed here, and they're both structural rather than cosmetic.
 *
 * FIRST: Ace was premium-only. The one component built to explain AcedIt
 * showed free users an upgrade wall, which meant the people least likely to
 * understand the product were the only people it refused to talk to. He's now
 * split in two — a rules-based guide that answers "what is this", "where is
 * it" and "what should I do now" for everybody at no cost, and the language
 * model, which stays Premium and handles the half that actually needs it.
 *
 * SECOND: Ace knew nothing about AcedIt. His system prompt carried the
 * student's name, streak and XP and not one word about our own features, so
 * every answer about the product was improvised. He now reads the same feature
 * map the rest of the guidance does, and — more usefully — he can open the
 * thing he's describing rather than reciting a path to it.
 *
 * The opening screen is a dealt hand, not a greeting. "Hey, ask me anything"
 * puts the work back on someone who came here because they didn't know what to
 * do; three cards that already read their data don't.
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Loader2, ArrowRight, Lock, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import MarkdownMath from "@/components/shared/MarkdownMath";
import SpadeMark, { AceCard } from "@/components/ace/SpadeMark";
import useAceYield from "@/components/ace/useAceYield";
import { streamAce, TierBlockedError } from "@/lib/aiClient";
import { isPremium } from "@/lib/tierAccess";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { dealHand, answer, openers } from "@/lib/aceGuide";
import { readsAsDismissal, readsAsRecall, DISMISS, pick } from "@/lib/aceVoice";
import { turnOff, turnOn } from "@/lib/aceBuddy";
import { deck, deckBySection, STATE } from "@/lib/aceDeck";
import { SECTIONS, BY_ID, PAGES, featuresForPage, readiness } from "@/lib/aceKnowledge";

// Static class strings — Tailwind never sees a class built from a variable.
const TONE = {
    primary: { bar: "bg-primary", tint: "bg-primary/5",  edge: "border-primary/30" },
    streak:  { bar: "bg-streak",  tint: "bg-streak/5",   edge: "border-streak/30" },
    xp:      { bar: "bg-xp",      tint: "bg-xp/5",       edge: "border-xp/30" },
    "chart-3": { bar: "bg-chart-3", tint: "bg-chart-3/5", edge: "border-chart-3/30" },
    "chart-4": { bar: "bg-chart-4", tint: "bg-chart-4/5", edge: "border-chart-4/30" },
    map:     { bar: "bg-map",     tint: "bg-map/5",      edge: "border-map/30" },
};

export default function AceCompanion({ userProfile }) {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    // The XP popup stack sits at exactly these coordinates on a phone and wins
    // on z-index, so it covers him outright. He gets out of its way instead.
    const yielding = useAceYield();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [streaming, setStreaming] = useState(false);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);        // the student's own rows
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef(null);
    const inputRef = useRef(null);
    const abortRef = useRef(null);

    const premium = isPremium(userProfile);

    // ── Draggable launcher ───────────────────────────────────────────────
    // The default corner can sit on top of other controls, so it moves and the
    // position sticks. Double-click snaps it home.
    const PILL_POS_KEY = "acedit_ace_pill_pos_v1";
    const [pillPos, setPillPos] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(PILL_POS_KEY));
            if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) return saved;
        } catch { /* first run / private mode */ }
        return { x: 0, y: 0 };
    });
    const draggedRef = useRef(false);
    const savePillPos = (pos) => {
        setPillPos(pos);
        try { localStorage.setItem(PILL_POS_KEY, JSON.stringify(pos)); } catch { /* private mode */ }
    };
    const onPillDragEnd = (_e, info) => {
        savePillPos({
            x: Math.min(12, Math.max(-(window.innerWidth - 110), pillPos.x + info.offset.x)),
            y: Math.min(12, Math.max(-(window.innerHeight - 140), pillPos.y + info.offset.y)),
        });
        setTimeout(() => { draggedRef.current = false; }, 150);
    };

    // ── The student's own rows ───────────────────────────────────────────
    // Loaded on first open rather than at mount: Ace sits on every page in the
    // app, and seven queries per navigation to populate a panel nobody opened
    // is a tax on the whole product.
    const load = useCallback(async () => {
        if (data || loading) return;
        setLoading(true);
        try {
            const me = await base44.auth.me();
            const email = me?.email;
            if (!email) { setData({}); return; }
            const q = (entity, extra = {}, ...rest) =>
                base44.entities[entity].filter({ created_by: email, ...extra }, ...rest).catch(() => []);
            const [subjects, flashcards, assessments, techniques, maps, plans, friends] = await Promise.all([
                q("UserSubject", { is_active: true }),
                q("Flashcard", { is_active: true }),
                q("SubjectAssessment", {}, "due_date", 20),
                q("StudyTechnique", {}, "-date", 120),
                q("MindMap", {}, "-updated_date", 60),
                q("StudyPlan", {}, "date", 40),
                q("Friendship", {}),
            ]);
            setData({ subjects, flashcards, assessments, techniques, maps, plans, friends });
        } catch {
            // An unreachable database shouldn't take the guide down with it —
            // the feature map still works, so "what is blurting" still answers.
            setData({});
        } finally { setLoading(false); }
    }, [data, loading]);

    useEffect(() => { if (open) load(); }, [open, load]);

    // Anything in the app can hand over to Ace — the first-run card does it,
    // and a `page` in the detail means "open showing what's on that page"
    // rather than the usual hand.
    useEffect(() => {
        const onOpen = (e) => {
            const page = e?.detail?.page;
            setOpen(true);
            setMessages(page ? [{ role: "ace", pageTour: page }] : []);
        };
        window.addEventListener("ace:open", onOpen);
        return () => window.removeEventListener("ace:open", onOpen);
    }, []);

    const hand = useMemo(() => (data ? dealHand({
        ...data,
        atarComponents: userProfile?.atar_components || null,
    }) : null), [data, userProfile]);

    const ready = useMemo(() => (data ? readiness(data) : null), [data]);
    const myDeck = useMemo(() => (data ? deck(data) : null), [data]);

    // Follow the conversation, but never on the opening screen — the hand
    // arriving counted as new content, so the panel opened already scrolled
    // past its own heading and first card.
    //
    // And a reply that fills more than a screen — the deck, the tour, a page
    // walkthrough — wants its TOP in view, not its bottom. Scrolling to the
    // end of those dropped the student at the last row of a list whose
    // heading and summary they never saw.
    useEffect(() => {
        const el = scrollRef.current;
        if (!el || !messages.length) return;
        const last = messages[messages.length - 1];
        const isScreen = last?.deck || last?.tour || last?.pageTour;
        const node = el.lastElementChild;
        if (isScreen && node) el.scrollTop = Math.max(0, node.offsetTop - el.offsetTop - 8);
        else el.scrollTop = el.scrollHeight;
    }, [messages, streaming]);

    useEffect(() => {
        if (open) setTimeout(() => inputRef.current?.focus(), 250);
    }, [open]);

    const go = useCallback((to) => {
        setOpen(false);
        // Feature routes are stored as real paths; createPageUrl exists for
        // page NAMES, and running a path through it would double the slash.
        navigate(to.startsWith("/") ? to : createPageUrl(to));
    }, [navigate]);

    // ── Asking ───────────────────────────────────────────────────────────
    const ask = useCallback(async (text) => {
        const content = String(text ?? input).trim();
        if (!content || streaming) return;
        setError(null);
        setInput("");
        const asked = [...messages, { role: "user", content }];

        // "Go away" is a sentence, not just a button. Someone who types it and
        // gets a feature lookup back has been ignored by the one thing in the
        // app whose whole job is listening — so it's checked before anything
        // else, and it actually does what it says.
        if (readsAsDismissal(content)) {
            turnOff();
            setMessages([...asked, { role: "ace", dismissed: true }]);
            return;
        }
        if (readsAsRecall(content)) {
            turnOn();
            setMessages([...asked, { role: "ace", recalled: true }]);
            return;
        }

        // The guide gets first refusal on everything. It's instant, it's free,
        // and it cannot invent a feature — so a question it can answer should
        // never cost a model call or a Premium check.
        const guided = answer(content, { ready, premium });
        if (guided?.kind === "hand") {
            setMessages([...asked, { role: "ace", hand: true }]);
            return;
        }
        if (guided?.kind === "feature") {
            setMessages([...asked, { role: "ace", ...guided }]);
            return;
        }

        // Past here it's a real question about the world, which is the part
        // that needs the model.
        if (!premium) {
            setMessages([...asked, { role: "ace", upgrade: true }]);
            return;
        }

        setMessages([...asked, { role: "assistant", content: "" }]);
        setStreaming(true);
        const controller = new AbortController();
        abortRef.current = controller;
        try {
            await streamAce(
                asked.filter(m => m.role === "user" || m.role === "assistant")
                    .map(m => ({ role: m.role, content: m.content })),
                {
                    name: userProfile?.username || userProfile?.full_name || "",
                    streak: userProfile?.streak_days ?? 0,
                    xp: userProfile?.total_xp ?? 0,
                    subjects: (data?.subjects || []).map(s => s.subject_name).filter(Boolean),
                },
                (_delta, soFar) => setMessages(prev => {
                    const next = [...prev];
                    next[next.length - 1] = { role: "assistant", content: soFar };
                    return next;
                }),
                { signal: controller.signal },
            );
        } catch (err) {
            if (err?.name === "AbortError") {
                setMessages(prev => {
                    const next = [...prev];
                    const last = next[next.length - 1];
                    if (last?.role === "assistant" && !last.content) next.pop();
                    return next;
                });
            } else if (err instanceof TierBlockedError) {
                setMessages(prev => [...prev.slice(0, -1), { role: "ace", upgrade: true, note: err.message }]);
            } else {
                setMessages(prev => prev.slice(0, -1));
                setError(err?.message || "Ace had trouble responding. Try again.");
            }
        } finally {
            setStreaming(false);
            abortRef.current = null;
        }
    }, [input, streaming, messages, ready, premium, userProfile, data]);

    const stop = () => { try { abortRef.current?.abort(); } catch { /* noop */ } };

    return (
        <>
            <AnimatePresence>
                {!open && !yielding && (
                    <motion.div key="ace-fab" drag dragMomentum={false} dragElastic={0.08}
                        onDragStart={() => { draggedRef.current = true; }}
                        onDragEnd={onPillDragEnd}
                        style={{ x: pillPos.x, y: pillPos.y, touchAction: "none" }}
                        className="fixed right-4 md:right-6 bottom-24 md:bottom-6 z-40 cursor-grab active:cursor-grabbing">
                        <motion.button
                            initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.6, x: 60 }}
                            transition={{ type: "spring", stiffness: 380, damping: 24 }}
                            whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
                            onClick={() => { if (!draggedRef.current) setOpen(true); }}
                            onDoubleClick={() => savePillPos({ x: 0, y: 0 })}
                            aria-label="Open Ace, your guide to AcedIt"
                            title="Drag me anywhere · double-click to snap back"
                            data-ace-fab
                            className="flex items-center gap-2 pl-1.5 pr-4 py-1.5 rounded-full shadow-soft bg-surface border-2 border-border hover:shadow-soft-lg transition-shadow">
                            <SpadeMark className="w-9 h-9" />
                            <span className="font-display font-extrabold text-sm text-foreground">Ace</span>
                        </motion.button>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {open && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setOpen(false)}
                            className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-[2px] md:bg-transparent md:backdrop-blur-0 md:pointer-events-none" />

                        <motion.div key="ace-panel"
                            initial={{ opacity: 0, y: 24, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 24, scale: 0.96 }}
                            transition={{ type: "spring", stiffness: 320, damping: 26 }}
                            data-ace-panel
                            className="fixed z-50 right-0 bottom-0 left-0 md:left-auto md:right-6 md:bottom-6 md:w-[420px] h-[82vh] md:h-[640px] md:max-h-[84vh] flex flex-col bg-surface border-2 border-border rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden">

                            <div className="flex items-center gap-3 px-4 py-3 border-b-2 border-border">
                                <SpadeMark className="w-10 h-10" mood={streaming ? "thinking" : "idle"} />
                                <div className="flex-1 min-w-0">
                                    <p className="font-display font-extrabold text-foreground leading-tight">Ace</p>
                                    <p className="text-xs text-muted-foreground leading-tight">
                                        Knows every corner of this app
                                    </p>
                                </div>
                                {messages.length > 0 && (
                                    <button onClick={() => { setMessages([]); setError(null); }}
                                        aria-label="Start over"
                                        className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg">
                                        <RefreshCw className="w-4 h-4" />
                                    </button>
                                )}
                                <Button variant="ghost" size="icon" onClick={() => setOpen(false)}
                                    className="rounded-xl" aria-label="Close">
                                    <X className="w-5 h-5" />
                                </Button>
                            </div>

                            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                                {messages.length === 0 && (
                                    <Opening hand={hand} loading={loading} ready={ready}
                                        onGo={go} onAsk={ask} deck={myDeck}
                                        onTour={() => setMessages([{ role: "ace", tour: true }])}
                                        onDeck={() => setMessages([{ role: "ace", deck: true }])} />
                                )}

                                {messages.map((m, i) => (
                                    <Turn key={i} m={m} hand={hand} deck={myDeck}
                                        streaming={streaming && i === messages.length - 1}
                                        onGo={go} onUpgrade={() => go("/Subscription")} />
                                ))}

                                {error && (
                                    <div className="rounded-2xl border-2 border-destructive/30 bg-destructive/5 p-3 text-center">
                                        <p className="text-sm text-destructive">{error}</p>
                                    </div>
                                )}
                            </div>

                            <div className="border-t-2 border-border p-3">
                                <div className="flex items-end gap-2 rounded-2xl border-2 border-border bg-secondary/40 px-3 py-2 focus-within:border-primary/50 transition-colors">
                                    <textarea ref={inputRef} value={input} rows={1}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); }
                                        }}
                                        aria-label="Ask Ace"
                                        placeholder="Ask about anything in here…"
                                        className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none max-h-28 leading-relaxed py-1" />
                                    {streaming ? (
                                        <Button size="icon" variant="ghost" onClick={stop}
                                            className="rounded-xl flex-shrink-0" aria-label="Stop">
                                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                                        </Button>
                                    ) : (
                                        <Button size="icon" onClick={() => ask()} disabled={!input.trim()}
                                            className="rounded-xl flex-shrink-0" aria-label="Send">
                                            <Send className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}

/* ── The opening screen: a dealt hand ─────────────────────────────────── */

function Opening({ hand, loading, ready, deck: myDeck, onGo, onAsk, onTour, onDeck }) {
    if (loading || !hand) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
                <SpadeMark className="w-14 h-14" mood="thinking" />
                <p className="text-xs text-muted-foreground">Reading your week…</p>
            </div>
        );
    }
    return (
        <div className="space-y-4">
            <div className="text-center pt-1">
                <p className="font-display font-extrabold text-foreground text-base">
                    {hand.stage === "setup" ? "Let's get you set up"
                        : hand.cards.length ? "Here's what I'd play" : "You're on top of it"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 px-4">
                    {hand.cards.length
                        ? "From your own data — every card says why it's here."
                        : "Nothing urgent in your data right now. Ask me anything."}
                </p>
            </div>

            <div className="space-y-2">
                {hand.cards.map((c, i) => <HandCard key={c.id} c={c} i={i} onGo={onGo} />)}
            </div>

            <div className="space-y-1.5 pt-1">
                {openers(ready).map(o => (
                    <button key={o.q}
                        onClick={() => (o.kind === "tour" ? onTour() : onAsk(o.q))}
                        className="w-full text-left text-sm text-foreground bg-secondary/60 hover:bg-secondary rounded-xl px-3.5 py-2.5 transition-colors">
                        {o.q}
                    </button>
                ))}
                {/* Only offered once there's a real gap to show. "You've played
                    2 of 33" on day one is a scoreboard of things you haven't
                    done yet, which is the opposite of encouraging. */}
                {myDeck && myDeck.played >= 3 && myDeck.unseen > 0 && (
                    <button onClick={onDeck} data-open-deck
                        className="w-full text-left text-sm text-foreground bg-secondary/60 hover:bg-secondary rounded-xl px-3.5 py-2.5 transition-colors">
                        What haven't I tried yet?
                        <span className="text-muted-foreground"> · {myDeck.played} of {myDeck.total} played</span>
                    </button>
                )}
            </div>
        </div>
    );
}

/** One dealt card. The reason is the feature, so it never gets truncated. */
function HandCard({ c, i, onGo }) {
    const t = TONE[c.tone] || TONE.primary;
    return (
        <motion.button
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.07, 0.3) }}
            onClick={() => onGo(c.to)}
            data-hand-card={c.id}
            className={`w-full text-left rounded-2xl border-2 ${t.edge} ${t.tint} overflow-hidden hover:shadow-soft transition-shadow group`}>
            <div className="flex">
                <span className={`w-1.5 flex-shrink-0 ${t.bar}`} />
                <div className="min-w-0 flex-1 p-3.5">
                    <p className="text-sm font-bold text-foreground leading-snug">{c.title}</p>
                    <p className="text-xs text-muted-foreground leading-snug mt-1">{c.why}</p>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-foreground mt-2">
                        {c.cta}
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                </div>
            </div>
        </motion.button>
    );
}

/* ── A turn in the thread ─────────────────────────────────────────────── */

function Turn({ m, hand, deck: myDeck, streaming, onGo, onUpgrade }) {
    if (m.role === "user") {
        return (
            <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary text-primary-foreground px-3.5 py-2.5 text-sm">
                    <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                </div>
            </div>
        );
    }

    if (m.role === "assistant") {
        return (
            <AceSays>
                {m.content
                    ? <MarkdownMath isStreaming={streaming}>{m.content}</MarkdownMath>
                    : <Dots />}
            </AceSays>
        );
    }

    // ── Ace answering from the map ────────────────────────────────────
    if (m.hand) {
        return (
            <div className="space-y-2">
                {hand?.cards?.length
                    ? hand.cards.map((c, i) => <HandCard key={c.id} c={c} i={i} onGo={onGo} />)
                    : <AceSays>Nothing's urgent in your data right now — which is a good sign. Ask me about any part of the app and I'll show you where it is.</AceSays>}
            </div>
        );
    }

    if (m.tour) return <Tour onGo={onGo} />;
    if (m.pageTour) return <PageTour page={m.pageTour} onGo={onGo} />;
    if (m.deck) return <Deck d={myDeck} onGo={onGo} />;

    if (m.dismissed) {
        return (
            <AceSays mood="sleepy">
                <p className="text-sm text-foreground leading-snug">
                    {pick(DISMISS.off, "chat")}
                </p>
                <p className="text-[11px] text-muted-foreground leading-snug mt-1.5">
                    No more pop-ups. Say &ldquo;come back&rdquo; whenever.
                </p>
            </AceSays>
        );
    }
    if (m.recalled) {
        return (
            <AceSays mood="excited">
                <p className="text-sm text-foreground leading-snug">{pick(DISMISS.back, "chat")}</p>
            </AceSays>
        );
    }

    if (m.upgrade) {
        return (
            <AceSays>
                <p className="text-sm text-foreground leading-relaxed">
                    {m.note || "That one's a real question rather than a question about the app, and answering it properly is the part that runs on Premium."}
                </p>
                <p className="text-xs text-muted-foreground mt-2 leading-snug">
                    Anything about how AcedIt works — what a feature does, where it is, what to do next —
                    I'll always answer for free.
                </p>
                <Button size="sm" onClick={onUpgrade} className="rounded-xl mt-3 gap-1.5 text-xs h-8">
                    <Sparkles className="w-3.5 h-3.5" /> See Premium
                </Button>
            </AceSays>
        );
    }

    if (m.feature) {
        return (
            <AceSays>
                <p className="text-sm font-bold text-foreground">{m.feature.name}</p>
                {m.lines.map((l, i) => (
                    <p key={i} className={`text-sm leading-snug mt-1 ${i === 0 ? "text-foreground" : "text-muted-foreground"}`}>{l}</p>
                ))}
                <div className="flex flex-wrap gap-1.5 mt-3">
                    {m.actions.map((a, i) => (
                        <button key={i} onClick={() => onGo(a.to)} data-ace-action={a.label}
                            className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-colors ${
                                a.secondary
                                    ? "border-2 border-border text-muted-foreground hover:text-foreground"
                                    : "bg-primary text-primary-foreground hover:bg-primary/90"}`}>
                            {m.locked && !a.secondary && <Lock className="w-3 h-3" />}
                            {a.label}
                            {!a.secondary && <ArrowRight className="w-3 h-3" />}
                        </button>
                    ))}
                </div>
                {/* Premium features are still shown and still explained. Hiding
                    them would leave a free user asking why the app they read
                    about doesn't match the app they have. */}
                {m.locked && (
                    <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
                        You can open it — it'll ask you to upgrade before it runs.
                    </p>
                )}
            </AceSays>
        );
    }
    return null;
}

/**
 * One page, explained — where the first-run card hands over to.
 *
 * Sub-features are included here and excluded from the card, because this is
 * the place with room to say that Mind Maps has layers inside it.
 */
function PageTour({ page, onGo }) {
    const meta = PAGES[page];
    const items = featuresForPage(page);
    if (!meta) return null;
    return (
        <div className="space-y-2" data-page-tour={page}>
            <AceSays>
                <p className="text-sm font-bold text-foreground">{meta.title}</p>
                <p className="text-sm text-foreground leading-snug mt-1">{meta.intro}</p>
            </AceSays>
            {items.map(f => (
                <button key={f.id} onClick={() => onGo(f.to)} data-page-tour-item={f.id}
                    className="w-full text-left rounded-2xl border-2 border-border hover:border-primary/40 px-3 py-2.5 transition-colors">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">{f.name}</span>
                        {f.premium && <Lock className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                        {f.parent && <span className="pill bg-secondary text-muted-foreground">inside</span>}
                    </div>
                    <p className="text-xs text-muted-foreground leading-snug mt-0.5">{f.what}</p>
                    <p className="text-[11px] text-muted-foreground leading-snug mt-1">
                        <span className="font-bold text-foreground">Worth it when:</span>{" "}
                        {f.when.charAt(0).toLowerCase() + f.when.slice(1)}
                    </p>
                </button>
            ))}
        </div>
    );
}

/**
 * The deck — what you've touched, and what's still face down.
 *
 * The three states are kept visibly apart because they're different claims.
 * Played means there's data behind it. Opened means you visited the route on
 * this device, which is all we can know about the read-only parts and is not
 * the same as having used them. Face down means neither.
 *
 * Blurring those together would make the number bigger and the number
 * worthless, and this only works at all if a face-down card genuinely means
 * "you have never seen this".
 */
function Deck({ d, onGo }) {
    if (!d) return null;
    const sections = deckBySection(d);
    return (
        <div className="space-y-3" data-deck>
            <AceSays>
                <p className="text-sm text-foreground leading-snug">
                    <span className="font-bold">{d.played} of {d.total}</span> played
                    {d.opened > 0 && <>, {d.opened} opened but not used</>}.
                    {d.unseen > 0 && " The rest you've never seen."}
                </p>
                <p className="text-[11px] text-muted-foreground leading-snug mt-1.5">
                    Worked out from what you've left behind — decks, maps, logged sessions —
                    plus the pages you've opened on this device. It's evidence, not a record.
                </p>
            </AceSays>

            {d.suggestions.length > 0 && (
                <div>
                    <p className="stat-label mb-1.5">Worth a look</p>
                    <div className="space-y-1.5">
                        {d.suggestions.slice(0, 3).map(c => (
                            <button key={c.id} onClick={() => onGo(c.feature.to)} data-deck-suggestion={c.id}
                                className="w-full text-left rounded-2xl border-2 border-primary/30 bg-primary/5 px-3 py-2.5 hover:shadow-soft transition-shadow">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-foreground">{c.feature.name}</span>
                                    {c.feature.premium && <Lock className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                                </div>
                                <p className="text-xs text-muted-foreground leading-snug mt-0.5">{c.feature.what}</p>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {Object.entries(sections).map(([section, cards]) => (
                <div key={section}>
                    <p className="stat-label mb-1.5">{section}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                        {cards.map(c => (
                            <button key={c.id} onClick={() => onGo(c.feature.to)}
                                data-deck-card={c.id} data-deck-state={c.state}
                                className={`text-left rounded-xl border-2 px-2.5 py-2 transition-colors ${
                                    c.state === STATE.played
                                        ? "border-primary/40 bg-primary/5"
                                        : c.state === STATE.opened
                                            ? "border-border bg-secondary/40"
                                            : "border-dashed border-border hover:border-primary/40"}`}>
                                <p className={`text-xs font-bold leading-tight ${
                                    c.state === STATE.unseen ? "text-muted-foreground" : "text-foreground"}`}>
                                    {c.feature.name}
                                </p>
                                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                                    {c.state === STATE.played ? "played"
                                        : c.state === STATE.opened ? "opened"
                                            : c.blocked ? `needs ${c.blocked.label}` : "not tried"}
                                </p>
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

/** "What's in this app?" — the whole surface, grouped, in one screen. */
function Tour({ onGo }) {
    return (
        <div className="space-y-3">
            <AceSays>
                <p className="text-sm text-foreground leading-snug">
                    Everything's here. Tap anything and I'll take you to it.
                </p>
            </AceSays>
            {Object.entries(SECTIONS).map(([section, ids]) => (
                <div key={section}>
                    <p className="stat-label mb-1.5">{section}</p>
                    <div className="space-y-1">
                        {ids.filter(id => !BY_ID[id].parent).map(id => {
                            const f = BY_ID[id];
                            return (
                                <button key={id} onClick={() => onGo(f.to)} data-tour-item={id}
                                    className="w-full text-left rounded-xl border-2 border-border hover:border-primary/40 px-3 py-2 transition-colors">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-foreground">{f.name}</span>
                                        {f.premium && <Lock className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{f.what}</p>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}

function AceSays({ children, mood = "idle" }) {
    return (
        <div className="flex gap-2">
            <SpadeMark className="w-7 h-7 flex-shrink-0 mt-0.5" mood={mood} />
            <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-secondary px-3.5 py-2.5 text-sm text-foreground">
                {children}
            </div>
        </div>
    );
}

function Dots() {
    return (
        <span className="inline-flex gap-1 py-1">
            {[0, 150, 300].map(d => (
                <span key={d} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
                    style={{ animationDelay: `${d}ms` }} />
            ))}
        </span>
    );
}

export { AceCard };
