-- Server-side master-data checks using temporary QA-only rows. This script
-- must end in ROLLBACK; it creates no lasting employees or master values.
begin;
select set_config('app.hr_qa_actor', (select id::text from public.profiles where role = 'ADMIN' and is_active order by created_at limit 1), true);
select set_config('request.jwt.claim.sub', current_setting('app.hr_qa_actor'), true);
do $$
declare
  actor uuid := current_setting('app.hr_qa_actor')::uuid;
  suffix text := md5(clock_timestamp()::text || random()::text);
  dept uuid; pos uuid; emp_type uuid; inactive_status uuid; location_id uuid;
  client_id uuid; resource_type_id uuid; document_type_id uuid; separation_type_id uuid;
  active_status uuid; employee_id uuid; employee_json jsonb;
begin
  insert into public.departments(name, created_by) values ('QA TEST department ' || suffix, actor) returning id into dept;
  insert into public.positions(name, department_id, created_by) values ('QA TEST position ' || suffix, dept, actor) returning id into pos;
  insert into public.employment_types(name, created_by) values ('QA TEST employment type ' || suffix, actor) returning id into emp_type;
  insert into public.employment_statuses(name, is_employed, created_by) values ('QA TEST status ' || suffix, true, actor) returning id into inactive_status;
  insert into public.locations(name, created_by) values ('QA TEST location ' || suffix, actor) returning id into location_id;
  insert into public.clients(name, created_by) values ('QA TEST client ' || suffix, actor) returning id into client_id;
  insert into public.resource_types(name, created_by) values ('QA TEST resource type ' || suffix, actor) returning id into resource_type_id;
  insert into public.document_types(name, category, is_required, supports_expiry, display_order, created_by)
    values ('QA TEST document requirement ' || suffix, 'QA TEST', true, false, 999, actor) returning id into document_type_id;
  insert into public.separation_types(name, created_by) values ('QA TEST separation type ' || suffix, actor) returning id into separation_type_id;

  select id into active_status from public.employment_statuses where is_active order by name limit 1;
  if active_status is null then raise exception 'No active employment status exists for the control employee'; end if;
  employee_json := jsonb_build_object(
    'employee_number', 'QA TEST MASTER-' || suffix,
    'first_name', 'QA', 'last_name', 'Master Check', 'date_hired', current_date,
    'department_id', dept, 'position_id', pos, 'employment_type_id', emp_type,
    'employment_status_id', active_status, 'work_location_id', location_id,
    'position_label', 'QA TEST position', 'client_assignment_selected', false
  );
  employee_id := public.save_employee(null, employee_json, null);

  -- Toggle one QA value per subtransaction so the remaining baseline values stay active.
  employee_json := employee_json || jsonb_build_object('employee_number', 'QA TEST INACTIVE-DEPT-' || suffix);
  begin
    update public.departments set is_active = false where id = dept;
    perform public.save_employee(null, employee_json, null);
    raise exception 'Inactive department was accepted' using errcode = 'P0001';
  exception when sqlstate '22023' then null; end;

  employee_json := employee_json || jsonb_build_object('employee_number', 'QA TEST INACTIVE-POS-' || suffix);
  begin
    update public.positions set is_active = false where id = pos;
    perform public.save_employee(null, employee_json, null);
    raise exception 'Inactive position was accepted' using errcode = 'P0001';
  exception when sqlstate '22023' then null; end;

  employee_json := employee_json || jsonb_build_object('employee_number', 'QA TEST INACTIVE-TYPE-' || suffix);
  begin
    update public.employment_types set is_active = false where id = emp_type;
    perform public.save_employee(null, employee_json, null);
    raise exception 'Inactive employment type was accepted' using errcode = 'P0001';
  exception when sqlstate '22023' then null; end;

  employee_json := employee_json || jsonb_build_object('employee_number', 'QA TEST INACTIVE-STATUS-' || suffix, 'employment_status_id', inactive_status);
  begin
    update public.employment_statuses set is_active = false where id = inactive_status;
    perform public.save_employee(null, employee_json, null);
    raise exception 'Inactive employment status was accepted' using errcode = 'P0001';
  exception when sqlstate '22023' then null; end;

  employee_json := employee_json || jsonb_build_object('employee_number', 'QA TEST INACTIVE-LOCATION-' || suffix, 'employment_status_id', active_status, 'work_location_id', location_id);
  begin
    update public.locations set is_active = false where id = location_id;
    perform public.save_employee(null, employee_json, null);
    raise exception 'Inactive location was accepted' using errcode = 'P0001';
  exception when sqlstate '22023' then null; end;

  employee_json := employee_json || jsonb_build_object('employee_number', 'QA TEST INACTIVE-CLIENT-' || suffix, 'work_location_id', location_id);
  begin
    update public.clients set is_active = false where id = client_id;
    perform public.save_employee(null, employee_json, client_id);
    raise exception 'Inactive client was accepted' using errcode = 'P0001';
  exception when sqlstate '22023' then null; end;

  begin
    update public.resource_types set is_active = false where id = resource_type_id;
    perform public.save_resource(null, 'QA TEST RESOURCE ' || suffix, resource_type_id, null, null, 'AVAILABLE');
    raise exception 'Inactive resource type was accepted' using errcode = 'P0001';
  exception when sqlstate '22023' then null; end;

  begin
    update public.document_types set is_active = false where id = document_type_id;
    insert into public.employee_documents(employee_id, document_type_id, file_path, original_filename, uploaded_by)
    values(employee_id, document_type_id, 'qa-test/' || suffix, 'QA TEST placeholder.txt', actor);
    raise exception 'Inactive document requirement was accepted' using errcode = 'P0001';
  exception when sqlstate '22023' then null; end;

  begin
    update public.separation_types set is_active = false where id = separation_type_id;
    perform public.record_lifecycle_event(employee_id, 'SEPARATION', current_date, '{}'::jsonb,
      jsonb_build_object('separation_type_id', separation_type_id), null);
    raise exception 'Inactive separation type was accepted' using errcode = 'P0001';
  exception when sqlstate '22023' then null; end;
end $$;
rollback;
select 'PASS: inactive department, position, type, status, client, location, document requirement, resource type and separation type were rejected; transaction rolled back.' as result;
