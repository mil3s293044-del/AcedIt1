-- 0043 — study groups are read and written by the server only.
--
-- WHAT WAS WRONG. Every group table was written straight from the browser,
-- under policies written for a feature that trusted its members:
--
--   * `study_groups_update_member` let ANY member update the row, with a check
--     that only asked they still be in it afterwards. So a member could rename
--     the group, empty the member list, or set `owner_email` to themselves.
--   * `group_messages_insert_member` accepted `sender_email = 'system'` from
--     any member, so a line in the app's own voice — "Sam was removed" — was
--     one insert away. And the messages were free text between minors, checked
--     for swear words in the browser and nowhere else.
--   * `group_shared_resources_update_sharer` let only the SHARER update a
--     shared row, so recording an import failed for everybody the share was
--     for — after their copy had already been created. They were told it
--     failed, tapped again, and got it twice.
--   * Joining by code could not work at all: `study_groups_select_member`
--     hides a group from anybody not already in it, so the code lookup came
--     back empty for exactly the people who needed it.
--   * And every member could read every other member's email off the row.
--
-- WHAT REPLACES IT. server.mjs, under the service role: getGroups, getGroup,
-- lookupGroupCode, createGroup, joinGroup, leaveGroup, removeGroupMember,
-- resetGroupCode, deleteGroup, postGroupPhrase, shareToGroup, importGroupItem,
-- reactToGroupItem, removeGroupItem and setGroupSacSharing. It checks who may
-- do what, takes names off the profiles, accepts a phrase from a fixed set
-- instead of text, and returns no email. See src/lib/groups.js.
--
-- So the browser keeps NOTHING on these four tables — reads included, because
-- the reads were what published the addresses. `is_group_member` stays: it is
-- `security definer`, so it reads the table without a policy, and nothing is
-- lost by keeping it.
--
-- APPLY IT AFTER THE DEPLOY THAT USES IT, not before. The client before that
-- deploy reads and writes these tables directly, so applying this first
-- empties the group page until the new client ships. The other way round costs
-- nothing: the new client touches none of these tables, and until this runs
-- the hole is simply still open. Safe to run twice: every drop is `if exists`.

-- ── study_groups ─────────────────────────────────────────────────────────────
drop policy if exists "study_groups_select_member"   on public.study_groups;
drop policy if exists "study_groups_insert_as_owner" on public.study_groups;
drop policy if exists "study_groups_update_member"   on public.study_groups;
drop policy if exists "study_groups_delete_as_owner" on public.study_groups;

-- ── group_messages ───────────────────────────────────────────────────────────
drop policy if exists "group_messages_select_member" on public.group_messages;
drop policy if exists "group_messages_insert_member" on public.group_messages;

-- ── group_shared_resources ───────────────────────────────────────────────────
drop policy if exists "group_shared_resources_select_member" on public.group_shared_resources;
drop policy if exists "group_shared_resources_insert_member" on public.group_shared_resources;
drop policy if exists "group_shared_resources_update_sharer" on public.group_shared_resources;
drop policy if exists "group_shared_resources_delete_sharer" on public.group_shared_resources;

-- ── group_flashcard_decks ────────────────────────────────────────────────────
-- Nothing in the app reads or writes this table any more (GroupDecks.jsx,
-- which was mounted nowhere, is deleted). Closed rather than left open.
drop policy if exists "group_flashcard_decks_select_member" on public.group_flashcard_decks;
drop policy if exists "group_flashcard_decks_insert_member" on public.group_flashcard_decks;
drop policy if exists "group_flashcard_decks_update_member" on public.group_flashcard_decks;
drop policy if exists "group_flashcard_decks_delete_owner"  on public.group_flashcard_decks;

-- RLS stays ENABLED on all four, so with no policy the browser's role reads
-- and writes nothing; the service role bypasses RLS as it always has.
alter table public.study_groups           enable row level security;
alter table public.group_messages         enable row level security;
alter table public.group_shared_resources enable row level security;
alter table public.group_flashcard_decks  enable row level security;
