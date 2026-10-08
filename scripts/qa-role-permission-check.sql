-- Production-safe role check. All profile changes, audit writes, and the
-- temporary Settings insert are rolled back at the end of this transaction.
begin;
select set_config('app.hr_qa_actor', (select id::text from public.profiles where role = 'ADMIN' and is_active order by created_at limit 1), true);
select set_config('request.jwt.claim.sub', current_setting('app.hr_qa_actor'), true);
do $$ begin
  if nullif(current_setting('app.hr_qa_actor', true), '') is null then raise exception 'No active Admin profile is available'; end if;
end $$;

update public.profiles set role = 'VIEWER' where id = current_setting('app.hr_qa_actor')::uuid;
set local role authenticated;
do $$
declare call_sql text;
begin
  if not private.has_active_profile() or private.can_manage_hr_records() or private.can_manage_settings() then raise exception 'Viewer role guard assertion failed'; end if;
  perform count(*) from public.employees;
  foreach call_sql in array array[
    'select public.save_employee(null, ''{}''::jsonb, null)',
    'select public.archive_employee(''00000000-0000-0000-0000-000000000001''::uuid)',
    'select public.record_lifecycle_event(''00000000-0000-0000-0000-000000000001''::uuid, ''PROMOTION''::public.lifecycle_event_type, current_date, ''{}''::jsonb, ''{}''::jsonb, null)',
    'select public.save_resource(null, ''QA TEST ROLE'', ''00000000-0000-0000-0000-000000000001''::uuid, null, null, ''AVAILABLE''::public.resource_status)',
    'select public.assign_resource(''00000000-0000-0000-0000-000000000001''::uuid, null)',
    'select public.assign_employee_resources(''00000000-0000-0000-0000-000000000001''::uuid, array[]::uuid[])',
    'select public.verify_employee_document(''00000000-0000-0000-0000-000000000001''::uuid)',
    'select public.set_employee_document_review_status(''00000000-0000-0000-0000-000000000001''::uuid, ''PENDING'')',
    'select public.set_document_not_applicable(''00000000-0000-0000-0000-000000000001''::uuid, ''00000000-0000-0000-0000-000000000001''::uuid, null, false)',
    'select public.set_resource_condition(''00000000-0000-0000-0000-000000000001''::uuid, null, null)',
    'select public.approve_access_request(''00000000-0000-0000-0000-000000000001''::uuid, ''HR_STAFF''::public.app_role, ''Tuguegarao Branch'')',
    'select public.reject_access_request(''00000000-0000-0000-0000-000000000001''::uuid)',
    'select public.bootstrap_initial_admin(''not-a-bootstrap-secret'')'
  ] loop
    begin execute call_sql; raise exception 'Viewer unexpectedly executed %', call_sql;
    exception when insufficient_privilege then null; end;
  end loop;
  begin insert into public.departments(name) values ('QA ROLE DENIAL MUST ROLLBACK'); raise exception 'Viewer modified Settings';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

update public.profiles set role = 'HR_STAFF' where id = current_setting('app.hr_qa_actor')::uuid;
set local role authenticated;
do $$ begin
  if not private.can_manage_hr_records() or private.can_manage_settings() then raise exception 'HR Staff role guard assertion failed'; end if;
  begin perform public.save_employee(null, '{}'::jsonb, null); raise exception 'HR Staff save passed validation unexpectedly';
  exception when sqlstate '22023' then null; end;
  begin perform public.verify_employee_document('00000000-0000-0000-0000-000000000001'::uuid); raise exception 'HR Staff verified documents';
  exception when insufficient_privilege then null; end;
  begin perform public.approve_access_request('00000000-0000-0000-0000-000000000001'::uuid, 'HR_STAFF', 'Tuguegarao Branch'); raise exception 'HR Staff approved access';
  exception when insufficient_privilege then null; end;
  begin insert into public.departments(name) values ('QA ROLE DENIAL MUST ROLLBACK'); raise exception 'HR Staff modified Settings';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

update public.profiles set role = 'HR_MANAGER' where id = current_setting('app.hr_qa_actor')::uuid;
set local role authenticated;
do $$ begin
  if not private.can_manage_hr_records() or private.can_manage_settings() then raise exception 'HR Manager role guard assertion failed'; end if;
  begin perform public.save_employee(null, '{}'::jsonb, null); raise exception 'HR Manager save passed validation unexpectedly';
  exception when sqlstate '22023' then null; end;
  begin perform public.verify_employee_document('00000000-0000-0000-0000-000000000001'::uuid); raise exception 'HR Manager document check did not reach record validation';
  exception when sqlstate 'P0002' then null; end;
  begin perform public.approve_access_request('00000000-0000-0000-0000-000000000001'::uuid, 'HR_STAFF', 'Tuguegarao Branch'); raise exception 'HR Manager approved access';
  exception when insufficient_privilege then null; end;
  begin insert into public.departments(name) values ('QA ROLE DENIAL MUST ROLLBACK'); raise exception 'HR Manager modified Settings';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

update public.profiles set role = 'ADMIN' where id = current_setting('app.hr_qa_actor')::uuid;
set local role authenticated;
do $$
declare temporary_name text := 'QA ROLE ROLLBACK ' || md5(clock_timestamp()::text || random()::text);
begin
  if not private.can_manage_hr_records() or not private.can_manage_settings() then raise exception 'Admin role guard assertion failed'; end if;
  begin perform public.save_employee(null, '{}'::jsonb, null); raise exception 'Admin save passed validation unexpectedly';
  exception when sqlstate '22023' then null; end;
  insert into public.departments(name) values (temporary_name);
  if not exists(select 1 from public.departments where name = temporary_name) then raise exception 'Admin Settings write unavailable'; end if;
end $$;
reset role;
rollback;
select 'PASS: Viewer denial; HR Staff operational limits; HR Manager limits; Admin access; transaction rolled back.' as result;
