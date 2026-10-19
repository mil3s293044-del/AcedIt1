/**
 * brainSignal — a technique telling the science card that the work happened.
 *
 * Fired at the moment a student does the thing the card is about — rates a
 * card, moves past an answer they wrote, picks an option, adds to a map —
 * so the brain beside the tool pulses the regions that work uses, while they
 * are doing it rather than in a paragraph they read once.
 *
 * A window event rather than a prop: the six techniques are siblings of the
 * card, not its children, and threading a callback through each one is six
 * more props for something purely decorative. The NAME is written out at
 * both ends because `reachable.test.mjs` matches a dispatch to its listener by
 * the literal string — an event nothing listens for is the dead relay that
 * test was written to catch.
 *
 * It must never throw into the study flow it is reporting on.
 */
export function signalBrain(technique, kind = "work") {
    try {
        if (typeof window === "undefined") return;
        window.dispatchEvent(new CustomEvent("acedit:brain", { detail: { technique, kind, at: Date.now() } }));
    } catch {
        /* a decoration failing is not a reason to interrupt studying */
    }
}

export default signalBrain;
