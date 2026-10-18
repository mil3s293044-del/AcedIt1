/**
 * Podium — the three places that pay, dealt onto the table as Ace, King, Queen.
 *
 * ─── A LEAGUE NEEDS SOMETHING TO BE AT THE TOP OF ───────────────────────────
 * The board below is a race with every gap drawn and it answers "where am I".
 * It cannot answer "what am I racing FOR", because a ranked list makes 1st,
 * 2nd and 3rd look like the first three rows of thirty. The payout was the
 * other half of that: the league computed a finish every week and paid nothing
 * with it, so there was nothing at the top either.
 *
 * ─── THE REWARD IS PRINTED ON THE STEP ──────────────────────────────────────
 * Each plinth says what that place pays — the crest worn next week, Monday's
 * credits and the XP — because a student deciding whether a quiet Thursday is
 * worth one more session is weighing exactly that, and a podium that just
 * draws three heights is decoration. `grantForLeague` is the same function the
 * server grants with, so the figure on the step is the figure that lands.
 *
 * The table itself is `CardPodium`, shared with Ranked and the study-group
 * week, so the three boards a student moves between deal one podium.
 */
import React from "react";
import Crest from "@/components/shared/Crest";
import CardPodium from "@/components/boards/CardPodium";
import { PODIUM, leagueXPFor, podiumCrest } from "@/lib/league";
import { grantForLeague } from "@/lib/credStore";

const plain = (v) => Math.round(Number(v) || 0).toLocaleString();

export default function Podium({ rows = [], groupSize = 30, tiered = false }) {
    // ── A BOARD WITH NO PODIUM DOES NOT PRINT ONE ───────────────────────────
    // Three paid places out of two students is not a podium, it is everybody —
    // and congratulating the only person here is the failure `leagueLead`
    // refuses with "1st of 1".
    if (rows.length <= PODIUM) return null;

    const top = rows.slice(0, PODIUM);

    return (
        <CardPodium layoutScope="league" label="This week's podium"
            entries={top.map((r, i) => {
                const place = i + 1;
                const credits = grantForLeague({
                    position: place, groupSize, tiered, tierIndex: 0,
                });
                const xp = leagueXPFor(place);
                return {
                    key: r.display_name,
                    name: r.display_name,
                    isMe: !!r.is_me,
                    figure: { value: r.compete_score, format: plain, quantity: "compete" },
                    // The crest sits on a light token: it inks itself in the
                    // app's own tokens, which do not read on the dark felt.
                    reward: (
                        <>
                            <span className="inline-flex items-center justify-center gap-1">
                                <span className="inline-flex rounded-full bg-[#F4F1EA] p-[2px]">
                                    <Crest podium={podiumCrest(place)} />
                                </span>
                                <span className="tabular-nums">{credits.toLocaleString()}</span>
                            </span>
                            <span className="block">
                                credits{xp > 0 && <span className="tabular-nums"> · +{xp} XP</span>}
                            </span>
                        </>
                    ),
                };
            })} />
    );
}
