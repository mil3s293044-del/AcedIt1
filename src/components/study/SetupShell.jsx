/**
 * SetupShell — the pieces every Study technique's setup screen shares.
 *
 * ─── THE TOOLS DID NOT MATCH EACH OTHER ─────────────────────────────────────
 * Active Recall and Blurting were one card each with the start button at the
 * bottom of ~1,000px of options — below the fold on every screen — and their
 * history behind a quiet link under it. Revision Mode was five stacked boxes
 * with black pills and a summary card of its own. Three setups, three shapes,
 * on one page whose tabs promise they are siblings.
 *
 * ─── THE START BAR IS PINNED, AND IT SAYS WHAT IS ABOUT TO HAPPEN ───────────
 * `StartBar` is sticky inside its card, so the button is on screen from the
 * first paint and stays there while the options are scrolled, then settles at
 * the foot of the card. It leads with the session as a FIGURE ("6 questions")
 * and a line of what the options added up to, so the press is on something
 * stated rather than on a verb. `bottom-[5.25rem]` clears the phone's bottom
 * nav, the offset the Ranked pinned bar and Strategise's footer already use.
 *
 * Its card must be `overflow-clip`, never `overflow-hidden`: `hidden` makes the
 * card a scroll container, and a sticky child sticks to a box that never
 * scrolls — which renders exactly like no sticky at all.
 *
 * ─── HISTORY IS A DIALOG, OPENED FROM THE PAGE'S OWN HEADER ─────────────────
 * It was an inline panel that appeared under a long setup card, so pressing
 * "Previous sessions" changed something off screen. As a dialog it opens
 * where the student is, from any phase of the session, and the page header
 * names it beside the technique — one place for it on every tool that has one.
 */
import React from "react";
import { FolderOpen } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** The pinned bar at the foot of a setup card. `children` is the button. */
export function StartBar({ figure, line = null, children }) {
    return (
        <div className="sticky bottom-[5.25rem] md:bottom-4 z-10 mt-6">
            {/* `pr-20` below xl is the Ace launcher's corner — the reserve
                Strategise's footer keeps, sized for a bar inside a card. It is
                fixed bottom-right and sat on the button at every width until
                the column clears it at 1280. On a phone that leaves no room
                beside the button, so the bar STACKS rather than truncating
                "14 questions" to "14 questio…". */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 rounded-2xl border-2 border-border
                bg-surface/95 backdrop-blur-xl pl-4 pr-20 xl:pr-4 py-3 shadow-soft-lg">
                <div className="min-w-0 flex-1">
                    <p className="font-display text-base sm:text-lg font-extrabold leading-tight text-foreground tabular-nums">
                        {figure}
                    </p>
                    {line && <p className="mt-0.5 text-xs text-muted-foreground leading-snug">{line}</p>}
                </div>
                <div className="flex-shrink-0 *:w-full sm:*:w-auto">{children}</div>
            </div>
        </div>
    );
}

/**
 * The history list, as a dialog. `count` is how many rows there are; with none
 * the empty state is drawn instead of `children`.
 */
export function HistoryDialog({ open, onOpenChange, title, description, count = 0, empty, children }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto rounded-3xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FolderOpen className="w-4 h-4 text-muted-foreground" aria-hidden="true" /> {title}
                    </DialogTitle>
                    {description && <DialogDescription>{description}</DialogDescription>}
                </DialogHeader>
                {count === 0 ? empty : children}
            </DialogContent>
        </Dialog>
    );
}

/**
 * A history row's delete button. Visible on any device without hover, faded
 * until hover on one with it — `opacity-0 group-hover:` alone made it a
 * control a phone could never reach.
 */
export const HOVER_REVEAL = "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100";
