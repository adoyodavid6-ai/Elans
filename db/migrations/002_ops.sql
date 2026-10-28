-- Ops console additions: diagnostic workspace, notes, invites and PII-free queue views.

alter table opportunities add column diagnostic jsonb not null default '{}';
alter table opportunities add column notes text;

create table lead_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  author_label text not null,
  body text not null,
  created_at timestamptz not null default now()
);
alter table lead_notes enable row level security;
alter table lead_notes force row level security;
create policy tenant_isolation on lead_notes using (tenant_id = app_tenant()) with check (tenant_id = app_tenant());

-- Invitations to join a tenant (client users, partner users). Only the token hash is stored.
create table invites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  email text not null,
  role text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_by text,
  created_at timestamptz not null default now()
);
alter table invites enable row level security;
alter table invites force row level security;
create policy invites_scope on invites using (tenant_id = app_tenant() or app_is_system()) with check (tenant_id = app_tenant() or app_is_system());

-- Queue metadata across client tenants for the console. No message bodies or personal data:
-- opening an item requires a just-in-time access grant, which is audited.
create or replace function ops_ticket_queue()
returns table (id uuid, tenant_id uuid, tenant_name text, subject text, priority text, status text, sla_due_at timestamptz, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select t.id, t.tenant_id, tn.name, t.subject, t.priority, t.status, t.sla_due_at, t.created_at
  from tickets t join tenants tn on tn.id = t.tenant_id
  where tn.kind in ('client','demo','partner') and t.status in ('open','pending')
  order by t.sla_due_at nulls last
$$;

create or replace function ops_review_queue()
returns table (id uuid, tenant_id uuid, tenant_name text, kind text, title text, queue text, sla_due_at timestamptz, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, r.tenant_id, tn.name, r.kind, r.title, r.queue, r.sla_due_at, r.created_at
  from review_items r join tenants tn on tn.id = r.tenant_id
  where r.status = 'open' and r.queue = 'elans'
  order by r.sla_due_at
$$;

create or replace function ops_incident_queue()
returns table (id uuid, tenant_id uuid, tenant_name text, severity text, title text, status text, opened_at timestamptz)
language sql stable security definer set search_path = public as $$
  select i.id, i.tenant_id, tn.name, i.severity, i.title, i.status, i.opened_at
  from incidents i join tenants tn on tn.id = i.tenant_id
  where i.status <> 'resolved'
  order by i.severity, i.opened_at
$$;

-- Provisioning a client tenant happens in the system context (see lib/ops/provision.ts).
