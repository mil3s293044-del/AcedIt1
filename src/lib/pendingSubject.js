/**
 * pendingSubject — a subject link opened while signed out survives the sign-in.
 *
 * The subject page is a link you can send ("have a look at Methods before you
 * pick"), and signing in always lands on the app root — the reason
 * `pendingFriend` and `pendingGroup` exist. Without this, somebody tapping a
 * shared `/Subjects?view=vce-maths-methods` signed in and arrived on the
 * dashboard with the subject gone. Kept for a day, taken once.
 *
 * Only a CATALOGUE id is kept. A student's own subject is private, so a link
 * to one opens nothing for anybody else, and storing whatever string a URL
 * carried is not this module's job.
 *
 * Storage that is blocked or absent costs the redirect, never a crash.
 */
export const PENDING_SUBJECT_KEY = "acedit.subject.pending";
export const PENDING_SUBJECT_TTL_MS = 86400_000;

/** A catalogue id, or null. The catalogue's ids are `vce-<slug>`. */
export function normaliseSubjectView(view) {
    const id = String(view || "").trim().toLowerCase();
    return /^vce-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) && id.length <= 64 ? id : null;
}

const store = (s) => s ?? (typeof localStorage === "undefined" ? null : localStorage);

/** Remember the subject in a subject link, if this location is one. */
export function rememberSubjectLink(location, storage, now = Date.now()) {
    try {
        if (!/^\/subjects\/?$/i.test(location?.pathname || "")) return null;
        const id = normaliseSubjectView(new URLSearchParams(location.search || "").get("view"));
        if (!id) return null;
        store(storage)?.setItem(PENDING_SUBJECT_KEY, JSON.stringify({ id, at: now }));
        return id;
    } catch {
        return null;
    }
}

/** Take the remembered subject ONCE — a second call finds nothing. Stale is gone. */
export function takePendingSubject(storage, now = Date.now()) {
    try {
        const s = store(storage);
        const raw = s?.getItem(PENDING_SUBJECT_KEY);
        if (!raw) return null;
        s.removeItem(PENDING_SUBJECT_KEY);
        const { id, at } = JSON.parse(raw) || {};
        if (!Number.isFinite(at) || now - at > PENDING_SUBJECT_TTL_MS) return null;
        return normaliseSubjectView(id);
    } catch {
        return null;
    }
}
