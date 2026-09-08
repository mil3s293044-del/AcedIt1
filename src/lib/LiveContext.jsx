/**
 * LiveContext — one clock for the whole app's freshness.
 *
 * Mounted once in Layout, above everything. It owns four things and nothing
 * else owns any of them:
 *
 *   1. WHEN a refresh is allowed (delegated to `decideRefresh`, which is pure
 *      and tested — the rules are not buried in an effect).
 *   2. The busy registry, so any surface can say "not right now" and be sure
 *      the refresh comes back rather than being lost.
 *   3. The tick components subscribe to. `useLiveTick()` returns a number that
 *      goes up when it is safe to refetch; a component depends on it in its
 *      effect and nothing else changes.
 *   4. Whether anything is live, which the nav dot and the poll rate read.
 *
 * ─── The tick is a NUMBER, not the data ─────────────────────────────────────
 * This provider does not fetch anything. It says "now is a good moment", and
 * each page refetches what it already knows how to fetch. That is what keeps
 * it from becoming a second data layer arguing with `readCache` — and it means
 * adding a page to the live system is one `useLiveTick()` in a dependency
 * array rather than a new query.
 *
 * ─── Realtime is a FASTER TRIGGER, never a second source of truth ───────────
 * When the realtime path is available it does exactly one thing: bump the
 * tick sooner than the poll would have. The data still arrives through the
 * same reads, so there is no version of this where the push path and the poll
 * path disagree about what a student's score is. If migration 0035 has not
 * been applied, the subscription never fires and the poll carries the whole
 * job — which is why this can ship before the migration does.
 */
import React, {
    createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import { useLocation } from "react-router-dom";
import {
    decideRefresh, globalBusy, anythingLive, focusedFieldHasContent,
    LIVE_POLL_MS, BUSY,
} from "@/lib/liveRefresh";
import { readCache } from "@/api/supabaseClient";
import { subscribeCompete } from "@/api/realtime";

const LiveCtx = createContext(null);

export { BUSY };

export function LiveProvider({ children }) {
    const location = useLocation();
    const [tick, setTick] = useState(0);
    const [liveState, setLiveState] = useState({ live: false, battles: 0, callouts: 0 });
    const [realtimeReady, setRealtimeReady] = useState(false);

    // The app-wide singleton, not a registry of its own: an AI stream claims
    // busy from inside aiClient, which is not a component and cannot render
    // one. Two registries would let the provider free-run while that half
    // still had work in flight.
    const registry = globalBusy;
    const busyRef = useRef([]);
    const lastRefreshAt = useRef(0);
    const lastInputAt = useRef(0);
    // A refresh asked for while somebody was busy. This ref IS the "defer,
    // never skip" rule — dropping it is the bug the whole file exists to
    // avoid.
    const pending = useRef(null);
    const liveRef = useRef(false);

    // ── The gate ────────────────────────────────────────────────────────────
    const attempt = useCallback((opts = {}) => {
        const d = decideRefresh({
            now: Date.now(),
            lastRefreshAt: lastRefreshAt.current,
            lastInputAt: lastInputAt.current,
            busy: busyRef.current,
            focusedHasContent: focusedFieldHasContent(
                typeof document !== "undefined" ? document.activeElement : null),
            hidden: typeof document !== "undefined" && document.hidden,
            live: liveRef.current,
            ...opts,
        });

        if (d.action === "refresh") {
            pending.current = null;
            lastRefreshAt.current = Date.now();
            // Drop the read cache so the refetch is a real one. Without this
            // every page would re-ask and be handed the same 8s-old promise,
            // and the whole system would be an animation with no new data
            // behind it.
            readCache.clear();
            setTick((n) => n + 1);
            return d;
        }
        if (d.action === "defer") {
            // Keep the STRONGEST intent: a forced request that lands during a
            // quiz must still be forced when the quiz ends.
            pending.current = {
                force: (pending.current?.force || opts.force) ?? false,
                requested: true,
            };
        }
        return d;
    }, []);

    // ── Busy ────────────────────────────────────────────────────────────────
    useEffect(() => registry.onChange(() => {
        busyRef.current = registry.reasons();
        // Freed up? Run whatever was waiting, immediately — this is the moment
        // the deferral pays off.
        if (!busyRef.current.length && pending.current) {
            attempt({ ...pending.current });
        }
    }), [registry, attempt]);

    // ── Typing, measured rather than declared ───────────────────────────────
    // One document-level listener instead of every form in the app having to
    // remember to announce itself — a list that would be wrong within a month.
    useEffect(() => {
        const onInput = () => {
            lastInputAt.current = Date.now();
        };
        document.addEventListener("input", onInput, true);
        return () => document.removeEventListener("input", onInput, true);
    }, []);

    // ── Coming back to the tab is the moment freshness matters ──────────────
    useEffect(() => {
        const onWake = () => { if (!document.hidden) attempt({ force: true }); };
        document.addEventListener("visibilitychange", onWake);
        window.addEventListener("focus", onWake);
        return () => {
            document.removeEventListener("visibilitychange", onWake);
            window.removeEventListener("focus", onWake);
        };
    }, [attempt]);

    // ── An XP award moves standings; so does any battle write ───────────────
    useEffect(() => {
        const bump = () => attempt({ requested: true });
        window.addEventListener("xp_awarded", bump);
        window.addEventListener("compete_changed", bump);
        return () => {
            window.removeEventListener("xp_awarded", bump);
            window.removeEventListener("compete_changed", bump);
        };
    }, [attempt]);

    // ── Changing page ───────────────────────────────────────────────────────
    useEffect(() => { attempt({ requested: true }); }, [location.pathname, attempt]);

    // ── The poll ────────────────────────────────────────────────────────────
    // One timer for the app. It fires often and mostly decides to do nothing;
    // `decideRefresh` is where the rate actually lives, so a live contest and
    // a quiet account are one code path with different answers.
    useEffect(() => {
        const iv = setInterval(() => attempt({}), Math.min(LIVE_POLL_MS, 15000));
        return () => clearInterval(iv);
    }, [attempt]);

    // ── Realtime, when it is there ──────────────────────────────────────────
    useEffect(() => {
        let stop = null;
        subscribeCompete({
            onChange: () => attempt({ requested: true }),
            onReady: (ok) => setRealtimeReady(!!ok),
        }).then((fn) => { stop = fn; }).catch(() => setRealtimeReady(false));
        return () => { try { stop?.(); } catch { /* already gone */ } };
    }, [attempt]);

    const setLive = useCallback((input) => {
        const next = anythingLive(input);
        liveRef.current = next.live;
        setLiveState((prev) => (
            prev.live === next.live && prev.battles === next.battles && prev.callouts === next.callouts
                ? prev : next));
    }, []);

    const value = useMemo(() => ({
        tick,
        live: liveState,
        realtimeReady,
        registry,
        setLive,
        refreshNow: () => attempt({ force: true }),
    }), [tick, liveState, realtimeReady, registry, setLive, attempt]);

    return <LiveCtx.Provider value={value}>{children}</LiveCtx.Provider>;
}

/**
 * A number that goes up when it is a good moment to refetch.
 *
 * Outside the provider it is a constant 0, so a component using it renders
 * fine in isolation (and in a test harness) rather than throwing.
 */
export function useLiveTick() {
    return useContext(LiveCtx)?.tick ?? 0;
}

export function useLive() {
    return useContext(LiveCtx) ?? {
        tick: 0, live: { live: false, battles: 0, callouts: 0 },
        realtimeReady: false, registry: null, setLive: () => {}, refreshNow: () => {},
    };
}

/**
 * Hold the app still while `active` is true.
 *
 *     useBusy(isPlaying, BUSY.QUIZ);
 *
 * Releases on unmount as well as when `active` goes false, because the common
 * way out of a quiz is navigating away from it — and a claim that outlives its
 * component would freeze the app permanently.
 */
export function useBusy(active, reason) {
    const ctx = useContext(LiveCtx);
    const registry = ctx?.registry;
    useEffect(() => {
        if (!active || !registry) return undefined;
        const token = registry.acquire(reason);
        return () => registry.release(token);
    }, [active, reason, registry]);
}

/** Announce that something competitive changed, from anywhere. */
export function announceCompeteChange() {
    try { window.dispatchEvent(new CustomEvent("compete_changed")); } catch { /* SSR */ }
}
