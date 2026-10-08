-- Rollback-only production check for archive semantics. It creates a QA TEST
-- employee, current client allocation, and assigned resource, then archives
-- without separation and verifies operational totals and retained relations.
begin;
select set_config('app.hr_qa_actor', (select id::text from public.profiles where role = 'ADMIN' and is_active order by created_at limit 1), true);
select set_config('request.jwt.claim.sub', current_setting('app.hr_qa_actor'), true);
do $$
declare
  actor uuid := current_setting('app.hr_qa_actor')::uuid;
  suffix text := md5(clock_timestamp()::text || random()::text);
  dept uuid; pos uuid; emp_type uuid; status_id uuid; v_client_id uuid;
  resource_type_id uuid; v_employee_id uuid; v_resource_id uuid; active_before integer; active_after integer;
  employee_json jsonb;
begin
  insert into public.departments(name, created_by) values ('QA TEST Archive Department ' || suffix, actor) returning id into dept;
  insert into public.positions(name, department_id, created_by) values ('QA TEST Archive Position ' || suffix, dept, actor) returning id into pos;
  insert into public.employment_types(name, created_by) values ('QA TEST Archive Employment Type ' || suffix, actor) returning id into emp_type;
  select id into status_id from public.employment_statuses where lower(name) = 'regular' and is_active and is_employed limit 1;
  if status_id is null then raise exception 'No active employed status is available'; end if;
  insert into public.clients(name, created_by) values ('QA TEST Archive Client ' || suffix, actor) returning id into v_client_id;
  insert into public.resource_types(name, created_by) values ('QA TEST Archive Resource Type ' || suffix, actor) returning id into resource_type_id;
  employee_json := jsonb_build_object(
    'employee_number', 'QA TEST ARCHIVE-' || suffix, 'first_name', 'QA TEST', 'last_name', 'Archive Employee',
    'date_hired', current_date, 'department_id', dept, 'position_id', pos, 'employment_type_id', emp_type,
    'employment_status_id', status_id, 'position_label', 'QA TEST Archive Position',
    'client_assignment_selected', true, 'client_assignment_start_date', current_date
  );
  v_employee_id := public.save_employee(null, employee_json, v_client_id);
  v_resource_id := public.save_resource(null, 'QA TEST ARCHIVE RESOURCE-' || suffix, resource_type_id, null, null, 'AVAILABLE');
  perform public.assign_resource(v_resource_id, v_employee_id);
  select count(*) into active_before from public.employees e where not e.is_archived and e.employment_status_id in (select id from public.employment_statuses where is_employed);
  perform public.archive_employee(v_employee_id);
  select count(*) into active_after from public.employees e where not e.is_archived and e.employment_status_id in (select id from public.employment_statuses where is_employed);

  if active_before - active_after <> 1 then raise exception 'Archived employee remained in active headcount'; end if;
  if not exists(select 1 from public.employees where id = v_employee_id and is_archived and employment_status_id = status_id) then raise exception 'Archive changed employment status or lost employee'; end if;
  if not exists(select 1 from public.employee_client_assignments where employee_client_assignments.employee_id = v_employee_id and client_id = v_client_id and end_date is null) then raise exception 'Archive closed the client history unexpectedly'; end if;
  if (select count(*) from public.employee_client_assignments a join public.employees e on e.id = a.employee_id join public.employment_statuses s on s.id = e.employment_status_id where a.client_id = v_client_id and a.end_date is null and not e.is_archived and s.is_employed) <> 0 then raise exception 'Archived employee inflated current client allocation'; end if;
  if not exists(select 1 from public.resource_assignments where resource_assignments.resource_id = v_resource_id and resource_assignments.employee_id = v_employee_id and released_at is null) then raise exception 'Archive released the resource unexpectedly'; end if;
  if not exists(select 1 from public.resources where id = v_resource_id and status = 'ASSIGNED') then raise exception 'Archived employee resource was counted as available'; end if;
  if not exists(select 1 from public.employees where id = v_employee_id) then raise exception 'Archived profile is not historically accessible'; end if;
end $$;
rollback;
select 'PASS: archive hid employee from active headcount/client allocations while retaining open client/resource relationships; no rows persisted.' as result;
