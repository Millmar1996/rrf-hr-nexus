# RRF HR Nexus Production QA Retest

**Date:** 2026-10-08  
**Target:** https://rrf-hr-nexus.vercel.app/  
**Scope:** Repair pass for RRF-QA-004 through RRF-QA-016  
**State:** Repair migration applied to the linked HR project; production app retest is pending deployment.
**Production data changed:** Schema/function migration only; no employee, master-data, document, resource, or report test records were created during this pass.
**Real workforce data imported:** No.

## Summary

The audited lifecycle, dashboard, search, and tablet defects have local fixes and
targeted regression coverage. The `20261008000100` repair migration was applied
to the verified Supabase project `vdzvkezkvjpfrboqyrts` and its remote migration
ledger now matches the repository. No production app release has been made yet,
so the affected application workflows are not claimed as production-repaired.
Local lint, type checking, production build, and focused Chromium checks pass.

Supabase CLI authorization is active and the exact project ref was verified.
Enabling leaked-password protection was attempted through the Supabase Auth
management configuration and rejected with a plan restriction (Pro plan and
above). Vercel project inspection confirmed `rrf-hr-nexus`; the personal
portfolio project was not accessed or changed. Production app deployment and
workflow retest are still pending.

## Retest matrix

| Original issue | Local repair | Local evidence | Production retest |
| --- | --- | --- | --- |
| RRF-QA-004 Separation cannot save | The form selects an active separation type. The new `record_lifecycle_event` migration validates the type, sets Separated, closes client allocation, releases active resources, and retains history in one transaction. | Migration applied to the verified Supabase project; local TypeScript, lint, build, and regression tests pass. | **NOT RUN** — application deployment and end-to-end QA scenario pending. |
| RRF-QA-005 Client reassignment values reversed | Monthly report resolves previous/new values from the exact effective-dated assignment pair, with structured event values as the same formatter fallback. | Repair migration applied; regression test covers Client A → Client B; report, XLSX, and PDF share the prepared report result. | **NOT RUN** — application deployment and authenticated production workflow pending. |
| RRF-QA-006 Regularization loses new status | Event writes structured previous/new status IDs, stable codes, and labels; note text is separate. Historical events are backfilled when status labels can be resolved. | Repair migration applied; regression test covers Probationary → Regular. | **NOT RUN** — application deployment and authenticated production workflow pending. |
| RRF-QA-007 Inactive values selectable | Create/edit controls now use a shared rule: inactive values are omitted for new records and retained only when already selected on the record being edited. Server RPC validation remains authoritative. | Regression test covers inactive clients and employment types; source reviewed for departments, positions, statuses, clients, locations, document requirements, resource types, and separation types. | **NOT RUN** — production controls not retested. |
| RRF-QA-008 Activity omits lifecycle events | Profile Activity combines lifecycle events with system audit changes and suppresses duplicate lifecycle-generated audit rows. Separation reason is presented separately from status transition. | TypeScript, lint, build pass; UI test not run. | **NOT RUN**. |
| RRF-QA-009 Dashboard links too broad | Due/overdue employee counts use the same 30-day rule as the employee filter. Resource shortcut applies `filter=available` and workstation category. File alerts count affected employees and link to matching file filters. | Regression tests cover due dates and available status; route selectors reviewed. | **NOT RUN**. |
| RRF-QA-010 Full-name search fails | Shared normalized matching handles case and repeated whitespace; employee search includes combined first/middle/last name, employee number, department, role, client, and resource fields. | Regression test covers `QA TEST Employee`. | **NOT RUN**. |
| RRF-QA-011 Tablet employee directory overflow | Employee directory switches to the compact list at widths up to 1100px and constrains intermediate page/table widths. | Chromium measured document width at 1024, 900, 768, 640, and 390px; page `scrollWidth` equaled viewport width at each. | **NOT RUN** — production viewport measurements pending. |
| RRF-QA-012 Archived employee in client totals | Client allocation summaries count open assignments only for non-archived employees with an employed status. Open historical assignments remain visible on archived profiles. | Regression test covers archive/separation allocation rule; documented in `business-rules.md`. | **NOT RUN**. |
| RRF-QA-013 Bearer token returned to browser JS | No architecture rewrite was made because current client-side Supabase operations depend on the token bridge. This issue remains open for a server-action/RSC data-access migration. | Existing token endpoint and client dependency reviewed. | **OPEN — not repaired**. |
| RRF-QA-014 Leaked-password protection disabled | Enablement was attempted through the project Auth config API. Supabase rejected the change because leaked-password protection requires Pro plan or above. | Current setting remains disabled; no other Auth config was changed. | **OPEN — blocked by current Supabase plan**. |
| RRF-QA-015 SECURITY DEFINER role-negative testing | Static review found the 13 public RPCs restricted to `authenticated` and fixed `search_path`; operational mutations call role guards, settings/provisioning use Admin checks, document review/waiver functions use Admin/HR Manager checks. This is source review only. | Migration source review completed; names and source locations are listed below. | **OPEN — role identities and direct RPC denial tests not run**. |
| RRF-QA-016 Sign-in token request loop | Workspace provider now skips authenticated data loading on `/signin` and `/signup`. | Local Chromium observed 0 `/api/auth/token` requests while signed out on `/signin`; one 200 token response after sign-in. No browser console errors on sign-in, dashboard, or employee directory. | **NOT RUN** — production network request count not remeasured. |

## SECURITY DEFINER source review

Public RPCs reviewed in migration sources:

- `approve_access_request` — Admin guard.
- `archive_employee` — HR-record management guard.
- `assign_employee_resources` — HR-record management guard.
- `assign_resource` — HR-record management guard.
- `bootstrap_initial_admin` — authenticated caller plus bootstrap-secret guard.
- `record_lifecycle_event` — HR-record management guard; replacement migration also validates active master values and separation state.
- `reject_access_request` — Admin guard.
- `save_employee` — HR-record management guard.
- `save_resource` — HR-record management guard.
- `set_document_not_applicable` — Admin/HR Manager guard.
- `set_employee_document_review_status` — Admin/HR Manager guard.
- `set_resource_condition` — HR-record management guard.
- `verify_employee_document` — Admin/HR Manager guard.

Remote catalog query confirmed each of the 13 functions is `SECURITY DEFINER`,
has `search_path=""`, and grants execution to `authenticated` and `service_role`
only (with owner execution for `postgres`). No `PUBLIC` or `anon` grant was
present. This does not replace verification of RLS/storage policies or direct
negative tests under each application role; those remain required before data
import.

## Local verification

- `npm run test:hr-regressions` — pass (8 targeted tests).
- `npm run typecheck` — pass.
- `npm run lint` — pass.
- `npm run build` — pass.
- `git diff --check` — pass.
- `npm audit --omit=dev` — pass (0 production dependency vulnerabilities reported).
- Local Chromium: sign-in route loads, invalid credentials show the same generic
  message, configured administrator login reaches the dashboard, and the
  employee directory document width stays within the viewport at 1024, 900,
  768, 640, and 390px. The signed-out sign-in page made no token requests; the
  dashboard made one successful token request. No console errors or failed HTTP
  responses were observed on the dashboard/employee-directory checks.

## Outstanding production gate

Before production data import, deploy only to the verified `rrf-hr-nexus` Vercel
project and complete the production scenarios from the repair-pass request.
Create controlled QA role identities only if a safe provisioning path is
available, then remove them after role-negative tests. Leaked-password
protection requires a Supabase plan upgrade. Do not import RRFMG workforce data
before all production retests pass.

## QA data and cleanup

No records were created or edited during this local repair pass. Existing
production QA history was not modified. No production cleanup was performed.
