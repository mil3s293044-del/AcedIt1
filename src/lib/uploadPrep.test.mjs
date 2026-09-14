/**
 * uploadPrep assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/uploadPrep.test.mjs
 *
 * Three things this file holds, each one a bug that reached students:
 *
 *   THE LIMIT IS DERIVED FROM THE API'S, not guessed. Claude states its image
 *   ceiling in BASE64 bytes and base64 inflates by 4/3, so the number a picker
 *   enforces is three quarters of the stated one. The server allowed 30 MB.
 *
 *   A FILE IS NEVER REFUSED OVER A HEADER. The same JPEG arrives as image/jpeg,
 *   image/jpg or application/octet-stream depending on the browser, and two of
 *   those three used to be dropped as "unsupported file type".
 *
 *   A PHOTO IS RESIZED, NOT REJECTED. Claude downsamples every image on arrival
 *   anyway, so a limit is the wrong tool for the commonest input there is.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import {
    kindOf, capFor, inspect, targetSize, canShrink, countPdfPages, extOf,
    IMAGE_RAW_CAP, IMAGE_BASE64_CAP, BASE64_INFLATION, PDF_RAW_CAP, DOC_RAW_CAP,
    IMAGE_MAX_EDGE,
} from "@/lib/uploadPrep";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const MB = 1024 * 1024;
const f = (name, type, size) => ({ name, type, size });

// ─── The limit ──────────────────────────────────────────────────────────────

check("THE RAW CAP IS THE BASE64 CAP DIVIDED BY THE INFLATION, not a guess", () => {
    assert.equal(IMAGE_BASE64_CAP, 10 * MB);
    assert.equal(IMAGE_RAW_CAP, Math.floor(10 * MB / (4 / 3)));
    assert.ok(Math.abs(IMAGE_RAW_CAP / MB - 7.5) < 0.01, "≈7.5 MB of file, not 10");
    // The bug: the server allowed 30 MB, so a 12 MB photo passed and the API
    // refused the 16 MB of base64 it turned into.
    assert.ok(12 * MB > IMAGE_RAW_CAP);
    assert.ok(12 * MB * BASE64_INFLATION > IMAGE_BASE64_CAP);
});

check("a PDF leaves headroom under the 32 MB request ceiling", () => {
    assert.ok(PDF_RAW_CAP * BASE64_INFLATION < 32 * MB,
        "encoded, a max-size PDF must still leave room for the prompt");
    assert.ok(PDF_RAW_CAP >= 8 * MB, "and it must not be so tight it is useless");
});

// ─── The header ─────────────────────────────────────────────────────────────

check("A FILE IS NEVER REFUSED OVER A HEADER", () => {
    // The three ways one JPEG arrives.
    assert.equal(kindOf(f("notes.jpg", "image/jpeg", MB)), "image");
    assert.equal(kindOf(f("notes.jpg", "image/jpg", MB)), "image");
    assert.equal(kindOf(f("notes.jpg", "application/octet-stream", MB)), "image");
    // ...and with no type at all, which is what a drag-and-drop can give.
    assert.equal(kindOf(f("notes.JPG", "", MB)), "image");
    // iPhone default.
    assert.equal(kindOf(f("IMG_4021.HEIC", "", 3 * MB)), "image");
    // Documents the same way.
    assert.equal(kindOf(f("notes.docx", "application/octet-stream", MB)), "doc");
    assert.equal(kindOf(f("paper.pdf", "", MB)), "pdf");
    assert.equal(kindOf(f("notes.txt", "", MB)), "text");
});

check("but something genuinely unreadable still says so, by name", () => {
    assert.equal(kindOf(f("archive.zip", "application/zip", MB)), null);
    assert.equal(kindOf(f("scan", "", MB)), null, "no type AND no extension is not a guess");
    const v = inspect(f("essay.pages", "", MB));
    assert.equal(v.ok, false);
    assert.match(v.reason, /essay\.pages/, "the sentence names the file");
    assert.match(v.reason, /PDF|photo/i, "and says what would work instead");
});

// ─── The photo ──────────────────────────────────────────────────────────────

check("A PHOTO IS RESIZED, NOT REJECTED — at any size", () => {
    for (const size of [2 * MB, 8 * MB, 25 * MB]) {
        const v = inspect(f("photo.jpg", "image/jpeg", size));
        assert.equal(v.ok, true, `${size / MB}MB photo must be accepted`);
        assert.equal(v.shrink, true);
    }
});

check("...but HEIC cannot be resized in a browser, so it is size-checked", () => {
    // No canvas can decode HEIC, so it travels whole and the server converts it.
    assert.equal(canShrink(f("IMG.HEIC", "image/heic", MB)), false);
    assert.equal(inspect(f("IMG.HEIC", "image/heic", 3 * MB)).ok, true);
    const big = inspect(f("IMG.HEIC", "image/heic", 9 * MB));
    assert.equal(big.ok, false);
    assert.match(big.reason, /9\.0 MB/, "it states what the file actually is");
    assert.match(big.reason, /7\.5 MB/, "and the limit it missed");
});

check("an oversized PDF names the file, the size and the limit", () => {
    const v = inspect(f("2019 exam.pdf", "application/pdf", 25 * MB));
    assert.equal(v.ok, false);
    assert.match(v.reason, /2019 exam\.pdf/);
    assert.match(v.reason, /25\.0 MB/);
    assert.match(v.reason, /16\.0 MB/);
    assert.equal(inspect(f("small.pdf", "application/pdf", 4 * MB)).ok, true);
});

check("caps are per kind and none of them is zero", () => {
    assert.equal(capFor("image"), IMAGE_RAW_CAP);
    assert.equal(capFor("pdf"), PDF_RAW_CAP);
    assert.equal(capFor("doc"), DOC_RAW_CAP);
    assert.equal(capFor("text"), DOC_RAW_CAP);
    assert.equal(capFor(null), 0);
});

// ─── The resize ─────────────────────────────────────────────────────────────

check("resizing only shrinks, and never distorts", () => {
    // A 12MP phone photo.
    const t = targetSize(4032, 3024);
    assert.deepEqual(t, { width: 2000, height: 1500 });
    assert.ok(Math.abs(4032 / 3024 - t.width / t.height) < 0.01, "aspect ratio held");
    // Portrait.
    assert.deepEqual(targetSize(3024, 4032), { width: 1500, height: 2000 });
    // Already small: null means LEAVE IT ALONE, so a clean diagram is never
    // re-encoded into JPEG artefacts for nothing.
    assert.equal(targetSize(800, 600), null);
    assert.equal(targetSize(IMAGE_MAX_EDGE, IMAGE_MAX_EDGE), null);
    // Degenerate input must not produce a zero-sized canvas.
    assert.equal(targetSize(0, 100), null);
    assert.equal(targetSize(NaN, NaN), null);
    const sliver = targetSize(10000, 3);
    assert.ok(sliver.height >= 1, "a 1px-tall result is still a valid image");
});

// ─── The page count ─────────────────────────────────────────────────────────

check("an uncountable PDF returns null, and null is not 'fine'", () => {
    assert.equal(countPdfPages(new Uint8Array([1, 2, 3])), null);
    const three = new TextEncoder().encode(
        "%PDF-1.4 /Type /Page x /Type /Page y /Type /Page z /Type /Pages");
    assert.equal(countPdfPages(three), 3, "/Type /Pages is the tree root, not a page");
});

check("extOf survives the shapes a filename actually takes", () => {
    assert.equal(extOf("a.b.PDF"), "pdf");
    assert.equal(extOf("noext"), "noext");
    assert.equal(extOf(""), "");
    assert.equal(extOf(null), "");
});

// ─── Client and server must not drift ───────────────────────────────────────

check("THE SERVER ENFORCES THE SAME CAPS — change one, change both", () => {
    const server = fs.readFileSync("server.mjs", "utf8");
    assert.match(server, /UPLOAD_IMAGE_CAP = Math\.floor\(10 \* 1024 \* 1024 \* 3 \/ 4\)/,
        "the server's image cap must be derived from the same base64 arithmetic");
    assert.match(server, /UPLOAD_PDF_CAP = 16 \* 1024 \* 1024/);
    assert.match(server, /UPLOAD_DOC_CAP = 25 \* 1024 \* 1024/);
    // And the old 30 MB number must be gone from multer, or the backstop is
    // three times looser than the thing it is backing up.
    assert.doesNotMatch(server, /fileSize: 30 \* 1024 \* 1024/,
        "multer's 30 MB limit was the number from nowhere");
});

console.log(`\n${passed} passed`);
