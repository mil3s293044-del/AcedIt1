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
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import AceSpot, { useAceCue } from "@/components/ace/AceSpot";
import { isReady } from "@/lib/due";
import {
    BANK_TOPIC, bankSummary, fixState, mistakeMeta, casesFor,
} from "@/lib/mistakeBank";
import useBankActions from "@/components/mistakes/useBankActions";
import { redoQueue } from "@/lib/quizInsight";
import { revisionQuery } from "@/lib/revision";
import QuizPlayer from "@/components/quizzes/QuizPlayer";
import PreSit from "@/components/quizzes/PreSit";
import SitScreen from "@/components/shared/SitScreen";
import QuestionPanel from "@/components/mistakes/QuestionPanel";
import CommandTermPanel from "@/components/quizzes/CommandTermPanel";
import BankBand, { BankPile } from "@/components/mistakes/BankBand";
import DrillRun from "@/components/mistakes/DrillRun";
import { pileOf, bankBands } from "@/lib/bankRun";
import { Play, RotateCcw, Check, X, Sparkles, Bookmark } from "lucide-react";

/**
 * Nothing banked yet. Its own component so the hover reaction re-renders this
 * card, not the page: Ace arrives thinking it over, settles, and leans in
 * while the pointer is on the way to Quizzes.
 */
function EmptyBank() {
    const ace = useAceCue();
    return (
        <div className="p-4 sm:p-6 max-w-2xl mx-auto">
            <div className="card-soft border-2 border-border p-6 text-center">
                <AceSpot pose="think" cue={ace.cue} className="w-24 h-24 mx-auto" />
                <h1 className="text-xl font-display font-black text-foreground mt-3">
                    Nothing in the bank yet
                </h1>
                <p className="text-sm text-muted-foreground leading-snug mt-1.5 max-w-sm mx-auto">
                    Take a quiz and mark it. Every mark you drop can be saved from the marking,
                    and it comes back here on its own schedule until you have it.
                </p>
                <Link to={createPageUrl("Quizzes")} {...ace.hover("eager")}>
                    <Button className="btn-3d bg-primary hover:bg-primary text-primary-foreground rounded-xl mt-4 gap-2">
                        <Sparkles className="w-4 h-4" /> Go to Quizzes
                    </Button>
                </Link>
            </div>
        </div>
    );
}

/**
 * The route. The bank lives inside Revision now — "All mistakes" there is this
 * same screen — and the route stays so every old link, bookmark and toast
 * still lands on it, with its tab, rather than on a 404.
 */
export default function MistakeBank() {
    const tab = new URLSearchParams(window.location.search).get("tab");
    return <Navigate replace
        to={`${createPageUrl("Revision")}${revisionQuery({ view: "mistakes", tab: tab === "redo" || tab === "fix" ? tab : undefined })}`} />;
}

export function MistakeBankView() {
    const { toast } = useToast();
    const [cards, setCards] = useState([]);
    // Quiz attempts: the command-term panel, the redo gate and every fixState.
    const [attempts, setAttempts] = useState([]);
    // The quizzes the mistakes came from, so a case can be re-sat where it
    // happened rather than merely named.
    const [quizzes, setQuizzes] = useState([]);
    const [loading, setLoading] = useState(true);
    /**
     * Fix, or Sit again. A DEEP LINK MAY CHOOSE — `reachable.test.mjs` pins
     * the ids against what is linked, because the queue's "questions to sit
     * again" row once landed on Fix.
     */
    const [tab, setTab] = useState(() => {
        const t = new URLSearchParams(window.location.search).get("tab");
        return t === "redo" || t === "fix" ? t : "fix";
    });
    // The drill run in progress, and what it is called.
    const [run, setRun] = useState(null);
    // A re-sit on the table (the pre-sit sheet), and one being sat.
    const [pendingRedo, setPendingRedo] = useState(null);
    const [redoing, setRedoing] = useState(null);
    const putCards = useCallback((next) => {
        setCards((prev) => (typeof next === "function" ? next(prev) : next));
    }, []);

    const load = useCallback(async () => {
        try {
            const user = await base44.auth.me();
            // Three independent reads. The bank is the only one that must
            // succeed: attempts and quizzes each fail on their own.
            const [rows, attemptRows, quizRows] = await Promise.all([
                base44.entities.Flashcard.filter({
                    created_by: user.email, topic: BANK_TOPIC, is_active: true,
                }),
                base44.entities.QuizAttempt.filter({ created_by: user.email }).catch(() => []),
                base44.entities.Quiz.filter({ created_by: user.email }).catch(() => []),
            ]);
            putCards(rows || []);
            setAttempts(attemptRows || []);
            setQuizzes(quizRows || []);
        } catch {
            putCards([]);
        } finally { setLoading(false); }
    }, [putCards]);

    useEffect(() => { load(); }, [load]);

    // `isReady` is due OR never reviewed — a mistake banked an hour ago is
    // ready now. ATTEMPTS ARE PASSED EVERYWHERE A STATE IS READ, or fixState
    // reports the ladder alone and calls a rehearsed mistake "fixed".
    const summary = useMemo(() => bankSummary(cards, isReady, attempts), [cards, attempts]);
    const pile = useMemo(() => pileOf(summary.cards, attempts), [summary, attempts]);
    const bands = useMemo(() => bankBands(cards, { attempts, isReady }), [cards, attempts]);
    const cases = useMemo(() => casesFor(cards, attempts, quizzes), [cards, attempts, quizzes]);

    // Whole questions to sit again. Derived, never stored — see redoQueue.
    const redo = useMemo(() => redoQueue(quizzes, attempts, cards), [quizzes, attempts, cards]);
    const redoByQuiz = useMemo(() => {
        const groups = new Map();
        for (const row of redo) {
            if (!groups.has(row.quizId)) {
                groups.set(row.quizId, { quiz: row.quiz, title: row.title, subject: row.subject, rows: [] });
            }
            groups.get(row.quizId).rows.push(row);
        }
        return [...groups.values()].sort((a, b) => b.rows.length - a.rows.length);
    }, [redo]);

    /**
     * A re-sit of one quiz's flagged questions, laid on the table first.
     *
     * Through the retry path the player already has: `_isRetry` keeps it out
     * of the averages and the deck card (a subset of your hardest questions is
     * not the quiz), and `_sourceIndex` records each result against its place
     * in the PARENT quiz — which is exactly what the redo gate reads back.
     */
    const startRedo = (group) => {
        const questions = group.rows
            .map((r) => ({ ...r.question, _sourceIndex: r.qIndex }))
            .filter((q) => q.question);
        if (!questions.length) return;
        setPendingRedo({ ...group.quiz, _isRetry: true, _parentTitle: group.title, title: `${group.title} — sit again`, questions });
    };

    // Grading, clearing and restoring live in one hook that Revision shares —
    // the code that pays XP for a rating is written once.
    const { onGraded, clearFixed, restore } = useBankActions({ putCards, toast });

    const drill = (list, label) => {
        if (!list?.length) return;
        setRun({ queue: list, label });
    };
    const endRun = () => { setRun(null); load(); };

    if (loading) {
        return (
            <div className="p-4 sm:p-6 max-w-3xl mx-auto">
                <div className="h-40 rounded-2xl bg-secondary animate-pulse" />
            </div>
        );
    }

    // The drill and a re-sit each take the whole screen — see SitScreen.
    if (run) {
        return (
            <DrillRun queue={run.queue} attempts={attempts} label={run.label}
                onGraded={onGraded} onClear={clearFixed} onClose={endRun}
                onSitAgain={redoByQuiz.length ? () => { endRun(); setTab("redo"); } : null} />
        );
    }
    if (redoing) {
        return (
            <SitScreen label={redoing.quiz.title}>
                <QuizPlayer quiz={redoing.quiz} mode={redoing.mode} timeLimitMs={redoing.timeLimitMs}
                    onExit={() => { setRedoing(null); load(); }} />
            </SitScreen>
        );
    }

    // Nothing banked yet. A real state and not a failure.
    if (summary.total === 0 && summary.clearedCount === 0 && redoByQuiz.length === 0) return <EmptyBank />;

    const readyNow = summary.cards.filter(isReady);
    const outstanding = summary.cards.filter((c) => fixState(c, attempts) !== "fixed");

    return (
        <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
            <PreSit open={!!pendingRedo} quiz={pendingRedo} attempts={attempts}
                onCancel={() => setPendingRedo(null)}
                onStart={({ mode, timeLimitMs }) => {
                    setRedoing({ quiz: pendingRedo, mode, timeLimitMs });
                    setPendingRedo(null);
                }} />

            {/* ── THE HEADLINE, AND THE PILE UNDER IT ────────────────────────
                What has gone RIGHT, as a fraction so it cannot flatter, over
                one slot per mistake. */}
            <header className="space-y-3">
                <div>
                    <p className="stat-label text-muted-foreground">Mistake bank</p>
                    {/* An EMPTY PILE is not "0 of 0". The page used to show
                        its empty state whenever the working pile was empty —
                        which also hid Sit again from a student with questions
                        to re-sit and nothing banked, and threw away a record
                        of everything they had cleared. */}
                    <h1 className="text-2xl sm:text-3xl font-display font-black text-foreground leading-tight">
                        {summary.total === 0
                            ? (summary.clearedCount > 0
                                ? <>All <span className="text-primary tabular-nums">{summary.clearedCount}</span> fixed and cleared out.</>
                                : "Nothing banked to drill.")
                            : <>You have fixed <span className="text-primary tabular-nums">{summary.fixed}</span> of{" "}
                                <span className="tabular-nums">{summary.total}</span>.</>}
                    </h1>
                    {summary.total > 0 && <p className="text-sm text-muted-foreground mt-1">
                        {summary.outstanding === 0
                            ? "Nothing outstanding. Every mistake you have saved is holding."
                            : `${summary.outstanding} still to nail down.`}
                        {summary.clearedCount > 0 && (
                            <> <span className="text-primary font-bold">{summary.clearedCount} cleared out</span> for good.</>
                        )}
                    </p>}
                </div>
                <BankPile pile={pile} />
            </header>

            {/* TWO KINDS OF WORK, AND THEY ARE NOT THE SAME SIZE. A dropped
                criterion is drilled in thirty seconds; a whole question is a
                SIT. Fix is the drilling; Sit again is the proving. */}
            <div role="tablist" className="inline-flex rounded-2xl bg-surface border-2 border-border shadow-soft p-1.5 gap-1">
                {[["fix", "Fix", Bookmark, summary.outstanding],
                  ["redo", "Sit again", RotateCcw, redo.length]].map(([k, label, Icon, n]) => (
                    <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                        className={`flex items-center gap-1.5 py-2 px-3.5 rounded-xl text-sm font-bold transition-colors ${
                            tab === k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
                        <Icon className="w-3.5 h-3.5" /> {label}
                        {n > 0 && <span className="tabular-nums opacity-70">{n}</span>}
                    </button>
                ))}
            </div>

            {tab === "redo" ? (
                <RedoTab groups={redoByQuiz} cases={cases} onSit={startRedo} />
            ) : (
            <>
                {/* ── ONE BUTTON ─────────────────────────────────────────────
                    There were four ways to start a review: Review N now, Drill
                    all N, a button per subject and one per topic. One plays
                    what is ready; the bands below each play their own. */}
                {summary.total > 0 && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2" data-bank-actions>
                        <Button onClick={() => drill(readyNow, "Drilling what's ready")} disabled={!readyNow.length} data-drill-ready
                            className="btn-3d bg-primary hover:bg-primary text-primary-foreground rounded-xl gap-2">
                            <Play className="w-4 h-4" />
                            {readyNow.length ? `Drill the ${readyNow.length} ready` : "Nothing ready today"}
                        </Button>
                        {outstanding.length > readyNow.length && (
                            <button type="button" onClick={() => drill(outstanding, "Drilling every open mistake")} data-drill-all
                                className="text-sm font-bold text-muted-foreground hover:text-foreground underline underline-offset-4">
                                or drill all {outstanding.length} still open
                            </button>
                        )}
                    </div>
                )}

                {/* ── THE BANDS ─────────────────────────────────────────────── */}
                <div className="space-y-7">
                    {bands.map((band) => (
                        <BankBand key={band.subject} band={band} attempts={attempts}
                            onDrill={(list) => drill(list, `Drilling ${band.subject}`)} onClear={clearFixed} />
                    ))}
                </div>

                {/* The verb, under the criteria — a diagnosis, drawn only when
                    there is one. */}
                <CommandTermPanel attempts={attempts} />

                {/* CLEARED, AND STILL THERE. Collapsed: a record, not work. */}
                {summary.clearedCount > 0 && (
                    <details className="rounded-2xl border-2 border-border bg-surface overflow-hidden" data-cleared>
                        <summary className="px-3.5 py-3 cursor-pointer text-sm font-bold text-foreground flex items-center gap-2">
                            <Check className="w-4 h-4 text-primary" />
                            {summary.clearedCount} cleared out
                            <span className="text-[11px] font-normal text-muted-foreground">— kept, not deleted</span>
                        </summary>
                        <ul className="border-t border-border/60 divide-y divide-border/60">
                            {summary.cleared.map((c) => (
                                <li key={c.id} className="flex items-center gap-3 px-3.5 py-2">
                                    <div className="flex-1 min-w-0">
                                        <QuestionPanel label="" tone="plain" textClass="text-xs text-muted-foreground leading-snug">
                                            {mistakeMeta(c).criterion || c.question}
                                        </QuestionPanel>
                                    </div>
                                    <button type="button" onClick={() => restore([c])}
                                        className="pill border-2 border-border text-[10px] text-muted-foreground
                                            hover:text-foreground hover:border-foreground/40 flex-shrink-0">
                                        Put it back
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </details>
                )}

                {/* THIS SAID THEY "ALSO SHOW UP IN SPACED REPETITION". They do
                    not: `deckCards` takes the bank out of every deck surface,
                    on purpose, so a mistake is not a flashcard. */}
                <p className="text-[11px] text-muted-foreground leading-snug" data-bank-footer>
                    These come back on their own schedule, here and in your review queue, apart from your flashcard
                    decks. Fixed means you can recall it <span className="font-bold">and</span> you earned it again on
                    the question you dropped it in.
                </p>
            </>
            )}
        </div>
    );
}

/**
 * The re-sit list.
 *
 * ─── Why a question is not a card ───────────────────────────────────────────
 * Everything on the Fix tab is small enough to rehearse: a criterion, a phrase,
 * a wording. This tab is the other size of mistake, and it gets the other kind
 * of treatment — you do not drill a whole exam question, you sit it. Nothing
 * here is stored: which questions need re-sitting is a fact about the attempt
 * history, so it cannot go stale and cannot disagree with the marks it came
 * from.
 *
 * ─── Both halves of "why" are shown ─────────────────────────────────────────
 * A question is here because you have missed it more than once, or because you
 * are carrying banked mistakes on it that have never been earned back. The
 * second is the one that closes the loop: the drill ladder ends at "sit it
 * again", and this is where that happens.
 */
export function RedoTab({ groups, cases, onSit }) {
    const closed = cases.filter((c) => c.closed);

    if (!groups.length) {
        return (
            <div className="card-soft border-2 border-border p-6 text-center">
                {/* Proud when the tab is empty BECAUSE questions were closed out
                    for full marks; thinking when there was simply nothing. */}
                <AceSpot pose={closed.length > 0 ? "proud" : "think"} className="w-20 h-20 mx-auto" />
                <p className="text-sm font-bold text-foreground mt-2">Nothing to sit again.</p>
                <p className="text-xs text-muted-foreground leading-snug mt-1 max-w-sm mx-auto">
                    A question lands here when you have missed it more than once, or when you are
                    carrying marks from it that you have not earned back yet.
                </p>
                {closed.length > 0 && (
                    <p className="text-[11px] text-primary font-bold mt-3">
                        {closed.length} question{closed.length === 1 ? "" : "s"} closed out for full marks.
                    </p>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <p className="text-sm text-muted-foreground leading-snug">
                Sitting the question again is the last step. A mistake counts as fixed when you can
                recall it <span className="font-bold text-foreground">and</span> you earn it back
                here; the question is done with when the whole thing comes out at full marks.
            </p>

            {groups.map((g) => (
                <div key={g.quiz?.id || g.title} className="card-soft border-2 border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-sm font-black text-foreground truncate">{g.title}</p>
                            <p className="text-[11px] text-muted-foreground">
                                {g.subject ? `${g.subject} · ` : ""}
                                {g.rows.length} question{g.rows.length === 1 ? "" : "s"} to sit again
                            </p>
                        </div>
                        <Button size="sm" onClick={() => onSit(g)}
                            className="btn-3d bg-primary hover:bg-primary text-primary-foreground rounded-xl gap-1.5 flex-shrink-0">
                            <Play className="w-3.5 h-3.5" /> Sit {g.rows.length}
                        </Button>
                    </div>

                    <ul className="space-y-2 mt-3">
                        {g.rows.map((r) => (
                            <li key={r.key} className="rounded-xl border border-border p-2.5">
                                {/* NOT `line-clamp-2`. This is the list a
                                    student decides from — "do I need to sit
                                    this again" is a judgement about the whole
                                    question, and two lines of a four-mark stem
                                    is the half that carries no command term. */}
                                <QuestionPanel label="" tone="plain"
                                    textClass="text-xs font-bold text-foreground leading-snug">
                                    {r.question.question}
                                </QuestionPanel>
                                <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground mt-1">
                                    {r.reasons.map((why, i) => (
                                        <span key={i} className="inline-flex items-center gap-1">
                                            {why.kind === "missed"
                                                ? <><X className="w-3 h-3 text-streak" />missed {why.missed} of {why.seen}</>
                                                : <><Bookmark className="w-3 h-3 text-chart-3" />{why.count} banked mark{why.count === 1 ? "" : "s"} to earn back</>}
                                        </span>
                                    ))}
                                </p>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}

            {closed.length > 0 && (
                <p className="text-[11px] text-primary font-bold flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    {closed.length} question{closed.length === 1 ? "" : "s"} already closed out for full marks.
                </p>
            )}
        </div>
    );
}
