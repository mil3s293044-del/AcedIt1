/**
 * UpdatePrompt — the screen that says a new version of AcedIt shipped, and
 * reloads into it when the student says so.
 *
 * ─── Why it blocks ──────────────────────────────────────────────────────────
 * A banner would be kinder and would not work. The thing being prevented is a
 * student navigating into a chunk that was deleted by the deploy and getting a
 * white screen (`lazyPage.js` has the full account), and a strip somebody can
 * ignore is ignored precisely by the students who keep a tab open for days —
 * who are exactly the ones holding the dead bundle. So it takes the screen.
 *
 * ─── AND WHY BLOCKING IS SAFE ───────────────────────────────────────────────
 * Only because it never arrives over real work. `mayPrompt` runs every hold in
 * `liveRefresh`'s registry, so a quiz on screen, an exam, a running focus
 * block, a marking call in flight or text typed in the last few seconds all
 * hold it — and it is still waiting when they are done, because an update that
 * gave up would leave the student on the stale bundle this exists to get them
 * off. The worst case is a prompt a few minutes late, which costs nothing.
 *
 * ─── IT IS THE APP'S OWN PANEL ──────────────────────────────────────────────
 * Design tokens, both themes, `card-soft on-table`, the brand mark rather than
 * a mascot — `AceIntro`'s rule: drawing the MARK claims nobody, so this cannot
 * end up as a second Ace on screen talking over the first (`ACE_ORDER`).
 *
 * THE SCRIM IS LITERAL, and that is the call focus mode already makes. A scrim
 * is SHADOW, not ink: its job is to dim whatever is behind it. Written as
 * `bg-foreground/60` it inverts with the theme — `--foreground` is near-white
 * in the dark — so the overlay came out a pale wash that BRIGHTENED the page it
 * was meant to push back. Only a screenshot caught it. `bg-black/60` matches
 * the app's own `DialogOverlay` and is right in both themes, for the same
 * reason focus mode's ground is a literal `#0A121F`: a token that flips
 * underneath a deliberate effect is the bug rather than the fix.
 *
 * There is no dismiss. A cross would make this a banner with extra steps, and
 * the one button is the one action — which is also why the copy says what the
 * button does rather than apologising for being here.
 */

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Sparkles } from "lucide-react";
import BrandMark from "@/components/shared/BrandMark";
import { useLive } from "@/lib/LiveContext";
import { focusedFieldHasContent } from "@/lib/liveRefresh";
import {
    fetchVersion, stale, mayPrompt, VERSION_POLL_MS, VERSION_FOCUS_GAP_MS,
} from "@/lib/appVersion";

export default function UpdatePrompt() {
    const { registry } = useLive();
    const [show, setShow] = useState(false);
    const [reloading, setReloading] = useState(false);

    // The build this tab booted with. A ref rather than state: it is written
    // once, from the first successful poll, and a re-render on it would be a
    // re-render announcing nothing.
    const booted = useRef(null);
    // A version seen while the student was busy. THIS REF IS THE "DEFER, NEVER
    // DROP" — without it an update noticed mid-quiz is gone, and the next poll
    // is three minutes away at best.
    const pending = useRef(false);
    const lastInputAt = useRef(0);
    const lastCheckAt = useRef(0);

    // Typing is MEASURED rather than declared, the same call liveRefresh makes:
    // a registry of every form in the app is a list that is wrong within a
    // month. One passive listener on the document.
    useEffect(() => {
        const onInput = () => { lastInputAt.current = Date.now(); };
        document.addEventListener("input", onInput, true);
        return () => document.removeEventListener("input", onInput, true);
    }, []);

    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();

        const decide = () => {
            if (cancelled || !pending.current) return;
            const gate = mayPrompt({
                now: Date.now(),
                lastInputAt: lastInputAt.current,
                busy: registry ? registry.reasons() : [],
                focusedHasContent: focusedFieldHasContent(document.activeElement),
                hidden: document.hidden,
            });
            if (gate.ok) setShow(true);
        };

        const check = async () => {
            if (cancelled) return;
            lastCheckAt.current = Date.now();
            const latest = await fetchVersion(controller.signal);
            if (cancelled || !latest) return;
            if (!booted.current) { booted.current = latest; return; }
            if (stale(booted.current, latest)) pending.current = true;
            decide();
        };

        check();
        const poll = setInterval(check, VERSION_POLL_MS);

        // Coming back to the tab is the moment a deploy is most likely to have
        // landed since they last looked, and the one moment we know they are
        // not mid-sentence. `decide` runs either way, so an update that was
        // held while they were away is shown the instant they return rather
        // than waiting out the rest of the poll.
        const onFocus = () => {
            if (document.hidden) return;
            decide();
            if (Date.now() - lastCheckAt.current > VERSION_FOCUS_GAP_MS) check();
        };
        document.addEventListener("visibilitychange", onFocus);
        window.addEventListener("focus", onFocus);

        // And the moment the student stops being busy. The registry already
        // notifies on every acquire and release, so finishing a quiz shows the
        // prompt that was waiting rather than leaving it for the next poll.
        const offBusy = registry?.onChange?.(decide) || (() => {});

        return () => {
            cancelled = true;
            controller.abort();
            clearInterval(poll);
            document.removeEventListener("visibilitychange", onFocus);
            window.removeEventListener("focus", onFocus);
            offBusy();
        };
    }, [registry]);

    const reload = () => {
        setReloading(true);
        try {
            // Clear lazyPage's one-reload guard on the way out. It is keyed per
            // page name in sessionStorage, and a tab that already burned its
            // reload on a missing chunk would otherwise carry that mark into
            // the new build, where the chunk exists and the guard is stale.
            sessionStorage.removeItem("acedit:chunk-reload");
        } catch { /* blocked storage is not a reason to stay on the old build */ }
        // `reload()` rather than a cache-busted href: the browser revalidates
        // index.html, which is what names the new chunks, and every other asset
        // is fingerprinted so it cannot come back stale.
        window.location.reload();
    };

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    role="dialog" aria-modal="true" aria-labelledby="update-title">
                    <motion.div
                        className="card-soft on-table w-full max-w-md p-6 sm:p-7 text-center"
                        initial={{ opacity: 0, y: 14, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.98 }}
                        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}>

                        <div className="flex justify-center mb-4">
                            <span className="relative inline-flex">
                                <BrandMark size="xl" glow showWord={false} />
                                <Sparkles className="w-4 h-4 text-primary absolute -top-1 -right-1" />
                            </span>
                        </div>

                        <h2 id="update-title" className="font-display font-extrabold text-2xl text-foreground">
                            A fresh AcedIt is ready
                        </h2>
                        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                            We shipped an update while you had this open. One tap loads it —
                            takes a second, and your work is already saved.
                        </p>

                        <button
                            onClick={reload}
                            disabled={reloading}
                            autoFocus
                            className="mt-5 w-full inline-flex items-center justify-center gap-2 px-5 py-3
                                rounded-2xl bg-foreground text-background font-bold
                                hover:opacity-90 transition-opacity disabled:opacity-70">
                            {/* A refresh glyph that turns is the control saying it is
                                working, in the control's own place — which is why
                                `aceLoading.test.mjs` leaves this idiom alone. */}
                            <RefreshCw className={`w-4 h-4 ${reloading ? "animate-spin" : ""}`} />
                            {reloading ? "Loading it up…" : "Load the new version"}
                        </button>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
