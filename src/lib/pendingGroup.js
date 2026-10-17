/**
 * pendingGroup — a group link opened while signed out survives the sign-in.
 *
 * The same reason `pendingFriend` exists: signing in always lands on the app
 * root, so somebody new who tapped `/StudyGroups?join=GRP-XXXXXX` in a class
 * chat signed in and arrived on the dashboard with the code gone — which, for
 * a group link, is the whole of the moment. Kept for a day, taken once.
 *
 * Storage that is blocked or absent costs the redirect, never a crash.
 */
import { normaliseGroupCode } from "./groups.js";

export const PENDING_GROUP_KEY = "acedit.group.pending";
export const PENDING_GROUP_TTL_MS = 86400_000;

const store = (s) => s ?? (typeof localStorage === "undefined" ? null : localStorage);

/** Remember the code in a group link, if this location is one. */
export function rememberGroupLink(location, storage, now = Date.now()) {
    try {
        if (!/^\/studygroups\/?$/i.test(location?.pathname || "")) return null;
        const code = normaliseGroupCode(new URLSearchParams(location.search || "").get("join"));
        if (!code) return null;
        store(storage)?.setItem(PENDING_GROUP_KEY, JSON.stringify({ code, at: now }));
        return code;
    } catch {
        return null;
    }
}

/** Take the remembered code ONCE — a second call finds nothing. Stale is gone. */
export function takePendingGroup(storage, now = Date.now()) {
    try {
        const s = store(storage);
        const raw = s?.getItem(PENDING_GROUP_KEY);
        if (!raw) return null;
        s.removeItem(PENDING_GROUP_KEY);
        const { code, at } = JSON.parse(raw) || {};
        if (!Number.isFinite(at) || now - at > PENDING_GROUP_TTL_MS) return null;
        return normaliseGroupCode(code);
    } catch {
        return null;
    }
}
