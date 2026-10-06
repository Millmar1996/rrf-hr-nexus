# RRF HR Nexus

RRF HR Nexus is a Stage 1 master's capstone application for centralized HR information and workforce monitoring at RRFMG's Tuguegarao branch. It reduces repetitive spreadsheet work by connecting employee records with lifecycle history, 201 file monitoring, resource assignments and reporting.

## Current stage

Stage 1 establishes the responsive application shell, design system, populated dashboard and the first employee management workflows. All employee names and records are fictional demo information.

## Stack

- Next.js 16 App Router and React 19
- TypeScript
- CSS design system with Lucide icons
- Browser demo repository behind a small persistence interface

## Run locally

Requires Node.js 20.9 or newer.

~~~sh
npm install
npm run dev
~~~

Open http://localhost:3000. Run npm run lint, npm run typecheck, and npm run build before deployment.

## Environment variables

Stage 1 needs no environment variables. .env.example documents the future DATABASE_URL. Never commit .env or credentials.

## Implemented modules

- Dashboard with workforce metrics, recent lifecycle activity, upcoming dates, 201 file completeness, resource status and quick actions.
- Employee directory with search, status, department, employment type and client filters, sorting, pagination, validated create/edit, profile views and archive.
- Employee profile tabs for overview, employment history, 201 checklist, resources and activity.
- Lifecycle events for hire, promotion, transfer, regularization, client reassignment and separation. New employee creation records a Hire event.
- 201 file completeness overview and employee document category checklist. File upload is intentionally disabled until storage is configured.
- Resource monitoring for workstations, computers and other equipment, with employee assignment.
- Reports overview for headcount, department, status, client, 201 completeness, lifecycle and resource utilization.
- Settings overview for organizational reference lists.

## Persistence and authentication limitations

There are no PostgreSQL credentials or storage configuration in this workspace. Stage 1 uses browser localStorage through lib/repository.ts. Saved changes are local to one browser and deployment origin; users do not share records across browsers, and browser storage must not hold real personnel data. Seeded demo data loads for a first-time browser.

Authentication and server-side authorization are not configured. The HR Administrator shown in the shell is a demo identity, not a secure login. Do not use real employee information on this deployment. docs/DATA_MODEL.md describes the planned PostgreSQL relationships and access-control requirements.

## Stage 2 recommendations

1. Provision PostgreSQL and replace the browser adapter with server-side repositories and migrations.
2. Add authenticated sessions, server-enforced Administrator / HR Manager / HR Staff / Viewer permissions, and audit logging.
3. Configure private document storage, access policies, retention and expiry notifications before enabling uploads.
4. Move organizational reference lists to database-backed settings and add history-preserving resource assignment records.
5. Add import/export, date-ranged reports, backup/restore, and acceptance testing with HR staff.

## Structure

- app/ application routing and global visual system
- components/ shell, dashboard, employee and supporting module screens
- lib/types.ts domain types; lib/seed.ts fictional sample records
- lib/repository.ts persistence boundary and browser demo adapter
- lib/store.tsx Stage 1 client data store and domain actions
- docs/DATA_MODEL.md PostgreSQL model and migration guidance
