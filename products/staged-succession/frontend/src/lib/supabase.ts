import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** True when both Supabase env vars are actually set. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Supabase is optional at boot: `createClient` throws synchronously on an
 * empty URL, which used to crash the whole app before React ever rendered
 * (a blank screen with no chance to show even the login page). When not
 * configured, this stays `null` at runtime instead.
 *
 * Typed as non-null because most call sites (api.ts, ChatPage.tsx) assume
 * Supabase is configured and are unaffected by this change — they're only
 * reached after a signed-in user exists, which requires `isSupabaseConfigured`
 * to be true in the first place (see AuthContext.tsx, the only place that
 * checks it). This keeps today's fix scoped to "the app can boot without
 * Supabase" without touching how any Supabase-backed feature works.
 */
export const supabase = (
  isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null
) as SupabaseClient;
