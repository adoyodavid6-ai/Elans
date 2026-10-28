# Feature status register

Honest status of every capability in this build. **Working** = implemented and exercised locally.
**Mock / test mode** = implemented end to end against a labelled stand-in until credentials or
accreditation exist. **Needs credentials** = code path exists, switched off until configured.
**Not built** = parked in BACKLOG.md.

## Public site

| Feature | Status | Notes |
|---|---|---|
| All sitemap pages (home, solutions, industries, packs, growth, frontier, templates, pricing, about, trust, partners, careers, contact, legal, resources, case studies, integrations, how it works) | Working | DB-first content with typed seed fallback; edits in Console → Content |
| Solutions catalogue: 28 categories, 112 solutions, 15-field detail pages, status badges | Working | Incomplete pages render `noindex` and are left out of the sitemap (D-015) |
| AI Opportunity Assessment (10 steps, save & resume, consent, contact last) | Working | Rules mode without an API key; AI hypotheses labelled when a key is set |
| Opportunity Score (11 weighted criteria, versioned weights, exclusions) and report | Working | Weights editable/activated in Console → Content → Weights |
| ROI calculators (master + 8 specialist, low/base/high, capacity vs cash) | Working | |
| AI Visibility Check | Working (rules) / Needs credentials (live web search) | Uses Claude web search when `ANTHROPIC_API_KEY` is set |
| Contact, partner forms, lead capture with consent records | Working | Turnstile needs keys; disabled in dev |
| Session booking with M-Pesa payment and calendar file | Mock / test mode | Daraja sandbox/production via `MPESA_ENV` + credentials |
| Website chat agent (FAQs, solutions, booking, handover to inbox) | Working | English + Swahili detection; AI answers only with a key |
| Quote acceptance → client provisioning | Working | Creates tenant, project, onboarding tasks, subscription, invite |
| SEO/GEO: metadata, JSON-LD, sitemap.xml, robots.txt, llms.txt | Working | Set `NEXT_PUBLIC_SITE_URL` in production |
| Statistics on public pages | Blocked by design | Only from SOURCES.md once verified (D-022); none published yet |

## Ops console (`/ops`)

| Feature | Status | Notes |
|---|---|---|
| Staff sign-in with mandatory TOTP MFA | Working | |
| Dashboard, leads/CRM, pipeline, opportunities, diagnostic notes | Working | |
| Quote builder with commercial rules (margin floor, term discounts, split setup) | Working | |
| Contracts, assessments review, live chat inbox, bookings | Working | |
| Clients with just-in-time, audited 4-hour access grants | Working | |
| Operations: review queue, tickets, incidents (PII-free cross-tenant queues) | Working | |
| Content CMS with revisions, prices, score weights, sources, site settings | Working | |
| Team & roles, analytics, message log (outbox) | Working | |

## Client portal (`/portal`)

| Feature | Status | Notes |
|---|---|---|
| Sign-in, invitations, MFA (required for owners/admins) | Working | |
| One-click illustrative demo workspace | Working | Shared, rebuilt on seed (D-031) |
| Overview with outcomes vs baseline, usage vs allowance | Working | |
| eTIMS Compliance & Reconciliation workspace (upload, WhatsApp intake simulation, confidence, review, supplier register, variance report) | Mock / test mode | eTIMS checks use the labelled mock until `{{ETIMS_ROUTE}}` is confirmed (D-020) |
| Image/PDF invoice extraction | Needs credentials | Uses Claude vision with `ANTHROPIC_API_KEY`; without it every field goes to human review |
| M-Pesa & bank reconciliation (CSV import, matching, confirmations, receipts) | Working (CSV) / Needs credentials (live Daraja feed) | |
| WhatsApp Sales & Support agent with simulator and take-over | Working (simulator) / Needs credentials (WhatsApp Cloud API) | Meta business verification required |
| Approvals with editable messages; autonomy per action type; kill switches (automation and account) | Working | |
| Workflow health, run step ledger (audit trail) | Working | |
| Campaigns & Studio content sign-off | Working | Content generation itself is done by the Elans team |
| Projects/onboarding, monthly report (printable), billing with M-Pesa | Working / Mock payments | |
| Support tickets, documents, integrations, team, data export, DPA requests, audit log | Working | Files stored in Postgres in dev (B-009) |

## Platform

| Feature | Status | Notes |
|---|---|---|
| Tenant isolation via Postgres RLS (app role `NOBYPASSRLS`) | Working, tested | `tests/rls.test.ts` |
| Workflow runtime: idempotency, retries, approval gates, reviews, kill switches, metering, incidents | Working | D-027 |
| AI gateway: structured outputs, untrusted-input wrapping, budgets, deterministic fallbacks | Working | |
| eTIMS evaluation (`npm run eval:etims`) | Working (synthetic) | D-030: not evidence of real-world accuracy |
| Outbound email / WhatsApp / SMS delivery | Logged only | Outbox records every message; provider worker is B-010 |
| CI (typecheck, migrate + seed, tests incl. RLS, eval, build) | Configured | `.github/workflows/ci.yml` |
| Certifications (ISO 27001, SOC 2, etc.) | None claimed | The Trust page says so |
