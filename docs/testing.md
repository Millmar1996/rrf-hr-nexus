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
| 2026-10-07 | Vercel Production auth smoke | Passed: production root and protected redirects, generic wrong-password response, valid Millmar login, Secure/HttpOnly/SameSite=Lax cookie, session token/profile/RLS access, signed-in dashboard and HR routes, signed-in redirect, logout and post-logout protection |
| 2026-10-07 | Vercel signup and identity check | Passed: `/signup` redirects to `/signin`; public Supabase Auth signup is rejected; production dashboard renders Millmar Agustin and Sign out; database retains one Auth user and one active profile |
| 2026-10-07 | Vercel deployment | Ready at `https://rrf-hr-nexus.vercel.app` from commit `b1f1cb9` |

The full `npm audit` has five high findings from one development-only ESLint dependency chain (`eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`). The current braces advisory has no patched version published, while the affected package is development-only; `npm audit --omit=dev` reports no production vulnerabilities. No breaking framework downgrade or unreviewed fork override was applied. See [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).

## Supabase project checks

- Sixteen HR application tables and `access_requests` exist in the connected project; RLS is enabled on public application tables.
- The project migration ledger matches all nine ordered migrations in `supabase/migrations/`.
- Fictional demo records remain in Supabase. The current administrator is a separate internal account; no real employee information or binary document was added.
- `employee-documents` is a private bucket. Policies require an active profile and appropriate HR role.
- The administrator profile is active (`Millmar Agustin`, `ADMIN`) and associated with one confirmed internal Supabase Auth identity. No public signup workflow is exposed.
- Supabase security advisor reports guarded authenticated `SECURITY DEFINER` RPCs as WARN findings; the functions perform explicit role checks and use a fixed search path.

## Monthly HR report checks

| Check | Expected result |
|---|---|
| Generate a month with recorded events | Preview movement categories and affected employees from lifecycle and dated assignment records |
| Generate an inactive month | Report still renders zero activity while showing the workforce, compliance, and resource sections |
| Select invalid month/year through API | Request is rejected with a friendly validation error |
| Export Excel | Workbook contains Monthly Summary, Workforce Snapshot, New Hires, Lifecycle Movements, Client Assignments, 201 File Compliance, Resource Summary, and People Events sheets |
| Export PDF | A4 business report includes section tables, generated-by metadata, and page numbering; it is not a webpage screenshot |
| Compare periods | Headcount and employment types are reconstructed from hire dates/lifecycle events; current documents and resource inventory are excluded from historical comparison |
| Verify privacy | Export does not include private file paths, storage URLs, document notes, or free-text separation notes |

### Monthly report execution results (2026-10-07)

| Check | Result |
|---|---|
| Local production-mode authentication | Wrong credentials returned 401; Millmar signed in successfully; unauthenticated report route redirected to `/signin` |
| October 2026 preview | Passed against live Supabase: 1 hire, 1 regularization, 1 promotion, 1 department transfer, 1 location transfer, 1 client reassignment, 1 separation, 1 expired document, 1 upcoming expiry, 1 resource assignment, 2 birthdays, and 2 anniversaries |
| Workforce snapshot | Passed: 22 total historical employee records, 21 active at period end, including one on leave, and one separated; 5 probationary and 15 regular by employment type |
| Cross-screen 201 consistency | Passed: report attention detail contains the same 21 active employees returned by the 201 files filtering rules; document status reference date differs by design (selected period end vs current date) |
| November 2026 no-activity month | Passed: zero lifecycle movement while report and workforce snapshot still generated |
| XLSX | Passed: valid workbook, all 8 expected worksheets, October hire row present, and hire date is an Excel date cell |
| PDF | Passed: non-empty PDF structure, expected report title and brand text, 9 pages with page numbering |
| Private document access | Passed: signed URL for fictional fixture document returned the private PDF successfully (HTTP 200) |
| Browser viewport sweep | Not completed: Playwright Chromium could not launch because the workstation lacks `libnspr4.so`; installing system browser dependencies requires interactive sudo authentication. Responsive rules were reviewed at the requested CSS breakpoints. |
| Vercel production report smoke | Passed at `https://rrf-hr-nexus.vercel.app`: root/protected routes redirect when signed out; Millmar login works; root and `/signin` route to dashboard after login; dashboard, employees, monthly report, resources, and settings return 200; October preview matches all fixture counts; Excel and PDF download successfully; sign out clears cookies and protected routes redirect again. |

The fictional October report fixtures are reproducible through `supabase/seed.sql` and `npm run seed:monthly-report-fixtures`. They include an October hire (Leah Mercado), existing October promotion (Maria Santos) and regularization (Angela Reyes), location and department transfers, a client reassignment, a separation (Ethan Moreno), birthdays, private uploaded NBI/medical document examples, and a workstation assignment. Fixtures use fictional data and are safe to re-run.

## Scope and remaining verification

| Area | Status | Evidence / limit |
|---|---|---|
| Login UI and server-side credential validation | Passed locally | Generic error for incorrect credentials; no credentials are embedded in frontend code |
| Session persistence, refresh, and logout | Passed locally | HTTP-only cookie survives multiple protected requests; signout expires it |
| Protected route middleware | Passed locally | Unauthenticated `/`, `/dashboard`, `/employees` redirect to `/signin`; all listed HR pages allow active session only |
| Authenticated HR CRUD workflows | Not re-tested in this auth-only task | Existing Supabase-backed workflows are preserved; this task verified authenticated profile/RLS access and page delivery |
| Desktop/mobile browser visual QA | Not performed | No design changes were made; tests used local and production HTTP workflows |
