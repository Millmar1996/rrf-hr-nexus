import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

const emailOtpTypes = new Set<EmailOtpType>(["signup", "email", "magiclink", "recovery", "invite", "email_change"]);

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const supabase = await createClient();

  let error: Error | null = null;
  if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code);
    error = result.error;
  } else if (tokenHash && type && emailOtpTypes.has(type)) {
    const result = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    error = result.error;
  } else {
    error = new Error("Invalid confirmation link.");
  }

  if (!error) {
    const { data: auth } = await supabase.auth.getUser();
    const nextPath = url.searchParams.get("next");
    if (nextPath === "/auth/update-password") {
      return NextResponse.redirect(new URL(nextPath, request.url), { status: 303 });
    }
    const configuredAdmin = process.env.NEXUS_BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
    if (auth.user?.email && configuredAdmin && auth.user.email.toLowerCase() === configuredAdmin && process.env.NEXUS_BOOTSTRAP_SECRET) {
      const { error: bootstrapError } = await supabase.rpc("bootstrap_initial_admin", { p_secret: process.env.NEXUS_BOOTSTRAP_SECRET });
      if (!bootstrapError) return NextResponse.redirect(new URL("/dashboard", request.url), { status: 303 });
    }
    if (auth.user) {
      const { data: profile } = await supabase.from("profiles").select("is_active").eq("id", auth.user.id).maybeSingle();
      if (profile?.is_active) return NextResponse.redirect(new URL("/dashboard", request.url), { status: 303 });
    }
  }
  const destination = new URL("/signin", request.url);
  destination.searchParams.set("notice", error ? "confirmation_failed" : "email_confirmed");
  return NextResponse.redirect(destination, { status: 303 });
}
