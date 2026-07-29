-- 0022: AcedIt ATAR — the holistic competitive score (0-99.95, ATAR-shaped).
--
-- Measures HOW a student is studying over a trailing 28-day window
-- (mastery 30% / consistency 30% / effort 25% / breadth 15%), computed
-- server-side from the audited xp_events log. NOT a VCAA prediction — the UI
-- says so wherever it appears. Ranks/bands across the app key off this.

alter table public.user_profiles
    add column if not exists acedit_atar        numeric,
    add column if not exists atar_components    jsonb,
    add column if not exists atar_updated_at    timestamptz;

alter table public.leaderboards
    add column if not exists acedit_atar        numeric;

create index if not exists leaderboards_acedit_atar_idx
    on public.leaderboards (acedit_atar desc nulls last);

comment on column public.user_profiles.acedit_atar is
    'AcedIt ATAR: trailing-28-day study-quality score (0-99.95). App-native — not a VCAA prediction.';
