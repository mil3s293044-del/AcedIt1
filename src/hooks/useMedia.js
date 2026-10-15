import { useEffect, useState } from "react";

/**
 * Whether a media query matches, kept live.
 *
 * For when a breakpoint decides what is MOUNTED rather than how it looks — the
 * planner's drag board and its phone agenda are two different interaction
 * models over one week, and rendering both and hiding one would leave two
 * sets of controls for every session in the DOM. Read on first render, so the
 * page does not paint the wrong one and swap.
 */
export function useMedia(query) {
    const get = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false);
    const [on, setOn] = useState(get);
    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return undefined;
        const mq = window.matchMedia(query);
        const onChange = () => setOn(mq.matches);
        onChange();
        mq.addEventListener?.("change", onChange);
        return () => mq.removeEventListener?.("change", onChange);
    }, [query]);
    return on;
}
