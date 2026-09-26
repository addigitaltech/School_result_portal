import express from 'express';
import { apiRouter } from './api.js';
import { uploadRouter } from './uploads.js';

const app = express();
const port = Number(process.env.PORT ?? 10000);

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

app.use('/api', apiRouter);
app.use('/api/uploads', uploadRouter);

app.listen(port, '0.0.0.0', () => {
  console.log(`School Results API listening on port ${port}`);
});
