# Supabase setup (Relationships)

Puzzles live **only** in Supabase (`published_data` / `draft_data`). The app does not load puzzle JSON files.

The database is a self-hosted Supabase shared with other apps (`https://supabase.erichenry.com`). Relationships’ tables live in their own Postgres schema, `relationships`.

## 1. Create tables

In Studio (`https://supabase.erichenry.com`) → **SQL Editor**, paste and run `supabase/schema.sql`.

Then expose the schema to the API: on the server, add `relationships` to `PGRST_DB_SCHEMAS` in `~/supabase-project/.env` and run `sh run.sh recreate rest`.

## 2. Configure the app

Set `SUPABASE_URL`, the public key (the server’s `ANON_KEY`), and `SUPABASE_SCHEMA` in `public/src/supabaseConfig.js`. `scripts/ingest-puzzles.mjs` reads the same file.

## 3. Set your edit password

In Studio → **SQL Editor**, run (with your password in place of `<password>`):

```sql
insert into relationships.editor_secret (password_hash)
values (extensions.crypt('<password>', extensions.gen_salt('bf', 10)))
on conflict (id) do update set password_hash = excluded.password_hash;
```

Then delete that query from the SQL Editor’s list (Studio autosaves queries). Run it again any time to change the password. Only a bcrypt hash is stored, and the public key can’t read it.

## 4. Add puzzles

Use **Add puzzle** in the app, or `scripts/ingest-puzzles.mjs` for a bulk import (needs `SUPABASE_SECRET_KEY`; see the script). A `debug` row is optional for the debug puzzle shortcut.

## 5. Edit puzzles in the app

1. **Option (⌥) + click ⋮**, or **long-press ⋮** → **Edit** appears
2. Tap **Edit** → enter password → **Continue**
3. Save drafts → **Publish**

Draft edits live in `draft_data` and do not change the live puzzle until you publish. **Exit** discards unsaved in-memory edits and reloads the published version.

## 6. Test draft overlay

1. Open a puzzle in play mode and note the title
2. Enter edit mode → change the title → **Save draft**
3. Confirm play content is unchanged if you **Exit** and reload
4. Re-enter edit → confirm your draft title is still there
5. **Publish** → live title updates

Password is required every time you enter edit mode. On `localhost` the prompt accepts anything so the edit UI opens, but saving still needs the real password.

## Notes

- Anyone can read puzzles. Writes only go through password-checked database functions (`supabase/schema.sql`); the public key can’t insert, update or delete rows directly.
- Supabase must be configured and reachable; there is no offline or static puzzle fallback.
- Never commit the Secret / service role key.
