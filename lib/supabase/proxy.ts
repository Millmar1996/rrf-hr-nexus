import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const publicPaths = new Set(["/signin", "/api/auth/login", "/api/auth/token"]);

function redirectToSignIn(request: NextRequest, response: NextResponse, notice: string) {
  const destination = request.nextUrl.clone();
  destination.pathname = "/signin";
  destination.search = "";
  destination.searchParams.set("notice", notice);

  const redirect = NextResponse.redirect(destination);
  redirect.headers.set("Cache-Control", "private, no-store, max-age=0");
  redirect.headers.set("Pragma", "no-cache");
  redirect.headers.set("Expires", "0");
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    if (publicPaths.has(request.nextUrl.pathname)) return NextResponse.next({ request });
    return redirectToSignIn(request, NextResponse.next({ request }), "temporarily_unavailable");
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 10,
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  // Refresh and verify the user's claims before making access decisions.
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (publicPaths.has(request.nextUrl.pathname)) {
    if (request.nextUrl.pathname.startsWith("/api/auth/")) return response;
    if (claims?.sub) {
      const { data: existingProfile } = await supabase.from("profiles").select("is_active").eq("id", claims.sub).maybeSingle();
      if (existingProfile?.is_active) {
        const destination = request.nextUrl.clone(); destination.pathname = "/dashboard"; destination.search = "";
        const redirect = NextResponse.redirect(destination); redirect.headers.set("Cache-Control", "private, no-store, max-age=0"); response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie)); return redirect;
      }
    }
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    return response;
  }
  if (error || !claims?.sub) return redirectToSignIn(request, response, "signin_required");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", claims.sub)
    .maybeSingle();

  if (profileError) return redirectToSignIn(request, response, "temporarily_unavailable");
  if (!profile?.is_active) return redirectToSignIn(request, response, "access_pending");

  if (request.nextUrl.pathname === "/" || request.nextUrl.pathname === "/signup") {
    const destination = request.nextUrl.clone();
    destination.pathname = "/dashboard";
    destination.search = "";
    const redirect = NextResponse.redirect(destination);
    redirect.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}
