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
 */

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
    const attempts = Array.isArray(allAttempts)
        ? allAttempts.filter((a) => a?.quiz_id === quiz?.id)
        : [];

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

    return { attempts: attempts.length, bestScore, avgScore, wrongIdx, mostRecent };
}
