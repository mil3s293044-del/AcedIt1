-- ─── 0015: Weekly leagues system ──────────────────────────────────────────
-- Duolingo-style competitive leagues. Every Monday UTC, users are placed
-- into groups of 30 within their current tier. After 7 days:
--   • Top 5 promote to next tier
--   • Bottom 5 demote to lower tier
--   • Middle 20 stay
--
-- 6 tiers: bronze → silver → gold → platinum → diamond → master
--
-- No cron required — rollover is lazy: every awardXP call checks if the
-- user's current week_start is stale and rolls them over if so.

-- ─── league_groups ─────────────────────────────────────────────────────────
-- One row per (tier, week_start) per "shard" — there can be many groups in
-- the same tier+week (e.g. once 31+ Gold-tier users exist for a given week,
-- a second Gold group is created).
create table if not exists public.league_groups (
    id              uuid primary key default gen_random_uuid(),
    tier            text not null check (tier in ('bronze','silver','gold','platinum','diamond','master')),
    week_start      date not null,                 -- Monday UTC
    created_at      timestamptz not null default now(),
    -- 0 means group is open for new joiners; >0 means closed (full).
    member_count    integer not null default 0,
    is_full         boolean not null default false
);
create index if not exists league_groups_tier_week_idx
    on public.league_groups (tier, week_start, is_full);

-- ─── league_memberships ───────────────────────────────────────────────────
-- One row per (user, week_start). Holds the user's weekly XP, tier at
-- start, group placement, and promotion/demotion outcome.
create table if not exists public.league_memberships (
    id                 uuid primary key default gen_random_uuid(),
    user_email         text not null,
    league_group_id    uuid not null references public.league_groups(id) on delete cascade,
    week_start         date not null,
    tier               text not null check (tier in ('bronze','silver','gold','platinum','diamond','master')),
    weekly_xp          integer not null default 0,
    final_position     integer,                  -- set during rollover
    promoted           boolean not null default false,
    demoted            boolean not null default false,
    is_anonymous       boolean not null default false,
    joined_at          timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);
create unique index if not exists league_memberships_user_week_uniq
    on public.league_memberships (user_email, week_start);
create index if not exists league_memberships_group_xp_idx
    on public.league_memberships (league_group_id, weekly_xp desc);
create index if not exists league_memberships_user_email_idx
    on public.league_memberships (user_email);

-- ─── RLS ──────────────────────────────────────────────────────────────────
alter table public.league_groups enable row level security;
alter table public.league_memberships enable row level security;

-- Anyone authenticated can read league data — they need to see other
-- members of their group on the leaderboard.
drop policy if exists "league_groups_select_all" on public.league_groups;
create policy "league_groups_select_all" on public.league_groups
    for select using (auth.uid() is not null);

drop policy if exists "league_memberships_select_all" on public.league_memberships;
create policy "league_memberships_select_all" on public.league_memberships
    for select using (auth.uid() is not null);

-- Users can update only their OWN membership (toggle anonymity).
-- Inserts/group-management happen server-side via service_role (RLS bypassed).
drop policy if exists "league_memberships_update_own" on public.league_memberships;
create policy "league_memberships_update_own" on public.league_memberships
    for update using (user_email = auth.email())
    with check (user_email = auth.email());

-- ─── user_profiles additions ──────────────────────────────────────────────
alter table public.user_profiles
    add column if not exists current_league_tier      text default 'bronze' check (current_league_tier in ('bronze','silver','gold','platinum','diamond','master')),
    add column if not exists current_league_group_id  uuid references public.league_groups(id) on delete set null,
    add column if not exists league_lifetime_promotes integer not null default 0,
    add column if not exists league_lifetime_demotes  integer not null default 0,
    add column if not exists league_anonymous_default boolean not null default false;

create index if not exists user_profiles_league_tier_idx
    on public.user_profiles (current_league_tier);
