import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Import handlers from /api
import deployHandler from '../api/deploy';
import deleteSiteHandler from '../api/delete-site';
import manageDomainHandler from '../api/manage-domain';

dotenv.config();

const app = express();

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
app.post('/api/deploy', wrapVercel(deployHandler));
app.delete('/api/delete-site', wrapVercel(deleteSiteHandler));
app.post('/api/manage-domain', wrapVercel(manageDomainHandler));
app.delete('/api/manage-domain', wrapVercel(manageDomainHandler));

// Rotta per generazione AI (usa l'handler serverless per coerenza)
import generateLandingHandler from '../api/ai/generate-landing';
app.post('/api/ai/generate-landing', wrapVercel(generateLandingHandler));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Rotta per recuperare i consumi correnti (usa l'handler serverless)
import usageHandler from '../api/usage/[userId]';
app.get('/api/usage/:userId', wrapVercel(usageHandler));

export default app;
