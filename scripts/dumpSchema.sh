#!/usr/bin/env bash
# Regenerate supabase/schema.json — the ground truth dbColumns.test.mjs checks
# server.mjs against.
#
# Every migration is applied to a real Postgres 16 and information_schema is
# read back, rather than the SQL being parsed. A parser would have to follow
# `create table`, `alter table … add column`, `drop column`, renames and the
# drop-and-recreate in 0008 — and a schema checker that is itself wrong about
# the schema is worse than not having one.
#
# RUN THIS WHENEVER A MIGRATION LANDS. The test reads the committed JSON, so a
# stale snapshot means the checker is validating against last month's schema.
#
#   bash scripts/dumpSchema.sh
set -euo pipefail

PORT=${PGPORT:-5499}
DATA=${PGDATA_DIR:-/var/lib/postgresql/schemadump}
export PATH="/usr/lib/postgresql/16/bin:$PATH"

command -v initdb >/dev/null || { echo "postgres 16 not installed"; exit 1; }

rm -rf "$DATA"; mkdir -p "$DATA"; chown postgres:postgres "$DATA"; chmod 700 "$DATA"
su postgres -s /bin/bash -c "PATH=$PATH initdb -D $DATA -U postgres --auth=trust" >/dev/null
su postgres -s /bin/bash -c "PATH=$PATH pg_ctl -D $DATA -o '-p $PORT -k /tmp' -l $DATA/log start" >/dev/null
sleep 3

psql -h /tmp -p "$PORT" -U postgres -q -c "drop database if exists schemadump;" -c "create database schemadump;"

# Supabase supplies the auth schema and these helpers in a real project; the
# RLS policies in the migrations reference them, so a bare Postgres needs them
# stubbed or half the migrations fail on a function that is not ours.
psql -h /tmp -p "$PORT" -U postgres -d schemadump -q <<'SQL'
create extension if not exists pgcrypto;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text);
create or replace function auth.jwt()   returns jsonb language sql stable as $$ select coalesce(current_setting('request.jwt.claims', true)::jsonb, '{}'::jsonb) $$;
create or replace function auth.uid()   returns uuid  language sql stable as $$ select null::uuid $$;
create or replace function auth.email() returns text  language sql stable as $$ select (auth.jwt() ->> 'email') $$;
create or replace function auth.role()  returns text  language sql stable as $$ select 'authenticated'::text $$;
SQL

for f in supabase/migrations/*.sql; do
  psql -h /tmp -p "$PORT" -U postgres -d schemadump -v ON_ERROR_STOP=1 -q -f "$f"
done

psql -h /tmp -p "$PORT" -U postgres -d schemadump -tAc "
select json_object_agg(table_name, cols)
from (
  select table_name, json_agg(column_name order by ordinal_position) as cols
  from information_schema.columns
  where table_schema='public'
  group by table_name
) t;" > /tmp/_schema_raw.json

node -e "
const fs=require('fs');
const raw=JSON.parse(fs.readFileSync('/tmp/_schema_raw.json','utf8'));
const out={};
Object.keys(raw).sort().forEach(t=>out[t]=raw[t].slice().sort());
fs.writeFileSync('supabase/schema.json', JSON.stringify(out,null,1)+'\n');
console.log('wrote supabase/schema.json —', Object.keys(out).length, 'tables');
"

su postgres -s /bin/bash -c "PATH=$PATH pg_ctl -D $DATA stop" >/dev/null
rm -rf "$DATA" /tmp/_schema_raw.json
