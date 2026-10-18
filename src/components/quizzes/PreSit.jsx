/**
 * PreSit — the table a quiz is laid on before you sit it.
 *
 * Tapping a pack used to open a pop-up asking "How do you want to take this
 * quiz?" with two tiles, and the SAC tile opened a SECOND screen with the
 * clock. So the first thing a student met after choosing a quiz was a question
 * about modes, with nothing on screen about the quiz they had just chosen —
 * how long it is, what it is worth, how they did last time.
 *
 * This is one sheet that says all of that and then asks once:
 *
 *   the card       the quiz's own deck face — rank is your best, so a never-sat
 *                  quiz is a two, which is the card the results will turn
 *   the paper      questions, MARKS and about how long (`paperFacts`, the same
 *                  arithmetic the generator's footer promised)
 *   your history   best, the last sit and when, or that you have not sat it
 *   the sit        Practice or Timed SAC, and the SAC clock is set right here
 *
 * ─── THE SAC PROMISES ONLY WHAT THE PLAYER DOES ─────────────────────────────
 * The old confirm screen said "per-question feedback is turned off until you
 * finish" and nothing in the player checked for a SAC, so multiple choice was
 * marked as you went in exam mode too. The player holds every verdict to the
 * end in a SAC now, and this sheet says so; the line and the behaviour are
 * checked together in quizSit.test.mjs.
 */
import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowRight, Timer, BookOpen } from "lucide-react";
import PlayingCard from "@/components/cards/PlayingCard";
import { suitFor } from "@/components/cards/cardIdentity";
import { paperFacts, sitHistory, agoLabel, SAC_MIN_MINUTES } from "@/lib/quizSit";
import { MINUTES_PER_MARK } from "@/lib/quizSetup";

const MINUTE_STEP = 5;
const MINUTE_MIN = 5;
const MINUTE_MAX = 180;

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function Figure({ value, label }) {
    return (
        <div className="min-w-0">
            <p className="font-display font-extrabold text-xl sm:text-2xl text-foreground tabular-nums leading-none">{value}</p>
            <p className="stat-label mt-1">{label}</p>
        </div>
    );
}

function ModeTile({ id, active, onPick, icon: Icon, title, children, aside }) {
    return (
        <div role="radio" aria-checked={active} tabIndex={0} data-mode={id}
            onClick={() => onPick(id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(id); } }}
            className={`w-full text-left rounded-2xl border-2 px-4 py-3.5 cursor-pointer transition-colors
                focus:outline-none focus-visible:ring-2 focus-visible:ring-ring
                ${active ? "border-primary bg-primary/[0.06]" : "border-border hover:border-primary/40"}`}>
            <div className="flex items-start gap-3">
                <span className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 grid place-items-center
                    ${active ? "border-primary" : "border-muted-foreground/40"}`} aria-hidden="true">
                    {active && <span className="w-2.5 h-2.5 rounded-full bg-primary" />}
                </span>
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground flex items-center gap-1.5">
                        <Icon className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                        {title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{children}</p>
                </div>
                {aside}
            </div>
        </div>
    );
}

/**
 * `onStart({ mode, timeLimitMs })` — mode is "standard" or "sac"; the clock is
 * null for practice. `tone` is the subject's colour.
 */
export default function PreSit({ quiz, attempts = [], tone, open, onCancel, onStart }) {
    const facts = useMemo(() => paperFacts(quiz), [quiz]);
    const history = useMemo(() => sitHistory(quiz, attempts), [quiz, attempts]);
    const [mode, setMode] = useState("standard");
    const [minutes, setMinutes] = useState(facts.sacMinutes);

    // A different quiz is a different paper: reset the choice and the clock,
    // or the second quiz opened starts on the first one's allowance.
    useEffect(() => { setMode("standard"); setMinutes(facts.sacMinutes); }, [quiz?.id, facts.sacMinutes]);

    if (!quiz) return null;
    const best = history.best == null ? null : Math.round(history.best);
    const nudge = (d) => setMinutes((m) => Math.min(MINUTE_MAX, Math.max(MINUTE_MIN, m + d)));

    const kinds = [
        facts.mcq ? `${facts.mcq} multiple choice` : null,
        facts.written ? `${facts.written} written` : null,
        facts.multipart ? plural(facts.multipart, "in parts", "in parts") : null,
    ].filter(Boolean).join(" · ");

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel?.(); }}>
            <DialogContent data-presit className="max-w-lg p-0 gap-0 overflow-hidden rounded-3xl bg-surface">
                {/* ── The quiz ─────────────────────────────────────────────── */}
                <div className="px-5 sm:px-6 pt-6 pb-5 flex gap-4 sm:gap-5 items-start">
                    <div className="w-[4.5rem] sm:w-20 aspect-[2.5/3.5] flex-shrink-0" aria-hidden="true">
                        <PlayingCard rank={history.rank} suit={suitFor(quiz.subject)} tone={tone} pips
                            smallIndices watermark={false} className="w-full h-full shadow-soft" />
                    </div>
                    <div className="min-w-0 flex-1 pr-6">
                        <p className="stat-label truncate">
                            {[quiz.subject, quiz.difficulty].filter(Boolean).join(" · ")}
                        </p>
                        <DialogTitle className="font-display font-extrabold text-lg sm:text-xl text-foreground leading-snug mt-1">
                            {quiz.title}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground mt-1.5 leading-snug">
                            {history.last
                                ? <>Best <span className="font-bold text-foreground">{best}%</span>
                                    {/* The last sit only when it says something the
                                        best does not — "best 75% · last 75%" is one
                                        number printed twice. */}
                                    {history.last.score === best
                                        ? `, ${history.sits > 1 ? "set" : "sat"} ${agoLabel(history.last.days)}`
                                        : ` · last sat ${agoLabel(history.last.days)} at ${history.last.score}%`}
                                    {history.sits > 1 ? ` · ${plural(history.sits, "sit")}` : ""}</>
                                : history.sits > 0
                                    ? "Sat before, but the marking never came back."
                                    : "Not sat yet. Your first sit sets this card."}
                        </DialogDescription>
                    </div>
                </div>

                {/* ── The paper ────────────────────────────────────────────── */}
                <div className="px-5 sm:px-6 pb-5">
                    <div className="grid grid-cols-3 gap-3 border-y border-border py-4">
                        <Figure value={facts.questions} label={facts.questions === 1 ? "question" : "questions"} />
                        <Figure value={facts.marks} label={facts.marks === 1 ? "mark" : "marks"} />
                        <Figure value={`~${facts.minutes}`} label="minutes" />
                    </div>
                    {kinds && <p className="text-xs text-muted-foreground mt-2.5">{kinds}</p>}
                </div>

                {/* ── The sit ──────────────────────────────────────────────── */}
                <div role="radiogroup" aria-label="How to sit it" className="px-5 sm:px-6 pb-5 space-y-2.5">
                    <ModeTile id="standard" active={mode === "standard"} onPick={setMode} icon={BookOpen} title="Practice">
                        Your own pace. Multiple choice is marked as you go, written answers at the end.
                    </ModeTile>
                    <ModeTile id="sac" active={mode === "sac"} onPick={setMode} icon={Timer} title="Timed SAC"
                        aside={mode === "sac" && (
                            <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                <button type="button" onClick={() => nudge(-MINUTE_STEP)} disabled={minutes <= MINUTE_MIN}
                                    aria-label={`${MINUTE_STEP} minutes less`}
                                    className="w-7 h-7 rounded-lg border-2 border-border font-bold leading-none
                                        hover:bg-secondary disabled:opacity-30">−</button>
                                <span className="w-11 text-center font-display font-extrabold tabular-nums text-foreground"
                                    data-sac-minutes={minutes}>{minutes}m</span>
                                <button type="button" onClick={() => nudge(MINUTE_STEP)} disabled={minutes >= MINUTE_MAX}
                                    aria-label={`${MINUTE_STEP} minutes more`}
                                    className="w-7 h-7 rounded-lg border-2 border-border font-bold leading-none
                                        hover:bg-secondary disabled:opacity-30">+</button>
                            </div>
                        )}>
                        Exam conditions: a {minutes}-minute clock, nothing marked until you hand it in, and it hands itself in when time runs out.
                    </ModeTile>
                </div>

                <div className="px-5 sm:px-6 py-4 border-t border-border bg-secondary/30 flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground min-w-0">
                        {mode === "sac"
                            ? `Set at ${MINUTES_PER_MARK} min a mark, never under ${SAC_MIN_MINUTES}`
                            : "You can stop and save partway"}
                    </p>
                    <Button data-presit-start
                        onClick={() => onStart?.({ mode, timeLimitMs: mode === "sac" ? minutes * 60000 : null })}
                        className="btn-3d gap-2 bg-primary hover:bg-primary/90 text-white rounded-xl flex-shrink-0">
                        {mode === "sac" ? `Start the SAC` : "Start practice"} <ArrowRight className="w-4 h-4" />
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
