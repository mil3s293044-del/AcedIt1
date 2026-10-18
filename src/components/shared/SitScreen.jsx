/**
 * SitScreen — the full-screen surface every sit runs on.
 *
 * A quiz, a re-sit of the questions you missed, and a run through the mistake
 * bank are the same kind of moment: one thing in front of you, nothing else
 * reachable, one way out. They were three different shapes. The quiz sat in
 * the page frame under a "Back to Quizzes" pill (only a SAC went full screen);
 * a re-sit from /MistakeBank mounted the player straight into the page, nav
 * and corner Ace included, so on a phone the launcher stood on the Next
 * button; and the drill ran in the frame with its own back link.
 *
 * One wrapper, so the three cannot drift apart again. `fixed inset-0 z-50`
 * covers the side rail, the top bar, the bottom nav and the launcher, which is
 * what makes "one exit" true rather than a matter of which links happen to be
 * on screen. The exit itself belongs to whatever runs inside.
 */
import React from "react";

// Static classes — JIT cannot see an assembled one.
const WIDTH = { "3xl": "max-w-3xl", "2xl": "max-w-2xl" };

export default function SitScreen({ children, width = "3xl", label }) {
    return (
        <div data-sit role="region" aria-label={label}
            className="fixed inset-0 z-50 bg-background overflow-y-auto">
            <div className={`${WIDTH[width] || WIDTH["3xl"]} mx-auto px-4 py-5 sm:py-8`}>{children}</div>
        </div>
    );
}
