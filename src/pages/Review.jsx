/**
 * Review — what you owe, and whether any of it is sticking.
 *
 * ─── The two pages this is ──────────────────────────────────────────────────
 * It was two routes. /Review was an audit of FLASHCARDS whose own subtitle
 * read "Everything the app is keeping track of" — a claim it could not meet,
 * because six other things the app genuinely tracks and already has an action
 * for were on other screens or surfaced nowhere. And /Analytics was 1,271
 * lines of chart answering "how much did I do", which is a question nobody
 * acts on: the daily-minutes bars, the technique pie, the rating histogram and
 * the mastery grid were all true and none of them changed what a student did
 * next.
 *
 * One page, two tabs, and the split is what you can DO about it:
 *
 *   QUEUE     everything outstanding, ranked by what it costs to skip today,
 *             each row carrying the reason it is there and the button that
 *             answers it. `studyQueue.js` is the model.
 *   INSIGHTS  the panels that end in an action — is it sticking, where are the
 *             marks going, where do the hours go. A chart earns its place here
 *             by changing what somebody does.
 *
 * ─── Why the queue is first, and why the cards survive under it ─────────────
 * The queue answers "what now" and the audit answers "why is it asking". Both
 * are needed and only one is needed FIRST: the pile detail — the honest split
 * into due, never-opened and put-away, with the three ways to answer each —
 * is the thing a student opens once a fortnight when the number looks wrong,
 * and the thing nobody should have to scroll past every day.
 *
 * ─── The old page's reasoning, which still holds ────────────────────────────
 * "The website always thinks a bunch of flashcards are due." It did, and it
 * was mostly wrong: a card is created with next_review_date set to today, so a
 * sixty-card deck reported sixty due before anybody opened one, and
 * `next_review_date <= today` never stops being true, so a fortnight off left
 * every card permanently overdue with the number only climbing. A count that
 * only goes up is not information; people stop reading it, and then they stop
 * reading the numbers next to it.
 *
 * And "I know this" is not a delete. The only exit from the queue used to be
 * is_active: false, so somebody who has a definition cold had to destroy the
 * card to stop being asked, which loses it for revision week. Marking known
 * keeps the card and is one button to undo — which is the only reason it is
 * safe to use casually, which is the only way an audit screen gets used.
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { deckCards, isBankCard } from "@/lib/mistakeBank";
import { ToastAction } from "@/components/ui/toast";
import { Layers, Play, Sparkles, Inbox, ChevronDown, ListChecks, LineChart, CheckCircle2 } from "lucide-react";
import AuditPile from "@/components/study/AuditPile";
import QueueRow from "@/components/study/QueueRow";
import HelpButton from "@/components/shared/HelpButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    auditPiles, tally, dueQueue, todayISO, isReady,
    markKnown, markUnknown, snoozeFor,
} from "@/lib/due";
import { studyQueue, queueLead } from "@/lib/studyQueue";
import { studyEvents } from "@/lib/studyLog";
import { SECONDS_PER_CARD } from "@/lib/retention";
import AceShuffle from "@/components/ace/AceShuffle";
import InsightsTab from "@/components/analytics/InsightsTab";

/** How long "not this week" actually is. */
const SNOOZE_DAYS = 7;

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

const TABS = [["queue", "Queue", ListChecks], ["insights", "Insights", LineChart]];

export default function Review() {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [showKnown, setShowKnown] = useState(false);
    const [showAudit, setShowAudit] = useState(false);
    const { toast } = useToast();
    const navigate = useNavigate();
    const location = useLocation();

    // `/Analytics` redirects here with ?tab=insights, so the one route that
    // existed for the charts still lands on them rather than on a queue the
    // student did not ask for.
    const [tab, setTab] = useState(() =>
        new URLSearchParams(location.search).get("tab") === "insights" ? "insights" : "queue");

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
            toast({ title: "Couldn't load your work", description: "Refresh and try again.", variant: "destructive" });
            setData({ cards: [], bankCards: [], quizzes: [], attempts: [], assessments: [], sessions: [], techniques: [] });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => { load(); }, [load]);

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
        navigate(`${createPageUrl("Study")}?tab=spaced${pile ? `&subject=${encodeURIComponent(pile.subject)}` : ""}`);
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

    return (
        <div className="min-h-screen p-4 sm:p-6 lg:p-8">
            <div className="max-w-5xl mx-auto space-y-5">

                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Progress</span>
                    <HelpButton page="Review" />
                </div>

                <Tabs value={tab} onValueChange={setTab} className="space-y-5">
                    <TabsList className="grid w-full sm:w-auto sm:inline-grid grid-cols-2 h-auto p-1.5 rounded-2xl bg-surface border-2 border-border shadow-soft">
                        {TABS.map(([v, label, Icon]) => (
                            <TabsTrigger key={v} value={v}
                                className="flex items-center justify-center gap-1.5 py-2.5 px-4 sm:px-6 rounded-xl text-sm font-bold whitespace-nowrap text-muted-foreground data-[state=active]:bg-foreground data-[state=active]:text-background transition-all">
                                <Icon className="hidden sm:block w-4 h-4" /> {label}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {/* ══ QUEUE ═════════════════════════════════════════════ */}
                    <TabsContent value="queue" className="mt-0 space-y-5">

                        {/* THE LEAD NAMES THE FIRST THING, not a total. "You
                            have 6 things outstanding" is a number; "your
                            Chemistry SAC is on Friday and you have not
                            started" is a reason to do something. */}
                        <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                            className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-[1.15]">
                            {lead ? lead.line : "You're all caught up."}
                        </motion.h1>

                        {queue.length > 0 ? (
                            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.04 }}
                                className="card-soft on-table overflow-hidden">
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
                            <div className="card-soft on-table p-8 text-center">
                                <CheckCircle2 className="w-9 h-9 text-primary mx-auto mb-3" />
                                <h2 className="font-display font-extrabold text-foreground">Nothing is asking for you</h2>
                                <p className="text-sm text-muted-foreground mt-1">
                                    No cards due, no mistakes waiting, nothing with a date on it this
                                    fortnight. Have the evening off.
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

                        {/* ── THE AUDIT, FOLDED ───────────────────────────────
                            The detail behind the card row: the honest split and
                            the three ways to answer each pile. It is what a
                            student opens when the number looks wrong, which is
                            once a fortnight — so it is not the thing everybody
                            scrolls past every day. It NAMES what is behind it
                            rather than being a chevron on nothing, which is the
                            call the science rail already makes. */}
                        {cards.length > 0 && (
                            <section className="space-y-3">
                                <button type="button" onClick={() => setShowAudit((v) => !v)}
                                    aria-expanded={showAudit}
                                    className="w-full card-soft on-table p-4 flex items-center gap-3 text-left
                                        hover:bg-secondary/40 transition-colors">
                                    <div className="flex-1 min-w-0">
                                        <h2 className="font-display font-extrabold text-foreground text-sm">
                                            Where your {counts.total} cards actually stand
                                        </h2>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {counts.active} asking for you · {counts.new} never opened · {counts.known} put away
                                        </p>
                                    </div>
                                    <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${showAudit ? "rotate-180" : ""}`} />
                                </button>

                                {showAudit && (
                                    <>
                                        <div className="card-soft on-table p-5">
                                            <div className="grid grid-cols-3 gap-4">
                                                <Figure value={counts.active} label="Asking for you"
                                                    tone={counts.active > 0 ? "text-chart-3" : "text-muted-foreground"}
                                                    hint={counts.overdue > 0 ? `${counts.overdue} of them well past due` : null} />
                                                <Figure value={counts.new} label="Never opened" tone="text-muted-foreground"
                                                    hint={counts.new > 0 ? "New material, not a backlog" : null} />
                                                <Figure value={counts.known} label="Put away" tone="text-primary"
                                                    hint={counts.known > 0 ? "You said you know these" : null} />
                                            </div>

                                            {/* The reframe, said out loud. For most students this
                                                line is the entire fix: the alarming number was
                                                never review debt. */}
                                            {counts.new > counts.active && counts.new > 0 && (
                                                <p className="mt-4 text-sm text-muted-foreground border-t border-border pt-3">
                                                    Most of your queue is material you have not started yet. That is not you
                                                    falling behind, and nothing here is counting it against you.
                                                </p>
                                            )}
                                        </div>

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
                                    </>
                                )}
                            </section>
                        )}
                    </TabsContent>

                    {/* ══ INSIGHTS ══════════════════════════════════════════ */}
                    <TabsContent value="insights" className="mt-0">
                        <InsightsTab data={data} today={today} />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
