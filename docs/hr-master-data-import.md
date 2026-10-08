# HR master-data import

No RRFMG workbook was found in the repository or available project/download
folders during this implementation. Do not import guessed department, position,
client, 201-requirement, or seating values.

## Values awaiting source confirmation

The production QA audit found the following active, example-like client labels:

- Cedarline Logistics
- Northstar Retail
- Pacific Ledger Co.
- Summit Health Group
- Internal – Tuguegarao

It also found generic department/position values, three similar Tuguegarao
location labels, and five required document types. These are **unreconciled**;
do not treat them as approved RRFMG master data and do not replace them with
guessed values. After the source workbooks are approved, compare each existing
row with the authoritative source and deactivate unsupported values rather than
deleting referenced history.

| Source values | Destination | Reconciliation rule |
| --- | --- | --- |
| Department list | `departments` | Match normalized official name/code; preserve IDs and deactivate unsupported rows. |
| Position/title list and department mapping | `positions` | Match normalized title plus department; never infer a missing department. |
| Client responsibility assignment list | `clients`, then `employee_client_assignments` | Reconcile client identity first; import employee allocations only after employee IDs are validated. |
| Branch/site list | `locations` | Compare canonical names/addresses/codes; consolidate only after verifying references. |
| 201 List of Requirements | `document_types` | Confirm category, required flag, expiry behavior and display order with HR before replacing the current checklist. |
| Approved asset categories | `resource_types` | Preserve referenced IDs; deactivate unsupported categories rather than deleting them. |
| Approved separation reasons | `separation_types` | Map controlled reason labels; retain referenced inactive values for historical events. |

Before import, validate required columns, duplicate employee numbers, duplicate
master names/codes, department-position relationships, client assignment dates,
status/type mappings, supervisor references, document requirements, and
resource codes. Produce a dry-run discrepancy report and obtain HR sign-off.
Take a database backup, import in dependency order, then reconcile source and
database row counts and spot-check representative records. No automatic runtime
or deployment seed should create fictional employee records.

When the approved source workbooks are provided, prepare a reviewed UTF-8 JSON
file with this structure (the values below are intentionally empty):

```json
{
  "departments": [],
  "positions": [],
  "clients": []
}
```

Department and client entries may be strings or objects with `name`, optional
`code`, and optional `description`. Position entries use `title` or `name`, a
`department` name, and optional `description`. The importer trims labels,
deduplicates names case-insensitively, links positions to their department,
retains existing matching database records, and skips positions whose
department cannot be resolved.

Always inspect the source-to-JSON mapping and run a dry run first:

```sh
node scripts/import-hr-master-data.mjs --input /path/to/reviewed-master-data.json
```

Only apply after source review and a current database backup. The explicit
`--apply` mode requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` supplied
through the process environment; never put the service-role key in the JSON,
source tree, or shell history.

```sh
node scripts/import-hr-master-data.mjs --input /path/to/reviewed-master-data.json --apply
```

This importer intentionally does not import employees, documents, resources,
or seating assignments. Those need separate reviewed mappings and relationship
checks before being loaded.
