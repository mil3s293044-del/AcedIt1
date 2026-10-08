/**
 * The four feature tabs of the Progress report.
 *
 * ─── EACH ONE ANSWERS ABOUT ONE FEATURE, AND LINKS INTO IT ──────────────────
 * The page before this put every number the app knows in one column. Grouping
 * them by FEATURE is what makes them legible: a student who has just spent
 * twenty minutes on flashcards knows which tab is about to tell them something,
 * and every panel ends in the door to the screen that moves it. A bar with no
 * way through is a diagnosis, which is Ranked's own lesson about its ATAR
 * components.
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
import ReportHead from "@/components/progress/ReportHead";
import BarList from "@/components/progress/BarList";
import Panel from "@/components/progress/Panel";
import { verdictFor, hhmm } from "@/lib/progressReport";
import MemoryPanel from "@/components/analytics/MemoryPanel";
import AttentionPanel from "@/components/analytics/AttentionPanel";
import CognitiveProfilePanel from "@/components/analytics/CognitiveProfilePanel";
import WeakTopicsPanel from "@/components/analytics/WeakTopicsPanel";
import SubjectSplit from "@/components/analytics/SubjectSplit";

/** The way through, in the gutter rather than inside a panel's heading row. */
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

// ─── CARDS ──────────────────────────────────────────────────────────────────

export function CardsTab({ report, range, cards, techniques }) {
    if (!report?.total) {
        return <Nothing line="Nothing here until you have some flashcards. Once you do, this is where their recall, the pile and what is slipping are reported."
            to={createPageUrl("Study") + "?tab=spaced"} cta="Make some cards" />;
    }

    const stats = [
        { label: "Cards you own", value: report.total.toLocaleString() },
        report.accuracy != null
            ? { label: "Recall accuracy", value: `${report.accuracy}%`, hint: `over ${report.ratings.toLocaleString()} ratings, all time` }
            : null,
        report.slipping > 0 ? { label: "Slipping", value: report.slipping, hint: "past reliable recall" } : null,
    ].filter(Boolean);

    return (
        <div className="space-y-4">
            <ReportHead
                value={report.reviewed.toLocaleString()} label={`Cards reviewed ${range.blurb}`}
                delta={report.delta}
                note={range.comparable ? null : "All-time has no period before it to compare against."}
                verdict={verdictFor(report, range)} stats={stats}
                action={<Door to={createPageUrl("Study") + "?tab=spaced"}>Review now</Door>}
            />

            <div className="grid gap-4 xl:grid-cols-2 items-start">
                <Panel title="How strong your deck is"
                    note="Every card placed by its own recall record — the four bands are where the work is, which an average cannot say.">
                    <BarList rows={report.bands.map((b) => ({
                        key: b.id, label: b.label, value: b.n,
                        display: `${b.n} ${b.n === 1 ? "card" : "cards"}`,
                        tone: b.id === "strong" ? "bg-primary" : b.id === "fair" ? "bg-chart-3"
                            : b.id === "weak" ? "bg-xp" : "bg-muted-foreground/40",
                    }))} />
                </Panel>
                <MemoryPanel techniques={techniques} cards={cards} />
            </div>

            <WeakTopicsPanel flashcards={cards} />
        </div>
    );
}

// ─── QUIZZES ────────────────────────────────────────────────────────────────

export function QuizzesTab({ report, range }) {
    if (!report?.sits) {
        return <Nothing line={`No sits ${range.blurb}. This reports your average against the period before it, which subjects are carrying it, and the command terms costing you marks.`}
            to={createPageUrl("Quizzes")} cta="Sit a quiz" />;
    }

    const stats = [
        { label: "Sits", value: report.sits },
        report.best != null ? { label: "Best", value: `${report.best}%` } : null,
        report.prevAvg != null && range.comparable
            ? { label: "Period before", value: `${report.prevAvg}%`, hint: `${report.prevSits} ${report.prevSits === 1 ? "sit" : "sits"}` }
            : null,
    ].filter(Boolean);

    return (
        <div className="space-y-4">
            <ReportHead
                value={report.avg} suffix="%" label={`Average ${range.blurb}`}
                delta={report.delta} deltaSuffix=" pts"
                note={!range.comparable
                    ? "All-time has no period before it to compare against."
                    : report.need > 0
                        ? `${report.need} more ${report.need === 1 ? "sit" : "sits"} and this compares you against the period before.`
                        : "Not enough sits in the period before this one to compare against yet."}
                verdict={verdictFor(report, range)} stats={stats}
                action={<Door to={createPageUrl("Quizzes")}>Sit another</Door>}
            />

            <div className="grid gap-4 xl:grid-cols-2 items-start">
                {report.subjects.length > 0 && (
                    <Panel title="By subject" note="Weakest first. The average is of marks earned, so a four-mark part counts double a two.">
                        <BarList rows={report.subjects.map((s) => ({
                            key: s.subject, label: s.subject, value: s.avg,
                            display: `${s.avg}% · ${s.sits} ${s.sits === 1 ? "sit" : "sits"}`,
                            tone: s.avg >= 75 ? "bg-primary" : s.avg >= 50 ? "bg-chart-3" : "bg-streak",
                        }))} max={100} />
                    </Panel>
                )}

                {/* THE COMMAND TERMS, finally drawn. `commandTermStats` has been
                    in the repo for months and only the MARKER had ever been
                    shown them — "collect nothing you don't use" inverted, on the
                    most examiner-like statistic this app can produce. */}
                {report.terms.length > 0 && (
                    <Panel title="Command terms"
                        note="What the question asked you to DO, and how you scored on each. This is where marks go that have nothing to do with knowing the content."
                        action={<Link to={createPageUrl("AITools") + "?tool=command_term"}
                            className="text-xs font-bold text-primary hover:underline whitespace-nowrap">Work on these</Link>}>
                        <BarList rows={report.terms.map((t) => ({
                            key: t.id, label: t.label, value: t.pct,
                            display: `${Math.round(t.pct)}%`,
                            tone: t.pct >= 75 ? "bg-primary" : t.pct >= 50 ? "bg-chart-3" : "bg-streak",
                        }))} max={100} />
                    </Panel>
                )}
            </div>
        </div>
    );
}

// ─── MISTAKES ───────────────────────────────────────────────────────────────

export function MistakesTab({ report, range }) {
    if (!report?.total) {
        return <Nothing line="Nothing banked yet. Every mark a quiz takes off you can be saved from the marking panel, and this reports how many of them you have actually fixed."
            to={createPageUrl("Quizzes")} cta="Sit a quiz" />;
    }

    const pct = report.total ? Math.round((report.fixed / report.total) * 100) : 0;
    const stats = [
        { label: "Ready to drill", value: report.ready, hint: "due or never opened" },
        { label: "Drilled", value: report.drilled, hint: range.blurb },
        { label: "Newly banked", value: report.banked, hint: range.blurb },
    ];

    return (
        <div className="space-y-4">
            {/* NO DELTA ON THIS HEADLINE, and that is a correctness call rather
                than a gap. Nothing records WHEN a mistake became fixed — the
                state is derived from the ladder and a later sit — so the only
                period figure available is how many were DRILLED, and a "+3"
                chip beside "0/9 fixed" says three more are fixed. A movement
                chip that describes a different number from the one it sits on
                is worse than no chip. Drilled is a stat, where it is labelled. */}
            <ReportHead
                value={`${report.fixed}/${report.total}`} label="Mistakes fixed"
                delta={null} note={null}
                verdict={verdictFor(report, range)} stats={stats}
                action={<Door to={createPageUrl("MistakeBank")}>Drill them</Door>}
            />

            <div className="grid gap-4 xl:grid-cols-2 items-start">
                <Panel title="Where each one is"
                    note="Fixed means the ladder is cleared AND a later sit earned that criterion back. Rehearsal on its own is drilled, not fixed.">
                    <BarList rows={report.states.map((s) => ({
                        key: s.state, label: STATE_LABEL[s.state] || s.state, value: s.n,
                        display: `${s.n}`,
                        tone: STATE_TONE[s.state] || "bg-muted-foreground/40",
                    }))} />
                    <p className="mt-3.5 text-xs text-muted-foreground">{pct}% of what you have banked is fixed.</p>
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

// ─── HOURS ──────────────────────────────────────────────────────────────────

export function HoursTab({ report, range, events, quizzes, attempts, cards, sessions, techniques, today }) {
    if (!report?.minutes) {
        return <Nothing line={`Nothing logged ${range.blurb}. Both study tables feed this — every technique on the Study page and every quiz you sit.`}
            to={createPageUrl("Study")} cta="Start a session" />;
    }

    const stats = [
        { label: "Days active", value: report.activeDays, hint: range.span ? `of ${range.span}` : null },
        report.perActiveDay ? { label: "Per active day", value: hhmm(report.perActiveDay) } : null,
        report.prevMinutes != null && range.comparable
            ? { label: "Period before", value: hhmm(report.prevMinutes) || "0m" } : null,
    ].filter(Boolean);

    const peak = report.bars.length ? Math.max(...report.bars.map((b) => b.minutes), 1) : 1;

    return (
        <div className="space-y-4">
            <ReportHead
                value={hhmm(report.minutes) || "0m"} label={`Studied ${range.blurb}`}
                delta={report.delta} deltaDisplay={hhmm(Math.abs(report.delta?.value || 0)) || "0m"}
                note={!range.comparable
                    ? "All-time has no period before it to compare against."
                    : "One more day logged and this compares you against the period before."}
                verdict={verdictFor(report, range)} stats={stats}
                action={<Door to={createPageUrl("Study")}>Start a session</Door>}
            />

            {/* EVERY MINUTE HERE IS A COUNTABLE ONE. `countableByDay` is the same
                cap the league and the ATAR's effort component apply, so this
                page cannot read higher than every board in the app. */}
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

            <div className="grid gap-4 xl:grid-cols-2 items-start">
                {report.techniques.length > 0 && (
                    <Panel title="Which techniques" note="Where the time actually went, by what you ran on the Study page.">
                        <BarList rows={report.techniques.map((t) => ({
                            key: t.name, label: t.name, value: t.minutes,
                            display: hhmm(t.minutes) || "—", tone: "bg-chart-3",
                        }))} />
                    </Panel>
                )}
                <AttentionPanel techniques={techniques} sessions={sessions} />
            </div>

            <SubjectSplit events={events} quizzes={quizzes} attempts={attempts} cards={cards} today={today} />
            <CognitiveProfilePanel techniques={techniques} cards={cards} sessions={sessions} />
        </div>
    );
}
