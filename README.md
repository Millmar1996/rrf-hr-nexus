# RRF HR Nexus

**Integrated Human Resource Services Management System** for RRFMG's Tuguegarao branch. The approved red and white UI brings employee records, lifecycle history, client assignments, private 201 files, resources, workforce reporting, and master data into one Supabase-backed workspace.

## Current implementation

The application uses Supabase PostgreSQL as its authoritative data source. The browser-local demo repository has been removed. Employee CRUD and archive, lifecycle changes, client and resource assignment history, private document upload and signed access, reports, dashboard metrics, organization structure, access requests, and settings are wired to the database and protected by RLS and guarded RPCs.

Supabase migrations and fictional seed records are applied to the connected project. The existing sign-in page now validates the single HR Administrator credential on the server and issues an HTTP-only, 10-hour Supabase session, preserving the existing database RLS access. Signup is disabled. The active administrator profile is Millmar Agustin.

## Stack

- Next.js 16 App Router, React 19, TypeScript
- Supabase PostgreSQL, Auth, Row Level Security, and private Storage
- Vercel project `rrf-hr-nexus` at <https://rrf-hr-nexus.vercel.app>
- GitHub repository <https://github.com/Millmar1996/rrf-hr-nexus>

## Run locally

Requires Node.js 20.9 or newer.

```sh
npm install
npm run dev
```

Open `http://localhost:3000`. Use the fictional SQL seed only in development/demo workspaces. Run `npm run lint`, `npm run typecheck`, and `npm run build` for code checks.

## Environment

Copy `.env.example` to `.env.local`. Configure the Supabase URL/publishable key and `HR_ADMIN_USERNAME` / `HR_ADMIN_PASSWORD`. The HR credentials are server-only and must never use a `NEXT_PUBLIC_` prefix. No service-role key is used. `.env.local` is ignored by Git.

## Supabase artifacts

- Browser/server SSR clients and generated types: `lib/supabase/`
- Ordered migrations: `supabase/migrations/`
- Fictional seed SQL: `supabase/seed.sql`
- Auth, deployment and first-admin notes: `docs/ADMIN-PROVISIONING.md`
- System, schema, role, business-rule, test, and change documentation: `docs/`

## Deployment status

Production, Preview, and Development Vercel environments have the Supabase connection values and server-only HR credentials. GitHub is connected to Vercel, and the application is deployed at <https://rrf-hr-nexus.vercel.app>. The internal Supabase Auth identity exists only to preserve existing RLS-protected HR data access; the login form has no email, signup, or recovery workflow. No real personnel data is present.
