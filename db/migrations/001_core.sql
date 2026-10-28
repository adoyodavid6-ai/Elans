-- Elans core schema.
-- Tenancy: every tenant table carries tenant_id and is protected by row-level security.
-- The application connects as `elans_app` (no BYPASSRLS) and, inside each transaction, sets:
--   app.tenant_id  — the tenant being acted on
--   app.user_id    — the signed-in user (may be empty for public requests)
--   app.auth       — 'system' only inside the auth module (users/sessions lookups)
--   app.staff_role — Elans staff role, used only for global content writes
-- Staff never get a blanket bypass: to act on a client tenant the app first checks an
-- access_grants row and audits it (DECISIONS D-007).

create extension if not exists pgcrypto;

create or replace function app_tenant() returns uuid language sql stable as $$
  select nullif(current_setting('app.tenant_id', true), '')::uuid
$$;
create or replace function app_user() returns uuid language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')::uuid
$$;
create or replace function app_is_system() returns boolean language sql stable as $$
  select coalesce(current_setting('app.auth', true), '') = 'system'
$$;
create or replace function app_staff_role() returns text language sql stable as $$
  select nullif(current_setting('app.staff_role', true), '')
$$;

-- ───────────────────────────── Identity & tenancy ─────────────────────────────
create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('internal','client','partner','demo')),
  parent_tenant_id uuid references tenants(id),
  country_code char(2) not null default 'KE',
  currency char(3) not null default 'KES',
  locale text not null default 'en-KE',
  data_region text not null default 'eu-west-2',
  kill_switch boolean not null default false,
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null,
  password_hash text not null,
  mfa_secret text,
  mfa_enabled boolean not null default false,
  staff_role text check (staff_role in ('admin','content_editor','consultant','engineer','support')),
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table memberships (
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('owner','admin','approver','member','viewer')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create table sessions (
  id text primary key,                 -- sha256 of the cookie token
  user_id uuid not null references users(id) on delete cascade,
  mfa_passed boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ip text,
  user_agent text
);

create table access_grants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  staff_user_id uuid not null references users(id),
  reason text not null,
  approved_by uuid references users(id),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table audit_log (
  id bigserial primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  actor_id uuid,
  actor_label text,
  action text not null,
  entity text,
  entity_id text,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ───────────────────────────── Global content (no tenant) ─────────────────────────────
create table content_items (
  type text not null,
  slug text not null,
  data jsonb not null,
  publish_state text not null default 'published' check (publish_state in ('draft','published')),
  version int not null default 1,
  edited boolean not null default false,  -- true once changed in the console (seed will not overwrite)
  updated_at timestamptz not null default now(),
  updated_by text,
  primary key (type, slug)
);
create table content_revisions (
  id bigserial primary key,
  type text not null,
  slug text not null,
  version int not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  created_by text
);
create table price_points (
  key text primary key,
  label text not null,
  amount numeric(14,2),
  currency char(3) not null default 'KES',
  token text not null,
  confirmed boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by text
);
create table site_settings (
  key text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);
create table score_weight_versions (
  id serial primary key,
  weights jsonb not null,
  note text,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  created_by text
);
create table sources (
  id text primary key,
  claim text not null,
  url text,
  source_type text,
  accessed_on date,
  state text not null default 'unverified' check (state in ('unverified','verified','vendor_estimate')),
  notes text
);
create table prompt_versions (
  id serial primary key,
  prompt_key text not null,
  version text not null,
  body text not null,
  model text,
  eval_score numeric(5,4),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (prompt_key, version)
);
create table eval_runs (
  id serial primary key,
  prompt_key text not null,
  version text not null,
  mode text not null,
  score numeric(5,4) not null,
  cases int not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table kb_articles (
  id serial primary key,
  slug text unique not null,
  title text not null,
  body text not null,
  audience text not null default 'client',
  updated_at timestamptz not null default now()
);

-- ───────────────────────────── Leads, assessment, sessions ─────────────────────────────
create table contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text,
  email text,
  phone text,
  organisation text,
  role_title text,
  preferred_language text default 'en',
  erased_at timestamptz,
  created_at timestamptz not null default now()
);
create table consents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  contact_id uuid references contacts(id) on delete cascade,
  purpose text not null,                -- report_delivery | marketing | whatsapp | analytics | booking
  channel text not null default 'any',
  granted boolean not null,
  notice_version text not null,
  source text not null,
  created_at timestamptz not null default now()
);
create table leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  contact_id uuid references contacts(id),
  source text not null,                 -- assessment | contact | roi | ai_visibility | chat | booking | partner
  source_detail text,
  utm jsonb not null default '{}',
  industry text,
  score int not null default 0,
  stage text not null default 'new',    -- new | contacted | qualified | discovery | diagnostic | proposal | won | lost
  owner_id uuid references users(id),
  message text,
  lost_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table assessments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  lead_id uuid references leads(id),
  resume_token_hash text not null,
  state text not null default 'draft' check (state in ('draft','submitted','reviewed')),
  current_step int not null default 1,
  industry text,
  answers jsonb not null default '{}',
  reviewed_by uuid references users(id),
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz
);
create table opportunity_scores (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  assessment_id uuid not null references assessments(id) on delete cascade,
  solution_slug text not null,
  score int not null,
  criteria jsonb not null,
  flag text not null default 'none' check (flag in ('none','human_review','excluded')),
  weight_version_id int references score_weight_versions(id),
  rationale text
);
create table reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  assessment_id uuid not null references assessments(id) on delete cascade,
  public_token text not null unique,
  sections jsonb not null,
  generator text not null,              -- 'rules' or model id
  created_at timestamptz not null default now()
);
create table roi_scenarios (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  lead_id uuid references leads(id),
  calculator text not null,
  inputs jsonb not null,
  outputs jsonb not null,
  formula_version text not null,
  created_at timestamptz not null default now()
);
create table ai_visibility_checks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  lead_id uuid references leads(id),
  brand text not null,
  category text,
  location text,
  queries jsonb not null,
  results jsonb not null,
  method text not null,
  created_at timestamptz not null default now()
);
create table payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  provider text not null check (provider in ('mpesa','card','mock')),
  purpose text not null,
  reference text not null,
  amount numeric(14,2) not null,
  currency char(3) not null default 'KES',
  phone text,
  status text not null default 'pending' check (status in ('pending','succeeded','failed','cancelled')),
  provider_ref text,
  idempotency_key text not null unique,
  raw jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table bookings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  contact_id uuid references contacts(id),
  lead_id uuid references leads(id),
  type text not null check (type in ('strategy','discovery','support','diagnostic')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'pending_payment' check (status in ('pending_payment','confirmed','cancelled','completed','no_show')),
  topic text,
  payment_id uuid references payments(id),
  created_at timestamptz not null default now()
);
create unique index bookings_slot_unique on bookings (starts_at) where status in ('pending_payment','confirmed');

-- ───────────────────────────── Conversations ─────────────────────────────
create table conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  engine_instance_id uuid,
  channel text not null check (channel in ('web','whatsapp','instagram','voice','sms')),
  contact_id uuid references contacts(id),
  visitor_ref text,
  language text default 'en',
  status text not null default 'open' check (status in ('open','handed_off','closed')),
  resolution text check (resolution in ('resolved','handed_off','abandoned')),
  assigned_to uuid references users(id),
  meta jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  direction text not null check (direction in ('in','out')),
  author text not null check (author in ('customer','agent','human','system')),
  body text not null,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table handoffs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  reason text not null,
  requested_at timestamptz not null default now(),
  accepted_by uuid references users(id),
  accepted_at timestamptz,
  callback_requested boolean not null default false
);

-- ───────────────────────────── Commercial ─────────────────────────────
create table opportunities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  lead_id uuid references leads(id),
  client_tenant_id uuid references tenants(id),
  name text not null,
  stage text not null default 'discovery',  -- discovery | diagnostic | design | proposal | negotiation | won | lost
  value numeric(14,2) not null default 0,
  owner_id uuid references users(id),
  close_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table quotes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  number text not null unique,
  status text not null default 'draft' check (status in ('draft','sent','accepted','declined','expired')),
  lines jsonb not null default '[]',
  term_months int not null default 6,
  split_setup boolean not null default false,
  totals jsonb not null default '{}',
  checks jsonb not null default '{}',
  public_token text unique,
  accepted_name text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  accepted_at timestamptz
);
create table contracts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  quote_id uuid references quotes(id),
  client_tenant_id uuid references tenants(id),
  start_date date not null,
  min_term_months int not null,
  status text not null default 'active',
  signed_by text,
  signed_at timestamptz
);
create table change_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  contract_id uuid references contracts(id),
  project_id uuid,
  title text not null,
  description text,
  amount numeric(14,2) not null,
  status text not null default 'proposed' check (status in ('proposed','approved','declined','done')),
  created_at timestamptz not null default now()
);

-- ───────────────────────────── Client delivery (client tenant) ─────────────────────────────
create table projects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  solution_slug text,
  stage text not null default 'discover' check (stage in ('discover','design','build','prove','run')),
  status text not null default 'on_track' check (status in ('on_track','at_risk','blocked','done')),
  accountable_engineer text,
  start_date date,
  target_date date,
  created_at timestamptz not null default now()
);
create table onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  title text not null,
  owner text not null check (owner in ('client','elans')),
  status text not null default 'todo' check (status in ('todo','doing','done')),
  due_date date,
  sort int not null default 0
);
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  package_key text not null,
  status text not null default 'active',
  monthly_amount numeric(14,2) not null,
  currency char(3) not null default 'KES',
  allowances jsonb not null default '{}',
  started_at date not null default current_date
);
create table invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  number text not null,
  status text not null default 'issued' check (status in ('draft','issued','paid','overdue','void')),
  amount numeric(14,2) not null,
  currency char(3) not null default 'KES',
  lines jsonb not null default '[]',
  issued_at date not null default current_date,
  due_date date not null,
  etims_invoice_no text,
  paid_at timestamptz,
  unique (tenant_id, number)
);
create table usage_events (
  id bigserial primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  meter text not null,
  quantity numeric(14,4) not null,
  cost numeric(14,4) not null default 0,
  run_id uuid,
  created_at timestamptz not null default now()
);
create table tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  subject text not null,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'open' check (status in ('open','pending','resolved','closed')),
  sla_due_at timestamptz,
  created_by uuid references users(id),
  created_label text,
  assigned_to uuid references users(id),
  conversation_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table ticket_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  ticket_id uuid not null references tickets(id) on delete cascade,
  author_label text not null,
  is_staff boolean not null default false,
  body text not null,
  created_at timestamptz not null default now()
);
create table documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  kind text not null default 'other',
  mime text,
  size_bytes int,
  content bytea,                        -- dev storage; production uses object storage (storage_path)
  storage_path text,
  uploaded_by text,
  created_at timestamptz not null default now()
);
create table dpa_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  subject_ref text not null,
  type text not null check (type in ('access','erasure','correction','objection','export')),
  status text not null default 'received' check (status in ('received','verifying','in_progress','completed','rejected')),
  received_at timestamptz not null default now(),
  due_at timestamptz not null,
  closed_at timestamptz,
  notes text
);
create table breach_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  detected_at timestamptz not null default now(),
  summary text not null,
  severity text not null default 'low',
  status text not null default 'open' check (status in ('open','notified','closed')),
  notification_due_at timestamptz not null,
  notified_at timestamptz
);
create table outbox (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  channel text not null check (channel in ('email','whatsapp','sms')),
  to_addr text not null,
  subject text,
  body text not null,
  status text not null default 'queued' check (status in ('queued','sent','failed','logged')),
  meta jsonb not null default '{}',
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create table partners (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  partner_tenant_id uuid references tenants(id),
  name text not null,
  programme text not null check (programme in ('referral','white_label')),
  status text not null default 'applied',
  contact_email text,
  created_at timestamptz not null default now()
);

-- ───────────────────────────── Runtime (client tenant) ─────────────────────────────
create table engine_instances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  solution_slug text not null,
  name text not null,
  template_version text not null default '1.0.0',
  status text not null default 'proving' check (status in ('configuring','proving','live','paused')),
  autonomy jsonb not null default '{}',
  owner_metric text not null,
  baseline_value numeric,
  baseline_note text,
  config jsonb not null default '{}',
  kill_switch boolean not null default false,
  monthly_budget numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);
create table connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  integration_slug text not null,
  mode text not null check (mode in ('live','sandbox','mock')),
  secret_ref text,
  status text not null default 'connected',
  created_at timestamptz not null default now()
);
create table runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  engine_instance_id uuid not null references engine_instances(id) on delete cascade,
  trigger text not null,
  idempotency_key text not null,
  status text not null default 'running' check (status in ('running','waiting_review','waiting_approval','succeeded','failed','cancelled','blocked')),
  input jsonb not null default '{}',
  output jsonb not null default '{}',
  cost numeric(14,4) not null default 0,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (engine_instance_id, idempotency_key)
);
create table run_steps (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  run_id uuid not null references runs(id) on delete cascade,
  seq int not null,
  name text not null,
  kind text not null check (kind in ('rule','ai','action','review','approval')),
  status text not null check (status in ('succeeded','failed','skipped','waiting')),
  input_hash text,
  output jsonb not null default '{}',
  confidence numeric(5,4),
  model text,
  prompt_version text,
  attempts int not null default 1,
  duration_ms int,
  error text,
  created_at timestamptz not null default now()
);
create table review_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  run_id uuid references runs(id) on delete cascade,
  engine_instance_id uuid references engine_instances(id) on delete cascade,
  queue text not null default 'elans' check (queue in ('elans','client')),
  kind text not null,
  title text not null,
  payload jsonb not null,
  status text not null default 'open' check (status in ('open','resolved')),
  sla_due_at timestamptz not null,
  decided_by text,
  decided_at timestamptz,
  decision jsonb,
  created_at timestamptz not null default now()
);
create table approvals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  run_id uuid references runs(id) on delete cascade,
  engine_instance_id uuid references engine_instances(id) on delete cascade,
  action_type text not null,
  title text not null,
  summary text not null,
  proposed jsonb not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired')),
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create table incidents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  engine_instance_id uuid references engine_instances(id) on delete set null,
  severity text not null check (severity in ('sev1','sev2','sev3','sev4')),
  title text not null,
  detail text,
  status text not null default 'open' check (status in ('open','mitigated','resolved')),
  opened_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- eTIMS proof solution
create table etims_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  engine_instance_id uuid not null references engine_instances(id) on delete cascade,
  run_id uuid references runs(id) on delete set null,
  document_id uuid references documents(id) on delete set null,
  source text not null,
  period char(7) not null,
  supplier_pin text,
  supplier_name text,
  buyer_pin text,
  invoice_no text,
  cu_invoice_no text,
  invoice_date date,
  amount_total numeric(14,2),
  vat_amount numeric(14,2),
  field_confidence jsonb not null default '{}',
  status text not null check (status in ('needs_review','valid','invalid','not_found','mismatch','duplicate','pending_check')),
  reason text,
  check_ref text,
  created_at timestamptz not null default now()
);
create table etims_suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  engine_instance_id uuid not null references engine_instances(id) on delete cascade,
  pin text not null,
  name text,
  contact text,
  invoices_total int not null default 0,
  invoices_invalid int not null default 0,
  status text not null default 'ok' check (status in ('ok','watch','non_compliant')),
  last_request_at timestamptz,
  unique (engine_instance_id, pin)
);

-- Reconciliation (M-Pesa & bank)
create table recon_receivables (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  engine_instance_id uuid not null references engine_instances(id) on delete cascade,
  number text not null,
  customer_name text not null,
  customer_phone text,
  account_ref text,
  amount numeric(14,2) not null,
  balance numeric(14,2) not null,
  due_date date,
  status text not null default 'open' check (status in ('open','part_paid','paid'))
);
create table recon_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  engine_instance_id uuid not null references engine_instances(id) on delete cascade,
  source text not null,
  txn_ref text not null,
  txn_at timestamptz not null,
  amount numeric(14,2) not null,
  payer_name text,
  payer_phone text,
  reference text,
  receivable_id uuid references recon_receivables(id),
  match_method text,
  confidence numeric(5,4),
  status text not null default 'unmatched' check (status in ('matched','suggested','unmatched','ignored')),
  receipted_at timestamptz,
  unique (engine_instance_id, txn_ref)
);

-- Growth / Studio / Relate
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  channel text not null,
  status text not null default 'planned',
  start_date date,
  end_date date,
  kpis jsonb not null default '{}'
);
create table studio_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete set null,
  kind text not null check (kind in ('copy','image','video','ad_variant','post')),
  title text not null,
  body text,
  ai_generated boolean not null default true,
  status text not null default 'draft' check (status in ('draft','elans_review','awaiting_client','approved','scheduled','published','changes_requested')),
  scheduled_for timestamptz,
  feedback text,
  created_at timestamptz not null default now()
);
create table relationship_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  contact_id uuid references contacts(id) on delete cascade,
  display_name text not null,
  warmth int not null default 50,
  memory jsonb not null default '{}',
  last_interaction_at timestamptz,
  marketing_consent boolean not null default false
);
create table follow_ups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  profile_id uuid not null references relationship_profiles(id) on delete cascade,
  suggestion text not null,
  reason text not null,
  status text not null default 'suggested' check (status in ('suggested','approved','sent','dismissed','blocked_no_consent')),
  due_at timestamptz not null default now()
);

-- ───────────────────────────── Row-level security ─────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'audit_log','access_grants','contacts','consents','leads','assessments','opportunity_scores','reports',
    'roi_scenarios','ai_visibility_checks','payments','bookings','conversations','messages','handoffs',
    'opportunities','quotes','contracts','change_orders','projects','onboarding_tasks','subscriptions',
    'invoices','usage_events','tickets','ticket_messages','documents','dpa_requests','breach_log','outbox',
    'partners','engine_instances','connections','runs','run_steps','review_items','approvals','incidents',
    'etims_invoices','etims_suppliers','recon_receivables','recon_transactions','campaigns','studio_items',
    'relationship_profiles','follow_ups'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format(
      'create policy tenant_isolation on %I using (tenant_id = app_tenant()) with check (tenant_id = app_tenant())', t);
  end loop;
end $$;

-- tenants: a request sees only its own tenant row (system context sees all for provisioning)
alter table tenants enable row level security;
alter table tenants force row level security;
create policy tenant_self on tenants using (id = app_tenant() or app_is_system()) with check (app_is_system());

-- identity tables: only the auth module (system context) or the user themselves
alter table users enable row level security;
alter table users force row level security;
create policy users_self on users using (id = app_user() or app_is_system()) with check (app_is_system() or id = app_user());
alter table sessions enable row level security;
alter table sessions force row level security;
create policy sessions_system on sessions using (app_is_system()) with check (app_is_system());
alter table memberships enable row level security;
alter table memberships force row level security;
create policy memberships_scope on memberships
  using (app_is_system() or user_id = app_user() or tenant_id = app_tenant())
  with check (app_is_system());

-- global content: readable by all, writable only by Elans content roles
do $$
declare t text;
begin
  foreach t in array array['content_items','content_revisions','price_points','site_settings','score_weight_versions','sources','prompt_versions','eval_runs','kb_articles'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy read_all on %I for select using (true)', t);
    execute format('create policy write_staff on %I for all using (app_staff_role() in (''admin'',''content_editor'') or app_is_system()) with check (app_staff_role() in (''admin'',''content_editor'') or app_is_system())', t);
  end loop;
end $$;

-- Aggregated, PII-free operational metrics across tenants for the ops console.
create or replace function ops_portfolio_metrics()
returns table (tenant_id uuid, tenant_name text, kind text, active_instances bigint, runs_7d bigint, failed_7d bigint,
               open_reviews bigint, pending_approvals bigint, open_incidents bigint, mrr numeric)
language sql stable security definer set search_path = public as $$
  select t.id, t.name, t.kind,
    (select count(*) from engine_instances e where e.tenant_id = t.id and e.status in ('proving','live')),
    (select count(*) from runs r where r.tenant_id = t.id and r.started_at > now() - interval '7 days'),
    (select count(*) from runs r where r.tenant_id = t.id and r.status = 'failed' and r.started_at > now() - interval '7 days'),
    (select count(*) from review_items i where i.tenant_id = t.id and i.status = 'open'),
    (select count(*) from approvals a where a.tenant_id = t.id and a.status = 'pending'),
    (select count(*) from incidents i where i.tenant_id = t.id and i.status <> 'resolved'),
    coalesce((select sum(s.monthly_amount) from subscriptions s where s.tenant_id = t.id and s.status = 'active'), 0)
  from tenants t where t.kind in ('client','demo','partner')
$$;

create index on leads (tenant_id, created_at desc);
create index on runs (tenant_id, engine_instance_id, started_at desc);
create index on review_items (tenant_id, status);
create index on approvals (tenant_id, status);
create index on messages (conversation_id, created_at);
create index on etims_invoices (engine_instance_id, period);
create index on recon_transactions (engine_instance_id, status);
create index on audit_log (tenant_id, created_at desc);
