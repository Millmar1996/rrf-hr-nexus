-- Keep lifecycle values structured and make separation one atomic HR operation.
create or replace function public.record_lifecycle_event(
  p_employee_id uuid,
  p_event_type public.lifecycle_event_type,
  p_effective_date date,
  p_previous_data jsonb default '{}',
  p_new_data jsonb default '{}',
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  employee_row public.employees%rowtype;
  event_id uuid;
  old_status_id uuid;
  old_status_name text;
  new_status_id uuid;
  new_status_name text;
  separation_type_id uuid;
  separation_type_name text;
  old_client_id uuid;
  old_client_name text;
  new_client_id uuid;
  new_client_name text;
  old_client_start date;
  previous_data jsonb := coalesce(p_previous_data, '{}'::jsonb);
  new_data jsonb := coalesce(p_new_data, '{}'::jsonb);
  released_resource_ids uuid[];
begin
  if actor is null or not private.can_manage_hr_records() then
    raise exception 'Not authorized to record lifecycle events' using errcode = '42501';
  end if;

  select * into employee_row
  from public.employees
  where id = p_employee_id
  for update;
  if not found then raise exception 'Employee was not found' using errcode = 'P0002'; end if;

  select id, name into old_status_id, old_status_name
  from public.employment_statuses where id = employee_row.employment_status_id;

  if p_event_type = 'REGULARIZATION' then
    select id, name into new_status_id, new_status_name
    from public.employment_statuses where lower(name) = 'regular' and is_active
    order by id limit 1;
    if new_status_id is null then raise exception 'Configure an active Regular employment status first' using errcode = '22023'; end if;
    previous_data := previous_data || jsonb_build_object(
      'status_id', old_status_id, 'employment_status_id', old_status_id,
      'status_code', upper(regexp_replace(coalesce(old_status_name, ''), '[^A-Za-z0-9]+', '_', 'g')),
      'status_name', old_status_name, 'employment_status_name', old_status_name,
      'label', coalesce(old_status_name, 'Previous status')
    );
    new_data := new_data || jsonb_build_object(
      'status_id', new_status_id, 'employment_status_id', new_status_id,
      'status_code', upper(regexp_replace(new_status_name, '[^A-Za-z0-9]+', '_', 'g')),
      'status_name', new_status_name, 'employment_status_name', new_status_name,
      'label', new_status_name
    );
  end if;

  if p_event_type = 'SEPARATION' then
    separation_type_id := nullif(new_data->>'separation_type_id', '')::uuid;
    if separation_type_id is null then
      select id into separation_type_id from public.separation_types
      where is_active and lower(name) = lower(coalesce(new_data->>'separation_type_name', new_data->>'label', ''))
      order by name limit 1;
    end if;
    select name into separation_type_name from public.separation_types
    where id = separation_type_id and is_active;
    if separation_type_id is null or separation_type_name is null then
      raise exception 'Choose an active separation type' using errcode = '22023';
    end if;
    select id, name into new_status_id, new_status_name
    from public.employment_statuses where lower(name) = 'separated' and is_active
    order by id limit 1;
    if new_status_id is null then raise exception 'Configure an active Separated employment status first' using errcode = '22023'; end if;
    previous_data := previous_data || jsonb_build_object(
      'status_id', old_status_id, 'employment_status_id', old_status_id,
      'status_code', upper(regexp_replace(coalesce(old_status_name, ''), '[^A-Za-z0-9]+', '_', 'g')),
      'status_name', old_status_name, 'employment_status_name', old_status_name,
      'label', coalesce(old_status_name, 'Previous status')
    );
    new_data := new_data || jsonb_build_object(
      'separation_type_id', separation_type_id, 'separation_type_name', separation_type_name,
      'separation_type_code', upper(regexp_replace(separation_type_name, '[^A-Za-z0-9]+', '_', 'g')),
      'status_id', new_status_id, 'employment_status_id', new_status_id,
      'status_code', upper(regexp_replace(new_status_name, '[^A-Za-z0-9]+', '_', 'g')),
      'status_name', new_status_name, 'employment_status_name', new_status_name,
      'label', separation_type_name
    );
  end if;

  if p_event_type in ('CLIENT_ASSIGNMENT', 'CLIENT_REASSIGNMENT', 'REHIRE') then
    select a.client_id, c.name, a.start_date into old_client_id, old_client_name, old_client_start
    from public.employee_client_assignments a
    join public.clients c on c.id = a.client_id
    where a.employee_id = p_employee_id and a.end_date is null
    order by a.start_date desc limit 1 for update of a;

    new_client_id := nullif(new_data->>'client_id', '')::uuid;
    if lower(coalesce(new_data->>'label', new_data->>'client_name', '')) = 'unassigned' then new_client_id := null; end if;
    if p_event_type = 'CLIENT_REASSIGNMENT' and old_client_id is not null and new_client_id = old_client_id then
      raise exception 'Choose a different client for reassignment' using errcode = '22023';
    end if;
    if new_client_id is not null then
      select name into new_client_name from public.clients where id = new_client_id and is_active;
      if new_client_name is null then raise exception 'Choose an active client' using errcode = '22023'; end if;
    elsif p_event_type in ('CLIENT_ASSIGNMENT', 'CLIENT_REASSIGNMENT') and old_client_id is not null
      and lower(coalesce(new_data->>'label', new_data->>'client_name', '')) <> 'unassigned' then
      raise exception 'Choose a client or explicitly end the assignment' using errcode = '22023';
    end if;

    if old_client_id is not null then
      previous_data := previous_data || jsonb_build_object('client_id', old_client_id, 'client_name', old_client_name, 'label', old_client_name);
    elsif p_event_type = 'CLIENT_ASSIGNMENT' then
      previous_data := previous_data || jsonb_build_object('label', 'Unassigned');
    end if;
    if new_client_id is not null then
      new_data := new_data || jsonb_build_object('client_id', new_client_id, 'client_name', new_client_name, 'label', new_client_name);
    elsif p_event_type in ('CLIENT_ASSIGNMENT', 'CLIENT_REASSIGNMENT') then
      new_data := new_data || jsonb_build_object('client_name', 'Unassigned', 'label', 'Unassigned');
    end if;
  end if;

  if p_event_type in ('PROMOTION', 'POSITION_CHANGE') and nullif(new_data->>'position_id', '') is not null
    and not exists(select 1 from public.positions p where p.id = (new_data->>'position_id')::uuid and p.is_active) then
    raise exception 'Choose an active position' using errcode = '22023';
  end if;
  if p_event_type = 'DEPARTMENT_TRANSFER' and nullif(new_data->>'department_id', '') is not null
    and not exists(select 1 from public.departments d where d.id = (new_data->>'department_id')::uuid and d.is_active) then
    raise exception 'Choose an active department' using errcode = '22023';
  end if;
  if p_event_type = 'LOCATION_TRANSFER' and nullif(new_data->>'work_location_id', '') is not null
    and not exists(select 1 from public.locations l where l.id = (new_data->>'work_location_id')::uuid and l.is_active) then
    raise exception 'Choose an active location' using errcode = '22023';
  end if;
  if p_event_type <> 'SEPARATION' and nullif(new_data->>'employment_status_id', '') is not null
    and exists(select 1 from public.employment_statuses s where s.id = (new_data->>'employment_status_id')::uuid and lower(s.name) = 'separated') then
    raise exception 'Use the Separation lifecycle event to separate an employee' using errcode = '22023';
  end if;

  update public.employees set
    position_id = coalesce(nullif(new_data->>'position_id', '')::uuid, position_id),
    department_id = coalesce(nullif(new_data->>'department_id', '')::uuid, department_id),
    employment_type_id = coalesce(nullif(new_data->>'employment_type_id', '')::uuid, employment_type_id),
    employment_status_id = case when p_event_type in ('REGULARIZATION', 'SEPARATION') then new_status_id else coalesce(nullif(new_data->>'employment_status_id', '')::uuid, employment_status_id) end,
    work_location_id = coalesce(nullif(new_data->>'work_location_id', '')::uuid, work_location_id),
    regularization_date = coalesce(nullif(new_data->>'regularization_date', '')::date, regularization_date),
    is_archived = case when p_event_type = 'SEPARATION' then true when p_event_type = 'REHIRE' then false else is_archived end,
    archived_at = case when p_event_type = 'SEPARATION' then now() when p_event_type = 'REHIRE' then null else archived_at end,
    updated_by = actor
  where id = p_employee_id;

  if p_event_type in ('CLIENT_ASSIGNMENT', 'CLIENT_REASSIGNMENT', 'REHIRE') then
    if old_client_id is not null and (new_client_id is distinct from old_client_id or p_event_type = 'CLIENT_REASSIGNMENT') then
      if p_effective_date < old_client_start then raise exception 'Assignment effective date cannot precede the current assignment' using errcode = '22023'; end if;
      update public.employee_client_assignments set end_date = p_effective_date
      where employee_id = p_employee_id and end_date is null;
    end if;
    if new_client_id is not null and new_client_id is distinct from old_client_id then
      insert into public.employee_client_assignments(employee_id, client_id, start_date, created_by)
      values (p_employee_id, new_client_id, p_effective_date, actor);
    elsif p_event_type = 'CLIENT_REASSIGNMENT' and new_client_id is null and old_client_id is not null then
      update public.employee_client_assignments set end_date = p_effective_date
      where employee_id = p_employee_id and end_date is null;
    end if;
  end if;

  if p_event_type = 'SEPARATION' then
    update public.employee_client_assignments set end_date = greatest(start_date, p_effective_date)
    where employee_id = p_employee_id and end_date is null;
    with released as (
      update public.resource_assignments set released_at = now(), released_by = actor
      where employee_id = p_employee_id and released_at is null
      returning resource_id
    ) select array_agg(resource_id) into released_resource_ids from released;
    if released_resource_ids is not null then
      update public.resources r set status = 'AVAILABLE', updated_by = actor
      where r.id = any(released_resource_ids) and r.status = 'ASSIGNED'
        and not exists(select 1 from public.resource_assignments a where a.resource_id = r.id and a.released_at is null);
    end if;
  elsif p_event_type = 'REHIRE' then
    select id into new_status_id from public.employment_statuses where lower(name) = 'active' and is_active order by id limit 1;
    update public.employees set employment_status_id = coalesce(nullif(new_data->>'employment_status_id', '')::uuid, new_status_id, employment_status_id), is_archived = false, archived_at = null where id = p_employee_id;
  end if;

  insert into public.employee_lifecycle_events(employee_id, event_type, effective_date, previous_data, new_data, notes, created_by, separation_type_id)
  values (p_employee_id, p_event_type, p_effective_date, previous_data, new_data, nullif(btrim(p_notes), ''), actor, separation_type_id)
  returning id into event_id;
  return event_id;
end;
$$;
revoke execute on function public.record_lifecycle_event(uuid, public.lifecycle_event_type, date, jsonb, jsonb, text) from public, anon;
grant execute on function public.record_lifecycle_event(uuid, public.lifecycle_event_type, date, jsonb, jsonb, text) to authenticated;

-- Repair the audited QA event and any other regularization that only has the old status.
update public.employee_lifecycle_events e
set previous_data = coalesce(e.previous_data, '{}'::jsonb) || jsonb_build_object(
      'status_id', coalesce(nullif(e.previous_data->>'status_id', '')::uuid, (select s.id from public.employment_statuses s where s.name = e.previous_data->>'label' limit 1)),
      'employment_status_id', coalesce(nullif(e.previous_data->>'status_id', '')::uuid, (select s.id from public.employment_statuses s where s.name = e.previous_data->>'label' limit 1)),
      'status_code', upper(regexp_replace(coalesce((select s.name from public.employment_statuses s where s.id = nullif(e.previous_data->>'status_id', '')::uuid or s.name = e.previous_data->>'label' limit 1), e.previous_data->>'label', ''), '[^A-Za-z0-9]+', '_', 'g')),
      'status_name', coalesce((select s.name from public.employment_statuses s where s.id = nullif(e.previous_data->>'status_id', '')::uuid or s.name = e.previous_data->>'label' limit 1), e.previous_data->>'label'),
      'employment_status_name', coalesce((select s.name from public.employment_statuses s where s.id = nullif(e.previous_data->>'status_id', '')::uuid or s.name = e.previous_data->>'label' limit 1), e.previous_data->>'label'),
      'label', coalesce((select s.name from public.employment_statuses s where s.id = nullif(e.previous_data->>'status_id', '')::uuid or s.name = e.previous_data->>'label' limit 1), e.previous_data->>'label', 'Previous status')),
    new_data = coalesce(e.new_data, '{}'::jsonb) || jsonb_build_object(
      'status_id', regular_status.id, 'employment_status_id', regular_status.id,
      'status_code', 'REGULAR', 'status_name', regular_status.name,
      'employment_status_name', regular_status.name, 'label', regular_status.name)
from public.employment_statuses regular_status
where e.event_type = 'REGULARIZATION' and lower(regular_status.name) = 'regular'
  and (coalesce(e.new_data->>'label', '') = '' or coalesce(e.new_data->>'status_name', '') = '');

-- Reconcile exact client movement pairs from the dated assignment ledger.
with assignment_pairs as (
  select e.id as event_id, prior.client_id as old_client_id, prior.name as old_client_name,
         new_a.client_id as new_client_id, new_a.name as new_client_name
  from public.employee_lifecycle_events e
  cross join lateral (
    select a.client_id, a.start_date, c.name from public.employee_client_assignments a
    join public.clients c on c.id = a.client_id
    where a.employee_id = e.employee_id and a.start_date = e.effective_date
    order by a.created_at desc limit 1
  ) new_a
  cross join lateral (
    select a.client_id, c.name from public.employee_client_assignments a
    join public.clients c on c.id = a.client_id
    where a.employee_id = e.employee_id and a.end_date is not null and a.end_date <= new_a.start_date
      and a.start_date < new_a.start_date
    order by a.start_date desc, a.created_at desc limit 1
  ) prior
  where e.event_type = 'CLIENT_REASSIGNMENT'
)
update public.employee_lifecycle_events e
set previous_data = coalesce(e.previous_data, '{}'::jsonb) || jsonb_build_object('client_id', p.old_client_id, 'client_name', p.old_client_name, 'label', p.old_client_name),
    new_data = coalesce(e.new_data, '{}'::jsonb) || jsonb_build_object('client_id', p.new_client_id, 'client_name', p.new_client_name, 'label', p.new_client_name)
from assignment_pairs p where e.id = p.event_id;
