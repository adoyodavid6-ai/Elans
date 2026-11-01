-- Payments: Paystack alongside M-Pesa, cross-tenant settlement, M-Pesa C2B (paybill/till) confirmations.

alter table payments drop constraint if exists payments_provider_check;
alter table payments add constraint payments_provider_check check (provider in ('mpesa','card','mock','paystack','mpesa_c2b'));
alter table payments add column if not exists email text;
alter table payments add column if not exists channel text;
alter table payments add column if not exists return_path text;
create index if not exists payments_pending on payments (status, created_at) where status = 'pending';

-- Webhooks arrive without a tenant context. These definer functions let the server find which tenant a
-- payment belongs to (the payment id is HMAC-signed or provider-verified before they are called).
create or replace function payment_locate(p_id uuid)
returns table (tenant_id uuid, provider text, provider_ref text, status text, amount numeric, currency char(3), purpose text, return_path text)
language sql stable security definer set search_path = public as $$
  select tenant_id, provider, provider_ref, status, amount, currency, purpose, return_path from payments where id = p_id
$$;

-- Recent payments across all tenants for the console (no phone numbers or emails).
create or replace function ops_payment_queue(p_limit int default 100)
returns table (id uuid, tenant_name text, provider text, purpose text, reference text, amount numeric, currency char(3), status text, provider_ref text, created_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, t.name, p.provider, p.purpose, p.reference, p.amount, p.currency, p.status, p.provider_ref, p.created_at, p.updated_at
  from payments p join tenants t on t.id = p.tenant_id
  where coalesce(app_staff_role(), '') <> ''
  order by p.created_at desc limit least(greatest(p_limit, 1), 500)
$$;

-- M-Pesa C2B confirmation (customer paid the paybill/till directly). Recorded once per M-Pesa transaction
-- under the Elans internal tenant; if the account reference equals an open client invoice number for the
-- same amount, that invoice is marked paid and the client's audit log notes it.
create or replace function mpesa_c2b_confirm(p_trans_id text, p_amount numeric, p_ref text, p_payer text, p_raw jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare v_internal uuid := '00000000-0000-4000-8000-000000000001'; v_inv uuid; v_tenant uuid; v_number text;
begin
  if exists (select 1 from payments where idempotency_key = 'c2b:' || p_trans_id) then return 'duplicate'; end if;
  insert into payments (tenant_id, provider, purpose, reference, amount, status, provider_ref, idempotency_key, raw)
    values (v_internal, 'mpesa_c2b', 'c2b', left(coalesce(p_ref, ''), 60), p_amount, 'succeeded', p_trans_id, 'c2b:' || p_trans_id, coalesce(p_raw, '{}'::jsonb));
  select i.id, i.tenant_id, i.number into v_inv, v_tenant, v_number from invoices i
    where upper(i.number) = upper(trim(coalesce(p_ref, ''))) and i.status in ('issued','overdue') and abs(i.amount - p_amount) < 1 limit 1;
  if v_inv is null then return 'recorded'; end if;
  update invoices set status = 'paid', paid_at = now() where id = v_inv;
  insert into audit_log (tenant_id, actor_label, action, entity, entity_id, meta)
    values (v_tenant, 'M-Pesa', 'invoice.paid', 'invoice', v_inv::text, jsonb_build_object('mpesaReceipt', p_trans_id, 'amount', p_amount));
  return 'matched:' || v_number;
end $$;
