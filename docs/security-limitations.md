# Security limitations and current controls

## Current controls

- Workspace routes are protected by the server-side Supabase session cookie
  and active-profile lookup.
- The Supabase publishable/anon key is public by design; no service-role key is
  present in browser code or the repository.
- The application uses RLS and role-guarded `SECURITY DEFINER` procedures.
- Employee documents remain in the private `employee-documents` bucket and are
  opened using short-lived signed URLs.
- `/api/auth/token` verifies the Supabase user and active profile, rejects
  cross-origin browser requests, sets `no-store`/`no-referrer` headers, and
  returns only the access token and expiry. The extra user ID was removed from
  that response; the mutation helper obtains only a verified user ID from
  `/api/auth/user-id`.
- The browser client keeps the access token in module memory until its JWT
  expiry and does not store it in `localStorage` or `sessionStorage`.
- Public signup is disabled. The current sign-in setup has one provisioned
  Admin identity; production multi-user sign-in and role-specific account
  screens have not been exercised with separate users.

## Residual browser-token risk

The browser still receives an authenticated Supabase JWT because this Stage 1
application performs direct Supabase reads, Storage calls, and RLS-protected
RPC writes from the browser. Same-origin checks and `HttpOnly` session cookies
reduce exposure routes, but they do not prevent an XSS or compromised same-origin
script from using the token until it expires. Its authority is bounded by the
authenticated profile's RLS policies; it is not a service-role credential.
Removing this residual risk requires moving direct database and Storage
operations behind server actions/route handlers, which is a broader data-access
change and was not done in this hardening pass to avoid disrupting working HR
flows. Keep dependencies current, maintain a restrictive Content Security
Policy, and plan server-side data access before production workforce records
are introduced.

## Authentication policy limitation

Leaked-password protection unavailable on current Supabase plan.

Enable it if the project upgrades to a plan that supports the control. This
limitation is not represented as enabled.

## Role test limitation

Temporary Auth identities could not be safely provisioned from this project:
public signup is disabled, the application exposes only the existing Admin
login, and no service-role/admin-user provisioning secret is configured for
this environment. The `qa:role-guards` production integration check instead
temporarily maps the existing Admin profile to each application role within a
single uncommitted database transaction, invokes the actual RLS helpers,
policies, and RPCs as the `authenticated` database role, and rolls everything
back. This verifies database enforcement without creating accounts or
persistent QA records. It does not test role-specific browser sessions or
separate-user session isolation.
