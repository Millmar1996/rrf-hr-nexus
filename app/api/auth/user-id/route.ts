import { createClient } from "@/lib/supabase/server";
import { isSameOriginRequest } from "@/lib/supabase/request-origin";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const headers = new Headers({
  "Cache-Control": "no-store, private, max-age=0",
  "Pragma": "no-cache",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
});

export async function GET(request: NextRequest) {
  if (!isSameOriginRequest({
    origin: request.headers.get("origin"),
    secFetchSite: request.headers.get("sec-fetch-site"),
    expectedOrigin: request.nextUrl.origin,
  })) return NextResponse.json({ error: "Request not allowed." }, { status: 403, headers });

  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "Sign in required." }, { status: 401, headers });
    const { data: profile, error: profileError } = await supabase
      .from("profiles").select("is_active").eq("id", user.id).maybeSingle();
    if (profileError || !profile?.is_active) return NextResponse.json({ error: "Sign in required." }, { status: 401, headers });
    return NextResponse.json({ user_id: user.id }, { headers });
  } catch {
    return NextResponse.json({ error: "Sign in required." }, { status: 401, headers });
  }
}
