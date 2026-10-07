import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";

export default async function Page({ searchParams }: { searchParams: Promise<{ notice?: string | string[] }> }) {
  let profile: { full_name: string; role: string } | null = null;
  const authConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
    process.env.HR_ADMIN_USERNAME && process.env.HR_ADMIN_PASSWORD,
  );
  const query = await searchParams;
  const notice = Array.isArray(query.notice) ? query.notice[0] : query.notice;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (data?.claims?.sub) {
      const result = await supabase
        .from("profiles")
        .select("full_name, role, is_active")
        .eq("id", data.claims.sub)
        .maybeSingle();
      if (result.data?.is_active) profile = { full_name: result.data.full_name, role: result.data.role };
    }
  } catch {
    // Supabase configuration is optional while the fictional local demo is in use.
  }
  return <AppShell profile={profile} notice={notice} authConfigured={authConfigured} />;
}
