# Supabase setup (Relationships)

Puzzles live **only** in Supabase (`published_data` / `draft_data`). The app does not load puzzle JSON files.

## 1. Create tables

In [Supabase Dashboard](https://supabase.com/dashboard) → **SQL Editor**, paste and run `supabase/schema.sql`.

If you already ran an older version of the schema, also run:

- `supabase/migrate_password_auth.sql`
- `supabase/migrate_draft_overlay.sql` (splits live `data` into `published_data` + optional `draft_data`)

## 2. Configure the app

Set `SUPABASE_URL` and the publishable key in `public/src/supabaseConfig.js` (or your deployment env).

## 3. Set your edit password

Run this locally (password is not saved anywhere — only the hash is printed):

```bash
node scripts/hash_admin_password.js
```

Copy the hash into `public/src/supabaseConfig.js` as `ADMIN_PASSWORD_HASH`.

The default hash matches the password `change-me` until you replace it.

## 4. Add puzzles

Use **Add puzzle** in the app, or insert rows directly in the Supabase dashboard. A `debug` row is optional for the debug puzzle shortcut.

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
