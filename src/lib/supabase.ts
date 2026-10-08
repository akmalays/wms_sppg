import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://fqsqtxtmdcajcnhpcwgw.supabase.co';

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxc3F0eHRtZGNhamNuaHBjd2d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5NzA0ODUsImV4cCI6MjEwNTU0NjQ4NX0.LODDoF05rj8JD7CYNJL9AOLusDOf29rMTPg_srMUg1g';

/**
 * Checks if live Supabase credentials are configured in .env
 */
export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl !== 'https://your-project.supabase.co' &&
    supabaseAnonKey !== 'your-anon-key'
  );
};

/**
 * Safe Supabase client instance.
 * If credentials are missing, creates a dummy/mock client so app bootstrap never crashes.
 */
export const supabase: SupabaseClient = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : createClient('https://placeholder.supabase.co', 'placeholder-key', {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

export default supabase;
