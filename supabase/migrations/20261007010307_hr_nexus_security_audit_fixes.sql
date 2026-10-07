-- Correct trigger behavior, record role changes, and tighten resource state invariants.
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
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger profiles_role_audit after update of role, is_active on public.profiles
  for each row execute function private.audit_business_row();

create or replace function public.record_lifecycle_event(p_employee_id uuid, p_event_type public.lifecycle_event_type, p_effective_date date, p_previous_data jsonb default '{}', p_new_data jsonb default '{}', p_notes text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  old_employee public.employees%rowtype;
  event_id uuid;
  selected_status uuid;
  selected_type uuid;
  freed_resources uuid[];
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
    select id into selected_status from public.employment_statuses where lower(name)='active' limit 1;
    select id into selected_type from public.employment_types where lower(name)='regular' limit 1;
    update public.employees set employment_status_id=coalesce(selected_status,employment_status_id),employment_type_id=coalesce(selected_type,employment_type_id) where id=p_employee_id;
  elsif p_event_type='SEPARATION' then
    select id into selected_status from public.employment_statuses where lower(name)='separated' limit 1;
    update public.employees set employment_status_id=coalesce(selected_status,employment_status_id) where id=p_employee_id;
    update public.employee_client_assignments set end_date=greatest(p_effective_date,start_date) where employee_id=p_employee_id and end_date is null;
    with freed as (
      update public.resource_assignments set released_at=now(),released_by=actor
      where employee_id=p_employee_id and released_at is null returning resource_id
    ) select array_agg(resource_id) into freed_resources from freed;
    if freed_resources is not null then update public.resources set status='AVAILABLE',updated_by=actor where id=any(freed_resources); end if;
  elsif p_event_type='REHIRE' then
    select id into selected_status from public.employment_statuses where lower(name)='active' limit 1;
    update public.employees set employment_status_id=coalesce(nullif(p_new_data->>'employment_status_id','')::uuid,selected_status,employment_status_id),is_archived=false,archived_at=null where id=p_employee_id;
  end if;
  if nullif(p_new_data->>'client_id','') is not null then
    update public.employee_client_assignments set end_date=greatest(p_effective_date,start_date) where employee_id=p_employee_id and end_date is null;
    insert into public.employee_client_assignments(employee_id,client_id,start_date,created_by)
    values(p_employee_id,(p_new_data->>'client_id')::uuid,p_effective_date,actor);
  end if;
  insert into public.employee_lifecycle_events(employee_id,event_type,effective_date,previous_data,new_data,notes,created_by)
  values(p_employee_id,p_event_type,p_effective_date,coalesce(p_previous_data,'{}'),coalesce(p_new_data,'{}'),p_notes,actor)
  returning id into event_id;
  return event_id;
end;
$$;

create or replace function public.save_employee(p_employee_id uuid, p_employee jsonb, p_client_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  target_id uuid;
  old_client uuid;
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
    perform 1 from public.employees where id=p_employee_id for update;
    if not found then raise exception 'Employee was not found' using errcode = 'P0002'; end if;
    target_id := p_employee_id;
    select a.client_id into old_client from public.employee_client_assignments a where a.employee_id=target_id and a.end_date is null for update;
    update public.employees set employee_number=p_employee->>'employee_number',first_name=p_employee->>'first_name',middle_name=nullif(p_employee->>'middle_name',''),last_name=p_employee->>'last_name',preferred_name=nullif(p_employee->>'preferred_name',''),email=nullif(p_employee->>'email',''),contact_number=nullif(p_employee->>'contact_number',''),birthday=nullif(p_employee->>'birthday','')::date,date_hired=(p_employee->>'date_hired')::date,regularization_date=nullif(p_employee->>'regularization_date','')::date,department_id=nullif(p_employee->>'department_id','')::uuid,position_id=nullif(p_employee->>'position_id','')::uuid,employment_type_id=nullif(p_employee->>'employment_type_id','')::uuid,employment_status_id=nullif(p_employee->>'employment_status_id','')::uuid,supervisor_employee_id=nullif(p_employee->>'supervisor_employee_id','')::uuid,work_location_id=nullif(p_employee->>'work_location_id','')::uuid,updated_by=actor where id=target_id;
  end if;
  if p_client_id is not null and p_client_id is distinct from old_client then
    update public.employee_client_assignments set end_date=greatest(current_date,start_date) where employee_id=target_id and end_date is null;
    insert into public.employee_client_assignments(employee_id,client_id,start_date,created_by)
    values(target_id,p_client_id,case when p_employee_id is null then (p_employee->>'date_hired')::date else current_date end,actor);
    if p_employee_id is not null and old_client is not null then
      insert into public.employee_lifecycle_events(employee_id,event_type,effective_date,previous_data,new_data,notes,created_by)
      values(target_id,'CLIENT_REASSIGNMENT',current_date,jsonb_build_object('client_id',old_client),jsonb_build_object('client_id',p_client_id),'Client assignment changed while editing employee record.',actor);
    end if;
  end if;
  return target_id;
end;
$$;

create or replace function public.save_resource(p_resource_id uuid, p_resource_code text, p_resource_type_id uuid, p_location_id uuid, p_description text, p_status public.resource_status)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); target_id uuid; assigned boolean;
begin
  if actor is null or not private.can_manage_hr_records() then raise exception 'Not authorized to manage resources' using errcode = '42501'; end if;
  if p_resource_id is null then
    if p_status='ASSIGNED' then raise exception 'Assign a resource to an employee to set Assigned status' using errcode = '22023'; end if;
    insert into public.resources(resource_code,resource_type_id,location_id,description,status,created_by,updated_by)
    values(p_resource_code,p_resource_type_id,p_location_id,p_description,p_status,actor,actor) returning id into target_id;
  else
    target_id := p_resource_id;
    select exists(select 1 from public.resource_assignments where resource_id=p_resource_id and released_at is null) into assigned;
    if p_status='ASSIGNED' and not assigned then raise exception 'Assign a resource to an employee to set Assigned status' using errcode = '22023'; end if;
    update public.resources set resource_code=p_resource_code,resource_type_id=p_resource_type_id,location_id=p_location_id,description=p_description,status=case when assigned then 'ASSIGNED'::public.resource_status else p_status end,updated_by=actor where id=p_resource_id;
    if not found then raise exception 'Resource was not found' using errcode = 'P0002'; end if;
  end if;
  return target_id;
end;
$$;
