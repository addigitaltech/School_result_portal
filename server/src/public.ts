import { Router, type Request } from 'express';
import { requireAuth, requireRole, jsonError, type AuthedRequest } from './api.js';
import { query } from './db.js';
import { normalizeToken } from './tokens.js';

type Row = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Report bundle: everything needed to render one report card, computed server-side
// so class statistics/positions are correct no matter who is viewing.
// ---------------------------------------------------------------------------
export async function buildReportBundle(studentId: string, sessionId: string, termId: string) {
  const studentResult = await query<Row>(
    `SELECT s.*, c.name AS class_name, a.name AS arm_name
     FROM students s LEFT JOIN classes c ON c.id = s.class_id LEFT JOIN arms a ON a.id = s.arm_id WHERE s.id = $1`, [studentId],
  );
  const student = studentResult.rows[0];
  if (!student) return null;
  const { class_name: className, arm_name: armName, ...studentFields } = student as Row & { class_name: string | null; arm_name: string | null };

  const [settings, session, term] = await Promise.all([
    query<Row>('SELECT * FROM school_settings LIMIT 1'),
    query<Row>('SELECT * FROM academic_sessions WHERE id = $1', [sessionId]),
    query<Row>('SELECT * FROM terms WHERE id = $1', [termId]),
  ]);

  const current = await query<Row>(
    `SELECT r.*, s.name AS subject_name, t.name AS term_name
     FROM results r JOIN subjects s ON s.id = r.subject_id JOIN terms t ON t.id = r.term_id
     WHERE r.student_id = $1 AND r.session_id = $2 AND r.term_id = $3 AND r.status = 'Published' ORDER BY s.name`,
    [studentId, sessionId, termId],
  );
  const isThirdTerm = String(term.rows[0]?.name ?? '').toLowerCase().includes('third');
  let results: Row[] = current.rows.map((row) => ({ ...row, subjects: { name: row.subject_name } }));
  if (isThirdTerm) {
    const annual = await query<{ subject_id: string; total_score: number }>(
      `SELECT subject_id, total_score FROM results
       WHERE student_id = $1 AND session_id = $2 AND status = 'Published'
         AND term_id IN (SELECT id FROM terms WHERE session_id = $2 AND lower(name) IN ('first term','second term','third term'))`,
      [studentId, sessionId],
    );
    const grouped = new Map<string, number[]>();
    for (const row of annual.rows) grouped.set(row.subject_id, [...(grouped.get(row.subject_id) ?? []), Number(row.total_score)]);
    results = results.map((row) => {
      const scores = grouped.get(String(row.subject_id)) ?? [Number(row.total_score)];
      const cumulativeTotal = scores.reduce((sum, score) => sum + score, 0);
      return { ...row, cumulative_total: cumulativeTotal, cumulative_average: cumulativeTotal / scores.length, cumulative_terms_count: scores.length };
    });
  }

  const [remark, bands, traits, ratings, classStudents, allResults] = await Promise.all([
    query<Row>('SELECT * FROM term_remarks WHERE student_id = $1 AND session_id = $2 AND term_id = $3', [studentId, sessionId, termId]),
    query<Row>('SELECT * FROM grade_bands ORDER BY min_score DESC'),
    query<Row>('SELECT * FROM affective_traits ORDER BY name'),
    query<Row>('SELECT * FROM affective_ratings WHERE student_id = $1 AND session_id = $2 AND term_id = $3', [studentId, sessionId, termId]),
    student.class_id ? query<Row>('SELECT id, class_id, arm_id FROM students WHERE class_id = $1', [student.class_id]) : Promise.resolve({ rows: [] as Row[] }),
    student.class_id
      ? query<Row>(
        `SELECT r.*, jsonb_build_object('name', sj.name) AS subjects
         FROM results r JOIN subjects sj ON sj.id = r.subject_id JOIN students st ON st.id = r.student_id
         WHERE r.session_id = $1 AND r.term_id = $2 AND r.status = 'Published' AND st.class_id = $3 AND st.arm_id IS NOT DISTINCT FROM $4`,
        [sessionId, termId, student.class_id, student.arm_id ?? null],
      )
      : Promise.resolve({ rows: [] as Row[] }),
  ]);

  return {
    student: studentFields,
    className: className ?? '—',
    armName: armName ?? '',
    settings: settings.rows[0] ?? null,
    session: session.rows[0] ?? null,
    term: term.rows[0] ?? null,
    results,
    termRemark: remark.rows[0] ?? null,
    gradeBands: bands.rows,
    traits: traits.rows,
    ratings: ratings.rows,
    allResults: allResults.rows,
    classStudents: classStudents.rows,
  };
}

// Mounted at /api/report-bundle (staff only): admin and teachers can print any student's complete result.
export const bundleRouter = Router();
bundleRouter.get('/:studentId/:sessionId/:termId', requireAuth, requireRole('admin', 'teacher'), async (req: AuthedRequest, res) => {
  try {
    const bundle = await buildReportBundle(String(req.params.studentId), String(req.params.sessionId), String(req.params.termId));
    if (!bundle) return jsonError(res, 'Student not found.', 404);
    return res.json({ data: bundle });
  } catch (error) {
    console.error(error);
    return jsonError(res, 'Could not load the report card.', 500);
  }
});

// ---------------------------------------------------------------------------
// Public result checker: surname + token, no account.
// ---------------------------------------------------------------------------
const failures = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;

function clientKey(req: Request) { return req.ip ?? 'unknown'; }
function isBlocked(key: string) {
  const entry = failures.get(key);
  if (!entry) return false;
  if (entry.resetAt < Date.now()) { failures.delete(key); return false; }
  return entry.count >= MAX_FAILURES;
}
function recordFailure(key: string) {
  const entry = failures.get(key);
  if (!entry || entry.resetAt < Date.now()) failures.set(key, { count: 1, resetAt: Date.now() + WINDOW_MS });
  else entry.count += 1;
}

async function verify(req: Request): Promise<{ studentId: string } | { error: string; status: number }> {
  const key = clientKey(req);
  if (isBlocked(key)) return { error: 'Too many failed attempts. Please wait 15 minutes and try again.', status: 429 };
  const surname = String(req.body?.surname ?? '').trim();
  const token = normalizeToken(req.body?.token);
  if (!surname || !token) return { error: 'Enter the student surname and the result token.', status: 400 };
  const found = await query<{ id: string }>(
    `SELECT s.id FROM student_tokens t JOIN students s ON s.id = t.student_id
     WHERE t.token = $1 AND regexp_replace(lower(trim(s.last_name)), '\\s+', ' ', 'g') = regexp_replace(lower($2), '\\s+', ' ', 'g')`,
    [token, surname],
  );
  if (!found.rows[0]) { recordFailure(key); return { error: 'Invalid surname or token. Check the details on your result card and try again.', status: 401 }; }
  return { studentId: found.rows[0].id };
}

export const publicRouter = Router();

// No auth: lets the login page and the result-checker page know which mode the school has enabled,
// and shows basic branding, before the visitor has typed anything.
publicRouter.get('/settings', async (_req, res) => {
  try {
    const result = await query<Row>('SELECT school_name, logo_url, motto, result_access_mode FROM school_settings LIMIT 1');
    return res.json({ data: result.rows[0] ?? { school_name: 'School Results Portal', logo_url: '', motto: '', result_access_mode: 'portal' } });
  } catch (error) {
    console.error(error);
    return jsonError(res, 'Could not load settings.', 500);
  }
});

publicRouter.post('/check', async (req, res) => {
  try {
    const verified = await verify(req);
    if ('error' in verified) return jsonError(res, verified.error, verified.status);
    const [student, periods, settings] = await Promise.all([
      query<Row>(
        `SELECT s.id, s.first_name, s.last_name, s.other_name, s.student_id, s.photo_url, c.name AS class_name, a.name AS arm_name
         FROM students s LEFT JOIN classes c ON c.id = s.class_id LEFT JOIN arms a ON a.id = s.arm_id WHERE s.id = $1`, [verified.studentId]),
      query<Row>(
        `SELECT DISTINCT r.session_id, a.name AS session_name, r.term_id, t.name AS term_name
         FROM results r JOIN academic_sessions a ON a.id = r.session_id JOIN terms t ON t.id = r.term_id
         WHERE r.student_id = $1 AND r.status = 'Published' ORDER BY a.name DESC, t.name`, [verified.studentId]),
      query<Row>('SELECT school_name, logo_url, motto, current_session_id, current_term_id FROM school_settings LIMIT 1'),
    ]);
    return res.json({ data: { student: student.rows[0], periods: periods.rows, school: settings.rows[0] ?? null } });
  } catch (error) {
    console.error(error);
    return jsonError(res, 'Could not check the result right now. Please try again.', 500);
  }
});

publicRouter.post('/report', async (req, res) => {
  try {
    const verified = await verify(req);
    if ('error' in verified) return jsonError(res, verified.error, verified.status);
    const sessionId = String(req.body?.session_id ?? '');
    const termId = String(req.body?.term_id ?? '');
    if (!sessionId || !termId) return jsonError(res, 'Select a session and term.');
    const bundle = await buildReportBundle(verified.studentId, sessionId, termId);
    if (!bundle) return jsonError(res, 'Student not found.', 404);
    await query('UPDATE student_tokens SET use_count = use_count + 1, last_used_at = now() WHERE student_id = $1', [verified.studentId]);
    return res.json({ data: bundle });
  } catch (error) {
    console.error(error);
    return jsonError(res, 'Could not load the result right now. Please try again.', 500);
  }
});
