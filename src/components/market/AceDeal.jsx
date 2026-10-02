/**
 * AceDeal — Ace deals the board while it loads.
 *
 * ═══ Why this and not the app's normal loader ═══════════════════════════════
 * `AceShuffle` is the right answer on the twenty-five screens that use it: a
 * riffling deck beside "Loading your dashboard…", small and out of the way. The
 * floor is the one place where that is the wrong shape, because opening it is
 * an ARRIVAL. A student lands on a dark room they have not seen before, and the
 * thing they are waiting for is a table with cards on it.
 *
 * So the wait IS the deal. Ace flicks cards out FACE DOWN onto the grid where
 * the real markets are about to be, the board turns over in a wave, and what it
 * turns over INTO is the skeleton. When the data arrives it fills in underneath.
 *
 * ═══ IT IS THE SKELETON, NOT A CURTAIN IN FRONT OF ONE ══════════════════════
 * This was true of the six cards and of NOTHING ELSE, which made it a third of
 * a promise. The real floor is a header strip, three tabs, a chip row, a board
 * and a 300px tape rail — so everything except the cards appeared at once when
 * the data landed, and the cards themselves were `h-[132px]` against a real
 * `MarketCard` that MEASURES 316px at its shortest. Three rows of that is about
 * 550px of jump on the one screen whose loader exists to prevent jumping.
 *
 * Every piece of the floor is drawn here now, at its real size and in its real
 * place. `SLOT_H` is the measured height of the commonest card — a weekly
 * streak line with a price bar and a crowd row — and the shape inside it is
 * MarketCard's own: kind row, title, the price well, the crowd row. Cards whose
 * content runs longer (a SAC line with a position on it) are taller and nothing
 * can fix that; targeting the common one is what makes the usual case seamless.
 *
 * ═══ THE HEADLINE SLOT SAYS WHAT IS HAPPENING ══════════════════════════════
 * The label used to be its own line beside him, which is an element the real
 * page does not have and therefore one more thing that vanishes. It sits in the
 * `h1` instead — the exact place "You're holding 3 positions" is about to be —
 * so the one honest non-skeleton element on screen costs no layout at all.
 *
 * ═══ THE MASCOT HAS TO BE THE THING THAT MOVES ══════════════════════════════
 * The first version of this was six cards springing in past a STILL DRAWING of
 * Ace: `pose="toss"` set once, `idle={false}`, `eyes={false}`. Every one of
 * those is a switch that turns his own motion off, so the only animation on
 * screen was the cards, and the character — the entire reason to do this rather
 * than draw a spinner — was a picture beside them.
 *
 * He is also BIG now and stands at the table's edge rather than sitting at
 * 56px in a caption. At that size he was labelling the wait; the arm is the
 * only part of him that reads as a throw and at 56px it was about nine pixels
 * of travel. He overlaps the board's left margin on purpose — a dealer stands
 * AT the table — and he is `pointer-events-none`, so the thing he overlays is
 * a placeholder nobody can click anyway.
 *
 * ═══ THE DEAL, AS THREE ACTS ═══════════════════════════════════════════════
 *   DEALING — one ROW per beat, three beats, face down. The cards fly from HIS
 *             hand: the further down and across a slot is, the further its card
 *             has travelled, so the six fan out of one point rather than
 *             sliding in from the same offset six times. Each beat is
 *             toss → recover so the arm SWINGS and comes back.
 *   TURNING — the board turns over in a WAVE, not at once: a diagonal sweep
 *             from his hand outward, each card a beat behind the one before.
 *             Turning six cards simultaneously is a transition; turning them in
 *             sequence is somebody turning them.
 *   PLEASED — `proud`: eyes arced, hands on hips. Then he simply stands with
 *             `idle` on and his own fidget system takes over. A SLOW LOAD IS
 *             THE ONE CASE A LOADER CANNOT DESIGN FOR, and the answer is the
 *             character's own behaviour rather than a loop that gets more
 *             annoying the longer it runs.
 *
 * Under `prefers-reduced-motion` every timer is skipped, the cards are simply
 * placed face up and he simply stands — identical layout, nothing moves.
 */
import React, { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import AceBody from "@/components/ace/AceBody";
import { CardBack } from "@/components/cards/PlayingCard";

/**
 * The floor's own ink. Not app tokens — the room scopes its palette on `.floor`
 * and a panel here drawn in `bg-surface` is the app's cream showing through the
 * felt, which is the class of bug `floorInk.test.mjs` exists for.
 */
const CARD = "var(--floor-card)";
const EDGE = "var(--floor-edge)";
const WELL = "var(--floor-well)";
const BONE = "var(--floor-bone)";
const DIM = "var(--floor-dim)";

/**
 * The lattice on the back of a dealt card, in the floor's own gold — the money
 * colour in this room, which is what a deck dealt onto it should be.
 *
 * Passed as `ink`/`soft` rather than as `tone`: `tone` goes through `alpha()`,
 * which parses six hex digits and cannot read a `var()`, so inking the back
 * that way meant writing a literal `#FFC800` into a floor component. The
 * palette guard failed it, correctly — that is the exact class it watches for.
 */
const BACK_INK = "rgb(var(--floor-warn-rgb) / 0.45)";
const BACK_SOFT = "var(--floor-well)";

/** As many as the grid shows before a student scrolls. More is a longer wait. */
const DEALT = 6;
/** Two columns, so a row is two cards and the deal has three beats. */
const PER_ROW = 2;
const ROWS = Math.ceil(DEALT / PER_ROW);

/**
 * MEASURED, not guessed: 316px is the shortest real `MarketCard` on the board
 * (a weekly streak line, which is also the commonest kind minted). The old
 * 132 was a number from nowhere and it is why the board jumped.
 */
const SLOT_H = 316;

/** One beat of the deal: the flick, then the arm coming back. */
const BEAT_MS = 380;
const FLICK_MS = 250;
/** The pause before the board turns, and the gap between one card and the next. */
const TURN_WAIT_MS = 240;
const TURN_STEP_MS = 95;
/** How long he holds the finish before going back to being himself. */
const PLEASED_MS = 1200;

/**
 * Where a card starts, relative to where it lands.
 *
 * Ace stands at the board's left edge beside the first row, so every card has
 * to travel back toward that point to have come FROM him — further for the
 * right-hand column, and further again for each row down. Approximate on
 * purpose: these are start offsets on an element whose final position is set by
 * the grid, so being a few pixels out changes the arc and can never change the
 * layout.
 */
function fromAce(i) {
    const col = i % PER_ROW;
    const row = Math.floor(i / PER_ROW);
    return {
        x: -(40 + col * 240),
        y: 150 - row * 170,
        rotate: -26 - col * 10,
        scale: 0.78,
        opacity: 0,
    };
}

/**
 * The order the wave turns them in — a diagonal out of his hand rather than
 * row by row, so the sweep crosses the board instead of marching down it.
 */
const turnOrder = (i) => (i % PER_ROW) + Math.floor(i / PER_ROW);

/** A bar. Everything inside a slot is one of these. */
function Bone({ w = "100%", h = 10, className = "", bg = BONE }) {
    return <div className={`rounded-full ${className}`} style={{ width: w, height: h, background: bg }} />;
}

/**
 * The face a card turns over INTO — MarketCard's own shape, so the real one
 * drops into the same outline: kind row and clock, a two-line title, the price
 * well, the crowd row.
 */
function SlotFace() {
    return (
        <div className="absolute inset-0 rounded-2xl border-2 p-4 flex flex-col"
            style={{ background: CARD, borderColor: EDGE }}>
            <div className="flex items-center justify-between gap-3 mb-3">
                <Bone w="86px" h={11} />
                <Bone w="44px" h={11} />
            </div>
            <div className="space-y-2.5 mb-4">
                <Bone w="100%" h={14} />
                <Bone w="68%" h={14} />
            </div>
            {/* The price well. A step IN from the card on the real one, and the
                thing a student's eye lands on first — so it is the tallest
                block here, the way `PriceBar` is there: the figure, the split
                drawn under it, and what each side pays under its own end. */}
            <div className="rounded-xl px-3 py-3 space-y-2.5" style={{ background: WELL }}>
                <Bone w="62px" h={24} />
                <Bone w="100%" h={14} />
                <div className="flex items-center justify-between gap-3">
                    <Bone w="52px" h={9} />
                    <Bone w="52px" h={9} />
                </div>
            </div>
            <Bone w="72%" h={8} className="mt-2.5" />
            <div className="flex items-center justify-between gap-3 mt-auto pt-3">
                <Bone w="58%" h={10} />
                <Bone w="34px" h={10} />
            </div>
        </div>
    );
}

/**
 * One card: flicked from Ace face down, then turned over.
 *
 * `perspective` goes on the PARENT and the rotation on the child — an element
 * cannot supply its own vanishing point, and a `rotateY` without one reads as a
 * horizontal squash rather than a turn. The same lesson MovePreview's card
 * records on the dashboard.
 */
function DealtCard({ i, dealt, turned, frozen }) {
    const settled = { opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 };
    // It is in the air only once its ROW has been thrown. Before that it is
    // held, which is why it is invisible rather than merely offset.
    const out = frozen || dealt > Math.floor(i / PER_ROW);
    const faceUp = frozen || turned > turnOrder(i);
    return (
        <motion.div
            aria-hidden
            initial={frozen ? settled : fromAce(i)}
            animate={out ? settled : fromAce(i)}
            transition={frozen ? { duration: 0 } : {
                // Springy on the way in, because a dealt card has weight. The
                // pair is offset by a beat of its own so a row reads as two
                // cards thrown from one hand, not as a bar dropping in.
                type: "spring", stiffness: 240, damping: 24,
                delay: (i % PER_ROW) * 0.07,
            }}
            style={{ height: SLOT_H, perspective: 1200 }}
        >
            <motion.div
                className="relative w-full h-full"
                initial={false}
                animate={{ rotateY: faceUp ? 180 : 0 }}
                transition={frozen ? { duration: 0 }
                    : { duration: 0.42, ease: [0.4, 0, 0.2, 1] }}
                style={{ transformStyle: "preserve-3d" }}
            >
                {/* Face down. The student's OWN back if they have bought one —
                    `skin` is left to the provider deliberately, because a back
                    somebody paid for being dealt onto the floor is the whole
                    point of owning it, and the cred store's own rule is that
                    owned has to be worn somewhere a person can see it. */}
                <div className="absolute inset-0" style={{ backfaceVisibility: "hidden" }}>
                    <CardBack
                        ink={BACK_INK} soft={BACK_SOFT}
                        // A fraction of the WIDTH, and a dealt slot is wide —
                        // 38% of 400px is a dinner plate on a 304px card.
                        medallion="18%"
                        className="w-full h-full !rounded-2xl"
                        style={{ background: WELL, borderColor: EDGE }}
                    />
                </div>
                {/* Face up — the skeleton, pre-rotated so it is the far side. */}
                <div className="absolute inset-0"
                    style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                    <SlotFace />
                </div>
            </motion.div>
        </motion.div>
    );
}

/**
 * The deal, as a clock.
 *
 * One state each for the rows thrown, whether the arm is mid-throw, and how far
 * the turning wave has got — because his pose and the cards have to be driven
 * by the SAME counts or the flick and the landing drift apart on a slow frame.
 */
function useDeal(frozen) {
    const [dealt, setDealt] = useState(frozen ? ROWS : 0);
    const [flicking, setFlicking] = useState(false);
    const [turned, setTurned] = useState(frozen ? DEALT : 0);
    const [pleased, setPleased] = useState(false);

    useEffect(() => {
        if (frozen) return undefined;
        const timers = [];
        for (let r = 0; r < ROWS; r += 1) {
            const at = r * BEAT_MS;
            timers.push(setTimeout(() => setFlicking(true), at));
            // The card leaves his hand PART WAY through the flick, not at the
            // start of it — a card that departs before the arm moves reads as
            // two unrelated animations.
            timers.push(setTimeout(() => { setDealt(r + 1); setFlicking(false); },
                at + FLICK_MS));
        }
        // The turn. One card at a time along the diagonal: six turning at once
        // is a transition, six turning in sequence is somebody turning them.
        const landed = ROWS * BEAT_MS + TURN_WAIT_MS;
        const steps = PER_ROW + ROWS - 1;
        for (let s = 0; s <= steps; s += 1) {
            timers.push(setTimeout(() => setTurned(s + 1), landed + s * TURN_STEP_MS));
        }
        const done = landed + steps * TURN_STEP_MS + 300;
        timers.push(setTimeout(() => setPleased(true), done));
        // …and then he stops performing and goes back to being himself.
        timers.push(setTimeout(() => setPleased(false), done + PLEASED_MS));
        return () => timers.forEach(clearTimeout);
    }, [frozen]);

    return { dealt, flicking, turned, pleased };
}

/** A pill in the tab row, at the real control's size. */
function TabBone({ w }) {
    return (
        <div className="rounded-xl border-2 px-3.5 py-2 flex items-center"
            style={{ borderColor: EDGE, height: 38 }}>
            <Bone w={w} h={11} bg={DIM} />
        </div>
    );
}

export default function AceDeal({ label = "Opening the floor…" }) {
    const reduce = useReducedMotion();
    const { dealt, flicking, turned, pleased } = useDeal(reduce);

    const done = turned > PER_ROW + ROWS - 1;
    // One expression, so what he is doing can never disagree with what the
    // cards are doing. `stand` is the only resting pose here, which is what
    // lets his own idles fire once the deal is over.
    // `stand` is the recovery on purpose: it is the biggest arm delta from
    // `toss` in the pose table, and the arm is the only part of him large
    // enough to read as a throw. `offer` was the first choice and its hands sit
    // almost where the toss leaves them, so the flick disappeared.
    const pose = reduce ? "stand"
        : flicking ? "toss"
            : pleased ? "proud"
                : "stand";

    return (
        <div className="max-w-6xl mx-auto">

            {/* ── The strip: the real header, with the wait in the headline ── */}
            <header className="flex flex-wrap items-end justify-between gap-4 mb-5">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest"
                        style={{ color: DIM }}>The floor</p>
                    {/* Exactly where "You're holding 3 positions" lands. */}
                    <h1 className="font-display font-black text-2xl sm:text-3xl leading-tight"
                        style={{ color: "var(--floor-muted-2)" }}>{label}</h1>
                </div>
                <div className="flex items-end gap-5">
                    <div className="space-y-1.5">
                        <p className="text-[10px] font-black uppercase tracking-widest"
                            style={{ color: DIM }}>Cred</p>
                        <Bone w="76px" h={22} />
                    </div>
                </div>
            </header>

            {/* The three tabs, at their real width. */}
            <div className="flex items-center gap-1.5 mb-4" aria-hidden>
                <TabBone w="58px" /><TabBone w="56px" /><TabBone w="32px" />
            </div>

            <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-6 items-start">

                {/* ── THE BOARD ───────────────────────────────────────────── */}
                <div className="min-w-0 relative">

                    {/* He stands AT the table rather than in a caption above
                        it, and he overlaps its left margin because that is
                        where a dealer stands. `pointer-events-none`: the only
                        thing under him is a placeholder. */}
                    {/* He stands at the board's near-left corner and
                        overlaps it, because that is where a dealer stands —
                        and the thing he overlaps is a placeholder nobody can
                        click. He cannot go further out: `Room` pads the page
                        by 16/24px and `max-w-6xl` leaves nothing at 1152, so a
                        larger negative offset is a horizontal scrollbar at
                        some width, which is the exact bug `Room`'s own header
                        records. A halo in the GROUND colour is what separates
                        him from the card instead — the BrandMark glow idiom,
                        pointed the other way. */}
                    <div className="absolute z-20 pointer-events-none
                        -left-2 sm:-left-5 top-[96px] sm:top-[118px]"
                        style={{ filter: "drop-shadow(0 0 14px var(--floor-ground)) drop-shadow(0 0 26px var(--floor-ground))" }}>
                        <AceBody
                            className="w-28 sm:w-40"
                            pose={pose}
                            tone="fill-[var(--floor-ink)]"
                            card="fill-[var(--floor-card)]"
                            cardStroke="stroke-[var(--floor-edge)]"
                            // ON, both of them. These were the switches that
                            // made the first version a still drawing: without
                            // idles he freezes the moment the deal ends, and
                            // without eyes he does not look at the person
                            // waiting.
                            idle={done}
                            eyes
                            title="Ace dealing the board"
                        />
                    </div>

                    {/* The filter chips, where the real ones sit. */}
                    <div className="flex items-center gap-1.5 pb-2 mb-0.5" aria-hidden>
                        {["34px", "50px", "42px", "56px"].map((w, i) => (
                            <div key={i} className="rounded-lg border-2 px-3 py-1.5 flex items-center"
                                style={{ borderColor: EDGE, height: 30 }}>
                                <Bone w={w} h={9} bg={DIM} />
                            </div>
                        ))}
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                        {Array.from({ length: DEALT }, (_, i) => (
                            <DealtCard key={i} i={i} dealt={dealt} turned={turned} frozen={reduce} />
                        ))}
                    </div>
                </div>

                {/* ── THE TAPE ────────────────────────────────────────────── */}
                {/* It is a 300px column on the real page, so leaving it out
                    moved the board sideways the moment the data arrived. */}
                <aside className="space-y-4" aria-hidden>
                    <section className="rounded-2xl border-2 p-4"
                        style={{ background: CARD, borderColor: EDGE }}>
                        <h2 className="text-[10px] font-black uppercase tracking-widest mb-3"
                            style={{ color: DIM }}>The tape</h2>
                        <div className="space-y-3">
                            {["92%", "74%", "86%", "60%", "80%", "68%"].map((w, i) => (
                                <div key={i} className="space-y-1.5">
                                    <Bone w={w} h={9} />
                                    <Bone w="40%" h={7} bg={WELL} />
                                </div>
                            ))}
                        </div>
                    </section>
                </aside>
            </div>
        </div>
    );
}
