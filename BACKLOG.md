# BACKLOG

Ideas outside the current scope lock. Nothing here is built until David schedules it.

| ID | Idea | Origin | Notes |
|---|---|---|---|
| B-001 | n8n as a visual "custom client flow" surface calling Elans engines via signed API | D-005 | Only if bespoke clients need to see/edit flows |
| B-002 | Self-hosted Inngest (or Trigger.dev) in-region for strict data-residency tenants | D-006, D-009 | Trigger: first client requiring in-country processing |
| B-003 | Dedicated secrets manager (e.g. Doppler / AWS Secrets Manager) | ARCHITECTURE §5 | Trigger: first enterprise procurement review |
| B-004 | Python document service (layout-aware OCR) | D-011 | Trigger: Stage 10 eval gap |
| B-005 | Swahili-language public site | §1.3 | Agents are bilingual from day one; site is English at launch |
| B-006 | External search (Typesense/Meilisearch) | D-012 | Trigger: catalogue > ~2,000 records or relevance complaints |
| B-007 | SSO (SAML/OIDC) for enterprise client portals | D-028 | Trigger: first enterprise request |
| B-008 | Scheduled nightly reset of the shared demo workspace (and per-visitor demo tenants) | D-031 | Today it resets on every seed |
| B-009 | Real object storage for documents (S3-compatible, in-region) | Portal | Dev stores files in Postgres `bytea` (5 MB limit) |
| B-010 | Background worker for the outbox (email/WhatsApp/SMS providers) | Runtime | Today messages are logged (`EMAIL_PROVIDER=log`) |
