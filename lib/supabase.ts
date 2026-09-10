import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

export function getBrowserSupabase() {
  const current = config();
  if (!current) return null;
  browserClient ??= createClient(current.url, current.key);
  return browserClient;
}

export async function getSupabaseUser(request: Request) {
  const current = config();
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!current || !token) return null;
  const client = createClient(current.url, current.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  return error ? null : data.user;
}
