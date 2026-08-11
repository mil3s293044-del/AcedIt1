/**
 * MindMapCanvas — an interactive sandbox for a mind map.
 *
 * Drag nodes, connect any node to any other, drop new typed nodes in. Anything
 * the student hasn't touched is still positioned automatically, so a map made
 * by typing an outline arrives already tidy and only stops tidying itself
 * where they've disagreed with it.
 *
 * Colour carries two things at once. The tapered branches behind the nodes take
 * the BRANCH tone, so everything hanging off one limb of the root reads as a
 * group; the node boxes take the TYPE tone, so a term and an open question are
 * telling apart without reading either. They're legible together because they
 * never land on the same pixels.
 *
 * Pan and zoom live in the viewBox, not in a CSS transform. That's not a style
 * preference: every drag has to convert a pointer position into map
 * coordinates, `getScreenCTM()` is the only reliable way to do that, and a CSS
 * transform on the <svg> puts the result a scale factor out. Nothing in a
 * drag-and-drop canvas works if the coordinate maths is approximate.
 */
import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { layout, subtreeIds, branchTones, TYPE_BY_ID } from "@/lib/mindmap";
import { ZoomIn, ZoomOut, Maximize2, Minimize2, Scan } from "lucide-react";

// Static class strings — Tailwind never sees a class built by a template
// literal, so every one of these has to appear here in full.
const TONE = {
    map:       { fill: "fill-map",       stroke: "stroke-map",       text: "fill-map" },
    xp:        { fill: "fill-xp",        stroke: "stroke-xp",        text: "fill-xp" },
    "chart-3": { fill: "fill-chart-3",   stroke: "stroke-chart-3",   text: "fill-chart-3" },
    "chart-4": { fill: "fill-chart-4",   stroke: "stroke-chart-4",   text: "fill-chart-4" },
    primary:   { fill: "fill-primary",   stroke: "stroke-primary",   text: "fill-primary" },
    streak:    { fill: "fill-streak",    stroke: "stroke-streak",    text: "fill-streak" },
    berry:     { fill: "fill-berry",     stroke: "stroke-berry",     text: "fill-berry" },
    vine:      { fill: "fill-vine",      stroke: "stroke-vine",      text: "fill-vine" },
};
const CONF_FILL = { 1: "fill-streak", 2: "fill-xp", 3: "fill-primary" };
const CONF_WORD = { 1: "Shaky", 2: "Getting it", 3: "Solid" };

// Nodes size to their label rather than sitting at a fixed width. "CO2
// concentration" in a 170-wide box wrapped to two cramped lines; the same text
// in a box that fits it reads in one. The LAYOUT still reserves a uniform
// column so nothing can collide — only the drawn box varies.
const NODE_H = 62, ROOT_H = 72;
// PAD is the horizontal room the box keeps for chrome: the type bar down the
// left edge takes 13px of it, and the label is nudged right by half the rest so
// it still looks centred inside what's left.
const PAD = 34, BAR_SHIFT = 6;
const MIN_W = 120, MAX_W = 210, ROOT_MIN_W = 158;
const LANE_W = 190;                       // uniform slot the layout reserves
// MEASURED, not guessed: the bold face renders at ~8.9px per character at
// 13.5px, so the original 7.3 estimate overflowed every box with a long label.
// These are that measurement scaled to the sizes actually drawn, plus headroom.
const CHAR = 9.4, ROOT_CHAR = 11.1;
const FONT = 14, ROOT_FONT = 16.5;
// colGap is the whole column pitch: it has to clear the widest node plus a
// link chip. Tighter than it was, because the map's WIDTH is what decides how
// far the whole thing has to shrink to fit, and therefore how readable it is.
// rowGap is generous because the fit is almost always WIDTH-bound: a
// horizontal tree is far wider than it is tall, so vertical space in the canvas
// is free. Spreading the rows uses it and costs no scale.
const LAYOUT_OPTS = { nodeW: LANE_W, nodeH: NODE_H, colGap: 272, rowGap: 150 };

// Branch thickness by depth: a trunk leaving the root, tapering to a twig.
// This is the single thing that makes the picture read as a mind map instead
// of an org chart.
const TRUNK = [16, 9, 5.5, 3.5, 2.5];
const trunkAt = (d) => TRUNK[Math.min(d, TRUNK.length - 1)];

/**
 * A branch drawn as a filled shape rather than a stroked line, so it can be
 * thick where it leaves the parent and thin where it meets the child.
 */
function taper(a, b, w0, w1) {
    const mx = (a.x + b.x) / 2;
    return [
        `M ${a.x} ${a.y - w0 / 2}`,
        `C ${mx} ${a.y - w0 / 2}, ${mx} ${b.y - w1 / 2}, ${b.x} ${b.y - w1 / 2}`,
        `L ${b.x} ${b.y + w1 / 2}`,
        `C ${mx} ${b.y + w1 / 2}, ${mx} ${a.y + w0 / 2}, ${a.x} ${a.y + w0 / 2}`,
        "Z",
    ].join(" ");
}

/**
 * Wrap a label to at most `maxLines` lines that fit the box.
 *
 * Node boxes are a fixed height, so two lines is a hard ceiling there. Link
 * chips size themselves to their content and get three — a relationship like
 * "is the rate-limiting step" is the entire point of labelling the link, and
 * clipping it to "rate-limiting…" throws away the half that means something.
 */
function wrap(text, max = 20, maxLines = 2) {
    const words = String(text || "").split(/\s+/);
    const lines = [];
    let line = "";
    for (const w of words) {
        if ((line + " " + w).trim().length > max && line) { lines.push(line); line = w; }
        else line = (line + " " + w).trim();
        if (lines.length === maxLines) break;
    }
    if (lines.length < maxLines && line) lines.push(line);
    if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
        lines[maxLines - 1] = lines[maxLines - 1].slice(0, max - 1) + "…";
    }
    return lines;
}

/** Wrapped lines plus the box width they need. */
function fitBox(text, depth) {
    const root = depth === 0;
    const char = root ? ROOT_CHAR : CHAR;
    const maxChars = Math.floor((MAX_W - PAD) / char);
    const lines = wrap(text, maxChars, 2);
    const longest = Math.max(1, ...lines.map(l => l.length));
    const w = Math.min(MAX_W, Math.max(root ? ROOT_MIN_W : MIN_W, Math.round(longest * char) + PAD));
    return { lines, w, h: root ? ROOT_H : NODE_H };
}

export default function MindMapCanvas({
    nodes = [],
    edges = [],
    // Map<nodeId, nodeCount> — nodes that already open into their own map, and
    // how big that map is. A Set still works; it just can't show the count.
    childMapNodeIds = new Map(),
    selectedId = null,
    onSelect,
    onMove,                        // (moves: [{id,x,y}]) — committed on pointer-up
    onConnect,                     // (fromId, toId)
    onOpenNode,                    // double-click / badge — drill into a node
    onAddChild,                    // Tab — a node under the selected one
    onAddSibling,                  // Enter — a node beside the selected one
    onDelete,                      // Delete/Backspace
    connectFrom = null,            // id while the student is drawing a link
    editable = false,
    compact = false,
    expandable = false,
    // Full screen can be driven from outside. It has to be, for the builder:
    // a canvas that goes full screen on its own leaves the palette and the
    // inspector behind, which is the half of the screen you actually build
    // with. When `full` is passed the parent owns it; otherwise we do.
    full: fullProp,
    onToggleFull,
    apiRef,                        // gets { clientToSvg, fit } so a palette can drop onto us
    className = "",
}) {
    const svgRef = useRef(null);
    const wrapRef = useRef(null);
    const [fullOwn, setFullOwn] = useState(false);
    const controlled = fullProp !== undefined;
    const full = controlled ? fullProp : fullOwn;
    const toggleFull = useCallback(() => {
        if (controlled) onToggleFull?.(!fullProp);
        else setFullOwn(f => !f);
    }, [controlled, onToggleFull, fullProp]);
    const [view, setView] = useState(null);         // { x, y, w, h } — null until first fit
    const [drag, setDrag] = useState(null);         // live node drag
    const [ghost, setGhost] = useState(null);       // pointer position while connecting
    const pan = useRef(null);
    const touched = useRef(false);                  // has the student panned/zoomed?

    const { positions, minX, minY, width, height } = useMemo(
        () => layout(nodes, LAYOUT_OPTS), [nodes]);
    const tones = useMemo(() => branchTones(nodes), [nodes]);
    // Box geometry per node, computed once — the renderer, the link chips and
    // the hit areas all have to agree on it.
    const boxes = useMemo(() => {
        const out = new Map();
        for (const n of nodes) {
            const d = positions.get(n.id)?.depth ?? 1;
            out.set(n.id, fitBox(n.text, d));
        }
        return out;
    }, [nodes, positions]);
    // Two colour systems, deliberately, because they answer two different
    // questions. The BRANCH tone says "these boxes belong together" and is what
    // makes the picture a mind map; the TYPE tone says "this one is a term and
    // that one is an open question" and is what makes it classifiable. They
    // don't collide because they're painted on different things: branch on the
    // tapered connectors behind, type on the box itself.
    const toneOf = useCallback((id) => TONE[tones.get(id)] || TONE.map, [tones]);
    const typeToneOf = useCallback(
        (n) => TONE[TYPE_BY_ID[n.type]?.tone] || TONE.map, []);

    // Live drag offsets are applied at render time rather than written into
    // state on every pointermove — otherwise a 60fps drag re-lays-out the whole
    // tree sixty times a second and the node lags the cursor.
    const shown = useMemo(() => {
        if (!drag) return positions;
        const out = new Map(positions);
        for (const id of drag.ids) {
            const p = out.get(id);
            if (p) out.set(id, { ...p, x: p.x + drag.dx, y: p.y + drag.dy });
        }
        return out;
    }, [positions, drag]);

    const contentBox = useMemo(() => ({ x: minX - 30, y: minY - 30, w: width + 60, h: height + 60 }),
        [minX, minY, width, height]);

    const fit = useCallback(() => {
        touched.current = false;
        let { x, y, w, h } = contentBox;
        // Fit-to-content is right until it isn't. A twelve-node map is about
        // 1500 map-units wide; on a 350px phone canvas that fits at 0.23 scale,
        // which renders 13px text at 3px. Below a readable floor, frame the
        // middle of the map at that floor and let them pan instead — a legible
        // piece beats an illegible whole. The root sits at (0,0), which is the
        // other reason the coordinate space isn't normalised.
        const el = wrapRef.current?.getBoundingClientRect();
        if (el?.width && el?.height) {
            // The floor scales with the room available, because the trade it
            // makes goes the other way at each end.
            //
            // On a phone canvas a whole map lands at 0.25 — a four-pixel label,
            // which is a picture OF a mind map rather than a mind map. Framing
            // the middle at a readable size and letting them pan is better.
            //
            // On a desktop canvas a flat 0.72 was clipping eight of thirteen
            // nodes to buy 10px labels over 9px ones. Seeing most of your map
            // cut off at the edge reads as broken, and the fix — one scroll to
            // zoom — is right there. So a wide canvas shows the whole thing.
            const MIN_SCALE = el.width < 620 ? 0.72 : 0.45;
            const scale = Math.min(el.width / w, el.height / h);
            if (scale < MIN_SCALE) {
                w = el.width / MIN_SCALE;
                h = el.height / MIN_SCALE;
                x = -w / 2;
                y = -h / 2;
            }
        }
        setView({ x, y, w: Math.max(w, 1), h: Math.max(h, 1) });
    }, [contentBox]);

    // Refit while the student hasn't taken control of the view; once they have,
    // leave it alone — a canvas that snaps back every time you add a node is
    // unusable.
    useEffect(() => { if (!touched.current) fit(); }, [fit]);

    const clientToSvg = useCallback((clientX, clientY) => {
        const svg = svgRef.current;
        if (!svg) return { x: 0, y: 0 };
        const m = svg.getScreenCTM();
        if (!m) return { x: 0, y: 0 };
        const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
        return { x: p.x, y: p.y };
    }, []);

    useEffect(() => { if (apiRef) apiRef.current = { clientToSvg, fit }; }, [apiRef, clientToSvg, fit]);

    const zoomBy = useCallback((factor, about) => {
        setView(v => {
            if (!v) return v;
            touched.current = true;
            const w = Math.min(Math.max(v.w / factor, 200), 40000);
            const h = v.h * (w / v.w);
            const cx = about?.x ?? v.x + v.w / 2, cy = about?.y ?? v.y + v.h / 2;
            return { x: cx - (cx - v.x) * (w / v.w), y: cy - (cy - v.y) * (h / v.h), w, h };
        });
    }, []);

    // React attaches wheel passively, so preventDefault there is a no-op and
    // the page scrolls behind the zoom.
    useEffect(() => {
        const el = wrapRef.current;
        if (!el || compact) return;
        const onWheel = (e) => {
            e.preventDefault();
            zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, clientToSvg(e.clientX, e.clientY));
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    }, [zoomBy, clientToSvg, compact]);

    // The parent owns Escape when it owns full screen — otherwise Escape both
    // closes the builder and clears the selection, and you lose your place.
    useEffect(() => {
        if (!full || controlled) return;
        const esc = (e) => { if (e.key === "Escape") setFullOwn(false); };
        window.addEventListener("keydown", esc);
        return () => window.removeEventListener("keydown", esc);
    }, [full, controlled]);

    // ── Keyboard ────────────────────────────────────────────────────────────
    // Every node used to require dragging a chip in from a palette, which is
    // slow, needs a mouse, and is unreachable from a keyboard entirely. Enter
    // and Tab are what every outliner in the world uses; arrows walk the tree.
    const move = useCallback((dir) => {
        if (!selectedId) { onSelect?.(nodes.find(n => !n.parent)?.id ?? null); return; }
        const here = positions.get(selectedId);
        if (!here) return;
        const cur = nodes.find(n => n.id === selectedId);
        // Left/right follow the tree outward and inward, which on a two-sided
        // map is not the same as screen direction — a branch on the left grows
        // leftward, so "further out" there means pressing Left.
        const outward = (dir === "ArrowRight") === (here.x >= 0);
        if (dir === "ArrowLeft" || dir === "ArrowRight") {
            if (!outward) { if (cur?.parent) onSelect?.(cur.parent); return; }
            const kids = nodes.filter(n => n.parent === selectedId);
            if (kids.length) onSelect?.(kids[0].id);
            return;
        }
        // Up/down step through everything at the same depth, ordered by where
        // it actually sits on screen.
        const peers = nodes
            .map(n => ({ n, p: positions.get(n.id) }))
            .filter(x => x.p && x.p.depth === here.depth && Math.sign(x.p.x) === Math.sign(here.x))
            .sort((a, b) => a.p.y - b.p.y);
        const i = peers.findIndex(x => x.n.id === selectedId);
        const next = peers[i + (dir === "ArrowDown" ? 1 : -1)];
        if (next) onSelect?.(next.n.id);
    }, [selectedId, nodes, positions, onSelect]);

    const onKeyDown = useCallback((e) => {
        if (!editable || compact) return;
        // Never steal keys from a field the student is typing in.
        const t = e.target;
        if (t !== e.currentTarget && /^(INPUT|TEXTAREA|SELECT)$/.test(t?.tagName || "")) return;
        if (t?.isContentEditable) return;

        if (e.key === "Tab" && selectedId) { e.preventDefault(); onAddChild?.(selectedId); return; }
        if (e.key === "Enter" && selectedId) { e.preventDefault(); onAddSibling?.(selectedId); return; }
        if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
            e.preventDefault(); onDelete?.(selectedId); return;
        }
        if (e.key.startsWith("Arrow")) { e.preventDefault(); move(e.key); return; }
        if (e.key === "Escape") { e.preventDefault(); onSelect?.(null); return; }
        if (e.key === "0") { e.preventDefault(); fit(); return; }
        if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomBy(1.3); return; }
        if (e.key === "-" || e.key === "_") { e.preventDefault(); zoomBy(1 / 1.3); return; }
    }, [editable, compact, selectedId, onAddChild, onAddSibling, onDelete, onSelect, move, fit, zoomBy]);

    // ── Pointer handling ────────────────────────────────────────────────────
    const onNodeDown = (e, node) => {
        if (compact) return;
        e.stopPropagation();
        wrapRef.current?.focus?.({ preventScroll: true });
        onSelect?.(node.id);
        if (connectFrom) { if (connectFrom !== node.id) onConnect?.(connectFrom, node.id); return; }
        if (!editable || !onMove) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        const start = clientToSvg(e.clientX, e.clientY);
        // Dragging takes the whole branch. Moving a parent and leaving its
        // children behind reads as breaking the map, not as moving one box.
        setDrag({ id: node.id, ids: subtreeIds(nodes, node.id), start, dx: 0, dy: 0, moved: false });
    };

    const onPointerMove = (e) => {
        if (connectFrom) setGhost(clientToSvg(e.clientX, e.clientY));
        if (drag) {
            const p = clientToSvg(e.clientX, e.clientY);
            const dx = p.x - drag.start.x, dy = p.y - drag.start.y;
            setDrag(d => (d ? { ...d, dx, dy, moved: d.moved || Math.hypot(dx, dy) > 3 } : d));
            return;
        }
        if (pan.current) {
            const { sx, sy, v } = pan.current;
            const el = svgRef.current.getBoundingClientRect();
            setView({ ...v, x: v.x - (e.clientX - sx) * (v.w / el.width), y: v.y - (e.clientY - sy) * (v.h / el.height) });
        }
    };

    const onPointerUp = () => {
        if (drag) {
            // A click that never moved is a selection, not a drag — committing
            // it would pin the node at the position it already had.
            if (drag.moved && onMove) {
                // Dragging counts as taking control of the view. Without this
                // the auto-refit fires on the next render and re-frames the
                // whole map, so moving one node slides every other node across
                // the screen — it looks like the drag broke something.
                touched.current = true;
                onMove(drag.ids.map(id => {
                    const p = positions.get(id);
                    return { id, x: (p?.x ?? 0) + drag.dx, y: (p?.y ?? 0) + drag.dy };
                }));
            }
            setDrag(null);
        }
        pan.current = null;
    };

    const onBackgroundDown = (e) => {
        wrapRef.current?.focus?.({ preventScroll: true });
        if (compact || !view) return;
        if (connectFrom) return;
        onSelect?.(null);
        pan.current = { sx: e.clientX, sy: e.clientY, v: view };
        touched.current = true;
    };

    if (!nodes.length || !view) {
        return (
            <div ref={wrapRef} className={`relative overflow-hidden rounded-2xl bg-secondary/30 border border-border ${className}`} />
        );
    }

    return (
        <div ref={wrapRef}
            tabIndex={editable && !compact ? 0 : -1}
            onKeyDown={onKeyDown}
            className={full && !controlled
                ? "fixed inset-3 sm:inset-6 z-50 overflow-hidden rounded-2xl bg-background border-2 border-border shadow-soft-lg"
                : `relative overflow-hidden rounded-2xl bg-secondary/30 border border-border ${className}`}>
            <svg ref={svgRef}
                viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
                className={`w-full h-full select-none ${compact ? "" : "touch-none"} ${
                    connectFrom ? "cursor-crosshair" : compact ? "" : "cursor-grab"}`}
                onPointerDown={onBackgroundDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
                role="img" aria-label={`Mind map with ${nodes.length} nodes`}>

                {/* Tree branches first, so nodes sit on top of them. The S-curve
                    leaves the parent horizontally and arrives at the child the
                    same way, which is what makes a mind map read as branches
                    rather than as an org chart. */}
                {nodes.map(n => {
                    if (!n.parent) return null;
                    const a = shown.get(n.parent), b = shown.get(n.id);
                    if (!a || !b) return null;
                    const d = b.depth ?? 1;
                    return (
                        <path key={`e${n.id}`}
                            d={taper(a, b, trunkAt(d - 1), trunkAt(d))}
                            className={toneOf(n.id).fill} opacity="0.4" />
                    );
                })}

                {/* Hand-drawn connections, dashed so they read as "this isn't
                    part of the hierarchy" — which is exactly what makes them
                    worth more than an ordinary branch. */}
                {edges.map(e => {
                    const a = shown.get(e.from), b = shown.get(e.to);
                    if (!a || !b) return null;
                    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
                    const bow = Math.min(80, Math.hypot(b.x - a.x, b.y - a.y) / 4);
                    return (
                        <g key={e.id || `${e.from}-${e.to}`}>
                            <path d={`M ${a.x} ${a.y} Q ${mx} ${my - bow} ${b.x} ${b.y}`}
                                fill="none" strokeWidth="2.5" strokeDasharray="7 6"
                                className="stroke-map" opacity="0.75" />
                        </g>
                    );
                })}

                {/* The line that follows the pointer while a link is being drawn. */}
                {connectFrom && ghost && shown.get(connectFrom) && (
                    <path d={`M ${shown.get(connectFrom).x} ${shown.get(connectFrom).y} L ${ghost.x} ${ghost.y}`}
                        fill="none" strokeWidth="2.5" strokeDasharray="7 6" className="stroke-map" />
                )}

                {nodes.map(n => {
                    const p = shown.get(n.id);
                    if (!p) return null;
                    const branch = toneOf(n.id);
                    const type = TYPE_BY_ID[n.type] || TYPE_BY_ID.idea;
                    const tone = typeToneOf(n);
                    const selected = selectedId === n.id;
                    const isSource = connectFrom === n.id;
                    const root = p.depth === 0;
                    const { lines, w, h } = boxes.get(n.id) || fitBox(n.text, p.depth);
                    // One line sits on the centre line; two straddle it. The
                    // type bar is vertical down the left edge, so it costs no
                    // height either way.
                    const textTop = h / 2 + (lines.length === 1 ? 5 : -3);
                    const layers = childMapNodeIds.get?.(n.id) ?? (childMapNodeIds.has?.(n.id) ? 0 : null);
                    const hasChildMap = layers != null;
                    return (
                        <g key={n.id} transform={`translate(${p.x - w / 2}, ${p.y - h / 2})`}
                            onPointerDown={(e) => onNodeDown(e, n)}
                            onDoubleClick={(e) => { e.stopPropagation(); onOpenNode?.(n.id); }}
                            data-node={n.id} data-type={n.type || "idea"}
                            data-tone={tones.get(n.id)} data-type-tone={type.tone}
                            className={compact ? "" : editable ? "cursor-grab" : "cursor-pointer"}>
                            {/* Opaque base so the tint above lands on the card
                                colour rather than on whatever the branch behind
                                it is painting. */}
                            <rect width={w} height={h} rx={root ? 18 : 15} className="fill-surface" />
                            <rect width={w} height={h} rx={root ? 18 : 15} className={tone.fill}
                                opacity={root ? 0.2 : 0.14} />
                            <rect width={w} height={h} rx={root ? 18 : 15} fill="none"
                                className={selected || isSource ? "stroke-foreground" : tone.stroke}
                                strokeWidth={selected || isSource ? 3.5 : 2.5} />

                            {/* The type colour at FULL strength. A 14% wash of
                                it behind the text is a hint; a solid bar is
                                something you can sort thirty nodes by without
                                reading one of them. */}
                            <rect x="8" y={(h - 24) / 2} width="5" height="24" rx="2.5"
                                className={tone.fill} />
                            <title>{type.label}{n.confidence ? ` · ${CONF_WORD[n.confidence]}` : ""}</title>

                            {lines.map((l, i) => (
                                <text key={i} x={w / 2 + BAR_SHIFT} y={textTop + i * 17} textAnchor="middle"
                                    style={{ fontSize: root ? ROOT_FONT : FONT }}
                                    className={`fill-foreground ${root ? "font-black" : "font-bold"}`}>
                                    {l}
                                </text>
                            ))}

                            {/* Confidence reads at a glance without opening the
                                node — the whole point of marking it. It's a ring
                                rather than the border now, because the border
                                belongs to the type. */}
                            {n.confidence > 0 && (
                                <circle cx={w - 11} cy={11} r="4.5" className={CONF_FILL[n.confidence]} />
                            )}
                            {/* This node opens into a map of its own, and says
                                how much is behind it. "Something is down there"
                                is not enough to decide whether to go and look. */}
                            {hasChildMap && (
                                <g transform={`translate(${w / 2 - 17}, ${h - 7})`} data-child-map={n.id}
                                    className="cursor-pointer"
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={(e) => { e.stopPropagation(); onOpenNode?.(n.id); }}>
                                    <rect width="34" height="16" rx="8" className={`fill-surface ${branch.stroke}`}
                                        strokeWidth="1.5" />
                                    <text x="17" y="11.5" textAnchor="middle"
                                        className={`${branch.text} text-[10px] font-black`}>
                                        {layers > 0 ? `${layers} ▸` : "▸"}
                                    </text>
                                    <title>Open the {layers > 0 ? `${layers}-node ` : ""}map behind this node</title>
                                </g>
                            )}
                        </g>
                    );
                })}

                {/* Link labels last, on a chip, so they land on top of whatever
                    they cross. The label IS the learning — an unlabelled link is
                    the vague connection this feature exists to push students
                    past, so it gets shown rather than hidden behind a hover. It
                    wraps rather than truncating: "raises collision frequency"
                    clipped to "raises collision fre…" loses the half that means
                    something. */}
                {[
                    ...nodes.filter(n => n.parent && n.link)
                        .map(n => ({ key: `l${n.id}`, from: n.parent, to: n.id, label: n.link, anchor: true })),
                    ...edges.filter(e => e.label)
                        .map(e => ({ key: `x${e.id || e.from + e.to}`, from: e.from, to: e.to, label: e.label, anchor: false })),
                ].map(({ key, from, to, label, anchor }) => {
                    const a = shown.get(from), b = shown.get(to);
                    if (!a || !b) return null;
                    const lines = wrap(label, 15, 3);
                    const cw = Math.max(...lines.map(l => l.length)) * 6.1 + 14;
                    const ch = lines.length * 13 + 8;
                    // Tree labels anchor just outside the child rather than at
                    // the branch midpoint — the midpoint is only ever a gap of
                    // colGap-nodeW, narrower than the chip, so centring it there
                    // put "uses the ATP" straight over the root node's label.
                    const dir = b.x >= a.x ? -1 : 1;
                    const bb = boxes.get(to) || { w: MIN_W, h: NODE_H };
                    const cx = anchor ? b.x + dir * (bb.w / 2 + 8 + cw / 2) : (a.x + b.x) / 2;
                    const cy = anchor ? b.y - (bb.h + ch) / 2 - 4 : (a.y + b.y) / 2 - Math.min(80, Math.hypot(b.x - a.x, b.y - a.y) / 4) / 2;
                    return (
                        <g key={key} className="pointer-events-none">
                            <rect x={cx - cw / 2} y={cy - ch / 2} width={cw} height={ch} rx="6"
                                className={anchor ? "fill-surface stroke-border" : "fill-surface stroke-map"}
                                strokeWidth="1" />
                            {lines.map((l, i) => (
                                <text key={i} x={cx} y={cy - ch / 2 + 13 + i * 13} textAnchor="middle"
                                    className={`${anchor ? "fill-muted-foreground" : "fill-map"} text-[11px] font-semibold`}>
                                    {l}
                                </text>
                            ))}
                        </g>
                    );
                })}
            </svg>

            {/* Thumbnails are for recognising a map at a glance, so the chrome
                that helps on a full canvas just crowds them out. */}
            {!compact && (
                <>
                    <div className="absolute bottom-2 right-2 flex gap-1">
                        {[
                            [ZoomOut, () => zoomBy(1 / 1.3), "Zoom out"],
                            [ZoomIn, () => zoomBy(1.3), "Zoom in"],
                            [Scan, fit, "Fit to view"],
                            ...(expandable || full
                                ? [[full ? Minimize2 : Maximize2, () => { toggleFull(); requestAnimationFrame(fit); },
                                    full ? "Exit full screen" : "Full screen"]]
                                : []),
                        ].map(([Icon, fn, label]) => (
                            <button key={label} onClick={fn} aria-label={label}
                                className="w-8 h-8 rounded-lg bg-surface/90 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                                <Icon className="w-4 h-4" />
                            </button>
                        ))}
                    </div>
                    <p className="absolute bottom-3 left-3 right-32 hidden sm:block truncate text-[11px] text-muted-foreground/70 pointer-events-none">
                        {connectFrom ? "Click the node you want to link to · Esc to cancel"
                            : editable ? "Tab adds a child · Enter adds a sibling · arrows move · colour bar = what kind of node it is · double-click opens one as its own map"
                                : "Drag to move · scroll to zoom"}
                    </p>
                </>
            )}
        </div>
    );
}
