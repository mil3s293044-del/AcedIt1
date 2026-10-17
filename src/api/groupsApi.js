/**
 * groupsApi — the one way the client reaches a study group.
 *
 * Every group read and write is the server's (see src/lib/groups.js). The
 * refusals are sentences meant for a student, and `callFriends` already pulls
 * one back out of a non-2xx body rather than printing the shim's
 * "Function 'x' failed (400): {json}" at somebody — so this reuses it.
 */
import { callFriends } from "@/api/friendsApi";

export const getGroups = () => callFriends("getGroups");
export const getGroup = (id) => callFriends("getGroup", { id });
export const lookupGroupCode = (code) => callFriends("lookupGroupCode", { code });
export const createGroup = (name, subject) => callFriends("createGroup", { name, subject });
export const joinGroup = (code) => callFriends("joinGroup", { code });
export const leaveGroup = (id, purge = false) => callFriends("leaveGroup", { id, purge });
export const removeGroupMember = (id, memberId) => callFriends("removeGroupMember", { id, member_id: memberId });
export const resetGroupCode = (id) => callFriends("resetGroupCode", { id });
export const deleteGroup = (id) => callFriends("deleteGroup", { id });
export const postGroupPhrase = (id, phrase) => callFriends("postGroupPhrase", { id, phrase });
/** `payload` is what `ownShareContent` reads: a kind and the ids of YOUR row. */
export const shareToGroup = (groupIds, payload) => callFriends("shareToGroup", { group_ids: groupIds, ...payload });
export const importGroupItem = (id) => callFriends("importGroupItem", { id });
export const reactToGroupItem = (id, glyph) => callFriends("reactToGroupItem", { id, glyph });
export const removeGroupItem = (id) => callFriends("removeGroupItem", { id });
export const setGroupSacSharing = (id, share) => callFriends("setGroupSacSharing", { id, share });
