import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Operation {
  method: "GET" | "POST" | "PUT" | "DELETE";
  table: string;
  select?: string;
  filters: { column: string; op: string; value: string | string[] | null }[];
  order?: { column: string; ascending: boolean };
  limit?: number;
  count?: "exact";
  head?: boolean;
  maybeSingle?: boolean;
  single?: boolean;
  body?: Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const reqBody = req.method === "POST" || req.method === "PUT" ? await req.json().catch(() => ({})) : {};
    const op = reqBody as unknown as Operation;

    if (!op.table) return json({ error: "table is required" }, 400);

    let query = supabase.from(op.table);

    // Build query based on method
    if (op.method === "GET") {
      let q = query.select(op.select ?? "*");
      for (const f of op.filters) {
        if (f.op === "eq") q = q.eq(f.column, f.value as string);
        else if (f.op === "neq") q = q.neq(f.column, f.value as string);
        else if (f.op === "in") q = q.in(f.column, f.value as string[]);
        else if (f.op === "is") q = q.is(f.column, f.value as string | null);
        else if (f.op === "not_in") {
          // not.in is not directly supported; use filter
          const vals = (f.value as string[]).join(",");
          q = q.filter(f.column, "not.in", `(${vals})`);
        }
      }
      if (op.order) q = q.order(op.order.column, { ascending: op.order.ascending });
      if (op.limit) q = q.limit(op.limit);

      if (op.count === "exact" && op.head) {
        const { count, error } = await q.count("exact", { head: true });
        if (error) return json({ error: error.message }, 500);
        return json({ count, data: null }, 200);
      }
      if (op.count === "exact") {
        const { data, count, error } = await q.count("exact");
        if (error) return json({ error: error.message }, 500);
        return json({ data, count }, 200);
      }
      if (op.maybeSingle) {
        const { data, error } = await q.maybeSingle();
        if (error) return json({ error: error.message }, 500);
        return json({ data }, 200);
      }
      if (op.single) {
        const { data, error } = await q.single();
        if (error) return json({ error: error.message }, 500);
        return json({ data }, 200);
      }
      const { data, error } = await q;
      if (error) return json({ error: error.message }, 500);
      return json({ data }, 200);
    }

    if (op.method === "POST") {
      const { data, error } = await query.insert(op.body ?? {}).select();
      if (error) return json({ error: error.message }, 500);
      return json({ data }, 201);
    }

    if (op.method === "PUT") {
      let q = query.update(op.body ?? {});
      for (const f of op.filters) {
        if (f.op === "eq") q = q.eq(f.column, f.value as string);
        else if (f.op === "neq") q = q.neq(f.column, f.value as string);
      }
      const { data, error } = await q.select();
      if (error) return json({ error: error.message }, 500);
      return json({ data }, 200);
    }

    if (op.method === "DELETE") {
      let q = query.delete();
      for (const f of op.filters) {
        if (f.op === "eq") q = q.eq(f.column, f.value as string);
        else if (f.op === "neq") q = q.neq(f.column, f.value as string);
      }
      const { data, error } = await q.select();
      if (error) return json({ error: error.message }, 500);
      return json({ data }, 200);
    }

    return json({ error: "Method not supported" }, 405);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
