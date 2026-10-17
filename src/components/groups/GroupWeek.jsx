/**
 * GroupWeek — who has been locking in since Monday, and what is coming up.
 *
 * It LEADS the group, because it is the one thing a group knows that nothing
 * else in the app does: how the people you actually sit with are going this
 * week. The minutes are the COUNTED ones (`countableStudyMinutes`, server
 * side) on the league's own Monday, so this can never tell a student a
 * different week from the board one tab away.
 *
 * Somebody who has not started is COUNTED and never NAMED. "Three haven't
 * started yet" is a fact about the group; a list of who is a list of who to
 * have a go at, on a page their whole class can open.
 *
 * The rows are read, not pressed, so they are a ruled list and not cards —
 * Progress's rule: a bordered, elevated box is something you do.
 */
import React, { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CalendarClock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import Band from "@/components/shared/Band";
import InitialAvatar from "@/components/shared/InitialAvatar";
import { rankWeek, minutesLabel, sacsSoon, dueLabel } from "@/lib/groups";

const days = (n) => `${n} day${n === 1 ? "" : "s"}`;

export default function GroupWeek({ week, sacs = [], sharingSacs = false, todayIso, soonDays, onToggleSacs, working }) {
    const reduce = useReducedMotion();
    const ranked = useMemo(() => rankWeek(week?.members || []), [week]);
    const soon = useMemo(() => sacsSoon(sacs, todayIso, soonDays), [sacs, todayIso, soonDays]);
    const total = ranked.studied.length + ranked.notStarted;

    return (
        <Band title="This week" aside={<span className="text-xs font-bold text-muted-foreground whitespace-nowrap">Since Monday</span>}>
            <div data-group-block="week">
                {ranked.studied.length > 0 ? (
                    <>
                        <p className="flex items-baseline gap-2 flex-wrap mb-3">
                            <span className="font-display text-3xl font-extrabold tabular-nums text-foreground">{minutesLabel(ranked.total)}</span>
                            <span className="text-sm text-muted-foreground">
                                together · {ranked.studied.length} of {total} {ranked.studied.length === 1 ? "has" : "have"} started
                            </span>
                        </p>
                        <ol className="divide-y divide-border border-y border-border">
                            {ranked.studied.map((m) => (
                                <li key={m.id}
                                    className={`grid grid-cols-[1.5rem_2.25rem_minmax(0,1fr)_4.5rem] items-center gap-3 py-2.5 ${m.me ? "bg-primary/5" : ""}`}>
                                    <span className="font-display font-extrabold text-muted-foreground text-right tabular-nums">{m.place}</span>
                                    <InitialAvatar name={m.name} size="sm" />
                                    <div className="min-w-0">
                                        <p className="flex items-center gap-2 min-w-0">
                                            <span className="font-bold text-foreground truncate">{m.name}</span>
                                            {m.me && <span className="pill bg-primary/15 text-primary text-[10px] flex-shrink-0">You</span>}
                                            <span className="text-xs text-muted-foreground flex-shrink-0">{days(m.days)}</span>
                                        </p>
                                        <div className="mt-1.5 h-1.5 rounded-full bg-secondary overflow-hidden">
                                            {/* A day of quizzes with no timed minutes is on the list
                                                and draws NO bar — a sliver would claim minutes it
                                                does not have. */}
                                            {m.minutes > 0 && <motion.div className="h-full rounded-full bg-primary origin-left"
                                                style={{ width: `${Math.max(4, Math.round(m.share * 100))}%` }}
                                                initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: 1 }}
                                                transition={{ duration: 0.5, delay: Math.min(0.4, m.place * 0.05) }} />}
                                        </div>
                                    </div>
                                    <span className="font-display font-extrabold text-foreground text-right tabular-nums">{minutesLabel(m.minutes)}</span>
                                </li>
                            ))}
                        </ol>
                        {(ranked.notStarted > 0 || !ranked.meStarted) && (
                            <p className="text-sm text-muted-foreground mt-3">
                                {ranked.notStarted > 0 && `${ranked.notStarted} ${ranked.notStarted === 1 ? "hasn't" : "haven't"} started yet this week.`}
                                {!ranked.meStarted && " Your first session puts you on here."}
                            </p>
                        )}
                    </>
                ) : (
                    <p className="text-sm text-muted-foreground py-2">
                        Nothing logged since Monday yet. The first session puts you at the top.
                    </p>
                )}

                {/* ── Coming up ─────────────────────────────────────────── */}
                <div className="mt-5" data-group-block="sacs">
                    {soon.length > 0 && (
                        <ul className="space-y-1.5 mb-3">
                            {soon.map((s, i) => (
                                <li key={`${s.name}-${s.due}-${i}`} className="flex items-center gap-2.5 text-sm">
                                    <CalendarClock className={`w-4 h-4 flex-shrink-0 ${s.days <= 3 ? "text-streak" : "text-muted-foreground"}`} aria-hidden />
                                    <span className="min-w-0 truncate">
                                        <span className="font-bold text-foreground">{s.me ? "You" : s.name}</span>
                                        <span className="text-muted-foreground"> · {[s.subject, s.kind].filter(Boolean).join(" ")}</span>
                                    </span>
                                    <span className={`ml-auto flex-shrink-0 font-bold ${s.days <= 3 ? "text-streak" : "text-foreground"}`}>{dueLabel(s.days)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                    <label className="flex items-start gap-3 rounded-2xl bg-secondary/60 px-4 py-3 cursor-pointer">
                        <Switch checked={sharingSacs} disabled={working} onCheckedChange={(v) => onToggleSacs?.(v)} className="mt-0.5" />
                        <span className="min-w-0">
                            <span className="block text-sm font-bold text-foreground">Show my SAC dates to this group</span>
                            <span className="block text-xs text-muted-foreground mt-0.5">
                                The subject and the day, never what you called it. Only this group, and off until you turn it on.
                            </span>
                        </span>
                    </label>
                </div>
            </div>
        </Band>
    );
}
