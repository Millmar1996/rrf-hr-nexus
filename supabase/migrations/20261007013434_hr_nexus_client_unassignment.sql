-- Allow a recorded client reassignment to end an assignment without creating a replacement.
create or replace function public.record_lifecycle_event(
  p_employee_id uuid,
  p_event_type public.lifecycle_event_type,
  p_effective_date date,
  p_previous_data jsonb default '{}',
  p_new_data jsonb default '{}',
  p_notes text default null
)
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
  if p_event_type='CLIENT_REASSIGNMENT' or nullif(p_new_data->>'client_id','') is not null then
    update public.employee_client_assignments set end_date=greatest(p_effective_date,start_date) where employee_id=p_employee_id and end_date is null;
    if nullif(p_new_data->>'client_id','') is not null then
      insert into public.employee_client_assignments(employee_id,client_id,start_date,created_by)
      values(p_employee_id,(p_new_data->>'client_id')::uuid,p_effective_date,actor);
    end if;
  end if;
  insert into public.employee_lifecycle_events(employee_id,event_type,effective_date,previous_data,new_data,notes,created_by)
  values(p_employee_id,p_event_type,p_effective_date,coalesce(p_previous_data,'{}'),coalesce(p_new_data,'{}'),p_notes,actor)
  returning id into event_id;
  return event_id;
end;
$$;
