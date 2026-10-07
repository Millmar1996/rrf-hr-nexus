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

## 2026-10-07 — Single-account sign-in and deployment

- Wired the existing sign-in design to server-side username/password validation using `HR_ADMIN_USERNAME` and `HR_ADMIN_PASSWORD`; removed the signup link and disabled the public signup route.
- Kept Supabase Auth as the session identity needed by the existing RLS-protected HR tables, Storage, and RPCs. Provisioned the one internal Millmar Agustin `ADMIN` identity without a mailbox or email confirmation step.
- Added an HTTP-only, `SameSite=Lax`, production `Secure` 10-hour session cookie, server token bridge for browser RLS requests, one common route guard, no-store protected responses, and logout cache clearing.
- Configured local ignored `.env.local` and Vercel Production, Preview, and Development environment variables. Production, authenticated route, session, and logout smoke results are recorded in `docs/testing.md`.
# 2026-10-07 — Monthly HR report and exports

- Added `/reports/monthly` with month/year selection, in-app preview, workforce movement details, 201 compliance, document expirations, resource movements, birthdays, anniversaries, regularization monitoring, and period comparison.
- Added shared authenticated report generation used by preview, Excel workbook, and printable A4 PDF endpoints. Exports are generated from Supabase records and do not persist monthly totals.
- Added workbook sheets for summary, workforce snapshot, new hires, lifecycle movements, client assignments, 201 compliance, resources, and people events.
- Documented Manila date boundaries and the historical snapshot limits of the existing document/resource schema.
- Tested the fictional October 2026 report locally and in production, then deployed commit `3934f54` to `https://rrf-hr-nexus.vercel.app`.

## 2026-10-07 — HR data consistency cleanup

- Confirmed the report and main HR workspace both query the linked Supabase database; no runtime localStorage, static employee fixture, or empty-database demo fallback was present.
- Identified that the source-of-truth itself still contained the fictional seed set. Removed its 22 employees and related lifecycle, client assignment, document, resource, resource assignment, and fixture audit rows, plus two private fixture files. Preserved schema, migrations, master data, Millmar's Admin profile, and access/profile audit history.
- Made empty compliance report/dashboard completion show 0% when there are no employees instead of implying that an empty population is fully complete.
- Clarified in docs that fictional data is explicit development seeding only; it is never created on app start or during Vercel builds.
