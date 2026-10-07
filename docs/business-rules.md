# Business rules

- **Employee identity:** employee number is unique. Employee records are archived, never hard-deleted by normal HR workflows.
- **Lifecycle:** each recorded event stores its employee, enum type, effective date, before/after JSON, notes, actor, and database timestamp. The lifecycle RPC updates current employee fields when a new value is supplied.
- **Regularization:** only active/probationary employees with a regularization date are due. The event moves status to Active and employment type to Regular where those reference values exist.
- **Client assignments:** the active client is derived from the assignment with no end date. Reassignment ends the prior row and inserts a new row; history is retained.
- **Separation:** stores a Separation event and effective date, marks status Separated and archived, closes active client assignment, releases active resource assignments, and retains employee documents and history.
- **Rehire:** a Rehire event reactivates a retained employee and can establish a current client assignment.
- **201 compliance:** required active document requirements are joined to uploaded metadata. No file means Missing; expiry before today means Expired; expiry within 30 days means Expiring soon; otherwise Complete. Dashboard and reports use the same calculation. Binary files remain in private Storage.
- **Resources:** assignment history is append-only. Active assignment means Assigned; release returns the resource to Available. Maintenance and Inactive remain explicit non-assigned states.
- **Audit:** table triggers write actor, action, entity, old/new row data, and timestamp. Audit records are not editable through application policies.
- **Monthly workforce changes:** counts and affected employees are calculated from lifecycle records by effective date and event type for month/year or custom range; no summary rows are saved.
- **Upcoming dates:** birthdays and anniversaries are derived from employee birthday and hire date. Regularization alerts are derived from employment status and regularization date.
- **Master data:** department, position, employment type/status, client, location, document requirement, and resource type values are deactivated rather than deleted when no longer in use.
