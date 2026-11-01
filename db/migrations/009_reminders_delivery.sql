-- Session reminders (45 minutes before a session) and real outbox delivery.

alter table bookings add column if not exists reminded_at timestamptz;
alter table bookings add column if not exists meeting_link text;
create index if not exists bookings_reminder_due on bookings (starts_at) where status = 'confirmed' and reminded_at is null;

alter table outbox add column if not exists attempts int not null default 0;
alter table outbox add column if not exists last_error text;
alter table outbox drop constraint if exists outbox_status_check;
alter table outbox add constraint outbox_status_check check (status in ('queued','sending','sent','failed','logged'));
create index if not exists outbox_queued on outbox (created_at) where status in ('queued','sending');

-- Delivery runs as the system across tenants: claim a batch (skipping rows another worker holds) and record outcomes.
-- A row left in 'sending' for over 10 minutes (a crashed worker) is claimed again.
create or replace function outbox_claim(p_limit int default 20)
returns table (id uuid, channel text, to_addr text, subject text, body text, meta jsonb, attempts int)
language plpgsql security definer set search_path = public as $$
begin
  if not app_is_system() then raise exception 'not permitted'; end if;
  return query
  with c as (
    select o.id from outbox o
    where (o.status = 'queued' or (o.status = 'sending' and o.sent_at is null and o.created_at < now() - interval '10 minutes' and o.attempts < 5))
    order by o.created_at limit p_limit for update skip locked
  )
  update outbox o set status = 'sending', attempts = o.attempts + 1 from c where o.id = c.id
  returning o.id, o.channel, o.to_addr, o.subject, o.body, o.meta, o.attempts;
end $$;

create or replace function outbox_mark(p_id uuid, p_ok boolean, p_error text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not app_is_system() then raise exception 'not permitted'; end if;
  update outbox set
    status = case when p_ok then 'sent' when attempts >= 5 then 'failed' else 'queued' end,
    sent_at = case when p_ok then now() else null end,
    last_error = case when p_ok then null else left(p_error, 500) end
  where id = p_id;
end $$;
