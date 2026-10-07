# RRF HR Nexus

**Integrated Human Resource Services Management System** for RRFMG's Tuguegarao branch. The approved red and white UI brings employee records, lifecycle history, client assignments, private 201 files, resources, workforce reporting, and master data into one Supabase-backed workspace.

## Current implementation

The application uses Supabase PostgreSQL as its authoritative data source. The browser-local demo repository has been removed. Employee CRUD and archive, lifecycle changes, client and resource assignment history, private document upload and signed access, reports, dashboard metrics, organization structure, access requests, and settings are wired to the database and protected by RLS and guarded RPCs.

Supabase migrations and fictional seed records are applied to the connected project. Supabase Auth flows are implemented, but hosted Auth URL settings and the initial administrator email still need to be bound. Until an active Admin is provisioned, no user can enter HR screens. See `docs/ADMIN-PROVISIONING.md` for the one remaining identity input and flow.

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

Copy `.env.example` to `.env.local`. The public Supabase URL and publishable key are needed for client integration. `NEXUS_BOOTSTRAP_ADMIN_EMAIL` and `NEXUS_BOOTSTRAP_SECRET` are server-only first-admin bootstrap settings; never put the secret in a `NEXT_PUBLIC_` variable. No service-role key is required. Values remain out of Git.

## Supabase artifacts

- Browser/server SSR clients and generated types: `lib/supabase/`
- Ordered migrations: `supabase/migrations/`
- Fictional seed SQL: `supabase/seed.sql`
- Auth, deployment and first-admin notes: `docs/ADMIN-PROVISIONING.md`
- System, schema, role, business-rule, test, and change documentation: `docs/`

## Deployment status

Production, Preview, and Development Vercel environments have the public Supabase connection values. Production also has the server-only bootstrap secret. GitHub is connected to Vercel, and the application is deployed at <https://rrf-hr-nexus.vercel.app>. Hosted Supabase Auth URL configuration and the initial Admin email are still pending; no real personnel data is present.
