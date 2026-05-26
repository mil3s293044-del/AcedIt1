-- ─── 0016: achievements unlock tracking ──────────────────────────────────
-- The achievement catalog lives in code (server.mjs ACHIEVEMENT_CATALOG)
-- so adding/tweaking achievements is a code change, not a DB change. This
-- table just records which users have unlocked which codes + when.

create table if not exists public.user_achievements (
    id                  uuid primary key default gen_random_uuid(),
    user_email          text not null,
    achievement_code    text not null,
    unlocked_at         timestamptz not null default now(),
    reward_xp_awarded   integer not null default 0
);
create unique index if not exists user_achievements_user_code_uniq
    on public.user_achievements (user_email, achievement_code);
create index if not exists user_achievements_user_idx
    on public.user_achievements (user_email);

alter table public.user_achievements enable row level security;

-- Users can read their own unlocks. Writes happen server-side via service_role.
drop policy if exists "user_achievements_select_own" on public.user_achievements;
create policy "user_achievements_select_own" on public.user_achievements
    for select using (user_email = auth.email());
