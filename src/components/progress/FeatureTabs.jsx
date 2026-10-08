/**
 * The four feature tabs of the Progress report.
 *
 * ─── ACT, THEN READ. THAT ORDER IS THE WHOLE REWORK ─────────────────────────
 * Every tab used to open with a 252px figure and carry its one action in the
 * top-right corner as a small outlined button. So the thing a student can DO
 * was the smallest element on a screen of numbers about what they had already
 * done — and on CARDS, the tab about flashcards, the review itself was that
 * corner button plus a fold 1,491 measured pixels further down.
 *
 * Each tab now leads with ITS OWN outstanding rows out of the one queue the
 * Today tab draws (`workFor`), with the button on the row; the figure follows
 * as a compact strip; the panels follow that; and the methodology half is
 * behind one named fold.
 *
 * ─── EVERY BAR IS A DOOR, WHERE THE DESTINATION IS EXACT ────────────────────
 * A bar with no way through is a diagnosis, which is Ranked's own lesson about
 * its ATAR components. A subject row opens that subject's hub, a command term
 * seeds that term's tool, a technique row opens THAT technique on /Study. Rows
 * with no exact destination — the deck's strength bands, the mistake states —
 * stay flat rather than pointing somewhere approximate, which is the
 * refuse-rather-than-guess rule and not an omission.
 *
 * ─── AND NOTHING HERE IS A SECOND COPY OF A FEATURE SCREEN ──────────────────
 * /MistakeBank is the drilling, /Quizzes is the shelf, /Study is the session.
 * These tabs are the TREND and the VERDICT over a window — the thing none of
 * those screens can show, because each of them is about right now.
 */
import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Inbox } from "lucide-react";
import { createPageUrl } from "@/utils";
import ReportStrip from "@/components/progress/ReportStrip";
import FeatureWork from "@/components/progress/FeatureWork";
import MoreDetail from "@/components/progress/MoreDetail";
import BarList from "@/components/progress/BarList";
import Panel from "@/components/progress/Panel";
import { verdictFor, hhmm } from "@/lib/progressReport";
import { toolQuery } from "@/lib/toolBrief";
import MemoryPanel from "@/components/analytics/MemoryPanel";
import AttentionPanel from "@/components/analytics/AttentionPanel";
import WeakTopicsPanel from "@/components/analytics/WeakTopicsPanel";
import SubjectSplit from "@/components/analytics/SubjectSplit";

/** The way through, for a tab with no outstanding work to lead with. */
function Door({ to, children }) {
    return (
        <Link to={to}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-foreground
                border-2 border-border rounded-xl px-3 py-2 hover:border-foreground/40
                hover:bg-secondary transition-colors whitespace-nowrap">
            {children}<ArrowRight className="w-3.5 h-3.5" />
        </Link>
    );
}

/**
 * A tab with nothing in it SAYS WHAT WOULD FILL IT.
 *
 * Hiding the tab instead would change the shape of the bar between visits, so a
 * student who has never sat a quiz would find a tab appear where a different
 * one used to be. An empty tab that names the one thing that fills it is a
 * smaller cost and it is a real answer.
 */
function Nothing({ line, to, cta }) {
    return (
        <div className="card-soft on-table p-10 text-center">
            <Inbox className="w-9 h-9 text-muted-foreground/40 mx-auto mb-3" aria-hidden="true" />
            <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-snug">{line}</p>
            {to && <div className="mt-4 flex justify-center"><Door to={to}>{cta}</Door></div>}
        </div>
    );
}

/**
 * TWO COLUMNS FROM `lg`, NOT `xl`.
 *
 * Tailwind breakpoints are VIEWPORT-based and the page is `max-w-5xl`, so at
 * `xl` (1280) a 1100px laptop fell to one column inside a 1024px container —
 * which drew a bar a thousand pixels wide to say "7 cards". At `lg` (1024) the
 * container is already at its measure, so the split fires exactly when there
 * is room for it. The same viewport-is-not-element trap `WeekPace` records.
 */
const SPLIT = "grid gap-4 lg:grid-cols-2 items-start";

const studyTab = (id) => `${createPageUrl("Study")}?tab=${id}`;
const subjectHub = (subject) => `${createPageUrl("SubjectHub")}?subject=${encodeURIComponent(subject)}`;

// ─── CARDS ──────────────────────────────────────────────────────────────────

export function CardsTab({ report, range, cards, techniques, work = [], pile = null, audit = null }) {
    if (!report?.total) {
        return <Nothing line="Nothing here until you have some flashcards. Once you do, this is where their recall, the pile and what is slipping are reported."
            to={studyTab("spaced_repetition")} cta="Make some cards" />;
    }

    const stats = [
        { label: "cards you own", value: report.total.toLocaleString() },
        report.accuracy != null
            ? { label: "recall accuracy", value: `${report.accuracy}%`, hint: `${report.ratings.toLocaleString()} ratings, all time` }
            : null,
        report.slipping > 0 ? { label: "slipping", value: report.slipping, hint: "past reliable recall" } : null,
    ].filter(Boolean);

    return (
        <div className="space-y-4">
            <FeatureWork items={work} />
            <ReportStrip
                value={report.reviewed.toLocaleString()} label={`cards reviewed ${range.blurb}`}
                delta={report.delta} series={report.series}
                note={range.comparable ? null : "All-time has no period before it to compare against."}
                verdict={verdictFor(report, range)} stats={stats}
                action={work.length ? null : <Door to={studyTab("spaced_repetition")}>Review now</Door>}
            />

            {/* TWO CUTS OF ONE DECK, SIDE BY SIDE. How strong the cards are,
                against how many are asking — complementary, so the strength
                bands stop being four rows drawn a thousand pixels wide. */}
            <div className={SPLIT}>
                {/* These rows are deliberately NOT doors: there is no review
                    session filtered to one band, and sending somebody to the
                    whole deck under a row reading "7 cards" is the half-wired
                    shape this app keeps meeting. The reasoning is a comment
                    rather than copy — a student does not need to be told what
                    a panel decided not to do. */}
                <Panel title="How strong your deck is"
                    note="Every card placed by its own recall record — the four bands are where the work is, which an average cannot say.">
                    <BarList rows={report.bands.map((b) => ({
                        key: b.id, label: b.label, value: b.n,
                        display: `${b.n} ${b.n === 1 ? "card" : "cards"}`,
                        tone: b.id === "strong" ? "bg-primary" : b.id === "fair" ? "bg-chart-3"
                            : b.id === "weak" ? "bg-xp" : "bg-muted-foreground/40",
                    }))} />
                </Panel>
                {pile}
            </div>

            <WeakTopicsPanel flashcards={cards} />

            <MoreDetail label="How it is holding, and every pile">
                <MemoryPanel techniques={techniques} cards={cards} />
                {audit}
            </MoreDetail>
        </div>
    );
}

// ─── QUIZZES ────────────────────────────────────────────────────────────────

export function QuizzesTab({ report, range, work = [] }) {
    if (!report?.sits) {
        return <Nothing line={`No sits ${range.blurb}. This reports your average against the period before it, which subjects are carrying it, and the command terms costing you marks.`}
            to={createPageUrl("Quizzes")} cta="Sit a quiz" />;
    }

    const stats = [
        { label: report.sits === 1 ? "sit" : "sits", value: report.sits },
        report.best != null ? { label: "best", value: `${report.best}%` } : null,
        report.prevAvg != null && range.comparable
            ? { label: "the period before", value: `${report.prevAvg}%`, hint: `${report.prevSits} ${report.prevSits === 1 ? "sit" : "sits"}` }
            : null,
    ].filter(Boolean);

    return (
        <div className="space-y-4">
            <FeatureWork items={work} />
            <ReportStrip
                value={report.avg} suffix="%" label={`average ${range.blurb}`}
                delta={report.delta} deltaSuffix=" pts"
                series={report.series} percent tone="chart-3"
                note={!range.comparable
                    ? "All-time has no period before it to compare against."
                    : report.need > 0
                        ? `${report.need} more ${report.need === 1 ? "sit" : "sits"} and this compares you against the period before.`
                        : "Not enough sits in the period before this one to compare against yet."}
                verdict={verdictFor(report, range)} stats={stats}
                action={work.length ? null : <Door to={createPageUrl("Quizzes")}>Sit another</Door>}
            />

            <div className={SPLIT}>
                {report.subjects.length > 0 && (
                    <Panel title="By subject" note="Weakest first, and every row opens that subject. The average is of marks earned, so a four-mark part counts double a two.">
                        <BarList rows={report.subjects.map((s) => ({
                            key: s.subject, label: s.subject, value: s.avg,
                            display: `${s.avg}% · ${s.sits} ${s.sits === 1 ? "sit" : "sits"}`,
                            to: subjectHub(s.subject),
                            tone: s.avg >= 75 ? "bg-primary" : s.avg >= 50 ? "bg-chart-3" : "bg-streak",
                        }))} max={100} />
                    </Panel>
                )}

                {/* THE COMMAND TERMS, finally drawn AND finally pressable.
                    `commandTermStats` sat in the repo for months with only the
                    MARKER ever shown them; then they were drawn as flat text
                    beside one shared "Work on these" link, so a student reading
                    "Evaluate 71%" still had to work out what to do about that
                    term specifically. Each row seeds the command-term tool with
                    its OWN term through `toolQuery`, which is the builder every
                    other screen hands a problem over with. */}
                {report.terms.length > 0 && (
                    <Panel title="Command terms"
                        note="What the question asked you to DO, and how you scored on each. Tap one to work on that term. This is where marks go that have nothing to do with knowing the content.">
                        <BarList rows={report.terms.map((t) => ({
                            key: t.id, label: t.label, value: t.pct,
                            display: `${Math.round(t.pct)}%`,
                            to: `${createPageUrl("AITools")}?${toolQuery({
                                tool: "command_term",
                                seed: `I keep losing marks on "${t.label}" questions — I am scoring about ${Math.round(t.pct)}% on them. What does a full-mark answer to that command term look like, and how do I spot when a question is asking for it?`,
                            })}`,
                            tone: t.pct >= 75 ? "bg-primary" : t.pct >= 50 ? "bg-chart-3" : "bg-streak",
                        }))} max={100} />
                    </Panel>
                )}
            </div>
        </div>
    );
}

// ─── MISTAKES ───────────────────────────────────────────────────────────────

export function MistakesTab({ report, range, work = [] }) {
    if (!report?.total) {
        return <Nothing line="Nothing banked yet. Every mark a quiz takes off you can be saved from the marking panel, and this reports how many of them you have actually fixed."
            to={createPageUrl("Quizzes")} cta="Sit a quiz" />;
    }

    const pct = report.total ? Math.round((report.fixed / report.total) * 100) : 0;
    const stats = [
        { label: "ready to drill", value: report.ready, hint: "due or never opened" },
        { label: `drilled ${range.blurb}`, value: report.drilled },
        { label: `newly banked ${range.blurb}`, value: report.banked },
    ];

    return (
        <div className="space-y-4">
            <FeatureWork items={work} />
            {/* NO DELTA AND NO LINE ON THIS HEADLINE, and both are correctness
                calls rather than gaps. Nothing records WHEN a mistake became
                fixed — the state is derived from the ladder and a later sit —
                so there is no series to plot and the only period figure
                available is how many were DRILLED. A "+3" chip beside "0/9
                fixed" says three more are fixed, and a rising line under it
                would say the same thing louder. A movement signal that
                describes a different number from the one it sits on is worse
                than none. Drilled is a stat, where it is labelled. */}
            <ReportStrip
                value={`${report.fixed}/${report.total}`} label="mistakes fixed"
                delta={null} note={null}
                verdict={verdictFor(report, range)} stats={stats}
                action={work.length ? null : <Door to={createPageUrl("MistakeBank")}>Drill them</Door>}
            />

            <div className={SPLIT}>
                <Panel title="Where each one is"
                    note="Fixed means the ladder is cleared AND a later sit earned that criterion back. Rehearsal on its own is drilled, not fixed.">
                    <BarList rows={report.states.map((s) => ({
                        key: s.state, label: STATE_LABEL[s.state] || s.state, value: s.n,
                        display: `${s.n}`,
                        tone: STATE_TONE[s.state] || "bg-muted-foreground/40",
                    }))} />
                    <p className="mt-3 px-2 text-xs text-muted-foreground">{pct}% of what you have banked is fixed.</p>
                </Panel>

                {report.repeats.length > 0 && (
                    <Panel title="Dropped more than once"
                        note="One criterion costing you repeatedly is ONE thing to fix, not four — which is the whole reason this is called out separately.">
                        <BarList rows={report.repeats.map((r) => ({
                            key: r.criterion, label: r.criterion, value: r.count,
                            display: `${r.count}×`, tone: "bg-chart-4",
                        }))} />
                    </Panel>
                )}
            </div>
        </div>
    );
}

const WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"];

const STATE_LABEL = {
    fixed: "Fixed", drilled: "Rehearsed, not re-sat", working: "Working on it",
    new: "Not started", slipping: "Slipping back",
};
const STATE_TONE = {
    fixed: "bg-primary", drilled: "bg-chart-3", working: "bg-xp",
    new: "bg-muted-foreground/40", slipping: "bg-streak",
};

/** Study's own technique ids, so a technique row opens THAT technique. */
const TECHNIQUE_ID = {
    "Pomodoro": "pomodoro",
    "Spaced Repetition": "spaced_repetition",
    "Active Recall": "active_recall",
    "Blurting": "blurting",
    "Revision Mode": "exam",
    "Mind Maps": "mind_map",
};

// ─── HOURS ──────────────────────────────────────────────────────────────────

export function HoursTab({ report, range, events, quizzes, attempts, cards, techniques, today }) {
    if (!report?.minutes) {
        return <Nothing line={`Nothing logged ${range.blurb}. Both study tables feed this — every technique on the Study page and every quiz you sit.`}
            to={createPageUrl("Study")} cta="Start a session" />;
    }

    const stats = [
        { label: `days active${range.span ? ` of ${range.span}` : ""}`, value: report.activeDays },
        report.perActiveDay ? { label: "per active day", value: hhmm(report.perActiveDay) } : null,
        report.prevMinutes != null && range.comparable
            ? { label: "the period before", value: hhmm(report.prevMinutes) || "0m" } : null,
    ].filter(Boolean);

    const peak = report.bars.length ? Math.max(...report.bars.map((b) => b.minutes), 1) : 1;

    return (
        <div className="space-y-4">
            {/* NO ACTION ROWS HERE, and that is honest rather than a gap. There
                is no such thing as an overdue hour — nothing in `studyQueue` is
                about time — so this tab leads with its figure and a door, and
                `TAB_KINDS.hours` is deliberately empty. Inventing a row to make
                the four tabs symmetrical is the padding every builder in
                `studyQueue.js` already refuses. */}
            <ReportStrip
                value={hhmm(report.minutes) || "0m"} label={`studied ${range.blurb}`}
                delta={report.delta} deltaDisplay={hhmm(Math.abs(report.delta?.value || 0)) || "0m"}
                series={report.series}
                note={!range.comparable
                    ? "All-time has no period before it to compare against."
                    : "One more day logged and this compares you against the period before."}
                verdict={verdictFor(report, range)} stats={stats}
                action={<Door to={createPageUrl("Study")}>Start a session</Door>}
            />

            <div className={SPLIT}>
                {/* EVERY MINUTE HERE IS A COUNTABLE ONE. `countableByDay` is the
                    same cap the league and the ATAR's effort component apply, so
                    this page cannot read higher than every board in the app. */}
                {report.bars.length > 1 && (
                    <Panel title="Day by day" note="Capped the way every ranked board caps them, so this figure is the one the league counts.">
                        <div className="flex items-end gap-1 h-24">
                            {report.bars.map((b) => (
                                <div key={b.day} className="flex-1 min-w-0 flex flex-col justify-end h-full"
                                    title={`${b.day} · ${hhmm(b.minutes) || "nothing"}`}>
                                    <div className={`rounded-sm ${b.minutes ? "bg-primary" : "bg-muted"}`}
                                        style={{ height: `${b.minutes ? Math.max(6, (b.minutes / peak) * 100) : 4}%` }} />
                                </div>
                            ))}
                        </div>
                        {/* A BAR WITH NO DAY UNDER IT IS A BLOCK. Four of them across a
                            panel reads as decoration rather than as a week — but
                            twenty-eight initials do not fit, so the labels appear only
                            while they can be read. */}
                        {report.bars.length <= 10 && (
                            <div className="flex gap-1 mt-1.5">
                                {report.bars.map((b) => (
                                    <span key={b.day} className="flex-1 min-w-0 text-center text-[10px]
                                        text-muted-foreground tabular-nums">
                                        {WEEKDAY[new Date(`${b.day}T00:00:00`).getDay()]}
                                    </span>
                                ))}
                            </div>
                        )}
                    </Panel>
                )}

                {report.techniques.length > 0 && (
                    <Panel title="Which techniques" note="Where the time actually went. Every row opens that technique on the Study page.">
                        <BarList rows={report.techniques.map((t) => ({
                            key: t.name, label: t.name, value: t.minutes,
                            display: hhmm(t.minutes) || "—",
                            to: TECHNIQUE_ID[t.name] ? studyTab(TECHNIQUE_ID[t.name]) : null,
                            tone: "bg-chart-3",
                        }))} />
                    </Panel>
                )}
            </div>

            <SubjectSplit events={events} quizzes={quizzes} attempts={attempts} cards={cards} today={today} />

            <MoreDetail label="When the hours land">
                <AttentionPanel techniques={techniques} />
            </MoreDetail>
        </div>
    );
}
