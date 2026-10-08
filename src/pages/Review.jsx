/**
 * Progress — a REPORT, in five tabs, one per feature.
 *
 * ─── A WAVE OF TRUE NUMBERS IS NOT A REPORT ─────────────────────────────────
 * This page has been two routes, then two tabs, then ONE LONG SCROLL carrying
 * everything the app knows in a single column. Every figure on it was real and
 * a student met all of them at once with nothing saying which feature each was
 * about or whether any of it was good. The answer is not fewer numbers — it is
 * that each feature gets its own screen, and each screen opens with a VERDICT
 * rather than a chart.
 *
 *   TODAY     what is outstanding and what you have already cleared. The only
 *             tab with an action on every row; `studyQueue.js` is the model.
 *   CARDS     recall, the deck's strength bands, what is slipping, the pile.
 *   QUIZZES   your average against the period before it, by subject, and the
 *             command terms costing you marks.
 *   MISTAKES  how many you have actually fixed, and which criterion repeats.
 *   HOURS     where the time went, capped the way every ranked board caps it.
 *
 * ─── EVERY TAB IS THE SAME FOUR THINGS ──────────────────────────────────────
 * One headline figure, how it moved against the student's own previous period,
 * one sentence saying what that means, then the breakdown. Learned once on the
 * first tab and read at a glance on the other three — which is most of why a
 * report reads faster than a dashboard carrying identical data.
 *
 * ─── AND THE TABS ARE NOT WHAT THEY WERE ────────────────────────────────────
 * Queue and Insights were once two tabs and that WAS wrong: Insights was the
 * half answering "is any of this working" and nothing on screen said it was
 * there, which is the "a screen nobody presses into is a screen nobody has"
 * failure /League and /Review were both rebuilt out of. What makes these
 * different is that the bar NAMES A FEATURE each, so a student who has just
 * done twenty minutes of flashcards can see which tab is about to tell them
 * something. A tab bar whose labels are the things you do is navigation; one
 * whose labels are "Queue" and "Insights" is two words nobody can place
 * themselves in.
 *
 * ─── A TAB WITH NOTHING IN IT IS STILL OFFERED ──────────────────────────────
 * It says what would fill it and links there. Hiding it would change the shape
 * of the bar between visits, so a student who has never sat a quiz would find
 * a tab appear where a different one used to be.
 *
 * ─── NOTHING IS STORED AND NOTHING IS A COMPOSITE ───────────────────────────
 * Every figure is derived from rows this page already loads, so none of it can
 * go stale or disagree with the screen it came from. There is deliberately no
 * "progress score out of 100": the app already has one number everything is
 * standardised around and a second invented scale beside it would be a figure
 * nobody can argue with competing with the one they can.
 *
 * ─── AND NOTHING IS TICKED THAT WAS NOT ACTUALLY DONE ───────────────────────
 * There is no checkbox and there cannot be one: the queue stores nothing, so a
 * tick would need a "dismissed" flag — the one thing `studyQueue.js`'s header
 * rules out, and a flag would let somebody tick away a SAC that is still on
 * Friday. THE WORK ticks the row. The page re-reads when the student comes
 * back to the tab, and anything that was on the list and is not any more is
 * held for a moment with a line through it before it goes.
 *
 * ─── The old page's reasoning, which still holds ────────────────────────────
 * "The website always thinks a bunch of flashcards are due." It did, and it
 * was mostly wrong: a card is created with next_review_date set to today, so a
 * sixty-card deck reported sixty due before anybody opened one. A count that
 * only goes up is not information; people stop reading it, and then they stop
 * reading the numbers next to it. The audit that takes that pile apart lives
 * on CARDS now, which is the tab it is about.
 *
 * And "I know this" is not a delete. The only exit from the queue used to be
 * is_active: false, so somebody who has a definition cold had to destroy the
 * card to stop being asked, which loses it for revision week. Marking known
 * keeps the card and is one button to undo — which is the only reason it is
 * safe to use casually, which is the only way an audit screen gets used.
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { deckCards, isBankCard } from "@/lib/mistakeBank";
import { ToastAction } from "@/components/ui/toast";
import { Layers, Play, Sparkles, Inbox, ChevronDown, CheckCircle2, ListChecks, Target, Clock, FileText } from "lucide-react";
import AuditPile from "@/components/study/AuditPile";
import QueueRow from "@/components/study/QueueRow";
import { ClearedStrip, ClearedRow } from "@/components/study/Cleared";
import HelpButton from "@/components/shared/HelpButton";
import Panel from "@/components/progress/Panel";
import {
    auditPiles, tally, dueQueue, todayISO, isReady,
    markKnown, markUnknown, snoozeFor,
} from "@/lib/due";
import { studyQueue, queueLead, clearedThisWeek } from "@/lib/studyQueue";
import { globalBusy, MIN_GAP_MS } from "@/lib/liveRefresh";
import { studyEvents } from "@/lib/studyLog";
import { SECONDS_PER_CARD } from "@/lib/retention";
import AceShuffle from "@/components/ace/AceShuffle";
import PeriodSwitch from "@/components/progress/PeriodSwitch";
import ProgressTabs from "@/components/progress/ProgressTabs";
import { CardsTab, QuizzesTab, MistakesTab, HoursTab } from "@/components/progress/FeatureTabs";
import {
    PERIODS, periodRange, cardsReport, quizzesReport, mistakesReport, hoursReport, workFor,
} from "@/lib/progressReport";

/** How long "not this week" actually is. */
const SNOOZE_DAYS = 7;

/**
 * The five tabs, in the order the questions get asked.
 *
 * ONE WORD EACH, measured at 360 where the bar is `grid-cols-5` and each cell
 * is about 66px: the icons are HIDDEN below `sm` for the reason the Ranked bar
 * hides its own — a glyph beside "Quizzes" restates the word next to it, which
 * is decoration exactly where width is the binding constraint, and "Mistakes"
 * is the label that clips first.
 */
const TABS = [
    ["today", "Today", ListChecks],
    ["cards", "Cards", Layers],
    ["quizzes", "Quizzes", FileText],
    ["mistakes", "Mistakes", Target],
    ["hours", "Hours", Clock],
];
const TAB_IDS = TABS.map(([id]) => id);

/**
 * `/Analytics` has redirected to `?tab=insights` since the merge, and there is
 * no tab by that name any more. It lands on CARDS, because "is any of this
 * sticking" was the lead question of the old Insights tab and the panels that
 * answered it — the memory panel and the weak topics — are the ones that moved
 * here. A redirect that drops somebody on a tab that does not exist is the
 * half-wired shape this app keeps meeting.
 */
const TAB_ALIAS = { insights: "cards", queue: "today", progress: "today" };
const resolveTab = (raw) => {
    const id = String(raw || "").toLowerCase();
    if (TAB_IDS.includes(id)) return id;
    return TAB_ALIAS[id] || "today";
};

/** How long a ticked-off row stays on screen, and how many may stack. */
const CLEARED_LINGER_MS = 7000;
const CLEARED_SHOWN = 3;

const minutesFor = (n) => Math.max(1, Math.round((n * SECONDS_PER_CARD) / 60));

/** One number and its caption, for the headline strip. */
function Figure({ value, label, tone = "text-foreground", hint }) {
    return (
        <div className="min-w-0">
            <p className={`font-display font-extrabold text-2xl sm:text-3xl leading-none ${tone}`}>{value}</p>
            <p className="stat-label mt-1">{label}</p>
            {hint && <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{hint}</p>}
        </div>
    );
}

export default function Review() {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [showKnown, setShowKnown] = useState(false);
    /** Rows that were on the list a moment ago and are not any more. */
    const [justCleared, setJustCleared] = useState([]);
    const seen = useRef(null);
    const loadOk = useRef(true);
    const lastLoad = useRef(Date.now());
    const { toast } = useToast();
    const navigate = useNavigate();
    const location = useLocation();

    /**
     * Which tab, and over what window.
     *
     * The tab is read from the query so every existing link still lands — and
     * it is WRITTEN back on a change, so a student can send somebody the tab
     * they are looking at. `replace` rather than `push`, or four taps along the
     * bar put four entries in the back stack and leaving the page takes five
     * presses.
     */
    const [tab, setTab] = useState(() =>
        resolveTab(new URLSearchParams(location.search).get("tab")));
    const [period, setPeriod] = useState(PERIODS[0].id);

    const pickTab = useCallback((next) => {
        setTab(next);
        const q = new URLSearchParams(location.search);
        q.set("tab", next);
        navigate({ search: `?${q.toString()}` }, { replace: true });
    }, [location.search, navigate]);

    // Computed once per render rather than per card, so a four-hundred-card
    // audit does not build four hundred Date objects to ask the same question.
    const today = todayISO();

    const load = useCallback(async () => {
        try {
            const user = await base44.auth.me();
            const email = user.email;
            // ONE PASS. Six reads for a page that used to be two pages making
            // ten between them, and the shim's cache dedupes anything another
            // mounted component asks for in the same paint.
            const [flashcards, quizzes, attempts, assessments, sessions, techniques] =
                await Promise.all([
                    base44.entities.Flashcard.filter({ created_by: email, is_active: true }),
                    base44.entities.Quiz.filter({ created_by: email }),
                    base44.entities.QuizAttempt.filter({ created_by: email }),
                    base44.entities.SubjectAssessment.filter({ created_by: email }),
                    base44.entities.StudySession.filter({ created_by: email }),
                    base44.entities.StudyTechnique.filter({ created_by: email }),
                ].map(p => p.catch(() => [])));

            loadOk.current = true;
            setData({
                // The deck half and the bank half, split once. `deckCards` is
                // the filter every DECK surface reads through; the bank reviews
                // on its own screen and is counted here as its own queue row.
                cards: deckCards(flashcards || []),
                bankCards: (flashcards || []).filter(isBankCard),
                quizzes: quizzes || [],
                attempts: attempts || [],
                assessments: assessments || [],
                sessions: sessions || [],
                techniques: techniques || [],
            });
        } catch (err) {
            console.error("Review load error:", err);
            // A FAILED READ MUST NEVER READ AS "YOU FINISHED EVERYTHING". The
            // catch hands back six empty arrays, so without this the queue
            // empties and every item on it would be announced as cleared —
            // congratulating a student for an outage.
            loadOk.current = false;
            toast({ title: "Couldn't load your work", description: "Refresh and try again.", variant: "destructive" });
            setData({ cards: [], bankCards: [], quizzes: [], attempts: [], assessments: [], sessions: [], techniques: [] });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => { load(); }, [load]);

    /**
     * ─── COMING BACK IS WHAT TICKS SOMETHING OFF ────────────────────────────
     * The obvious build for "check items off" is a checkbox, and it cannot be
     * done here: the queue is DERIVED and stores nothing, so a tick would need
     * a "dismissed" flag — the one thing `studyQueue.js`'s own header rules
     * out, and a flag would let somebody tick away a SAC that is still on
     * Friday. So THE WORK is what ticks the row, and this is the half that was
     * missing: every row leaves to another page, and nothing re-read the data
     * when the student came back, so the list they returned to was the list
     * they left and the thing they had just done was still on it.
     *
     * It fires on becoming visible rather than on a timer. A poll would be a
     * query per student per interval to answer a question that only changes
     * when they go and do something, and `MIN_GAP_MS` keeps an alt-tabbing
     * student from re-reading six tables every few seconds.
     *
     * It also HOLDS while anything in the app has declared itself busy — the
     * same registry `liveRefresh` already keeps, rather than a second opinion
     * about what must not be interrupted.
     */
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState !== "visible") return;
            if (globalBusy.reasons().length) return;
            if (Date.now() - lastLoad.current < MIN_GAP_MS) return;
            lastLoad.current = Date.now();
            load();
        };
        document.addEventListener("visibilitychange", onVisible);
        window.addEventListener("focus", onVisible);
        return () => {
            document.removeEventListener("visibilitychange", onVisible);
            window.removeEventListener("focus", onVisible);
        };
    }, [load]);

    const cards = data?.cards || [];
    const counts = useMemo(() => tally(cards, today), [cards, today]);
    const piles = useMemo(() => auditPiles(cards, today), [cards, today]);
    const cardQueue = useMemo(() => dueQueue(cards, { today }), [cards, today]);
    const events = useMemo(
        () => studyEvents(data?.sessions || [], data?.techniques || []),
        [data]);

    /** The whole queue. Derived, so nothing here can go stale. */
    const queue = useMemo(() => (data ? studyQueue({
        cards,
        bankCards: data.bankCards,
        quizzes: data.quizzes,
        attempts: data.attempts,
        assessments: data.assessments,
        events,
        piles,
        isReady: (c) => isReady(c, today),
        today,
    }) : []), [data, cards, events, piles, today]);

    const lead = useMemo(() => queueLead(queue), [queue]);

    /**
     * The window, and the four feature reports read off it.
     *
     * All four are computed on every render of the page rather than per tab.
     * They are arithmetic over rows already in memory — no query, no model call
     * — and computing only the live one would mean the tab bar could not carry
     * a figure, which is what stops a label being a word with nothing behind it.
     */
    const range = useMemo(() => periodRange(period), [period]);

    const reports = useMemo(() => {
        if (!data) return null;
        return {
            cards: cardsReport(cards, range),
            quizzes: quizzesReport(data.attempts, data.quizzes, range),
            mistakes: mistakesReport(data.bankCards, data.attempts, (c) => isReady(c, today), range),
            hours: hoursReport(events, data.techniques, range),
        };
    }, [data, cards, events, range, today]);

    /** This week's done pile, off the same rows the queue is built from. */
    const cleared = useMemo(() => (data ? clearedThisWeek({
        cards, bankCards: data.bankCards, attempts: data.attempts, events,
    }) : null), [data, cards, events]);

    /**
     * ─── WHAT LEFT THE LIST SINCE LAST TIME ─────────────────────────────────
     * Nothing is claimed that did not happen: an item is announced as done
     * because the fact behind it stopped being true, which is the same reason
     * it was on the list at all.
     *
     * The FIRST settle announces nothing. Without that guard, opening the page
     * would tick off everything the student had cleared at any point in the
     * past — and a failed read is treated as a first settle for the same
     * reason, which is what `loadOk` is for.
     */
    useEffect(() => {
        if (!data) return;
        if (!loadOk.current) { seen.current = null; return; }
        const now = new Map(queue.map((q) => [q.key, q]));
        const prev = seen.current;
        seen.current = now;
        if (!prev) return;
        const gone = [...prev.values()].filter((it) => !now.has(it.key));
        if (!gone.length) return;
        // Newest first, and capped: six rows ticking at once is a list of
        // things that are no longer there, which is not what the student came
        // back to see.
        setJustCleared((prevGone) => [...gone, ...prevGone].slice(0, CLEARED_SHOWN));
    }, [data, queue]);

    // They go on their own. A tick that stays is a row, and the queue would
    // slowly fill with work the student finished days ago.
    useEffect(() => {
        if (!justCleared.length) return undefined;
        const t = setTimeout(() => setJustCleared([]), CLEARED_LINGER_MS);
        return () => clearTimeout(t);
    }, [justCleared]);

    /**
     * Apply a patch to a set of cards.
     *
     * Optimistic, because the whole point is that clearing a pile feels like
     * one gesture, and reversible from the toast, because a student marking
     * two hundred cards known should not have to be sure first. The previous
     * values are captured per card rather than assumed, so undo restores an
     * already-snoozed card to its snooze rather than to nothing.
     */
    const apply = useCallback(async (ids, patch, message) => {
        if (!ids?.length) return;
        const before = new Map();
        for (const c of cards) {
            if (!ids.includes(c.id)) continue;
            const prev = {};
            for (const k of Object.keys(patch)) prev[k] = c[k] ?? null;
            before.set(c.id, prev);
        }

        const write = async (idList, payload, perCard) => {
            setBusy(true);
            setData((prev) => (prev ? {
                ...prev,
                cards: prev.cards.map((c) => {
                    if (!idList.includes(c.id)) return c;
                    return { ...c, ...(perCard ? perCard.get(c.id) : payload) };
                }),
            } : prev));
            try {
                if (perCard) {
                    // Undo can restore different values per card, so it groups
                    // by identical payload rather than sending one row at a time.
                    const groups = new Map();
                    for (const [id, p] of perCard) {
                        const key = JSON.stringify(p);
                        if (!groups.has(key)) groups.set(key, { payload: p, ids: [] });
                        groups.get(key).ids.push(id);
                    }
                    // Distinct payloads, so the groups are independent.
                    await Promise.all([...groups.values()].map(g =>
                        base44.entities.Flashcard.bulkUpdate(g.ids, g.payload)));
                } else {
                    await base44.entities.Flashcard.bulkUpdate(idList, payload);
                }
            } catch (err) {
                console.error("Review update failed:", err);
                toast({ title: "That didn't save", description: "Your cards are unchanged.", variant: "destructive" });
                await load();
            } finally {
                setBusy(false);
            }
        };

        await write(ids, patch, null);
        toast({
            title: message,
            action: (
                <ToastAction altText="Undo" onClick={() => write(ids, null, before)}>Undo</ToastAction>
            ),
        });
    }, [cards, toast, load]);

    const onKnown = useCallback((ids, msg) => apply(ids, markKnown(), msg), [apply]);
    const onRestore = useCallback((ids, msg) => apply(ids, markUnknown(), msg), [apply]);
    const onSnooze = useCallback((ids, msg) => apply(ids, snoozeFor(SNOOZE_DAYS, today), msg), [apply, today]);

    const startReview = useCallback((pile) => {
        // Study owns the review session. The subject rides along so it opens on
        // the deck the student was just looking at rather than on the list.
        navigate(`${createPageUrl("Study")}?tab=spaced_repetition${pile ? `&subject=${encodeURIComponent(pile.subject)}` : ""}`);
    }, [navigate]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <AceShuffle size="lg" label="Loading your work" />
            </div>
        );
    }

    const active = piles.filter((p) => p.active > 0);
    const fresh = piles.filter((p) => p.active === 0 && p.fresh > 0);
    const known = piles.filter((p) => p.known > 0);
    const nothingAtAll = cards.length === 0 && !queue.length;

    /**
     * THE PILE, TAKEN APART — and it lives on CARDS now.
     *
     * It answers "why is it asking me for these" about flashcards specifically,
     * so a tab about flashcards is where it belongs; under the queue it was a
     * block about one feature sitting on the screen that ranks all seven. Still
     * folded, because it is what a student opens once a fortnight when the
     * number looks wrong, and it still NAMES what is behind it rather than
     * being a chevron on nothing.
     */
    /**
     * ─── THE SPLIT IS ON SCREEN; THE PILES ARE BEHIND THE FOLD ──────────────
     * This page was built around one sentence — "the website always thinks a
     * bunch of flashcards are due" — and the answer to it is these three
     * figures, which say that most of the pile is material nobody has opened
     * rather than review debt. Folding THAT away would hide the page's own
     * reason for existing, so it rides beside the strength bands where it
     * fills the second column with the complementary cut of the same deck:
     * how strong the cards are, against how many are asking.
     *
     * What stays folded is the per-subject list under it, which is long, has
     * three buttons per row, and is what a student opens once a fortnight when
     * the number looks wrong.
     */
    const pileSummary = cards.length > 0 ? (
        <Panel title={`Where your ${counts.total} cards stand`}
            note="The honest split. Most queues are mostly material nobody has opened yet, which is not a backlog.">
            <div className="grid grid-cols-3 gap-4">
                <Figure value={counts.active} label="Asking for you"
                    tone={counts.active > 0 ? "text-chart-3" : "text-muted-foreground"}
                    hint={counts.overdue > 0 ? `${counts.overdue} well past due` : null} />
                <Figure value={counts.new} label="Never opened" tone="text-muted-foreground"
                    hint={counts.new > 0 ? "New material" : null} />
                <Figure value={counts.known} label="Put away" tone="text-primary"
                    hint={counts.known > 0 ? "You know these" : null} />
            </div>
        </Panel>
    ) : null;

    const auditSection = (
        <section className="space-y-3">
            {active.length > 0 && (
                <section className="space-y-3">
                    <h3 className="stat-label px-1">Claiming your attention</h3>
                    {active.map((p) => (
                        <AuditPile key={p.subject} pile={p} today={today} busy={busy}
                            onKnown={onKnown} onSnooze={onSnooze} onRestore={onRestore}
                            onReview={startReview} />
                    ))}
                </section>
            )}

            {fresh.length > 0 && (
                <section className="space-y-3">
                    <h3 className="stat-label px-1">Not started yet</h3>
                    <p className="text-xs text-muted-foreground px-1 -mt-1">
                        These have never been reviewed, so nothing here is overdue. They join the
                        queue a few at a time once your due pile is clear.
                    </p>
                    {fresh.map((p) => (
                        <AuditPile key={p.subject} pile={p} today={today} busy={busy}
                            onKnown={onKnown} onSnooze={onSnooze} onRestore={onRestore}
                            onReview={startReview} />
                    ))}
                </section>
            )}

            {known.length > 0 && (
                <section className="space-y-3">
                    <button type="button" onClick={() => setShowKnown((v) => !v)}
                        aria-expanded={showKnown}
                        className="flex items-center gap-2 stat-label px-1 hover:text-foreground">
                        Put away ({counts.known})
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showKnown ? "rotate-180" : ""}`} />
                    </button>
                    {showKnown && (
                        <>
                            <p className="text-xs text-muted-foreground px-1 -mt-1">
                                Cards you have said you know. They are still yours, still in the deck,
                                and one button away from coming back.
                            </p>
                            {known.map((p) => (
                                <AuditPile key={p.subject} pile={p} today={today} busy={busy}
                                    onKnown={onKnown} onSnooze={onSnooze} onRestore={onRestore}
                                    onReview={null} />
                            ))}
                        </>
                    )}
                </section>
            )}
        </section>
    );

    return (
        <div className="min-h-screen p-4 sm:p-6 lg:p-8">
            <div className="max-w-5xl mx-auto space-y-5">

                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Progress</span>
                    <HelpButton page="Review" />
                </div>

                {/* ══ THE BAR ═══════════════════════════════════════════════
                    One cell per FEATURE, which is what makes this navigation
                    rather than two words nobody can place themselves in. It is
                    a component so the probe can draw the REAL one at 360. */}
                <ProgressTabs tabs={TABS} value={tab} onChange={pickTab} />

                {/* THE WINDOW IS ALWAYS STATED. On Today it is a sentence
                    rather than a switch, because the queue is about right now
                    and a control that changes nothing is worse than none — the
                    rule `BoardSwitch` keeps about being handed one board. The
                    row stays either way so the layout does not jump. */}
                <div className="min-h-[2.25rem] flex items-center">
                    {tab === "today"
                        ? <p className="text-xs text-muted-foreground">Everything outstanding right now, and what you have cleared since Monday.</p>
                        : <PeriodSwitch value={period} onChange={setPeriod} />}
                </div>

                {/* ══ TODAY ═════════════════════════════════════════════ */}
                <div className={tab === "today" ? "space-y-5" : "hidden"}>

                        {/* THE LEAD NAMES THE FIRST THING, not a total. "You
                            have 6 things outstanding" is a number; "your
                            Chemistry SAC is on Friday and you have not
                            started" is a reason to do something. */}
                        <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                            className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-[1.15]">
                            {lead ? lead.line : "You're all caught up."}
                        </motion.h1>

                        {/* THE DONE PILE, directly under the lead. It is the
                            counterweight to everything below it: the list of
                            what you owe gets shorter the better you do, so
                            without this the reward for a good week was a
                            shorter list of failings. */}
                        <ClearedStrip cleared={cleared} />

                        {(queue.length > 0 || justCleared.length > 0) ? (
                            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.04 }}
                                className="card-soft on-table overflow-hidden">
                                {/* Ticked rows sit ABOVE the remaining work and
                                    leave on their own. They are in the same
                                    panel rather than a toast, because what a
                                    student wants to see on coming back is the
                                    thing they did leaving the list they left
                                    it on. */}
                                <AnimatePresence initial={false}>
                                    {justCleared.map((item) => (
                                        <ClearedRow key={`done:${item.key}`} item={item} />
                                    ))}
                                </AnimatePresence>
                                {queue.map((item, i) => (
                                    <QueueRow key={item.key} item={item} index={i} lead={i === 0}
                                        href={createPageUrl(item.page) + (item.query || "")} />
                                ))}
                            </motion.div>
                        ) : nothingAtAll ? (
                            <div className="card-soft on-table p-10 text-center">
                                <Inbox className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                                <h2 className="font-display font-extrabold text-foreground">Nothing here yet</h2>
                                <p className="text-sm text-muted-foreground mt-1 mb-4">
                                    Once you have made some cards or sat a quiz, this is where everything
                                    outstanding collects.
                                </p>
                                <Link to={createPageUrl("Study")}>
                                    <Button className="rounded-xl gap-2"><Sparkles className="w-4 h-4" /> Make some cards</Button>
                                </Link>
                            </div>
                        ) : (
                            /* ─── AN EMPTY QUEUE IS A RESULT, NOT A VOID ─────
                               It used to be a grey tick over "nothing is
                               asking for you", which is the same card an
                               account that has never done anything would get —
                               the page's one moment of success drawn as an
                               absence. It says WHY the list is empty now, and
                               the why is the student's own week, counted off
                               their rows. With a quiet week behind it the
                               claim is dropped rather than invented: an empty
                               queue on a Monday morning is a real caught-up
                               and is not an achievement. */
                            <div className="rounded-2xl bg-primary/5 border border-primary/15 on-table p-8 text-center">
                                <CheckCircle2 className="w-10 h-10 text-primary mx-auto mb-3" />
                                <h2 className="font-display font-extrabold text-xl text-foreground">
                                    {cleared?.any ? "You cleared it." : "Nothing is asking for you"}
                                </h2>
                                <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto">
                                    {cleared?.any
                                        ? "Nothing is due, nothing is waiting to be marked and nothing has a date on it this fortnight. That is this week's work, done."
                                        : "No cards due, no mistakes waiting, nothing with a date on it this fortnight. Have the evening off."}
                                </p>
                            </div>
                        )}

                        {/* A day's work on the cards specifically, when there is
                            one. The queue row above says how many are ready;
                            this says how long today's slice takes and starts
                            it, which is a different promise. */}
                        {cardQueue.queue.length > 0 && (
                            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.06 }}
                                className="rounded-2xl bg-primary/5 border border-primary/15 on-table p-5">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                                            <Layers className="w-5 h-5 text-primary" />
                                        </div>
                                        <div className="min-w-0">
                                            <h2 className="font-display font-extrabold text-foreground">
                                                {cardQueue.queue.length} card{cardQueue.queue.length === 1 ? "" : "s"} for today
                                            </h2>
                                            <p className="text-sm text-muted-foreground">
                                                About {minutesFor(cardQueue.queue.length)} minutes.
                                                {cardQueue.backlog > 0
                                                    ? ` ${cardQueue.backlog} more behind them, and they will wait.`
                                                    : " That is the lot."}
                                            </p>
                                        </div>
                                    </div>
                                    <Button onClick={() => startReview(null)} className="rounded-xl gap-2 flex-shrink-0">
                                        <Play className="w-4 h-4" /> Start
                                    </Button>
                                </div>
                            </motion.div>
                        )}

                </div>

                {/* ══ THE FOUR FEATURE REPORTS ══════════════════════════════
                    Rendered only when live. They are cheap — arithmetic over
                    rows already in memory — but the panels under them are not:
                    four charts mounted off screen is four `ResizeObserver`s and
                    four recharts trees paid for on a tab nobody opened. */}
                {tab === "cards" && (
                    <CardsTab report={reports?.cards} range={range} cards={cards}
                        techniques={data?.techniques || []}
                        work={workFor(queue, "cards")} pile={pileSummary} audit={auditSection} />
                )}
                {tab === "quizzes" && (
                    <QuizzesTab report={reports?.quizzes} range={range}
                        work={workFor(queue, "quizzes")} />
                )}
                {tab === "mistakes" && (
                    <MistakesTab report={reports?.mistakes} range={range}
                        work={workFor(queue, "mistakes")} />
                )}
                {tab === "hours" && (
                    <HoursTab report={reports?.hours} range={range} events={events}
                        quizzes={data?.quizzes || []} attempts={data?.attempts || []}
                        cards={cards} techniques={data?.techniques || []} today={today} />
                )}
            </div>
        </div>
    );
}
