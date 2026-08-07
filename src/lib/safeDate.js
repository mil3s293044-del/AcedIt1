/**
 * safeDate — date formatting that degrades to a dash instead of a white screen.
 *
 * `format()` from date-fns throws `RangeError: Invalid time value` when handed
 * an invalid Date, and every call site here runs during render. One study
 * session row with a null `date`, one competition without a start date, one
 * malformed timestamp out of an import, and React unmounts the whole tree —
 * the user sees a blank page, not a missing label.
 *
 * That is exactly backwards for a field that is decoration. These wrappers
 * return the fallback instead, so a bad row costs you one line of text.
 *
 * Use `fmtDate` for date-only strings ("2026-08-07") and `fmtWhen` for
 * timestamps; both accept a Date, an ISO string, or null.
 */
import { format, parseISO, isValid } from "date-fns";

/** Coerce anything date-shaped to a valid Date, or null. */
export function toDate(value) {
    if (value == null || value === "") return null;
    if (value instanceof Date) return isValid(value) ? value : null;
    if (typeof value === "number") {
        const d = new Date(value);
        return isValid(d) ? d : null;
    }
    if (typeof value !== "string") return null;
    // parseISO handles both "2026-08-07" and full timestamps, and unlike
    // `new Date(str)` it doesn't shift date-only strings by the UTC offset.
    const iso = parseISO(value);
    if (isValid(iso)) return iso;
    const loose = new Date(value);
    return isValid(loose) ? loose : null;
}

/**
 * Format `value` with `pattern`, or return `fallback` if it isn't a real date.
 * Never throws.
 */
export function fmtDate(value, pattern, fallback = "—") {
    const d = toDate(value);
    if (!d) return fallback;
    try {
        return format(d, pattern);
    } catch {
        return fallback;
    }
}

/** Same, for timestamps — just a clearer name at the call site. */
export const fmtWhen = fmtDate;

/** True when `value` is a date we can actually render. */
export const isRealDate = (value) => toDate(value) != null;
