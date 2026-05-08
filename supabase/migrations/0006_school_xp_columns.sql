-- ════════════════════════════════════════════════════════════════════════════
-- Phase 3b-4 — school_profiles XP aggregates for awardXP.
--
-- Base44's awardXP function looks up a user's school by `school_name` and
-- bumps `total_season_xp` + `total_alltime_xp` on every XP event. Add the
-- columns + a school_name index so that path keeps working.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.school_profiles
    add column if not exists school_name        text,
    add column if not exists total_season_xp    bigint not null default 0,
    add column if not exists total_alltime_xp   bigint not null default 0;

-- Backfill school_name from name where the row already had one
update public.school_profiles set school_name = name where school_name is null;

create index if not exists school_profiles_school_name_idx
    on public.school_profiles (school_name) where school_name is not null;
