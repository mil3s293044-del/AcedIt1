/**
 * MegaPicker — one textbook, and the chapter you want out of it.
 *
 * ═══ THE PRICE IS ON SCREEN BEFORE IT IS SPENT ═════════════════════════════
 * This is the only action in the app whose price is not fixed: every other
 * button costs what `chips.js` published for it, and a mega read costs its
 * PAGES. So the number under the range moves as the range moves, and it is
 * `chipsForRange` — the identical function the server charges with — rather
 * than a second estimate that could drift from the bill.
 *
 * A student who drags to 120 pages watches it reach a third of their week and
 * can decide. A student who is told afterwards has been robbed.
 *
 * ═══ AND IT SAYS WHICH MODEL READS IT ══════════════════════════════════════
 * A chapter runs on Haiku, because input tokens are the whole cost of a mega
 * read and it is three times cheaper on them. That is a real difference in
 * what comes back, so the panel names it. An app that quietly downgrades the
 * model and lets the student conclude it is just bad has spent their trust to
 * save its own money.
 *
 * ═══ Two pickers, not one ══════════════════════════════════════════════════
 * A book is STORED, so the second visit should not be another upload. The
 * panel opens on what they already have, with "add another book" beside it,
 * and it says how long a book is kept — a shelf that silently empties is worse
 * than one that never held anything.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listMega, megaUrl, uploadMega } from "@/api/megaUploads";
import {
    MEGA_FILE_CAP, MEGA_MODEL_LABEL, MEGA_TTL_HOURS, RANGE_PAGE_CAP,
    defaultRange, megaPrice, normaliseRange, parseRange,
} from "@/lib/megaUpload";

const mb = (n) => `${(n / 1048576).toFixed(0)} MB`;

/** One stored book on the shelf. */
function BookRow({ book, active, onPick }) {
    return (
        <button type="button" onClick={() => onPick(book)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-colors
                ${active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
            <BookOpen className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
            <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-foreground truncate">{book.name}</span>
                <span className="block text-xs text-muted-foreground tabular-nums">
                    {book.pages} pages{book.size ? ` · ${mb(book.size)}` : ""}
                </span>
            </span>
        </button>
    );
}

export default function MegaPicker({ featurePrice = 0, onChange, toast }) {
    const [books, setBooks] = useState([]);
    // Whether a NEW book would be taken. Books are the first thing to stand
    // down when storage gets tight (see storageBudget.js), and a student
    // should hear that BEFORE pushing 40 MB up school wifi, not after.
    const [accepting, setAccepting] = useState({ ok: true, reason: null });
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState(0);
    const [picked, setPicked] = useState(null);
    const [range, setRange] = useState(null);
    const [text, setText] = useState("");
    const inputRef = useRef(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const res = await listMega();
            setBooks(res.files || []);
            setAccepting({ ok: res.accepting !== false, reason: res.accepting_reason || null });
        } catch { setBooks([]); }      // not signed in, or no storage — not an error to shout about
        finally { setLoading(false); }
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

    // `onChange` through a REF, never through the dep array. A parent that
    // passes an inline lambda hands this a new function every render, and with
    // it in the deps that is an infinite publish→render→publish loop — the
    // hazard `hookDeps.test.mjs` exists for. The ref makes the component safe
    // whatever the caller does.
    const notify = useRef(onChange);
    notify.current = onChange;

    // The chosen pages, published upward. The caller is given the file_url a
    // generate call sends, or null, so it never assembles one itself.
    useEffect(() => {
        if (!picked || !range) { notify.current?.(null); return; }
        const price = megaPrice(range.pages, featurePrice);
        notify.current?.({
            url: megaUrl(picked.handle, range.from, range.to),
            pages: range.pages,
            name: picked.name,
            // BOTH halves. `read` is the surcharge the gate needs; `total` is
            // what this panel printed. A caller subtracting one from the other
            // is a second copy of the sum, waiting to disagree with it.
            read: price.read,
            total: price.total,
        });
    }, [picked, range, featurePrice]);

    const choose = (book) => {
        setPicked(book);
        const r = defaultRange(book.pages);
        setRange(r);
        setText(`${r.from}-${r.to}`);
    };

    const onUpload = async (e) => {
        // The FileList is LIVE — copy before the reset, or this is empty.
        // See the header of pickFiles.js.
        const file = Array.from(e.target.files || [])[0];
        e.target.value = "";
        if (!file) return;
        setBusy(true);
        setProgress(0);
        try {
            const res = await uploadMega(file, { onProgress: setProgress });
            await refresh();
            choose({ handle: res.file_url, name: res.name, pages: res.pages, size: res.size });
            toast?.({ title: "Book stored", description: `${res.name} — ${res.pages} pages.` });
        } catch (err) {
            toast?.({ title: "Couldn't store that book", description: err.message, variant: "destructive" });
        } finally {
            setBusy(false);
            setProgress(0);
        }
    };

    const commitText = (raw) => {
        const parsed = parseRange(raw, picked?.pages);
        // REFUSES rather than guesses: unparseable input snaps back to the
        // range that is actually selected, so the number under the box and the
        // pages that get read can never disagree.
        if (parsed) { setRange(parsed); setText(`${parsed.from}-${parsed.to}`); }
        else if (range) setText(`${range.from}-${range.to}`);
    };

    const price = range ? megaPrice(range.pages, featurePrice) : null;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="stat-label text-muted-foreground">Read from a book</p>
                <span className="pill bg-chart-4/10 text-chart-4">Reads on {MEGA_MODEL_LABEL}</span>
            </div>

            {loading ? (
                <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading your books…
                </p>
            ) : (
                <div className="space-y-2">
                    {books.map((b) => (
                        <BookRow key={b.handle} book={b} active={picked?.handle === b.handle} onPick={choose} />
                    ))}
                    {books.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                            Upload a textbook once and pick the chapter each time. PDFs up to {mb(MEGA_FILE_CAP)},
                            kept for {Math.round(MEGA_TTL_HOURS / 24)} days.
                        </p>
                    )}
                </div>
            )}

            <input ref={inputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={onUpload} />
            <Button type="button" variant="outline" size="sm" disabled={busy || !accepting.ok}
                onClick={() => inputRef.current?.click()}
                className="gap-2 rounded-xl">
                {busy
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading {Math.round(progress * 100)}%</>
                    : <><Upload className="w-4 h-4" /> {books.length ? "Add another book" : "Upload a book"}</>}
            </Button>
            {/* A disabled button says WHY, the rule Active Recall's already
                records. And it names what is unaffected, because "storage is
                full" on a study app reads as "nothing works". */}
            {!accepting.ok && accepting.reason && (
                <p className="text-xs text-muted-foreground">{accepting.reason}</p>
            )}

            {picked && range && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border-2 border-border p-3.5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-foreground truncate">{picked.name}</p>
                        <button type="button" onClick={() => { setPicked(null); setRange(null); }}
                            className="text-muted-foreground hover:text-foreground" aria-label="Clear book">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <label className="text-xs font-bold text-muted-foreground" htmlFor="mega-range">Pages</label>
                        <input id="mega-range" value={text}
                            onChange={(e) => setText(e.target.value)}
                            onBlur={(e) => commitText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitText(e.currentTarget.value); } }}
                            className="w-28 rounded-xl border-2 border-border bg-surface px-2.5 py-1.5 text-sm
                                font-bold tabular-nums text-foreground focus:border-primary outline-none"
                            placeholder="214-248" />
                        <span className="text-xs text-muted-foreground tabular-nums">of {picked.pages}</span>
                    </div>

                    {/* The drag, on the END of the range. The start is where the
                        chapter begins and the student typed it; this is how much
                        of it to read, which is the thing the price moves with. */}
                    <input type="range" min={range.from}
                        max={Math.min(picked.pages, range.from + RANGE_PAGE_CAP - 1)}
                        value={range.to}
                        onChange={(e) => {
                            const r = normaliseRange(range.from, e.target.value, picked.pages);
                            setRange(r);
                            setText(`${r.from}-${r.to}`);
                        }}
                        className="w-full accent-primary" />

                    <p className="text-xs text-muted-foreground">
                        <span className="font-bold text-foreground tabular-nums">{price.total} chips</span>
                        {" — "}{range.pages} page{range.pages === 1 ? "" : "s"} to read ({price.read})
                        {price.feature ? ` plus ${price.feature} to generate` : ""}.
                        {range.pages >= RANGE_PAGE_CAP && ` ${RANGE_PAGE_CAP} pages is the most one go can read.`}
                    </p>
                </motion.div>
            )}
        </div>
    );
}
