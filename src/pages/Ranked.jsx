/**
 * Ranked — one page, three eras.
 *
 * ─── THE SPLIT IS TIME, and that is what finally made this page readable ────
 * It carried an always-on ATAR hero — the dial, the five components, the rank
 * tiles — ABOVE the tab bar, so a student heading for the weekly league
 * scrolled past a 230px gauge of a trailing-28-day score to get there, and the
 * profile tab opened under the same gauge. One number owning the top of every
 * tab, including the two tabs it has nothing to do with.
 *
 * Everything on this page answers "where do I stand", and the only real
 * difference between the answers is the WINDOW:
 *
 *   My rank   — the AcedIt ATAR, trailing 28 days. The score, the five
 *               components with the door that moves each one, the board of
 *               everyone else's, and the ladder you have climbed. Everything
 *               ATAR and everything rank, in one place and nowhere else.
 *   League    — this week. The real `/League` page, embedded.
 *   All time  — XP and hours. Lifetime totals, which are a different claim
 *               from a 28-day average and were sharing a chip row with it.
 *
 * `BOARDS` carries an `era` for exactly this, in `ranked.js`, so which board
 * sits on which tab is a fact about the board rather than two hard-coded
 * arrays that can disagree about where the ATAR lives.
 *
 * ─── Each board is one view, built once ─────────────────────────────────────
 * `useBoardView` is the scoped, sorted field plus everything derived from it —
 * the visible rows, the titles, the standing and the movement. One source for
 * the list and the maths, so a rank can never disagree with the row it came
 * from, and the two board tabs cannot arrive at it differently.
 *
 * The one number the whole ladder is standardised around is still trailing
 * 28-day study quality, 0-99.95, and still not a VCAA prediction. The UI keeps
 * saying so.
 */
import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
    GraduationCap, Trophy, Info, Target, TrendingUp, Users, ArrowRight,
    Swords, History,
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import HelpButton from "@/components/shared/HelpButton";
import MyProfile from "@/components/ranked/MyProfile";
import AtarDial from "@/components/ranked/AtarDial";
import RankedBoard from "@/components/ranked/RankedBoard";
import StandingRail from "@/components/ranked/StandingRail";
import WeekStrip from "@/components/ranked/WeekStrip";
import { ScopeSwitch, BoardSwitch } from "@/components/ranked/BoardControls";
import League from "@/pages/League";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    standing, titlesFor, nextBand, weakestComponent, BAND_TONE,
    COMPONENT_MOVE, moveHref, boardsFor, boardById, fmtMins,
} from "@/lib/ranked";
import { movementMap } from "@/lib/boardMovement";
import { liftFor } from "@/lib/atarLift";
import AceTip from "@/components/ace/AceTip";
import { planningEvidence } from "@/lib/atarBands";
import { AceLoading } from "@/components/ace/AceShuffle";

const TONE_PILL = {
    muted: "bg-secondary text-muted-foreground", xp: "bg-xp/15 text-xp",
    "chart-3": "bg-chart-3/15 text-chart-3", "chart-4": "bg-chart-4/15 text-chart-4",
    primary: "bg-primary/15 text-primary", streak: "bg-streak/15 text-streak",
};

const ATAR_BOARD = boardById("atar");
const ALL_TIME = boardsFor("alltime");

// Each bar states the evidence it was computed from. A percentage on its own
// tells a student their planning is 22 without telling them why, which makes
// the one number the whole app is standardised around impossible to act on.
const COMPONENT_META = [
    { key: "mastery", label: "Mastery", hint: "Quiz accuracy + card retention", bar: "bg-chart-4",
      evidence: (c) => {
          const bits = [];
          if (c.quiz_marks) bits.push(`${c.quiz_marks} quiz marks`);
          if (c.cards_reviewed) bits.push(`${c.cards_reviewed} cards`);
          return bits.length ? bits.join(" · ") : "no quizzes or cards yet";
      } },
    { key: "consistency", label: "Consistency", hint: "Days showing up", bar: "bg-streak",
      evidence: (c) => `${c.study_days ?? 0} of 20 days` },
    { key: "effort", label: "Effort", hint: "Focused minutes", bar: "bg-xp",
      evidence: (c) => `${fmtMins(c.minutes)} of ~20h` },
    { key: "breadth", label: "Breadth", hint: "Technique variety", bar: "bg-chart-3",
      evidence: (c) => `${Math.min(c.technique_families ?? 0, c.technique_target ?? 5)} of ${c.technique_target ?? 5} techniques` },
    { key: "planning", label: "Planning", hint: "Goals, blocks, prep and intents kept", bar: "bg-primary",
      evidence: (c) => planningEvidence(c) },
];

const TABS = [
    ["rank", "My rank", GraduationCap],
    ["league", "League", Swords],
    ["alltime", "All time", History],
];

function displayName(row, me) {
    if (!row) return "—";
    if (row.user_email === me) return "You";
    if (row.is_anonymous) return `Anon #${(row.user_email || "").slice(0, 4)}`;
    return row.username || row.user_name || (row.user_email || "").split("@")[0];
}

/**
 * One board, scoped and sorted, with everything derived from THAT list.
 *
 * The field is the single source for both the visible rows and the standing
 * maths — a rank computed off a different array from the one on screen is how
 * a board starts disagreeing with itself. Movement is computed over the whole
 * field rather than the visible fifty, so a student at 58th is compared
 * against where they actually were.
 */
function useBoardView(data, meta, scope) {
    const field = useMemo(() => {
        if (!data?.board) return [];
        let list = data.board.filter(r => meta.value(r) != null
            && (meta.id !== "atar" || r.acedit_atar != null));
        if (scope === "friends") list = list.filter(r => data.friends?.includes(r.user_email) || r.user_email === data.me);
        if (scope === "school") list = list.filter(r => data.my_school && r.school_name === data.my_school);
        return list.sort((a, b) => (meta.value(b) || 0) - (meta.value(a) || 0));
    }, [data, meta, scope]);

    const rows = useMemo(() => field.slice(0, 50), [field]);
    const titles = useMemo(() => titlesFor(field), [field]);
    const mine = useMemo(() => {
        const s = standing(field, data?.me, meta.value);
        const row = field.find(r => r.user_email === data?.me) || null;
        return { ...s, row };
    }, [field, data, meta]);
    // Null when this week's snapshot does not exist yet, which draws no arrows
    // at all rather than telling the whole field it is holding position.
    const movement = useMemo(
        () => movementMap(field, data?.snapshots?.[meta.id] ?? null),
        [field, data, meta]);

    return { field, rows, titles, mine, movement };
}

export default function Ranked() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    // CONTROLLED, because WeekStrip on the first tab switches to the League tab
    // rather than navigating to /League. An uncontrolled Tabs can only be moved
    // by the trigger it owns, and a strip that says "you are 2nd this week"
    // should open the board it is talking about.
    const [tab, setTab] = useState("rank");
    const [board, setBoard] = useState("xp");   // which of the two all-time boards
    const [scope, setScope] = useState("global");

    useEffect(() => {
        base44.functions.invoke("getRankedBoards", {})
            .then(res => setData(res?.data ?? res))
            .catch(e => console.error("Ranked load error:", e))
            .finally(() => setLoading(false));
    }, []);

    const allTimeMeta = useMemo(() => boardById(board), [board]);
    const atarView = useBoardView(data, ATAR_BOARD, scope);
    const allTimeView = useBoardView(data, allTimeMeta, scope);

    const next = nextBand(data?.my_atar);
    const weakest = weakestComponent(data?.my_components);
    const weakestMeta = COMPONENT_META.find(c => c.key === weakest?.key);
    const bandTone = BAND_TONE[data?.my_band] || "primary";
    const mine = atarView.mine;

    // The student's own lifetime figures, off the board row already fetched —
    // so the all-time tab leads with their numbers rather than with other
    // people's.
    const myRow = useMemo(
        () => (data?.board || []).find(r => r.user_email === data?.me) || null,
        [data]);

    const nameOf = (r) => displayName(r, data?.me);

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-[1600px] mx-auto px-4 lg:px-8 py-6 lg:py-10 space-y-6">

                {/* ── HEADER ──────────────────────────────────────────────
                    The eyebrow and the help button only. The headline used to
                    live here and state the ATAR, which put a 28-day score at
                    the top of the league and all-time tabs too — so each tab
                    carries its own h1 now, about the thing that tab is of. */}
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Ranked</span>
                    <HelpButton page="Ranked" />
                </div>

                <Tabs value={tab} onValueChange={setTab} className="space-y-6">
                    <TabsList className="grid w-full sm:w-auto sm:inline-grid grid-cols-3 h-auto p-1.5 rounded-2xl bg-surface border-2 border-border shadow-soft">
                        {TABS.map(([v, label, Icon]) => (
                            <TabsTrigger key={v} value={v}
                                className="flex items-center justify-center gap-1.5 py-2.5 px-3 sm:px-6 rounded-xl text-sm font-bold whitespace-nowrap text-muted-foreground data-[state=active]:bg-foreground data-[state=active]:text-background transition-all">
                                <Icon className="hidden sm:block w-4 h-4" /> {label}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {/* ══ MY RANK — the ATAR, the field, and the climb ══════ */}
                    <TabsContent value="rank" className="mt-0 space-y-6">

                        <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                            className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                            {loading ? "Sizing up the field…"
                                : data?.my_atar != null
                                    ? mine.rank
                                        ? `${data.my_atar.toFixed(2)} — ${data.my_band}, ${mine.rank === 1 ? "and top of the board." : `${ordinal(mine.rank)} of ${mine.total}.`}`
                                        : `You're sitting at ${data.my_atar.toFixed(2)} — ${data.my_band}.`
                                    : "Three study days on the board unlocks your AcedIt ATAR."}
                        </motion.h1>

                        {/* ── THE SCORE ───────────────────────────────────── */}
                        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                            <div className="card-soft p-5 lg:p-6">
                                <div className="grid lg:grid-cols-[auto_1fr] gap-6 items-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <AtarDial atar={loading ? null : data?.my_atar} band={data?.my_band} size={230} />
                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
                                            AcedIt ATAR <AceTip term="atar" align="center" />
                                        </span>
                                        {data?.my_band && (
                                            <span className={`pill ${TONE_PILL[bandTone]}`}>{data.my_band}</span>
                                        )}
                                    </div>

                                    <div className="space-y-4 min-w-0">
                                        {/* Where you sit, and what the next rung costs. */}
                                        <div className="grid sm:grid-cols-3 gap-2.5">
                                            <Stat icon={Trophy} label="Rank"
                                                value={mine.rank ? `#${mine.rank}` : "—"}
                                                sub={mine.rank ? `of ${mine.total} ranked` : "not ranked yet"} />
                                            <Stat icon={Users} label="Percentile"
                                                value={mine.percentile ? `Top ${mine.percentile}%` : "—"}
                                                sub={scope === "global" ? "across AcedIt" : `in ${scope}`} />
                                            <Stat icon={TrendingUp} label="Next band"
                                                value={next ? `+${next.gap.toFixed(2)}` : "Top band"}
                                                sub={next ? `to ${next.name}` : "nothing above this"} />
                                        </div>

                                        {/* ── The five components, each with a door ──────────
                                            A bar with no way through is a DIAGNOSIS. The panel
                                            named the weakest one in a sentence and left every
                                            component to the student to work out which screen
                                            moves it — the same shape as a percentage with no
                                            evidence under it, one step further along.

                                            A quiet LINK rather than a filled button, five times
                                            over: five buttons in a panel that already carries a
                                            primary one below reads as a toolbar. The loud one
                                            stays where it belongs, on the component that is
                                            actually costing them. */}
                                        <div className="grid sm:grid-cols-2 gap-x-5 gap-y-3">
                                            {COMPONENT_META.map(c => {
                                                const comps = data?.my_components || {};
                                                const v = comps[c.key] ?? 0;
                                                const move = COMPONENT_MOVE[c.key];
                                                // What ten points on THIS component is worth, from
                                                // the same differenced model Today's Play and
                                                // StandingRail use — so it is checkable rather
                                                // than a number the page invented.
                                                const lift = data?.my_components ? liftFor(comps, c.key, 10) : null;
                                                // A component with nothing left to gain is not
                                                // offered an action, and a gain that rounds to
                                                // +0.00 prints no figure: a rail row whose number
                                                // is not real teaches a student that none of the
                                                // numbers here are.
                                                const maxed = lift != null && lift.headroom <= 0;
                                                const gain = lift && lift.gain >= 0.005 ? lift.gain.toFixed(2) : null;
                                                return (
                                                    <div key={c.key}>
                                                        <div className="flex items-baseline justify-between mb-1 gap-2">
                                                            <span className="text-xs font-bold text-foreground inline-flex items-center gap-1">
                                                                {c.label} <AceTip term={c.key} />
                                                            </span>
                                                            <span className="text-xs font-bold text-foreground tabular-nums">{v}</span>
                                                        </div>
                                                        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                                                            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, v)}%` }}
                                                                transition={{ duration: 0.8, delay: 0.2 }}
                                                                className={`h-full rounded-full ${c.bar}`} />
                                                        </div>
                                                        <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">
                                                            {data?.my_components ? c.evidence(comps) : c.hint}
                                                        </p>
                                                        {move && (maxed ? (
                                                            <p className="text-[11px] font-bold text-muted-foreground mt-0.5">
                                                                Nothing left to gain here.
                                                            </p>
                                                        ) : (
                                                            <Link to={moveHref(c.key, createPageUrl)}
                                                                className="inline-flex items-center gap-1 mt-0.5 text-[11px] font-bold
                                                                    text-foreground hover:text-primary transition-colors group">
                                                                {move.label}
                                                                {gain && (
                                                                    <span className="text-primary tabular-nums">+{gain}</span>
                                                                )}
                                                                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                                                            </Link>
                                                        ))}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* The one that's actually costing you. */}
                                        {weakest && weakestMeta && (
                                            <div className="rounded-2xl border-2 border-border bg-secondary/40 p-3
                                                flex flex-wrap items-center gap-x-2.5 gap-y-2">
                                                <Target className="w-4 h-4 text-foreground flex-shrink-0" />
                                                <p className="text-xs text-muted-foreground leading-snug flex-1 min-w-[12rem]">
                                                    <span className="font-bold text-foreground">{weakestMeta.label} is your ceiling right now ({weakest.value}).</span>{" "}
                                                    {weakest.action}
                                                </p>
                                                {/* THE ONE LOUD BUTTON on the panel, and it is on
                                                    the component that is actually costing them —
                                                    which is why the other five are quiet links. */}
                                                {moveHref(weakest.key, createPageUrl) && (
                                                    <Link to={moveHref(weakest.key, createPageUrl)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl
                                                            bg-foreground text-background text-xs font-bold
                                                            hover:opacity-90 transition-opacity flex-shrink-0">
                                                        {COMPONENT_MOVE[weakest.key].label}
                                                        <ArrowRight className="w-3.5 h-3.5" />
                                                    </Link>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <p className="text-[11px] text-muted-foreground mt-4 flex items-center gap-1.5">
                                    <Info className="w-3.5 h-3.5 flex-shrink-0" />
                                    Your AcedIt ATAR measures how you&rsquo;ve studied over the last 28 days — it&rsquo;s yours to move, and it&rsquo;s not a VCAA prediction.
                                </p>
                            </div>
                        </motion.section>

                        {/* THE WEEK, read on the way past. It was in the sticky
                            rail, which is the second column — so below xl it
                            sat under thirty rows. Full width and above the
                            board, it is a status line: where they are this
                            week, how long is left, and what the podium pays. It
                            opens the TAB rather than the route, because the
                            route is the thing beside it. */}
                        <WeekStrip onOpen={() => setTab("league")} />

                        <BoardSection
                            heading="The ATAR board" meta={ATAR_BOARD}
                            scope={scope} onScope={setScope} hasSchool={!!data?.my_school}
                            view={atarView} data={data} loading={loading} nameOf={nameOf}
                            emptyText="No ranked students in this scope yet — three study days gets you on the board." />

                        {/* ── YOUR CLIMB ──────────────────────────────────────
                            Rank, level, the ten-tier ladder and what you have
                            unlocked. It was a tab of its own, which split the
                            page about where you stand into two pages about
                            where you stand — and put the rank ladder, which is
                            the one thing here that is purely yours, behind a
                            choice. It is the END of this tab rather than the
                            top of it, because the board above is what somebody
                            opens Ranked to look at. */}
                        <section className="space-y-4 pt-2">
                            <div className="flex items-center gap-3">
                                <h2 className="font-display text-xl sm:text-2xl font-extrabold text-foreground">
                                    Your climb
                                </h2>
                                {/* A rule to the end of the row, the same thing
                                    that turns the Quizzes shelf from a hole into
                                    a shelf: it terminates the band, so the space
                                    beside the heading is margin somebody chose. */}
                                <span className="flex-1 h-0.5 rounded-full bg-border" aria-hidden="true" />
                            </div>
                            <MyProfile data={data} loading={loading} />
                        </section>
                    </TabsContent>

                    {/* ══ LEAGUE — this week ════════════════════════════════ */}
                    {/* The REAL page, not a copy of it — `/League` is still a
                        route and two renderings of one board is the mirror this
                        codebase keeps deleting. */}
                    <TabsContent value="league" className="mt-0">
                        <League embedded />
                    </TabsContent>

                    {/* ══ ALL TIME — XP and hours ═══════════════════════════ */}
                    <TabsContent value="alltime" className="mt-0 space-y-6">
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                                {loading ? "Counting it all up…"
                                    : myRow
                                        ? `${(myRow.total_xp || 0).toLocaleString()} XP and ${fmtMins(myRow.total_study_time || 0)} logged.`
                                        : "Everything you log from here counts toward this."}
                            </h1>
                            <p className="text-sm text-muted-foreground mt-2">
                                These two never reset. The ATAR is the last 28 days and the league is this
                                week — this is the whole run.
                            </p>
                        </motion.div>

                        <BoardSection
                            heading={allTimeMeta.label} meta={allTimeMeta}
                            scope={scope} onScope={setScope} hasSchool={!!data?.my_school}
                            view={allTimeView} data={data} loading={loading} nameOf={nameOf}
                            boards={ALL_TIME} board={board} onBoard={setBoard}
                            emptyText="Nothing on this board for this scope yet." />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}

/**
 * A board with its own header, its controls and the standing rail beside it.
 *
 * ONE COMPONENT FOR BOTH TABS. The ATAR board and the all-time boards differ
 * in exactly two ways — which board descriptor they draw and whether there is
 * anything to switch between — so a second copy of the loading, empty, grid
 * and rail cases is three states that can drift apart. `BoardSwitch` draws
 * nothing when handed fewer than two boards, which is what lets the ATAR tab
 * pass none at all.
 */
function BoardSection({
    heading, meta, scope, onScope, hasSchool, view, data, loading, nameOf,
    boards = null, board = null, onBoard = null, emptyText,
}) {
    return (
        <section className="space-y-4">
            <div className="space-y-3">
                <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
                    <div>
                        <h2 className="font-display text-xl sm:text-2xl font-extrabold text-foreground leading-tight">
                            {heading}
                        </h2>
                        {/* WHAT THE BOARD IS OF. A leaderboard whose window is
                            not stated is one a student cannot argue with — and
                            these three measure three different spans of time,
                            which was the whole reason the chip row was
                            confusing. */}
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {meta.window}
                            {view.mine?.rank ? ` · you're ${ordinal(view.mine.rank)} of ${view.mine.total}` : ""}
                        </p>
                    </div>
                    {boards && onBoard && (
                        <BoardSwitch boards={boards} board={board} onBoard={onBoard} />
                    )}
                </div>
                <ScopeSwitch scope={scope} onScope={onScope} hasSchool={hasSchool} />
            </div>

            <div className="grid xl:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
                <div className="min-w-0">
                    {loading ? (
                        <div className="card-soft p-10">
                            <AceLoading>Loading the board…</AceLoading>
                        </div>
                    ) : data?.setup_required ? (
                        <div className="card-soft p-8 text-center text-sm text-muted-foreground">
                            The ATAR engine is almost ready — one database migration to run.
                        </div>
                    ) : view.rows.length === 0 ? (
                        <div className="card-soft p-8 text-center">
                            <p className="text-sm text-muted-foreground">{emptyText}</p>
                        </div>
                    ) : (
                        <RankedBoard rows={view.rows} me={data.me} boardMeta={meta}
                            titles={view.titles} movement={view.movement}
                            nameOf={nameOf} myStanding={view.mine} />
                    )}
                </div>

                {/* ── Standing rail ───────────────────────────────────────
                    Was three cards: your standing, your title, and an
                    explainer for the scarcity rules of a label most students
                    do not have. StandingRail is the contest instead — who is
                    above, who is behind, and what the gap costs in work. */}
                <div className="xl:sticky xl:top-6 space-y-3">
                    <StandingRail
                        mine={view.mine} boardMeta={meta} board={meta.id}
                        nameOf={nameOf}
                        components={data?.my_components}
                        title={view.titles.get(data?.me)} />
                </div>
            </div>
        </section>
    );
}

function Stat({ icon: Icon, label, value, sub }) {
    return (
        <div className="rounded-2xl border-2 border-border bg-secondary/30 p-3">
            <p className="stat-label flex items-center gap-1.5 mb-1"><Icon className="w-3 h-3" /> {label}</p>
            <p className="font-display font-black text-foreground text-xl leading-none tabular-nums">{value}</p>
            <p className="text-[10px] text-muted-foreground mt-1 truncate">{sub}</p>
        </div>
    );
}

const ordinal = (n) => {
    const s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
