-- Staff directory for the console (names and roles only; no credentials).
create or replace function ops_staff_directory()
returns table (id uuid, name text, email text, staff_role text, mfa_enabled boolean, last_login_at timestamptz)
language sql stable security definer set search_path = public as $$
  select id, name, email, staff_role, mfa_enabled, last_login_at from users where staff_role is not null order by name
$$;
