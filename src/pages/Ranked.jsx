/**
 * Ranked — the AcedIt ATAR, then the ladder.
 *
 * The rework, and why:
 *
 *   • The page ran to four full-width stacked sections and ended with
 *     GamifiedMyRank rendering an achievements grid immediately above
 *     AchievementsGallery rendering another one. My profile now lives behind a
 *     tab, so the board is the page rather than the thing you scroll past.
 *   • max-w-6xl centred left ~380px of dead margin either side on a wide
 *     screen. Now 1600px with the board left and a standing rail filling it.
 *   • The score was a number and five bars. It's a dial with the bands marked
 *     on it, so the next one is a place you can see rather than a sentence.
 *   • The board carried percentile, gaps and superlatives in its data and
 *     displayed none of them. A rank on its own isn't competitive; "1.24
 *     behind the spot above" is.
 *
 * The one number the whole ladder is standardised around is still trailing
 * 28-day study quality, 0-99.95, and still not a VCAA prediction. The UI keeps
 * saying so.
 */
import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
    GraduationCap, Zap, Clock, Trophy, Info, Loader2, Target, TrendingUp, Users,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import HelpButton from "@/components/shared/HelpButton";
import GamifiedMyRank from "@/components/ranked/GamifiedMyRank";
import AchievementsGallery from "@/components/ranked/AchievementsGallery";
import AtarDial from "@/components/ranked/AtarDial";
import RankedBoard from "@/components/ranked/RankedBoard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    standing, titlesFor, nextBand, weakestComponent, BAND_TONE,
} from "@/lib/ranked";
import AceTip from "@/components/ace/AceTip";

const TONE_PILL = {
    muted: "bg-secondary text-muted-foreground", xp: "bg-xp/15 text-xp",
    "chart-3": "bg-chart-3/15 text-chart-3", "chart-4": "bg-chart-4/15 text-chart-4",
    primary: "bg-primary/15 text-primary", streak: "bg-streak/15 text-streak",
};

const fmtMins = (m) => {
    if (!m) return "0m";
    const h = Math.floor(m / 60), mm = Math.round(m % 60);
    return h === 0 ? `${mm}m` : mm === 0 ? `${h}h` : `${h}h ${mm}m`;
};

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
      evidence: (c) => `${c.technique_families ?? 0} of 5 techniques` },
    { key: "planning", label: "Planning", hint: "Goals, blocks and intents kept", bar: "bg-primary",
      evidence: (c) => {
          const bits = [];
          if (c.goals_set) bits.push(`${c.goals_met ?? 0}/${c.goals_set} goals`);
          if (c.blocks_planned) bits.push(`${c.blocks_kept ?? 0}/${c.blocks_planned} blocks`);
          if (c.intents_declared) bits.push(`${c.intents_kept ?? 0}/${c.intents_declared} intents kept`);
          return bits.length ? bits.join(" · ") : "nothing planned yet";
      } },
];

const BOARDS = [
    { id: "atar", label: "ATAR", icon: GraduationCap, value: (r) => r.acedit_atar,
      fmt: (v) => (v == null ? "—" : v.toFixed(2)), gap: (g) => `${g.toFixed(2)} behind` },
    { id: "xp", label: "XP", icon: Zap, value: (r) => r.total_xp || 0,
      fmt: (v) => (v || 0).toLocaleString(), gap: (g) => `${Math.round(g).toLocaleString()} XP behind` },
    { id: "time", label: "Study time", icon: Clock, value: (r) => r.total_study_time || 0,
      fmt: (v) => fmtMins(v || 0), gap: (g) => `${fmtMins(g)} behind` },
];

const SCOPES = [
    { id: "global", label: "Global" },
    { id: "friends", label: "Friends" },
    { id: "school", label: "School" },
];

function displayName(row, me) {
    if (!row) return "—";
    if (row.user_email === me) return "You";
    if (row.is_anonymous) return `Anon #${(row.user_email || "").slice(0, 4)}`;
    return row.username || row.user_name || (row.user_email || "").split("@")[0];
}

export default function Ranked() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [board, setBoard] = useState("atar");
    const [scope, setScope] = useState("global");

    useEffect(() => {
        base44.functions.invoke("getRankedBoards", {})
            .then(res => setData(res?.data ?? res))
            .catch(e => console.error("Ranked load error:", e))
            .finally(() => setLoading(false));
    }, []);

    const meta = BOARDS.find(b => b.id === board);

    // The scoped, sorted field — the source for both the visible rows and the
    // standing maths, so a rank never disagrees with the list it came from.
    const field = useMemo(() => {
        if (!data?.board) return [];
        let list = data.board.filter(r => meta.value(r) != null && (board !== "atar" || r.acedit_atar != null));
        if (scope === "friends") list = list.filter(r => data.friends?.includes(r.user_email) || r.user_email === data.me);
        if (scope === "school") list = list.filter(r => data.my_school && r.school_name === data.my_school);
        return list.sort((a, b) => (meta.value(b) || 0) - (meta.value(a) || 0));
    }, [data, board, scope, meta]);

    const rows = useMemo(() => field.slice(0, 50), [field]);
    const titles = useMemo(() => titlesFor(field), [field]);
    const mine = useMemo(() => {
        const s = standing(field, data?.me, meta.value);
        const row = field.find(r => r.user_email === data?.me) || null;
        return { ...s, row };
    }, [field, data, meta]);

    const gapLabel = mine.above ? `${meta.gap(mine.above.gap)} ${displayName(mine.above.row, data?.me)}` : null;
    const next = nextBand(data?.my_atar);
    const weakest = weakestComponent(data?.my_components);
    const weakestMeta = COMPONENT_META.find(c => c.key === weakest?.key);
    const bandTone = BAND_TONE[data?.my_band] || "primary";

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-[1600px] mx-auto px-4 lg:px-8 py-6 lg:py-10 space-y-6">

                {/* ── HEADER ──────────────────────────────────────────── */}
                <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Ranked</span>
                        <HelpButton page="Ranked" />
                    </div>
                    <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                        {loading ? "Sizing up the field…"
                            : data?.my_atar != null
                                ? mine.rank
                                    ? `${data.my_atar.toFixed(2)} — ${data.my_band}, ${mine.rank === 1 ? "and top of the board." : `${ordinal(mine.rank)} of ${mine.total}.`}`
                                    : `You're sitting at ${data.my_atar.toFixed(2)} — ${data.my_band}.`
                                : "Three study days on the board unlocks your AcedIt ATAR."}
                    </h1>
                </motion.section>

                {/* ── THE SCORE ───────────────────────────────────────── */}
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

                                {/* The five components. */}
                                <div className="grid sm:grid-cols-2 gap-x-5 gap-y-2">
                                    {COMPONENT_META.map(c => {
                                        const comps = data?.my_components || {};
                                        const v = comps[c.key] ?? 0;
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
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* The one that's actually costing you. */}
                                {weakest && weakestMeta && (
                                    <div className="rounded-2xl border-2 border-border bg-secondary/40 p-3 flex items-start gap-2.5">
                                        <Target className="w-4 h-4 text-foreground flex-shrink-0 mt-0.5" />
                                        <p className="text-xs text-muted-foreground leading-snug">
                                            <span className="font-bold text-foreground">{weakestMeta.label} is your ceiling right now ({weakest.value}).</span>{" "}
                                            {weakest.action}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <p className="text-[11px] text-muted-foreground mt-4 flex items-center gap-1.5">
                            <Info className="w-3.5 h-3.5 flex-shrink-0" />
                            Your AcedIt ATAR measures how you've studied over the last 28 days — it's yours to move, and it's not a VCAA prediction.
                        </p>
                    </div>
                </motion.section>

                {/* ── BOARD / PROFILE ─────────────────────────────────── */}
                <Tabs defaultValue="board" className="space-y-5">
                    <TabsList className="grid w-full sm:w-auto sm:inline-grid grid-cols-2 h-auto p-1.5 rounded-2xl bg-surface border-2 border-border shadow-soft">
                        {[["board", "Leaderboard", Trophy], ["profile", "My profile", GraduationCap]].map(([v, label, Icon]) => (
                            <TabsTrigger key={v} value={v}
                                className="flex items-center justify-center gap-1.5 py-2.5 px-6 rounded-xl text-sm font-bold text-muted-foreground data-[state=active]:bg-foreground data-[state=active]:text-background transition-all">
                                <Icon className="w-4 h-4" /> {label}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    <TabsContent value="board" className="mt-0">
                        <div className="grid xl:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
                            <div className="min-w-0 space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="inline-flex rounded-2xl bg-surface border-2 border-border shadow-soft p-1.5 gap-1">
                                        {BOARDS.map(b => (
                                            <button key={b.id} onClick={() => setBoard(b.id)} data-board={b.id}
                                                className={`flex items-center gap-1.5 py-2 px-3.5 rounded-xl text-xs lg:text-sm font-bold transition-all ${
                                                    board === b.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
                                                <b.icon className="w-3.5 h-3.5" /> {b.label}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex gap-1.5">
                                        {SCOPES.map(s => (
                                            <button key={s.id} onClick={() => setScope(s.id)} data-scope={s.id}
                                                disabled={s.id === "school" && !data?.my_school}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all disabled:opacity-40 ${
                                                    scope === s.id ? "bg-primary border-primary text-white" : "bg-surface border-border text-muted-foreground hover:text-foreground"}`}>
                                                {s.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {loading ? (
                                    <div className="card-soft p-10 flex items-center justify-center text-muted-foreground gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin" /> Loading the board…
                                    </div>
                                ) : data?.setup_required ? (
                                    <div className="card-soft p-8 text-center text-sm text-muted-foreground">
                                        The ATAR engine is almost ready — one database migration to run.
                                    </div>
                                ) : rows.length === 0 ? (
                                    <div className="card-soft p-8 text-center">
                                        <Trophy className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                                        <p className="text-sm text-muted-foreground">
                                            {board === "atar"
                                                ? "No ranked students in this scope yet — three study days gets you on the board."
                                                : "Nothing on this board for this scope yet."}
                                        </p>
                                    </div>
                                ) : (
                                    <RankedBoard rows={rows} me={data.me} boardMeta={meta} titles={titles}
                                        nameOf={(r) => displayName(r, data.me)} myStanding={mine} gapLabel={gapLabel} />
                                )}
                            </div>

                            {/* ── Standing rail ───────────────────────── */}
                            <div className="xl:sticky xl:top-6 space-y-3">
                                <div className="card-soft p-4 border-2 border-border space-y-3">
                                    <p className="stat-label flex items-center gap-1.5">
                                        <Target className="w-3.5 h-3.5" /> Your standing
                                    </p>
                                    {mine.rank ? (
                                        <>
                                            <p className="font-display font-black text-3xl text-foreground leading-none">
                                                #{mine.rank}
                                                <span className="text-sm font-bold text-muted-foreground"> of {mine.total}</span>
                                            </p>
                                            {mine.above ? (
                                                <div className="rounded-xl bg-streak/5 border-2 border-streak/25 p-3">
                                                    <p className="text-xs text-muted-foreground leading-snug">
                                                        <span className="font-bold text-foreground">
                                                            {meta.gap(mine.above.gap)} {displayName(mine.above.row, data.me)}
                                                        </span>
                                                        {" "}— that's the next spot.
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="rounded-xl bg-primary/5 border-2 border-primary/25 p-3">
                                                    <p className="text-xs text-foreground font-bold">Top of the board. Someone's coming.</p>
                                                </div>
                                            )}
                                            {mine.below && (
                                                <p className="text-[11px] text-muted-foreground">
                                                    {displayName(mine.below.row, data.me)} is {meta.gap(mine.below.gap).replace(" behind", "")} back.
                                                </p>
                                            )}
                                        </>
                                    ) : (
                                        <p className="text-xs text-muted-foreground leading-snug">
                                            You're not on this board yet. Three study days puts you on the ATAR ladder.
                                        </p>
                                    )}
                                </div>

                                {titles.get(data?.me) && (
                                    <div className="card-soft p-4 border-2 border-border">
                                        <p className="stat-label mb-1.5">Your title</p>
                                        <span className={`pill ${TONE_PILL[titles.get(data.me).tone]}`}>
                                            {titles.get(data.me).label}
                                        </span>
                                        <p className="text-[11px] text-muted-foreground mt-1.5">{titles.get(data.me).blurb}</p>
                                    </div>
                                )}

                                <div className="card-soft p-4 border-2 border-border">
                                    <p className="stat-label mb-2">How titles work</p>
                                    <p className="text-[11px] text-muted-foreground leading-snug">
                                        Three of them go to whoever actually leads this board on hours, XP and
                                        streak. The rest are earned at a threshold. Most people don't have one —
                                        that's the point.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="profile" className="mt-0 space-y-6">
                        <GamifiedMyRank />
                        <AchievementsGallery />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
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
