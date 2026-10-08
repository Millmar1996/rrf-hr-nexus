# HR master-data and status rules

## Employee status

Employee status is the operational/employment stage, independent of employment
type. These are controlled values stored in `employment_statuses`:

| Value | Meaning | Employed for headcount? |
| --- | --- | --- |
| Active | Employed and not in probation/regularization stage | Yes |
| Probationary | Employed during probation; eligible for regularization monitoring | Yes |
| Regular | Employed after regularization | Yes |
| On Leave | Still employed but temporarily unavailable | Yes |
| Separated | Formal employment has ended; preserve record/history | No |
| Inactive | Temporarily disabled/archived record, not current headcount | No |

Status changes never delete employee records. Separation is recorded as a
lifecycle event and preserves the employee, documents, assignments, and history.
Rehire reactivates the retained employee record. A regularization event changes
the status to Regular and does not change the employment type.

Regularization history records prior and resulting employment-status IDs,
stable status codes, and labels in structured lifecycle event data. Notes remain
separate optional context and are never used as the new status value.

## Employment type

Employment type describes the contractual arrangement, not employment stage.
Initial configurable values are Full-time, Part-time, Contractual,
Project-based, and Intern / Trainee. HR administrators may add, edit, or
deactivate types. Legacy `Regular`, `Probationary`, and `Project Based` type
rows are retained for historical employee references but are not new choices.

## Organization, clients, and locations

Departments, positions, clients, and locations are relational master data.
Positions may be associated with one department; selecting a department filters
position choices. Inactive master records remain available on historical
profiles but cannot be assigned to new employee records. Client assignment is
optional and retains effective-dated history. Tuguegarao is the only known
company location seeded by this phase. No RRFMG-specific department, title, or
client is seeded until authoritative workbooks are available.

## Archive versus separation

Archiving is an administrative visibility change. It preserves the employee
record, open assignment rows, documents, and history; it does not represent an
employment termination. Current client allocation summaries count only open
assignments belonging to non-archived employees whose employment status is
marked employed. An archived employee may still show an open historical
assignment on their profile, clearly labeled as belonging to an archived
record.

Separation is the employment-ending transaction. It records a configured
separation type and effective date, sets the separated status and archived
state, closes the current client assignment, releases active resource
assignments, and retains all related history and documents. Monthly client
movement values are resolved from structured event data and the exact
effective-dated assignment pair; the prepared report data feeds the preview,
Excel, and PDF output.

## Lifecycle event types

The lifecycle event set is application-controlled so reports can rely on stable
meaning: Hire, Onboarding, Regularization, Promotion, Position Change,
Department Transfer, Location Transfer, Client Assignment, Client
Reassignment, Status Change, Leave Started, Returned from Leave, Separation,
and Rehire. The older Transfer value remains for compatibility with existing
history. Event types are not user-created settings.

## Separation types

Separation reason is stored separately from employee status. Initial editable
values are Resignation, Termination, End of Contract, Retirement, Redundancy,
and Other. Referenced types are deactivated rather than deleted.

## Document status

Document status is derived from requirement configuration and uploaded metadata:

- **Missing:** an active required requirement has no uploaded document.
- **Pending / For Verification:** an uploaded document is awaiting HR review.
- **Complete:** a verified document is present and not expired or within the
  30-day expiry window.
- **Expiring Soon:** expiry is within 30 days.
- **Expired:** expiry is before the current/reporting date.
- **Not Applicable:** HR has recorded that the requirement does not apply to
  the employee; it does not count as missing.

Expiry is derived from the expiry date, never manually entered as a status.
The authoritative 201 requirement names must come from `201 List of
Requirements.xlsx`; no RRFMG checklist is presumed here.

## Resources

Resource type and resource status are separate controlled concepts. Initial
resource types are Workstation / Seat, Desktop Computer, Laptop, Monitor,
Headset, and Other Equipment. Resource status values are Available, Assigned,
Reserved, Under Maintenance, and Retired. The old Inactive status is retained
for compatibility with existing rows and is not offered for new selection.

Condition is separate from status: Good, Needs Attention, or Damaged. An
Available resource may be assigned; Reserved, Under Maintenance, and Retired
resources may not. Assignment history is retained. Separated, inactive, or
archived employees cannot receive new resource assignments.

## Master-data maintenance

HR managers may add, edit, and deactivate reusable values. Referenced master
rows are not hard-deleted. Deactivated rows remain visible on existing employee
profiles/history but are omitted from new-entry choices. Employee number is
unique in the database as well as checked by the form.

## Source-data import

`Employee Master List.xlsx`, `Client Responsibilty Assignment.xlsx`, `201 List
of Requirements.xlsx`, and `Seating Plan 07.22.2026.xlsx` were not found in the
repository or the available project/download folders during this change. Do
not use fictional seed data as RRFMG truth. The reviewed JSON import process
for departments, positions, and clients is documented in
[`hr-master-data-import.md`](hr-master-data-import.md).
