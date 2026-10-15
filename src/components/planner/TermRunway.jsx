/**
 * TermRunway — the planner's hero: the next SAC's countdown, standing on the
 * eight weeks it sits in.
 *
 * ─── THE COUNTDOWN KEPT ITS VOICE AND LOST ITS TUNNEL VISION ───────────────
 * `SacHero` counted down to ONE date, well: an urgency gradient that warms as
 * the day closes, a fanned hand that thins, Ace's hold tightening, his line.
 * All of that is here, as the header. What it could not do was see the SECOND
 * SAC — a Methods test three weeks out was a row in a list further down, and
 * whether anything had been planned before it was on no screen at all. Its
 * fourteen day-pips are gone; the track under the header is the same distance
 * drawn on the term, where it can sit beside everything else.
 *
 * ─── THE TRACK ─────────────────────────────────────────────────────────────
 * Eight Monday-anchored weeks. Every tracked SAC is a pin on its date; the
 * sessions planned for its subject in its run-up are ticks under the track —
 * filled when done, faint when still to come, hollow when the day passed and
 * nothing happened. A SAC inside a fortnight with no prep planned says so ON
 * the pin, because that is the cheapest thing on the term to change. The
 * rules for all of it are `termRunway.js`'s, and tested there.
 *
 * Tapping a pin moves the week board to that week, which is where planning it
 * happens — the runway shows the term, and the board is where you act on it.
 *
 * ─── IT SCROLLS RATHER THAN SQUASHES ON A PHONE ────────────────────────────
 * Eight weeks across 360px is 45px a week, and two SAC pins in one week would
 * be two overlapping smudges. The track keeps a readable width and scrolls.
 * It needs no scrolling to today: the track STARTS at this week's Monday, so
 * today is always in the first week on screen.
 *
 * Stalks are drawn in one pass and cards in a second, so a stalk from a higher
 * lane runs BEHIND the card below it rather than through it.
 *
 * Ace is CONTENT here, as he was on the old hero: he stands at the end of the
 * countdown and does not talk or follow the student around, so he claims no
 * stage — the rule `aceStage.test.mjs` draws between illustration and host.
 *
 * ─── IT OPENS THE PAGE, AND THE PAGE'S HEADLINE IS THE TRACK'S ─────────────
 * The planner used to open on a headline row — an eyebrow, a two-line sentence
 * about the term, and today's intention beside it — with this underneath. The
 * row was taller on one side than the other, so its eyebrow floated halfway
 * down, and its sentence was the second reading of the term on one screen: the
 * countdown's own line already says how the NEXT one is going. So the runway
 * is the first thing on the page, and `lead` is the heading of the TRACK — the
 * part of this card that is about the term — rather than a block of its own
 * above the card. `aside` is the page's help, at the end of that row.
 *
 * The header and the track pad identically, because they are one card: at
 * different gutters the countdown and the track heading started 4px apart,
 * which is the size of misalignment that reads as a mistake rather than a
 * choice.
 */
import React from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { GraduationCap, BookOpen, Sparkles, Plus, AlertTriangle, Check } from "lucide-react";
import AceBody from "@/components/ace/AceBody";
import { sacBand, fanCards } from "@/lib/sacRunway";
import { sacMood } from "@/lib/aceVoice";
import { fmtDate } from "@/lib/safeDate";
import { createPageUrl } from "@/utils";
import { shortSubject } from "@/lib/subjectShort";
import { LANE_H, STALK_FOOT, hasPrepLine, lanesHeight } from "@/lib/termRunway";

const EASE = [0.16, 1, 0.3, 1];
const daysWord = (d) => (d <= 0 ? "Today" : d === 1 ? "Tomorrow" : `${d} days`);
const shortDate = (iso) => fmtDate(iso, "d MMM");

/** The hand behind the number, thinning as the date closes. Moved from SacHero. */
function CardFan({ count, urgency }) {
    const spread = 13 + urgency * 5;
    const mid = (count - 1) / 2;
    return (
        <svg viewBox="0 0 200 200" aria-hidden="true"
            className="absolute -top-4 -right-6 w-60 h-60 sm:w-80 sm:h-80 pointer-events-none select-none">
            <g transform="translate(168 18)">
                {Array.from({ length: count }, (_, i) => (
                    <g key={i} transform={`rotate(${20 + (i - mid) * spread})`}>
                        <rect x="-30" y="0" width="60" height="132" rx="8"
                            fill="currentColor" className="text-white" fillOpacity="0.08"
                            stroke="currentColor" strokeOpacity="0.22" strokeWidth="1.5" />
                    </g>
                ))}
            </g>
        </svg>
    );
}

function Header({ next, runway }) {
    const reduce = useReducedMotion();
    const band = sacBand(next.daysOut);
    const feel = sacMood(next.daysOut);
    const u = band.urgency;
    const others = runway.sacs.length - 1 + runway.later.length;
    return (
        <div className={`relative overflow-hidden px-5 sm:px-7 pt-6 pb-6 text-white ${band.grad}`}>
            {/* A scrim under the words. White on the brand green is about 2:1,
                and in the dark theme the green is brighter still, so the
                countdown — the largest thing on the page — washed out. It is
                SHADOW, so it is literal black in both themes. */}
            <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-black/25 via-black/10 to-transparent dark:from-black/45 dark:via-black/20" />
            <CardFan count={fanCards(next.daysOut)} urgency={u} />
            <motion.div
                className="absolute right-3 bottom-2 sm:right-8 sm:bottom-3 w-20 sm:w-28 pointer-events-none"
                data-ace-sac={feel.pose}
                animate={reduce ? {} : { y: [0, -4 - u * 4, 0] }}
                transition={reduce ? {} : { duration: 4.4 - u * 2.6, repeat: Infinity, ease: "easeInOut" }}>
                <AceBody className="w-full" pose={feel.pose} title="Ace"
                    tone="fill-slate-900" card="fill-white" cardStroke="stroke-white" />
            </motion.div>

            <div className="relative pr-20 sm:pr-32">
                <p className="text-xs font-bold uppercase tracking-widest text-white/75">
                    {band.label} · next up
                </p>
                <div className="flex items-end gap-x-5 gap-y-1 flex-wrap mt-1">
                    <motion.p className="font-display font-black leading-none tabular-nums"
                        style={{ fontSize: "clamp(2.75rem, 7vw, 4.5rem)" }}
                        initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, ease: EASE }}>
                        {daysWord(next.daysOut)}
                    </motion.p>
                    <div className="mb-1.5 min-w-0">
                        <p className="font-extrabold text-white text-lg leading-tight line-clamp-2">
                            {next.sac.subject_name} — {next.sac.title}
                        </p>
                        <p className="text-sm text-white/80">{fmtDate(next.due, "EEEE d MMMM")}</p>
                    </div>
                </div>
                <p className="text-sm font-bold text-white/95 mt-2 max-w-lg" data-ace-sac-line>{feel.line}</p>

                <div className="flex gap-2 mt-4 flex-wrap">
                    {next.needsPrep && (
                        <Link to={`${createPageUrl("Strategise")}?id=${encodeURIComponent(next.sac.id)}`}
                            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-extrabold bg-white text-slate-900 hover:bg-white/90 transition-colors">
                            <Sparkles className="w-4 h-4" /> Plan its prep
                        </Link>
                    )}
                    <Link to="/Study?tab=exam"
                        className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${band.chip}`}>
                        <GraduationCap className="w-4 h-4" /> Run a timed mock
                    </Link>
                    <Link to="/Study?tab=spaced_repetition"
                        className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${band.chip}`}>
                        <BookOpen className="w-4 h-4" /> Review cards
                    </Link>
                </div>
                {others > 0 && (
                    <p className="text-xs font-bold text-white/80 mt-3">
                        {others} more {others === 1 ? "assessment" : "assessments"} after this one
                        {runway.flagged > (next.needsPrep ? 1 : 0)
                            ? ` · ${runway.flagged - (next.needsPrep ? 1 : 0)} with no prep planned`
                            : ""}
                    </p>
                )}
            </div>
        </div>
    );
}

function EmptyHeader({ onTrack }) {
    return (
        <div className="relative px-5 sm:px-7 pt-6 pb-6 bg-secondary/60 flex items-center gap-4">
            <AceBody className="w-16 sm:w-20 flex-shrink-0" pose="point" title="Ace" />
            <div className="min-w-0">
                <h2 className="font-display font-extrabold text-foreground text-xl">What&apos;s your next SAC?</h2>
                <p className="text-sm text-muted-foreground mt-0.5 max-w-md">
                    Track it and it lands on this runway, with every session you plan for it in the run-up.
                </p>
                <button type="button" onClick={onTrack}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-extrabold bg-primary text-primary-foreground btn-3d">
                    <Plus className="w-4 h-4" /> Track a SAC
                </button>
            </div>
        </div>
    );
}

/** Where a pin's card sits against its date, so the end ones stay on the track. */
const anchorOf = (x) => (x < 0.07 ? "-12%" : x > 0.93 ? "-88%" : "-50%");

/** The stalk, from the track up to its card. */
function Stalk({ s, i, reduce }) {
    return (
        <motion.span aria-hidden="true"
            className={`absolute bottom-0 w-px ${s.needsPrep ? "bg-xp" : "bg-foreground/25"}`}
            style={{ left: `${s.x * 100}%`, height: s.lane * LANE_H + STALK_FOOT, originY: 1 }}
            initial={reduce ? false : { scaleY: 0 }} animate={{ scaleY: 1 }}
            transition={{ duration: 0.4, delay: reduce ? 0 : 0.35 + i * 0.08, ease: EASE }} />
    );
}

function Pin({ s, i, rail, onOpen, reduce }) {
    const next = i === 0;
    const bottom = s.lane * LANE_H + STALK_FOOT;
    return (
            <motion.button type="button" onClick={() => onOpen?.(s.sac)}
                aria-label={`${s.sac.subject_name} ${s.sac.title}, ${daysWord(s.daysOut)}. ${s.planned} prep ${s.planned === 1 ? "session" : "sessions"} planned. Show that week.`}
                className={`absolute w-[8.5rem] text-left rounded-xl bg-surface border overflow-hidden flex
                    shadow-soft hover:shadow-md hover:-translate-y-0.5 transition-[box-shadow,transform]
                    ${next ? "border-foreground/70 ring-2 ring-foreground/10" : s.needsPrep ? "border-xp border-dashed" : "border-border"}`}
                style={{ left: `${s.x * 100}%`, bottom, translateX: anchorOf(s.x) }}
                initial={reduce ? false : { opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 340, damping: 24, delay: 0.45 + i * 0.08 }}>
                <span aria-hidden="true" className={`w-1 flex-shrink-0 ${rail}`} />
                <span className="min-w-0 flex-1 px-2 py-1.5">
                    <span className="flex items-center justify-between gap-1">
                        <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                            {(s.sac.assessment_type || "sac").toUpperCase()}
                        </span>
                        <span className={`text-[10px] font-black tabular-nums ${s.daysOut <= 3 ? "text-streak" : "text-foreground/70"}`}>
                            {s.daysOut <= 0 ? "today" : `${s.daysOut}d`}
                        </span>
                    </span>
                    <span className="block text-xs font-extrabold text-foreground leading-tight truncate">{shortSubject(s.sac.subject_name)}</span>
                    <span className="block text-[10px] text-muted-foreground leading-tight truncate">{s.sac.title}</span>
                    {s.needsPrep ? (
                        <span className="mt-1 flex items-center gap-1 text-[10px] font-bold text-xp">
                            <AlertTriangle className="w-3 h-3" /> No prep planned
                        </span>
                    ) : hasPrepLine(s) ? (
                        <span className="mt-1 flex items-center gap-1 text-[10px] font-bold text-muted-foreground tabular-nums">
                            <Check className="w-3 h-3 text-primary" /> {s.done}/{s.planned} prep done
                        </span>
                    ) : null}
                </span>
            </motion.button>
    );
}

export default function TermRunway({ runway, railClassFor = () => "bg-chart-3", onOpen, onTrack, lead = null, aside = null }) {
    const reduce = useReducedMotion();
    const next = runway?.next || null;

    if (!runway) return null;
    // The next SAC can sit past the eighth week, so "is there a header" and
    // "are there pins" are separate questions.
    const lanesH = lanesHeight(runway.sacs);

    return (
        <section data-term-runway className="relative overflow-hidden rounded-3xl border border-border bg-surface shadow-soft">
            {next ? <Header next={next} runway={runway} /> : <EmptyHeader onTrack={onTrack} />}

            <div className="px-5 sm:px-7 pt-5 pb-6">
                <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="min-w-0">
                        <p className="stat-label">The next eight weeks</p>
                        {lead && (
                            <h1 className="mt-1 max-w-3xl font-display font-extrabold tracking-tight text-foreground
                                text-xl sm:text-2xl leading-snug text-balance">
                                {lead}
                            </h1>
                        )}
                    </div>
                    {aside && <div className="flex-shrink-0">{aside}</div>}
                </div>

                <div className="overflow-x-auto overscroll-x-contain -mx-5 sm:mx-0 px-5 sm:px-0 pb-1">
                    <div className="relative min-w-[680px]">
                        {/* Pins, in lanes above the track. */}
                        <div className="relative" style={{ height: lanesH }}>
                            {runway.sacs.map((s, i) => <Stalk key={s.id} s={s} i={i} reduce={reduce} />)}
                            {runway.sacs.map((s, i) => (
                                <Pin key={s.id} s={s} i={i} rail={railClassFor(s.sac.subject_name)}
                                    onOpen={onOpen} reduce={reduce} />
                            ))}
                        </div>

                        {/* The track: weeks as alternating bands, the elapsed part
                            of this week filled, a dot on every due date. */}
                        <div className="relative h-3 rounded-full overflow-hidden bg-secondary">
                            {runway.weeks.map((w, k) => (
                                <span key={w.start} aria-hidden="true"
                                    className={`absolute inset-y-0 ${k % 2 ? "bg-foreground/[0.05]" : ""}`}
                                    style={{ left: `${w.x * 100}%`, width: `${w.width * 100}%` }} />
                            ))}
                            <motion.span aria-hidden="true" className="absolute inset-y-0 left-0 bg-foreground/15"
                                style={{ originX: 0, width: `${runway.todayX * 100}%` }}
                                initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: 1 }}
                                transition={{ duration: 0.6, ease: EASE }} />
                        </div>
                        {runway.sacs.map((s) => (
                            <span key={s.id} aria-hidden="true"
                                className={`absolute w-3.5 h-3.5 -ml-[7px] rounded-full ring-[3px] ring-surface ${railClassFor(s.sac.subject_name)}`}
                                style={{ left: `${s.x * 100}%`, top: lanesH - 2 }} />
                        ))}

                        {/* Today: a hairline down through the track and the
                            ticks, BEHIND them, and its label in the week row —
                            where it stands in for "This week", since it can
                            only ever be in the first one. Drawn first so a
                            tick on today's date sits on top of the line. */}
                        <motion.span aria-hidden="true" className="absolute w-px bg-foreground/60"
                            style={{ left: `${runway.todayX * 100}%`, top: lanesH - 6, height: 44 }}
                            initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }}
                            transition={{ delay: reduce ? 0 : 0.5 }} />

                        {/* Prep ticks, under the track. */}
                        <div className="relative h-5 mt-2">
                            {runway.ticks.map((t, i) => (
                                <motion.span key={t.id}
                                    title={`${t.subject} prep · ${shortDate(t.day)} · ${t.done ? "done" : t.missed ? "did not happen" : "planned"}`}
                                    className={`absolute top-1 w-2.5 h-2.5 -ml-[5px] rounded-full
                                        ${t.missed ? "border-[1.5px] border-foreground/40 bg-transparent"
                                            : `${railClassFor(t.subject)} ${t.done ? "" : "opacity-35"}`}`}
                                    style={{ left: `${t.x * 100}%` }}
                                    initial={reduce ? false : { scale: 0 }} animate={{ scale: 1 }}
                                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 20, delay: 0.7 + i * 0.03 }} />
                            ))}
                        </div>

                        {/* Week labels, with Today in place of the first. */}
                        <div className="relative h-5 mt-1">
                            <motion.span
                                className="absolute top-0 rounded-full bg-foreground text-background text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5"
                                style={{ left: `${runway.todayX * 100}%`, translateX: "-50%" }}
                                initial={reduce ? false : { opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: reduce ? 0 : 0.5 }}>
                                Today
                            </motion.span>
                            {runway.weeks.slice(1).map((w, k) => (
                                <span key={w.start}
                                    className="absolute top-0.5 text-[10px] tabular-nums whitespace-nowrap text-muted-foreground"
                                    // On a Saturday or Sunday the Today pill reaches
                                    // into next week, so that label steps aside.
                                    style={{ left: k === 0
                                        ? `max(calc(${w.x * 100}% + 4px), calc(${runway.todayX * 100}% + 28px))`
                                        : `calc(${w.x * 100}% + 4px)` }}>
                                    {k === 0 ? "Next week" : shortDate(w.start)}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* The key sits UNDER the chart it explains, beside what is
                    past the chart's end — a caption row rather than a second
                    header competing with the heading above. A key to marks
                    that are not on the track is a key to nothing. */}
                {(runway.later.length > 0 || runway.ticks.length > 0) && (
                    <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <p className="text-xs text-muted-foreground min-w-0">
                            {runway.later.length > 0 && (
                                <>
                                    {runway.later.length} more after {shortDate(runway.to)}:{" "}
                                    {runway.later.slice(0, 3).map((s) => `${s.sac.subject_name} ${shortDate(s.due)}`).join(" · ")}
                                    {runway.later.length > 3 ? " …" : ""}
                                </>
                            )}
                        </p>
                        {runway.ticks.length > 0 && (
                            <span className="hidden sm:flex items-center gap-3 text-[10px] font-semibold text-muted-foreground">
                                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-foreground/70" /> prep done</span>
                                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-foreground/25" /> planned</span>
                                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full border border-foreground/40" /> missed</span>
                            </span>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}
