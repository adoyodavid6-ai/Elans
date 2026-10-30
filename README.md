# Elans

**Intelligent Systems. Measurable Results.**

Elans — AI Automation & Growth. One brand, one platform, one client account, seven divisions
(Automate · Converse · Grow · Studio · Relate · Intelligence · Partners) on a shared Elans Core.

This repository contains the whole platform in one Next.js app (D-025):

| Area | Path | Who |
|---|---|---|
| Public site, assessment, ROI, bookings, chat | `/` (`src/app/(site)`) | Prospects |
| Ops console: CRM, pipeline, quotes, CMS, operations | `/ops` | Elans staff (MFA required) |
| Client portal: automations, approvals, conversations, reports, billing | `/portal` | Clients (MFA for owners/admins) |

What works, what runs in mock/test mode and what needs credentials: **[docs/FEATURE_STATUS.md](docs/FEATURE_STATUS.md)**.

## Run it locally

Requirements: Node 22, Postgres 16.

```bash
cp .env.example .env          # then set SESSION_SECRET to a long random string
npm install
npm run db:migrate            # creates the database, the RLS-bound app role and all tables
npm run db:seed               # content, prices, admin user and the illustrative demo tenant
npm run dev                   # http://localhost:3000
```

Without `ANTHROPIC_API_KEY` everything runs in deterministic rules mode. Add a key to enable AI
hypotheses in reports, AI answers in chat, image/PDF invoice extraction and the live AI Visibility Check.

### Accounts after seeding

| Where | How |
|---|---|
| Ops console `/ops/login` | Locally: `admin@elans.local` / `ElansAdmin!2026` (you will be asked to enrol an authenticator app). On a deployed environment this default is never created: set `ELANS_ADMIN_EMAIL` and `ELANS_ADMIN_PASSWORD` instead. |
| Client portal demo | Open `/portal/demo` (or "Open the demo workspace" on `/portal/login`). Illustrative data only. |

Suggested demo path: `/portal/demo?next=/portal/automations/etims` → upload or simulate an invoice →
**Approvals** (edit and approve a supplier request) → **Agents & Conversations** (order 20 bags of cement,
then send the code shown) → **Reports** (print the monthly report).

## Deploying to Vercel

The public site runs without a database (it falls back to built-in content). The **client portal, the
demo workspace (`/portal/demo`), the staff console and the forms need Postgres**. Without it,
`/portal/demo` shows a "not available on this deployment yet" message.

1. **Create a Postgres 16 database** (e.g. Neon from the Vercel Marketplace, or Supabase). Use its
   *pooled* connection string where offered, with `sslmode=require`.
2. **Choose an app role.** The app must connect as a role that cannot bypass row-level security.
   Pick a name and password, e.g. `elans_app`; the first deploy creates it.
3. **Add environment variables** in Vercel → Project → Settings → Environment Variables (Production):

   | Variable | Value |
   |---|---|
   | `DATABASE_ADMIN_URL` | Owner connection string from your provider |
   | `DATABASE_URL` | Same host and database, with the app role: `postgres://elans_app:<password>@<host>/<db>?sslmode=require` |
   | `SESSION_SECRET` | A long random string (`openssl rand -hex 32`) |
   | `NEXT_PUBLIC_SITE_URL` | Your site URL, e.g. `https://lasselanselans.vercel.app` |
   | `ELANS_ADMIN_EMAIL`, `ELANS_ADMIN_PASSWORD` | Staff console admin (password 14+ characters) |
   | `MPESA_ENV` | `mock` until Daraja credentials exist |

4. **Redeploy.** The `vercel-build` script applies migrations, seeds content and the demo workspace,
   then builds. Every later deploy re-applies pending migrations and rebuilds the demo data (edits made
   in the console are kept).

Scope the database variables to Production only (or give Preview its own database), otherwise
preview deployments run migrations against production.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | TypeScript |
| `npm test` | Unit, content-integrity and RLS isolation tests (RLS tests skip without a database) |
| `npm run eval:etims` | eTIMS extraction/status evaluation on 62 synthetic cases (`-- --ai` to evaluate the AI prompt) |
| `npm run db:migrate` / `db:seed` / `db:reset` | Database (reset drops and recreates; development only) |

## Control documents

| Document | Purpose |
|---|---|
| [`DECISIONS.md`](DECISIONS.md) | Every ambiguity resolved, with reasons (David may overturn) |
| [`PLACEHOLDERS.md`](PLACEHOLDERS.md) | Every unconfirmed `{{TOKEN}}` and suggested value awaiting confirmation |
| [`SOURCES.md`](SOURCES.md) | The only permitted source of public statistics (all currently unverified, so none are published) |
| [`BACKLOG.md`](BACKLOG.md) | Out-of-scope ideas, parked until scheduled |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/PAGE_MAP.md`](docs/PAGE_MAP.md), [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) | Stage 0 design (see D-025–D-028 for where the build departed from it) |

## Before going live

1. Confirm prices, legal entity, contact details and domain (PLACEHOLDERS P0/P1).
2. Register with the ODPC; have counsel review the privacy notice, DPA and data region (D-009).
3. Set real `SESSION_SECRET`, `NEXT_PUBLIC_SITE_URL`, Turnstile keys, email provider and M-Pesa credentials.
4. Replace the seeded admin account; remove or restrict the demo workspace if not wanted.
5. Confirm the eTIMS route and re-run the evaluation on consented client invoices (D-030).

## Standing rules (summary)

UK English · scope lock · placeholder tokens · prove one solution before rollout · zero fabrication ·
honest Live/Pilot/Planned/Custom status · decision log.
