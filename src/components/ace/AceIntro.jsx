/**
 * AceIntro — Ace introducing a page, once, the first time you stand on it.
 *
 * This is the piece the whole "help people understand the app" job actually
 * turns on, and it's also the piece most likely to be hated, so the shape
 * matters more than the content.
 *
 * What it is NOT: a modal, a backdrop, a spotlight, a numbered sequence with
 * Next / Next / Next. Those get dismissed in about two seconds and teach
 * nothing, and worse, they teach the student that the correct response to this
 * app talking to them is to close it — after which nothing you put in front of
 * them again gets read.
 *
 * What it is: a small card in the corner opposite the launcher, that does not
 * block anything, naming the page and the two or three things on it. It waits
 * for the page to settle, appears once, and is gone for good either way. The
 * pacing rules live in aceFirstRun.js and are deliberately strict — one per
 * page ever, one per sitting, and it switches itself off entirely if the first
 * three are closed without a single one being opened.
 */
import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight } from "lucide-react";
import SpadeMark from "@/components/ace/SpadeMark";
import { PAGES, featuresForPage } from "@/lib/aceKnowledge";
import { shouldIntroduce, markShown, markClosed } from "@/lib/aceFirstRun";

/** Long enough for the page to have finished laying itself out. */
const SETTLE_MS = 1400;

export default function AceIntro({ page, suppressed = false }) {
    const [show, setShow] = useState(false);
    const meta = PAGES[page];

    useEffect(() => {
        setShow(false);
        if (!page || suppressed || !meta) return;
        if (!shouldIntroduce(page)) return;
        const t = setTimeout(() => {
            // Re-checked on fire, not just on schedule: a student who clicks
            // through three pages in a second would otherwise queue three
            // introductions and get all of them.
            if (!shouldIntroduce(page)) return;
            markShown(page);
            setShow(true);
        }, SETTLE_MS);
        return () => clearTimeout(t);
    }, [page, suppressed, meta]);

    const close = useCallback((engaged) => {
        markClosed(page, { engaged });
        setShow(false);
    }, [page]);

    if (!meta) return null;

    // The two or three headline features, sub-features left out — those are
    // what the help drawer is for, and this has to stay readable at a glance.
    const items = featuresForPage(page).filter(f => !f.parent).slice(0, 3);

    return (
        <AnimatePresence>
            {show && (
                <motion.aside
                    key={`intro-${page}`}
                    initial={{ opacity: 0, y: 16, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 16, scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 320, damping: 28 }}
                    data-ace-intro={page}
                    role="note" aria-label={`About ${meta.title}`}
                    /* RIGHT side, always. The nav rail owns the left edge on
                       desktop, so anything Ace puts over there is either under
                       it or fighting it — he gets one column and stays in it.

                       Stacked ABOVE the launcher rather than beside it: the
                       launcher is a button people reach for, and at phone width
                       this card is full-bleed, so "opposite corner" stops
                       meaning anything and it has to clear it vertically. */
                    className="fixed left-3 right-3 bottom-40 sm:left-auto sm:right-6 sm:bottom-[5.5rem] sm:w-[340px] z-30
                        rounded-2xl bg-surface border-2 border-border shadow-soft-lg p-4">
                    <div className="flex items-start gap-2.5">
                        <SpadeMark className="w-9 h-9 flex-shrink-0" mood="pleased" />
                        <div className="min-w-0 flex-1">
                            <p className="stat-label">First time here</p>
                            <p className="font-display font-extrabold text-foreground leading-tight">{meta.title}</p>
                        </div>
                        <button onClick={() => close(false)} aria-label="Dismiss"
                            data-ace-intro-close
                            className="text-muted-foreground hover:text-foreground p-1 -m-1 rounded-lg flex-shrink-0">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <p className="text-sm text-foreground leading-snug mt-2.5">{meta.intro}</p>

                    {items.length > 0 && (
                        <ul className="mt-2.5 space-y-1.5">
                            {items.map(f => (
                                <li key={f.id} className="text-xs text-muted-foreground leading-snug">
                                    <span className="font-bold text-foreground">{f.name}</span> — {f.what}
                                </li>
                            ))}
                        </ul>
                    )}

                    <div className="flex items-center gap-2 mt-3.5">
                        <button onClick={() => close(false)}
                            className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
                            Got it
                        </button>
                        <button data-ace-intro-more
                            onClick={() => {
                                // Handing over rather than growing: the panel
                                // already explains everything properly, and
                                // this card has no business becoming a second
                                // one.
                                window.dispatchEvent(new CustomEvent("ace:open", { detail: { page } }));
                                close(true);
                            }}
                            className="ml-auto inline-flex items-center gap-1 rounded-xl bg-primary text-primary-foreground px-3 py-1.5 text-xs font-bold hover:bg-primary/90 transition-colors">
                            Show me <ArrowRight className="w-3 h-3" />
                        </button>
                    </div>
                </motion.aside>
            )}
        </AnimatePresence>
    );
}
