/**
 * friends — the rules for one student reaching another.
 *
 * Imported by `server.mjs` AND the client, so it is written with no `@/`
 * alias and nothing outside itself: node cannot resolve the alias, and
 * `serverBoot.test.mjs` refuses a module the server reaches that it cannot
 * load. One copy, so the code the Friends page prints is the code the server
 * looks up, and the notes it offers are the only notes the server accepts.
 *
 * ─── WHY ANY OF THIS IS ON THE SERVER ───────────────────────────────────────
 * Friendship rows used to be written by the browser, under a policy that let
 * EITHER party update one. So the student who SENT a request could mark it
 * accepted themselves: anybody could make themselves anybody's friend. On an
 * app whose pranks are bounded by "friends only, mutual and accepted", that
 * bound was a formality, the friend-count achievements were farmable, and the
 * names on a request were whatever the sender typed — a request could arrive
 * from "Mr Smith". Every write goes through `requestFriend` / `respondFriend` /
 * `removeFriend` now, the names come off the profiles, and migration 0042
 * takes the browser's write policies away.
 *
 * ─── A CODE, NOT A SEARCH ───────────────────────────────────────────────────
 * Students mostly do not know each other's email addresses, and searching by
 * username would let anyone find any student by trying names — on a product
 * whose users are mostly minors, a directory is the wrong thing to build. A
 * friend code is shared out of band, on purpose, by the person it belongs to:
 * a link sent in a group chat, or six characters read off a screen. Nobody can
 * be found who did not hand their code over.
 */

/** No 0/O, 1/I/L — a code is read aloud and copied off a phone. */
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CODE_LENGTH = 5;
export const CODE_PREFIX = "ACE-";

/** A fresh code. `rand` is injectable so the test can pin one. */
export function makeFriendCode(rand = Math.random) {
    let out = "";
    for (let i = 0; i < CODE_LENGTH; i += 1) {
        out += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length) % CODE_ALPHABET.length];
    }
    return `${CODE_PREFIX}${out}`;
}

/**
 * Whatever a student typed or pasted, as a code — or null. Case, spaces,
 * dashes and the "ACE" prefix are all optional, and a whole link is accepted
 * too, because "paste what your friend sent you" should work for whatever
 * your friend sent you. A character outside the alphabet is refused rather
 * than guessed at: an O read as a 0 is a request to a stranger.
 */
export function normaliseFriendCode(input) {
    let s = String(input || "").trim();
    const fromLink = s.match(/[?&]add=([^&#\s]+)/i);
    if (fromLink) s = decodeURIComponent(fromLink[1]);
    s = s.toUpperCase().replace(/[\s-]/g, "");
    if (s.startsWith("ACE")) s = s.slice(3);
    if (s.length !== CODE_LENGTH) return null;
    for (const ch of s) if (!CODE_ALPHABET.includes(ch)) return null;
    return `${CODE_PREFIX}${s}`;
}

/** The link that sends a request when it is opened. */
export function friendLink(code, origin = "") {
    const c = normaliseFriendCode(code);
    if (!c) return null;
    return `${String(origin || "").replace(/\/+$/, "")}/Friends?add=${encodeURIComponent(c)}`;
}

// ─── Limits ──────────────────────────────────────────────────────────────────

/** Requests a student may send in a day — enough for a class, not a spray. */
export const REQUESTS_PER_DAY = 20;
/** Unanswered outgoing requests a student may have waiting at once. */
export const PENDING_MAX = 30;
/** Code lookups an hour. A lookup names the code's owner, so it is bounded:
 *  twenty-eight million codes is not a space anybody walks at thirty an hour. */
export const LOOKUPS_PER_HOUR = 30;

// ─── What a share may carry ──────────────────────────────────────────────────

/**
 * THE NOTES ARE THE WHOLE VOCABULARY. A share used to carry a free-text box,
 * which made it a direct-message channel between students the app had no way
 * to moderate — the reason migration 0034 refused free text on Compete and
 * pranks were built without any. What a student actually wanted to say with a
 * deck fits in a short, fixed list, and nothing on it can be used against
 * anybody.
 */
export const SHARE_NOTES = [
    { id: "helped",  text: "This one helped me" },
    { id: "luck",    text: "Good luck!" },
    { id: "before",  text: "Try this before the SAC" },
    { id: "class",   text: "Made this for our class" },
    { id: "beat",    text: "Beat my score" },
];

/** A note id → its text, or null for anything not on the list. */
export const noteText = (id) => SHARE_NOTES.find((n) => n.id === id)?.text || null;

/**
 * What may be SHOWN of a share's message. Old rows carry whatever was typed,
 * and printing them now would keep the channel open for every share sent
 * before it closed — so only a message that IS one of the notes is drawn.
 */
export const shownNote = (message) =>
    SHARE_NOTES.some((n) => n.text === message) ? message : null;

/** The share kinds the server accepts, and the table each lands in. */
export const SHARE_TABLES = {
    quiz: "shared_quizzes",
    deck: "shared_flashcards",
    result: "shared_ai_results",
};

/** The most cards one shared deck may carry. */
export const DECK_SHARE_MAX = 500;

// ─── Reading friendship rows ─────────────────────────────────────────────────

const lower = (s) => String(s || "").trim().toLowerCase();

/**
 * Split one student's friendship rows into friends, requests waiting on them,
 * and requests waiting on somebody else. A pair can appear in both directions
 * if a duplicate was ever written, so friends are one per person.
 */
export function splitFriendships(me, rows = []) {
    const self = lower(me);
    const friends = new Map();
    const incoming = [];
    const outgoing = [];
    for (const r of rows || []) {
        if (!r) continue;
        const req = lower(r.requester_email);
        const rec = lower(r.recipient_email);
        if (req !== self && rec !== self) continue;
        const other = req === self ? rec : req;
        if (!other || other === self) continue;
        if (r.status === "accepted") {
            if (!friends.has(other)) friends.set(other, { id: r.id, email: other, since: r.updated_date || r.created_date || null });
        } else if (r.status === "pending") {
            (rec === self ? incoming : outgoing).push({ id: r.id, email: other, at: r.created_date || null });
        }
    }
    return { friends: [...friends.values()], incoming, outgoing };
}

/** How a student is named to a friend: their handle, else their first name. */
export function friendName(profile, email) {
    const u = String(profile?.username || "").trim();
    if (u) return u;
    const full = String(profile?.full_name || "").trim();
    if (full) return full;
    return String(email || "").split("@")[0] || "A student";
}
