import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const { data: profile, error: profileError } = await supabase.from("profiles").select("is_active").eq("id", user.id).maybeSingle();
    if (profileError || !profile?.is_active) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const response = NextResponse.json({ access_token: session.access_token, expires_at: session.expires_at, user_id: user.id });
    response.headers.set("Cache-Control", "no-store, private");
    return response;
  } catch {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
}
