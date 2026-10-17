/**
 * friends assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/friends.test.mjs
 *
 * ═══ ANYBODY COULD BE ANYBODY'S FRIEND ══════════════════════════════════════
 * `friendships_update_either` let the student who SENT a request mark it
 * accepted, so the "friends only" bound on pranks and sharing was a formality,
 * the friend-count achievements were farmable, and the name on a request was
 * whatever the sender's browser typed. Every write is the server's now, and
 * every check below holds a piece of that in place — most of them as scans,
 * because a client that quietly goes back to writing `friendships` directly
 * renders perfectly and simply reopens the hole.
 *
 * Every check below was verified by putting the bug back.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import {
    makeFriendCode, normaliseFriendCode, friendLink, CODE_ALPHABET, CODE_LENGTH, CODE_PREFIX,
    SHARE_NOTES, noteText, shownNote, splitFriendships, friendName, SHARE_TABLES,
} from "@/lib/friends";
import { rememberFriendLink, takePendingFriend, PENDING_KEY, PENDING_TTL_MS } from "@/lib/pendingFriend";

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
/** One handler's body, by brace depth from its `app.post(` line. */
function handler(src, name) {
    const at = src.indexOf(`app.post("/local-ai/fn/${name}"`);
    assert.ok(at >= 0, `no ${name} handler`);
    let i = src.indexOf("{", src.indexOf("=>", at));
    let depth = 0;
    const start = i;
    for (; i < src.length; i += 1) {
        if (src[i] === "{") depth += 1;
        else if (src[i] === "}") { depth -= 1; if (depth === 0) break; }
    }
    return src.slice(start, i + 1);
}

// ─── Codes ───────────────────────────────────────────────────────────────────

check("a code is the prefix and five characters from the alphabet", () => {
    for (let i = 0; i < 200; i += 1) {
        const c = makeFriendCode();
        assert.match(c, new RegExp(`^${CODE_PREFIX}[${CODE_ALPHABET}]{${CODE_LENGTH}}$`));
    }
});

check("the alphabet has nothing that reads as something else", () => {
    for (const ch of "01OIL") assert.ok(!CODE_ALPHABET.includes(ch), `"${ch}" is in the alphabet`);
});

check("a code is accepted however it was typed or pasted", () => {
    for (const s of ["ACE-7KQ2X", "ace-7kq2x", "7kq2x", " ACE 7KQ2X ", "ace7kq2x",
        "https://acedit.au/Friends?add=ACE-7KQ2X", "acedit.au/Friends?add=ace-7kq2x&x=1"]) {
        assert.equal(normaliseFriendCode(s), "ACE-7KQ2X", s);
    }
});

check("a character outside the alphabet is refused, never guessed", () => {
    for (const s of ["ACE-7KQ20", "ACE-OKQ2X", "ACE-7KQ2", "ACE-7KQ2XY", "", null, "hello"]) {
        assert.equal(normaliseFriendCode(s), null, String(s));
    }
});

check("the link carries the code and comes back to it", () => {
    const link = friendLink("ace-7kq2x", "https://acedit.au/");
    assert.equal(link, "https://acedit.au/Friends?add=ACE-7KQ2X");
    assert.equal(normaliseFriendCode(link), "ACE-7KQ2X");
    assert.equal(friendLink("nope"), null);
});

// ─── Notes ───────────────────────────────────────────────────────────────────

check("a note is an id from the list, and anything else is no note", () => {
    assert.equal(noteText("luck"), "Good luck!");
    assert.equal(noteText("you are so dumb lol"), null);
    assert.equal(noteText(undefined), null);
});

check("only a message that IS a note is ever shown — old free text is not", () => {
    for (const n of SHARE_NOTES) assert.equal(shownNote(n.text), n.text);
    assert.equal(shownNote("meet me after school"), null);
    assert.equal(shownNote(""), null);
});

check("the share kinds map to the three share tables", () => {
    assert.deepEqual(SHARE_TABLES, { quiz: "shared_quizzes", deck: "shared_flashcards", result: "shared_ai_results" });
});

// ─── Reading rows ────────────────────────────────────────────────────────────

check("rows split into friends, requests waiting on me, and requests waiting on them", () => {
    const rows = [
        { id: "a", requester_email: "me@x.com", recipient_email: "maya@x.com", status: "accepted" },
        { id: "a2", requester_email: "maya@x.com", recipient_email: "me@x.com", status: "accepted" },
        { id: "b", requester_email: "jo@x.com", recipient_email: "me@x.com", status: "pending" },
        { id: "c", requester_email: "me@x.com", recipient_email: "tom@x.com", status: "pending" },
        { id: "d", requester_email: "me@x.com", recipient_email: "sam@x.com", status: "declined" },
        { id: "e", requester_email: "x@x.com", recipient_email: "y@x.com", status: "accepted" },
        { id: "f", requester_email: "me@x.com", recipient_email: "me@x.com", status: "accepted" },
    ];
    const s = splitFriendships("ME@x.com", rows);
    assert.deepEqual(s.friends.map((f) => f.email), ["maya@x.com"], "a duplicate pair is one friend");
    assert.deepEqual(s.incoming.map((f) => f.id), ["b"]);
    assert.deepEqual(s.outgoing.map((f) => f.id), ["c"]);
});

check("a friend is named by handle, then name, then the address's first half", () => {
    assert.equal(friendName({ username: "mayac", full_name: "Maya Chen" }, "m@x.com"), "mayac");
    assert.equal(friendName({ full_name: "Maya Chen" }, "m@x.com"), "Maya Chen");
    assert.equal(friendName(null, "maya.c@x.com"), "maya.c");
});

// ─── The link survives a sign-in ─────────────────────────────────────────────

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };

check("a friend link is remembered, and only a friend link", () => {
    const s = mem();
    assert.equal(rememberFriendLink({ pathname: "/Dashboard", search: "?add=ACE-7KQ2X" }, s), null);
    assert.equal(rememberFriendLink({ pathname: "/Friends", search: "?add=ace-7kq2x" }, s), "ACE-7KQ2X");
});

check("it is taken ONCE, so the student is not sent back to it twice", () => {
    const s = mem();
    rememberFriendLink({ pathname: "/Friends", search: "?add=ACE-7KQ2X" }, s, 1000);
    assert.equal(takePendingFriend(s, 2000), "ACE-7KQ2X");
    assert.equal(takePendingFriend(s, 3000), null);
});

check("a day-old link is dropped rather than replayed", () => {
    const s = mem();
    rememberFriendLink({ pathname: "/Friends", search: "?add=ACE-7KQ2X" }, s, 0);
    assert.equal(takePendingFriend(s, PENDING_TTL_MS + 1), null);
    assert.equal(s.getItem(PENDING_KEY), null);
});

check("blocked storage costs the redirect, never a crash", () => {
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => {} };
    assert.equal(rememberFriendLink({ pathname: "/Friends", search: "?add=ACE-7KQ2X" }, broken), null);
    assert.equal(takePendingFriend(broken), null);
});

// ─── The browser writes no friendship and no share ───────────────────────────

check("no client file writes friendships or shares directly", () => {
    const bad = /\b(Friendship|SharedQuiz|SharedFlashcard|SharedAIResult)\.(create|bulkCreate)\(|\bFriendship\.update\(/;
    const hits = walk("src").filter((f) => bad.test(strip(read(f))));
    assert.deepEqual(hits, [], `a direct write is back in ${hits.join(", ")}`);
});

const SERVER = strip(read("server.mjs"));

check("only the RECIPIENT may answer a request, and only while it is pending", () => {
    const h = handler(SERVER, "respondFriend");
    assert.match(h, /row\.recipient_email\)\.toLowerCase\(\) !== String\(user\.email\)\.toLowerCase\(\)/);
    assert.match(h, /row\.status !== "pending"/);
});

check("a request's names come off the profiles, never the request body", () => {
    const h = handler(SERVER, "requestFriend");
    assert.match(h, /requester_name: friendName\(myProfile, me\)/);
    assert.match(h, /recipient_name: friendName\(target, them\)/);
    assert.ok(!/req\.body\??\.(requester_name|recipient_name|name)\b/.test(h), "a name is taken from the client");
});

check("a declined request is never re-sent, and a request both ways is a yes", () => {
    const h = handler(SERVER, "requestFriend");
    assert.match(h, /theirs\?\.status === "pending"[\s\S]{0,200}status: "accepted"/);
    assert.match(h, /if \(mine\) return res\.json\(\{ success: true, state: "sent" \}\)/);
});

check("an email with no account answers exactly like one with an account", () => {
    const h = handler(SERVER, "requestFriend");
    assert.ok(!/No account|isn't on AcedIt|not on AcedIt/i.test(h), "the response says whether an email has an account");
});

check("requests are capped per day and while waiting", () => {
    const h = handler(SERVER, "requestFriend");
    assert.match(h, />= REQUESTS_PER_DAY/);
    assert.match(h, />= PENDING_MAX/);
});

check("a code lookup is rate limited, because it names the code's owner", () => {
    assert.match(handler(SERVER, "lookupFriendCode"), /friendLimitHit\(`lookup:\$\{user\.email\}`, LOOKUPS_PER_HOUR/);
});

check("a share goes only to ACCEPTED friends, with a note or nothing", () => {
    const h = handler(SERVER, "shareWithFriends");
    assert.match(h, /r\.status === "accepted"/);
    assert.match(h, /const message = noteText\(note\);/, "the message is something other than a note again");
    assert.ok(!/message:\s*req\.body/.test(h), "free text reaches a share again");
});

check("a share is read off the sender's OWN rows, not taken from the request", () => {
    // The reading lives in `ownShareContent`, which a share to a study group
    // goes through too — one copy of "what leaves", so neither can drift.
    const at = SERVER.indexOf("async function ownShareContent(");
    assert.ok(at >= 0, "ownShareContent is gone — re-point this check");
    const own = SERVER.slice(at, SERVER.indexOf("\n}\n", at));
    assert.match(own, /from\("quizzes"\)[\s\S]{0,140}\.eq\("created_by", me\)/);
    assert.match(own, /from\("flashcards"\)[\s\S]{0,140}\.eq\("created_by", me\)/);
    assert.match(own, /from\("ai_saved_results"\)[\s\S]{0,160}\.eq\("created_by", me\)/);
    const h = handler(SERVER, "shareWithFriends");
    assert.match(h, /await ownShareContent\(me, kind, req\.body\)/, "the friend share reads its content some other way");
    assert.ok(!/flashcard_data:\s*req\.body|quiz_data:\s*req\.body/.test(h));
});

check("either side may end a friendship", () => {
    const h = handler(SERVER, "removeFriend");
    assert.match(h, /\[row\.requester_email, row\.recipient_email\]\.some/);
});

check("getFriends returns no other student's email", () => {
    const h = handler(SERVER, "getFriends");
    const ret = h.slice(h.indexOf("return res.json({\n      success: true,\n      code,"));
    assert.ok(ret.length > 20, "getFriends' response block moved — re-point this check");
    assert.ok(!/\bemail:/.test(ret.slice(0, ret.indexOf("limits:"))), "an email is in getFriends' payload");
});

// ─── The migration ───────────────────────────────────────────────────────────

check("migration 0042 takes away every browser write and keeps delete for either side", () => {
    const sql = strip(read("supabase/migrations/0042_friendships_server_only.sql"));
    for (const p of ["friendships_insert_as_requester", "friendships_update_either",
        "shared_quizzes_insert_as_sender", "shared_quizzes_update_either",
        "shared_flashcards_insert_as_sender", "shared_flashcards_update_either",
        "shared_ai_results_insert_as_sender", "shared_ai_results_update_either"]) {
        assert.match(sql, new RegExp(`drop policy if exists "${p}"`), `${p} survives`);
        assert.ok(!new RegExp(`create policy "${p}"`).test(sql), `${p} is recreated`);
    }
    for (const t of ["friendships", "shared_quizzes", "shared_flashcards", "shared_ai_results"]) {
        assert.match(sql, new RegExp(`create policy "${t}_delete_either"`));
    }
    for (const t of ["shared_quizzes", "shared_flashcards", "shared_ai_results"]) {
        assert.match(sql, new RegExp(`create policy "${t}_update_recipient"[\\s\\S]{0,140}using \\(shared_with_email = auth\\.email\\(\\)\\)`));
    }
    assert.ok(!/for (insert|update) using \(requester_email/.test(sql));
});

// ─── The page and its wiring ─────────────────────────────────────────────────

const PAGE = strip(read("src/pages/Friends.jsx"));

check("the page is one page — no tab bar, no ladder, no free-text box", () => {
    assert.ok(!/<TabsList/.test(PAGE), "the five tabs are back");
    assert.ok(!/FriendsLeaderboard|"ladder"/.test(PAGE), "a second leaderboard is back");
    assert.ok(!/<textarea/.test(PAGE), "a free-text message box is back");
    assert.ok(!fs.existsSync("src/components/friends/FriendsLeaderboard.jsx"));
});

check("a friend's actions are visible — nothing waits behind a hover", () => {
    assert.ok(!/opacity-0 group-hover:opacity-100/.test(PAGE), "an action is hover-only again, so a phone cannot reach it");
    assert.ok(!/\bconfirm\(/.test(PAGE), "a native confirm() is back");
});

check("opening a friend link asks first — it sends nothing on arrival", () => {
    const effect = PAGE.slice(PAGE.indexOf("if (!addParam) return;"), PAGE.indexOf("const closeInvite"));
    assert.ok(effect.includes("lookupFriendCode("), "the link no longer looks the code up");
    assert.ok(!effect.includes("requestFriend("), "a request is sent the moment the link opens");
});

check("'where you stand' lands on the Friends board, which Ranked honours", () => {
    assert.match(PAGE, /createPageUrl\("Ranked"\)\}\?tab=board&scope=friends/);
    const ranked = strip(read("src/pages/Ranked.jsx"));
    assert.match(ranked, /\["board", "Board"/);
    assert.match(ranked, /new URLSearchParams\(window\.location\.search\)\.get\("scope"\);\s*return SCOPES\.some\(\(x\) => x\.id === s\) \? s : "global";/);
    assert.match(ranked, /new URLSearchParams\(window\.location\.search\)\.get\("tab"\);\s*return TABS\.some\(\(\[v\]\) => v === t\) \? t : "score";/);
    assert.match(strip(read("src/lib/ranked.js")), /id: "friends"/);
});

check("received AI results are shown — they used to arrive into a void", () => {
    assert.match(PAGE, /SharedAIResult\.filter\(\{ shared_with_email: user\.email, status: "pending" \}\)/);
});

check("every friend function is ported", () => {
    const client = read("src/api/supabaseClient.js");
    for (const f of ["getFriends", "lookupFriendCode", "requestFriend", "respondFriend", "cancelFriend", "removeFriend", "shareWithFriends"]) {
        assert.match(client, new RegExp(`${f}:\\s+'/local-ai/fn/${f}'`), `${f} is not in PORTED_FUNCTIONS`);
        assert.match(SERVER, new RegExp(`app\\.post\\("/local-ai/fn/${f}"`), `${f} has no handler`);
    }
});

console.log(`\n${passed} friends checks passed`);
