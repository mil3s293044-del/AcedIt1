/**
 * SetupControls — the controls the three study-setup screens share.
 *
 * ─── THE SAME CONTROL WAS WRITTEN THREE TIMES, AND SEVEN MORE WERE DROPDOWNS ─
 * Active Recall had a flush row of `[4, 6, 8, 12]` buttons, Blurting had the
 * same row for `[5, 10, 15, 20]`, and the quiz generator — the richest setup in
 * the app — had none of it: seven stacked `<Select>`s, which is a form rather
 * than a screen, and which reads as generated for the reason this codebase
 * already records about the quiz list ("a grid of those is precisely what makes
 * an app look generated"). The two hand-rolled rows were also a copy waiting to
 * drift: one of them had already picked up a hover state the other had not.
 *
 * A dropdown hides its options until you open it, so for a closed set of three
 * or four a SEGMENTED row is strictly better — everything visible, one tap, and
 * the chosen value readable without opening anything. A dropdown stays right
 * for a long list, which is why the subject picker is untouched.
 *
 * ─── A SLIDER PRINTS ITS VALUE ON THE LABEL ROW ─────────────────────────────
 * Never under the track and never only in a tooltip: the value is the thing the
 * student is setting, so it sits at the top of the field at full weight where
 * the eye already is, and the track is the control. That is also what makes the
 * two-handle range readable — "2 to 6 marks" is a sentence, where two numbers
 * floating under two handles is a puzzle.
 *
 * `tone` is a NAMED PRESET, the `AceShuffle` rule: a control's border, fill and
 * ink are one decision. Static class strings only — the JIT cannot see a
 * template-string class name.
 */
import React from "react";
import { Slider } from "@/components/ui/slider";

export const TONE = {
    primary: {
        slider: "primary",
        on: "border-primary bg-primary/10 text-foreground",
        chipOn: "border-primary bg-primary/10 text-primary",
        value: "text-primary",
    },
    chart4: {
        slider: "chart4",
        on: "border-chart-4 bg-chart-4/10 text-foreground",
        chipOn: "border-chart-4 bg-chart-4/10 text-chart-4",
        value: "text-chart-4",
    },
    xp: {
        slider: "xp",
        on: "border-xp bg-xp/10 text-foreground",
        chipOn: "border-xp bg-xp/10 text-xp",
        value: "text-xp",
    },
};
const inkFor = (tone) => TONE[tone] || TONE.primary;

const OFF = "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/40";

/**
 * A labelled row. `value` is the readout — the figure a slider is setting, or
 * nothing at all for a segmented row, where the control already says it.
 */
export function Field({ label, optional = false, value = null, hint = null, tone = "primary", children }) {
    const ink = inkFor(tone);
    return (
        <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-muted-foreground">
                    {label}
                    {optional && <span className="text-muted-foreground/60 font-normal"> (optional)</span>}
                </span>
                {value != null && (
                    <span className={`text-sm font-display font-extrabold tabular-nums ${ink.value}`}>{value}</span>
                )}
            </div>
            {children}
            {hint && <p className="text-[11px] leading-snug text-muted-foreground/80">{hint}</p>}
        </div>
    );
}

/**
 * A closed set, all of it on screen. `options` is `[{ value, label, sub }]`;
 * `sub` is the second line a difficulty row wants ("Exam level") and is dropped
 * below `sm`, where four cells of two lines is a control taller than it is wide.
 */
export function Segmented({ value, onChange, options = [], tone = "primary", size = "md" }) {
    const ink = inkFor(tone);
    const pad = size === "sm" ? "py-1.5 text-xs" : "py-2.5 text-sm";
    // FOUR CELLS OF WORDS DO NOT FIT A PHONE. At 390 a four-option row gives
    // each cell about 75px, and "Written", "Extended", "Standard" and
    // "Revision" all came back clipped mid-word — which reads as a rendering
    // fault rather than as a choice, and is the same complaint the mistake
    // bank's cut-off questions drew. Shortening the words to fit would make
    // the control cryptic, so the ROW wraps instead: two columns below `sm`,
    // one row from `sm` up. Three or fewer still fit a line at every width,
    // and a 2-up grid of three leaves an orphan cell, so they stay a row.
    const wrap = options.length >= 4 ? "grid grid-cols-2 sm:flex" : "flex";
    return (
        <div className={`${wrap} gap-1.5`}>
            {options.map(o => {
                const on = o.value === value;
                return (
                    <button key={String(o.value)} type="button"
                        onClick={() => onChange?.(o.value)}
                        aria-pressed={on}
                        className={`flex-1 min-w-0 rounded-xl border-2 px-2 ${pad} font-bold
                            transition-colors ${on ? ink.on : OFF}`}>
                        <span className="block truncate">{o.label}</span>
                        {o.sub && (
                            <span className="hidden sm:block text-[10px] font-medium opacity-70 truncate">{o.sub}</span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

/** One handle. The caller prints the value through `Field`. */
export function StepSlider({ value, onChange, min, max, step = 1, tone = "primary", ...rest }) {
    return (
        <Slider tone={inkFor(tone).slider} min={min} max={max} step={step}
            value={[value]} onValueChange={(v) => onChange?.(v[0])} {...rest} />
    );
}

/**
 * Two handles over one scale.
 *
 * `minStepsBetweenThumbs` is 0 on purpose: collapsing the range onto one value
 * is a legitimate answer ("every question is worth 3"), and forbidding it would
 * make the control unable to express the setting it replaced.
 */
export function RangeSlider({ value, onChange, min, max, step = 1, tone = "primary", ...rest }) {
    return (
        <Slider tone={inkFor(tone).slider} min={min} max={max} step={step}
            minStepsBetweenThumbs={0}
            value={value} onValueChange={(v) => onChange?.(v)} {...rest} />
    );
}

/** One of many. Used where the set is long enough to wrap. */
export function ChipToggle({ active, onClick, disabled = false, tone = "primary", children }) {
    const ink = inkFor(tone);
    return (
        <button type="button" onClick={onClick} disabled={disabled} aria-pressed={active}
            className={`rounded-lg border-2 px-2.5 py-1 text-xs font-bold transition-colors
                disabled:opacity-40 disabled:cursor-not-allowed
                ${active ? ink.chipOn : OFF}`}>
            {children}
        </button>
    );
}

export default { Field, Segmented, StepSlider, RangeSlider, ChipToggle, TONE };
