# SECURITY DEFINER RPC security review

**Reviewed:** 2026-10-08

**Target:** Supabase project `vdzvkezkvjpfrboqyrts` (RRF HR Nexus only)

The remote catalog was queried for every public `SECURITY DEFINER` function.
All 13 functions use `search_path = ''`. After migration
`20261008000200_pre_import_security_hardening.sql`, execution is revoked from
`PUBLIC`, `anon`, and `service_role`. The 12 application RPCs are explicitly
granted to `authenticated`; the obsolete initial-admin bootstrap procedure is
owner-only. The PostgreSQL owner retains its normal owner capability. No
function is granted to `PUBLIC` or `anon`.

| Function | Purpose | Allowed application roles | Internal permission guard | EXECUTE after hardening | Fixed path | Public/anon |
| --- | --- | --- | --- | --- | --- | --- |
| `save_employee(uuid,jsonb,uuid)` | Create/update employee and assignment history | ADMIN, HR_MANAGER, HR_STAFF | `private.can_manage_hr_records()` | authenticated | Yes, empty | No |
| `archive_employee(uuid)` | Administrative archive | ADMIN, HR_MANAGER, HR_STAFF | `private.can_manage_hr_records()` | authenticated | Yes, empty | No |
| `record_lifecycle_event(uuid,lifecycle_event_type,date,jsonb,jsonb,text)` | Lifecycle transaction, including separation | ADMIN, HR_MANAGER, HR_STAFF | `private.can_manage_hr_records()` | authenticated | Yes, empty | No |
| `save_resource(uuid,text,uuid,uuid,text,resource_status)` | Create/update resource | ADMIN, HR_MANAGER, HR_STAFF | `private.can_manage_hr_records()`; now validates newly selected active type/location | authenticated | Yes, empty | No |
| `assign_resource(uuid,uuid)` | Assign/release a resource | ADMIN, HR_MANAGER, HR_STAFF | `private.can_manage_hr_records()` | authenticated | Yes, empty | No |
| `assign_employee_resources(uuid,uuid[])` | Synchronize employee resource assignments | ADMIN, HR_MANAGER, HR_STAFF | `private.can_manage_hr_records()` | authenticated | Yes, empty | No |
| `set_resource_condition(uuid,text,text)` | Update resource condition | ADMIN, HR_MANAGER, HR_STAFF | `private.can_manage_hr_records()` | authenticated | Yes, empty | No |
| `verify_employee_document(uuid)` | Verify uploaded 201 document | ADMIN, HR_MANAGER | `private.has_role(ADMIN, HR_MANAGER)` | authenticated | Yes, empty | No |
| `set_employee_document_review_status(uuid,text)` | Return document for correction/review | ADMIN, HR_MANAGER | `private.has_role(ADMIN, HR_MANAGER)` | authenticated | Yes, empty | No |
| `set_document_not_applicable(uuid,uuid,text,boolean)` | Waive/restore a requirement with reason | ADMIN, HR_MANAGER | `private.has_role(ADMIN, HR_MANAGER)` | authenticated | Yes, empty | No |
| `approve_access_request(uuid,app_role,text)` | Approve account role | ADMIN | `private.has_role(ADMIN)` | authenticated | Yes, empty | No |
| `reject_access_request(uuid)` | Reject account request | ADMIN | `private.has_role(ADMIN)` | authenticated | Yes, empty | No |
| `bootstrap_initial_admin(text)` | One-time initial profile provisioning | No normal application role | Requires confirmed configured email, one-time secret, exact Millmar account, and no existing profile | Owner only; authenticated grant removed | Yes, empty | No |

## Verification method and findings

The production catalog review checks function name/signature, `prosecdef`,
`proconfig`, and ACL. Source review checks the role predicates and operation
logic. `scripts/qa-role-permission-check.sql` additionally runs against the
linked project in a transaction, temporarily changes the existing profile's
role, calls RPCs with negative/invalid test values, confirms RLS policy
decisions, and ends in `ROLLBACK`. No temporary account or lasting Settings
row is created. The resulting checks cover Viewer denial, Staff/Manager
boundaries, and Admin access. They exercise PostgreSQL authorization rather
than relying on hidden UI controls.

The bootstrap procedure is not used by the production username/password login
and an Admin profile already exists. Its authenticated grant was removed. The
function body remains as owner-only migration-era recovery code; the app's
optional confirmation callback is not configured for the current login flow.

`employee_documents` also has an insert/type-change trigger that rejects an
inactive document requirement. Existing documents can keep a historical
reference if its document type is later deactivated.
