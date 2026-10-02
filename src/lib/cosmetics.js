/**
 * cosmetics — what a student has bought, actually drawn.
 *
 * ─── THE WHOLE SHELF WAS AN INVENTORY WITH NO CONSUMERS ─────────────────────
 * `cred_owned`, `cred_equipped` and `cred_held` were written by the store and
 * read by NOTHING. A student could spend 2,400 credits — most of a fortnight's
 * earning — on a gilt card back that rendered nowhere in the app, and the only
 * evidence it existed was the word "Owned" on the shelf they bought it from.
 *
 * That is the "collect nothing you don't use" rule inverted, which this
 * codebase has now recorded four times, and it is the worst version of it:
 * the others asked a student for something and ignored the answer. This took
 * their money.
 *
 * ─── A COSMETIC IS READ FROM CONTEXT, NEVER THREADED ────────────────────────
 * `CardBack` is drawn on nineteen surfaces and `PlayingCard` on eighteen.
 * Passing an equipped skin down to each one means nineteen call sites that can
 * each forget, which is how half the app ends up wearing it — the shape
 * `useAceYield` was built to end for the mascot. So the profile is read ONCE
 * and the components consume it, and a surface that wants the old look passes
 * an explicit skin rather than being the one that forgot.
 *
 * ─── A SKIN IS LITERAL INK, LIKE THE FLOOR ──────────────────────────────────
 * A gilt back is gilt in both themes. These are not semantic colours standing
 * for a state — they are a physical object the student chose and paid for, and
 * a token that flips underneath would mean the thing they bought looks like a
 * different thing after dark. Same reasoning the floor's palette records, and
 * the same reasoning that keeps focus mode's ground literal.
 *
 * The DEFAULT is not a skin. With nothing equipped every card draws exactly as
 * it always has, off the subject's own tone — so this cannot change a single
 * pixel for the ~130 students who have bought nothing.
 */

/* ── Card backs ──────────────────────────────────────────────────────────── */

/**
 * Each skin is a ground, an ink and a medallion ink. `tone` is the subject
 * colour and is used ONLY by the default — a chosen back is the same back on
 * every deck, which is most of what makes it feel owned.
 */
export const BACK_SKINS = {
    "back-felt": {
        id: "back-felt", label: "Felt",
        ground: "#0B5D34", ink: "#58CC02", medallion: "#0B5D34", pip: "#E8F5DC",
    },
    "back-ink": {
        id: "back-ink", label: "Ink",
        ground: "#141A24", ink: "#5A6B84", medallion: "#141A24", pip: "#C9D6E8",
    },
    "back-gilt": {
        id: "back-gilt", label: "Gilt",
        ground: "#4A3613", ink: "#D9A82C", medallion: "#4A3613", pip: "#F7E7B8",
    },
};

/** The skin a profile is wearing, or null for the default subject-toned back. */
export function backSkin(profile) {
    const id = profile?.extra?.cred_equipped?.back;
    return (typeof id === "string" && BACK_SKINS[id]) || null;
}

/* ── Crests ──────────────────────────────────────────────────────────────── */

/**
 * A crest sits beside a name wherever the app prints one. It is deliberately
 * SMALL and monochrome: it has to read at 12px next to a username on a board
 * row, and anything with internal detail becomes a smudge at that size.
 *
 * `shape` is what the component draws. Colour rides on the surface rather than
 * on the crest, so one crest works on the floor, on Ranked and on the tape
 * without three definitions — the mistake `Countdown variant="banner"` made
 * with a hard-coded ink.
 */
export const CRESTS = {
    "crest-ring": { id: "crest-ring", label: "Ring", shape: "ring" },
    "crest-bolt": { id: "crest-bolt", label: "Bolt", shape: "bolt" },
    "crest-laurel": { id: "crest-laurel", label: "Laurel", shape: "laurel" },
};

/** The crest a profile is wearing, or null. */
export function crestOf(profile) {
    const id = profile?.extra?.cred_equipped?.crest;
    return (typeof id === "string" && CRESTS[id]) || null;
}

/* ── Equipping ───────────────────────────────────────────────────────────── */

/** Which catalogue slot an owned id belongs to, or null if it is not wearable. */
export function slotOf(id) {
    if (BACK_SKINS[id]) return "back";
    if (CRESTS[id]) return "crest";
    return null;
}

/**
 * The patch that equips an owned cosmetic. PURE, and it REFUSES anything the
 * student does not own — the client decides what to show and the server decides
 * what is true, so this is checked on both sides rather than trusted from the
 * request body. Passing null for `id` clears the slot.
 */
export function equipPatch(profile, id) {
    const owned = Array.isArray(profile?.extra?.cred_owned) ? profile.extra.cred_owned : [];
    const equipped = { ...(profile?.extra?.cred_equipped || {}) };

    if (id === null || id === undefined || id === "") {
        return null;                       // nothing to clear without a slot
    }
    const slot = slotOf(id);
    if (!slot) return null;
    if (!owned.includes(id)) return null;  // you cannot wear what you do not own

    equipped[slot] = id;
    return { extra: { ...(profile?.extra || {}), cred_equipped: equipped } };
}

/** The patch that takes a slot off. Separate from `equipPatch` because clearing
 *  needs the SLOT and equipping needs the ID, and one function taking either is
 *  how a caller ends up clearing the wrong one. */
export function unequipPatch(profile, slot) {
    const s = String(slot || "");
    if (s !== "back" && s !== "crest") return null;
    const equipped = { ...(profile?.extra?.cred_equipped || {}) };
    if (!(s in equipped)) return null;
    delete equipped[s];
    return { extra: { ...(profile?.extra || {}), cred_equipped: equipped } };
}

export default { BACK_SKINS, CRESTS, backSkin, crestOf, slotOf, equipPatch, unequipPatch };
