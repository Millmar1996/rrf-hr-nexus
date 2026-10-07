-- RRF HR Nexus relational foundation.
-- Apply only after confirming the target Supabase project and reviewing its schema.
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create type public.app_role as enum ('ADMIN', 'HR_MANAGER', 'HR_STAFF', 'VIEWER');
create type public.lifecycle_event_type as enum (
  'HIRE', 'PROMOTION', 'TRANSFER', 'POSITION_CHANGE', 'DEPARTMENT_TRANSFER',
  'REGULARIZATION', 'CLIENT_REASSIGNMENT', 'STATUS_CHANGE', 'LOCATION_TRANSFER',
  'SEPARATION', 'REHIRE'
);
create type public.resource_status as enum ('AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'INACTIVE');

create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke execute on function private.set_updated_at() from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.app_role not null default 'HR_STAFF',
  branch text not null default 'Tuguegarao Branch',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function private.has_active_profile()
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active
  );
$$;

create or replace function private.has_role(allowed_roles public.app_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active and p.role = any(allowed_roles)
  );
$$;
revoke execute on function private.has_active_profile() from public, anon;
revoke execute on function private.has_role(public.app_role[]) from public, anon;
grant execute on function private.has_active_profile() to authenticated;
grant execute on function private.has_role(public.app_role[]) to authenticated;

create table public.departments (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null
);

create table public.positions (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  department_id uuid references public.departments(id) on delete restrict,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  unique (department_id, name)
);

create table public.employment_types (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null
);

create table public.employment_statuses (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  is_employed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null
);

create table public.clients (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null
);

create table public.locations (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null unique,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null
);

create table public.employees (
  id uuid primary key default extensions.gen_random_uuid(),
  employee_number text not null unique,
  first_name text not null,
  middle_name text,
  last_name text not null,
  preferred_name text,
  email text,
  contact_number text,
  birthday date,
  date_hired date not null,
  regularization_date date,
  department_id uuid references public.departments(id) on delete restrict,
  position_id uuid references public.positions(id) on delete restrict,
  employment_type_id uuid references public.employment_types(id) on delete restrict,
  employment_status_id uuid references public.employment_statuses(id) on delete restrict,
  supervisor_employee_id uuid references public.employees(id) on delete set null,
  work_location_id uuid references public.locations(id) on delete set null,
  is_archived boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  check (regularization_date is null or regularization_date >= date_hired),
  check ((is_archived and archived_at is not null) or (not is_archived and archived_at is null))
);

create table public.employee_lifecycle_events (
  id uuid primary key default extensions.gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  event_type public.lifecycle_event_type not null,
  effective_date date not null,
  previous_data jsonb not null default '{}'::jsonb,
  new_data jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

create table public.employee_client_assignments (
  id uuid primary key default extensions.gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  start_date date not null,
  end_date date,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  check (end_date is null or end_date >= start_date)
);

create unique index employee_one_current_client_idx
  on public.employee_client_assignments(employee_id) where end_date is null;

create table public.document_types (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null unique,
  description text,
  category text not null default 'General',
  is_required boolean not null default true,
  supports_expiry boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null
);

create table public.employee_documents (
  id uuid primary key default extensions.gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  document_type_id uuid not null references public.document_types(id) on delete restrict,
  storage_bucket text not null default 'employee-documents',
  file_path text not null,
  original_filename text not null,
  mime_type text,
  file_size bigint check (file_size is null or file_size >= 0),
  issue_date date,
  expiry_date date,
  notes text,
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (storage_bucket, file_path),
  check (expiry_date is null or issue_date is null or expiry_date >= issue_date)
);

create table public.resource_types (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null
);

create table public.resources (
  id uuid primary key default extensions.gen_random_uuid(),
  resource_code text not null unique,
  resource_type_id uuid not null references public.resource_types(id) on delete restrict,
  description text,
  location_id uuid references public.locations(id) on delete set null,
  status public.resource_status not null default 'AVAILABLE',
  condition text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null
);

create table public.resource_assignments (
  id uuid primary key default extensions.gen_random_uuid(),
  resource_id uuid not null references public.resources(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  released_at timestamptz,
  assigned_by uuid references public.profiles(id) on delete set null,
  released_by uuid references public.profiles(id) on delete set null,
  notes text,
  check (released_at is null or released_at >= assigned_at)
);

create unique index resource_one_current_assignment_idx
  on public.resource_assignments(resource_id) where released_at is null;

create table public.audit_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index employees_name_idx on public.employees(last_name, first_name);
create index departments_created_by_idx on public.departments(created_by);
create index departments_updated_by_idx on public.departments(updated_by);
create index positions_created_by_idx on public.positions(created_by);
create index positions_updated_by_idx on public.positions(updated_by);
create index employment_types_created_by_idx on public.employment_types(created_by);
create index employment_types_updated_by_idx on public.employment_types(updated_by);
create index employment_statuses_created_by_idx on public.employment_statuses(created_by);
create index employment_statuses_updated_by_idx on public.employment_statuses(updated_by);
create index clients_created_by_idx on public.clients(created_by);
create index clients_updated_by_idx on public.clients(updated_by);
create index locations_created_by_idx on public.locations(created_by);
create index locations_updated_by_idx on public.locations(updated_by);
create index employees_department_idx on public.employees(department_id);
create index employees_position_idx on public.employees(position_id);
create index employees_employment_type_idx on public.employees(employment_type_id);
create index employees_status_idx on public.employees(employment_status_id);
create index employees_supervisor_idx on public.employees(supervisor_employee_id);
create index employees_work_location_idx on public.employees(work_location_id);
create index employees_created_by_idx on public.employees(created_by);
create index employees_updated_by_idx on public.employees(updated_by);
create index employees_hired_idx on public.employees(date_hired);
create index employees_regularization_idx on public.employees(regularization_date) where regularization_date is not null;
create index lifecycle_employee_date_idx on public.employee_lifecycle_events(employee_id, effective_date desc);
create index lifecycle_date_type_idx on public.employee_lifecycle_events(effective_date desc, event_type);
create index lifecycle_created_by_idx on public.employee_lifecycle_events(created_by);
create index client_assignment_employee_idx on public.employee_client_assignments(employee_id, start_date desc);
create index client_assignment_client_idx on public.employee_client_assignments(client_id, start_date desc);
create index client_assignment_created_by_idx on public.employee_client_assignments(created_by);
create index documents_employee_type_idx on public.employee_documents(employee_id, document_type_id);
create index documents_type_idx on public.employee_documents(document_type_id);
create index documents_expiry_idx on public.employee_documents(expiry_date) where expiry_date is not null;
create index documents_uploaded_by_idx on public.employee_documents(uploaded_by);
create index resource_types_created_by_idx on public.resource_types(created_by);
create index resource_types_updated_by_idx on public.resource_types(updated_by);
create index resources_type_idx on public.resources(resource_type_id);
create index resources_location_idx on public.resources(location_id);
create index resources_status_idx on public.resources(status);
create index resource_assignments_resource_idx on public.resource_assignments(resource_id);
create index resource_assignments_employee_idx on public.resource_assignments(employee_id, assigned_at desc);
create index resource_assignments_assigned_by_idx on public.resource_assignments(assigned_by);
create index resource_assignments_released_by_idx on public.resource_assignments(released_by);
create index audit_entity_date_idx on public.audit_logs(entity_type, entity_id, created_at desc);
create index audit_user_date_idx on public.audit_logs(user_id, created_at desc);

do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'departments', 'positions', 'employment_types', 'employment_statuses',
    'clients', 'locations', 'employees', 'document_types', 'employee_documents',
    'resource_types', 'resources'
  ] loop
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function private.set_updated_at()', t, t);
  end loop;
end;
$$;

create or replace function private.audit_employee_changes()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_logs(user_id, action, entity_type, entity_id, old_data, new_data)
  values (
    (select auth.uid()),
    case when tg_op = 'INSERT' then 'employee.created' when new.is_archived and not old.is_archived then 'employee.archived' else 'employee.updated' end,
    'employee',
    coalesce(new.id, old.id),
    case when tg_op = 'INSERT' then null else to_jsonb(old) - 'created_by' - 'updated_by' end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) - 'created_by' - 'updated_by' end
  );
  return new;
end;
$$;
create trigger employees_audit after insert or update on public.employees
  for each row execute function private.audit_employee_changes();
revoke execute on function private.audit_employee_changes() from public, anon, authenticated;

create or replace function private.can_manage_hr_records()
returns boolean language sql stable set search_path = '' as $$
  select private.has_role(array['ADMIN', 'HR_MANAGER', 'HR_STAFF']::public.app_role[]);
$$;

create or replace function private.can_manage_settings()
returns boolean language sql stable set search_path = '' as $$
  select private.has_role(array['ADMIN']::public.app_role[]);
$$;
revoke execute on function private.can_manage_hr_records() from public, anon;
revoke execute on function private.can_manage_settings() from public, anon;
grant execute on function private.can_manage_hr_records() to authenticated;
grant execute on function private.can_manage_settings() to authenticated;

alter table public.profiles enable row level security;
alter table public.departments enable row level security;
alter table public.positions enable row level security;
alter table public.employment_types enable row level security;
alter table public.employment_statuses enable row level security;
alter table public.clients enable row level security;
alter table public.locations enable row level security;
alter table public.employees enable row level security;
alter table public.employee_lifecycle_events enable row level security;
alter table public.employee_client_assignments enable row level security;
alter table public.document_types enable row level security;
alter table public.employee_documents enable row level security;
alter table public.resource_types enable row level security;
alter table public.resources enable row level security;
alter table public.resource_assignments enable row level security;
alter table public.audit_logs enable row level security;

create policy "Profiles are visible to self and administrators" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.has_role(array['ADMIN']::public.app_role[])));
create policy "Admins manage profiles" on public.profiles for all to authenticated
  using ((select private.has_role(array['ADMIN']::public.app_role[]))) with check ((select private.has_role(array['ADMIN']::public.app_role[])));

do $$
declare t text;
begin
  foreach t in array array['departments','positions','employment_types','employment_statuses','clients','locations','document_types','resource_types'] loop
    execute format('create policy %I on public.%I for select to authenticated using ((select private.has_active_profile()))', t || '_read_active_profiles', t);
    execute format('create policy %I on public.%I for all to authenticated using ((select private.can_manage_settings())) with check ((select private.can_manage_settings()))', t || '_admin_write', t);
  end loop;
end;
$$;

create policy "Active profiles can read employees" on public.employees for select to authenticated
  using ((select private.has_active_profile()));
create policy "HR staff manage employees" on public.employees for insert to authenticated with check ((select private.can_manage_hr_records()));
create policy "HR staff update employees" on public.employees for update to authenticated
  using ((select private.can_manage_hr_records())) with check ((select private.can_manage_hr_records()));

create policy "Active profiles can read lifecycle" on public.employee_lifecycle_events for select to authenticated
  using ((select private.has_active_profile()));
create policy "HR staff record lifecycle" on public.employee_lifecycle_events for insert to authenticated
  with check ((select private.can_manage_hr_records()));

create policy "Active profiles can read client assignments" on public.employee_client_assignments for select to authenticated
  using ((select private.has_active_profile()));
create policy "HR staff create client assignments" on public.employee_client_assignments for insert to authenticated
  with check ((select private.can_manage_hr_records()));
create policy "HR staff update client assignments" on public.employee_client_assignments for update to authenticated
  using ((select private.can_manage_hr_records())) with check ((select private.can_manage_hr_records()));

create policy "HR managers read document metadata" on public.employee_documents for select to authenticated
  using ((select private.has_role(array['ADMIN','HR_MANAGER','HR_STAFF']::public.app_role[])));
create policy "HR staff add document metadata" on public.employee_documents for insert to authenticated
  with check ((select private.can_manage_hr_records()));
create policy "HR staff update document metadata" on public.employee_documents for update to authenticated
  using ((select private.can_manage_hr_records())) with check ((select private.can_manage_hr_records()));
create policy "HR managers delete document metadata" on public.employee_documents for delete to authenticated
  using ((select private.has_role(array['ADMIN','HR_MANAGER']::public.app_role[])));

create policy "Active profiles can read resources" on public.resources for select to authenticated
  using ((select private.has_active_profile()));
create policy "HR staff manage resources" on public.resources for all to authenticated
  using ((select private.can_manage_hr_records())) with check ((select private.can_manage_hr_records()));
create policy "Active profiles can read resource assignments" on public.resource_assignments for select to authenticated
  using ((select private.has_active_profile()));
create policy "HR staff create resource assignments" on public.resource_assignments for insert to authenticated
  with check ((select private.can_manage_hr_records()));
create policy "HR staff update resource assignments" on public.resource_assignments for update to authenticated
  using ((select private.can_manage_hr_records())) with check ((select private.can_manage_hr_records()));

create policy "Managers read audit log" on public.audit_logs for select to authenticated
  using ((select private.has_role(array['ADMIN','HR_MANAGER']::public.app_role[])));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('employee-documents', 'employee-documents', false, 20971520, array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "HR can read private employee files" on storage.objects for select to authenticated
  using (bucket_id = 'employee-documents' and (select private.has_role(array['ADMIN','HR_MANAGER','HR_STAFF']::public.app_role[])));
create policy "HR can upload private employee files" on storage.objects for insert to authenticated
  with check (bucket_id = 'employee-documents' and (select private.can_manage_hr_records()));
create policy "HR can update private employee files" on storage.objects for update to authenticated
  using (bucket_id = 'employee-documents' and (select private.can_manage_hr_records()))
  with check (bucket_id = 'employee-documents' and (select private.can_manage_hr_records()));
create policy "Managers can remove private employee files" on storage.objects for delete to authenticated
  using (bucket_id = 'employee-documents' and (select private.has_role(array['ADMIN','HR_MANAGER']::public.app_role[])));

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.departments, public.positions, public.employment_types, public.employment_statuses, public.clients, public.locations, public.employees, public.employee_lifecycle_events, public.employee_client_assignments, public.document_types, public.employee_documents, public.resource_types, public.resources, public.resource_assignments to authenticated;
grant select on public.audit_logs to authenticated;
