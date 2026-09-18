# ZUARI — Build. Manage. Deliver.

Multi-company construction management platform with two purpose-built interfaces on one backend:

- **Command Center** (`/dashboard`, `/projects/*`) — desktop management for Directors and Project Managers.
- **ZUARI Site** (`/site/*`) — mobile-first, photo-first capture for Site Supervisors (installable PWA).

## Run it

```bash
npm install
npm run db:up        # Postgres 16 in Docker on port 5434 (container: zuari-postgres)
npx prisma migrate deploy
npm run db:seed      # demo company, 3 projects, photos, issues, activity
npm run dev          # http://localhost:3100
```

Copy `.env.example` to `.env` first (set `AUTH_SECRET` with `openssl rand -hex 32`).

### Demo sign-ins — password `zuari-demo-2026`

| Role | Email | Lands on |
|---|---|---|
| Director | nick.araujo@coastalindia.demo | Command Center |
| Project Manager | priya.naik@coastalindia.demo | Command Center |
| Site Supervisor | carlos.fernandes@coastalindia.demo | ZUARI Site (open on a phone or a narrow window) |
| Second tenant | meera.kamat@konkanbuilders.demo | Isolated company |

Seed photos are generated, stylised construction-stage images (watermarked "ZUARI DEMO IMAGE"), not real site photography.
Re-running `npm run db:seed` resets only the demo companies.

## End-to-end test

With the server running: `node e2e/workflow.mjs` — drives the full office → site → office flow in real browsers (desktop + phone viewport) and checks tenant isolation and role scoping. Uses system Chrome via Playwright.

## Architecture

- Next.js 16 (App Router) · TypeScript · Tailwind v4 · Prisma 6 · PostgreSQL. No external auth or storage service is required.
- **Auth:** bcrypt password hashes, signed JWT in an httpOnly cookie. The user row is re-read on every request, so role changes and deactivation take effect immediately.
- **Authorization is server-side, in one place** (`src/lib/access.ts`): `projectScope`, `taskScope`, `issueScope` inject tenant + membership filters into every query. Directors see the whole company; managers and supervisors see member projects; supervisors see only tasks assigned to them. Every server action re-checks role and project access; pages 404 rather than reveal other tenants' data.
- **Tenancy:** every company-owned table has a `companyId` foreign key to `Company` (cascade).
- **Photos:** validated by magic bytes (JPEG/PNG/WebP, ≤10 MB, ≤8 per submission), compressed client-side to ≤1600 px, stored under `uploads/<company>/<project>/`, and served only through `/api/photos/[id]`, which checks tenant and project access. Swap `src/lib/storage.ts` for S3/Supabase Storage to go to the cloud.
- **Progress model:** task status ↔ progress rules live in `src/lib/task.ts`; phase progress = mean of its tasks; project progress = mean of phases (`recomputeProgress` in `src/lib/services.ts`).
- **Evidence chain:** Project → Task → ProgressUpdate → ProgressPhoto → User + timestamp.
- Times are India Standard Time throughout.

## Known limits (MVP)

- Offline: the capture forms keep typed details in local storage and show an offline banner, but photos are not queued while offline — there is no background sync yet.
- No login rate limiting, password reset or email delivery; team accounts are created by managers with a temporary password.
- `TaskComment` exists in the schema but has no UI yet.
- Modules shown as "Soon" in the sidebar (Workforce, Materials, Finance, Documents, Analytics…) are intentionally not built.
