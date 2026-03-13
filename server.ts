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

    const finalRepoPath = repoPath || DEFAULT_REPO;
    console.log(`Tentativo di deploy per: ${siteName}. Repo: ${finalRepoPath}. TeamID: ${TEAM_ID || 'Nessuno'}`);

    if (!finalRepoPath || finalRepoPath.includes('tuo-username')) {
      return res.status(400).json({ 
        error: 'Repository GitHub non configurato correttamente. Assicurati di aver impostato la variabile GITHUB_REPO nei Settings con il formato "username/repository".' 
      });
    }

    try {
      // 1. Crea il progetto su Vercel
      const url = TEAM_ID 
        ? `https://api.vercel.com/v9/projects?teamId=${TEAM_ID}`
        : `https://api.vercel.com/v9/projects`;

      const response = await axios.post(
        url,
        {
          name: siteName.toLowerCase().replace(/\s+/g, '-').substring(0, 30) + '-' + siteId.substring(0, 5),
          gitRepository: {
            type: 'github',
            repo: finalRepoPath,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${VERCEL_TOKEN}`,
          },
        }
      );

      res.json(response.data);
    } catch (error: any) {
      const errorData = error.response?.data;
      let errorMessage = errorData?.error?.message || errorData?.message || error.message;
      console.error('Errore Vercel API:', errorMessage);

      if (errorMessage.includes('GitHub integration')) {
        errorMessage = `L'integrazione GitHub di Vercel non ha accesso al repository "${finalRepoPath}". 
        Assicurati che:
        1. Il nome del repository sia corretto (formato: username/repo).
        2. Hai installato l'app Vercel su GitHub per questo repository.
        3. Se il repository è privato, il token Vercel deve avere i permessi necessari.`;
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
