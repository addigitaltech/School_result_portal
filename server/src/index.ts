import express from 'express';
import { apiRouter } from './api.js';
import { uploadRouter, filesRouter } from './files.js';
import { tokenRouter } from './tokens.js';
import { publicRouter, bundleRouter } from './public.js';
import { authRouter } from './auth.js';

const app = express();
const port = Number(process.env.PORT ?? 10000);

// Render sits behind a proxy; this makes req.ip / req.protocol reflect the real client.
app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.FRONTEND_ORIGIN ?? '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'school-result-portal-api' });
});

app.use('/api/files', filesRouter);
app.use('/api/uploads', uploadRouter);
app.use('/api/tokens', tokenRouter);
app.use('/api/public', publicRouter);
app.use('/api/report-bundle', bundleRouter);
app.use('/api/auth', authRouter);
app.use('/api', apiRouter);

app.listen(port, '0.0.0.0', () => {
  console.log(`School Results API listening on port ${port}`);
});
