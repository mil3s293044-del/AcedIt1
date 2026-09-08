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
