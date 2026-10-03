/**
 * InsightsTab — the half of Analytics that ends somewhere.
 *
 * ─── What was cut, and the rule that cut it ─────────────────────────────────
 * Analytics was five tabs and about twenty charts. The test a panel had to
 * pass to survive here is one question: CAN A STUDENT DO SOMETHING DIFFERENT
 * BECAUSE OF IT? That is not a style preference — a page of true numbers that
 * change nothing is read once, and then the numbers that DO matter are read
 * with the same attention, which is none.
 *
 *   GONE  Daily Study Time bars — "how much did I do" is on the dashboard
 *         against the student's own usual, which is the only comparison that
 *         means anything; a bare bar chart of minutes answers nobody.
 *   GONE  Technique Breakdown pie — a share of five techniques with no claim
 *         about which share is right. The ATAR's breadth component is the one
 *         place that has an opinion, and it has a door on it.
 *   GONE  Rating Distribution — how often you pressed Good. A histogram of
 *         your own button presses.
 *   GONE  Mastery by Subject grid — a second, coarser answer to what the
 *         subject hub answers properly, and the per-subject row below carries
 *         what was useful in it.
 *   GONE  Flashcard Recommendations — the queue is that, properly, with the
 *         action on the row.
 *   GONE  AtarPanel — Ranked owns the ATAR now, dial, components, doors and
 *         all. Two surfaces drawing one score is the mirror this codebase
 *         keeps deleting, and the whole point of the Ranked split was that the
 *         ATAR lives in ONE place.
 *
 * ─── What is left, in the order the questions get asked ─────────────────────
 *   1. IS IT STICKING — the only question here that predicts a result. Three
 *      panels that were already written and were behind a tab nobody opened.
 *   2. WHERE THE MARKS ARE GOING — the topics costing you, which is the only
 *      panel on the old page that already ended in something to do.
 *   3. WHERE THE HOURS WENT — one row per subject, with the way into it.
 *
 * ─── AND THE COACH WENT WITH IT ───────────────────────────────────────────
 * "Ask the coach" was a model call that read everything above and said what it
 * would change. It failed the same test the charts did, one level up: the
 * panels here each name one thing and point at the screen that moves it, so a
 * paragraph of generated advice on top of them is a SECOND answer to a
 * question four panels have already answered properly — and the one answer
 * nobody can check, on a page whose whole rebuild was about only printing
 * things a student can act on and verify.
 *
 * It took three queries with it. `UserSubject`, `ActiveRecallSession` and
 * `BlurtingSession` were loaded for the coach alone, so this tab now costs
 * NOTHING beyond what the page already had — everything below draws from rows
 * the queue tab loaded.
 */
import React from "react";
import { motion } from "framer-motion";
import CognitiveProfilePanel from "@/components/analytics/CognitiveProfilePanel";
import MemoryPanel from "@/components/analytics/MemoryPanel";
import AttentionPanel from "@/components/analytics/AttentionPanel";
import WeakTopicsPanel from "@/components/analytics/WeakTopicsPanel";
import SubjectSplit from "@/components/analytics/SubjectSplit";
import { studyEvents } from "@/lib/studyLog";

function Band({ title, blurb, children }) {
    return (
        <section className="space-y-3">
            <div className="flex items-center gap-3">
                <div>
                    <h2 className="font-display text-lg sm:text-xl font-extrabold text-foreground leading-tight">
                        {title}
                    </h2>
                    {blurb && <p className="text-xs text-muted-foreground mt-0.5">{blurb}</p>}
                </div>
                {/* A rule to the end of the row — what turns a left-aligned
                    band into a shelf rather than a hole. */}
                <span className="flex-1 h-0.5 rounded-full bg-border self-end mb-1" aria-hidden="true" />
            </div>
            {children}
        </section>
    );
}

export default function InsightsTab({ data, today }) {
    if (!data) return null;

    const cards = data.cards || [];
    const techniques = data.techniques || [];
    const sessions = data.sessions || [];
    const events = studyEvents(sessions, techniques);

    const nothing = !cards.length && !techniques.length && !sessions.length && !(data.attempts || []).length;
    if (nothing) {
        return (
            <div className="card-soft p-10 text-center">
                <h2 className="font-display font-extrabold text-foreground">Nothing to read yet</h2>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                    Sit a quiz or run a study session and this fills in — it only reports things
                    you have actually done, so there is nothing to show you first.
                </p>
            </div>
        );
    }

    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="space-y-7">

            <Band title="Is it sticking?"
                blurb="Everything else here is how much you did. This is whether any of it stayed.">
                <div className="grid gap-4 xl:grid-cols-2 items-start">
                    <MemoryPanel techniques={techniques} cards={cards} />
                    <AttentionPanel techniques={techniques} sessions={sessions} />
                </div>
                <CognitiveProfilePanel techniques={techniques} cards={cards} sessions={sessions} />
            </Band>

            <Band title="Where the marks are going"
                blurb="The topics your own answers keep coming back wrong on.">
                <WeakTopicsPanel flashcards={cards} />
            </Band>

            <Band title="Where the hours went"
                blurb="Your subjects beside each other, and what the time bought.">
                <SubjectSplit events={events} quizzes={data.quizzes} attempts={data.attempts}
                    cards={cards} today={today} />
            </Band>
        </motion.div>
    );
}
