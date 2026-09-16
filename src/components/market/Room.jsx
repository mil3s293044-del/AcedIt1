/**
 * Room — the floor's ground, shared by every screen that is part of it.
 *
 * ─── IT IS A DIFFERENT ROOM, AND THE DARKNESS WAS NEVER WHAT MADE IT ONE ────
 * This note used to say the floor rendered identically in both themes and that
 * THAT was the point, on the focus-mode reasoning: a token that flips
 * underneath a deliberate inversion is the bug rather than the fix. Half of
 * that holds and half of it does not, and the difference is what the two
 * screens are FOR.
 *
 * Focus mode is a BLACKOUT. Bright is the one thing it must never be, so a
 * token that could turn it white is a genuine fault and its ink stays literal.
 * The floor is not a blackout; it is somewhere else. What makes it somewhere
 * else is that it does not look like the rest of the app — and a light floor
 * can do that perfectly well, as long as it is COOL SLATE where the app is
 * warm cream rather than the dashboard with market cards on it.
 *
 * So the floor has its own palette rather than no palette: `.floor` scopes one
 * set of `--floor-*` tokens (index.css) with a light and a dark value each,
 * and it follows the app theme. A student who set the app light no longer
 * walks into a near-black page halfway through a navigation, which was the
 * real cost of the old rule and was never something the rule intended.
 *
 * The class goes HERE, on the one wrapper, which is what lets a `position:
 * fixed` overlay inside the room — the settlement reveal, the take-side sheet,
 * the line dialog — inherit the palette without being told which room it is
 * in. Custom properties inherit down the DOM tree; `fixed` escapes layout, not
 * the cascade.
 *
 * It lives here rather than inside Competitions because the market page is the
 * same room seen closer up, and a second hand-rolled copy of a ground colour is
 * how two surfaces start disagreeing about where you are. `BrandMark` records
 * the same lesson after eight call sites had drifted to three corner radii.
 *
 * ─── NO NEGATIVE MARGIN, and there never should have been one ───────────────
 * This carried `-m-4 sm:-m-6 p-4 sm:p-6` to pull the dark ground out past the
 * page padding it was cancelling. Layout's `<main>` HAS NO PADDING — every
 * other page in the app is a plain `min-h-screen bg-background` that owns its
 * full width and pads inside — so the negative margin had nothing to cancel
 * and simply pushed the floor 24px wider than the viewport, giving
 * /Competitions a horizontal scrollbar on every screen at `sm` and up.
 *
 * It is the same trap in reverse as the WeekPace note about viewports: a
 * measurement copied from a layout that is not the one you are in. Filling the
 * width and padding inside is what the rest of the app does and it puts the
 * ground exactly where the negative margin was trying to reach.
 */
import React from "react";

export default function Room({ children }) {
    return (
        <div className="floor min-h-screen bg-[var(--floor-ground)] p-4 sm:p-6">{children}</div>
    );
}
