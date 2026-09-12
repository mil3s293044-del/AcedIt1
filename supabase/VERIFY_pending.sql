-- ════════════════════════════════════════════════════════════════════════════
-- Did PENDING_run_me.sql actually land?
--
-- Paste this into the Supabase SQL editor AFTER running PENDING_run_me.sql.
-- Every row should read "ok". Read-only — it changes nothing.
--
-- Worth running rather than assuming: the SQL editor reports the last
-- statement's result, and PENDING_run_me.sql is one long transaction whose
-- successful commit looks the same whether it did ten things or forty.
-- ════════════════════════════════════════════════════════════════════════════

select 'callouts table (0025/0026)' as check,
       case when to_regclass('public.callouts') is null
            then 'MISSING — call-outs stay hidden'
            else 'ok' end as result
union all
select 'callout verify/record columns (0026)',
       case when exists (select 1 from information_schema.columns
                         where table_name = 'callouts' and column_name = 'window_start')
            then 'ok' else 'MISSING' end
union all
select 'compete_reactions table (0034)',
       case when to_regclass('public.compete_reactions') is null
            then 'MISSING — reaction buttons never appear'
            else 'ok' end
union all
select 'compete_reactions RLS policy (0034)',
       case when exists (select 1 from pg_policy p
                         join pg_class c on c.oid = p.polrelid
                         where c.relname = 'compete_reactions')
            then 'ok' else 'MISSING — reactions would be unreadable' end
union all
-- Realtime is optional: without it the app polls every 45s and behaves
-- identically, just later. "MISSING" here is a slower app, not a broken one.
select 'realtime: goal_competitions (0035)',
       case when exists (select 1 from pg_publication_tables
                         where pubname = 'supabase_realtime'
                           and schemaname = 'public' and tablename = 'goal_competitions')
            then 'ok' else 'not published — polling only' end
union all
select 'realtime: study_duels (0035)',
       case when exists (select 1 from pg_publication_tables
                         where pubname = 'supabase_realtime'
                           and schemaname = 'public' and tablename = 'study_duels')
            then 'ok' else 'not published — polling only' end
union all
select 'realtime: callouts (0035)',
       case when exists (select 1 from pg_publication_tables
                         where pubname = 'supabase_realtime'
                           and schemaname = 'public' and tablename = 'callouts')
            then 'ok' else 'not published — polling only' end
union all
-- A few earlier ones the app degrades visibly without, so a partial run is
-- caught here rather than as a blank panel a week later.
select 'acedit_atar column (0022)',
       case when exists (select 1 from information_schema.columns
                         where table_name = 'user_profiles' and column_name = 'acedit_atar')
            then 'ok' else 'MISSING — Ranked degrades to a notice' end
union all
select 'weekly chips (0033)',
       case when exists (select 1 from information_schema.columns
                         where table_name = 'user_profiles' and column_name = 'weekly_chips_spent')
            then 'ok' else 'MISSING' end
union all
select 'markets table (0036)',
       case when to_regclass('public.markets') is null
            then 'MISSING — Compete says the floor is not open'
            else 'ok' end
union all
select 'market_positions table (0036)',
       case when to_regclass('public.market_positions') is null
            then 'MISSING — nobody can take a side'
            else 'ok' end
union all
select 'cred columns (0036)',
       case when exists (select 1 from information_schema.columns
                         where table_name = 'user_profiles' and column_name = 'cred_balance')
            then 'ok' else 'MISSING — no stake can be escrowed' end;
