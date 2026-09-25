/**
 * aceReplay — asking for the first run or the tour back.
 *
 * ─── The gap this closes ────────────────────────────────────────────────────
 * Neither onboarding surface could be STARTED. Both derive their own
 * eligibility from the profile's age and open themselves in Ace's corner, and
 * both write `skipped` the moment the student presses the X on his bubble. So
 * a student who dismissed him on minute one — which is the single most likely
 * thing to happen to a bubble that appears unasked-for — had permanently lost
 * both, with no control anywhere in the app to get either back.
 *
 * ─── An automatic offer is DERIVED. A replay is a REQUEST. ──────────────────
 * That line is the whole design and it is why nothing here touches
 * `firstWinStatus` or `tourStatus`. Those answer "should this open at a
 * student who did not ask", which must stay derived from the profile's age —
 * there are ~130 existing accounts and a flag that said "has not seen it"
 * would ambush every one of them. A replay is not that question. Somebody
 * pressed a button, so it runs, at any age, however many times they like.
 *
 * ─── A request is STICKY, because the listener may not exist yet ────────────
 * The run hands over to the tour at its close, and Layout unmounts AceTour for
 * as long as the run is live — so the handover fires into a component that has
 * not mounted, and a plain event would simply be lost. The pending set is what
 * makes the order not matter: a late listener claims the request on mount, an
 * already-mounted one hears the event, and `take` clears it either way so a
 * claimed request cannot fire twice.
 */

/** The two things that can be asked for. */
export const RUN = "first-win";
export const TOUR = "ace-tour";

const EVENT = "acedit:ace-replay";
const pending = new Set();

/** Ask for one. Safe to call before anything is listening. */
export function requestAce(what) {
    pending.add(what);
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(EVENT, { detail: what }));
    }
}

/**
 * Claim a request, if one is waiting. Returns whether there was one, and
 * clears it — so a component that both listens and checks on mount cannot act
 * on the same request twice.
 */
export function takeAceRequest(what) {
    if (!pending.has(what)) return false;
    pending.delete(what);
    return true;
}

/** Listen while mounted. Returns the unsubscribe, for the effect's cleanup. */
export function onAceRequest(what, fn) {
    if (typeof window === "undefined") return () => {};
    const handler = (e) => { if (e?.detail === what && takeAceRequest(what)) fn(); };
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
}

/** Only for tests: forget anything outstanding. */
export function _resetAceRequests() { pending.clear(); }
