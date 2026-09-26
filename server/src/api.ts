import { Router, type NextFunction, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from './db.js';

export type Role = 'admin' | 'teacher' | 'student' | 'parent';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  display_name: string;
  teacher_id: string | null;
  student_id: string | null;
  parent_id: string | null;
}

type AuthedRequest = Request & { user?: AuthUser };

const JWT_SECRET = process.env.JWT_SECRET ?? 'development-only-change-me';
const tables = new Set([
  'school_settings', 'app_users', 'academic_sessions', 'terms', 'teachers', 'classes', 'arms',
  'class_arms', 'subjects', 'students', 'parents', 'results', 'grade_bands', 'affective_traits',
  'affective_ratings', 'term_remarks',
]);
const columns: Record<string, Set<string>> = {
  school_settings: new Set(['id','school_name','address','phone','email','logo_url','current_session_id','current_term_id','pass_percentage','motto','ca1_max_score','ca2_max_score','ca3_max_score','exam_max_score','updated_at']),
  app_users: new Set(['id','email','password_hash','role','display_name','teacher_id','student_id','parent_id','created_at']),
  academic_sessions: new Set(['id','name','is_active','created_at']),
  terms: new Set(['id','name','session_id','is_current','created_at']),
  teachers: new Set(['id','teacher_id','full_name','email','phone','gender','status','subject_ids','class_ids','created_at']),
  classes: new Set(['id','name','class_teacher_id','created_at']),
  arms: new Set(['id','name','created_at']),
  class_arms: new Set(['class_id','arm_id','created_at']),
  subjects: new Set(['id','code','name','class_id','teacher_id','status','created_at']),
  students: new Set(['id','student_id','first_name','last_name','other_name','gender','date_of_birth','class_id','arm_id','photo_url','parent_guardian','parent_phone','email','admission_date','status','created_at']),
  parents: new Set(['id','full_name','email','phone','student_id','created_at']),
  results: new Set(['id','student_id','subject_id','teacher_id','class_id','session_id','term_id','ca1_score','ca2_score','ca3_score','exam_score','total_score','is_offered','grade','remark','status','created_at','updated_at']),
  grade_bands: new Set(['id','min_score','max_score','grade','remark','created_at']),
  affective_traits: new Set(['id','name','created_at']),
  affective_ratings: new Set(['id','student_id','trait_id','session_id','term_id','rating','created_at','updated_at']),
  term_remarks: new Set(['id','student_id','session_id','term_id','teacher_remark','principal_remark','created_at','updated_at']),
};

function jsonError(res: Response, message: string, status = 400) {
  res.status(status).json({ error: message });
}

function signUser(user: AuthUser) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '8h' });
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) return jsonError(res, 'Authentication required.', 401);
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET) as AuthUser;
    next();
  } catch {
    return jsonError(res, 'Invalid or expired token.', 401);
  }
}

function requireRole(...roles: Role[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) return jsonError(res, 'You are not authorized for this operation.', 403);
    next();
  };
}

function parseSelect(table: string, raw: string | undefined) {
  const allowed = columns[table];
  if (!raw || raw === '*') return '*';
  const selected = raw.split(',').map((part) => part.trim().split('(')[0]).filter((name) => allowed.has(name));
  return selected.length ? selected.join(', ') : '*';
}

function addFilter(table: string, rawKey: string, rawValue: string, params: unknown[], where: string[]) {
  const match = rawKey.match(/^([a-z_]+)(?:\[([^\]]+)\])?$/);
  if (!match || !columns[table].has(match[1])) return;
  const column = match[1];
  const op = match[2] ?? 'eq';
  if (op === 'in') {
    const values = rawValue.split(',');
    where.push(`"${column}" = ANY($${params.length + 1}::text[])`);
    params.push(values);
  } else if (op === 'is') {
    where.push(rawValue === 'null' ? `"${column}" IS NULL` : `"${column}" IS NOT NULL`);
  } else if (op === 'neq') {
    where.push(`"${column}" <> $${params.length + 1}`);
    params.push(rawValue);
  } else {
    where.push(`"${column}" = $${params.length + 1}`);
    params.push(rawValue);
  }
}

function applyScope(table: string, user: AuthUser, where: string[], params: unknown[]) {
  if (user.role === 'admin') return;
  if (user.role === 'teacher') {
    if (table === 'results') { where.push(`teacher_id = $${params.length + 1}`); params.push(user.teacher_id); }
    if (table === 'teachers') { where.push(`id = $${params.length + 1}`); params.push(user.teacher_id); }
    if (table === 'app_users') { where.push('1 = 0'); }
  }
  if (user.role === 'student') {
    if (['students','results','affective_ratings','term_remarks'].includes(table)) { where.push(`student_id = $${params.length + 1}`); params.push(user.student_id); }
    else if (['app_users'].includes(table)) { where.push(`id = $${params.length + 1}`); params.push(user.id); }
    else if (table === 'school_settings' || ['academic_sessions','terms','classes','subjects','arms','class_arms','grade_bands','affective_traits'].includes(table)) { /* read-only reference data */ }
    else { where.push('1 = 0'); }
  }
  if (user.role === 'parent') {
    if (table === 'parents') { where.push(`id = $${params.length + 1}`); params.push(user.parent_id); }
    else if (['students','results','affective_ratings','term_remarks'].includes(table)) {
      where.push(`student_id = (SELECT student_id FROM parents WHERE id = $${params.length + 1})`); params.push(user.parent_id);
    } else if (table === 'app_users') { where.push(`id = $${params.length + 1}`); params.push(user.id); }
    else if (table === 'school_settings' || ['academic_sessions','terms','classes','subjects','arms','class_arms','grade_bands','affective_traits'].includes(table)) { /* read-only reference data */ }
    else { where.push('1 = 0'); }
  }
}

function canWrite(user: AuthUser, table: string) {
  if (user.role === 'admin') return true;
  if (user.role === 'teacher') return ['results','affective_ratings','term_remarks'].includes(table);
  return false;
}

export const apiRouter = Router();

apiRouter.post('/login', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  if (!email || !password) return jsonError(res, 'Email and password are required.');
  const result = await query<AuthUser & { password_hash: string }>(
    'SELECT id, email, password_hash, role, display_name, teacher_id, student_id, parent_id FROM app_users WHERE lower(email) = lower($1)', [email],
  );
  const account = result.rows[0];
  if (!account || !(await bcrypt.compare(password, account.password_hash))) return jsonError(res, 'Invalid email or password.', 401);
  const { password_hash: _password, ...user } = account;
  res.json({ user, token: signUser(user) });
});

apiRouter.get('/me', requireAuth, (req: AuthedRequest, res) => res.json({ user: req.user }));

apiRouter.all('/data/:table', requireAuth, async (req: AuthedRequest, res) => {
  const table = Array.isArray(req.params.table) ? req.params.table[0] : req.params.table;
  if (!tables.has(table)) return jsonError(res, 'Unknown resource.', 404);
  const user = req.user!;
  const where: string[] = [];
  const params: unknown[] = [];
  applyScope(table, user, where, params);

  try {
    if (req.method === 'GET') {
      for (const [key, value] of Object.entries(req.query)) {
        if (['select','order','limit','maybeSingle','single','count','in_field','in_values'].includes(key)) continue;
        if (typeof value === 'string') addFilter(table, key, value, params, where);
      }
      if (req.query.in_field && req.query.in_values && typeof req.query.in_field === 'string' && typeof req.query.in_values === 'string') addFilter(table, `${req.query.in_field}[in]`, req.query.in_values, params, where);
      const order = typeof req.query.order === 'string' && columns[table].has(req.query.order.replace(/^-/, '')) ? req.query.order : 'created_at';
      const orderColumn = order.replace(/^-/, '');
      const direction = order.startsWith('-') ? 'DESC' : 'ASC';
      const limit = Math.min(Math.max(Number(req.query.limit ?? 1000), 1), 5000);
      const sql = `SELECT ${parseSelect(table, typeof req.query.select === 'string' ? req.query.select : undefined)} FROM "${table}"${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY "${orderColumn}" ${direction} LIMIT ${limit}`;
      const result = await query(sql, params);
      if (req.query.count === 'exact') return res.json({ data: req.query.head === 'true' ? null : result.rows, count: result.rowCount });
      if (req.query.maybeSingle === 'true' || req.query.single === 'true') return res.json({ data: result.rows[0] ?? null });
      return res.json({ data: result.rows });
    }

    if (!canWrite(user, table)) return jsonError(res, 'You are not authorized to modify this resource.', 403);
    const body = req.body as Record<string, unknown>;
    const validEntries = Object.entries(body).filter(([key]) => columns[table].has(key) && key !== 'id' && key !== 'total_score' && key !== 'created_at');
    if (req.method === 'POST') {
      const names = validEntries.map(([key]) => `"${key}"`).join(', ');
      const placeholders = validEntries.map(([,], index) => `$${index + 1}`).join(', ');
      const values = validEntries.map(([, value]) => value);
      const result = await query(`INSERT INTO "${table}" (${names}) VALUES (${placeholders}) RETURNING *`, values);
      return res.status(201).json({ data: result.rows });
    }

    const filters = Object.entries(req.query).filter(([key]) => key !== 'select' && key !== 'order' && key !== 'limit');
    for (const [key, value] of filters) if (typeof value === 'string') addFilter(table, key, value, params, where);
    if (!where.length) return jsonError(res, 'An update or delete filter is required.', 400);
    if (req.method === 'PUT' || req.method === 'PATCH') {
      const assignments = validEntries.map(([key], index) => `"${key}" = $${params.length + index + 1}`);
      const values = validEntries.map(([, value]) => value);
      const result = await query(`UPDATE "${table}" SET ${assignments.join(', ')} WHERE ${where.join(' AND ')} RETURNING *`, [...params, ...values]);
      return res.json({ data: result.rows });
    }
    if (req.method === 'DELETE') {
      const result = await query(`DELETE FROM "${table}" WHERE ${where.join(' AND ')} RETURNING *`, params);
      return res.json({ data: result.rows });
    }
    return jsonError(res, 'Method not supported.', 405);
  } catch (error) {
    console.error(error);
    return jsonError(res, (error as Error).message, 500);
  }
});

export { bcrypt };
