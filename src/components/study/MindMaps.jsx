/**
 * MindMaps — build a map from memory, then find out what you missed.
 *
 * Karpicke & Blunt (2011, Science) put concept mapping against retrieval
 * practice and mapping lost on every measure, including a final test that was
 * itself a concept map. Students expected the opposite — it feels like
 * understanding. The follow-up (Blunt & Karpicke, 2014) found the rescue:
 * mapping done *as retrieval*, closed book, works about as well as anything
 * else.
 *
 * So this is not a diagram tool with a save button. The flow is:
 *
 *   1. Name the topic. Notes go away.       ← the part that makes it work
 *   2. Type what you remember. It draws itself.
 *   3. Only then, get interrogated on the gaps.
 *   4. Rebuild from memory next week and diff the two.
 *
 * The outline is the primary input, not the canvas. Fiddly node dragging is
 * what kills these tools before any learning happens; typing an indented list
 * takes thirty seconds and most students will never touch a node with a mouse.
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import {
    Network, Plus, Loader2, EyeOff, Sparkles, ArrowLeft, Trash2, Check, AlertTriangle,
    Lightbulb, ListTree, Layers, RotateCcw, TrendingUp,
} from "lucide-react";
import MindMapCanvas from "./MindMapCanvas";
import { parseOutline, toOutline, emptyMap, mapStats, edgesAsCards, diffMaps } from "@/lib/mindmap";
import { fmtDate } from "@/lib/safeDate";

const STARTERS = [
    { id: "process",  label: "A process",      hint: "Steps in order — what causes what",
      seed: "Topic\n  First step :: starts when\n  Second step :: leads to\n  Outcome" },
    { id: "compare",  label: "Two things",     hint: "How A and B differ and overlap",
      seed: "Topic\n  Thing A\n    Unique to A\n  Thing B\n    Unique to B\n  Shared" },
    { id: "causes",   label: "Causes and effects", hint: "What drives it, what follows",
      seed: "Topic\n  Causes\n  Effects\n  Limiting factors" },
    { id: "blank",    label: "Blank",          hint: "Start from nothing", seed: "" },
];

/** The one screen that matters: closed-book building. */
function Builder({ map, outline, setOutline, seconds }) {
    const ref = useRef(null);

    // Tab nests, Shift-Tab promotes. Without this the outline is unusable and
    // the whole "typing is faster than dragging" argument collapses.
    const onKeyDown = (e) => {
        if (e.key !== "Tab") return;
        e.preventDefault();
        const el = ref.current;
        const { selectionStart: s, selectionEnd: en, value } = el;
        const lineStart = value.lastIndexOf("\n", s - 1) + 1;
        if (e.shiftKey) {
            if (value.slice(lineStart, lineStart + 2) === "  ") {
                const next = value.slice(0, lineStart) + value.slice(lineStart + 2);
                setOutline(next);
                requestAnimationFrame(() => el.setSelectionRange(Math.max(lineStart, s - 2), Math.max(lineStart, en - 2)));
            }
        } else {
            const next = `${value.slice(0, lineStart)}  ${value.slice(lineStart)}`;
            setOutline(next);
            requestAnimationFrame(() => el.setSelectionRange(s + 2, en + 2));
        }
    };

    const mins = Math.floor(seconds / 60), secs = String(seconds % 60).padStart(2, "0");

    return (
        // The outline column is deliberately narrow. An indented list needs
        // maybe 40 characters; a mind map needs every pixel it can get, and a
        // 50/50 split makes both of them worse.
        <div className="grid lg:grid-cols-[minmax(0,360px)_1fr] gap-4">
            <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <p className="stat-label flex items-center gap-1.5"><ListTree className="w-3.5 h-3.5" /> Type it out</p>
                    <span className="pill bg-secondary text-muted-foreground tabular-nums">{mins}:{secs}</span>
                </div>
                <textarea
                    ref={ref}
                    value={outline}
                    onChange={(e) => setOutline(e.target.value)}
                    onKeyDown={onKeyDown}
                    spellCheck={false}
                    placeholder={"Photosynthesis\n  Light-dependent :: happens first\n    Thylakoid membrane\n    Produces ATP\n  Calvin cycle :: uses the ATP"}
                    className="w-full h-[380px] rounded-2xl border-2 border-border bg-surface p-4 font-mono text-sm leading-relaxed text-foreground resize-none focus:outline-none focus:border-map"
                    aria-label="Mind map outline"
                />
                <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    <span className="pill bg-secondary">Tab to nest</span>
                    <span className="pill bg-secondary">Shift-Tab to promote</span>
                    <span className="pill bg-secondary">:: to label a link</span>
                </div>
                <p className="text-xs text-muted-foreground leading-snug">
                    Label your links. <span className="text-foreground font-bold">"Calvin cycle :: uses the ATP"</span> is
                    worth ten unlabelled boxes — the relationship is where the understanding actually lives.
                </p>
            </div>

            <div className="space-y-3">
                <p className="stat-label flex items-center gap-1.5"><Network className="w-3.5 h-3.5" /> It draws itself</p>
                {map.nodes.length > 1 ? (
                    <MindMapCanvas nodes={map.nodes} expandable className="h-[380px]" />
                ) : (
                    <div className="h-[380px] rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center text-center px-8">
                        <Network className="w-7 h-7 text-muted-foreground/30 mb-2" />
                        <p className="text-sm font-bold text-foreground">The map appears as you type</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            No dragging, no arranging. Just get what you remember onto the page.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

/** The gap review — questions only, never answers. */
function GapReview({ review, onAddNode }) {
    if (!review) return null;
    const { missing = [], weak_links = [], misconceptions = [], strong = [], verdict } = review;
    return (
        <div className="space-y-4">
            {verdict && (
                <div className="rounded-2xl bg-map/5 border-2 border-map/25 p-4">
                    <p className="stat-label text-map mb-1">The read</p>
                    <p className="text-sm text-foreground">{verdict}</p>
                </div>
            )}

            {misconceptions.length > 0 && (
                <div className="rounded-2xl border-2 border-streak/30 bg-streak/5 p-4">
                    <p className="stat-label text-streak flex items-center gap-1.5 mb-2">
                        <AlertTriangle className="w-3.5 h-3.5" /> Worth double-checking
                    </p>
                    <div className="space-y-2.5">
                        {misconceptions.map((m, i) => (
                            <div key={i}>
                                <p className="text-xs font-bold text-foreground">{m.between}</p>
                                <p className="text-sm text-muted-foreground leading-snug">{m.why_check}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {missing.length > 0 && (
                <div className="card-soft p-4">
                    <p className="stat-label flex items-center gap-1.5 mb-2">
                        <Lightbulb className="w-3.5 h-3.5 text-xp" /> Can you answer these?
                    </p>
                    <p className="text-[11px] text-muted-foreground mb-3">
                        Each one points at something your map doesn't have. It won't tell you the answer —
                        that's the point. Add the node yourself once you've retrieved it.
                    </p>
                    <div className="space-y-2">
                        {missing.map((m, i) => (
                            <div key={i} className="rounded-xl border border-border p-3">
                                <p className="text-sm font-bold text-foreground leading-snug">{m.prompt}</p>
                                {m.hint && <p className="text-xs text-muted-foreground mt-1">Hint: {m.hint}</p>}
                                <button onClick={() => onAddNode?.(m.prompt)}
                                    className="text-[11px] font-bold text-map hover:underline mt-2">
                                    + Add a branch for this
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {weak_links.length > 0 && (
                <div className="card-soft p-4">
                    <p className="stat-label flex items-center gap-1.5 mb-2">
                        <Layers className="w-3.5 h-3.5 text-chart-4" /> Links worth sharpening
                    </p>
                    <div className="space-y-2.5">
                        {weak_links.map((w, i) => (
                            <div key={i}>
                                <p className="text-xs font-bold text-foreground">{w.between}</p>
                                <p className="text-sm text-muted-foreground leading-snug">{w.challenge}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {strong.length > 0 && (
                <div className="rounded-2xl bg-primary/5 border-2 border-primary/25 p-4">
                    <p className="stat-label text-primary flex items-center gap-1.5 mb-2">
                        <Check className="w-3.5 h-3.5" /> You clearly have this
                    </p>
                    <ul className="space-y-1">
                        {strong.map((s, i) => <li key={i} className="text-sm text-muted-foreground">{s}</li>)}
                    </ul>
                </div>
            )}
        </div>
    );
}

export default function MindMaps({ user, subjects = [] }) {
    const { toast } = useToast();
    const [maps, setMaps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState("list");        // list → build → review
    const [map, setMap] = useState(null);
    const [outline, setOutline] = useState("");
    const [review, setReview] = useState(null);
    const [busy, setBusy] = useState(false);
    const [seconds, setSeconds] = useState(0);
    const [rebuildOf, setRebuildOf] = useState(null);
    const [diff, setDiff] = useState(null);
    const [newTitle, setNewTitle] = useState("");

    const load = useCallback(async () => {
        if (!user?.email) return;
        try {
            const rows = await base44.entities.MindMap.filter({ created_by: user.email }, "-updated_date", 50);
            setMaps(rows || []);
        } catch { /* the tab still works for building */ }
        finally { setLoading(false); }
    }, [user]);

    useEffect(() => { load(); }, [load]);

    // A visible clock, because "how long did that take" is the honest measure
    // of whether building blind is getting easier.
    useEffect(() => {
        if (view !== "build") return;
        const t = setInterval(() => setSeconds(s => s + 1), 1000);
        return () => clearInterval(t);
    }, [view]);

    // Outline is the source of truth while building; the tree follows it.
    useEffect(() => {
        if (view !== "build" || !map) return;
        const nodes = parseOutline(outline);
        setMap(m => ({ ...m, nodes: nodes.length ? nodes : emptyMap(m.title).nodes }));
    }, [outline, view]);

    const stats = useMemo(() => (map ? mapStats(map) : null), [map]);

    const start = (starter, title) => {
        const m = emptyMap(title || "Untitled map");
        setMap(m);
        setOutline(starter?.seed ? starter.seed.replace(/^Topic/, title || "Topic") : (title || "Topic"));
        setReview(null); setDiff(null); setSeconds(0); setRebuildOf(null); setNewTitle("");
        setView("build");
    };

    const rebuild = (previous) => {
        const m = emptyMap(previous.title);
        m.subject = previous.subject_name;
        m.topic = previous.topic;
        setMap(m);
        setOutline(previous.title);       // deliberately empty of their old content
        setReview(null); setDiff(null); setSeconds(0);
        setRebuildOf(previous);
        setView("build");
    };

    const check = async () => {
        if (!map || map.nodes.length < 3) {
            toast({ title: "Get a bit more down first", description: "Three nodes isn't a map yet." });
            return;
        }
        setBusy(true);
        try {
            const res = await base44.functions.invoke("mindMapGaps", {
                title: map.title, subject: map.subject, topic: map.topic || map.title,
                outline: toOutline(map.nodes), built_from_memory: true,
            });
            const data = res?.data ?? res;
            if (data?.error) throw new Error(data.error);
            setReview(data);
            if (rebuildOf) setDiff(diffMaps({ nodes: rebuildOf.nodes || [] }, map));
            setView("review");
        } catch (e) {
            toast({ title: "Couldn't check the map", description: e.message, variant: "destructive" });
        } finally { setBusy(false); }
    };

    const save = async () => {
        if (!map) return;
        setBusy(true);
        // A rebuild saved without checking is still a retention measurement —
        // the diff shouldn't depend on whether they used the AI pass.
        const measured = diff || (rebuildOf ? diffMaps({ nodes: rebuildOf.nodes || [] }, map) : null);
        const minutes = Math.max(1, Math.round(seconds / 60));
        try {
            const payload = {
                title: map.title,
                subject_name: map.subject || null,
                topic: map.topic || null,
                phase: review ? "checked" : "blind",
                built_from_memory: true,
                nodes: map.nodes,
                cross_links: map.crossLinks || [],
                gaps: review?.missing || [],
                parent_map_id: rebuildOf?.id || null,
                retention_score: measured?.retention ?? null,
                minutes_spent: minutes,
            };
            await base44.entities.MindMap.create(payload);
            // Time spent building blind is retrieval practice, so it counts as
            // study the same way Blurting and Active Recall do.
            await base44.entities.StudyTechnique.create({
                technique_name: "mind_map",
                subject: map.subject || null,
                topic: map.topic || map.title,
                session_duration: minutes,
                date: new Date().toISOString().slice(0, 10),
                created_by: user.email,
            }).catch(() => {});
            toast({ variant: "success", title: "Map saved",
                description: measured ? `${measured.retention}% of last time's map came back from memory.`
                    : `${stats.nodes} nodes, ${stats.linked} labelled links.` });
            setView("list"); setMap(null); load();
        } catch (e) {
            toast({ title: "Couldn't save", description: e.message, variant: "destructive" });
        } finally { setBusy(false); }
    };

    const exportCards = async () => {
        const cards = edgesAsCards(map);
        if (!cards.length) {
            toast({ title: "No labelled links yet",
                description: "Label a link with :: and it becomes a card. An unlabelled arrow isn't worth revising." });
            return;
        }
        setBusy(true);
        try {
            for (const c of cards) {
                await base44.entities.Flashcard.create({
                    question: c.question, answer: c.answer,
                    subject_name: map.subject || null, topic: c.topic,
                    next_review_date: new Date().toISOString().slice(0, 10),
                    is_active: true,
                });
            }
            toast({ variant: "success", title: `${cards.length} cards made`,
                description: "Every labelled link is now a flashcard in Spaced Repetition." });
        } catch (e) {
            toast({ title: "Couldn't make cards", description: e.message, variant: "destructive" });
        } finally { setBusy(false); }
    };

    // ── List ────────────────────────────────────────────────────────────────
    if (view === "list") {
        return (
            <div className="space-y-5">
                <div className="rounded-3xl bg-gradient-to-br from-map/10 to-transparent border-2 border-map/20 p-6">
                    <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-map/15 flex items-center justify-center flex-shrink-0">
                            <EyeOff className="w-5 h-5 text-map" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-display font-extrabold text-foreground text-lg">Map it from memory</h3>
                            <p className="text-sm text-muted-foreground mt-1 max-w-2xl leading-snug">
                                Notes closed. Type what you actually remember and the map draws itself — then get
                                interrogated on what's missing. Built with your notes open, this is note-taking with
                                extra steps; built blind, it's retrieval practice.
                            </p>
                        </div>
                    </div>

                    <div className="mt-5 space-y-2.5">
                        <label htmlFor="mm-topic" className="stat-label">1 · What are you mapping?</label>
                        <Input id="mm-topic" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter" && newTitle.trim()) start(STARTERS[3], newTitle.trim()); }}
                            placeholder="Photosynthesis, the Russian Revolution, rates of reaction…"
                            className="h-11 border-2 rounded-xl bg-surface" />
                    </div>

                    <div className="mt-4">
                        <p className="stat-label mb-2">2 · Pick a shape to start from</p>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                            {STARTERS.map(s => (
                                <button key={s.id} disabled={!newTitle.trim()}
                                    onClick={() => start(s, newTitle.trim())}
                                    className="text-left rounded-2xl border-2 border-border bg-surface p-3.5 transition-all enabled:hover:border-map/50 enabled:hover:shadow-soft disabled:opacity-45 disabled:cursor-not-allowed">
                                    <p className="text-sm font-bold text-foreground">{s.label}</p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{s.hint}</p>
                                </button>
                            ))}
                        </div>
                        {!newTitle.trim() && (
                            <p className="text-[11px] text-muted-foreground mt-2">Name the topic first — then close the notes.</p>
                        )}
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-map" /></div>
                ) : maps.length === 0 ? (
                    <div className="text-center py-8">
                        <Network className="w-8 h-8 text-muted-foreground/25 mx-auto mb-2" />
                        <p className="text-sm font-bold text-foreground">No maps yet</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Pick a shape above and start with the notes shut.</p>
                    </div>
                ) : (
                    <div className="grid sm:grid-cols-2 gap-3">
                        {maps.map(m => {
                            const s = mapStats({ nodes: m.nodes || [] });
                            return (
                                <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                    className="card-soft p-4 border-2 border-border">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="font-bold text-foreground truncate">{m.title}</p>
                                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                                {fmtDate(m.updated_date || m.created_date, "d MMM")} · {s.nodes} nodes · {s.linked} labelled
                                                {m.retention_score != null && ` · ${m.retention_score}% recalled`}
                                            </p>
                                        </div>
                                        {m.phase === "checked" && (
                                            <span className="pill bg-primary/15 text-primary flex-shrink-0">Checked</span>
                                        )}
                                    </div>
                                    <div className="mt-3">
                                        <MindMapCanvas nodes={m.nodes || []} compact className="h-32" />
                                    </div>
                                    <div className="flex gap-2 mt-3">
                                        <Button size="sm" variant="outline" onClick={() => rebuild(m)}
                                            className="border-2 rounded-xl gap-1.5 flex-1">
                                            <RotateCcw className="w-3.5 h-3.5" /> Rebuild from memory
                                        </Button>
                                        <Button size="sm" variant="ghost" aria-label={`Delete ${m.title}`}
                                            onClick={async () => {
                                                await base44.entities.MindMap.delete(m.id);
                                                setMaps(prev => prev.filter(x => x.id !== m.id));
                                            }}
                                            className="rounded-xl text-muted-foreground hover:text-streak">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    // ── Build ───────────────────────────────────────────────────────────────
    if (view === "build" && map) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <button onClick={() => { setView("list"); setMap(null); }}
                        className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowLeft className="w-4 h-4" /> All maps
                    </button>
                    <div className="flex items-center gap-2">
                        <span className="pill bg-map/15 text-map inline-flex items-center gap-1">
                            <EyeOff className="w-3 h-3" /> Notes closed
                        </span>
                        {rebuildOf && <span className="pill bg-xp/15 text-xp">Rebuild</span>}
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <Input value={map.title} onChange={(e) => setMap(m => ({ ...m, title: e.target.value }))}
                        placeholder="Topic" aria-label="Map title"
                        className="max-w-xs font-bold" />
                    <select value={map.subject || ""} onChange={(e) => setMap(m => ({ ...m, subject: e.target.value || null }))}
                        aria-label="Subject"
                        className="h-10 rounded-xl border-2 border-border bg-surface px-3 text-sm text-foreground">
                        <option value="">No subject</option>
                        {subjects.map(s => <option key={s.subject_name} value={s.subject_name}>{s.subject_name}</option>)}
                    </select>
                    {stats && (
                        <div className="flex gap-4 ml-auto">
                            {[["Nodes", stats.nodes], ["Labelled", stats.linked], ["Depth", stats.depth]].map(([k, v]) => (
                                <div key={k}>
                                    <p className="font-display font-black text-lg leading-none text-foreground tabular-nums">{v}</p>
                                    <p className="stat-label">{k}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <Builder map={map} outline={outline} setOutline={setOutline} seconds={seconds} />

                <div className="flex flex-wrap gap-2">
                    <Button onClick={check} disabled={busy} className="gap-1.5 bg-map hover:bg-map/90 text-white btn-3d">
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        Now check what I missed
                    </Button>
                    <Button variant="outline" onClick={save} disabled={busy} className="border-2 rounded-xl">
                        Save without checking
                    </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                    Checking opens your gaps as questions, not answers — you still have to retrieve them.
                </p>
            </div>
        );
    }

    // ── Review ──────────────────────────────────────────────────────────────
    return (
        <div className="space-y-4">
            <button onClick={() => setView("build")}
                className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to the map
            </button>

            {diff && (
                <div className="rounded-3xl border-2 border-xp/30 bg-gradient-to-br from-xp/10 to-transparent p-5">
                    <p className="stat-label text-xp flex items-center gap-1.5 mb-1">
                        <TrendingUp className="w-3.5 h-3.5" /> Against last time
                    </p>
                    <p className="font-display font-black text-4xl text-foreground tabular-nums leading-none">
                        {diff.retention}%
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                        of your previous map came back from memory
                        {diff.lost.length > 0 && ` — ${diff.lost.length} dropped out`}
                        {diff.gained.length > 0 && `, ${diff.gained.length} new`}.
                    </p>
                    {diff.lost.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                            <span className="font-bold text-foreground">Gone:</span> {diff.lost.slice(0, 6).join(" · ")}
                        </p>
                    )}
                </div>
            )}

            <MindMapCanvas nodes={map?.nodes || []} expandable className="h-[320px]" />
            <GapReview review={review} onAddNode={(prompt) => {
                setOutline(o => `${o}\n  ${prompt.replace(/\?$/, "")}`);
                setView("build");
            }} />

            <div className="flex flex-wrap gap-2">
                <Button onClick={save} disabled={busy} className="gap-1.5 btn-3d">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save the map
                </Button>
                <Button variant="outline" onClick={exportCards} disabled={busy} className="border-2 rounded-xl gap-1.5">
                    <Plus className="w-4 h-4" /> Turn links into flashcards
                </Button>
            </div>
        </div>
    );
}
