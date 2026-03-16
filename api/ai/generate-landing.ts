import { GoogleGenAI } from "@google/genai";
import { createClient } from '@supabase/supabase-js';
import { VercelRequest, VercelResponse } from '@vercel/node';
import dotenv from 'dotenv';

dotenv.config();

// Helper per gestire CORS su Vercel
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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, userId } = req.body;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!userId) return res.status(400).json({ error: 'userId mancante' });
  if (!prompt) return res.status(400).json({ error: 'prompt mancante' });
  if (!GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY mancante' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return res.status(500).json({ error: 'Configurazione Supabase mancante' });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 1. Verifica e incrementa i consumi
    let { data: usage, error: fetchError } = await supabase
      .from('user_usage')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (fetchError && fetchError.code === 'PGRST116') {
      const { data: newUsage, error: insertError } = await supabase
        .from('user_usage')
        .insert([{ user_id: userId }])
        .select()
        .single();
      if (insertError) throw insertError;
      usage = newUsage;
    } else if (fetchError) {
      throw fetchError;
    }

    if (usage.generations_this_month >= LIMITS.GENERATIONS_PER_MONTH) {
      throw new Error(`Hai raggiunto il limite di ${LIMITS.GENERATIONS_PER_MONTH} generazioni mensili.`);
    }

    // 2. Generazione con Gemini
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const model = ai.models.generateContent({
      model: "gemini-1.5-flash-latest",
      contents: `Genera il contenuto HTML/Tailwind per una landing page basata su questo prompt: ${prompt}. 
      Rispondi solo con il codice HTML pulito, senza blocchi di codice markdown.`
    });

    const response = await model;

    // 3. Incrementa il contatore
    await supabase
      .from('user_usage')
      .update({ generations_this_month: usage.generations_this_month + 1 })
      .eq('user_id', userId);

    res.json({ content: response.text });
  } catch (err: any) {
    console.error('Errore AI Proxy:', err);
    res.status(403).json({ error: err.message });
  }
};

export default allowCors(handler);
