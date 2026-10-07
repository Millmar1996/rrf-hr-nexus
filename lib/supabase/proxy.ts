import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const publicPaths = new Set(["/signin", "/signup", "/auth/confirm", "/auth/update-password"]);

function redirectToSignIn(request: NextRequest, response: NextResponse, notice: string) {
  const destination = request.nextUrl.clone();
  destination.pathname = "/signin";
  destination.search = "";
  destination.searchParams.set("notice", notice);

  const redirect = NextResponse.redirect(destination);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = response.headers.get(header);
    if (value) redirect.headers.set(header, value);
  }
  return redirect;
}

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // The local fictional demo still runs without Supabase configuration.
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
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
    if (claims?.sub) {
      const { data: existingProfile } = await supabase.from("profiles").select("is_active").eq("id", claims.sub).maybeSingle();
      if (existingProfile?.is_active) {
        const destination = request.nextUrl.clone(); destination.pathname = "/dashboard"; destination.search = "";
        const redirect = NextResponse.redirect(destination); response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie)); return redirect;
      }
    }
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

  return response;
}
