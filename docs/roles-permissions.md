# Roles and permissions

Profiles use the `ADMIN`, `HR_MANAGER`, `HR_STAFF`, and `VIEWER` enum. A confirmed Auth identity without an active profile cannot read workforce data or enter protected HR routes. Signup metadata never grants a role.

The current office login exposes one account: Millmar Agustin as `ADMIN`. Public account creation is disabled. Other roles remain enforced by existing RLS and RPC rules but cannot be added through the current sign-in UI.

| Role | Reads | Writes |
|---|---|---|
| ADMIN | All workspace data, private document metadata/files, audit, access requests and profiles | All HR records, settings, profiles/roles, access approvals, documents and resources |
| HR_MANAGER | Employees, lifecycle, assignments, documents, resources, settings references and audit | Employee/lifecycle/client/resource/document operations; no role or settings administration |
| HR_STAFF | Operational employee, lifecycle, client, document and resource data | Operational employee/lifecycle/assignment/document/resource operations; no master-data or role administration |
| VIEWER | Active-profile workforce data, document metadata/files and audit | None |

RLS enforces these permissions in PostgreSQL and Storage. Workflow RPCs repeat role checks because they run as `SECURITY DEFINER`; the Supabase advisor flags this callable shape, so any future RPC must retain explicit authorization checks and a fixed `search_path`. Audit rows are append-only to application roles. Access requests are visible only to the requesting identity and Admins; profile role changes are Admin-only.

`private.has_active_profile`, `private.has_role`, and `private.can_manage_hr_records` are the central policy helpers. Employee documents use a private bucket and signed URLs; Viewer access is read-only. Settings deactivation preserves referenced history instead of deleting master records.
