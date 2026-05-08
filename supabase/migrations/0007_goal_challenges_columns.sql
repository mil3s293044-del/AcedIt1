-- ─── 0007: expand goal_challenges schema ────────────────────────────────────
-- The 0003 schema was a minimal stub. The Base44 challenge functions
-- (generateGoalChallenge, saveChallengeProgress, completeGoalChallenge) need
-- a richer set of columns. This migration brings the table up to feature
-- parity with the Base44 GoalChallenge entity.
--
-- Safe to run because goal_challenges is empty in this project (dual-run, no
-- writes have hit Supabase yet).

-- Drop the old numeric `progress` and `is_completed` columns; replace with
-- jsonb progress + a richer text `status` column.
alter table public.goal_challenges drop column if exists progress;
alter table public.goal_challenges drop column if exists is_completed;

alter table public.goal_challenges
    add column if not exists status                text not null default 'active'
        check (status in ('active','completed','skipped','abandoned')),
    add column if not exists progress              jsonb not null default '{}'::jsonb,
    add column if not exists sub_goal_id           text,
    add column if not exists sub_goal_title        text,
    add column if not exists subject_name          text,
    add column if not exists subject_code          text,
    add column if not exists difficulty            text,
    add column if not exists instructions          text,
    add column if not exists target_metric         text,
    add column if not exists time_limit_minutes    int,
    add column if not exists content               jsonb not null default '{}'::jsonb,
    add column if not exists completion_criteria   jsonb not null default '{}'::jsonb,
    add column if not exists ai_reasoning          text,
    add column if not exists performance_snapshot  jsonb not null default '{}'::jsonb,
    add column if not exists generation_number     int default 1,
    add column if not exists result                jsonb;

create index if not exists goal_challenges_status_idx
    on public.goal_challenges (created_by, status);
create index if not exists goal_challenges_sub_goal_idx
    on public.goal_challenges (goal_id, sub_goal_id);
