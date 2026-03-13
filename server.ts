import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { createServer as createViteServer } from 'vite';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Route per creare il progetto su Vercel
  app.post('/api/deploy', async (req, res) => {
    const { siteName, siteId, repoPath } = req.body;
    const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
    const DEFAULT_REPO = process.env.GITHUB_REPO;
    const TEAM_ID = process.env.VERCEL_TEAM_ID;

    if (!VERCEL_TOKEN) {
      return res.status(500).json({ error: 'VERCEL_TOKEN non configurato sul server' });
    }

    const rawRepoPath = repoPath || DEFAULT_REPO;
    const sanitizedRepo = (rawRepoPath || '')
      .replace('https://github.com/', '')
      .replace('http://github.com/', '')
      .replace('.git', '')
      .trim();

    console.log(`Tentativo di deploy per: ${siteName}. Repo: ${sanitizedRepo}. TeamID: ${TEAM_ID || 'Nessuno'}`);

    if (!sanitizedRepo || sanitizedRepo.includes('tuo-username')) {
      return res.status(400).json({ 
        error: 'Repository GitHub non configurato correttamente. Assicurati di aver impostato la variabile GITHUB_REPO nei Settings con il formato "username/repository".' 
      });
    }

    try {
      // 1. Crea il progetto su Vercel
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
