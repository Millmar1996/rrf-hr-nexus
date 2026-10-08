import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

let browserClient: ReturnType<typeof createSupabaseClient<Database>> | undefined;
let cachedAccessToken: { token: string; expiresAt: number } | null = null;
let pendingAccessToken: Promise<string | null> | null = null;

export function clearAccessToken() {
  cachedAccessToken = null;
  pendingAccessToken = null;
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !publishableKey) {
    throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  }
  browserClient ??= createSupabaseClient<Database>(url, publishableKey, {
    accessToken: async () => {
      if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 30_000) return cachedAccessToken.token;
      if (pendingAccessToken) return pendingAccessToken;
      pendingAccessToken = (async () => {
        try {
          const response = await fetch("/api/auth/token", { cache: "no-store" });
          if (!response.ok) return null;
          const session = await response.json() as { access_token: string; expires_at: number };
          cachedAccessToken = { token: session.access_token, expiresAt: session.expires_at * 1000 };
          return session.access_token;
        } catch {
          return null;
        } finally {
          pendingAccessToken = null;
        }
      })();
      return pendingAccessToken;
    },
  });
  return browserClient;
}
