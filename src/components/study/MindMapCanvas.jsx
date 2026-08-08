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
import { layout, subtreeIds, TYPE_BY_ID } from "@/lib/mindmap";
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
// Depth still colours anything untyped, so an outline typed in thirty seconds
// isn't a wall of identical grey boxes.
const DEPTH_TONE = ["map", "chart-3", "chart-4", "xp"];
const CONF_STROKE = { 1: "stroke-streak", 2: "stroke-xp", 3: "stroke-primary" };
const CONF_FILL   = { 1: "fill-streak",   2: "fill-xp",   3: "fill-primary" };

// Must match the defaults handed to layout() below — the layout reserves the
// box, the canvas draws it, and a mismatch shows up as overlapping nodes.
const NODE_W = 170, NODE_H = 58;
const LAYOUT_OPTS = { nodeW: NODE_W, nodeH: NODE_H };

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

const toneOf = (node, depth) =>
    TONE[TYPE_BY_ID[node.type]?.tone] || TONE[DEPTH_TONE[Math.min(depth, DEPTH_TONE.length - 1)]];

export default function MindMapCanvas({
    nodes = [],
    edges = [],
    childMapNodeIds = new Set(),   // nodes that already open into their own map
    selectedId = null,
    onSelect,
    onMove,                        // (moves: [{id,x,y}]) — committed on pointer-up
    onConnect,                     // (fromId, toId)
    onOpenNode,                    // double-click / badge — drill into a node
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
        const MIN_SCALE = 0.42;
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

    // ── Pointer handling ────────────────────────────────────────────────────
    const onNodeDown = (e, node) => {
        if (compact) return;
        e.stopPropagation();
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
                    const mx = (a.x + b.x) / 2;
                    return (
                        <path key={`e${n.id}`}
                            d={`M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`}
                            fill="none" strokeWidth="2" className="stroke-border" />
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
                    const tone = toneOf(n, p.depth);
                    const type = TYPE_BY_ID[n.type];
                    const showType = type && n.type !== "idea";
                    const selected = selectedId === n.id;
                    const isSource = connectFrom === n.id;
                    const lines = wrap(n.text, 18, showType ? 2 : 2);
                    const w = p.depth === 0 ? NODE_W + 30 : NODE_W;
                    const textTop = showType ? NODE_H / 2 + 2 : NODE_H / 2 + (lines.length === 1 ? 5 : -2);
                    return (
                        <g key={n.id} transform={`translate(${p.x - w / 2}, ${p.y - NODE_H / 2})`}
                            onPointerDown={(e) => onNodeDown(e, n)}
                            onDoubleClick={(e) => { e.stopPropagation(); onOpenNode?.(n.id); }}
                            data-node={n.id} data-type={n.type || "idea"}
                            className={compact ? "" : editable ? "cursor-grab" : "cursor-pointer"}>
                            {/* Opaque base so the tint above lands on the card
                                colour rather than on whatever the branch behind
                                it is painting. */}
                            <rect width={w} height={NODE_H} rx="14" className="fill-surface" />
                            <rect width={w} height={NODE_H} rx="14" className={tone.fill}
                                opacity={p.depth === 0 ? 0.2 : 0.12} />
                            <rect width={w} height={NODE_H} rx="14" fill="none"
                                className={selected || isSource ? "stroke-foreground"
                                    : CONF_STROKE[n.confidence] || tone.stroke}
                                strokeWidth={selected || isSource || n.confidence ? 3 : 2} />

                            {/* Muted rather than the type's own colour. At 9px
                                on a tinted card, orange measures 2:1 and purple
                                3.5:1 — the border and the tint already say which
                                type this is, so the word only has to be
                                readable. */}
                            {showType && (
                                <text x={w / 2} y={16} textAnchor="middle" opacity="0.7"
                                    className="fill-foreground text-[9px] font-black tracking-wider">
                                    {type.label.toUpperCase()}
                                </text>
                            )}
                            {lines.map((l, i) => (
                                <text key={i} x={w / 2} y={textTop + i * 15} textAnchor="middle"
                                    className={`fill-foreground ${p.depth === 0 ? "text-[15px] font-black" : "text-[13px] font-bold"}`}>
                                    {l}
                                </text>
                            ))}

                            {/* Confidence reads at a glance without opening the
                                node — the whole point of marking it. */}
                            {n.confidence > 0 && (
                                <circle cx={w - 11} cy={11} r="4" className={CONF_FILL[n.confidence]} />
                            )}
                            {/* This node opens into a map of its own. */}
                            {childMapNodeIds.has(n.id) && (
                                <g transform={`translate(${w - 26}, ${NODE_H - 18})`}>
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
                    const cx = anchor ? b.x + dir * (NODE_W / 2 + 6 + cw / 2) : (a.x + b.x) / 2;
                    const cy = anchor ? b.y - (NODE_H + ch) / 2 - 4 : (a.y + b.y) / 2 - Math.min(80, Math.hypot(b.x - a.x, b.y - a.y) / 4) / 2;
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
                            : editable ? "Drag a node to move its branch · double-click to open it as its own map"
                                : "Drag to move · scroll to zoom"}
                    </p>
                </>
            )}
        </div>
    );
}
