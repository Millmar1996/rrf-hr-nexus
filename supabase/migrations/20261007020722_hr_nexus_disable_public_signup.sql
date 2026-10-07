create or replace function private.reject_public_auth_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Account registration is disabled' using errcode = '42501';
end;
$$;

revoke all on function private.reject_public_auth_signup() from public, anon, authenticated;

drop trigger if exists auth_signup_disabled on auth.users;
create trigger auth_signup_disabled
before insert on auth.users
for each row execute function private.reject_public_auth_signup();
