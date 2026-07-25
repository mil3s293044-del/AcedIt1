import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles, Lock, Info, TrendingUp, Loader2, Target } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { clubOf } from "@/lib/mockAtarMath";
import MockAtarPlanner from "./MockAtarPlanner";

/**
 * Mock ATAR — the Ranked page's personal centrepiece. Deliberately a GAME:
 * computed server-side from quiz accuracy, study minutes, practice volume
 * and streak, with a plain disclaimer that it is not a real prediction.
 * Carries the trajectory sparkline, club badge, and the "What do I need?"
 * planner.
 */

function Sparkline({ history }) {
    if (!Array.isArray(history) || history.length < 2) return null;
    const vals = history.map((h) => h.a);
    const min = Math.min(...vals), max = Math.max(...vals);
    const span = Math.max(0.5, max - min);
    const W = 96, H = 26;
    const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * W},${H - 3 - ((v - min) / span) * (H - 6)}`).join(" ");
    return (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="opacity-90" aria-hidden>
            <polyline points={pts} fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={W} cy={H - 3 - ((vals[vals.length - 1] - min) / span) * (H - 6)} r="2.5" fill="white" />
        </svg>
    );
}

export default function MockAtarCard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [plannerOpen, setPlannerOpen] = useState(false);

    useEffect(() => {
        base44.functions.invoke("computeMockAtar")
            .then((r) => setData(r?.data || r))
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, []);

    const atar = data?.atar ?? null;
    const scores = data?.scores || [];
    const history = data?.history || [];
    const unlockedCount = scores.filter((s) => !s.locked).length;

    const club = clubOf(atar);
    const prevSnap = history.length >= 2 ? history[history.length - 2].a : null;
    const delta = prevSnap != null && atar != null ? Math.round((atar - prevSnap) * 100) / 100 : null;
    const crossedClub = club && prevSnap != null && (clubOf(prevSnap)?.min || 0) < club.min;

    return (
        <motion.section
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-chart-4 to-chart-3 text-white shadow-soft p-6 lg:p-7"
        >
            <Sparkles className="absolute -top-6 -right-6 w-36 h-36 text-white/10 pointer-events-none" />
            <div className="relative">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-xs font-bold uppercase tracking-widest text-white/70">Your mock ATAR</p>
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold text-white/80"
                        title="This number is a game score built from your practice in AcedIt. It is not a prediction of your real ATAR — nobody can compute that from an app.">
                        <Info className="w-3 h-3" /> just for the game — not a real prediction
                    </span>
                    {club && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/25 px-2.5 py-0.5 text-[11px] font-black">
                            {club.emoji} {club.name}
                        </span>
                    )}
                </div>

                {crossedClub && (
                    <motion.p initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                        className="inline-block rounded-xl bg-white/20 px-3 py-1.5 text-sm font-extrabold mt-1 mb-1">
                        🎉 Welcome to the {club.name}!
                    </motion.p>
                )}

                {loading ? (
                    <div className="flex items-center gap-3 py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-white/70" />
                        <p className="text-sm text-white/70">Crunching your numbers…</p>
                    </div>
                ) : atar != null ? (
                    <div className="flex items-end justify-between gap-4 flex-wrap">
                        <div className="flex items-end gap-4 flex-wrap">
                            <p className="font-display font-black leading-none" style={{ fontSize: "clamp(3rem, 9vw, 4.75rem)" }}>
                                {atar.toFixed(2)}
                            </p>
                            <div className="mb-1.5">
                                {delta != null && delta !== 0 && (
                                    <p className={`text-sm font-extrabold ${delta > 0 ? "text-white" : "text-white/70"}`}>
                                        {delta > 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(2)} since last check-in
                                    </p>
                                )}
                                <p className="text-xs text-white/70 mt-0.5">
                                    from {unlockedCount} subject{unlockedCount === 1 ? "" : "s"}
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 mb-1">
                            <Sparkline history={history} />
                            <button onClick={() => setPlannerOpen(true)}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-white text-chart-4 hover:bg-white/90 px-3.5 py-2 text-xs font-black transition-colors shadow-soft">
                                <Target className="w-3.5 h-3.5" /> What do I need?
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="py-2">
                        <p className="font-display font-extrabold text-2xl">Locked 🔒</p>
                        <p className="text-sm text-white/75 mt-1">Do a quiz or log a study session in any subject to unlock your first mock score.</p>
                    </div>
                )}

                {/* Per-subject mock study scores */}
                {scores.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                        {scores.map((s) => (
                            <div key={s.subject}
                                className={`rounded-xl px-3 py-1.5 text-xs font-bold ${s.locked ? "bg-white/10 text-white/50" : "bg-white/20 text-white"}`}
                                title={s.locked
                                    ? `Do a quiz or study session in ${s.subject} to unlock`
                                    : `${s.attempts} quizzes · ${Math.round(s.minutes)} min studied${s.accuracy != null ? ` · ${s.accuracy}% accuracy` : ""}`}>
                                {s.subject}
                                {s.locked
                                    ? <Lock className="w-3 h-3 inline ml-1.5 -mt-0.5" />
                                    : <span className="ml-1.5 font-black">{s.score.toFixed(1)}</span>}
                            </div>
                        ))}
                    </div>
                )}

                <p className="flex items-center gap-1.5 text-[11px] text-white/60 mt-4">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Raise it with: quiz accuracy · study hours · practice volume · your streak · more subjects
                </p>
            </div>

            <MockAtarPlanner open={plannerOpen} onOpenChange={setPlannerOpen} data={data} />
        </motion.section>
    );
}
