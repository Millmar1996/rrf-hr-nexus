# Auth and first administrator provisioning

Authentication identities live in `auth.users`; application permissions live in `public.profiles`. Signup captures a pending access request but never creates a role/profile. An account without an active profile cannot open HR routes or read workforce tables.

## First administrator

The application includes a one-time secure claim RPC. The server-only bootstrap secret is configured in Vercel Production and its hash is stored in a private database table. Once the administrator email is supplied, bind that exact address to `NEXUS_BOOTSTRAP_ADMIN_EMAIL` in Vercel Production. A signup with that address and the name `Millmar`, followed by email confirmation, invokes the RPC. It will create exactly one `ADMIN` profile and consume the secret hash. Passwords are set by the user through Supabase signup; no shared or generated password is needed.

The email is intentionally not invented. No administrator profile exists until that exact identity is known and confirmed. Later signup requests are reviewed in Settings → Access control by an active Admin.

## Hosted Auth callback configuration

The application uses `/auth/confirm` for email confirmation and password recovery. Add both of these redirect URLs to the connected Supabase Auth URL Configuration:

- `http://localhost:3000/auth/confirm`
- `https://rrf-hr-nexus.vercel.app/auth/confirm`

The local `supabase/config.toml` also allows `/auth/update-password` for local flows. Password resets first return to the confirmation handler, which validates the code and then redirects to the reset form. Keep the configured Site URL on the production deployment and allow local development explicitly.

The connected tools exposed project/database access, but not Supabase Auth URL Configuration. The CLI session is not authenticated and the available browser profile is not signed into Supabase, so this setting is the one provider-side operation that still needs an authenticated dashboard session.

## Environment variables

Vercel Production, Preview, and Development have `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Production also has `NEXUS_BOOTSTRAP_SECRET`. The secret is server-only, and no service-role key is used. The existing GitHub repository is connected to the Vercel project.
