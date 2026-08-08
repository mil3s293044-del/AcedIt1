-- 0025: Call-outs — prove you learned it, not just that you clocked hours.
--
-- Duels and group battles reward measured effort: XP, minutes, cards reviewed.
-- All of those can be farmed by a student who flips cards without reading them,
-- which makes the leaderboard a measure of patience rather than learning.
--
-- A call-out is the check. One competitor challenges another to sit a short,
-- timed quiz built from the material that competitor themselves studied during
-- the competition. Pass and you take the caller's competition XP; fail and you
-- lose your own. It costs the caller something to make the accusation, so it
-- can't be used as free harassment.
--
-- Server-write-only, like study_duels: every state change runs through
-- server.mjs with the service_role key, because the questions carry their own
-- answers and the settlement moves XP. Clients read via RLS and never see the
-- `questions` column — the API strips answers before sending.

create table public.callouts (
    id                uuid primary key default gen_random_uuid(),
    created_by        text not null,                 -- = caller_email
    created_date      timestamptz not null default now(),

    -- What it's attached to. Exactly one of these is set.
    duel_id           uuid references public.study_duels(id) on delete cascade,
    competition_id    uuid references public.goal_competitions(id) on delete cascade,

    caller_email      text not null,
    caller_name       text not null default '',
    target_email      text not null,
    target_name       text not null default '',

    -- The window the material and the XP at stake are drawn from.
    window_start      timestamptz not null,

    -- pending  → target hasn't opened it yet (clock not running)
    -- active   → target opened it; `started_at` set, timer running
    -- passed / failed / expired / voided
    status            text not null default 'pending'
                      check (status in ('pending','active','passed','failed','expired','voided')),

    -- The quiz. Answers live here and are never sent to any client.
    -- [{ q, options: [..], correct: int, source: 'flashcard'|'quiz', ref }]
    questions         jsonb not null default '[]'::jsonb,
    seconds_allowed   int not null default 300,
    pass_mark         numeric not null default 0.75,

    -- Deadline for opening it at all. Missing this forfeits.
    respond_by        timestamptz not null,
    started_at        timestamptz,
    submitted_at      timestamptz,

    -- Outcome
    score             numeric,                       -- 0..1
    answers           jsonb not null default '[]'::jsonb,
    xp_moved          int not null default 0,
    settle_note       text,

    extra             jsonb not null default '{}'::jsonb
);

create index callouts_target_idx  on public.callouts (target_email, status, created_date desc);
create index callouts_caller_idx  on public.callouts (caller_email, created_date desc);
create index callouts_duel_idx    on public.callouts (duel_id);
create index callouts_comp_idx    on public.callouts (competition_id);

-- One live call-out per target per contest, and one per caller per contest.
-- Partial unique indexes so settled rows don't block a rematch in a new duel.
create unique index callouts_one_open_per_target_duel
    on public.callouts (duel_id, target_email)
    where duel_id is not null and status in ('pending','active');
create unique index callouts_one_open_per_target_comp
    on public.callouts (competition_id, target_email)
    where competition_id is not null and status in ('pending','active');
create unique index callouts_one_per_caller_duel
    on public.callouts (duel_id, caller_email)
    where duel_id is not null and status in ('pending','active');
create unique index callouts_one_per_caller_comp
    on public.callouts (competition_id, caller_email)
    where competition_id is not null and status in ('pending','active');

alter table public.callouts enable row level security;

-- Only the two people involved can see a call-out. Spectators don't need the
-- questions rendered anywhere, and the API strips answers regardless.
create policy "callouts_select_involved" on public.callouts
    for select using (auth.email() = caller_email or auth.email() = target_email);
-- No insert/update/delete policies: writes are service_role only.
