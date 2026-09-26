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
  insert(payload: Record<string, unknown> | Record<string, unknown>[]) { this.method = 'POST'; this.body = Array.isArray(payload) ? payload[0] : payload; return this; }
  upsert(payload: Record<string, unknown> | Record<string, unknown>[], options?: { onConflict?: string }) { this.method = 'POST'; this.body = Array.isArray(payload) ? payload[0] : payload; if (options?.onConflict) this.params.set('upsert', options.onConflict); return this; }
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
      const data = this.singleMode ? (payload.data ? [payload.data as T] : []) : ((payload.data ?? []) as T[]);
      return { data, error: null, count: payload.count };
    } catch (error) {
      return { data: [], error: error as Error, count: null };
    }
  }

  then<TResult1 = Result<any>, TResult2 = never>(onfulfilled?: ((value: Result<any>) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null) {
    return this.execute().then(onfulfilled, onrejected);
  }
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
        getPublicUrl(path: string) { return { data: { publicUrl: uploadedUrls.get(`${bucket}/${path}`) ?? `${API_URL}/uploads/${path}` } }; },
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

export function apiLogout() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem('srp_current_user'); }
