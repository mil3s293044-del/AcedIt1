/**
 * mega upload assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/megaUpload.test.mjs
 *
 * Two failures matter here and neither is a crash.
 *
 * THE PRICE THE PICKER PRINTS MUST BE THE PRICE THAT IS CHARGED. The server
 * imports `chipsForRange` rather than reimplementing it, so the guard is that
 * nothing ELSE computes a page price — a scan at the bottom holds that.
 *
 * AND A MISSING RANGE MUST NEVER MEAN "THE WHOLE BOOK". A 600-page read is
 * ~1,400 chips against a 1,000-chip weekly stack, so the default has to fail
 * small. Every clamp here is pointed the same way.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
    MEGA_FILE_CAP, MEGA_PAGE_CAP, MEGA_AT, RANGE_PAGE_CAP, MEGA_ACTIVE_MAX,
    TOKENS_PER_PAGE, PAGE_TEXT_TOKENS, PAGE_IMAGE_TOKENS, MEGA_MODEL,
    chipsForRange, megaPrice, normaliseRange, parseRange, defaultRange, pageIndices,
    DEFAULT_RANGE_PAGES,
    isMegaCandidate, megaReason, priceLine,
} from "@/lib/megaUpload";
import { WEEKLY_CHIPS, MICROS_PER_CHIP, PRICE } from "@/lib/chips";
import { PDF_RAW_CAP } from "@/lib/uploadPrep";
import { PRICES } from "@/lib/aiCost";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

// ─── The cost model, which is the whole reason this feature has a shape ─────

check("a page is read as TEXT AND AS A PICTURE, and both are counted", () => {
    // Forgetting the image half halves the estimate and doubles the real bill.
    assert.equal(TOKENS_PER_PAGE, PAGE_TEXT_TOKENS + PAGE_IMAGE_TOKENS);
    assert.ok(PAGE_IMAGE_TOKENS > 2000, "a full page at 1568px is over 2k tokens");
});

check("a chapter is affordable and a whole textbook is not", () => {
    // This is the arithmetic the whole design falls out of. If it ever stops
    // holding, the page cap and the range picker are both answering a question
    // that no longer exists.
    assert.ok(chipsForRange(40) < WEEKLY_CHIPS / 4, "a 40-page chapter is a normal action");
    assert.ok(chipsForRange(600) > WEEKLY_CHIPS, "600 pages costs more than a whole week");
});

check("the price is linear and rounded ONCE, not per page", () => {
    // Rounding each page up turns a 2.36-chip page into 3 and overcharges a
    // 40-page chapter by better than a quarter.
    const per = chipsForRange(1);
    assert.ok(chipsForRange(40) < per * 40, "per-page rounding would cost more");
    assert.ok(Math.abs(chipsForRange(80) - 2 * chipsForRange(40)) <= 1, "linear in pages");
});

check("the price is derived from the real rate, not typed", () => {
    const rate = PRICES[MEGA_MODEL]?.in;
    assert.ok(rate, `${MEGA_MODEL} must be in the price table`);
    const expected = Math.ceil((40 * TOKENS_PER_PAGE / 1e6) * rate * 1e6 / MICROS_PER_CHIP);
    assert.equal(chipsForRange(40), expected);
});

check("no pages costs nothing, and one page still costs something", () => {
    assert.equal(chipsForRange(0), 0);
    assert.equal(chipsForRange(-5), 0);
    assert.equal(chipsForRange(NaN), 0);
    assert.ok(chipsForRange(1) >= 1, "a free action is one somebody can run in a loop");
});

check("the bill is the pages plus the feature, both reported", () => {
    const p = megaPrice(40, PRICE.flashcard_ai_gen);
    assert.equal(p.read, chipsForRange(40));
    assert.equal(p.feature, PRICE.flashcard_ai_gen);
    assert.equal(p.total, p.read + p.feature);
});

// ─── Ranges: every clamp points at "smaller" ────────────────────────────────

check("the range cap bites at the END, so the chapter still starts where asked", () => {
    const r = normaliseRange(214, 600, 700);
    assert.equal(r.from, 214, "the start the student chose survives");
    assert.equal(r.pages, RANGE_PAGE_CAP);
});

check("a reversed range is swapped rather than refused", () => {
    assert.deepEqual(normaliseRange(248, 214, 400), { from: 214, to: 248, pages: 35 });
});

check("nothing can be asked for past the end of the book", () => {
    const r = normaliseRange(1, 9999, 12);
    assert.equal(r.to, 12);
    assert.equal(r.pages, 12);
});

check("garbage clamps to the first page rather than to the whole book", () => {
    for (const bad of [null, undefined, "abc", NaN, -4, {}]) {
        const r = normaliseRange(bad, bad, 600);
        assert.equal(r.from, 1, String(bad));
        assert.ok(r.pages <= RANGE_PAGE_CAP, String(bad));
    }
});

check("the picker opens on a CHAPTER, not on the ceiling", () => {
    const r = defaultRange(600);
    assert.equal(r.pages, DEFAULT_RANGE_PAGES);
    assert.ok(DEFAULT_RANGE_PAGES < RANGE_PAGE_CAP,
        "opening at the cap pins the slider to the right and reads as the price");
    assert.ok(chipsForRange(r.pages) < WEEKLY_CHIPS / 5,
        "the first thing a student sees must not be a wall");
});

check("a one-page book gives a one-page default", () => {
    assert.deepEqual(defaultRange(1), { from: 1, to: 1, pages: 1 });
});

check("the range a student types is parsed, and anything else REFUSES", () => {
    assert.deepEqual(parseRange("214-248", 400), { from: 214, to: 248, pages: 35 });
    assert.deepEqual(parseRange("214 to 248", 400), { from: 214, to: 248, pages: 35 });
    assert.deepEqual(parseRange("214–248", 400), { from: 214, to: 248, pages: 35 });
    assert.deepEqual(parseRange("7", 400), { from: 7, to: 7, pages: 1 });
    // Null, so the caller can snap back to the range that IS selected. A guess
    // here means the number on screen and the pages read disagree.
    for (const bad of ["", "chapter 7", "1-", "-5", "abc-def", null, undefined]) {
        assert.equal(parseRange(bad, 400), null, JSON.stringify(bad));
    }
});

// ─── Which files may take this path ─────────────────────────────────────────

check("a big PDF is a candidate and a small one is left alone", () => {
    assert.equal(isMegaCandidate({ name: "book.pdf", type: "application/pdf", size: MEGA_AT + 1 }), true);
    assert.equal(isMegaCandidate({ name: "notes.pdf", type: "application/pdf", size: 2e6 }), false);
});

check("the threshold IS the ordinary PDF cap — two numbers here would leave a gap", () => {
    // A file between the two would be refused by both paths.
    assert.equal(MEGA_AT, PDF_RAW_CAP);
});

check("a PDF with a wrong or missing MIME type is still a PDF", () => {
    // The same refuse-on-a-header bug the ordinary uploads already had.
    assert.equal(isMegaCandidate({ name: "book.pdf", type: "application/octet-stream", size: MEGA_AT + 1 }), true);
    assert.equal(isMegaCandidate({ name: "book.PDF", type: "", size: MEGA_AT + 1 }), true);
});

check("only PDFs, and the refusal says why", () => {
    const r = megaReason({ name: "notes.docx", type: "", size: 5e6 });
    assert.match(r, /PDFs only/);
    assert.equal(megaReason({ name: "book.pdf", type: "application/pdf", size: 5e6 }), null);
});

check("an oversized book is refused BY NAME with both numbers", () => {
    const r = megaReason({ name: "huge.pdf", type: "application/pdf", size: MEGA_FILE_CAP + 1e6 });
    assert.match(r, /\d+\.\d MB/, "what they have, to one decimal");
    assert.match(r, new RegExp(`${Math.round(MEGA_FILE_CAP / 1048576)} MB`), "and the limit");
});

check("the caps are ordered so none of them is unreachable", () => {
    assert.ok(MEGA_AT < MEGA_FILE_CAP, "the mega path must open below where it closes");
    assert.ok(RANGE_PAGE_CAP < MEGA_PAGE_CAP, "a stored book must be longer than one read");
    assert.ok(MEGA_ACTIVE_MAX >= 1);
});

check("the price line names the pages and the two halves", () => {
    const line = priceLine(40, 25);
    assert.match(line, /40 pages/);
    assert.match(line, /25 to generate/);
});

// ─── The page a student asked for is the page they get ─────────────────────

check("a 1-based range becomes the right zero-based indices", () => {
    assert.deepEqual(pageIndices(1, 3, 100), [0, 1, 2]);
    assert.deepEqual(pageIndices(214, 216, 400), [213, 214, 215]);
    assert.deepEqual(pageIndices(7, 7, 400), [6]);
});

check("indices never escape the book, however bad the input", () => {
    for (const [a, b] of [[0, 0], [-5, -1], [999, 9999], [NaN, NaN]]) {
        const idx = pageIndices(a, b, 12);
        assert.ok(idx.every((i) => i >= 0 && i < 12), `${a}-${b} -> ${idx}`);
        assert.ok(idx.length >= 1);
    }
});

check("indices and the price agree on how many pages that is", () => {
    // The bill is `pages`; the slice is `indices.length`. Two counts of one
    // thing is how somebody is charged for 40 pages and reads 39.
    for (const [a, b, total] of [[1, 40, 600], [214, 600, 700], [1, 5, 5], [590, 610, 600]]) {
        assert.equal(pageIndices(a, b, total).length, normaliseRange(a, b, total).pages,
            `${a}-${b} of ${total}`);
    }
});

// ─── The scan: one cost model, one copy of it ───────────────────────────────

const SRC = path.resolve("src");
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    return /\.(jsx?|mjs)$/.test(e.name) ? [full] : [];
});

check("nothing but megaUpload.js works out what a page costs", () => {
    // The server imports `chipsForRange`; the picker imports `megaPrice`. A
    // second copy anywhere is the number under the range picker drifting from
    // the number on the bill, which is the one thing this must never do.
    const files = [...walk(SRC), path.resolve("server.mjs")];
    const offenders = files.filter((f) => {
        if (f.endsWith("megaUpload.js") || f.endsWith("megaUpload.test.mjs")) return false;
        const src = fs.readFileSync(f, "utf8");
        return /TOKENS_PER_PAGE\s*[*/]|PAGE_IMAGE_TOKENS|PAGE_TEXT_TOKENS/.test(src);
    });
    assert.deepEqual(offenders.map((f) => path.relative(process.cwd(), f)), [],
        "import chipsForRange instead");
});

check("the server takes the mega caps from this module rather than restating them", () => {
    const src = fs.readFileSync(path.resolve("server.mjs"), "utf8");
    assert.match(src, /from "\.\/src\/lib\/megaUpload\.js"/, "server imports the model");
    // The numbers themselves must not appear as literals beside the import.
    const bad = [`${MEGA_PAGE_CAP}`, `${RANGE_PAGE_CAP}`]
        .filter((n) => new RegExp(`(MEGA_PAGE_CAP|RANGE_PAGE_CAP)\\s*=\\s*${n}`).test(src));
    assert.deepEqual(bad, [], "the server must not redeclare a cap");
});

check("a handle carries no path and no address", () => {
    // The bucket key holds the owner; the client only ever sees the uuid. A
    // key that reached the client would be a list of our students' storage.
    const src = fs.readFileSync(path.resolve("server.mjs"), "utf8");
    assert.match(src, /files\.map\(\(\{ key, \.\.\.rest \}\) => rest\)/,
        "megaFiles must strip the storage key before answering");
});

console.log(`\n${passed} checks passed`);
