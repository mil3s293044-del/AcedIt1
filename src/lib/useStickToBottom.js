import { useEffect, useRef, useState } from "react";

// useStickToBottom — auto-scroll a container to its bottom when content
// changes, BUT only if the user is already near the bottom. If they've
// scrolled up to read, leave them alone.
//
// Returns:
//   • containerRef — attach to the scrollable element (e.g. <div ref={ref}>)
//   • isAtBottom   — true if the user is currently near the bottom
//
// Why this exists: scrollIntoView({ behavior: 'smooth' }) on every streaming
// chunk stacks animations and walks up to the document scroll context, which
// scrolls the whole PAGE down past the viewport. This keeps the scroll
// inside the container and respects the user's intent.
export default function useStickToBottom(deps, { threshold = 80 } = {}) {
    const containerRef = useRef(null);
    const [isAtBottom, setIsAtBottom] = useState(true);

    // Track whether user has scrolled away from the bottom.
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const onScroll = () => {
            const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
            setIsAtBottom(distance <= threshold);
        };
        el.addEventListener("scroll", onScroll, { passive: true });
        return () => el.removeEventListener("scroll", onScroll);
    }, [threshold]);

    // When deps change (e.g. messages updated), scroll to bottom — but only
    // if the user was already there. Use instant scroll, not smooth, so
    // bursty stream chunks don't queue overlapping animations.
    useEffect(() => {
        const el = containerRef.current;
        if (!el || !isAtBottom) return;
        el.scrollTop = el.scrollHeight;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    return { containerRef, isAtBottom };
}
