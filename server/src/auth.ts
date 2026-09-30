import { createHash, randomBytes } from 'node:crypto';
import { Router, type Request } from 'express';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { jsonError } from './api.js';
import { query } from './db.js';

// Password reset by email for staff (admin/teacher) accounts.
// Configure SMTP on the API service. For Gmail use an App Password:
//   SMTP_HOST=smtp.gmail.com  SMTP_PORT=465  SMTP_USER=you@gmail.com  SMTP_PASS=<16-char app password>
//   SMTP_FROM="School Results Portal <you@gmail.com>"   (optional)   APP_URL=https://your-frontend-url
function mailer() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  const port = Number(process.env.SMTP_PORT ?? 465);
  return nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const attempts = new Map<string, { count: number; resetAt: number }>();
function tooMany(req: Request) {
  const key = req.ip ?? 'unknown';
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) { attempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 }); return false; }
  entry.count += 1;
  return entry.count > 5;
}

export const authRouter = Router();

authRouter.post('/forgot-password', async (req, res) => {
  const transport = mailer();
  if (!transport) return jsonError(res, 'Password reset email is not set up on this server yet. Please contact the administrator.', 503);
  if (tooMany(req)) return jsonError(res, 'Too many requests. Please wait 15 minutes and try again.', 429);
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const generic = { data: { message: 'If an account exists for that email, a reset link has been sent. Check your inbox (and spam folder).' } };
  if (!email) return res.json(generic);
  try {
    const found = await query<{ id: string; display_name: string }>("SELECT id, display_name FROM app_users WHERE lower(email) = $1 AND role IN ('admin','teacher')", [email]);
    const account = found.rows[0];
    if (!account) return res.json(generic);
    const token = randomBytes(32).toString('hex');
    await query('DELETE FROM password_reset_tokens WHERE user_id = $1', [account.id]);
    await query("INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 hour')", [account.id, sha256(token)]);
    const appUrl = (process.env.APP_URL ?? process.env.FRONTEND_ORIGIN ?? '').replace(/\/$/, '');
    const link = `${appUrl}/reset-password?token=${token}`;
    await transport.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to: email,
      subject: 'Reset your School Results Portal password',
      text: `Hello ${account.display_name},\n\nUse this link to choose a new password (valid for 1 hour):\n${link}\n\nIf you did not ask for this, you can ignore this email.`,
      html: `<p>Hello ${account.display_name.replace(/[<>&]/g, '')},</p><p>Use the button below to choose a new password. The link is valid for 1 hour.</p><p><a href="${link}" style="background:#1d4ed8;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Reset password</a></p><p>Or paste this link into your browser:<br>${link}</p><p>If you did not ask for this, you can ignore this email.</p>`,
    });
    return res.json(generic);
  } catch (error) {
    console.error(error);
    return jsonError(res, 'The reset email could not be sent. Please try again later or contact the administrator.', 500);
  }
});

authRouter.post('/reset-password', async (req, res) => {
  const token = String(req.body?.token ?? '');
  const password = String(req.body?.password ?? '');
  if (!token) return jsonError(res, 'This reset link is invalid.');
  if (password.length < 6) return jsonError(res, 'Password must be at least 6 characters.');
  try {
    const found = await query<{ id: string; user_id: string }>(
      'SELECT id, user_id FROM password_reset_tokens WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()', [sha256(token)],
    );
    const record = found.rows[0];
    if (!record) return jsonError(res, 'This reset link is invalid or has expired. Please request a new one.', 400);
    const passwordHash = await bcrypt.hash(password, 12);
    await query('UPDATE app_users SET password_hash = $1 WHERE id = $2', [passwordHash, record.user_id]);
    await query('UPDATE password_reset_tokens SET used_at = now() WHERE id = $1', [record.id]);
    return res.json({ data: { message: 'Password updated. You can now sign in.' } });
  } catch (error) {
    console.error(error);
    return jsonError(res, 'Could not reset the password.', 500);
  }
});
