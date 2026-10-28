-- Members of the current tenant (names, roles, MFA status). Scoped by app_tenant(); no credentials.
create or replace function tenant_members()
returns table (user_id uuid, name text, email text, role text, mfa_enabled boolean, last_login_at timestamptz)
language sql stable security definer set search_path = public as $$
  select u.id, u.name, u.email, m.role, u.mfa_enabled, u.last_login_at
  from memberships m join users u on u.id = m.user_id
  where m.tenant_id = app_tenant() and u.staff_role is null
  order by u.name
$$;

-- Account-level kill switch, callable only by the tenant itself (the app checks the owner role).
create or replace function set_tenant_kill_switch(on_off boolean)
returns void language sql security definer set search_path = public as $$
  update tenants set kill_switch = on_off where id = app_tenant()
$$;
