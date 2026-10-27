/**
 * OpeningDeal — the first two and a half seconds of acedit.au.
 *
 * ─── WHAT IT REPLACED ───────────────────────────────────────────────────────
 * CardStorm: six hundred grey rectangles thrown at a navy screen, swarming
 * into a brain and being absorbed by it over five seconds, ending on a green
 * fog and then a fade to the cream page. Three things were wrong and none of
 * them was the code:
 *
 *   - THE BRAIN READ AS AN EGG. A point cloud held in profile is a brain to
 *     the person who built it; to a visitor it was an oval of confetti.
 *   - IT WAS NOT THIS APP'S VOCABULARY. The brain had already left the
 *     dashboard. What the app is made of now is cards, the ace of spades, and
 *     Ace — the logo is that ace, and the hero underneath is a dealt hand.
 *   - IT ENDED ON A FLASH. Navy, then green fog, then cream. The jump from
 *     dark to light was the last thing it did and the one thing it did not
 *     design.
 *
 * ─── WHAT IT IS ─────────────────────────────────────────────────────────────
 * Ace riffles a deck, fans it, and the middle card turns over: the ace of
 * spades. That card then flies into the logo in the header — its pip shrinks
 * onto the glyph exactly, so the mark the visitor watched turn over IS the
 * logo — while the navy opens around it like an iris onto the page, and the
 * hero hand deals straight on. The dark-to-light change is the ending now,
 * not an accident after it.
 *
 * ─── THE RULES IT KEEPS ─────────────────────────────────────────────────────
 *   - The marketing entry only, once a session, never under reduced motion —
 *     `opensOn`, the same three tests the boot layer in index.html makes.
 *   - Skippable on any input: a tap, a key, a scroll.
 *   - IT NEVER OPENS ONTO A LOADER. After the turn it holds on the ace until
 *     the app's own loaders (`data-app-waiting`) are gone, so the iris shows
 *     the page rather than a spinner. `HOLD_MAX_MS` is the ceiling, and it
 *     sits under the hero hand's own so the hand cannot deal behind it.
 *   - The page underneath is laid out the whole time and only hidden from
 *     paint (`visibility`, never `display`), so nothing reflows when it shows.
 *
 * The arithmetic — the beats, the riffle, the flight onto the glyph, the iris
 * radius — is `src/lib/openingDeal.js`, pure, and `openingDeal.test.mjs` runs
 * it. Literal ink throughout: this is a room of its own, the same navy the
 * boot layer paints before any stylesheet exists.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
    motion, useReducedMotion, useMotionValue, useMotionTemplate, useTransform, animate,
} from "framer-motion";
import PlayingCard, { CardBack } from "@/components/cards/PlayingCard";
import { SpadePip } from "@/components/ace/SpadeMark";
import AceBody from "@/components/ace/AceBody";
import { claimAce } from "@/components/ace/useAceYield";
import { FLUSH_SEEN, OPENING_DONE } from "@/components/marketing/flushGate";
import {
    DECK, BEATS, OPEN_MS, FLIGHT_MS, STOCK_FADE_DELAY_MS, STOCK_FADE_MS, LOGO_SWAP_MS, ANNOUNCE_MS,
    FLICK, SKIP_MS, LIFT_Y, LIFT_SCALE, ACE_INDEX, RIFFLE_STAGGER, IRIS_EDGE, stackOf, riffleOf,
    fanAngle, foldDelay, flightTo, irisRadius, landable, holdStep, opensOn,
} from "@/lib/openingDeal";

const NAVY = "#0D1626";

/**
 * The house deck's back: a white border round a deep green field, the way a
 * real deck is printed. The app's default back is the deck colour at 16% on
 * card stock, which is right on a page and washes out to a pale smear on this
 * navy. Not in BACK_SKINS: it is not for sale, and it is deliberately not the
 * Felt skin somebody can buy, so the opening does not wear an item off the
 * shelf.
 */
const HOUSE = { ground: "#0F3B22", ink: "#58CC02", medallion: "#0F3B22", pip: "#E8F5DC" };

function HouseBack() {
    return (
        <div className="w-full h-full rounded-[0.9rem] bg-white p-[6%]
            shadow-[0_1px_2px_rgba(0,0,0,0.25),0_16px_30px_-14px_rgba(0,0,0,0.6)]">
            <CardBack skin={HOUSE} flat className="w-full h-full !rounded-[0.55rem]" />
        </div>
    );
}

/** Before the turn the cards wear the stack's places; after the riffle, the new ones. */
const STACK = stackOf(DECK);
const RIFFLE = riffleOf(DECK);

/** The page is drawn once nothing in it is still a loader. */
function pageReady() {
    const root = document.getElementById("root");
    if (!root || !root.firstElementChild) return false;
    return !root.querySelector("[data-app-waiting]");
}

/** The first logo glyph on screen, if there is one to land on. */
function logoTarget() {
    for (const svg of document.querySelectorAll("[data-brand-spade] svg")) {
        const rect = svg.getBoundingClientRect();
        if (landable(rect, window.innerWidth, window.innerHeight)) {
            return { holder: svg.closest("[data-brand-spade]"), rect };
        }
    }
    return null;
}

/**
 * How far into its fade the boot layer's line is, as a CSS delay for ours. A
 * CSS animation with delay d is at progress (t − d) at local time t, and ours
 * is inserted at t = 0, so matching the boot's elapsed time e means d = 0.15 − e.
 * Navigation start is the fallback, and it is EARLIER than the boot's first
 * paint by the server's response time, so it is only used when the boot's
 * own clock cannot be read.
 */
function lineDelayNow() {
    let elapsed = null;
    try {
        const anim = document.querySelector("#boot .acedit-open-line")?.getAnimations?.()[0];
        if (anim && typeof anim.currentTime === "number") elapsed = anim.currentTime / 1000;
    } catch { /* no Web Animations: fall through */ }
    if (elapsed === null) elapsed = (typeof performance !== "undefined" ? performance.now() : 0) / 1000;
    return `${(0.15 - elapsed).toFixed(3)}s`;
}

/** Where each card sits, per phase. Percentages are of the card, so the deck scales. */
function cardTarget(phase, i) {
    const r = RIFFLE[i];
    const home = STACK[i];
    const after = STACK[r.order];
    const isAce = r.order === ACE_INDEX;
    switch (phase) {
        case "arrive":
            return {
                animate: { opacity: 1, x: `${home.x}%`, y: `${home.y}%`, rotate: home.rotate, scale: 1 },
                transition: { type: "spring", stiffness: 260, damping: 24, delay: i * 0.02 },
            };
        case "split":
            return {
                animate: { opacity: 1, x: `${r.side * 40 + home.x}%`, y: `${home.y - 6}%`, rotate: r.side * 10, scale: 1 },
                transition: { duration: 0.2, ease: "easeOut" },
            };
        case "riffle":
            return {
                animate: { opacity: 1, x: `${after.x}%`, y: `${after.y}%`, rotate: after.rotate, scale: 1 },
                transition: { duration: 0.16, ease: "easeIn", delay: r.order * RIFFLE_STAGGER },
            };
        case "fan":
            return {
                animate: { opacity: 1, x: "0%", y: "0%", rotate: fanAngle(r.order), scale: 1 },
                transition: { type: "spring", stiffness: 220, damping: 22, delay: Math.abs(r.order - ACE_INDEX) * 0.015 },
            };
        default:
            // turn, hold, open, skip
            return isAce
                ? {
                    animate: { opacity: 1, x: "0%", y: `${LIFT_Y * 100}%`, rotate: 0, scale: LIFT_SCALE },
                    transition: { type: "spring", stiffness: 210, damping: 20 },
                }
                : {
                    animate: { opacity: 0, x: "0%", y: "18%", rotate: 0, scale: 0.92 },
                    transition: { duration: 0.32, ease: "easeIn", delay: foldDelay(r.order) },
                };
    }
}

/** Ace's pose per phase: he shuffles, holds the hand, flicks the ace over, and is pleased. */
const POSE = {
    arrive: "stand", split: "shuffle", riffle: "shuffle", fan: "offer",
    turn: "toss", hold: "proud", open: "proud", skip: "proud",
};

export default function OpeningDeal() {
    const reduce = useReducedMotion();
    // null = not playing. Otherwise one of the beats, then "hold", "open" or "skip".
    const [phase, setPhase] = useState(null);
    const [flight, setFlight] = useState(null);
    const phaseRef = useRef(null);
    phaseRef.current = phase;

    const deckRef = useRef(null);
    const aceRef = useRef(null);
    const logoRef = useRef(null);
    const announced = useRef(false);
    const timers = useRef([]);

    // The line's fade, kept in phase with the boot layer's, which has been
    // running since the document first painted: this one starts exactly as
    // far into the same animation, read off the boot's own clock.
    const [lineDelay] = useState(lineDelayNow);

    // The iris. A radial gradient on the GROUND, which is a layer of its own
    // under the cards, so the ace is never cut by the hole it opens.
    const irisX = useMotionValue(0);
    const irisY = useMotionValue(0);
    const irisR = useMotionValue(0);
    const rimR = useTransform(irisR, (r) => r + 1.5);
    const edgeR = useTransform(irisR, (r) => r + IRIS_EDGE);
    const iris = useMotionTemplate`radial-gradient(circle at ${irisX}px ${irisY}px, rgba(13,22,38,0) ${irisR}px, rgba(88,204,2,0.35) ${rimR}px, ${NAVY} ${edgeR}px)`;

    const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };

    const announce = useCallback(() => {
        if (announced.current) return;
        announced.current = true;
        window.dispatchEvent(new CustomEvent(OPENING_DONE));
    }, []);

    const showPage = () => {
        const root = document.getElementById("root");
        if (root) root.style.visibility = "";
    };
    const showLogo = () => {
        if (logoRef.current) logoRef.current.style.visibility = "";
        logoRef.current = null;
    };

    useEffect(() => {
        let pathname = "/";
        if (typeof window !== "undefined") pathname = window.location.pathname;
        if (!opensOn({ pathname, seen: FLUSH_SEEN, reduce })) return undefined;
        setPhase("arrive");
        return undefined;
    }, [reduce]);

    // He is on screen over everything, so he claims the stage for as long as
    // the opening plays: nobody else draws an Ace underneath it.
    const playing = phase !== null;
    useEffect(() => (playing ? claimAce("opening") : undefined), [playing]);

    /**
     * THE PAGE UNDERNEATH IS HIDDEN FROM PAINT while the ground is solid. It
     * is a full marketing page compositing under something opaque, and the
     * opening pays for every frame of it. `visibility`, so it stays laid out
     * and the logo can still be measured; restored in cleanup as well as when
     * the ground opens, so a crash can never leave the site invisible.
     */
    useEffect(() => {
        const root = document.getElementById("root");
        if (!playing || !root) return undefined;
        const prev = root.style.visibility;
        root.style.visibility = "hidden";
        // The boot layer goes once this has painted over it, never before.
        const raf = requestAnimationFrame(() => document.getElementById("boot")?.remove());
        return () => {
            cancelAnimationFrame(raf);
            root.style.visibility = prev;
            showLogo();
            timers.current.forEach(clearTimeout);
            timers.current = [];
        };
    }, [playing]);

    const open = useCallback(() => {
        if (phaseRef.current !== "hold" && phaseRef.current !== "turn") return;
        const card = aceRef.current?.getBoundingClientRect();
        const box = deckRef.current?.getBoundingClientRect();
        const target = logoTarget();
        const origin = box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : null;
        const move = card && origin && target ? flightTo(card, origin, target.rect, LIFT_SCALE) : null;
        if (move && target.holder) {
            logoRef.current = target.holder;
            target.holder.style.visibility = "hidden";
        }
        setFlight(move || { x: 0, y: 0, scale: 0.6, out: true });

        const cx = card ? card.left + card.width / 2 : window.innerWidth / 2;
        const cy = card ? card.top + card.height / 2 : window.innerHeight / 2;
        irisX.set(cx); irisY.set(cy); irisR.set(0);
        animate(irisR, irisRadius(cx, cy, window.innerWidth, window.innerHeight), {
            duration: OPEN_MS / 1000, ease: [0.5, 0, 0.15, 1],
        });

        setPhase("open");
        showPage();
        // The hand deals as the ground opens, so it is already moving when
        // the iris reaches it rather than starting after a held breath.
        later(announce, ANNOUNCE_MS);
        // The ace has landed: the real glyph takes over, invisibly.
        later(showLogo, LOGO_SWAP_MS);
        later(() => setPhase(null), OPEN_MS + 60);
    }, [announce, irisR, irisX, irisY]);

    // The beats, off one clock from mount.
    useEffect(() => {
        if (phase !== "arrive") return undefined;
        const t0 = performance.now();
        later(() => setPhase("split"), BEATS.ARRIVE);
        later(() => setPhase("riffle"), BEATS.SPLIT);
        later(() => setPhase("fan"), BEATS.RIFFLE);
        later(() => setPhase("turn"), BEATS.FAN);
        later(() => {
            setPhase("hold");
            const wait = () => {
                const step = holdStep({
                    phase: phaseRef.current, ready: pageReady(), elapsed: performance.now() - t0,
                });
                if (step === "open") open();
                else if (step === "wait") later(wait, 80);
            };
            wait();
        }, BEATS.TURN);
        return undefined;
    }, [phase, open]);

    const skip = useCallback(() => {
        const p = phaseRef.current;
        if (!p || p === "open" || p === "skip") return;
        timers.current.forEach(clearTimeout);
        timers.current = [];
        setPhase("skip");
        showPage();
        announce();
        later(() => setPhase(null), SKIP_MS + 40);
    }, [announce]);

    useEffect(() => {
        if (!playing) return undefined;
        const opts = { passive: true };
        window.addEventListener("wheel", skip, opts);
        window.addEventListener("touchstart", skip, opts);
        window.addEventListener("keydown", skip);
        return () => {
            window.removeEventListener("wheel", skip);
            window.removeEventListener("touchstart", skip);
            window.removeEventListener("keydown", skip);
        };
    }, [playing, skip]);

    if (!playing || typeof document === "undefined") return null;

    const opening = phase === "open";
    const leaving = opening || phase === "skip";
    const turned = phase === "turn" || phase === "hold" || opening || phase === "skip";

    return createPortal(
        <motion.div
            aria-hidden="true"
            data-opening={phase}
            onClick={skip}
            className="fixed inset-0 z-[100] overflow-hidden cursor-pointer"
            style={{ pointerEvents: leaving ? "none" : "auto" }}
            initial={false}
            animate={{ opacity: phase === "skip" ? 0 : 1 }}
            transition={{ duration: SKIP_MS / 1000, ease: "easeOut" }}
        >
            {/* The ground. Solid until it opens, then the iris. */}
            <motion.div className="absolute inset-0"
                style={{ background: opening ? iris : NAVY }} />

            {/* The deck. The box is one card, a little above the middle; every
                card is positioned in percentages of it. */}
            <div ref={deckRef} className="acedit-open-deck theme-locked-light" style={{ perspective: 1100 }}>
                {/* Ace, beside the deck. Light ink: on this navy his own
                    near-black would vanish, and this is exactly how he is
                    drawn in the app's dark theme — light body, eyes knocked
                    out of it. */}
                <motion.div
                    className="absolute bottom-0 w-14 sm:w-24 z-20"
                    style={{ right: "calc(100% + var(--open-card-w) * 0.75)" }}
                    initial={{ opacity: 0, x: -24 }}
                    animate={{ opacity: leaving ? 0 : 1, x: 0 }}
                    transition={leaving ? { duration: 0.2 } : { type: "spring", stiffness: 240, damping: 22 }}
                >
                    <AceBody className="w-full" pose={POSE[phase] || "stand"} idle={false}
                        tone="fill-[#FAFAFA]" card="fill-[#0D1626]" cardStroke="stroke-[#0D1626]" />
                </motion.div>

                {Array.from({ length: DECK }, (_, i) => {
                    const r = RIFFLE[i];
                    const isAce = r.order === ACE_INDEX;
                    const { animate: to, transition } = cardTarget(phase, i);
                    // The new places hold from the riffle on; before it, the old.
                    const z = phase === "arrive" || phase === "split" ? i : r.order;
                    if (isAce) {
                        return (
                            <motion.div key={i} className="absolute inset-0"
                                style={{ zIndex: turned ? 30 : z, transformOrigin: "50% 50%" }}
                                initial={false}
                                // A flick of the wrist on the way, back to
                                // upright before it lands, or the glyph
                                // arrives tilted against the one in the logo.
                                animate={flight
                                    ? { x: flight.x, y: flight.y, scale: flight.scale, opacity: flight.out ? 0 : 1, rotate: [...FLICK] }
                                    : { x: 0, y: 0, scale: 1, opacity: 1, rotate: 0 }}
                                transition={{ duration: FLIGHT_MS / 1000, ease: [0.65, 0, 0.35, 1] }}
                            >
                                <motion.div ref={aceRef} className="absolute inset-0"
                                    // The fan pivots far below the card; the lift
                                    // and the flight pivot on its centre. The ace
                                    // is upright in the fan, so switching costs
                                    // nothing at the moment it happens.
                                    style={{ transformOrigin: turned ? "50% 50%" : "50% 160%" }}
                                    initial={{ opacity: 0, x: `${STACK[i].x}%`, y: "40%", rotate: STACK[i].rotate }}
                                    animate={to} transition={transition}
                                >
                                    <AceCard turned={turned} holding={phase === "hold"} opening={opening} />
                                </motion.div>
                            </motion.div>
                        );
                    }
                    return (
                        <motion.div key={i} className="absolute inset-0"
                            style={{ zIndex: z, transformOrigin: "50% 160%" }}
                            initial={{ opacity: 0, x: `${STACK[i].x}%`, y: "40%", rotate: STACK[i].rotate }}
                            animate={to} transition={transition}
                        >
                            <HouseBack />
                        </motion.div>
                    );
                })}
            </div>

            {/* The line, in the place the boot layer already drew it. */}
            <motion.div className="absolute inset-0 pointer-events-none"
                initial={false}
                animate={{ opacity: leaving ? 0 : 1 }}
                transition={{ duration: 0.22 }}>
                <p className="acedit-open-line" style={{ animationDelay: lineDelay }}>
                    The new age of studying
                </p>
            </motion.div>
        </motion.div>,
        document.body,
    );
}

/**
 * The ace: a back that turns over to the ace of spades, a glow that says it
 * was chosen, and — over the printed pip — the same pip on its own, so that
 * when the card stock fades on the way to the logo the mark is what is left.
 */
function AceCard({ turned, holding, opening }) {
    return (
        <>
            {/* The glow. Green, because a black shadow under a card is no
                shadow on this navy. It breathes while the page is not ready
                yet, which is the only thing that says "waiting". */}
            <motion.div className="absolute -inset-[35%] -z-10 rounded-full pointer-events-none"
                style={{ background: "radial-gradient(closest-side, rgba(88,204,2,0.38), rgba(88,204,2,0))" }}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={opening
                    ? { opacity: 0, scale: 0.6 }
                    : turned
                        ? (holding ? { opacity: [0.9, 0.55, 0.9], scale: [1, 1.06, 1] } : { opacity: 0.9, scale: 1 })
                        : { opacity: 0, scale: 0.7 }}
                transition={holding && !opening
                    ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
                    : { duration: 0.35, ease: "easeOut", delay: turned && !opening ? 0.3 : 0 }}
            />
            <div className="absolute inset-0" style={{ perspective: 900 }}>
                <motion.div className="relative w-full h-full"
                    style={{ transformStyle: "preserve-3d" }}
                    initial={false}
                    animate={{ rotateY: turned ? 180 : 0 }}
                    transition={{ duration: 0.42, ease: "easeInOut", delay: turned ? 0.12 : 0 }}
                >
                    <div className="absolute inset-0" style={{ backfaceVisibility: "hidden" }}>
                        <HouseBack />
                    </div>
                    <div className="absolute inset-0"
                        style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                        {/* The stock stays opaque for most of the flight and
                            goes once it is small. Faded from the start, it
                            went grey over the navy and then ghostly over the
                            page opening behind it. */}
                        <motion.div className="absolute inset-0"
                            initial={false}
                            animate={{ opacity: opening ? 0 : 1 }}
                            transition={opening
                                ? { duration: STOCK_FADE_MS / 1000, delay: STOCK_FADE_DELAY_MS / 1000, ease: "easeIn" }
                                : { duration: 0 }}>
                            <PlayingCard rank="A" suit="spade" tone="#58CC02" pips className="w-full h-full" />
                        </motion.div>
                        {/* The pip alone, drawn exactly over the printed one —
                            the same box PipFace uses, inside the same 1px
                            border — so fading the card under it changes
                            nothing about the mark until the stock is gone. */}
                        <div className="absolute inset-0 border border-transparent grid place-items-center pointer-events-none">
                            <SpadePip className="w-[34%] h-[34%]" tone="fill-foreground" />
                        </div>
                    </div>
                </motion.div>
            </div>
        </>
    );
}
