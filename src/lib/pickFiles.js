/**
 * pickFiles — the one place a student's file is accepted into the app.
 *
 * ═══ Why this is shared rather than written six times ═══════════════════════
 * Six surfaces take uploads (Flashcards, Active Recall ×2, Blurting, Cheat
 * Sheet, Quizzes) and every one of them had its own `accept` string and its own
 * handler. They had already drifted into four different answers to "what can I
 * give you":
 *
 *     Flashcards    .pdf .txt .docx .pptx
 *     Active Recall .pdf .docx .pptx          ← not even plain text
 *     Blurting      .pdf .docx .pptx .txt
 *     Cheat Sheet   .pdf .txt .docx .pptx
 *
 * None of them accepted an IMAGE, on an app for sixteen-year-olds, whose server
 * has read JPEG, PNG, GIF and WebP — and transcoded HEIC — the entire time.
 * Photographing your notes is the most natural way a student has of getting
 * material into this app and it was the one thing they could not do. That is
 * most of what "even smaller files get rejected" turned out to be: a 2 MB photo
 * refused by a file picker, not by a size limit.
 *
 * ═══ A FileList IS LIVE, AND CLEARING THE INPUT EMPTIES IT ══════════════════
 * `e.target.files` is not an array and not a snapshot — it is a reference to
 * the input's CURRENT selection. Every picker resets the input after a pick so
 * the same file can be chosen twice in a row (without the reset, re-picking
 * fires no `change` event at all), and this is the order that has to hold:
 *
 *     const picked = Array.from(e.target.files || []);   // copy FIRST
 *     e.target.value = "";                               // then reset
 *
 * Read straight through — `const picked = e.target.files` before the reset —
 * the list is already empty by the time anything looks at it. `prepareFiles`
 * then returns `{ ready: [], skipped: [] }`, which is indistinguishable from a
 * cancelled dialog: NO error, NO toast, no file in the list. It shipped to five
 * pickers at once and made uploading look completely dead across the app.
 * `uploadPrep.test.mjs` scans for it, because nothing else can see it.
 *
 * ═══ NOTHING THROWS, AND NOTHING SILENTLY VANISHES ══════════════════════════
 * A file that cannot be used is reported BY NAME with the reason, and every
 * other file still goes through. Three of the four study tools ran their
 * uploads through `Promise.all`, so one unreadable file rejected the whole
 * batch and the student got a dead button with no idea which of their five
 * files was the problem.
 */
import { prepareFiles } from "@/lib/uploadPrep";

/**
 * What the pickers offer. Images are listed by extension AND by `image/*`,
 * because iOS reports HEIC inconsistently and a bare extension list hides the
 * camera roll on some Android builds.
 */
export const STUDY_ACCEPT =
    ".pdf,.txt,.docx,.pptx,.png,.jpg,.jpeg,.webp,.heic,.heif,image/*";

/** The line under the button, so the picker and the copy cannot disagree. */
export const STUDY_ACCEPT_LABEL = "PDF, Word, PowerPoint, text — or a photo of your notes";

/**
 * Take a FileList, hand back what is usable.
 *
 * Photos are resized here rather than refused: Claude downsamples every image
 * to 1568–2576 px on its long edge anyway, so the megapixels in a phone photo
 * are thrown away on arrival. Shrinking first makes the upload faster on school
 * wifi, cheaper in tokens, and — the point — no longer capable of exceeding a
 * limit. See uploadPrep.js.
 *
 * `existing` dedupes by name so picking twice does not double a file.
 */
export async function acceptFiles(fileList, { toast, existing = [] } = {}) {
    const { ready, skipped, notes } = await prepareFiles(fileList);

    skipped.forEach((s) => toast?.({
        title: "Couldn't use that one",
        description: s.reason,
        variant: "destructive",
    }));
    // A note is advice, not a refusal — the file is going either way.
    notes.forEach((n) => toast?.({ title: "Heads up", description: n }));

    const seen = new Set((existing || []).map((f) => f.name));
    return [...(existing || []), ...ready.filter((f) => {
        if (seen.has(f.name)) return false;
        seen.add(f.name);
        return true;
    })];
}

/**
 * Upload a batch and keep going when one fails.
 *
 * `Promise.all` is the wrong primitive for a list of independent uploads: it
 * rejects on the FIRST failure and discards every result that did succeed, so a
 * single expired or oversized file turned a five-file generate into nothing at
 * all. Returns what landed plus what did not, and the caller decides.
 */
export async function uploadAll(files, uploader) {
    const settled = await Promise.allSettled((files || []).map(async (f) => ({
        url: (await uploader({ file: f })).file_url,
        name: f.name,
        ext: String(f.name || "").split(".").pop()?.toLowerCase() || "",
    })));
    const uploaded = [];
    const failed = [];
    settled.forEach((r, i) => {
        if (r.status === "fulfilled" && r.value?.url) uploaded.push(r.value);
        else failed.push({ name: files[i]?.name || "a file", reason: r.reason?.message || "upload failed" });
    });
    return { uploaded, failed };
}
