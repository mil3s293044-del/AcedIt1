-- ════════════════════════════════════════════════════════════════════════════
-- 0023 — unblock xp_events writes
-- ════════════════════════════════════════════════════════════════════════════
-- Migration 0003 created xp_events with `xp_amount int not null` and no
-- default. Migration 0005 superseded it with `xp_awarded` and backfilled the
-- old column, but never relaxed the constraint — and no code has written
-- xp_amount since. Every insert the server makes has therefore been rejected
-- with a not-null violation.
--
-- It was invisible because supabase-js resolves with `{ data, error }` rather
-- than rejecting, and every call site destructured only `data`. XP still
-- reached user_profiles (that write happens separately and did succeed), so
-- the app looked healthy while its audit log stayed empty.
--
-- What reads xp_events back, and was consequently stuck at zero:
--   · study duel live + final scores   (computeMetricValue)
--   · back-yourself bet progress       (loadMyArenaCore)
--   · the Arena momentum ticker        (getArenaState)
--   · the AcedIt ATAR and its history  (computeAcedItATAR)
--
-- xp_amount is kept rather than dropped: it is the column 0003 shipped, it may
-- be referenced by anything reading the database directly, and server.mjs now
-- writes it in step with xp_awarded via insertXPEvent().

alter table public.xp_events alter column xp_amount drop not null;
alter table public.xp_events alter column xp_amount set default 0;

-- Any rows that predate this and came in through another path.
update public.xp_events
   set xp_amount = coalesce(xp_awarded, 0)
 where xp_amount is null;

-- computeMetricValue and computeAcedItATAR both scan by user + time window.
-- 0003's index is on (created_by, created_date); these read user_email.
create index if not exists xp_events_user_email_date_idx
    on public.xp_events (user_email, created_date desc);
