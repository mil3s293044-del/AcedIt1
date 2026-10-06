/**
 * PrankWatcher — how a prank actually arrives.
 *
 * ─── IT USED TO NEED A REFRESH, AND THAT WAS A DECISION ─────────────────────
 * Layout fetched `getPranks` once, keyed on the account, and Layout does not
 * unmount between navigations — so the effect ran once per PAGE LOAD. A prank
 * sent while somebody had the app open sat in the table until they reloaded the
 * tab. The comment beside it argued the case in its own words: "a prank is not
 * urgent, the receive cap means there are never more than a few, and a timer
 * asking the server every thirty seconds whether somebody has been pranked is a
 * query per student per interval for a joke."
 *
 * Every clause of that is true and the conclusion is still wrong, because the
 * whole point of a prank is that it lands WHILE THEY ARE THERE. A joke that
 * arrives next Tuesday when they happen to reload is not a joke, and the sender
 * paid credits for it.
 *
 * ─── THREE TRIGGERS, AND THE SLOWEST ONE IS THE FLOOR ───────────────────────
 *   ON MOUNT      what was already waiting, which is the old behaviour.
 *   ON A PUSH     `subscribePranks` — a Supabase realtime INSERT filtered to
 *                 this student. Lands in about a second.
 *   ON THE TICK   `useLiveTick`, the poll LiveContext is ALREADY running for
 *                 Compete. This costs one more request per existing tick rather
 *                 than a timer of its own, which is the objection above
 *                 answered rather than ignored.
 *
 * The poll is not a belt-and-braces nicety. A table that is not in the
 * `supabase_realtime` publication is SILENT — the channel subscribes, reports
 * SUBSCRIBED, and never fires, and there is no status that says so — so until
 * migration 0040 is applied the push does nothing at all. The tick is what
 * makes shipping this an improvement rather than a dependency on a migration
 * somebody still has to run.
 *
 * ─── THE PUSH IS A DOORBELL. THE SERVER IS STILL THE DELIVERY ───────────────
 * Nothing is read off the broadcast row. `getPranks` is what resolves the
 * sender's NAME, drops a row it cannot attribute rather than delivering one
 * anonymously, and stamps `seen_at`. Drawing the pushed row would produce the
 * one thing migration 0038 says this may never be — an anonymous prank — and
 * nothing would ever mark it seen, so it would replay on every load forever.
 *
 * ─── IT PLAYS IMMEDIATELY, INCLUDING OVER A QUIZ ────────────────────────────
 * A deliberate call rather than an oversight. `liveRefresh`'s hold list exists
 * for a REFETCH, which can change the numbers under somebody mid-answer; a
 * prank changes no layout, takes no tap (`pointer-events-none` throughout) and
 * touches nothing a student is measured on, so there is nothing for it to cost.
 * Interrupting is the joke. If that ever stops being true, `holdReasons` is the
 * thing to reach for and `useBusy` already declares every surface.
 *
 * ─── ONE FETCH AT A TIME, AND IDS ARE DEDUPED ───────────────────────────────
 * `getPranks` SELECTs unseen rows and then UPDATEs them seen, which is two
 * calls — so a push and a tick landing together could both read the same row
 * before either marks it. The in-flight ref makes that nearly impossible and
 * the id check makes it harmless, which is the right pair: one of them is a
 * race and the other is a fact.
 */
import { useCallback, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { takeFn } from "@/lib/fnResult";
import { useLiveTick } from "@/lib/LiveContext";
import { subscribePranks } from "@/api/realtime";

export default function PrankWatcher({ email, onArrive }) {
    const tick = useLiveTick();
    const busy = useRef(false);
    // The callback in a ref, so the fetch identity does not change with it.
    // Layout re-renders constantly and an effect keyed on a fresh `onArrive`
    // would tear the realtime channel down and rebuild it on every one.
    const arrive = useRef(onArrive);
    useEffect(() => { arrive.current = onArrive; }, [onArrive]);

    const pull = useCallback(async () => {
        if (busy.current) return;
        busy.current = true;
        try {
            const res = await base44.functions.invoke("getPranks", {});
            const rows = takeFn(res)?.pranks;
            if (Array.isArray(rows) && rows.length) arrive.current?.(rows);
        } catch {
            /* A prank that does not arrive is not an error worth showing. */
        } finally {
            busy.current = false;
        }
    }, []);

    // On mount, and on every live tick. `pull` is stable, so this is keyed on
    // the ACCOUNT and the tick alone.
    useEffect(() => {
        if (!email) return;
        pull();
    }, [email, tick, pull]);

    // And the push, which is what makes it feel immediate.
    useEffect(() => {
        if (!email) return undefined;
        let stop = null;
        let alive = true;
        (async () => {
            const off = await subscribePranks({ email, onChange: pull });
            if (alive) stop = off; else off?.();
        })();
        return () => { alive = false; stop?.(); };
    }, [email, pull]);

    return null;
}
