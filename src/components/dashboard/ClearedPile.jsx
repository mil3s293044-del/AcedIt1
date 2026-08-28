/**
 * ClearedPile — what you have actually put away this week, as the pile it is.
 *
 * WHAT IT REPLACES was "Last sessions": four rows reading "Chemistry · Aug 14 ·
 * 1m", each with one to three orange stars and no legend. The stars were
 * `productivity_rating`, a one-to-five you tapped on the way out of a session,
 * and nothing on the page said so — so the panel showed a number nobody could
 * read against four lines nobody could tell apart. It was a log, in the second
 * most valuable column on the page, and a log answers a question ("what
 * happened on the fourteenth") that nobody opens a dashboard to ask.
 *
 * THE QUESTION PEOPLE ACTUALLY ASK is "have I done enough lately", and the
 * honest answer to that is a volume, not a list. So the week's sessions become
 * a pile: one card per session, stacked with the most recent on top, tinted by
 * subject, leaning slightly so the depth of the pile is the amount of work.
 * You can see a heavy week from across the room. Four rows of text could not
 * do that no matter what was written in them.
 *
 * THE STARS DID NOT SURVIVE and should not have. A self-rated score collected
 * once, shown without its scale, next to a duration, invites exactly one
 * conclusion — that the app is grading your mood — and it is the only number
 * on the dashboard that no other screen uses for anything.
 *
 * IT COUNTS SESSIONS, NOT DAYS. The streak panel already owns days, and a
 * second panel drawing the same seven boxes in a different shape is the kind
 * of duplication that makes a dashboard feel padded. Two sessions on Tuesday
 * are two cards here and one lit day over there, which is the distinction
 * worth having.
 */
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowRight, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { colorFor } from "@/components/cards/cardIdentity";
import { clearedThisWeek } from "@/lib/clearedWeek";

/**
 * More than this and the pile is a smear.
 *
 * Fourteen cards at five pixels of offset came out as a solid block of
 * horizontal lines: a stack, but not a stack whose edges you could see. Eight
 * at seven pixels reads as cards. The rest are counted in the sentence
 * underneath, which is where a number belongs anyway.
 */
const MAX_IN_PILE = 8;

const fmt = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

export default function ClearedPile({ sessions = [], className = "" }) {
    const reduce = useReducedMotion();
    const week = clearedThisWeek(sessions);
    const inPile = week.sessions.slice(0, MAX_IN_PILE);
    const extra = week.count - inPile.length;

    if (week.count === 0) {
        return (
            <div data-cleared-pile="0" className={`card-soft on-table p-5 ${className}`}>
                <p className="stat-label mb-3">Cleared this week</p>
                <div className="flex flex-col items-center text-center gap-3 py-2">
                    <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center
                        justify-center border border-primary/10">
                        <Brain className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <p className="font-bold text-foreground text-sm">Nothing cleared yet</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Every session you finish lands here for the week.
                        </p>
                    </div>
                    <Link to={createPageUrl("Study")}>
                        <Button size="sm" className="gap-1.5">
                            <Brain className="w-3.5 h-3.5" /> Start a session
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div data-cleared-pile={week.count} className={`card-soft on-table p-5 ${className}`}>
            <div className="flex items-baseline justify-between gap-3 mb-1">
                <p className="stat-label">Cleared this week</p>
                <Link to={createPageUrl("Study")}
                    className="text-[11px] font-bold text-muted-foreground hover:text-foreground
                        underline underline-offset-2">
                    View all
                </Link>
            </div>

            {/* The pile. Stacked with a few pixels of offset each, so height IS
                the count: a heavy week is visibly a taller stack, and no label
                has to say so. */}
            <div className="relative mx-auto my-4"
                style={{ height: 48 + inPile.length * 7, width: 120 }}>
                {inPile.map((s, i) => {
                    // `inPile` is newest first, so i === 0 is the card that has
                    // to end up ON TOP: highest on the stack and highest in the
                    // z-order. The first version derived both from the reverse
                    // of that and buried the newest session at the bottom of
                    // its own pile, with the label on it hidden behind seven
                    // older ones.
                    const lift = (inPile.length - 1 - i) * 7;
                    const tone = colorFor(s.subject || "Study");
                    return (
                        <motion.div
                            key={s.id || i}
                            data-pile-card={s.subject || "Study"}
                            title={`${s.subject || "Study"} · ${s.duration_minutes || 0}m`}
                            className="absolute left-1/2 rounded-[7px] border bg-surface"
                            style={{
                                width: 104,
                                height: 44,
                                borderColor: `${tone}66`,
                                background: `linear-gradient(105deg, ${tone}1F, ${tone}0A)`,
                                bottom: lift,
                                zIndex: inPile.length - i,
                                boxShadow: "0 1px 2px rgba(13,22,38,0.10)",
                            }}
                            initial={reduce
                                ? { opacity: 0, x: "-50%" }
                                : { opacity: 0, x: "-50%", y: -14, rotate: -6 }}
                            animate={{
                                opacity: 1, x: "-50%", y: 0,
                                // Alternating lean, so the stack has the ragged
                                // edge a real pile has rather than looking
                                // machine-squared.
                                rotate: reduce ? 0 : (i % 2 ? 1.4 : -1.2),
                            }}
                            transition={reduce
                                ? { duration: 0.2, delay: (inPile.length - 1 - i) * 0.02 }
                                : { type: "spring", stiffness: 260, damping: 22,
                                    delay: 0.1 + (inPile.length - 1 - i) * 0.05 }}
                        >
                            {/* Only the top card is readable, which is exactly
                                how a pile works. The rest are edges. */}
                            {i === 0 && (
                                <span className="absolute inset-0 px-2.5 flex flex-col justify-center">
                                    <span className="block text-[11px] font-extrabold
                                        text-foreground leading-tight truncate">
                                        {s.subject || "Study"}
                                    </span>
                                    <span className="block text-[10px] text-muted-foreground leading-tight">
                                        {s.duration_minutes || 0}m
                                    </span>
                                </span>
                            )}
                        </motion.div>
                    );
                })}
            </div>

            <p className="text-[13px] leading-relaxed">
                <span className="font-bold text-foreground">
                    {week.count} session{week.count === 1 ? "" : "s"}
                </span>
                <span className="text-muted-foreground">
                    {" "}· {fmt(week.minutes)} across {week.days} day{week.days === 1 ? "" : "s"}
                    {extra > 0 ? `, ${extra} more under the top` : ""}
                </span>
            </p>

            {week.subjects.length > 0 && (
                <p className="text-[11px] text-muted-foreground/70 mt-1.5 leading-relaxed">
                    {week.subjects.slice(0, 3).join(", ")}
                    {week.subjects.length > 3 ? ` +${week.subjects.length - 3}` : ""}
                </p>
            )}

            <Link to={createPageUrl("Study")}
                className="inline-flex items-center gap-1 text-[11px] font-bold
                    text-primary hover:underline mt-2.5">
                Add to the pile <ArrowRight className="w-3 h-3" />
            </Link>
        </div>
    );
}
