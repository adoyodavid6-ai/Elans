# Elans — Core Data Model (Stage 0 ERD)

Postgres (Supabase). All tables have `id uuid pk`, `created_at`, `updated_at`. Money is
`amount_minor bigint` + `currency char(3)` — never floats. Country, currency, tax regime,
locale and phone format are **configuration** (`tenants`, `site_settings`), never code.

## Tenancy and RLS rules

1. **Global content** (catalogue, industries, pricing, frontier, templates, integrations, resources) has **no `tenant_id`**; public read of `published` rows only; write by Elans `content_editor` role.
2. **Tenant data** carries `tenant_id not null`; RLS policy `tenant_id in (select tenant_id from memberships where user_id = auth.uid())` plus role checks per action.
3. **Pre-tenant data** (assessments, leads, bookings) belongs to the **Elans internal tenant**; when a lead converts, a client tenant is created and relevant records are linked, not moved.
4. **Elans staff** reach a client tenant only via an `access_grants` row (reason, expiry, approver) — every read/write under a grant is audited (D-007).
5. **Partners**: `tenants.parent_tenant_id` models white-label sub-tenants; partner admins see children only through explicit grants.
6. CI runs an RLS isolation suite: two synthetic tenants, every tenant table, select/insert/update/delete must fail across the boundary.

## 1. Identity, tenancy, governance

```mermaid
erDiagram
  tenants ||--o{ memberships : has
  users ||--o{ memberships : has
  roles ||--o{ memberships : grants
  tenants ||--o{ tenants : "parent_tenant_id (white-label)"
  tenants ||--o{ access_grants : "staff access to"
  users ||--o{ access_grants : "granted to"
  tenants ||--o{ audit_log : records
  tenants ||--o{ consents : holds
  tenants ||--o{ dpa_requests : receives
  tenants ||--o{ breach_log : logs
  partners ||--o{ white_label_tenants : owns
  white_label_tenants }o--|| tenants : is

  tenants { uuid id PK
    text kind "internal|client|partner|demo"
    uuid parent_tenant_id FK
    text country_code
    text currency
    text tax_regime
    text locale
    text data_region
    bool kill_switch }
  users { uuid id PK "= auth.users.id"
    text email
    bool mfa_enrolled }
  roles { text key PK "owner|admin|approver|member|viewer|elans_*" }
  memberships { uuid tenant_id FK
    uuid user_id FK
    text role_key FK }
  access_grants { uuid tenant_id FK
    uuid staff_user_id FK
    text reason
    timestamptz expires_at
    uuid approved_by }
  audit_log { uuid tenant_id FK
    uuid actor_id
    text action
    text entity
    uuid entity_id
    text input_hash
    jsonb meta }
  consents { uuid tenant_id FK
    uuid contact_id FK
    text purpose "report|marketing|whatsapp|analytics"
    text channel
    text notice_version
    timestamptz granted_at
    timestamptz withdrawn_at }
  dpa_requests { uuid tenant_id FK
    text type "access|erasure|correction|objection"
    text status
    timestamptz due_at }
  breach_log { uuid tenant_id FK
    timestamptz detected_at
    timestamptz odpc_deadline "detected + 72h"
    text status }
  partners { uuid id PK
    uuid tenant_id FK
    text programme "referral|white_label" }
  white_label_tenants { uuid partner_id FK
    uuid tenant_id FK
    jsonb branding }
```

## 2. Catalogue & content (global)

```mermaid
erDiagram
  divisions ||--o{ solutions : groups
  solution_categories ||--o{ solutions : contains
  solutions }o--o{ industries : "solution_industries"
  solutions }o--o{ integrations : "solution_integrations (required|optional)"
  solutions }o--o{ solutions : "related_solutions"
  industries ||--o{ industry_packs : offers
  industry_packs }o--o{ solutions : bundles
  templates ||--o{ template_versions : versions
  templates }o--o{ solutions : implements
  pricing_packages ||--o{ price_points : priced_by
  solutions ||--o{ price_points : "from price"
  industry_packs ||--o{ price_points : "from price"
  frontier_topics }o--o{ solutions : "elans offer"
  resources }o--o{ solutions : links
  resources }o--o{ industries : links

  divisions { text key PK "automate|converse|grow|studio|relate|intelligence|partners" }
  solution_categories { text slug PK
    text name
    int sort }
  solutions { uuid id PK
    text slug
    text division_key FK
    text category_slug FK
    text status "live|pilot|planned|custom"
    text risk_class
    text complexity
    text timeline
    jsonb manual_workflow "WorkflowDiagram JSON"
    jsonb automated_workflow
    jsonb approval_points
    jsonb body "problem, affected, capabilities, benefits, success_indicators, faqs"
    text owner_metric
    bool is_illustrative_demo
    int content_completeness
    text publish_state }
  industries { text slug PK
    jsonb body
    jsonb kpis
    jsonb compliance_notes }
  industry_packs { text slug PK
    text industry_slug FK
    text status }
  integrations { text slug PK
    text status "supported|planned|custom_assessment"
    text adaptor_mode "live|sandbox|mock"
    text category }
  templates { text slug PK
    text division_key
    text security_class
    text maintenance_status }
  template_versions { uuid template_id FK
    text version
    jsonb definition
    uuid prompt_version_id
    numeric eval_score "internal only" }
  pricing_packages { text key PK "launch|growth|scale|enterprise|grow_*|session_*" }
  price_points { uuid id PK
    text subject_type
    text subject_key
    text kind "setup|monthly|usage|session"
    bigint amount_minor "null = quoted"
    text currency
    bool is_from_price
    date effective_from }
  frontier_topics { text slug PK
    text status }
  resources { text slug PK
    text template "guide|comparison|industry|checklist|glossary"
    uuid[] source_ids "-> sources" }
  sources { uuid id PK
    text claim
    text url
    date accessed_on
    text verification "unverified|verified|vendor_estimate" }
```

`sources` mirrors `SOURCES.md` so the CMS can refuse to publish a statistic without a verified source.

## 3. Assessment, scoring, ROI, leads, sessions (Elans internal tenant)

```mermaid
erDiagram
  assessments ||--o{ assessment_answers : has
  assessments ||--o{ opportunity_scores : produces
  score_weight_versions ||--o{ opportunity_scores : "weights used"
  assessments ||--o| reports : generates
  assessments ||--o{ roi_scenarios : "pre-fills"
  leads ||--o{ assessments : submitted
  leads }o--|| contacts : is
  contacts ||--o{ consents : gives
  contacts ||--o{ sessions_bookings : books
  sessions_bookings ||--o| payments : "paid by"
  leads ||--o{ ai_visibility_checks : ran

  assessments { uuid id PK
    uuid tenant_id FK
    text industry_slug
    text resume_token_hash
    text state "draft|submitted|reviewed" }
  assessment_answers { uuid assessment_id FK
    int step
    jsonb answer }
  opportunity_scores { uuid assessment_id FK
    uuid solution_id FK
    int score "0-100"
    jsonb criteria
    text flag "none|human_review|excluded"
    uuid weight_version_id FK }
  score_weight_versions { uuid id PK
    jsonb weights
    timestamptz activated_at }
  reports { uuid assessment_id FK
    jsonb sections "told_us | estimate | hypothesis — typed"
    text pdf_path }
  roi_scenarios { uuid id PK
    text calculator
    jsonb inputs
    jsonb outputs "low|base|high"
    text formula_version }
  leads { uuid tenant_id FK
    uuid contact_id FK
    text source
    text utm
    int lead_score
    text stage }
  contacts { uuid tenant_id FK
    text name
    text email
    text phone_e164
    text preferred_language }
  sessions_bookings { uuid contact_id FK
    text type "strategy|discovery|support"
    timestamptz starts_at
    text status }
  payments { uuid tenant_id FK
    text provider "mpesa|card"
    text provider_ref
    bigint amount_minor
    text currency
    text status
    text idempotency_key }
  ai_visibility_checks { uuid lead_id FK
    text brand
    jsonb queries
    jsonb results "sample snapshot" }
```

## 4. Commercial (ops console)

```mermaid
erDiagram
  leads ||--o{ opportunities : becomes
  opportunities ||--o{ quotes : has
  quotes ||--o{ quote_lines : contains
  quotes ||--o| contracts : "signed as"
  contracts ||--o{ change_orders : amends
  contracts ||--o{ subscriptions : creates
  contracts ||--o{ projects : delivers
  projects ||--o{ onboarding_tasks : has
  subscriptions ||--o{ invoices : bills
  tenants ||--o{ usage_events : meters
  invoices }o--o{ usage_events : "overage lines"
  tenants ||--o{ tickets : raises
  kb_articles }o--o{ tickets : "answers"

  opportunities { uuid tenant_id FK
    text stage "Elans Method stages"
    bigint value_minor }
  quotes { uuid opportunity_id FK
    numeric gross_margin
    bool margin_floor_breach
    int term_months }
  quote_lines { uuid quote_id FK
    uuid solution_id
    text kind
    bigint amount_minor }
  contracts { uuid quote_id FK
    text esign_ref
    date start_date
    int min_term_months }
  change_orders { uuid contract_id FK
    bigint amount_minor
    text status }
  subscriptions { uuid tenant_id FK
    text package_key
    jsonb allowances }
  invoices { uuid tenant_id FK
    text etims_invoice_no
    text status }
  usage_events { uuid tenant_id FK
    text meter "voice_min|wa_conversation|doc_page|ai_tokens|resolved_conversation"
    numeric quantity
    bigint cost_minor
    uuid run_id }
  projects { uuid tenant_id FK
    text status
    uuid accountable_engineer }
  onboarding_tasks { uuid project_id FK
    text status }
  tickets { uuid tenant_id FK
    text priority
    timestamptz sla_due_at }
  kb_articles { uuid id PK }
```

## 5. Runtime — automations, agents, growth (tenant data)

```mermaid
erDiagram
  tenants ||--o{ engine_instances : runs
  solutions ||--o{ engine_instances : "instance of"
  engine_instances }o--o{ connections : uses
  engine_instances ||--o{ runs : executes
  runs ||--o{ run_steps : has
  run_steps ||--o{ review_items : raises
  run_steps ||--o{ approvals : awaits
  runs ||--o{ incidents : triggers
  prompt_versions ||--o{ run_steps : "used by"
  engine_instances ||--o{ conversations : hosts
  conversations ||--o{ messages : contains
  conversations ||--o{ handoffs : escalates
  contacts ||--o{ conversations : participates
  contacts ||--o| relationship_profiles : profiled
  relationship_profiles ||--o{ follow_ups : suggests
  tenants ||--o{ campaigns : runs
  campaigns ||--o{ content_items : contains
  content_items ||--o{ content_approvals : "approved via"
  tenants ||--o{ reports_intel : receives

  engine_instances { uuid tenant_id FK
    uuid solution_id FK
    text template_version
    text status "proving|live|paused"
    jsonb autonomy "per action type opt-in"
    text owner_metric
    numeric baseline_value
    bigint monthly_budget_minor
    bool kill_switch }
  connections { uuid tenant_id FK
    text integration_slug
    text secret_ref "Vault ref only"
    text mode "live|sandbox|mock" }
  runs { uuid tenant_id FK
    uuid engine_instance_id FK
    text idempotency_key
    text status
    bigint cost_minor }
  run_steps { uuid run_id FK
    text kind "rule|ai|action"
    text input_hash
    jsonb output
    numeric confidence
    text model
    uuid prompt_version_id FK }
  prompt_versions { uuid id PK
    text prompt_key
    text version
    text body
    numeric eval_score }
  review_items { uuid tenant_id FK
    text queue "elans|client"
    timestamptz sla_due_at
    uuid reviewer_id
    text decision }
  approvals { uuid tenant_id FK
    text action_type
    jsonb proposed_action
    uuid decided_by
    text decision }
  incidents { uuid tenant_id FK
    text severity
    text status
    uuid on_call }
  conversations { uuid tenant_id FK
    text channel "whatsapp|web|instagram|voice"
    text language
    text resolution "resolved|handed_off|abandoned" }
  messages { uuid conversation_id FK
    text direction
    text body_encrypted
    bool is_untrusted "always true for inbound" }
  handoffs { uuid conversation_id FK
    uuid to_user
    text reason }
  relationship_profiles { uuid tenant_id FK
    uuid contact_id FK
    int warmth_score
    jsonb memory }
  follow_ups { uuid profile_id FK
    text suggestion
    bool consent_checked }
  campaigns { uuid tenant_id FK
    text channel
    jsonb kpis }
  content_items { uuid campaign_id FK
    text kind "copy|image|video|ad_variant"
    bool ai_generated
    text state }
  content_approvals { uuid content_item_id FK
    text stage "elans_review|client_approval"
    text decision }
  reports_intel { uuid tenant_id FK
    text kind
    uuid[] source_ids }
```

Tables named in §21 but merged here: `contacts` is shared by leads, conversations and Relate (one contact graph per tenant).
