-- Customisable document templates (quotation, contract, receipt) and the documents issued from them.
-- Owned by the Elans internal tenant; isolated by RLS like other pre-sale data.

create table doc_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  kind text not null check (kind in ('quotation','contract','receipt')),
  name text not null,
  is_default boolean not null default false,
  config jsonb not null,                 -- branding, company, numbering, tax, sections (see src/lib/documents/types.ts)
  version int not null default 1,
  archived boolean not null default false,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index doc_templates_one_default on doc_templates (tenant_id, kind) where is_default and not archived;

create table doc_template_revisions (
  id bigserial primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  template_id uuid not null references doc_templates(id) on delete cascade,
  version int not null,
  config jsonb not null,
  created_by text,
  created_at timestamptz not null default now()
);

create table doc_counters (
  tenant_id uuid not null references tenants(id) on delete cascade,
  kind text not null,
  year int not null,
  next int not null default 1,
  primary key (tenant_id, kind, year)
);

create table issued_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  kind text not null check (kind in ('quotation','contract','receipt')),
  template_id uuid references doc_templates(id) on delete set null,
  number text,                           -- assigned when issued
  status text not null default 'draft' check (status in ('draft','issued','accepted','void')),
  title text not null default '',
  client jsonb not null default '{}',    -- name, organisation, email, phone, address, taxPin
  data jsonb not null default '{}',      -- lines, dates, notes and kind-specific fields
  snapshot jsonb,                        -- template config frozen at issue, so later template edits never change an issued document
  totals jsonb not null default '{}',
  source_ref text,                       -- e.g. quote:<id>, contract:<id>, invoice:<id>
  public_token text unique,
  accepted_name text,
  accepted_at timestamptz,
  accepted_ip text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  issued_at timestamptz,
  unique (tenant_id, kind, number)
);
create index issued_documents_list on issued_documents (tenant_id, kind, created_at desc);

do $$
declare t text;
begin
  foreach t in array array['doc_templates','doc_template_revisions','doc_counters','issued_documents'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy tenant_isolation on %I using (tenant_id = app_tenant()) with check (tenant_id = app_tenant())', t);
  end loop;
end $$;

-- Public view of an issued document by its unguessable token (client view / acceptance page).
create or replace function public_document(p_token text)
returns table (id uuid, kind text, number text, status text, title text, client jsonb, data jsonb, snapshot jsonb, totals jsonb, accepted_name text, accepted_at timestamptz, issued_at timestamptz)
language sql stable security definer set search_path = public as $$
  select id, kind, number, status, title, client, data, snapshot, totals, accepted_name, accepted_at, issued_at
  from issued_documents where public_token = p_token and status in ('issued','accepted') and length(p_token) >= 20
$$;

create or replace function accept_public_document(p_token text, p_name text, p_ip text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_tenant uuid;
begin
  update issued_documents set status = 'accepted', accepted_name = left(p_name, 120), accepted_at = now(), accepted_ip = left(p_ip, 64), updated_at = now()
    where public_token = p_token and status = 'issued' and kind in ('quotation','contract') and length(p_token) >= 20
    returning id, tenant_id into v_id, v_tenant;
  if v_id is null then return false; end if;
  insert into audit_log (tenant_id, actor_label, action, entity, entity_id, meta)
    values (v_tenant, 'client:' || left(p_name, 120), 'document.accepted', 'issued_document', v_id::text, jsonb_build_object('ip', p_ip));
  return true;
end $$;
