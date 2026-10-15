-- 0042 — friendships and shares are written by the server only.
--
-- WHAT WAS WRONG. `friendships_update_either` let EITHER party update a row,
-- with a check that only required one of the two emails to be the caller's.
-- So the student who SENT a request could set it to 'accepted' themselves, and
-- the recipient could rewrite the requester to anybody at all. Anybody could
-- make themselves anybody's friend — which is the bound pranks rely on
-- ("friends only, mutual and accepted"), the condition sharing relies on, and
-- the count two achievements pay XP for. And the names on a request were
-- whatever the sender's browser wrote, so a request could arrive from
-- "Mr Smith".
--
-- The shares had the same shape: `*_insert_as_sender` let a student address a
-- quiz, a deck or an AI result to ANY email, friend or not, with a free-text
-- message on it, and `*_update_either` let the sender rewrite who it was for
-- after the fact.
--
-- WHAT REPLACES IT. Every write goes through server.mjs under the service role
-- — `requestFriend`, `respondFriend`, `cancelFriend`, `removeFriend` and
-- `shareWithFriends` — which checks who may do what and takes names off the
-- profiles. The browser keeps exactly what it still needs:
--
--   * SELECT, unchanged, on all four tables.
--   * DELETE by EITHER party. It was requester-only on friendships and
--     sender-only on shares, so a student who accepted somebody could not
--     remove them, and "delete my account" could not clear a request or a share
--     that had been sent TO them — the partial failure Settings reports.
--   * UPDATE on a share by its RECIPIENT only, which is accepting or declining
--     it. The sender no longer edits a share once it is sent.
--
-- APPLY IT AFTER THE DEPLOY THAT USES IT, not before. The client before that
-- deploy writes these tables directly, so applying this first switches off
-- friend requests and sharing until the new client ships. The other way round
-- costs nothing: the new client writes nothing these policies forbid, and
-- until this runs the hole is simply still open. Safe to run twice: every drop
-- is `if exists`.

-- ── friendships ──────────────────────────────────────────────────────────────
drop policy if exists "friendships_insert_as_requester" on public.friendships;
drop policy if exists "friendships_update_either"       on public.friendships;
drop policy if exists "friendships_delete_as_requester" on public.friendships;
drop policy if exists "friendships_delete_either"       on public.friendships;
create policy "friendships_delete_either" on public.friendships
    for delete using (requester_email = auth.email() or recipient_email = auth.email());

-- ── shared_quizzes ───────────────────────────────────────────────────────────
drop policy if exists "shared_quizzes_insert_as_sender"   on public.shared_quizzes;
drop policy if exists "shared_quizzes_update_either"      on public.shared_quizzes;
drop policy if exists "shared_quizzes_delete_as_sender"   on public.shared_quizzes;
drop policy if exists "shared_quizzes_update_recipient"   on public.shared_quizzes;
drop policy if exists "shared_quizzes_delete_either"      on public.shared_quizzes;
create policy "shared_quizzes_update_recipient" on public.shared_quizzes
    for update using (shared_with_email = auth.email()) with check (shared_with_email = auth.email());
create policy "shared_quizzes_delete_either" on public.shared_quizzes
    for delete using (shared_by_email = auth.email() or shared_with_email = auth.email());

-- ── shared_flashcards ────────────────────────────────────────────────────────
drop policy if exists "shared_flashcards_insert_as_sender" on public.shared_flashcards;
drop policy if exists "shared_flashcards_update_either"    on public.shared_flashcards;
drop policy if exists "shared_flashcards_delete_as_sender" on public.shared_flashcards;
drop policy if exists "shared_flashcards_update_recipient" on public.shared_flashcards;
drop policy if exists "shared_flashcards_delete_either"    on public.shared_flashcards;
create policy "shared_flashcards_update_recipient" on public.shared_flashcards
    for update using (shared_with_email = auth.email()) with check (shared_with_email = auth.email());
create policy "shared_flashcards_delete_either" on public.shared_flashcards
    for delete using (shared_by_email = auth.email() or shared_with_email = auth.email());

-- ── shared_ai_results ────────────────────────────────────────────────────────
drop policy if exists "shared_ai_results_insert_as_sender" on public.shared_ai_results;
drop policy if exists "shared_ai_results_update_either"    on public.shared_ai_results;
drop policy if exists "shared_ai_results_delete_as_sender" on public.shared_ai_results;
drop policy if exists "shared_ai_results_update_recipient" on public.shared_ai_results;
drop policy if exists "shared_ai_results_delete_either"    on public.shared_ai_results;
create policy "shared_ai_results_update_recipient" on public.shared_ai_results
    for update using (shared_with_email = auth.email()) with check (shared_with_email = auth.email());
create policy "shared_ai_results_delete_either" on public.shared_ai_results
    for delete using (shared_by_email = auth.email() or shared_with_email = auth.email());
