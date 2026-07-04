-- 0019_fix_marketing_leads_unique.sql
-- Fix for 0018: the unique index was created on lower(email) (an expression),
-- but captureLead upserts with ON CONFLICT (email), which needs a unique index
-- on the plain `email` column. Without a match, every upsert failed and no lead
-- was ever stored. Swap the expression index for a plain-column one. Safe to run
-- on a table that already exists; captureLead always lowercases before insert.

drop index if exists public.marketing_leads_email_key;

create unique index if not exists marketing_leads_email_key
  on public.marketing_leads (email);
