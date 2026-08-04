/**
 * Ranked — standardised around the AcedIt ATAR. One score to rule the ladder
 * (trailing-28-day study quality, 0-99.95, NOT a VCAA prediction — the UI
 * says so), three boards only (ATAR / XP / Study time) with a
 * Global / Friends / School scope toggle, and My Profile below. The old
 * leagues, season tiers, meme ranks and perks are retired.
 */
import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { GraduationCap, Zap, Clock, Trophy, Info, Loader2, Flame } from "lucide-react";
import { base44 } from "@/api/base44Client";
import HelpButton from "@/components/shared/HelpButton";
import GamifiedMyRank from "@/components/ranked/GamifiedMyRank";
import AchievementsGallery from "@/components/ranked/AchievementsGallery";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ── Band styling (static classes) ───────────────────────────────────────────
const BAND_STYLE = {
    "The 99 Club":     "bg-chart-4/15 text-chart-4",
    "State Contender": "bg-chart-4/10 text-chart-4",
    "Elite":           "bg-primary/15 text-primary",
    "Strong":          "bg-primary/10 text-primary",
    "Solid":           "bg-chart-3/10 text-chart-3",
    "On Track":        "bg-chart-3/10 text-chart-3",
    "Building":        "bg-xp/10 text-xp",
    "Foundation":      "bg-secondary text-muted-foreground",
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
    {
        key: "mastery", label: "Mastery", hint: "Quiz accuracy + card retention", bar: "bg-chart-4",
        evidence: (c) => {
            const bits = [];
            if (c.quiz_marks) bits.push(`${c.quiz_marks} quiz marks`);
            if (c.cards_reviewed) bits.push(`${c.cards_reviewed} cards`);
            return bits.length ? bits.join(" · ") : "no quizzes or cards yet";
        },
    },
    {
        key: "consistency", label: "Consistency", hint: "Days showing up", bar: "bg-streak",
        evidence: (c) => `${c.study_days ?? 0} of 20 days`,
    },
    {
        key: "effort", label: "Effort", hint: "Focused minutes", bar: "bg-xp",
        evidence: (c) => `${fmtMins(c.minutes)} of ~20h`,
    },
    {
        key: "breadth", label: "Breadth", hint: "Technique variety", bar: "bg-chart-3",
        evidence: (c) => `${c.technique_families ?? 0} of 5 techniques`,
    },
    {
        key: "planning", label: "Planning", hint: "Goals, blocks and intents kept", bar: "bg-primary",
        evidence: (c) => {
            const bits = [];
            if (c.goals_set) bits.push(`${c.goals_met ?? 0}/${c.goals_set} goals`);
            if (c.blocks_planned) bits.push(`${c.blocks_kept ?? 0}/${c.blocks_planned} blocks`);
            if (c.intents_declared) bits.push(`${c.intents_kept ?? 0}/${c.intents_declared} intents kept`);
            return bits.length ? bits.join(" · ") : "nothing planned yet";
        },
    },
];

const BOARDS = [
    { id: "atar", label: "ATAR", icon: GraduationCap, value: (r) => r.acedit_atar, fmt: (v) => v?.toFixed(2), sub: (r) => r.band },
    { id: "xp",   label: "XP",   icon: Zap,           value: (r) => r.total_xp || 0, fmt: (v) => (v || 0).toLocaleString(), sub: () => null },
    { id: "time", label: "Study time", icon: Clock,   value: (r) => r.total_study_time || 0, fmt: (v) => `${Math.floor((v || 0) / 60)}h ${(v || 0) % 60}m`, sub: () => null },
];

const SCOPES = [
    { id: "global",  label: "Global" },
    { id: "friends", label: "Friends" },
    { id: "school",  label: "School" },
];

function displayName(row, me) {
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
        base44.functions.invoke('getRankedBoards', {})
            .then(res => setData(res?.data ?? res))
            .catch(e => console.error("Ranked load error:", e))
            .finally(() => setLoading(false));
    }, []);

    const rows = useMemo(() => {
        if (!data?.board) return [];
        const meta = BOARDS.find(b => b.id === board);
        let list = data.board.filter(r => meta.value(r) != null && (board !== "atar" || r.acedit_atar != null));
        if (scope === "friends") list = list.filter(r => data.friends?.includes(r.user_email) || r.user_email === data.me);
        if (scope === "school") list = list.filter(r => data.my_school && r.school_name === data.my_school);
        return list.sort((a, b) => (meta.value(b) || 0) - (meta.value(a) || 0)).slice(0, 50);
    }, [data, board, scope]);

    const meta = BOARDS.find(b => b.id === board);
    const myRankIdx = rows.findIndex(r => r.user_email === data?.me);

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-6xl mx-auto px-4 lg:px-8 py-6 lg:py-10 space-y-6">

                {/* ── COACH STRIP ─────────────────────────────────────── */}
                <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Ranked</span>
                        <HelpButton page="Ranked" />
                    </div>
                    <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                        {loading ? "Sizing up the field…"
                            : data?.my_atar != null
                                ? `You're sitting at ${data.my_atar.toFixed(2)} — ${data.my_band}.`
                                : "Three study days on the board unlocks your AcedIt ATAR."}
                    </h1>
                </motion.section>

                {/* ── MY ATAR HERO ────────────────────────────────────── */}
                <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                    <div className="card-soft p-6 lg:p-7">
                        <div className="flex flex-wrap items-start gap-6">
                            <div>
                                <p className="stat-label mb-1">AcedIt ATAR</p>
                                <p className="font-display font-black text-foreground leading-none" style={{ fontSize: "clamp(3rem, 9vw, 4.5rem)" }}>
                                    {loading ? "—" : data?.my_atar != null ? data.my_atar.toFixed(2) : "—"}
                                </p>
                                {data?.my_band && (
                                    <span className={`pill mt-2 inline-block ${BAND_STYLE[data.my_band] || "bg-secondary text-muted-foreground"}`}>
                                        {data.my_band}
                                    </span>
                                )}
                            </div>
                            <div className="flex-1 min-w-[220px] space-y-2.5">
                                {COMPONENT_META.map(c => {
                                    const comps = data?.my_components || {};
                                    const v = comps[c.key] ?? 0;
                                    const evidence = data?.my_components ? c.evidence(comps) : null;
                                    return (
                                        <div key={c.key}>
                                            <div className="flex items-baseline justify-between mb-1">
                                                <span className="text-xs font-bold text-foreground">{c.label}</span>
                                                <span className="text-xs text-muted-foreground">{c.hint} · <span className="font-bold text-foreground">{v}</span></span>
                                            </div>
                                            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                                                <motion.div initial={{ width: 0 }} animate={{ width: `${v}%` }} transition={{ duration: 0.8, delay: 0.2 }}
                                                    className={`h-full rounded-full ${c.bar}`} />
                                            </div>
                                            {evidence && (
                                                <p className="text-[11px] text-muted-foreground/70 mt-1">{evidence}</p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1.5">
                            <Info className="w-3.5 h-3.5 flex-shrink-0" />
                            Your AcedIt ATAR measures how you've studied over the last 28 days — it's yours to move, and it's not a VCAA prediction.
                        </p>
                    </div>
                </motion.section>

                {/* ── THE THREE BOARDS ────────────────────────────────── */}
                <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <Tabs value={board} onValueChange={setBoard}>
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                            <TabsList className="grid grid-cols-3 h-auto p-1.5 rounded-2xl bg-surface border-2 border-border shadow-soft">
                                {BOARDS.map(b => (
                                    <TabsTrigger key={b.id} value={b.id}
                                        className="flex items-center gap-1.5 py-2 px-4 rounded-xl text-xs lg:text-sm font-bold text-muted-foreground data-[state=active]:bg-foreground data-[state=active]:text-background transition-all">
                                        <b.icon className="w-3.5 h-3.5" /> {b.label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                            <div className="flex gap-1.5">
                                {SCOPES.map(s => (
                                    <button key={s.id} onClick={() => setScope(s.id)}
                                        disabled={s.id === "school" && !data?.my_school}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all disabled:opacity-40 ${
                                            scope === s.id ? "bg-primary border-primary text-white" : "bg-surface border-border text-muted-foreground hover:text-foreground"
                                        }`}>
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {BOARDS.map(b => (
                            <TabsContent key={b.id} value={b.id} className="mt-0">
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
                                    <div className="card-soft divide-y divide-border overflow-hidden">
                                        {rows.map((r, i) => {
                                            const isMe = r.user_email === data.me;
                                            return (
                                                <div key={r.user_email}
                                                    className={`flex items-center gap-3 px-4 py-3 ${isMe ? "bg-primary/5" : ""}`}>
                                                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-display font-black text-sm flex-shrink-0 ${
                                                        i === 0 ? "bg-xp text-white" : i === 1 ? "bg-secondary text-foreground" : i === 2 ? "bg-streak/70 text-white" : "text-muted-foreground"
                                                    }`}>
                                                        {i + 1}
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-sm truncate ${isMe ? "font-black text-primary" : "font-bold text-foreground"}`}>
                                                            {displayName(r, data.me)}
                                                        </p>
                                                        {b.sub(r) && <p className="text-[11px] text-muted-foreground">{b.sub(r)}</p>}
                                                    </div>
                                                    {r.streak_days > 0 && (
                                                        <span className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-streak">
                                                            <Flame className="w-3 h-3" /> {r.streak_days}
                                                        </span>
                                                    )}
                                                    <span className="font-display font-extrabold text-foreground tabular-nums">
                                                        {b.fmt(b.value(r))}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                        {myRankIdx === -1 && data?.my_atar != null && board === "atar" && (
                                            <p className="px-4 py-2.5 text-xs text-muted-foreground">You're just outside the top 50 — keep climbing.</p>
                                        )}
                                    </div>
                                )}
                            </TabsContent>
                        ))}
                    </Tabs>
                </motion.section>

                {/* ── MY PROFILE ──────────────────────────────────────── */}
                <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="space-y-6">
                    <h2 className="font-display font-extrabold text-foreground text-lg lg:text-xl">My profile</h2>
                    <GamifiedMyRank />
                    <AchievementsGallery />
                </motion.section>
            </div>
        </div>
    );
}
