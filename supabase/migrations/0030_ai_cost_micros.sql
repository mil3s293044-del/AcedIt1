-- ════════════════════════════════════════════════════════════════════════════
-- Migration 0030 — track AI spend in micro-dollars instead of whole cents.
--
-- THE CEILING WAS LEAKING. Spend was stored as an integer number of cents and
-- every estimate ended in round(dollars * 100). A typical Ace chat turn costs
-- about $0.0007, which is 0.07 of a cent, which rounds to zero. So Ace turns
-- added nothing at all to the weekly ceiling and the only thing bounding the
-- feature was its daily message counter. Cached Claude calls had the same
-- problem from the other direction (see 0030's companion fix in aiCost.js).
--
-- A micro-dollar is one millionth of a dollar. The cheapest call we can make
-- still registers in the hundreds, so nothing rounds away.
--
--   weekly_ai_cost_micros    premium rolling weekly spend; ceiling 1,950,000
--                            (= $1.95 USD, about $3.00 AUD)
--   lifetime_ai_cost_micros  free-tier lifetime spend; ceiling 1,000,000 ($1.00)
--
-- The cents columns are LEFT IN PLACE and still written by the server, exactly
-- as migration 0011 left the monthly_* columns alone when it moved to weekly.
-- A deploy that rolls back to the previous server keeps a working (if coarse)
-- ceiling rather than an unbounded one.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.user_profiles
  add column if not exists weekly_ai_cost_micros   bigint not null default 0,
  add column if not exists lifetime_ai_cost_micros bigint not null default 0;

-- Backfill from the coarse columns so nobody's accrued spend resets to zero on
-- deploy. This understates real historical spend, because the cents figure was
-- itself missing every sub-half-cent call, but it never overstates it.
update public.user_profiles
   set weekly_ai_cost_micros   = coalesce(weekly_ai_cost_cents, 0)   * 10000,
       lifetime_ai_cost_micros = coalesce(lifetime_ai_cost_cents, 0) * 10000
 where weekly_ai_cost_micros = 0
   and lifetime_ai_cost_micros = 0;

-- Mirrors the index 0014 added for the free-tier ceiling; the gate reads this
-- column on every AI request from a free user.
create index if not exists user_profiles_lifetime_micros_idx
    on public.user_profiles (lifetime_ai_cost_micros);

comment on column public.user_profiles.weekly_ai_cost_micros   is 'Premium rolling weekly AI spend in micro-dollars (1e-6 USD). Ceiling 1950000 = $1.95 USD.';
comment on column public.user_profiles.lifetime_ai_cost_micros is 'Free-tier lifetime AI spend in micro-dollars (1e-6 USD). Ceiling 1000000 = $1.00 USD.';
