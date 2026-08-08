/**
 * MindMapCanvas — renders a laid-out tree as SVG.
 *
 * Read-and-zoom, not drag-and-drop. Fiddly node placement is what kills mind
 * map tools before any learning happens, so position is computed rather than
 * authored: the student types an outline and the picture draws itself. That
 * trade is the whole ease-of-use story — you give up bespoke arrangement and
 * get a map in thirty seconds instead of ten minutes.
 */
import React, { useMemo, useState, useRef, useEffect } from "react";
import { layout, indexTree } from "@/lib/mindmap";
import { ZoomIn, ZoomOut, Maximize2, Minimize2, Scan } from "lucide-react";

// Depth decides colour, so a glance tells you the shape of the hierarchy.
// Static strings — Tailwind never sees a class built by template literal.
//
// Nodes are a tint plus a coloured border rather than a solid fill. A solid
// fill forces a choice of label colour that can't hold in both themes: white
// on the dark-mode teal measures 2.2:1, and the orange ring is worse. Tinting
// lets every label stay `fill-foreground`, which is legible by construction —
// and a map of soft cards reads better than a wall of saturated boxes anyway.
const RING = [
    { fill: "fill-map",     stroke: "stroke-map" },
    { fill: "fill-chart-3", stroke: "stroke-chart-3" },
    { fill: "fill-chart-4", stroke: "stroke-chart-4" },
    { fill: "fill-xp",      stroke: "stroke-xp" },
];
// Confidence overrides depth colour — a shaky node should be findable instantly.
const CONF_STROKE = { 1: "stroke-streak", 2: "stroke-xp", 3: "stroke-primary" };

// Must match the defaults in layout() — the layout reserves the box, the
// canvas draws it, and a mismatch shows up as overlapping nodes.
const NODE_W = 150, NODE_H = 50;

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

export default function MindMapCanvas({ nodes, selectedId, onSelect, hidden = new Set(), compact = false, expandable = false, className = "" }) {
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [full, setFull] = useState(false);
    const drag = useRef(null);

    const { positions, width, height } = useMemo(
        () => layout(nodes || [], { nodeW: NODE_W, nodeH: NODE_H }), [nodes]);
    const { byId } = useMemo(() => indexTree(nodes?.length ? nodes : [{ id: "_", parent: null }]), [nodes]);

    // A twelve-node map needs roughly 1600px to be readable, and no panel in a
    // two-column layout has that. Fit-to-view is the right default — it shows
    // the shape — but reading the thing needs the whole window.
    useEffect(() => {
        if (!full) return;
        const esc = (e) => { if (e.key === "Escape") setFull(false); };
        window.addEventListener("keydown", esc);
        return () => window.removeEventListener("keydown", esc);
    }, [full]);

    if (!nodes?.length) return null;

    const pannable = zoom !== 1 || full;
    const startPan = (e) => {
        if (!pannable) return;
        const pt = e.touches?.[0] || e;
        drag.current = { x: pt.clientX - pan.x, y: pt.clientY - pan.y };
    };
    const movePan = (e) => {
        if (!drag.current) return;
        const pt = e.touches?.[0] || e;
        setPan({ x: pt.clientX - drag.current.x, y: pt.clientY - drag.current.y });
    };
    const endPan = () => { drag.current = null; };

    return (
        <div className={full
            ? "fixed inset-3 sm:inset-6 z-50 overflow-hidden rounded-2xl bg-background border-2 border-border shadow-soft-lg"
            : `relative overflow-hidden rounded-2xl bg-secondary/30 border border-border ${className}`}>
            {/* A margin so a label chip riding above the topmost branch isn't
                clipped by the edge of the box the layout sized. */}
            {/* Panning only exists once you're zoomed past fit-to-view. At zoom 1
                the whole map is already on screen, so swallowing touches there
                would just stop the page scrolling under a full-width canvas. */}
            <svg viewBox={`-28 -28 ${width + 56} ${height + 56}`}
                className={`w-full h-full select-none ${pannable ? "touch-none cursor-grab" : ""}`}
                style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "center" }}
                onMouseDown={startPan} onMouseMove={movePan} onMouseUp={endPan} onMouseLeave={endPan}
                onTouchStart={startPan} onTouchMove={movePan} onTouchEnd={endPan}
                role="img" aria-label={`Mind map with ${nodes.length} nodes`}>

                {/* Edges first so nodes sit on top of them. The S-curve leaves
                    the parent horizontally and arrives at the child the same
                    way, which is what makes a mind map read as branches rather
                    than as an org chart. */}
                {nodes.map(n => {
                    if (!n.parent) return null;
                    const a = positions.get(n.parent), b = positions.get(n.id);
                    if (!a || !b) return null;
                    const mx = (a.x + b.x) / 2;
                    return (
                        <path key={`e${n.id}`}
                            d={`M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`}
                            fill="none" strokeWidth="2" className="stroke-border" />
                    );
                })}

                {nodes.map(n => {
                    const p = positions.get(n.id);
                    if (!p) return null;
                    const ring = RING[Math.min(p.depth, RING.length - 1)];
                    const isHidden = hidden.has(n.id);
                    const selected = selectedId === n.id;
                    // 16 chars is what actually fits 150px at 13px bold — 18 let
                    // "Thylakoid membrane" spill past its own border.
                    const lines = isHidden ? ["?"] : wrap(n.text, 16);
                    const w = p.depth === 0 ? NODE_W + 28 : NODE_W;
                    return (
                        <g key={n.id} transform={`translate(${p.x - w / 2}, ${p.y - NODE_H / 2})`}
                            onClick={(e) => { e.stopPropagation(); onSelect?.(n.id); }}
                            className={onSelect ? "cursor-pointer" : ""}>
                            {/* Opaque base so the tint above lands on the card
                                colour rather than on whatever the edge behind
                                it is painting. */}
                            <rect width={w} height={NODE_H} rx="14" className="fill-surface" />
                            <rect width={w} height={NODE_H} rx="14"
                                className={isHidden ? "fill-secondary" : ring.fill}
                                opacity={isHidden ? 0.5 : p.depth === 0 ? 0.22 : 0.14} />
                            <rect width={w} height={NODE_H} rx="14" fill="none"
                                className={selected ? "stroke-foreground"
                                    : CONF_STROKE[n.confidence] || ring.stroke}
                                strokeWidth={selected || n.confidence ? 3 : 2}
                                opacity={isHidden ? 0.4 : 1} />
                            {lines.map((l, i) => (
                                <text key={i} x={w / 2} y={NODE_H / 2 + (lines.length === 1 ? 5 : i * 15 - 3)}
                                    textAnchor="middle"
                                    className={`${isHidden ? "fill-muted-foreground" : "fill-foreground"} ${
                                        p.depth === 0 ? "text-[15px] font-black" : "text-[13px] font-bold"}`}>
                                    {l}
                                </text>
                            ))}
                        </g>
                    );
                })}

                {/* Edge labels last, on a chip, so they land on top of whatever
                    they cross. The label IS the learning — an unlabelled edge is
                    the vague link this feature exists to push students past, so
                    it gets shown rather than hidden behind a hover. It wraps
                    rather than truncating: "raises collision frequency" clipped
                    to "raises collision fre…" loses the half that means
                    something. */}
                {nodes.map(n => {
                    if (!n.parent || !n.link) return null;
                    const a = positions.get(n.parent), b = positions.get(n.id);
                    if (!a || !b) return null;
                    const lines = wrap(n.link, 15, 3);
                    const cw = Math.max(...lines.map(l => l.length)) * 6.1 + 14;
                    const ch = lines.length * 13 + 8;
                    // Anchored just outside the child rather than at the branch
                    // midpoint. The midpoint is only ever a gap of colGap-nodeW,
                    // which is narrower than the chip — centring it there put
                    // "uses the ATP" straight over the root node's own label.
                    // Lifted clear of the branch too, since a parent and child
                    // on the same row are joined by a dead-straight line.
                    const dir = b.x >= a.x ? -1 : 1;
                    const cx = b.x + dir * (NODE_W / 2 + 6 + cw / 2);
                    const cy = b.y - (NODE_H + ch) / 2 - 4;
                    return (
                        <g key={`l${n.id}`}>
                            <rect x={cx - cw / 2} y={cy - ch / 2} width={cw} height={ch} rx="6"
                                className="fill-surface stroke-border" strokeWidth="1" />
                            {lines.map((l, i) => (
                                <text key={i} x={cx} y={cy - ch / 2 + 13 + i * 13} textAnchor="middle"
                                    className="fill-muted-foreground text-[11px] font-semibold">
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
                            [ZoomOut, () => setZoom(z => Math.max(0.4, z - 0.2)), "Zoom out"],
                            [ZoomIn, () => setZoom(z => Math.min(2.5, z + 0.2)), "Zoom in"],
                            [Scan, () => { setZoom(1); setPan({ x: 0, y: 0 }); }, "Fit to view"],
                            ...(expandable || full
                                ? [[full ? Minimize2 : Maximize2, () => { setFull(f => !f); setZoom(1); setPan({ x: 0, y: 0 }); },
                                    full ? "Exit full screen" : "Full screen"]]
                                : []),
                        ].map(([Icon, fn, label]) => (
                            <button key={label} onClick={fn} aria-label={label}
                                className="w-8 h-8 rounded-lg bg-surface/90 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                                <Icon className="w-4 h-4" />
                            </button>
                        ))}
                    </div>
                    {/* Hidden on narrow screens, where it ran straight under the
                        zoom buttons. */}
                    {byId.size > 0 && (
                        <p className="absolute bottom-3 left-3 right-32 hidden sm:block truncate text-[11px] text-muted-foreground/70 pointer-events-none">
                            {pannable ? "Drag to move · " : ""}Use the buttons to zoom{full ? " · Esc to close" : ""}
                        </p>
                    )}
                </>
            )}
        </div>
    );
}
