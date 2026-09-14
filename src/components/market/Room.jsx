/**
 * Room — the floor's ground, shared by every screen that is part of it.
 *
 * ─── LITERAL INK, NOT TOKENS, and that is the point ─────────────────────────
 * Compete is a different room on purpose, so it renders identically in both
 * themes rather than following the app's. This is the focus-mode lesson
 * arrived at from the same direction: a token that flips underneath a
 * deliberate inversion is the bug, not the fix.
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
        <div className="min-h-screen bg-[#0A121F] p-4 sm:p-6">{children}</div>
    );
}
