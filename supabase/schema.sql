-- Run once in Studio → SQL Editor on the self-hosted Supabase (https://supabase.erichenry.com).
-- Then add `relationships` to PGRST_DB_SCHEMAS in ~/supabase-project/.env and run
-- `sh run.sh recreate rest` so the API exposes this schema.

create schema if not exists relationships;
grant usage on schema relationships to anon, authenticated, service_role;

create table if not exists relationships.puzzles (
  id text primary key,
  num integer not null default 0,
  title text not null,
  published_data jsonb not null,
  draft_data jsonb,
  draft_updated_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists puzzles_num_idx on relationships.puzzles (num);

grant select, insert, update, delete on relationships.puzzles to anon, authenticated;
grant all on relationships.puzzles to service_role;

alter table relationships.puzzles enable row level security;

drop policy if exists "read all puzzles" on relationships.puzzles;
create policy "read all puzzles" on relationships.puzzles
  for select to anon, authenticated using (true);

drop policy if exists "insert puzzles" on relationships.puzzles;
create policy "insert puzzles" on relationships.puzzles
  for insert to anon, authenticated with check (true);

drop policy if exists "update puzzles" on relationships.puzzles;
create policy "update puzzles" on relationships.puzzles
  for update to anon, authenticated using (true) with check (true);

drop policy if exists "delete puzzles" on relationships.puzzles;
create policy "delete puzzles" on relationships.puzzles
  for delete to anon, authenticated using (true);
