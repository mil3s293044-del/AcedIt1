/**
 * MindMaps — one growing map per subject, not a folder of documents.
 *
 * The shape of this is the point. A subject has ONE root map, any node in it
 * can be opened as a map of its own, and that nests as deep as the student
 * wants. So "Biology" is a place you go back to for two years rather than a
 * file you make once and lose, and a term that turns out to be a whole topic
 * gets promoted into its own space instead of being crammed into a box.
 *
 * Nodes are typed — cause, effect, term, evidence, open question. That isn't
 * decoration: type is what lets the map export itself as real practice. A term
 * with a note becomes a definition card, an open question becomes a recall
 * prompt, an effect becomes "what does this lead to". An untyped map exports
 * almost nothing, which is the honest answer rather than forty cards whose
 * backs are blank.
 *
 * Two ways in, because they're good at different things. Typing an outline is
 * still the fastest way to get thirty nodes down and it auto-arranges. The
 * canvas is for arranging, connecting and growing a map you already have.
 * Neither replaces the other, so both stay.
 *
 * The evidence that shaped the original build still holds and still shows up
 * here: Karpicke & Blunt (2011, Science) found concept mapping LOST to
 * retrieval practice, and Blunt & Karpicke (2014) found what rescues it —
 * doing it as retrieval. Hence the closed-book prompt on a new map, the gap
 * check that answers in questions only, and the exports being first-class
 * rather than an afterthought. A map that never feeds a recall session is the
 * version of this feature the evidence says doesn't work.
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import {
    Network, Plus, Loader2, EyeOff, Sparkles, ArrowLeft, Trash2, Check, AlertTriangle,
    Lightbulb, ListTree, Layers, TrendingUp, ChevronRight, Link2, X, Zap, Target,
    ListOrdered, BookMarked, Quote, FlaskConical, HelpCircle, Send, Wand2, MousePointer2,
} from "lucide-react";
import MindMapCanvas from "./MindMapCanvas";
import {
    parseOutline, toOutline, emptyMap, mapStats, exportCards, exportPrompts, diffMaps,
    NODE_TYPES, TYPE_BY_ID, newNode, removeNode, subtreeIds, freeSpotNear, nodeId,
} from "@/lib/mindmap";

const TYPE_ICON = {
    idea: Lightbulb, cause: Zap, effect: Target, step: ListOrdered,
    term: BookMarked, example: Quote, evidence: FlaskConical, question: HelpCircle,
};
// Static strings, so Tailwind's scanner sees every one of them.
const TONE_CLASS = {
    map:       { text: "text-map",       bg: "bg-map/10",       border: "border-map/40",       dot: "bg-map" },
    xp:        { text: "text-xp",        bg: "bg-xp/10",        border: "border-xp/40",        dot: "bg-xp" },
    "chart-3": { text: "text-chart-3",   bg: "bg-chart-3/10",   border: "border-chart-3/40",   dot: "bg-chart-3" },
    "chart-4": { text: "text-chart-4",   bg: "bg-chart-4/10",   border: "border-chart-4/40",   dot: "bg-chart-4" },
    primary:   { text: "text-primary",   bg: "bg-primary/10",   border: "border-primary/40",   dot: "bg-primary" },
    streak:    { text: "text-streak",    bg: "bg-streak/10",    border: "border-streak/40",    dot: "bg-streak" },
};
const CONF = [
    { v: 0, label: "—",          cls: "bg-secondary text-muted-foreground" },
    { v: 1, label: "Shaky",      cls: "bg-streak/15 text-streak" },
    { v: 2, label: "Getting it", cls: "bg-xp/15 text-xp" },
    { v: 3, label: "Solid",      cls: "bg-primary/15 text-primary" },
];

const rowToMap = (row) => ({
    id: row.id,
    title: row.title,
    subject: row.subject_name || null,
    topic: row.topic || "",
    phase: row.phase || "blind",
    nodes: row.nodes?.length ? row.nodes : emptyMap(row.title).nodes,
    crossLinks: row.cross_links || [],
    isSubjectRoot: !!row.is_subject_root,
    drillFromMapId: row.drill_from_map_id || null,
    drillFromNodeId: row.drill_from_node_id || null,
    parentMapId: row.parent_map_id || null,
});

const mapToRow = (m) => ({
    title: m.title,
    subject_name: m.subject || null,
    topic: m.topic || null,
    phase: m.phase || "blind",
    nodes: m.nodes,
    cross_links: m.crossLinks || [],
    is_subject_root: !!m.isSubjectRoot,
    drill_from_map_id: m.drillFromMapId || null,
    drill_from_node_id: m.drillFromNodeId || null,
});

/** The gap review — questions only, never answers. */
function GapReview({ review, onClose, onAddNode }) {
    if (!review) return null;
    const { missing = [], weak_links = [], misconceptions = [], strong = [], verdict } = review;
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <p className="stat-label flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-map" /> What you missed</p>
                <button onClick={onClose} aria-label="Close gap review"
                    className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            {verdict && (
                <div className="rounded-xl bg-map/5 border-2 border-map/25 p-3">
                    <p className="text-sm text-foreground leading-snug">{verdict}</p>
                </div>
            )}
            {misconceptions.length > 0 && (
                <div className="rounded-xl border-2 border-streak/30 bg-streak/5 p-3">
                    <p className="stat-label text-streak flex items-center gap-1.5 mb-2">
                        <AlertTriangle className="w-3.5 h-3.5" /> Worth double-checking
                    </p>
                    <div className="space-y-2">
                        {misconceptions.map((m, i) => (
                            <div key={i}>
                                <p className="text-xs font-bold text-foreground">{m.between}</p>
                                <p className="text-xs text-muted-foreground leading-snug">{m.why_check}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {missing.length > 0 && (
                <div className="rounded-xl border-2 border-border p-3">
                    <p className="stat-label mb-1 flex items-center gap-1.5">
                        <Lightbulb className="w-3.5 h-3.5 text-xp" /> Can you answer these?
                    </p>
                    <p className="text-[11px] text-muted-foreground mb-2">
                        Each points at something your map hasn't got. It won't tell you the answer —
                        that's the point.
                    </p>
                    <div className="space-y-2">
                        {missing.map((m, i) => (
                            <div key={i} className="rounded-lg border border-border p-2.5">
                                <p className="text-xs font-bold text-foreground leading-snug">{m.prompt}</p>
                                {m.hint && <p className="text-[11px] text-muted-foreground mt-0.5">Hint: {m.hint}</p>}
                                <button onClick={() => onAddNode(m.prompt)}
                                    className="text-[11px] font-bold text-map hover:underline mt-1.5">
                                    + Add as an open question
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {weak_links.length > 0 && (
                <div className="rounded-xl border-2 border-border p-3">
                    <p className="stat-label mb-2 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-chart-4" /> Links worth sharpening
                    </p>
                    <div className="space-y-2">
                        {weak_links.map((w, i) => (
                            <div key={i}>
                                <p className="text-xs font-bold text-foreground">{w.between}</p>
                                <p className="text-xs text-muted-foreground leading-snug">{w.challenge}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {strong.length > 0 && (
                <div className="rounded-xl bg-primary/5 border-2 border-primary/25 p-3">
                    <p className="stat-label text-primary flex items-center gap-1.5 mb-1">
                        <Check className="w-3.5 h-3.5" /> You clearly have this
                    </p>
                    <ul className="space-y-0.5">
                        {strong.map((s, i) => <li key={i} className="text-xs text-muted-foreground">{s}</li>)}
                    </ul>
                </div>
            )}
        </div>
    );
}

export default function MindMaps({ user, subjects = [] }) {
    const { toast } = useToast();
    const [allMaps, setAllMaps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [subject, setSubject] = useState(null);
    const [trail, setTrail] = useState([]);          // [{ id, title }] — drill path
    const [map, setMap] = useState(null);
    const [selectedId, setSelectedId] = useState(null);
    const [connectFrom, setConnectFrom] = useState(null);
    const [mode, setMode] = useState("canvas");      // canvas | outline
    const [outline, setOutline] = useState("");
    const [review, setReview] = useState(null);
    const [busy, setBusy] = useState(false);
    const [saving, setSaving] = useState(false);
    const [dragType, setDragType] = useState(null);  // palette chip being dragged
    const [dragAt, setDragAt] = useState(null);
    const [scope, setScope] = useState("map");       // map | branch — what exports
    const [recallOf, setRecallOf] = useState(null);  // the real map being recalled against
    const [diff, setDiff] = useState(null);
    const canvasApi = useRef(null);
    const dirty = useRef(0);
    const savedAt = useRef(0);

    const selected = useMemo(
        () => map?.nodes.find(n => n.id === selectedId) || null, [map, selectedId]);
    const stats = useMemo(() => (map ? mapStats(map) : null), [map]);

    // Which nodes in this map already open into a map of their own.
    const childMapNodeIds = useMemo(() => new Set(
        allMaps.filter(m => m.drill_from_map_id === map?.id && m.drill_from_node_id)
            .map(m => m.drill_from_node_id)), [allMaps, map]);

    const load = useCallback(async () => {
        if (!user?.email) return;
        try {
            const rows = await base44.entities.MindMap.filter({ created_by: user.email }, "-updated_date", 200);
            setAllMaps(rows || []);
        } catch { /* the sandbox still works unsaved */ }
        finally { setLoading(false); }
    }, [user]);
    useEffect(() => { load(); }, [load]);

    // ── Mutation helper ─────────────────────────────────────────────────────
    // Every change goes through here so autosave has exactly one thing to
    // watch, rather than a save call bolted onto each of fifteen handlers.
    const edit = useCallback((fn) => {
        setMap(m => (m ? fn(m) : m));
        dirty.current += 1;
    }, []);

    // Autosave. A "brain of storage" you can lose by closing a tab is not a
    // store, and an explicit Save button is exactly the step people skip.
    useEffect(() => {
        if (!map || dirty.current === savedAt.current) return;
        const t = setTimeout(async () => {
            const at = dirty.current;
            setSaving(true);
            try {
                const row = mapToRow(map);
                if (map.id) await base44.entities.MindMap.update(map.id, row);
                else {
                    const created = await base44.entities.MindMap.create(row);
                    if (created?.id) setMap(m => ({ ...m, id: created.id }));
                    setAllMaps(prev => [{ ...row, id: created?.id }, ...prev]);
                }
                savedAt.current = at;
            } catch (e) {
                toast({ title: "Couldn't save the map", description: e.message, variant: "destructive" });
            } finally { setSaving(false); }
        }, 1200);
        return () => clearTimeout(t);
    }, [map, toast]);

    // ── Opening a subject ───────────────────────────────────────────────────
    const openSubject = useCallback(async (name) => {
        setSubject(name);
        setSelectedId(null); setReview(null); setConnectFrom(null);
        const existing = allMaps.find(m => m.subject_name === name && m.is_subject_root);
        if (existing) {
            const m = rowToMap(existing);
            setMap(m); setTrail([{ id: m.id, title: name }]); setOutline(toOutline(m.nodes));
            savedAt.current = dirty.current;
            return;
        }
        // First visit to a subject: make its root. Everything in the subject
        // hangs off this, so it exists from the first click rather than after
        // the student works out they were supposed to create something.
        const base = emptyMap(name);
        base.subject = name;
        base.isSubjectRoot = true;
        try {
            const created = await base44.entities.MindMap.create(mapToRow(base));
            const m = { ...base, id: created?.id };
            setMap(m); setTrail([{ id: m.id, title: name }]); setOutline(toOutline(m.nodes));
            savedAt.current = dirty.current;
            setAllMaps(prev => [{ ...mapToRow(base), id: created?.id }, ...prev]);
        } catch {
            setMap(base); setTrail([{ id: null, title: name }]); setOutline(toOutline(base.nodes));
            toast({ title: "Working offline", description: "Couldn't reach your saved maps — this one won't persist yet." });
        }
    }, [allMaps, toast]);

    const openMapRow = useCallback((row, newTrail) => {
        const m = rowToMap(row);
        setMap(m); setTrail(newTrail); setOutline(toOutline(m.nodes));
        setSelectedId(null); setReview(null); setConnectFrom(null);
        savedAt.current = dirty.current;
    }, []);

    // ── Drilling a node into its own map ────────────────────────────────────
    const openNode = useCallback(async (id) => {
        const node = map?.nodes.find(n => n.id === id);
        if (!node) return;
        const existing = allMaps.find(m => m.drill_from_map_id === map.id && m.drill_from_node_id === id);
        if (existing) { openMapRow(existing, [...trail, { id: existing.id, title: node.text }]); return; }

        const child = emptyMap(node.text, node.type || "idea");
        child.subject = subject;
        child.drillFromMapId = map.id;
        child.drillFromNodeId = id;
        // The node's note is the one piece of real content it already holds, so
        // it comes across rather than being stranded a level up.
        if (node.note?.trim()) {
            child.nodes.push(newNode(node.note.trim().slice(0, 60), { parent: child.nodes[0].id, type: "term" }));
        }
        try {
            const created = await base44.entities.MindMap.create(mapToRow(child));
            const row = { ...mapToRow(child), id: created?.id };
            setAllMaps(prev => [row, ...prev]);
            openMapRow(row, [...trail, { id: created?.id, title: node.text }]);
        } catch (e) {
            toast({ title: "Couldn't open that node", description: e.message, variant: "destructive" });
        }
    }, [map, allMaps, subject, trail, openMapRow, toast]);

    const goToTrail = useCallback((i) => {
        const target = trail[i];
        const row = allMaps.find(m => m.id === target.id);
        if (row) openMapRow(row, trail.slice(0, i + 1));
    }, [trail, allMaps, openMapRow]);

    // ── Node operations ─────────────────────────────────────────────────────
    const addNode = useCallback((type, at) => {
        edit(m => {
            const parent = selectedId && m.nodes.some(n => n.id === selectedId)
                ? selectedId
                : m.nodes.find(n => !n.parent)?.id || null;
            const spot = at || freeSpotNear(m.nodes, parent);
            const n = newNode(TYPE_BY_ID[type]?.label || "New node", { parent, type, x: spot.x, y: spot.y });
            setSelectedId(n.id);
            return { ...m, nodes: [...m.nodes, n] };
        });
    }, [edit, selectedId]);

    const updateNode = useCallback((id, patch) => {
        edit(m => ({ ...m, nodes: m.nodes.map(n => (n.id === id ? { ...n, ...patch } : n)) }));
    }, [edit]);

    const moveNodes = useCallback((moves) => {
        const byId = new Map(moves.map(mv => [mv.id, mv]));
        edit(m => ({
            ...m,
            nodes: m.nodes.map(n => (byId.has(n.id)
                ? { ...n, x: byId.get(n.id).x, y: byId.get(n.id).y, pinned: true }
                : n)),
        }));
    }, [edit]);

    const connect = useCallback((from, to) => {
        setConnectFrom(null);
        edit(m => {
            const already = (m.crossLinks || []).some(e =>
                (e.from === from && e.to === to) || (e.from === to && e.to === from));
            if (already) return m;
            return { ...m, crossLinks: [...(m.crossLinks || []), { id: nodeId(), from, to, label: "" }] };
        });
        setSelectedId(to);
        toast({ title: "Linked", description: "Now say what the link IS — an unlabelled arrow isn't worth revising." });
    }, [edit, toast]);

    const deleteSelected = useCallback(() => {
        if (!selected || !selected.parent) return;   // never delete the root
        edit(m => removeNode(m, selected.id));
        setSelectedId(null);
    }, [selected, edit]);

    const retidy = useCallback(() => {
        edit(m => ({ ...m, nodes: m.nodes.map(({ x: _x, y: _y, pinned: _p, ...n }) => n) }));
        requestAnimationFrame(() => canvasApi.current?.fit());
        toast({ title: "Tidied", description: "Everything back on the auto-layout." });
    }, [edit, toast]);

    // ── Recall attempt ──────────────────────────────────────────────────────
    // Rebuilding from memory and diffing against last time is the measurement
    // that makes any of this a study technique rather than a drawing tool. It
    // happens in a SEPARATE map on purpose: clearing the real one to make room
    // for the attempt would mean a closed tab mid-recall costs the student
    // their accumulated subject brain.
    const startRecall = useCallback(async () => {
        if (!map || map.nodes.length < 3) {
            toast({ title: "Not enough to recall yet", description: "Build the map out a bit first." });
            return;
        }
        const attempt = emptyMap(map.title);
        attempt.subject = map.subject;
        attempt.parentMapId = map.id;
        attempt.drillFromMapId = map.drillFromMapId;
        attempt.drillFromNodeId = map.drillFromNodeId;
        try {
            const created = await base44.entities.MindMap.create({ ...mapToRow(attempt), parent_map_id: map.id });
            const row = { ...mapToRow(attempt), parent_map_id: map.id, id: created?.id };
            setAllMaps(prev => [row, ...prev]);
            setRecallOf({ id: map.id, title: map.title, nodes: map.nodes, trail });
            openMapRow(row, [...trail, { id: created?.id, title: "From memory" }]);
            toast({ title: "Notes shut", description: `Rebuild ${map.title} from memory. Your real map is untouched.` });
        } catch (e) {
            toast({ title: "Couldn't start", description: e.message, variant: "destructive" });
        }
    }, [map, trail, openMapRow, toast]);

    const finishRecall = useCallback(() => {
        if (!recallOf || !map) return;
        const d = diffMaps({ nodes: recallOf.nodes }, map);
        setDiff(d);
        edit(m => ({ ...m, retentionScore: d.retention }));
        if (map.id) base44.entities.MindMap.update(map.id, { retention_score: d.retention }).catch(() => {});
    }, [recallOf, map, edit]);

    const leaveRecall = useCallback(() => {
        const row = allMaps.find(m => m.id === recallOf?.id);
        setDiff(null); setRecallOf(null);
        if (row) openMapRow(row, recallOf.trail);
    }, [allMaps, recallOf, openMapRow]);

    // ── Palette drag-and-drop ───────────────────────────────────────────────
    useEffect(() => {
        if (!dragType) return;
        const move = (e) => setDragAt({ x: e.clientX, y: e.clientY });
        const up = (e) => {
            const api = canvasApi.current;
            const el = document.elementFromPoint(e.clientX, e.clientY);
            const overCanvas = !!el?.closest("[data-mm-canvas]");
            if (api && overCanvas) addNode(dragType, api.clientToSvg(e.clientX, e.clientY));
            else addNode(dragType);          // a tap on the chip still adds one
            setDragType(null); setDragAt(null);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up, { once: true });
        return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    }, [dragType, addNode]);

    useEffect(() => {
        if (!connectFrom) return;
        const esc = (e) => { if (e.key === "Escape") setConnectFrom(null); };
        window.addEventListener("keydown", esc);
        return () => window.removeEventListener("keydown", esc);
    }, [connectFrom]);

    // ── Outline mode ────────────────────────────────────────────────────────
    const applyOutline = useCallback((text) => {
        setOutline(text);
        edit(m => {
            // `m.nodes` is passed in so positions, notes and confidence set on
            // the canvas survive a round trip through the outline.
            const parsed = parseOutline(text, m.nodes);
            return parsed.length ? { ...m, nodes: parsed } : m;
        });
    }, [edit]);

    const onOutlineKey = (e) => {
        if (e.key !== "Tab") return;
        e.preventDefault();
        const el = e.target;
        const { selectionStart: s, selectionEnd: en, value } = el;
        const lineStart = value.lastIndexOf("\n", s - 1) + 1;
        if (e.shiftKey) {
            if (value.slice(lineStart, lineStart + 2) === "  ") {
                applyOutline(value.slice(0, lineStart) + value.slice(lineStart + 2));
                requestAnimationFrame(() => el.setSelectionRange(Math.max(lineStart, s - 2), Math.max(lineStart, en - 2)));
            }
        } else {
            applyOutline(`${value.slice(0, lineStart)}  ${value.slice(lineStart)}`);
            requestAnimationFrame(() => el.setSelectionRange(s + 2, en + 2));
        }
    };

    // ── AI gap check ────────────────────────────────────────────────────────
    const check = async () => {
        if (!map || map.nodes.length < 3) {
            toast({ title: "Get a bit more down first", description: "Three nodes isn't a map yet." });
            return;
        }
        setBusy(true);
        try {
            const res = await base44.functions.invoke("mindMapGaps", {
                title: map.title, subject: map.subject, topic: map.topic || map.title,
                outline: toOutline(map.nodes), built_from_memory: map.phase === "blind",
            });
            const data = res?.data ?? res;
            if (data?.error) throw new Error(data.error);
            setReview(data);
            edit(m => ({ ...m, phase: "checked" }));
        } catch (e) {
            toast({ title: "Couldn't check the map", description: e.message, variant: "destructive" });
        } finally { setBusy(false); }
    };

    // ── Exports ─────────────────────────────────────────────────────────────
    const exportIds = useMemo(() => {
        if (scope === "branch" && selected) return subtreeIds(map.nodes, selected.id);
        return null;
    }, [scope, selected, map]);

    const sendToFlashcards = async () => {
        const cards = exportCards(map, exportIds);
        if (!cards.length) {
            toast({
                title: "Nothing to test on yet",
                description: "Cards come from labelled links, terms with notes, and typed nodes. Add a note to a term or label a connection and try again.",
            });
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
                description: "They're in Spaced Repetition, due today." });
        } catch (e) {
            toast({ title: "Couldn't make cards", description: e.message, variant: "destructive" });
        } finally { setBusy(false); }
    };

    const sendToRecall = () => {
        const prompts = exportPrompts(map, exportIds);
        if (!prompts.length) {
            toast({ title: "Nothing to recall yet",
                description: "Mark a node as shaky, or add an open question or a term, and it'll come through here." });
            return;
        }
        // Handed over the same way the rest of the app moves a topic between
        // techniques, so this lands in a session rather than a dead end.
        sessionStorage.setItem("acedit:recallPrompts", JSON.stringify({
            subject: map.subject, topic: map.title, prompts,
        }));
        toast({ variant: "success", title: `${prompts.length} prompts ready`,
            description: "Open Active Recall — they're waiting there." });
    };

    // ── Subject picker ──────────────────────────────────────────────────────
    if (!subject) {
        const countFor = (name) => allMaps.filter(m => m.subject_name === name)
            .reduce((s, m) => s + (m.nodes?.length || 0), 0);
        const mapsFor = (name) => allMaps.filter(m => m.subject_name === name).length;
        return (
            <div className="space-y-5">
                <div className="rounded-3xl bg-gradient-to-br from-map/10 to-transparent border-2 border-map/20 p-6">
                    <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-map/15 flex items-center justify-center flex-shrink-0">
                            <Network className="w-5 h-5 text-map" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-display font-extrabold text-foreground text-lg">One map per subject</h3>
                            <p className="text-sm text-muted-foreground mt-1 max-w-2xl leading-snug">
                                Not a document you make once. A map you keep growing all year — open any node
                                and it becomes a map of its own, so a term that turns out to be a whole topic
                                gets its own space instead of being crammed into a box. Then send any branch
                                of it straight into flashcards or recall.
                            </p>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-map" /></div>
                ) : subjects.length === 0 ? (
                    <div className="text-center py-8">
                        <Network className="w-8 h-8 text-muted-foreground/25 mx-auto mb-2" />
                        <p className="text-sm font-bold text-foreground">Add a subject first</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Your maps are organised by subject.</p>
                    </div>
                ) : (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {subjects.map(s => {
                            const n = countFor(s.subject_name);
                            return (
                                <button key={s.subject_name} onClick={() => openSubject(s.subject_name)}
                                    data-subject={s.subject_name}
                                    className="text-left card-soft p-5 border-2 border-border hover:border-map/50 hover:shadow-soft transition-all">
                                    <div className="flex items-center justify-between">
                                        <p className="font-display font-extrabold text-foreground">{s.subject_name}</p>
                                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {n === 0 ? "Nothing mapped yet — start it"
                                            : `${n} node${n === 1 ? "" : "s"} across ${mapsFor(s.subject_name)} map${mapsFor(s.subject_name) === 1 ? "" : "s"}`}
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    if (!map) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-map" /></div>;

    const Icon = TYPE_ICON[selected?.type] || Lightbulb;
    const selTone = TONE_CLASS[TYPE_BY_ID[selected?.type]?.tone] || TONE_CLASS.map;

    return (
        <div className="space-y-3">
            {/* ── Breadcrumb ─────────────────────────────────────────────── */}
            <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => { setSubject(null); setMap(null); setTrail([]); }}
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Subjects
                </button>
                <span className="text-muted-foreground/40">/</span>
                {trail.map((t, i) => (
                    <span key={t.id || i} className="inline-flex items-center gap-2 min-w-0">
                        {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />}
                        <button onClick={() => goToTrail(i)} disabled={i === trail.length - 1}
                            className={`text-sm truncate max-w-[10rem] ${i === trail.length - 1
                                ? "font-extrabold text-foreground" : "font-bold text-muted-foreground hover:text-foreground"}`}>
                            {t.title}
                        </button>
                    </span>
                ))}
                <span className="ml-auto flex items-center gap-2">
                    {saving && <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Saving</span>}
                    <div className="inline-flex rounded-xl border-2 border-border overflow-hidden">
                        {[["canvas", MousePointer2, "Canvas"], ["outline", ListTree, "Outline"]].map(([id, I, label]) => (
                            <button key={id} onClick={() => { setMode(id); if (id === "outline") setOutline(toOutline(map.nodes)); }}
                                className={`px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
                                    mode === id ? "bg-map text-white" : "text-muted-foreground hover:text-foreground"}`}>
                                <I className="w-3.5 h-3.5" /> {label}
                            </button>
                        ))}
                    </div>
                </span>
            </div>

            {/* ── A brand-new map gets the closed-book nudge, once ────────── */}
            {map.nodes.length <= 1 && (
                <div className="rounded-2xl border-2 border-map/25 bg-map/5 p-3.5 flex items-start gap-2.5">
                    <EyeOff className="w-4 h-4 text-map flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground leading-snug">
                        <span className="font-bold text-foreground">Shut your notes first.</span> Built with them
                        open this is note-taking with extra steps; built from memory it's retrieval practice, and
                        that's the difference between it working and not.
                    </p>
                </div>
            )}

            {recallOf && (
                <div className="rounded-2xl border-2 border-xp/30 bg-xp/5 p-3.5 flex items-center gap-3 flex-wrap">
                    <EyeOff className="w-4 h-4 text-xp flex-shrink-0" />
                    <p className="text-xs text-muted-foreground leading-snug min-w-0 flex-1">
                        <span className="font-bold text-foreground">Rebuilding &ldquo;{recallOf.title}&rdquo; from memory.</span>{" "}
                        Your real map is safe — this is a separate attempt.
                    </p>
                    <div className="flex gap-2">
                        <Button size="sm" onClick={finishRecall} className="rounded-xl gap-1.5 text-xs h-8 bg-xp hover:bg-xp/90 text-white">
                            <Check className="w-3.5 h-3.5" /> Compare
                        </Button>
                        <Button size="sm" variant="outline" onClick={leaveRecall} className="border-2 rounded-xl text-xs h-8">
                            Back to my map
                        </Button>
                    </div>
                </div>
            )}

            {diff && (
                <div className="rounded-2xl border-2 border-xp/30 bg-gradient-to-br from-xp/10 to-transparent p-4">
                    <p className="stat-label text-xp flex items-center gap-1.5 mb-1">
                        <TrendingUp className="w-3.5 h-3.5" /> Against your real map
                    </p>
                    <p className="font-display font-black text-3xl text-foreground tabular-nums leading-none">
                        {diff.retention}%
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                        came back from memory
                        {diff.lost.length > 0 && ` — ${diff.lost.length} dropped out`}
                        {diff.gained.length > 0 && `, ${diff.gained.length} new`}.
                    </p>
                    {diff.lost.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                            <span className="font-bold text-foreground">Gone:</span> {diff.lost.slice(0, 8).join(" · ")}
                        </p>
                    )}
                </div>
            )}

            <div className="grid lg:grid-cols-[168px_1fr_300px] gap-3">
                {/* ── Palette ────────────────────────────────────────────── */}
                <div className="lg:space-y-1.5 flex lg:block gap-2 overflow-x-auto pb-1 lg:pb-0">
                    <p className="stat-label hidden lg:block mb-2">Drag one in</p>
                    {NODE_TYPES.map(t => {
                        const I = TYPE_ICON[t.id];
                        const c = TONE_CLASS[t.tone];
                        return (
                            <button key={t.id} data-palette={t.id}
                                onPointerDown={() => { setDragType(t.id); }}
                                title={t.hint}
                                className={`flex-shrink-0 w-auto lg:w-full flex items-center gap-2 rounded-xl border-2 ${c.border} ${c.bg} px-2.5 py-2 text-left hover:shadow-soft transition-all cursor-grab active:cursor-grabbing`}>
                                <I className={`w-3.5 h-3.5 flex-shrink-0 ${c.text}`} />
                                <span className="text-xs font-bold text-foreground whitespace-nowrap">{t.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* ── Canvas / outline ───────────────────────────────────── */}
                <div className="space-y-2 min-w-0">
                    {mode === "canvas" ? (
                        <div data-mm-canvas>
                            <MindMapCanvas
                                nodes={map.nodes}
                                edges={map.crossLinks || []}
                                childMapNodeIds={childMapNodeIds}
                                selectedId={selectedId}
                                onSelect={setSelectedId}
                                onMove={moveNodes}
                                onConnect={connect}
                                onOpenNode={openNode}
                                connectFrom={connectFrom}
                                editable expandable
                                apiRef={canvasApi}
                                className="h-[460px]"
                            />
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <textarea
                                value={outline}
                                onChange={(e) => applyOutline(e.target.value)}
                                onKeyDown={onOutlineKey}
                                spellCheck={false}
                                aria-label="Mind map outline"
                                placeholder={"Photosynthesis\n  Light-dependent [step] :: happens first\n    Thylakoid membrane [term]\n  Calvin cycle [step] :: uses the ATP"}
                                className="w-full h-[420px] rounded-2xl border-2 border-border bg-surface p-4 font-mono text-sm leading-relaxed text-foreground resize-none focus:outline-none focus:border-map"
                            />
                            <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                                <span className="pill bg-secondary">Tab to nest</span>
                                <span className="pill bg-secondary">:: labels a link</span>
                                <span className="pill bg-secondary">[cause] sets a type</span>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" onClick={check} disabled={busy}
                            className="gap-1.5 bg-map hover:bg-map/90 text-white rounded-xl">
                            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                            Check what I missed
                        </Button>
                        <Button size="sm" variant="outline" onClick={retidy} className="border-2 rounded-xl gap-1.5">
                            <Wand2 className="w-3.5 h-3.5" /> Re-tidy
                        </Button>
                        {!recallOf && (
                            <Button size="sm" variant="outline" onClick={startRecall}
                                className="border-2 rounded-xl gap-1.5">
                                <EyeOff className="w-3.5 h-3.5" /> Rebuild from memory
                            </Button>
                        )}
                        {stats && (
                            <div className="flex gap-3 ml-auto text-right">
                                {[["Nodes", stats.nodes], ["Links", stats.linked + stats.crossLinks], ["Typed", stats.typed]].map(([k, v]) => (
                                    <div key={k}>
                                        <p className="font-display font-black text-base leading-none text-foreground tabular-nums">{v}</p>
                                        <p className="stat-label">{k}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Inspector ──────────────────────────────────────────── */}
                <div className="space-y-3">
                    {/* No AnimatePresence here on purpose. `mode="wait"` keeps
                        the PREVIOUS node's panel mounted while it animates out,
                        so clicking a new node shows the old node's editable
                        fields for a few hundred milliseconds — long enough to
                        start typing into the wrong node. An inspector has to
                        track the selection instantly. */}
                    {review ? (
                            <motion.div key="review" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                                <GapReview review={review} onClose={() => setReview(null)}
                                    onAddNode={(prompt) => {
                                        edit(m => {
                                            const parent = m.nodes.find(n => !n.parent)?.id || null;
                                            const spot = freeSpotNear(m.nodes, parent);
                                            return { ...m, nodes: [...m.nodes, newNode(prompt.replace(/\?*$/, "?"), { parent, type: "question", x: spot.x, y: spot.y })] };
                                        });
                                    }} />
                            </motion.div>
                        ) : selected ? (
                            <motion.div key={selected.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                className="card-soft p-4 border-2 border-border space-y-3">
                                <div className="flex items-center gap-2">
                                    <div className={`w-7 h-7 rounded-lg ${selTone.bg} flex items-center justify-center`}>
                                        <Icon className={`w-4 h-4 ${selTone.text}`} />
                                    </div>
                                    <p className="stat-label">Node</p>
                                    {selected.parent && (
                                        <button onClick={deleteSelected} aria-label="Delete node"
                                            className="ml-auto text-muted-foreground hover:text-streak">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>

                                <Input value={selected.text} aria-label="Node text"
                                    onChange={(e) => updateNode(selected.id, { text: e.target.value })}
                                    className="font-bold border-2 rounded-xl" />

                                <div>
                                    <p className="stat-label mb-1.5">What kind of thing is it?</p>
                                    <div className="grid grid-cols-2 gap-1">
                                        {NODE_TYPES.map(t => {
                                            const I = TYPE_ICON[t.id];
                                            const c = TONE_CLASS[t.tone];
                                            const on = (selected.type || "idea") === t.id;
                                            return (
                                                <button key={t.id} data-settype={t.id}
                                                    onClick={() => updateNode(selected.id, { type: t.id })}
                                                    className={`flex items-center gap-1.5 rounded-lg border-2 px-2 py-1.5 text-[11px] font-bold transition-all ${
                                                        on ? `${c.border} ${c.bg} text-foreground` : "border-border text-muted-foreground hover:text-foreground"}`}>
                                                    <I className={`w-3 h-3 flex-shrink-0 ${on ? c.text : ""}`} /> {t.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div>
                                    <p className="stat-label mb-1.5">How solid is it?</p>
                                    <div className="flex gap-1">
                                        {CONF.map(c => (
                                            <button key={c.v} onClick={() => updateNode(selected.id, { confidence: c.v })}
                                                aria-label={`Confidence ${c.label}`}
                                                className={`flex-1 rounded-lg px-1 py-1.5 text-[11px] font-bold transition-all ${
                                                    (selected.confidence || 0) === c.v ? c.cls : "bg-secondary/50 text-muted-foreground"}`}>
                                                {c.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <p className="stat-label mb-1.5">What you know about it</p>
                                    <textarea value={selected.note || ""} aria-label="Node note"
                                        onChange={(e) => updateNode(selected.id, { note: e.target.value })}
                                        placeholder="A definition, a detail, the bit you keep forgetting…"
                                        className="w-full h-20 rounded-xl border-2 border-border bg-surface p-2.5 text-xs text-foreground resize-none focus:outline-none focus:border-map" />
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                        This is what turns the node into a flashcard.
                                    </p>
                                </div>

                                {selected.parent && (
                                    <Input value={selected.link || ""} aria-label="Link label"
                                        onChange={(e) => updateNode(selected.id, { link: e.target.value })}
                                        placeholder="How it relates to its parent…"
                                        className="text-xs border-2 rounded-xl" />
                                )}

                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    <Button size="sm" variant="outline" onClick={() => setConnectFrom(selected.id)}
                                        className="border-2 rounded-xl gap-1.5 text-xs h-8">
                                        <Link2 className="w-3.5 h-3.5" /> Connect
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => openNode(selected.id)}
                                        className="border-2 rounded-xl gap-1.5 text-xs h-8">
                                        <Layers className="w-3.5 h-3.5" />
                                        {childMapNodeIds.has(selected.id) ? "Open its map" : "Make it a map"}
                                    </Button>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                className="rounded-2xl border-2 border-dashed border-border p-4 text-center">
                                <MousePointer2 className="w-5 h-5 text-muted-foreground/30 mx-auto mb-1.5" />
                                <p className="text-xs font-bold text-foreground">Pick a node</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                                    Or add one from the palette. Double-click any node to open it as its own map.
                                </p>
                            </motion.div>
                        )}

                    {/* ── Send it somewhere ──────────────────────────────── */}
                    <div className="card-soft p-4 border-2 border-border space-y-2.5">
                        <p className="stat-label flex items-center gap-1.5"><Send className="w-3.5 h-3.5" /> Use it elsewhere</p>
                        <div className="inline-flex rounded-lg border-2 border-border overflow-hidden w-full">
                            {[["map", "Whole map"], ["branch", "This branch"]].map(([id, label]) => (
                                <button key={id} onClick={() => setScope(id)} disabled={id === "branch" && !selected}
                                    className={`flex-1 px-2 py-1.5 text-[11px] font-bold transition-colors disabled:opacity-40 ${
                                        scope === id ? "bg-secondary text-foreground" : "text-muted-foreground"}`}>
                                    {label}
                                </button>
                            ))}
                        </div>
                        <Button size="sm" onClick={sendToFlashcards} disabled={busy}
                            className="w-full rounded-xl gap-1.5 text-xs h-8">
                            <Plus className="w-3.5 h-3.5" /> Make flashcards
                        </Button>
                        <Button size="sm" variant="outline" onClick={sendToRecall}
                            className="w-full border-2 rounded-xl gap-1.5 text-xs h-8">
                            <TrendingUp className="w-3.5 h-3.5" /> Send to Active Recall
                        </Button>
                        <p className="text-[10px] text-muted-foreground leading-snug">
                            Cards come from labelled links, terms with notes, and typed nodes — so a map that's
                            only boxes exports nothing, which is the honest answer.
                        </p>
                    </div>
                </div>
            </div>

            {/* The chip that follows your finger while dragging a type in. */}
            {dragType && dragAt && (
                <div className="fixed z-[60] pointer-events-none -translate-x-1/2 -translate-y-1/2"
                    style={{ left: dragAt.x, top: dragAt.y }}>
                    <span className="pill bg-map text-white shadow-soft-lg">{TYPE_BY_ID[dragType]?.label}</span>
                </div>
            )}
        </div>
    );
}
