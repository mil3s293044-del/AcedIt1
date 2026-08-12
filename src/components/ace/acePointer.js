/**
 * acePointer — one pointer listener for however many Aces are on screen.
 *
 * Eye tracking is the cheapest thing that makes a character feel present: a
 * drawing that looks at you stops being a drawing. But it's also the easiest
 * way to put a `pointermove` handler on the hot path of the whole app, and
 * there can be several Aces mounted at once (companion, perch, empty state).
 *
 * So there's exactly ONE listener, it's passive, and it coalesces into a
 * single rAF regardless of how fast the pointer moves. Subscribers are called
 * at most once per frame with the last known position. When the last Ace
 * unmounts the listener is removed — nothing keeps running for a character
 * who isn't on screen.
 */
let x = 0, y = 0, frame = 0, attached = false;
const subs = new Set();

function flush() {
    frame = 0;
    for (const fn of subs) fn(x, y);
}

function onMove(e) {
    x = e.clientX;
    y = e.clientY;
    if (!frame) frame = requestAnimationFrame(flush);
}

/** Subscribe to pointer position. Returns an unsubscribe. */
export function watchPointer(fn) {
    subs.add(fn);
    if (!attached && typeof window !== "undefined") {
        window.addEventListener("pointermove", onMove, { passive: true });
        attached = true;
    }
    // Hand over the last known position immediately, so an Ace that mounts
    // mid-session doesn't stare straight ahead until you happen to move.
    if (x || y) fn(x, y);
    return () => {
        subs.delete(fn);
        if (!subs.size && attached) {
            window.removeEventListener("pointermove", onMove);
            if (frame) cancelAnimationFrame(frame);
            frame = 0;
            attached = false;
        }
    };
}
