/**
 * AI job assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/aiJobs.test.mjs
 *
 * ═══ "A PROGRESS BAR IF THEY CLICK ONTO ANOTHER PAGE WHILE WAITING" ═════════
 * A quiz, a deck or a set of Active Recall questions takes twenty seconds to a
 * couple of minutes to make, and leaving the page used to leave it behind:
 * the quiz saved itself silently, the deck sat in a draft nobody reopened, and
 * Active Recall's questions landed in a component that no longer existed.
 *
 * A creation is a job now, owned by no page, with a floating card that fills
 * on a COUNT — each question or card the model has finished writing — rather
 * than a clock. Everything that decides what that card says is pure and held
 * here, along with the wiring that a refactor could quietly undo. Every check
 * was verified by putting the bug back.
 */
import assert from "node:assert/strict";
import fs from "node:fs";

// A held result survives a reload through sessionStorage, so the store is
// imported with one in place.
const storage = new Map();
globalThis.sessionStorage = {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
};

const {
    createItemCounter, takeSseEvents, readCounted, jobFill, jobLine, runningIn, trayJobs, laneOf, watchStep, JOB_KINDS, BANDS,
} = await import("@/lib/aiJobs");
const store = await import("@/lib/jobStore");
const { globalBusy } = await import("@/lib/liveRefresh");

let passed = 0;
const check = async (name, fn) => {
    try { await fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};
const read = (rel) => fs.readFileSync(rel, "utf8");
/** A comment naming the broken form is not the broken form. */
const strip = (src) => src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

/** Feeds a string to a fresh counter in pieces of `size`, returning the count after each. */
const countIn = (text, size) => {
    const c = createItemCounter();
    const seen = [];
    for (let i = 0; i < text.length; i += size) seen.push(c.push(text.slice(i, i + size)));
    return { final: c.items, seen };
};

const QUIZ = JSON.stringify({
    questions: [
        { type: "mcq", question: "Which of {a, b} is $\\frac{1}{2}$?", options: ["{", "}", "[]", "\"{\""], correct_answer: "{" },
        { type: "short_answer", question: "A string with a \\\" quote and a } brace", model_answer: "} ] {" },
        { type: "multipart", stem: "Stem", parts: [{ label: "a", marks: 1 }, { label: "b", marks: 2 }] },
    ],
});

console.log("\n── The count ──");

await check("counts each object closed inside the first array, and nothing else", () => {
    assert.equal(countIn(QUIZ, QUIZ.length).final, 3);
});

await check("braces and brackets inside strings are not structure, escapes included", () => {
    // Every question above carries braces in its text; a counter that read them
    // would report a different number on every one.
    const c = createItemCounter();
    c.push('{"questions":[{"q":"\\"}\\"{["},');
    assert.equal(c.items, 1);
    c.push('{"q":"\\\\"}');               // an escaped backslash, THEN the closing quote
    assert.equal(c.items, 2, "a backslash that is itself escaped does not escape the quote after it");
});

await check("a multipart question's own parts are not questions", () => {
    const c = createItemCounter();
    c.push('{"questions":[{"parts":[{"a":1},{"b":2},{"c":3}]}]}');
    assert.equal(c.items, 1);
});

await check("the count is the same however the text is chunked, and never runs backwards", () => {
    for (const size of [1, 2, 3, 7, 13, 50]) {
        const { final, seen } = countIn(QUIZ, size);
        assert.equal(final, 3, `chunks of ${size}`);
        for (let i = 1; i < seen.length; i++) assert.ok(seen[i] >= seen[i - 1], `went backwards at ${size}`);
    }
});

await check("a deck counts the same way as a quiz", () => {
    const deck = JSON.stringify({ flashcards: Array.from({ length: 12 }, (_, i) => ({ question: `Q${i} {x}`, answer: "[y]" })) });
    assert.equal(countIn(deck, 5).final, 12);
});

await check("an object still being written is not counted until it closes", () => {
    const c = createItemCounter();
    c.push('{"questions":[{"q":"one"},{"q":"two, still go');
    assert.equal(c.items, 1);
});

console.log("\n── The stream ──");

await check("server-sent events split on the blank line and keep the unfinished tail", () => {
    const { events, rest } = takeSseEvents('event: progress\ndata: {"stage":"write","items":2}\n\nevent: done\ndata: {"ok"');
    assert.deepEqual(events, [{ event: "progress", data: { stage: "write", items: 2 } }]);
    assert.equal(rest, 'event: done\ndata: {"ok"');
});

await check("a data line that is not JSON is skipped rather than losing the result behind it", () => {
    const { events } = takeSseEvents('event: progress\ndata: not json\n\nevent: done\ndata: {"a":1}\n\n');
    assert.deepEqual(events, [{ event: "done", data: { a: 1 } }]);
});

const streamOf = (chunks) => new ReadableStream({
    start(c) { for (const ch of chunks) c.enqueue(new TextEncoder().encode(ch)); c.close(); },
});

await check("reading a counted call reports every count and returns the result", async () => {
    const seen = [];
    let beats = 0;
    const result = await readCounted(streamOf([
        'event: progress\ndata: {"stage":"read","items":0}\n\n',
        'event: ping\ndata: {}\n\nevent: progress\ndata: {"stage":"write","it',
        'ems":1}\n\nevent: progress\ndata: {"stage":"write","items":2}\n\n',
        'event: done\ndata: {"questions":[1,2]}\n\n',
    ]), (p) => seen.push(p), () => { beats += 1; });
    assert.deepEqual(result, { questions: [1, 2] });
    assert.deepEqual(seen.map((p) => `${p.stage}:${p.items}`), ["read:0", "write:1", "write:2"]);
    assert.equal(beats, 4, "every chunk, the heartbeat included, counts as the call still being alive");
});

await check("a connection that closes without `done` is a failure, never an empty success", async () => {
    await assert.rejects(
        readCounted(streamOf(['event: progress\ndata: {"stage":"write","items":3}\n\n']), () => {}),
        /closed before/,
    );
});

await check("an `error` event throws its message", async () => {
    await assert.rejects(
        readCounted(streamOf(['event: error\ndata: {"message":"AI response was incomplete"}\n\n']), () => {}),
        /incomplete/,
    );
});

await check("a progress callback that throws cannot fail the generate", async () => {
    const result = await readCounted(streamOf([
        'event: progress\ndata: {"stage":"write","items":1}\n\nevent: done\ndata: {"ok":true}\n\n',
    ]), () => { throw new Error("bar broke"); });
    assert.deepEqual(result, { ok: true });
});

console.log("\n── The bar ──");

const job = (over) => ({ kind: "quiz", title: "Chemistry quiz", status: "running", files: 0, filesDone: 0, items: 0, total: 10, stage: "read", ...over });

await check("the bar never runs backwards across stages", () => {
    const path = [
        job({ files: 2, stage: "upload", filesDone: 0 }),
        job({ files: 2, stage: "upload", filesDone: 1 }),
        job({ files: 2, stage: "upload", filesDone: 2 }),
        job({ files: 2, stage: "read" }),
        job({ files: 2, stage: "write", items: 0 }),
        job({ files: 2, stage: "write", items: 5 }),
        job({ files: 2, stage: "write", items: 10 }),
        job({ files: 2, stage: "finish", items: 10 }),
        job({ files: 2, status: "ready" }),
    ];
    const fills = path.map((j) => jobFill(j).fill);
    for (let i = 1; i < fills.length; i++) assert.ok(fills[i] >= fills[i - 1], `dropped at step ${i}: ${fills}`);
    assert.equal(fills.at(-1), 1);
});

await check("inside the write band the fill is the count and nothing else", () => {
    const [from, to] = BANDS.noFiles.write;
    assert.equal(jobFill(job({ stage: "write", items: 0 })).fill, from);
    assert.equal(jobFill(job({ stage: "write", items: 5 })).fill, from + (to - from) * 0.5);
    assert.equal(jobFill(job({ stage: "write", items: 10 })).fill, to);
    assert.equal(jobFill(job({ stage: "write", items: 14 })).fill, to, "a model that wrote more than asked does not overrun the band");
});

await check("before anything can be counted the bar holds still and says so", () => {
    assert.deepEqual(jobFill(job({ stage: "read" })), { fill: BANDS.noFiles.read[0], counting: false });
    // No total (a deck of "as many as the notes support") is nothing to fill against.
    const open = jobFill(job({ stage: "write", items: 7, total: null }));
    assert.equal(open.counting, false);
    assert.equal(open.fill, BANDS.noFiles.write[0]);
});

await check("a missing total is not a total of zero — Number(null) is 0", () => {
    assert.equal(jobLine(job({ stage: "write", items: 4, total: null })).detail, "4 so far");
    assert.equal(jobLine(job({ stage: "write", items: 4, total: undefined })).detail, "4 so far");
    assert.equal(jobFill(job({ stage: "write", items: 4, total: null })).counting, false);
    // And a count nobody has reported is not a count of zero: nothing has
    // been measured yet, so the bar holds with its sheen.
    assert.equal(jobFill(job({ stage: "write", items: null })).counting, false);
    assert.equal(jobFill(job({ files: 2, stage: "upload", filesDone: null })).counting, false);
});

console.log("\n── The words ──");

await check("every figure on the card is a count of something that exists", () => {
    assert.equal(jobLine(job({ stage: "write", items: 6 })).detail, "6 of 10");
    assert.equal(jobLine(job({ stage: "write", items: 0, total: null })).detail, "", "nothing written yet prints nothing, not '0 so far'");
    assert.equal(jobLine(job({ files: 3, filesDone: 1, stage: "upload" })).detail, "1 of 3");
    assert.equal(jobLine(job({ files: 1, filesDone: 0, stage: "upload" })).detail, "", "one file is not a count worth printing");
    assert.equal(jobLine(job({ stage: "read" })).detail, "");
});

await check("the status names the stage in the kind's own words", () => {
    assert.equal(jobLine(job({ stage: "read" })).status, "Reading your notes");
    assert.equal(jobLine(job({ kind: "reshuffle", stage: "read" })).status, "Reading the quiz");
    assert.equal(jobLine(job({ kind: "flashcards", stage: "write" })).status, "Writing cards");
    assert.equal(jobLine(job({ files: 1, stage: "upload" })).status, "Uploading your file");
    assert.equal(jobLine(job({ files: 2, stage: "upload" })).status, "Uploading your files");
});

await check("a finished job says Ready and offers the kind's action; a failed one offers none", () => {
    const ready = jobLine(job({ status: "ready", items: 10 }));
    assert.equal(ready.status, "Ready");
    assert.equal(ready.detail, "10 questions");
    assert.equal(ready.action, "Open");
    assert.equal(jobLine(job({ status: "ready", items: 10, note: "2 point at a missing source." })).detail, "10 questions",
        "a note never takes the count's place beside the bar");
    assert.equal(jobLine(job({ kind: "flashcards", status: "ready", items: 1 })).detail, "1 card");
    assert.equal(jobLine(job({ kind: "recall", status: "ready" })).action, "Start");
    const failed = jobLine(job({ status: "failed", error: null }));
    assert.equal(failed.action, null);
    assert.match(failed.detail, /Nothing was saved/);
});

await check("the card's copy keeps the house voice", () => {
    const words = JSON.stringify(JOB_KINDS) + strip(read("src/lib/aiJobs.js")) + strip(read("src/components/shared/JobTray.jsx"));
    for (const banned of ["Don't", "Fix it", "No excuses", "Embarrassing"]) assert.ok(!words.includes(banned), banned);
});

console.log("\n── One per lane ──");

await check("a reshuffle runs in the quiz lane, so it blocks a second quiz and is blocked by one", () => {
    assert.equal(laneOf("reshuffle"), "quiz");
    const jobs = [job({ kind: "reshuffle" }), job({ kind: "flashcards", status: "ready" })];
    assert.ok(runningIn(jobs, "quiz"));
    assert.equal(runningIn(jobs, "flashcards"), null, "a finished job blocks nothing");
});

await check("the card shows the current student's jobs, and stands down only where a page has them covered", () => {
    const jobs = [
        job({ id: 1, email: "a@x" }),
        job({ id: 2, email: "b@x" }),
        job({ id: 3, email: "a@x", kind: "flashcards" }),
        job({ id: 4, email: "a@x", kind: "reshuffle", status: "ready" }),
    ];
    const ids = (list) => list.map((j) => j.id);
    assert.deepEqual(ids(trayJobs(jobs, { email: "a@x" })), [1, 3, 4]);
    assert.deepEqual(ids(trayJobs(jobs, { email: "a@x", displayed: ["quiz"] })), [3, 4],
        "a bar on screen covers a RUNNING job — never a held result, which that page has not taken");
    assert.deepEqual(ids(trayJobs(jobs, { email: "a@x", watched: ["quiz"] })), [1, 3],
        "a watching page covers a SETTLED job — it takes it in the same breath, so no Ready flashes up");
    assert.deepEqual(ids(trayJobs(jobs, { email: "a@x", watched: ["flashcards"] })), [1, 3, 4],
        "watching is not drawing: a running job under a page that is not drawing it still shows");
});

console.log("\n── Handing back ──");

await check("a page showing a running job watches it, and takes it when it settles", () => {
    const run = job({ id: "j1" });
    let step = watchStep({ jobs: [run], watched: null, showing: true, running: run });
    assert.deepEqual(step, { watched: "j1", settle: null });
    // The job settles: the page is no longer "showing" a RUNNING job (there is
    // none), and that must not lose it — it was watching up to this moment.
    const done = { ...run, status: "ready" };
    step = watchStep({ jobs: [done], watched: "j1", showing: false, running: null });
    assert.equal(step.settle, done);
    assert.equal(step.watched, null);
});

await check("a failure is handed back the same way, so the page that showed it says why", () => {
    const failed = job({ id: "j1", status: "failed", error: "Too big" });
    assert.equal(watchStep({ jobs: [failed], watched: "j1" }).settle, failed);
});

await check("a page that stops showing a job mid-run lets it go to the card", () => {
    const run = job({ id: "j1" });
    const step = watchStep({ jobs: [run], watched: "j1", showing: false, running: run });
    assert.deepEqual(step, { watched: null, settle: null });
    // …and when it later settles, nobody takes it: it is held for the card.
    assert.equal(watchStep({ jobs: [{ ...run, status: "ready" }], watched: step.watched }).settle, null);
});

await check("a page that never showed a job never takes it — a held result is not ambushed", () => {
    const ready = job({ id: "j9", status: "ready" });
    assert.deepEqual(watchStep({ jobs: [ready], watched: null, showing: false, running: null }), { watched: null, settle: null });
});

await check("a watched job that vanished (dismissed, or opened elsewhere) is forgotten", () => {
    assert.deepEqual(watchStep({ jobs: [], watched: "j1" }), { watched: null, settle: null });
});

await check("a remounted page picks up the job the old mount started", () => {
    // The generator is a closure over the mount that STARTED it; after a round
    // trip a different mount is showing it. Nothing about the job names its
    // mount, so whichever is showing it takes it.
    const run = job({ id: "j1" });
    assert.equal(watchStep({ jobs: [run], watched: null, showing: true, running: run }).watched, "j1");
});

console.log("\n── The store ──");

await check("settling marks the job and never removes it: whoever is watching takes it", () => {
    store.__resetJobs();
    const release = store.claimDisplay("quiz");
    const h = store.startJob({ kind: "quiz", title: "Methods quiz", email: "a@x", total: 5 });
    h.ready({ result: { id: "q1" } });
    assert.equal(store.getJobs()[0].status, "ready", "the generator cannot know which mount is showing it");
    assert.deepEqual(store.takeJob(h.id).result, { id: "q1" });
    assert.equal(store.getJobs().length, 0);
    release();
});

await check("a job finishing anywhere else is held with its result, and adopted once", () => {
    store.__resetJobs();
    const h = store.startJob({ kind: "flashcards", title: "Chemistry deck", email: "a@x", total: null });
    h.progress({ stage: "write", items: 9 });
    h.ready({ result: { cards: [1, 2, 3] }, items: 3 });
    const [held] = store.getJobs();
    assert.equal(held.status, "ready");
    assert.equal(held.items, 3);
    assert.equal(store.adoptJob("flashcards", "b@x"), null, "another student's result is not theirs to take");
    const adopted = store.adoptJob("flashcards", "a@x");
    assert.deepEqual(adopted.result, { cards: [1, 2, 3] });
    assert.equal(store.adoptJob("flashcards", "a@x"), null, "adopted once");
    assert.equal(store.getJobs().length, 0);
});

await check("a held result survives a reload; a running job is not pretended to", () => {
    store.__resetJobs();
    store.startJob({ kind: "quiz", title: "Still going", email: "a@x" });
    store.startJob({ kind: "recall", title: "Held", email: "a@x" }).ready({ result: { questions: ["q"] } });
    const saved = JSON.parse(globalThis.sessionStorage.getItem("acedit.jobs.v1"));
    assert.deepEqual(saved.map((j) => j.title), ["Held"]);
});

await check("claims are counted, so two mounts cannot release each other", () => {
    store.__resetJobs();
    const a = store.claimDisplay("quiz");
    const b = store.claimDisplay("reshuffle");
    a();
    a();                                    // a second release of one claim is a no-op
    assert.deepEqual(store.getLanes().displayed, ["quiz"], "the second claim still holds");
    b();
    assert.deepEqual(store.getLanes().displayed, []);
    const w = store.claimWatch("flashcards");
    assert.deepEqual(store.getLanes(), { displayed: [], watched: ["flashcards"] }, "watching and drawing are separate claims");
    w();
});

await check("a running job holds the app still until it settles, and settles once", () => {
    store.__resetJobs();
    const before = globalBusy._size();
    const h = store.startJob({ kind: "quiz", title: "x", email: "a@x" });
    assert.equal(globalBusy._size(), before + 1);
    h.fail("nope");
    h.fail("again");
    h.ready({});
    assert.equal(globalBusy._size(), before, "a leaked claim would stop the app refreshing for good");
});

await check("a new job replaces a finished one in its lane but never a running one", () => {
    store.__resetJobs();
    store.startJob({ kind: "quiz", title: "old", email: "a@x" }).ready({});
    store.startJob({ kind: "reshuffle", title: "new", email: "a@x" });
    assert.deepEqual(store.getJobs().map((j) => j.title), ["new"]);
    // Pages refuse a second press while one runs, but if one ever got through,
    // dropping the running job would orphan a request still writing a quiz.
    store.startJob({ kind: "quiz", title: "newer", email: "a@x" });
    assert.deepEqual(store.getJobs().map((j) => j.title), ["new", "newer"]);
});

console.log("\n── The wiring ──");

const server = strip(read("server.mjs"));

await check("the server imports the counter by a path node can resolve", () => {
    assert.match(server, /import \{ createItemCounter \} from "\.\/src\/lib\/aiJobs\.js";/);
    assert.ok(!/from "\.\/src\/lib\/aiJobs\.js";[\s\S]*?@\//.test(read("src/lib/aiJobs.js").split("\n").filter((l) => l.startsWith("import")).join("\n")),
        "aiJobs.js imports nothing through the alias");
    assert.ok(!read("src/lib/aiJobs.js").split("\n").some((l) => /^import .*@\//.test(l)), "no @/ import in a module server.mjs loads");
});

await check("only an explicit, countable request is answered as a stream", () => {
    assert.match(server, /params\.progress === true && !!params\.response_json_schema \? openProgressSse\(res\)/);
});

await check("the stream counts on the model's own text, on BOTH attempts", () => {
    const uses = server.match(/counted\(anthropic\.messages\.stream\(/g) || [];
    assert.equal(uses.length, 2, "the schema-fallback retry must be counted too, or a retried generate holds at zero");
});

await check("a streamed generate ends in done or error, never a bare status after the headers", () => {
    assert.match(server, /if \(progressSse\) return progressSse\.done\(result\);/);
    assert.match(server, /if \(progressSse\) return progressSse\.fail\(/);
    assert.match(server, /res\.headersSent && res\.getHeader\("Content-Type"\)[^\n]*event-stream[\s\S]{0,80}writeSseError/);
});

await check("the client only asks for a count when it can read one", () => {
    const client = strip(read("src/lib/aiClient.js"));
    assert.match(client, /typeof options\.onProgress === 'function' && !!params\?\.response_json_schema/);
    assert.match(client, /includes\('text\/event-stream'\)\)\s*\{\s*return await readCounted\(/,
        "a server answering plain JSON is read the ordinary way");
    const sdk = strip(read("src/api/base44Client.js"));
    assert.match(sdk, /async \(params, options\) => \{[\s\S]{0,120}?invokeLLM\(params \|\| \{\}, options \|\| \{\}\)/,
        "the SDK override passes the progress callback through, or every page's bar stays empty");
});

const PAGES = {
    quiz: { file: "src/pages/Quizzes.jsx", gen: "handleGenerateQuiz" },
    reshuffle: { file: "src/pages/Quizzes.jsx", gen: "handleReshuffleQuiz" },
    flashcards: { file: "src/components/study/SpacedRepetition.jsx", gen: "handleGenerateFlashcardsFromFile" },
    recall: { file: "src/components/study/ActiveRecall.jsx", gen: "handleGenerateQuestions" },
};
/** A handler's body: from its declaration to the next top-level `const … = ` at the same indent. */
const bodyOf = (src, name) => {
    const at = src.indexOf(`const ${name} = async`);
    assert.ok(at >= 0, `${name} not found`);
    const indent = src.lastIndexOf("\n", at);
    const pad = src.slice(indent + 1, at);
    const next = src.indexOf(`\n${pad}const `, at + 10);
    return src.slice(at, next < 0 ? undefined : next);
};

for (const [kind, { file, gen }] of Object.entries(PAGES)) {
    await check(`${kind}: the generator is a job, counted, and settles rather than announcing`, () => {
        const body = strip(bodyOf(read(file), gen));
        assert.match(body, new RegExp(`startJob\\(\\{\\s*kind: "${kind}"`), "not started as a job — leaving the page loses it again");
        assert.match(body, /\}, \{ onProgress: job\.progress \}\)/, "the model call is not counted — the card would never fill");
        assert.match(body, /job\.ready\(/);
        assert.match(body, /job\.fail\(/);
        assert.match(body, /runningIn\(getJobs\(\), "(quiz|flashcards|recall)"\)/,
            "a double-press is checked against the render, which has not caught up with the first job");
        // The generator is a closure over the mount that STARTED it. A toast or
        // a setter for the result there reaches a mount the student may have
        // left — the page that shows the job announces it.
        assert.ok(!/toast\(\{\s*title: "(Quiz created!|New quiz created!)|toast\(\{\s*title: `\$\{(cards|response\.questions)\.length\}/.test(body),
            "the generator announces its own result");
        assert.ok(!/setQuestions\(|setGeneratedFlashcards\(|setIsShowingGenerated\(true\)/.test(body),
            "the generator hands its result to the mount that started it, not the one showing it");
    });
}

await check("every page that shows a job takes it through the one hand-back", () => {
    for (const [kind, file] of [["quiz", PAGES.quiz.file], ["flashcards", PAGES.flashcards.file], ["recall", PAGES.recall.file]]) {
        const src = strip(read(file));
        assert.match(src, new RegExp(`useJobView\\("${kind}", \\{[\\s\\S]{0,160}onSettled:`), `${file} does not watch its ${kind} job`);
    }
});

await check("what decides whether a page is showing its job is declared BEFORE the hook reads it", () => {
    // `show` runs during render as soon as a job is running. A state it names
    // that is declared further down is in its temporal dead zone, so the page
    // crashes the moment the first generate starts — found in the browser,
    // with the card still counting over an error screen.
    for (const file of [PAGES.quiz.file, PAGES.flashcards.file, PAGES.recall.file]) {
        const src = strip(read(file));
        const at = src.indexOf("useJobView(");
        const show = src.slice(at).match(/show:\s*([^\n]+)/)[1];
        for (const name of new Set(show.match(/[A-Za-z_]\w*/g))) {
            const decl = src.search(new RegExp(`const \\[${name},|const ${name} =`));
            if (decl < 0) continue;
            assert.ok(decl < at, `${file}: show reads ${name} before it is declared`);
        }
    }
});

await check("a held result is taken where Open lands", () => {
    const quizzes = strip(read(PAGES.quiz.file));
    assert.match(quizzes, /searchParams\.get\("open"\)[\s\S]{0,900}adoptJob\("quiz"[\s\S]{0,120}setPendingQuiz\(target\)/,
        "?open= no longer opens the quiz it made");
    assert.match(strip(read(PAGES.flashcards.file)), /adoptJob\("flashcards"/);
    assert.match(strip(read(PAGES.recall.file)), /adoptJob\("recall"/);
    const study = strip(read("src/pages/Study.jsx"));
    assert.match(study, /URLSearchParams\(location\.search\)\.get\('tab'\)[\s\S]{0,120}\}, \[location\.search, location\.key\]\)/,
        "Study reads ?tab= once (or only when the query changes) — Review from a page already on Study, " +
        "whose address can already say ?tab=spaced_repetition, lands on the tab it was on");
});

await check("a page's own bar stands the card down only while it is ON SCREEN", () => {
    const tray = strip(read("src/components/shared/JobTray.jsx"));
    assert.match(tray, /useJobDisplay\(job\?\.kind \|\| "quiz", claims && onScreen && job\?\.status === "running"\)/,
        "a mounted-but-unseen bar (the deck screen's, under the fold) hid the card");
    const store = strip(read("src/lib/jobStore.js"));
    assert.match(store, /new IntersectionObserver\(/);
    // Watching is what the hand-back needs; drawing is what hides the card.
    assert.match(store, /showing \? claimWatch\(kind\) : undefined/);
    assert.ok(!/showing \? claimDisplay\(kind\)/.test(store), "watching a job must not hide the card by itself");
    const skeleton = strip(read("src/components/shared/AISkeleton.jsx"));
    assert.match(skeleton, /<JobBar job=\{job\} claims \/>/);
    assert.ok(skeleton.indexOf("<JobBar") < skeleton.indexOf("<LoadingQuiz"),
        "the counted bar leads the skeleton — under the warm-up quiz it was below the fold");
    assert.match(strip(read(PAGES.recall.file)), /<JobBar job=\{recallJob\} claims \/>/);
});

await check("the card is mounted once for every page, and asks before a running job is closed", () => {
    const layout = strip(read("src/Layout.jsx"));
    assert.equal((layout.match(/<JobTray /g) || []).length, 1);
    const tray = strip(read("src/components/shared/JobTray.jsx"));
    assert.match(tray, /if \(!running\) return undefined;[\s\S]{0,200}window\.addEventListener\("beforeunload", warn\)/);
});

await check("the card stays clear of Ace's corner and the nav on a phone", () => {
    const tray = strip(read("src/components/shared/JobTray.jsx"));
    // Ace's launcher: `fixed right-4 bottom-24`, 64px wide. right-24 is 96px.
    assert.match(tray, /left-4 right-24 bottom-\[5\.25rem\]/);
    assert.match(tray, /md:right-auto md:left-\[5\.5rem\] md:bottom-6/, "the laptop corner is the side rail's other side");
});

console.log(`\n${passed} passed${process.exitCode ? " — SOME FAILED" : ""}\n`);
