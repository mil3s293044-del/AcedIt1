/**
 * annotate — putting the assessor's marks on the student's own sentence.
 *
 * The first version of this showed an edit in a card OFF to the side: their
 * phrase struck through, the better one beside it. Two things were wrong with
 * that. A strikethrough means DELETE THIS, when what the marking wants to say
 * is LOOK HERE; and lifting the phrase out of the paragraph loses the one
 * thing that makes an annotation land, which is seeing it sitting in your own
 * writing.
 *
 * So the marker now returns a verbatim QUOTE from the answer, and this turns
 * the answer into segments — plain text, flagged text, plain text — that the
 * renderer can underline in place.
 *
 * ─── The rule that makes it trustworthy ─────────────────────────────────────
 * EXACT MATCHES ONLY. If the quote is not in the answer character for
 * character, the annotation is DROPPED. No fuzzy matching, no nearest
 * neighbour, no stripping punctuation until something lines up. Underlining
 * the wrong six words and telling a student those words cost them a mark is
 * worse than showing nothing at all — they will go and change a sentence that
 * was fine, and they will stop believing the next annotation.
 *
 * Overlaps are resolved the same way and for the same reason: the first
 * annotation to claim a span keeps it, and anything that would overlap it is
 * dropped rather than nested, because a span that is half one colour and half
 * another says nothing a student can act on.
 */

const str = (v) => (typeof v === "string" ? v : "");

/**
 * Normalise one annotation off the model.
 *
 * `quote` is the only required field — an annotation that cannot point at
 * anything is not an annotation.
 */
export function normaliseAnnotation(raw, i = 0) {
    const quote = str(raw?.quote || raw?.was).trim();
    if (!quote) return null;
    const worth = Number(raw?.worth);
    // An assessor rarely has exactly one way to fix a sentence, and offering
    // two lets a student pick the one that sounds like them rather than copy
    // the one the model happened to write first. `fix` was the single-string
    // first version and still reads.
    const fixes = [
        ...(Array.isArray(raw?.fixes) ? raw.fixes : []),
        raw?.fix, raw?.now,
    ].map(str).map((f) => f.trim()).filter(Boolean);
    return {
        id: `a${i}`,
        quote,
        issue: str(raw?.issue || raw?.why).trim(),
        // What the study design or the criterion actually asked for. This is
        // the examiner's half — the issue says what is wrong, this says what
        // the assessor was looking for, and a student needs both.
        wanted: str(raw?.wanted || raw?.criterion_detail).trim(),
        fixes: [...new Set(fixes)],
        criterion: str(raw?.criterion).trim() || "Wording",
        // "lost" — this cost a mark. "risk" — imprecise but survived.
        severity: raw?.severity === "risk" ? "risk" : "lost",
        worth: Number.isFinite(worth) && worth > 0 ? worth : 0,
    };
}

/**
 * Split `text` into segments, each either plain or carrying an annotation.
 *
 * Always returns at least one segment for a non-empty text, so a renderer can
 * use this unconditionally rather than branching on whether anything matched.
 */
export function segment(text, annotations = []) {
    const body = str(text);
    if (!body) return [];

    const list = (Array.isArray(annotations) ? annotations : [])
        .map(normaliseAnnotation)
        .filter(Boolean);

    // Claim spans in the order the marker gave them. `taken` is what has
    // already been claimed, so a quote appearing twice annotates the first
    // occurrence that is still free rather than colliding on the same one.
    const spans = [];
    const overlaps = (a, b) => a.start < b.end && b.start < a.end;

    for (const ann of list) {
        let from = 0;
        for (;;) {
            const at = body.indexOf(ann.quote, from);
            if (at === -1) break;                       // no free occurrence left
            const span = { start: at, end: at + ann.quote.length, ann };
            if (!spans.some((s) => overlaps(s, span))) { spans.push(span); break; }
            from = at + 1;
        }
        // Falling out of the loop without pushing means the quote is not in the
        // answer, or every occurrence is already claimed. Dropped, silently and
        // deliberately — see the header.
    }

    spans.sort((a, b) => a.start - b.start);

    const out = [];
    let cursor = 0;
    for (const s of spans) {
        if (s.start > cursor) out.push({ text: body.slice(cursor, s.start), ann: null });
        out.push({ text: body.slice(s.start, s.end), ann: s.ann });
        cursor = s.end;
    }
    if (cursor < body.length) out.push({ text: body.slice(cursor), ann: null });
    return out;
}

/** The annotations that actually landed on the text. */
export const landed = (segments) =>
    segments.filter((s) => s.ann).map((s) => s.ann);

/**
 * How many the marker sent that could not be placed.
 *
 * Worth knowing rather than hiding: a marker that keeps quoting text the
 * student did not write is a prompt problem, and this is the number that says
 * so out loud.
 */
export function dropped(text, annotations = []) {
    const sent = (Array.isArray(annotations) ? annotations : []).map(normaliseAnnotation).filter(Boolean).length;
    return Math.max(0, sent - landed(segment(text, annotations)).length);
}
