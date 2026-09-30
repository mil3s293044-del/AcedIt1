/**
 * ConsentBanner — the ask that has to happen before a pixel loads.
 *
 * ─── WHY IT IS A REAL CHOICE AND NOT A COOKIE WALL ──────────────────────────
 * Most of this app's users are fifteen to eighteen. A banner whose only button
 * is "Got it" is not a choice, and a dismissal that counts as acceptance is the
 * pattern regulators name specifically. So there are TWO buttons of equal
 * weight, neither is pre-selected, and closing the banner without choosing
 * leaves the stored value UNSET — which `readConsent` reports as a refusal, so
 * nothing loads.
 *
 * ─── IT NAMES THE COMPANIES ─────────────────────────────────────────────────
 * "We use cookies to improve your experience" tells somebody nothing they can
 * act on. Meta and TikTok are the two that matter here — they are advertising
 * networks, the data goes to them, and a student deciding whether to allow that
 * should be told who. The privacy policy already lists them; the banner is
 * where the decision is actually made, so it says it there too.
 *
 * ─── IT DOES NOT BLOCK THE PAGE ─────────────────────────────────────────────
 * No overlay, no scroll lock. The app works fully whether you accept or not,
 * because nothing behind the banner depends on tracking, and holding a study
 * app hostage over a marketing pixel would be absurd. That is also why the
 * decline path costs nothing: measurement is ours to lose.
 */
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { CONSENT, readConsent } from "@/lib/compliance";
import { setConsent } from "@/lib/analytics";

export default function ConsentBanner() {
    const reduce = useReducedMotion();
    // Deliberately not read during render initialisation on the server path —
    // `readConsent` is storage-guarded, but the mount effect is also what makes
    // the banner never flash for somebody who already answered.
    const [show, setShow] = useState(false);

    useEffect(() => {
        setShow(readConsent() === CONSENT.UNSET);
    }, []);

    const choose = (value) => {
        setConsent(value);
        setShow(false);
    };

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={reduce ? false : { y: 24, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 24, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 28 }}
                    role="dialog"
                    aria-label="Analytics and advertising cookies"
                    className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:p-4"
                >
                    <div className="mx-auto max-w-3xl card-soft on-table p-4 sm:p-5
                        flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-foreground mb-1">
                                Can we measure how people find AcedIt?
                            </p>
                            <p className="text-sm text-muted-foreground">
                                We&rsquo;d use Meta, TikTok and Google Analytics to see which ads bring
                                students here. They&rsquo;re advertising networks, so this is genuinely
                                your call &mdash; AcedIt works exactly the same either way, and we never
                                use them for anyone under 18.{" "}
                                <Link
                                    to={createPageUrl("Privacy")}
                                    className="text-primary underline underline-offset-2 font-semibold"
                                >
                                    Privacy Policy
                                </Link>
                            </p>
                        </div>
                        {/* Equal weight, nothing pre-selected. The decline button is not
                            a quieter link — a choice drawn as an afterthought is not one. */}
                        <div className="flex gap-2 flex-shrink-0">
                            <Button
                                variant="outline"
                                className="flex-1 sm:flex-none font-bold"
                                onClick={() => choose(CONSENT.DENIED)}
                            >
                                No thanks
                            </Button>
                            <Button
                                className="flex-1 sm:flex-none font-bold"
                                onClick={() => choose(CONSENT.GRANTED)}
                            >
                                That&rsquo;s fine
                            </Button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
