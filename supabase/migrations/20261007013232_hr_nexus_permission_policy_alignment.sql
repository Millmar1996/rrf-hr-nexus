-- Align document removal with HR_STAFF operational permissions and quiet redundant RLS policies.
create index if not exists access_requests_reviewed_by_idx on public.access_requests(reviewed_by);

drop policy if exists "Users view their own access request" on public.access_requests;
drop policy if exists "Admins review access requests" on public.access_requests;
create policy "Users and admins view access requests" on public.access_requests
  for select to authenticated
  using (user_id=(select auth.uid()) or (select private.has_role(array['ADMIN']::public.app_role[])));

drop policy if exists "Managers read audit log" on public.audit_logs;

drop policy if exists "HR managers delete document metadata" on public.employee_documents;
create policy "HR staff remove document metadata" on public.employee_documents
  for delete to authenticated using ((select private.can_manage_hr_records()));

drop policy if exists "Managers can remove private employee files" on storage.objects;
create policy "HR staff can remove private employee files" on storage.objects
  for delete to authenticated using (
    bucket_id='employee-documents' and (select private.can_manage_hr_records())
  );
