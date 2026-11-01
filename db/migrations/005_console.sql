-- Staff console: follow-ups on leads, partner workflow, cross-client invoicing.

alter table leads add column if not exists next_action text;
alter table leads add column if not exists next_action_due date;
create index if not exists leads_next_action_due on leads (tenant_id, next_action_due) where next_action_due is not null;

alter table partners add column if not exists notes text;
alter table partners add column if not exists updated_at timestamptz not null default now();

create sequence if not exists invoice_number_seq start 1001;

-- Invoice metadata across client tenants (amounts and dates only; no personal data).
create or replace function ops_invoice_queue()
returns table (id uuid, tenant_id uuid, tenant_name text, number text, status text, amount numeric, currency char(3),
               description text, issued_at date, due_date date, paid_at timestamptz)
language sql stable security definer set search_path = public as $$
  select i.id, i.tenant_id, t.name, i.number,
    case when i.status = 'issued' and i.due_date < current_date then 'overdue' else i.status end,
    i.amount, i.currency, coalesce(i.lines->0->>'description', ''), i.issued_at, i.due_date, i.paid_at
  from invoices i join tenants t on t.id = i.tenant_id
  where t.kind in ('client','partner','demo') and app_staff_role() is not null and app_staff_role() <> ''
  order by i.issued_at desc, i.number desc
$$;

-- Issues an invoice into a client tenant. Restricted to admin and consultant staff; recorded in the
-- client's audit log (which the client can see).
create or replace function ops_create_invoice(p_tenant uuid, p_amount numeric, p_description text, p_due date, p_actor text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_number text; v_currency char(3);
begin
  if coalesce(app_staff_role(), '') not in ('admin','consultant') then raise exception 'not permitted'; end if;
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
  if coalesce(app_staff_role(), '') not in ('admin','consultant') then raise exception 'not permitted'; end if;
  if p_status not in ('paid','void','issued') then raise exception 'invalid status'; end if;
  update invoices set status = p_status, paid_at = case when p_status = 'paid' then now() else null end
    where id = p_invoice returning tenant_id into v_tenant;
  if v_tenant is null then raise exception 'unknown invoice'; end if;
  insert into audit_log (tenant_id, actor_label, action, entity, entity_id)
    values (v_tenant, p_actor, 'invoice.' || p_status, 'invoice', p_invoice::text);
end $$;

-- Names of client tenants for pickers (no personal data).
create or replace function ops_client_list()
returns table (id uuid, name text, kind text, currency char(3))
language sql stable security definer set search_path = public as $$
  select id, name, kind, currency from tenants
  where kind in ('client','partner','demo') and coalesce(app_staff_role(), '') <> ''
  order by name
$$;
