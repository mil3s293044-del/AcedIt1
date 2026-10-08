/**
 * MoreDetail — the methodology half of a tab, behind one named control.
 *
 * ─── THE LENGTH WAS THE COMPLAINT ───────────────────────────────────────────
 * Measured: the Hours tab was 1,962px on a desktop and ~1,850px per tab on a
 * phone, so a student looking for one figure scrolled past six panels to find
 * it. Every one of those panels was true; most of them are read once.
 *
 * ─── IT NAMES WHAT IS BEHIND IT ─────────────────────────────────────────────
 * The call the science rail already makes on /Study: a chevron on nothing is a
 * control nobody presses, and "a screen nobody presses into is a screen nobody
 * has" is the failure /League and /Review were each rebuilt out of. So the
 * label says the panels, not "more" — and what leads the tab is what names
 * something a student can act on, which is the half that must never be folded.
 *
 * ─── ONE PREFERENCE, ACROSS EVERY TAB ───────────────────────────────────────
 * Keyed `acedit.progress.detail`, the same shape the science rail's own
 * preference takes. A student who folded the detail away on Cards has said
 * what they think of a methodology rail; asking again on Hours is the app not
 * listening. It defaults CLOSED — this is the half that was making the page
 * long, and a first visit should land on the short version — and blocked or
 * absent storage costs a render rather than a crash.
 */
import React, { useCallback, useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

const KEY = "acedit.progress.detail";

const read = () => {
    try { return localStorage.getItem(KEY) === "open"; } catch { return false; }
};

export default function MoreDetail({ label, children }) {
    const [open, setOpen] = useState(read);

    // Read once on mount rather than during render, so a blocked store and a
    // server render agree about the first paint.
    useEffect(() => { setOpen(read()); }, []);

    const toggle = useCallback(() => {
        setOpen((v) => {
            const next = !v;
            try { localStorage.setItem(KEY, next ? "open" : "shut"); } catch { /* a preference is not worth a crash */ }
            return next;
        });
    }, []);

    if (!children) return null;

    return (
        <section className="space-y-4">
            <button type="button" onClick={toggle} aria-expanded={open}
                className="w-full flex items-center gap-2.5 px-1 py-1 text-left group">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider
                    group-hover:text-foreground transition-colors">
                    {label}
                </span>
                <span className="h-px flex-1 bg-border" aria-hidden="true" />
                <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform
                    ${open ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
            {open && <div className="space-y-4">{children}</div>}
        </section>
    );
}
