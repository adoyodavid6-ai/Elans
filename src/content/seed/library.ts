import type { IllustrativeExample, Resource, Template } from "../types";
import { flow } from "./helpers";

export const templates: Template[] = [
  { slug: "etims-invoice-check", name: "eTIMS Purchase Invoice Check", division: "automate", industry: "cross-industry", fn: "tax-compliance", problem: "Purchase invoices claimed without valid eTIMS support.", workflow: "Intake → extraction with confidence → review queue → eTIMS check → supplier correction request → monthly variance report.", integrations: ["etims", "email-intake", "whatsapp-business", "csv-excel"], complexity: "medium", prerequisites: ["KRA PIN", "Sample of 50 purchase invoices", "Integration route confirmed"], setupTime: "3–5 weeks", securityClass: "confidential", pricingModel: "Setup + monthly + per-page usage", version: "1.0.0", maintenance: "beta", evalScore: 0.94, solution: "etims-compliance-reconciliation" },
  { slug: "mpesa-statement-matcher", name: "M-Pesa Statement Matcher", division: "automate", industry: "cross-industry", fn: "payments-reconciliation", problem: "Payments with messy references matched by hand.", workflow: "Statement ingestion → deterministic match → AI-suggested match with confidence → auto-apply above threshold → receipt → exceptions queue.", integrations: ["mpesa-daraja", "csv-excel", "whatsapp-business"], complexity: "medium", prerequisites: ["3 months of statements", "Open invoices or balances"], setupTime: "3–5 weeks", securityClass: "confidential", pricingModel: "Setup + monthly + per-transaction usage", version: "1.0.0", maintenance: "beta", solution: "mpesa-bank-reconciliation" },
  { slug: "whatsapp-catalogue-agent", name: "WhatsApp Catalogue Sales Agent", division: "converse", industry: "retail-ecommerce", fn: "customer-service", problem: "Enquiries lost after hours; staff answering repetitive questions.", workflow: "Inbound message → grounded answer from catalogue → order capture → STK push → payment verification → handover rules.", integrations: ["whatsapp-business", "mpesa-daraja"], complexity: "medium", prerequisites: ["Catalogue with prices", "FAQs", "WhatsApp Business Platform number"], setupTime: "3–4 weeks", securityClass: "internal", pricingModel: "Setup + monthly with conversation allowance, or per resolved conversation", version: "1.0.0", maintenance: "beta", solution: "whatsapp-sales-support-agent" },
  { slug: "collections-ladder-standard", name: "Standard Collections Ladder", division: "automate", industry: "cross-industry", fn: "collections-credit", problem: "Inconsistent follow-up of overdue balances.", workflow: "Daily balance sync → segment → staged reminders with payment links → reply understanding → promise tracking → human escalation.", integrations: ["whatsapp-business", "sms", "mpesa-daraja"], complexity: "medium", prerequisites: ["Balances and due dates", "Consent status", "Approved message templates"], setupTime: "4–6 weeks", securityClass: "confidential", pricingModel: "Setup + monthly", version: "0.9.0", maintenance: "beta", solution: "collections-receivables" },
  { slug: "school-fees-term-cycle", name: "School Fees Term Cycle", division: "automate", industry: "education", fn: "education-admin", problem: "Arrears and bursar workload at term start.", workflow: "Fee structure → statements → reminders → payment matching by admission number → receipts → arrears ladder.", integrations: ["school-ms", "mpesa-daraja", "whatsapp-business", "sms"], complexity: "medium", prerequisites: ["Learner list", "Fee structure"], setupTime: "3–5 weeks", securityClass: "confidential", pricingModel: "Monthly per-learner band", version: "0.1.0", maintenance: "planned", solution: "school-fee-collection" },
  { slug: "rent-cycle", name: "Monthly Rent Cycle", division: "automate", industry: "property-management", fn: "property-real-estate", problem: "Rent matching and arrears.", workflow: "Invoices → reminders → unit-level matching → receipts → owner statements → arrears ladder.", integrations: ["mpesa-daraja", "whatsapp-business", "pms"], complexity: "medium", prerequisites: ["Tenancy register"], setupTime: "3–5 weeks", securityClass: "confidential", pricingModel: "Monthly per-unit band", version: "0.1.0", maintenance: "planned", solution: "rent-collection" },
  { slug: "voice-receptionist-clinic", name: "Clinic Voice Receptionist", division: "converse", industry: "healthcare", fn: "customer-service", problem: "Missed calls and front-desk overload.", workflow: "Inbound call → intent → booking or answer → transfer rules (urgent/clinical) → WhatsApp confirmation.", integrations: ["voice", "whatsapp-business", "hmis"], complexity: "medium", prerequisites: ["Services and hours", "Booking calendar", "Transfer numbers"], setupTime: "3–5 weeks", securityClass: "restricted", pricingModel: "Setup + monthly with minute allowance", version: "0.1.0", maintenance: "planned", solution: "ai-voice-receptionist" },
  { slug: "sha-claim-precheck", name: "SHA Claim Pre-check", division: "automate", industry: "healthcare", fn: "healthcare-admin", problem: "Claims returned for administrative reasons.", workflow: "Claim pack → document completeness → payer rule checks → flags to claims officer → submission → return tracking.", integrations: ["hmis", "sha"], complexity: "high", prerequisites: ["Payer rules", "Historical rejections"], setupTime: "6–10 weeks", securityClass: "restricted", pricingModel: "Setup + monthly", version: "0.1.0", maintenance: "planned", solution: "sha-claims-scrubber" },
  { slug: "lead-response-60s", name: "60-second Lead Response", division: "converse", industry: "cross-industry", fn: "sales-crm", problem: "Leads answered too late.", workflow: "Lead event → reply on lead's channel → qualifying questions → score → book meeting → CRM sync.", integrations: ["meta-ads", "whatsapp-business", "hubspot", "google-workspace"], complexity: "low", prerequisites: ["Lead sources", "Qualification criteria"], setupTime: "2–4 weeks", securityClass: "internal", pricingModel: "Monthly", version: "0.1.0", maintenance: "planned", solution: "instant-lead-response" },
  { slug: "kpi-morning-pack", name: "Morning KPI Pack", division: "intelligence", industry: "cross-industry", fn: "business-intelligence", problem: "Owners lack daily visibility.", workflow: "Nightly sync → KPI calculation → commentary → 7am WhatsApp delivery.", integrations: ["pos", "quickbooks", "whatsapp-business"], complexity: "low", prerequisites: ["Data access", "KPI definitions"], setupTime: "2–3 weeks", securityClass: "internal", pricingModel: "Monthly", version: "0.1.0", maintenance: "planned", solution: "kpi-pack-whatsapp" },
  { slug: "dsar-workflow", name: "Data Subject Request Workflow", division: "automate", industry: "cross-industry", fn: "compliance-workflow", problem: "Access and erasure requests handled late or not at all.", workflow: "Request → identity check → deadline → data location → DPO approval → response → suppression update.", integrations: ["rest-webhooks", "email-intake"], complexity: "medium", prerequisites: ["System inventory", "Named DPO"], setupTime: "3–5 weeks", securityClass: "restricted", pricingModel: "Setup + monthly", version: "1.0.0", maintenance: "active", solution: "dpa-operations" },
  { slug: "content-approval-loop", name: "Content Approval Loop", division: "studio", industry: "cross-industry", fn: "marketing-operations", problem: "Content production stalls without a clear approval path.", workflow: "Request → AI drafts → editor review → client approval → scheduled publishing → performance capture.", integrations: ["instagram-facebook", "meta-ads"], complexity: "low", prerequisites: ["Brand kit"], setupTime: "1–2 weeks", securityClass: "internal", pricingModel: "Included in Studio bundles", version: "0.9.0", maintenance: "beta" },
  { slug: "donor-report-assembly", name: "Donor Report Assembly", division: "automate", industry: "ngos", fn: "ngo-humanitarian", problem: "Reporting season overload.", workflow: "Field data → cleaning → indicator mapping → narrative draft → programme lead approval → export to donor template.", integrations: ["google-workspace", "csv-excel"], complexity: "medium", prerequisites: ["Log-frames", "Data sources"], setupTime: "4–6 weeks", securityClass: "confidential", pricingModel: "Setup + monthly", version: "0.1.0", maintenance: "planned", solution: "donor-reporting" },
];

export const resources: Resource[] = [
  {
    slug: "etims-expense-validation-guide",
    title: "eTIMS and your expenses: a practical guide for finance teams",
    kind: "guide",
    category: "Finance & tax automation",
    summary: "What KRA's data-driven validation means for expense claims, and a monthly routine to keep your claims supported.",
    readingMinutes: 8,
    published: "2026-10-20",
    related: ["etims-compliance-reconciliation", "pre-filing-variance-report"],
    body: `**Short answer:** KRA increasingly checks the expenses you declare against invoices recorded in eTIMS. Expenses without valid eTIMS support are at risk of being disallowed. The practical fix is to check invoices when you receive them, not when you file. *This guide is general information, not tax advice. Speak to your tax adviser about your position.*

## What has changed
From 2026, declared income and expenses are compared with data KRA already holds from eTIMS and customs. In practice, purchase invoices that were not issued through eTIMS, or whose details do not match what is recorded, are weak support for a deduction.

## Where businesses get caught out
- Small suppliers who issue manual or non-compliant invoices
- Invoices issued to the wrong buyer PIN
- Amount or date mismatches between the invoice and the eTIMS record
- Invoices that cannot be found at year-end

## A monthly routine that works
1. **At receipt:** capture every supplier invoice in one place, whether it arrives by email, WhatsApp or on paper.
2. **Within a week:** check each invoice's eTIMS validity and record the result.
3. **Immediately:** ask suppliers to correct invalid invoices while the transaction is fresh.
4. **Before filing:** produce a variance report comparing your ledger with validated support, and review it with your adviser.

## What to automate
The checking and chasing are repetitive and rules-based, which makes them a good fit for automation. Interpretation is not. A good system extracts invoice details with a confidence score, sends uncertain ones to a person, checks validity and drafts supplier correction requests for your approval.

## Questions to ask any provider
- How do you connect to eTIMS, and is that route approved?
- What happens when a photo is unreadable?
- Who approves messages to my suppliers?
- Can my tax adviser see the evidence trail?`,
    faqs: [
      { q: "Does every expense need an eTIMS invoice?", a: "There are exceptions and transitional rules. Confirm your position with your tax adviser. The guide covers the common case of supplier purchase invoices." },
      { q: "Can I fix last year's invoices now?", a: "Sometimes suppliers can reissue invoices, but it is harder the older the transaction. That is why checking at receipt matters." },
    ],
  },
  {
    slug: "whatsapp-agent-buyers-checklist",
    title: "Buying a WhatsApp AI agent: a 12-point checklist",
    kind: "checklist",
    category: "WhatsApp commerce",
    summary: "The questions to ask before you put an AI agent on your business WhatsApp.",
    readingMinutes: 5,
    published: "2026-10-18",
    related: ["whatsapp-sales-support-agent", "payment-confirmation-agent"],
    body: `**Short answer:** a good WhatsApp agent answers only from knowledge you approve, verifies payments against real receipts, hands over to a person cleanly, and respects consent. Use this checklist to compare providers.

## Grounding and accuracy
1. Does it answer only from your approved catalogue, prices and policies?
2. What does it do when it does not know the answer?
3. Is it tested on your real customer questions before launch?

## Payments
4. Does it verify M-Pesa payments against your real receipts, not screenshots?
5. Who handles refunds and disputes?

## Handover
6. Can your team take over any conversation instantly?
7. Does the person taking over see the full conversation?

## Language
8. Does it handle Swahili and code-switching (including Sheng)?

## Compliance
9. Is it on the official WhatsApp Business Platform?
10. Does it record consent and honour opt-outs immediately?

## Accountability
11. What is the owner metric, and how is it reported?
12. Can you switch it off instantly?`,
  },
  {
    slug: "automation-roi-labour-capacity-vs-cash",
    title: "Automation ROI: labour capacity is not the same as cash savings",
    kind: "guide",
    category: "Automation ROI",
    summary: "How to build an honest business case for automation without double-counting.",
    readingMinutes: 7,
    published: "2026-10-15",
    related: ["mpesa-bank-reconciliation", "collections-receivables"],
    body: `**Short answer:** hours freed by automation are valuable only if they are redeployed or avoid future hiring. Count them as *labour capacity*, separately from *cash savings* such as avoided penalties, recovered revenue or reduced overtime.

## Three kinds of value
- **Labour capacity:** time freed, valued at the fully loaded cost of that time. Real, but not cash unless you act on it.
- **Avoidable cost:** errors, rework, penalties and write-offs that stop happening.
- **Incremental revenue:** sales or collections that would not have happened otherwise, counted only with a clean baseline.

## The calculation
Baseline annual cost = frequency × minutes per task ÷ 60 × hourly cost, plus error cost. Benefit = coverage × baseline, minus the human review time that remains. Net benefit = benefit − first-year solution cost.

## Use scenarios, not one number
Model low, base and high cases. If the low case does not work, the project is risky.

## The Elans calculator
Our [ROI calculator](/roi) shows every formula and keeps capacity and cash separate. It is an estimate, not a guarantee.`,
  },
  {
    slug: "geo-explained",
    title: "Generative Engine Optimisation (GEO), explained for East African businesses",
    kind: "guide",
    category: "GEO / AI visibility",
    summary: "What GEO is, how it differs from SEO and five things to do this month.",
    readingMinutes: 6,
    published: "2026-10-12",
    related: ["ai-readable-product-data"],
    body: `**Short answer:** GEO is the practice of making your business accurately described and cited in AI-generated answers from tools like ChatGPT, Gemini, Perplexity and Google's AI answers.

## Why it matters
More people now ask AI assistants for recommendations. Studies suggest that the sources AI assistants cite often differ from the top Google results, so good SEO alone does not guarantee you appear.

## How GEO differs from SEO
- **Entities over keywords:** AI systems need a clear, consistent description of who you are.
- **Quotable answers:** concise, factual answers are easier to cite.
- **Corroboration:** consistent information across trusted sources builds confidence.

## Five things to do this month
1. Make your name, address and phone number identical everywhere.
2. Write a clear one-paragraph description of your business on your site.
3. Add FAQ content that answers real customer questions in the first sentence.
4. Add Organization and Service structured data.
5. Run our free [AI Visibility Check](/growth/ai-visibility-check) to see a sample snapshot.`,
  },
  {
    slug: "odpc-ready-marketing",
    title: "ODPC-ready marketing: consent, opt-outs and erasure in practice",
    kind: "checklist",
    category: "AI security & governance",
    summary: "A practical checklist for marketing teams under Kenya's Data Protection Act.",
    readingMinutes: 6,
    published: "2026-10-08",
    related: ["consent-aware-broadcasts", "dpa-operations"],
    body: `**Short answer:** keep a record of consent by purpose and channel, honour opt-outs everywhere immediately, and make sure erasure requests stop all marketing. *General information, not legal advice.*

## The checklist
- Record how and when each contact consented, and to what
- Separate service messages from marketing
- Put an opt-out in every marketing message
- Apply opt-outs across WhatsApp, SMS and email at once
- Maintain one suppression list that every tool respects
- Track access and erasure requests with deadlines
- Keep a breach register and know your 72-hour notification process

## Common failure
Marketing that continues after a customer has asked to be erased. This has led to ODPC complaints and awards. A shared suppression list prevents it.`,
  },
  {
    slug: "reconciliation-vs-matching",
    title: "M-Pesa reconciliation: rules first, AI second",
    kind: "comparison",
    category: "Finance & tax automation",
    summary: "Why deterministic rules should match most payments, and where AI genuinely helps.",
    readingMinutes: 5,
    published: "2026-10-05",
    related: ["mpesa-bank-reconciliation"],
    body: `**Short answer:** use deterministic rules (reference, phone, amount, date) for the majority of matches, and AI only for messy free-text references, always with a confidence score and human review below the threshold.

## Rules are better for money
Rules are predictable, auditable and fast. Most payments with a correct account reference should never need AI.

## AI is better for language
References like "fees ya Wanjiku form 2" or "rent B4 Oct" need language understanding. AI can propose a match and explain why.

## The combination
| Approach | Strength | Risk |
|---|---|---|
| Rules only | Auditable | Leaves many exceptions |
| AI only | Flexible | Unpredictable for money |
| Rules + AI suggestions with thresholds | Best of both | Needs good review UX |`,
  },
  {
    slug: "glossary-agentic-ai",
    title: "Glossary: agentic AI terms in plain English",
    kind: "glossary",
    category: "AI agents",
    summary: "Agents, evals, grounding, human-in-the-loop and more, defined simply.",
    readingMinutes: 4,
    published: "2026-10-01",
    related: [],
    body: `## Agent
Software that uses an AI model to decide which steps to take towards a goal, using tools it is allowed to use.

## Grounding
Restricting an AI's answers to approved sources, such as your catalogue or policies.

## Evaluation set (eval)
A collection of real examples with known correct outputs, used to test an AI workflow before and after every change.

## Human-in-the-loop
A design where a person approves or reviews certain AI outputs before they take effect.

## Confidence threshold
The level of certainty below which an AI output is sent to a person.

## Kill switch
A control that stops an automation immediately.

## Agent washing
Marketing ordinary automation or chatbots as autonomous "agents".`,
  },
  {
    slug: "sha-claims-returns-analysis",
    title: "Analysing your SHA claim returns: a 30-minute exercise",
    kind: "industry",
    category: "Industry workflow examples",
    summary: "How hospital billing teams can find the top causes of returned claims using data they already have.",
    readingMinutes: 6,
    published: "2026-09-28",
    related: ["sha-claims-scrubber", "claims-resubmission-tracking"],
    body: `**Short answer:** export three months of returned and rejected claims, group them by stated reason, and you will usually find that a few administrative causes account for most of the value.

## Step by step
1. Export returned and rejected claims with reason, value and date.
2. Normalise reasons into 8–12 categories (missing pre-authorisation, missing signature, coding inconsistency, member eligibility…).
3. Rank by value, not count.
4. For the top three, write the check that would have caught each one before submission.
5. Assign an owner to every open return older than 30 days.

## What this tells you
Which checks to automate first, and how much cash is waiting in resubmissions. *Administrative analysis only. Clinical and coding decisions remain with qualified staff.*`,
  },
];

export const examples: IllustrativeExample[] = [
  {
    slug: "school-term-start",
    title: "A school's first fortnight of term",
    industry: "education",
    solution: "school-fee-collection",
    scenario: "A private school with several hundred learners receives most fee payments in the first two weeks of term, many with incomplete references.",
    before: flow(["i:Hundreds of M-Pesa payments", "m:Bursar matches by hand over several days", "m:Parents call to confirm receipt", "k:Arrears chased inconsistently"]),
    after: flow(["i:Payments ingested as they arrive", "r:Matched by admission number; messy references suggested", "x:Receipts sent instantly", "p:Bursar reviews exceptions only", "o:Balance messages to parents with payment links"]),
    whatWeMeasure: ["% of payments auto-matched", "Bursar hours in weeks 1–2", "Fees collected by week 3"],
  },
  {
    slug: "hardware-supplier-etims",
    title: "A hardware supplier's month-end",
    industry: "construction-hardware",
    solution: "etims-compliance-reconciliation",
    scenario: "A hardware business buys from dozens of small suppliers and claims their invoices as expenses.",
    before: flow(["i:Invoices on paper and WhatsApp", "m:Keyed into accounts", "w:No eTIMS check", "k:Unsupported expenses found at filing"]),
    after: flow(["i:Invoices forwarded on receipt", "a:Fields extracted with confidence", "x:eTIMS check", "x:Correction requests to suppliers", "o:Variance report before filing"]),
    whatWeMeasure: ["% of expenses with valid eTIMS support", "KES at risk", "Supplier corrections obtained"],
  },
  {
    slug: "clinic-evening-calls",
    title: "A clinic's evening phone line",
    industry: "healthcare",
    solution: "ai-voice-receptionist",
    scenario: "A busy outpatient clinic receives calls after hours and during peak morning sessions.",
    before: flow(["i:Calls during peaks and evenings", "w:Missed or voicemail", "k:Patients book elsewhere"]),
    after: flow(["i:Every call answered", "a:Booking or FAQ in English/Swahili", "p:Urgent calls transferred or directed to emergency numbers", "x:WhatsApp confirmation", "o:Booked appointments"]),
    whatWeMeasure: ["Answered call rate", "Bookings from calls", "After-hours bookings"],
  },
  {
    slug: "boutique-whatsapp-orders",
    title: "A fashion boutique's WhatsApp orders",
    industry: "retail-ecommerce",
    solution: "whatsapp-sales-support-agent",
    scenario: "A boutique sells mostly through WhatsApp and Instagram, with the owner answering every message.",
    before: flow(["i:Messages at all hours", "m:Owner sends photos and prices", "m:Checks M-Pesa for every 'paid'", "k:Late replies lose sales"]),
    after: flow(["i:Customer asks", "a:Agent answers from catalogue", "x:Order and STK push", "r:Payment verified", "p:Owner handles custom requests", "o:Orders confirmed in minutes"]),
    whatWeMeasure: ["First-response time", "After-hours orders", "Resolution rate"],
  },
];
