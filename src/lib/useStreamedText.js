import { useEffect, useRef, useState } from "react";

// useStreamedText — smooth a chunky token stream into a steady typewriter feel.
//
// Anthropic delivers tokens in bursty chunks (e.g. 80 chars, pause 200ms, 60
// chars). Pushing each chunk straight to the DOM looks janky. This hook keeps
// the FULL incoming `target` string as the destination and reveals characters
// at a fixed rate, so the visible text grows smoothly like ChatGPT.
//
//   const visible = useStreamedText(target, isStreaming);
//   <MarkdownMath isStreaming={isStreaming}>{visible}</MarkdownMath>
//
// • While `isStreaming` is true, visible catches up at `charsPerTick`/16ms.
// • When `isStreaming` flips false, the rest of `target` is revealed instantly
//   (no awkward delay after the network is done).
// • If `target` shrinks (e.g. the caller resets between generations), visible
//   resets too.
export default function useStreamedText(target, isStreaming, { charsPerTick = 4 } = {}) {
  const [visible, setVisible] = useState("");
  const rafRef = useRef(null);
  const lastTickRef = useRef(0);
  const visibleLenRef = useRef(0);

  useEffect(() => {
    // Reset when the target shrinks (new generation kicks off).
    if (!target || target.length < visibleLenRef.current) {
      visibleLenRef.current = 0;
      setVisible(target ?? "");
      return;
    }

    // Streaming finished — flush the rest immediately.
    if (!isStreaming) {
      visibleLenRef.current = target.length;
      setVisible(target);
      return;
    }

    // Animate at ~60fps, advancing `charsPerTick` chars each frame.
    const tick = (now) => {
      if (!lastTickRef.current) lastTickRef.current = now;
      const elapsed = now - lastTickRef.current;
      const frames = Math.max(1, Math.floor(elapsed / 16));
      const next = Math.min(target.length, visibleLenRef.current + frames * charsPerTick);
      if (next !== visibleLenRef.current) {
        visibleLenRef.current = next;
        setVisible(target.slice(0, next));
        lastTickRef.current = now;
      }
      if (visibleLenRef.current < target.length && isStreaming) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTickRef.current = 0;
    };
  }, [target, isStreaming, charsPerTick]);

  return visible;
}
