/**
 * RivalryStrip — the people you are actually racing.
 *
 * ─── Why a person and not a battle ──────────────────────────────────────────
 * Compete listed CONTESTS: "Chemistry Sprint", "7-day duel". But nobody comes
 * back to an app to check on a contest — they come back to check on a person.
 * "Priya is 5 ahead of you" is the sentence that gets opened; "Chemistry
 * Sprint: 400 v 395" is the same fact with the interesting half removed.
 *
 * ─── The head-to-head is what makes it a rivalry ────────────────────────────
 * One race is a race. A race plus "3–2, and she's called you out twice" is a
 * story you are already in the middle of, and it costs nothing to show because
 * `rivalries()` derives all of it from rows the page has already loaded.
 *
 * A gap is drawn as a SIGNED number against a bar rather than as two scores,
 * because the distance is what you can act on and the totals are not. Under
 * ten points it is coloured, over that it is grey — a lead you cannot lose
 * this week is not a rivalry, it is a fact.
 */
import React from "react";
import { motion } from "framer-motion";
import { Swords, ShieldAlert } from "lucide-react";

const firstName = (n) => String(n || "").trim().split(/\s+/)[0] || "Someone";
const initials = (n) => String(n || "?").trim().split(/\s+/).slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "").join("") || "?";

/** Deterministic colour per person, so a rival looks the same everywhere. */
const HUES = ["--chart-3", "--chart-4", "--primary", "--xp", "--streak"];
function hueOf(email) {
    let h = 0;
    const s = String(email || "");
    for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return HUES[h % HUES.length];
}

const CLOSE = 10;

export default function RivalryStrip({ rivals = [], onOpen }) {
    if (!rivals.length) return null;

    return (
        <motion.section
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display font-extrabold text-foreground text-base flex items-center gap-2">
                    <Swords className="w-4 h-4 text-chart-4" /> Who you're racing
                </h2>
            </div>

            {/* Scrolls on a phone rather than shrinking. Six avatars squeezed
                into 390px are six things nobody can read — the same call the
                rank ladder makes. */}
            <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
                {rivals.map((r, i) => {
                    const live = r.live > 0 && r.gap != null;
                    const ahead = (r.gap ?? 0) >= 0;
                    const close = live && Math.abs(r.gap) <= CLOSE;
                    const hue = hueOf(r.email);
                    const played = r.wins + r.losses;
                    return (
                        <motion.button
                            key={r.email}
                            type="button"
                            onClick={() => onOpen?.(r)}
                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.04 * i }}
                            className="snap-start flex-shrink-0 w-[168px] text-left rounded-2xl border-2 border-border
                                bg-surface p-3 hover:border-foreground/20 transition-colors"
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <span className="w-8 h-8 rounded-xl flex items-center justify-center
                                        font-display font-black text-xs text-white flex-shrink-0"
                                    style={{ background: `hsl(var(${hue}))` }}>
                                    {initials(r.name)}
                                </span>
                                <span className="font-bold text-sm text-foreground truncate">
                                    {firstName(r.name)}
                                </span>
                            </div>

                            {live ? (
                                <>
                                    <p className={`font-display font-black text-lg leading-none tabular-nums
                                        ${close ? (ahead ? "text-primary" : "text-streak") : "text-muted-foreground"}`}>
                                        {ahead ? "+" : ""}{r.gap}
                                        <span className="text-[11px] font-bold text-muted-foreground ml-1">
                                            {ahead ? "ahead" : "behind"}
                                        </span>
                                    </p>
                                    {/* ── THE BAR IS HOW MUCH OF A RACE THIS
                                        STILL IS, and it used to be the exact
                                        opposite. It drew the gap, so a 34-point
                                        blowout filled the bar solid green and a
                                        five-point nail-biter drew a stub —
                                        every other bar in this app means full
                                        is good, so the two cards a student most
                                        needs to tell apart were drawn back to
                                        front. It fills as the gap CLOSES. */}
                                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden mt-1.5">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${Math.max(0, 1 - Math.abs(r.gap) / (CLOSE * 2)) * 100}%` }}
                                            transition={{ duration: 0.7, ease: "easeOut" }}
                                            className={`h-full rounded-full ${
                                                !close ? "bg-muted-foreground/40"
                                                : ahead ? "bg-primary" : "bg-streak"}`} />
                                    </div>
                                </>
                            ) : (
                                <p className="font-display font-black text-lg leading-none text-muted-foreground">
                                    {played ? `${r.wins}–${r.losses}` : "—"}
                                    <span className="text-[11px] font-bold text-muted-foreground ml-1">
                                        {played ? "all time" : "no history yet"}
                                    </span>
                                </p>
                            )}

                            <p className="text-[11px] text-muted-foreground mt-1.5 truncate">
                                {r.calledMe > 0
                                    ? <span className="inline-flex items-center gap-1 text-xp font-bold">
                                        <ShieldAlert className="w-3 h-3" />
                                        called you out {r.calledMe === 1 ? "once" : `${r.calledMe}×`}
                                    </span>
                                    : played
                                        ? `${r.wins}–${r.losses} between you`
                                        : `${r.live} live`}
                            </p>
                        </motion.button>
                    );
                })}
            </div>
        </motion.section>
    );
}
