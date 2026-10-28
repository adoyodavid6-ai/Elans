# Stage 0 Review — assumptions we believe are wrong or risky

Ordered by impact. Each has a proposed resolution (logged in DECISIONS.md where we have
already applied it conservatively). David decides.

## A. Scope and sequencing

1. **Stage 2 content volume is the real critical path, not code.** 28 categories × 3–8 solutions (≈ 85–220 solution pages) + 21 industries + 11 packs + 10 frontier topics + growth services, each "genuinely specific" with two workflow diagrams. Written properly that is weeks of expert copy and review. *Proposal:* Stage 2 fully writes the **Gap Map top 10 solutions, 8 priority industries and all 11 packs**; every other record ships with structured fields, honest status (mostly Planned / Custom assessment) and `noindex` until it passes the completeness gate (D-015). Remaining pages are written in batches after launch.
2. **Document Intelligence (Gap Map #9) is a prerequisite, not a later template.** The eTIMS proof cannot ingest invoices without it. Built inside Stage 10 (D-019).
3. **Stage 5 needs a chat agent before the agent runtime exists (Stage 9).** Resolved with a narrow agent on the shared conversation module (D-018).
4. **Stage 2 requires "admin editing" but the console is Stage 7.** Resolved by shipping only the CMS module of `apps/ops` at Stage 2 (D-010).
5. **Minor inconsistencies:** logo/type "Stage 2" vs Stage 1 (D-013); homepage "15 sections" lists 16 (D-014); §4 has no route for Industry Packs or package detail pages (added in PAGE_MAP).

## B. External dependencies with long lead times — start now, in parallel

6. **eTIMS:** a direct OSCU/VSCU integration as a third-party system generally requires KRA approval/certification as an integrator; an accredited partner is faster. Either way, Stage 10 must start on a labelled MOCK (D-020). This decision should be made in the next few weeks, not at Stage 10.
7. **M-Pesa Daraja Go-Live** (Paybill/Till, business documents, Safaricom review) and **Meta WhatsApp business verification + message-template approval** each take time and block Stage 5 and Stage 11 on production.
8. **ODPC registration for Elans itself** must be in place before the assessment collects personal data in production — the site cannot honestly claim ODPC-readiness for clients otherwise.
9. **A pilot client and ≥ 50 consented real invoices** are needed for the eTIMS eval set; synthetic invoices alone won't prove the pattern.

## C. Market-intelligence claims (§2)

10. **None of the §2 figures has been verified, and several come from vendor blogs or secondary news.** The Gartner figure is cited via a news site rather than Gartner; the "pricing fell 35%" and per-interaction cost figures are vendor marketing; the KES 100,000 eTIMS penalty has **no source URL at all**; the KUSCCO and SACCO figures should come from SASRA/CBK. All seeded as `unverified` and blocked from publication until checked (D-022).
11. **Naming KUSCCO or specific lenders in sales copy** carries reputational and defamation risk. Use sector-level figures only.

## D. Commercial

12. **"Setup ≈ one-third of projected 90-day value"** means a KES 120,000 Launch setup implies KES 360,000 of value in 90 days (~KES 120k/month) — plausible for reconciliation in a mid-sized firm, optimistic for a small salon or clinic. Recommend the quote builder flag (not block) quotes failing the check, and that Launch be sized to a single high-frequency workflow.
13. **"Price per resolved conversation" needs an auditable definition** before it appears on the pricing page (proposed in D-023), otherwise it invites disputes.
14. **Outcome fees "only with clean baselines"** — correct, but the baseline must be captured in the Diagnostic before go-live and frozen in `engine_instances.baseline_value`; otherwise no outcome fee. Encoded in the data model.

## E. Compliance and data

15. **Data residency is undecided and matters.** Supabase has no African region. Kenya's Data Protection Act (s.48–50) and the 2021 General Regulations restrict cross-border transfers and may require some processing in Kenya; health data (SHA pack) is sensitive personal data. This needs a Kenyan data-protection lawyer's opinion before Stage 8, and the platform records region per tenant (D-009).
16. **Health administration ("SHA Claims Scrubber")**: even admin-only, it processes diagnosis and procedure codes — sensitive data, and coding suggestions edge towards clinical judgement. Keep it to completeness/consistency checks against payer rules, with human submission, and say so explicitly on the page.
17. **CV parsing and scoring (HR)** and **loan intake/KYC (Collections & credit)** are high-risk automated-decision areas under DPA s.35 (rights re automated decisions). Already flagged "Human-review required" by the scoring engine; the copy must say a human decides.
18. **AI Visibility Check** queries model APIs, whose answers differ from the consumer ChatGPT/Gemini/Perplexity apps and vary run to run. It must be labelled as an indicative API sample, with the date and models used, and must respect each provider's terms.

## F. Design

19. **Copper on ivory is ≈ 3.1:1** — fails AA for body text. Restricted to large text and non-text UI; add a darker `--copper-ink` token (D-017).
20. **Eleven top-level nav items plus CTAs will crowd desktop headers.** Proposed condensed nav with unchanged routes (D-016).

## G. Things we think are right and are keeping

Kenya-first moat; eTIMS as the proof solution; deterministic code for money and tax; human approval gates; honest status badges; one-template, DB-driven catalogue; run-and-maintain accountability as the differentiator against the high agentic-AI failure rate.
