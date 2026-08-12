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
    Maximize2, Minimize2, Circle, CornerDownRight,
} from "lucide-react";
import MindMapCanvas from "./MindMapCanvas";
import {
    parseOutline, toOutline, emptyMap, mapStats, exportCards, exportPrompts, diffMaps,
    NODE_TYPES, TYPE_BY_ID, newNode, removeNode, subtreeIds, freeSpotNear, nodeId,
} from "@/lib/mindmap";
import AceTip from "@/components/ace/AceTip";
import AceShuffle from "@/components/ace/AceShuffle";
import AceBody from "@/components/ace/AceBody";

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
    berry:     { text: "text-berry",     bg: "bg-berry/10",     border: "border-berry/40",     dot: "bg-berry" },
    vine:      { text: "text-vine",      bg: "bg-vine/10",      border: "border-vine/40",      dot: "bg-vine" },
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
    // rowToMap reads this back, so leaving it out of the write meant a recall
    // attempt lost its link to the map it was an attempt AT on the first save.
    parent_map_id: m.parentMapId || null,
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

/**
 * Save state, said plainly.
 *
 * A spinner that appears for 300ms and vanishes tells you nothing about
 * whether your work is safe, which is the only question worth answering here.
 * "Saved" persists; a failure persists too, and offers the retry.
 */
function SaveState({ state, onRetry }) {
    if (state === "idle") return null;
    if (state === "error") {
        return (
            <button onClick={onRetry} data-save-state="error"
                className="inline-flex items-center gap-1 rounded-lg bg-streak/15 px-2 py-1 text-[11px] font-bold text-foreground">
                <AlertTriangle className="w-3 h-3 text-streak" /> Not saved — retry
            </button>
        );
    }
    const label = state === "saving" ? "Saving" : state === "pending" ? "Unsaved" : "Saved";
    return (
        <span data-save-state={state}
            className="text-[11px] font-bold text-muted-foreground inline-flex items-center gap-1">
            {state === "saving" ? <Loader2 className="w-3 h-3 animate-spin" />
                : state === "saved" ? <Check className="w-3 h-3 text-primary" />
                    : <Circle className="w-2 h-2 fill-xp text-xp" />}
            {label}
        </span>
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
    // A freshly added node opens its name field, so Tab-Tab-Tab actually builds
    // a map instead of producing a row of boxes all called "New node".
    const [renamingId, setRenamingId] = useState(null);
    const [connectFrom, setConnectFrom] = useState(null);
    const [mode, setMode] = useState("canvas");      // canvas | outline
    const [outline, setOutline] = useState("");
    const [review, setReview] = useState(null);
    const [busy, setBusy] = useState(false);
    const [saveState, setSaveState] = useState("idle"); // idle | pending | saving | saved | error
    const [builder, setBuilder] = useState(false);   // full-screen building mode
    const [dragType, setDragType] = useState(null);  // palette chip being dragged
    const [dragAt, setDragAt] = useState(null);
    const [scope, setScope] = useState("map");       // map | branch — what exports
    const [recallOf, setRecallOf] = useState(null);  // the real map being recalled against
    const [diff, setDiff] = useState(null);
    const [confirmLayer, setConfirmLayer] = useState(null);  // map id awaiting a second click
    const canvasApi = useRef(null);
    const dirty = useRef(0);
    const savedAt = useRef(0);
    // The saved rows, mirrored in a ref. Every navigation reads FROM this list,
    // and React state hasn't committed yet at the moment a flush finishes — so
    // a handler that awaits a save and then reads `allMaps` reads the version
    // from before the save. The ref is written synchronously; the state exists
    // only to re-render.
    const allMapsRef = useRef([]);
    const mapRef = useRef(null);
    useEffect(() => { mapRef.current = map; }, [map]);

    const selected = useMemo(
        () => map?.nodes.find(n => n.id === selectedId) || null, [map, selectedId]);
    const stats = useMemo(() => (map ? mapStats(map) : null), [map]);

    // The maps that hang off nodes of this one — the layer below.
    const childMapRows = useMemo(
        () => allMaps.filter(m => m.drill_from_map_id === map?.id && m.drill_from_node_id),
        [allMaps, map]);
    // Node → how much is behind it. The count is nodes BELOW that map's own
    // root, so "0" honestly means you opened it and never put anything in.
    const childMapNodeIds = useMemo(() => new Map(
        childMapRows.map(r => [r.drill_from_node_id, Math.max(0, (r.nodes?.length || 1) - 1)])),
        [childMapRows]);
    const layers = useMemo(() => childMapRows.map(r => ({
        row: r,
        nodeId: r.drill_from_node_id,
        title: map?.nodes.find(n => n.id === r.drill_from_node_id)?.text || r.title,
        count: Math.max(0, (r.nodes?.length || 1) - 1),
    })).sort((a, b) => b.count - a.count || a.title.localeCompare(b.title)), [childMapRows, map]);

    const putRows = useCallback((rows) => {
        allMapsRef.current = rows;
        setAllMaps(rows);
    }, []);
    /** Insert or merge one row, keeping the ref and the state in step. */
    const putRow = useCallback((row) => {
        const has = row.id && allMapsRef.current.some(r => r.id === row.id);
        putRows(has
            ? allMapsRef.current.map(r => (r.id === row.id ? { ...r, ...row } : r))
            : [row, ...allMapsRef.current]);
    }, [putRows]);

    const load = useCallback(async () => {
        if (!user?.email) return;
        try {
            const rows = await base44.entities.MindMap.filter({ created_by: user.email }, "-updated_date", 200);
            putRows(rows || []);
        } catch { /* the sandbox still works unsaved */ }
        finally { setLoading(false); }
        // Depending on `user` itself would re-run this on every parent render
        // that hands down a fresh object.
    }, [user?.email, putRows]);
    useEffect(() => { load(); }, [load]);

    // ── Mutation helper ─────────────────────────────────────────────────────
    // Every change goes through here so autosave has exactly one thing to
    // watch, rather than a save call bolted onto each of fifteen handlers.
    const edit = useCallback((fn) => {
        setMap(m => (m ? fn(m) : m));
        dirty.current += 1;
    }, []);

    // ── Saving ──────────────────────────────────────────────────────────────
    // One writer, used by both the debounce and the flush, so there is exactly
    // one place that knows how a map reaches the database.
    const persist = useCallback(async (m, at) => {
        if (!m) return null;
        const row = mapToRow(m);
        if (m.id) {
            await base44.entities.MindMap.update(m.id, row);
            // THE bug this replaced: allMaps was loaded once and never touched
            // again, so every breadcrumb click, every drill-out and every
            // return to a subject reloaded the version from page load — and
            // then autosaved that back over everything since. The map appeared
            // to save and then silently un-saved itself the moment you moved.
            putRow({ ...row, id: m.id });
            savedAt.current = at;
            return m.id;
        }
        const created = await base44.entities.MindMap.create(row);
        const id = created?.id || null;
        if (id) {
            setMap(x => (x && !x.id ? { ...x, id } : x));
            if (mapRef.current && !mapRef.current.id) mapRef.current = { ...mapRef.current, id };
        }
        putRow({ ...row, id });
        savedAt.current = at;
        return id;
    }, [putRow]);

    const save = useCallback(async () => {
        if (dirty.current === savedAt.current) return true;
        const at = dirty.current;
        setSaveState("saving");
        try {
            await persist(mapRef.current, at);
            setSaveState("saved");
            return true;
        } catch (e) {
            setSaveState("error");
            toast({ title: "Couldn't save the map", description: e.message, variant: "destructive" });
            return false;
        }
    }, [persist, toast]);

    // Autosave. A "brain of storage" you can lose by closing a tab is not a
    // store, and an explicit Save button is exactly the step people skip.
    useEffect(() => {
        if (!map || dirty.current === savedAt.current) return;
        setSaveState("pending");
        const t = setTimeout(save, 900);
        return () => clearTimeout(t);
    }, [map, save]);

    // Anything that navigates has to land the pending write FIRST. The debounce
    // timer is cleared when the map changes, so without this, editing a node
    // and clicking a breadcrumb inside the next second threw the edit away.
    const flush = useCallback(async () => { await save(); }, [save]);

    // The last line of defence. A 900ms debounce is short, but "I closed the
    // tab" is exactly when losing work is unforgivable.
    useEffect(() => {
        const warn = (e) => {
            if (dirty.current === savedAt.current) return;
            e.preventDefault();
            e.returnValue = "";
        };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, []);

    // ── Opening a subject ───────────────────────────────────────────────────
    const openSubject = useCallback(async (name) => {
        await flush();
        setSubject(name);
        setSelectedId(null); setReview(null); setConnectFrom(null);
        const existing = allMapsRef.current.find(m => m.subject_name === name && m.is_subject_root);
        if (existing) {
            const m = rowToMap(existing);
            setMap(m); setTrail([{ id: m.id, title: m.title || name }]); setOutline(toOutline(m.nodes));
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
            putRow({ ...mapToRow(base), id: created?.id });
        } catch {
            setMap(base); setTrail([{ id: null, title: name }]); setOutline(toOutline(base.nodes));
            toast({ title: "Working offline", description: "Couldn't reach your saved maps — this one won't persist yet." });
        }
    }, [flush, putRow, toast]);

    const openMapRow = useCallback((row, newTrail) => {
        const m = rowToMap(row);
        setMap(m); setTrail(newTrail); setOutline(toOutline(m.nodes));
        setSelectedId(null); setReview(null); setConnectFrom(null);
        savedAt.current = dirty.current;
        setSaveState("idle");
    }, []);

    // ── Drilling a node into its own map ────────────────────────────────────
    const openNode = useCallback(async (id) => {
        const node = mapRef.current?.nodes.find(n => n.id === id);
        if (!node) return;
        // Land the pending write before leaving, then read the list back from
        // the ref — the state copy is still a render behind.
        await flush();
        const here = mapRef.current;
        const existing = allMapsRef.current.find(
            m => m.drill_from_map_id === here.id && m.drill_from_node_id === id);
        if (existing) { openMapRow(existing, [...trail, { id: existing.id, title: node.text }]); return; }

        const child = emptyMap(node.text, node.type || "idea");
        child.subject = subject;
        child.drillFromMapId = here.id;
        child.drillFromNodeId = id;
        // The node's note is the one piece of real content it already holds, so
        // it comes across rather than being stranded a level up.
        if (node.note?.trim()) {
            child.nodes.push(newNode(node.note.trim().slice(0, 60), { parent: child.nodes[0].id, type: "term" }));
        }
        try {
            const created = await base44.entities.MindMap.create(mapToRow(child));
            const row = { ...mapToRow(child), id: created?.id };
            putRow(row);
            openMapRow(row, [...trail, { id: created?.id, title: node.text }]);
        } catch (e) {
            toast({ title: "Couldn't open that node", description: e.message, variant: "destructive" });
        }
    }, [flush, putRow, subject, trail, openMapRow, toast]);

    const goToTrail = useCallback(async (i) => {
        const target = trail[i];
        if (!target || i === trail.length - 1) return;
        await flush();
        const row = allMapsRef.current.find(m => m.id === target.id);
        if (row) { openMapRow(row, trail.slice(0, i + 1)); return; }
        // An unsaved map has no row to come back to. Saying so beats a
        // breadcrumb that silently does nothing when you click it.
        toast({ title: "That level isn't saved yet", description: "Give it a moment and try again." });
    }, [trail, flush, openMapRow, toast]);

    /** Up one layer — the move you make most, so it gets its own control. */
    const goUp = useCallback(() => {
        if (trail.length > 1) goToTrail(trail.length - 2);
    }, [trail, goToTrail]);

    const openLayer = useCallback(async (layer) => {
        await flush();
        const row = allMapsRef.current.find(m => m.id === layer.row.id) || layer.row;
        openMapRow(row, [...trail, { id: row.id, title: layer.title }]);
    }, [flush, trail, openMapRow]);

    /** Every map beneath one, at any depth. A layer can have layers. */
    const descendantMapIds = useCallback((id) => {
        const out = [];
        const walk = (parentId) => {
            for (const r of allMapsRef.current) {
                if (r.drill_from_map_id === parentId) { out.push(r.id); walk(r.id); }
            }
        };
        walk(id);
        return out;
    }, []);

    /**
     * Remove a nested map and everything under it.
     *
     * There was no way to do this at all. Open a node as a map by mistake and
     * it was permanent — which also made deleting the node dangerous, because
     * the map it anchored stayed in the database with nothing pointing at it.
     */
    const deleteLayer = useCallback(async (layer) => {
        const ids = [layer.row.id, ...descendantMapIds(layer.row.id)];
        setBusy(true);
        try {
            for (const id of ids) await base44.entities.MindMap.delete(id);
            putRows(allMapsRef.current.filter(r => !ids.includes(r.id)));
            setConfirmLayer(null);
            toast({
                title: `Removed "${layer.title}"`,
                description: ids.length > 1
                    ? `That map and the ${ids.length - 1} inside it are gone. The node stays.`
                    : "The node stays — only the map behind it is gone.",
            });
        } catch (e) {
            toast({ title: "Couldn't remove that map", description: e.message, variant: "destructive" });
        } finally { setBusy(false); }
    }, [descendantMapIds, putRows, toast]);

    // ── Node operations ─────────────────────────────────────────────────────
    const addNode = useCallback((type, at) => {
        edit(m => {
            const parent = selectedId && m.nodes.some(n => n.id === selectedId)
                ? selectedId
                : m.nodes.find(n => !n.parent)?.id || null;
            const spot = at || freeSpotNear(m.nodes, parent);
            const n = newNode(TYPE_BY_ID[type]?.label || "New node", { parent, type, x: spot.x, y: spot.y });
            setSelectedId(n.id);
            // Opens its name field, same as a keyboard-added node. Without it a
            // palette click leaves a box called "Cause" that you then have to
            // find, click and rename — three actions for the one you wanted.
            setRenamingId(n.id);
            return { ...m, nodes: [...m.nodes, n] };
        });
    }, [edit, selectedId]);

    // Tab / Enter from the canvas. A new node arrives unpinned so the layout
    // places it — pinning it at a guessed spot is what made keyboard-added
    // nodes land on top of each other.
    const addRelated = useCallback((anchorId, where) => {
        edit(m => {
            const anchor = m.nodes.find(n => n.id === anchorId);
            if (!anchor) return m;
            // A sibling of the root has nowhere to go, so it becomes a child.
            const parent = where === "child" || !anchor.parent ? anchorId : anchor.parent;
            const n = newNode("New node", { parent, type: "idea" });
            setSelectedId(n.id);
            setRenamingId(n.id);
            return { ...m, nodes: [...m.nodes, n] };
        });
    }, [edit]);

    const deleteById = useCallback((id) => {
        const m = mapRef.current;
        const n = m?.nodes.find(x => x.id === id);
        if (!n || !n.parent) return;            // never delete the root
        // Deleting a node that opens into a map used to leave that map in the
        // database with nothing pointing at it — invisible, unreachable, and
        // still counted. Say so, and point at the control that removes it.
        const doomed = subtreeIds(m.nodes, id);
        const anchored = doomed.filter(x => childMapNodeIds.has(x));
        if (anchored.length) {
            const name = m.nodes.find(x => x.id === anchored[0])?.text || "It";
            toast({
                title: "That node opens into a map",
                description: `"${name}" has a map of its own. Remove it under "Inside this map" first — otherwise it'd be left with nothing pointing at it.`,
            });
            return;
        }
        edit(mm => removeNode(mm, id));
        setSelectedId(null);
    }, [edit, childMapNodeIds, toast]);

    const updateNode = useCallback((id, patch) => {
        edit(m => {
            const nodes = m.nodes.map(n => (n.id === id ? { ...n, ...patch } : n));
            const isRoot = !m.nodes.find(n => n.id === id)?.parent;
            // Renaming the root renames the MAP. It's the only way to rename
            // one, and without this the breadcrumb, the layer panel and the
            // subject list all keep showing the name you just changed. The old
            // title is kept while the field is empty mid-edit rather than
            // letting the map briefly become "".
            if (!isRoot || patch.text == null) return { ...m, nodes };
            const title = patch.text.trim() ? patch.text : m.title;
            setTrail(t => (t.length ? t.map((x, i) => (i === t.length - 1 ? { ...x, title } : x)) : t));
            return { ...m, nodes, title };
        });
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

    // The inspector's bin and the Delete key are the same action, so they go
    // through the same guard rather than one of them quietly skipping it.
    const deleteSelected = useCallback(() => {
        if (selected) deleteById(selected.id);
    }, [selected, deleteById]);

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
        // The map being recalled against has to be on disk before we walk away
        // from it — that's the whole promise of "your real map is untouched".
        await flush();
        const attempt = emptyMap(map.title);
        attempt.subject = map.subject;
        attempt.parentMapId = map.id;
        attempt.drillFromMapId = map.drillFromMapId;
        attempt.drillFromNodeId = map.drillFromNodeId;
        try {
            const created = await base44.entities.MindMap.create(mapToRow(attempt));
            const row = { ...mapToRow(attempt), id: created?.id };
            putRow(row);
            setRecallOf({ id: map.id, title: map.title, nodes: map.nodes, trail });
            openMapRow(row, [...trail, { id: created?.id, title: "From memory" }]);
            toast({ title: "Notes shut", description: `Rebuild ${map.title} from memory. Your real map is untouched.` });
        } catch (e) {
            toast({ title: "Couldn't start", description: e.message, variant: "destructive" });
        }
    }, [map, trail, flush, putRow, openMapRow, toast]);

    const finishRecall = useCallback(() => {
        if (!recallOf || !map) return;
        const d = diffMaps({ nodes: recallOf.nodes }, map);
        setDiff(d);
        edit(m => ({ ...m, retentionScore: d.retention }));
        if (map.id) base44.entities.MindMap.update(map.id, { retention_score: d.retention }).catch(() => {});
    }, [recallOf, map, edit]);

    const leaveRecall = useCallback(async () => {
        // The attempt is work too — it's what the next comparison reads.
        await flush();
        const row = allMapsRef.current.find(m => m.id === recallOf?.id);
        const back = recallOf?.trail;
        setDiff(null); setRecallOf(null);
        if (row) openMapRow(row, back);
    }, [flush, recallOf, openMapRow]);

    // ── Palette drag-and-drop ───────────────────────────────────────────────
    // A chip is both a button and a drag handle, which is why this needs a
    // latch: pointerdown arms the drag, pointerup adds the node, and then the
    // browser's own click event fires and the onClick handler adds a SECOND
    // one. Every palette click was making two nodes.
    const paletteHandled = useRef(false);
    useEffect(() => {
        if (!dragType) return;
        const move = (e) => setDragAt({ x: e.clientX, y: e.clientY });
        const up = (e) => {
            const api = canvasApi.current;
            const el = document.elementFromPoint(e.clientX, e.clientY);
            const overCanvas = !!el?.closest("[data-mm-canvas]");
            if (api && overCanvas) addNode(dragType, api.clientToSvg(e.clientX, e.clientY));
            else addNode(dragType);          // a tap on the chip still adds one
            paletteHandled.current = true;
            setDragType(null); setDragAt(null);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up, { once: true });
        return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    }, [dragType, addNode]);

    /** Keyboard activation only — the pointer path already added one. */
    const paletteClick = useCallback((id) => {
        if (paletteHandled.current) { paletteHandled.current = false; return; }
        addNode(id);
    }, [addNode]);

    useEffect(() => {
        if (!connectFrom) return;
        const esc = (e) => { if (e.key === "Escape") setConnectFrom(null); };
        window.addEventListener("keydown", esc);
        return () => window.removeEventListener("keydown", esc);
    }, [connectFrom]);

    // Escape leaves the builder, but only once it has nothing more urgent to
    // do — cancelling a link you're drawing comes first, then clearing the
    // selection, which the canvas owns.
    useEffect(() => {
        if (!builder) return;
        document.body.style.overflow = "hidden";
        const esc = (e) => {
            if (e.key !== "Escape" || connectFrom || selectedId) return;
            setBuilder(false);
        };
        window.addEventListener("keydown", esc);
        return () => {
            document.body.style.overflow = "";
            window.removeEventListener("keydown", esc);
        };
    }, [builder, connectFrom, selectedId]);

    // Entering or leaving full screen changes how much room the map has, so it
    // gets re-framed. Two frames because the layout has to settle first.
    useEffect(() => {
        const t = requestAnimationFrame(() => requestAnimationFrame(() => canvasApi.current?.fit()));
        return () => cancelAnimationFrame(t);
    }, [builder]);

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
        const forSubject = (name) => allMaps.filter(m => m.subject_name === name);
        const countFor = (name) => forSubject(name).reduce((s, m) => s + (m.nodes?.length || 0), 0);
        const mapsFor = (name) => forSubject(name).length;
        // "When did I last touch this" is the thing that decides which subject
        // to open, and the card was three rows of nothing without it.
        const lastFor = (name) => {
            const t = forSubject(name)
                .map(m => Date.parse(m.updated_date || m.created_date || ""))
                .filter(Number.isFinite);
            if (!t.length) return null;
            const days = Math.floor((Date.now() - Math.max(...t)) / 86400000);
            return days <= 0 ? "today" : days === 1 ? "yesterday"
                : days < 14 ? `${days} days ago`
                    : days < 60 ? `${Math.round(days / 7)} weeks ago` : `${Math.round(days / 30)} months ago`;
        };
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
                    <div className="flex justify-center py-10"><AceShuffle size="lg" /></div>
                ) : subjects.length === 0 ? (
                    <div className="text-center py-8">
                        <AceBody className="w-24 mx-auto" pose="point" title="Ace" />
                        <p className="text-sm font-bold text-foreground">Add a subject first</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Your maps are organised by subject.</p>
                    </div>
                ) : (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {subjects.map(s => {
                            const n = countFor(s.subject_name);
                            const maps = mapsFor(s.subject_name);
                            const last = lastFor(s.subject_name);
                            return (
                                <button key={s.subject_name} onClick={() => openSubject(s.subject_name)}
                                    data-subject={s.subject_name}
                                    className="text-left card-soft p-5 border-2 border-border hover:border-map/50 hover:shadow-soft transition-all">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="font-display font-extrabold text-foreground truncate">{s.subject_name}</p>
                                        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                    </div>
                                    {n === 0 ? (
                                        <p className="text-xs text-muted-foreground mt-1">Nothing mapped yet — start it</p>
                                    ) : (
                                        <>
                                            <div className="flex items-baseline gap-3 mt-2">
                                                <div>
                                                    <p className="font-display font-black text-xl leading-none text-foreground tabular-nums">{n}</p>
                                                    <p className="stat-label">nodes</p>
                                                </div>
                                                <div>
                                                    <p className="font-display font-black text-xl leading-none text-foreground tabular-nums">{maps}</p>
                                                    <p className="stat-label">layer{maps === 1 ? "" : "s"}</p>
                                                </div>
                                            </div>
                                            {last && <p className="text-[11px] text-muted-foreground mt-2">Last worked on {last}</p>}
                                        </>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    if (!map) return <div className="flex justify-center py-10"><AceShuffle size="lg" /></div>;

    const Icon = TYPE_ICON[selected?.type] || Lightbulb;
    const selTone = TONE_CLASS[TYPE_BY_ID[selected?.type]?.tone] || TONE_CLASS.map;

    return (
        // Full-screen building mode. It carries the whole editor — breadcrumb,
        // palette, canvas, inspector — because a full-screen CANVAS on its own
        // leaves behind the two panels you build with, which made it a viewing
        // mode wearing a builder's name.
        <div data-builder={builder || undefined}
            className={builder
                ? "fixed inset-0 z-50 bg-background overflow-y-auto p-3 sm:p-4 space-y-3"
                : "space-y-3"}>
            {/* ── Breadcrumb ─────────────────────────────────────────────── */}
            <div className="flex items-center gap-2 flex-wrap">
                {trail.length > 1 ? (
                    <button onClick={goUp} aria-label="Up one layer"
                        className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowLeft className="w-4 h-4" /> Up
                    </button>
                ) : (
                    <button onClick={async () => { await flush(); setSubject(null); setMap(null); setTrail([]); setBuilder(false); }}
                        className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowLeft className="w-4 h-4" /> Subjects
                    </button>
                )}
                <span className="text-muted-foreground/40">/</span>
                {/* Deep trails collapse in the middle rather than wrapping onto
                    a third line — where you are and where you came from are the
                    two ends, and those are what stay. */}
                {(trail.length > 4 ? [trail[0], { ellipsis: true }, ...trail.slice(-2)] : trail).map((t, i) => (
                    t.ellipsis ? (
                        <span key="gap" className="inline-flex items-center gap-2">
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />
                            <span className="text-sm font-bold text-muted-foreground/60">…</span>
                        </span>
                    ) : (
                        <span key={t.id || i} className="inline-flex items-center gap-2 min-w-0">
                            {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />}
                            <button onClick={() => goToTrail(trail.indexOf(t))} disabled={t === trail[trail.length - 1]}
                                data-crumb={t.title}
                                className={`text-sm truncate max-w-[10rem] ${t === trail[trail.length - 1]
                                    ? "font-extrabold text-foreground" : "font-bold text-muted-foreground hover:text-foreground"}`}>
                                {t.title}
                            </button>
                        </span>
                    )
                ))}
                <span className="ml-auto flex items-center gap-2">
                    <SaveState state={saveState} onRetry={save} />
                    <div className="inline-flex rounded-xl border-2 border-border overflow-hidden">
                        {[["canvas", MousePointer2, "Canvas"], ["outline", ListTree, "Outline"]].map(([id, I, label]) => (
                            <button key={id} onClick={() => { setMode(id); if (id === "outline") setOutline(toOutline(map.nodes)); }}
                                className={`px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
                                    mode === id ? "bg-map text-white" : "text-muted-foreground hover:text-foreground"}`}>
                                <I className="w-3.5 h-3.5" /> {label}
                            </button>
                        ))}
                    </div>
                    <button onClick={() => setBuilder(b => !b)} data-builder-toggle
                        aria-pressed={builder}
                        title={builder ? "Leave full screen (Esc)" : "Build full screen"}
                        className={`inline-flex items-center gap-1.5 rounded-xl border-2 px-2.5 py-1.5 text-xs font-bold transition-colors ${
                            builder ? "border-map bg-map text-white" : "border-border text-muted-foreground hover:text-foreground"}`}>
                        {builder ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                        <span className="hidden sm:inline">{builder ? "Exit" : "Full screen"}</span>
                    </button>
                </span>
            </div>

            {/* ── A brand-new map gets the closed-book nudge, once ────────── */}
            {map.nodes.length <= 1 && (
                <div className="rounded-2xl border-2 border-map/25 bg-map/5 p-3.5 flex items-end gap-3"
                    data-ace-mapnudge>
                    <AceBody className="w-16 sm:w-20 flex-shrink-0" pose="alert" title="Ace" />
                    <p className="text-xs text-muted-foreground leading-snug flex-1 min-w-0 pb-1">
                        <span className="font-bold text-foreground">Shut your notes first.</span> Built with them
                        open this is note-taking with extra steps; built from memory it&rsquo;s retrieval practice, and
                        that&rsquo;s the difference between it working and not.
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
                        <TrendingUp className="w-3.5 h-3.5" /> Against your real map <AceTip term="retention_score" />
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

            {/* The palette used to be a permanent 168px column down the left,
                which cost the canvas a fifth of its width to eight chips that
                are used occasionally. It's a strip above the canvas now, and
                the chips ADD on click as well as drag — dragging was the only
                way in, which is slow on a desktop and impossible on a keyboard. */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                <span className="stat-label flex-shrink-0 hidden sm:inline">Add</span>
                {NODE_TYPES.map(t => {
                    const I = TYPE_ICON[t.id];
                    const c = TONE_CLASS[t.tone];
                    return (
                        <button key={t.id} data-palette={t.id} data-palette-tone={t.tone}
                            onPointerDown={() => { setDragType(t.id); }}
                            onClick={() => paletteClick(t.id)}
                            title={`${t.hint} — click to add under the selected node, or drag onto the canvas`}
                            className={`flex-shrink-0 flex items-center gap-1.5 rounded-xl border-2 ${c.border} ${c.bg} pl-1.5 pr-2.5 py-1.5 hover:shadow-soft transition-all`}>
                            {/* The same solid bar the node draws down its left
                                edge, so this strip doubles as the legend rather
                                than needing one of its own. */}
                            <span className={`w-1.5 h-4 rounded-full flex-shrink-0 ${c.dot}`} />
                            <I className={`w-3.5 h-3.5 flex-shrink-0 ${c.text}`} />
                            <span className="text-xs font-bold text-foreground whitespace-nowrap">{t.label}</span>
                        </button>
                    );
                })}
            </div>

            <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-3">
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
                                full={builder}
                                onToggleFull={setBuilder}
                                onAddChild={(id) => addRelated(id, "child")}
                                onAddSibling={(id) => addRelated(id, "sibling")}
                                onDelete={deleteById}
                                apiRef={canvasApi}
                                /* The canvas is the feature; it was getting 28%
                                   of the page. Fills the viewport now, with a
                                   floor so a short window still shows a map. */
                                className={builder
                                    ? "h-[calc(100vh-210px)] min-h-[420px]"
                                    : "h-[calc(100vh-340px)] min-h-[440px]"}
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
                                className="w-full h-[calc(100vh-360px)] min-h-[420px] rounded-2xl border-2 border-border bg-surface p-4 font-mono text-sm leading-relaxed text-foreground resize-none focus:outline-none focus:border-map"
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
                    {/* ── The layer below ────────────────────────────────
                        Drilling in was easy and getting back out was a
                        breadcrumb; knowing what was down there at all needed
                        you to remember. This lists it, sized, so the nesting
                        is navigable rather than just possible. */}
                    {layers.length > 0 && (
                        <div className="card-soft p-4 border-2 border-border space-y-2">
                            <p className="stat-label flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5" /> Inside this map
                            </p>
                            <ul className="space-y-1">
                                {layers.map(l => (
                                    <li key={l.row.id} className="flex items-center gap-1">
                                        <button onClick={() => openLayer(l)} data-layer={l.title}
                                            className={`min-w-0 flex-1 text-left flex items-center gap-2 rounded-xl border-2 px-2.5 py-1.5 transition-colors ${
                                                selectedId === l.nodeId
                                                    ? "border-map/50 bg-map/5" : "border-border hover:border-map/40"}`}>
                                            <CornerDownRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                            <span className="text-xs font-bold text-foreground truncate flex-1">{l.title}</span>
                                            <span className="text-[11px] text-muted-foreground tabular-nums flex-shrink-0">
                                                {l.count === 0 ? "empty" : l.count}
                                            </span>
                                        </button>
                                        {/* Two clicks, not a modal. Removing a map is
                                            worth a pause; it isn't worth a dialog. */}
                                        <button
                                            onClick={() => (confirmLayer === l.row.id ? deleteLayer(l) : setConfirmLayer(l.row.id))}
                                            onBlur={() => setConfirmLayer(c => (c === l.row.id ? null : c))}
                                            disabled={busy}
                                            data-remove-layer={l.title}
                                            aria-label={confirmLayer === l.row.id ? `Confirm removing ${l.title}` : `Remove the map behind ${l.title}`}
                                            className={`flex-shrink-0 rounded-lg px-1.5 py-1.5 text-[10px] font-bold transition-colors ${
                                                confirmLayer === l.row.id
                                                    ? "bg-streak text-white"
                                                    : "text-muted-foreground hover:text-streak"}`}>
                                            {confirmLayer === l.row.id ? "Sure?" : <Trash2 className="w-3.5 h-3.5" />}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                            <p className="text-[10px] text-muted-foreground leading-snug">
                                Any node can become one of these — open it and it gets a map of its own.
                                Removing one here leaves the node itself alone.
                            </p>
                        </div>
                    )}

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

                                {/* A node added with Tab or Enter opens focused
                                    and selected, so you type the name and hit
                                    Tab again. Without this, keyboard building
                                    produced a row of boxes all called "New
                                    node" that then had to be renamed one by one. */}
                                <Input value={selected.text} aria-label="Node text"
                                    ref={(el) => {
                                        if (el && renamingId && renamingId === selected.id) {
                                            el.focus(); el.select();
                                            setRenamingId(null);
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") { e.preventDefault(); addRelated(selected.id, "sibling"); }
                                        if (e.key === "Tab" && !e.shiftKey) { e.preventDefault(); addRelated(selected.id, "child"); }
                                    }}
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
                                    <p className="stat-label mb-1.5 inline-flex items-center gap-1">
                                        How solid is it? <AceTip term="node_confidence" />
                                    </p>
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
