import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const response = NextResponse.redirect(new URL("/signin?notice=signed_out", request.url), { status: 303 });
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
