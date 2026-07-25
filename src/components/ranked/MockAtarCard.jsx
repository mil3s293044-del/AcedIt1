import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles, Lock, Info, TrendingUp, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

/**
 * Mock ATAR — the Ranked page's personal centrepiece. Deliberately a GAME:
 * the score is computed server-side from quiz accuracy, study minutes,
 * practice volume and streak, and the card carries a plain disclaimer that
 * it is not a real prediction. The point is a number worth grinding.
 */
export default function MockAtarCard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        base44.functions.invoke("computeMockAtar")
            .then((r) => setData(r?.data || r))
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, []);

    const atar = data?.atar ?? null;
    const scores = data?.scores || [];
    const unlockedCount = scores.filter((s) => !s.locked).length;

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
                </div>

                {loading ? (
                    <div className="flex items-center gap-3 py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-white/70" />
                        <p className="text-sm text-white/70">Crunching your numbers…</p>
                    </div>
                ) : atar != null ? (
                    <div className="flex items-end gap-4 flex-wrap">
                        <p className="font-display font-black leading-none" style={{ fontSize: "clamp(3rem, 9vw, 4.75rem)" }}>
                            {atar.toFixed(2)}
                        </p>
                        <p className="text-sm text-white/75 mb-2 max-w-[220px]">
                            Built from {unlockedCount} subject{unlockedCount === 1 ? "" : "s"} — quizzes, hours and streak all push it up.
                        </p>
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
        </motion.section>
    );
}
