/**
 * ProgressTabs — the bar, as a component so it can be MEASURED.
 *
 * /Review is auth-gated and the one thing that settles a tab bar is opening it
 * at 360, where this is a full-width `grid-cols-5` and each cell is about 66px.
 * That is the width at which the Ranked bar wrapped "My profile" onto two lines
 * and then clipped "Leaderboard" inside its own pill — both of which render,
 * neither of which throws, and only a measurement finds. Drawn from the probe
 * it is the real component rather than a copy of its class list, which is the
 * copy that drifts and leaves the measurement describing something else.
 *
 * ONE WORD PER CELL and the icons hidden below `sm`: a glyph beside "Quizzes"
 * restates the word next to it, which is decoration exactly where width is the
 * binding constraint.
 *
 * MEASURED, and the first draft failed: at 360 with `text-[13px] px-1` the cell
 * is 59px and "Mistakes" was CLIPPED INSIDE ITS OWN PILL — the identical fault
 * the Ranked bar hit, found the identical way, by comparing each button's
 * `scrollWidth` against its `clientWidth` rather than by looking at it. `text-xs
 * px-0.5` below `sm` is the smallest change that clears it; renaming the tab was
 * the other option and it is not available, because "Mistakes" is what
 * /MistakeBank is called everywhere else and `reachable.test.mjs` exists to stop
 * one screen being given two names.
 */
import React from "react";

export default function ProgressTabs({ tabs = [], value, onChange }) {
    return (
        <div role="tablist" aria-label="Progress"
            className="grid grid-cols-5 gap-1 p-1.5 rounded-2xl bg-surface border-2 border-border shadow-soft">
            {tabs.map(([id, label, Icon]) => {
                const on = id === value;
                return (
                    <button key={id} type="button" role="tab" aria-selected={on}
                        onClick={() => onChange(id)}
                        className={`flex items-center justify-center gap-1.5 py-2.5 px-0.5 sm:px-4 rounded-xl
                            text-xs sm:text-sm font-bold whitespace-nowrap transition-all
                            ${on ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
                        {Icon && <Icon className="hidden sm:block w-4 h-4" aria-hidden="true" />} {label}
                    </button>
                );
            })}
        </div>
    );
}
