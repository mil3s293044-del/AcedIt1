/**
 * useAceYield — Ace steps aside when the app has something better to say.
 *
 * The XP popup stack lives at `bottom-24 right-4`. Ace's launcher lives at
 * `bottom-24 right-4` too. On a phone those are the same coordinates, and the
 * popup (z-200) simply covers him (z-40) — measured at 390×740, the popup
 * spans x 143–309 and he spans x 275–374. On a desktop the launcher clears it,
 * but his speech panel doesn't.
 *
 * Two ways to fix a collision: move one of them, or have one of them yield.
 * Moving the XP stack means pushing it ~270px up the screen to clear his
 * tallest state, which puts a transient notification in the middle of the
 * page. So he yields — and it's the better answer anyway. You just earned
 * something; a companion who keeps talking over that is the companion you
 * turn off. He slides out to the right, waits, and comes back.
 *
 * Deliberately dumb about counting: any celebration event re-arms the timer,
 * so a burst of three popups keeps him away until the last one has cleared
 * rather than having him pop in and out between them.
 */
import { useEffect, useRef, useState } from "react";

/** Longest an XP popup lives (5s for a level-up) plus its exit animation. */
export const YIELD_MS = 5400;

/** The events that mean "something is being celebrated in his corner". */
const LOUD = ["xp_awarded", "streak_updated"];

export default function useAceYield() {
    const [yielding, setYielding] = useState(false);
    const timer = useRef(null);

    useEffect(() => {
        const step = () => {
            setYielding(true);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => setYielding(false), YIELD_MS);
        };
        LOUD.forEach((e) => window.addEventListener(e, step));
        return () => {
            LOUD.forEach((e) => window.removeEventListener(e, step));
            clearTimeout(timer.current);
        };
    }, []);

    return yielding;
}

/* ────────────────────────────────────────────────────────────────────────
 * He can only be in one place.
 *
 * The buddy and the launcher are separate components that both draw Ace in
 * the bottom-right corner. That was fine when the launcher was a pill with a
 * 36px icon on it, and stopped being fine the moment both became the whole
 * character: two identical Aces, overlapping, both waving.
 *
 * So whoever is drawing him says so, and everyone else defers.
 *
 * Claims carry an OWNER, and that isn't decoration. The first version counted
 * claims, which works only for things that never claim him themselves: the
 * roamer both claims him AND has to know whether someone else has him, and
 * with a bare count it heard its own claim, hid itself, released, reappeared,
 * and oscillated. An owner set lets each caller ask "is anyone OTHER than me
 * holding him", which is the actual question.
 * ──────────────────────────────────────────────────────────────────────── */
const BUSY = "ace:busy";
const holders = new Set();

function announce() {
    window.dispatchEvent(new CustomEvent(BUSY, { detail: { holders: [...holders] } }));
}

/** Claim him under an owner id. Returns a release function. */
export function claimAce(owner = "ace") {
    holders.add(owner);
    announce();
    let released = false;
    return () => {
        if (released) return;
        released = true;
        holders.delete(owner);
        announce();
    };
}

/**
 * True while someone OTHER than `self` is drawing him. Pass the same owner id
 * you claim with, or nothing at all if you never claim.
 */
export function useAceClaimed(self) {
    const [list, setList] = useState(() => [...holders]);
    useEffect(() => {
        const on = (e) => setList(e.detail?.holders || []);
        window.addEventListener(BUSY, on);
        setList([...holders]);
        return () => window.removeEventListener(BUSY, on);
    }, []);
    return list.some((o) => o !== self);
}
