/**
 * TheReveal — one earned payoff where there used to be three pitches.
 *
 * The wizard previously ran three consecutive selling screens between the last
 * question and the sign-in: a plan reveal, a price-comparison bar chart, and a
 * free-versus-premium feature stack. Two problems with that, and the second is
 * the expensive one.
 *
 * FIRST, IT REPEATED THE LANDING PAGE. The landing page now anchors the price
 * against a private tutor and prints the free-versus-premium split in full.
 * Someone arriving here has just read both. Being sold the same two things
 * again, immediately, reads as a funnel rather than as a product, and it is
 * three screens of the reader's patience spent on information they already
 * have.
 *
 * SECOND, NOTHING WAS EARNED. The old plan reveal listed four bullets that
 * were identical for every student who ever saw it, under a heading that said
 * "your plan". Asking four questions and then showing an answer that does not
 * depend on them is worse than not asking, because the reader can tell.
 *
 * So: one screen. The hand they built fans out, and everything stated is
 * derived from the cards in it — their subjects by name, their year, their
 * target, their course. The one number on the screen that is not their own is
 * the review ladder, and that is real scheduling from the app's SM-2 setup
 * rather than a marketing figure.
 *
 * THE TWO IS THE HONEST BIT, and it is the reason this screen works at all.
 * Every subject card is a two, because rank is mastery and nothing has been
 * studied. Saying that out loud, at the exact moment a funnel would normally
 * be flattering someone, is the most persuasive thing on the page: it is a
 * promise that the ranks mean something, made by a product that just declined
 * to hand out a good one.
 *
 * The plan columns stay, compressed to what actually differs, because a person
 * about to choose between free and paid on the next screen should be able to
 * see the difference without going back. They are the summary, not the pitch.
 */
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Crown } from "lucide-react";
import { handFrom, FanCard } from "./HandOfAnswers";
import { formatAtar } from "./AtarCut";
import CostGap from "./CostGap";
import { TOOL_COUNT } from "@/components/ai_tools/chatTools";

/**
 * The first four reviews of anything you learn, in days.
 *
 * These are the intervals the app's own spaced repetition actually walks on a
 * card that keeps being answered correctly, which is why they are printed
 * rather than a rounder-looking set. A ladder invented for the graphic would
 * disagree with the schedule the student meets on day two.
 */
const LADDER = [1, 3, 8, 14];

/**
 * The spread. Bigger than the rail's hand, because this is the payoff.
 *
 * The step is FIXED and the container scrolls, rather than the step shrinking
 * to fit the count. Tightening the fan for a student who takes six subjects
 * would hide the labels on exactly the hands that have the most in them, and
 * a hand of nine that reads worse than a hand of four has the incentive
 * backwards.
 */
function Spread({ cards }) {
    const reduce = useReducedMotion();
    const n = cards.length;
    const step = 62;
    const W = 88, H = 124;
    const width = n > 0 ? (n - 1) * step + W : W;
    const mid = (n - 1) / 2;

    return (
        // overflow-y is visible, not hidden: the lean throws card corners
        // above and below the box, and clipping them shears the top off the
        // outermost card in every hand with more than four cards in it.
        <div className="w-full overflow-x-auto pt-3 pb-2 -mx-1 px-1">
            <div className="relative mx-auto" style={{ width, height: H + 26 }}>
                {cards.map((c, i) => {
                    const off = i - mid;
                    return (
                        <motion.div
                            key={c.key}
                            data-spread={c.key}
                            title={c.title}
                            className="absolute top-0"
                            style={{ width: W, height: H, left: i * step, zIndex: i }}
                            // From squared-up in the middle to spread. The
                            // whole hand starts stacked on the centre card and
                            // opens, which is what a hand being shown looks
                            // like and what the rail below has been building to.
                            initial={reduce
                                ? { opacity: 0 }
                                : { opacity: 0, x: -off * step, rotate: 0, y: 16 }}
                            whileInView={{ opacity: 1, x: 0, rotate: off * 4.2, y: Math.abs(off) * 3.5 }}
                            viewport={{ once: true }}
                            transition={reduce
                                ? { duration: 0.3, delay: i * 0.04 }
                                : { type: "spring", stiffness: 190, damping: 22, delay: 0.12 + i * 0.06 }}
                        >
                            <FanCard card={c} labelSize="9px"
                                strip={i === n - 1 ? W : step} />
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}

function Line({ children, i }) {
    const reduce = useReducedMotion();
    return (
        <motion.li
            className="flex items-start gap-2.5"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.5 + i * 0.08 }}
        >
            <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" strokeWidth={3} />
            <span className="text-sm text-foreground leading-snug">{children}</span>
        </motion.li>
    );
}

export default function TheReveal({ answers }) {
    const cards = handFrom(answers);
    const subjects = answers.subjects || [];
    const n = subjects.length;
    // Two names and a count reads; five names is a list nobody finishes. The
    // first two are joined with a comma rather than "and" when a count
    // follows, or the sentence lands as "X and Y and 3 others".
    const first = subjects.slice(0, 2).map((s) => s.name);
    const rest = n - 2;
    const subjectPhrase = n === 0
        ? "your subjects"
        : n <= 2
            ? first.join(" and ")
            : `${first.join(", ")} and ${rest} other${rest === 1 ? "" : "s"}`;

    const year = (answers.yearLevel || "").replace(/ Units.*$/, "");

    return (
        <div data-the-reveal className="space-y-7">
            <Spread cards={cards} />

            <div className="card-soft p-5 lg:p-6">
                <p className="stat-label text-primary mb-3">What AcedIt does with this hand</p>
                <ul className="space-y-2.5">
                    <Line i={0}>
                        Questions written for <span className="font-bold">{subjectPhrase}</span>
                        {year ? <> at <span className="font-bold">{year}</span> level</> : null}, marked against
                        the criteria an assessor actually uses.
                    </Line>
                    <Line i={1}>
                        Every subject you added starts as a <span className="font-bold">two</span>. Rank is
                        mastery in AcedIt, so the only way to hold better cards is to earn them.
                    </Line>
                    <Line i={2}>
                        Reviews land as things start to fade, not on a timetable you have to keep.
                    </Line>
                    <Line i={3}>
                        {answers.goalAtar
                            ? <>Progress measured against <span className="font-bold">ATAR {formatAtar(answers.goalAtar)}</span>, so you can see the gap rather than guess at it.</>
                            : <>Progress measured against where you are heading, so you can see the gap rather than guess at it.</>}
                    </Line>
                </ul>

                {/* The ladder. Concrete, small, and true — it is the schedule
                    the student will actually be on from tomorrow. */}
                <div className="mt-5 pt-5 border-t border-border">
                    <p className="stat-label text-muted-foreground mb-2.5">
                        Your first month on one idea
                    </p>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        {LADDER.map((d, i) => (
                            <React.Fragment key={d}>
                                {i > 0 && <span className="flex-1 h-px bg-border" />}
                                <motion.span
                                    className="px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20
                                        text-[11px] font-bold text-primary tabular-nums whitespace-nowrap"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.3, delay: 0.85 + i * 0.1 }}
                                >
                                    Day {d}
                                </motion.span>
                            </React.Fragment>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2.5 leading-relaxed">
                        Four short reviews, spread out. That beats four hours of rereading,
                        and it is most of what the last forty years of memory research keeps finding.
                    </p>
                </div>
            </div>

            {/* The price, as a shape. "$90 an hour versus $5 a week" is a true
                sentence that lands as two numbers and is gone by the next
                screen; the same fact drawn over forty school weeks is a gap you
                cannot un-see. */}
            <CostGap />

            {/* The split, compressed. Only what differs, because the reader is
                one screen away from choosing and does not need the shared half
                listed twice. */}
            <div>
                <p className="stat-label text-muted-foreground mb-2.5">Two ways to play it</p>
                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-surface border border-border shadow-soft p-4">
                        <p className="stat-label text-muted-foreground mb-1">Free</p>
                        <p className="font-display font-extrabold text-foreground text-2xl leading-none mb-3">
                            $0<span className="text-sm text-muted-foreground font-bold">/wk</span>
                        </p>
                        <ul className="space-y-1.5 text-[12px] text-muted-foreground leading-snug">
                            <li>Timer, flashcards, quizzes you write</li>
                            <li>Streaks, friends, leaderboards</li>
                            <li>5 AI quizzes, 5 sets, 5 tool uses. Lifetime.</li>
                        </ul>
                    </div>
                    <div className="relative rounded-2xl bg-primary/5 border-2 border-primary shadow-soft p-4">
                        <span className="absolute -top-2.5 right-3 pill bg-primary
                            text-primary-foreground text-[9px] px-2 py-0.5">
                            <Crown className="w-3 h-3" /> MOST PICK
                        </span>
                        <p className="stat-label text-primary mb-1">Premium</p>
                        <p className="font-display font-extrabold text-foreground text-2xl leading-none mb-3">
                            $5<span className="text-sm text-muted-foreground font-bold">/wk</span>
                        </p>
                        <ul className="space-y-1.5 text-[12px] text-foreground leading-snug font-medium">
                            <li>Everything free, without the caps</li>
                            <li>Marking against VCAA criteria</li>
                            <li>Spaced repetition, blurting, active recall</li>
                            <li>All {TOOL_COUNT} AI tools, every day</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
