/**
 * Crest — the small mark beside a name, from either of the two ways to get one.
 *
 * ─── A CREST WAS DEFINED, SOLD, AND DRAWN NOWHERE ───────────────────────────
 * `CRESTS` and `crestOf` shipped with the cosmetics store and `useCosmetics`
 * has exposed an equipped one since Layout mounted the provider — and nothing
 * in the tree ever rendered it. A student could buy a crest and the only
 * evidence it existed was the word "Owned" on the shelf they bought it from,
 * which is exactly the bug that release was written to end, one file short of
 * the finish. This is the missing renderer, and the league's podium shares it.
 *
 * ─── EARNED AND BOUGHT ARE DIFFERENT CLAIMS ─────────────────────────────────
 * A podium crest says "this student came second last week" and a bought one
 * says "this student liked this shape". They are stored separately for that
 * reason (`extra.league_award` against `extra.cred_equipped`), and where both
 * exist the EARNED one is drawn: it is the one with information in it, and the
 * one other students are reading the board for.
 *
 * ─── SHAPE CARRIES THE PLACE, NOT JUST COLOUR ───────────────────────────────
 * There is no bronze token and inventing one for a single mark is not worth a
 * colour in the palette — WeeklyBoard's own medal note already refused that.
 * So first is a filled medal in the XP amber, second is filled in the muted
 * ink and third is the outline, which survives greyscale and a CVD check the
 * way the floor's step dots have to. The same two tokens, three readings.
 *
 * It is monochrome and has no internal detail on purpose: it renders at 12px
 * beside a username, and anything finer is a smudge at that size.
 */
import React from "react";

const PODIUM_INK = {
    gold:   "text-xp",
    silver: "text-muted-foreground",
    bronze: "text-muted-foreground",
};
const PODIUM_LABEL = { gold: "1st", silver: "2nd", bronze: "3rd" };

/** A medal: a disc on two ribbon tails. Filled for first and second, outlined for third. */
function Medal({ filled }) {
    return (
        <>
            <path d="M8.2 2 L10.6 7.2 L13.4 7.2 L10.6 2 Z" fill="currentColor" opacity="0.55" />
            <path d="M7.8 2 L5.4 7.2 L2.6 7.2 L5.4 2 Z" fill="currentColor" opacity="0.55" />
            <circle
                cx="8" cy="10.4" r="4.4"
                fill={filled ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth={filled ? 0 : 1.6}
            />
        </>
    );
}

/** The three bought shapes. `currentColor` throughout, so the surface inks them. */
const SHAPES = {
    ring: <circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="2.2" />,
    bolt: <path d="M9.4 1.6 L4 8.8 H7.2 L6.6 14.4 L12 7.2 H8.8 Z" fill="currentColor" />,
    laurel: (
        <>
            <path d="M8 14.2 C4.6 12.4 3.2 9 3.6 5.2 C5.6 6 7.2 8 8 10.4"
                fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M8 14.2 C11.4 12.4 12.8 9 12.4 5.2 C10.4 6 8.8 8 8 10.4"
                fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="8" cy="3.2" r="1.5" fill="currentColor" />
        </>
    ),
};

/**
 * `podium` is a crest key from `podiumCrest` ("gold" | "silver" | "bronze");
 * `skin` is a bought crest — an entry from `CRESTS`, or just its `shape`,
 * because the board sends the shape string rather than a whole catalogue
 * entry it would then have to keep in step. Either may be absent, and with
 * neither this draws NOTHING rather than a placeholder — a slot reserved for a
 * crest nobody has is a column of empty boxes down the board.
 */
export default function Crest({ podium = null, skin = null, className = "" }) {
    if (podium && PODIUM_INK[podium]) {
        return (
            <svg
                viewBox="0 0 16 16" role="img"
                className={`w-3.5 h-3.5 flex-shrink-0 ${PODIUM_INK[podium]} ${className}`}
            >
                <title>{`${PODIUM_LABEL[podium]} last week`}</title>
                <Medal filled={podium !== "bronze"} />
            </svg>
        );
    }
    const key = typeof skin === "string" ? skin : skin?.shape;
    const shape = key && SHAPES[key];
    if (!shape) return null;
    return (
        <svg
            viewBox="0 0 16 16" role="img"
            className={`w-3.5 h-3.5 flex-shrink-0 text-muted-foreground ${className}`}
        >
            <title>{skin?.label || key}</title>
            {shape}
        </svg>
    );
}
