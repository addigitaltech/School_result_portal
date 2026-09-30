import { Router, type Request } from 'express';
import multer from 'multer';
import { requireAuth, jsonError, type AuthedRequest } from './api.js';
import { query } from './db.js';

// Files (school logo, student passport photos) are stored inside PostgreSQL, so no external
// object storage account is required and everything is included in normal database backups.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

/** Detects the real image type from the file's first bytes rather than trusting the client's mime type. */
function detectImageType(buffer: Buffer): string | null {
  if (buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length > 6 && buffer.subarray(0, 4).toString('ascii') === 'GIF8') return 'image/gif';
  if (buffer.length > 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

function publicBase(req: Request) {
  const configured = (process.env.PUBLIC_API_URL ?? '').replace(/\/$/, '');
  return configured || `${req.protocol}://${req.get('host')}`;
}

// Mounted at /api/uploads (authenticated)
export const uploadRouter = Router();
uploadRouter.post('/', requireAuth, upload.single('file'), async (req: AuthedRequest, res) => {
  const user = req.user;
  if (!user || !['admin', 'teacher'].includes(user.role)) return jsonError(res, 'You are not authorized to upload files.', 403);
  if (!req.file) return jsonError(res, 'A file is required.');
  const path = String(req.body?.path ?? '').replace(/^\/+/, '');
  if (!/^(school-logos|student-photos)\/[A-Za-z0-9._-]+$/.test(path)) return jsonError(res, 'Invalid upload path.');
  const contentType = detectImageType(req.file.buffer);
  if (!contentType) return jsonError(res, 'Only PNG, JPG, GIF or WEBP images are allowed.');
  try {
    await query(
      `INSERT INTO uploaded_files (path, content_type, data) VALUES ($1, $2, $3)
       ON CONFLICT (path) DO UPDATE SET content_type = EXCLUDED.content_type, data = EXCLUDED.data`,
      [path, contentType, req.file.buffer],
    );
    return res.status(201).json({ data: { path, publicUrl: `${publicBase(req)}/api/files/${path}` } });
  } catch (error) {
    console.error(error);
    return jsonError(res, 'Upload failed.', 500);
  }
});

// Mounted at /api/files (public, so logos/photos can be shown on printed pages and on the school website)
export const filesRouter = Router();
filesRouter.get(/^\/(.+)$/, async (req, res) => {
  const path = String((req.params as Record<string, string>)[0] ?? '');
  try {
    const result = await query<{ content_type: string; data: Buffer }>('SELECT content_type, data FROM uploaded_files WHERE path = $1', [path]);
    const file = result.rows[0];
    if (!file) return jsonError(res, 'File not found.', 404);
    res.set({
      'Content-Type': file.content_type,
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });
    return res.send(file.data);
  } catch (error) {
    console.error(error);
    return jsonError(res, 'Could not load file.', 500);
  }
});
