-- Run in Studio → SQL Editor on the self-hosted Supabase (https://supabase.erichenry.com).
-- Safe to re-run. Then add `relationships` to PGRST_DB_SCHEMAS in ~/supabase-project/.env
-- and run `sh run.sh recreate rest` so the API exposes this schema.
--
-- Access model: anyone can read puzzles. Writes only go through the security definer
-- functions below, which check the editing password against a bcrypt hash that the
-- public key cannot read. Set or change the password with:
--   insert into relationships.editor_secret (password_hash)
--   values (extensions.crypt('<password>', extensions.gen_salt('bf', 10)))
--   on conflict (id) do update set password_hash = excluded.password_hash;
-- (Delete that query from Studio afterward; Studio autosaves queries.)

create extension if not exists pgcrypto with schema extensions;

create schema if not exists relationships;
grant usage on schema relationships to anon, authenticated, service_role;

-- Puzzles ------------------------------------------------------------------

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

revoke insert, update, delete on relationships.puzzles from anon, authenticated;
grant select on relationships.puzzles to anon, authenticated;
grant all on relationships.puzzles to service_role;

alter table relationships.puzzles enable row level security;

drop policy if exists "read all puzzles" on relationships.puzzles;
create policy "read all puzzles" on relationships.puzzles
  for select to anon, authenticated using (true);

drop policy if exists "insert puzzles" on relationships.puzzles;
drop policy if exists "update puzzles" on relationships.puzzles;
drop policy if exists "delete puzzles" on relationships.puzzles;

-- Editing password (single row, never readable through the API) --------------

create table if not exists relationships.editor_secret (
  id boolean primary key default true check (id),
  password_hash text not null
);
revoke all on relationships.editor_secret from anon, authenticated;
alter table relationships.editor_secret enable row level security;

create or replace function relationships.assert_editor(p_password text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_password is null or not exists (
    select 1
    from relationships.editor_secret s
    where s.password_hash = extensions.crypt(p_password, s.password_hash)
  ) then
    raise exception 'Wrong editing password' using errcode = '28P01';
  end if;
end;
$$;

create or replace function relationships.verify_edit_password(p_password text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform relationships.assert_editor(p_password);
  return true;
exception
  when invalid_password then
    return false;
end;
$$;

-- Write functions (one per repository write) ---------------------------------

create or replace function relationships.create_puzzle(
  p_password text,
  p_id text,
  p_num integer,
  p_title text,
  p_published_data jsonb,
  p_draft_data jsonb
)
returns relationships.puzzles
language plpgsql
security definer
set search_path = ''
as $$
declare
  result relationships.puzzles;
begin
  perform relationships.assert_editor(p_password);
  insert into relationships.puzzles
    (id, num, title, published_data, draft_data, draft_updated_at, updated_at)
  values (
    p_id, p_num, p_title, p_published_data, p_draft_data,
    case when p_draft_data is null then null else now() end,
    now()
  )
  returning * into result;
  return result;
end;
$$;

create or replace function relationships.save_puzzle_draft(
  p_password text,
  p_id text,
  p_draft_data jsonb
)
returns relationships.puzzles
language plpgsql
security definer
set search_path = ''
as $$
declare
  result relationships.puzzles;
begin
  perform relationships.assert_editor(p_password);
  update relationships.puzzles
  set draft_data = p_draft_data, draft_updated_at = now(), updated_at = now()
  where id = p_id
  returning * into result;
  if not found then
    raise exception 'Puzzle "%" not found', p_id;
  end if;
  return result;
end;
$$;

create or replace function relationships.publish_puzzle(
  p_password text,
  p_id text,
  p_published_data jsonb
)
returns relationships.puzzles
language plpgsql
security definer
set search_path = ''
as $$
declare
  result relationships.puzzles;
begin
  perform relationships.assert_editor(p_password);
  update relationships.puzzles
  set published_data = p_published_data,
      title = p_published_data->>'title',
      draft_data = null,
      draft_updated_at = null,
      updated_at = now()
  where id = p_id
  returning * into result;
  if not found then
    raise exception 'Puzzle "%" not found', p_id;
  end if;
  return result;
end;
$$;

create or replace function relationships.promote_puzzle_draft(
  p_password text,
  p_id text
)
returns relationships.puzzles
language plpgsql
security definer
set search_path = ''
as $$
declare
  result relationships.puzzles;
begin
  perform relationships.assert_editor(p_password);
  update relationships.puzzles
  set published_data = coalesce(draft_data, published_data),
      title = coalesce(coalesce(draft_data, published_data)->>'title', title),
      draft_data = null,
      draft_updated_at = null,
      updated_at = now()
  where id = p_id
  returning * into result;
  if not found then
    raise exception 'Puzzle "%" not found', p_id;
  end if;
  return result;
end;
$$;

create or replace function relationships.clear_puzzle_draft(
  p_password text,
  p_id text
)
returns relationships.puzzles
language plpgsql
security definer
set search_path = ''
as $$
declare
  result relationships.puzzles;
begin
  perform relationships.assert_editor(p_password);
  update relationships.puzzles
  set draft_data = null, draft_updated_at = null, updated_at = now()
  where id = p_id
  returning * into result;
  if not found then
    raise exception 'Puzzle "%" not found', p_id;
  end if;
  return result;
end;
$$;

create or replace function relationships.delete_puzzle(
  p_password text,
  p_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform relationships.assert_editor(p_password);
  delete from relationships.puzzles where id = p_id;
end;
$$;

-- Only the API-facing functions are callable with the public key (not assert_editor).
revoke execute on all functions in schema relationships from public, anon, authenticated;
grant execute on function
  relationships.verify_edit_password(text),
  relationships.create_puzzle(text, text, integer, text, jsonb, jsonb),
  relationships.save_puzzle_draft(text, text, jsonb),
  relationships.publish_puzzle(text, text, jsonb),
  relationships.promote_puzzle_draft(text, text),
  relationships.clear_puzzle_draft(text, text),
  relationships.delete_puzzle(text, text)
to anon, authenticated, service_role;
