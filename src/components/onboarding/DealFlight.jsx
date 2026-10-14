/**
 * DealFlight — the card you picked leaves your hand and lands on the table.
 *
 * Every answer in the wizard deals a card, and before this the card simply
 * APPEARED in the hand at the bottom of the screen while the button you had
 * pressed stayed exactly where it was. The two were never visibly the same
 * object, so the hand read as a progress bar wearing a costume. A flight is
 * what makes it a deal: the thing you touched travels to where it now lives.
 *
 * HOW IT LANDS EXACTLY. The destination card is rendered at its final place
 * straight away, invisible, and the flight is a fixed-position copy animated
 * from the button's rect onto that card's rect. When it lands the copy goes
 * and the real card is switched on, so there is never a frame with two of it
 * and never a jump at the end. `fly` must be called BEFORE the answer is
 * written, in the same handler: both updates batch, so the destination card's
 * very first render already knows it is airborne and skips its own entrance —
 * otherwise the rect measured would be the middle of an entrance animation.
 *
 * WHERE IT LANDS is whichever `[data-deal-slot]` for that card is actually on
 * screen: the table on a desktop, the rail on a phone. Nothing here knows
 * which layout is showing, and nothing needs to.
 *
 * THE COPY IS PORTALLED TO THE BODY. `position: fixed` resolves against a
 * transformed ancestor, and every animated section here carries a transform —
 * the lesson MarkModule and AceRoam each record.
 *
 * A card is never left invisible: a flight that cannot find its slot, or one
 * that never reports landing, grounds the card anyway.
 */
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import FanCard from "@/components/onboarding/FanCard";

const FlightContext = createContext({ fly: () => {}, isAirborne: () => false });
export const useFlight = () => useContext(FlightContext);

/** The copy of a slot that is actually laid out, if there is one. */
function visibleSlot(key) {
    const els = document.querySelectorAll(`[data-deal-slot="${CSS.escape(key)}"]`);
    for (const el of els) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && el.offsetParent !== null) return el;
    }
    return null;
}

const FLIGHT_S = 0.64;

export function FlightProvider({ children }) {
    const reduce = useReducedMotion();
    const [flights, setFlights] = useState([]);
    const [airborne, setAirborne] = useState(() => new Set());
    const seq = useRef(0);

    const ground = useCallback((key) => {
        setAirborne((s) => {
            if (!s.has(key)) return s;
            const next = new Set(s);
            next.delete(key);
            return next;
        });
    }, []);

    const fly = useCallback((fromEl, card) => {
        if (reduce || !fromEl || !card || typeof window === "undefined") return;
        const from = fromEl.getBoundingClientRect();
        if (!from.width) return;
        setAirborne((s) => new Set(s).add(card.key));
        // One frame for React to commit the new card, one for layout.
        requestAnimationFrame(() => requestAnimationFrame(() => {
            const slot = visibleSlot(card.key);
            if (!slot) { ground(card.key); return; }
            const r = slot.getBoundingClientRect();
            const id = ++seq.current;
            setFlights((f) => [...f, {
                id,
                card,
                from,
                to: {
                    cx: r.left + r.width / 2,
                    cy: r.top + r.height / 2,
                    // offsetWidth is the card's own size; the rect of a rotated
                    // card is the box AROUND it, which is larger.
                    w: slot.offsetWidth,
                    h: slot.offsetHeight,
                    rot: Number(slot.dataset.rot || 0),
                    label: slot.dataset.labelSize || "9px",
                },
            }]);
        }));
        window.setTimeout(() => ground(card.key), FLIGHT_S * 1000 + 900);
    }, [reduce, ground]);

    const land = useCallback((id, key) => {
        setFlights((f) => f.filter((x) => x.id !== id));
        ground(key);
    }, [ground]);

    const isAirborne = useCallback((key) => airborne.has(key), [airborne]);
    const value = useMemo(() => ({ fly, isAirborne }), [fly, isAirborne]);

    return (
        <FlightContext.Provider value={value}>
            {children}
            {typeof document !== "undefined" && createPortal(
                flights.map((f) => (
                    <Flying key={f.id} flight={f} onLand={() => land(f.id, f.card.key)} />
                )),
                document.body,
            )}
        </FlightContext.Provider>
    );
}

/**
 * The copy in the air. It ARCS — up out of the hand and down onto the table —
 * because a straight line between two rects reads as a slide, and a slide is
 * a layout change rather than somebody throwing a card.
 */
function Flying({ flight, onLand }) {
    const { from, to, card } = flight;
    const dx = from.left + from.width / 2 - to.cx;
    const dy = from.top + from.height / 2 - to.cy;
    const s0 = Math.max(0.3, Math.min(1.3, Math.min(from.width / to.w, from.height / to.h)));
    const apex = Math.min(dy, 0) - 90;
    return (
        <motion.div
            aria-hidden="true"
            className="theme-locked-light fixed z-[70] pointer-events-none"
            style={{ left: to.cx - to.w / 2, top: to.cy - to.h / 2, width: to.w, height: to.h }}
            initial={{ x: dx, y: dy, scale: s0, rotate: -10 }}
            animate={{
                x: [dx, dx * 0.4, 0],
                y: [dy, apex, 0],
                scale: [s0, 1.16, 1],
                rotate: [-10, 10, to.rot],
            }}
            transition={{ duration: FLIGHT_S, times: [0, 0.48, 1], ease: [0.3, 0.7, 0.2, 1] }}
            onAnimationComplete={onLand}
        >
            <div className="w-full h-full" style={{ filter: "drop-shadow(0 22px 26px rgba(13,22,38,0.38))" }}>
                <FanCard card={card} strip={to.w} width={to.w} labelSize={to.label} />
            </div>
        </motion.div>
    );
}
