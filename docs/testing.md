# Testing log

## Automated checks

| Date | Check | Result |
|---|---|---|
| 2026-10-07 | `npm run typecheck` | Passed after final auth, resource, settings and report changes |
| 2026-10-07 | `npm run lint` | Passed with no warnings after resource search was wired |
| 2026-10-07 | `npm run build` | Passed; Next.js production build completed |
| 2026-10-07 | `git diff --check` | Passed |
| 2026-10-07 | `npm audit --omit=dev` | Passed: 0 production dependency vulnerabilities |
| 2026-10-07 | Production HTTP smoke | `/signin` and `/signup` returned 200; unauthenticated dashboard, employee, lifecycle, 201 files, resources, reports, and settings returned 307 to `/signin?notice=signin_required` |
| 2026-10-07 | Vercel production deploy | Ready and aliased to `https://rrf-hr-nexus.vercel.app` |

The full `npm audit` still reports five high findings through development-only `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`. GitHub's current advisory says all published `braces` releases through 3.0.3 are affected and no patched version is available; `npm audit fix` did not resolve it. No breaking framework downgrade or unreviewed fork override was applied.

## Supabase project checks

- Sixteen HR application tables and `access_requests` exist in the connected project; RLS is enabled on all public application tables.
- The project migration ledger matches all eight ordered migrations in `supabase/migrations/`.
- Fictional seed state: 5 departments, 11 positions, 4 employment types, 4 employment statuses, 5 clients, 2 locations, 20 employees, 20 client assignments, 22 lifecycle events, 24 resources, and 14 resource assignments. No real personnel records or binary files were added.
- `employee-documents` is a private bucket. Policies require an active profile for read and HR write permissions for upload/update/delete.
- Supabase security advisor after migrations: guarded authenticated `SECURITY DEFINER` RPCs are WARN findings; no unguarded data exposure finding was identified. The performance advisor's duplicate access/audit select policies and reviewed-by FK index were fixed in the last migration; unused indexes remain informational until query statistics accumulate.
- The Auth URL Configuration and a first admin profile are not yet configured. Therefore sign-up, sign-in, role enforcement with a real user, and file workflows cannot yet be run end-to-end against a real session.

## Application workflow verification

| Workflow | Status | Evidence / limitation |
|---|---|---|
| Employee CRUD, archive, lifecycle, assignments, resources, private document storage, dashboard, reports, settings | Implemented in Supabase-backed store and guarded RPC/RLS paths | Requires a provisioned signed-in admin for live UI interaction |
| Auth sign-up/sign-in/sign-out/session guard | Implemented | Hosted redirect allow-list and administrator identity are still pending |
| Workforce changes month/year/custom range | Implemented from lifecycle event records | Type/build checks pending final run |
| Desktop/mobile browser QA | Not completed | No browser session was available in connected account tools |
| Production primary workflow smoke test | Partially completed | Public auth pages and protected-route redirects pass. Sign-in and authenticated HR workflows await the first active Admin account. |

Do not describe unrun workflows as production-verified. Repeat browser and cross-feature scenarios after the first admin is provisioned.
