import { randomInt } from 'node:crypto';
import { Router } from 'express';
import { requireAuth, requireRole, jsonError, type AuthedRequest } from './api.js';
import { query } from './db.js';

// Unambiguous characters only (no 0/O, 1/I/L) so printed tokens are easy to read and type.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function makeToken(length = 12) {
  let token = '';
  for (let index = 0; index < length; index += 1) token += ALPHABET[randomInt(ALPHABET.length)];
  return token;
}
export function normalizeToken(value: unknown) {
  return String(value ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

export const tokenRouter = Router();

/**
 * Admin only. Creates a result-checking token for every targeted student who does not have one yet.
 * Body: { student_ids?: string[], class_id?: string, arm_id?: string, regenerate?: boolean }
 * With no targeting fields it applies to every student. regenerate=true replaces existing tokens.
 */
tokenRouter.post('/generate', requireAuth, requireRole('admin'), async (req: AuthedRequest, res) => {
  const studentIds: string[] = Array.isArray(req.body?.student_ids) ? req.body.student_ids.map(String) : [];
  const classId = req.body?.class_id ? String(req.body.class_id) : null;
  const armId = req.body?.arm_id ? String(req.body.arm_id) : null;
  const regenerate = req.body?.regenerate === true;
  try {
    const targets = await query<{ id: string }>(
      `SELECT s.id FROM students s
       WHERE ($1::uuid[] IS NULL OR s.id = ANY($1::uuid[]))
         AND ($2::uuid IS NULL OR s.class_id = $2::uuid)
         AND ($3::uuid IS NULL OR s.arm_id = $3::uuid)`,
      [studentIds.length ? studentIds : null, classId, armId],
    );
    let generated = 0;
    for (const target of targets.rows) {
      if (!regenerate) {
        const existing = await query('SELECT 1 FROM student_tokens WHERE student_id = $1', [target.id]);
        if (existing.rowCount) continue;
      }
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const inserted = await query(
          `INSERT INTO student_tokens (student_id, token) VALUES ($1, $2)
           ON CONFLICT (student_id) DO UPDATE SET token = EXCLUDED.token, use_count = 0, last_used_at = NULL, created_at = now()
           RETURNING student_id`,
          [target.id, makeToken()],
        ).catch((error: { code?: string }) => (error.code === '23505' ? null : Promise.reject(error)));
        if (inserted?.rowCount) { generated += 1; break; }
      }
    }
    return res.json({ data: { generated, considered: targets.rowCount } });
  } catch (error) {
    console.error(error);
    return jsonError(res, 'Failed to generate tokens.', 500);
  }
});
