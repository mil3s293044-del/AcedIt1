/**
 * MistakeBank — the mistakes you have made, and which of them you have fixed.
 *
 * ─── The one question this answers ──────────────────────────────────────────
 * "Am I actually getting these right now?"
 *
 * Not "what have I got wrong" — a bank that only accumulates is a guilt list,
 * and a guilt list is a screen nobody opens twice. Everything here is built
 * around mistakes LEAVING: the headline counts what is fixed, the bar shows
 * the pile shrinking, and a fixed mistake gets its own quiet section instead of
 * disappearing, because seeing them stack up is the reward for the work.
 *
 * The bank already existed as rows — `topic: "Mistake bank"` flashcards on the
 * spaced-repetition shelf. What did not exist was anywhere to read them as a
 * set. So the quiz toast said "it joins your Mistake bank deck" and pointed at
 * nothing, which is the shape of feature nobody uses.
 *
 * ─── Why the review runs here ───────────────────────────────────────────────
 * A review screen that sends you to a different page to review is not a review
 * screen. It grades through `sm2.js` — the SAME arithmetic the deck uses, moved
 * out of SpacedRepetition.jsx for exactly this — so a card answered here comes
 * back on the day the deck would have chosen. Two schedulers for one card is
 * how an app starts disagreeing with itself.
 *
 * ─── What is NOT here ───────────────────────────────────────────────────────
 * No deck management, no editing, no generation. Those exist on the Study page
 * and they are not what somebody opening this screen came for. This is a
 * record and a way to work through it.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import MarkdownMath from "@/components/shared/MarkdownMath";
import AceBody from "@/components/ace/AceBody";
import { isDue, isNew } from "@/lib/due";
import { calculateNextReview, reviewPatch, formatIntervalShort, RATINGS } from "@/lib/sm2";
import { BANK_TOPIC, bankSummary, fixState, mistakeMeta } from "@/lib/mistakeBank";
import { drillFor, suggestRating } from "@/lib/drill";
import ClozeDrill from "@/components/mistakes/ClozeDrill";
import ProduceDrill from "@/components/mistakes/ProduceDrill";
import {
    Play, RotateCcw, Check, X, Repeat, ArrowLeft, Inbox, ChevronDown, Sparkles,
} from "lucide-react";

/**
 * Static class lookups — Tailwind cannot see a class assembled at runtime.
 *
 * The order here is the order on screen, and it is deliberate: what you are
 * still getting wrong comes first, what you have not touched second, and the
 * good news last. A screen that opens with your wins buries the work.
 */
const STATE = {
    slipping: { label: "Still getting it wrong", chip: "bg-streak", text: "text-streak", ring: "border-streak/30", bar: "bg-streak",
        blurb: "You have answered these since banking them and they did not come back." },
    new:      { label: "Not reviewed yet",       chip: "bg-muted-foreground", text: "text-muted-foreground", ring: "border-border", bar: "bg-foreground/25",
        blurb: "Banked, but you have not been asked about them yet." },
    working:  { label: "Coming back",            chip: "bg-xp", text: "text-xp", ring: "border-xp/30", bar: "bg-xp",
        blurb: "Recalled at least once. Not yet on a long enough schedule to call fixed." },
    fixed:    { label: "Fixed",                  chip: "bg-primary", text: "text-primary", ring: "border-primary/30", bar: "bg-primary",
        blurb: "Two clean recalls and a schedule a week out or longer." },
};
const ORDER = ["slipping", "new", "working", "fixed"];

/** The pile, shrinking. One bar, four segments, in the order above. */
function FixBar({ summary }) {
    if (!summary.total) return null;
    const seg = ORDER.map((k) => ({ k, n: summary[k] })).filter((s) => s.n > 0);
    return (
        <div>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-secondary"
                role="img"
                aria-label={ORDER.map((k) => `${summary[k]} ${STATE[k].label}`).join(", ")}>
                {seg.map((s) => (
                    <motion.div key={s.k} initial={{ width: 0 }}
                        animate={{ width: `${(s.n / summary.total) * 100}%` }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className={STATE[s.k].bar} />
                ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground mt-2">
                {seg.map((s) => (
                    <span key={s.k} className="flex items-center gap-1.5">
                        {/* The count is foreground with a coloured dot rather
                            than coloured text — a dot is a graphic and owes
                            3:1, where small text owes 4.5:1 and xp does not
                            make it in light mode. Same call as RetentionCard. */}
                        <span className={`w-1.5 h-1.5 rounded-full ${STATE[s.k].bar}`} />
                        <span className="font-bold text-foreground tabular-nums">{s.n}</span>
                        {STATE[s.k].label.toLowerCase()}
                    </span>
                ))}
            </div>
        </div>
    );
}

/** One mistake, as a row. The criterion IS the headline — it is what was wanted. */
function MistakeRow({ card, index }) {
    const [open, setOpen] = useState(false);
    const reduce = useReducedMotion();
    const state = fixState(card);
    const meta = mistakeMeta(card);
    const s = STATE[state];

    return (
        <motion.li
            initial={reduce ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.25) }}
            className={`rounded-2xl border-2 bg-surface overflow-hidden ${s.ring}`}
        >
            <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
                className="w-full flex items-start gap-2.5 text-left px-3 py-2.5 cursor-pointer">
                <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${s.chip}`} />
                <span className="min-w-0 flex-1">
                    <MarkdownMath className="text-sm font-bold text-foreground leading-snug">
                        {meta.criterion || card.question}
                    </MarkdownMath>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground mt-0.5">
                        {card.subject_name && <span>{card.subject_name}</span>}
                        {meta.questionTitle && <span className="truncate max-w-[16rem]">· {meta.questionTitle}</span>}
                        {meta.cost > 0 && (
                            <span className="tabular-nums">· cost {meta.cost} mark{meta.cost === 1 ? "" : "s"}</span>
                        )}
                    </span>
                </span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5
                    transition-transform ${open ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={reduce ? false : { height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={reduce ? undefined : { height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-3 pb-3 space-y-2 border-t border-border/60">
                            {meta.quote && (
                                <p className="text-sm text-muted-foreground italic leading-snug pt-2">
                                    You wrote “{meta.quote}”
                                </p>
                            )}
                            <div className="rounded-xl bg-primary/5 border border-primary/20 px-2.5 py-2">
                                <p className="stat-label text-primary">What scores</p>
                                <MarkdownMath className="text-sm text-foreground leading-snug mt-0.5">
                                    {card.answer}
                                </MarkdownMath>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.li>
    );
}

/**
 * The review itself. Question, then the answer, then four buttons.
 *
 * Deliberately the same shape and the same words as the spaced-repetition
 * player, because it is the same act — a student should not have to learn a
 * second grading vocabulary for the same cards.
 */
/**
 * The rung's name, said out loud.
 *
 * A drill that silently gets harder feels like the app moving the goalposts.
 * Naming the stage turns the same event into progress — you are on this one
 * BECAUSE you got the last one right.
 */
const STAGE_BADGE = {
    recognise: { label: "First look", cls: "bg-secondary text-muted-foreground",
        blurb: "Read what scores, then rate how well you knew it." },
    cloze:     { label: "Fill the gaps", cls: "bg-xp/15 text-xp",
        blurb: "You have seen this one. Put the words back." },
    produce:   { label: "From scratch", cls: "bg-primary/15 text-primary",
        blurb: "No wording to lean on. Write what would earn the mark." },
};

function Runner({ queue, onGraded, onDone }) {
    const [i, setI] = useState(0);
    const [shown, setShown] = useState(false);
    const [suggested, setSuggested] = useState(null);
    const [tally, setTally] = useState({ right: 0, wrong: 0 });
    const card = queue[i];

    // Which rung this card is on, and everything that rung needs. Recomputed
    // per card rather than per render so a cloze does not rebuild — and
    // reshuffle its word bank — while the student is looking at it.
    const drill = useMemo(() => (card ? drillFor(card) : null), [card]);

    // The card advances locally the moment it is graded; the write goes out
    // behind it. A student rating twenty cards should never be waiting on a
    // round trip to see the next one.
    const grade = (quality) => {
        onGraded(card, quality);
        setTally((t) => ({ right: t.right + (quality >= 3 ? 1 : 0), wrong: t.wrong + (quality < 3 ? 1 : 0) }));
        if (i + 1 >= queue.length) onDone({ right: tally.right + (quality >= 3 ? 1 : 0), total: queue.length });
        else { setI(i + 1); setShown(false); setSuggested(null); }
    };

    if (!card) return null;
    const meta = mistakeMeta(card);
    const badge = STAGE_BADGE[drill.stage];
    // Every rung reaches the rating buttons; they are just earned differently.
    const rateable = drill.stage === "recognise" ? shown : suggested !== null;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <button type="button" onClick={() => onDone(null)}
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground
                        hover:text-foreground cursor-pointer transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Back to the bank
                </button>
                <p className="text-xs text-muted-foreground tabular-nums">{i + 1} of {queue.length}</p>
            </div>

            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <motion.div className="h-full bg-primary" initial={false}
                    animate={{ width: `${(i / queue.length) * 100}%` }} transition={{ duration: 0.3 }} />
            </div>

            <div className="card-soft border-2 border-border p-5 space-y-4">
                {/* THE CRITERION IS THE HEADING, not the card's question text.
                    The question already contains the assessment title and the
                    quote, and the label above repeats the title — so the old
                    screen printed the same title twice and buried the actual
                    mark under a paragraph of prose. */}
                <div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`pill text-[10px] ${badge.cls}`}>{badge.label}</span>
                        <p className="stat-label text-muted-foreground">
                            {card.subject_name || "Mistake"}{meta.questionTitle ? ` · ${meta.questionTitle}` : ""}
                        </p>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5">{badge.blurb}</p>
                </div>

                {drill.stage === "recognise" && (
                    <>
                        <div>
                            <MarkdownMath className="text-lg font-bold text-foreground leading-snug">
                                {meta.criterion || card.question}
                            </MarkdownMath>
                            {meta.quote && (
                                <p className="text-sm text-muted-foreground italic leading-snug mt-2">
                                    You wrote “{meta.quote}”
                                </p>
                            )}
                        </div>

                        <AnimatePresence mode="wait">
                            {shown ? (
                                <motion.div key="a" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="pt-4 border-t border-border">
                                    <p className="stat-label text-primary">What scores</p>
                                    <MarkdownMath className="text-base text-foreground leading-relaxed mt-1">
                                        {card.answer}
                                    </MarkdownMath>
                                </motion.div>
                            ) : (
                                <Button key="q" onClick={() => setShown(true)}
                                    className="btn-3d w-full bg-primary hover:bg-primary text-primary-foreground rounded-xl">
                                    Show what scores
                                </Button>
                            )}
                        </AnimatePresence>
                    </>
                )}

                {drill.stage === "cloze" && (
                    <ClozeDrill key={card.id} cloze={drill.cloze}
                        onGraded={(g) => setSuggested(suggestRating(g))} />
                )}

                {drill.stage === "produce" && (
                    <ProduceDrill key={card.id} card={card} criterion={drill.criterion}
                        onMarked={(rating) => setSuggested(rating ?? 3)} />
                )}
            </div>

            {rateable && (
                <div className="space-y-1.5">
                    {/* The drill SUGGESTS; the student decides. Only they know
                        whether they knew it or guessed it, and taking that
                        judgement away is how a schedule stops matching a
                        memory. */}
                    {suggested != null && (
                        <p className="text-xs text-muted-foreground text-center">
                            Suggested from how you went — change it if you know better.
                        </p>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {RATINGS.map((r) => (
                            <button key={r.quality} type="button" onClick={() => grade(r.quality)}
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
                </div>
            )}
        </div>
    );
}

export default function MistakeBank() {
    const { toast } = useToast();
    const [cards, setCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all");
    const [queue, setQueue] = useState(null);
    const [result, setResult] = useState(null);
    // Grades already sent, so a card graded in one run is not re-sent if the
    // student starts another before the reload lands.
    const sentRef = useRef(new Set());

    const load = useCallback(async () => {
        try {
            const user = await base44.auth.me();
            const rows = await base44.entities.Flashcard.filter({
                created_by: user.email, topic: BANK_TOPIC, is_active: true,
            });
            setCards(rows || []);
        } catch {
            setCards([]);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    // Due OR never reviewed. A mistake banked an hour ago has not "come due"
    // by the scheduler's reckoning, but the student got it wrong this morning
    // and making them wait a day is the dead end this screen exists to avoid.
    // See bankSummary's note on ready vs due.
    const isReady = useCallback((c) => isDue(c) || isNew(c), []);
    const summary = useMemo(() => bankSummary(cards, isReady), [cards, isReady]);

    const shown = useMemo(() => {
        const list = filter === "all" ? summary.cards : summary.cards.filter((c) => fixState(c) === filter);
        // Within a filter, the ones still going wrong first. Same rule as the
        // sections: the work before the wins.
        const rank = { slipping: 0, new: 1, working: 2, fixed: 3 };
        return [...list].sort((a, b) => rank[fixState(a)] - rank[fixState(b)]);
    }, [summary, filter]);

    /**
     * One graded card, written through the shared scheduler.
     *
     * Optimistic on the row we hold so the counts move as they work, and the
     * reload at the end of a run is what reconciles it.
     */
    const onGraded = useCallback(async (card, quality) => {
        const key = `${card.id}:${(card.total_reviews || 0) + 1}`;
        if (sentRef.current.has(key)) return;
        sentRef.current.add(key);
        const updates = calculateNextReview(quality, card);
        const totalReviews = (card.total_reviews || 0) + 1;
        setCards((prev) => prev.map((c) => c.id === card.id
            ? { ...c, ...reviewPatch(updates, quality), total_reviews: totalReviews } : c));
        try {
            await base44.entities.Flashcard.update(card.id, {
                ...reviewPatch(updates, quality), total_reviews: totalReviews,
            });
            // The same per-card XP the deck pays, through the same idempotent
            // event key — a mistake reviewed here is worth exactly what the
            // same card is worth on the Study page, or one of the two screens
            // is quietly the better place to do the work.
            base44.functions.invoke("awardXPIncremental", {
                type: "flashcard_card",
                event_key: `fc_${card.id}_r${totalReviews}`,
                metadata: { correct: quality >= 3, card_id: card.id },
            }).then((res) => {
                const xp = (res?.data ?? res)?.xp_awarded || 0;
                if (xp > 0) window.dispatchEvent(new CustomEvent("xp_awarded", { detail: { xp, source: "flashcard" } }));
            }).catch(() => {});
        } catch {
            sentRef.current.delete(key);
            toast({ title: "That rating didn't save", description: "The card will come back around.", variant: "destructive" });
        }
    }, [toast]);

    const start = (list) => {
        if (!list.length) return;
        setResult(null);
        setQueue(list);
    };

    const finish = (r) => {
        setQueue(null);
        if (r) setResult(r);
        load();
    };

    if (loading) {
        return (
            <div className="p-4 sm:p-6 max-w-3xl mx-auto">
                <div className="h-40 rounded-2xl bg-secondary animate-pulse" />
            </div>
        );
    }

    if (queue) {
        return (
            <div className="p-4 sm:p-6 max-w-2xl mx-auto">
                <Runner queue={queue} onGraded={onGraded} onDone={finish} />
            </div>
        );
    }

    // Nothing banked yet. This is a real state and not a failure — it says
    // where mistakes come from rather than apologising for being empty.
    if (summary.total === 0) {
        return (
            <div className="p-4 sm:p-6 max-w-2xl mx-auto">
                <div className="card-soft border-2 border-border p-6 text-center">
                    <AceBody pose="think" className="w-24 h-24 mx-auto" />
                    <h1 className="text-xl font-display font-black text-foreground mt-3">
                        Nothing in the bank yet
                    </h1>
                    <p className="text-sm text-muted-foreground leading-snug mt-1.5 max-w-sm mx-auto">
                        Take a quiz and mark it. Every mark you drop can be saved from the marking,
                        and it comes back here on its own schedule until you have it.
                    </p>
                    <Link to={createPageUrl("Quizzes")}>
                        <Button className="btn-3d bg-primary hover:bg-primary text-primary-foreground rounded-xl mt-4 gap-2">
                            <Sparkles className="w-4 h-4" /> Go to Quizzes
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    const outstanding = summary.cards.filter((c) => fixState(c) !== "fixed");
    const readyNow = summary.cards.filter(isReady);

    return (
        <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
            <div>
                <p className="stat-label text-muted-foreground">Mistake bank</p>
                {/* The headline is the thing that has gone RIGHT, stated as a
                    fraction so it cannot flatter — 0 of 14 reads as honestly
                    as 12 of 14. */}
                <h1 className="text-2xl sm:text-3xl font-display font-black text-foreground leading-tight">
                    You have fixed <span className="text-primary tabular-nums">{summary.fixed}</span> of{" "}
                    <span className="tabular-nums">{summary.total}</span>.
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    {summary.outstanding === 0
                        ? "Nothing outstanding. Every mistake you have saved is holding."
                        : `${summary.outstanding} still to nail down.`}
                </p>
            </div>

            <div className="card-soft on-table border-2 border-border p-4 space-y-4">
                <FixBar summary={summary} />

                <AnimatePresence>
                    {result && (
                        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="text-sm text-foreground">
                            <span className="font-bold tabular-nums">{result.right}</span> of{" "}
                            <span className="tabular-nums">{result.total}</span> recalled. The ones you missed
                            come back tomorrow.
                        </motion.p>
                    )}
                </AnimatePresence>

                <div className="flex flex-wrap gap-2">
                    <Button onClick={() => start(readyNow)} disabled={!readyNow.length}
                        className="btn-3d bg-primary hover:bg-primary text-primary-foreground rounded-xl gap-2">
                        <Play className="w-4 h-4" />
                        {readyNow.length ? `Review ${readyNow.length} now` : "Nothing waiting today"}
                    </Button>
                    {outstanding.length > 0 && (
                        <Button variant="outline" onClick={() => start(outstanding)}
                            className="border-2 border-border rounded-xl gap-2">
                            <RotateCcw className="w-4 h-4" /> Drill all {outstanding.length}
                        </Button>
                    )}
                </div>
            </div>

            {/* The mistakes you keep making. This is the most useful thing on
                the screen and it only appears when it has something to say —
                the themes prompt's own rule, applied across the bank rather
                than across one attempt. */}
            {summary.repeats.length > 0 && (
                <div className="card-soft border-2 border-border p-4">
                    <div className="flex items-center gap-2">
                        <Repeat className="w-4 h-4 text-streak flex-shrink-0" />
                        <p className="stat-label text-muted-foreground">You keep making these</p>
                    </div>
                    <ul className="space-y-1.5 mt-2.5">
                        {summary.repeats.slice(0, 4).map((r) => (
                            <li key={r.criterion} className="flex items-baseline justify-between gap-3">
                                <div className="min-w-0">
                                    <MarkdownMath className="text-sm font-bold text-foreground leading-snug">
                                        {r.criterion}
                                    </MarkdownMath>
                                    <p className="text-[11px] text-muted-foreground truncate">
                                        {r.subjects.join(", ") || "across your subjects"}
                                    </p>
                                </div>
                                <span className={`flex items-center gap-1 flex-shrink-0 text-[11px] font-bold tabular-nums
                                    ${r.fixed ? "text-primary" : "text-foreground"}`}>
                                    {r.fixed
                                        ? <><Check className="w-3.5 h-3.5" /> fixed</>
                                        : <>
                                            <X className="w-3.5 h-3.5 text-streak" /> {r.count}×
                                            {r.open < r.count && (
                                                <span className="font-normal text-muted-foreground">
                                                    · {r.open} open
                                                </span>
                                            )}
                                        </>}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Filters. "All" first, then only the states that exist — a chip
                reading "Fixed 0" is a filter that leads to an empty screen. */}
            <div className="flex flex-wrap gap-1.5">
                {[{ k: "all", label: `All ${summary.total}` },
                  ...ORDER.filter((k) => summary[k] > 0).map((k) => ({ k, label: `${STATE[k].label} ${summary[k]}` }))
                ].map((f) => (
                    <button key={f.k} type="button" onClick={() => setFilter(f.k)}
                        className={`pill border-2 cursor-pointer transition-colors
                            ${filter === f.k
                                ? "border-foreground bg-foreground text-background"
                                : "border-border text-muted-foreground hover:border-foreground/40"}`}>
                        {f.label}
                    </button>
                ))}
            </div>

            {filter !== "all" && (
                <p className="text-xs text-muted-foreground -mt-3">{STATE[filter].blurb}</p>
            )}

            {shown.length === 0 ? (
                <div className="card-soft border-2 border-border p-6 text-center">
                    <Inbox className="w-6 h-6 text-muted-foreground mx-auto" />
                    <p className="text-sm text-muted-foreground mt-2">Nothing in this one.</p>
                </div>
            ) : (
                <ul className="space-y-2">
                    {shown.map((c, i) => <MistakeRow key={c.id} card={c} index={i} />)}
                </ul>
            )}

            <p className="text-[11px] text-muted-foreground leading-snug">
                These are ordinary flashcards on the same schedule as the rest of your decks — they
                also show up in <Link to={createPageUrl("Study?tab=spaced_repetition")}
                    className="underline hover:text-foreground">Spaced Repetition</Link>. Fixed means two
                clean recalls and a schedule a week out or longer.
            </p>
        </div>
    );
}
