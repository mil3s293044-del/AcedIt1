/**
 * WeekPace — this week's study against what this student usually does by now.
 *
 * ─── What it replaces ───────────────────────────────────────────────────────
 * "Cleared this week": a leaning pile of cards over the line "4 sessions · 27m
 * across 3 days". Two things were wrong with it and only one was visible.
 *
 * The visible one: it is a LOG. It reads identically whether that is a strong
 * week or a collapse, so the only thing a student can do with it is nod. The
 * pile was a nice object and it was a picture of a count — the count was
 * already written underneath it in words.
 *
 * The invisible one, which is worse: it read `study_sessions` alone, and only
 * quizzes and the activity tracker write there. Every pomodoro, active recall,
 * blurting and spaced-repetition session goes to `study_techniques`. So a
 * student who spent their whole week on the Study page was shown their
 * QUIZZES and told that was the week. See studyLog.js — that is the same trap
 * the ATAR's planning component fell into, written up in CLAUDE.md, repeated
 * on the panel next to it.
 *
 * ─── Against themselves, not a target ───────────────────────────────────────
 * The app has no basis for saying a student should do ninety minutes a day, so
 * it does not. Their own median week, cut at the same weekday, is a bar it can
 * actually justify — and it means something in week one and in week thirty
 * without anyone choosing a number.
 *
 * With too little history there is NO comparison and the panel says so rather
 * than inventing one. A first-fortnight account gets its minutes and a line
 * about the comparison arriving, which is the honest version of this panel and
 * still more use than a pile.
 *
 * ─── And it absorbed the subjects hand ──────────────────────────────────────
 * "Your subjects" was a fan of playing cards whose corner had, in turn, held
 * the deck's card count, the days since you last opened it, and finally the
 * usual weekly hours — at which point it was answering this panel's question
 * on a different object, two panels apart, with the same number. So the hand
 * went and the breakdown came here, where the total it adds up to is printed
 * directly above it.
 *
 * The rows are BARS AGAINST THE BIGGEST SUBJECT, not against a target. The
 * point is the SHAPE of a week — which subject gets the hours and which one is
 * living on scraps — and the app has no business saying what the split ought
 * to be. Least first, because the bottom of that list is the thing worth
 * knowing.
 */
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowRight, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { weekPace, usualWeeklyMinutes, MIN_BASELINE_WEEKS } from "@/lib/studyLog";
import { usualOrder, usualLabel, THIN_WEEK_MINUTES } from "@/lib/usualWeek";
import { colorFor } from "@/components/cards/cardIdentity";

const DAY_NAME = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const fmt = (m) => {
    const n = Math.max(0, Math.round(m || 0));
    if (n < 60) return `${n}m`;
    const h = Math.floor(n / 60);
    const r = n % 60;
    return r ? `${h}h ${r}m` : `${h}h`;
};

/**
 * The bar. This week's minutes as a fill, their usual as a marked line across
 * it — so "ahead" and "behind" are a position rather than a word.
 *
 * The track is scaled to whichever of the two is larger, with headroom, so the
 * marker is never at the very end and the fill never runs off. Scaling to the
 * baseline alone would peg a big week at 100% and hide how far ahead it is.
 */
function PaceBar({ minutes, baseline }) {
    const reduce = useReducedMotion();
    const top = Math.max(minutes, baseline) * 1.15 || 1;
    const fill = Math.min(100, (minutes / top) * 100);
    const mark = Math.min(100, (baseline / top) * 100);
    const ahead = minutes >= baseline;

    return (
        <div className="relative h-2.5 rounded-full bg-secondary overflow-hidden mt-3">
            <motion.span
                className={`absolute inset-y-0 left-0 rounded-full ${
                    ahead ? "bg-primary" : "bg-xp"}`}
                initial={reduce ? false : { width: 0 }}
                animate={{ width: `${fill}%` }}
                transition={reduce ? { duration: 0 } : { duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
            />
            {/* The marker sits ON TOP of the fill, in ink rather than in the
                card's own background: drawn in the background colour it
                vanished the moment the fill had not reached it, which is
                exactly the case the panel exists to show. */}
            <span aria-hidden="true"
                className="absolute inset-y-0 w-[3px] rounded-full bg-foreground/55"
                style={{ left: `calc(${mark}% - 1.5px)` }} />
        </div>
    );
}

export default function WeekPace({ events = [], subjects = [], className = "" }) {
    const pace = weekPace(events);
    const today = DAY_NAME[pace.dayIndex];

    // The per-subject split, least first. Subjects with no history at all are
    // dropped rather than listed at zero: a subject added yesterday has not
    // been starved, and a row reading "0m/wk" against it is an accusation the
    // data does not support.
    const usual = usualWeeklyMinutes(events);
    const rows = usualOrder(
        subjects
            .filter((name) => usual.has(name))
            .map((name) => ({ subject: name, usualMinutes: usual.get(name) })),
        (r) => r.usualMinutes,
    );
    const most = rows.reduce((m, r) => Math.max(m, r.usualMinutes), 0);

    if (pace.minutes === 0 && pace.baseline == null) {
        return (
            <div data-week-pace="0" className={`card-soft on-table p-5 ${className}`}>
                <p className="stat-label mb-3">Your study week</p>
                <div className="flex flex-col items-center text-center gap-3 py-6">
                    <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center
                        justify-center border border-primary/10">
                        <Brain className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <p className="font-bold text-foreground text-sm">Nothing logged yet</p>
                        <p className="text-xs text-muted-foreground mt-0.5 max-w-xs">
                            Once there are a couple of weeks behind you, this shows the
                            current one against your usual, and where the hours go.
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

    const ahead = pace.delta != null && pace.delta >= 0;

    return (
        <div data-week-pace={pace.minutes} className={`card-soft on-table p-5 lg:p-6 ${className}`}>
            <div className="flex items-baseline justify-between gap-3 mb-4">
                <p className="stat-label">Your study week</p>
                <Link to={createPageUrl("Analytics")}
                    className="text-[11px] font-bold text-muted-foreground hover:text-foreground
                        underline underline-offset-2">
                    View all
                </Link>
            </div>

            {/* STACKED AT EVERY WIDTH, deliberately. This panel sits in one
                half of a two-column row inside the page's own two-column grid,
                so at the viewport where a `lg:` split would fire the panel
                itself is about 500px wide and each column would be 250 — the
                headline and the bar do not fit in that. Tailwind breakpoints
                are viewport-wide and not element-wide, which is the same trap
                the streak panel beside this one records in its own comment. */}
            <div className="space-y-5">
                <div>
                    <p className="font-display font-extrabold text-foreground leading-none"
                        style={{ fontSize: "clamp(2.25rem, 6vw, 3.25rem)" }}>
                        {fmt(pace.minutes)}
                    </p>

                    {pace.baseline != null ? (
                        <>
                            <PaceBar minutes={pace.minutes} baseline={pace.baseline} />
                            {/* The comparison in words as well as in the bar,
                                because the bar cannot say WHICH weekday it
                                stopped at, and "behind" without "by Wednesday"
                                is a different claim. */}
                            <p className="text-[13px] leading-relaxed mt-2.5">
                                <span className={`font-bold ${ahead ? "text-primary" : "text-xp"}`}>
                                    {ahead ? "Ahead of" : "Behind"} your usual
                                </span>
                                <span className="text-muted-foreground">
                                    {" "}— you are normally at {fmt(pace.baseline)} by {today}.
                                </span>
                            </p>
                        </>
                    ) : (
                        <p className="text-[13px] text-muted-foreground leading-relaxed mt-3">
                            {pace.sessions} session{pace.sessions === 1 ? "" : "s"} across{" "}
                            {pace.days} day{pace.days === 1 ? "" : "s"}. Your usual pace shows
                            up here after {MIN_BASELINE_WEEKS} weeks.
                        </p>
                    )}

                    <Link to={createPageUrl("Study")}
                        className="inline-flex items-center gap-1 text-[11px] font-bold
                            text-primary hover:underline mt-3">
                        {ahead ? "Keep it going" : "Put some time in"}
                        <ArrowRight className="w-3 h-3" />
                    </Link>
                </div>

                {/* WHERE THE HOURS GO. Nothing here is a target: the bars are
                    relative to the subject that gets the most, so the row that
                    matters is the short one at the bottom. */}
                <div>
                    {rows.length > 0 ? (
                        <>
                            <p className="text-[11px] font-bold uppercase tracking-wider
                                text-muted-foreground/70 mb-2.5">
                                A normal week
                            </p>
                            <ul className="space-y-2">
                                {rows.slice(0, 6).map((r) => {
                                    const tone = colorFor(r.subject);
                                    const thin = r.usualMinutes <= THIN_WEEK_MINUTES;
                                    const pct = most > 0
                                        ? Math.max(2, (r.usualMinutes / most) * 100)
                                        : 2;
                                    return (
                                        <li key={r.subject} data-usual-row={r.subject}>
                                            <div className="flex items-baseline justify-between gap-3">
                                                <span className="text-[12px] font-bold text-foreground
                                                    truncate">{r.subject}</span>
                                                <span className={`text-[11px] font-bold tabular-nums
                                                    flex-shrink-0 ${
                                                    thin ? "text-streak" : "text-muted-foreground"}`}>
                                                    {usualLabel(r.usualMinutes)}
                                                </span>
                                            </div>
                                            <span className="block h-1.5 rounded-full bg-secondary
                                                overflow-hidden mt-1">
                                                <span className="block h-full rounded-full"
                                                    style={{ width: `${pct}%`, background: tone }} />
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </>
                    ) : (
                        <div className="h-full flex flex-col justify-center">
                            <p className="text-[11px] font-bold uppercase tracking-wider
                                text-muted-foreground/70 mb-1.5">
                                A normal week
                            </p>
                            <p className="text-[13px] text-muted-foreground leading-relaxed">
                                After {MIN_BASELINE_WEEKS} weeks this shows what each subject
                                usually gets — the one living on scraps is the useful half of
                                that.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
