# Change log

## 2026-10-07 — Supabase foundation

- Added normalized PostgreSQL schema, RLS, private document Storage, fictional seed data, typed browser/server clients, and generated TypeScript database types.
- Added role helpers, access requests, and a one-time Admin bootstrap path. Signup does not grant roles.

## 2026-10-07 — Database-backed HR workflows

- Replaced the browser localStorage repository with Supabase workspace loading and write operations.
- Added database-backed employee create/edit/archive, lifecycle movements, client assignment history, regularization, resource assignments, private 201 document upload/download/removal, audit history, dynamic dashboard values, reports/CSV export, settings, and organization structure.
- Added workforce changes month/year/custom range reporting and global employee/reference/resource search.
- Added password reset and confirmation callback handling, plus per-role UI access controls backed by RLS and guarded RPCs.
- Applied workflow, audit, bootstrap, and permission-alignment migrations to the connected project; synced migration filenames and generated schema types.
- Configured Supabase URL/publishable-key environment values in Vercel Production and Development, plus a server-only bootstrap secret in Production.

## Remaining provider work

- Hosted Supabase Auth URL settings require a signed-in Supabase dashboard or Management API session, which was not available in this environment.
- GitHub is now linked to the Vercel project and Preview has the public Supabase connection variables.
- The first Admin email is not yet supplied, and live authenticated production QA cannot run until that account is active.
