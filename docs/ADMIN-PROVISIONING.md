# HR Administrator sign-in

The office-stage deployment has one primary login, Millmar Agustin (`ADMIN`). The login page accepts the configured username and password. The server compares both values to `HR_ADMIN_USERNAME` and `HR_ADMIN_PASSWORD`; they are not included in client bundles or stored in browser storage.

## Session and Supabase identity

Supabase Auth remains the session identity provider because the existing HR tables, Storage bucket, and mutation RPCs enforce access through Supabase Auth claims and RLS. The username login maps to one internal, confirmed Supabase identity. That account has an active `ADMIN` profile named Millmar Agustin. No email is used for login, no confirmation email is required, and public signup is disabled.

The Supabase session is stored in a 10-hour `HttpOnly`, `SameSite=Lax` cookie (`Secure` in production). The browser only obtains a short-lived access token through a no-store server endpoint when it needs to query Supabase directly; the refresh session remains server-only. Logout clears the token held in memory and expires the server cookies.

## Environment variables

Set these values in ignored local `.env.local` and in Vercel Production, Preview, and Development:

- `HR_ADMIN_USERNAME`
- `HR_ADMIN_PASSWORD`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Only the Supabase URL and publishable key use the `NEXT_PUBLIC_` prefix. Never commit `.env.local` or expose the HR password to browser code. Changing the login password requires updating both `HR_ADMIN_PASSWORD` and the internal Supabase Auth password together. Change the temporary office password before using real employee information.

`/`, `/signup`, and every operational route are guarded by `proxy.ts`. Signed-in users visiting `/` or `/signin` go to `/dashboard`; signed-out users go to `/signin`. All app and redirect responses are marked `no-store` so Back navigation cannot restore a cached authenticated page.
