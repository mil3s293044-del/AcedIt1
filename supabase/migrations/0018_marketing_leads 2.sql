-- 0018_marketing_leads.sql
-- Top-of-funnel email capture for the marketing campaign. Anonymous landing
-- visitors who aren't ready to start a trial drop their email for a lead
-- magnet (e.g. the free VCE study roadmap). Rows are written server-side via
-- the service_role key in server.mjs (captureLead), so no public RLS policies
-- are needed — RLS is ON with no policies, which denies all anon/auth access.

create table if not exists public.marketing_leads (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  source      text,                       -- where they signed up, e.g. 'landing_roadmap'
  pillar      text,                       -- campaign pillar that drove them, e.g. 'feedback'
  lead_magnet text,                       -- which magnet was promised
  utm         jsonb not null default '{}'::jsonb,  -- utm_source/medium/campaign/content/term
  status      text not null default 'new',         -- new | nurturing | converted | unsubscribed
  emailed_at  timestamptz,                -- when the lead-magnet email was sent
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- One row per email; re-submission refreshes attribution (see captureLead
-- upsert). Plain-column unique index (not lower(email)) so `ON CONFLICT (email)`
-- matches it — captureLead always stores the email lowercased, so this still
-- gives case-insensitive dedup.
create unique index if not exists marketing_leads_email_key
  on public.marketing_leads (email);

create index if not exists marketing_leads_created_at_idx
  on public.marketing_leads (created_at desc);

create index if not exists marketing_leads_pillar_idx
  on public.marketing_leads (pillar);

alter table public.marketing_leads enable row level security;
-- Intentionally no policies: only the server's service_role (which bypasses
-- RLS) may read or write this table.
