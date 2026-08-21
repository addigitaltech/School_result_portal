/**
 * API client that proxies all database calls through the Supabase edge function.
 * The anon key JWT in .env is expired, so direct Supabase client calls fail.
 * The edge function uses the service role key (available in Deno.env) to access the database.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const FUNCTION_URL = `${supabaseUrl}/functions/v1/api`;

async function request<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${FUNCTION_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const text = await res.text();
  let data: unknown;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const errMsg = (data as { error?: string })?.error ?? `Request failed (${res.status})`;
    throw new Error(errMsg);
  }
  return data as T;
}

function buildQuery(params: Record<string, string | number | boolean | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

// ---- Auth ----
export interface LoginResponse { user: import('./types').AppUser }

export async function apiLogin(email: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

// ---- Generic data access ----
export interface DataResponse<T> { data: T[] | T | null; count?: number }

export async function apiSelect<T>(
  table: string,
  opts: {
    select?: string;
    filters?: Record<string, string | null>;
    order?: string;
    limit?: number;
    count?: 'exact';
    maybeSingle?: boolean;
    inField?: string;
    inValues?: string[];
  } = {},
): Promise<{ data: T[] | T | null; count?: number | null }> {
  const params: Record<string, string | number | boolean | null | undefined> = {};
  if (opts.select) params.select = opts.select;
  if (opts.order) params.order = opts.order;
  if (opts.limit) params.limit = opts.limit;
  if (opts.count) params.count = opts.count;
  if (opts.maybeSingle) params.maybeSingle = 'true';
  if (opts.inField) params.in_field = opts.inField;
  if (opts.inValues) params.in_values = opts.inValues.join(',');
  for (const [k, v] of Object.entries(opts.filters ?? {})) {
    params[k] = v === null ? 'null' : v;
  }
  const qs = buildQuery(params);
  return request<{ data: T[] | T | null; count?: number }>(`/data/${table}${qs}`);
}

export async function apiInsert<T>(table: string, row: Record<string, unknown>): Promise<T[]> {
  const res = await request<{ data: T[] }>(`/data/${table}`, {
    method: 'POST',
    body: JSON.stringify(row),
  });
  return res.data ?? [];
}

export async function apiUpdate<T>(table: string, id: string, row: Record<string, unknown>): Promise<T[]> {
  const qs = buildQuery({ id });
  const res = await request<{ data: T[] }>(`/data/${table}${qs}`, {
    method: 'PUT',
    body: JSON.stringify(row),
  });
  return res.data ?? [];
}

export async function apiDelete(table: string, id: string): Promise<boolean> {
  const qs = buildQuery({ id });
  await request<{ success: boolean }>(`/data/${table}${qs}`, { method: 'DELETE' });
  return true;
}
