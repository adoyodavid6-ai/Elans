-- Two console levels: super_admin (full control) and admin (read and contribute).
-- The super admin account is assigned by scripts/migrate.ts from ELANS_SUPER_ADMIN_EMAIL on every deploy.

alter table users drop constraint if exists users_staff_role_check;
update users set staff_role = 'admin' where staff_role is not null and staff_role <> 'super_admin';
alter table users add constraint users_staff_role_check check (staff_role in ('super_admin','admin'));

-- Global content: day-to-day content can be edited by both levels; configuration only by the super admin.
do $$
declare t text;
begin
  foreach t in array array['content_items','content_revisions','kb_articles','prompt_versions','eval_runs'] loop
    execute format('drop policy if exists write_staff on %I', t);
    execute format('create policy write_staff on %I for all using (app_staff_role() in (''super_admin'',''admin'') or app_is_system()) with check (app_staff_role() in (''super_admin'',''admin'') or app_is_system())', t);
  end loop;
  foreach t in array array['price_points','site_settings','score_weight_versions','sources'] loop
    execute format('drop policy if exists write_staff on %I', t);
    execute format('create policy write_staff on %I for all using (app_staff_role() = ''super_admin'' or app_is_system()) with check (app_staff_role() = ''super_admin'' or app_is_system())', t);
  end loop;
end $$;

-- Issuing invoices is day-to-day; changing their status (paid, void, reopened) is super admin only.
create or replace function ops_create_invoice(p_tenant uuid, p_amount numeric, p_description text, p_due date, p_actor text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_number text; v_currency char(3);
begin
  if coalesce(app_staff_role(), '') not in ('super_admin','admin') then raise exception 'not permitted'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be positive'; end if;
  select currency into v_currency from tenants where id = p_tenant and kind in ('client','partner','demo');
  if v_currency is null then raise exception 'unknown client'; end if;
  v_number := 'ELN-' || to_char(current_date, 'YYYY') || '-' || nextval('invoice_number_seq');
  insert into invoices (tenant_id, number, status, amount, currency, lines, due_date)
    values (p_tenant, v_number, 'issued', p_amount, v_currency, jsonb_build_array(jsonb_build_object('description', left(p_description, 300), 'amount', p_amount)), p_due)
    returning id into v_id;
  insert into audit_log (tenant_id, actor_label, action, entity, entity_id, meta)
    values (p_tenant, p_actor, 'invoice.issued', 'invoice', v_id::text, jsonb_build_object('number', v_number, 'amount', p_amount));
  return v_id;
end $$;

create or replace function ops_set_invoice_status(p_invoice uuid, p_status text, p_actor text)
returns void language plpgsql security definer set search_path = public as $$
declare v_tenant uuid;
begin
  if coalesce(app_staff_role(), '') <> 'super_admin' then raise exception 'only the super admin can change an invoice''s status'; end if;
  if p_status not in ('paid','void','issued') then raise exception 'invalid status'; end if;
  update invoices set status = p_status, paid_at = case when p_status = 'paid' then now() else null end
    where id = p_invoice returning tenant_id into v_tenant;
  if v_tenant is null then raise exception 'unknown invoice'; end if;
  insert into audit_log (tenant_id, actor_label, action, entity, entity_id)
    values (v_tenant, p_actor, 'invoice.' || p_status, 'invoice', p_invoice::text);
end $$;

-- Requests from admins to the super admin ("Ask Super Admin").
create table staff_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  kind text not null,                -- capability key, e.g. invoice.paid, content.publish
  title text not null,
  note text,
  payload jsonb not null default '{}',
  link text,
  status text not null default 'pending' check (status in ('pending','approved','declined','done')),
  requested_by uuid references users(id),
  requested_label text not null,
  decided_label text,
  decision_note text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index staff_requests_pending on staff_requests (tenant_id, status, created_at desc);
alter table staff_requests enable row level security;
alter table staff_requests force row level security;
create policy tenant_isolation on staff_requests using (tenant_id = app_tenant()) with check (tenant_id = app_tenant());
