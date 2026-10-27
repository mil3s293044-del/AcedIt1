/**
 * replyRoom assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/replyRoom.test.mjs
 *
 * ═══ A LONG ESSAY CAME BACK AS "…" ══════════════════════════════════════════
 * The chat capped a reply at 2048 tokens. The model it runs on thinks by
 * default and the thinking counts against that cap, so a long essay sent to
 * the English Mentor spent the whole cap thinking and streamed no text at all.
 * The server called that a success and the chat printed "…".
 *
 * Every failure here is silent. A short question still fits, so nothing breaks
 * on the screen anybody tries; only the long input the student most wanted
 * marked comes back empty. Every check below was verified by putting the bug
 * back.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { thinksByDefault, replyCap, emptyReplyMessage, THINKING_ROOM } from "@/lib/replyRoom";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const read = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
// Comments stripped, so an explanation that names the bug is not the bug.
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const server = read("server.mjs");
const serverCode = code(server);

/** The server's own default for a model constant, read off the source. */
function defaultModel(name) {
    const m = new RegExp(`const ${name}\\s*=\\s*process\\.env\\.\\w+\\s*\\|\\|\\s*"([^"]+)"`).exec(server);
    assert.ok(m, `no default for ${name} in server.mjs`);
    return m[1];
}

check("the current generation thinks by default and the 4.x models do not", () => {
    for (const id of ["claude-sonnet-5-5", "claude-sonnet-5", "claude-opus-5", "claude-opus-5-5", "claude-haiku-5-5", "claude-fable-5-1"]) {
        assert.equal(thinksByDefault(id), true, `${id} thinks when thinking is omitted`);
    }
    for (const id of ["claude-sonnet-4-6", "claude-opus-4-8", "claude-opus-4-7", "claude-haiku-4-5"]) {
        assert.equal(thinksByDefault(id), false, `${id} does not think unless asked`);
    }
});

check("an id it does not recognise gets the room, because unused room costs nothing", () => {
    assert.equal(thinksByDefault("some-new-model"), true);
    assert.equal(thinksByDefault(""), true);
    assert.equal(thinksByDefault(null), true);
});

check("the cap is the reply plus room to think, and only the room moves", () => {
    assert.equal(replyCap("claude-sonnet-5-5", 2048), 2048 + THINKING_ROOM);
    assert.equal(replyCap("claude-haiku-4-5", 2048), 2048, "a model that does not think is given exactly its reply");
    assert.ok(THINKING_ROOM >= 4096, "room smaller than a long essay's thinking is the same bug at a different size");
    assert.equal(replyCap("claude-sonnet-5-5", null), 1 + THINKING_ROOM, "a missing reply size is never NaN or zero");
});

check("an empty reply says why, and never with an ellipsis", () => {
    const reasons = ["max_tokens", "refusal", "stopped", undefined, "end_turn"];
    const said = reasons.map((r) => emptyReplyMessage(r));
    for (const s of said) {
        assert.ok(s.length > 20, `"${s}" is not an explanation`);
        assert.ok(!/^\s*(…|\.\.\.)\s*$/.test(s));
        assert.ok(!/\b(Don't|Fix it|No excuses|Embarrassing|Move)\b/.test(s), `banned word in "${s}"`);
    }
    // Four, the generic one included: a refusal that falls through to "came
    // back empty" is still three distinct sentences among the first three.
    assert.equal(new Set(said.slice(0, 4)).size, 4, "running out of room, a refusal, a stop and an unexplained empty reply are four different things to say");
});

check("the chat's stream sizes its cap with room to think, on the model it actually sends", () => {
    const start = serverCode.indexOf('app.post("/local-ai/invokeAIStream"');
    const end = serverCode.indexOf("app.post(", start + 10);
    const body = serverCode.slice(start, end);
    assert.ok(/const maxTokens = replyCap\(model,/.test(body), "the stream's max_tokens no longer goes through replyCap");
    assert.ok(/max_tokens:\s*maxTokens/.test(body), "the request does not send the computed cap");
    assert.ok(/model,\s*\n\s*max_tokens/.test(body) || /model:\s*model/.test(body), "the cap is sized for a different model than the one sent");
    assert.ok(thinksByDefault(defaultModel("MODEL")), "the default model no longer thinks — this guard is testing nothing");
});

check("a reply with no text is an error with its reason, never a done", () => {
    const start = serverCode.indexOf('app.post("/local-ai/invokeAIStream"');
    const body = serverCode.slice(start, serverCode.indexOf("app.post(", start + 10));
    assert.ok(/if \(delta\) wrote = true/.test(body), "the stream no longer notices whether any text arrived");
    const guard = body.indexOf("if (!wrote)");
    const done = body.indexOf('sse("done"');
    assert.ok(guard > 0 && done > guard, "`done` can be sent before the empty check");
    const branch = body.slice(guard, done);
    assert.ok(/sse\("error",\s*\{\s*message:\s*emptyReplyMessage\(finalMessage\.stop_reason\)/.test(branch), "the empty case does not send its reason");
    assert.ok(/return;/.test(branch), "the empty case falls through to done");
});

check("no small fixed cap reaches a model that thinks by default", () => {
    // Every literal `max_tokens` under the room: the request it sits in must
    // name a model that does not think, or the same empty reply is waiting.
    const re = /max_tokens:\s*(\d[\d_]*)/g;
    let m, seen = 0;
    while ((m = re.exec(serverCode))) {
        const n = Number(m[1].replace(/_/g, ""));
        if (n >= THINKING_ROOM) continue;
        seen += 1;
        const before = serverCode.slice(Math.max(0, m.index - 400), m.index);
        const model = /model:\s*([A-Z_]+)\s*,[^]*$/.exec(before)?.[1];
        assert.ok(model, `max_tokens: ${n} with no model constant beside it`);
        assert.equal(thinksByDefault(defaultModel(model)), false, `max_tokens: ${n} is sent to ${model}, which thinks by default`);
    }
    assert.ok(seen >= 1, "found no small caps at all — the scan matched nothing");
});

check("the chat prints the reason in the reply's place and keeps it out of the next prompt", () => {
    const chat = code(read("src/components/ai_tools/UnifiedChat.jsx"));
    assert.ok(!/content:\s*"(…|\.\.\.)"/.test(chat), "a failed reply is an ellipsis again");
    assert.ok(/content:\s*failure \|\| emptyReplyMessage\(\),\s*failed:\s*true/.test(chat), "a failed reply no longer carries its reason");
    assert.ok(/e\?\.message \|\| emptyReplyMessage\(\)/.test(chat), "the server's reason is dropped on the way to the bubble");
    assert.ok(/messages\.filter\(m => !m\.failed\)\.slice\(-MAX_TURNS_IN_PROMPT\)/.test(chat), "a failed bubble goes back to the model as something it said");
    assert.ok(/m\.failed\s*\n?\s*\?\s*<p/.test(chat), "a failed reply is drawn as a normal answer");
});

console.log(`\n${passed} checks passed`);
