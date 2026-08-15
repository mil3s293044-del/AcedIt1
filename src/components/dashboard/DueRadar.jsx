/**
 * DueRadar — what is coming, drawn as the thing the panel was already called.
 *
 * It was a list of rows with pink pills under the heading "On your radar",
 * which is a word doing the work a picture should. Time until due is a
 * distance, so the dial is not a metaphor laid over the data — the geometry is
 * the data. Centre is now; the rim is a fortnight out; a subject keeps its
 * bearing from one week to the next, so eventually you stop reading the labels
 * and recognise the shape of your own fortnight.
 *
 * THE GRID IS SVG, THE BLIPS ARE HTML. Everything decorative — rings, spokes,
 * the sweep — is one inert SVG marked aria-hidden. Every blip is a real anchor
 * positioned over the top, so it tabs, focuses, shows a title on hover and
 * navigates on click. Drawing the blips inside the SVG would have meant
 * reinventing all four of those, badly.
 *
 * THE SWEEP COSTS ONE TRANSFORM. The dial rotates a single group; each blip
 * flares on a CSS animation whose period matches the sweep's, delayed by that
 * blip's bearing, so it lights exactly as the beam crosses it. Nothing reads
 * the sweep's angle at runtime and there is no frame loop — the whole thing is
 * a compositor rotation plus N keyframe animations, on a page people scroll.
 *
 * SOUND IS OFF AND STAYS OFF UNTIL ASKED. A dashboard that pings at you the
 * moment it loads is a dashboard people close, and browsers block unprompted
 * audio anyway. The ping is the flare. If we ever add the real thing it goes
 * behind a switch that remembers, which is why the flare is a separate concern
 * from the blip in the first place.
 *
 * IT NEVER PRETENDS TO BE FULL. Nothing due means an empty dial and a sentence
 * saying so, not a scattering of decorative dots.
 */
import React from "react";
import { Link } from "react-router-dom";
import { useReducedMotion } from "framer-motion";
import { createPageUrl } from "@/utils";
import { colorFor } from "@/components/cards/cardIdentity";
import { plotRadar, flareDelay, radiusOf, HORIZON_DAYS, CORE_R, EDGE_R } from "@/lib/radar";

/** One revolution. Slow enough to be ambient, quick enough to notice. */
const SWEEP_MS = 5200;

/** The rings that carry a label, in days. */
const RINGS = [3, 7, HORIZON_DAYS];

const dayLabel = (d) => (d <= 0 ? "now" : d === 1 ? "tomorrow" : `in ${d} days`);

export default function DueRadar({ items = [], className = "" }) {
    const reduce = useReducedMotion();
    // Past the horizon it is not "coming up", it is just term. The cap keeps
    // the dial from turning into a rim of dots that never move.
    const near = items.filter((i) => Number(i.days) <= HORIZON_DAYS);
    const blips = plotRadar(near);
    const overdue = blips.filter((b) => b.overdue).length;

    return (
        <div data-due-radar={blips.length} className={`card-soft on-table p-5 ${className}`}>
            <div className="flex items-baseline justify-between gap-3 mb-1">
                <p className="stat-label">On your radar</p>
                {blips.length > 0 && (
                    <Link to={createPageUrl("Goals")}
                        className="text-[11px] font-bold text-muted-foreground hover:text-foreground
                            underline underline-offset-2">
                        See all {items.length}
                    </Link>
                )}
            </div>

            <div className="relative mx-auto w-full max-w-[260px] aspect-square my-2">
                {/* ── The dial. Inert, decorative, one element. ─────────── */}
                <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full"
                    aria-hidden="true">
                    <defs>
                        <radialGradient id="radar-ground" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.07" />
                            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.015" />
                        </radialGradient>
                        {/* The beam: opaque at its leading edge, gone by the
                            time it has swept a quarter turn behind itself. */}
                        <linearGradient id="radar-beam" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.22" />
                        </linearGradient>
                    </defs>

                    <circle cx="100" cy="100" r={EDGE_R} fill="url(#radar-ground)" />

                    {RINGS.map((d) => {
                        const r = radiusOf(d);
                        return (
                            <g key={d}>
                                <circle cx="100" cy="100" r={r} fill="none"
                                    className="stroke-border" strokeWidth="1" />
                                {/* ON the ring, not in a row underneath it. The
                                    labels used to sit in a flex row across the
                                    bottom — now, 3d, 7d, 14d, left to right —
                                    under a set of concentric circles, which
                                    reads as a linear axis and is the one thing
                                    a dial is not. */}
                                {/* INSIDE the ring, not above it. At the rim
                                    the outer label sat at y=1 in a 200-high
                                    viewBox and the top of "14d" was cut clean
                                    off by the edge of the box. */}
                                <text x={100} y={100 - r + 9} textAnchor="middle"
                                    className="fill-muted-foreground/70"
                                    style={{ fontSize: 7, fontWeight: 700 }}>
                                    {`${d}d`}
                                </text>
                            </g>
                        );
                    })}

                    {/* The core. Inside this is late, not close. */}
                    <circle cx="100" cy="100" r={CORE_R} fill="none"
                        className="stroke-border" strokeWidth="1" strokeDasharray="3 3" />
                    <text x={100} y={100 - CORE_R - 4} textAnchor="middle"
                        className="fill-muted-foreground/70"
                        style={{ fontSize: 7, fontWeight: 700 }}>now</text>

                    {[0, 45, 90, 135].map((a) => (
                        <line key={a} x1="100" y1="100" x2="100" y2={100 - EDGE_R}
                            className="stroke-border/60" strokeWidth="0.75"
                            transform={`rotate(${a} 100 100)`} />
                    ))}

                    {!reduce && (
                        <g style={{
                            transformOrigin: "100px 100px",
                            animation: `radar-sweep ${SWEEP_MS}ms linear infinite`,
                        }}>
                            {/* A wedge, not a line: the leading edge reads as
                                the beam and the tail as its afterglow. */}
                            {/* A quarter turn of afterglow, not a third of the
                                dial. The wider wedge read as a green pie slice
                                sitting on the panel rather than as light
                                trailing a beam. */}
                            <path d={`M100 100 L100 ${100 - EDGE_R} A${EDGE_R} ${EDGE_R} 0 0 0 ${
                                100 - EDGE_R * Math.sin(Math.PI / 4)} ${
                                100 - EDGE_R * Math.cos(Math.PI / 4)} Z`}
                                fill="url(#radar-beam)" />
                            <line x1="100" y1="100" x2="100" y2={100 - EDGE_R}
                                className="stroke-primary" strokeWidth="1.25" strokeOpacity="0.55" />
                        </g>
                    )}
                </svg>

                {/* ── The blips. Real links, over the top. ─────────────── */}
                {blips.map((b) => {
                    const tone = b.overdue ? "hsl(var(--streak))" : colorFor(b.subject || b.title);
                    return (
                        <Link
                            key={b.key}
                            to={createPageUrl(b.to)}
                            data-blip={b.key}
                            data-blip-overdue={b.overdue ? "1" : "0"}
                            title={`${b.title} — ${b.subtitle || ""} · ${dayLabel(b.days)}`}
                            aria-label={`${b.title}, ${b.subtitle || ""}, due ${dayLabel(b.days)}`}
                            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full
                                grid place-items-center group focus-visible:outline-none"
                            style={{ left: `${b.left}%`, top: `${b.top}%`,
                                width: b.size, height: b.size }}
                        >
                            {/* The flare. Its own element so the blip itself is
                                never animated — a link that pulses is a link
                                that is hard to click. */}
                            {!reduce && (
                                <span aria-hidden="true"
                                    className="absolute inset-0 rounded-full"
                                    style={{
                                        background: tone,
                                        animation: `radar-flare ${SWEEP_MS}ms ease-out infinite`,
                                        animationDelay: `${flareDelay(b.deg, SWEEP_MS)}ms`,
                                    }} />
                            )}
                            <span className="absolute inset-0 rounded-full ring-2
                                ring-transparent group-hover:ring-foreground/25
                                group-focus-visible:ring-primary transition-shadow"
                                style={{ background: tone, opacity: b.overdue ? 1 : 0.85 }} />
                            {/* Overdue keeps its own slow pulse, independent of
                                the sweep, because being late is a state and not
                                an event. */}
                            {b.overdue && !reduce && (
                                <span aria-hidden="true"
                                    className="absolute -inset-1.5 rounded-full border"
                                    style={{
                                        borderColor: tone,
                                        animation: "radar-late 1800ms ease-out infinite",
                                    }} />
                            )}
                        </Link>
                    );
                })}

                {blips.length === 0 && (
                    <div className="absolute inset-0 grid place-items-center text-center px-6">
                        <p className="text-[13px] text-muted-foreground leading-relaxed">
                            Nothing inside a fortnight.
                        </p>
                    </div>
                )}
            </div>

            {blips.length > 0 && (
                <p className="text-[13px] text-muted-foreground leading-relaxed mt-3">
                    {overdue > 0 ? (
                        <>
                            <span className="font-bold text-streak">{overdue}</span>
                            {" "}inside the ring{overdue === 1 ? "" : "s"} already
                            {blips.length > overdue
                                ? `, ${blips.length - overdue} coming up.`
                                : "."}
                        </>
                    ) : (
                        <>
                            <span className="font-bold text-foreground">{blips.length}</span>
                            {" "}on the dial, nothing late.
                        </>
                    )}
                </p>
            )}
        </div>
    );
}
