# System architecture

## Application

RRF HR Nexus is a Next.js App Router application using React and TypeScript. The approved red and white interface is retained. `lib/store.tsx` loads the authenticated workspace from Supabase and provides writes to the employee, lifecycle, resource, and document workflows. The former browser localStorage repository and in-app demo seed adapter have been removed; fictional data now lives only in the SQL seed script.

## Authentication and authorization

The current office-stage login has one username/password account. `/api/auth/login` validates `HR_ADMIN_USERNAME` and `HR_ADMIN_PASSWORD` server-side, then signs into the corresponding internal Supabase Auth identity. Supabase Auth is retained as the minimum necessary identity layer because PostgreSQL RLS, Storage policies, and guarded RPCs use its user claims. There is no public signup, email confirmation, recovery flow, OAuth, or MFA.

Supabase session cookies are HTTP-only, `SameSite=Lax`, `Secure` in production, and have a 10-hour lifetime. `proxy.ts` is the common route guard: it sends signed-out users to `/signin`, sends signed-in users away from `/signin` to `/dashboard`, and sends `/` to the right destination. Protected responses use `no-store`. The browser receives a short-lived Supabase access token from `/api/auth/token` only when it needs direct RLS-protected data access; the browser keeps it in memory and the refresh cookie stays HTTP-only. Logout invalidates the Supabase session, clears the in-memory token, and expires cookies.

`HR_ADMIN_USERNAME` and `HR_ADMIN_PASSWORD` are server-only environment variables. They are configured in local ignored `.env.local` and Vercel Production, Preview, and Development. The active profile is Millmar Agustin with the `ADMIN` role.

## Data and storage

PostgreSQL is authoritative. Normalized master data, employees, lifecycle history, client assignment history, documents, resources, resource assignment history, profiles, access requests, and audit records are in `public`. Private authorization helpers and the original one-time bootstrap configuration are in the non-exposed `private` schema. The bootstrap path is not part of the current login flow. RLS is enabled on application tables. The `employee-documents` bucket is private; uploaded file paths are stored as metadata and viewed through short-lived signed URLs.

Atomic employee, lifecycle, resource, and assignment changes use guarded database RPCs. Audit triggers capture important table changes. Dashboard and report values derive from loaded database records; monthly workforce changes are calculated from lifecycle history for the selected date interval.

## Deployments and configuration

The connected Supabase project has the nine ordered repository migrations applied, master data, and one active Admin profile with a corresponding confirmed internal Auth identity. The fictional transactional rows previously inserted from `supabase/seed.sql` were removed after confirming that all employees and related records were development fixtures. The production project now has no employee, lifecycle, client assignment, employee document, resource, or resource assignment rows. Public signup is blocked by a database trigger. The connected Vercel project has the Supabase URL/publishable key and server-only HR credentials in Production, Preview, and Development. GitHub is connected for branch deployments. The production URL is `https://rrf-hr-nexus.vercel.app`.

## Verified limits

- Authentication routes, cookies, protected redirects, and Supabase profile access passed local HTTP workflow checks. Production login/logout verification is recorded in `docs/testing.md`.
- Browser-level desktop/mobile interaction and real employee mutations were not part of this login-only task; previous HR CRUD implementation remains behind the new authentication gate.
- The database schema still contains multi-role and access-request structures from the previous phase. The current page exposes only the single configured HR Administrator login.
- Supabase security advisories report guarded `SECURITY DEFINER` RPC exposure to `authenticated`; RPC bodies enforce active role checks.
