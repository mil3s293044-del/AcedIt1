/**
 * AceTip — a small spade beside anything the app never bothered to explain.
 *
 * The help drawer answers "what's on this page". This answers the question
 * that actually stops people: they're looking at one number, one badge, one
 * row of four buttons, and there is nothing anywhere in the product that says
 * what it is. "AcedIt ATAR 71.4". "Weak spot". "Stability 62". "Again / Hard /
 * Good / Easy". All shipped undefined.
 *
 * Deliberately a tap and not a hover. Half the students using this are on a
 * phone, where hover doesn't exist, and a tooltip that only appears to mouse
 * users is a tooltip that isn't there for the people most likely to be lost.
 *
 * Deliberately small and quiet, too. This goes next to dozens of things; if it
 * drew attention it would turn every page into a field of question marks and
 * be the first thing anyone asked us to remove.
 */
import React from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { SpadePip } from "@/components/ace/SpadeMark";
import { termFor } from "@/lib/aceTerms";
import { BY_ID } from "@/lib/aceKnowledge";

export default function AceTip({ term, className = "", align = "start", side = "bottom" }) {
    const t = termFor(term);
    // A tip with nothing behind it renders nothing rather than an empty
    // bubble — that way a typo in a `term` prop is invisible instead of being
    // a small broken thing on the page.
    if (!t) return null;
    const feature = t.see ? BY_ID[t.see] : null;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button type="button" data-ace-tip={term}
                    aria-label={`What is ${t.term}?`}
                    onClick={(e) => e.stopPropagation()}
                    className={`inline-grid place-items-center w-4 h-4 rounded-full align-middle
                        text-muted-foreground/70 hover:text-foreground transition-colors
                        focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${className}`}>
                    <SpadePip className="w-2.5 h-2.5" tone="fill-current" />
                </button>
            </PopoverTrigger>
            <PopoverContent align={align} side={side} sideOffset={6}
                data-ace-tip-content={term}
                onClick={(e) => e.stopPropagation()}
                className="w-72 max-w-[calc(100vw-2rem)] rounded-2xl border-2 border-border bg-surface p-3.5 shadow-soft-lg">
                <p className="font-display font-extrabold text-foreground text-sm leading-tight">{t.term}</p>
                <p className="text-sm text-foreground leading-snug mt-1.5">{t.what}</p>
                {t.how && (
                    <p className="text-xs text-muted-foreground leading-snug mt-2">{t.how}</p>
                )}
                {/* The misreading, called out in the same breath rather than a
                    footnote — a caveat below the fold is a caveat nobody read. */}
                {t.not && (
                    <p className="text-xs text-foreground/80 leading-snug mt-2 pt-2 border-t border-border">
                        {t.not}
                    </p>
                )}
                {feature && (
                    <Link to={feature.to}
                        className="inline-flex items-center gap-1 text-xs font-bold text-foreground hover:underline mt-2.5">
                        Open {feature.name} <ArrowRight className="w-3 h-3" />
                    </Link>
                )}
            </PopoverContent>
        </Popover>
    );
}
