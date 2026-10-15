/**
 * subjectShort — a subject's name as it is said, short enough for a card.
 *
 * Moved out of onboardingFlow.js so the planner's runway can print "Methods"
 * on a pin without pulling the whole onboarding model (and the catalogue it
 * imports) into the planner's chunk. onboardingFlow re-exports it, so the
 * hand and its test are untouched.
 */

/**
 * The long catalogue names, as they are actually said.
 *
 * A card in the hand is 62px wide and the label is two lines of 7.5px type, so
 * "Mathematical Methods" broke as "Mathem / atical Methods" and "Chemistry" as
 * "Chemistr / y" — a label cut mid-word reads as a rendering fault. These are
 * the names students use in a corridor, which is the right register for a
 * card in their hand anyway.
 */
const SHORT = {
    "Mathematical Methods": "Methods",
    "Specialist Mathematics": "Specialist",
    "General Mathematics": "General",
    "English Language": "Eng Lang",
    "English (EAL)": "EAL",
    "Environmental Science": "Enviro",
    "History: Revolutions": "Revs",
    "Australian History": "Aus History",
    "Legal Studies": "Legal",
    "Australian and Global Politics": "Politics",
    "Business Management": "Business",
    "Visual Communication Design": "VCD",
    "Art Making and Exhibiting": "Art",
    "Music Repertoire Performance": "Music",
    "Software Development": "Software",
    "Data Analytics": "Data",
    "Health and Human Development": "HHD",
    "Physical Education": "PE",
    "Japanese (Second Language)": "Japanese",
    "Chinese (Second Language)": "Chinese",
};

/**
 * The longest WORD a hand card can carry. The rail's overlapped cards show a
 * strip about 46px wide at 7px type, which is ten characters; a label may wrap
 * onto a second line between words, never inside one.
 */
export const SHORT_MAX = 10;

export function shortSubject(name = "") {
    const n = String(name || "").trim();
    if (SHORT[n]) return SHORT[n];
    const fits = (t) => t.split(/\s+/).length <= 2 && t.split(/\s+/).every((w) => w.length <= SHORT_MAX);
    if (fits(n)) return n;
    // A custom subject: the first word that carries meaning, and an ellipsis
    // to say it was cut, rather than a word broken in half.
    const words = n.split(/\s+/).filter((w) => !/^(year|yr|vce|unit|units|the|and|of|\d+)$/i.test(w));
    const first = words[0] || n;
    return first.length <= SHORT_MAX ? first : `${first.slice(0, SHORT_MAX - 1)}…`;
}
