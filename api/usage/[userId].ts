import { createClient } from '@supabase/supabase-js';
import { VercelRequest, VercelResponse } from '@vercel/node';
import dotenv from 'dotenv';

dotenv.config();

const allowCors = (fn: any) => async (req: VercelRequest, res: VercelResponse) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  return await fn(req, res);
};

const LIMITS = { SITES_PER_MONTH: 1, GENERATIONS_PER_MONTH: 5 };

const handler = async (req: VercelRequest, res: VercelResponse) => {
  const { userId } = req.query;
  const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL)?.trim();
  const SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)?.trim();

  if (!userId) return res.status(400).json({ error: 'userId mancante' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return res.status(500).json({ error: 'Configurazione Supabase mancante (SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY)' });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    let { data: usage, error } = await supabase
      .from('user_usage')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code === 'PGRST116') {
      const { data: newUsage, error: createError } = await supabase
        .from('user_usage')
        .insert([{ user_id: userId }])
        .select()
        .single();
      if (createError) throw createError;
      usage = newUsage;
    } else if (error) {
      throw error;
    }

    res.json({ usage, limits: LIMITS });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export default allowCors(handler);
