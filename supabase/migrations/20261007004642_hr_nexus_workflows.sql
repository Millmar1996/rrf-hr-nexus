-- Transactional application workflows and audit coverage for RRF HR Nexus.
create or replace function private.audit_business_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  row_id uuid;
  old_row jsonb;
  new_row jsonb;
  action_name text;
begin
  if tg_op <> 'INSERT' then old_row := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then new_row := to_jsonb(new); end if;
  row_id := coalesce((new_row->>'id')::uuid, (old_row->>'id')::uuid);
  action_name := lower(replace(tg_table_name, '_', '.')) || case tg_op when 'INSERT' then '.created' when 'DELETE' then '.deleted' else '.updated' end;
  insert into public.audit_logs(user_id, action, entity_type, entity_id, old_data, new_data)
  values ((select auth.uid()), action_name, tg_table_name, row_id,
    case when old_row is null then null else old_row - 'created_by' - 'updated_by' - 'uploaded_by' end,
    case when new_row is null then null else new_row - 'created_by' - 'updated_by' - 'uploaded_by' end);
  return coalesce(new, old);
end;
$$;
revoke execute on function private.audit_business_row() from public, anon, authenticated;

create trigger lifecycle_audit after insert on public.employee_lifecycle_events
  for each row execute function private.audit_business_row();
create trigger documents_audit after insert or update or delete on public.employee_documents
  for each row execute function private.audit_business_row();
create trigger client_assignments_audit after insert or update on public.employee_client_assignments
  for each row execute function private.audit_business_row();
create trigger resource_assignments_audit after insert or update on public.resource_assignments
  for each row execute function private.audit_business_row();
create trigger resources_audit after insert or update on public.resources
  for each row execute function private.audit_business_row();
create trigger departments_audit after insert or update on public.departments
  for each row execute function private.audit_business_row();
create trigger positions_audit after insert or update on public.positions
  for each row execute function private.audit_business_row();
create trigger employment_types_audit after insert or update on public.employment_types
  for each row execute function private.audit_business_row();
create trigger employment_statuses_audit after insert or update on public.employment_statuses
  for each row execute function private.audit_business_row();
create trigger clients_audit after insert or update on public.clients
  for each row execute function private.audit_business_row();
create trigger locations_audit after insert or update on public.locations
  for each row execute function private.audit_business_row();
create trigger document_types_audit after insert or update on public.document_types
  for each row execute function private.audit_business_row();
create trigger resource_types_audit after insert or update on public.resource_types
  for each row execute function private.audit_business_row();

create or replace function public.save_employee(p_employee_id uuid, p_employee jsonb, p_client_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  target_id uuid;
  old_client uuid;
  employee_row public.employees%rowtype;
begin
  if actor is null or not private.can_manage_hr_records() then raise exception 'Not authorized to manage employee records' using errcode = '42501'; end if;
  if nullif(p_employee->>'employee_number','') is null or nullif(p_employee->>'first_name','') is null or nullif(p_employee->>'last_name','') is null then
    raise exception 'Employee number, first name, and last name are required' using errcode = '22023';
  end if;
  if p_employee_id is null then
    insert into public.employees(employee_number,first_name,middle_name,last_name,preferred_name,email,contact_number,birthday,date_hired,regularization_date,department_id,position_id,employment_type_id,employment_status_id,supervisor_employee_id,work_location_id,created_by,updated_by)
    values (p_employee->>'employee_number',p_employee->>'first_name',nullif(p_employee->>'middle_name',''),p_employee->>'last_name',nullif(p_employee->>'preferred_name',''),nullif(p_employee->>'email',''),nullif(p_employee->>'contact_number',''),nullif(p_employee->>'birthday','')::date,(p_employee->>'date_hired')::date,nullif(p_employee->>'regularization_date','')::date,nullif(p_employee->>'department_id','')::uuid,nullif(p_employee->>'position_id','')::uuid,nullif(p_employee->>'employment_type_id','')::uuid,nullif(p_employee->>'employment_status_id','')::uuid,nullif(p_employee->>'supervisor_employee_id','')::uuid,nullif(p_employee->>'work_location_id','')::uuid,actor,actor)
    returning id into target_id;
    insert into public.employee_lifecycle_events(employee_id,event_type,effective_date,previous_data,new_data,notes,created_by)
    values (target_id,'HIRE',(p_employee->>'date_hired')::date,'{}',jsonb_build_object('label',p_employee->>'position_label'),'Employee record created.',actor);
  else
    select * into employee_row from public.employees where id = p_employee_id for update;
    if not found then raise exception 'Employee was not found' using errcode = 'P0002'; end if;
    target_id := p_employee_id;
    select a.client_id into old_client from public.employee_client_assignments a where a.employee_id = target_id and a.end_date is null for update;
    update public.employees set employee_number=p_employee->>'employee_number',first_name=p_employee->>'first_name',middle_name=nullif(p_employee->>'middle_name',''),last_name=p_employee->>'last_name',preferred_name=nullif(p_employee->>'preferred_name',''),email=nullif(p_employee->>'email',''),contact_number=nullif(p_employee->>'contact_number',''),birthday=nullif(p_employee->>'birthday','')::date,date_hired=(p_employee->>'date_hired')::date,regularization_date=nullif(p_employee->>'regularization_date','')::date,department_id=nullif(p_employee->>'department_id','')::uuid,position_id=nullif(p_employee->>'position_id','')::uuid,employment_type_id=nullif(p_employee->>'employment_type_id','')::uuid,employment_status_id=nullif(p_employee->>'employment_status_id','')::uuid,supervisor_employee_id=nullif(p_employee->>'supervisor_employee_id','')::uuid,work_location_id=nullif(p_employee->>'work_location_id','')::uuid,updated_by=actor where id=target_id;
  end if;
  if p_client_id is not null and p_client_id is distinct from old_client then
    update public.employee_client_assignments set end_date=(p_employee->>'date_hired')::date where employee_id=target_id and end_date is null;
    insert into public.employee_client_assignments(employee_id,client_id,start_date,created_by)
    values(target_id,p_client_id,case when p_employee_id is null then (p_employee->>'date_hired')::date else current_date end,actor);
    if p_employee_id is not null and old_client is not null then
      insert into public.employee_lifecycle_events(employee_id,event_type,effective_date,previous_data,new_data,notes,created_by)
      values(target_id,'CLIENT_REASSIGNMENT',current_date,jsonb_build_object('client_id',old_client),jsonb_build_object('client_id',p_client_id), 'Client assignment changed while editing employee record.',actor);
    end if;
  end if;
  return target_id;
end;
$$;
revoke execute on function public.save_employee(uuid,jsonb,uuid) from public, anon;
grant execute on function public.save_employee(uuid,jsonb,uuid) to authenticated;

create or replace function public.archive_employee(p_employee_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not private.can_manage_hr_records() then raise exception 'Not authorized to archive employee records' using errcode = '42501'; end if;
  update public.employees set is_archived=true,archived_at=now(),updated_by=(select auth.uid()) where id=p_employee_id and not is_archived;
  if not found then raise exception 'Employee was not found or is already archived' using errcode = 'P0002'; end if;
end;
$$;
revoke execute on function public.archive_employee(uuid) from public, anon;
grant execute on function public.archive_employee(uuid) to authenticated;

create or replace function public.record_lifecycle_event(p_employee_id uuid, p_event_type public.lifecycle_event_type, p_effective_date date, p_previous_data jsonb default '{}', p_new_data jsonb default '{}', p_notes text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  old_employee public.employees%rowtype;
  new_employee public.employees%rowtype;
  event_id uuid;
  separated_status uuid;
  active_status uuid;
  regular_type uuid;
begin
  if actor is null or not private.can_manage_hr_records() then raise exception 'Not authorized to record lifecycle events' using errcode = '42501'; end if;
  select * into old_employee from public.employees where id=p_employee_id for update;
  if not found then raise exception 'Employee was not found' using errcode = 'P0002'; end if;
  update public.employees e set
    position_id=coalesce(nullif(p_new_data->>'position_id','')::uuid,e.position_id),
    department_id=coalesce(nullif(p_new_data->>'department_id','')::uuid,e.department_id),
    employment_type_id=coalesce(nullif(p_new_data->>'employment_type_id','')::uuid,e.employment_type_id),
    employment_status_id=coalesce(nullif(p_new_data->>'employment_status_id','')::uuid,e.employment_status_id),
    work_location_id=coalesce(nullif(p_new_data->>'work_location_id','')::uuid,e.work_location_id),
    regularization_date=coalesce(nullif(p_new_data->>'regularization_date','')::date,e.regularization_date),
    is_archived=case when p_event_type='SEPARATION' then true when p_event_type='REHIRE' then false else e.is_archived end,
    archived_at=case when p_event_type='SEPARATION' then now() when p_event_type='REHIRE' then null else e.archived_at end,
    updated_by=actor
  where e.id=p_employee_id;
  if p_event_type='REGULARIZATION' then
    select id into active_status from public.employment_statuses where lower(name)='active' limit 1;
    select id into regular_type from public.employment_types where lower(name)='regular' limit 1;
    update public.employees set employment_status_id=coalesce(active_status,employment_status_id),employment_type_id=coalesce(regular_type,employment_type_id) where id=p_employee_id;
  elsif p_event_type='SEPARATION' then
    select id into separated_status from public.employment_statuses where lower(name)='separated' limit 1;
    update public.employees set employment_status_id=coalesce(separated_status,employment_status_id) where id=p_employee_id;
    update public.employee_client_assignments set end_date=p_effective_date where employee_id=p_employee_id and end_date is null;
    update public.resource_assignments set released_at=now(),released_by=actor where employee_id=p_employee_id and released_at is null;
    update public.resources r set status='AVAILABLE',updated_by=actor where exists(select 1 from public.resource_assignments a where a.resource_id=r.id and a.employee_id=p_employee_id and a.released_by=actor and a.released_at is not null);
  elsif p_event_type='REHIRE' then
    update public.employees set employment_status_id=coalesce(nullif(p_new_data->>'employment_status_id','')::uuid,active_status),is_archived=false,archived_at=null where id=p_employee_id;
  end if;
  select * into new_employee from public.employees where id=p_employee_id;
  if nullif(p_new_data->>'client_id','') is not null then
    update public.employee_client_assignments set end_date=p_effective_date where employee_id=p_employee_id and end_date is null;
    insert into public.employee_client_assignments(employee_id,client_id,start_date,created_by)
    values(p_employee_id,(p_new_data->>'client_id')::uuid,p_effective_date,actor);
  end if;
  insert into public.employee_lifecycle_events(employee_id,event_type,effective_date,previous_data,new_data,notes,created_by)
  values(p_employee_id,p_event_type,p_effective_date,coalesce(p_previous_data,'{}'),coalesce(p_new_data,'{}'),p_notes,actor)
  returning id into event_id;
  return event_id;
end;
$$;
revoke execute on function public.record_lifecycle_event(uuid,public.lifecycle_event_type,date,jsonb,jsonb,text) from public, anon;
grant execute on function public.record_lifecycle_event(uuid,public.lifecycle_event_type,date,jsonb,jsonb,text) to authenticated;

create or replace function public.save_resource(p_resource_id uuid, p_resource_code text, p_resource_type_id uuid, p_location_id uuid, p_description text, p_status public.resource_status)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); target_id uuid;
begin
  if actor is null or not private.can_manage_hr_records() then raise exception 'Not authorized to manage resources' using errcode = '42501'; end if;
  if p_resource_id is null then
    insert into public.resources(resource_code,resource_type_id,location_id,description,status,created_by,updated_by)
    values(p_resource_code,p_resource_type_id,p_location_id,p_description,case when p_status='ASSIGNED' then 'AVAILABLE'::public.resource_status else p_status end,actor,actor) returning id into target_id;
  else
    target_id := p_resource_id;
    update public.resources set resource_code=p_resource_code,resource_type_id=p_resource_type_id,location_id=p_location_id,description=p_description,
      status=case when exists(select 1 from public.resource_assignments where resource_id=p_resource_id and released_at is null) then 'ASSIGNED'::public.resource_status else p_status end,updated_by=actor where id=p_resource_id;
    if not found then raise exception 'Resource was not found' using errcode = 'P0002'; end if;
  end if;
  return target_id;
end;
$$;
revoke execute on function public.save_resource(uuid,text,uuid,uuid,text,public.resource_status) from public, anon;
grant execute on function public.save_resource(uuid,text,uuid,uuid,text,public.resource_status) to authenticated;

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
    if current_status in ('MAINTENANCE','INACTIVE') then raise exception 'A resource in maintenance or inactive cannot be assigned' using errcode = '22023'; end if;
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

create policy "Active profiles can read audit log" on public.audit_logs for select to authenticated
  using ((select private.has_role(array['ADMIN','HR_MANAGER','VIEWER']::public.app_role[])));

drop policy if exists "HR managers read document metadata" on public.employee_documents;
create policy "Active profiles read document metadata" on public.employee_documents for select to authenticated
  using ((select private.has_active_profile()));
drop policy if exists "HR can read private employee files" on storage.objects;
create policy "HR can read private employee files" on storage.objects for select to authenticated
  using (bucket_id='employee-documents' and (select private.has_active_profile()));
