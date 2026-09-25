/**
 * Act IV — THE SCIENCE. The claim, made checkable.
 *
 * NOTHING HERE IS MARKETING ART, and that is the whole argument. The rotating
 * cloud is `BrainModel`, the same component the Study page and the Analytics
 * cognition tab render, and the regions it lights come from `TECHNIQUE_NEURO`
 * — the same table the product uses, with the same citations attached. Pick a
 * technique here and you are looking at exactly what a student sees inside.
 *
 * The cheapest way to claim "built on the research" is a stock photo of a
 * glowing brain and the word neuroscience. Wiring the marketing page to the
 * product's own model means the claim can be AUDITED: if the science in the app
 * changed, this act would change with it, because there is only one copy.
 *
 * THE PICTURE IS ATMOSPHERE; THE TEXT IS THE CONTENT. Every fact is in the HTML
 * beside the canvas, so a screen reader, a crawler and anyone on reduced motion
 * gets all of it. If the canvas never painted, nothing factual would be lost —
 * which is also why this act is safe to run at the top of the motion budget.
 */
import React, { useState } from "react";
import BrainShowcase from "@/components/marketing/BrainShowcase";
import { useAct } from "@/components/reel/ReelContext";
import Cue from "@/components/reel/Cue";

const INK = "#F4F7FB";

export default function ActScience() {
    const { advance, deal } = useAct("science");
    const [picked, setPicked] = useState(false);

    return (
        <div className="w-full flex flex-col items-center" style={{ color: INK }}>
            <div className="text-center">
                <p className="text-[11px] sm:text-xs font-black tracking-[0.2em] uppercase opacity-40">
                    Why it works
                </p>
                {/* SIZED TO FIT, like the other tall acts. At lg:3.1rem over
                    two lines this act ran past the fold and the fixed hand
                    rail landed on its cue. */}
                <h2 className="mt-2 font-display font-black leading-[1.03] tracking-tight
                               text-[7vw] sm:text-[3.4vw] lg:text-[2.5rem] max-w-4xl mx-auto">
                    Not a study app with{" "}
                    <span className="opacity-45">a brain drawn on it.</span>
                </h2>
            </div>

            <div className="mt-6 w-full max-w-5xl">
                <BrainShowcase
                    height={320}
                    onPick={(t) => { setPicked(true); deal({ technique: t }); }}
                />
            </div>

            <Cue done={picked} onAdvance={advance} nextLabel="What it costs" ink={INK}>
                Pick a technique and watch what moves
            </Cue>
        </div>
    );
}
