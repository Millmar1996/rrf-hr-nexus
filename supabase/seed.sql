-- Non-company-specific reference defaults only. Deliberately contains no
-- employees, departments, positions, clients, document checklist, or inventory.
-- Import those values only from approved RRFMG source files.

insert into public.employment_types (name) values
  ('Full-time'), ('Part-time'), ('Contractual'), ('Project-based'), ('Intern / Trainee')
on conflict (name) do nothing;

insert into public.employment_statuses (name, is_employed) values
  ('Active', true), ('Probationary', true), ('Regular', true),
  ('On Leave', true), ('Separated', false), ('Inactive', false)
on conflict (name) do nothing;

insert into public.locations (name, code) values ('Tuguegarao', 'TUG')
on conflict (name) do nothing;

insert into public.resource_types (name) values
  ('Workstation / Seat'), ('Desktop Computer'), ('Laptop'), ('Monitor'), ('Headset'), ('Other Equipment')
on conflict (name) do nothing;

insert into public.document_types (name, category, description, is_required, supports_expiry, is_active, display_order)
values ('Development sample — replace from approved RRFMG list', 'Development only',
  'Not an approved company requirement. Replace using 201 List of Requirements.xlsx.', false, false, false, 0)
on conflict (name) do nothing;

insert into public.separation_types (name) values
  ('Resignation'), ('Termination'), ('End of Contract'), ('Retirement'), ('Redundancy'), ('Other')
on conflict (name) do nothing;
