import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://lygoswawqplklqvnouao.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let supabaseInstance: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('[Supabase] Client initialized with Cloud API.');
  } catch (err) {
    console.warn('[Supabase] Init notice:', err);
  }
}

export const supabase = supabaseInstance;
export const isSupabaseConfigured = () => Boolean(supabaseInstance);
