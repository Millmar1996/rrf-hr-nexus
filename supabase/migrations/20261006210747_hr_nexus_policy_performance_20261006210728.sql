-- Remove duplicate permissive SELECT policies and index the remaining actor FKs.

drop policy "Admins manage profiles" on public.profiles;
create policy "Admins insert profiles" on public.profiles for insert to authenticated
  with check ((select private.has_role(array['ADMIN']::public.app_role[])));
create policy "Admins update profiles" on public.profiles for update to authenticated
  using ((select private.has_role(array['ADMIN']::public.app_role[])))
  with check ((select private.has_role(array['ADMIN']::public.app_role[])));

do $$
declare t text;
begin
  foreach t in array array[
    'departments','positions','employment_types','employment_statuses',
    'clients','locations','document_types','resource_types'
  ] loop
    execute format('drop policy %I on public.%I', t || '_admin_write', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select private.can_manage_settings()))',
      t || '_admin_insert', t
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select private.can_manage_settings())) with check ((select private.can_manage_settings()))',
      t || '_admin_update', t
    );
  end loop;
end;
$$;

drop policy "HR staff manage resources" on public.resources;
create policy "HR staff insert resources" on public.resources for insert to authenticated
  with check ((select private.can_manage_hr_records()));
create policy "HR staff update resources" on public.resources for update to authenticated
  using ((select private.can_manage_hr_records()))
  with check ((select private.can_manage_hr_records()));

create index document_types_created_by_idx on public.document_types(created_by);
create index document_types_updated_by_idx on public.document_types(updated_by);
create index resources_created_by_idx on public.resources(created_by);
create index resources_updated_by_idx on public.resources(updated_by);
