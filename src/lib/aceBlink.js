/**
 * When Ace blinks, and the one scheduler both of his faces use.
 *
 * ─── HE BLINKED FASTER THE LONGER A TAB WAS OPEN ───────────────────────────
 * AceBody and SpadeFace each scheduled their own blinks: a timeout to close
 * the eyes, then a second one to open them and schedule the next. The cleanup
 * cancelled only the FIRST. So an effect torn down during the 110ms the eyes
 * were shut left the second timer running, and when it fired it scheduled a
 * fresh blink chain that nothing could ever stop.
 *
 * That teardown is not rare. AceBody's effect re-ran whenever the pose's
 * eyelid value changed, and most of his fidgets change it (think, ponder,
 * yawn, nod, whistle), and he fidgets every few seconds. Each orphan chain
 * blinked on its own clock alongside the real one, so the chains piled up and
 * the blinking sped up for as long as the page stayed open. Nothing threw.
 *
 * `startBlinking` owns BOTH timers and the stop cancels both. Stopping
 * mid-blink also reopens the eyes, or a pose change could leave him with his
 * eyes shut until the next blink on the new chain.
 *
 * ─── AND THE RATE ITSELF WAS A PERSON'S, WHICH IS TOO FAST FOR A MASCOT ────
 * 2.8–6.6 seconds is roughly how often people blink, and on a cartoon
 * character in the corner of a screen somebody is working on it reads as
 * nervous. Five to eleven seconds is calm without looking frozen, and the
 * spread keeps it irregular: a blink on a fixed beat reads as a machine.
 */

/** The shortest gap between two blinks. */
export const BLINK_MIN_MS = 5000;
/** How much longer than that a gap may run, chosen at random each time. */
export const BLINK_SPREAD_MS = 6000;
/** How long the eyes stay shut. Long enough to read as a blink, not a flicker. */
export const BLINK_HOLD_MS = 150;

/** One gap before the next blink. */
export const blinkDelay = (random = Math.random) => BLINK_MIN_MS + random() * BLINK_SPREAD_MS;

/**
 * Start a blink chain. `onChange(true)` closes the eyes and `onChange(false)`
 * opens them. Returns a stop that cancels every timer the chain holds and
 * leaves the eyes open.
 */
export function startBlinking(onChange, { timers = globalThis, random = Math.random } = {}) {
    let live = true;
    let gap = null;
    let hold = null;
    const schedule = () => {
        gap = timers.setTimeout(() => {
            if (!live) return;
            onChange(true);
            hold = timers.setTimeout(() => {
                if (!live) return;
                onChange(false);
                schedule();
            }, BLINK_HOLD_MS);
        }, blinkDelay(random));
    };
    schedule();
    return () => {
        live = false;
        timers.clearTimeout(gap);
        timers.clearTimeout(hold);
        onChange(false);
    };
}
