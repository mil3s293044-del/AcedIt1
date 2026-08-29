/**
 * QuizDeck — a quiz in the list, drawn as the deck it is.
 *
 * The quiz list was the last screen in the app still using the generated-app
 * tile: an icon in a rounded square, a title, two pills, three identical grey
 * stat boxes reading Attempts / Best / Avg, an accordion and a row of buttons.
 * Every card came out the same shape whatever was on it, and a grid of them
 * says nothing about what the page is for.
 *
 * Which was doubly odd here, because PlayingCard is used on seventeen other
 * surfaces — the landing page, the signup wizard, the dashboard, Subjects,
 * Review, the flashcard shelf, and inside the quiz PLAYER itself. Tapping a
 * generic tile and landing on a card table was a seam in the middle of the one
 * flow this page exists to start.
 *
 * So a quiz is a pack of cards, on the same CardPack the flashcard shelf uses.
 *
 * RANK IS YOUR BEST SCORE, on the subject's suit. That is the same contract
 * cardIdentity states everywhere else — rank is how strong this thing is, suit
 * is the family it belongs to — and it means an unplayed quiz is a two and a
 * 95% is an Ace. Nobody is handed an Ace for generating a quiz, for the same
 * reason the signup wizard refuses to: a rank given away free is worth nothing
 * when it is earned later.
 *
 * ONE NUMBER ON THE FACE. The three stat tiles are gone. On a card there is
 * room for one figure and it should be the one that answers "what now" —
 * the score to beat, or, on a quiz never sat, how big it is. Attempts and
 * average live on the results screen, which has room to say them properly.
 */
import React from "react";
import { motion } from "framer-motion";
import { Shuffle, Target, Trash2 } from "lucide-react";
import CardPack, { PackAction } from "@/components/cards/CardPack";
import { rankFor, suitFor } from "@/components/cards/cardIdentity";

/**
 * Score → the tone the figure is printed in. Static lookups, because a
 * Tailwind class assembled at runtime is invisible to the scanner and compiles
 * to nothing — a bug that only shows up in the production build.
 */
const SCORE_TEXT = {
    high: "text-primary",
    good: "text-chart-3",
    mid:  "text-xp",
    low:  "text-streak",
};
const scoreBand = (s) => (s >= 90 ? "high" : s >= 70 ? "good" : s >= 50 ? "mid" : "low");

export default function QuizDeck({
    title, subject, difficulty, tone,
    /** Drives the thickness of the pack, and the face when never sat. */
    questions = 0,
    /** Null when it has never been sat — which is a different thing from zero. */
    bestScore = null,
    attempts = 0,
    /** MCQs got wrong on the most recent attempt, if any. */
    toFix = 0,
    /** Reshuffle regenerates from the source file, so it needs one. */
    canReshuffle = false,
    onSelect, onRetryWrong, onReshuffle, onDelete,
    index = 0,
}) {
    const played = typeof bestScore === "number";
    const score = played ? Math.round(bestScore) : 0;

    return (
        <CardPack
            index={index}
            label={title}
            ariaLabel={`${title} — ${questions} question${questions === 1 ? "" : "s"}, ${played ? `best ${score}%` : "never sat"}`}
            total={questions}
            tone={tone}
            rank={rankFor(score)}
            suit={suitFor(subject)}
            mastery={played ? score : undefined}
            onSelect={onSelect}
            watermark={false}
            actions={(
                <>
                    {/* Only offered when there is something to fix. A button
                        that retries nothing is worse than no button. */}
                    {toFix > 0 && (
                        <PackAction label={`Retry the ${toFix} you got wrong`} onClick={onRetryWrong}>
                            <Target className="w-3.5 h-3.5" />
                        </PackAction>
                    )}
                    {canReshuffle && (
                        <PackAction label={`Reshuffle ${title}`} onClick={onReshuffle}>
                            <Shuffle className="w-3.5 h-3.5" />
                        </PackAction>
                    )}
                    <PackAction label={`Delete ${title}`} tone="danger" onClick={onDelete}>
                        <Trash2 className="w-3.5 h-3.5" />
                    </PackAction>
                </>
            )}
        >
            <span className="font-display font-extrabold text-foreground text-[14px]
                leading-tight line-clamp-3">{title}</span>
            {difficulty && (
                <span className="block text-[11px] text-muted-foreground mt-0.5 truncate">{difficulty}</span>
            )}

            {/* Dead centre, where a card prints its pips. Never sat, the honest
                headline is how big the thing is; sat, it is the score to beat. */}
            <span className="flex-1 grid place-items-center">
                <span className="flex flex-col items-center font-display leading-none">
                    <span className={`text-[30px] font-black tabular-nums
                        ${played ? SCORE_TEXT[scoreBand(score)] : "text-foreground"}`}>
                        {played ? `${score}%` : questions}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest
                        text-muted-foreground mt-1">
                        {played ? "best" : questions === 1 ? "question" : "questions"}
                    </span>
                </span>
            </span>

            <span className="flex items-center gap-2 text-[10px] text-muted-foreground">
                {played ? (
                    <span className="tabular-nums">
                        {questions} q · {attempts} {attempts === 1 ? "try" : "tries"}
                    </span>
                ) : (
                    <span className="font-bold">Never sat</span>
                )}
                {toFix > 0 && (
                    <span className="inline-flex items-center gap-1 text-streak font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-streak" />{toFix} to fix
                    </span>
                )}
            </span>

            {/* The score as a rule at the foot rather than another labelled
                progress bar. The corner index already says it in words. */}
            <span className="block h-1 rounded-full bg-secondary overflow-hidden mt-1.5 mr-1">
                <motion.span className="block h-full rounded-full"
                    style={{ backgroundColor: tone || "hsl(var(--primary))" }}
                    initial={{ width: 0 }} animate={{ width: `${played ? Math.max(2, score) : 0}%` }}
                    transition={{ duration: 0.7, delay: 0.15 }} />
            </span>
        </CardPack>
    );
}
