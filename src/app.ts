import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';
import { checkAndIncrementUsage, getUserUsage, LIMITS } from './lib/usage';

// Import handlers from /api
import deployHandler from '../api/deploy';
import deleteSiteHandler from '../api/delete-site';
import manageDomainHandler from '../api/manage-domain';

dotenv.config();

const app = express();

// Lazy AI
let aiInstance: GoogleGenAI | null = null;
function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY mancante');
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Helper per convertire Vercel handler in Express route
const wrapVercel = (handler: any) => async (req: any, res: any) => {
  try {
    await handler(req, res);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// Rotte API esistenti (adattate)
app.post('/api/deploy', async (req, res) => {
  try {
    const { ownerId } = req.body;
    if (!ownerId) return res.status(400).json({ error: 'ownerId mancante' });
    
    // Verifica limiti
    await checkAndIncrementUsage(ownerId, 'site');
    
    // Procedi col deploy
    await deployHandler(req as any, res as any);
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

app.delete('/api/delete-site', wrapVercel(deleteSiteHandler));
app.post('/api/manage-domain', wrapVercel(manageDomainHandler));
app.delete('/api/manage-domain', wrapVercel(manageDomainHandler));

// Nuova rotta per generazione AI con monitoraggio
app.post('/api/ai/generate-landing', async (req, res) => {
  const { prompt, userId } = req.body;
  
  if (!userId) return res.status(400).json({ error: 'userId mancante' });
  if (!prompt) return res.status(400).json({ error: 'prompt mancante' });

  try {
    // Verifica limiti
    await checkAndIncrementUsage(userId, 'generation');

    // Generazione con Gemini
    const ai = getAI();
    const model = ai.models.generateContent({
      model: "gemini-1.5-flash-latest",
      contents: `Genera il contenuto HTML/Tailwind per una landing page basata su questo prompt: ${prompt}. 
      Rispondi solo con il codice HTML pulito, senza blocchi di codice markdown.`
    });

    const response = await model;
    res.json({ content: response.text });
  } catch (err: any) {
    console.error('Errore AI:', err);
    res.status(403).json({ error: err.message });
  }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Rotta per recuperare i consumi correnti
app.get('/api/usage/:userId', async (req, res) => {
  try {
    const usage = await getUserUsage(req.params.userId);
    res.json({ usage, limits: LIMITS });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default app;
