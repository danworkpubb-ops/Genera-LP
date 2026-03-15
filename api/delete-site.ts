import axios from 'axios';
import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  const { projectId } = req.body;
  const VERCEL_TOKEN = process.env.VERCEL_TOKEN?.trim();
  const TEAM_ID = process.env.VERCEL_TEAM_ID?.trim();

  if (!VERCEL_TOKEN) return res.status(500).json({ error: 'VERCEL_TOKEN non configurato' });

  try {
    // 1. Elimina da Vercel
    const url = TEAM_ID 
      ? `https://api.vercel.com/v9/projects/${projectId}?teamId=${TEAM_ID}`
      : `https://api.vercel.com/v9/projects/${projectId}`;
      
    await axios.delete(url, {
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}` }
    });
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
