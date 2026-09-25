/**
 * StartHereCard — the way back into the first run and the tour.
 *
 * Neither could be STARTED before this. Both open themselves from the
 * profile's age and both write `skipped` when the student presses the X on
 * Ace's bubble, so dismissing him on minute one — the single most likely thing
 * to happen to a bubble nobody asked for — lost both permanently, with no
 * control anywhere in the app to get either back.
 *
 * ONE CARD, TWO HOMES, and the same component in both so they cannot drift.
 * On the dashboard it is time-boxed to `ENTRY_WINDOW_HOURS`, because it is for
 * the student who has just closed him and will not go looking; after that it
 * is reference rather than news and lives on Help with everything else this
 * app can do. The dashboard copy SAYS where it goes, because a control that
 * disappears without saying so is one the student assumes they imagined.
 *
 * He is drawn here rather than iconed: this card is about a character who
 * talks to you from the corner, and `AceBody` with its idles on is the only
 * honest preview of that. An icon of a rocket would be the decoration rule.
 */
import React from "react";
import { ArrowRight } from "lucide-react";
import AceBody from "@/components/ace/AceBody";
import { RUN, TOUR, requestAce } from "@/lib/aceReplay";

export default function StartHereCard({ home = "help", className = "" }) {
    return (
        <div className={`card-soft p-4 sm:p-5 ${className}`}>
            <div className="flex items-start gap-3 sm:gap-4">
                <AceBody className="w-12 sm:w-14 flex-shrink-0 hidden sm:block" pose="offer" />

                <div className="min-w-0 flex-1">
                    <p className="stat-label text-muted-foreground">
                        {home === "dashboard" ? "New here" : "Starting out"}
                    </p>
                    <p className="font-display font-extrabold text-foreground text-lg leading-tight">
                        Do one real thing
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-1.5">
                        Pick a subject and Ace builds you three real exam questions, marks your
                        answers and shows you what that did. About three minutes, and the quiz
                        is yours afterwards.
                    </p>

                    <div className="flex flex-wrap items-center gap-2 mt-3.5">
                        <button
                            onClick={() => requestAce(RUN)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-primary
                                text-primary-foreground px-3.5 py-2 text-sm font-bold
                                hover:bg-primary/90 transition-colors">
                            Start it <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={() => requestAce(TOUR)}
                            className="inline-flex items-center rounded-xl border-2 border-border
                                px-3.5 py-2 text-sm font-bold text-foreground
                                hover:border-primary hover:bg-primary/5 transition-colors">
                            Show me around
                        </button>
                    </div>

                    {home === "dashboard" && (
                        <p className="text-[11px] text-muted-foreground leading-snug mt-3">
                            This stays on the Help page from here on.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
