/**
 * Act V — WHAT IT COSTS. The anchor, dragged by the reader.
 *
 * THE COMPARISON IS A PRIVATE TUTOR, because that is what a VCE family actually
 * weighs this against. Comparing against another app answers a question nobody
 * in the house is asking.
 *
 * AND THE READER SETS THE TERMS. A static "$90/hr vs $5/wk" is our number
 * against our number, which is exactly the shape of every pricing page and is
 * read as such. Dragging your OWN tutoring hours makes the arithmetic yours:
 * the figure that lands is one you specified, so there is nothing to argue
 * with. Two hours a week is the modal answer and where the handle opens.
 *
 * EVERY NUMBER IS CONSERVATIVE AND THE ASYMMETRY FLATTERS US LEAST — tutoring
 * over 40 school weeks (nobody books through summer), AcedIt over the full 52
 * (the subscription does not pause). See `tutorGap` in lib/reel, which is the
 * one copy of this arithmetic and is asserted. The honest comparison already
 * wins by a mile, and an exaggerated one is checkable in four seconds by
 * anyone with a parent.
 *
 * AT ZERO HOURS THE ACT DEALS NOTHING. AcedIt costs more than no tutor at all,
 * and a card reading "$0 the gap, over a year" would be the screen shrugging.
 * The honest reading at zero is that no comparison is being made.
 */
import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { tutorGap, TUTOR_HOURLY, ACEDIT_WEEKLY, TUTOR_HOURS_MAX, TUTOR_WEEKS } from "@/lib/reel";
import { useAct } from "@/components/reel/ReelContext";
import Cue from "@/components/reel/Cue";

const INK = "#0D1626";
const OPEN_AT = 2;

export default function ActCost() {
    const { advance, deal } = useAct("cost");
    const [hours, setHours] = useState(OPEN_AT);
    const [touched, setTouched] = useState(false);
    const g = useMemo(() => tutorGap(hours), [hours]);

    const onDrag = (v) => {
        const h = Number(v);
        setHours(h);
        setTouched(true);
        deal({ yearGap: tutorGap(h).gap });
    };

    const fillPct = (hours / TUTOR_HOURS_MAX) * 100;
    const money = (n) => `$${n.toLocaleString()}`;

    return (
        <div className="w-full flex flex-col items-center text-center" style={{ color: INK }}>
            <p className="text-[11px] sm:text-xs font-black tracking-[0.2em] uppercase opacity-45">
                What it costs
            </p>
            <h2 className="mt-3 font-display font-black leading-[1.02] tracking-tight
                           text-[8vw] sm:text-[4.4vw] lg:text-[3.1rem] max-w-3xl">
                Same help.
                <br className="hidden sm:block" />{" "}
                <span className="opacity-40">Different invoice.</span>
            </h2>

            <p className="mt-6 text-sm sm:text-base font-bold opacity-60">
                How many hours of tutoring a week?
            </p>

            <div className="mt-4 w-full max-w-md px-2">
                <div className="font-display font-black text-4xl sm:text-5xl tabular-nums">
                    {hours}<span className="text-xl sm:text-2xl opacity-40"> hr/wk</span>
                </div>
                <input
                    type="range"
                    min={0} max={TUTOR_HOURS_MAX} step={1} value={hours}
                    onChange={(e) => onDrag(e.target.value)}
                    aria-label="Hours of tutoring per week"
                    aria-valuetext={`${hours} hours a week: ${money(g.tutor)} a year`}
                    className="reel-range mt-4 w-full h-2 rounded-full appearance-none cursor-pointer"
                    style={{
                        background: `linear-gradient(to right, ${INK} 0%, ${INK} ${fillPct}%, rgba(13,22,38,0.14) ${fillPct}%, rgba(13,22,38,0.14) 100%)`,
                    }}
                />
            </div>

            {/* The two columns. The tutor's figure is the one that moves, which
                is the whole demonstration — ours does not, because it cannot. */}
            <div className="mt-9 w-full max-w-2xl grid grid-cols-2 gap-3 sm:gap-6">
                <div className="rounded-2xl bg-white border-2 border-black/10 p-4 sm:p-7">
                    <p className="text-[10px] sm:text-xs font-black uppercase tracking-wider opacity-45">
                        A tutor
                    </p>
                    <motion.p
                        key={g.tutor}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25 }}
                        className="mt-2 font-display font-black tabular-nums leading-none
                                   text-[9vw] sm:text-[3.4rem]"
                        style={{ color: "#FF4B4B" }}
                    >
                        {money(g.tutor)}
                    </motion.p>
                    <p className="mt-2 text-[11px] sm:text-sm font-bold opacity-50 leading-snug">
                        {money(TUTOR_HOURLY)}/hr &times; {TUTOR_WEEKS} school weeks
                    </p>
                </div>

                <div className="rounded-2xl bg-[#0D1626] text-white p-4 sm:p-7">
                    <p className="text-[10px] sm:text-xs font-black uppercase tracking-wider opacity-45">
                        AcedIt
                    </p>
                    <p className="mt-2 font-display font-black tabular-nums leading-none
                                  text-[9vw] sm:text-[3.4rem] text-primary">
                        {money(g.acedit)}
                    </p>
                    <p className="mt-2 text-[11px] sm:text-sm font-bold opacity-50 leading-snug">
                        ${ACEDIT_WEEKLY}/wk, all year, every subject
                    </p>
                </div>
            </div>

            <motion.p
                className="mt-6 h-7 text-sm sm:text-lg font-bold"
                initial={false}
                animate={{ opacity: g.gap > 0 ? 1 : 0 }}
                transition={{ duration: 0.25 }}
            >
                {g.gap > 0 && (
                    <>
                        <span className="font-black text-primary">{money(g.gap)}</span>
                        <span className="opacity-60"> difference, over a year.</span>
                    </>
                )}
            </motion.p>

            <Cue done={touched} onAdvance={advance} nextLabel="Deal me in" ink={INK}>
                Drag the hours
            </Cue>
        </div>
    );
}
