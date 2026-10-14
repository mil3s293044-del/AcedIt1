/**
 * AceHost — Ace running the deal, on every screen of the signup wizard.
 *
 * He says one thing per screen and it is a REACTION to the answer before: the
 * weeks a year leaves, what VTAC does to the subjects just picked. Never a
 * compliment — "great choice!" is what a form says when it has nothing, and
 * the lines come out of `aceLines` (onboardingFlow.js) so a test can hold them
 * to the calendar and the catalogue they quote.
 *
 * TWO PLACES, ONE BODY. On a desktop he stands on the dark table, inked light
 * the way he is on the Compete floor; on a phone he is a small figure beside
 * the question, in the app's own ink. One component draws both so there is
 * one place that claims the stage — `aceStage.test.mjs` scans the files that
 * draw a body and requires each to claim, because a surface that forgets
 * renders perfectly and is simply a second Ace.
 *
 * HE MOVES WHEN A CARD IS DEALT. `dealt` is the number of cards on the table;
 * when it goes up he tosses, then settles back to the screen's own pose. A
 * mascot standing still while cards fly past him is watching the deal, not
 * dealing it — the lesson AceDeal records on the floor.
 *
 * The bubble never empties between screens: `AceSay` swaps its lines in place
 * and reveals them as lines, which is the fix the first run's bubble needed.
 */
import React, { useEffect, useRef, useState } from "react";
import AceBody from "@/components/ace/AceBody";
import { AceSay, AceLine } from "@/components/ace/AceWalker";
import { claimAce } from "@/components/ace/useAceYield";

const TOSS_MS = 720;

/** The screen's pose, interrupted by a toss whenever a card lands. */
function useDealPose(pose, dealt) {
    const [tossing, setTossing] = useState(false);
    const last = useRef(dealt);
    useEffect(() => {
        if (dealt > last.current) {
            setTossing(true);
            const t = window.setTimeout(() => setTossing(false), TOSS_MS);
            last.current = dealt;
            return () => window.clearTimeout(t);
        }
        last.current = dealt;
        return undefined;
    }, [dealt]);
    return tossing ? "toss" : pose;
}

export default function AceHost({ variant = "row", lines = [], beat, pose = "stand", dealt = 0 }) {
    useEffect(() => claimAce("onboarding"), []);
    const shown = useDealPose(pose, dealt);
    const [first, ...rest] = lines;

    if (variant === "table") {
        return (
            <div className="flex items-end gap-3">
                <AceBody
                    className="w-[5.5rem] flex-shrink-0 -mb-1"
                    pose={shown}
                    tone="fill-[#F4F1EA]"
                    card="fill-[#1A2742]"
                    cardStroke="stroke-[#33456A]"
                    title="Ace"
                />
                {lines.length > 0 && (
                    <div className="relative mb-6 max-w-[17rem] rounded-2xl rounded-bl-md
                        bg-white/[0.08] border border-white/[0.12] backdrop-blur-sm
                        px-4 py-3 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.6)]">
                        <AceSay beat={beat}>
                            <AceLine className="font-display font-extrabold text-[15px] leading-snug text-balance text-[#F4F1EA]">
                                {first}
                            </AceLine>
                            {rest.map((l) => (
                                <AceLine key={l} className="text-[13px] leading-snug text-[#F4F1EA]/70 mt-1">
                                    {l}
                                </AceLine>
                            ))}
                        </AceSay>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="flex items-end gap-2.5">
            <AceBody className="w-11 flex-shrink-0" pose={shown} title="Ace" idle={false} />
            {lines.length > 0 && (
                <div className="relative flex-1 min-w-0 rounded-2xl rounded-bl-md bg-surface
                    border border-border px-3.5 py-2.5 shadow-soft">
                    <AceSay beat={beat}>
                        <AceLine className="font-display font-extrabold text-sm leading-snug text-balance text-foreground">
                            {first}
                        </AceLine>
                        {rest.map((l) => (
                            <AceLine key={l} className="text-xs leading-snug text-muted-foreground mt-0.5">
                                {l}
                            </AceLine>
                        ))}
                    </AceSay>
                </div>
            )}
        </div>
    );
}
