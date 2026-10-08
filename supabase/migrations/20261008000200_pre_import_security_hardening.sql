-- Tighten callable RPC grants and enforce active master values on write paths.
-- Browser HR operations continue to use authenticated RLS-scoped RPCs.

revoke execute on function public.save_employee(uuid, jsonb, uuid) from public, anon, service_role;
grant execute on function public.save_employee(uuid, jsonb, uuid) to authenticated;
revoke execute on function public.archive_employee(uuid) from public, anon, service_role;
grant execute on function public.archive_employee(uuid) to authenticated;
revoke execute on function public.record_lifecycle_event(uuid, public.lifecycle_event_type, date, jsonb, jsonb, text) from public, anon, service_role;
grant execute on function public.record_lifecycle_event(uuid, public.lifecycle_event_type, date, jsonb, jsonb, text) to authenticated;
revoke execute on function public.save_resource(uuid, text, uuid, uuid, text, public.resource_status) from public, anon, service_role;
grant execute on function public.save_resource(uuid, text, uuid, uuid, text, public.resource_status) to authenticated;
revoke execute on function public.assign_resource(uuid, uuid) from public, anon, service_role;
grant execute on function public.assign_resource(uuid, uuid) to authenticated;
revoke execute on function public.approve_access_request(uuid, public.app_role, text) from public, anon, service_role;
grant execute on function public.approve_access_request(uuid, public.app_role, text) to authenticated;
revoke execute on function public.reject_access_request(uuid) from public, anon, service_role;
grant execute on function public.reject_access_request(uuid) to authenticated;
revoke execute on function public.assign_employee_resources(uuid, uuid[]) from public, anon, service_role;
grant execute on function public.assign_employee_resources(uuid, uuid[]) to authenticated;
revoke execute on function public.verify_employee_document(uuid) from public, anon, service_role;
grant execute on function public.verify_employee_document(uuid) to authenticated;
revoke execute on function public.set_employee_document_review_status(uuid, text) from public, anon, service_role;
grant execute on function public.set_employee_document_review_status(uuid, text) to authenticated;
revoke execute on function public.set_document_not_applicable(uuid, uuid, text, boolean) from public, anon, service_role;
grant execute on function public.set_document_not_applicable(uuid, uuid, text, boolean) to authenticated;
revoke execute on function public.set_resource_condition(uuid, text, text) from public, anon, service_role;
grant execute on function public.set_resource_condition(uuid, text, text) to authenticated;

-- Initial account bootstrap is no longer part of the production login flow.
-- Keep it owner-only; it cannot be called by normal authenticated sessions.
revoke execute on function public.bootstrap_initial_admin(text) from public, anon, authenticated, service_role;

create or replace function public.save_resource(
  p_resource_id uuid,
  p_resource_code text,
  p_resource_type_id uuid,
  p_location_id uuid,
  p_description text,
  p_status public.resource_status
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target_id uuid;
  old_row public.resources%rowtype;
begin
  if actor is null or not private.can_manage_hr_records() then
    raise exception 'Not authorized to manage resources' using errcode = '42501';
  end if;

  if p_resource_id is null then
    if not exists(select 1 from public.resource_types t where t.id = p_resource_type_id and t.is_active) then
      raise exception 'Choose an active resource type' using errcode = '22023';
    end if;
    if p_location_id is not null and not exists(select 1 from public.locations l where l.id = p_location_id and l.is_active) then
      raise exception 'Choose an active location' using errcode = '22023';
    end if;
    insert into public.resources(resource_code, resource_type_id, location_id, description, status, created_by, updated_by)
    values (btrim(p_resource_code), p_resource_type_id, p_location_id, p_description,
      case when p_status = 'ASSIGNED' then 'AVAILABLE'::public.resource_status else p_status end, actor, actor)
    returning id into target_id;
  else
    select * into old_row from public.resources where id = p_resource_id for update;
    if not found then raise exception 'Resource was not found' using errcode = 'P0002'; end if;
    if old_row.resource_type_id is distinct from p_resource_type_id
      and not exists(select 1 from public.resource_types t where t.id = p_resource_type_id and t.is_active) then
      raise exception 'Choose an active resource type' using errcode = '22023';
    end if;
    if old_row.location_id is distinct from p_location_id and p_location_id is not null
      and not exists(select 1 from public.locations l where l.id = p_location_id and l.is_active) then
      raise exception 'Choose an active location' using errcode = '22023';
    end if;
    update public.resources set
      resource_code = btrim(p_resource_code), resource_type_id = p_resource_type_id,
      location_id = p_location_id, description = p_description,
      status = case when exists(select 1 from public.resource_assignments where resource_id = p_resource_id and released_at is null)
        then 'ASSIGNED'::public.resource_status else p_status end,
      updated_by = actor
    where id = p_resource_id
    returning id into target_id;
  end if;
  return target_id;
end;
$$;
revoke execute on function public.save_resource(uuid, text, uuid, uuid, text, public.resource_status) from public, anon, service_role;
grant execute on function public.save_resource(uuid, text, uuid, uuid, text, public.resource_status) to authenticated;

create or replace function private.require_active_document_type()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' or new.document_type_id is distinct from old.document_type_id)
    and not exists(select 1 from public.document_types d where d.id = new.document_type_id and d.is_active) then
    raise exception 'Choose an active document requirement' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke execute on function private.require_active_document_type() from public, anon, authenticated;
drop trigger if exists employee_documents_require_active_type on public.employee_documents;
create trigger employee_documents_require_active_type
  before insert or update of document_type_id on public.employee_documents
  for each row execute function private.require_active_document_type();
