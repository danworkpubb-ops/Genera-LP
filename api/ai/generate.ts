import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';
import { VercelRequest, VercelResponse } from '@vercel/node';

dotenv.config();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, siteId } = req.body;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY non configurata sul server SaaS' });
  }

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt mancante' });
  }

  try {
    console.log(`Richiesta AI ricevuta da sito: ${siteId || 'Sconosciuto'}`);
    
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    const text = response.text;

    res.json({ text });
  } catch (error: any) {
    console.error('Errore Gemini Proxy:', error);
    res.status(500).json({ error: 'Errore durante la generazione AI: ' + error.message });
  }
}
