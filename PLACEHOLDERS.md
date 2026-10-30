# PLACEHOLDERS

Every unconfirmed value stays as `{{TOKEN}}` in code and copy until David confirms it here.
Ordered by the **earliest stage it blocks**. P0 = needed before or during Stage 1–2.

| Priority | Token | Blocks | Default / suggestion | Long lead? | Confirmed value |
|---|---|---|---|---|---|
| P0 | `{{DOMAIN}}` | Stage 0 envs, email, Supabase auth redirects, subdomains | — (check `elans.co.ke` / `.com` / `.africa` availability) | Domain + email DNS | |
| P0 | Legal entity name & registration no. | Footer, legal pages, invoices, contracts | — | | |
| P0 | Company contact details (address, phone, email, WhatsApp number) | Contact page, NAP data for GEO, chat | — | WA number needs Meta verification | |
| P0 | `{{MARKET_SCOPE_CONFIRM}}` | Home and About copy | Kenya-led, East Africa + international section (D-002) | | |
| P0 | `{{TYPEFACES}}` | Stage 1 | Plus Jakarta Sans adopted (D-042); open-source, no licence cost | — | |
| P0 | `{{MADA_TM_CONFIRM}}` | Grow copy | Use "MADA Growth Engine™" (™ only — never ® unless registered) | Trademark search | |
| P0 | Trademark clearance for "Elans" (Kenya KIPI + key markets) | Logo sign-off | — | Yes | |
| P0 | Status of **LedgerLock, MezaTap, Fondly, LassElans** assets — existing code/repos to reuse, or concepts only? | Stage 2 copy, Stages 10–12 | Treated as concepts (no reuse) until shown | | |
| P1 | `{{PRICE_LAUNCH_SETUP}}` / `{{PRICE_LAUNCH_MONTHLY}}` | Pricing page | KES 120,000 / KES 20,000 | | |
| P1 | `{{PRICE_GROWTH_SETUP}}` / `{{PRICE_GROWTH_MONTHLY}}` | Pricing page | KES 350,000 / KES 60,000 | | |
| P1 | `{{PRICE_SCALE_SETUP}}` / `{{PRICE_SCALE_MONTHLY}}` | Pricing page | KES 600,000 / KES 120,000 + usage | | |
| P1 | `{{PRICE_GROW_ESSENTIALS}}` / `_MOMENTUM` / `_MARKET_LEADER` | Pricing, Growth pages | — | | |
| P1 | `{{PRICE_STRATEGY_SESSION}}`, `{{PRICE_DIAGNOSTIC}}`, `{{PRICE_SUPPORT_SESSION}}` | Pricing, Sessions | — | | |
| P1 | `{{DISCOVERY_CALL_FREE?}}` | CTAs, Sessions | Free, 20 min, qualification only | | |
| P1 | `{{CASE_STUDY_DATE}}` | Case Studies page | — (or hide date line) | | |
| P1 | `{{STATUTORY_RATES}}` (PAYE bands, NSSF tiers, SHIF %, Housing Levy %, VAT, WHT) | Solution copy examples, payroll calculators | Configurable tables, verified at build time from KRA/NSSF/SHA sources | | |
| P1 | `{{SUPPORT_HOURS}}` | Chat handover, Trust, Pricing | Mon–Fri 08:00–18:00 EAT | | |
| P1 | `{{ODPC_REG}}` | Privacy notice, Trust page | — (Elans must register as controller/processor before collecting leads) | Yes | |
| P1 | `{{ANALYTICS}}`, `{{EMAIL_PROVIDER}}` | Stage 4–6 | Plausible/PostHog EU; Resend/Postmark | | |
| P2 | `{{CARD_GATEWAY}}` | Stage 5 payments | Paystack or Pesapal | KYC onboarding | |
| P2 | M-Pesa Paybill/Till + Daraja Go-Live | Stage 5 payments | Sandbox until approved | **Yes** (Safaricom) | |
| P2 | `{{SMS_PROVIDER}}` | Stage 5 notifications | Africa's Talking | Sender ID approval | |
| P2 | WhatsApp Business Platform (BSP or Cloud API) + Meta business verification | Stage 5 chat on WA, Stage 11 | Meta Cloud API direct | **Yes** | |
| P2 | Supabase / hosting data region | Stage 0 envs | EU region pending legal review (D-009) | Legal opinion | |
| P3 | `{{MARGIN_FLOOR}}` | Stage 7 quote builder | 65% | | |
| P3 | `{{MIN_TERM}}` | Stage 7 contracts | 6 months | | |
| P3 | e-signature provider | Stage 7 | — | | |
| P4 | `{{ETIMS_ROUTE}}` | Stage 10 | Accredited integrator first; direct OSCU/VSCU only after confirming KRA third-party certification requirements | **Yes** | |
| P4 | `{{VOICE_STACK}}` | Stage 11 voice | Evaluate Swahili STT/TTS quality before choosing | Kenyan number provisioning | |
| P4 | Pilot client(s) for eTIMS proof + ≥ 50 consented sample invoices for the eval set | Stage 10 | — | **Yes** | |
| P1 | Suggested prices shown as **Indicative** (D-029): Grow Essentials 75k / Momentum 180k / Market Leader 380k per month; Strategy Session 15k; Diagnostic 60k; Support session 7.5k | Pricing, Sessions | Edit in Console → Content → Prices and tick "confirmed" | | |
| P1 | Admin account `admin@elans.local` (seed) | Console | Change the email and password, re-enrol MFA, before any deployment | | |
| P2 | `{{DEMO_PAYBILL}}` | Demo WhatsApp agent copy | Shown as "123456 (demo)" in the illustrative tenant only | | |
| P2 | Data retention periods (conversations 12 months; tax records 7 years) | Portal → Data & Privacy, DPA | Defaults stated as "per your agreement"; confirm with counsel | | |
| P2 | Data-subject request deadlines (7 days access, 14 days other) | Portal DPA requests | Configurable policy; confirm against the Kenya DPA 2019 and 2021 Regulations | | |
