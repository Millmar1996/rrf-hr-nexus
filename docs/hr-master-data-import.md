# RRFMG HR master-data import readiness

**Status:** planning only. No RRFMG workbook has been imported, and source
headers have not yet been inspected. The column labels below are semantic
fields to map after the approved workbooks are supplied; they are not claims
about the workbooks' exact header text.

## Values awaiting source confirmation

Previously observed example-like values include Cedarline Logistics,
Northstar Retail, Pacific Ledger Co., Summit Health Group, Internal –
Tuguegarao, generic department/position labels, and similar Tuguegarao
location labels. They remain unreconciled. Do not treat them as RRFMG source
data or replace them with guesses. Match the approved workbook first, then
deactivate unsupported master values while preserving referenced history.

## Source-to-database field mapping

| Workbook / semantic source column (verify exact header) | Destination table.field | Normalization | Deduplication | Required / validation |
| --- | --- | --- | --- | --- |
| Employee Master List.xlsx — employee number / ID | `employees.employee_number` | Trim, preserve official punctuation/case | Case-insensitive normalized employee number; reject duplicates | Required; unique; report collisions before apply |
| Employee Master List.xlsx — first, middle, last, preferred name | `employees.first_name`, `middle_name`, `last_name`, `preferred_name` | Trim whitespace; preserve source spelling/diacritics | Match by employee number, never name alone | First/last required; other name fields optional |
| Employee Master List.xlsx — work email, contact number | `employees.email`, `contact_number` | Trim; lowercase email; preserve phone symbols and country prefix | Use employee number to identify record; report duplicate email | Optional; if present validate email/phone syntax |
| Employee Master List.xlsx — birthday / date of birth | `employees.birthday` | Parse explicit workbook date or approved date format; reject ambiguous dates | Employee number; do not create duplicate people from anniversary workbook | Optional in source; valid calendar date; do not future-date |
| Employee Master List.xlsx — hire date / date hired | `employees.date_hired` | Parse to ISO date; retain source date in dry-run evidence | Employee number | Required; valid date; compare with lifecycle hire event |
| Employee Master List.xlsx — regularization / probation-end date | `employees.regularization_date` | Parse to ISO date; blank remains null | Employee number | Optional; must not precede hire date without HR approval |
| Employee Master List.xlsx — department | `departments.name`, then `employees.department_id` | Trim/case-fold only for matching; preserve approved canonical label | Match normalized approved department name/code | Required for employee; unresolved values block row |
| Employee Master List.xlsx — position / job title | `positions.name`, `positions.department_id`, then `employees.position_id` | Trim; preserve official title | Match normalized title plus department | Required; department relation must resolve; never infer department |
| Employee Master List.xlsx — employment type | `employment_types.name`, then `employees.employment_type_id` | Map only to HR-approved controlled values | Canonical status/type mapping table; do not match status and type by same word | Required if source has it; unknown values block row |
| Employee Master List.xlsx — employment status | `employment_statuses.name`, then `employees.employment_status_id` | Map only to controlled status; separate status from employment type | Canonical mapping plus HR approval for ambiguous values | Required; separated employees must be reconciled to lifecycle history |
| Employee Master List.xlsx — immediate supervisor / manager employee number | `employees.supervisor_employee_id` | Resolve exact employee number after employee IDs are staged | Employee number, not supervisor name | Optional; referenced employee must resolve; reject cycles for review |
| Employee Master List.xlsx — branch / work site / location | `locations.name` and `employees.work_location_id` | Map to an approved canonical location/code | Normalized location code/name | Optional if one branch is confirmed; unknown site blocks row |
| Client Responsibilty Assignment.xlsx — employee number / ID | `employees.employee_number` lookup and `employee_client_assignments.employee_id` | Trim and normalize employee number | Employee number | Required; must resolve to exactly one employee |
| Client Responsibilty Assignment.xlsx — client / account name | `clients.name`, `employee_client_assignments.client_id` | Trim; preserve official approved name and code | Match approved client code first, normalized name second | Required for assigned rows; unresolved names block row |
| Client Responsibilty Assignment.xlsx — assignment start / effective date | `employee_client_assignments.start_date` | Parse to ISO date | Employee ID + client ID + start date | Required; cannot overlap another current allocation; validate against hire date |
| Client Responsibilty Assignment.xlsx — assignment end / inactive date | `employee_client_assignments.end_date` | Blank maps to null/current; otherwise ISO date | Same employee/client/start identity | Optional; cannot precede start date |
| 201 List of Requirements.xlsx — requirement/document name | `document_types.name` | Trim; preserve approved title | Normalized name plus category | Required for each requirement; never delete rows already referenced |
| 201 List of Requirements.xlsx — category / group | `document_types.category` | Map to approved controlled category | Name + category | Required if source distinguishes groups; otherwise HR assigns during review |
| 201 List of Requirements.xlsx — required / conditional / not applicable rule | `document_types.is_required` plus exemption workflow | Map explicit source wording; do not infer optionality | Match canonical requirement row | Required decision for every requirement; HR approval required |
| 201 List of Requirements.xlsx — expiry / renewal rule | `document_types.supports_expiry` | Convert explicit renewal/validity statements to boolean | Match canonical requirement row | Required decision for expiry-capable requirements; confirm with HR |
| 201 List of Requirements.xlsx — display order / notes | `document_types.display_order`, `description` | Preserve approved order and concise notes | Requirement identity | Optional; notes do not substitute for the requirement name |
| Seating Plan 07.22.2026.xlsx — seat/workstation code | `resources.resource_code` | Trim; preserve exact official code | Case-insensitive normalized code; reject duplicates | Required; unique |
| Seating Plan 07.22.2026.xlsx — seat type / equipment category | `resource_types.name`, `resources.resource_type_id` | Map to approved type values | Normalized type name/code | Required; unknown type blocks row |
| Seating Plan 07.22.2026.xlsx — site / room / location | `locations.name`, `resources.location_id` | Map to canonical approved location | Location code/name | Optional only if location is genuinely unspecified |
| Seating Plan 07.22.2026.xlsx — assigned employee number | `employees.employee_number`, `resource_assignments.employee_id` | Trim and resolve after employee staging | Resource code + employee number + assignment date | If occupied, must resolve to one employee; reject duplicate active assignments |
| Seating Plan 07.22.2026.xlsx — availability / condition | `resources.status`, `resources.condition` | Map source values to controlled enums; unknown states flagged | Resource code | Optional only when source omits it; do not infer available from blank |
| Anniversary & Birthday.xlsx — employee number/ID, if present | `employees.employee_number` lookup | Normalize employee number | Employee number | Preferred key; if missing, require HR review of normalized name and department |
| Anniversary & Birthday.xlsx — birthday | `employees.birthday` | Parse to ISO month/day/year; compare with Employee Master List | Employee number | Cross-check; conflict blocks automatic import until resolved |
| Anniversary & Birthday.xlsx — hire date / anniversary date | `employees.date_hired` | Parse to ISO date; compare with Employee Master List | Employee number | Cross-check only; do not create duplicated anniversary event rows |

Birthdays and work anniversaries are derived from `employees.birthday` and
`employees.date_hired`. The anniversary workbook is a validation/correction
source, not a separate calendar table. Document binaries are not imported from
the requirement list; actual employee files require a separately reviewed,
private-storage migration plan.

## Import order and dry run

1. Obtain the five approved source workbooks and preserve read-only originals.
2. Inventory exact sheet names, headers, formulas, merged cells, date formats,
   hidden rows, and row counts. Record checksums and file dates.
3. Produce a reviewed source-to-JSON/CSV mapping. Do not load directly from
   workbook rows into production.
4. Normalize and resolve master data first: departments, positions, clients,
   locations, employment types/statuses, document requirements, resource types.
5. Stage employee identities and validate unique employee numbers, names,
   dates, controlled-value mappings, manager references, and department/position
   links.
6. Stage client and resource assignments only after employee IDs resolve.
   Validate date ranges, one current client per employee, one current employee
   per resource, and valid resource status.
7. Reconcile anniversary/birthday dates against the employee master. Report
   conflicts rather than choosing a source silently.
8. Run a dry run that writes no application rows. Produce row counts, accepted
   rows, rejected rows, duplicate groups, unresolved references, date errors,
   and before/after expected totals. HR reviews and signs this summary.
9. Apply in a transaction/batched idempotent process using stable natural keys.
   Keep an import-batch identifier and row-level source provenance in a separate
   staging file; do not place workbook PII in Git.
10. Reconcile imported counts and representative records against the approved
    workbooks before opening the system for office use.

## Backup, rollback, and reconciliation

Before the eventual import, confirm the Supabase target ref is
`vdzvkezkvjpfrboqyrts`, confirm the Vercel target is the RRF HR Nexus project,
and ensure a recent restorable backup exists. A logical backup can be created
outside the repository with the linked Supabase CLI:

```sh
mkdir -p /secure/backups/rrf-hr-nexus
npx supabase@latest db dump --linked --file /secure/backups/rrf-hr-nexus/pre-import-YYYYMMDD-HHMM.sql
```

Restrict access to the backup because it contains sensitive records, encrypt it
at rest, and verify it is non-empty and readable. Also confirm the Supabase
project's point-in-time recovery/backup retention capability and restore
procedure before importing; do not assume it is enabled on the current plan.

Dry run first. For apply, keep a signed-off manifest with source workbook
checksum, batch ID, inserted/updated counts, and created row identifiers. If a
validation or reconciliation gate fails, stop the import transaction. If a
committed batch must be undone, use its batch manifest to remove only rows
created by that batch and restore prior values from the pre-import backup; do
not delete rows with subsequently created lifecycle, document, or assignment
history. For any broad/uncertain rollback, restore to an isolated recovery
project and reconcile before replacing production data. After import, compare
row counts, employee-number sets, department/position/client/resource totals,
date distributions, and sampled employee profiles against the source files.

The current `scripts/import-hr-master-data.mjs` supports a reviewed master-data
JSON dry run and explicit `--apply`; it does not import employee, document,
resource, seating, or anniversary data. Build and validate separate importers
for those relations before the real import. `SUPABASE_SERVICE_ROLE_KEY` must be
provided only through a protected process environment when applying; never put
it in a file, command history, report, or repository.
