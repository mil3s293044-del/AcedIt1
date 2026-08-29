/**
 * AceTour — the signup tour, on screen.
 *
 * Ace walks in on each page, says what it is for, and Next takes you to the
 * following one. Six stops and a sign-off. All the copy and every rule about
 * who sees it live in `@/lib/aceTour`; this file navigates, speaks, and
 * remembers where you were.
 *
 * He is drawn with AceWalker and AceBubble — the same pair AceBuddy uses — so
 * he arrives the way he arrives everywhere else in the app and the tour is not
 * a bespoke panel with a mascot glued to it. The first version pointed him at
 * each page's `<h1>` via AceRoam, which put him hard against the top of the
 * viewport (headings are near the top, that is what headings are) where he
 * clipped under the nav. Standing in his own corner and talking is both more
 * robust and more like himself.
 *
 * ─── The shape, and why it is this shape ────────────────────────────────────
 * A card in the corner, never a backdrop with a spotlight. A modal tour gets
 * closed in two seconds and teaches the student that the correct response to
 * this app talking to them is to close it — after which none of the good
 * guidance already in here gets read either. aceFirstRun's header makes the
 * same argument at length and is the reason Ace speaks the way he does
 * everywhere else.
 *
 * So the app stays fully usable behind it, Skip is on every stop, and closing
 * it is a real answer that is never asked again.
 *
 * ─── Resuming ──────────────────────────────────────────────────────────────
 * The stop index is written to the profile as it advances, so a refresh, a
 * closed tab or a phone that went to sleep picks up where it left off rather
 * than starting over — the fastest way to make someone abandon a tour is to
 * make them redo the first half of it.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AceWalker, { AceBubble } from "@/components/ace/AceWalker";
import {
    STOPS, CONTENT_STOPS, stopAt, tourState, tourStatus, withTourPatch,
} from "@/lib/aceTour";

/**
 * Pages where he holds his tongue rather than talks over something.
 *
 * The payment flow is the one that matters: the signup wizard sends
 * premium-intent students straight to /Subscription the moment they land
 * (AuthContext's runPostSignup), so without this a brand-new premium signup
 * gets a tour of the app opening on top of a checkout page. The tour is only
 * paused here — it keeps its place and picks up wherever they go next.
 */
const QUIET_PAGES = new Set([
    "Onboarding", "Landing", "Login", "ForgotPassword", "ResetPassword", "Suspended",
    "Checkout", "PaymentSuccess", "PaymentCancel", "Paywall", "Premium", "Subscription",
]);

export default function AceTour({ page, userProfile, onLiveChange }) {
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [index, setIndex] = useState(0);
    const [live, setLive] = useState(false);
    const started = useRef(false);

    // Layout owns the profile fetch. This keeps its own copy because it writes
    // to `extra`, and re-seeds only when a genuinely different profile lands.
    useEffect(() => {
        if (userProfile?.id && userProfile.id !== profile?.id) setProfile(userProfile);
    }, [userProfile, profile?.id]);

    /** Patch `extra.ace_tour`, locally first so the UI never waits on the network. */
    const patch = useCallback(async (changes) => {
        if (!profile?.id) return;
        const extra = withTourPatch(profile, changes);
        setProfile((p) => (p ? { ...p, extra } : p));
        try { await base44.entities.UserProfile.update(profile.id, { extra }); }
        catch { /* the tour still runs; the next login re-reads whatever stuck */ }
    }, [profile]);

    // Open it, or pick it back up. Guarded by a ref rather than by state so a
    // re-render mid-write cannot start it twice.
    useEffect(() => {
        if (!profile || started.current) return;
        const status = tourStatus(profile);
        if (!status) return;
        started.current = true;
        const state = tourState(profile);
        setIndex(status === "resume" ? state.stop : 0);
        setLive(true);
        if (status === "start") {
            patch({ status: "active", stop: 0, started_at: new Date().toISOString() });
        }
    }, [profile, patch]);

    const showing = live && !QUIET_PAGES.has(page);
    useEffect(() => { onLiveChange?.(showing); }, [showing, onLiveChange]);

    const stop = live && !QUIET_PAGES.has(page) ? stopAt(index) : null;

    const finish = useCallback((status) => {
        setLive(false);
        patch({ status, finished_at: new Date().toISOString() });
    }, [patch]);

    const next = useCallback(() => {
        const to = index + 1;
        if (to >= STOPS.length) { finish("done"); return; }
        setIndex(to);
        patch({ stop: to });
        const target = stopAt(to);
        if (target) navigate(target.route);
    }, [index, finish, patch, navigate]);

    if (!stop) return null;

    return (
        <motion.aside
            data-ace-tour={stop.id}
            role="status" aria-label="A tour of AcedIt"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
            /* His lane: right side, above the launcher corner, clear of the
               bottom tab bar on a phone. Same geometry as AceBuddy, because
               they are the same character standing in the same place. */
            className="fixed z-40 right-3 sm:right-6 max-w-[calc(100vw-1.5rem)]
                bottom-[9.5rem] sm:bottom-[5.5rem] pointer-events-none"
        >
            {/* `trip` replays the walk-in, so he strides in again at every
                stop rather than teleporting between pages. */}
            <AceWalker trip={stop.id} pose={stop.final ? "happy" : "point"}
                size="w-20 sm:w-24" className="justify-end">
                <AceBubble className="pointer-events-auto w-[min(19rem,calc(100vw-8.5rem))]">
                    <AnimatePresence mode="wait">
                        <motion.div key={stop.id}
                            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}>
                            <div className="flex items-start gap-2.5">
                                <div className="min-w-0 flex-1">
                                    <p className="stat-label truncate">
                                        {stop.final ? "That is everything" : "A quick look around"}
                                    </p>
                                    <p className="font-display font-extrabold text-foreground leading-tight">
                                        {stop.final ? "You are set" : stop.title}
                                    </p>
                                </div>
                                <button onClick={() => finish("skipped")} aria-label="Close the tour"
                                    data-ace-tour-close
                                    className="text-muted-foreground hover:text-foreground p-1 -m-1
                                        rounded-lg flex-shrink-0">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {!stop.final && (
                                <div className="flex items-center gap-2.5 mt-2.5">
                                    <div className="flex items-center gap-1.5 flex-1">
                                        {STOPS.filter((s) => !s.final).map((s, i) => (
                                            <span key={s.id} aria-hidden="true"
                                                className={`h-1.5 flex-1 min-w-[10px] rounded-full
                                                    ${i <= index ? "bg-primary" : "bg-foreground/15"}`} />
                                        ))}
                                    </div>
                                    <span className="text-[10px] font-black text-muted-foreground tabular-nums
                                        uppercase tracking-wider whitespace-nowrap">
                                        {index + 1}/{CONTENT_STOPS}
                                    </span>
                                </div>
                            )}

                            <p className="text-sm text-foreground leading-snug mt-2.5">{stop.lead}</p>

                            <div className="flex items-center gap-3 mt-3.5">
                                {!stop.final && (
                                    <button onClick={() => finish("skipped")}
                                        className="text-xs font-bold text-muted-foreground
                                            hover:text-foreground transition-colors whitespace-nowrap">
                                        Skip the tour
                                    </button>
                                )}
                                <button onClick={stop.final ? () => finish("done") : next}
                                    data-ace-tour-next
                                    className="ml-auto inline-flex items-center gap-1 rounded-xl bg-primary
                                        text-primary-foreground px-3 py-1.5 text-xs font-bold
                                        hover:bg-primary/90 transition-colors whitespace-nowrap">
                                    {stop.final ? "Start studying" : <>Next <ArrowRight className="w-3 h-3" /></>}
                                </button>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </AceBubble>
            </AceWalker>
        </motion.aside>
    );
}
