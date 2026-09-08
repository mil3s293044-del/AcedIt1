/**
 * useStakes — one shared, cached feed of my live stakes (active duels +
 * back-yourself bets) for every surface: the global strip, the Study coach,
 * and session-complete moments.
 *
 * Module-level cache so N consumers = 1 fetch. Refreshes shortly after any
 * xp_awarded event (so standings move the moment you study) and on a slow
 * poll while stakes are live. Emits window events:
 *   - 'duel_lead_change'  {duel, nowLeading, rivalName, gap}
 *   - 'arena_away_report' {items: [{duel, rivalName, gained}]}
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

const CACHE_MS = 45000;
const SNAPSHOT_KEY = "arena_rival_snapshot";

let _cache = null;
let _fetchedAt = 0;
let _inflight = null;
let _awayChecked = false;
const _subs = new Set();

function myScore(duel, me) {
    return duel.live_scores?.[me] || 0;
}
function rivalOf(duel, me) {
    const isChallenger = duel.challenger_email === me;
    return {
        email: isChallenger ? duel.opponent_email : duel.challenger_email,
        name: isChallenger ? duel.opponent_name : duel.challenger_name,
    };
}

function detectLeadChanges(prev, next) {
    if (!prev?.me || !next?.me) return;
    const me = next.me;
    (next.duels || []).filter(d => d.status === "active").forEach(d => {
        const before = (prev.duels || []).find(p => p.id === d.id && p.status === "active");
        if (!before?.live_scores || !d.live_scores) return;
        const rival = rivalOf(d, me);
        const wasLeading = myScore(before, me) > (before.live_scores[rival.email] || 0);
        const isLeading = myScore(d, me) > (d.live_scores[rival.email] || 0);
        if (wasLeading !== isLeading) {
            window.dispatchEvent(new CustomEvent("duel_lead_change", {
                detail: {
                    duel: d,
                    nowLeading: isLeading,
                    rivalName: rival.name,
                    gap: Math.abs(myScore(d, me) - (d.live_scores[rival.email] || 0)),
                },
            }));
        }
    });
}

/**
 * Somebody is CLOSING ON YOU — the alert that fires before the overtake.
 *
 * `detectLeadChanges` above only speaks once the lead has already changed
 * hands, which is the moment it is too late to do anything about. This is the
 * one that arrives while there is still something to defend.
 *
 * Three conditions, and all three matter:
 *
 *   - the gap NARROWED. A rival who was already close and has done nothing is
 *     not news, and firing on that means the alert goes off on every poll for
 *     the whole contest until nobody reads it.
 *   - it is now inside CLOSING_WITHIN. A gap going 800 → 600 is a big move and
 *     still not a threat.
 *   - you are still AHEAD. Once they have passed you it is a lead change, and
 *     that is the other function's line to deliver.
 */
export const CLOSING_WITHIN = 25;

function detectClosing(prev, next) {
    if (!prev?.me || !next?.me) return;
    const me = next.me;
    (next.duels || []).filter(d => d.status === "active" && d.live_scores).forEach(d => {
        const before = (prev.duels || []).find(p => p.id === d.id && p.live_scores);
        if (!before) return;
        const rival = rivalOf(d, me);
        if (!rival?.email) return;
        const gapNow = myScore(d, me) - (d.live_scores[rival.email] || 0);
        const gapWas = myScore(before, me) - (before.live_scores[rival.email] || 0);
        if (gapNow <= 0 || gapNow >= gapWas || gapNow > CLOSING_WITHIN) return;
        window.dispatchEvent(new CustomEvent("rival_closing", {
            detail: { duel: d, rivalName: rival.name, gap: Math.round(gapNow),
                closed: Math.round(gapWas - gapNow) },
        }));
    });
}

// "While you were away" — rival progress since the last session, from a
// localStorage snapshot. Fires once per app load.
function checkAwayReport(data) {
    if (_awayChecked || !data?.me) return;
    _awayChecked = true;
    let snapshot = {};
    try { snapshot = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || "{}"); } catch { /* fresh */ }
    const items = [];
    (data.duels || []).filter(d => d.status === "active" && d.live_scores).forEach(d => {
        const rival = rivalOf(d, data.me);
        const nowScore = d.live_scores[rival.email] || 0;
        const prevScore = snapshot[d.id];
        if (prevScore != null && nowScore - prevScore >= 10) {
            items.push({ duel: d, rivalName: rival.name, gained: nowScore - prevScore });
        }
    });
    if (items.length) {
        window.dispatchEvent(new CustomEvent("arena_away_report", { detail: { items } }));
    }
}

function writeSnapshot(data) {
    if (!data?.me) return;
    const snapshot = {};
    (data.duels || []).filter(d => d.status === "active" && d.live_scores).forEach(d => {
        const rival = rivalOf(d, data.me);
        snapshot[d.id] = d.live_scores[rival.email] || 0;
    });
    try { localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot)); } catch { /* full */ }
}

export async function fetchStakes(force = false) {
    if (!force && _cache && Date.now() - _fetchedAt < CACHE_MS) return _cache;
    if (_inflight) return _inflight;
    _inflight = base44.functions.invoke("getMyStakes", {})
        .then(res => {
            const data = res?.data ?? res;
            if (data?.setup_required) return _cache;
            checkAwayReport(data);
            detectLeadChanges(_cache, data);
            detectClosing(_cache, data);
            writeSnapshot(data);
            _cache = data;
            _fetchedAt = Date.now();
            _subs.forEach(fn => fn(data));
            return data;
        })
        .catch(e => { console.error("Stakes fetch error:", e); return _cache; })
        .finally(() => { _inflight = null; });
    return _inflight;
}

export function useStakes() {
    const [stakes, setStakes] = useState(_cache);

    useEffect(() => {
        const sub = (d) => setStakes(d);
        _subs.add(sub);
        fetchStakes().then(d => { if (d) setStakes(d); });

        // Any XP award can move a standing — refetch just after the server
        // has recorded it.
        let debounce = null;
        const onXP = () => {
            clearTimeout(debounce);
            debounce = setTimeout(() => fetchStakes(true), 1800);
        };
        window.addEventListener("xp_awarded", onXP);

        // Slow poll only while something is live (rivals study too).
        const iv = setInterval(() => {
            const live = (_cache?.duels || []).some(d => d.status === "active") || (_cache?.bets || []).length > 0;
            if (live) fetchStakes(true);
        }, 90000);

        return () => {
            _subs.delete(sub);
            window.removeEventListener("xp_awarded", onXP);
            clearTimeout(debounce);
            clearInterval(iv);
        };
    }, []);

    return { stakes, refresh: () => fetchStakes(true) };
}

/**
 * How much is racing right now, for the nav dot and the poll rate.
 *
 * Read off the stakes payload the app ALREADY loads on every page rather than
 * a query of its own — six nav items asking the server whether anything is
 * live would be six round trips before the shell painted, and the answer is
 * sitting in a module-level cache two lines up.
 */
export function useLiveCount() {
    const { stakes } = useStakes();
    const duels = (stakes?.duels || []).filter(d => d?.status === "active").length;
    const callouts = (stakes?.callouts || [])
        .filter(c => ["pending", "active"].includes(c?.status)).length;
    return { duels, callouts, total: duels + callouts, live: duels + callouts > 0 };
}
