-- 0040 — pranks arrive without a refresh.
--
-- WHAT WAS WRONG. `getPranks` was fetched ONCE per page load, keyed on the
-- account, and Layout does not unmount between navigations — so a prank sent
-- while somebody had the app open did not arrive until they reloaded the tab.
-- Layout's own comment argued the case ("a prank is not urgent... a timer
-- asking the server every thirty seconds whether somebody has been pranked is
-- a query per student per interval for a joke") and the trade was simply the
-- wrong way round: the whole point of a prank is that it lands while they are
-- there to see it.
--
-- THE PUSH IS A FASTER TRIGGER AND NEVER A DATA SOURCE, which is the rule
-- `realtime.js` already states for Compete. This publication makes the client
-- hear that a row arrived; it then calls `getPranks` like always, so the
-- SERVER still decides what is delivered, still resolves the sender's name,
-- still drops a row it cannot attribute, and still marks it seen. Nothing in
-- the broadcast payload is trusted or drawn.
--
-- AND THE POLL STAYS UNDERNEATH. A table that is not in this publication is
-- SILENT — the subscription connects and simply never fires, with no status
-- that says so — so LiveContext's existing tick carries the whole job and this
-- only makes it faster. That is what makes applying this migration an
-- improvement rather than a dependency.
--
-- `replica identity` is left at its default. The client reads nothing off the
-- payload, so there is no reason to put a prank's columns on the wire; the
-- default sends the primary key on an update and that is already more than
-- anything here uses.

do $$
begin
    -- The publication is created by Supabase on project setup. On a bare
    -- Postgres (a local test, a self-hosted instance) it may not exist, and a
    -- migration that assumes somebody else's object is one that fails on a
    -- clean database.
    if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        create publication supabase_realtime;
    end if;
end $$;

-- Guarded, so this is safe to run twice: `alter publication ... add table` on
-- a table already in it is an error rather than a no-op.
do $$
begin
    if to_regclass('public.pranks') is null then
        return;   -- 0038 has not been applied yet; a later run picks it up
    end if;
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'pranks'
    ) then
        alter publication supabase_realtime add table public.pranks;
    end if;
end $$;
