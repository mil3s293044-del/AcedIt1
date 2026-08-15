/**
 * RetentionCard — "What you'll lose this week".
 *
 * Sits under the brain in the rail, and the pairing is the point: the brain
 * shows the systems the last month of work leaned on, this shows what that
 * work is about to cost if it isn't topped up. Same material, opposite
 * direction.
 *
 * The claim it makes is deliberately narrower than "cards due". Due-today is
 * already on the radar and in the deck list. This is about DEPTH of decay —
 * a card only counts here once predicted recall has fallen through 85%, which
 * under the model is about half again past its scheduled review. Being a
 * little overdue is fine; this is the part that isn't.
 *
 * It is a projection, not a reading of anyone's memory, and the footer says
 * so. See src/lib/retention.js for the model and what it deliberately refuses
 * to double-count.
 */
import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { TrendingDown, ArrowRight, Info, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { retentionOutlook, retentionSummary } from "@/lib/retention";
import AceTip from "@/components/ace/AceTip";

/**
 * The collection split three ways. This replaced a day-by-day decay curve:
 * at rail width a 3-of-13 drop rendered as a two-pixel sliver, and the day the
 * curve crosses is not something anyone acts on. The PROPORTION is the part
 * that lands — "over half of what you've learned has already slipped" is a
 * much stronger sentence than "7 cards", and it's the same fact.
 */
function RetentionBar({ slipping, falling, total, days }) {
    if (!total) return null;
    const safe = Math.max(0, total - slipping - falling);
    const pct = (n) => (n / total) * 100;
    const seg = [
        { n: slipping, cls: "bg-streak",     label: "already slipped" },
        { n: falling,  cls: "bg-xp",         label: `drop out within ${days} days` },
        { n: safe,     cls: "bg-foreground/15", label: "still holding" },
    ].filter(s => s.n > 0);
    return (
        <div role="img"
            aria-label={`Of ${total} cards learned: ${slipping} already slipped, ${falling} drop out of reach within ${days} days, ${safe} still holding.`}>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-secondary" data-retention-bar>
                {seg.map(s => (
                    <motion.div key={s.label} initial={{ width: 0 }} animate={{ width: `${pct(s.n)}%` }}
                        transition={{ duration: 0.7, delay: 0.15 }} title={`${s.n} ${s.label}`}
                        className={s.cls} />
                ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground mt-1.5">
                {slipping > 0 && (
                    <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-streak" />
                        <span className="font-bold text-foreground tabular-nums">{slipping}</span> gone
                    </span>
                )}
                {falling > 0 && (
                    <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-xp" />
                        <span className="font-bold text-foreground tabular-nums">{falling}</span> this week
                    </span>
                )}
                <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-foreground/25" />
                    <span className="font-bold text-foreground tabular-nums">{safe}</span> holding
                </span>
            </div>
        </div>
    );
}

export default function RetentionCard({ flashcards = [], days = 7 }) {
    const o = useMemo(() => retentionOutlook(flashcards, { days }), [flashcards, days]);

    return (
        <div className="card-soft on-table border-2 border-border p-5">
            <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-streak/10 flex items-center justify-center flex-shrink-0">
                    <TrendingDown className="w-4 h-4 text-streak" />
                </div>
                <div className="min-w-0">
                    <p className="stat-label inline-flex items-center gap-1">
                        What you'll lose this week <AceTip term="at_risk" />
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                        {o.hasData ? `${o.learnedCount} card${o.learnedCount === 1 ? "" : "s"} learned so far` : "nothing reviewed yet"}
                    </p>
                </div>
            </div>

            <p className="text-sm text-foreground leading-snug mb-3">{retentionSummary(o)}</p>

            {/* Nothing at risk is a real result, not an empty state — it gets
                said properly rather than shown as a blank panel. */}
            {o.hasData && o.atRisk === 0 && (
                <div className="flex items-center gap-2 rounded-2xl border-2 border-border bg-secondary/40 p-3">
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    <p className="text-xs text-muted-foreground leading-snug">
                        Your schedule is ahead of the decay. Keep the reviews where they are.
                    </p>
                </div>
            )}

            {o.atRisk > 0 && (
                <>
                    <RetentionBar slipping={o.slipping} falling={o.falling}
                        total={o.learnedCount} days={o.days} />

                    <ul className="space-y-2 mt-3">
                        {o.subjects.slice(0, 3).map(s => (
                            <li key={s.subject} className="flex items-baseline justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-foreground truncate">{s.subject}</p>
                                    <p className="text-[10px] text-muted-foreground truncate">
                                        {s.topics.length ? s.topics.slice(0, 2).join(", ") : "mixed topics"}
                                        {s.topics.length > 2 ? ` +${s.topics.length - 2}` : ""}
                                    </p>
                                </div>
                                {/* The counts are foreground with a coloured dot
                                    rather than coloured text: measured on this
                                    card, text-streak is 3.27:1 in light mode and
                                    text-xp is 2.2:1 in light — both under 4.5. The
                                    dot is a graphic and only owes 3:1, so the
                                    signal survives and the number stays legible. */}
                                <span className="flex items-center gap-1.5 flex-shrink-0 text-[11px] font-bold tabular-nums text-foreground">
                                    {s.slipping > 0 && (
                                        <span className="flex items-center gap-1" title="already below reliable recall">
                                            <span className="w-1.5 h-1.5 rounded-full bg-streak" />{s.slipping} gone
                                        </span>
                                    )}
                                    {s.falling > 0 && (
                                        <span className="flex items-center gap-1" title={`drops below reliable recall within ${o.days} days`}>
                                            <span className="w-1.5 h-1.5 rounded-full bg-xp" />{s.falling} soon
                                        </span>
                                    )}
                                </span>
                            </li>
                        ))}
                        {o.subjects.length > 3 && (
                            <li className="text-[10px] text-muted-foreground">
                                +{o.subjects.length - 3} more subject{o.subjects.length - 3 === 1 ? "" : "s"}
                            </li>
                        )}
                    </ul>

                    <Link to={createPageUrl("Study?tab=spaced_repetition")}
                        className="mt-3 flex items-center justify-between gap-2 rounded-2xl border-2 border-border bg-secondary/40 p-3 hover:border-streak/50 transition-colors group">
                        <span className="text-xs text-muted-foreground leading-snug">
                            <span className="font-bold text-foreground">{o.atRisk} card{o.atRisk === 1 ? "" : "s"}</span> to hold it,
                            about <span className="font-bold text-foreground">{o.minutes} min</span>.
                        </span>
                        <ArrowRight className="w-4 h-4 text-streak flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
                    </Link>

                    {/* Lapse rate is the one thing the interval genuinely can't
                        express, so it only appears when it says something. */}
                    {o.lapseRate != null && o.lapseRate > 0.2 && (
                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                            className="text-[11px] text-muted-foreground leading-snug mt-2.5">
                            You forget <span className="font-bold text-foreground">{Math.round(o.lapseRate * 100)}%</span> of
                            cards on review. Above about 20% usually means the cards are being memorised
                            rather than understood — shorter cards, one idea each, tend to fix it.
                        </motion.p>
                    )}
                </>
            )}

            <p className="text-[10px] text-muted-foreground leading-snug flex items-start gap-1.5 pt-2.5 mt-2.5 border-t border-border">
                <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
                A projection, not a reading of your memory. It assumes the standard forgetting
                curve and your own review intervals, and assumes you review nothing between now and then.
            </p>
        </div>
    );
}
