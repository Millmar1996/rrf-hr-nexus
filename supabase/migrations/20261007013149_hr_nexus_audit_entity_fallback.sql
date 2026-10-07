-- Audit access requests by their user_id primary key (these rows do not have id).
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
  row_id := coalesce(
    nullif(new_row->>'id', '')::uuid,
    nullif(old_row->>'id', '')::uuid,
    nullif(new_row->>'user_id', '')::uuid,
    nullif(old_row->>'user_id', '')::uuid
  );
  action_name := lower(replace(tg_table_name, '_', '.')) || case tg_op when 'INSERT' then '.created' when 'DELETE' then '.deleted' else '.updated' end;
  insert into public.audit_logs(user_id, action, entity_type, entity_id, old_data, new_data)
  values ((select auth.uid()), action_name, tg_table_name, row_id,
    case when old_row is null then null else old_row - 'created_by' - 'updated_by' - 'uploaded_by' end,
    case when new_row is null then null else new_row - 'created_by' - 'updated_by' - 'uploaded_by' end);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke execute on function private.audit_business_row() from public, anon, authenticated;
