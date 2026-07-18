-- 0021: The Arena — study duels + back-yourself bets.
--
-- Two new tables. BOTH are server-write-only: every insert/update goes through
-- server.mjs functions using the service_role key (escrow, settlement, and
-- payouts all run through the audited XP engine). Clients get read-only
-- visibility via RLS so the arena can render live duels.

-- ─── study_duels: head-to-head study battles with an XP ante ────────────────
create table public.study_duels (
    id               uuid primary key default gen_random_uuid(),
    created_by       text not null,                -- challenger email
    created_date     timestamptz not null default now(),

    challenger_email text not null,
    challenger_name  text not null default '',
    opponent_email   text not null,
    opponent_name    text not null default '',

    metric           text not null check (metric in ('xp', 'quiz_marks', 'flashcards', 'study_minutes')),
    window_hours     int  not null check (window_hours in (24, 72, 168)),
    ante_xp          int  not null check (ante_xp between 25 and 500),

    -- pending → active → settled | declined | expired | cancelled
    status           text not null default 'pending',
    starts_at        timestamptz,
    ends_at          timestamptz,
    settled_at       timestamptz,
    winner_email     text,                          -- null on tie
    final_scores     jsonb not null default '{}'::jsonb,

    -- spectator side bets: [{id, bettor_email, bettor_name, backed_email,
    --   wagered_xp, status: open|won|lost, xp_outcome, created_at}]
    side_bets        jsonb not null default '[]'::jsonb
);
create index study_duels_challenger_idx on public.study_duels (challenger_email, created_date desc);
create index study_duels_opponent_idx   on public.study_duels (opponent_email, created_date desc);
create index study_duels_status_idx     on public.study_duels (status);

alter table public.study_duels enable row level security;
-- Any signed-in student can watch a duel (spectator side bets need this).
create policy "study_duels_select_authed" on public.study_duels
    for select using (auth.role() = 'authenticated');
-- No insert/update/delete policies: writes are service_role only.

-- ─── study_bets: back-yourself commitment bets, auto-verified ───────────────
create table public.study_bets (
    id            uuid primary key default gen_random_uuid(),
    created_by    text not null,
    created_date  timestamptz not null default now(),

    metric        text not null check (metric in ('xp', 'quiz_marks', 'flashcards', 'study_minutes')),
    target        int  not null check (target > 0),
    stake_xp      int  not null check (stake_xp between 25 and 500),
    multiplier    numeric not null default 1.5,

    starts_at     timestamptz not null default now(),
    ends_at       timestamptz not null,
    -- active → won | lost
    status        text not null default 'active',
    settled_at    timestamptz,
    final_value   int
);
create index study_bets_owner_idx on public.study_bets (created_by, created_date desc);

alter table public.study_bets enable row level security;
create policy "study_bets_select_own" on public.study_bets
    for select using (created_by = auth.email());
-- No insert/update/delete policies: writes are service_role only.
