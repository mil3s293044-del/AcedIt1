/**
 * LedgerRow — one row under the podium, the same on every board.
 *
 * ─── THE COLUMNS ARE FIXED WIDTHS, and that is most of what reads as premium
 * Every figure lines up in one right-aligned column, every place numeral in
 * another, every arrow in a third. A score at the end of a flex row moves its
 * left edge with the length of the name beside it, and a column of numbers
 * comes out ragged — the difference between a table somebody designed and a
 * list of divs. The place is display type with real weight, because on a
 * leaderboard the rank IS the content.
 *
 * ─── ROWS RACE TO THEIR NEW PLACES ──────────────────────────────────────────
 * A row is keyed by the PERSON, never by the place, and carries `layout`, so
 * when the board under it changes — XP to study time, everyone to friends — a
 * student who was 6th and is now 3rd SLIDES there rather than a different
 * name appearing in the slot. That slide is the whole answer to "did I move";
 * a list that re-renders in place has to be read twice to find out. Only the
 * POSITION animates (`layout="position"`): a row whose width changes with its
 * content would otherwise stretch its text mid-move.
 *
 * A row that LEAVES pops out of the flow at once (`mode="popLayout"` on the
 * board's AnimatePresence) and fades where it stood, so the rows that stay
 * start racing immediately instead of waiting for it to finish going.
 *
 * The avatar shares a `layoutId` with the podium's medallion, so somebody
 * leaving the top three drops down into their row rather than vanishing.
 *
 * ─── The rail ───────────────────────────────────────────────────────────────
 * Your row and the two either side carry a left rail, because those three rows
 * are the race you are in. SIDE-SPECIFIC colour utilities and `border-t`
 * rather than `divide-y`: Tailwind's `divide-*` writes `border-color` through
 * a combinator that outranks a plain `border-primary` on the child, which is
 * how the first rail on Ranked came out the same grey as the dividers.
 */
import React, { forwardRef, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronUp } from "lucide-react";
import BoardAvatar from "@/components/boards/BoardAvatar";
import MoveChip from "@/components/boards/MoveChip";
import LiveFigure from "@/components/boards/LiveFigure";
import { rowDelay } from "@/lib/boardKit";

const EDGES = {
    both: "first:rounded-t-2xl last:rounded-b-2xl",
    bottom: "last:rounded-b-2xl",
    none: "",
};

const LedgerRow = forwardRef(function LedgerRow({
    person, layoutScope = "board", place, move, name, isMe = false, near = false,
    badges = null, sub = null, aside = null, figure, gap = null, meter = null, extra = null,
    index = 0, arriving = false, flash = 0,
    // A board with no weekly snapshot at all (a study group) has no movement
    // to draw, so it does not reserve the lane every Ranked row keeps.
    moveLane = true,
    // Which of the list's rounded corners this row may have to round off for
    // itself — the ledger does not clip (a flying avatar would be cut off at
    // its edge), so a tinted first or last row rounds its own corners.
    edges = "both",
    // The row's own ref, for the board to observe (your row, for the dock).
    // NOT `ref`: AnimatePresence's "popLayout" mode clones every child with a
    // ref of its own, which silently replaces one passed as `ref` — and then
    // nothing would follow you. The two are merged here instead.
    rowRef = null,
}, ref) {
    const reduce = useReducedMotion();
    const setRef = useCallback((el) => {
        for (const r of [ref, rowRef]) {
            if (typeof r === "function") r(el);
            else if (r) r.current = el;
        }
    }, [ref, rowRef]);
    return (
        <motion.div ref={setRef}
            layout={reduce ? false : "position"}
            initial={arriving && !reduce ? { opacity: 0, y: 10 } : { opacity: 0 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.16 } }}
            transition={{
                duration: 0.32, ease: [0.16, 1, 0.3, 1],
                delay: arriving ? rowDelay(index) : 0,
                layout: { type: "spring", stiffness: 380, damping: 38 },
            }}
            data-row={isMe ? "me" : undefined} data-ledger-row={person}
            className={`relative pl-2 pr-3 sm:pl-3 sm:pr-4 py-2.5 border-t border-t-border border-l-4 transition-colors
                ${EDGES[edges] || ""} ${
                isMe ? "bg-primary/[0.07] border-l-primary"
                    : near ? "bg-primary/[0.03] border-l-primary/30"
                    : "border-l-transparent hover:bg-secondary/40"}`}>
            {/* Tapping the docked row brings you back here, and the row says
                so — a scroll that lands on a page of identical rows has not
                finished the job. Keyed on the tap count so a second tap
                pulses again. */}
            {flash > 0 && !reduce && (
                <motion.span key={flash} aria-hidden="true"
                    className="absolute inset-0 bg-primary/15 pointer-events-none rounded-[inherit]"
                    initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0, 1, 0] }}
                    transition={{ duration: 1.4, times: [0, 0.2, 0.45, 0.65, 1], ease: "easeInOut" }} />
            )}
            <div className="relative flex items-center gap-2 sm:gap-3">
                <span className={`w-6 sm:w-8 text-center font-display font-black flex-shrink-0 tabular-nums
                    text-base sm:text-lg leading-none ${isMe ? "text-primary" : "text-foreground/70"}`}>
                    {place}
                </span>
                {/* A fixed lane, so the arrows form a column instead of
                    shuffling sideways with the length of the place beside
                    them. Reserved even with no snapshot — an empty lane costs
                    22px and keeps every other column still. */}
                {moveLane && (
                    <span className="w-6 sm:w-7 flex items-center justify-center flex-shrink-0">
                        <MoveChip move={move} />
                    </span>
                )}
                <BoardAvatar name={name} size={38}
                    layoutId={reduce ? undefined : `${layoutScope}-av-${person}`}
                    ring={isMe ? "ring-2 ring-primary/40" : "ring-1 ring-border"} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <p className={`text-sm truncate ${isMe ? "font-black text-primary" : "font-bold text-foreground"}`}>
                            {name}
                        </p>
                        {badges}
                    </div>
                    {sub != null && <div className="text-[11px] text-muted-foreground truncate">{sub || " "}</div>}
                </div>
                {aside}

                {/* THE FIGURE, AND THE REACH, IN ONE RIGHT-ALIGNED COLUMN of
                    fixed width — every figure on the board shares a right edge
                    and the gap bar sits directly under the number it is a
                    difference from. */}
                <div className="flex-shrink-0 w-[4.75rem] sm:w-[6.5rem] text-right">
                    <span className="font-display font-extrabold text-base sm:text-lg leading-none">
                        <LiveFigure value={figure.value} format={figure.format} quantity={figure.quantity} />
                    </span>
                    {meter}
                    {!meter && gap?.pct != null && (
                        <div className="flex items-center justify-end gap-1.5 mt-1">
                            <span className={`inline-flex items-center text-[10px] font-bold tabular-nums ${
                                isMe ? "text-primary" : "text-muted-foreground"}`}>
                                <ChevronUp className="w-2.5 h-2.5" />{gap.label}
                            </span>
                            <div className="h-1.5 w-8 sm:w-12 rounded-full bg-secondary overflow-hidden flex-shrink-0">
                                <motion.div
                                    initial={{ width: 0 }} animate={{ width: `${gap.pct}%` }}
                                    transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1],
                                        delay: arriving ? rowDelay(index) + 0.1 : 0 }}
                                    className={`h-full rounded-full ${isMe ? "bg-primary" : "bg-muted-foreground/40"}`} />
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {extra}
        </motion.div>
    );
});

export default LedgerRow;
