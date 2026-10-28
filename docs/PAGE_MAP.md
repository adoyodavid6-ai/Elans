# Elans — Page Map (Stage 0 confirmation)

The §4 sitemap is confirmed with the additions/changes marked **[+]** / **[Δ]**. Every
listing and detail page is rendered from database records via one template per type.

Legend — **Src**: `DB` record-driven · `Static` hand-built page · `App` interactive. **Stage**: build stage.

## apps/web — public site

| Route | Page | Src | Stage | Notes |
|---|---|---|---|---|
| `/` | Home (16 sections — see D-014) | DB + Static | 3 | Featured items, prices, statuses pulled from DB |
| `/solutions` | Catalogue: search + filters (function, industry, division, complexity, timeline, status, price band) | DB | 3 | Postgres FTS; filters in URL for shareable/SEO-safe state |
| `/solutions/[category]` | Function category (28) | DB | 3 | |
| `/solutions/[category]/[solution]` | Solution detail (15 required fields) | DB | 3 | Incomplete records render `noindex` (D-015) |
| `/industries` | Industry index | DB | 3 | |
| `/industries/[industry]` | Industry page (21) | DB | 3 | CTA pre-fills assessment `?industry=` |
| `/industries/[industry]/packs/[pack]` **[+]** | Industry Pack detail (11) | DB | 3 | Packs needed a home; §4 had none |
| `/growth` | Growth & marketing hub | DB | 3 | |
| `/growth/[service]` | Grow / Studio / Relate / Intelligence service | DB | 3 | |
| `/growth/ai-visibility-check` **[+]** | Free AI Visibility Check (lead magnet) | App | 4 | Labelled "sample snapshot" |
| `/frontier` · `/frontier/[topic]` | Emerging needs hub (10) | DB | 3 | Status usually Pilot/Planned |
| `/templates` · `/templates/[template]` | Template library (public view) | DB | 3 | "Request implementation", never "instant" |
| `/how-it-works` | The Elans Method | Static | 3 | |
| `/assessment` | AI Opportunity Assessment (10 steps, save & resume) | App | 4 | Contact details last; Turnstile |
| `/assessment/resume/[token]` **[+]** | Resume link target | App | 4 | Signed, expiring token |
| `/assessment/report/[id]` | Preliminary report (web + PDF) | App | 4 | Unguessable id + consent; `noindex` |
| `/roi` · `/roi/[calculator]` | Master + 8 specialist calculators | App | 4 | Formulas visible; low/base/high |
| `/pricing` | Packages, retainers, sessions | DB | 3 | All prices from `price_points` |
| `/pricing/[package]` **[+]** | Package detail (scope, exclusions, terms …) | DB | 3 | §11 requires per-package detail |
| `/case-studies` (+ `/[slug]` when real) | Honest state + labelled illustrative examples | DB | 3 | "First client results publishing {{CASE_STUDY_DATE}}" |
| `/resources` · `/resources/[slug]` | Insights, guides, checklists, glossary | DB | 3 | Templates: guide, comparison, industry solution, checklist, glossary |
| `/integrations` | Directory with Supported/Planned/Custom assessment | DB | 3 | From `integrations.status` |
| `/trust` | Security, privacy, AI governance | Static + DB | 3 | Real controls only, no badges |
| `/partners` | White-label & referral programme | Static | 3 | Programme status shown honestly |
| `/sessions` | Strategy Session (paid) / Discovery Call booking | App | 5 | M-Pesa/card |
| `/sessions/confirmation/[id]` **[+]** | Booking + payment confirmation | App | 5 | |
| `/about` · `/careers` · `/contact` | Company pages | Static | 3 | |
| `/legal/{privacy,terms,cookies,dpa,acceptable-use}` | Legal | Static (MDX) | 3 | Drafts flagged for legal review |
| `/sitemap.xml` · `/robots.txt` · `/llms.txt` **[+]** | SEO/GEO | Generated | 6 | |
| `/api/*` | Inngest endpoint, webhooks (Daraja, WA, gateway) | — | 5+ | Signature-verified |

## apps/ops — `ops.{{DOMAIN}}`

Stage 2: **Content CMS only** (solutions, categories, industries, packs, growth services, frontier, templates, integrations, pricing, resources, score weights). Stage 7: Leads/CRM, pipeline, assessment review, diagnostic workspace, quote builder, proposals, contracts, onboarding, billing. Later: monitoring & incidents, review centre, template registry & evals, partners, analytics.

## apps/portal — `app.{{DOMAIN}}` (Stage 8)

Overview · My Automations · Agents & Conversations · Workflow Health · Campaigns & Content · Approvals · Projects · Reports · Usage & Billing · Support · Documents · Integrations · Team & Permissions · Data & Privacy · Settings. Demo tenant with persistent "Illustrative data" banner.

## Navigation

Primary: Home · Solutions ▾ · Industries ▾ · Growth & Marketing ▾ · How It Works · AI Opportunity Assessment · Pricing · Case Studies · Resources · About · Contact.
**[Δ]** On desktop, eleven top-level items will not fit cleanly next to two CTAs and Client Login. Proposal (D-016): keep Solutions / Industries / Growth & Marketing / How It Works / Pricing / Resources visible; put About, Case Studies, Contact under a "Company" menu; the Assessment is the primary CTA button rather than a nav link. All routes unchanged. Mobile: full menu + bottom CTA bar.
