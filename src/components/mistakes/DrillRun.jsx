/**
 * DrillRun — a run through the mistake bank, as cards climbing their ladders.
 *
 * It used to be a card in the page frame (nav, rail and corner Ace around it)
 * that ended on one sentence: "3 of 4 recalled. The ones you missed come back
 * tomorrow." That is a count of button presses. What a run actually changes is
 * WHERE EACH MISTAKE SITS — Good moves a card up a rung, Again drops it back to
 * the start, Hard holds it — and the screen never said so, so a student had no
 * idea whether twenty minutes of drilling had moved anything.
 *
 * So the run is staged around the move:
 *
 *   the strip   one slot per card in the run, filled with what happened to it
 *   the card    the exercise for the rung it is on (see drill.js)
 *   the rail    the card's ladder under it; after a rating the rail redraws at
 *               the new rung and says the move in words — "Up to Fill it",
 *               "Back to See it" — before the next card is dealt
 *   the end     what climbed, what is ready to prove on the real question,
 *               what slipped, and anything that is now fixed, with clearing it
 *               offered right there, ONCE, at the moment it is true
 *
 * Every move is read off the card before and after (`moveOf`), never off the
 * button: Good inside a rung's range holds, and a rung a card cannot build is
 * skipped. The grade is written by the page through the shared scheduler the
 * moment it is pressed; this only stages it. Full screen on `SitScreen`, the
 * same surface as a quiz sit, with one way out.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, ArrowUp, ArrowDown, Equal, Flag, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import SitScreen from "@/components/shared/SitScreen";
import MarkdownMath from "@/components/shared/MarkdownMath";
import QuestionPanel from "@/components/mistakes/QuestionPanel";
import LadderTrack from "@/components/mistakes/LadderTrack";
import ClozeDrill from "@/components/mistakes/ClozeDrill";
import SpotDrill from "@/components/mistakes/SpotDrill";
import RepairDrill from "@/components/mistakes/RepairDrill";
import { calculateNextReview, formatIntervalShort, RATINGS } from "@/lib/sm2";
import { drillFor, suggestRating } from "@/lib/drill";
import { mistakeMeta } from "@/lib/mistakeBank";
import { afterRating, moveOf, moveLine, runSummary, rungOf, MOVE_MS } from "@/lib/bankRun";

/** The rung's name, said out loud: a drill that silently gets harder feels like moved goalposts. */
const STAGE_BADGE = {
    recognise: { label: "See it", cls: "bg-secondary text-muted-foreground", blurb: "Read what scores, then rate how well you knew it." },
    spot:      { label: "Spot it", cls: "bg-streak/15 text-streak", blurb: "Your own sentence. Find the words that cost the mark." },
    cloze:     { label: "Fill it", cls: "bg-xp/15 text-xp", blurb: "You have seen this one. Put the words back." },
    repair:    { label: "Fix it", cls: "bg-primary/15 text-primary", blurb: "Write the version that would have scored." },
};

/** A move's look. Shape carries it as well as colour — the CVD rule. Static classes. */
const MOVE = {
    climbed: { Icon: ArrowUp, chip: "bg-primary/15 text-primary", slot: "bg-primary text-primary-foreground" },
    closer:  { Icon: ArrowUp, chip: "bg-primary/10 text-primary", slot: "bg-primary/45 text-primary-foreground" },
    proven:  { Icon: Flag, chip: "bg-chart-3/15 text-chart-3", slot: "bg-chart-3 text-white" },
    fixed:   { Icon: Check, chip: "bg-primary/15 text-primary", slot: "bg-primary text-primary-foreground" },
    held:    { Icon: Equal, chip: "bg-secondary text-muted-foreground", slot: "bg-foreground/25 text-foreground" },
    slipped: { Icon: ArrowDown, chip: "bg-streak/15 text-streak", slot: "bg-streak text-white" },
};

/** The run so far: one slot per card, filled with what happened to it. */
function RunStrip({ queue, moves, at }) {
    const byIndex = moves;
    return (
        <div className="flex gap-1" aria-hidden="true" data-run-strip>
            {queue.map((c, i) => {
                const m = byIndex[i];
                const look = m ? MOVE[m.kind] : null;
                return (
                    <span key={`${c.id}-${i}`}
                        className={`h-5 flex-1 min-w-0 rounded-md grid place-items-center transition-colors ${
                            look ? look.slot : i === at ? "bg-foreground/15 ring-2 ring-foreground/30" : "bg-secondary"}`}>
                        {look && <look.Icon className="w-3 h-3" strokeWidth={3} />}
                    </span>
                );
            })}
        </div>
    );
}

/** The end of the run: what moved, said by where it went. */
function RunEnd({ moves, cards, onClear, onSitAgain, onClose }) {
    const reduce = useReducedMotion();
    const s = runSummary(moves);
    const fixedCards = s.fixed.map((m) => cards.get(m.id)).filter(Boolean);
    const [cleared, setCleared] = useState(false);
    const head = s.up === 0
        ? (s.slipped.length ? "Nothing climbed this time." : "Held steady.")
        : `${s.up} went up the ladder${s.slipped.length ? `, ${s.slipped.length} slipped` : ""}.`;

    const Group = ({ kind, title, items, children }) => {
        if (!items.length) return null;
        const look = MOVE[kind];
        return (
            <section data-run-group={kind} className="card-soft border-2 border-border p-4">
                <p className="flex items-center gap-2 text-sm font-black text-foreground">
                    <span className={`w-6 h-6 rounded-lg grid place-items-center ${look.chip}`}>
                        <look.Icon className="w-3.5 h-3.5" strokeWidth={3} />
                    </span>
                    {title} <span className="text-muted-foreground font-bold tabular-nums">{items.length}</span>
                </p>
                <ul className="mt-2.5 space-y-2">
                    {items.map((m) => {
                        const c = cards.get(m.id);
                        return (
                            <li key={m.id} className="flex items-baseline justify-between gap-3">
                                <MarkdownMath className="text-sm text-foreground leading-snug min-w-0">
                                    {mistakeMeta(c).criterion || c?.question || ""}
                                </MarkdownMath>
                                <span className="text-[11px] font-bold text-muted-foreground flex-shrink-0 tabular-nums">
                                    {m.kind === "closer" && m.next
                                        ? `${m.to} · ${m.needs} more for ${m.next}`
                                        : m.from === m.to ? m.to : `${m.from} → ${m.to}`}
                                </span>
                            </li>
                        );
                    })}
                </ul>
                {children}
            </section>
        );
    };

    return (
        <motion.div data-run-end initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="space-y-4">
            <div>
                <p className="stat-label">Drilled {s.total}</p>
                <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-foreground leading-tight mt-1">{head}</h1>
            </div>
            <Group kind="fixed" title="Fixed" items={s.fixed}>
                {/* ASKED ONCE, AT THE MOMENT IT IS TRUE: these were not fixed
                    when the run started. Nothing is deleted; one tap on the
                    bank puts them back. */}
                <div className="mt-3 flex flex-wrap items-center gap-3">
                    {cleared ? (
                        <p className="text-xs font-bold text-primary flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Cleared out of the bank</p>
                    ) : (
                        <Button size="sm" data-run-clear onClick={() => { onClear?.(fixedCards); setCleared(true); }}
                            className="btn-3d bg-primary hover:bg-primary text-primary-foreground rounded-xl gap-1.5">
                            <Check className="w-3.5 h-3.5" /> Clear {fixedCards.length === 1 ? "it" : `all ${fixedCards.length}`} out of the bank
                        </Button>
                    )}
                </div>
            </Group>
            <Group kind="proven" title="Ready to prove on the question" items={s.proven}>
                <p className="text-xs text-muted-foreground mt-2.5 leading-snug">
                    Rehearsed to the end. A mistake is fixed when you earn it back on the question it came from.
                </p>
                {onSitAgain && (
                    <Button size="sm" variant="outline" onClick={onSitAgain} data-run-sit
                        className="mt-3 border-2 border-chart-3/40 text-chart-3 hover:bg-chart-3/10 rounded-xl gap-1.5">
                        <RotateCcw className="w-3.5 h-3.5" /> Sit them again
                    </Button>
                )}
            </Group>
            {/* A harder exercise next time, or closer to one: both are the
                card moving up, and "closer" says by how much. */}
            <Group kind="climbed" title="Up the ladder" items={[...s.climbed, ...s.closer]} />
            <Group kind="held" title="Held" items={s.held} />
            <Group kind="slipped" title="Slipped back — they come round again tomorrow" items={s.slipped} />
            {/* An exit, drawn as one: `bg-foreground` came out a white slab in
                the dark, the brightest thing on a screen whose actions are the
                green ones above it. */}
            <Button onClick={onClose} data-run-close variant="outline"
                className="w-full sm:w-auto border-2 border-border rounded-xl font-bold">
                Back to the bank
            </Button>
        </motion.div>
    );
}

export default function DrillRun({ queue = [], attempts = [], onGraded, onClear, onSitAgain, onClose, label = "Drilling your mistakes" }) {
    const reduce = useReducedMotion();
    const [i, setI] = useState(0);
    const [shown, setShown] = useState(false);
    const [suggested, setSuggested] = useState(null);
    const [moves, setMoves] = useState([]);
    const [moving, setMoving] = useState(null);
    const [done, setDone] = useState(false);
    // The card as each was BEFORE its rating, for the summary to name.
    const seen = useRef(new Map());
    const timer = useRef(null);
    useEffect(() => () => clearTimeout(timer.current), []);

    const card = queue[i];
    // Per card, not per render: a cloze must not rebuild — and reshuffle its
    // word bank — while the student is looking at it.
    const drill = useMemo(() => (card ? drillFor(card) : null), [card]);
    const rung = useMemo(() => (card ? rungOf(card, attempts) : null), [card, attempts]);
    const afterSteps = useMemo(
        () => (moving ? rungOf(moving.after, attempts).steps : null), [moving, attempts]);

    const rateable = !moving && drill && (drill.stage === "recognise" ? shown : suggested !== null);

    const grade = (quality) => {
        if (!card || moving) return;
        const after = afterRating(card, quality);
        const move = moveOf(card, after, attempts);
        seen.current.set(card.id, card);
        onGraded?.(card, quality);
        setMoves((m) => [...m, move]);
        setMoving({ move, after });
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
            setMoving(null);
            if (i + 1 >= queue.length) setDone(true);
            else { setI(i + 1); setShown(false); setSuggested(null); }
        }, reduce ? 300 : MOVE_MS);
    };

    // Number keys rate; Space shows the answer. Never while typing — the
    // cloze and the rewrite take words, and a 3 in an answer is not a rating.
    useEffect(() => {
        const onKey = (e) => {
            const t = e.target;
            if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
            if (drill?.stage === "recognise" && !shown && (e.key === " " || e.key === "Enter")) {
                e.preventDefault(); setShown(true); return;
            }
            const q = Number(e.key);
            if (rateable && q >= 1 && q <= 4) { e.preventDefault(); grade(q); }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });

    if (!queue.length) return null;

    if (done) {
        return (
            <SitScreen width="2xl" label={label}>
                <RunEnd moves={moves} cards={seen.current} onClear={onClear} onSitAgain={onSitAgain} onClose={onClose} />
            </SitScreen>
        );
    }

    const meta = mistakeMeta(card);
    const badge = STAGE_BADGE[drill.stage];
    const leave = moving?.move.kind === "slipped" ? { x: -60, y: 40, rotate: -6 }
        : moving?.move.kind === "held" ? { x: 40, rotate: 2 } : { x: 60, y: -40, rotate: 6 };
    const look = moving ? MOVE[moving.move.kind] : null;

    return (
        <SitScreen width="2xl" label={label}>
            <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        {/* The one way out. Grades already pressed are saved. */}
                        <button type="button" onClick={onClose} data-run-exit aria-label="Stop drilling"
                            className="w-8 h-8 rounded-xl border-2 border-border text-muted-foreground hover:text-foreground
                                hover:bg-secondary flex items-center justify-center transition-colors flex-shrink-0">
                            <X className="w-4 h-4" />
                        </button>
                        <p className="text-sm font-bold text-foreground truncate">{label}</p>
                    </div>
                    <p className="text-xs text-muted-foreground tabular-nums flex-shrink-0">{i + 1} of {queue.length}</p>
                </div>

                <RunStrip queue={queue} moves={moves} at={i} />

                <AnimatePresence mode="wait">
                    <motion.div key={`${card.id}-${i}`} data-drill-card={drill.stage}
                        initial={reduce ? { opacity: 0 } : { opacity: 0, x: -50, rotate: -3 }}
                        // EVERY KEY IN BOTH TARGETS. A target that drops `x` and
                        // `rotate` leaves them wherever their spring had got to,
                        // so a quick rating froze the card mid-deal, tilted.
                        animate={moving && !reduce
                            ? { opacity: 0.55, scale: 0.98, x: 0, rotate: 0 }
                            : { opacity: 1, x: 0, rotate: 0, scale: 1 }}
                        exit={reduce ? { opacity: 0 } : { opacity: 0, ...leave }}
                        transition={{ type: "spring", stiffness: 300, damping: 28 }}
                        className="card-soft on-table border-2 border-border p-5 space-y-4">
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className={`pill text-[10px] ${badge.cls}`}>{badge.label}</span>
                                <p className="stat-label text-muted-foreground">{card.subject_name || "Mistake"}</p>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1.5">{badge.blurb}</p>
                        </div>

                        <QuestionPanel>{meta.question}</QuestionPanel>

                        {drill.stage === "recognise" && (
                            <>
                                <div>
                                    <MarkdownMath className="text-lg font-bold text-foreground leading-snug">
                                        {meta.criterion || card.question}
                                    </MarkdownMath>
                                    {meta.quote && (
                                        <p className="text-sm text-muted-foreground italic leading-snug mt-2">You wrote “{meta.quote}”</p>
                                    )}
                                </div>
                                {shown ? (
                                    <motion.div initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                                        className="pt-4 border-t border-border">
                                        <p className="stat-label text-primary">What scores</p>
                                        <MarkdownMath className="text-base text-foreground leading-relaxed mt-1">{card.answer}</MarkdownMath>
                                    </motion.div>
                                ) : (
                                    <Button onClick={() => setShown(true)} data-show-scores
                                        className="btn-3d w-full bg-primary hover:bg-primary text-primary-foreground rounded-xl">
                                        Show what scores
                                    </Button>
                                )}
                            </>
                        )}
                        {drill.stage === "cloze" && (
                            <ClozeDrill key={card.id} cloze={drill.cloze} onGraded={(g) => setSuggested(suggestRating(g))} />
                        )}
                        {drill.stage === "spot" && (
                            <SpotDrill key={card.id} spot={drill.spot} criterion={meta.criterion}
                                onGraded={(g) => setSuggested(suggestRating(g))} />
                        )}
                        {drill.stage === "repair" && (
                            <RepairDrill key={card.id} card={card} criterion={drill.criterion}
                                quote={drill.quote} onMarked={(rating) => setSuggested(rating ?? 3)} />
                        )}
                    </motion.div>
                </AnimatePresence>

                {/* ── THE RAIL. The card's ladder under it, redrawn at the new
                    rung after a rating, with the move said in words. */}
                <div className="px-1" data-run-rail>
                    <LadderTrack steps={afterSteps || rung.steps} />
                    <div className="h-8 mt-2 flex justify-center">
                        <AnimatePresence>
                            {moving && (
                                <motion.p key={`${card.id}-${i}-move`} data-run-move={moving.move.kind}
                                    initial={reduce ? false : { opacity: 0, y: 8, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black ${look.chip}`}>
                                    <look.Icon className="w-3.5 h-3.5" strokeWidth={3} /> {moveLine(moving.move)}
                                </motion.p>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {rateable && (
                    <div className="space-y-1.5">
                        {/* The drill SUGGESTS; the student decides. Only they
                            know whether they knew it or guessed. */}
                        {suggested != null && (
                            <p className="text-xs text-muted-foreground text-center">
                                Suggested from how you went — change it if you know better.
                            </p>
                        )}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {RATINGS.map((r) => (
                                <button key={r.quality} type="button" onClick={() => grade(r.quality)} data-rate={r.quality}
                                    className={`rounded-xl border-2 px-2 py-2.5 text-center cursor-pointer transition-all ${r.color}
                                        ${suggested === r.quality ? "ring-2 ring-ring scale-[1.03]" : ""}`}>
                                    <span className="block text-sm font-black">{r.label}</span>
                                    <span className="block text-[10px] opacity-80">{r.sublabel}</span>
                                    <span className="block text-[10px] font-bold tabular-nums mt-0.5">
                                        {formatIntervalShort(calculateNextReview(r.quality, card).interval_days)}
                                    </span>
                                </button>
                            ))}
                        </div>
                        <p className="hidden sm:block text-[11px] text-muted-foreground text-center">Keys 1–4 rate it.</p>
                    </div>
                )}
            </div>
        </SitScreen>
    );
}
