-- 0020: Streak shields — earned insurance against a single missed day.
--
-- One shield is earned at every 7-day streak milestone (7, 14, 21, …), held to
-- a max of 2. When a user misses exactly one day, updateStreak consumes a
-- shield and the streak continues instead of resetting. Gaps of 2+ days still
-- hard-reset (shields protect a slip, not an absence).

alter table public.user_profiles
    add column if not exists streak_shields int not null default 0;

comment on column public.user_profiles.streak_shields is
    'Streak insurance: earned at each 7-day streak milestone (max 2), consumed by updateStreak to survive a single missed day.';
