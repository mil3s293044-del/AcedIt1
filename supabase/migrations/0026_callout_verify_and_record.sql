-- 0026: Self-verification, immunity, and a public record for call-outs.
--
-- Three things the first cut of call-outs got wrong by omission.
--
-- 1. Passing one was purely defensive. You kept your XP and that was the whole
--    reward, which makes a mechanic students dread rather than reach for. A
--    pass is now a record worth having.
--
-- 2. There was no way to opt out of the anxiety honestly. `kind = 'self_check'`
--    lets a student sit the same quiz unprompted; passing buys a window where
--    nobody can call them out, which turns a defensive mechanic into a flex.
--
-- 3. Nothing priced repeat accusers. That's counted from this table at
--    settlement rather than stored, so no column is needed for it.

alter table public.callouts
    add column if not exists kind text not null default 'callout'
        check (kind in ('callout', 'self_check')),
    -- Set when a self-check passes: nobody may call this student out until it
    -- expires. Also set on a passed call-out — surviving one should buy the
    -- same peace as volunteering for one.
    add column if not exists immunity_until timestamptz,
    -- Which contest metric the stake was scoped to, for the record and for
    -- explaining the number back to the student.
    add column if not exists metric text;

-- A self-check has no opponent, so the caller/target are the same person and
-- the original "one open per caller" index would stop a student verifying
-- themselves while a real call-out is in flight. Scope every uniqueness rule
-- to real call-outs.
drop index if exists callouts_one_open_per_target_duel;
drop index if exists callouts_one_open_per_target_comp;
drop index if exists callouts_one_per_caller_duel;
drop index if exists callouts_one_per_caller_comp;

create unique index callouts_one_open_per_target_duel
    on public.callouts (duel_id, target_email)
    where duel_id is not null and kind = 'callout' and status in ('pending','active');
create unique index callouts_one_open_per_target_comp
    on public.callouts (competition_id, target_email)
    where competition_id is not null and kind = 'callout' and status in ('pending','active');
create unique index callouts_one_per_caller_duel
    on public.callouts (duel_id, caller_email)
    where duel_id is not null and kind = 'callout' and status in ('pending','active');
create unique index callouts_one_per_caller_comp
    on public.callouts (competition_id, caller_email)
    where competition_id is not null and kind = 'callout' and status in ('pending','active');

-- One self-check at a time per contest, so it can't be spammed to farm
-- immunity or to stall an incoming call-out.
create unique index callouts_one_open_self_check_duel
    on public.callouts (duel_id, target_email)
    where duel_id is not null and kind = 'self_check' and status in ('pending','active');
create unique index callouts_one_open_self_check_comp
    on public.callouts (competition_id, target_email)
    where competition_id is not null and kind = 'self_check' and status in ('pending','active');

-- Looked up on every call-out attempt, so it wants an index.
create index if not exists callouts_immunity_idx
    on public.callouts (target_email, immunity_until)
    where immunity_until is not null;
