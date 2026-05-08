-- ════════════════════════════════════════════════════════════════════════════
-- Phase 3b-4 — columns the XP / streak server functions write to.
--
-- These mirror the fields Base44's awardXP and updateStreak functions read &
-- write. Without them the ported endpoints would 400 on PostgREST schema
-- mismatches. Each is nullable / safely defaulted so existing rows aren't
-- affected.
-- ════════════════════════════════════════════════════════════════════════════


-- ─── user_profiles: streak + XP integrity fields ──────────────────────────
alter table public.user_profiles
    add column if not exists last_streak_date  date,
    add column if not exists peak_streak       int not null default 0,
    -- Anti-grind state used by awardXP (daily-per-source caps + 1h velocity log)
    add column if not exists daily_xp_caps     jsonb not null default '{}'::jsonb,
    add column if not exists xp_velocity_log   jsonb not null default '[]'::jsonb,
    -- Mirror of created_by for legacy code that filters by user_email
    add column if not exists user_email        text;

-- Backfill user_email from created_by for existing rows (one-time)
update public.user_profiles set user_email = created_by where user_email is null;


-- ─── xp_events: full audit row Base44 awardXP writes ──────────────────────
-- The 0003 migration created this with minimal columns. awardXP needs more.
alter table public.xp_events
    add column if not exists user_email       text,
    add column if not exists xp_awarded       int,
    add column if not exists raw_xp           int,
    add column if not exists capped           boolean default false,
    add column if not exists integrity_flags  jsonb not null default '[]'::jsonb,
    add column if not exists total_xp_after   bigint,
    add column if not exists season_xp_after  bigint,
    add column if not exists level_before     int,
    add column if not exists level_after      int,
    add column if not exists leveled_up       boolean default false,
    add column if not exists metadata         jsonb not null default '{}'::jsonb;

-- Backfill xp_awarded from xp_amount (the 0003 migration's original column name)
update public.xp_events set xp_awarded = xp_amount where xp_awarded is null and xp_amount is not null;
update public.xp_events set user_email = created_by where user_email is null;
