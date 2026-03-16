import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

let supabaseAdmin: any = null;

function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Configurazione Supabase mancante (SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY)');
    }
    
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  }
  return supabaseAdmin;
}

export const LIMITS = {
  SITES_PER_MONTH: 1,
  GENERATIONS_PER_MONTH: 5
};

export async function checkAndIncrementUsage(userId: string, type: 'site' | 'generation') {
  const admin = getSupabaseAdmin();
  // 1. Recupera o crea il record di consumo
  let { data: usage, error } = await admin
    .from('user_usage')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code === 'PGRST116') {
    // Record non esiste, crealo
    const { data: newUsage, error: createError } = await admin
      .from('user_usage')
      .insert([{ user_id: userId }])
      .select()
      .single();
    
    if (createError) throw createError;
    usage = newUsage;
  } else if (error) {
    throw error;
  }

  // 2. Controlla se è necessario resettare (se è passato un mese)
  const lastReset = new Date(usage.last_reset_date);
  const now = new Date();
  const isNewMonth = now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear();

  if (isNewMonth) {
    const { data: resetUsage, error: resetError } = await admin
      .from('user_usage')
      .update({
        sites_created_this_month: 0,
        generations_this_month: 0,
        last_reset_date: now.toISOString()
      })
      .eq('user_id', userId)
      .select()
      .single();
    
    if (resetError) throw resetError;
    usage = resetUsage;
  }

  // 3. Verifica i limiti
  if (type === 'site') {
    if (usage.sites_created_this_month >= LIMITS.SITES_PER_MONTH) {
      throw new Error(`Limite raggiunto: puoi creare solo ${LIMITS.SITES_PER_MONTH} sito al mese.`);
    }
    // Incrementa
    await admin
      .from('user_usage')
      .update({ sites_created_this_month: usage.sites_created_this_month + 1 })
      .eq('user_id', userId);
  } else {
    if (usage.generations_this_month >= LIMITS.GENERATIONS_PER_MONTH) {
      throw new Error(`Limite raggiunto: puoi generare solo ${LIMITS.GENERATIONS_PER_MONTH} landing page al mese.`);
    }
    // Incrementa
    await admin
      .from('user_usage')
      .update({ generations_this_month: usage.generations_this_month + 1 })
      .eq('user_id', userId);
  }

  return true;
}

export async function getUserUsage(userId: string) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('user_usage')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error && error.code === 'PGRST116') return { sites_created_this_month: 0, generations_this_month: 0 };
  if (error) throw error;
  return data;
}
