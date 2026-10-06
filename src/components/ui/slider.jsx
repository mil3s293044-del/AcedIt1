import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

/**
 * ONE THUMB PER VALUE. The shadcn default renders a single `<Thumb>` whatever
 * it is handed, so a two-value range silently drew one handle and the second
 * end could never be dragged — it renders perfectly and is simply the wrong
 * control. It maps over the value now, which is what a range needs.
 *
 * `tone` is a NAMED PRESET rather than loose classes, for the reason
 * `AceShuffle`'s ink is: the track, the filled range and the thumbs are one
 * decision, and splitting them across three props is how half of it gets made.
 * Static class strings only — the JIT cannot see a template-string class name.
 */
const TONE = {
  primary: { range: "bg-primary", thumb: "border-primary", ring: "focus-visible:ring-primary/40" },
  chart4:  { range: "bg-chart-4", thumb: "border-chart-4", ring: "focus-visible:ring-chart-4/40" },
  xp:      { range: "bg-xp",      thumb: "border-xp",      ring: "focus-visible:ring-xp/40" },
};

const Slider = React.forwardRef(({ className, tone = "primary", ...props }, ref) => {
  const ink = TONE[tone] || TONE.primary;
  const values = props.value ?? props.defaultValue ?? [0];
  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn("relative flex w-full touch-none select-none items-center py-2", className)}
      {...props}>
      <SliderPrimitive.Track
        className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
        <SliderPrimitive.Range className={cn("absolute h-full", ink.range)} />
      </SliderPrimitive.Track>
      {values.map((_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          className={cn(
            "block h-5 w-5 rounded-full border-2 bg-surface shadow-soft transition-colors",
            "focus-visible:outline-none focus-visible:ring-4 disabled:pointer-events-none disabled:opacity-50",
            ink.thumb, ink.ring)} />
      ))}
    </SliderPrimitive.Root>
  );
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
