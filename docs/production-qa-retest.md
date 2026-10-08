# RRF HR Nexus Production QA Retest

**Date:** 2026-10-08 (Asia/Manila)

**Production URL:** https://rrf-hr-nexus.vercel.app/

**Production Vercel project:** `millmar-s-projects/rrf-hr-nexus`

**Production deployment:** `rrf-hr-nexus-8pqnr2vsm-millmar-s-projects.vercel.app`

**Deployed commits:** `675f7b0`, `6dbeab9`

**Supabase project ref:** `vdzvkezkvjpfrboqyrts`

**Scope:** Production repair/retest for RRF-QA-004 through RRF-QA-016.
**Real RRFMG employee data imported:** No.

## Verdict

**NOT READY FOR DATA IMPORT.** The audited separation, lifecycle history,
client-reassignment report, dashboard filter, search, tablet overflow, and PDF
export defects were repaired and production-tested. Three launch gates remain:
the browser still receives a Supabase access token through `/api/auth/token`,
role-negative tests could not be run without safe temporary Auth identities,
and leaked-password protection is unavailable on the current Supabase plan.

The production deploy was made from the `rrf-hr-nexus` repository/project only.
The personal portfolio Vercel project was not accessed or changed.

## Retest matrix

| Original issue | Fix | Production result | Evidence |
| --- | --- | --- | --- |
| RRF-QA-004 Separation cannot save | Separation type is collected from active master data. The transaction records the event, sets Separated, archives the employee, closes its client allocation, releases active resources, and retains history/documents. | **PASS** | Created `QA TEST Retest Employee`, assigned QA client and workstation, then recorded Resignation effective 2026-10-08. Employee became Separated/archived; open client/resource assignments closed; profile remained available. |
| RRF-QA-005 Client reassignment values reversed | Monthly report and exports now use the event’s immutable structured previous/new client values, not current assignment queries. PDF movement output no longer duplicates client rows. | **PASS** | Production preview, XLSX `Client Assignments`, and PDF all show `QA TEST Retest Client A 20261008 → QA TEST Retest Client B 20261008`. The pre-fix production report was observed showing B → B. |
| RRF-QA-006 Regularization loses new status | Structured old/new status IDs, codes, and labels are stored in lifecycle data; notes remain separate. | **PASS** | Production row stores Probationary → Regular with both status IDs and codes. Profile history, Activity, monthly preview, XLSX, and PDF display the transition. |
| RRF-QA-007 Inactive values selectable | New-record selectors use active master values; inactive existing values remain displayable on historic records. | **PARTIAL** | Production Add Employee form omitted inactive `QA TEST Client`, inactive employment types, and later deactivated QA clients. The broad set of every master-backed control was not individually exercised. |
| RRF-QA-008 Activity omits lifecycle events | Profile Activity combines lifecycle entries and system audit changes while suppressing duplicate lifecycle audit rows. | **PASS** | The QA profile Activity and Employment history tabs displayed Promotion, Regularization, Client Reassignment, and Separation. Dashboard Recent activity showed the separation and other lifecycle events. |
| RRF-QA-009 Dashboard links too broad | Regularization and available-workstation destinations apply the same predicates as their displayed counts. | **PASS** | With one QA employee due by 2026-10-20, dashboard count was 1 and the filtered employee directory returned only that employee. Available workstation count was 1 and the filtered resource page returned the one available workstation. |
| RRF-QA-010 Full-name search fails | Search normalizes case/whitespace and searches combined employee name plus related fields. | **PASS** | Ctrl+K search for `QA TEST Search Employee 20261008` returned the exact employee and employee number. |
| RRF-QA-011 Tablet employee directory overflow | Directory switches to compact layout earlier and constrains page width. | **PASS** | Production `/employees` document `scrollWidth` matched viewport width at 1440, 1366, 1024, 900, 768, 640, and 390px. |
| RRF-QA-012 Archived employee in client totals | Current assignment totals exclude archived/non-employed employees; historical allocation rows remain. Separation closes open assignments. | **PARTIAL** | Production separation removed the QA employee from current allocation and released its workstation. Local rule regression passed for archived/non-employed status. Archive-only behavior with an open client assignment was not separately exercised in production. |
| RRF-QA-013 Bearer token returned to browser JS | No broad auth/data-access rewrite was made in this repair. | **OPEN — HIGH** | `/api/auth/token` remains available to browser JavaScript and returns Supabase session material. Authenticated operations still depend on the current token bridge. |
| RRF-QA-014 Leaked-password protection disabled | Attempted to enable through Supabase Auth project configuration. | **OPEN — MEDIUM** | Supabase returned a plan restriction: leaked-password protection requires Pro or higher. No unrelated Auth configuration was changed. |
| RRF-QA-015 SECURITY DEFINER role-negative tests unavailable | Static review retained role guards and least-privilege grants. | **OPEN — HIGH** | No safe temporary Auth-user provisioning path/service-role credential was available. Admin-only, HR Manager, HR Staff, and Viewer UI/RPC denial behavior is not represented as tested. |
| RRF-QA-016 Sign-in token request loop | Workspace loading skips public auth routes. | **PASS** | Production sign-in had no token requests while signed out; a valid administrator login reached Dashboard and subsequent token requests returned successfully. Invalid credentials showed the generic error. |

## Production workflow results

### Authentication and navigation

- `/`, `/dashboard`, and `/employees` redirected to `/signin` while logged out.
- Incorrect credentials remained on sign-in and displayed the generic “Incorrect
  username or password” message.
- Configured administrator sign-in reached Dashboard; refresh retained the
  session; authenticated `/signin` redirected to Dashboard; logout cleared the
  session and protected routes returned to sign-in.
- Primary tested routes loaded without a 404 or redirect loop. Browser checks
  recorded no uncaught page errors or unexpected failed responses during the
  lifecycle, dashboard, report, document, and responsive tests.

### Employee, lifecycle, clients, and resources

- Created the QA retest employee through Add Employee, then refreshed and
  revisited the profile. Its employee number, status, client, and resource
  persisted.
- Recorded Promotion (Operations Analyst → Operations Coordinator),
  Regularization (Probationary → Regular), Client Reassignment (QA client A → QA
  client B), and Separation (Regular → Separated, Resignation).
- The current employee state, profile Employment history, Activity, dashboard
  Recent activity, and monthly report reflected those events.
- Separation closed the active client assignment and resource assignment. The
  employee record and lifecycle history remained accessible.
- Archived a separate QA search/document test employee; its record remained
  accessible as an archived profile.

### 201 files and private storage

- Uploaded a harmless QA PDF to the private `employee-documents` bucket. The
  file appeared as “For Verification” on the employee checklist.
- Storage catalog confirmed the bucket is `public=false`. An unauthenticated
  request to the object path was rejected (HTTP 400); the authenticated UI
  opened a time-limited signed URL.
- Removed the QA file through the application. Both its document row and
  storage object were absent afterward. The temporary employee was archived.
- Expiring/expired-date recalculation and report consistency after a dated
  upload were not separately tested.

### Monthly HR report and exports

- Generated October 2026. The preview showed the QA regularization, promotion,
  reassignment, and separation with their effective dates and values.
- Exported and parsed a valid XLSX containing eight worksheets. `Client
  Assignments` contains the correct A → B pair; `Lifecycle Movements` includes
  previous/new values and separation type.
- Exported and parsed a valid three-page PDF. It contains the reporting period,
  lifecycle values, client A → B, and separation state/type without footer-only
  pages or duplicated client movement rows.
- Empty-period reporting and a second reporting month were not fully retested.

### Dashboard and responsive behavior

- The dashboard due-review number matched its filtered employee result. The
  available workstation number matched the filtered resources result.
- Dashboard lifecycle activity updated after the QA movement events.
- `/employees` had no document-level horizontal overflow at 1440, 1366, 1024,
  900, 768, 640, or 390px. This retest did not repeat every route at every
  viewport.

## Security review

- Supabase Auth sessions are server-cookie based for login and protected route
  gating. The browser token bridge remains a security concern and needs a
  server-side data mutation/read migration before treating access-token
  exposure as closed.
- The 13 reviewed public `SECURITY DEFINER` RPCs have `search_path=""`, no
  `PUBLIC`/`anon` execution grant, and role checks in the reviewed functions.
  This is catalog/source review, not a substitute for direct negative tests.
- Viewer/HR Staff/HR Manager/Admin role denial tests remain unverified. Public
  signup is disabled and this environment did not provide a safe admin user
  provisioning credential; no temporary staff identity was created.
- Leaked-password protection remains disabled due to the Supabase plan limit.
- The private document object URL was rejected without authentication; signed
  links are time-limited.

## Production data consistency

- Regularization event `previous_data` and `new_data` contain status UUIDs,
  stable status codes, and human labels. Profile and report/export values match.
- Client reassignment event retains client A and client B IDs/names. The
  production report/export correction now uses those event snapshots. Current
  assignment queries no longer rewrite the event's previous client.
- Separation event contains the previous Regular status, new Separated status,
  separation type ID/code/name, effective date, and separate notes.
- Separated employee has no open client or resource assignment. Historical
  assignment rows remain.
- Archived QA employees are not included in current employee/due counts.

## Local verification

- `npm run lint` — PASS.
- `npm run typecheck` — PASS.
- `npm run test:hr-regressions` — PASS (8 tests).
- `npm run build` — PASS.
- `git diff --check` — PASS.
- Local production-mode Chromium exported the October report; PDF parsing
  confirmed 3 pages and XLSX parsing confirmed 8 sheets and correct lifecycle
  values. Production browser export retest passed after deployment.

## QA data created and cleanup

Created only clearly labeled QA records:

- Employee `QA TEST Retest Employee` (`QA TEST RETEST-20261008`): separated and
  archived; lifecycle and assignment history retained.
- Employee `QA TEST Document Employee 20261008` (`QA TEST DOC-20261008`): test
  PDF removed from storage and metadata removed; employee archived.
- Employee `QA TEST Search Employee 20261008` (`QA TEST SEARCH-20261008`):
  search and due-filter checks completed; employee archived.
- Clients `QA TEST Retest Client A 20261008` and `QA TEST Retest Client B
  20261008`: deactivated; assignment history retained.
- Resource `QA TEST WS-20261008`: assignment released and resource marked
  Retired; resource/assignment history retained.
- Existing `QA TEST Employee` and `QA TEST Client` records from earlier QA were
  not edited or deleted.

No real RRFMG workforce/master/201 records were imported. QA lifecycle and
audit history is intentionally retained so the tested transaction remains
verifiable; the temporary uploaded file itself was removed.

## Required before data import

1. Move privileged HR reads/mutations behind server-side operations so the
   browser does not receive a broadly usable Supabase token.
2. Provision controlled QA role identities safely, then run UI and direct RPC
   negative tests for Admin, HR Manager, HR Staff, and Viewer.
3. Enable leaked-password protection after moving to a Supabase plan that
   supports it, or obtain an approved alternative policy.
4. Complete remaining report/date/expiry checks and production archive-only
   client-allocation check.
5. Reconcile active master values against RRFMG's approved source workbooks
   before importing actual personnel records.
