/**
 * DealtHand — the landing hero: a hand dealt across the bottom of the screen.
 *
 * What it replaces was a 496KB background video, three drifting aurora blobs
 * and a headline whose key word was gradient-clipped with a drop-shadow glow.
 * That combination is the stock template every AI-built SaaS page ships with,
 * and it made the strongest claim on the page — "this is different" — in the
 * most interchangeable way available.
 *
 * SO THE HERO SHOWS THE PRODUCT INSTEAD OF DESCRIBING IT. Every card in the
 * fan is a real object from inside the app, drawn by the same PlayingCard the
 * app itself uses, and the fan ends on the Ace of Spades. A visitor sees what
 * they are about to get twenty seconds before they get it.
 *
 * FOUR THINGS MOVE, and each one is doing a job:
 *
 *   THE DEAL. Cards fly in one at a time from Ace's hand, spinning, and land
 *   in the arc. It is the app's own motion — the same deal the review deck and
 *   the quiz table use — so the hero is the first lesson in how the thing
 *   behaves rather than an unrelated flourish.
 *
 *   THE PARALLAX. The whole fan tilts with the pointer, cards further from
 *   centre moving more. This is what makes it read as objects on a table
 *   rather than as a picture of some. It is also the cheapest premium
 *   signal available: nothing else on a page moves like real depth.
 *
 *   THE SHEEN. A specular bar crosses the fan every few seconds, the way light
 *   moves over glossy card stock when you tilt a hand. Slow enough to notice
 *   only if you're looking at it.
 *
 *   THE LIFT. Hovering a card pulls it out of the hand and squares it up. The
 *   fan is browsable, so the hero is the first interactive thing on the page
 *   rather than the last static one.
 *
 * ALL OF IT FOLDS FLAT under reduced motion: the cards are simply there, in
 * the arc, and nothing moves. The composition survives without the animation,
 * which is the test of whether the animation was decoration.
 */
import React, { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from "framer-motion";
import PlayingCard from "@/components/cards/PlayingCard";
import AceBody from "@/components/ace/AceBody";

/**
 * The hand. Five things the app is, in the order they matter to someone who
 * has never seen it: the material, the marking, the plan, the habit, and him.
 *
 * `rank` and `suit` are the app's own two marks and they are not random here
 * either — the flashcard deck carries a mastery rank, the quiz card a question
 * number, and the last card is the Ace of Spades because that is the product.
 */
const HAND = [
    { rank: "Q", suit: "heart",   label: "Flashcards",  line: "142 due",             tone: "#8B5CF6" },
    { rank: "7", suit: "diamond", label: "Quizzes",     line: "Marked like VCAA",    tone: "#3B82F6" },
    { rank: "4", suit: "club",    label: "Your week",   line: "3 sessions today",    tone: "#10B981" },
    { rank: "K", suit: "heart",   label: "The streak",  line: "41-day run",          tone: "#FF4B4B" },
    { rank: "A", suit: "spade",   label: "Ace",         line: "Your coach",          tone: "#0D1626", ace: true },
];

/**
 * The fan, in CARD WIDTHS between neighbours — not in percent of the row.
 * A percentage inside a transform resolves against the element being moved,
 * so `x: "62%"` moved each card 62% of ITS OWN width and the whole hand
 * collapsed into a pile in the middle of the hero. Expressed per-neighbour it
 * also stays right at every breakpoint, because the cards themselves scale.
 */
const STEP = 74;
const DROP = 34;
const LEAN = 12;

/** The sheen crosses this often, and takes this long. */
const SHEEN_EVERY = 5200;
const SHEEN_MS = 1400;

export default function DealtHand({ className = "" }) {
    const reduce = useReducedMotion();
    /**
     * Three cards on a phone, five on a desktop.
     *
     * Hiding the last two with a CSS class looked right and was wrong: the
     * fan's positions are computed from the middle of the hand, so dropping
     * two off the end left the remaining three sitting entirely left of
     * centre. The COUNT has to change, not just the visibility.
     */
    const [narrow, setNarrow] = useState(false);
    useEffect(() => {
        if (typeof window === "undefined") return undefined;
        const mq = window.matchMedia("(max-width: 639px)");
        const sync = () => setNarrow(mq.matches);
        sync();
        mq.addEventListener("change", sync);
        return () => mq.removeEventListener("change", sync);
    }, []);
    const hand = narrow ? HAND.slice(0, 2).concat(HAND[HAND.length - 1]) : HAND;
    const wrapRef = useRef(null);
    const [hover, setHover] = useState(-1);
    const [dealt, setDealt] = useState(false);
    const [sheen, setSheen] = useState(false);

    // Pointer, normalised to -0.5…0.5 of the hero. Sprung, so the fan has
    // weight — a tilt that tracks the cursor exactly reads as a texture map
    // rather than as a hand of cards.
    const px = useMotionValue(0), py = useMotionValue(0);
    const sx = useSpring(px, { stiffness: 110, damping: 20, mass: 0.6 });
    const sy = useSpring(py, { stiffness: 110, damping: 20, mass: 0.6 });
    const rotY = useTransform(sx, [-0.5, 0.5], [-13, 13]);
    const rotX = useTransform(sy, [-0.5, 0.5], [9, -9]);

    useEffect(() => {
        if (reduce) return undefined;
        const el = wrapRef.current;
        if (!el) return undefined;
        const onMove = (e) => {
            const b = el.getBoundingClientRect();
            px.set((e.clientX - b.left) / b.width - 0.5);
            py.set((e.clientY - b.top) / b.height - 0.5);
        };
        const onLeave = () => { px.set(0); py.set(0); };
        window.addEventListener("pointermove", onMove, { passive: true });
        window.addEventListener("pointerleave", onLeave);
        return () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerleave", onLeave);
        };
    }, [px, py, reduce]);

    // The hand is dealt once, shortly after the headline has landed.
    const [settled, setSettled] = useState(false);
    useEffect(() => {
        const a = setTimeout(() => setDealt(true), reduce ? 0 : 420);
        const b = setTimeout(() => setSettled(true), reduce ? 0 : 1500);
        return () => { clearTimeout(a); clearTimeout(b); };
    }, [reduce]);

    useEffect(() => {
        if (reduce || !dealt) return undefined;
        const tick = setInterval(() => {
            setSheen(true);
            setTimeout(() => setSheen(false), SHEEN_MS);
        }, SHEEN_EVERY);
        return () => clearInterval(tick);
    }, [reduce, dealt]);

    return (
        <div ref={wrapRef} data-dealt-hand={dealt ? "dealt" : "dealing"}
            className={`relative w-full select-none ${className}`}
            style={{ perspective: 1400 }}>

            {/* The dealer. He is mid-toss, which is the pose that launches a
                card — the hand arrives from somewhere rather than appearing. */}
            <motion.div
                className="absolute left-[1%] sm:left-[3%] bottom-[14%] z-30 pointer-events-none w-16 sm:w-28 lg:w-32"
                initial={reduce ? { opacity: 0 } : { opacity: 0, x: -60, y: 20 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ delay: 0.15, type: "spring", stiffness: 200, damping: 22 }}
            >
                <AceBody className="w-full" pose="toss" title="Ace, your coach" />
            </motion.div>

            {/* THE FAN ITSELF TAKES NO POINTER — ONLY THE SLOTS DO. This is
                not belt-and-braces, it is the second half of the jitter fix.
                `preserve-3d` puts this element's own plane into the same 3D
                space as its children, and hit-testing in there is decided by
                DEPTH, not by z-index. As the tilt springs to rest, an
                off-centre slot rocks a fraction of a degree behind that plane
                and back out again — so the topmost thing under a perfectly
                STILL cursor alternates between the slot and this container
                several times a second: enter, leave, enter, leave. Nothing
                here is interactive, so the honest fix is to make the plane
                untouchable and hand the pointer to the slots. */}
            <motion.div
                className="relative h-[clamp(172px,27vw,340px)] pointer-events-none"
                style={reduce ? undefined : { rotateX: rotX, rotateY: rotY, transformStyle: "preserve-3d" }}
            >
                {hand.map((c, i) => {
                    // -0.5 … 0.5 across the hand, which drives everything: the
                    // arc, the lean, and how much of the parallax each card
                    // takes. One number, so the fan can never come apart.
                    const t = i / (hand.length - 1) - 0.5;
                    // Offset from the middle of the hand, in card widths.
                    const off = (i - (hand.length - 1) / 2) * STEP;
                    const lifted = hover === i;
                    const rest = t * t * DROP * 4;
                    const lean = t * LEAN * 2;
                    return (
                        /* THE HIT AREA IS SEPARATE FROM THE CARD, and that is
                           the whole fix for the hover jitter. When the pointer
                           target is the thing that scales and lifts, hovering
                           it moves it — often out from under the cursor, or far
                           enough that the neighbour is now on top — so enter
                           and leave fire against each other several times a
                           second and the fan flickers.

                           This outer element never moves. It sits at the
                           card's resting position, owns the pointer, and the
                           card animating inside it is inert to the mouse. */
                        <div
                            key={c.label}
                            data-hand-slot={i}
                            onPointerEnter={() => setHover(i)}
                            onPointerLeave={() => setHover(-1)}
                            className="absolute left-1/2 bottom-4 sm:bottom-7 w-[clamp(96px,13vw,188px)]
                                pointer-events-auto"
                            style={{
                                zIndex: lifted ? 40 : 10 + i,
                                transform: `translateX(calc(-50% + ${off}%)) translateY(${rest}px) rotate(${lean}deg)`,
                                transformStyle: "preserve-3d",
                            }}
                        >
                        <motion.div
                            data-hand-card={i}
                            data-lifted={lifted ? "1" : "0"}
                            className="w-full pointer-events-none"
                            style={{ transformStyle: "preserve-3d" }}
                            initial={reduce ? { opacity: 0 } : {
                                // Relative to the slot it already sits in, so
                                // the deal is a flight from Ace's hand into
                                // place rather than a second positioning system.
                                opacity: 0, x: "-460%", y: 40, rotate: -46, scale: 0.5,
                            }}
                            animate={dealt ? {
                                opacity: 1,
                                x: 0,
                                y: lifted && !reduce ? -10 : 0,
                                rotate: lifted && !reduce ? -lean : 0,
                                scale: lifted && !reduce ? 1.11 : 1,
                            } : {}}
                            transition={reduce ? { duration: 0.2 } : {
                                type: "spring", stiffness: 190, damping: 20, mass: 0.9,
                                // The stagger belongs to the deal and nothing
                                // else. Left on, every hover-out replayed it and
                                // the card crawled back into the fan.
                                delay: settled ? 0 : i * 0.085,
                            }}
                        >
                            {/* A card lying on a table throws a real shadow.
                                Without one the fan reads as stickers.

                                TWO shadows, and both are INK rather than
                                black. A single 0.45-black blur was tuned for
                                a navy hero, where the darkest thing on screen
                                was already dark; on cream the same shadow is
                                the darkest thing in the frame and each card
                                sits in a grey smudge. Real shadows on a light
                                surface are tinted by what's around them and
                                come in two parts — a tight contact shadow that
                                says the card is touching, and a wide soft one
                                that says how far off the table it is. */}
                            <div className="relative"
                                style={{
                                    filter: "drop-shadow(0 2px 2px rgba(13,22,38,0.10)) "
                                        + "drop-shadow(0 16px 22px rgba(13,22,38,0.16))",
                                }}>
                                <PlayingCard rank={c.rank} suit={c.suit} tone={c.tone} smallIndices
                                    watermark={!c.ace}
                                    className="w-full aspect-[2.5/3.5]">
                                    {c.ace ? (
                                        <span className="absolute inset-0 grid place-items-center pt-2">
                                            <AceBody className="w-[62%]" pose="happy" idle={false} />
                                        </span>
                                    ) : (
                                        <span className="absolute inset-x-0 top-[46%] flex flex-col px-3">
                                            <span className="block font-display font-extrabold text-foreground
                                                text-[11px] sm:text-[13px] leading-tight">{c.label}</span>
                                            <span className="block text-[9px] sm:text-[11px] text-muted-foreground
                                                leading-tight mt-0.5">{c.line}</span>
                                        </span>
                                    )}
                                </PlayingCard>

                                {/* The sheen. Clipped to the card and skewed,
                                    so it reads as light crossing gloss rather
                                    than as a white rectangle. */}
                                {!reduce && (
                                    <motion.span aria-hidden="true"
                                        className="absolute inset-0 rounded-[0.9rem] overflow-hidden pointer-events-none">
                                        <motion.span
                                            className="absolute top-[-40%] h-[180%] w-[45%] -skew-x-12"
                                            style={{
                                                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.75), transparent)",
                                            }}
                                            initial={false}
                                            animate={{ left: sheen ? "130%" : "-60%" }}
                                            transition={sheen
                                                ? { duration: SHEEN_MS / 1000, ease: "easeInOut", delay: i * 0.06 }
                                                : { duration: 0 }}
                                        />
                                    </motion.span>
                                )}
                            </div>
                        </motion.div>
                        </div>
                    );
                })}
            </motion.div>
        </div>
    );
}
