/**
 * fnResult — unwrap what `base44.functions.invoke` actually hands back.
 *
 * ─── The bug this exists to stop ────────────────────────────────────────────
 * `functionsApi._invoke` returns `{ data, error }` — deliberately, to match
 * Base44's SDK envelope so call sites that destructure `{ data }` keep working
 * through the dual run. A page that does
 *
 *     const res = await base44.functions.invoke("getMarkets", {});
 *     if (res?.error) throw new Error(res.error);
 *     setData(res);                               // ← the envelope, not the payload
 *
 * gets an object with exactly two keys, `data` and `error`. Every field it
 * then reads — `data.markets`, `data.me`, `data.rows` — is `undefined`, so the
 * page renders its EMPTY STATE and looks like a feature nobody is using rather
 * than a feature that is broken. `res.error` is `null`, so the guard above
 * passes and nothing anywhere reports a problem.
 *
 * That is exactly what happened to the weekly league: the board, the history
 * and the cred strip all read the envelope, and `WeekStrip` checked
 * `res.success` — which is inside `data` — so the only entrance to the page
 * never rendered at all. A feature shipped and was invisible, which is the
 * same failure the league had before it was rebuilt, arrived at from a
 * completely different direction.
 *
 * `?? res` is not defensive padding: a function that has NOT been ported still
 * falls through to the real Base44 SDK, whose shape differs, and during the
 * dual run both are live. Handling both is the point.
 */

/** The payload, whichever envelope it arrived in. */
export function unwrapFn(res) {
    if (res == null) return null;
    // `data` present means the ported-function envelope. `data` can legitimately
    // be null (a function that returns nothing), so check the KEY, not the value.
    if (typeof res === "object" && "data" in res) return res.data ?? null;
    return res;
}

/**
 * The error, from either envelope or from the payload itself.
 *
 * A ported function answers 200 with `{ error: "..." }` in its BODY for a
 * refusal it wants the UI to print — "You're in this call-out", "Not enough
 * cred" — so the error can sit at either level and both have to be read.
 */
export function fnError(res) {
    if (res == null) return null;
    if (typeof res !== "object") return null;
    if (res.error) return typeof res.error === "string" ? res.error : "That didn't work.";
    const body = unwrapFn(res);
    if (body && typeof body === "object" && body.error) {
        return typeof body.error === "string" ? body.error : "That didn't work.";
    }
    return null;
}

/** Throws the refusal, or returns the payload. The shape most call sites want. */
export function takeFn(res) {
    const err = fnError(res);
    if (err) throw new Error(err);
    return unwrapFn(res);
}
