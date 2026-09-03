/**
 * quizDeck — the numbers a quiz shows on its face.
 *
 * Lifted out of QuizCard when the quiz list became a shelf of packs. It was
 * ninety lines of scoring arithmetic living inside a presentational component,
 * where it could not be asserted against anything, and two of the three rules
 * in it are the kind that go quietly wrong.
 *
 * THE ADJUSTED SCORE WINS. An attempt that included written work the student
 * marked themselves carries `adjusted_score`, and that is the figure the
 * results page shows them. A card reading the raw `score` would tell them they
 * got 60% on the quiz whose results screen just said 78%, and the card is the
 * one they would believe was broken.
 *
 * WRONG MEANS WRONG, NOT UNGRADED. "Retry the ones you got wrong" is built
 * from the most recent attempt's MCQs only. A short answer has no stored
 * correct index to compare against, so including them would quietly hand the
 * student back questions they had actually answered well.
 *
 * AND THE MOST RECENT ATTEMPT IS THE MOST RECENT FULL SIT. A "wrong only"
 * retry stores its answers under the positions they held IN THE RETRY —
 * question 5 of the quiz, sat as the only question in the run, is answer 0 —
 * and this function reads those answers against the PARENT quiz's array. So
 * once a student used the retry button, every number on that deck face was
 * computed by comparing their answers to the wrong questions: the count of
 * what was left to fix was arbitrary, and pressing the button again served
 * them a set of questions chosen at random. Its score is not comparable
 * either — a subset made of your hardest questions is not the quiz.
 */

import { isRetryAttempt } from "@/lib/quizInsight";

/** The score a student was actually shown for an attempt. */
export const effectiveScore = (attempt) =>
    typeof attempt?.adjusted_score === "number" ? attempt.adjusted_score : attempt?.score;

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/**
 * Everything the deck face and its actions need, from one pass over the
 * attempts. Returns zeroes and nulls rather than throwing on a shape we did
 * not expect — a quiz list that cannot count is still a quiz list.
 */
export function quizDeckStats(quiz, allAttempts = []) {
    const all = Array.isArray(allAttempts)
        ? allAttempts.filter((a) => a?.quiz_id === quiz?.id)
        : [];
    // Retries still count as attempts — they are real work, and the face's
    // "3 tries" is a count of turning up. They are excluded from everything
    // that is a MEASUREMENT of the quiz.
    const attempts = all.filter((a) => !isRetryAttempt(a));

    const scored = attempts.map(effectiveScore).filter(isNum);
    // `null`, not 0. A quiz nobody has sat is a different thing from a quiz
    // somebody scored nothing on, and the face says so in different words.
    const bestScore = scored.length ? Math.max(...scored) : null;
    const avgScore = scored.length
        ? Math.round(scored.reduce((sum, s) => sum + s, 0) / scored.length)
        : null;

    const mostRecent = attempts.length
        ? [...attempts].sort((a, b) =>
            new Date(b.created_date || 0) - new Date(a.created_date || 0))[0]
        : null;

    const answers = mostRecent?.user_answers;
    const questions = Array.isArray(quiz?.questions) ? quiz.questions : [];
    const wrongIdx = answers
        ? questions.reduce((out, q, i) => {
            if (q?.type !== "mcq") return out;              // nothing to compare
            const given = answers[i];
            if (given === undefined || given === null) { out.push(i); return out; }
            if (parseInt(given, 10) !== q.correct_answer) out.push(i);
            return out;
        }, [])
        : [];

    return { attempts: all.length, bestScore, avgScore, wrongIdx, mostRecent };
}

/** How many recent sits the headline average is taken over. */
export const RECENT_WINDOW = 5;

/**
 * The numbers the Quizzes hero prints: how many quizzes, how many attempts,
 * the recent average and the best ever.
 *
 * IT LIVES HERE, beside `quizDeckStats`, because the hero sits directly above
 * the shelf of deck faces and the two have to agree. They did not. The hero
 * computed its own arithmetic inline and got three things differently:
 *
 *   THE ADJUSTED SCORE. The hero read the raw `score`; the faces read
 *   `effectiveScore`. So a student who marked their own written work saw the
 *   results screen say 78%, the deck face say 78%, and the panel above both
 *   say 60% — the exact failure the note at the top of this file describes,
 *   on the one surface that had not been fixed.
 *
 *   AN UNSCORED ATTEMPT IS NOT A ZERO. `sum + (a.score || 0)` counted an
 *   attempt whose marking never came back as nought out of a hundred and
 *   divided by it anyway, which drags the average down by a mark the student
 *   never dropped.
 *
 *   "LAST 5" HAS TO MEAN THE LAST 5. Attempts were sorted on `date`, which is
 *   written as a DAY (`toISOString().split("T")[0]`) — so every sit on the
 *   same day tied, and the order among them was whatever order the rows came
 *   back in. On a page where somebody sits four quizzes in an afternoon,
 *   "last 5" and "you scored X% last time" were picking arbitrarily. Ordered
 *   on `created_date`, which is a timestamp.
 *
 * Retries count as ATTEMPTS and never as a MEASUREMENT — the same split every
 * other reader of this data makes.
 */
export function quizzingSummary(quizzes = [], allAttempts = []) {
    const list = Array.isArray(allAttempts) ? allAttempts : [];
    const at = (a) => new Date(a?.created_date || a?.date || 0).getTime() || 0;
    const fullSits = list.filter((a) => !isRetryAttempt(a)).sort((a, b) => at(b) - at(a));

    // In sit order, most recent first, with the unscored dropped rather than
    // read as zero.
    const scored = fullSits.map(effectiveScore).filter(isNum);
    const recent = scored.slice(0, RECENT_WINDOW);

    return {
        totalQuizzes: Array.isArray(quizzes) ? quizzes.length : 0,
        // Every attempt, retries included: this one is a count of turning up.
        totalAttempts: list.length,
        avgScore: recent.length
            ? Math.round(recent.reduce((sum, s) => sum + s, 0) / recent.length)
            : null,
        // How many the average is actually over, so the label can say "last 3"
        // when there are three rather than promising five and averaging fewer.
        avgOver: recent.length,
        bestScore: scored.length ? Math.max(...scored) : null,
        lastAttempt: fullSits[0] || null,
    };
}

