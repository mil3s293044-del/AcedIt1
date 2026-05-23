-- ─── 0013: allow users to create private custom subjects ──────────────────
-- The vce_subjects table was originally curriculum reference data (read-only,
-- service-role writes). The Subjects page lets users create their own custom
-- subjects on top of the static VCE catalog — those need to live somewhere,
-- and the client points them at vce_subjects with is_private=true.
--
-- This migration:
--   1. Adds the columns the client expects (color, overview, is_private).
--   2. Drops the global UNIQUE(code) constraint — multiple users can name
--      a subject with the same code (e.g. two students each adding "BIO34"
--      as a private subject is fine).
--   3. Adds RLS policies so authenticated users can INSERT/UPDATE/DELETE
--      their own private rows. Service-role writes still go through (RLS
--      bypassed for service_role).

alter table public.vce_subjects
    add column if not exists color      text,
    add column if not exists overview   text,
    add column if not exists is_private boolean not null default false;

-- Drop the global unique constraint on code so two users can both have
-- a private "BIO34" custom subject. If we ever re-seed the static
-- curriculum into this table we can add a partial unique back covering
-- only is_private = false.
alter table public.vce_subjects drop constraint if exists vce_subjects_code_key;

create index if not exists vce_subjects_created_by_idx on public.vce_subjects (created_by);
create index if not exists vce_subjects_is_private_idx on public.vce_subjects (is_private);

-- INSERT: any authenticated user can create their own private subject.
drop policy if exists "vce_subjects_insert_own_private" on public.vce_subjects;
create policy "vce_subjects_insert_own_private" on public.vce_subjects
    for insert with check (
        is_private = true
        and created_by = auth.email()
    );

-- UPDATE: only your own private rows.
drop policy if exists "vce_subjects_update_own_private" on public.vce_subjects;
create policy "vce_subjects_update_own_private" on public.vce_subjects
    for update using (
        is_private = true
        and created_by = auth.email()
    ) with check (
        is_private = true
        and created_by = auth.email()
    );

-- DELETE: only your own private rows.
drop policy if exists "vce_subjects_delete_own_private" on public.vce_subjects;
create policy "vce_subjects_delete_own_private" on public.vce_subjects
    for delete using (
        is_private = true
        and created_by = auth.email()
    );
