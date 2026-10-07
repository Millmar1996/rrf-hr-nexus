import { createServerClient } from "@supabase/ssr";
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/supabase/database.types";

function matches(actual: string, expected: string | undefined) {
  if (!expected) return false;
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

export async function POST(request: NextRequest) {
  const usernameSetting = process.env.HR_ADMIN_USERNAME;
  const passwordSetting = process.env.HR_ADMIN_PASSWORD;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!usernameSetting || !passwordSetting || !url || !key) {
    return NextResponse.json({ error: "Sign-in is not configured. Contact the workspace administrator." }, { status: 503 });
  }

  let input: { username?: unknown; password?: unknown };
  try { input = await request.json(); }
  catch { return NextResponse.json({ error: "Enter your username and password." }, { status: 400 }); }
  const username = typeof input.username === "string" ? input.username.trim() : "";
  const password = typeof input.password === "string" ? input.password : "";
  if (!username) return NextResponse.json({ error: "Enter your username." }, { status: 400 });
  if (!password) return NextResponse.json({ error: "Enter your password." }, { status: 400 });
  if (!matches(username.toLowerCase(), usernameSetting.toLowerCase()) || !matches(password, passwordSetting)) {
    return NextResponse.json({ error: "Incorrect username or password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  const supabase = createServerClient<Database>(url, key, {
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 10,
    },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
    },
  });
  const internalEmail = `${usernameSetting.toLowerCase()}@rrf-hr-nexus.vercel.app`;
  const { error } = await supabase.auth.signInWithPassword({ email: internalEmail, password });
  if (error) return NextResponse.json({ error: "Incorrect username or password." }, { status: 401 });
  response.headers.set("Cache-Control", "no-store, private");
  return response;
}
