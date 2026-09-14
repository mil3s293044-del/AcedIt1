/**
 * uploadPrep — get a student's file into a shape the model can actually read,
 * BEFORE it leaves their phone.
 *
 * ═══ What this exists to fix ════════════════════════════════════════════════
 * Uploads failed three different ways and every one of them reached the student
 * as the same thing: nothing happened.
 *
 *   · The server accepted 30 MB. Claude's real ceiling is 10 MB of BASE64 for
 *     an image, which is about 7.5 MB of actual file — so a perfectly ordinary
 *     phone photo passed our check, got base64-encoded, and was rejected by the
 *     API with nothing on screen to explain it.
 *   · Nothing in the app checked a file's size at all. The first thing that
 *     looked at it was Anthropic.
 *   · And the file pickers did not accept images, on an app whose users are
 *     sixteen and photograph their notes.
 *
 * ═══ THE FIX FOR PHOTOS IS NOT A LIMIT, IT IS A RESIZE ══════════════════════
 * Claude downsamples every image to 1568 px (2576 px on the newer models) on
 * its long edge before it reads anything. So an 8 MB 12-megapixel photo is
 * carrying millions of pixels that are thrown away on arrival — it is slower to
 * upload on school wifi, costs more tokens, and is more likely to be refused,
 * in exchange for detail the model never sees. Resizing to 2000 px on the long
 * edge gets it under 500 KB and loses NOTHING that gets read.
 *
 * So the limit is the fallback, not the mechanism. Almost no photo should ever
 * be too big again.
 *
 * ═══ AND A FILE IS NEVER TURNED AWAY OVER A HEADER ══════════════════════════
 * Browsers disagree about MIME types: the same JPEG arrives as `image/jpeg` on
 * one device, `image/jpg` on another, and `application/octet-stream` from a
 * drag-and-drop or an Android file picker. The server matched on the MIME type
 * alone and dropped the other two as "unsupported file type" — a valid, small,
 * readable file refused because of a string the student never chose. The
 * extension is the fallback whenever the type is missing or unrecognised.
 */

/**
 * Claude's own limits, with the arithmetic left visible.
 *
 * The API states its image ceiling in BASE64 bytes, and base64 inflates by 4/3
 * — so the number a file picker has to enforce is three quarters of the stated
 * one. Writing `7.5 MB` as a constant would hide exactly the step that was got
 * wrong, so it is derived here instead.
 */
const MB = 1024 * 1024;
export const BASE64_INFLATION = 4 / 3;
export const IMAGE_BASE64_CAP = 10 * MB;          // Claude API, direct
export const IMAGE_RAW_CAP = Math.floor(IMAGE_BASE64_CAP / BASE64_INFLATION);

/**
 * PDFs go into the request as base64 too, and the whole request is capped at
 * 32 MB. 16 MB of PDF is ~21 MB encoded, which leaves real headroom for the
 * prompt and any other attachment rather than sitting on the line.
 */
export const PDF_RAW_CAP = 16 * MB;

/** DOCX/PPTX/TXT are extracted to TEXT on the server and never base64'd into
 *  the request, so the API's limits do not apply — only what we can chew. */
export const DOC_RAW_CAP = 25 * MB;

/** Long edge to resize a photo down to before upload. */
export const IMAGE_MAX_EDGE = 2000;
export const IMAGE_QUALITY = 0.85;

/** A PDF past this is legal but slow, expensive, and loses detail in the noise. */
export const PDF_PAGES_WARN = 150;

const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"]);
const DOC_EXT = new Set(["docx", "pptx"]);
const TEXT_EXT = new Set(["txt", "md", "csv"]);

/** Formats a browser canvas can actually decode, so can actually shrink. */
const DECODABLE = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export const extOf = (name) => String(name || "").split(".").pop()?.toLowerCase() || "";

/**
 * What KIND of thing this is, from the MIME type OR the extension.
 *
 * Either one is enough. The MIME type is preferred when it says something
 * useful and ignored when it does not — `application/octet-stream` is a
 * browser saying "I don't know", not a file saying "I am binary".
 */
export function kindOf(file) {
    const type = String(file?.type || "").toLowerCase();
    const ext = extOf(file?.name);

    if (type.startsWith("image/") || IMAGE_EXT.has(ext)) return "image";
    if (type === "application/pdf" || ext === "pdf") return "pdf";
    if (type.includes("wordprocessingml") || type.includes("presentationml") || DOC_EXT.has(ext)) {
        return "doc";
    }
    if (type.startsWith("text/") || TEXT_EXT.has(ext)) return "text";
    return null;
}

export function capFor(kind) {
    if (kind === "image") return IMAGE_RAW_CAP;
    if (kind === "pdf") return PDF_RAW_CAP;
    if (kind === "doc" || kind === "text") return DOC_RAW_CAP;
    return 0;
}

/** Always one decimal. "10 MB" next to a 7.5 MB limit reads as a rounding
 *  argument; "9.7 MB" is a fact the student can act on. */
export const mb = (bytes) => `${(bytes / MB).toFixed(1)} MB`;

/** Only images get shrunk, and only the ones a canvas can decode. HEIC cannot
 *  be read by most browsers, so it travels whole and the server converts it. */
export function canShrink(file) {
    return kindOf(file) === "image" && DECODABLE.has(String(file?.type || "").toLowerCase());
}

/**
 * Fit inside a square without distorting. Returns null when it already fits —
 * re-encoding a small image would cost quality and gain nothing.
 */
export function targetSize(width, height, maxEdge = IMAGE_MAX_EDGE) {
    const w = Math.max(0, Math.round(width) || 0);
    const h = Math.max(0, Math.round(height) || 0);
    if (!w || !h) return null;
    const longest = Math.max(w, h);
    if (longest <= maxEdge) return null;
    const scale = maxEdge / longest;
    return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/**
 * The verdict on one file, BEFORE anything is uploaded or resized.
 *
 * `shrink` means "too big, but we can fix that ourselves" — the student never
 * has to hear about it. `reason` is only ever set for something they actually
 * have to act on, and it names the file and the limit rather than saying the
 * upload failed.
 */
export function inspect(file) {
    const kind = kindOf(file);
    const size = Math.max(0, Number(file?.size) || 0);
    const name = file?.name || "that file";

    if (!kind) {
        return {
            ok: false, kind: null,
            reason: `${name} isn't a format we can read — try a PDF, a Word or PowerPoint file, a text file, or a photo.`,
        };
    }
    if (kind === "image" && canShrink(file)) {
        // Size is not a verdict for these: they get resized, and a 2000px JPEG
        // is under half a megabyte whatever it started as.
        return { ok: true, kind, shrink: true };
    }
    const cap = capFor(kind);
    if (size > cap) {
        return {
            ok: false, kind,
            reason: kind === "image"
                ? `${name} is ${mb(size)}. Photos need to be under ${mb(cap)} — try taking it again, or save it as a JPEG.`
                : `${name} is ${mb(size)}. The limit is ${mb(cap)} — try splitting it up.`,
        };
    }
    return { ok: true, kind, shrink: false };
}

/**
 * How many pages a PDF has, counted off the raw bytes.
 *
 * Deliberately a heuristic and deliberately only a WARNING. Both models the app
 * uses have a 1M context, so the API's own page ceiling is 600 and nothing here
 * is close to it — what a 300-page past-paper book actually costs is money,
 * minutes, and detail lost in the noise. Returns null when it cannot tell,
 * which is the honest answer for a compressed or linearised PDF, and null must
 * never read as "fine".
 */
export function countPdfPages(bytes) {
    try {
        const text = new TextDecoder("latin1").decode(bytes);
        const matches = text.match(/\/Type\s*\/Page[^s]/g);
        const n = matches ? matches.length : 0;
        return n > 0 ? n : null;
    } catch {
        return null;
    }
}

// ─── The browser half ───────────────────────────────────────────────────────
// Everything above is pure and tested in node. Everything below touches canvas
// and only runs in a browser, which is why the split is where it is.

/** Decode → draw at the smaller size → re-encode. Returns the original when
 *  there is nothing to gain, so a screenshot is never re-compressed for free. */
async function shrinkImage(file) {
    const bitmap = await createImageBitmap(file);
    try {
        const target = targetSize(bitmap.width, bitmap.height);
        // Already small enough AND already a reasonable size on disk: leave it
        // completely alone. Re-encoding a clean PNG diagram as JPEG would add
        // artefacts to the one kind of image where they cost the most.
        if (!target && file.size <= IMAGE_RAW_CAP) return file;

        const w = target?.width ?? bitmap.width;
        const h = target?.height ?? bitmap.height;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return file;
        // White behind it: a transparent PNG flattened onto nothing comes out
        // black, which turns a diagram into a solid rectangle.
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(bitmap, 0, 0, w, h);

        const blob = await new Promise((resolve) =>
            canvas.toBlob(resolve, "image/jpeg", IMAGE_QUALITY));
        if (!blob) return file;
        // If the "shrunk" file came out bigger, the original was better.
        if (blob.size >= file.size && !target) return file;

        const base = String(file.name || "photo").replace(/\.[^.]+$/, "");
        return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
    } finally {
        bitmap.close?.();
    }
}

/**
 * Prepare a whole batch. NOTHING THROWS: a file that cannot be used comes back
 * in `skipped` with a sentence naming it, and everything else still goes.
 *
 * That is the half of this the old code got wrong in a way nobody could see —
 * three of the four study tools ran their uploads through `Promise.all`, so one
 * unreadable file rejected the whole batch and the student got a dead button
 * with no idea which of their five files was the problem.
 */
export async function prepareFiles(files) {
    const list = Array.from(files || []);
    const ready = [];
    const skipped = [];
    const notes = [];

    for (const file of list) {
        const verdict = inspect(file);
        if (!verdict.ok) {
            skipped.push({ name: file?.name || "a file", reason: verdict.reason });
            continue;
        }
        if (verdict.shrink) {
            try {
                ready.push(await shrinkImage(file));
                continue;
            } catch {
                // Canvas refused it (a corrupt or exotic image). Fall through to
                // the size check rather than dropping it — the server may still
                // manage, and if it is genuinely too big we say so properly.
                if (file.size > IMAGE_RAW_CAP) {
                    skipped.push({
                        name: file.name,
                        reason: `${file.name} is ${mb(file.size)} and couldn't be resized. Photos need to be under ${mb(IMAGE_RAW_CAP)}.`,
                    });
                    continue;
                }
            }
        }
        if (verdict.kind === "pdf") {
            try {
                const pages = countPdfPages(await file.arrayBuffer());
                if (pages && pages > PDF_PAGES_WARN) {
                    notes.push(`${file.name} is about ${pages} pages — this will be slow, and the detail in a book that long tends to get lost. Splitting it into chapters works better.`);
                }
            } catch { /* unreadable page count is not a reason to refuse a file */ }
        }
        ready.push(file);
    }
    return { ready, skipped, notes };
}
