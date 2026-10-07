# Supabase implementation record

The database-backed HR foundation and current single-account authentication setup are implemented. This file records what exists rather than tracking unfinished provider setup.

## Implemented

1. Normalized schema, RLS helpers and policies, private storage bucket, fictional seed, generated TypeScript types.
2. One server-validated username/password login, one active `ADMIN` profile (Millmar Agustin), HTTP-only session cookies, protected routes, and logout. Supabase Auth is used only to retain the existing database identity/RLS model. Public registration is disabled.
3. Database-backed employee create/edit/archive, dashboard, lifecycle movements, client assignments, regularization, resource inventory and assignment, private 201 documents, audit activity, settings, reports, CSV export, organization structure, and global search.
4. Vercel environment settings for Production, Preview, and Development; deployment and route/session smoke tests are recorded in `docs/testing.md`.

## Known limits

- The current sign-in UI supports only one administrator account. Additional users and role administration are intentionally unavailable from the login flow.
- Authenticated HTTP checks verify session persistence and RLS profile access. This task did not perform a full browser QA pass or repeat all HR mutation workflows.
- The database retains access-request and bootstrap schema from the previous multi-user design; the current login does not use those paths.
