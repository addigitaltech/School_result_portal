import express from 'express';

const app = express();
const port = Number(process.env.PORT ?? 10000);

app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'school-result-portal-api' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`School Results API listening on port ${port}`);
});
