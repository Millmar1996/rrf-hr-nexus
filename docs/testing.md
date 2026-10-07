# Testing log

## Checks run for single-account sign-in

| Date | Check | Result |
|---|---|---|
| 2026-10-07 | `npm run typecheck` | Passed |
| 2026-10-07 | `npm run lint` | Passed with no warnings |
| 2026-10-07 | `npm run build` | Passed; Next.js production build completed |
| 2026-10-07 | `git diff --check` | Passed |
| 2026-10-07 | `npm audit --omit=dev` | Passed: 0 production dependency vulnerabilities |
| 2026-10-07 | Local production-mode HTTP auth smoke | Passed: root/protected redirects; generic incorrect-credential response; valid login; `Secure`, `HttpOnly`, `SameSite=Lax` cookie; protected route access; signed-in `/signin` redirect; disabled signup; logout cookie clearing and post-logout redirect |
| 2026-10-07 | Local Supabase identity/RLS check | Passed: Millmar Agustin profile is active with `ADMIN`; the issued Supabase token can read the profile through RLS |
| 2026-10-07 | Public account creation | Passed: anonymous Auth signup was rejected by the database trigger; database still has one Auth user and one active profile |
| 2026-10-07 | Authenticated HR route smoke | Passed: dashboard, employees, lifecycle, 201 files, resources, reports, organization, and settings return 200 with authenticated session; responses are `no-store` |
| 2026-10-07 | Vercel Production smoke | Pending deployment of this auth change |

The full `npm audit` has five high findings in a development-only ESLint dependency chain (`eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`). `npm audit --omit=dev` reports no production vulnerabilities. No breaking framework downgrade or unreviewed fork override was applied.

## Supabase project checks

- Sixteen HR application tables and `access_requests` exist in the connected project; RLS is enabled on public application tables.
- The project migration ledger matches all nine ordered migrations in `supabase/migrations/`.
- Fictional demo records remain in Supabase. The current administrator is a separate internal account; no real employee information or binary document was added.
- `employee-documents` is a private bucket. Policies require an active profile and appropriate HR role.
- The administrator profile is active (`Millmar Agustin`, `ADMIN`) and associated with one confirmed internal Supabase Auth identity. No public signup workflow is exposed.
- Supabase security advisor reports guarded authenticated `SECURITY DEFINER` RPCs as WARN findings; the functions perform explicit role checks and use a fixed search path.

## Scope and remaining verification

| Area | Status | Evidence / limit |
|---|---|---|
| Login UI and server-side credential validation | Passed locally | Generic error for incorrect credentials; no credentials are embedded in frontend code |
| Session persistence, refresh, and logout | Passed locally | HTTP-only cookie survives multiple protected requests; signout expires it |
| Protected route middleware | Passed locally | Unauthenticated `/`, `/dashboard`, `/employees` redirect to `/signin`; all listed HR pages allow active session only |
| Authenticated HR CRUD workflows | Not re-tested in this auth-only task | Existing Supabase-backed workflows are preserved; this task verified authenticated profile/RLS access and page delivery |
| Desktop/mobile browser visual QA | Not performed | No design changes were made; tests used HTTP workflows |
