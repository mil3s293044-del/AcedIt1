-- ─── 0008: align goal_competitions and score_wagers with Base44 functions ───
-- The 0003 schemas were generic placeholders. The Base44 functions
-- (createGoalCompetition, joinGoalCompetition, updateCompetitionProgress,
-- settleHoursCompetition, resolveScoreWager) need a different shape.
--
-- Both tables are empty in this project (dual-run, no writes), so safe to
-- drop+recreate goal_competitions, and to alter score_wagers.

-- ── goal_competitions: drop + recreate with Base44-compatible shape ─────────
drop table if exists public.goal_competitions cascade;

create table public.goal_competitions (
    id                       uuid primary key default gen_random_uuid(),
    created_by               text not null,                   -- = creator email
    created_date             timestamptz not null default now(),
    updated_date             timestamptz not null default now(),

    goal_id                  uuid references public.goals(id) on delete set null,
    goal_title               text,
    goal_description         text,
    goal_category            text,
    goal_target_date         date,
    subject_name             text,
    subject_code             text,
    competition_start_date   timestamptz,
    creator_email            text not null,
    creator_name             text,
    status                   text not null default 'active'
                              check (status in ('pending','active','completed','cancelled')),
    participants             jsonb not null default '[]'::jsonb,
    invite_code              text,
    max_participants         int default 10,
    progress_bets            jsonb not null default '[]'::jsonb,
    winner_email             text,
    winner_name              text,
    completed_at             timestamptz,

    extra                    jsonb not null default '{}'::jsonb
);

create index goal_competitions_creator_idx     on public.goal_competitions (creator_email);
create index goal_competitions_invite_code_idx on public.goal_competitions (invite_code);
create index goal_competitions_status_idx      on public.goal_competitions (status);
create trigger goal_competitions_touch_updated before update on public.goal_competitions
    for each row execute function public.touch_updated_date();

alter table public.goal_competitions enable row level security;

-- Visibility: creator OR anyone whose email appears in participants[].email
-- (using a jsonb existence check rather than the old text[] approach).
create policy "goal_competitions_select_participant" on public.goal_competitions
    for select using (
        creator_email = auth.email()
        or participants @> jsonb_build_array(jsonb_build_object('email', auth.email()))
    );
create policy "goal_competitions_insert_as_creator" on public.goal_competitions
    for insert with check (creator_email = auth.email());
-- Updates happen via service_role from server.mjs (joinGoalCompetition,
-- updateCompetitionProgress, settleHoursCompetition all run server-side),
-- but allow creator + accepted participants to update their own slice if
-- ever called direct.
create policy "goal_competitions_update_participant" on public.goal_competitions
    for update using (
        creator_email = auth.email()
        or participants @> jsonb_build_array(jsonb_build_object('email', auth.email()))
    ) with check (
        creator_email = auth.email()
        or participants @> jsonb_build_array(jsonb_build_object('email', auth.email()))
    );
create policy "goal_competitions_delete_as_creator" on public.goal_competitions
    for delete using (creator_email = auth.email());


-- ── score_wagers: align with resolveScoreWager expectations ─────────────────
-- Drop the old narrow status check; the function uses 'active' / 'resolved'
-- and tracks accuracy + xp_outcome separately.
alter table public.score_wagers drop constraint if exists score_wagers_status_check;

alter table public.score_wagers
    rename column wager_xp to wagered_xp;

alter table public.score_wagers
    add column if not exists assessment_id   uuid,
    add column if not exists actual_score    numeric,
    add column if not exists accuracy        text
        check (accuracy in ('exact','close','wrong')),
    add column if not exists xp_outcome      int;

alter table public.score_wagers
    alter column status set default 'active';

alter table public.score_wagers
    add constraint score_wagers_status_check
    check (status in ('active','resolved','cancelled'));

create index if not exists score_wagers_assessment_idx on public.score_wagers (assessment_id);
