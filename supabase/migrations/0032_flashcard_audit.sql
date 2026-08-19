-- 0032 — let a student put a card away without destroying it.
--
-- The review queue had exactly one exit: is_active = false, which is deletion.
-- So somebody who genuinely knows the definition of osmosis could keep being
-- asked, or lose the card. Neither is what they meant.
--
-- Two new states, because "stop asking me" has two honest meanings:
--
--   retired_at     "I know this." Out of the queue indefinitely, reversible,
--                  and timestamped so the audit screen can say when they
--                  decided that. A timestamp rather than a boolean because
--                  "you marked this known in March" is worth being able to say
--                  when a card resurfaces in an exam.
--
--   snoozed_until  "Not today." Lets somebody clear a pile without claiming
--                  knowledge they do not have, which is the behaviour that
--                  actually keeps the scheduler's data honest.
--
-- Both are nullable with no default, so every existing row keeps behaving
-- exactly as it does now and there is nothing to backfill.

alter table public.flashcards
    add column if not exists retired_at    timestamptz,
    add column if not exists snoozed_until date;

-- The due query is `is_active and not retired and (snoozed is null or past)`,
-- run per user on every dashboard load. A partial index over the active,
-- unretired rows keeps it off the retired pile entirely, which is the part
-- that only ever grows.
create index if not exists flashcards_due_queue_idx
    on public.flashcards (created_by, next_review_date)
    where is_active and retired_at is null;

-- The audit screen's "marked known" section reads the other side of that.
create index if not exists flashcards_retired_idx
    on public.flashcards (created_by, retired_at)
    where retired_at is not null;

comment on column public.flashcards.retired_at is
    'When the student marked this card known. Null means it is still in the review queue. Reversible.';
comment on column public.flashcards.snoozed_until is
    'Deferred until this date. Lateness is measured from the later of this and next_review_date, so a deliberate snooze does not read as a lapse.';
