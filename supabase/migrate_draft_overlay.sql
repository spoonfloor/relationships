-- Run in Supabase Dashboard → SQL Editor if you already have the old puzzles table.
-- Migrates single `data` + `status` rows to published_data / draft_data overlay.

drop policy if exists "public read published puzzles" on puzzles;
drop policy if exists "admin read all puzzles" on puzzles;

alter table puzzles add column if not exists published_data jsonb;
alter table puzzles add column if not exists draft_data jsonb;
alter table puzzles add column if not exists draft_updated_at timestamptz;

-- Existing live content becomes published; nothing starts as a pending draft.
update puzzles
set published_data = coalesce(published_data, data)
where data is not null;

alter table puzzles drop column if exists data;
alter table puzzles drop column if exists status;

drop index if exists puzzles_status_num_idx;
create index if not exists puzzles_num_idx on puzzles (num);

-- Fail loudly if any row is missing published content.
alter table puzzles alter column published_data set not null;
