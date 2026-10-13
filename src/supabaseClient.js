import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  isSupabaseConfigured,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SCHEMA,
  SUPABASE_URL,
} from "./supabaseConfig.js";

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let client = null;

export function getSupabase() {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      db: { schema: SUPABASE_SCHEMA },
    });
  }
  return client;
}
