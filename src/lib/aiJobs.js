/**
 * aiJobs — making a quiz, a deck or a set of questions, as something that
 * outlives the page it was started on.
 *
 * ─── WHAT WAS WRONG ─────────────────────────────────────────────────────────
 * A generate runs for twenty seconds to a couple of minutes, and students go
 * and do something else while it does. The request kept running — nothing
 * aborted it — but nothing on any other screen said so:
 *
 *   - a QUIZ saved itself in the background, silently, and a student who came
 *     back to the shelf and did not see it yet pressed generate a second time;
 *   - a DECK finished into a sessionStorage draft that only reappeared if they
 *     happened to open the flashcard screen again;
 *   - ACTIVE RECALL's questions landed in the state of a component that no
 *     longer existed, and were simply gone.
 *
 * So a creation is a JOB now (`jobStore.js`), owned by no page, and a floating
 * card on every other page says what is being made and how far along it is.
 *
 * ─── THE BAR IS COUNTED, NEVER TIMED ────────────────────────────────────────
 * The tempting bar eases toward 95% on a clock. It looks steadier and every
 * position on it is a guess, which is the "figure with nothing behind it" this
 * app refuses everywhere else. The model writes JSON and the server already
 * streams it, so the server counts each question or card as it CLOSES
 * (`createItemCounter`) and that count is what fills the bar: "6 of 10" is six
 * questions that exist.
 *
 * Before the first one there is nothing to count — the files are uploading, or
 * the model is reading them — and the bar says WHICH, with a moving sheen and
 * no movement in its fill. Where the student set no count ("as many cards as
 * the notes support") there is no denominator, and the line says "14 so far"
 * rather than inventing one.
 *
 * ─── THE BANDS ONLY STOP THE BAR RUNNING BACKWARDS ──────────────────────────
 * Upload, read, write and finish each own a fixed slice of the bar, so moving
 * from "2 of 2 files" to "0 of 10 questions" does not drop it to empty. The
 * slices are layout, not data: the PRINTED count is the measurement, and the
 * fill inside the write slice is that count and nothing else.
 *
 * Pure, so the test can hold it. No `@/` imports: `server.mjs` imports the
 * counter, and node cannot resolve the alias (serverBoot.test.mjs).
 */

/**
 * Counts the objects closed directly inside the FIRST array of a JSON object,
 * as text arrives in pieces. `{"questions":[{…},{…}` is two.
 *
 * Strings are skipped with their escapes, because a question about
 * `\frac{1}{2}` is full of braces that are not structure. Deeper arrays (a
 * multipart question's own parts) are not counted: a part is not a question.
 */
export function createItemCounter() {
    const stack = [];
    let inString = false;
    let escape = false;
    let items = 0;
    let chars = 0;
    return {
        push(text) {
            const s = String(text ?? "");
            chars += s.length;
            for (let i = 0; i < s.length; i++) {
                const ch = s[i];
                if (inString) {
                    if (escape) escape = false;
                    else if (ch === "\\") escape = true;
                    else if (ch === "\"") inString = false;
                    continue;
                }
                if (ch === "\"") inString = true;
                else if (ch === "{" || ch === "[") stack.push(ch);
                else if (ch === "}" || ch === "]") {
                    const closed = stack.pop();
                    if (closed === "{" && stack.length === 2 && stack[1] === "[" && stack[0] === "{") items += 1;
                }
            }
            return items;
        },
        get items() { return items; },
        get chars() { return chars; },
    };
}

/**
 * Server-sent events out of a buffer that may end mid-event. Returns the whole
 * events and what is left over for the next read. A `data:` line that is not
 * JSON is skipped rather than thrown on: one bad line must not lose the result
 * behind it.
 */
export function takeSseEvents(buffer) {
    const parts = String(buffer ?? "").split("\n\n");
    const rest = parts.pop() ?? "";
    const events = [];
    for (const raw of parts) {
        if (!raw.trim()) continue;
        let event = "message";
        let data = "";
        for (const line of raw.split("\n")) {
            if (line.startsWith("event: ")) event = line.slice(7).trim();
            else if (line.startsWith("data: ")) data += line.slice(6);
        }
        if (!data) continue;
        try { events.push({ event, data: JSON.parse(data) }); } catch { /* skipped */ }
    }
    return { events, rest };
}

/**
 * The events of a counted call, until `done` hands back the result. A
 * connection that closes without one is a FAILURE, never an empty success —
 * an empty quiz saved as if it were finished is worse than an error.
 * `stillAlive` is called on every chunk, the heartbeat included, so the
 * caller can time the call on silence rather than in total.
 */
export async function readCounted(body, onProgress, stillAlive = () => {}) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        stillAlive();
        buffer += decoder.decode(value, { stream: true });
        const { events, rest } = takeSseEvents(buffer);
        buffer = rest;
        for (const { event, data } of events) {
            if (event === "progress") {
                try { onProgress?.({ stage: data?.stage, items: Number(data?.items) || 0 }); } catch { /* a progress bar must never fail a generate */ }
            } else if (event === "done") {
                try { await reader.cancel(); } catch { /* already closed */ }
                return data;
            } else if (event === "error") {
                throw new Error(data?.message || "AI request failed");
            }
        }
    }
    throw new Error("The connection closed before the AI finished. Try again.");
}

/** What each kind of job makes, in the words the card prints. */
export const JOB_KINDS = {
    quiz: { noun: "quiz", unit: "question", units: "questions", reading: "Reading your notes", action: "Open" },
    reshuffle: { noun: "quiz", unit: "question", units: "questions", reading: "Reading the quiz", action: "Open" },
    flashcards: { noun: "deck", unit: "card", units: "cards", reading: "Reading your notes", action: "Review" },
    recall: { noun: "question set", unit: "question", units: "questions", reading: "Reading your notes", action: "Start" },
    // Revision's "Test me": a quiz made of one question per key-knowledge
    // point. It IS a quiz being made, so it shares the quiz lane.
    check: { noun: "knowledge check", unit: "question", units: "questions", reading: "Reading your checklist", action: "Sit it" },
};

/** The lane a kind runs in: one job per lane. A reshuffle IS a quiz being made, and so is a check. */
export const laneOf = (kind) => (kind === "reshuffle" || kind === "check" ? "quiz" : kind);

export const STAGES = ["upload", "read", "write", "finish"];

/** Where each stage's slice of the bar starts and ends. Layout, not data. */
export const BANDS = {
    withFiles: { upload: [0, 0.12], read: [0.12, 0.2], write: [0.2, 0.94], finish: [0.94, 1] },
    noFiles: { upload: [0, 0], read: [0, 0.1], write: [0.1, 0.94], finish: [0.94, 1] },
};

const clamp01 = (x) => Math.max(0, Math.min(1, x));

/** A whole number at or above zero, or null. `Number(null)` is 0, and a missing total is not a total of zero. */
const count = (v) => (v === null || v === undefined || v === "" ? null
    : (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.floor(Number(v)) : null));

/**
 * How full the bar is, and whether it is MOVING on a count or holding with a
 * sheen because there is nothing to count yet.
 */
export function jobFill(job) {
    if (!job) return { fill: 0, counting: false };
    if (job.status === "ready") return { fill: 1, counting: true };
    if (job.status === "failed") return { fill: 0, counting: false };
    const bands = count(job.files) > 0 ? BANDS.withFiles : BANDS.noFiles;
    const stage = STAGES.includes(job.stage) ? job.stage : "read";
    const [from, to] = bands[stage];
    let share = null;
    if (stage === "upload") {
        const total = count(job.files);
        const done = count(job.filesDone);
        share = total > 0 && done !== null ? Math.min(done, total) / total : null;
    } else if (stage === "write") {
        const total = count(job.total);
        const done = count(job.items);
        share = total > 0 && done !== null ? Math.min(done, total) / total : null;
    }
    return { fill: clamp01(from + (to - from) * (share ?? 0)), counting: share !== null };
}

/**
 * The words on the card: what is being made, what is happening, the count,
 * and what the button does. Every figure here is a count of something that
 * exists — files uploaded, items closed — and nothing else.
 */
export function jobLine(job) {
    const k = JOB_KINDS[job?.kind] || JOB_KINDS.quiz;
    const title = job?.title || `Your ${k.noun}`;
    if (!job) return { title, status: "", detail: "", action: null };
    const plural = (n) => (n === 1 ? k.unit : k.units);

    if (job.status === "failed") {
        return { title, status: "Couldn't finish", detail: job.error || "Something went wrong. Nothing was saved.", action: null };
    }
    if (job.status === "ready") {
        const n = count(job.items);
        // The count sits beside the bar; anything worth saying beyond it is a
        // NOTE on its own line, or a long one squeezes the bar to a stub.
        return {
            title,
            status: "Ready",
            detail: n ? `${n} ${plural(n)}` : "",
            note: job.note || "",
            action: k.action,
        };
    }
    const stage = STAGES.includes(job.stage) ? job.stage : "read";
    if (stage === "upload") {
        const total = count(job.files);
        const done = Math.min(count(job.filesDone) ?? 0, total ?? 0);
        return { title, status: total === 1 ? "Uploading your file" : "Uploading your files", detail: total > 1 ? `${done} of ${total}` : "", action: null };
    }
    if (stage === "write") {
        const total = count(job.total);
        const done = count(job.items) ?? 0;
        const status = `Writing ${k.units}`;
        if (total > 0) return { title, status, detail: `${Math.min(done, total)} of ${total}`, action: null };
        return { title, status, detail: done > 0 ? `${done} so far` : "", action: null };
    }
    if (stage === "finish") return { title, status: "Finishing up", detail: "", action: null };
    return { title, status: k.reading, detail: "", action: null };
}

/** The one job running in a kind's lane, if any — what stops a second generate. */
export function runningIn(jobs, kind) {
    const lane = laneOf(kind);
    return (jobs || []).find((j) => j.status === "running" && laneOf(j.kind) === lane) || null;
}

/**
 * Jobs the floating card should show: the current student's, less two kinds.
 * A RUNNING job whose bar a page is drawing on screen (`displayed`) — the
 * student is already looking at it. And a SETTLED job a page is watching
 * (`watched`) — that page takes it in the same breath, and without this the
 * card would flash "Ready" for the frame in between.
 */
export function trayJobs(jobs, { email, displayed = [], watched = [] } = {}) {
    const drawn = new Set(displayed.map(laneOf));
    const taken = new Set(watched.map(laneOf));
    return (jobs || []).filter((j) =>
        (!email || !j.email || j.email === email)
        && !(j.status === "running" && drawn.has(laneOf(j.kind)))
        && !(j.status !== "running" && taken.has(laneOf(j.kind))));
}

/**
 * HANDING BACK: which job a page is watching, and whether it has settled.
 *
 * A page that is SHOWING a job (its own skeleton) takes it when it finishes,
 * and does what it always did with it. The decision cannot live in the
 * generator: the generator is a closure over the mount that STARTED the job,
 * and a student who left mid-generate and came back is looking at a different
 * mount — whose state that closure cannot reach. So the generator only ever
 * marks the job settled, and whichever mount is watching takes it.
 *
 *   showing a running job        → watch it
 *   stopped showing it mid-run   → let it go to the card (the dialog closed)
 *   the watched job has settled  → take it, ready or failed
 *   the watched job is gone      → it was dismissed or opened elsewhere
 */
export function watchStep({ jobs, watched = null, showing = false, running = null } = {}) {
    const id = showing && running ? running.id : watched;
    if (!id) return { watched: null, settle: null };
    const job = (jobs || []).find((j) => j.id === id);
    if (!job) return { watched: null, settle: null };
    if (job.status === "running") return { watched: showing ? id : null, settle: null };
    return { watched: null, settle: job };
}
