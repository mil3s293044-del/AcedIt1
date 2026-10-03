/**
 * SubjectSplit — where the hours went, and what came back for them.
 *
 * ─── Why this replaced four charts ──────────────────────────────────────────
 * Analytics drew Daily Study Time, Technique Breakdown, Time Per Subject and
 * Quiz Avg by Subject as four separate panels. All four were true; none of
 * them ended anywhere. A student looking at a stacked bar of their week does
 * not learn anything they can act on, because the question they actually have
 * is comparative — "am I neglecting Legal?" — and that needs the subjects
 * beside each other with what the time BOUGHT next to it.
 *
 * So it is one row per subject: the hours, drawn to one scale so the shares
 * are readable without percentages, the quiz average those hours produced,
 * what is sitting ready, and the way into that subject. The link is what makes
 * it a panel rather than a readout — /SubjectHub is the screen that answers
 * "and what do I do about Legal", and it already exists.
 *
 * ─── THE AVERAGE COMES FROM `quizzingSummary`, NEVER A FOURTH MEAN ──────────
 * The quiz average had four different answers across seven surfaces, and the
 * scan in `quizDeck.test.mjs` exists because the fourth was found by it rather
 * than by reading. The three corrections — the adjusted score, dropping
 * unscored attempts, excluding retries — are all inside that function, so a
 * per-subject average is the same function over a filtered list and not a
 * reduce written here.
 *
 * ─── AND IT REPORTS, IT DOES NOT GRADE ──────────────────────────────────────
 * No subject is called neglected. Time split across six subjects is a choice a
 * student makes with information this app does not have — a SAC next week, a
 * subject they are already comfortable in — so the panel puts the shares in
 * front of them and says nothing about whether they are right. The one line it
 * does print is arithmetic they can check: which subject has had the least
 * time, and only when there is enough logged for that to mean anything.
 */
import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { createPageUrl } from "@/utils";
import { quizzingSummary } from "@/lib/quizDeck";
import { isReady } from "@/lib/due";
import { subjectColor } from "@/components/cards/cardIdentity";

/** Below this there is not enough logged for a share to mean anything. */
export const MIN_SPLIT_MINUTES = 60;

const fmt = (m) => {
    if (!m) return "0m";
    const h = Math.floor(m / 60), mm = Math.round(m % 60);
    return h === 0 ? `${mm}m` : mm === 0 ? `${h}h` : `${h}h ${mm}m`;
};

export default function SubjectSplit({ events = [], quizzes = [], attempts = [], cards = [], today }) {
    const rows = useMemo(() => {
        const by = new Map();
        const touch = (name) => {
            if (!by.has(name)) by.set(name, { subject: name, minutes: 0, ready: 0, attempts: [] });
            return by.get(name);
        };

        for (const e of events) {
            if (!e?.subject) continue;
            touch(e.subject).minutes += e.minutes || 0;
        }
        for (const c of cards) {
            const name = c?.subject_name;
            if (!name) continue;
            if (isReady(c, today)) touch(name).ready += 1;
        }
        // Attempts are keyed to a quiz, and the quiz is what carries the
        // subject — an attempt row has only the title.
        const subjectOf = new Map((quizzes || []).map((q) => [q.id, q.subject]).filter(([, s]) => s));
        for (const a of attempts) {
            const name = subjectOf.get(a?.quiz_id);
            if (!name) continue;
            touch(name).attempts.push(a);
        }

        return [...by.values()]
            .map((r) => {
                const q = quizzingSummary([], r.attempts);
                return { ...r, avg: q.avgScore, avgOver: q.avgOver, trend: q.trend };
            })
            // A subject with nothing logged and nothing ready is not a row —
            // it is a subject the student picked and has not opened, which
            // /Subjects says properly and this panel would say as a zero.
            .filter((r) => r.minutes > 0 || r.ready > 0 || r.attempts.length > 0)
            .sort((a, b) => b.minutes - a.minutes || a.subject.localeCompare(b.subject));
    }, [events, quizzes, attempts, cards, today]);

    const total = rows.reduce((n, r) => n + r.minutes, 0);
    // The scale is the BIGGEST subject rather than the total, so the longest
    // bar fills the track and the rest are read against it. Against the total,
    // six subjects all draw as slivers and the comparison this panel exists
    // for is invisible.
    const scale = rows.reduce((m, r) => Math.max(m, r.minutes), 0);

    if (!rows.length) return null;

    // Arithmetic the student can check, and only when it is real: under an
    // hour of logged time across everything, "least time" is noise.
    const leanest = total >= MIN_SPLIT_MINUTES && rows.length > 1
        ? rows[rows.length - 1] : null;

    return (
        <section className="card-soft p-5">
            <div className="flex items-baseline justify-between gap-3 mb-1">
                <h2 className="font-display font-extrabold text-foreground">Where the hours went</h2>
                <span className="text-xs text-muted-foreground tabular-nums">{fmt(total)} logged</span>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
                Both study tables, every technique and every quiz.
                {leanest && <> {leanest.subject} has had the least of it.</>}
            </p>

            <div className="space-y-3">
                {rows.map((r) => {
                    const pct = scale > 0 ? Math.max(2, Math.round((r.minutes / scale) * 100)) : 0;
                    return (
                        <Link key={r.subject}
                            to={`${createPageUrl("SubjectHub")}?subject=${encodeURIComponent(r.subject)}`}
                            className="block group rounded-xl -mx-2 px-2 py-1.5 hover:bg-secondary/50 transition-colors">
                            <div className="flex items-baseline justify-between gap-3 mb-1.5">
                                <span className="text-sm font-bold text-foreground truncate flex items-center gap-1">
                                    {r.subject}
                                    <ArrowRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                </span>
                                <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">
                                    {fmt(r.minutes)}
                                    {/* NULL rather than 0: an unscored or
                                        never-sat subject has no average, and
                                        printing 0% would read as having failed
                                        everything rather than having sat
                                        nothing. */}
                                    {r.avg != null && <> · <span className="font-bold text-foreground">{r.avg}%</span></>}
                                    {r.ready > 0 && <> · {r.ready} ready</>}
                                </span>
                            </div>
                            <div className="h-2 rounded-full bg-secondary overflow-hidden">
                                <div className="h-full rounded-full transition-all"
                                    style={{ width: `${pct}%`, backgroundColor: subjectColor(null, r.subject) }} />
                            </div>
                        </Link>
                    );
                })}
            </div>
        </section>
    );
}
