# Supabase setup (Relationships)

Puzzles live **only** in Supabase (`published_data` / `draft_data`). The app does not load puzzle JSON files.

The database is a self-hosted Supabase shared with other apps (`https://supabase.erichenry.com`). Relationships’ tables live in their own Postgres schema, `relationships`.

## 1. Create tables

In Studio (`https://supabase.erichenry.com`) → **SQL Editor**, paste and run `supabase/schema.sql`.

Then expose the schema to the API: on the server, add `relationships` to `PGRST_DB_SCHEMAS` in `~/supabase-project/.env` and run `sh run.sh recreate rest`.

## 2. Configure the app

Set `SUPABASE_URL`, the public key (the server’s `ANON_KEY`), and `SUPABASE_SCHEMA` in `public/src/supabaseConfig.js`. `scripts/ingest-puzzles.mjs` reads the same file.

## 3. Set your edit password

Run this locally (password is not saved anywhere — only the hash is printed):

```bash
node scripts/hash_admin_password.js
```

Copy the hash into `public/src/supabaseConfig.js` as `ADMIN_PASSWORD_HASH`.

The default hash matches the password `change-me` until you replace it.

## 4. Add puzzles

Use **Add puzzle** in the app, or insert rows directly in Studio’s Table Editor (`relationships` schema). A `debug` row is optional for the debug puzzle shortcut.

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

Password is required every time you enter edit mode.

## Notes

- The password only hides the edit UI. Puzzle writes are open in the database — fine for a solo side project.
- Supabase must be configured and reachable; there is no offline or static puzzle fallback.
- Never commit the Secret / service role key.
