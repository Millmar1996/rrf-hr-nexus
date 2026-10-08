import { createClient } from "@/lib/supabase/server";
import { isSameOriginRequest } from "@/lib/supabase/request-origin";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const headers = new Headers({
    "Cache-Control": "no-store, private, max-age=0",
    "Pragma": "no-cache",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });
  if (!isSameOriginRequest({
    origin: request.headers.get("origin"),
    secFetchSite: request.headers.get("sec-fetch-site"),
    expectedOrigin: request.nextUrl.origin,
  })) return NextResponse.json({ error: "Request not allowed." }, { status: 403, headers });

  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const { data: profile, error: profileError } = await supabase.from("profiles").select("is_active").eq("id", user.id).maybeSingle();
    if (profileError || !profile?.is_active) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    return NextResponse.json({ access_token: session.access_token, expires_at: session.expires_at }, { headers });
  } catch {
    return NextResponse.json({ error: "Sign in required." }, { status: 401, headers });
  }
}
