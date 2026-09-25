/**
 * ChapterRail — where you are in the film, and the way out of it.
 *
 * A DVD scene selector, not a progress bar. The hairline at the top already
 * says how far through you are; this says what the parts ARE and lets you
 * jump. That is the promise the brief makes in both directions at once — the
 * film carries you, and you are never trapped in it.
 *
 * IT NAMES THE ACTS RATHER THAN NUMBERING THEM. Ten unlabelled dots is a
 * progress bar wearing a costume: it tells a student there are ten things left
 * without telling them what any of them is, which is the exact anxiety this
 * page is trying not to create. The label is always in the DOM for a screen
 * reader and is revealed on hover for everyone else.
 *
 * THE STEPS ARE DRAWN DIFFERENTLY FROM THE SCENES, because they are a
 * different KIND of thing — one asks nothing, the other wants an answer — and
 * that is the only difference the rail is allowed to show. It is not a lock:
 * jumping straight to the wizard is a completely legitimate thing for a
 * returning student to want, and the reel's own rule is that no scene gates.
 *
 * Desktop only. On a phone it would be a column of dots over the content, and
 * the content is the film; the swipe already does this job there.
 */
import React from "react";
import { ACTS, indexOf } from "@/lib/reel";
import { useReel } from "@/components/reel/ReelContext";

export default function ChapterRail() {
    const { actId, goTo, ground } = useReel();
    // `currentColor` alone made this near-black on the three dark acts — see
    // the ground note in lib/reel. The rail belongs to no act, so it has to be
    // told which one it is over.
    const ink = ground === "dark" ? "#F4F7FB" : "#0D1626";
    const here = indexOf(actId);

    return (
        <nav
            aria-label="Chapters"
            style={{ color: ink }}
            className="hidden lg:flex fixed right-5 top-1/2 -translate-y-1/2 z-[65]
                       flex-col items-end gap-1.5 transition-colors duration-300"
        >
            {ACTS.map((a, i) => {
                const on = a.id === actId;
                const past = i < here;
                return (
                    <button
                        key={a.id}
                        type="button"
                        onClick={() => goTo(a.id)}
                        aria-current={on ? "step" : undefined}
                        className="group flex items-center gap-2.5 py-1 cursor-pointer"
                    >
                        <span
                            className={`text-[11px] font-bold tracking-wide whitespace-nowrap
                                        transition-all duration-200
                                        ${on
                                            ? "opacity-100 translate-x-0"
                                            : "opacity-0 translate-x-1 group-hover:opacity-70 group-hover:translate-x-0"}`}
                        >
                            {a.chapter}
                        </span>
                        {/* A step is a ring, a scene is a bar. Two shapes, so
                            the rail reads without relying on colour — the same
                            second-channel rule the Compete floor's step dots
                            record, learned there from a CVD check. */}
                        {a.kind === "step" ? (
                            <span
                                className={`rounded-full border-2 transition-all duration-200
                                            ${on ? "w-2.5 h-2.5 border-current"
                                                 : past ? "w-2 h-2 border-current opacity-60"
                                                        : "w-2 h-2 border-current opacity-25"}`}
                            />
                        ) : (
                            <span
                                className={`rounded-full bg-current transition-all duration-200
                                            ${on ? "w-6 h-[3px] opacity-100"
                                                 : past ? "w-3.5 h-[3px] opacity-55"
                                                        : "w-3.5 h-[3px] opacity-20"}`}
                            />
                        )}
                    </button>
                );
            })}
        </nav>
    );
}
