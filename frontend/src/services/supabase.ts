import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_URL_KEY = 'skh_supabase_url';
const STORAGE_ANON_KEY = 'skh_supabase_anon_key';

export function getSavedSupabaseUrl(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_URL_KEY);
    if (saved) return saved.trim();
  }
  return (import.meta.env.VITE_SUPABASE_URL || 'https://lygoswawqplklqvnouao.supabase.co').trim();
}

export function getSavedSupabaseAnonKey(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_ANON_KEY);
    if (saved) return saved.trim();
  }
  return (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
}

let supabaseInstance: SupabaseClient | null = null;

export function initSupabase(url?: string, anonKey?: string): SupabaseClient | null {
  const targetUrl = (url || getSavedSupabaseUrl()).trim();
  const targetKey = (anonKey || getSavedSupabaseAnonKey()).trim();

  if (!targetUrl || !targetKey) {
    console.warn('[Supabase] ⚠️ Supabase Anon Key belum diatur. Menunggu konfigurasi API Key.');
    supabaseInstance = null;
    return null;
  }

  try {
    supabaseInstance = createClient(targetUrl, targetKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    console.log('[Supabase] ✅ Supabase Client berhasil diinisialisasi untuk URL:', targetUrl);
    return supabaseInstance;
  } catch (err) {
    console.error('[Supabase] ❌ Gagal inisialisasi Supabase client:', err);
    supabaseInstance = null;
    return null;
  }
}

// Initial instance creation
initSupabase();

export function setSupabaseCredentials(url: string, anonKey: string): boolean {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_URL_KEY, url.trim());
    localStorage.setItem(STORAGE_ANON_KEY, anonKey.trim());
  }
  const client = initSupabase(url, anonKey);
  return Boolean(client);
}

export const getSupabase = (): SupabaseClient | null => {
  if (!supabaseInstance) {
    initSupabase();
  }
  return supabaseInstance;
};

export const isSupabaseConfigured = (): boolean => {
  const key = getSavedSupabaseAnonKey();
  return Boolean(key && key.length > 20);
};

export const supabase = {
  get client(): SupabaseClient | null {
    return getSupabase();
  },
  from(table: string) {
    const client = getSupabase();
    if (!client) {
      throw new Error('Supabase client belum terhubung. Harap masukkan Supabase Anon Key di Pengaturan Database.');
    }
    return client.from(table);
  },
};
