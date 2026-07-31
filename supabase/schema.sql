-- Run once in Supabase Dashboard → SQL Editor (Relationships project).

create table if not exists app_config (
  key text primary key,
  value text not null
);

create table if not exists puzzles (
  id text primary key,
  num integer not null default 0,
  title text not null,
  published_data jsonb not null,
  draft_data jsonb,
  draft_updated_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists puzzles_num_idx on puzzles (num);

alter table app_config enable row level security;

drop policy if exists "read app config" on app_config;
create policy "read app config"
  on app_config for select
  to anon, authenticated
  using (key = 'default_puzzle_id');

alter table puzzles enable row level security;

drop policy if exists "public read published puzzles" on puzzles;
drop policy if exists "admin read all puzzles" on puzzles;
drop policy if exists "read all puzzles" on puzzles;
create policy "read all puzzles"
  on puzzles for select
  to anon, authenticated
  using (true);

drop policy if exists "admin insert puzzles" on puzzles;
drop policy if exists "insert puzzles" on puzzles;
create policy "insert puzzles"
  on puzzles for insert
  to anon, authenticated
  with check (true);

drop policy if exists "admin update puzzles" on puzzles;
drop policy if exists "update puzzles" on puzzles;
create policy "update puzzles"
  on puzzles for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "admin delete puzzles" on puzzles;
drop policy if exists "delete puzzles" on puzzles;
create policy "delete puzzles"
  on puzzles for delete
  to anon, authenticated
  using (true);
