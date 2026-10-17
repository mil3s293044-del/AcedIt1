/**
 * groups — a study group: who is in one, how you get in, and what can be said.
 *
 * ─── IT HAD NEVER WORKED, AND WHAT DID WORK WAS UNSAFE ──────────────────────
 * The page wrote `study_groups` straight from the browser, and every part of
 * that was wrong in a way that renders perfectly:
 *
 *   * JOINING BY CODE COULD NOT SUCCEED. A group is readable only by its
 *     members, so a code looked up by somebody who is not yet one came back
 *     empty, every time — "Invalid code" for every code ever shared.
 *   * ANY MEMBER COULD REWRITE THE GROUP. The update policy asked only that the
 *     caller still be in it afterwards, so a member could rename it, empty the
 *     member list, or make themselves the owner.
 *   * ANYBODY COULD POST AS "SYSTEM". The message policy accepted
 *     `sender_email = 'system'` from any member, so "Sam was removed for
 *     cheating" was one insert away, in the app's own voice.
 *   * THE CHAT WAS FREE TEXT BETWEEN MINORS, checked in the BROWSER for a list
 *     of swear words and never again — skippable by anybody who wrote the row
 *     directly, blind to bullying that swears at nobody, and impossible to
 *     delete. The exact thing migration 0034 refused for Compete in its own
 *     words, and the pranks and share notes were each built not to be.
 *   * AN IMPORT SAID "FAILED" AFTER IT HAD WORKED. The cards were created and
 *     then the import count was written to a row only its sharer may update,
 *     so everybody the share was FOR got an error, tapped again, and got the
 *     deck twice.
 *
 * Every write is the server's now (see the Study groups section of
 * server.mjs), and this file is the rules it applies — pure, so they can be
 * tested without a database.
 *
 * ─── WHAT A GROUP CAN SAY ───────────────────────────────────────────────────
 * A fixed set of PHRASES, chosen for studying together, and REACTIONS on what
 * somebody shared. Nothing anybody types reaches anybody else except a group's
 * NAME, which is one bounded line and refuses links, handles, emails and phone
 * numbers — the ways a group of fifteen-year-olds gets moved somewhere nobody
 * can see. Old free-text messages and old client-written "system" lines are
 * not drawn at all, the rule `shownNote` keeps for shares: printing them now
 * would keep the channel open for everything sent before it closed.
 */
import { CODE_ALPHABET } from "./friends.js";

// ─── Codes and links ─────────────────────────────────────────────────────────

export const GROUP_PREFIX = "GRP-";
export const GROUP_CODE_LENGTH = 6;

/** A fresh code: GRP- and six characters with nothing that reads as another. */
export function makeGroupCode(rand = Math.random) {
    let out = "";
    for (let i = 0; i < GROUP_CODE_LENGTH; i += 1) {
        out += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length) % CODE_ALPHABET.length];
    }
    return GROUP_PREFIX + out;
}

/**
 * A code however it was typed or pasted, or null. Codes minted before this
 * file are eight characters of base 36 with no prefix, and every one of them
 * is still on a group somebody made, so those are accepted as they are.
 * A pasted link gives up its `join=`.
 */
export function normaliseGroupCode(input) {
    let raw = String(input ?? "").trim();
    if (!raw) return null;
    const fromLink = raw.match(/[?&]join=([^&#\s]+)/i);
    if (fromLink) {
        try { raw = decodeURIComponent(fromLink[1]); } catch { raw = fromLink[1]; }
    }
    const flat = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (flat.startsWith("GRP")) {
        const rest = flat.slice(3);
        if (rest.length === GROUP_CODE_LENGTH && [...rest].every((c) => CODE_ALPHABET.includes(c))) {
            return GROUP_PREFIX + rest;
        }
    }
    // Typed WITH the prefix, it is a new code that is wrong — refused rather
    // than read as an old one, which would turn a typo into "no group has
    // that code" instead of "that isn't a code".
    if (/^\s*grp[\s-]/i.test(raw)) return null;
    // Legacy: `Math.random().toString(36).substring(2, 10)`, upper-cased.
    if (/^[A-Z0-9]{6,10}$/.test(flat) && !flat.startsWith("ACE")) return flat;
    return null;
}

export function groupLink(code, origin = "") {
    return `${origin}/StudyGroups?join=${encodeURIComponent(code)}`;
}

// ─── Caps ────────────────────────────────────────────────────────────────────

/** A class, not a crowd. Past this a group is a board and Ranked has one. */
export const GROUP_MAX_MEMBERS = 30;
/** Owned and joined together. */
export const GROUPS_PER_STUDENT = 12;
export const GROUPS_CREATED_PER_DAY = 3;
/** A lookup names the group and its owner, so it is rate limited. */
export const GROUP_LOOKUPS_PER_HOUR = 30;
/** Per student, per group. A phrase every three minutes is a conversation. */
export const PHRASES_PER_HOUR = 20;
export const GROUP_NAME_MAX = 48;
/** How much of the feed a group page draws. */
export const FEED_MAX = 40;

/**
 * A group's name, or why it cannot be one. The one free line in a group, so it
 * refuses what would move a conversation somewhere nobody can see: a link, a
 * handle, an email, a phone number.
 */
export function cleanGroupName(input) {
    const name = String(input ?? "")
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, GROUP_NAME_MAX)
        .trim();
    if (name.length < 2) return { error: "Give the group a name." };
    if (/https?:|www\.|\.(com|net|org|gg|au|io|me|ly|app|co)\b|@|discord|snap(chat)?\b|insta(gram)?\b|tiktok|\d{6,}/i.test(name)) {
        return { error: "Group names can't hold links, handles, emails or phone numbers." };
    }
    return { name };
}

// ─── Membership ──────────────────────────────────────────────────────────────

const low = (e) => String(e ?? "").trim().toLowerCase();

export function isMember(group, email) {
    const me = low(email);
    if (!me) return false;
    return low(group?.owner_email) === me || (group?.member_emails || []).some((e) => low(e) === me);
}

export const isOwner = (group, email) => !!email && low(group?.owner_email) === low(email);

/** Why `email` cannot join, or null. Member first, so a full group never
 *  tells somebody already in it that it is full. */
export function joinRefusal(group, email) {
    if (!group) return "not_found";
    if (isMember(group, email)) return "member";
    if ((group?.extra?.removed || []).some((e) => low(e) === low(email))) return "removed";
    if ((group?.member_emails || []).length >= GROUP_MAX_MEMBERS) return "full";
    return null;
}

/** The two arrays with one member added, kept index-aligned. */
export function withMember(group, email, name) {
    const emails = [...(group?.member_emails || [])];
    const names = [...(group?.member_names || [])];
    if (emails.some((e) => low(e) === low(email))) return { member_emails: emails, member_names: names };
    while (names.length < emails.length) names.push("");
    return { member_emails: [...emails, email], member_names: [...names.slice(0, emails.length), name || ""] };
}

/** The two arrays with one member gone, kept index-aligned. */
export function withoutMember(group, email) {
    const emails = group?.member_emails || [];
    const names = group?.member_names || [];
    const keep = emails.map((e, i) => [e, names[i] ?? ""]).filter(([e]) => low(e) !== low(email));
    return { member_emails: keep.map(([e]) => e), member_names: keep.map(([, n]) => n) };
}

// ─── What can be said ────────────────────────────────────────────────────────

export const GROUP_PHRASES = [
    { id: "on",      text: "I'm studying now" },
    { id: "tonight", text: "Who's studying tonight?" },
    { id: "focus",   text: "Phones down, 25 minutes?" },
    { id: "stuck",   text: "Stuck. Anyone free to help?" },
    { id: "sac",     text: "SAC prep together this week?" },
    { id: "quiz",    text: "Try the quiz I shared" },
    { id: "break",   text: "On a break, back soon" },
    { id: "done",    text: "Done for today" },
    { id: "nice",    text: "Nice work, everyone" },
    { id: "luck",    text: "Good luck!" },
];

export const phraseText = (id) => GROUP_PHRASES.find((p) => p.id === id)?.text || null;

/** What the server writes about the group, and only the server. */
const EVENT_TEXT = {
    created: (name) => `${name} started the group`,
    joined:  (name) => `${name} joined`,
    left:    (name) => `${name} left`,
    shared:  (name, title) => (title ? `${name} shared ${title}` : `${name} shared something`),
};

export const GROUP_EVENTS = Object.keys(EVENT_TEXT);

/**
 * One feed row as the page may draw it, or null. A phrase is drawn by its ID,
 * so a row whose stored text was edited still prints the phrase; an event is
 * drawn only if it is a kind the server writes. Anything else — every old
 * free-text message, every old client-written "system" line — is null.
 * Nothing here returns an email; `mine` is worked out from one.
 */
export function feedItem(row, me) {
    if (!row) return null;
    const name = String(row.sender_name || "").trim() || "Someone";
    const at = row.timestamp || row.created_date || null;
    if (row.message_type === "phrase") {
        const text = phraseText(row.extra?.phrase);
        if (!text) return null;
        return { id: row.id, kind: "phrase", text, name, at, mine: !!me && low(row.sender_email) === low(me) };
    }
    if (row.message_type === "event") {
        const make = EVENT_TEXT[row.extra?.event];
        if (!make) return null;
        const title = String(row.extra?.title || "").trim().slice(0, 80) || null;
        return { id: row.id, kind: "event", text: make(name, title), at };
    }
    return null;
}

/** The feed, oldest first, as drawn: at most FEED_MAX, newest kept. */
export function shapeFeed(rows = [], me) {
    const items = (rows || []).map((r) => feedItem(r, me)).filter(Boolean);
    items.sort((a, b) => String(a.at || "").localeCompare(String(b.at || "")));
    return items.slice(-FEED_MAX);
}

// ─── Reactions on what somebody shared ───────────────────────────────────────

export const GROUP_REACTIONS = ["🙏", "🔥", "💡", "👏"];

/** The reactions map with `email` toggled on `glyph`, or null for a glyph not
 *  in the set. Stored as glyph → addresses on the shared row's `extra`. */
export function toggleReaction(map, glyph, email) {
    if (!GROUP_REACTIONS.includes(glyph) || !low(email)) return null;
    const next = {};
    for (const g of GROUP_REACTIONS) {
        const list = Array.isArray(map?.[g]) ? map[g].map(low).filter(Boolean) : [];
        next[g] = [...new Set(list)];
    }
    const me = low(email);
    next[glyph] = next[glyph].includes(me) ? next[glyph].filter((e) => e !== me) : [...next[glyph], me];
    return next;
}

/** Counts in the set's order, and whether I am one of them. No addresses. */
export function reactionSummary(map, email) {
    const me = low(email);
    return GROUP_REACTIONS.map((glyph) => {
        const list = Array.isArray(map?.[glyph]) ? [...new Set(map[glyph].map(low).filter(Boolean))] : [];
        return { glyph, count: list.length, mine: !!me && list.includes(me) };
    });
}

// ─── The shelf ───────────────────────────────────────────────────────────────

/** Resource types on the table → the kinds the page knows. */
export const SHELF_KINDS = { flashcard_deck: "deck", quiz: "quiz", ai_result: "result" };
export const SHELF_TYPES = { deck: "flashcard_deck", quiz: "quiz", result: "ai_result" };

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** One shared row as the page may draw it. No addresses. */
export function shelfItem(row, me) {
    const kind = SHELF_KINDS[row?.resource_type];
    if (!kind) return null;
    const data = row.resource_data || {};
    const cards = Array.isArray(data.flashcards) ? data.flashcards : Array.isArray(data.cards) ? data.cards : [];
    const size = kind === "deck" ? plural(cards.length, "card")
        : kind === "quiz" ? plural(Array.isArray(data.questions) ? data.questions.length : 0, "question")
            : String(data.tool_type || "Saved result").replace(/_/g, " ");
    const importers = (row.extra?.imported_by_emails || []).map(low);
    return {
        id: row.id,
        kind,
        title: String(row.title || "Untitled").slice(0, 120),
        size,
        subject: row.subject_name || null,
        by: String(row.shared_by_name || "").trim() || "Someone",
        mine: !!me && low(row.shared_by_email) === low(me),
        imported: !!me && importers.includes(low(me)),
        imports: Math.max(importers.length, Number(row.extra?.imports_count) || 0),
        reactions: reactionSummary(row.extra?.reactions, me),
        at: row.created_date || null,
    };
}

// ─── This week in the group ──────────────────────────────────────────────────

/**
 * Who has been locking in. `members` carries each member's COUNTED minutes
 * since Monday — the figure the league ranks on, computed by the server's
 * `countableStudyMinutes` — and their active days.
 *
 * Somebody who has not started is COUNTED, never NAMED. "Three haven't
 * started yet" is a fact about the group; a list of who is a list of who to
 * have a go at, on a page their whole class can open.
 */
export function rankWeek(members = []) {
    const clean = (members || []).map((m) => ({
        ...m,
        minutes: Math.max(0, Math.round(Number(m?.minutes) || 0)),
        days: Math.max(0, Math.round(Number(m?.days) || 0)),
    }));
    const going = clean.filter((m) => m.minutes > 0 || m.days > 0)
        .sort((a, b) => (b.minutes - a.minutes) || (b.days - a.days) || String(a.name).localeCompare(String(b.name)));
    const top = going[0]?.minutes || 0;
    return {
        studied: going.map((m, i) => ({ ...m, place: i + 1, share: top > 0 ? m.minutes / top : 0 })),
        notStarted: clean.length - going.length,
        total: going.reduce((s, m) => s + m.minutes, 0),
        meStarted: clean.some((m) => m.me && (m.minutes > 0 || m.days > 0)),
    };
}

/** "3h 20m", "45m", "0m" — joined by a NO-BREAK space, because a headline
 *  that wraps between "20h" and "40m" splits one figure across two lines. */
export function minutesLabel(mins) {
    const m = Math.max(0, Math.round(Number(mins) || 0));
    const h = Math.floor(m / 60);
    const r = m % 60;
    if (!h) return `${r}m`;
    return r ? `${h}h\u00a0${r}m` : `${h}h`;
}

/** Calendar days from one ISO day to another, read as dates, never as times. */
export function daysBetween(fromIso, toIso) {
    const p = (s) => {
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s ?? ""));
        return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
    };
    const d = (p(toIso) - p(fromIso)) / 86400000;
    return Number.isFinite(d) ? Math.round(d) : null;
}

/**
 * SACs coming up, for the members who chose to share them with this group.
 * The server sends the due DATE and the page counts the days off its own
 * local today, because the server's today is UTC and a Melbourne morning is
 * still yesterday there. A row with no date is dropped, never read as today.
 */
export function sacsSoon(rows = [], todayIso, soonDays) {
    return (rows || [])
        .map((r) => ({ ...r, days: daysBetween(todayIso, r?.due) }))
        .filter((r) => r.days != null && r.days >= 0 && r.days <= soonDays)
        .sort((a, b) => (a.days - b.days) || String(a.name).localeCompare(String(b.name)));
}

export const dueLabel = (days) => (days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`);
