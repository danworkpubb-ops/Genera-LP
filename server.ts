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

    if (!VERCEL_TOKEN) {
      return res.status(500).json({ error: 'VERCEL_TOKEN non configurato sul server' });
    }

    try {
      // 1. Crea il progetto su Vercel
      const response = await axios.post(
        `https://api.vercel.com/v9/projects`,
        {
          name: `site-${siteId}`,
          gitRepository: {
            type: 'github',
            repo: repoPath, // Es: 'username/repo'
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
      console.error('Errore Vercel API:', error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
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
