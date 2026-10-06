# Stage 1 persistence and data model

The browser demo adapter (lib/repository.ts) implements the small HrRepository boundary used by the UI. Its localStorage snapshot is scoped to one browser and one origin; it is not a shared database and is not suitable for real personnel records. Vercel deployments keep this demo state in each viewer's browser. Stage 2 should replace the adapter with a server-side PostgreSQL repository and authenticated API actions.

## PostgreSQL entities

- User: identity, password/identity-provider reference, role (ADMIN, HR_MANAGER, HR_STAFF, VIEWER), enabled state, created/updated timestamps.
- Department, Position, EmploymentType, EmploymentStatus, Client: maintained reference lists.
- Employee: unique employee number, personal/contact fields, nullable references to position, department, manager, client, plus hired/status/type/location/regularization fields, archive timestamp, created/updated and actor references.
- EmployeeLifecycleEvent: employee FK, event type, effective date, previous/new values, notes, recorded timestamp and actor FK. Append-only after recording.
- DocumentType: required document category, active flag and optional expiry policy.
- EmployeeDocument: employee and type FKs, status, issue/expiry dates, storage provider and opaque object key. Do not store document bytes in a PostgreSQL row.
- Resource: unique resource code, type, location and status.
- ResourceAssignment: resource and employee FKs, assigned/released timestamps and assigning actor. Keep prior assignments for history.
- ActivityLog: actor, target entity and ID, action, timestamp and safe structured change details.

Use soft archive for employee records. Index employee number, status, department, client, lifecycle effective date, document status/expiry, and active resource assignment. Enforce unique employee/resource codes and one current assignment per resource. Keep created_at, updated_at, created_by, and updated_by on mutable records. Role authorization must be checked on the server for every write.

Stage 1's lifecycle and resource entities exist in the demo adapter. Server-side roles, document binaries, immutable audit storage and the PostgreSQL constraints belong to Stage 2.
