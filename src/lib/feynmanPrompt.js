/**
 * feynmanPrompt — the instructions for a Feynman pass, as ONE cacheable block.
 *
 * ─── IT SHARES THE MARKER'S SYSTEM BLOCK, AND THAT IS THE WHOLE COST DESIGN ─
 * `markingSystem(subject)` is already a cacheable system prefix carrying the
 * subject's VCAA examiner profile, the worked marks and the rubric. A Feynman
 * pass needs exactly that knowledge — what the command terms mean, how
 * candidates lose marks, which terminology is load-bearing — so composing a
 * SECOND preamble would pay full rate for a block the marking call has already
 * warmed. Sharing it means a pass reads the cache entry rather than creating
 * one, which is the `askWhyRight` move in QuizPlayer, one technique over.
 *
 * The Feynman rubric is appended to that block rather than riding in the user
 * message, because it is identical for every pass in a subject — only the
 * student's explanation changes. markingPrompt.js's own rule.
 */

import { markingSystem } from "./markingPrompt.js";
import { audienceOf, GAP_LIST, GAPS_MAX } from "./feynman.js";

/**
 * What a Feynman pass is looking for, and what it must refuse.
 *
 * It is NOT marking. A marker asks whether the response earns the marks; this
 * asks whether the EXPLANATION HOLDS — which is a different and often harsher
 * question, because a response can earn every mark by naming the right terms
 * while the student could not say what one of them means.
 */
const RUBRIC = `
YOU ARE NOT MARKING. You are the person this explanation is being given TO.

The student is practising the Feynman technique: explain the idea in your own
words, simply enough for your audience, and find out where your understanding
is hollow rather than where your wording is. Your job is to find the places
their explanation does not survive one honest question.

WHAT YOU RETURN IS QUESTIONS. Not criticism, not a mark, not a rewrite — the
questions your audience would actually ask next and this explanation does not
answer. A good question is one the student can go away and answer.

THE FOUR KINDS:
${GAP_LIST.map((k) => `  ${k.id} — ${k.label}. ${k.blurb}`).join("\n")}

RULES:
- At most ${GAPS_MAX} gaps, and FEWER IS NORMAL. A pass that always finds five
  is a horoscope: the first time a student writes something good and is told it
  is broken, every later finding reads as decoration too. An explanation that
  holds returns an empty list, and that is a real and common answer.
- QUOTE VERBATIM or not at all. If you point at a phrase, copy it exactly as
  the student wrote it, character for character. Never paraphrase into the
  quote field. A gap whose problem is that something is ABSENT has no quote,
  and that is correct — leave it empty rather than quoting something nearby.
- One question per gap, phrased as your audience would ask it, in their words.
- Rank them: the question that most undermines the explanation comes first.
- Judge the EXPLANATION, never the student. No praise, no encouragement, no
  summary of what they did well — a different surface does that.
- Never restate the study design at them. If the idea is simply missing, the
  question is what makes that visible.`;

/**
 * The cacheable prefix: examiner profile + rubric, identical for every pass in
 * a subject and for every audience, so the audience rides in the USER message.
 */
export function feynmanSystem(subject) {
    return `${markingSystem(subject)}\n\n${RUBRIC}`;
}

/** The pass itself. Everything that changes between calls lives here. */
export function explainPrompt(text, { subject, topic, audience, terms = [] } = {}) {
    const who = audienceOf(audience);
    const leaned = terms.length
        ? `\n\nTECHNICAL TERMS THE STUDENT USED: ${terms.join(", ")}\nA term is only a gap if the explanation leans on it WITHOUT having said what it means. Using a term and then explaining it is the student doing the technique correctly.`
        : "";
    return `SUBJECT: ${subject || "VCE"}
TOPIC: ${topic || "—"}
AUDIENCE: they are explaining this to ${who.short}. ${who.note}${leaned}

THE STUDENT'S EXPLANATION, verbatim:
"""
${String(text || "")}
"""

Return the questions ${who.short} would ask next that this explanation does not answer.`;
}

export const GAPS_SCHEMA = {
    type: "object",
    properties: {
        gaps: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    kind: { type: "string", enum: GAP_LIST.map((k) => k.id) },
                    ask: { type: "string", description: "The question the audience would ask next." },
                    why: { type: "string", description: "One sentence: why this is the next question." },
                    quote: { type: "string", description: "Verbatim from the explanation, or empty if the problem is an absence." },
                },
                required: ["kind", "ask"],
            },
        },
    },
    required: ["gaps"],
};

/**
 * The second pass, and it may only CLOSE.
 *
 * Pinned to the cheap model in `aiModels.js`, because deciding whether a named
 * question has now been answered is CLASSIFICATION — the judgement was the
 * first pass, and it has already been made and paid for.
 */
export function recheckPrompt(text, open = []) {
    return `The student has rewritten their explanation. Below are the questions their PREVIOUS version did not answer, each with an id.

OPEN QUESTIONS:
${open.map((g) => `  [${g.id}] ${g.ask}`).join("\n")}

THE REWRITTEN EXPLANATION:
"""
${String(text || "")}
"""

For each id, decide ONLY whether the new version now answers that question.

Return the ids that are STILL NOT ANSWERED. Omit an id and you are saying the
student has answered it.

You may not raise anything new. If the rewrite introduced a different problem,
say nothing about it — this pass exists so the student can finish, and a loop
that finds a fresh fault every time never ends. Judge the listed questions and
nothing else.`;
}

export const RECHECK_SCHEMA = {
    type: "object",
    properties: {
        still_open: {
            type: "array",
            items: { type: "string" },
            description: "Ids of the questions the rewrite still does not answer.",
        },
    },
    required: ["still_open"],
};

export default { feynmanSystem, explainPrompt, GAPS_SCHEMA, recheckPrompt, RECHECK_SCHEMA };
