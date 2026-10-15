-- ─── 0041: premium codes (the Year 10 program) ──────────────────────────────
--
-- A student types their name and a code on /Subscription and gets Premium for
-- `days` days — no card, no Stripe. src/lib/premiumCodes.js holds the rules;
-- `redeemPremiumCode` in server.mjs is the only writer of redemptions.
--
-- HOW TO MANAGE IT (Supabase → Table Editor):
--   • Who has redeemed:  premium_code_redemptions (full_name, user_email, premium_until)
--   • Block somebody:    set revoked_at = now() on their row. Premium ends at
--                        once, and that account can never redeem a code again.
--   • Stop a code:       premium_codes → active = false (existing redemptions keep running)
--   • Extend somebody:   edit premium_until on their row.
--   • New code:          insert into premium_codes (code, label, days, max_redemptions)
--                        values ('NEWCODE', 'What it is for', 21, 100);
--
-- Safe to run twice.

-- ─── The codes ───────────────────────────────────────────────────────────────
create table if not exists public.premium_codes (
    code            text primary key check (code = upper(code) and length(code) between 3 and 40),
    label           text not null default '',
    days            int  not null default 21 check (days between 1 and 365),
    max_redemptions int,
    active          boolean not null default true,
    expires_at      timestamptz,
    created_at      timestamptz not null default now()
);

-- ─── Who redeemed what ───────────────────────────────────────────────────────
create table if not exists public.premium_code_redemptions (
    id              uuid primary key default gen_random_uuid(),
    code            text not null references public.premium_codes (code) on update cascade,
    user_email      text not null,
    full_name       text not null,
    redeemed_at     timestamptz not null default now(),
    premium_until   timestamptz not null,
    revoked_at      timestamptz,
    revoked_reason  text,
    unique (code, user_email)
);

create index if not exists premium_code_redemptions_email_idx
    on public.premium_code_redemptions (lower(user_email));

-- Server (service role) only. RLS on with no policies means a student's own
-- client cannot read the list of names or write a redemption for itself.
alter table public.premium_codes enable row level security;
alter table public.premium_code_redemptions enable row level security;

-- ─── The derived column the app reads ────────────────────────────────────────
alter table public.user_profiles
    add column if not exists code_premium_until timestamptz;

comment on column public.user_profiles.code_premium_until is
    'Premium from a code, until this time. DERIVED by trigger from premium_code_redemptions — edit the redemption, not this.';

-- Keeps code_premium_until equal to the latest unrevoked redemption, so a
-- revoke or an extension in the table editor reaches the app with no other step.
create or replace function public.sync_code_premium()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    if tg_op in ('UPDATE', 'DELETE') then
        update public.user_profiles
           set code_premium_until = (
                select max(r.premium_until)
                  from public.premium_code_redemptions r
                 where lower(r.user_email) = lower(old.user_email)
                   and r.revoked_at is null)
         where lower(created_by) = lower(old.user_email);
    end if;
    if tg_op in ('INSERT', 'UPDATE') then
        update public.user_profiles
           set code_premium_until = (
                select max(r.premium_until)
                  from public.premium_code_redemptions r
                 where lower(r.user_email) = lower(new.user_email)
                   and r.revoked_at is null)
         where lower(created_by) = lower(new.user_email);
    end if;
    return null;
end;
$$;

drop trigger if exists premium_code_redemptions_sync on public.premium_code_redemptions;
create trigger premium_code_redemptions_sync
    after insert or update or delete on public.premium_code_redemptions
    for each row execute function public.sync_code_premium();

-- A student's own client may update its own profile row (RLS allows it), so
-- without this anybody could write themselves a year of Premium from the
-- browser console. Requests carrying a signed-in student's JWT keep the old
-- value; the server (service role), the trigger above and the SQL editor pass.
create or replace function public.guard_code_premium_until()
returns trigger language plpgsql as $$
begin
    if (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role') in ('authenticated', 'anon') then
        if tg_op = 'INSERT' then
            new.code_premium_until := null;
        else
            new.code_premium_until := old.code_premium_until;
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists user_profiles_guard_code_premium on public.user_profiles;
create trigger user_profiles_guard_code_premium
    before insert or update on public.user_profiles
    for each row execute function public.guard_code_premium_until();

-- ─── A readable list for the table editor ────────────────────────────────────
-- security_invoker, so the API sees it through the tables' RLS (no rows for a
-- student) while the dashboard sees everything.
create or replace view public.premium_code_report with (security_invoker = true) as
select r.full_name,
       r.user_email,
       r.code,
       r.redeemed_at,
       r.premium_until,
       case
           when r.revoked_at is not null then 'blocked'
           when r.premium_until > now()  then 'active'
           else 'ended'
       end as status,
       r.revoked_reason,
       r.id as redemption_id
  from public.premium_code_redemptions r
 order by r.redeemed_at desc;

revoke all on public.premium_code_report from anon, authenticated;

-- ─── The Year 10 code ────────────────────────────────────────────────────────
-- Change the code or the limit here before running if you like. 21 days each,
-- at most 200 students, no end date on the code itself.
insert into public.premium_codes (code, label, days, max_redemptions)
values ('YEAR10ACE', 'Year 10 program', 21, 200)
on conflict (code) do nothing;
