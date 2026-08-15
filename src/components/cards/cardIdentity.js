/**
 * cardIdentity — what makes a flashcard a specific playing card.
 *
 * A real card has two marks in its corner, and both of them mean something:
 * the rank tells you how strong it is, the suit tells you what family it
 * belongs to. A flashcard already has both of those facts — how well the
 * student knows it, and which subject it came from — and until now they were
 * shown as a percentage in a stats panel nobody opens.
 *
 * RANK IS MASTERY. Thirteen steps from 2 to Ace, off the same mastery score
 * the deck list already computes. It is deliberately coarser than a
 * percentage: the score is a weighted guess from four signals, and printing
 * "68%" on it claims a precision the maths doesn't have. "Nine of spades"
 * claims exactly as much as it knows. Ace is rare on purpose — you have to be
 * near the top of the scale to get one, which is what makes drawing one mean
 * anything.
 *
 * SUIT IS THE SUBJECT. Hashed from the subject's name rather than from its
 * position in a list, so a subject keeps its suit forever — if suits were
 * assigned by order, adding a new subject would re-suit half the app.
 *
 * The obvious objection is that a VCE student takes five or six subjects and
 * there are only four suits, so two subjects will collide. That's fine, and
 * it's why the suit is drawn small: it is a family mark, not an identifier.
 * The card also carries the subject's own colour and its name in full. Nothing
 * anywhere relies on the suit to tell two subjects apart.
 */

/** Low to high. The index into this array IS the rank. */
export const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

/** Spoken forms, for the bits a screen reader has to say out loud. */
const SPOKEN = { J: "Jack", Q: "Queen", K: "King", A: "Ace" };

export const SUITS = ["spade", "heart", "diamond", "club"];

export const SUIT_LABEL = { spade: "Spades", heart: "Hearts", diamond: "Diamonds", club: "Clubs" };

/** Hearts and diamonds are red. Everything else follows the theme's ink. */
export const SUIT_IS_RED = { spade: false, club: false, heart: true, diamond: true };

/**
 * Mastery (0–100) → a rank. A card that has never been reviewed scores 0 and
 * comes out a 2, which is the correct thing for it to be.
 */
export function rankFor(mastery) {
    const m = Math.max(0, Math.min(100, Number(mastery) || 0));
    return RANKS[Math.round((m / 100) * (RANKS.length - 1))];
}

/** "Queen of Spades — 82% mastered". Used for the tooltip and the aria label. */
export function rankTitle(rank, suit, mastery) {
    const face = SPOKEN[rank] || rank;
    const pct = Number.isFinite(Number(mastery)) ? ` — ${Math.round(mastery)}% mastered` : "";
    return `${face} of ${SUIT_LABEL[suit] || "Spades"}${pct}`;
}

/**
 * Subject name → suit. A tiny FNV-style walk over the string: order-sensitive
 * (so "Methods" and "Setmohd" differ) and stable across sessions, which a
 * sum-of-char-codes would not be.
 */
function fnv(s, seed) {
    let h = seed;
    for (let i = 0; i < s.length; i += 1) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
}

export function suitFor(subject) {
    const s = String(subject || "");
    if (!s) return "spade";
    return SUITS[fnv(s, 2166136261) % SUITS.length];
}

/**
 * Subject name → colour.
 *
 * Until this existed, every subject in the app was `#3B82F6`. Nothing ever
 * wrote a colour at signup and every reader fell back to the same blue, so a
 * student with five subjects had five identical blue decks. The subject colour
 * was in the schema, in PlayingCard's API and drawn in half a dozen
 * components, and it had never once actually been a colour.
 *
 * Derived from the name for the same reason the suit is: a subject keeps its
 * colour forever, on any device, before it has a database row, and adding a
 * new subject never recolours the others. Onboarding can therefore print the
 * real colour of a real subject before the student has an account, and it will
 * still be that colour on their dashboard a year later.
 *
 * A DIFFERENT SEED FROM THE SUIT, which is not a detail. One shared hash would
 * lock colour to suit: with ten colours and four suits, every spade would draw
 * from the same two or three, and any two subjects that collided on suit would
 * collide on colour far more often than chance. Separate seeds keep the two
 * marks independent facts about the subject.
 */
export const SUBJECT_PALETTE = [
    { key: "blue",    hex: "#3B82F6", label: "Blue" },
    { key: "violet",  hex: "#8B5CF6", label: "Violet" },
    { key: "emerald", hex: "#10B981", label: "Emerald" },
    { key: "amber",   hex: "#F0B429", label: "Amber" },
    { key: "pink",    hex: "#EC4899", label: "Pink" },
    { key: "sky",     hex: "#0EA5E9", label: "Sky" },
    { key: "orange",  hex: "#F97316", label: "Orange" },
    { key: "teal",    hex: "#14B8A6", label: "Teal" },
    { key: "purple",  hex: "#A855F7", label: "Purple" },
    { key: "red",     hex: "#EF4444", label: "Red" },
];

export const SUBJECT_COLORS = SUBJECT_PALETTE.map((c) => c.hex);

export function colorFor(subject) {
    const s = String(subject || "");
    if (!s) return SUBJECT_COLORS[0];
    return SUBJECT_COLORS[fnv(s, 40389) % SUBJECT_COLORS.length];
}

/**
 * What the Subjects page used to write into `user_subjects.color`.
 *
 * It stored a DESIGN TOKEN NAME — "primary", "xp", "chart-3" — while every
 * card in the app read the same column expecting hex and handed it to
 * PlayingCard's `tone`, where `alpha()` regex-matches six hex digits, got
 * "primary", returned undefined, and fell back to the default border without
 * complaining. That is why subject colour had never visibly worked on a card
 * for anyone: not a missing value, a value in the wrong language, failing
 * silently at the one place it was consumed.
 *
 * The hexes are the computed values of those tokens in the light theme, so a
 * subject someone deliberately coloured years ago keeps the colour they chose
 * instead of being silently reassigned.
 */
const LEGACY_TOKEN_HEX = {
    primary:   "#58CC02",
    xp:        "#FFA500",
    streak:    "#FF4B4B",
    "chart-3": "#3B82F6",
    "chart-4": "#B45AE0",
};

const KEY_HEX = Object.fromEntries(SUBJECT_PALETTE.map((c) => [c.key, c.hex]));

/**
 * The one function every reader of a subject colour should call.
 *
 * Normalises on READ rather than migrating the column, which is deliberate:
 * a backfill would have to run once, against every row, and would still leave
 * every reader carrying its own `|| '#3B82F6'` fallback for rows written
 * before it landed. Doing it here fixes existing users the moment they load a
 * page, needs no migration, and means the fallback logic exists exactly once
 * instead of in the seven places that each had their own copy of it.
 *
 * Accepts a row, or a bare string, or nothing. In order:
 *   already hex        → use it
 *   a palette key      → its hex
 *   a legacy token     → the token's hex, so a deliberate choice survives
 *   null / unknown     → derived from the subject's name
 */
export function subjectColor(rowOrColor, name) {
    const row = typeof rowOrColor === "string" || rowOrColor == null
        ? { color: rowOrColor }
        : rowOrColor;
    const raw = String(row?.color || "").trim();
    const subject = name || row?.subject_name || row?.name || "";

    if (/^#[0-9a-f]{6}$/i.test(raw)) return raw;
    if (KEY_HEX[raw]) return KEY_HEX[raw];
    if (LEGACY_TOKEN_HEX[raw]) return LEGACY_TOKEN_HEX[raw];
    return colorFor(subject);
}
