# System architecture

## Application

RRF HR Nexus is a Next.js App Router application using React and TypeScript. The approved red and white interface is retained. `lib/store.tsx` loads the authenticated workspace from Supabase and provides writes to the employee, lifecycle, resource, and document workflows. The former browser localStorage repository and in-app demo seed adapter have been removed; fictional data now lives only in the SQL seed script.

Browser and server Supabase clients are in `lib/supabase/`. The browser uses the publishable API key (legacy anon key is supported as a compatibility fallback). No service-role key is needed or exposed. `proxy.ts` refreshes sessions and checks for an active profile before protected routes. Email confirmation is exchanged by `/auth/confirm`; password recovery routes through that callback before the reset form.

## Data and storage

PostgreSQL is authoritative. Normalized master data, employees, lifecycle history, client assignment history, documents, resources, resource assignment history, profiles, access requests, and audit records are in `public`. Private authorization helpers and one-time bootstrap configuration are in the non-exposed `private` schema. RLS is enabled on application tables. The `employee-documents` bucket is private; uploaded file paths are stored as metadata and viewed through short-lived signed URLs.

Atomic employee, lifecycle, resource, and assignment changes use guarded database RPCs. Audit triggers capture important table changes. Dashboard and report values derive from loaded database records; monthly workforce changes are calculated from lifecycle history for the selected date interval.

## Deployments and configuration

The connected Supabase project has the eight ordered repository migrations applied and fictional seed data. The connected Vercel project has the public Supabase URL and publishable key in Production, Preview, and Development, plus a server-only first-admin bootstrap secret in Production. The GitHub repository is connected for branch deployments. The production URL is `https://rrf-hr-nexus.vercel.app`.

`supabase/config.toml` describes local development callbacks and the current production callback. Hosted Auth URL Configuration still requires authenticated Supabase dashboard/API access; this environment exposes database/project tools but not the Auth URL settings API. No initial admin profile exists yet. The secure bootstrap flow is ready and requires the owner's administrator email to be bound before the first confirmed account can claim `ADMIN`.

## Verified limits

- No active administrator Auth profile exists, so authenticated CRUD and production sign-in workflows cannot be exercised end-to-end yet.
- Browser-level UI interaction was not available from the connected account tools; code checks and HTTP smoke checks are recorded in `docs/testing.md`.
- Supabase security advisories report guarded `SECURITY DEFINER` RPC exposure to `authenticated`; RPC bodies enforce active role checks, and the bootstrap RPC additionally requires a one-time server secret and matching email.
