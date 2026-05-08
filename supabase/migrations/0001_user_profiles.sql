-- ════════════════════════════════════════════════════════════════════════════
-- Phase 3a smoke-test migration — user_profiles only.
--
-- After applying this in the Supabase SQL editor and enabling Google OAuth,
-- the smoke test should:
--   1. Sign in via Google
--   2. Auto-create a user_profiles row on first login
--   3. window.__dualRun.testRead('UserProfile') returns that row
--
-- The other 34 tables come in a follow-up migration once we've proven
-- the auth + RLS + dispatch wiring works end-to-end.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── user_profiles ──────────────────────────────────────────────────────────
-- Mirrors the Base44 UserProfile shape inferred from the codebase.
-- IMPORTANT: review this against your Base44 dashboard's UserProfile fields.
-- Anything missing here means columns we'd need before flipping the flag.
create table public.user_profiles (
    id                            uuid primary key default gen_random_uuid(),
    -- Auth linkage. created_by stays as email for compat with the 193 existing
    -- `filter({ created_by: user.email })` call sites; user_id is the JWT linkage.
    user_id                       uuid references auth.users(id) on delete cascade,
    created_by                    text not null,
    created_date                  timestamptz not null default now(),
    updated_date                  timestamptz not null default now(),

    -- Identity / display
    full_name                     text,
    username                      text unique,
    is_anonymous_on_leaderboard   boolean not null default false,

    -- XP / progression
    total_xp                      bigint not null default 0,
    season_xp                     bigint not null default 0,
    current_level                 int not null default 1,
    streak_days                   int not null default 0,

    -- Subscription
    subscription_tier             text not null default 'free' check (subscription_tier in ('free','premium')),
    subscription_active           boolean not null default false,
    subscription_expires_at       timestamptz,
    user_role                     text not null default 'free_user',
    ai_credits                    int not null default 500,

    -- Trial
    trial_active                  boolean not null default false,
    trial_ends_at                 timestamptz,

    -- Onboarding
    onboarding_completed          boolean not null default false,
    onboarding_completed_at       timestamptz,

    -- Catch-all for fields we may have missed. Strongly typed columns added later.
    extra                         jsonb not null default '{}'::jsonb
);

create unique index user_profiles_created_by_uniq on public.user_profiles (created_by);
create index user_profiles_user_id_idx on public.user_profiles (user_id);

-- updated_date auto-bump trigger
create or replace function public.touch_updated_date()
returns trigger language plpgsql as $$
begin
    new.updated_date := now();
    return new;
end;
$$;

create trigger user_profiles_touch_updated
    before update on public.user_profiles
    for each row execute function public.touch_updated_date();

-- ─── RLS ────────────────────────────────────────────────────────────────────
-- Each user can only read/write their own profile. created_by must match the
-- JWT's email claim. Service role bypasses RLS for server-side ops.
alter table public.user_profiles enable row level security;

create policy "users read own profile"
    on public.user_profiles for select
    using (created_by = auth.email());

create policy "users insert own profile"
    on public.user_profiles for insert
    with check (created_by = auth.email());

create policy "users update own profile"
    on public.user_profiles for update
    using (created_by = auth.email())
    with check (created_by = auth.email());

create policy "users delete own profile"
    on public.user_profiles for delete
    using (created_by = auth.email());

-- ─── Auto-provision profile on first sign-in ────────────────────────────────
-- When a new auth.users row is created, mirror it into user_profiles so the
-- app has something to read right away (matches Base44's behavior where the
-- profile gets created during onboarding).
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    insert into public.user_profiles (user_id, created_by, full_name)
    values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data->>'full_name',
                 new.raw_user_meta_data->>'name',
                 split_part(new.email, '@', 1))
    )
    on conflict (created_by) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_auth_user();
