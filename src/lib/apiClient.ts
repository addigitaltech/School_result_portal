import type { AppUser } from './types';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:10000/api';
const TOKEN_KEY = 'srp_access_token';
const uploadedUrls = new Map<string, string>();

type Result<T> = { data: T; error: Error | null; count?: number | null };

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const isFormData = init.body instanceof FormData;
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...(isFormData ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers ?? {}) },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error ?? `Request failed (${response.status})`);
  return payload as T;
}

class QueryBuilder<T = any> implements PromiseLike<Result<any>> {
  private method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET';
  private body: Record<string, unknown> | Record<string, unknown>[] | undefined;
  private params = new URLSearchParams();
  private singleMode: 'single' | 'maybeSingle' | null = null;
  private countMode = false;
  private headMode = false;

  constructor(private readonly table: string) {}

  select(columns = '*', options?: { count?: 'exact'; head?: boolean }) {
    this.params.set('select', columns);
    if (options?.count) this.countMode = true;
    if (options?.head) this.headMode = true;
    return this;
  }
  eq(column: string, value: unknown) { this.params.set(column, String(value)); return this; }
  neq(column: string, value: unknown) { this.params.set(`${column}[neq]`, String(value)); return this; }
  in(column: string, values: string[]) { this.params.set('in_field', column); this.params.set('in_values', values.join(',')); return this; }
  is(column: string, value: null | 'null') { this.params.set(`${column}[is]`, value ?? 'null'); return this; }
  not(column: string, operator: string, value: string) { if (operator === 'in') this.params.set(`${column}[neq]`, value.replace(/^\(|\)$/g, '').split(',')[0]); return this; }
  order(column: string, options?: { ascending?: boolean }) { this.params.set('order', options?.ascending === false ? `-${column}` : column); return this; }
  limit(value: number) { this.params.set('limit', String(value)); return this; }
  single() { this.singleMode = 'single'; return this; }
  maybeSingle() { this.singleMode = 'maybeSingle'; return this; }
  insert(payload: Record<string, unknown> | Record<string, unknown>[]) { this.method = 'POST'; this.body = payload; return this; }
  upsert(payload: Record<string, unknown> | Record<string, unknown>[], options?: { onConflict?: string }) { this.method = 'POST'; this.body = payload; if (options?.onConflict) this.params.set('upsert', options.onConflict); return this; }
  update(payload: Record<string, unknown>) { this.method = 'PUT'; this.body = payload; return this; }
  delete() { this.method = 'DELETE'; return this; }

  private async execute(): Promise<Result<any>> {
    try {
      const query = this.params.toString();
      const suffix = query ? `?${query}` : '';
      const payload = await request<{ data: T[] | T | null; count?: number | null }>(`/data/${this.table}${suffix}`, {
        method: this.method,
        ...(this.method === 'GET' || this.method === 'DELETE' ? {} : { body: JSON.stringify(this.body ?? {}) }),
      });
      // The API always answers with an array of rows; single()/maybeSingle() must unwrap the first row,
      // otherwise callers receive an array where they expect an object (e.g. settings.id === undefined).
      const rows = Array.isArray(payload.data) ? (payload.data as T[]) : payload.data ? [payload.data as T] : [];
      const baseData = this.singleMode ? rows.slice(0, 1) : rows;
      const hydrated = await hydrateRelations(this.table, baseData, this.params.get('select'));
      const data = this.singleMode ? (hydrated[0] ?? null) : hydrated;
      return { data, error: null, count: payload.count };
    } catch (error) {
      return { data: [], error: error as Error, count: null };
    }
  }

  then<TResult1 = Result<any>, TResult2 = never>(onfulfilled?: ((value: Result<any>) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

async function hydrateRelations(table: string, rows: any[], selection: string | null) {
  if (!selection || !selection.includes('(') || !rows.length) return rows;
  const relations = [...selection.matchAll(/([a-z_]+)\(/g)].map((match) => match[1]).filter((relation) => relation !== table);
  const relationMap: Record<string, string> = { students: 'student_id', subjects: 'subject_id', classes: 'class_id', teachers: 'teacher_id', terms: 'term_id', academic_sessions: 'session_id' };
  for (const relation of relations) {
    const foreignKey = relationMap[relation];
    if (!foreignKey || !rows.some((row) => row[foreignKey])) continue;
    const ids = [...new Set(rows.map((row) => row[foreignKey]).filter(Boolean))];
    const response = await request<{ data: any[] }>(`/data/${relation}?in_field=id&in_values=${ids.map(encodeURIComponent).join(',')}&limit=5000`);
    const byId = new Map((response.data ?? []).map((item) => [item.id, item]));
    rows = rows.map((row) => ({ ...row, [relation]: byId.get(row[foreignKey]) ?? null }));
  }
  return rows;
}

export const api = {
  from<T = any>(table: string) { return new QueryBuilder<T>(table); },
  storage: {
    from(bucket: string) {
      return {
        async upload(path: string, file: File, _options?: { upsert?: boolean; contentType?: string }) {
          const form = new FormData(); form.append('file', file); form.append('bucket', bucket); form.append('path', path);
          try { const response = await request<{ data: { publicUrl: string } }>(`/uploads`, { method: 'POST', body: form }); uploadedUrls.set(`${bucket}/${path}`, response.data.publicUrl); return { error: null }; }
          catch (error) { return { error: error as Error }; }
        },
        getPublicUrl(path: string) { return { data: { publicUrl: uploadedUrls.get(`${bucket}/${path}`) ?? `${API_URL}/files/${path}` } }; },
      };
    },
  },
};

export interface LoginResponse { user: AppUser; token: string }

export async function apiLogin(email: string, password: string): Promise<LoginResponse> {
  const response = await request<LoginResponse>('/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  localStorage.setItem(TOKEN_KEY, response.token);
  return response;
}

export async function apiReportCard<T = any>(studentId: string, sessionId: string, termId: string): Promise<T[]> {
  const response = await request<{ data: T[] }>(`/report-card/${encodeURIComponent(studentId)}/${encodeURIComponent(sessionId)}/${encodeURIComponent(termId)}`);
  return response.data ?? [];
}

export interface ReportBundle {
  student: import('./types').Student;
  className: string;
  armName: string;
  settings: import('./types').SchoolSettings | null;
  session: import('./types').AcademicSession | null;
  term: import('./types').Term | null;
  results: any[];
  termRemark: import('./types').TermRemark | null;
  gradeBands: import('./types').GradeBand[];
  traits: import('./types').AffectiveTrait[];
  ratings: import('./types').AffectiveRating[];
  allResults: any[];
  classStudents: Pick<import('./types').Student, 'id' | 'class_id' | 'arm_id'>[];
}

/** Complete report card (with correct class statistics) for any student. Staff only. */
export async function apiReportBundle(studentId: string, sessionId: string, termId: string): Promise<ReportBundle> {
  const response = await request<{ data: ReportBundle }>(`/report-bundle/${encodeURIComponent(studentId)}/${encodeURIComponent(sessionId)}/${encodeURIComponent(termId)}`);
  return response.data;
}

export interface CheckerPeriod { session_id: string; session_name: string; term_id: string; term_name: string }
export interface CheckerInfo {
  student: { id: string; first_name: string; last_name: string; other_name: string; student_id: string; photo_url: string | null; class_name: string | null; arm_name: string | null };
  periods: CheckerPeriod[];
  school: { school_name: string; logo_url: string; motto: string; current_session_id: string | null; current_term_id: string | null } | null;
}

/** Public: verifies surname + token and lists the sessions/terms that have published results. */
export async function apiCheckerVerify(surname: string, token: string): Promise<CheckerInfo> {
  const response = await request<{ data: CheckerInfo }>('/public/check', { method: 'POST', body: JSON.stringify({ surname, token }) });
  return response.data;
}

/** Public: fetches one report card using surname + token. */
export async function apiCheckerReport(surname: string, token: string, sessionId: string, termId: string): Promise<ReportBundle> {
  const response = await request<{ data: ReportBundle }>('/public/report', { method: 'POST', body: JSON.stringify({ surname, token, session_id: sessionId, term_id: termId }) });
  return response.data;
}

/** Admin: creates result tokens for students that do not have one (or replaces them when regenerate is true). */
export async function apiGenerateTokens(options: { student_ids?: string[]; class_id?: string; arm_id?: string; regenerate?: boolean } = {}): Promise<{ generated: number; considered: number }> {
  const response = await request<{ data: { generated: number; considered: number } }>('/tokens/generate', { method: 'POST', body: JSON.stringify(options) });
  return response.data;
}

export interface PublicAppSettings { school_name: string; logo_url: string; motto: string; result_access_mode: 'portal' | 'token' | 'both' }

/** No auth required: lets the login page and the result checker know which mode the school has enabled. */
export async function apiPublicSettings(): Promise<PublicAppSettings> {
  const response = await request<{ data: PublicAppSettings }>('/public/settings');
  return response.data;
}

export async function apiForgotPassword(email: string): Promise<string> {
  const response = await request<{ data: { message: string } }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
  return response.data.message;
}

export async function apiResetPassword(token: string, password: string): Promise<string> {
  const response = await request<{ data: { message: string } }>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) });
  return response.data.message;
}

export function apiLogout() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem('srp_current_user'); }

export interface CreateUserPayload {
  email: string;
  password: string;
  display_name: string;
  role: 'admin' | 'teacher' | 'student' | 'parent';
  teacher_id?: string | null;
  student_id?: string | null;
  parent_id?: string | null;
}

/** Creates a login account. Always goes through this dedicated endpoint (never api.from('app_users').insert),
 *  since only this endpoint hashes the password server-side before it touches the database. */
export async function apiCreateUser(payload: CreateUserPayload): Promise<{ data: unknown; error: Error | null }> {
  try {
    const response = await request<{ data: unknown }>('/users', { method: 'POST', body: JSON.stringify(payload) });
    return { data: response.data, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

/** Updates a login account's profile fields and/or resets its password. Same reasoning as apiCreateUser. */
export async function apiUpdateUser(id: string, payload: Partial<Pick<CreateUserPayload, 'email' | 'display_name' | 'password' | 'teacher_id' | 'student_id' | 'parent_id'>>): Promise<{ data: unknown; error: Error | null }> {
  try {
    const response = await request<{ data: unknown }>(`/users/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) });
    return { data: response.data, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}
