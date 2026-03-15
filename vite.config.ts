import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from "@google/genai";
import { createClient } from '@supabase/supabase-js';
import deployHandler from './api/deploy';
import deleteSiteHandler from './api/delete-site';
import manageDomainHandler from './api/manage-domain';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  
  // API Plugin
  const apiPlugin = () => ({
    name: 'api-plugin',
    configureServer(server) {
      const app = express();
      app.use(cors()); // ABILITA CORS
      app.use(express.json());

      // Helper per convertire Vercel handler in Express route
      const wrapVercel = (handler: any) => async (req: any, res: any) => {
        try {
          await handler(req, res);
        } catch (err: any) {
          res.status(500).json({ error: err.message });
        }
      };

      // Lazy AI
      let aiInstance: GoogleGenAI | null = null;
      const getAI = () => {
        if (!aiInstance) {
          const apiKey = env.GEMINI_API_KEY;
          if (!apiKey) throw new Error('GEMINI_API_KEY mancante');
          aiInstance = new GoogleGenAI({ apiKey });
        }
        return aiInstance;
      };

      // Lazy Supabase Admin
      let supabaseAdmin: any = null;
      const getSupabaseAdmin = () => {
        if (!supabaseAdmin) {
          const url = env.VITE_SUPABASE_URL;
          const key = env.SUPABASE_SERVICE_ROLE_KEY;
          if (!url || !key) throw new Error('Configurazione Supabase mancante');
          supabaseAdmin = createClient(url, key);
        }
        return supabaseAdmin;
      };

      const LIMITS = { SITES_PER_MONTH: 1, GENERATIONS_PER_MONTH: 5 };

      app.get('/api/usage/:userId', async (req, res) => {
        try {
          const admin = getSupabaseAdmin();
          const { data, error } = await admin.from('user_usage').select('*').eq('user_id', req.params.userId).single();
          if (error && error.code === 'PGRST116') return res.json({ usage: { sites_created_this_month: 0, generations_this_month: 0 }, limits: LIMITS });
          if (error) throw error;
          res.json({ usage: data, limits: LIMITS });
        } catch (err: any) {
          res.status(500).json({ error: err.message });
        }
      });

      app.post('/api/deploy', async (req, res) => {
        try {
          const { ownerId } = req.body;
          if (!ownerId) return res.status(400).json({ error: 'ownerId mancante' });
          const admin = getSupabaseAdmin();
          let { data: usage } = await admin.from('user_usage').select('*').eq('user_id', ownerId).single();
          if (!usage) {
            const { data: newUsage } = await admin.from('user_usage').insert([{ user_id: ownerId }]).select().single();
            usage = newUsage;
          }
          if (usage.sites_created_this_month >= LIMITS.SITES_PER_MONTH) {
            return res.status(403).json({ error: `Limite raggiunto: ${LIMITS.SITES_PER_MONTH} sito al mese.` });
          }
          await deployHandler(req as any, res as any);
          await admin.from('user_usage').update({ sites_created_this_month: usage.sites_created_this_month + 1 }).eq('user_id', ownerId);
        } catch (err: any) {
          res.status(500).json({ error: err.message });
        }
      });

      app.delete('/api/delete-site', wrapVercel(deleteSiteHandler));
      app.post('/api/manage-domain', wrapVercel(manageDomainHandler));
      app.delete('/api/manage-domain', wrapVercel(manageDomainHandler));

      app.post('/api/ai/generate-landing', async (req, res) => {
        const { prompt, userId } = req.body;
        if (!userId || !prompt) return res.status(400).json({ error: 'Dati mancanti' });

        try {
          const admin = getSupabaseAdmin();
          // 1. Check/Increment usage
          let { data: usage, error } = await admin.from('user_usage').select('*').eq('user_id', userId).single();
          if (error && error.code === 'PGRST116') {
             const { data: newUsage, error: createError } = await admin.from('user_usage').insert([{ user_id: userId }]).select().single();
             if (createError) throw createError;
             usage = newUsage;
          } else if (error) throw error;

          if (usage.generations_this_month >= LIMITS.GENERATIONS_PER_MONTH) {
            return res.status(403).json({ error: `Limite raggiunto: ${LIMITS.GENERATIONS_PER_MONTH} generazioni/mese.` });
          }

          // 2. Generate
          const ai = getAI();
          const model = ai.models.generateContent({
            model: "gemini-1.5-flash-latest",
            contents: `Genera il contenuto HTML/Tailwind per una landing page basata su questo prompt: ${prompt}. Rispondi solo con il codice HTML pulito.`
          });
          const response = await model;

          // 3. Increment
          await admin.from('user_usage').update({ generations_this_month: usage.generations_this_month + 1 }).eq('user_id', userId);

          res.json({ content: response.text });
        } catch (err: any) {
          res.status(500).json({ error: err.message });
        }
      });

      server.middlewares.use(app);
    }
  });

  return {
    plugins: [react(), tailwindcss(), apiPlugin()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
