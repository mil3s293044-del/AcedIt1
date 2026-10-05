/**
 * realtime — the push path, which is a FASTER TRIGGER and never a data source.
 *
 * ─── What it does, and pointedly does not do ────────────────────────────────
 * When a battle or a call-out changes, this fires a callback. That is all. The
 * changed row is deliberately ignored: the app then refetches through the same
 * reads it already uses, so there is no version of this where the pushed copy
 * and the fetched copy disagree about a student's score. Two sources of truth
 * for one number is how a leaderboard starts contradicting itself.
 *
 * It also means the payload never has to be trusted. Realtime broadcasts what
 * RLS lets the client see, and RLS on these tables was written for reads by
 * the owner — using the row directly would be a second, subtler place where
 * "what the client was told" could stand in for "what the server knows".
 *
 * ─── It is allowed to be absent ─────────────────────────────────────────────
 * Postgres only publishes tables that are in the `supabase_realtime`
 * publication (migration 0035). Until that has been applied the subscription
 * connects and simply never fires, which is exactly the right failure: the
 * poll in LiveContext carries the whole job, nothing errors, and nothing on
 * screen claims to be live when it is not.
 *
 * `onReady(false)` is reported for a channel error or a timeout, so the UI can
 * say "polling" rather than "live" — a badge claiming a push connection it
 * does not have is worse than no badge.
 */
import { supabase } from "@/api/supabaseClient";
import { shouldUseSupabase } from "@/api/runtimeConfig";

/** The tables whose changes move a standing. */
const TABLES = ["goal_competitions", "study_duels", "callouts"];

/**
 * Changes arrive in bursts — one student syncing writes a participants array
 * that fires for every row in it. Coalesce, or a battle sync becomes six
 * refetches inside a second.
 */
const BURST_MS = 1200;

export async function subscribeCompete({ onChange, onReady } = {}) {
    // Base44 has no realtime, and neither does a build with no Supabase keys.
    // Report not-ready rather than throwing: the caller's fallback IS polling,
    // and it is already running.
    if (!shouldUseSupabase?.() || !supabase?.channel) {
        onReady?.(false);
        return () => {};
    }

    let timer = null;
    const fire = () => {
        clearTimeout(timer);
        timer = setTimeout(() => { try { onChange?.(); } catch { /* caller's problem */ } }, BURST_MS);
    };

    let channel;
    try {
        channel = supabase.channel("compete-live");
        TABLES.forEach((table) => {
            channel.on("postgres_changes", { event: "*", schema: "public", table }, fire);
        });

        channel.subscribe((status) => {
            // SUBSCRIBED only says the socket is up. It does NOT say the tables
            // are in the publication — an unpublished table is silent, and
            // there is no status for that. So this is "the transport works",
            // and the poll stays running underneath regardless.
            if (status === "SUBSCRIBED") onReady?.(true);
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
                onReady?.(false);
            }
        });
    } catch {
        onReady?.(false);
        return () => {};
    }

    return () => {
        clearTimeout(timer);
        try { supabase.removeChannel(channel); } catch { /* already torn down */ }
    };
}

/**
 * A prank landing on THIS student, pushed.
 *
 * ─── IT IS A DOORBELL, NOT A DELIVERY ───────────────────────────────────────
 * Same rule as above and it matters more here: the callback is told only that
 * something arrived, and the caller then goes through `getPranks` like always.
 * That endpoint is what resolves the sender's NAME, drops a row it cannot
 * attribute rather than delivering it anonymously, and stamps `seen_at`. A
 * client that drew the broadcast row would have an anonymous prank — the one
 * thing migration 0038 says this feature may never have — and no way to mark
 * it seen, so it would replay on every load.
 *
 * ─── FILTERED TO THEM, not just secured to them ─────────────────────────────
 * RLS on `pranks` already limits what a student may read, so the filter is not
 * what makes this safe. It is what stops every open tab in the school waking up
 * for a prank sent to somebody else — the socket delivers to the channel, and
 * `target_email=eq.` is how that work is never done.
 *
 * INSERT only. A prank's other write is `seen_at`, which this client just
 * caused by fetching, so listening for it would be the app ringing its own
 * doorbell.
 */
export async function subscribePranks({ email, onChange, onReady } = {}) {
    if (!email || !shouldUseSupabase?.() || !supabase?.channel) {
        onReady?.(false);
        return () => {};
    }

    // Shorter than the compete burst: a prank is a single row and the whole
    // point is that it lands while they are there. This only coalesces the
    // case of two friends sending in the same breath, so one fetch collects
    // both — which is what the queue wants anyway.
    const QUIET_MS = 350;
    let timer = null;
    const fire = () => {
        clearTimeout(timer);
        timer = setTimeout(() => { try { onChange?.(); } catch { /* caller's problem */ } }, QUIET_MS);
    };

    let channel;
    try {
        channel = supabase.channel(`pranks-${email}`);
        channel.on("postgres_changes", {
            event: "INSERT", schema: "public", table: "pranks",
            filter: `target_email=eq.${email}`,
        }, fire);
        channel.subscribe((status) => {
            // SUBSCRIBED says the socket is up and NOT that `pranks` is in the
            // publication — an unpublished table is silent and there is no
            // status for it. So the poll stays running underneath regardless,
            // which is what makes migration 0040 an improvement rather than a
            // dependency.
            if (status === "SUBSCRIBED") onReady?.(true);
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
                onReady?.(false);
            }
        });
    } catch {
        onReady?.(false);
        return () => {};
    }

    return () => {
        clearTimeout(timer);
        try { supabase.removeChannel(channel); } catch { /* already torn down */ }
    };
}
