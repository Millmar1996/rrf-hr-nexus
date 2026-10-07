# Database schema

Schema matches the linked Supabase project after migrations through `20261007020722`.

## Public tables

| Area | Tables | Purpose |
|---|---|---|
| Identity and access | `profiles`, `access_requests` | Active user role/branch; access request table remains from the previous multi-user workflow |
| Organization/master data | `departments`, `positions`, `employment_types`, `employment_statuses`, `clients`, `locations` | Reusable employee and client references |
| Employees | `employees` | Current employee attributes, supervisor relationship, archive state and regularization date |
| Lifecycle | `employee_lifecycle_events` | Append-only effective-dated events with previous/new JSON, actor and timestamp |
| Client history | `employee_client_assignments` | Effective-dated assignment history; active client has no `end_date` |
| Documents | `document_types`, `employee_documents` | Requirements and file metadata; file binary resides in private Storage |
| Resources | `resource_types`, `resources`, `resource_assignments` | Equipment inventory, current status and assignment/release history |
| Audit | `audit_logs` | Actor, action, entity id, timestamp and old/new JSON snapshots |

## Private schema and storage

`private` contains authorization helpers (`has_active_profile`, `has_role`, `can_manage_hr_records`), audit triggers, Auth signup capture, and the original `bootstrap_configuration`. The bootstrap table/RPC are not used by the current single-account login. The private `employee-documents` Storage bucket stores employee document binaries; the bucket is not public. Application rows store object paths and metadata, not public URLs.

## Relationships and constraints

- `employees.employee_number` is unique. Employee rows reference department, position, employment type/status, supervisor employee, and work location.
- Lifecycle events, client assignments, documents, and resource assignments reference their employee with restrictive history-preserving behavior.
- A partial unique constraint/index prevents multiple active client assignments per employee.
- Resource assignment history has a single active assignment per resource; RPCs update resource state with assignment events.
- `access_requests.user_id` references `auth.users`; `profiles.id` also maps to `auth.users.id`.
- Master data uses `is_active` so referenced values are archived/deactivated instead of removed.

## Security model

RLS is enabled on all public application tables. Active profiles can read the workspace. HR write paths require `ADMIN`, `HR_MANAGER`, or `HR_STAFF`; settings and role administration are Admin-only. Viewers receive read-only access. Access requests are restricted to the owner and Admin. Audit records have read policies but no application write policy. Storage object policies require an active profile to read and HR operational roles to insert, update, or remove files.

## Migration and seed

The linked database migration ledger is reproduced by `supabase/migrations/` in version order. `supabase/seed.sql` contains fictional Tuguegarao demonstration records only. It does not contain real RRFMG employee details or document binaries.
