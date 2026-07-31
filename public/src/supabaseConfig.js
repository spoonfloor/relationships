export const SUPABASE_URL = "https://luwnxayrthtyxgxdidtf.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_aCema0LZQvoWiXViaU0o2g_zggnBjoY";

/** SHA-256 hash of your editing password. Generate with: node scripts/hash_admin_password.js */
export const ADMIN_PASSWORD_HASH =
  "89d19d63941a517f4921ec8496fbf07c4b444537352cc585461a1b4de469fde5";

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
}
