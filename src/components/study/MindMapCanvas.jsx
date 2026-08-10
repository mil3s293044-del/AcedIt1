/**
 * MindMapCanvas — an interactive sandbox for a mind map.
 *
 * Drag nodes, connect any node to any other, drop new typed nodes in. Anything
 * the student hasn't touched is still positioned automatically, so a map made
 * by typing an outline arrives already tidy and only stops tidying itself
 * where they've disagreed with it.
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
};
const CONF_STROKE = { 1: "stroke-streak", 2: "stroke-xp", 3: "stroke-primary" };
const CONF_FILL   = { 1: "fill-streak",   2: "fill-xp",   3: "fill-primary" };

// Nodes size to their label rather than sitting at a fixed width. "CO2
// concentration" in a 170-wide box wrapped to two cramped lines; the same text
// in a box that fits it reads in one. The LAYOUT still reserves a uniform
// column so nothing can collide — only the drawn box varies.
const NODE_H = 62, ROOT_H = 72;
const MIN_W = 112, MAX_W = 200, ROOT_MIN_W = 150;
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
    const maxChars = Math.floor((MAX_W - 26) / char);
    const lines = wrap(text, maxChars, 2);
    const longest = Math.max(1, ...lines.map(l => l.length));
    const w = Math.min(MAX_W, Math.max(root ? ROOT_MIN_W : MIN_W, Math.round(longest * char) + 26));
    return { lines, w, h: root ? ROOT_H : NODE_H };
}

export default function MindMapCanvas({
    nodes = [],
    edges = [],
    childMapNodeIds = new Set(),   // nodes that already open into their own map
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
    apiRef,                        // gets { clientToSvg, fit } so a palette can drop onto us
    className = "",
}) {
    const svgRef = useRef(null);
    const wrapRef = useRef(null);
    const [full, setFull] = useState(false);
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
    const toneOf = useCallback((id) => TONE[tones.get(id)] || TONE.map, [tones]);

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
        // Raised from 0.42. At 0.42 a 14px label renders at six pixels, which
        // is a picture of a mind map rather than a mind map. Below this floor,
        // frame the middle at the floor and let them pan — the fit button is
        // right there when they want the whole thing.
        const MIN_SCALE = 0.72;
        if (el?.width && el?.height) {
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

    useEffect(() => {
        if (!full) return;
        const esc = (e) => { if (e.key === "Escape") setFull(false); };
        window.addEventListener("keydown", esc);
        return () => window.removeEventListener("keydown", esc);
    }, [full]);

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
            className={full
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
                            className={toneOf(n.id).fill} opacity="0.5" />
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
                    const tone = toneOf(n.id);
                    const type = TYPE_BY_ID[n.type];
                    const showType = type && n.type !== "idea";
                    const selected = selectedId === n.id;
                    const isSource = connectFrom === n.id;
                    const root = p.depth === 0;
                    const { lines, w, h } = boxes.get(n.id) || fitBox(n.text, p.depth);
                    // One line sits on the centre line; two straddle it. The type
                    // marker is a dot in the corner now, so it costs no height.
                    const textTop = h / 2 + (lines.length === 1 ? 5 : -3);
                    return (
                        <g key={n.id} transform={`translate(${p.x - w / 2}, ${p.y - h / 2})`}
                            onPointerDown={(e) => onNodeDown(e, n)}
                            onDoubleClick={(e) => { e.stopPropagation(); onOpenNode?.(n.id); }}
                            data-node={n.id} data-type={n.type || "idea"} data-tone={tones.get(n.id)}
                            className={compact ? "" : editable ? "cursor-grab" : "cursor-pointer"}>
                            {/* Opaque base so the tint above lands on the card
                                colour rather than on whatever the branch behind
                                it is painting. */}
                            <rect width={w} height={h} rx={root ? 18 : 15} className="fill-surface" />
                            <rect width={w} height={h} rx={root ? 18 : 15} className={tone.fill}
                                opacity={root ? 0.22 : 0.13} />
                            <rect width={w} height={h} rx={root ? 18 : 15} fill="none"
                                className={selected || isSource ? "stroke-foreground"
                                    : CONF_STROKE[n.confidence] || tone.stroke}
                                strokeWidth={selected || isSource ? 3.5 : n.confidence ? 3 : 2} />

                            {lines.map((l, i) => (
                                <text key={i} x={w / 2} y={textTop + i * 17} textAnchor="middle"
                                    style={{ fontSize: root ? ROOT_FONT : FONT }}
                                    className={`fill-foreground ${root ? "font-black" : "font-bold"}`}>
                                    {l}
                                </text>
                            ))}

                            {/* Type is a marker, not the node's whole colour —
                                colour belongs to the branch so structure is
                                visible. The word still shows on hover via the
                                title, and in the inspector. */}
                            {showType && (
                                <>
                                    <circle cx="12" cy={h / 2} r="3.5"
                                        className={TONE[type.tone]?.fill || "fill-map"} />
                                    <title>{type.label}</title>
                                </>
                            )}
                            {/* Confidence reads at a glance without opening the
                                node — the whole point of marking it. */}
                            {n.confidence > 0 && (
                                <circle cx={w - 11} cy={11} r="4.5" className={CONF_FILL[n.confidence]} />
                            )}
                            {/* This node opens into a map of its own. */}
                            {childMapNodeIds.has(n.id) && (
                                <g transform={`translate(${w - 27}, ${h - 19})`}>
                                    <rect width="18" height="12" rx="3" className={`${tone.fill} stroke-border`}
                                        strokeWidth="1" opacity="0.9" />
                                    <rect x="3" y="-3" width="18" height="12" rx="3"
                                        className={`fill-surface ${tone.stroke}`} strokeWidth="1.5" />
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
                                ? [[full ? Minimize2 : Maximize2, () => { setFull(f => !f); requestAnimationFrame(fit); },
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
                            : editable ? "Tab adds a child · Enter adds a sibling · arrows move · double-click opens a node as its own map"
                                : "Drag to move · scroll to zoom"}
                    </p>
                </>
            )}
        </div>
    );
}
