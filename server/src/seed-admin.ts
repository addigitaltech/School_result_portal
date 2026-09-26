import bcrypt from 'bcryptjs';
import { query, pool } from './db.js';

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const displayName = process.env.ADMIN_NAME?.trim() || 'Administrator';

if (!email || !password) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD before running server:seed-admin.');
  process.exit(1);
}

const passwordHash = await bcrypt.hash(password, 12);
await query(
  `INSERT INTO app_users (email, password_hash, role, display_name)
   VALUES ($1, $2, 'admin', $3)
   ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin', display_name = EXCLUDED.display_name`,
  [email, passwordHash, displayName],
);
console.log(`Administrator provisioned: ${email}`);
await pool.end();
