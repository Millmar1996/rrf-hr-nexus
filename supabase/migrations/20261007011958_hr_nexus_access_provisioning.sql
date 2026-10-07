-- Auditable, least-privilege access requests and a one-time first-admin claim.
create table public.access_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  requested_name text not null,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.access_requests enable row level security;
create policy "Users view their own access request" on public.access_requests for select to authenticated using (user_id=(select auth.uid()));
create policy "Admins review access requests" on public.access_requests for select to authenticated using ((select private.has_role(array['ADMIN']::public.app_role[])));
grant select on public.access_requests to authenticated;

create table private.bootstrap_configuration (
  singleton boolean primary key default true check (singleton),
  admin_email text,
  secret_hash text,
  claimed_at timestamptz,
  check ((claimed_at is null) or (admin_email is not null and secret_hash is null))
);
revoke all on private.bootstrap_configuration from public, anon, authenticated;
insert into private.bootstrap_configuration(singleton) values(true) on conflict(singleton) do nothing;

create or replace function private.capture_access_request()
returns trigger language plpgsql security definer set search_path = '' as $$
declare requested_name text;
begin
  requested_name := coalesce(nullif(new.raw_user_meta_data->>'full_name',''), split_part(new.email,'@',1));
  insert into public.access_requests(user_id,email,requested_name)
  values(new.id,lower(new.email),requested_name)
  on conflict(user_id) do update set email=excluded.email,requested_name=excluded.requested_name;
  return new;
end;
$$;
revoke execute on function private.capture_access_request() from public, anon, authenticated;
create trigger auth_user_access_request after insert on auth.users
  for each row execute function private.capture_access_request();

create or replace function public.bootstrap_initial_admin(p_secret text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  user_email text;
  requested_name text;
  configured_email text;
  stored_hash text;
begin
  if actor is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  select lower(email),coalesce(nullif(raw_user_meta_data->>'full_name',''),split_part(email,'@',1))
    into user_email,requested_name
    from auth.users where id=actor;
  if user_email is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null) then
    raise exception 'Confirm the administrator email before provisioning' using errcode = '42501';
  end if;
  select admin_email,secret_hash into configured_email,stored_hash from private.bootstrap_configuration where singleton=true for update;
  if stored_hash is null or p_secret is null or encode(extensions.digest(p_secret,'sha256'),'hex')<>stored_hash then
    raise exception 'Initial administrator setup is not configured' using errcode = '42501';
  end if;
  if configured_email is null or user_email<>lower(configured_email) then raise exception 'This account is not the configured initial administrator' using errcode = '42501'; end if;
  if lower(trim(requested_name))<>'millmar' then raise exception 'The initial administrator account name must be Millmar' using errcode = '22023'; end if;
  if exists(select 1 from public.profiles) then raise exception 'An administrator profile already exists' using errcode = '23505'; end if;
  insert into public.profiles(id,full_name,role,is_active) values(actor,'Millmar','ADMIN',true);
  update public.access_requests set status='APPROVED',reviewed_at=now() where user_id=actor;
  update private.bootstrap_configuration set secret_hash=null,claimed_at=now() where singleton=true;
end;
$$;
revoke execute on function public.bootstrap_initial_admin(text) from public, anon;
grant execute on function public.bootstrap_initial_admin(text) to authenticated;

create or replace function public.approve_access_request(p_user_id uuid, p_role public.app_role, p_branch text default 'Tuguegarao Branch')
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); request_row public.access_requests%rowtype;
begin
  if actor is null or not private.has_role(array['ADMIN']::public.app_role[]) then raise exception 'Only administrators can approve access' using errcode = '42501'; end if;
  select * into request_row from public.access_requests where user_id=p_user_id for update;
  if not found or request_row.status<>'PENDING' then raise exception 'Pending access request not found' using errcode = 'P0002'; end if;
  insert into public.profiles(id,full_name,role,branch,is_active) values(p_user_id,request_row.requested_name,p_role,coalesce(nullif(p_branch,''),'Tuguegarao Branch'),true)
  on conflict(id) do update set full_name=excluded.full_name,role=excluded.role,branch=excluded.branch,is_active=true;
  update public.access_requests set status='APPROVED',reviewed_by=actor,reviewed_at=now() where user_id=p_user_id;
end;
$$;
revoke execute on function public.approve_access_request(uuid,public.app_role,text) from public, anon;
grant execute on function public.approve_access_request(uuid,public.app_role,text) to authenticated;

create or replace function public.reject_access_request(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not private.has_role(array['ADMIN']::public.app_role[]) then raise exception 'Only administrators can reject access' using errcode = '42501'; end if;
  update public.access_requests set status='REJECTED',reviewed_by=(select auth.uid()),reviewed_at=now() where user_id=p_user_id and status='PENDING';
  if not found then raise exception 'Pending access request not found' using errcode = 'P0002'; end if;
end;
$$;
revoke execute on function public.reject_access_request(uuid) from public, anon;
grant execute on function public.reject_access_request(uuid) to authenticated;

create trigger profiles_created_audit after insert on public.profiles
  for each row execute function private.audit_business_row();
create trigger access_requests_audit after update on public.access_requests
  for each row execute function private.audit_business_row();
