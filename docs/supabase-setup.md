# Supabase setup (Relationships)

## 1. Create tables

In [Supabase Dashboard](https://supabase.com/dashboard) → **Relationships** → **SQL Editor**, paste and run `supabase/schema.sql`.

If you already ran an older version of the schema, also run:

- `supabase/migrate_password_auth.sql`
- `supabase/migrate_draft_overlay.sql` (splits live `data` into `published_data` + optional `draft_data`)

## 2. Seed puzzles

In **Project Settings → API**, copy the **Secret** key (keep it secret).

```bash
SUPABASE_SERVICE_ROLE_KEY=your_secret_key node scripts/seed_supabase.js
```

## 3. Set your edit password

Run this locally (password is not saved anywhere — only the hash is printed):

```bash
node scripts/hash_admin_password.js
```

Copy the hash into `public/src/supabaseConfig.js` as `ADMIN_PASSWORD_HASH`.

The default hash matches the password `change-me` until you replace it.

## 4. Edit puzzles in the app

1. **Option (⌥) + click ⋮**, or **long-press ⋮** → **Edit** appears
2. Tap **Edit** → enter password → **Continue**
3. Save drafts → **Publish**

Draft edits live in `draft_data` and do not change the live puzzle until you publish. **Exit** discards unsaved in-memory edits and reloads the published version.

## 5. Test draft overlay

After running `supabase/migrate_draft_overlay.sql`:

1. Open a puzzle in play mode and note the title
2. Enter edit mode → change the title → **Save draft**
3. Confirm the picker shows `(draft)` but play content is unchanged if you **Exit** and reload
4. Re-enter edit → confirm your draft title is still there
5. **Publish** → live title updates and `(draft)` clears

Password is required every time you enter edit mode.

## Notes

- The password only hides the edit UI. Puzzle writes are open in the database — fine for a solo side project.
- If Supabase is empty or unreachable, the app falls back to static JSON in `public/puzzles/`.
- Never commit the Secret key.
