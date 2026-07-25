import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Zap, Clock, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

const MEDALS = ["🥇", "🥈", "🥉"];

function hoursLabel(minutes) {
    const h = Math.floor((minutes || 0) / 60);
    const m = Math.round((minutes || 0) % 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Global rankings by total XP and study hours (the classic boards, restored),
 * with each player's mock ATAR displayed as a badge. Reads the public
 * leaderboards table; anonymous players show as "Anonymous".
 */
export default function GlobalLeaderboard() {
    const [metric, setMetric] = useState("xp"); // xp | hours
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [myEmail, setMyEmail] = useState(null);

    useEffect(() => {
        base44.auth.me().then((u) => setMyEmail(u?.email || null)).catch(() => {});
    }, []);

    useEffect(() => {
        let on = true;
        setLoading(true);
        const sortField = metric === "xp" ? "-total_xp" : "-total_study_time";
        base44.entities.Leaderboard.filter({}, sortField, 50)
            .then((list) => { if (on) setRows(list || []); })
            .catch(() => { if (on) setRows([]); })
            .finally(() => { if (on) setLoading(false); });
        return () => { on = false; };
    }, [metric]);

    return (
        <div className="space-y-4">
            {/* Metric toggle */}
            <div className="flex gap-2">
                <button onClick={() => setMetric("xp")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-sm font-bold border-2 transition-all ${
                        metric === "xp" ? "bg-xp border-xp text-white shadow-soft" : "bg-surface border-border text-muted-foreground hover:border-xp/40"
                    }`}>
                    <Zap className="w-4 h-4" /> Total XP
                </button>
                <button onClick={() => setMetric("hours")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-sm font-bold border-2 transition-all ${
                        metric === "hours" ? "bg-chart-3 border-chart-3 text-white shadow-soft" : "bg-surface border-border text-muted-foreground hover:border-chart-3/40"
                    }`}>
                    <Clock className="w-4 h-4" /> Study hours
                </button>
            </div>

            {loading ? (
                <div className="card-soft p-10 flex items-center justify-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading rankings…
                </div>
            ) : rows.length === 0 ? (
                <div className="card-soft p-10 text-center text-sm text-muted-foreground">
                    No rankings yet — do a study session and claim the top spot.
                </div>
            ) : (
                <div className="card-soft overflow-hidden divide-y divide-border/60">
                    {rows.map((r, i) => {
                        const isMe = r.user_email === myEmail;
                        const name = r.is_anonymous ? "Anonymous" : (r.username || r.user_name || "Student");
                        return (
                            <motion.div key={r.id || r.user_email}
                                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.4) }}
                                className={`flex items-center gap-3 px-4 py-3 ${isMe ? "bg-primary/5" : ""}`}>
                                <span className="w-8 text-center font-display font-extrabold text-sm flex-shrink-0">
                                    {i < 3 ? <span className="text-lg">{MEDALS[i]}</span> : <span className="text-muted-foreground/60">{i + 1}</span>}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-bold truncate ${isMe ? "text-primary" : "text-foreground"}`}>
                                        {name}{isMe && <span className="text-[10px] text-primary/70 ml-1.5">you</span>}
                                    </p>
                                </div>
                                {r.mock_atar != null && (
                                    <span className="pill bg-chart-4/10 text-chart-4 flex-shrink-0"
                                        title="Mock ATAR — a game score from practice in AcedIt, not a real prediction">
                                        ATAR {Number(r.mock_atar).toFixed(2)}
                                    </span>
                                )}
                                <span className="font-display font-extrabold text-sm text-foreground flex-shrink-0 tabular-nums">
                                    {metric === "xp" ? `${(r.total_xp || 0).toLocaleString()} XP` : hoursLabel(r.total_study_time)}
                                </span>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            <p className="text-[11px] text-muted-foreground/60 text-center">
                Mock ATAR badges are game scores from practice in AcedIt — not real predictions.
            </p>
        </div>
    );
}
