/**
 * The one chart each Progress tab opens on — drawn from `progressCharts.js`,
 * which is where every number here is decided and tested.
 *
 *   CARDS     DeckChart     the deck as one band, and the next seven days
 *   QUIZZES   SitChart      every sit where it happened, with an earned trend
 *   MISTAKES  FunnelChart   banked → started → drilled → fixed
 *   HOURS     HeatChart     four Monday-anchored weeks, shaded by the hour
 *
 * ─── AN EXHIBIT, NOT A CARD ────────────────────────────────────────────────
 * Each sits in an INSET WELL — a tint with a hairline, no elevation — the
 * idiom SourcePanel uses for a document. On this page a raised box means
 * something you press, and a chart is something you read.
 *
 * ─── IT ARRIVES, AND THEN IT STAYS STILL ───────────────────────────────────
 * Bars grow, dots land, cells fill in a wave — once, on arrival and when the
 * period or subject changes what they say. Nothing loops: a chart that keeps
 * moving is a chart that cannot be read. Reduced motion places everything.
 *
 * ─── SHAPE AND POSITION CARRY THE MEANING, COLOUR IS THE SECOND CHANNEL ────
 * The brand green and the streak red sit at ΔE 7.0 under deuteranopia, so
 * nothing here is told apart by those two hues alone: the deck band is
 * labelled under each segment, the funnel's stages are ordered, the heat is a
 * single hue at four depths with a printed legend.
 */
import React, { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { colorFor, SUBJECT_COLORS } from "@/components/cards/cardIdentity";
import { HEAT_STEPS } from "@/lib/progressCharts";
import { hhmm } from "@/lib/progressReport";

const EASE = [0.16, 1, 0.3, 1];

/** The well every chart sits in. */
export function Exhibit({ title, meta = null, children, foot = null }) {
    return (
        <section className="rounded-2xl bg-secondary/45 border border-border/70 p-4 sm:p-5">
            <div className="flex items-baseline justify-between gap-3 mb-4">
                <h2 className="font-display font-extrabold text-foreground text-[15px] sm:text-base">{title}</h2>
                {meta && <span className="text-xs text-muted-foreground tabular-nums text-right">{meta}</span>}
            </div>
            {children}
            {foot && <p className="mt-4 text-xs text-muted-foreground leading-relaxed">{foot}</p>}
        </section>
    );
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const weekdayOf = (iso) => WEEKDAY[new Date(`${iso}T00:00:00`).getDay()];
const shortDate = (iso) => {
    const d = new Date(`${iso}T00:00:00`);
    return `${d.getDate()} ${d.toLocaleString("en-AU", { month: "short" })}`;
};

// ─── CARDS ──────────────────────────────────────────────────────────────────

const BAND_TONE = {
    strong: { bar: "bg-primary", dot: "bg-primary" },
    fair: { bar: "bg-chart-3", dot: "bg-chart-3" },
    weak: { bar: "bg-xp", dot: "bg-xp" },
    fresh: { bar: "bg-muted-foreground/35", dot: "bg-muted-foreground/50" },
};

export function DeckChart({ strength, forecast = [] }) {
    const reduce = useReducedMotion();
    if (!strength?.total) return null;
    const peak = Math.max(1, ...forecast.map((d) => d.total));
    const week = forecast.reduce((s, d) => s + d.total, 0);

    return (
        <Exhibit title={`What your ${strength.total.toLocaleString()} cards are made of`}
            meta={week ? `${week.toLocaleString()} come up this week` : null}>
            <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr] lg:gap-8 items-end">
                {/* ONE BAND. Four bars of different lengths make the reader add
                    them up to see the deck; one band is the deck. */}
                <div>
                    <div className="flex h-9 w-full overflow-hidden rounded-xl bg-muted"
                        role="img"
                        aria-label={strength.segments.map((s) => `${s.label} ${s.n}`).join(", ")}>
                        {strength.segments.map((s, i) => (
                            <motion.div key={s.id}
                                className={`${BAND_TONE[s.id]?.bar || "bg-muted-foreground/40"} h-full first:rounded-l-xl last:rounded-r-xl
                                    ${i > 0 ? "border-l-2 border-secondary" : ""}`}
                                initial={reduce ? false : { width: 0 }}
                                animate={{ width: `${s.width * 100}%` }}
                                transition={{ duration: 0.75, delay: reduce ? 0 : 0.08 + i * 0.12, ease: EASE }} />
                        ))}
                    </div>
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
                        {strength.segments.map((s, i) => (
                            <motion.div key={s.id} className="min-w-0"
                                initial={reduce ? false : { opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: reduce ? 0 : 0.35 + i * 0.08 }}>
                                <p className="flex items-center gap-1.5 text-xs font-bold text-foreground truncate">
                                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${BAND_TONE[s.id]?.dot || ""}`} />
                                    {s.label}
                                </p>
                                <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
                                    <span className="font-display font-extrabold text-foreground text-sm">{s.n}</span>
                                    {" "}· {Math.round(s.share * 100)}%
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* THE NEXT SEVEN DAYS. Today is what can be sat now, split into
                    reviews and never-opened; every later day is what is
                    SCHEDULED for it, and nothing is projected. */}
                <div>
                    <p className="stat-label mb-2">Coming up</p>
                    <div className="flex items-end gap-1.5 h-24" role="img"
                        aria-label={forecast.map((d) => `${d.offset ? weekdayOf(d.day) : "Now"} ${d.total}`).join(", ")}>
                        {forecast.map((d, i) => {
                            const h = d.total ? Math.max(8, (d.total / peak) * 100) : 0;
                            const freshShare = d.total ? d.fresh / d.total : 0;
                            return (
                                <div key={d.day} className="flex-1 min-w-0 h-full flex flex-col justify-end items-center"
                                    title={`${d.offset ? weekdayOf(d.day) : "Ready now"} · ${d.total} ${d.total === 1 ? "card" : "cards"}${d.fresh ? ` (${d.fresh} never opened)` : ""}`}>
                                    <span className={`text-[10px] font-bold tabular-nums mb-1 ${d.total ? "text-foreground" : "text-muted-foreground/50"}`}>
                                        {d.total || "·"}
                                    </span>
                                    {d.total > 0 && (
                                        <motion.div className="w-full rounded-md overflow-hidden flex flex-col"
                                            style={{ originY: 1 }}
                                            initial={reduce ? false : { height: 0 }}
                                            animate={{ height: `${h}%` }}
                                            transition={{ duration: 0.55, delay: reduce ? 0 : 0.2 + i * 0.06, ease: EASE }}>
                                            {freshShare > 0 && (
                                                <div className="bg-primary/35 w-full" style={{ height: `${freshShare * 100}%` }} />
                                            )}
                                            <div className={`${i === 0 ? "bg-primary" : "bg-chart-3"} w-full flex-1`} />
                                        </motion.div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex gap-1.5 mt-1.5">
                        {forecast.map((d) => (
                            <span key={d.day} className={`flex-1 min-w-0 text-center text-[10px] tabular-nums
                                ${d.offset ? "text-muted-foreground" : "font-bold text-primary"}`}>
                                {d.offset ? weekdayOf(d.day) : "Now"}
                            </span>
                        ))}
                    </div>
                    {forecast[0]?.fresh > 0 && (
                        <p className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-sm bg-primary/35" /> never opened
                            <span className="w-2 h-2 rounded-sm bg-primary ml-2" /> up for review
                        </p>
                    )}
                </div>
            </div>
        </Exhibit>
    );
}

// ─── QUIZZES ────────────────────────────────────────────────────────────────

const PLOT_H = 168;
const yOf = (score) => 100 - Math.max(0, Math.min(100, score));

export function SitChart({ plot }) {
    const reduce = useReducedMotion();
    const [hot, setHot] = useState(null);
    // EVERY SUBJECT KEEPS ITS OWN COLOUR — unless two on this chart share one.
    // `colorFor` hashes into ten hues, so Methods and Chemistry can land on the
    // same amber, and two identical dots in one legend is a chart that cannot
    // be read. The later one moves to the next hue nobody here is using; every
    // other screen still draws it in its own.
    const subjects = useMemo(() => {
        const seen = new Map();
        const used = new Set();
        for (const p of plot?.points || []) {
            const name = p.subject || p.title;
            if (seen.has(name)) continue;
            let hue = colorFor(name);
            if (used.has(hue)) {
                const at = SUBJECT_COLORS.indexOf(hue);
                hue = SUBJECT_COLORS.map((_, k) => SUBJECT_COLORS[(at + 1 + k) % SUBJECT_COLORS.length])
                    .find((h) => !used.has(h)) || hue;
            }
            used.add(hue);
            seen.set(name, hue);
        }
        return seen;
    }, [plot]);
    if (!plot?.points?.length) return null;

    const pts = plot.points;
    // Where each half of the trend sits, so the arrow runs between the halves
    // it is the difference of rather than spanning the whole chart.
    const half = plot.trend ? plot.trend.n : 0;
    const xEarly = half ? pts.slice(0, half).reduce((s, p) => s + p.x, 0) / half : 0;
    const xLate = half ? pts.slice(pts.length - half).reduce((s, p) => s + p.x, 0) / half : 0;
    const shown = hot != null ? pts.find((p) => p.key === hot) : null;

    return (
        <Exhibit title="Every sit"
            meta={`${pts.length} ${pts.length === 1 ? "sit" : "sits"} · ${shortDate(plot.from)} – ${shortDate(plot.to)}`}
            foot={plot.trend
                ? `The line runs from your earlier ${half} sits to your later ${half}: ${plot.trend.from}% to ${plot.trend.to}%.`
                : plot.need > 0
                    ? `${plot.need} more ${plot.need === 1 ? "sit" : "sits"} and a trend appears — a direction drawn through fewer is a coin flip.`
                    : null}>
            <div className="relative" style={{ height: PLOT_H }}>
                {/* Guides at 50 and 75, the lines a VCE student actually
                    measures a paper against, and a fixed 0–100 axis — a scale
                    that fits itself to three scores draws a wander as a cliff. */}
                {[100, 75, 50, 25].map((g) => (
                    <div key={g} className="absolute inset-x-0 border-t border-dashed border-border/80"
                        style={{ top: `${yOf(g)}%` }}>
                        <span className="absolute -top-2 left-0 text-[10px] text-muted-foreground/70 tabular-nums bg-transparent pr-1">
                            {g}
                        </span>
                    </div>
                ))}

                {/* The average, as a rule the student can read a dot against. */}
                {plot.mean != null && (
                    <motion.div aria-hidden="true"
                        className="absolute inset-x-0 border-t-[1.5px] border-dashed border-foreground/40"
                        style={{ top: `${yOf(plot.mean)}%`, originX: 0 }}
                        initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: 1 }}
                        transition={{ duration: 0.8, delay: 0.5, ease: EASE }} />
                )}

                {/* The trend is REVEALED by a clip, never by animating the
                    stroke's length. `pathLength` is measured in the viewBox's
                    units and a non-scaling stroke dashes in screen pixels, so on
                    a chart stretched to its container the line came out as a row
                    of stray dashes. */}
                {plot.trend && (
                    <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100"
                        preserveAspectRatio="none" aria-hidden="true">
                        <defs>
                            <clipPath id="sit-trend-reveal">
                                <motion.rect x="0" y="-10" height="120"
                                    initial={reduce ? false : { width: 0 }} animate={{ width: 100 }}
                                    transition={{ duration: 0.9, delay: 0.7, ease: EASE }} />
                            </clipPath>
                        </defs>
                        <line x1={xEarly * 100} x2={xLate * 100}
                            y1={yOf(plot.trend.from)} y2={yOf(plot.trend.to)}
                            clipPath="url(#sit-trend-reveal)"
                            className={plot.trend.to >= plot.trend.from ? "stroke-primary" : "stroke-streak"}
                            strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                    </svg>
                )}
                {/* The trend ends in a marker rather than an arrowhead: an
                    arrowhead's angle depends on the chart's width, and this
                    chart has no fixed width. The colour of the line and the
                    sentence under the chart already say which way it went. */}
                {plot.trend && (
                    <motion.span aria-hidden="true"
                        className={`absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full ring-[3px] ring-background
                            ${plot.trend.to >= plot.trend.from ? "bg-primary" : "bg-streak"}`}
                        style={{ left: `${xLate * 100}%`, top: `${yOf(plot.trend.to)}%` }}
                        initial={reduce ? false : { scale: 0 }} animate={{ scale: 1 }}
                        transition={{ delay: reduce ? 0 : 1.5, type: "spring", stiffness: 400, damping: 16 }} />
                )}

                {pts.map((p, i) => (
                    <motion.button key={p.key} type="button"
                        onPointerEnter={() => setHot(p.key)} onPointerLeave={() => setHot(null)}
                        onFocus={() => setHot(p.key)} onBlur={() => setHot(null)}
                        aria-label={`${p.title}, ${p.score}%, ${shortDate(p.day)}`}
                        className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full ring-2 ring-background shadow-sm
                            focus:outline-none focus-visible:ring-foreground"
                        style={{ left: `${p.x * 100}%`, top: `${yOf(p.score)}%`, backgroundColor: subjects.get(p.subject || p.title) }}
                        initial={reduce ? false : { scale: 0, opacity: 0 }}
                        animate={{ scale: hot === p.key ? 1.5 : 1, opacity: 1 }}
                        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 18, delay: hot ? 0 : 0.15 + i * 0.04 }} />
                ))}

                {shown && (
                    <div className="absolute z-10 pointer-events-none -translate-x-1/2 -translate-y-full
                        rounded-lg bg-foreground text-background px-2.5 py-1.5 text-[11px] leading-tight shadow-soft whitespace-nowrap"
                        style={{ left: `${Math.min(88, Math.max(12, shown.x * 100))}%`, top: `calc(${yOf(shown.score)}% - 12px)` }}>
                        <span className="font-bold">{shown.score}%</span> · {shown.title.length > 34 ? `${shown.title.slice(0, 33)}…` : shown.title}
                        <span className="block opacity-70">{shortDate(shown.day)}{shown.subject ? ` · ${shown.subject}` : ""}</span>
                    </div>
                )}
            </div>
            {/* The legend carries the average too — printed on the chart it
                sat on top of the dots it averaged. */}
            <div className="mt-3 flex flex-wrap gap-x-3.5 gap-y-1">
                {plot.mean != null && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                        <span className="w-4 border-t-[1.5px] border-dashed border-foreground/50" />
                        average <span className="font-bold text-foreground tabular-nums">{plot.mean}%</span>
                    </span>
                )}
                {subjects.size > 1 && [...subjects.entries()].map(([name, hue]) => (
                    <span key={name} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: hue }} />{name}
                    </span>
                ))}
            </div>
        </Exhibit>
    );
}

// ─── MISTAKES ───────────────────────────────────────────────────────────────

const STAGE_TONE = {
    banked: "bg-muted-foreground/45",
    started: "bg-xp",
    drilled: "bg-chart-3",
    fixed: "bg-primary",
};

/** Where the pile stalls: the biggest drop between two neighbouring stages. */
function stallOf(funnel) {
    let worst = null;
    for (let i = 1; i < funnel.length; i++) {
        const lost = funnel[i - 1].n - funnel[i].n;
        if (lost > 0 && (!worst || lost > worst.lost)) worst = { from: funnel[i - 1], to: funnel[i], lost };
    }
    return worst;
}

const STALL_LINE = {
    started: (n) => `${n} banked and never opened. Starting is the cheapest step on the ladder.`,
    drilled: (n) => `${n} started and not yet through the ladder.`,
    fixed: (n) => `${n} drilled but not yet earned back on a later sit. Rehearsal is not proof until a paper says so.`,
};

export function FunnelChart({ funnel = [], slipping = 0 }) {
    const reduce = useReducedMotion();
    const total = funnel[0]?.n || 0;
    if (!total) return null;
    const stall = stallOf(funnel);
    return (
        <Exhibit title="From banked to fixed"
            meta={`${funnel[funnel.length - 1].n} of ${total} fixed`}
            foot={[
                stall ? STALL_LINE[stall.to.id]?.(stall.lost) : null,
                slipping > 0 ? `${slipping} slipped back after being started, and count as started.` : null,
            ].filter(Boolean).join(" ") || null}>
            <div className="space-y-2">
                {funnel.map((s, i) => {
                    const w = Math.max(s.n ? 0.08 : 0, s.share);
                    return (
                        <div key={s.id} className="grid grid-cols-[4.75rem_1fr_2.5rem] items-center gap-3">
                            <span className="text-xs font-bold text-foreground">{s.label}</span>
                            <div className="h-8 flex justify-center">
                                {s.n > 0 ? (
                                    <motion.div className={`h-full rounded-lg ${STAGE_TONE[s.id]} flex items-center justify-center`}
                                        initial={reduce ? false : { width: 0, opacity: 0.4 }}
                                        animate={{ width: `${w * 100}%`, opacity: 1 }}
                                        transition={{ duration: 0.6, delay: reduce ? 0 : 0.1 + i * 0.14, ease: EASE }}>
                                        <span className={`text-xs font-extrabold tabular-nums ${s.id === "banked" ? "text-foreground" : "text-white"}`}>
                                            {s.n}
                                        </span>
                                    </motion.div>
                                ) : (
                                    <div className="h-full w-full rounded-lg border-2 border-dashed border-border flex items-center justify-center">
                                        <span className="text-xs font-bold text-muted-foreground">0</span>
                                    </div>
                                )}
                            </div>
                            <span className="text-xs text-muted-foreground tabular-nums text-right">
                                {Math.round(s.share * 100)}%
                            </span>
                        </div>
                    );
                })}
            </div>
        </Exhibit>
    );
}

// ─── HOURS ──────────────────────────────────────────────────────────────────

const HEAT = [
    "bg-muted",
    "bg-primary/25",
    "bg-primary/45",
    "bg-primary/70",
    "bg-primary",
];
const HEAD = ["M", "T", "W", "T", "F", "S", "S"];

export function HeatChart({ heat }) {
    const reduce = useReducedMotion();
    if (!heat?.rows?.length) return null;
    const total = hhmm(heat.total);
    const days = heat.rows.reduce((n, r) => n + r.cells.filter((c) => !c.future).length, 0);
    return (
        <Exhibit title="Four weeks of evenings"
            meta={`${heat.active} of ${days} days${total ? ` · ${total}` : ""}`}
            foot="Countable minutes, capped the way every ranked board caps them — so a cell can never read hotter than the league does.">
            <div className="grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] gap-1.5 sm:gap-2 max-w-xl">
                <span />
                {HEAD.map((h, i) => (
                    <span key={i} className="text-center text-[10px] font-bold text-muted-foreground">{h}</span>
                ))}
                {heat.rows.map((row, r) => (
                    <React.Fragment key={row.monday}>
                        <span className="text-[10px] text-muted-foreground tabular-nums self-center">{shortDate(row.monday)}</span>
                        {row.cells.map((c, i) => (
                            <motion.div key={c.day}
                                title={c.future ? `${weekdayOf(c.day)} ${shortDate(c.day)} · not yet` : `${weekdayOf(c.day)} ${shortDate(c.day)} · ${hhmm(c.minutes) || "nothing logged"}`}
                                className={`aspect-square rounded-lg flex items-center justify-center
                                    ${c.future ? "border-2 border-dashed border-border/70" : HEAT[c.level]}
                                    ${c.today ? "ring-2 ring-foreground ring-offset-2 ring-offset-secondary" : ""}`}
                                initial={reduce ? false : { scale: 0.3, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 22, delay: (r + i) * 0.035 }}>
                                {!c.future && c.minutes > 0 && (
                                    <span className={`hidden sm:block text-[10px] font-bold tabular-nums
                                        ${c.level >= 3 ? "text-white" : "text-foreground/70"}`}>
                                        {c.minutes >= 60 ? `${Math.round(c.minutes / 6) / 10}h` : c.minutes}
                                    </span>
                                )}
                            </motion.div>
                        ))}
                    </React.Fragment>
                ))}
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span>none</span>
                {HEAT.map((cls, i) => <span key={i} className={`w-3 h-3 rounded ${cls}`} />)}
                <span>{hhmm(HEAT_STEPS[HEAT_STEPS.length - 1])}+</span>
                <span className="ml-2 opacity-80">steps at {HEAT_STEPS.map((m) => hhmm(m)).join(" · ")}</span>
            </div>
        </Exhibit>
    );
}
