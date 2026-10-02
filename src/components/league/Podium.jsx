/**
 * Podium — the three places that pay, drawn as the thing they are.
 *
 * ─── A LEAGUE NEEDS SOMETHING TO BE AT THE TOP OF ───────────────────────────
 * The board below is a race with every gap drawn and it answers "where am I".
 * It cannot answer "what am I racing FOR", because a ranked list makes 1st,
 * 2nd and 3rd look like the first three rows of thirty. The payout was the
 * other half of that: the league computed a finish every week and paid nothing
 * with it, so there was nothing at the top either.
 *
 * ─── THE REWARD IS PRINTED ON THE STEP ──────────────────────────────────────
 * Each place says what it pays — Monday's credits and the XP — because a
 * student deciding whether a quiet Thursday is worth one more session is
 * weighing exactly that, and a podium that just draws three heights is
 * decoration. `grantForLeague` is the same function the server grants with, so
 * the figure on the step is the figure that lands.
 *
 * ─── WIDER IS 2-1-3, NARROW IS A LIST ───────────────────────────────────────
 * The stepped arrangement is what makes a podium read as a podium, and at
 * phone width three stepped columns are three unreadable slivers. Under `sm`
 * the same three rows stack in rank order, which is honest about being a list
 * rather than a squashed podium — the "one pack per row on a phone is correct"
 * call, on a different object.
 */
import React from "react";
import { motion } from "framer-motion";
import Crest from "@/components/shared/Crest";
import { PODIUM, leagueXPFor, podiumCrest, ordinal } from "@/lib/league";
import { grantForLeague } from "@/lib/credStore";

// Heights are relative and only used at `sm` and up, where the step reads.
const STEP = { 1: "sm:h-28", 2: "sm:h-24", 3: "sm:h-20" };
// First gets the XP amber; the other two read as top-three without inventing a
// bronze token — WeeklyBoard's own medal note refused that, and so does Crest.
const FACE = {
    1: "bg-xp/15 border-xp/40",
    2: "bg-secondary border-border",
    3: "bg-secondary border-border",
};
// 2-1-3 across, so first stands in the middle. Static classes only; JIT cannot
// see a template-string order.
const ORDER = { 1: "sm:order-2", 2: "sm:order-1", 3: "sm:order-3" };

export default function Podium({ rows = [], groupSize = 30, tiered = false }) {
    // ── A BOARD WITH NO PODIUM DOES NOT PRINT ONE ───────────────────────────
    // Three paid places out of two students is not a podium, it is everybody —
    // and congratulating the only person here is the failure `leagueLead`
    // refuses with "1st of 1".
    if (rows.length <= PODIUM) return null;

    const top = rows.slice(0, PODIUM);

    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 sm:items-end">
            {top.map((r) => {
                const place = r.position;
                const credits = grantForLeague({
                    position: place, groupSize, tiered, tierIndex: 0,
                });
                const xp = leagueXPFor(place);
                return (
                    <motion.div
                        key={`${place}-${r.display_name}`}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: (PODIUM - place) * 0.06, ease: "easeOut" }}
                        className={`${ORDER[place]} flex flex-col`}
                    >
                        <div className="flex items-center gap-1.5 px-1 pb-1.5 min-w-0">
                            <Crest podium={podiumCrest(place)} />
                            <span className={`font-bold text-sm truncate
                                ${r.is_me ? "text-primary" : "text-foreground"}`}>
                                {r.display_name}
                            </span>
                            {r.is_me && <span className="stat-label text-primary flex-shrink-0">you</span>}
                        </div>
                        <div className={`rounded-2xl border-2 px-3 py-2.5 sm:py-3 flex sm:flex-col
                            items-center justify-between sm:justify-end gap-2 ${FACE[place]} ${STEP[place]}
                            ${r.is_me ? "ring-2 ring-primary/30" : ""}`}>
                            <span className={`font-display font-black text-xl tabular-nums
                                ${place === 1 ? "text-xp" : "text-foreground"}`}>
                                {ordinal(place)}
                            </span>
                            <span className="text-[11px] font-bold text-muted-foreground tabular-nums
                                text-right sm:text-center">
                                {credits.toLocaleString()} credits
                                {xp > 0 && <span className="hidden sm:inline"><br /></span>}
                                {xp > 0 && <span className="sm:hidden"> · </span>}
                                {xp > 0 && `+${xp} XP`}
                            </span>
                        </div>
                    </motion.div>
                );
            })}
        </div>
    );
}
