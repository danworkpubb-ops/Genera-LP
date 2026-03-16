import axios from 'axios';
import { VercelRequest, VercelResponse } from '@vercel/node';

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

const handler = async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST' && req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  const { projectId, domain, action } = req.body; // action: 'add' | 'remove'
  const VERCEL_TOKEN = process.env.VERCEL_TOKEN?.trim();
  const TEAM_ID = process.env.VERCEL_TEAM_ID?.trim();

  if (!VERCEL_TOKEN) return res.status(500).json({ error: 'VERCEL_TOKEN non configurato' });

  try {
    const url = TEAM_ID 
      ? `https://api.vercel.com/v9/projects/${projectId}/domains?teamId=${TEAM_ID}`
      : `https://api.vercel.com/v9/projects/${projectId}/domains`;

    if (req.method === 'POST') {
      // Aggiungi
      await axios.post(url, { name: domain }, {
        headers: { Authorization: `Bearer ${VERCEL_TOKEN}` }
      });
    } else {
      // Rimuovi
      const deleteUrl = TEAM_ID 
        ? `${url}/${domain}?teamId=${TEAM_ID}`
        : `${url}/${domain}`;
      await axios.delete(deleteUrl, {
        headers: { Authorization: `Bearer ${VERCEL_TOKEN}` }
      });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export default allowCors(handler);
