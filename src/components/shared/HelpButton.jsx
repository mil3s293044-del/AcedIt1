/**
 * HelpButton — Ace, explaining the page you're standing on.
 *
 * This existed already, on ten pages, carrying its own hand-written copy. The
 * copy had rotted: it promised "five powerful study techniques" when there are
 * six, walked through a Dashboard whose sections had been replaced months ago,
 * and named AI tools ("Practice Answer Generator", "Question Generator") that
 * don't go by those names. Help kept in a separate file from the thing it
 * describes doesn't stay true — it only ever drifts further, quietly, because
 * nobody opens it while they're changing a feature.
 *
 * So it reads the feature map now, same as Ace does. There is exactly one
 * place to describe a feature, and a description that goes stale goes stale
 * everywhere at once, which is the only way anyone notices.
 *
 * It was also hardcoded indigo-and-purple with a `bg-black/30` scrim, so in
 * dark mode it rendered as a bright slab. It uses the design tokens now.
 */
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, X, ArrowRight, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import SpadeMark from "@/components/ace/SpadeMark";
import { PAGES, featuresForPage } from "@/lib/aceKnowledge";

export default function HelpButton({ page, className = "" }) {
    const [open, setOpen] = useState(false);
    const meta = PAGES[page];
    const features = featuresForPage(page);
    // No entry means nothing truthful to say, and an empty panel is worse than
    // no button. Pages with notes but no features (Settings, Subscription,
    // Support) are legitimate — they're plumbing, not study features.
    if (!meta || (!features.length && !meta.notes?.length)) return null;

    return (
        <>
            <button onClick={() => setOpen(true)} aria-label={`What's on this page`}
                data-help-button={page}
                className={`inline-flex items-center justify-center w-8 h-8 rounded-full bg-surface border-2 border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors ${className}`}>
                <HelpCircle className="w-4 h-4" />
            </button>

            <AnimatePresence>
                {open && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setOpen(false)}
                            className="fixed inset-0 bg-foreground/25 backdrop-blur-sm z-50" />

                        <motion.div
                            initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 60 }}
                            transition={{ type: "spring", damping: 28, stiffness: 280 }}
                            data-help-panel={page}
                            role="dialog" aria-label={`What's on ${meta.title}`}
                            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-surface border-l-2 border-border shadow-2xl flex flex-col">

                            <div className="flex items-center gap-3 p-4 border-b-2 border-border">
                                <SpadeMark className="w-10 h-10" />
                                <div className="min-w-0 flex-1">
                                    <p className="stat-label">What's on this page</p>
                                    <h2 className="font-display font-extrabold text-foreground text-lg leading-tight">{meta.title}</h2>
                                </div>
                                <button onClick={() => setOpen(false)} aria-label="Close"
                                    className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="px-4 py-3 border-b-2 border-border bg-secondary/40">
                                <p className="text-sm text-foreground leading-snug">{meta.intro}</p>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                {(meta.notes || []).map((note, i) => (
                                    <motion.p key={`n${i}`}
                                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: Math.min(i * 0.04, 0.3) }}
                                        data-help-note={i}
                                        className="rounded-2xl border-2 border-border p-3 text-sm text-muted-foreground leading-snug">
                                        {note}
                                    </motion.p>
                                ))}
                                {features.map((f, i) => (
                                    <motion.div key={f.id}
                                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: Math.min(i * 0.04, 0.3) }}
                                        data-help-feature={f.id}
                                        className="rounded-2xl border-2 border-border p-3">
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-foreground text-sm">{f.name}</p>
                                            {f.premium && <Lock className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                                            {/* A sub-feature isn't a separate destination — saying so
                                                stops "Map layers" reading as a seventh tab. */}
                                            {f.parent && <span className="pill bg-secondary text-muted-foreground">inside</span>}
                                        </div>
                                        <p className="text-sm text-muted-foreground leading-snug mt-1">{f.what}</p>
                                        <p className="text-xs text-muted-foreground leading-snug mt-1.5">
                                            <span className="font-bold text-foreground">Worth it when:</span>{" "}
                                            {f.when.charAt(0).toLowerCase() + f.when.slice(1)}
                                        </p>
                                        {f.proof && (
                                            <p className="text-[11px] text-muted-foreground leading-snug mt-1">{f.proof}</p>
                                        )}
                                        {f.needs && (
                                            <p className="text-[11px] text-muted-foreground leading-snug mt-1">
                                                Needs {f.needs.label} first.
                                            </p>
                                        )}
                                    </motion.div>
                                ))}
                            </div>

                            {/* This panel only ever answers "what is on THIS
                                page", which is no help at all to a student who
                                is on the wrong page — the commonest way to be
                                lost here. Help is the same descriptions for
                                the whole app, so the panel now opens onto it
                                rather than dead-ending in a support form. */}
                            <div className="p-3 border-t-2 border-border space-y-2">
                                <Link to="/Help" onClick={() => setOpen(false)}
                                    className="flex items-center justify-center gap-1.5 text-xs font-bold text-primary hover:underline">
                                    Looking for something else? See everything <ArrowRight className="w-3 h-3" />
                                </Link>
                                <Link to="/Support" onClick={() => setOpen(false)}
                                    className="flex items-center justify-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
                                    Still stuck? Contact support <ArrowRight className="w-3 h-3" />
                                </Link>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
