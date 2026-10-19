/**
 * NeuroPanel — the science beside whichever technique is open, as ONE card
 * in three beats: the brain, the evidence, the catch.
 *
 * It was five stacked boxes: a pale brain, a paragraph, a five-row list of
 * regions, a chart with a paragraph under it, two more boxes of prose and a
 * source list. All of it true, and it read as a slab — the brain was the only
 * part anybody looked at. So the brain leads, on the dark plate the landing
 * page draws it on, and every beat is one line. What was longer is one tap
 * away (a region, a footnote, "Worth knowing") rather than deleted, because
 * this card exists to earn trust and the long version is where the trust is.
 *
 * ─── Woven into the session, not stapled beside it ──────────────────────────
 * The card reacts to the work while it happens (`neuroPanel.js`): a running
 * Pomodoro sits on the attention curve as "You · 12 min", a break lights the
 * daydreaming network, and rating a card or moving past an answer pulses the
 * regions this card already names. It never measures anything; it shows, at
 * the moment of doing it, which systems the evidence says that work uses.
 *
 * ─── Every line still points at a paper ─────────────────────────────────────
 * The sources used to sit in a list nothing pointed at. Each beat now carries
 * its own numbered footnotes into that list, and tapping one opens the paper
 * and what it found, right under the line it backs.
 *
 * Nothing in here is generated. It all comes from src/lib/neuro.js.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronDown, Brain, Flag } from "lucide-react";
import BrainModel from "./BrainModel";
import EvidenceChart from "./EvidenceChart";
import { TECHNIQUE_NEURO, REGION_NOTE, UTILITY, chartMax } from "@/lib/neuro";
import {
    citesFor, utilityCite, regionChips, pomodoroLive, breakFocus, pulseFor,
    shouldPulse, brainLine, PULSE_HOLD_MS,
} from "@/lib/neuroPanel";

// Static classes per tone — the JIT cannot see one assembled from a string.
const TONE_DOT = {
    primary: "bg-primary", xp: "bg-xp", streak: "bg-streak",
    "chart-3": "bg-chart-3", "chart-4": "bg-chart-4", map: "bg-map",
};
const TONE_CHIP_ON = {
    primary: "border-primary bg-primary/15 text-foreground",
    xp: "border-xp bg-xp/15 text-foreground",
    streak: "border-streak bg-streak/15 text-foreground",
    "chart-3": "border-chart-3 bg-chart-3/15 text-foreground",
    "chart-4": "border-chart-4 bg-chart-4/15 text-foreground",
    map: "border-map bg-map/15 text-foreground",
};
const TONE_PILL = {
    primary: "bg-primary/15 text-primary", xp: "bg-xp/15 text-xp",
    streak: "bg-streak/15 text-streak", map: "bg-map/15 text-map",
};

/** The numbers after a line. Tapping one opens what it cites, under the line. */
function Cites({ list, beat, open, onOpen }) {
    if (!list.length) return null;
    const on = open === beat;
    return (
        <button type="button" onClick={() => onOpen(on ? null : beat)} aria-expanded={on}
            data-cite={beat} aria-label={`Sources ${list.map((c) => c.n).join(", ")}`}
            className={`inline-flex align-super ml-1 gap-0.5 rounded px-1 text-[9px] font-black tabular-nums
                leading-none py-0.5 transition-colors ${on
                    ? "bg-foreground text-background"
                    : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
            {list.map((c) => c.n).join(",")}
        </button>
    );
}

/** What a footnote opens: the paper, and what it found. */
function Note({ list, lead = null, open, beat }) {
    return (
        <AnimatePresence initial={false}>
            {open === beat && (
                <motion.div key={beat} data-note={beat}
                    initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                    className="overflow-hidden">
                    <div className="mt-2 rounded-xl bg-secondary/60 px-3 py-2.5 space-y-2">
                        {lead && <p className="text-[12px] text-foreground leading-snug">{lead}</p>}
                        {list.map((c) => (
                            <p key={c.n} className="text-[11px] leading-snug">
                                <span className="font-black tabular-nums text-muted-foreground mr-1">{c.n}</span>
                                <span className="font-bold text-foreground">{c.ref}</span>
                                <span className="block text-muted-foreground mt-0.5">{c.note}</span>
                            </p>
                        ))}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

/** The Pomodoro's own broadcast, read for the curve. */
function useTimerState(enabled) {
    const [state, setState] = useState(() => {
        if (!enabled) return null;
        try { return JSON.parse(localStorage.getItem("globalTimerState") || "null"); } catch { return null; }
    });
    useEffect(() => {
        if (!enabled) { setState(null); return undefined; }
        const on = (e) => setState(e.detail || null);
        window.addEventListener("timerStateChanged", on);
        return () => window.removeEventListener("timerStateChanged", on);
    }, [enabled]);
    return state;
}

/** A pulse when the technique says the work happened. */
function usePulse(techniqueId) {
    const [pulse, setPulse] = useState(null);
    const last = useRef(null);
    useEffect(() => {
        setPulse(null);
        last.current = null;
        const spec = pulseFor(techniqueId);
        if (!spec) return undefined;
        let clear = 0;
        const on = (e) => {
            if (e.detail?.technique !== techniqueId) return;
            const now = Date.now();
            if (!shouldPulse(last.current, now)) return;
            last.current = now;
            setPulse({ ...spec, at: now });
            // Re-render once the line has had its moment, so it goes back to
            // the brief rather than holding a stale "Recall" forever.
            clearTimeout(clear);
            clear = setTimeout(() => setPulse((p) => (p && p.at === now ? { ...p } : p)), PULSE_HOLD_MS + 50);
        };
        window.addEventListener("acedit:brain", on);
        return () => { window.removeEventListener("acedit:brain", on); clearTimeout(clear); };
    }, [techniqueId]);
    return pulse;
}

export default function NeuroPanel({ techniqueId, techniqueName, open = true, onToggle }) {
    const data = TECHNIQUE_NEURO[techniqueId];
    const reduce = useReducedMotion();
    const [picked, setPicked] = useState(null);
    const [note, setNote] = useState(null);
    const [sourcesOpen, setSourcesOpen] = useState(false);
    const [caveatOpen, setCaveatOpen] = useState(false);
    useEffect(() => { setPicked(null); setNote(null); setCaveatOpen(false); }, [techniqueId]);

    const timer = useTimerState(open && techniqueId === "pomodoro");
    const pulse = usePulse(open ? techniqueId : null);
    const live = useMemo(() => (data ? pomodoroLive(timer, data.chart) : null), [timer, data]);
    const chips = useMemo(() => regionChips(data), [data]);
    const resting = useMemo(() => breakFocus(live, data), [live, data]);
    const focus = useMemo(() => (picked ? [picked] : resting), [picked, resting]);
    const brainPulse = useMemo(() => (pulse ? { ids: pulse.ids, at: pulse.at } : null), [pulse]);

    if (!data) return null;
    const utility = data.utility ? UTILITY[data.utility] : null;
    const line = brainLine({ data, picked, live, pulse });
    const marker = live?.phase === "focus" && data.chart?.live === "minutes" ? live : null;
    const cite = (beat) => citesFor(data, beat);
    const effectCite = data.effect?.cite ? data.sources[data.effect.cite - 1] : null;
    const uCite = utilityCite(data);

    // ── COLLAPSED: a bar, and the tool gets the width ───────────────────────
    // Reference, read once or twice, then in the way of the thing the student
    // opened the page to do. It is a real control that names what is behind
    // it rather than a chevron on nothing, and Study remembers the choice.
    if (!open) {
        return (
            <button type="button" onClick={onToggle} aria-expanded={false}
                className="w-full flex items-center gap-2.5 rounded-2xl border-2 border-border
                    bg-surface px-4 py-3 text-left hover:border-foreground/20 transition-colors">
                <Brain className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="stat-label text-muted-foreground flex-1 min-w-0 truncate">
                    The science behind {techniqueName}
                </span>
                <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </button>
        );
    }

    return (
        <motion.section key={techniqueId}
            initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            data-neuro={techniqueId}
            className="card-soft border-2 border-border rounded-3xl overflow-hidden"
            aria-label={`The science behind ${techniqueName}`}>

            {/* The card's own header is the way out. */}
            <button type="button" onClick={onToggle} aria-expanded
                className="w-full flex items-center gap-2.5 px-4 py-3 text-left border-b border-border
                    hover:bg-secondary/40 transition-colors">
                <Brain className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="stat-label text-muted-foreground flex-1 min-w-0 truncate">
                    The science behind {techniqueName}
                </span>
                <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0 rotate-180" />
            </button>

            {/* Two columns when it stacks under the tool and has the width;
                one as a rail. */}
            <div className="grid md:grid-cols-2 xl:grid-cols-1">

                {/* ── 1 · THE BRAIN ─────────────────────────────────────── */}
                <div className="p-3 md:border-r xl:border-r-0 border-border">
                    <BrainModel key={techniqueId} regions={data.regions} height={224} glow
                        focus={focus} pulse={brainPulse} labelId={picked} />

                    {/* Each region is a chip: tap to isolate it on the brain and
                        read what it does. Tap again to see them all. */}
                    <div className="flex flex-wrap gap-1.5 mt-3" role="group" aria-label="Brain regions">
                        {chips.map((c) => {
                            const on = picked === c.id;
                            return (
                                <button key={c.id} type="button" data-region={c.id}
                                    aria-pressed={on} title={c.name}
                                    onClick={() => setPicked(on ? null : c.id)}
                                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1
                                        text-[11px] font-bold transition-colors ${on
                                            ? TONE_CHIP_ON[c.tone] || TONE_CHIP_ON.map
                                            : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/25"}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${TONE_DOT[c.tone] || "bg-map"}`} />
                                    {c.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* The one line. It changes with what is happening: a pulse,
                        a picked region, a running timer, or the brief. A fixed
                        height, so the card below does not jump when it does. */}
                    <div className="mt-2.5 min-h-[3.75rem]" aria-live="polite">
                        <AnimatePresence mode="wait" initial={false}>
                            <motion.p key={`${line?.kind}:${line?.text}`} data-brain-line={line?.kind}
                                initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                                exit={reduce ? undefined : { opacity: 0, y: -4 }} transition={{ duration: 0.18 }}
                                className="text-[13px] text-foreground leading-snug">
                                {(line?.kind === "live" || line?.kind === "pulse") && (
                                    <span className="inline-flex items-center gap-1 mr-1.5 align-[1px]
                                        text-[10px] font-black uppercase tracking-wide text-primary">
                                        <span className={`w-1.5 h-1.5 rounded-full bg-primary ${reduce ? "" : "animate-pulse"}`} />
                                        Live
                                    </span>
                                )}
                                {line?.kind === "region" && (
                                    <span className="font-bold">{line.label}. </span>
                                )}
                                {line?.text}
                                {line && <Cites list={cite(line.beat)} beat={`line-${line.beat}`} open={note} onOpen={setNote} />}
                            </motion.p>
                        </AnimatePresence>
                        {line && <Note list={cite(line.beat)} open={note} beat={`line-${line.beat}`} />}
                    </div>
                    <p className="text-[10px] text-muted-foreground/80 leading-snug mt-1">{REGION_NOTE}</p>
                </div>

                <div className="p-4 space-y-5 xl:border-t border-border">
                    {/* ── 2 · THE EVIDENCE ──────────────────────────────── */}
                    <div>
                        <div className="flex items-start justify-between gap-2 mb-2.5">
                            <p className="text-[15px] font-display font-extrabold text-foreground leading-snug">
                                {data.headline}
                                <Cites list={cite("chart")} beat="chart" open={note} onOpen={setNote} />
                            </p>
                            {utility && (
                                <button type="button" onClick={() => setNote(note === "utility" ? null : "utility")}
                                    data-utility aria-expanded={note === "utility"} title={utility.blurb}
                                    className={`pill flex-shrink-0 text-[10px] ${TONE_PILL[utility.tone] || TONE_PILL.primary}`}>
                                    {utility.label}
                                </button>
                            )}
                        </div>
                        <Note list={cite("chart")} lead={data.chart?.caption} open={note} beat="chart" />
                        {uCite && <Note list={[uCite]} lead={utility.blurb} open={note} beat="utility" />}
                        <div className="mt-2.5">
                            <EvidenceChart key={techniqueId} chart={data.chart} max={chartMax(data.chart)}
                                marker={marker} caption={false} />
                        </div>
                        {data.effect && (
                            <p className="text-[11px] text-muted-foreground mt-2" data-effect>
                                Effect size{" "}
                                <span className="font-display font-black text-foreground tabular-nums">
                                    g&nbsp;≈&nbsp;{data.effect.g.toFixed(2)}
                                </span>{" "}
                                for {data.effect.label}
                                {data.effect.approx && " (approx.)"}
                                {effectCite && (
                                    <Cites list={[{ n: data.effect.cite, ...effectCite }]} beat="effect" open={note} onOpen={setNote} />
                                )}
                            </p>
                        )}
                        {effectCite && <Note list={[{ n: data.effect.cite, ...effectCite }]} open={note} beat="effect" />}
                    </div>

                    {/* ── 3 · THE CATCH ─────────────────────────────────── */}
                    <div className="border-t border-border pt-4" data-catch>
                        <p className="text-[13px] text-foreground leading-snug flex gap-2">
                            <Flag className="w-3.5 h-3.5 text-xp flex-shrink-0 mt-0.5" aria-hidden="true" />
                            <span>
                                {data.catch}
                                <Cites list={cite("catch")} beat="catch" open={note} onOpen={setNote} />
                            </span>
                        </p>
                        <Note list={cite("catch")} lead={data.feelsLike} open={note} beat="catch" />
                        {data.caveat && (
                            <>
                                <button type="button" onClick={() => setCaveatOpen((v) => !v)}
                                    aria-expanded={caveatOpen} data-caveat
                                    className="mt-2 pl-[22px] text-[11px] font-bold text-muted-foreground
                                        hover:text-foreground underline underline-offset-4">
                                    {caveatOpen ? "Less" : "Worth knowing"}
                                </button>
                                <AnimatePresence initial={false}>
                                    {caveatOpen && (
                                        <motion.p key="caveat"
                                            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                                            className="overflow-hidden pl-[22px] text-[12px] text-muted-foreground leading-snug">
                                            <span className="block pt-1.5">
                                                {data.caveat}
                                                <Cites list={cite("caveat")} beat="caveat" open={note} onOpen={setNote} />
                                            </span>
                                        </motion.p>
                                    )}
                                </AnimatePresence>
                                {caveatOpen && <div className="pl-[22px]"><Note list={cite("caveat")} open={note} beat="caveat" /></div>}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Every paper on the card, numbered as the footnotes are ─── */}
            <div className="border-t border-border">
                <button type="button" onClick={() => setSourcesOpen((v) => !v)} aria-expanded={sourcesOpen}
                    data-sources
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-secondary/40 transition-colors">
                    <span className="stat-label flex-1">Sources · {data.sources.length}</span>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${sourcesOpen ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence initial={false}>
                    {sourcesOpen && (
                        <motion.ol key="sources"
                            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                            className="overflow-hidden px-4">
                            {data.sources.map((s, i) => (
                                <li key={s.ref} className="flex gap-2 pb-2.5 first:pt-0.5">
                                    <span className="text-[10px] font-black tabular-nums text-muted-foreground mt-0.5 w-3 flex-shrink-0">{i + 1}</span>
                                    <span className="min-w-0">
                                        <span className="block text-xs font-bold text-foreground leading-snug">{s.ref}</span>
                                        <span className="block text-[11px] text-muted-foreground leading-snug mt-0.5">{s.note}</span>
                                    </span>
                                </li>
                            ))}
                        </motion.ol>
                    )}
                </AnimatePresence>
            </div>
        </motion.section>
    );
}
