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
 *   THE PODIUM. Top three read as a result rather than as rows 1–3 of 50.
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
 * THE SCALE IS THE MEDIAN GAP, NOT THE LARGEST. Dividing by the largest looked
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
 * Scroll past yourself and a compact bar pins your place, your figure and your
 * reach to the bottom of the screen; tap it to go back to the row. Being 18th
 * on a board of thirty and having to hunt for your own name is how a
 * leaderboard stops being motivating. It only appears when the real row is off
 * screen — a permanent bar would be a second, smaller copy of a row already in
 * front of them — and it sits ABOVE the bottom nav on a phone rather than
 * under it, which is the one way this can render as a thing nobody can tap.
 */
import React, { useMemo, useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Crown, Medal, ChevronUp, ChevronDown, Minus, ArrowDown } from "lucide-react";
import { avatarHue, initialsOf, rowFlex, BAND_TONE } from "@/lib/ranked";
import { movementLabel } from "@/lib/boardMovement";
import CrestRow from "@/components/ranked/CrestRow";

const TONE_PILL = {
    muted: "bg-secondary text-muted-foreground", xp: "bg-xp/15 text-xp",
    "chart-3": "bg-chart-3/15 text-chart-3", "chart-4": "bg-chart-4/15 text-chart-4",
    primary: "bg-primary/15 text-primary", streak: "bg-streak/15 text-streak",
};

/**
 * The podium's three looks. Gold / silver / bronze is the convention and the
 * palette has no bronze token, so third place is the XP amber at low strength
 * with an OUTLINE medal — the same two-tokens-three-readings trick `Crest`
 * makes, and for the same reason: inventing a hue for one mark is not worth a
 * colour in the palette, and the shape has to carry the place anyway.
 */
const PODIUM = [
    { ring: "ring-xp/70",      bg: "bg-xp/[0.08]",     border: "border-xp/50",
      ink: "text-xp",             icon: Crown, fill: true },
    { ring: "ring-border",     bg: "bg-secondary/60",  border: "border-border",
      ink: "text-muted-foreground", icon: Medal, fill: true },
    { ring: "ring-xp/30",      bg: "bg-xp/[0.04]",     border: "border-xp/25",
      ink: "text-xp/70",          icon: Medal, fill: false },
];

function Avatar({ name, size = 40, ring = "" }) {
    const hue = avatarHue(name);
    return (
        <div className={`rounded-2xl flex items-center justify-center font-display font-black flex-shrink-0 ${ring}`}
            style={{
                width: size, height: size,
                backgroundColor: `hsl(${hue} 70% 92%)`,
                color: `hsl(${hue} 70% 28%)`,
                fontSize: size * 0.36,
            }}
            aria-hidden="true">
            {initialsOf(name)}
        </div>
    );
}

function Title({ title }) {
    if (!title) return null;
    return (
        <span className={`pill text-[10px] ${TONE_PILL[title.tone] || TONE_PILL.primary}`} title={title.blurb}>
            {title.label}
        </span>
    );
}

/**
 * Which way this row has gone, in a fixed-width column.
 *
 * SHAPE CARRIES THE DIRECTION, not just colour. The brand green and the streak
 * red sit at ΔE 7.0 under deuteranopia — the floor's own step-dot lesson — so
 * an up arrow against a down arrow is what makes this readable, with the
 * number as the third channel. A level row draws a dash rather than nothing,
 * because "still there" and "we have no snapshot" are different facts and the
 * second one draws no chip at all.
 */
function MoveChip({ move, compact = false }) {
    if (!move) return null;
    const label = movementLabel(move);
    const box = `inline-flex items-center justify-center gap-0.5 tabular-nums font-bold ${
        compact ? "text-[10px]" : "text-[11px]"}`;

    if (move.dir === "new") {
        return (
            <span className={`${box} px-1.5 py-0.5 rounded-md bg-xp/15 text-xp text-[9px] tracking-wide`}
                title={label} aria-label={label}>NEW</span>
        );
    }
    if (move.dir === "level") {
        return (
            <span className={`${box} text-muted-foreground/60`} title={label} aria-label={label}>
                <Minus className="w-3 h-3" />
            </span>
        );
    }
    const up = move.dir === "up";
    return (
        <span className={`${box} ${up ? "text-primary" : "text-streak"}`} title={label} aria-label={label}>
            {up ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {move.places}
        </span>
    );
}

function Row({ row, place, isMe, boardMeta, title, name, gap, gapScale, near, move, innerRef }) {
    const flex = rowFlex(row, boardMeta.id);
    const band = boardMeta.id === "atar" ? row.band : null;
    // A gap of zero is a genuine tie, not a missing value, so it still draws —
    // at the floor width, which reads as "level with them".
    const pct = gap != null && gapScale > 0
        ? Math.max(4, Math.min(100, (gap / gapScale) * 100))
        : null;

    return (
        <div ref={innerRef} data-row={isMe ? "me" : undefined}
            /* The rail is what makes three rows read as one group. A tint
               alone did not: at the strength a leaderboard can carry without
               looking striped, "slightly warmer grey" is invisible next to
               white, and the contest you are actually in has to be findable
               without hunting for your own name.

               SIDE-SPECIFIC colour utilities, and the list separates itself
               with `border-t` rather than `divide-y`. Tailwind's divide-*
               writes `border-color` on every child through a combinator, which
               outranks a plain `border-primary` on the child itself — so the
               first version of this rail came out the same grey as the
               dividers, on every row, and looked like nothing had changed. */
            className={`pl-2 pr-3 sm:pl-3 sm:pr-4 py-2.5 border-t border-t-border border-l-4 transition-colors ${
                isMe ? "bg-primary/[0.07] border-l-primary"
                    : near ? "bg-primary/[0.03] border-l-primary/30"
                    : "border-l-transparent hover:bg-secondary/40"}`}>
            <div className="flex items-center gap-2 sm:gap-3">
                {/* THE PLACE, with weight. It was a 7px muted digit, which on a
                    board is the one column that cannot be incidental. */}
                <span className={`w-6 sm:w-8 text-center font-display font-black flex-shrink-0 tabular-nums
                    text-base sm:text-lg leading-none ${isMe ? "text-primary" : "text-foreground/70"}`}>
                    {place}
                </span>
                {/* A fixed lane, so the arrows form a column instead of
                    shuffling sideways with the length of the place beside
                    them. Reserved even when this board has no snapshot — an
                    empty lane costs 22px and keeps every other column still. */}
                <span className="w-6 sm:w-7 flex items-center justify-center flex-shrink-0">
                    <MoveChip move={move} />
                </span>
                <Avatar name={name} size={38}
                    ring={isMe ? "ring-2 ring-primary/40" : "ring-1 ring-border"} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <p className={`text-sm truncate ${isMe ? "font-black text-primary" : "font-bold text-foreground"}`}>
                            {name}
                        </p>
                        <Title title={title} />
                        {band && (
                            <span className={`pill text-[10px] ${TONE_PILL[BAND_TONE[band]] || TONE_PILL.muted}`}>{band}</span>
                        )}
                        {/* The rarest badges this student holds. Until now an
                            achievement was visible only to its owner, on a tab
                            inside a tab — a private checklist rather than
                            anything competitive. Commons are excluded by
                            CrestRow: a mark everybody carries distinguishes
                            nobody and would be noise on every line. */}
                        <CrestRow crests={row.crests} />
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{flex || " "}</p>
                </div>
                {row.streak_days > 0 && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-streak flex-shrink-0 w-12 justify-end">
                        <Flame className={row.streak_days >= 30 ? "w-4 h-4" : "w-3 h-3"} /> {row.streak_days}
                    </span>
                )}

                {/* THE FIGURE, AND THE REACH, IN ONE RIGHT-ALIGNED COLUMN of
                    fixed width — so every score on the board shares a right
                    edge and the gap bar sits directly under the number it is a
                    difference from. Stacked rather than on two rows of the
                    card: a hairline spanning the full width read as a divider
                    that had gone wrong, and the length is the information, so
                    it needs a bar comparable with the one above it rather than
                    a bigger one. */}
                <div className="flex-shrink-0 w-[4.75rem] sm:w-[6.5rem] text-right">
                    <span className="font-display font-extrabold text-foreground tabular-nums text-base sm:text-lg leading-none">
                        {boardMeta.fmt(boardMeta.value(row))}
                    </span>
                    {pct != null && (
                        <div className="flex items-center justify-end gap-1.5 mt-1">
                            <span className={`inline-flex items-center text-[10px] font-bold tabular-nums ${
                                isMe ? "text-primary" : "text-muted-foreground"}`}>
                                <ChevronUp className="w-2.5 h-2.5" />{boardMeta.gapShort
                                    ? boardMeta.gapShort(gap) : gap.toFixed(2)}
                            </span>
                            <div className="h-1.5 w-8 sm:w-12 rounded-full bg-secondary overflow-hidden flex-shrink-0">
                                <motion.div
                                    initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                    transition={{ duration: 0.5, ease: "easeOut" }}
                                    className={`h-full rounded-full ${isMe ? "bg-primary" : "bg-muted-foreground/40"}`} />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
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
    // are drawn against.
    const { gaps, gapScale } = useMemo(() => {
        const g = rows.map((r, i) => (i === 0 ? null
            : Math.max(0, (boardMeta.value(rows[i - 1]) || 0) - (boardMeta.value(r) || 0))));
        const finite = g.filter(v => typeof v === "number" && Number.isFinite(v)).sort((a, b) => a - b);
        if (!finite.length) return { gaps: g, gapScale: 0 };
        const median = finite[Math.floor(finite.length / 2)];
        // A board where everyone is level has a median of 0 and no scale to
        // draw against; fall back to the largest so the bars still mean
        // something rather than dividing by zero.
        return { gaps: g, gapScale: median > 0 ? median * 2 : finite[finite.length - 1] };
    }, [rows, boardMeta]);

    // ── Your row, pinned when it scrolls away ──────────────────────────────
    const myRowRef = useRef(null);
    const [myRowOff, setMyRowOff] = useState(false);
    useEffect(() => {
        const el = myRowRef.current;
        // Nothing to observe when you are on the podium (always near the top)
        // or not on this board at all.
        if (!el || typeof IntersectionObserver !== "function") { setMyRowOff(false); return; }
        const io = new IntersectionObserver(
            ([entry]) => setMyRowOff(!entry.isIntersecting),
            // A row half out of view is still a row you can see, so the bar
            // waits until it is genuinely gone.
            { threshold: 0.4 });
        io.observe(el);
        return () => io.disconnect();
    }, [rows, me, boardMeta]);

    const myMove = movement?.[me] || null;
    const myPlace = meVisible ? meIndex + 1 : myStanding?.rank || null;
    const myRow = meVisible ? rows[meIndex] : myStanding?.row || null;

    if (!rows.length) return null;

    return (
        <div className="space-y-3">
            {/* ── Podium ─────────────────────────────────────────────────── */}
            {/* 2-1-3, with the winner raised. `items-end` is what makes the
                three read as a podium rather than as three cards: the shorter
                two sit on the same baseline and the middle one stands up out
                of it.

                CAPPED AND CENTRED, because a podium is an OBJECT and three
                cards stretched to the width of a 1100px board column are three
                panels. At full width each card was ~360px holding a 56px
                avatar and one number, so the thing meant to be the ceremony at
                the top of the board was the emptiest part of the page. At 2xl
                the cards land near 215px, which is about the proportion a real
                podium step has — and on a phone the cap is far wider than the
                viewport, so nothing changes there. */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 items-end max-w-2xl sm:mx-auto">
                {[1, 0, 2].map(slot => {
                    const r = top[slot];
                    if (!r) return <div key={slot} />;
                    const p = PODIUM[slot];
                    const Icon = p.icon;
                    const name = nameOf(r);
                    const isMe = r.user_email === me;
                    const mv = movement?.[r.user_email] || null;
                    return (
                        <motion.div key={r.user_email}
                            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.06 * slot, duration: 0.38, ease: [0.4, 0, 0.2, 1] }}
                            data-podium={slot + 1}
                            className={`relative rounded-2xl border-2 ${p.border} ${p.bg} overflow-hidden
                                ${isMe ? "ring-2 ring-primary" : ""}`}>

                            {/* THE PLINTH. A place drawn as a numeral on a band
                                along the bottom is what a podium looks like;
                                the earlier version put a "1st" pill, a medal
                                glyph AND the number in the same card, which is
                                three things saying one thing — this file's own
                                icon rule, three times over. */}
                            <div className={`px-2 pt-3 pb-2 text-center ${slot === 0 ? "sm:pt-5" : ""}`}>
                                <div className="flex justify-center mb-2">
                                    <div className="relative">
                                        <Avatar name={name} size={slot === 0 ? 56 : 44}
                                            ring={`ring-2 ${p.ring}`} />
                                        {/* The medal rides ON the avatar ring, so
                                            it marks the person rather than
                                            floating above the card as a second
                                            label for the numeral below. */}
                                        <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full
                                            bg-surface border-2 ${p.border} flex items-center justify-center`}>
                                            <Icon className={`w-2.5 h-2.5 ${p.ink}`}
                                                strokeWidth={p.fill ? 2.5 : 2} />
                                        </span>
                                    </div>
                                </div>
                                <p className={`text-xs truncate px-1 ${isMe ? "font-black text-primary" : "font-bold text-foreground"}`}>
                                    {name}
                                </p>
                                <p className="font-display font-black text-foreground tabular-nums mt-0.5 leading-none"
                                    style={{ fontSize: slot === 0 ? "1.5rem" : "1.15rem" }}>
                                    {boardMeta.fmt(boardMeta.value(r))}
                                </p>
                                {/* THE TITLE IS A LUXURY AT 110px. A podium
                                    card on a 360px phone is a third of the
                                    screen, and "Metronome" beside a movement
                                    chip is wider than that — so the pill was
                                    clipped by the card's own `overflow-hidden`
                                    and bled off the side as a cut-off word.
                                    The movement chip earns its place at every
                                    width; the title comes back at `sm`, where
                                    there is room for it. */}
                                <div className="flex justify-center items-center gap-1.5 mt-1.5 min-h-[1.1rem] px-1">
                                    <MoveChip move={mv} compact />
                                    <span className="hidden sm:inline-flex min-w-0">
                                        <Title title={titles.get(r.user_email)} />
                                    </span>
                                </div>
                            </div>

                            <div className={`py-1 text-center font-display font-black text-sm leading-none
                                border-t-2 ${p.border} ${p.ink}`}>
                                {slot + 1}
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* ── The rest ───────────────────────────────────────────────── */}
            {rest.length > 0 && (
                <div className="card-soft overflow-hidden [&>*:first-child]:border-t-0">
                    {rest.map((r, i) => {
                        const idx = i + 3;
                        // Your row and the two either side: the race you are
                        // actually in, marked as one group.
                        const near = meVisible && Math.abs(idx - meIndex) === 1;
                        const isMe = r.user_email === me;
                        return (
                            <Row key={r.user_email} row={r} place={idx + 1}
                                isMe={isMe} near={near} innerRef={isMe ? myRowRef : undefined}
                                boardMeta={boardMeta} title={titles.get(r.user_email)} name={nameOf(r)}
                                move={movement?.[r.user_email] || null}
                                gap={gaps[idx]} gapScale={gapScale} />
                        );
                    })}

                    {/* YOU, WHEREVER YOU ACTUALLY ARE. Appended under the seven
                        with your real place, so collapsing the board can never
                        be the reason you cannot find yourself — the rule the
                        pinned bar keeps, reached from the other direction. The
                        rule above it says the rows between are not drawn
                        rather than letting 8th and 24th sit flush and read as
                        adjacent. */}
                    {!expanded && meCutOff && meVisible && (
                        <>
                            <div className="px-4 py-1.5 bg-secondary/40 border-t border-border
                                text-[10px] font-bold text-muted-foreground tracking-wide">
                                ⋯ {meIndex - (3 + rest.length) } more
                            </div>
                            <Row row={rows[meIndex]} place={meIndex + 1} isMe innerRef={myRowRef}
                                boardMeta={boardMeta} title={titles.get(me)} name={nameOf(rows[meIndex])}
                                move={movement?.[me] || null}
                                gap={gaps[meIndex]} gapScale={gapScale} />
                        </>
                    )}
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

            {/* Outside the visible list — pinned, so you can always find yourself. */}
            {!meVisible && myStanding?.rank && (
                <div className="card-soft overflow-hidden border-2 border-primary/30">
                    <p className="px-4 pt-2.5 text-[11px] text-muted-foreground">Outside the top {rows.length}</p>
                    <Row row={myStanding.row} place={myStanding.rank} isMe innerRef={myRowRef}
                        boardMeta={boardMeta} title={titles.get(me)} name={nameOf(myStanding.row)}
                        move={myMove}
                        gap={myStanding.above?.gap ?? null} gapScale={gapScale} />
                </div>
            )}

            {/* ── Your place, pinned while your row is off screen ────────── */}
            <AnimatePresence>
                {myRowOff && myRow && myPlace && (
                    <motion.button
                        type="button"
                        onClick={() => myRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
                        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 16 }}
                        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                        /* ABOVE the bottom nav, which is `md:hidden fixed
                           bottom-0` at about 72px tall and `z-40`. Under it,
                           this is a control nobody can reach on a phone. */
                        className="fixed left-3 right-3 sm:left-auto sm:right-6 sm:w-[22rem]
                            bottom-[5.25rem] md:bottom-5 z-30
                            flex items-center gap-2.5 px-3 py-2.5 rounded-2xl
                            bg-foreground text-background shadow-xl text-left
                            active:scale-[0.98] transition-transform">
                        <span className="font-display font-black tabular-nums text-lg leading-none flex-shrink-0">
                            {myPlace}
                        </span>
                        <span className="flex-1 min-w-0">
                            <span className="block text-xs font-bold truncate">Your place</span>
                            <span className="block text-[11px] opacity-70 truncate">
                                {myStanding?.above
                                    ? `${boardMeta.gap(myStanding.above.gap)}`
                                    : "Top of the board"}
                            </span>
                        </span>
                        <span className="font-display font-extrabold tabular-nums flex-shrink-0">
                            {boardMeta.fmt(boardMeta.value(myRow))}
                        </span>
                        <ArrowDown className="w-3.5 h-3.5 opacity-60 flex-shrink-0" />
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
}
