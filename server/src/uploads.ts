import { Router, type Request } from 'express';
import multer from 'multer';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { requireAuth, type AuthUser } from './api.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });
const router = Router();
const bucket = process.env.R2_BUCKET ?? '';
const publicBaseUrl = (process.env.R2_PUBLIC_BASE_URL ?? '').replace(/\/$/, '');
const client = process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY
  ? new S3Client({ endpoint: process.env.R2_ENDPOINT, region: 'auto', credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY } })
  : null;

router.post('/', requireAuth, upload.single('file'), async (req, res) => {
  const user = (req as Request & { user?: AuthUser }).user;
  if (!user || !['admin', 'teacher'].includes(user.role)) return res.status(403).json({ error: 'You are not authorized to upload files.' });
  if (!client || !bucket || !publicBaseUrl) return res.status(503).json({ error: 'R2 storage is not configured on the API.' });
  if (!req.file) return res.status(400).json({ error: 'A file is required.' });
  const requestedPath = String(req.body.path ?? '').replace(/^\/+/, '').replace(/\.\.+/g, '');
  const allowedPrefix = requestedPath.startsWith('school-logos/') || requestedPath.startsWith('student-photos/');
  if (!allowedPrefix) return res.status(400).json({ error: 'Invalid upload path.' });
  try {
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: requestedPath, Body: req.file.buffer, ContentType: req.file.mimetype, CacheControl: 'public, max-age=31536000, immutable' }));
    res.status(201).json({ data: { path: requestedPath, publicUrl: `${publicBaseUrl}/${requestedPath}` } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Upload failed.' });
  }
});

export { router as uploadRouter };
