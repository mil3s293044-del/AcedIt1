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
 * It is drawn with the same kit as every other board (`src/components/boards/`)
 * — once four people have started, the top three are dealt onto a small table
 * as Ace, King and Queen, and the rest sit on the ledger under it. Under four
 * there is no podium: three places out of three people is everybody, the
 * refusal the League's podium makes.
 */
import React, { useMemo } from "react";
import { motion, useReducedMotion, LayoutGroup, AnimatePresence } from "framer-motion";
import { CalendarClock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import Band from "@/components/shared/Band";
import CardPodium from "@/components/boards/CardPodium";
import LedgerRow from "@/components/boards/LedgerRow";
import useArrival from "@/components/boards/useArrival";
import { REVEAL_MS, PODIUM_SIZE } from "@/lib/boardKit";
import { rankWeek, minutesLabel, sacsSoon, dueLabel } from "@/lib/groups";

const days = (n) => `${n} day${n === 1 ? "" : "s"}`;

export default function GroupWeek({ week, sacs = [], sharingSacs = false, todayIso, soonDays, onToggleSacs, working }) {
    const reduce = useReducedMotion();
    const arriving = useArrival(REVEAL_MS);
    const ranked = useMemo(() => rankWeek(week?.members || []), [week]);
    const soon = useMemo(() => sacsSoon(sacs, todayIso, soonDays), [sacs, todayIso, soonDays]);
    const total = ranked.studied.length + ranked.notStarted;
    const from = ranked.studied.length > PODIUM_SIZE ? PODIUM_SIZE : 0;

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
                        <LayoutGroup id="group-week">
                            {from > 0 && (
                                <div className="mb-3">
                                    <CardPodium size="sm" layoutScope="group" label="Ahead this week"
                                        entries={ranked.studied.slice(0, PODIUM_SIZE).map((m) => ({
                                            key: m.id,
                                            // The same name the ledger prints, so a person moving
                                            // between the table and the list is one person.
                                            name: m.name,
                                            isMe: !!m.me,
                                            figure: { value: m.minutes, format: minutesLabel, quantity: "minutes" },
                                        }))} />
                                </div>
                            )}
                            <div className="relative border-y border-border [&>*:first-child]:border-t-0">
                                <AnimatePresence mode="popLayout">
                                    {ranked.studied.slice(from).map((m, i) => (
                                        <LedgerRow key={m.id} person={m.id} layoutScope="group" moveLane={false} edges="none"
                                            place={m.place} name={m.name} isMe={!!m.me}
                                            index={i} arriving={arriving}
                                            figure={{ value: m.minutes, format: minutesLabel, quantity: "minutes" }}
                                            badges={
                                                <>
                                                    {m.me && <span className="pill bg-primary/15 text-primary text-[10px] flex-shrink-0">You</span>}
                                                    <span className="text-xs text-muted-foreground flex-shrink-0">{days(m.days)}</span>
                                                </>
                                            }
                                            sub={
                                                <div className="mt-1.5 h-1.5 rounded-full bg-secondary overflow-hidden">
                                                    {/* A day of quizzes with no timed minutes is on the list
                                                        and draws NO bar — a sliver would claim minutes it
                                                        does not have. */}
                                                    {m.minutes > 0 && <motion.div className="h-full rounded-full bg-primary origin-left"
                                                        style={{ width: `${Math.max(4, Math.round(m.share * 100))}%` }}
                                                        initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: 1 }}
                                                        transition={{ duration: 0.5, delay: Math.min(0.4, m.place * 0.05) }} />}
                                                </div>
                                            } />
                                    ))}
                                </AnimatePresence>
                            </div>
                        </LayoutGroup>
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
