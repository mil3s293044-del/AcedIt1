/**
 * AuditPile — one subject's claim on your attention, and the means to refuse it.
 *
 * THE PANEL HAS TO ANSWER "WHY AM I BEING TOLD THIS" BEFORE IT ASKS FOR
 * ANYTHING. A count on its own ("Chemistry 34") is what the dashboard already
 * said, and it is exactly the thing students stopped reading. So the reason
 * sentence sits above the buttons, in the words somebody would use: twelve
 * cards went past forty-one days ago. Once that is on screen, "I know these"
 * is a judgement the student can actually make.
 *
 * THE COUNTS ARE A BAR, NOT FOUR NUMBERS. Overdue, due, new and put-away are
 * proportions of one pile, and a stacked bar shows at a glance that a subject
 * reading "240" is 230 cards nobody has opened rather than a catastrophe. Four
 * numbers in a row would need reading; the bar is understood before it is read.
 *
 * NOTHING DESTRUCTIVE HAPPENS BEHIND A CONFIRM DIALOG. Marking a pile known is
 * reversible by design, so the honest interaction is to do it immediately and
 * offer undo, not to interrogate somebody who already decided. A dialog here
 * would be the app doubting the student on the one screen built to trust them.
 */
import React, { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronDown, Check, Clock3, RotateCcw, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { colorFor } from "@/components/cards/cardIdentity";
import { cardState } from "@/lib/due";

/** How many individual cards a topic will list before it asks you to scroll. */
const CARD_PREVIEW = 40;

const STATE_STYLE = {
    overdue: { label: "Overdue", dot: "bg-streak", text: "text-streak" },
    due: { label: "Due", dot: "bg-chart-3", text: "text-chart-3" },
    new: { label: "New", dot: "bg-muted-foreground/50", text: "text-muted-foreground" },
    known: { label: "Known", dot: "bg-primary", text: "text-primary" },
    snoozed: { label: "Snoozed", dot: "bg-xp", text: "text-xp" },
    scheduled: { label: "Scheduled", dot: "bg-border", text: "text-muted-foreground" },
};

/**
 * The pile as one bar.
 *
 * Segments below a couple of percent still get a sliver rather than vanishing,
 * because a subject with three overdue cards among four hundred needs those
 * three to be visible — they are the entire reason the row is on screen.
 */
function PileBar({ counts, total }) {
    if (!total) return null;
    const order = ["overdue", "due", "new", "snoozed", "known"];
    return (
        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-border/40" aria-hidden="true">
            {order.map((k) => {
                const n = counts[k] || 0;
                if (!n) return null;
                return (
                    <div key={k}
                        className={STATE_STYLE[k].dot}
                        style={{ width: `${Math.max(1.5, (n / total) * 100)}%` }} />
                );
            })}
        </div>
    );
}

function CountPips({ counts }) {
    const shown = ["overdue", "due", "new", "known"].filter((k) => counts[k] > 0);
    if (!shown.length) return null;
    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold">
            {shown.map((k) => (
                <span key={k} className={`inline-flex items-center gap-1.5 ${STATE_STYLE[k].text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${STATE_STYLE[k].dot}`} />
                    {counts[k]} {STATE_STYLE[k].label.toLowerCase()}
                </span>
            ))}
        </div>
    );
}

/**
 * The things you can do to a pile.
 *
 * STUDYING IS THE PRIMARY, NOT DISMISSING. The first draft had "I know these"
 * as the filled button and Review as the outline, and rendering it made the
 * mistake obvious: the loudest control on a study app's screen was the one
 * that makes work go away. Marking off has to be easy and one click, which it
 * is, but it should not out-shout the thing the student came to the app to do.
 *
 * A PILE OF NOTHING BUT NEW CARDS STILL GETS A BUTTON. It has no due cards, so
 * the first draft rendered it with no actions at all — a row you could read and
 * not act on, which is the same dead end the dashboard already was.
 */
function PileActions({ active, fresh, known, onKnown, onSnooze, onRestore, onReview, busy }) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            {onReview && (active > 0 || fresh > 0) && (
                <Button size="sm" className="rounded-xl gap-1.5" onClick={onReview} disabled={busy}>
                    <Play className="w-3.5 h-3.5" />
                    {active > 0 ? `Review ${active}` : `Start ${fresh === 1 ? "it" : "these"}`}
                </Button>
            )}
            {active > 0 && (
                <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={onKnown} disabled={busy}>
                    <Check className="w-3.5 h-3.5" /> I know {active === 1 ? "this" : "these"}
                </Button>
            )}
            {active > 0 && (
                <Button size="sm" variant="ghost" className="rounded-xl gap-1.5 text-muted-foreground"
                    onClick={onSnooze} disabled={busy}>
                    <Clock3 className="w-3.5 h-3.5" /> Not this week
                </Button>
            )}
            {/* Never-opened cards can be put away too. Somebody who generated
                four hundred cards and wants sixty of them should not have to
                review three hundred and forty to say so. */}
            {active === 0 && fresh > 0 && (
                <Button size="sm" variant="ghost" className="rounded-xl gap-1.5 text-muted-foreground"
                    onClick={onKnown} disabled={busy}>
                    <Check className="w-3.5 h-3.5" /> Put {fresh} away
                </Button>
            )}
            {known > 0 && onRestore && (
                <Button size="sm" variant="ghost" className="rounded-xl gap-1.5 text-muted-foreground"
                    onClick={onRestore} disabled={busy}>
                    <RotateCcw className="w-3.5 h-3.5" /> Put {known} back
                </Button>
            )}
        </div>
    );
}

/** One card, with its own state and its own mark-off. The finest grain there is. */
function CardRow({ card, today, onKnown, onRestore, busy }) {
    const state = cardState(card, today);
    const style = STATE_STYLE[state] || STATE_STYLE.scheduled;
    const isKnown = state === "known";
    return (
        <li className="flex items-start gap-3 py-2 border-t border-border/50 first:border-t-0">
            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`}
                title={style.label} />
            <div className="flex-1 min-w-0">
                <p className={`text-sm leading-snug ${isKnown ? "text-muted-foreground line-through" : "text-foreground"}`}>
                    {card.question}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                    {style.label}
                    {card.next_review_date ? ` · scheduled ${card.next_review_date}` : ""}
                    {card.total_reviews ? ` · reviewed ${card.total_reviews}x` : " · never reviewed"}
                </p>
            </div>
            <button type="button" disabled={busy}
                onClick={() => (isKnown ? onRestore([card.id]) : onKnown([card.id]))}
                className="flex-shrink-0 text-[11px] font-bold rounded-lg px-2 py-1 border border-border
                    hover:bg-muted transition-colors disabled:opacity-50"
                aria-label={isKnown ? `Put "${card.question}" back in the queue` : `Mark "${card.question}" known`}>
                {isKnown ? "Put back" : "I know it"}
            </button>
        </li>
    );
}

export default function AuditPile({ pile, today, onKnown, onSnooze, onRestore, onReview, busy = false }) {
    const [open, setOpen] = useState(false);
    const [openTopic, setOpenTopic] = useState(null);
    const reduce = useReducedMotion();

    const colour = colorFor(pile.subject);
    const counts = {
        overdue: pile.overdue, due: pile.due, new: pile.fresh,
        known: pile.known, snoozed: pile.snoozed,
    };
    const ids = (cards, states) => cards.filter((c) => states.includes(cardState(c, today))).map((c) => c.id);
    const knownIds = (cards) => ids(cards, ["known"]);
    /**
     * What "I know these" acts on.
     *
     * Due cards when there are any, and otherwise the never-opened ones —
     * matching whichever button the row is actually showing. Keyed off the
     * same condition PileActions uses so the label and the effect can never
     * drift apart.
     */
    const targetIds = (cards, active) =>
        active > 0 ? ids(cards, ["due", "overdue"]) : ids(cards, ["new"]);

    return (
        <div className="card-soft on-table overflow-hidden">
            {/* The subject's own colour as an edge, the same one its card carries
                everywhere else, so the row is identifiable before it is read. */}
            <div className="flex" style={{ borderLeft: `3px solid ${colour}` }}>
                <div className="flex-1 min-w-0 p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h3 className="font-display font-extrabold text-foreground truncate">{pile.subject}</h3>
                            <p className="text-sm text-muted-foreground mt-0.5">{pile.reason}</p>
                        </div>
                        <button type="button" onClick={() => setOpen((v) => !v)}
                            aria-expanded={open}
                            aria-label={`${open ? "Hide" : "Show"} topics in ${pile.subject}`}
                            className="flex-shrink-0 flex items-center gap-1 text-[11px] font-bold text-muted-foreground
                                hover:text-foreground rounded-lg px-2 py-1">
                            {pile.topics.length} topic{pile.topics.length === 1 ? "" : "s"}
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
                        </button>
                    </div>

                    <div className="mt-3 space-y-2">
                        <PileBar counts={counts} total={pile.cards.length} />
                        <CountPips counts={counts} />
                    </div>

                    <div className="mt-4">
                        <PileActions
                            active={pile.active} fresh={pile.fresh} known={pile.known} busy={busy}
                            onReview={onReview ? () => onReview(pile) : null}
                            onKnown={() => onKnown(targetIds(pile.cards, pile.active),
                                `${pile.subject}: ${pile.active || pile.fresh} put away`)}
                            onSnooze={() => onSnooze(targetIds(pile.cards, pile.active),
                                `${pile.subject}: ${pile.active} put off for a week`)}
                            onRestore={() => onRestore(knownIds(pile.cards),
                                `${pile.subject}: ${pile.known} back in the queue`)}
                        />
                    </div>
                </div>
            </div>

            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={reduce ? false : { height: 0, opacity: 0 }}
                        animate={reduce ? {} : { height: "auto", opacity: 1 }}
                        exit={reduce ? {} : { height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="border-t border-border bg-muted/30 overflow-hidden">
                        <ul className="divide-y divide-border">
                            {pile.topics.map((t) => {
                                const topicOpen = openTopic === t.topic;
                                const tCounts = { overdue: t.overdue, due: t.due, new: t.fresh, known: t.known, snoozed: t.snoozed };
                                return (
                                    <li key={t.topic} className="p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="font-bold text-sm text-foreground truncate">{t.topic}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">{t.reason}</p>
                                            </div>
                                            <button type="button"
                                                onClick={() => setOpenTopic(topicOpen ? null : t.topic)}
                                                aria-expanded={topicOpen}
                                                aria-label={`${topicOpen ? "Hide" : "Show"} the ${t.cards.length} cards in ${t.topic}`}
                                                className="flex-shrink-0 flex items-center gap-1 text-[11px] font-bold
                                                    text-muted-foreground hover:text-foreground rounded-lg px-2 py-1">
                                                {t.cards.length} card{t.cards.length === 1 ? "" : "s"}
                                                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${topicOpen ? "rotate-180" : ""}`} />
                                            </button>
                                        </div>

                                        <div className="mt-2.5 space-y-2">
                                            <PileBar counts={tCounts} total={t.cards.length} />
                                            <CountPips counts={tCounts} />
                                        </div>

                                        <div className="mt-3">
                                            <PileActions
                                                active={t.active} fresh={t.fresh} known={t.known} busy={busy}
                                                onReview={null}
                                                onKnown={() => onKnown(targetIds(t.cards, t.active),
                                                    `${t.topic}: ${t.active || t.fresh} put away`)}
                                                onSnooze={() => onSnooze(targetIds(t.cards, t.active),
                                                    `${t.topic}: ${t.active} put off for a week`)}
                                                onRestore={() => onRestore(knownIds(t.cards),
                                                    `${t.topic}: ${t.known} back in the queue`)}
                                            />
                                        </div>

                                        {topicOpen && (
                                            <div className="mt-3 rounded-xl border border-border bg-background p-3">
                                                <ul className="max-h-96 overflow-y-auto">
                                                    {t.cards.slice(0, CARD_PREVIEW).map((c) => (
                                                        <CardRow key={c.id} card={c} today={today} busy={busy}
                                                            onKnown={(one) => onKnown(one, "1 card marked known")}
                                                            onRestore={(one) => onRestore(one, "1 card back in the queue")} />
                                                    ))}
                                                </ul>
                                                {t.cards.length > CARD_PREVIEW && (
                                                    <p className="text-[11px] text-muted-foreground pt-2 border-t border-border mt-2">
                                                        Showing the first {CARD_PREVIEW} of {t.cards.length}. The buttons above
                                                        act on all of them.
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
