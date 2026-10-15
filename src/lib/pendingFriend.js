/**
 * pendingFriend — a friend link opened while signed out survives the sign-in.
 *
 * Signing in always returns to the app root (AuthContext's `navigateToLogin`
 * says why: returning to the current path 404'd on /login), so somebody new
 * who tapped `/Friends?add=ACE-XXXXX` in a group chat signed in and landed on
 * the dashboard with the code gone — the one moment the link exists for. The
 * code is kept here for a day and the app takes them back to the invite once,
 * after they are in.
 *
 * Storage that is blocked or absent costs the redirect, never a crash.
 */
import { normaliseFriendCode } from "./friends.js";

export const PENDING_KEY = "acedit.friend.pending";
export const PENDING_TTL_MS = 86400_000;

const store = (s) => s ?? (typeof localStorage === "undefined" ? null : localStorage);

/** Remember the code in a friend link, if this location is one. */
export function rememberFriendLink(location, storage, now = Date.now()) {
    try {
        if (!/^\/friends\/?$/i.test(location?.pathname || "")) return null;
        const code = normaliseFriendCode(new URLSearchParams(location.search || "").get("add"));
        if (!code) return null;
        store(storage)?.setItem(PENDING_KEY, JSON.stringify({ code, at: now }));
        return code;
    } catch {
        return null;
    }
}

/** Take the remembered code ONCE — a second call finds nothing. Stale is gone. */
export function takePendingFriend(storage, now = Date.now()) {
    try {
        const s = store(storage);
        const raw = s?.getItem(PENDING_KEY);
        if (!raw) return null;
        s.removeItem(PENDING_KEY);
        const { code, at } = JSON.parse(raw) || {};
        if (!Number.isFinite(at) || now - at > PENDING_TTL_MS) return null;
        return normaliseFriendCode(code);
    } catch {
        return null;
    }
}
