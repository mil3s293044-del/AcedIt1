/**
 * friendsApi — the one way the client reaches the friend endpoints.
 *
 * Every friendship and share write is the server's (see src/lib/friends.js),
 * and the server refuses with a plain sentence meant for a student — "That's
 * you.", "No one has that code." A refusal arrives on a non-2xx, which the
 * functions shim throws as "Function 'x' failed (400): {json}", so this pulls
 * the sentence back out of the body rather than printing that at somebody.
 * `RedeemCode` does the same for the same reason.
 */
import { base44 } from "@/api/base44Client";
import { takeFn } from "@/lib/fnResult";

export async function callFriends(name, payload = {}) {
    try {
        return takeFn(await base44.functions.invoke(name, payload));
    } catch (err) {
        const msg = String(err?.message || "");
        const at = msg.indexOf("{");
        let fromBody = null;
        if (at >= 0) { try { fromBody = JSON.parse(msg.slice(at))?.error || null; } catch { /* not JSON */ } }
        if (fromBody) throw new Error(fromBody);
        if (!msg || /failed \(\d+\)/.test(msg)) throw new Error("That didn't go through. Try again in a minute.");
        throw err;
    }
}

export const getFriends = () => callFriends("getFriends");
export const lookupFriendCode = (code) => callFriends("lookupFriendCode", { code });
export const requestFriend = (by) => callFriends("requestFriend", by);
export const respondFriend = (id, accept) => callFriends("respondFriend", { id, accept });
export const cancelFriend = (id) => callFriends("cancelFriend", { id });
export const removeFriend = (id) => callFriends("removeFriend", { id });
export const shareWithFriends = (payload) => callFriends("shareWithFriends", payload);
