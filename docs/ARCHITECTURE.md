# Elans — Architecture (Stage 0)

Status: **Proposed — awaiting David's "go".** Nothing here is built yet.

## 1. Shape of the system

```
                        ┌──────────────────────────── Vercel ────────────────────────────┐
  Visitors ───────────► │ apps/web   (elans.{{DOMAIN}})  public site, SSG/ISR + server actions │
  Clients  ───────────► │ apps/portal (app.{{DOMAIN}})   client portal (Phase 3)               │
  Elans staff ────────► │ apps/ops    (ops.{{DOMAIN}})   console + content CMS (Stage 2 →)      │
                        └───────┬──────────────────┬──────────────────┬───────────────────────┘
                                │                  │                  │
                     packages/core (domain, Zod schemas, RBAC, pricing & scoring rules — deterministic)
                     packages/db   (Drizzle schema, migrations, RLS policies, seed)
                     packages/engines (assessment, scoring, ROI, quote, conversation, document, eTIMS …)
                     packages/integrations (adaptors: Daraja, WhatsApp, eTIMS, Xero … each Live/Mock)
                     packages/ai   (model gateway, prompt registry, schema-validated calls, evals)
                                │
         ┌──────────────────────┼─────────────────────────────┬──────────────────────────────┐
         ▼                      ▼                             ▼                              ▼
  Supabase Postgres      Inngest (durable workflows)    Model providers               External services
  Auth+MFA · RLS ·       steps · retries · waitForEvent  (Claude primary; smaller      M-Pesa Daraja · Meta WA ·
  Storage · pgvector     for approvals · per-tenant      models for classification)    {{CARD_GATEWAY}} · {{SMS_PROVIDER}} ·
  audit_log              concurrency & throttles         via packages/ai only          {{VOICE_STACK}} · {{ETIMS_ROUTE}}
```

### Separation of concerns (§16)
| Concern | Lives in | Rule |
|---|---|---|
| Deterministic business rules (money, tax, statutory, approvals, identity, permissions) | `packages/core` | Pure TypeScript, unit-tested, **never** delegated to a model |
| AI reasoning / extraction / drafting | `packages/ai` | Every call: versioned prompt, Zod output schema, confidence, audit record |
| Orchestration | `packages/engines/*/workflows` on Inngest | Steps are idempotent; external side-effects only after approval gates |
| Integration adaptors | `packages/integrations/<provider>` | Common interface; each adaptor declares `status: live \| sandbox \| mock`, surfaced in UI |
| Storage | `packages/db` | Drizzle migrations; RLS policies in SQL migrations; RLS tests in CI |
| Monitoring / billing / reporting | `packages/engines/{metering,incidents,reports}` | Usage events written by the gateway and adaptors, not by UI |

## 2. Repo structure

pnpm workspaces + Turborepo.

```
elans/
├─ apps/
│  ├─ web/              Next.js App Router — public site (Phase 1)
│  ├─ ops/              Next.js — internal console; Stage 2 ships only the Content CMS module
│  └─ portal/           Next.js — client portal (created at Stage 8, not before)
├─ packages/
│  ├─ ui/               Design system: tokens, components, WorkflowDiagram, StatusBadge, charts
│  ├─ core/             Domain types, Zod schemas, RBAC, pricing rules, Opportunity Score, ROI maths
│  ├─ db/               Drizzle schema, SQL migrations (incl. RLS), seed scripts, RLS test harness
│  ├─ content/          Seed content as typed, validated source files (catalogue, industries, frontier …)
│  ├─ engines/          assessment · scoring · roi · quote · conversation · document · etims · metering
│  ├─ integrations/     daraja · whatsapp · meta · {{CARD_GATEWAY}} · {{SMS_PROVIDER}} · etims · xero …
│  ├─ ai/               Model gateway, prompt registry client, redaction, eval runner
│  └─ config/           Shared tsconfig, eslint, tailwind preset, playwright config
├─ evals/               Eval sets per solution (JSONL) + golden outputs; run in CI on prompt/model change
├─ supabase/            Local Supabase config for dev (CLI), not a second schema source
├─ docs/                Architecture, page map, data model, runbooks, ADR-style decisions
├─ .github/workflows/   CI: typecheck · lint · unit · RLS isolation · Playwright · axe · evals (gated)
├─ DECISIONS.md  PLACEHOLDERS.md  SOURCES.md  BACKLOG.md
```

No `services/ai` (Python) at launch — see DECISIONS D-011. It is added only if document
tooling (e.g. layout-aware OCR for poor scans) materially beats model-vision extraction on the
eTIMS eval set at Stage 10.

## 3. Orchestration choice — **Inngest** (code-first durable workflows)

| Option | Verdict | Why |
|---|---|---|
| **Inngest** | **Chosen** | Durable step functions in the same TypeScript monorepo; automatic retries with backoff; `step.waitForEvent` maps directly onto human approval gates (wait days for a client to approve a journal, then resume); built-in idempotency keys, concurrency and throttling **keyed by tenant** (per-tenant rate limits and fair use); first-class on Vercel; self-hostable later if data residency requires it |
| Trigger.dev v3 | Strong alternative | Similar model; long-running tasks are better. Kept as fallback if Inngest's step/payload limits bite on document batches |
| Temporal | Rejected for now | Best-in-class durability but heavy operational burden (cluster or paid cloud, workers, versioning discipline) for a founding team |
| n8n (self-hosted) | Not the core runtime | Visual flows are attractive for bespoke client work, but tenant isolation, prompt/eval versioning, audit trail and code review are much weaker. Parked in BACKLOG as an optional "custom client flow" surface that calls Elans engines through a signed API |

**Data-residency rule for orchestration:** workflow events and step outputs carry **IDs and hashes only**, never raw PII, documents or message bodies. Payloads stay in Postgres/Storage in the chosen region; the orchestrator never holds personal data. This keeps the managed Inngest cloud acceptable under a cross-border-transfer assessment and makes self-hosting a later switch, not a rewrite.

### Workflow control pattern (every automation)
```
trigger → validate input (Zod) → dedupe (idempotency key) → AI step (schema-validated, confidence)
  → confidence ≥ threshold? ─ no ─► review_items (human queue, SLA timer) ─┐
                └ yes ─────────────────────────────────────────────────────┤
  → action is irreversible / financial / filing / customer-facing?          │
        and autonomy not opted-in? ─► approvals (waitForEvent) ─────────────┤
  → execute via adaptor (timeout, retry, rate limit) → run_steps + audit_log
  → compensating action on failure → incidents + alert
  kill switch checked before every side-effecting step (per automation and per tenant)
```

## 4. Platform choices

| Area | Choice | Notes |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript (strict) + Tailwind | React Server Components; SSG/ISR for catalogue pages |
| Database | Supabase Postgres + Auth (TOTP MFA) + Storage + pgvector | RLS for tenant isolation. Region: see D-009 |
| ORM / migrations | Drizzle | Schema in TS, RLS policies as raw SQL migrations, one schema owner |
| Search (catalogue) | Postgres full-text + `pg_trgm` | No external search service at launch |
| Content | Postgres is the source of truth; `packages/content` seeds it; editing in `apps/ops` CMS | Prices, statuses, weights, copy all editable — nothing hard-coded |
| Payments | M-Pesa Daraja (STK Push) + `{{CARD_GATEWAY}}` | Sandbox until Safaricom Go-Live |
| Email | Transactional provider `{{EMAIL_PROVIDER}}` | Report delivery, booking confirmations |
| Bot protection | Cloudflare Turnstile on assessment, forms, chat | Assessment & AI Visibility Check call models on anonymous input |
| Analytics | Consent-gated, first-party (e.g. Plausible/PostHog EU) `{{ANALYTICS}}` | No tracking before consent |
| Error/obs | Sentry + structured logs + Inngest run history | PII scrubbing in Sentry |
| Testing | Vitest (unit/integration) · RLS isolation suite · Playwright E2E · axe accessibility · eval runner | All in CI; evals gate prompt/model changes |

## 5. Environments

| Env | Web | Database | Payments/Channels | Models |
|---|---|---|---|---|
| dev | localhost | Supabase local (CLI) | Mock adaptors | Low-cost model or recorded fixtures |
| staging | Vercel preview + `staging.{{DOMAIN}}` | Supabase staging project | Daraja sandbox, WA test number | Real, capped budget |
| prod | `{{DOMAIN}}`, `app.`, `ops.` | Supabase prod project | Live after Go-Live / verification | Real, per-tenant budgets |

Secrets: Vercel/Supabase encrypted env vars at launch; integration credentials for **client** connections stored via Supabase Vault (only `connections.secret_ref` in tables). Migrate to a dedicated secrets manager when the first enterprise client requires it.

## 6. Security posture (summary — detail at /trust and Stage 8)

Tenant isolation by RLS on every tenant table (tested in CI with two synthetic tenants) · RBAC via memberships · MFA mandatory for ops staff and client admins · Elans staff reach client tenants only through time-boxed, audited access grants (D-007) · PII redaction before model calls where possible · client data never used for training (provider settings + contract) · full audit log · 72-hour breach workflow (`breach_log`) · no certification claims.
