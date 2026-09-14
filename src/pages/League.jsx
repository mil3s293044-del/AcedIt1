/**
 * League — this week's board, and the weeks you have already finished.
 *
 * ─── Why this page exists ───────────────────────────────────────────────────
 * Weekly leagues have been running since migration 0015 and no student has
 * ever seen one. `getLeagueStanding` had zero callers, there was no route, and
 * the settle function's only call site sat behind a mode check that has never
 * been true — so `final_position` was NULL on every row and every finished
 * week silently evaporated. The data was being written the whole time.
 *
 * ─── ONE QUESTION: where am I this week, and what closes the gap ────────────
 * The hero is the lead, not a greeting — the rule Compete's rework landed on.
 * Everything below is evidence for it: the board with every gap drawn, then
 * the weeks already settled.
 *
 * ─── It refetches when the app says it is safe to ───────────────────────────
 * `useLiveTick()` and nothing else — no clock of its own, no second data
 * layer. A board that is stale the moment somebody else studies is the thing
 * the live system was built for, and a board that refetches while a student is
 * mid-quiz is the thing it was built to avoid.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    Trophy, Loader2, Eye, EyeOff, ChevronLeft, TrendingUp, TrendingDown, Info,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { useLiveTick } from "@/lib/LiveContext";
import { takeFn } from "@/lib/fnResult";
import { Countdown } from "@/components/competition/arenaHelpers";
import WeeklyBoard from "@/components/league/WeeklyBoard";
import Reveal from "@/components/shared/Reveal";
import LiveNumber from "@/components/shared/LiveNumber";
import {
    msUntilReset, untilLabel, isClosing, leagueLead, historySummary, ordinal, SCORE_MAX,
} from "@/lib/league";

const TONE = {
    chase:   "text-chart-3",
    defend:  "text-xp",
    climb:   "text-muted-foreground",
    lead:    "text-primary",
};

export default function League() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [savingAnon, setSavingAnon] = useState(false);
    const liveTick = useLiveTick();

    // Declared BEFORE the effect that names it in a dependency array. A deps
    // array is evaluated DURING render, so a `const` below its own hook is a
    // temporal-dead-zone ReferenceError and a white screen — the crash that
    // took Compete down, and then Study, in two slightly different shapes.
    const load = useCallback(async () => {
        try {
            // takeFn, NOT the raw result. This read the { data, error }
            // envelope as the payload, so every field came back undefined and
            // the whole page rendered its empty state with no error anywhere.
            const payload = takeFn(await base44.functions.invoke("getLeagueStanding", {}));
            setData(payload);
            setError(null);
            // A week closed on this request, so Podium or Top Dog may have
            // just been granted. `useAchievementWatch` listens for exactly
            // this event and is mounted in Layout, so the unlock plays here
            // rather than being discovered on a tab three sessions later —
            // which is the silent-grant problem AchievementUnlock exists for.
            if (payload?.just_settled) window.dispatchEvent(new Event("xp_awarded"));
        } catch (e) {
            setError(e?.message || "Could not load the board.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load, liveTick]);

    const rows = data?.rows || [];
    const me = data?.me || {};
    const resetMs = msUntilReset(data?.group?.resets_at);
    const closing = isClosing(resetMs);
    const lead = useMemo(() => leagueLead({ rows, me, closing }), [rows, me, closing]);
    const hist = useMemo(() => historySummary(data?.history), [data?.history]);

    const toggleAnon = async () => {
        setSavingAnon(true);
        try {
            await base44.functions.invoke("setLeagueAnonymity", { is_anonymous: !me.is_anonymous });
            await load();
        } catch { /* the board simply keeps the state it had */ }
        setSavingAnon(false);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center text-muted-foreground gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading this week's board…
            </div>
        );
    }

    return (
        <div className="min-h-screen p-4 sm:p-6">
            <div className="max-w-4xl mx-auto">
                <Reveal className="space-y-5">

                    {/* ── Back, and the week's clock ───────────────────── */}
                    <div className="flex items-center justify-between gap-3">
                        <Link to={createPageUrl("Ranked")}
                            className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground
                                hover:text-foreground transition-colors">
                            <ChevronLeft className="w-4 h-4" /> Ranked
                        </Link>
                        {data?.group?.resets_at && (
                            <Countdown targetDate={data.group.resets_at} variant="chip" />
                        )}
                    </div>

                    {error && (
                        <div className="card-soft p-4 text-sm text-streak">{error}</div>
                    )}

                    {/* ── The hero: the MOVE is the headline ───────────── */}
                    {/* A page opened to find out where you stand should not
                        open with a greeting. The kicker is small; the thing
                        you can act on is the h1. */}
                    <section className="card-soft on-table p-5 sm:p-6">
                        <p className="stat-label text-muted-foreground flex items-center gap-1.5">
                            <Trophy className="w-3.5 h-3.5" />
                            This week
                            {resetMs != null && (
                                <span className={closing ? "text-xp" : ""}>
                                    · resets in {untilLabel(resetMs)}
                                </span>
                            )}
                        </p>

                        {lead ? (
                            <>
                                <h1 className={`font-display font-black text-2xl sm:text-3xl leading-tight mt-1
                                    ${TONE[lead.tone] || "text-foreground"}`}>
                                    {lead.headline}
                                </h1>
                                {lead.detail && (
                                    <p className="text-sm text-muted-foreground mt-1.5">{lead.detail}</p>
                                )}
                            </>
                        ) : (
                            <>
                                <h1 className="font-display font-black text-2xl sm:text-3xl leading-tight mt-1 text-foreground">
                                    {me.position ? `${ordinal(me.position)} this week` : "You're on the board"}
                                </h1>
                                <p className="text-sm text-muted-foreground mt-1.5">
                                    {rows.length < 2
                                        ? "Nobody else has studied yet this week — the race starts when they do."
                                        : "Every session moves your score."}
                                </p>
                            </>
                        )}

                        <div className="flex flex-wrap items-end gap-x-6 gap-y-3 mt-5">
                            <div>
                                <p className="stat-label text-muted-foreground">Compete score</p>
                                <p className="font-display font-black text-3xl text-foreground tabular-nums">
                                    <LiveNumber value={me.compete_score ?? 0} />
                                    <span className="text-base font-bold text-muted-foreground ml-1">
                                        / {SCORE_MAX}
                                    </span>
                                </p>
                            </div>
                            <div>
                                <p className="stat-label text-muted-foreground">Position</p>
                                <p className="font-display font-black text-3xl text-foreground tabular-nums">
                                    {ordinal(me.position) || "—"}
                                    <span className="text-base font-bold text-muted-foreground ml-1">
                                        of {rows.length}
                                    </span>
                                </p>
                            </div>
                            <div>
                                <p className="stat-label text-muted-foreground">XP this week</p>
                                <p className="font-display font-black text-3xl text-xp tabular-nums">
                                    <LiveNumber value={me.weekly_xp ?? 0} />
                                </p>
                            </div>
                        </div>

                        {/* ── THE GATE SAYS WHAT UNLOCKS IT ──────────────── */}
                        {/* A student who only ever sits short quizzes takes a
                            silent zero on a 400-point slice. "Never score a
                            student on a signal they can't reach" applies just
                            as hard to one they CAN reach and were never told
                            about. Their own row only. */}
                        {me.board_sits === 0 && (
                            <p className="flex items-start gap-2 text-xs text-muted-foreground mt-4 pt-4
                                border-t border-border">
                                <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                <span>
                                    Mastery counts your first sit of each quiz with at least{" "}
                                    {me.board_min_questions || 8} questions. Shorter practice still pays XP
                                    and still feeds your decks — it just doesn't decide the week.
                                </span>
                            </p>
                        )}
                    </section>

                    {/* ── The board ───────────────────────────────────── */}
                    <section className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="font-display font-extrabold text-foreground text-base">
                                Standings
                            </h2>
                            <button type="button" onClick={toggleAnon} disabled={savingAnon}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground
                                    hover:text-foreground transition-colors disabled:opacity-50">
                                {savingAnon
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : me.is_anonymous ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                {me.is_anonymous ? "Hidden" : "Visible"}
                            </button>
                        </div>
                        <WeeklyBoard rows={rows} />
                    </section>

                    {/* ── Finished weeks ──────────────────────────────── */}
                    {/* Only weeks the server has actually settled. Before this
                        release there were none at all — not because nobody
                        played, but because nothing ever wrote a result. */}
                    {hist.count > 0 && (
                        <section className="space-y-2">
                            <h2 className="font-display font-extrabold text-foreground text-base">
                                Finished weeks
                            </h2>
                            <div className="card-soft p-4">
                                <div className="flex flex-wrap items-end gap-x-6 gap-y-3 mb-4">
                                    <div>
                                        <p className="stat-label text-muted-foreground">Best finish</p>
                                        <p className="font-display font-black text-2xl text-foreground tabular-nums">
                                            {ordinal(hist.best)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="stat-label text-muted-foreground">Weeks played</p>
                                        <p className="font-display font-black text-2xl text-foreground tabular-nums">
                                            {hist.count}
                                        </p>
                                    </div>
                                    {/* null rather than 0 when there is only one
                                        week: 0 means "held your place" and must
                                        not double as "not enough data yet". */}
                                    {hist.trend !== null && hist.trend !== 0 && (
                                        <div>
                                            <p className="stat-label text-muted-foreground">Last week</p>
                                            <p className={`font-display font-black text-2xl tabular-nums
                                                flex items-center gap-1
                                                ${hist.trend > 0 ? "text-primary" : "text-streak"}`}>
                                                {hist.trend > 0
                                                    ? <TrendingUp className="w-5 h-5" />
                                                    : <TrendingDown className="w-5 h-5" />}
                                                {hist.trend > 0 ? "+" : ""}{hist.trend}
                                                <span className="text-xs font-bold text-muted-foreground">
                                                    places
                                                </span>
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1">
                                    {hist.weeks.map((w) => (
                                        <div key={w.week_start}
                                            className="flex items-center justify-between gap-3 py-1.5">
                                            <span className="text-sm text-muted-foreground">
                                                {new Date(`${w.week_start}T00:00:00Z`).toLocaleDateString(undefined, {
                                                    day: "numeric", month: "short",
                                                })}
                                            </span>
                                            <div className="flex-1 h-px bg-border" />
                                            <span className="text-xs font-bold text-muted-foreground tabular-nums">
                                                {w.weekly_xp.toLocaleString()} XP
                                            </span>
                                            <span className={`font-display font-black text-sm tabular-nums w-12 text-right
                                                ${w.position <= 3 ? "text-xp" : "text-foreground"}`}>
                                                {ordinal(w.position)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Says what it measures, the way Ranked does about the
                        ATAR. A weekly board that does not explain its own
                        number invites a student to guess at it. */}
                    <p className="text-xs text-muted-foreground text-center px-4">
                        Your compete score is effort, mastery and consistency over the week —
                        countable study minutes, your first sit of each quiz, and the days you
                        turned up. It resets every Monday.
                    </p>
                </Reveal>
            </div>
        </div>
    );
}
