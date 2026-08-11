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
