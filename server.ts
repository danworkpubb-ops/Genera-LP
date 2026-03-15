import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.options('*', cors());
  app.use(express.json());

  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  // API Route per creare il progetto su Vercel
  app.post(['/api/deploy', '/api/deploy/'], async (req, res) => {
    const { siteName, siteId, adminUser, adminPassword, ownerId } = req.body;
    const VERCEL_TOKEN = process.env.VERCEL_TOKEN?.trim();
    const DEFAULT_REPO = process.env.GITHUB_REPO?.trim();
    const TEAM_ID = process.env.VERCEL_TEAM_ID?.trim();
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL?.trim();
    const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY?.trim();
    const APP_URL = process.env.APP_URL || `https://${req.get('host')}`;

    if (!VERCEL_TOKEN) {
      return res.status(500).json({ error: 'VERCEL_TOKEN non configurato sul server' });
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return res.status(500).json({ error: 'Le variabili Supabase (VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY) non sono configurate sul server. Aggiungile nei Secret di AI Studio.' });
    }

    const rawRepoPath = DEFAULT_REPO;
    const sanitizedRepo = (rawRepoPath || '')
      .replace('https://github.com/', '')
      .replace('http://github.com/', '')
      .replace('.git', '')
      .replace(/\/$/, '')
      .trim();

    console.log(`Tentativo di deploy per: ${siteName}. Repo: ${sanitizedRepo}. TeamID: ${TEAM_ID || 'Nessuno'}`);

    if (!sanitizedRepo || sanitizedRepo.includes('tuo-username')) {
      return res.status(400).json({ 
        error: 'Repository GitHub non configurato correttamente. Assicurati di aver impostato la variabile GITHUB_REPO nei Settings con il formato "username/repository".' 
      });
    }

    try {
      // 1. Crea il progetto su Vercel con variabili d'ambiente
      const projectUrl = TEAM_ID 
        ? `https://api.vercel.com/v9/projects?teamId=${TEAM_ID}`
        : `https://api.vercel.com/v9/projects`;

      const projectResponse = await axios.post(
        projectUrl,
        {
          name: siteName.toLowerCase().replace(/\s+/g, '-').substring(0, 30) + '-' + siteId.substring(0, 5),
          framework: 'vite',
          gitRepository: {
            type: 'github',
            repo: sanitizedRepo,
          },
          environmentVariables: [
            {
              key: 'VITE_SUPABASE_URL',
              value: SUPABASE_URL,
              type: 'plain',
              target: ['production', 'preview', 'development']
            },
            {
              key: 'VITE_SUPABASE_ANON_KEY',
              value: SUPABASE_ANON_KEY,
              type: 'plain',
              target: ['production', 'preview', 'development']
            },
            {
              key: 'VITE_PROXY_URL',
              value: APP_URL,
              type: 'plain',
              target: ['production', 'preview', 'development']
            },
            {
              key: 'VITE_SITE_ID',
              value: siteId,
              type: 'plain',
              target: ['production', 'preview', 'development']
            },
            {
              key: 'VITE_OWNER_ID',
              value: ownerId,
              type: 'plain',
              target: ['production', 'preview', 'development']
            },
            {
              key: 'VITE_ADMIN_EMAIL',
              value: adminUser,
              type: 'plain',
              target: ['production', 'preview', 'development']
            },
            {
              key: 'VITE_ADMIN_PASSWORD',
              value: adminPassword,
              type: 'plain',
              target: ['production', 'preview', 'development']
            }
          ]
        },
        {
          headers: {
            Authorization: `Bearer ${VERCEL_TOKEN}`,
          },
        }
      );

      console.log('Progetto creato con successo:', projectResponse.data.id);

      // 2. Forza il primo Deploy per importare il codice
      const deployUrl = TEAM_ID 
        ? `https://api.vercel.com/v13/deployments?teamId=${TEAM_ID}`
        : `https://api.vercel.com/v13/deployments`;

      const deployResponse = await axios.post(
        deployUrl,
        {
          name: siteName,
          project: projectResponse.data.id,
          gitSource: {
            type: 'github',
            ref: 'main',
            repoId: projectResponse.data.link?.repoId || sanitizedRepo,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${VERCEL_TOKEN}`,
          },
        }
      );

      console.log('Deploy avviato:', deployResponse.data.id);
      const deploymentId = deployResponse.data.id;

      // 3. Polling per attendere che il deploy sia pronto
      let isReady = false;
      let attempts = 0;
      const maxAttempts = 30; // 30 * 5 secondi = 150 secondi (2.5 minuti)
      let finalDeployment = deployResponse.data;

      while (!isReady && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        attempts++;

        const checkUrl = TEAM_ID 
          ? `https://api.vercel.com/v13/deployments/${deploymentId}?teamId=${TEAM_ID}`
          : `https://api.vercel.com/v13/deployments/${deploymentId}`;

        const checkResponse = await axios.get(checkUrl, {
          headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
        });

        const status = checkResponse.data.status;
        console.log(`Stato deploy (${attempts}/${maxAttempts}): ${status}`);

        if (status === 'READY') {
          isReady = true;
          finalDeployment = checkResponse.data;
        } else if (status === 'ERROR' || status === 'CANCELED') {
          throw new Error(`Il deploy è fallito con stato: ${status}`);
        }
      }

      if (!isReady) {
        throw new Error('Timeout: Il deploy sta impiegando troppo tempo, ma è ancora in corso su Vercel.');
      }

      res.json({
        id: projectResponse.data.id,
        url: finalDeployment.url,
        name: projectResponse.data.name
      });
    } catch (error: any) {
      const errorData = error.response?.data;
      let errorMessage = errorData?.error?.message || errorData?.message || error.message;
      console.error('Errore Vercel API:', errorMessage);

      if (errorMessage.includes('GitHub integration')) {
        errorMessage = `L'integrazione GitHub di Vercel non ha accesso al repository "${sanitizedRepo}". 
        
        Soluzioni possibili:
        1. Se usi un Team su Vercel, assicurati di aver inserito il "Team ID" nei Settings di AI Studio (variabile VERCEL_TEAM_ID).
        2. Assicurati che il nome del repository sia corretto (formato: username/repo).
        3. Vai su Vercel -> Settings -> Integrations -> GitHub e autorizza il repository.`;
      }

      res.status(error.response?.status || 500).json({ 
        error: errorMessage,
        code: errorData?.error?.code || 'unknown_error'
      });
    }
  });

  // Proxy AI per Gemini
  app.post('/api/ai/generate', async (req, res) => {
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

      // TODO: Qui potresti aggiungere la logica per scalare i crediti su Supabase
      // usando siteId per identificare l'utente.

      res.json({ text });
    } catch (error: any) {
      console.error('Errore Gemini Proxy:', error);
      res.status(500).json({ error: 'Errore durante la generazione AI: ' + error.message });
    }
  });

  // Integrazione Vite
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server pronto su http://localhost:${PORT}`);
  });
}

startServer();
