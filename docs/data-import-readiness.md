# RRF HR Nexus — Data Import Readiness

**Verification date:** 2026-10-08 (Asia/Manila)  
**Production URL:** https://rrf-hr-nexus.vercel.app/  
**Vercel project:** `millmar-s-projects/rrf-hr-nexus`  
**Supabase project ref:** `vdzvkezkvjpfrboqyrts`  
**Application hardening commit:** `97b28df` (`security: harden pre-import access and master validation`)  
**Real RRFMG records imported:** No

## Final verdict

**READY FOR DATA IMPORT**

The current application passed production checks for authentication routing,
the HR database role guards, inactive master-data enforcement, archive-only
semantics, monthly report period isolation, report preview and exports, and
private document storage. No actual RRFMG employee, client, 201, or seating
records were loaded.

This verdict means the application is ready to begin a controlled, approved
data import. It does not mean the source workbooks have been reconciled: the
five named workbooks were not available to inspect, so their exact sheets,
headers, dates, and row-level exceptions still require a reviewed dry run and
HR approval before applying any data.

## Authentication regression

Production browser verification confirmed:

- Logged-out `/`, `/dashboard`, and `/employees` resolve to `/signin`.
- Invalid credentials show the generic “Incorrect username or password”
  message.
- Valid administrator login reaches `/dashboard`; refresh preserves the
  session; authenticated `/signin` redirects to `/dashboard`.
- Sign-out returns to `/signin`; opening `/dashboard` afterward returns to
  `/signin`.
- The signed-out `/signin` page made **0** requests to `/api/auth/token` during
  the observed wait; no repeated 401 token-request loop occurred.

The authenticated session remains backed by the existing HttpOnly cookie
flow. No authentication rewrite was made.

## Browser-token mitigation

The authenticated token bridge remains because the current browser Supabase
client performs HR reads and writes directly against Supabase under RLS. The
bridge was narrowed: `/api/auth/token` rejects cross-origin browser requests,
is marked private/no-store, and returns only the access token and expiry. The
store uses a separate session-validated `/api/auth/user-id` endpoint when it
only needs the acting user ID. The browser does not persist the token in
localStorage or sessionStorage.

This reduces unnecessary exposure but does not eliminate the access token from
browser JavaScript memory. An XSS in the authenticated application could use
the token until it expires, subject to the user's database role and RLS. Moving
all data access behind server actions/handlers remains a future security
improvement; the current role guards and RLS passed the checks below.

## Role / RLS verification

No temporary Supabase Auth users were created. Public signup is disabled, and
the available project setup did not provide a safe Auth user-provisioning
credential. Instead, `scripts/qa-role-permission-check.sql` temporarily changes
the existing Admin profile role inside one production database transaction,
sets the authenticated database role, tests guarded RPCs and Settings RLS, then
rolls back all changes.

Production transaction assertions passed:

| Role | Result |
| --- | --- |
| VIEWER | Can read allowed employee rows; cannot execute employee, archive, lifecycle, resource, document-management, access-approval, or bootstrap mutations; cannot insert Settings data. |
| HR_STAFF | Can manage operational employee records/resources; cannot verify documents, approve access, or write Settings. |
| HR_MANAGER | Can perform management operations including document verification; cannot approve access or write Settings. |
| ADMIN | Retains operational and Settings write access. |

These are direct database authorization tests, not UI-only hidden-button
checks. No lasting role change or Settings row remained. Real separate-user
sign-in and rendered UI role behavior were not exercised; the database policy
and RPC authorization boundary was.

## RPC security review

All 13 public `SECURITY DEFINER` functions were reviewed against the live
Supabase catalog and source. Every function has a fixed empty `search_path`.
`PUBLIC`, `anon`, and `service_role` execution grants were removed. The 12
application RPCs are executable by `authenticated` and enforce role checks
internally. `bootstrap_initial_admin` is owner-only. The role transaction
tested the denials and permissions described above.

The full function-by-function purpose, allowed roles, guard, grants, and
search-path record is in [rpc-security-review.md](rpc-security-review.md).

## Master-data active-state result

The active-only option helper covers Departments, Positions, Employment Types,
Employment Statuses, Clients, Locations, Document Requirements, Resource
Types, and Separation Types. Existing records retain inactive labels for
historical display. Ten local HR regression tests passed, including active
selection and retention of the currently selected inactive value.

The production rollback-only test created QA-only values and confirmed that
inactive departments, positions, employment types/statuses, clients,
locations, document requirements, resource types, and separation types are
rejected by the corresponding server-side validation/trigger. The transaction
was rolled back. No master values were permanently created by this test.

## Archive-only behavior

Archive means administrative hiding/deactivation; it is not separation.
The production rollback-only test archived a QA employee without separation
and confirmed:

- Active employee headcount excludes the archived employee.
- Current client-allocation totals exclude the archived employee.
- The open client assignment remains attached to the archived record for
  historical inspection.
- The open resource assignment remains; the resource stays Assigned and is not
  falsely counted as available until HR releases it or records separation.
- The employee row remains accessible.

The exact distinction is documented in [business-rules.md](business-rules.md).
The test transaction rolled back; no archive QA employee or assignments
persisted from this pass.

## Empty-month report result

Generated April 2035 in production. Preview, XLSX, and PDF showed zero new
hires, regularizations, promotions, transfers, client reassignments, and
separations. The period contained no QA employee names or stale October 2026
events. The normal report sections rendered with explicit empty-period
messages.

## Second-month report result

Generated October 2026 after April 2035, independently in the report UI.
October data did not bleed into April, and April data did not replace the
October report. The existing `QA TEST Retest Employee` showed the October
promotion, regularization, client reassignment, and separation. The structured
client pair was QA Retest Client A → QA Retest Client B; regularization was
Probationary → Regular; promotion and separation values were present.

The report UI was switched to each period and the Excel/PDF download controls
were clicked for both periods. Downloaded files were parsed after generation.

## Excel result

All four production downloads opened as valid XLSX workbooks with eight
worksheets:

- April 2035: period label correct, zero lifecycle movements, no QA retest
  employee or stale October event.
- October 2026: period label correct, QA employee and all tested movements
  included, structured client A/B values present, and no blank new lifecycle
  value.

The UI-triggered populated workbook contained both QA client names and the
correct period. The empty workbook contained no QA retest record.

## PDF result

All four production downloads opened as valid PDFs. The empty April report was
2 pages; the populated October report was 3 pages. Both had the correct title,
period, and report sections, and neither contained sidebar/navigation text or
an accidental blank page. The empty report had no QA employee names or
movements.

The October report contained the QA employee, promotion, regularization,
client reassignment, and separation. PDF text extraction places long table
cells on separate lines; the Previous and New columns visibly contained QA
Retest Client A and QA Retest Client B respectively. No blank “New” value was
observed.

## Private-storage result

A harmless QA PDF was uploaded to the private `employee-documents` bucket.
Authenticated signed URL creation returned 200, and reading the signed URL
returned 200. The anonymous public object URL was rejected (HTTP 400). The QA
document metadata and Storage object were then deleted (204 and 200); a follow-
up public object request confirmed the object was unavailable. No QA file
remains from this pass.

## Regression test count/result

- `npm run test:hr-regressions`: **10/10 passed**.
- The suite covers structured regularization/client values, separation value
  formatting, full-name search, exact regularization/resource filters,
  archived allocation rules, all inactive master categories, and token origin
  policy.
- `scripts/qa-role-permission-check.sql`: **PASS**, production transaction
  rolled back.
- `scripts/qa-master-active-check.sql`: **PASS**, production transaction
  rolled back.
- `scripts/qa-archive-only-check.sql`: **PASS**, production transaction
  rolled back.
- Authentication routing/session, empty/populated report UI, UI exports,
  private upload/signed read/anonymous denial/removal, and responsive checks:
  **PASS** in production browser/API exercises.

## Import mapping readiness

`docs/hr-master-data-import.md` contains semantic source-column-to-table/field
mapping, normalization, deduplication, required/optional, and validation rules
for:

- `Employee Master List.xlsx`
- `Client Responsibilty Assignment.xlsx`
- `201 List of Requirements.xlsx`
- `Seating Plan 07.22.2026.xlsx`
- `Anniversary & Birthday.xlsx`

The exact workbook headers, sheet names, row counts, date formats, formulas,
and data-quality exceptions remain unverified because the source files were
not supplied or present in the project folders. Mapping must be reconciled to
the actual source headers during dry-run review.

## Backup and rollback plan

Before import, take and verify a protected Supabase logical backup outside the
repository; confirm the target project ref and available restore/PITR
capability. Keep source originals read-only with checksums. Run a no-write dry
run that reports accepted/rejected rows, duplicates, unresolved references,
date errors, and expected totals. Require HR approval before apply. Apply with
a unique batch manifest and row-level provenance. If validation fails, stop
before commit; if an applied batch needs rollback, use its manifest and backup
to reverse only that batch, or restore to an isolated recovery project for
reconciliation. The detailed steps and current importer limitations are in
[hr-master-data-import.md](hr-master-data-import.md).

## Remaining limitations

- **Leaked-password protection unavailable on current Supabase plan.** It was
  not represented as enabled. Enable it if/when the project moves to a plan
  that supports the feature; see [security-limitations.md](security-limitations.md).
- The browser still has short-lived authenticated access-token material in
  memory because current data operations use direct Supabase calls under RLS.
- Role-negative tests used a rollback-only database identity simulation, not
  temporary distinct Auth accounts and full per-role UI sessions.
- The original `docs/production-qa-audit.md` was not present in this checkout
  or repository history during this pass. The full available
  `docs/production-qa-retest.md` and its issue IDs were used as the prior
  evidence source; the missing original audit was not recreated or overwritten.
- The source spreadsheets were unavailable, so no exact header mapping or
  row-level reconciliation has been approved yet.
- Existing clearly labeled QA history remains in production from the prior
  retest. The temporary masters, employee, profile-role changes, document row,
  and Storage object created by this hardening pass were rolled back/deleted.

## Import decision

It is safe to proceed to the **controlled, dry-run import preparation** for
the approved RRFMG workbooks. It is safe to apply the real workforce data only
after the actual files are supplied, exact headers and mappings are reviewed,
the dry-run validation summary is approved, and the verified backup/rollback
gate is completed. No real RRFMG records were imported by this pass.
