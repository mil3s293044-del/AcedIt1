/**
 * cheatSheet — how much fits on a printed sheet, in one place.
 *
 * `ITEMS_PER_PAGE` was defined in BOTH CheatSheetMaker.jsx (which sizes the
 * ask: "give me a ranked pool, I need this many to fill the sheet") and
 * CheatSheetArtifact.jsx (which paginates what came back). Same quantity, two
 * copies, nothing importing either — so a change to one would have the
 * generator asking for N items and the renderer laying out M, and the printed
 * sheet would silently stop matching the page count the picker promised.
 *
 * It is a .js rather than a constant exported from the renderer, for the reason
 * `xpRanks.js` was pulled out of `xpSystem.jsx`: a plain module can be read by
 * anything, a .jsx cannot.
 */

// A tight A4 two-column sheet holds ~22 short lines per page.
export const ITEMS_PER_PAGE = 22;

/** How many items fill `pages` sheets. */
export function fitCount(pages) {
    return Math.max(0, Math.round(Number(pages) || 0)) * ITEMS_PER_PAGE;
}

/** How many sheets `n` items need. Never zero — an empty sheet is still a sheet. */
export function pagesFor(n) {
    return Math.max(1, Math.ceil((Number(n) || 0) / ITEMS_PER_PAGE));
}
