-- Complete controlled HR master data without inserting fictional employees or
-- company-specific departments, positions, or clients.

alter table public.departments add column if not exists code text;
alter table public.clients add column if not exists code text;
alter table public.locations add column if not exists code text;
alter table public.document_types add column if not exists display_order integer not null default 0;
alter table public.employee_documents add column if not exists review_status text not null default 'COMPLETE';
alter table public.employee_documents add column if not exists verified_at timestamptz;
alter table public.employee_documents add column if not exists verified_by uuid references public.profiles(id) on delete set null;
alter table public.employee_documents drop constraint if exists employee_documents_review_status_check;
alter table public.employee_documents add constraint employee_documents_review_status_check
  check (review_status in ('PENDING','FOR_VERIFICATION','COMPLETE'));

create table if not exists public.employee_document_exemptions (
  id uuid primary key default extensions.gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  document_type_id uuid not null references public.document_types(id) on delete restrict,
  reason text not null check (length(btrim(reason)) between 3 and 1000),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  unique(employee_id, document_type_id)
);
create index if not exists document_exemptions_type_idx on public.employee_document_exemptions(document_type_id);
alter table public.employee_document_exemptions enable row level security;
create policy "Active profiles read document exemptions" on public.employee_document_exemptions for select to authenticated
  using ((select private.has_active_profile()));
create policy "HR managers manage document exemptions" on public.employee_document_exemptions for all to authenticated
  using ((select private.has_role(array['ADMIN','HR_MANAGER']::public.app_role[])))
  with check ((select private.has_role(array['ADMIN','HR_MANAGER']::public.app_role[])));
grant select, insert, update, delete on public.employee_document_exemptions to authenticated;

create unique index if not exists departments_code_unique
  on public.departments (lower(code)) where code is not null and btrim(code) <> '';
create unique index if not exists clients_code_unique
  on public.clients (lower(code)) where code is not null and btrim(code) <> '';
create unique index if not exists locations_code_unique
  on public.locations (lower(code)) where code is not null and btrim(code) <> '';

create table if not exists public.separation_types (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null
);
alter table public.employee_lifecycle_events
  add column if not exists separation_type_id uuid references public.separation_types(id) on delete restrict;
create index if not exists separation_types_created_by_idx on public.separation_types(created_by);
create index if not exists separation_types_updated_by_idx on public.separation_types(updated_by);
create trigger separation_types_updated_at before update on public.separation_types
  for each row execute function private.set_updated_at();
alter table public.separation_types enable row level security;
create policy "Active profiles read separation types" on public.separation_types for select to authenticated
  using ((select private.has_active_profile()));
create policy "HR managers manage separation types" on public.separation_types for all to authenticated
  using ((select private.has_role(array['ADMIN','HR_MANAGER']::public.app_role[])))
  with check ((select private.has_role(array['ADMIN','HR_MANAGER']::public.app_role[])));
grant select, insert, update on public.separation_types to authenticated;

insert into public.employment_statuses(name, is_active, is_employed)
select v.name, true, v.is_employed
from (values
  ('Active', true), ('Probationary', true), ('Regular', true),
  ('On Leave', true), ('Separated', false), ('Inactive', false)
) as v(name, is_employed)
where not exists (select 1 from public.employment_statuses s where lower(s.name)=lower(v.name));
update public.employment_statuses s set is_employed = v.is_employed
from (values
  ('Active', true), ('Probationary', true), ('Regular', true),
  ('On Leave', true), ('Separated', false), ('Inactive', false)
) as v(name, is_employed)
where lower(s.name)=lower(v.name);
update public.employment_statuses set is_active=true
where lower(name) in ('active','probationary','regular','on leave','separated','inactive');
update public.employment_statuses set is_active=false
where lower(name) not in ('active','probationary','regular','on leave','separated','inactive');

-- Employment stage belongs to employment_statuses. Retain legacy type rows for
-- existing employee references, but remove those stage labels from new choices.
insert into public.employment_types(name, is_active)
select v.name, true
from (values ('Full-time'), ('Part-time'), ('Contractual'), ('Project-based'), ('Intern / Trainee')) as v(name)
where not exists (select 1 from public.employment_types t where lower(t.name)=lower(v.name));
update public.employment_types set is_active=false
where lower(name) in ('regular','probationary','project based');
update public.employment_types set name='Project-based'
where lower(name)='project-based' and name <> 'Project-based'
  and not exists (select 1 from public.employment_types t where t.name='Project-based');

insert into public.locations(name, code, is_active)
select 'Tuguegarao', 'TUG', true
where not exists (select 1 from public.locations where lower(name)='tuguegarao');

insert into public.resource_types(name, is_active)
select v.name, true
from (values ('Workstation / Seat'), ('Desktop Computer'), ('Laptop'), ('Monitor'), ('Headset'), ('Other Equipment')) as v(name)
where not exists (select 1 from public.resource_types t where lower(t.name)=lower(v.name));
update public.resource_types set is_active=false where lower(name) in ('seat / workstation','computer');

insert into public.document_types(name,category,description,is_required,supports_expiry,is_active,display_order)
select 'Development sample — replace from approved RRFMG list', 'Development only',
       'Not an approved company requirement. Replace using 201 List of Requirements.xlsx.', false, false, false, 0
where not exists(select 1 from public.document_types where lower(name)=lower('Development sample — replace from approved RRFMG list'));

insert into public.separation_types(name, description) values
  ('Resignation', null), ('Termination', null), ('End of Contract', null),
  ('Retirement', null), ('Redundancy', null), ('Other', null)
on conflict (name) do nothing;

create or replace function public.assign_resource(p_resource_id uuid, p_employee_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); current_employee uuid; current_status public.resource_status;
begin
  if actor is null or not private.can_manage_hr_records() then raise exception 'Not authorized to assign resources' using errcode = '42501'; end if;
  select status into current_status from public.resources where id=p_resource_id for update;
  if not found then raise exception 'Resource was not found' using errcode = 'P0002'; end if;
  select employee_id into current_employee from public.resource_assignments where resource_id=p_resource_id and released_at is null for update;
  if p_employee_id is null then
    update public.resource_assignments set released_at=now(),released_by=actor where resource_id=p_resource_id and released_at is null;
    update public.resources set status='AVAILABLE',updated_by=actor where id=p_resource_id and status='ASSIGNED';
  else
    if current_status in ('MAINTENANCE','INACTIVE','RESERVED','RETIRED') then raise exception 'This resource is not available for assignment' using errcode = '22023'; end if;
    if not exists(select 1 from public.employees e join public.employment_statuses s on s.id=e.employment_status_id where e.id=p_employee_id and not e.is_archived and s.is_employed and lower(s.name) not in ('separated','inactive')) then
      raise exception 'Resources can only be assigned to currently employed employees' using errcode = '22023';
    end if;
    if current_employee is distinct from p_employee_id then
      update public.resource_assignments set released_at=now(),released_by=actor where resource_id=p_resource_id and released_at is null;
      insert into public.resource_assignments(resource_id,employee_id,assigned_by) values(p_resource_id,p_employee_id,actor);
    end if;
    update public.resources set status='ASSIGNED',updated_by=actor where id=p_resource_id;
  end if;
end;
$$;
revoke execute on function public.assign_resource(uuid,uuid) from public, anon;
grant execute on function public.assign_resource(uuid,uuid) to authenticated;

create or replace function public.assign_employee_resources(p_employee_id uuid, p_resource_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); v_resource_id uuid;
begin
  if actor is null or not private.can_manage_hr_records() then raise exception 'Not authorized to assign resources' using errcode = '42501'; end if;
  if not exists(select 1 from public.employees e join public.employment_statuses s on s.id=e.employment_status_id where e.id=p_employee_id and not e.is_archived and s.is_employed and lower(s.name) not in ('separated','inactive')) then
    raise exception 'Resources can only be assigned to currently employed employees' using errcode = '22023';
  end if;
  if (select count(*) from unnest(coalesce(p_resource_ids, '{}')) as selected(id)) <> (select count(distinct selected.id) from unnest(coalesce(p_resource_ids, '{}')) as selected(id)) then
    raise exception 'A resource may only be selected once' using errcode = '22023';
  end if;
  perform 1 from public.resources r where r.id=any(coalesce(p_resource_ids, '{}')) order by r.id for update;
  if exists(
    select 1 from public.resources r
    left join public.resource_assignments a on a.resource_id=r.id and a.released_at is null
    where r.id=any(coalesce(p_resource_ids, '{}'))
      and (r.status in ('MAINTENANCE','INACTIVE','RESERVED','RETIRED') or (a.employee_id is not null and a.employee_id<>p_employee_id))
  ) then raise exception 'One or more selected resources are no longer assignable' using errcode = '23505'; end if;
  update public.resource_assignments a set released_at=now(), released_by=actor
  where a.employee_id=p_employee_id and a.released_at is null and not (a.resource_id=any(coalesce(p_resource_ids, '{}')));
  update public.resources r set status='AVAILABLE',updated_by=actor
  where r.status='ASSIGNED'
    and exists(select 1 from public.resource_assignments a where a.resource_id=r.id and a.employee_id=p_employee_id and a.released_by=actor and a.released_at is not null)
    and not exists(select 1 from public.resource_assignments active where active.resource_id=r.id and active.released_at is null);
  foreach v_resource_id in array coalesce(p_resource_ids, '{}') loop
    if not exists(select 1 from public.resource_assignments a where a.resource_id=v_resource_id and a.released_at is null) then
      insert into public.resource_assignments(resource_id,employee_id,assigned_by) values(v_resource_id,p_employee_id,actor);
    end if;
    update public.resources set status='ASSIGNED',updated_by=actor where id=v_resource_id;
  end loop;
end;
$$;
revoke execute on function public.assign_employee_resources(uuid,uuid[]) from public, anon;
grant execute on function public.assign_employee_resources(uuid,uuid[]) to authenticated;

create or replace function public.verify_employee_document(p_document_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid());
begin
  if actor is null or not private.has_role(array['ADMIN','HR_MANAGER']::public.app_role[]) then raise exception 'Only HR managers may verify employee documents' using errcode='42501'; end if;
  update public.employee_documents set review_status='COMPLETE',verified_at=now(),verified_by=actor,updated_at=now() where id=p_document_id;
  if not found then raise exception 'Employee document was not found' using errcode='P0002'; end if;
end;
$$;
revoke execute on function public.verify_employee_document(uuid) from public, anon;
grant execute on function public.verify_employee_document(uuid) to authenticated;

create or replace function public.set_employee_document_review_status(p_document_id uuid, p_review_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid());
begin
  if actor is null or not private.has_role(array['ADMIN','HR_MANAGER']::public.app_role[]) then raise exception 'Only HR managers may update document review status' using errcode='42501'; end if;
  if p_review_status not in ('PENDING','FOR_VERIFICATION') then raise exception 'Choose Pending or For Verification' using errcode='22023'; end if;
  update public.employee_documents set review_status=p_review_status,verified_at=null,verified_by=null,updated_at=now() where id=p_document_id;
  if not found then raise exception 'Employee document was not found' using errcode='P0002'; end if;
end;
$$;
revoke execute on function public.set_employee_document_review_status(uuid,text) from public, anon;
grant execute on function public.set_employee_document_review_status(uuid,text) to authenticated;

create or replace function public.set_document_not_applicable(p_employee_id uuid, p_document_type_id uuid, p_reason text, p_is_applicable boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid());
begin
  if actor is null or not private.has_role(array['ADMIN','HR_MANAGER']::public.app_role[]) then raise exception 'Only HR managers may waive document requirements' using errcode='42501'; end if;
  if not exists(select 1 from public.employees e where e.id=p_employee_id) then raise exception 'Employee was not found' using errcode='P0002'; end if;
  if not exists(select 1 from public.document_types d where d.id=p_document_type_id and d.is_active and d.is_required) then raise exception 'Choose an active required document type' using errcode='22023'; end if;
  if p_is_applicable then
    if nullif(btrim(p_reason),'') is null then raise exception 'A reason is required when a document is not applicable' using errcode='22023'; end if;
    insert into public.employee_document_exemptions(employee_id,document_type_id,reason,created_by)
    values(p_employee_id,p_document_type_id,btrim(p_reason),actor)
    on conflict(employee_id,document_type_id) do update set reason=excluded.reason,created_at=now(),created_by=actor;
  else
    delete from public.employee_document_exemptions where employee_id=p_employee_id and document_type_id=p_document_type_id;
  end if;
end;
$$;
revoke execute on function public.set_document_not_applicable(uuid,uuid,text,boolean) from public, anon;
grant execute on function public.set_document_not_applicable(uuid,uuid,text,boolean) to authenticated;

create or replace function public.set_resource_condition(p_resource_id uuid, p_resource_code text, p_condition text)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); target_id uuid;
begin
  if actor is null or not private.can_manage_hr_records() then raise exception 'Not authorized to manage resources' using errcode='42501'; end if;
  if p_condition is not null and p_condition not in ('Good','Needs Attention','Damaged') then raise exception 'Choose a supported resource condition' using errcode='22023'; end if;
  target_id := p_resource_id;
  if target_id is null then select id into target_id from public.resources where resource_code=p_resource_code; end if;
  if target_id is null then raise exception 'Resource was not found' using errcode='P0002'; end if;
  update public.resources set condition=p_condition,updated_by=actor where id=target_id;
end;
$$;
revoke execute on function public.set_resource_condition(uuid,text,text) from public, anon;
grant execute on function public.set_resource_condition(uuid,text,text) to authenticated;

-- A status transition to regular is an employment stage change; it must not
-- overwrite the separate contract/employment type.
-- Keep the existing employee-save RPC as the single employee persistence path,
-- but allow an employee to have no client and preserve the entered assignment date.
create or replace function public.save_employee(p_employee_id uuid, p_employee jsonb, p_client_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid()); target_id uuid; old_client uuid; old_start date;
  assignment_start date; old_row public.employees%rowtype; client_selected boolean;
begin
  if actor is null or not private.can_manage_hr_records() then raise exception 'Not authorized to manage employee records' using errcode = '42501'; end if;
  if nullif(btrim(p_employee->>'employee_number'),'') is null or nullif(btrim(p_employee->>'first_name'),'') is null or nullif(btrim(p_employee->>'last_name'),'') is null then
    raise exception 'Employee number, first name, and last name are required' using errcode = '22023';
  end if;
  if p_employee_id is null then
    if not exists(select 1 from public.departments d where d.id=nullif(p_employee->>'department_id','')::uuid and d.is_active) then raise exception 'Choose an active department' using errcode='22023'; end if;
    if not exists(select 1 from public.positions p where p.id=nullif(p_employee->>'position_id','')::uuid and p.is_active and p.department_id=nullif(p_employee->>'department_id','')::uuid) then raise exception 'Choose an active position for the selected department' using errcode='22023'; end if;
    if not exists(select 1 from public.employment_types t where t.id=nullif(p_employee->>'employment_type_id','')::uuid and t.is_active) then raise exception 'Choose an active employment type' using errcode='22023'; end if;
    if not exists(select 1 from public.employment_statuses s where s.id=nullif(p_employee->>'employment_status_id','')::uuid and s.is_active) then raise exception 'Choose an active employment status' using errcode='22023'; end if;
    if exists(select 1 from public.employment_statuses s where s.id=nullif(p_employee->>'employment_status_id','')::uuid and lower(s.name)='separated') then raise exception 'Use the Separation lifecycle event to separate an employee' using errcode='22023'; end if;
    if nullif(p_employee->>'work_location_id','') is not null and not exists(select 1 from public.locations l where l.id=(p_employee->>'work_location_id')::uuid and l.is_active) then raise exception 'Choose an active work location' using errcode='22023'; end if;
    if nullif(p_employee->>'supervisor_employee_id','') is not null and not exists(select 1 from public.employees e join public.employment_statuses s on s.id=e.employment_status_id where e.id=(p_employee->>'supervisor_employee_id')::uuid and not e.is_archived and s.is_employed and lower(s.name) not in ('separated','inactive')) then raise exception 'Choose an active supervisor' using errcode='22023'; end if;
    insert into public.employees(employee_number,first_name,middle_name,last_name,preferred_name,email,contact_number,birthday,date_hired,regularization_date,department_id,position_id,employment_type_id,employment_status_id,supervisor_employee_id,work_location_id,created_by,updated_by)
    values (btrim(p_employee->>'employee_number'),btrim(p_employee->>'first_name'),nullif(btrim(p_employee->>'middle_name'),''),btrim(p_employee->>'last_name'),nullif(btrim(p_employee->>'preferred_name'),''),nullif(btrim(p_employee->>'email'),''),nullif(btrim(p_employee->>'contact_number'),''),nullif(p_employee->>'birthday','')::date,(p_employee->>'date_hired')::date,nullif(p_employee->>'regularization_date','')::date,(p_employee->>'department_id')::uuid,(p_employee->>'position_id')::uuid,(p_employee->>'employment_type_id')::uuid,(p_employee->>'employment_status_id')::uuid,nullif(p_employee->>'supervisor_employee_id','')::uuid,nullif(p_employee->>'work_location_id','')::uuid,actor,actor)
    returning id into target_id;
    insert into public.employee_lifecycle_events(employee_id,event_type,effective_date,previous_data,new_data,notes,created_by)
    values (target_id,'HIRE',(p_employee->>'date_hired')::date,'{}',jsonb_build_object('label',p_employee->>'position_label'),'Employee record created.',actor);
  else
    select * into old_row from public.employees where id=p_employee_id for update;
    if not found then raise exception 'Employee was not found' using errcode = 'P0002'; end if;
    target_id := p_employee_id;
    if (old_row.department_id is distinct from nullif(p_employee->>'department_id','')::uuid and not exists(select 1 from public.departments d where d.id=nullif(p_employee->>'department_id','')::uuid and d.is_active)) then raise exception 'Choose an active department' using errcode='22023'; end if;
    if (old_row.position_id is distinct from nullif(p_employee->>'position_id','')::uuid and not exists(select 1 from public.positions p where p.id=nullif(p_employee->>'position_id','')::uuid and p.is_active and p.department_id=nullif(p_employee->>'department_id','')::uuid)) then raise exception 'Choose an active position for the selected department' using errcode='22023'; end if;
    if (old_row.employment_type_id is distinct from nullif(p_employee->>'employment_type_id','')::uuid and not exists(select 1 from public.employment_types t where t.id=nullif(p_employee->>'employment_type_id','')::uuid and t.is_active)) then raise exception 'Choose an active employment type' using errcode='22023'; end if;
    if (old_row.employment_status_id is distinct from nullif(p_employee->>'employment_status_id','')::uuid and not exists(select 1 from public.employment_statuses s where s.id=nullif(p_employee->>'employment_status_id','')::uuid and s.is_active)) then raise exception 'Choose an active employment status' using errcode='22023'; end if;
    if old_row.employment_status_id is distinct from nullif(p_employee->>'employment_status_id','')::uuid and exists(select 1 from public.employment_statuses s where s.id=nullif(p_employee->>'employment_status_id','')::uuid and lower(s.name)='separated') then raise exception 'Use the Separation lifecycle event to separate an employee' using errcode='22023'; end if;
    if old_row.work_location_id is distinct from nullif(p_employee->>'work_location_id','')::uuid and nullif(p_employee->>'work_location_id','') is not null and not exists(select 1 from public.locations l where l.id=(p_employee->>'work_location_id')::uuid and l.is_active) then raise exception 'Choose an active work location' using errcode='22023'; end if;
    if nullif(p_employee->>'supervisor_employee_id','') is not null and not exists(select 1 from public.employees e join public.employment_statuses s on s.id=e.employment_status_id where e.id=(p_employee->>'supervisor_employee_id')::uuid and not e.is_archived and s.is_employed and lower(s.name) not in ('separated','inactive')) then raise exception 'Choose an active supervisor' using errcode='22023'; end if;
    select a.client_id,a.start_date into old_client,old_start from public.employee_client_assignments a where a.employee_id=target_id and a.end_date is null for update;
    update public.employees set employee_number=btrim(p_employee->>'employee_number'),first_name=btrim(p_employee->>'first_name'),middle_name=nullif(btrim(p_employee->>'middle_name'),''),last_name=btrim(p_employee->>'last_name'),preferred_name=nullif(btrim(p_employee->>'preferred_name'),''),email=nullif(btrim(p_employee->>'email'),''),contact_number=nullif(btrim(p_employee->>'contact_number'),''),birthday=nullif(p_employee->>'birthday','')::date,date_hired=(p_employee->>'date_hired')::date,regularization_date=nullif(p_employee->>'regularization_date','')::date,department_id=nullif(p_employee->>'department_id','')::uuid,position_id=nullif(p_employee->>'position_id','')::uuid,employment_type_id=nullif(p_employee->>'employment_type_id','')::uuid,employment_status_id=nullif(p_employee->>'employment_status_id','')::uuid,supervisor_employee_id=nullif(p_employee->>'supervisor_employee_id','')::uuid,work_location_id=nullif(p_employee->>'work_location_id','')::uuid,updated_by=actor where id=target_id;
  end if;
  client_selected := coalesce((p_employee->>'client_assignment_selected')::boolean,false);
  assignment_start := coalesce(nullif(p_employee->>'client_assignment_start_date','')::date,case when p_employee_id is null then (p_employee->>'date_hired')::date else current_date end);
  if p_client_id is not null and not exists(select 1 from public.clients c where c.id=p_client_id and c.is_active) and old_client is distinct from p_client_id then raise exception 'Choose an active client' using errcode='22023'; end if;
  if p_client_id is not null and p_client_id is distinct from old_client then
    if old_start is not null and assignment_start < old_start then raise exception 'A new client assignment cannot begin before the current assignment' using errcode='22023'; end if;
    update public.employee_client_assignments set end_date=greatest(start_date,assignment_start-1) where employee_id=target_id and end_date is null;
    insert into public.employee_client_assignments(employee_id,client_id,start_date,created_by) values(target_id,p_client_id,assignment_start,actor);
    if p_employee_id is not null and old_client is not null then
      insert into public.employee_lifecycle_events(employee_id,event_type,effective_date,previous_data,new_data,notes,created_by)
      values(target_id,'CLIENT_REASSIGNMENT',assignment_start,jsonb_build_object('client_id',old_client),jsonb_build_object('client_id',p_client_id),'Client assignment changed while editing employee record.',actor);
    elsif p_employee_id is null then
      insert into public.employee_lifecycle_events(employee_id,event_type,effective_date,previous_data,new_data,notes,created_by)
      values(target_id,'CLIENT_ASSIGNMENT',assignment_start,'{}',jsonb_build_object('client_id',p_client_id),'Initial client assignment.',actor);
    end if;
  elsif client_selected and p_client_id is null and old_client is not null then
    update public.employee_client_assignments set end_date=greatest(start_date,assignment_start-1) where employee_id=target_id and end_date is null;
    insert into public.employee_lifecycle_events(employee_id,event_type,effective_date,previous_data,new_data,notes,created_by)
    values(target_id,'CLIENT_REASSIGNMENT',assignment_start,jsonb_build_object('client_id',old_client),jsonb_build_object('label','Unassigned'),'Client assignment ended.',actor);
  elsif p_client_id is not null and p_client_id=old_client and nullif(p_employee->>'client_assignment_start_date','') is not null and assignment_start is distinct from old_start then
    if exists(select 1 from public.employee_client_assignments a where a.employee_id=target_id and a.end_date is not null and a.end_date>=assignment_start) then raise exception 'Client assignment dates cannot overlap historical assignments' using errcode='22023'; end if;
    update public.employee_client_assignments set start_date=assignment_start where employee_id=target_id and end_date is null;
  end if;
  return target_id;
end;
$$;
revoke execute on function public.save_employee(uuid,jsonb,uuid) from public, anon;
grant execute on function public.save_employee(uuid,jsonb,uuid) to authenticated;

create or replace function public.record_lifecycle_event(p_employee_id uuid, p_event_type public.lifecycle_event_type, p_effective_date date, p_previous_data jsonb default '{}', p_new_data jsonb default '{}', p_notes text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid()); old_employee public.employees%rowtype; new_employee public.employees%rowtype;
  event_id uuid; separated_status uuid; active_status uuid; regular_status uuid; separation_type uuid;
begin
  if actor is null or not private.can_manage_hr_records() then raise exception 'Not authorized to record lifecycle events' using errcode = '42501'; end if;
  select * into old_employee from public.employees where id=p_employee_id for update;
  if not found then raise exception 'Employee was not found' using errcode = 'P0002'; end if;
  if p_event_type='SEPARATION' then
    separation_type := nullif(p_new_data->>'separation_type_id','')::uuid;
    if separation_type is null or not exists(select 1 from public.separation_types t where t.id=separation_type and t.is_active) then raise exception 'Choose a separation type' using errcode='22023'; end if;
  end if;
  if p_event_type<>'SEPARATION' and nullif(p_new_data->>'employment_status_id','') is not null
     and exists(select 1 from public.employment_statuses s where s.id=(p_new_data->>'employment_status_id')::uuid and lower(s.name)='separated') then
    raise exception 'Use the Separation lifecycle event to separate an employee' using errcode='22023';
  end if;
  if p_event_type in ('PROMOTION','POSITION_CHANGE') and nullif(p_new_data->>'position_id','') is not null
     and not exists(select 1 from public.positions p where p.id=(p_new_data->>'position_id')::uuid and p.is_active) then
    raise exception 'Choose an active position' using errcode='22023';
  end if;
  if p_event_type='DEPARTMENT_TRANSFER' and nullif(p_new_data->>'department_id','') is not null
     and not exists(select 1 from public.departments d where d.id=(p_new_data->>'department_id')::uuid and d.is_active) then
    raise exception 'Choose an active department' using errcode='22023';
  end if;
  if p_event_type='LOCATION_TRANSFER' and nullif(p_new_data->>'work_location_id','') is not null
     and not exists(select 1 from public.locations l where l.id=(p_new_data->>'work_location_id')::uuid and l.is_active) then
    raise exception 'Choose an active location' using errcode='22023';
  end if;
  if p_event_type in ('CLIENT_ASSIGNMENT','CLIENT_REASSIGNMENT','REHIRE') and nullif(p_new_data->>'client_id','') is not null
     and not exists(select 1 from public.clients c where c.id=(p_new_data->>'client_id')::uuid and c.is_active) then
    raise exception 'Choose an active client' using errcode='22023';
  end if;
  update public.employees e set
    position_id=coalesce(nullif(p_new_data->>'position_id','')::uuid,e.position_id), department_id=coalesce(nullif(p_new_data->>'department_id','')::uuid,e.department_id),
    employment_type_id=coalesce(nullif(p_new_data->>'employment_type_id','')::uuid,e.employment_type_id), employment_status_id=coalesce(nullif(p_new_data->>'employment_status_id','')::uuid,e.employment_status_id),
    work_location_id=coalesce(nullif(p_new_data->>'work_location_id','')::uuid,e.work_location_id), regularization_date=coalesce(nullif(p_new_data->>'regularization_date','')::date,e.regularization_date),
    is_archived=case when p_event_type='SEPARATION' then true when p_event_type='REHIRE' then false else e.is_archived end,
    archived_at=case when p_event_type='SEPARATION' then now() when p_event_type='REHIRE' then null else e.archived_at end, updated_by=actor where e.id=p_employee_id;
  if p_event_type='REGULARIZATION' then
    select id into regular_status from public.employment_statuses where lower(name)='regular' limit 1;
    update public.employees set employment_status_id=coalesce(regular_status,employment_status_id) where id=p_employee_id;
  elsif p_event_type='SEPARATION' then
    select id into separated_status from public.employment_statuses where lower(name)='separated' limit 1;
    update public.employees set employment_status_id=coalesce(separated_status,employment_status_id) where id=p_employee_id;
    update public.employee_client_assignments set end_date=p_effective_date where employee_id=p_employee_id and end_date is null;
    update public.resource_assignments set released_at=now(),released_by=actor where employee_id=p_employee_id and released_at is null;
    update public.resources r set status='AVAILABLE',updated_by=actor
    where exists(select 1 from public.resource_assignments a where a.resource_id=r.id and a.employee_id=p_employee_id and a.released_by=actor and a.released_at is not null)
      and not exists(select 1 from public.resource_assignments active where active.resource_id=r.id and active.released_at is null);
  elsif p_event_type='REHIRE' then
    select id into active_status from public.employment_statuses where lower(name)='active' limit 1;
    update public.employees set employment_status_id=coalesce(nullif(p_new_data->>'employment_status_id','')::uuid,active_status),is_archived=false,archived_at=null where id=p_employee_id;
  end if;
  select * into new_employee from public.employees where id=p_employee_id;
  if p_event_type in ('CLIENT_ASSIGNMENT','CLIENT_REASSIGNMENT','REHIRE') and nullif(p_new_data->>'client_id','') is not null then
    update public.employee_client_assignments set end_date=p_effective_date where employee_id=p_employee_id and end_date is null;
    insert into public.employee_client_assignments(employee_id,client_id,start_date,created_by) values(p_employee_id,(p_new_data->>'client_id')::uuid,p_effective_date,actor);
  elsif p_event_type in ('CLIENT_ASSIGNMENT','CLIENT_REASSIGNMENT') and lower(coalesce(p_new_data->>'label',''))='unassigned' then
    update public.employee_client_assignments set end_date=p_effective_date where employee_id=p_employee_id and end_date is null;
  end if;
  insert into public.employee_lifecycle_events(employee_id,event_type,effective_date,previous_data,new_data,notes,created_by,separation_type_id)
  values(p_employee_id,p_event_type,p_effective_date,coalesce(p_previous_data,'{}'),coalesce(p_new_data,'{}'),p_notes,actor,separation_type) returning id into event_id;
  return event_id;
end;
$$;
revoke execute on function public.record_lifecycle_event(uuid,public.lifecycle_event_type,date,jsonb,jsonb,text) from public, anon;
grant execute on function public.record_lifecycle_event(uuid,public.lifecycle_event_type,date,jsonb,jsonb,text) to authenticated;
