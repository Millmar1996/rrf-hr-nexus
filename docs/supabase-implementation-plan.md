# Supabase implementation plan

## Phase 0 audit

- The App Router has one optional catch-all page. `AppShell` selects the dashboard, employee directory/profile/form, lifecycle/client assignment, 201 files, resources, reports, settings, and auth screens from the pathname.
- `lib/types.ts`, `lib/seed.ts`, and `lib/store.tsx` define the current domain snapshot. `lib/repository.ts` persists that snapshot to browser `localStorage`.
- Employee CRUD, archive, lifecycle events, and resource assignment are demo-store actions. Client assignment is currently presented through the lifecycle module. The 201 checklist, document compliance values, and several dashboard/report alerts are hardcoded; binary document storage is explicitly absent.
- `/signin` and `/signup` are presentation-only. The shell displays a hardcoded Millmar identity.
- There is no Supabase SDK/client, SQL migration, Supabase CLI configuration, or Supabase environment variables in the local environment or current Vercel project.
- The Next.js production build and UI routes work. The Vercel project is `rrf-hr-nexus`; it currently has no environment variables.

## Implementation sequence

1. **Supabase foundation:** add typed browser/server clients, environment validation, SQL migrations for normalized master data and HR records, constraints, indexes, update/audit triggers, role helpers, and RLS. Apply migrations to the connected Supabase project and seed fictional records.
2. **Authentication and access:** implement Supabase email/password auth, profile provisioning, role checks, and protected server operations.
3. **Employees and master data:** replace the demo store with database-backed employee CRUD/archive and settings reference data.
4. **Operational records:** add lifecycle and client assignment history, regularization rules, resources/assignment history, then private document metadata and storage policies.
5. **Derived operations:** replace dashboard constants with database queries, add alerts, monthly workforce changes, reports, exports, and organization structure.
6. **Hardening and release:** test critical workflows and RLS, document outcomes, configure Vercel environment variables, deploy, and run production smoke checks.

## Data and security decisions

- Supabase Postgres is the system of record; browser storage is removed as a runtime source after each migrated workflow is stable.
- `auth.users` is the identity source. A `profiles` row holds display name, branch, and a controlled role. Role checks are enforced by policies and server operations, not only by UI visibility.
- Employee, lifecycle, client assignment, document metadata, resource, resource assignment, and audit records remain separate relational entities. Lifecycle/audit history is append-only from ordinary HR workflows; employees are archived rather than deleted.
- Employee documents use private object storage and signed access. Service-role credentials remain server-only.
- Demo seed rows use fictional names and non-routable `rrfmg.example` email addresses.

## Access needed to apply Phase 1

The repository has no Supabase project URL, anon key, database password, or Supabase CLI login. The Vercel project has no Supabase environment variables. The schema and migration can be prepared without these values, but applying it to the live project and testing authenticated flows require Supabase project access. Secrets must be entered through Supabase/Vercel secure settings or an interactive CLI login, never committed.
