/**
 * megaUpload — a textbook is stored WHOLE and read a CHAPTER at a time.
 *
 * ═══ Why a big upload is not just a bigger upload ═══════════════════════════
 * The ordinary path tops out at 16 MB for a PDF because a Messages request may
 * be 32 MB in total. Raising that number is the easy half and it is not the
 * problem. The problem is that **reading a document costs input tokens for
 * every page of it, every single time**, and a textbook is enormous:
 *
 *   Claude's own docs: 1,500–3,000 tokens of TEXT per page, plus the image
 *   tokens for the page picture, because each page is rendered and read as
 *   both. That is about 4,600 tokens a page all in.
 *
 * So 600 pages is roughly 2.8M input tokens. On Sonnet that is about $8.30 —
 * against a weekly AI budget of $1.95 for the whole student (chips.js). One
 * press of "make flashcards from my textbook" would cost more than four weeks
 * of everything else they do.
 *
 * ═══ The shape that actually works ═════════════════════════════════════════
 * UPLOAD WHOLE, GENERATE FROM A RANGE. The book is stored once; each generate
 * names the pages it wants and only those pages are sent. Three things fall
 * out of that and all three are improvements:
 *
 *   - **It is affordable.** A 40-page chapter is ~95 chips of reading on top of
 *     the feature's own price, which is a normal action. The whole book is
 *     ~1,400 and the app says so before anything is spent rather than after.
 *   - **It is the better ask.** "Make me flashcards from these 600 pages"
 *     produces mush; "from chapter 7" produces a deck a student can sit down
 *     with. The constraint is pointing at the right thing anyway.
 *   - **It never holds a textbook in memory.** The slice is built on the
 *     server from the stored original and only the slice is ever encoded —
 *     which matters on a 512 MB box that has already been OOM'd once by a
 *     30 MB PDF (see the uploads section of CLAUDE.md).
 *
 * ═══ THE PRICE IS SHOWN BEFORE IT IS SPENT ═════════════════════════════════
 * `chipsForRange` is the same arithmetic on the client and the server, so the
 * number under the range picker is the number that gets charged. A student who
 * drags the range wider watches the price climb. That is the whole reason the
 * cost model lives in a shared file instead of inside the endpoint.
 *
 * ═══ AND IT READS ON HAIKU, WHICH THE PANEL SAYS OUT LOUD ══════════════════
 * Input tokens are the entire cost of a mega read and Haiku is 3× cheaper on
 * them, so the same chapter is 95 chips rather than 283. Pulling facts out of
 * a textbook is bulk comprehension rather than the subtle judgement marking
 * needs — the same reasoning that keeps handwriting on `VISION_MODEL` and
 * pushes prose tools onto the cheap model, applied in the other direction.
 * The screen NAMES the model, because a student who gets a thinner result than
 * they expected deserves to know why rather than concluding the app is bad.
 */

import { MICROS_PER_CHIP } from "./chips.js";
import { PDF_RAW_CAP } from "./uploadPrep.js";

/** The ceiling on a stored book. The Files API would take 500 MB; this is ours. */
export const MEGA_FILE_CAP = 100 * 1024 * 1024;

/**
 * The API's page ceiling, which applies to a REQUEST and not to the file.
 * 600 holds only on a model with a 1M context window; under that it is 100.
 * Nothing here ever sends 600 — see RANGE_PAGE_CAP — but a book longer than
 * this cannot be sliced meaningfully either, so it is where a file is refused.
 */
export const MEGA_PAGE_CAP = 600;

/** Above this, a PDF has to come through the mega path. Below it, nothing changes. */
export const MEGA_AT = PDF_RAW_CAP;

/**
 * The most pages ONE generate may send.
 *
 * Not an API limit — an affordability and quality one. 120 pages is a long
 * chapter, costs about a third of a week's chips to read, and is already past
 * the point where "make cards from this" starts returning generalities. The
 * cap is what stops a student spending their whole stack in one press.
 */
export const RANGE_PAGE_CAP = 120;

/**
 * How many books a student may have stored at once.
 *
 * Deliberately small, and it is about STORAGE rather than about cost: reading
 * is what costs and chips govern that. At 100 MB a book, this is the number
 * that decides whether the bucket fits the Supabase plan — see the note in
 * CLAUDE.md before raising it.
 *
 * There is deliberately NO separate "uploads per week" counter. It would be a
 * second limit on the same resource, and the sweep already evicts the oldest
 * book past this number — so a student who uploads ten in a day still ends the
 * day holding two. A constant that looks like a rule and enforces nothing is
 * the "collect nothing you don't use" trap in its most confusing form.
 */
export const MEGA_ACTIVE_MAX = 2;

/** How long a stored book lives. Long enough to work a term's chapters from. */
export const MEGA_TTL_HOURS = 7 * 24;

/**
 * Tokens one page costs to read, all in.
 *
 * 2,250 of text (the midpoint of the documented 1,500–3,000) plus 2,341 for
 * the page image, which is 1568 × 1120 ÷ 750 at the long edge Claude
 * downsamples to. Written as the sum so the half that was nearly forgotten —
 * every page is read as a PICTURE as well as as text — stays visible.
 */
export const PAGE_TEXT_TOKENS = 2250;
export const PAGE_IMAGE_TOKENS = Math.round((1568 * 1120) / 750);
export const TOKENS_PER_PAGE = PAGE_TEXT_TOKENS + PAGE_IMAGE_TOKENS;

/** The model a mega read runs on, and its input rate in dollars per Mtok. */
export const MEGA_MODEL = "claude-haiku-4-5";
export const MEGA_MODEL_LABEL = "Haiku 4.5";
const MEGA_INPUT_RATE = 1.0;

const clampInt = (v, lo, hi) => {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n)) return lo;
    return Math.max(lo, Math.min(hi, n));
};

/**
 * What reading `pages` pages costs, in chips.
 *
 * Rounded ONCE at the end rather than per page: rounding each page up turns a
 * 2.36-chip page into 3 and overcharges a 40-page chapter by 27%.
 */
export function chipsForRange(pages) {
    const n = Math.max(0, Math.round(Number(pages) || 0));
    if (n <= 0) return 0;
    const micros = (n * TOKENS_PER_PAGE / 1e6) * MEGA_INPUT_RATE * 1e6;
    return Math.max(1, Math.ceil(micros / MICROS_PER_CHIP));
}

/** The whole bill: the pages, plus whatever the feature itself costs. */
export function megaPrice(pages, featurePrice = 0) {
    const read = chipsForRange(pages);
    return { read, feature: Math.max(0, Math.round(featurePrice) || 0),
        total: read + Math.max(0, Math.round(featurePrice) || 0) };
}

/**
 * A page range the student typed, made safe.
 *
 * Pages are 1-BASED here, because that is what is printed on the paper and
 * what a student reads off a contents page. The conversion to indices happens
 * once, on the server, where the slice is cut.
 *
 * Reversed input is swapped rather than refused — somebody typing "248-214"
 * meant a range, and the error message for it would teach nothing.
 */
export function normaliseRange(from, to, totalPages) {
    const total = Math.max(1, Math.round(Number(totalPages) || 1));
    let a = clampInt(from, 1, total);
    let b = clampInt(to, 1, total);
    if (a > b) [a, b] = [b, a];
    // The cap bites at the END, so the start the student chose is respected.
    if (b - a + 1 > RANGE_PAGE_CAP) b = a + RANGE_PAGE_CAP - 1;
    return { from: a, to: Math.min(b, total), pages: Math.min(b, total) - a + 1 };
}

/** "214-248", "214 to 248", "214". Anything else is null rather than a guess. */
export function parseRange(text, totalPages) {
    const s = String(text || "").trim();
    if (!s) return null;
    const m = s.match(/^(\d+)\s*(?:-|–|—|to|\.\.)\s*(\d+)$/i) || s.match(/^(\d+)$/);
    if (!m) return null;
    return normaliseRange(m[1], m[2] ?? m[1], totalPages);
}

/**
 * The range to open the picker on: A TYPICAL CHAPTER, not the ceiling.
 *
 * Opening at `RANGE_PAGE_CAP` greets a student with a third of their weekly
 * stack and a slider already pinned to the far right, which reads as "this is
 * what it costs" rather than "this is where you start". 30 pages is what a
 * chapter usually is, it costs about what a quiz does, and the slider has
 * somewhere obvious to go in both directions.
 */
export const DEFAULT_RANGE_PAGES = 30;

export function defaultRange(totalPages) {
    const total = Math.max(1, Math.round(Number(totalPages) || 1));
    return normaliseRange(1, Math.min(DEFAULT_RANGE_PAGES, total), total);
}

/**
 * A 1-based page range as the ZERO-BASED indices a PDF library wants.
 *
 * The one place the conversion happens. It lives here rather than inside the
 * slice because an off-by-one is invisible in the result — page 214 comes back
 * looking exactly like page 215 unless somebody checks the number printed on
 * it — and a function is testable where a loop inside an endpoint is not.
 */
export function pageIndices(from, to, totalPages) {
    const r = normaliseRange(from, to, totalPages);
    const out = [];
    for (let i = r.from; i <= r.to; i += 1) out.push(i - 1);
    return out;
}

/** Is this file big enough to need the mega path? PDFs only — see `megaReason`. */
export function isMegaCandidate(file) {
    const name = String(file?.name || "").toLowerCase();
    const type = String(file?.type || "").toLowerCase();
    const pdf = type === "application/pdf" || name.endsWith(".pdf");
    return pdf && Number(file?.size || 0) > MEGA_AT;
}

/**
 * Why a file cannot be a mega upload, or null when it can.
 *
 * Only PDFs. A 60 MB DOCX is a real thing and its text extracts to a few
 * hundred KB, so it has never been bounded by the same ceiling — and there is
 * no such thing as a page range in a DOCX to slice on.
 */
export function megaReason(file) {
    const name = String(file?.name || "").toLowerCase();
    const type = String(file?.type || "").toLowerCase();
    if (!(type === "application/pdf" || name.endsWith(".pdf"))) {
        return "Big uploads are PDFs only — a Word file or a slide deck is read as text and has no pages to pick from.";
    }
    if (Number(file?.size || 0) > MEGA_FILE_CAP) {
        return `That file is ${(file.size / 1048576).toFixed(1)} MB. The largest book we store is ${(MEGA_FILE_CAP / 1048576).toFixed(0)} MB.`;
    }
    return null;
}

/** One line for the picker, so the price is never a surprise. */
export function priceLine(pages, featurePrice = 0) {
    const p = megaPrice(pages, featurePrice);
    return `${p.total} chips — ${pages} page${pages === 1 ? "" : "s"} to read (${p.read})`
        + (p.feature ? ` plus ${p.feature} to generate` : "");
}
