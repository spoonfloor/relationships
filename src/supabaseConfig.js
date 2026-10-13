export const SUPABASE_URL = "https://supabase.erichenry.com";
export const SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzkxOTIzODY5LCJleHAiOjE5NDk2MDM4Njl9.87Xo4_FIO0nWLtih6vtQnfQkrDLmv3otH5oURlduPMg";
/** Postgres schema holding this app's tables on the shared self-hosted Supabase. */
export const SUPABASE_SCHEMA = "relationships";

/** SHA-256 hash of your editing password. Generate with: node scripts/hash_admin_password.js */
export const ADMIN_PASSWORD_HASH =
  "89d19d63941a517f4921ec8496fbf07c4b444537352cc585461a1b4de469fde5";

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
}
