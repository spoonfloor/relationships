-- Run in SQL Editor if you already ran the older schema with magic-link admin setup.

drop function if exists is_puzzle_admin();

drop policy if exists "public read published puzzles" on puzzles;
drop policy if exists "admin read all puzzles" on puzzles;
drop policy if exists "admin insert puzzles" on puzzles;
drop policy if exists "admin update puzzles" on puzzles;
drop policy if exists "admin delete puzzles" on puzzles;
drop policy if exists "read admin user id" on app_config;

drop policy if exists "read app config" on app_config;
create policy "read app config"
  on app_config for select
  to anon, authenticated
  using (key = 'default_puzzle_id');

create policy "read all puzzles"
  on puzzles for select
  to anon, authenticated
  using (true);

create policy "insert puzzles"
  on puzzles for insert
  to anon, authenticated
  with check (true);

create policy "update puzzles"
  on puzzles for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "delete puzzles"
  on puzzles for delete
  to anon, authenticated
  using (true);
