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
