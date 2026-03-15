// api/deploy.ts
import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { siteName, siteId, adminUser, adminPassword, ownerId } = req.body;
  const VERCEL_TOKEN = process.env.VERCEL_TOKEN?.trim();
  const DEFAULT_REPO = process.env.GITHUB_REPO?.trim();
  const TEAM_ID = process.env.VERCEL_TEAM_ID?.trim();
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL?.trim();
  const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY?.trim();
  const APP_URL = process.env.APP_URL || `https://${req.headers.host}`;

  if (!VERCEL_TOKEN) {
    return res.status(500).json({ error: 'VERCEL_TOKEN non configurato sul server' });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Le variabili Supabase non sono configurate sul server.' });
  }

  const rawRepoPath = DEFAULT_REPO;
  const sanitizedRepo = (rawRepoPath || '')
    .replace('https://github.com/', '')
    .replace('http://github.com/', '')
    .replace('.git', '')
    .replace(/\/$/, '')
    .trim();

  if (!sanitizedRepo || sanitizedRepo.includes('tuo-username')) {
    return res.status(400).json({ 
      error: 'Repository GitHub non configurato correttamente.' 
    });
  }

  try {
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
          { key: 'VITE_SUPABASE_URL', value: SUPABASE_URL, type: 'plain', target: ['production', 'preview', 'development'] },
          { key: 'VITE_SUPABASE_ANON_KEY', value: SUPABASE_ANON_KEY, type: 'plain', target: ['production', 'preview', 'development'] },
          { key: 'VITE_PROXY_URL', value: APP_URL, type: 'plain', target: ['production', 'preview', 'development'] },
          { key: 'VITE_SITE_ID', value: siteId, type: 'plain', target: ['production', 'preview', 'development'] },
          { key: 'VITE_OWNER_ID', value: ownerId, type: 'plain', target: ['production', 'preview', 'development'] },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${VERCEL_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return res.status(200).json(projectResponse.data);
  } catch (error: any) {
    console.error('Errore deploy:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Errore durante il deploy su Vercel' });
  }
}
