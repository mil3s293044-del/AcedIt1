/**
 * RankedBoard — a ladder you can see yourself climbing.
 *
 * ─── What a leaderboard has to do ───────────────────────────────────────────
 * Make a position look worth taking. A flat list of rank, name and number does
 * the opposite: it reads as a fact about other people, arranged in an order
 * nobody in the middle of it can imagine changing.
 *
 *   THE GAP, ON EVERY ROW. Each row says what it would take to pass the person
 *   above it, and a bar draws that gap to a scale shared by the whole board —
 *   so a short bar is genuinely a short reach and the eye can find the tight
 *   parts of the ladder without reading a single number. This is the change
 *   that makes a position look takeable: before it, the only person who could
 *   see a gap was you, and only your own.
 *
 *   MOVEMENT, SINCE THE WEEK OPENED. An order that looks identical every time
 *   you open it reads as a fixture rather than a race. One arrow per row is
 *   the cheapest thing that puts motion in a ranking — and it is measured
 *   against a snapshot taken at one instant for the whole field, so two
 *   students are never told their places moved relative to different moments.
 *   `boardMovement.js` holds the rules, including the four separate ways a
 *   previous position can be missing and why not one of them may draw a number
 *   of places.
 *
 *   THE CONTEST, BRACKETED. Your row and the two either side are drawn as one
 *   group with a rail down the side, because those three rows are the race you
 *   are actually in. Everything else on the board is weather.
 *
 *   THE PODIUM. Top three read as a result rather than as rows 1–3 of 50 —
 *   dealt onto a felt table as the Ace, King and Queen of spades
 *   (`CardPodium`). The kit every board shares is `src/components/boards/`,
 *   and its arithmetic is `src/lib/boardKit.js`.
 *
 * ─── THE COLUMNS ARE FIXED WIDTHS, and that is most of what reads as premium
 * Every figure on the board lines up in one right-aligned column, every place
 * numeral in another, every arrow in a third. Before this the score sat at the
 * end of a flex row, so its left edge moved with the length of the name beside
 * it and a column of numbers came out ragged — which is the difference between
 * a table somebody designed and a list of divs. The place numeral went from a
 * 7px muted digit to display type with real weight, because on a leaderboard
 * the rank IS the content.
 *
 * ─── The bar is a real quantity, drawn to one scale ─────────────────────────
 * Bar length is that row's gap to the row above, against a scale shared by the
 * whole board — so every bar is comparable with every other and nothing had to
 * be invented to draw it. The obvious alternative, value over the value above,
 * is useless on the ATAR board where every ratio lands between 0.95 and 1.
 *
 * THE SCALE IS TWICE THE MEDIAN GAP, NOT THE LARGEST (`gapScale`, shared with
 * the League so the two boards agree about what "far" is). Dividing by the largest looked
 * principled and was unreadable: one student sitting 27 points clear of the
 * field set the scale for everybody, so the nine gaps that actually matter —
 * the 0.3s and 0.7s people can close this week — all drew as two invisible
 * pixels. A median-based scale gives the typical gap a legible mid-length bar,
 * which is the whole point of drawing it. Anything at or past twice the median
 * fills the bar and is simply "far"; the exact number is printed beside it, so
 * the cap loses nothing a student needed.
 *
 * ─── IT OPENS AT TEN, BECAUSE THIRTY ROWS IS A DOCUMENT ─────────────────────
 * The board drew every ranked student — fifty at the cap — which on a phone is
 * a page you scroll rather than a standing you read. Ten is the number every
 * league table in the world opens at, and it is the podium's three plus seven
 * so that the count means TEN PEOPLE rather than "ten rows after the three at
 * the top", which would be thirteen and quietly wrong.
 *
 * COLLAPSING MUST NEVER HIDE YOU FROM YOURSELF. A student outside the ten gets
 * their own row appended under the seven, carrying its real place number, with
 * the gap to the row above it — so the one row they came to find is always
 * drawn whatever the board is showing. That is the same rule the pinned bar
 * keeps, applied to the other way a row can go missing.
 *
 * ─── AND YOUR ROW IS NEVER LOST ─────────────────────────────────────────────
 * Scroll away from yourself and your row FOLLOWS you, holding on at the edge
 * of the screen it left by (`MyRowDock`); tap it to go back to the row. Being
 * 18th on a board of thirty and having to hunt for your own name is how a
 * leaderboard stops being motivating.
 */
import React, { useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup } from "framer-motion";
import { Flame, ChevronUp, ChevronDown } from "lucide-react";
import { rowFlex, BAND_TONE } from "@/lib/ranked";
import { gapsOf, gapScale, gapPct, REVEAL_MS } from "@/lib/boardKit";
import CrestRow from "@/components/ranked/CrestRow";
import CardPodium from "@/components/boards/CardPodium";
import LedgerRow from "@/components/boards/LedgerRow";
import MoveChip from "@/components/boards/MoveChip";
import BoardAvatar from "@/components/boards/BoardAvatar";
import LiveFigure from "@/components/boards/LiveFigure";
import MyRowDock, { useDockSide } from "@/components/boards/MyRowDock";
import useArrival from "@/components/boards/useArrival";

const TONE_PILL = {
    muted: "bg-secondary text-muted-foreground", xp: "bg-xp/15 text-xp",
    "chart-3": "bg-chart-3/15 text-chart-3", "chart-4": "bg-chart-4/15 text-chart-4",
    primary: "bg-primary/15 text-primary", streak: "bg-streak/15 text-streak",
};

function Title({ title, felt = false }) {
    if (!title) return null;
    // On the felt a tinted token pill reads as a sticker on a dark table, so
    // it is printed the way the table prints everything: literal light ink.
    if (felt) {
        return (
            <span className="pill text-[10px] bg-white/10 text-white/80 truncate max-w-full" title={title.blurb}>
                {title.label}
            </span>
        );
    }
    return (
        <span className={`pill text-[10px] ${TONE_PILL[title.tone] || TONE_PILL.primary}`} title={title.blurb}>
            {title.label}
        </span>
    );
}

/** What one person looks like on a row of this board. */
function rowProps({ row, place, isMe, near, boardMeta, title, name, gap, gapScale: scale, move, index, arriving, flash }) {
    const flex = rowFlex(row, boardMeta.id);
    const band = boardMeta.id === "atar" ? row.band : null;
    const pct = gapPct(gap, scale);
    return {
        person: row.user_email, layoutScope: "ranked", place, move, name, isMe, near, index, arriving, flash,
        badges: (
            <>
                <Title title={title} />
                {band && (
                    <span className={`pill text-[10px] ${TONE_PILL[BAND_TONE[band]] || TONE_PILL.muted}`}>{band}</span>
                )}
                {/* The rarest badges this student holds. Commons are excluded
                    by CrestRow: a mark everybody carries distinguishes nobody
                    and would be noise on every line. */}
                <CrestRow crests={row.crests} />
            </>
        ),
        sub: flex || "",
        aside: row.streak_days > 0 ? (
            <span className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-streak flex-shrink-0 w-12 justify-end">
                <Flame className={row.streak_days >= 30 ? "w-4 h-4" : "w-3 h-3"} /> {row.streak_days}
            </span>
        ) : null,
        figure: { value: boardMeta.value(row), format: boardMeta.fmt, quantity: boardMeta.id },
        gap: pct == null ? null : {
            pct, label: boardMeta.gapShort ? boardMeta.gapShort(gap) : gap.toFixed(2),
        },
    };
}

/**
 * How many PEOPLE a collapsed board shows, podium included. Ten is the count
 * a league table is read at; the list below the podium is therefore seven.
 */
export const COLLAPSED_TO = 10;

export default function RankedBoard({
    rows = [], me, boardMeta, titles = new Map(), nameOf, myStanding, movement = null,
}) {
    const [expanded, setExpanded] = useState(false);
    const arriving = useArrival(REVEAL_MS);
    const [flash, setFlash] = useState(0);

    const top = rows.slice(0, 3);
    const all = rows.slice(3);
    // Seven, so the podium's three make ten people rather than thirteen.
    const rest = expanded ? all : all.slice(0, Math.max(0, COLLAPSED_TO - top.length));
    const hidden = all.length - rest.length;

    const meIndex = rows.findIndex(r => r.user_email === me);
    const meVisible = meIndex >= 0;
    // Drawn below the seven when collapsing would otherwise lose them. The
    // podium is always shown, so somebody in the top three is never "outside".
    const meCutOff = meIndex >= 3 + rest.length;

    // Every adjacent gap on the visible board, and the one scale all the bars
    // are drawn against — the same rule the League draws by.
    const { gaps, scale } = useMemo(() => {
        const g = gapsOf(rows.map(r => boardMeta.value(r) || 0));
        return { gaps: g, scale: gapScale(g) };
    }, [rows, boardMeta]);

    // ── Your row, following you when it scrolls away ───────────────────────
    const myRowRef = useRef(null);
    const side = useDockSide(myRowRef, `${boardMeta.id}|${me}|${rows.length}|${expanded}|${meIndex}`);
    const backToRow = () => {
        myRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        setFlash(n => n + 1);
    };

    const myMove = movement?.[me] || null;
    const myPlace = meVisible ? meIndex + 1 : myStanding?.rank || null;
    const myRow = meVisible ? rows[meIndex] : myStanding?.row || null;

    if (!rows.length) return null;

    const row = (r, idx, extra = {}) => {
        const isMe = r.user_email === me;
        // Your row and the two either side: the race you are actually in,
        // marked as one group.
        const near = meVisible && Math.abs(idx - meIndex) === 1;
        return rowProps({
            row: r, place: idx + 1, isMe, near, boardMeta, title: titles.get(r.user_email), name: nameOf(r),
            gap: gaps[idx], gapScale: scale, move: movement?.[r.user_email] || null,
            index: idx - 3, arriving, flash: isMe ? flash : 0, ...extra,
        });
    };

    return (
        <LayoutGroup id="ranked-board">
        <div className="space-y-3">
            {/* ── Podium ─────────────────────────────────────────────────── */}
            {/* CAPPED AND CENTRED inside the felt, because a podium is an
                OBJECT: three cards stretched to the width of a 1100px board
                column are three panels. */}
            <CardPodium layoutScope="ranked" label={`Top three on ${boardMeta.label || "this board"}`}
                entries={top.map(r => ({
                    key: r.user_email,
                    name: nameOf(r),
                    isMe: r.user_email === me,
                    move: movement?.[r.user_email] || null,
                    figure: { value: boardMeta.value(r), format: boardMeta.fmt, quantity: boardMeta.id },
                    // THE TITLE IS A LUXURY AT 110px. A podium seat on a 360px
                    // phone is a third of the screen, so it comes back at `sm`.
                    badge: <Title title={titles.get(r.user_email)} felt />,
                }))} />

            {/* ── The rest ───────────────────────────────────────────────── */}
            {/* No `overflow-hidden`: a person leaving the podium flies down
                into their row, and a clipped ledger would cut them off at its
                edge mid-flight. The rows round their own corners instead. */}
            {rest.length > 0 && (
                <div className="card-soft relative [&>*:first-child]:border-t-0">
                    {/* "popLayout": a leaving row stops holding its place at
                        once, so the rows that stay start racing immediately.
                        Your row is observed through `rowRef`, never `ref`,
                        because popLayout replaces a child's `ref`. */}
                    <AnimatePresence mode="popLayout">
                        {rest.map((r, i) => {
                            const idx = i + 3;
                            const isMe = r.user_email === me;
                            return (
                                <LedgerRow key={r.user_email} rowRef={isMe ? myRowRef : undefined} {...row(r, idx)} />
                            );
                        })}

                        {/* YOU, WHEREVER YOU ACTUALLY ARE. Appended under the
                            seven with your real place, so collapsing the board
                            can never be the reason you cannot find yourself.
                            The rule above it says the rows between are not
                            drawn rather than letting 8th and 24th sit flush
                            and read as adjacent. */}
                        {!expanded && meCutOff && meVisible && (
                            <div key="skipped" className="px-4 py-1.5 bg-secondary/40 border-t border-border
                                text-[10px] font-bold text-muted-foreground tracking-wide">
                                ⋯ {meIndex - (3 + rest.length)} more
                            </div>
                        )}
                        {!expanded && meCutOff && meVisible && (
                            <LedgerRow key={rows[meIndex].user_email} rowRef={myRowRef}
                                {...row(rows[meIndex], meIndex, { near: false })} place={meIndex + 1} />
                        )}
                    </AnimatePresence>
                </div>
            )}

            {/* ONE CONTROL, AND IT SAYS HOW MANY. "Show all" is a label; "Show
                all 31" is a number a student can decide about — the same rule
                the review queue's entrances keep. */}
            {hidden > 0 && (
                <button type="button" onClick={() => setExpanded(true)} data-expand-board
                    className="w-full card-soft py-2.5 text-xs font-bold text-foreground
                        hover:bg-secondary/50 transition-colors inline-flex items-center justify-center gap-1.5">
                    Show all {rows.length}
                    <ChevronDown className="w-3.5 h-3.5" />
                </button>
            )}
            {expanded && all.length > COLLAPSED_TO - 3 && (
                <button type="button" onClick={() => setExpanded(false)} data-collapse-board
                    className="w-full card-soft py-2.5 text-xs font-bold text-muted-foreground
                        hover:bg-secondary/50 transition-colors inline-flex items-center justify-center gap-1.5">
                    Show the top {COLLAPSED_TO}
                    <ChevronUp className="w-3.5 h-3.5" />
                </button>
            )}

            {rest.length > 0 && (
                <p className="text-[11px] text-muted-foreground px-1 leading-snug">
                    The bar on each row is the gap to the place above it, drawn to one scale across
                    the board — a short bar is a spot you could take this week.
                    {movement && <> Arrows are places moved since Monday.</>}
                </p>
            )}

            {/* Outside the visible list — kept, so you can always find yourself. */}
            {!meVisible && myStanding?.rank && (
                <div className="card-soft border-2 border-primary/30">
                    <p className="px-4 pt-2.5 text-[11px] text-muted-foreground">Outside the top {rows.length}</p>
                    <LedgerRow rowRef={myRowRef} {...rowProps({
                        row: myStanding.row, place: myStanding.rank, isMe: true, near: false, boardMeta,
                        title: titles.get(me), name: nameOf(myStanding.row),
                        gap: myStanding.above?.gap ?? null, gapScale: scale, move: myMove,
                        index: 0, arriving, flash,
                    })} />
                </div>
            )}

            {/* ── Your row, holding on at the edge it left by ────────────── */}
            <MyRowDock side={myRow && myPlace ? side : null} onReturn={backToRow}>
                <span className="font-display font-black tabular-nums text-lg leading-none text-primary flex-shrink-0 w-7 text-center">
                    {myPlace}
                </span>
                {/* The arrow is on the row itself; on a phone the dock stops
                    short of Ace's corner and the label needs the width more. */}
                <span className="hidden sm:inline-flex"><MoveChip move={myMove} compact /></span>
                {myRow && <BoardAvatar name={nameOf(myRow)} size={32} ring="ring-2 ring-primary/40" />}
                <span className="flex-1 min-w-0">
                    <span className="block text-xs font-black text-primary truncate">Your place</span>
                    <span className="block text-[11px] text-muted-foreground truncate">
                        {myStanding?.above
                            ? `${boardMeta.gap(myStanding.above.gap)}`
                            : "Top of the board"}
                    </span>
                </span>
                {myRow && (
                    <span className="font-display font-extrabold flex-shrink-0">
                        <LiveFigure value={boardMeta.value(myRow)} format={boardMeta.fmt} quantity={boardMeta.id} />
                    </span>
                )}
            </MyRowDock>
        </div>
        </LayoutGroup>
    );
}
