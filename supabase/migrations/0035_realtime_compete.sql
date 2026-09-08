-- 0035: Publish the compete tables so the app can stop polling for them.
--
-- LiveContext polls every 45 seconds while a contest is running, which is fine
-- and is what ships today. This makes a rival's score arrive when it changes
-- instead of up to 45 seconds later, which is the difference between a
-- leaderboard that is accurate and one that feels alive.
--
-- ── The push is a TRIGGER, not a data source ──────────────────────────────
-- src/api/realtime.js throws the changed row away and refetches through the
-- normal reads. So this publication cannot become a second, subtler channel
-- where "what the client was told" stands in for "what the server knows" —
-- and the poll underneath it means the app behaves identically whether or not
-- this migration has been applied. That is why the client shipped first.
--
-- ── What each client actually receives ────────────────────────────────────
-- Realtime respects RLS, so a student is only notified about rows they could
-- already have read:
--   goal_competitions  → goal_competitions_select_participant (0008)
--   study_duels        → study_duels_select_authed            (0021)
--   callouts           → the policies in 0025
-- Nothing here widens any of that. It only makes the same rows arrive sooner.
--
-- REPLICA IDENTITY is left at its default (primary key). The app does not read
-- the payload, so there is nothing to gain from shipping full old rows on
-- every update — and `full` on goal_competitions would put the entire
-- participants array on the wire for every sync of every battle.

do $$
begin
    -- The publication is created by Supabase on project setup. On a bare
    -- Postgres (a local test, a self-hosted instance) it may not exist, and a
    -- migration that assumes somebody else's object is a migration that fails
    -- on a clean database.
    if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        create publication supabase_realtime;
    end if;
end $$;

-- Guarded per table, so this is safe to run twice — the contract
-- PENDING_run_me.sql states for the whole file it lives in. `alter publication
-- ... add table` on a table already in it is an error, not a no-op.
do $$
declare
    t text;
begin
    foreach t in array array['goal_competitions', 'study_duels', 'callouts']
    loop
        if to_regclass('public.' || t) is null then
            continue;   -- table not created yet; a later run picks it up
        end if;
        if not exists (
            select 1 from pg_publication_tables
            where pubname = 'supabase_realtime'
              and schemaname = 'public'
              and tablename = t
        ) then
            execute format('alter publication supabase_realtime add table public.%I', t);
        end if;
    end loop;
end $$;
