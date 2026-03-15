import { createClient } from '@supabase/supabase-js';

// @ts-ignore
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
// @ts-ignore
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Mancano le chiavi di Supabase! Controlla i Secrets della piattaforma.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
