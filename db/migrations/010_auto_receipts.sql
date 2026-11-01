-- Automatic receipts: one receipt document per confirmed payment, issued by Elans (internal tenant).

alter table issued_documents add column if not exists emailed_to text;
alter table issued_documents add column if not exists emailed_at timestamptz;
create unique index if not exists issued_documents_one_receipt_per_payment
  on issued_documents (source_ref) where kind = 'receipt' and source_ref like 'payment:%';

-- Everything a receipt needs about a payment, across tenants (system only): the payer from the booking contact,
-- the payment's own email (card payments) or the paying client's owner, and what was paid for.
create or replace function payment_receipt_info(p_id uuid)
returns table (
  payment_id uuid, tenant_id uuid, tenant_name text, status text, provider text, channel text, purpose text, reference text,
  amount numeric, currency char(3), provider_ref text, pay_email text, created_at timestamptz,
  booking_type text, booking_starts timestamptz, contact_name text, contact_email text, contact_phone text, contact_org text,
  invoice_number text, invoice_lines jsonb, owner_name text, owner_email text
) language plpgsql stable security definer set search_path = public as $$
begin
  if not app_is_system() then raise exception 'not permitted'; end if;
  return query
  select p.id, p.tenant_id, t.name, p.status, p.provider, p.channel, p.purpose, p.reference,
         p.amount, p.currency, p.provider_ref, p.email, p.created_at,
         b.type, b.starts_at, c.name, c.email, c.phone, c.organisation,
         i.number, i.lines, ou.name, ou.email
  from payments p
  join tenants t on t.id = p.tenant_id
  left join bookings b on b.payment_id = p.id
  left join contacts c on c.id = b.contact_id
  left join invoices i on p.purpose like 'invoice:%' and i.tenant_id = p.tenant_id and i.number = substr(p.purpose, 9)
  left join lateral (
    select u.name, u.email from memberships m join users u on u.id = m.user_id
    where m.tenant_id = p.tenant_id and u.staff_role is null and p.tenant_id <> '00000000-0000-4000-8000-000000000001'
    order by array_position(array['owner','admin','approver','member','viewer'], m.role), m.created_at limit 1
  ) ou on true
  where p.id = p_id;
end $$;

-- C2B (paybill/till) payments are matched to an invoice in mpesa_c2b_confirm; for a matched one the receipt goes
-- to the invoice's client. This links the C2B payment row to the invoice it paid.
create or replace function mpesa_c2b_confirm(p_trans_id text, p_amount numeric, p_ref text, p_payer text, p_raw jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare v_internal uuid := '00000000-0000-4000-8000-000000000001'; v_inv uuid; v_tenant uuid; v_number text; v_pay uuid;
begin
  if exists (select 1 from payments where idempotency_key = 'c2b:' || p_trans_id) then return 'duplicate'; end if;
  select i.id, i.tenant_id, i.number into v_inv, v_tenant, v_number from invoices i
    where upper(i.number) = upper(trim(coalesce(p_ref, ''))) and i.status in ('issued','overdue') and abs(i.amount - p_amount) < 1 limit 1;
  insert into payments (tenant_id, provider, purpose, reference, amount, status, provider_ref, idempotency_key, channel, raw)
    values (coalesce(v_tenant, v_internal), 'mpesa_c2b', case when v_inv is null then 'c2b' else 'invoice:' || v_number end,
            left(coalesce(p_ref, ''), 60), p_amount, 'succeeded', p_trans_id, 'c2b:' || p_trans_id, 'mpesa', coalesce(p_raw, '{}'::jsonb))
    returning id into v_pay;
  if v_inv is null then return 'recorded:' || v_pay; end if;
  update invoices set status = 'paid', paid_at = now() where id = v_inv;
  insert into audit_log (tenant_id, actor_label, action, entity, entity_id, meta)
    values (v_tenant, 'M-Pesa', 'invoice.paid', 'invoice', v_inv::text, jsonb_build_object('mpesaReceipt', p_trans_id, 'amount', p_amount));
  return 'matched:' || v_number || ':' || v_pay;
end $$;
