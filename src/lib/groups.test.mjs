/**
 * study group assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/groups.test.mjs
 *
 * ═══ A GROUP COULD BE TAKEN OVER, AND COULD NOT BE JOINED ═══════════════════
 * The browser wrote `study_groups` directly: any member could rewrite the row
 * (the member list, the owner), anybody could post as "system", the chat was
 * free text checked only in the sender's own browser, and joining by code had
 * never once worked because a group is invisible to a non-member. Every write
 * and every read is the server's now. The model checks below hold the rules;
 * the scans hold the wiring, because a client that quietly goes back to
 * writing a group table renders perfectly and simply reopens the hole.
 *
 * Every check below was verified by putting the bug back.
 */
process.env.TZ = "Australia/Melbourne";

import assert from "node:assert/strict";
import fs from "node:fs";
import {
    makeGroupCode, normaliseGroupCode, groupLink, GROUP_PREFIX, GROUP_CODE_LENGTH, cleanGroupName, GROUP_NAME_MAX,
    isMember, isOwner, joinRefusal, withMember, withoutMember, GROUP_MAX_MEMBERS,
    GROUP_PHRASES, phraseText, feedItem, shapeFeed, FEED_MAX,
    GROUP_REACTIONS, toggleReaction, reactionSummary, shelfItem,
    rankWeek, minutesLabel, daysBetween, sacsSoon, dueLabel,
} from "@/lib/groups";
import { CODE_ALPHABET } from "@/lib/friends";
import { rememberGroupLink, takePendingGroup, PENDING_GROUP_KEY, PENDING_GROUP_TTL_MS } from "@/lib/pendingGroup";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};
const read = (rel) => fs.readFileSync(rel, "utf8");
const strip = (src) => src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1")
    .replace(/^\s*--[^\n]*$/gm, "");
const walk = (dir, out = []) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = `${dir}/${e.name}`;
        if (e.isDirectory()) walk(p, out);
        else if (/\.(jsx?|mjs)$/.test(e.name) && !/\.test\.mjs$/.test(e.name)) out.push(p);
    }
    return out;
};
/** One block by brace depth, starting at the first `{` after `from`. */
function block(src, at) {
    let i = src.indexOf("{", at);
    let depth = 0;
    const start = i;
    for (; i < src.length; i += 1) {
        if (src[i] === "{") depth += 1;
        else if (src[i] === "}") { depth -= 1; if (depth === 0) break; }
    }
    return src.slice(start, i + 1);
}
function handler(src, name) {
    const at = src.indexOf(`app.post("/local-ai/fn/${name}"`);
    assert.ok(at >= 0, `no ${name} handler`);
    return block(src, src.indexOf("=>", at));
}
function fn(src, name) {
    const at = src.indexOf(`function ${name}(`);
    assert.ok(at >= 0, `no ${name} function`);
    return block(src, src.indexOf(")", at));
}
const memoryStore = () => {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

// ─── Codes ───────────────────────────────────────────────────────────────────

check("a code is GRP- and six characters from the friend-code alphabet", () => {
    for (let i = 0; i < 200; i += 1) {
        const c = makeGroupCode();
        assert.ok(c.startsWith(GROUP_PREFIX), c);
        const rest = c.slice(GROUP_PREFIX.length);
        assert.equal(rest.length, GROUP_CODE_LENGTH, c);
        assert.ok([...rest].every((ch) => CODE_ALPHABET.includes(ch)), c);
    }
});

check("a code is accepted however it was typed, pasted, or linked", () => {
    for (const raw of ["GRP-7KQ2XM", "grp-7kq2xm", " GRP 7KQ2XM ", "GRP7KQ2XM", "https://acedit.au/StudyGroups?join=GRP-7KQ2XM", "/StudyGroups?join=GRP-7KQ2XM&x=1"]) {
        assert.equal(normaliseGroupCode(raw), "GRP-7KQ2XM", raw);
    }
});

check("an old eight-character code still works — every existing group carries one", () => {
    assert.equal(normaliseGroupCode("k3j9x2ab"), "K3J9X2AB");
    assert.equal(normaliseGroupCode("K3J9X2"), "K3J9X2");
});

check("a friend code, junk and nothing are refused rather than guessed", () => {
    for (const raw of ["ACE-7KQ2X", "ACE7KQ2X", "", null, undefined, "ab", "GRP-7KQ2X", "this is not a code at all"]) {
        assert.equal(normaliseGroupCode(raw), null, String(raw));
    }
});

check("the link carries the code and comes back to it", () => {
    const link = groupLink("GRP-7KQ2XM", "https://acedit.au");
    assert.equal(link, "https://acedit.au/StudyGroups?join=GRP-7KQ2XM");
    assert.equal(normaliseGroupCode(link), "GRP-7KQ2XM");
});

// ─── Names ───────────────────────────────────────────────────────────────────

check("a name is one bounded line", () => {
    assert.equal(cleanGroupName("  12B   Chem\n crew ").name, "12B Chem crew");
    assert.equal(cleanGroupName("x".repeat(200)).name.length, GROUP_NAME_MAX);
    assert.ok(cleanGroupName(" a ").error);
    assert.ok(cleanGroupName("").error);
});

check("a name cannot carry a way to move the group somewhere nobody can see", () => {
    for (const bad of ["join discord.gg/abc", "www.site.com", "chem @maya", "maya@school.vic.edu.au", "call 0412345678", "add my snap", "https://x.io"]) {
        assert.ok(cleanGroupName(bad).error, bad);
    }
    assert.ok(cleanGroupName("Methods 3/4 crew").name);
});

// ─── Membership ──────────────────────────────────────────────────────────────

const G = { owner_email: "Owner@x.com", member_emails: ["Owner@x.com", "a@x.com"], member_names: ["Olly", "Ava"], extra: {} };

check("membership is read case-insensitively, owner included", () => {
    assert.ok(isMember(G, "owner@x.com"));
    assert.ok(isMember(G, "A@X.COM"));
    assert.ok(!isMember(G, "b@x.com"));
    assert.ok(isOwner(G, "OWNER@x.com"));
    assert.ok(!isOwner(G, "a@x.com"));
    assert.ok(!isMember(G, ""));
});

check("a member is told they are a member, never that the group is full", () => {
    const full = { ...G, member_emails: Array.from({ length: GROUP_MAX_MEMBERS }, (_, i) => (i === 0 ? "a@x.com" : `m${i}@x.com`)) };
    assert.equal(joinRefusal(full, "a@x.com"), "member");
    assert.equal(joinRefusal(full, "new@x.com"), "full");
    assert.equal(joinRefusal({ ...G, extra: { removed: ["b@x.com"] } }, "B@x.com"), "removed");
    assert.equal(joinRefusal(G, "b@x.com"), null);
    assert.equal(joinRefusal(null, "b@x.com"), "not_found");
});

check("adding and removing keep the two lists aligned and never double up", () => {
    const added = withMember(G, "b@x.com", "Bea");
    assert.deepEqual(added.member_emails, ["Owner@x.com", "a@x.com", "b@x.com"]);
    assert.deepEqual(added.member_names, ["Olly", "Ava", "Bea"]);
    assert.deepEqual(withMember(G, "A@x.com", "Dup").member_emails, G.member_emails);
    const gone = withoutMember(added, "A@X.com");
    assert.deepEqual(gone.member_emails, ["Owner@x.com", "b@x.com"]);
    assert.deepEqual(gone.member_names, ["Olly", "Bea"]);
});

// ─── What can be said ────────────────────────────────────────────────────────

check("a phrase is an id from the set, and nothing else is a phrase", () => {
    assert.ok(GROUP_PHRASES.length >= 6);
    assert.equal(phraseText("focus"), "Phones down, 25 minutes?");
    assert.equal(phraseText("whatever I like"), null);
    assert.equal(phraseText(undefined), null);
    assert.equal(new Set(GROUP_PHRASES.map((p) => p.id)).size, GROUP_PHRASES.length);
});

check("no phrase uses a banned word", () => {
    const banned = /\b(don'?t|fix it|no excuses|embarrassing|move)\b/i;
    for (const p of GROUP_PHRASES) assert.ok(!banned.test(p.text), p.text);
});

check("old free text and old client-written 'system' lines are never drawn", () => {
    assert.equal(feedItem({ id: 1, message_type: "text", message: "you're all losers", sender_name: "X" }, "me@x.com"), null);
    assert.equal(feedItem({ id: 2, message_type: "system", sender_email: "system", message: "Sam was removed for cheating" }, "me@x.com"), null);
    assert.equal(feedItem({ id: 3, message_type: "user", message: "hi" }), null);
    // A phrase is drawn by its ID — an edited stored text cannot reach the page.
    const p = feedItem({ id: 4, message_type: "phrase", message: "something else entirely", extra: { phrase: "done" }, sender_name: "Ava", sender_email: "a@x.com", timestamp: "2026-10-17T01:00:00Z" }, "A@x.com");
    assert.equal(p.text, "Done for today");
    assert.equal(p.mine, true);
    assert.equal(feedItem({ id: 5, message_type: "phrase", extra: { phrase: "nope" } }), null);
    assert.equal(feedItem({ id: 6, message_type: "event", extra: { event: "kicked" }, sender_name: "Olly" }), null);
    assert.equal(feedItem({ id: 7, message_type: "event", extra: { event: "joined" }, sender_name: "Bea" }).text, "Bea joined");
});

check("a feed item carries no email", () => {
    const items = [
        feedItem({ id: 1, message_type: "phrase", extra: { phrase: "on" }, sender_name: "Ava", sender_email: "a@x.com" }, "a@x.com"),
        feedItem({ id: 2, message_type: "event", extra: { event: "shared", title: "Redox" }, sender_name: "Ava", sender_email: "a@x.com" }, "a@x.com"),
    ];
    for (const it of items) assert.ok(!JSON.stringify(it).includes("@"), JSON.stringify(it));
});

check("the feed is oldest first and keeps the newest FEED_MAX", () => {
    const rows = Array.from({ length: FEED_MAX + 10 }, (_, i) => ({
        id: i, message_type: "phrase", extra: { phrase: "on" }, sender_name: "A",
        timestamp: new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString(),
    })).reverse();
    const feed = shapeFeed(rows, "me@x.com");
    assert.equal(feed.length, FEED_MAX);
    assert.equal(feed[0].id, 10);
    assert.equal(feed.at(-1).id, FEED_MAX + 9);
});

// ─── Reactions ───────────────────────────────────────────────────────────────

check("a reaction toggles, and only a glyph in the set is accepted", () => {
    const on = toggleReaction({}, GROUP_REACTIONS[0], "A@x.com");
    assert.deepEqual(on[GROUP_REACTIONS[0]], ["a@x.com"]);
    const off = toggleReaction(on, GROUP_REACTIONS[0], "a@x.com");
    assert.deepEqual(off[GROUP_REACTIONS[0]], []);
    assert.equal(toggleReaction({}, "💩", "a@x.com"), null);
    assert.equal(toggleReaction({}, GROUP_REACTIONS[0], ""), null);
});

check("the summary is counts and 'mine', in the set's order, with no addresses", () => {
    const map = { [GROUP_REACTIONS[1]]: ["a@x.com", "A@x.com", "b@x.com"] };
    const s = reactionSummary(map, "b@x.com");
    assert.deepEqual(s.map((r) => r.glyph), GROUP_REACTIONS);
    assert.equal(s[1].count, 2, "the same student counted twice");
    assert.equal(s[1].mine, true);
    assert.ok(!JSON.stringify(s).includes("@"));
});

// ─── The shelf ───────────────────────────────────────────────────────────────

check("a shelf item says what it is, whether I added it, and carries no address", () => {
    const deck = shelfItem({
        id: "r1", resource_type: "flashcard_deck", title: "Chemistry - Redox", shared_by_email: "a@x.com", shared_by_name: "Ava",
        resource_data: { flashcards: [{ question: "q", answer: "a" }, { question: "q2", answer: "a2" }] },
        extra: { imported_by_emails: ["Me@x.com"], reactions: {} },
    }, "me@x.com");
    assert.equal(deck.kind, "deck");
    assert.equal(deck.size, "2 cards");
    assert.equal(deck.imported, true);
    assert.equal(deck.mine, false);
    assert.equal(deck.imports, 1);
    assert.ok(!JSON.stringify(deck).includes("@"));
    assert.equal(shelfItem({ resource_type: "quiz", resource_data: { questions: [1] } }, "x").size, "1 question");
    assert.equal(shelfItem({ resource_type: "note" }, "x"), null);
});

// ─── This week ───────────────────────────────────────────────────────────────

check("somebody who has not started is COUNTED, never NAMED", () => {
    const w = rankWeek([
        { id: 1, name: "Ava", minutes: 120, days: 3 },
        { id: 2, name: "Bea", minutes: 0, days: 0 },
        { id: 3, name: "Cal", minutes: 300, days: 2, me: true },
        { id: 4, name: "Dee", minutes: null, days: undefined },
    ]);
    assert.deepEqual(w.studied.map((m) => m.name), ["Cal", "Ava"]);
    assert.equal(w.notStarted, 2);
    assert.deepEqual(Object.keys(w).sort(), ["meStarted", "notStarted", "studied", "total"], "a list of who hasn't started is back");
    assert.equal(w.total, 420);
    assert.equal(w.studied[0].place, 1);
    assert.equal(w.studied[0].share, 1);
    assert.equal(w.studied[1].share, 120 / 300);
    assert.equal(w.meStarted, true);
});

check("a day of quizzes with no timed minutes still counts as having started", () => {
    const w = rankWeek([{ id: 1, name: "Ava", minutes: 0, days: 1 }, { id: 2, name: "Bea", minutes: 0, days: 0, me: true }]);
    assert.deepEqual(w.studied.map((m) => m.name), ["Ava"]);
    assert.equal(w.meStarted, false);
    assert.equal(w.studied[0].share, 0);
});

check("minutes read as a person would say them", () => {
    assert.equal(minutesLabel(0), "0m");
    assert.equal(minutesLabel(45), "45m");
    assert.equal(minutesLabel(60), "1h");
    assert.equal(minutesLabel(200), "3h\u00a020m", "a headline can wrap between the hours and the minutes");
    assert.equal(minutesLabel(null), "0m");
});

// ─── SACs ────────────────────────────────────────────────────────────────────

check("days to a SAC are calendar days off a LOCAL today", () => {
    assert.equal(daysBetween("2026-10-17", "2026-10-18"), 1);
    assert.equal(daysBetween("2026-10-17", "2026-10-17"), 0);
    assert.equal(daysBetween("2026-10-31", "2026-11-02"), 2);
    assert.equal(daysBetween("2026-10-17", ""), null);
    assert.equal(daysBetween("2026-10-17", null), null);
});

check("only SACs inside the window, soonest first, and an undated one is dropped", () => {
    const rows = [
        { name: "Ava", subject: "Chemistry", due: "2026-10-24" },
        { name: "Bea", subject: "Methods", due: "2026-10-17" },
        { name: "Cal", subject: "Physics", due: "2026-10-16" },
        { name: "Dee", subject: "Legal", due: "2026-11-30" },
        { name: "Eve", subject: "English", due: null },
    ];
    const soon = sacsSoon(rows, "2026-10-17", 14);
    assert.deepEqual(soon.map((s) => s.name), ["Bea", "Ava"]);
    assert.equal(dueLabel(soon[0].days), "today");
    assert.equal(dueLabel(1), "tomorrow");
    assert.equal(dueLabel(7), "in 7 days");
});

// ─── The link kept across a sign-in ──────────────────────────────────────────

check("a group link is remembered, and only a group link", () => {
    const s = memoryStore();
    assert.equal(rememberGroupLink({ pathname: "/StudyGroups", search: "?join=grp-7kq2xm" }, s, 1000), "GRP-7KQ2XM");
    assert.ok(s.getItem(PENDING_GROUP_KEY));
    const t = memoryStore();
    assert.equal(rememberGroupLink({ pathname: "/Friends", search: "?join=GRP-7KQ2XM" }, t), null);
    assert.equal(rememberGroupLink({ pathname: "/StudyGroups", search: "?join=nope" }, t), null);
    assert.equal(t.getItem(PENDING_GROUP_KEY), null);
});

check("it is taken ONCE, a stale one is dropped, and blocked storage never crashes", () => {
    const s = memoryStore();
    rememberGroupLink({ pathname: "/StudyGroups", search: "?join=GRP-7KQ2XM" }, s, 1000);
    assert.equal(takePendingGroup(s, 2000), "GRP-7KQ2XM");
    assert.equal(takePendingGroup(s, 3000), null);
    rememberGroupLink({ pathname: "/StudyGroups", search: "?join=GRP-7KQ2XM" }, s, 1000);
    assert.equal(takePendingGroup(s, 1000 + PENDING_GROUP_TTL_MS + 1), null);
    const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => {} };
    assert.equal(rememberGroupLink({ pathname: "/StudyGroups", search: "?join=GRP-7KQ2XM" }, blocked), null);
    assert.equal(takePendingGroup(blocked), null);
});

// ─── The browser touches no group table ──────────────────────────────────────

check("no client file reads or writes a group table directly", () => {
    const bad = /\b(StudyGroup|GroupMessage|GroupSharedResource|GroupFlashcardDeck)\.(filter|list|get|create|bulkCreate|update|bulkUpdate|delete)\(/;
    const hits = walk("src").filter((f) => bad.test(strip(read(f))));
    assert.deepEqual(hits, [], `a direct group read or write is back in ${hits.join(", ")}`);
    assert.ok(!/q\("StudyGroup"/.test(strip(read("src/pages/Help.jsx"))));
});

check("the old chat, resources and decks components are gone", () => {
    for (const f of ["GroupChat", "GroupResources", "GroupDecks"]) {
        assert.ok(!fs.existsSync(`src/components/groups/${f}.jsx`), `${f}.jsx is back`);
    }
});

const SERVER = strip(read("server.mjs"));

check("every group function is ported and has a handler", () => {
    const client = read("src/api/supabaseClient.js");
    for (const f of ["getGroups", "getGroup", "lookupGroupCode", "createGroup", "joinGroup", "leaveGroup", "removeGroupMember",
        "resetGroupCode", "deleteGroup", "postGroupPhrase", "shareToGroup", "importGroupItem", "reactToGroupItem", "removeGroupItem", "setGroupSacSharing"]) {
        assert.match(client, new RegExp(`${f}:\\s+'/local-ai/fn/${f}'`), `${f} is not in PORTED_FUNCTIONS`);
        assert.match(SERVER, new RegExp(`app\\.post\\("/local-ai/fn/${f}"`), `${f} has no handler`);
    }
});

check("the reads return no other student's email", () => {
    for (const name of ["getGroups", "getGroup", "lookupGroupCode"]) {
        const h = handler(SERVER, name);
        const ret = h.slice(h.lastIndexOf("return res.json({"));
        const body = block(ret, 0);
        assert.ok(body.length > 20, `${name}'s response moved — re-point this check`);
        assert.ok(!/\b(email|owner_email|member_emails|sender_email|shared_by_email|created_by):/.test(body), `an address is in ${name}'s payload`);
    }
    // The member rows are BUILT above the response, so the response block
    // alone cannot see an address added there.
    const g = handler(SERVER, "getGroup");
    const built = g.slice(g.indexOf("const out = members.map("), g.lastIndexOf("return res.json({"));
    assert.ok(built.length > 20, "getGroup's member rows moved — re-point this check");
    assert.ok(!/\b(email|created_by):/.test(built), "an address is in getGroup's member rows");
    const members = fn(SERVER, "groupMembers");
    assert.match(members, /name: friendName\(p, email\)/);
});

check("a SAC reaches the group as a subject and a day, never its title", () => {
    const h = handler(SERVER, "getGroup");
    const sacs = h.slice(h.indexOf("sacs: (sacRes.data"), h.indexOf("feed: shapeFeed"));
    assert.ok(sacs.length > 20, "the SAC mapping moved — re-point this check");
    assert.ok(!/\btitle\b/.test(sacs), "a planner title is sent to the group");
    assert.match(h, /share_sacs/, "SAC dates are shown without the member turning it on");
});

check("joining goes through the refusal rules and cannot lose a concurrent join", () => {
    const h = handler(SERVER, "joinGroup");
    assert.match(h, /joinRefusal\(g, me\)/);
    assert.match(h, /casUpdate\("study_groups"/);
    assert.match(h, /joinRefusal\(row, me\)/, "the refusal is not re-checked against the row being written");
    assert.match(h, /friendLimitHit\(`glookup:\$\{me\}`, GROUP_LOOKUPS_PER_HOUR/);
    assert.match(handler(SERVER, "lookupGroupCode"), /friendLimitHit\(`glookup:\$\{user\.email\}`, GROUP_LOOKUPS_PER_HOUR/);
    assert.match(fn(SERVER, "casUpdate"), /\.eq\("updated_date", row\.updated_date\)/);
});

check("only the owner removes, resets and deletes; a removed member stays out", () => {
    for (const name of ["removeGroupMember", "resetGroupCode", "deleteGroup"]) {
        assert.match(handler(SERVER, name), /!isOwner\(g, (me|user\.email)\)/, `${name} is open to any member`);
    }
    assert.match(handler(SERVER, "removeGroupMember"), /removed: \[\.\.\.new Set/);
    assert.match(handler(SERVER, "leaveGroup"), /if \(isOwner\(g, me\)\) return res\.status\(400\)/);
});

check("a call is a phrase from the set, named off the profile — never text from the request", () => {
    const h = handler(SERVER, "postGroupPhrase");
    assert.match(h, /const text = phraseText\(phrase\);\s*if \(!text\) return res\.status\(400\)/);
    assert.match(h, /message: text, message_type: "phrase"/);
    assert.match(h, /sender_name: friendName\(/);
    assert.ok(!/req\.body\??\.(message|text|name|sender_name)\b/.test(h), "text or a name is taken from the client");
    assert.match(h, /friendLimitHit\(`phrase:/);
    assert.match(h, /isMember\(g, me\)/);
});

check("the server writes the only 'event' lines, and nothing writes 'system'", () => {
    const ev = fn(SERVER, "groupEvent");
    const insert = ev.slice(ev.indexOf(".insert("));
    assert.match(insert, /message_type: "event"/, "the event row is written as something other than an event");
    const group = SERVER.slice(SERVER.indexOf("const GROUP_COLS ="), SERVER.indexOf("app.post(\"/local-ai/fn/setGroupSacSharing\""));
    assert.ok(group.length > 1000, "the group section moved — re-point this check");
    assert.ok(!/sender_email:\s*"system"/.test(group), "a row is written as sender 'system'");
    assert.ok(!/message_type:\s*"system"/.test(group), "a row is written as a 'system' line");
});

check("what is shared is read off the sharer's OWN rows, for a friend or a group", () => {
    const own = fn(SERVER, "ownShareContent");
    assert.match(own, /from\("quizzes"\)[\s\S]{0,140}\.eq\("created_by", me\)/);
    assert.match(own, /from\("flashcards"\)[\s\S]{0,140}\.eq\("created_by", me\)/);
    assert.match(own, /from\("ai_saved_results"\)[\s\S]{0,160}\.eq\("created_by", me\)/);
    for (const name of ["shareToGroup", "shareWithFriends"]) {
        const h = handler(SERVER, name);
        assert.match(h, /await ownShareContent\(me, kind, req\.body\)/, `${name} reads its own content again`);
        assert.ok(!/resource_data:\s*req\.body|flashcard_data:\s*req\.body|quiz_data:\s*req\.body/.test(h));
    }
    assert.match(handler(SERVER, "shareToGroup"), /isMember\(g, me\)/);
});

check("an import creates the rows FIRST, as the importer, and never reports a landed import as failed", () => {
    const h = handler(SERVER, "importGroupItem");
    assert.match(h, /isMember\(g, me\)/);
    assert.match(h, /created_by: me/);
    const insert = h.indexOf('from("flashcards").insert');
    const mark = h.indexOf('casUpdate("group_shared_resources"');
    assert.ok(insert > 0 && mark > insert, "the import count is written before the rows exist");
    assert.match(h, /if \(marked\.error\) console\.warn/, "a failure to RECORD the import fails the import again");
    assert.match(h, /importedDeck\(/, "an imported card is built some other way than importedDeck");
});

check("migration 0043 takes every browser policy off all four tables and grants none", () => {
    const sql = strip(read("supabase/migrations/0043_study_groups_server_only.sql"));
    const policies = {
        study_groups: ["select_member", "insert_as_owner", "update_member", "delete_as_owner"],
        group_messages: ["select_member", "insert_member"],
        group_shared_resources: ["select_member", "insert_member", "update_sharer", "delete_sharer"],
        group_flashcard_decks: ["select_member", "insert_member", "update_member", "delete_owner"],
    };
    for (const [t, ps] of Object.entries(policies)) {
        for (const p of ps) assert.match(sql, new RegExp(`drop policy if exists "${t}_${p}"\\s+on public\\.${t};`), `${t}_${p} survives`);
        assert.match(sql, new RegExp(`alter table public\\.${t}\\s+enable row level security`));
    }
    assert.ok(!/create policy/i.test(sql), "the migration grants the browser something back");
});

// ─── The page ────────────────────────────────────────────────────────────────

const PAGE = strip(read("src/pages/StudyGroups.jsx"));
const COMPONENTS = ["GroupRoom", "GroupWeek", "GroupShelf", "GroupCalls", "GroupDialogs"]
    .map((f) => strip(read(`src/components/groups/${f}.jsx`))).join("\n");

check("there is nowhere to type at another student", () => {
    assert.ok(!/<textarea|<Textarea/.test(PAGE + COMPONENTS), "a free-text box is back");
    const calls = strip(read("src/components/groups/GroupCalls.jsx"));
    assert.ok(!/<Input\b|<input\b/.test(calls), "the calls grew a text input");
    assert.match(calls, /phrases\.map\(/);
});

check("opening a group link asks first — it joins nothing on arrival", () => {
    const effect = PAGE.slice(PAGE.indexOf("if (!joinParam) return;"), PAGE.indexOf("const closeInvite"));
    assert.ok(effect.includes("lookupGroupCode("), "the link no longer looks the code up");
    assert.ok(!/joinGroup\(|join\(/.test(effect), "the link joins the moment it opens");
});

check("the group LEADS with this week, then the shelf, then the calls", () => {
    const room = strip(read("src/components/groups/GroupRoom.jsx"));
    const at = (s) => room.indexOf(s);
    assert.ok(at("<GroupWeek") > 0 && at("<GroupWeek") < at("<GroupShelf") && at("<GroupShelf") < at("<GroupCalls"));
});

check("the week draws only who has started, and counts the rest", () => {
    const week = strip(read("src/components/groups/GroupWeek.jsx"));
    assert.match(week, /\{m\.minutes > 0 && <motion\.div/, "a member with no counted minutes draws a bar");
    // The top three may be on the table above the list (`from`), so the list
    // is a slice — but it is a slice of who STARTED, never of every member.
    assert.match(week, /ranked\.studied\.slice\(from\)\.map\(/);
    assert.match(week, /ranked\.studied\.slice\(0, PODIUM_SIZE\)/);
    assert.match(week, /const from = ranked\.studied\.length > PODIUM_SIZE \? PODIUM_SIZE : 0/,
        "a podium is dealt for a group where three places is everybody who started");
    assert.match(week, /ranked\.notStarted/);
    assert.ok(!/week\??\.members\??\.map\(/.test(week), "every member is drawn by name again");
});

check("every destructive act asks in the app's own dialog", () => {
    assert.ok(!/\bconfirm\(/.test(PAGE + COMPONENTS), "a native confirm() is back");
    const dialogs = strip(read("src/components/groups/GroupDialogs.jsx"));
    assert.ok((dialogs.match(/<AlertDialog /g) || []).length >= 3, "remove, leave/delete and new code each need a confirm");
});

check("the group is in both navs, and account deletion takes you out of every group", () => {
    for (const nav of ["src/components/layout/SideRail.jsx", "src/components/layout/BottomNav.jsx"]) {
        assert.match(read(nav), /path: "StudyGroups"/, `${nav} has no way to Study groups`);
    }
    const settings = strip(read("src/pages/Settings.jsx"));
    assert.match(settings, /label: "Study groups"[\s\S]{0,200}deleteGroup\(g\.id\) : leaveGroup\(g\.id, true\)/);
    assert.match(handler(SERVER, "leaveGroup"), /req\.body\?\.purge/);
});

check("a group link survives the sign-in, the way a friend link does", () => {
    const app = strip(read("src/App.jsx"));
    assert.match(app, /rememberGroupLink\(location\)/);
    assert.match(app, /takePendingGroup\(\)/);
    assert.match(PAGE, /takePendingGroup\(\)/);
});

console.log(`\n${passed} group checks passed`);
