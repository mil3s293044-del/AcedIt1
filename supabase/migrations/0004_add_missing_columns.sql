-- ════════════════════════════════════════════════════════════════════════════
-- Phase 3b-3 hotfix — fields the app sends that aren't in our schema yet.
--
-- PostgREST (Supabase's auto-API) returns 400 PGRST204 when the JSON body
-- contains a field that isn't a real column. Each missing column = one bug.
-- These ALTER TABLEs add the columns the app actually sends.
--
-- All columns are nullable (no defaults change semantics) so existing rows
-- aren't affected.
-- ════════════════════════════════════════════════════════════════════════════


-- ─── user_subjects: VCE catalog linkage + year level ──────────────────────
alter table public.user_subjects
    add column if not exists vce_subject_id text,
    add column if not exists year_level     text;

create index if not exists user_subjects_vce_subject_id_idx
    on public.user_subjects (vce_subject_id) where vce_subject_id is not null;


-- ─── user_profiles: onboarding tasks + goal/school metadata ───────────────
alter table public.user_profiles
    add column if not exists onboarding_tasks   jsonb not null default '{}'::jsonb,
    add column if not exists goal_atar          numeric,
    add column if not exists goal_course_name   text,
    add column if not exists goal_university    text,
    add column if not exists school_code        text,
    add column if not exists school_name        text,
    add column if not exists credits_reset_date timestamptz,
    add column if not exists integrity_flags    jsonb not null default '{}'::jsonb;
