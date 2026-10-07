-- Fictional branch demo data. Safe to re-run after the foundation migration.
insert into public.departments (name) values
  ('Accounting'), ('Client Services'), ('Human Resources'), ('Information Technology'), ('Operations')
on conflict (name) do nothing;

insert into public.positions (name, department_id)
select seed.name, d.id from (values
  ('Accountant', 'Accounting'), ('Junior Accountant', 'Accounting'), ('Senior Accountant', 'Accounting'),
  ('Client Support Associate', 'Client Services'), ('Client Services Lead', 'Client Services'),
  ('HR Assistant', 'Human Resources'), ('HR Administrator', 'Human Resources'),
  ('IT Support Specialist', 'Information Technology'), ('Systems Analyst', 'Information Technology'),
  ('Operations Analyst', 'Operations'), ('Operations Coordinator', 'Operations')
) as seed(name, department_name)
join public.departments d on d.name = seed.department_name
on conflict (department_id, name) do nothing;

insert into public.employment_types (name) values ('Regular'), ('Probationary'), ('Contractual'), ('Project Based')
on conflict (name) do nothing;
insert into public.employment_statuses (name, is_employed) values
  ('Active', true), ('Probationary', true), ('On Leave', true), ('Separated', false)
on conflict (name) do nothing;
insert into public.clients (name) values
  ('Northstar Retail'), ('Pacific Ledger Co.'), ('Summit Health Group'), ('Internal – Tuguegarao'), ('Cedarline Logistics')
on conflict (name) do nothing;
insert into public.locations (name, address) values
  ('Tuguegarao City', 'Fictional demo location'), ('Tuguegarao · Floor 2', 'Fictional demo office floor')
on conflict (name) do nothing;
insert into public.resource_types (name) values ('Seat / Workstation'), ('Computer'), ('Other Equipment')
on conflict (name) do nothing;
insert into public.document_types (name, category, is_required, supports_expiry) values
  ('Personal Information Sheet', 'Personal', true, false),
  ('Government ID', 'Government', true, true),
  ('Employment Contract', 'Employment', true, false),
  ('NBI Clearance', 'Clearance', true, true),
  ('Medical Certificate', 'Medical', true, true),
  ('Certificates', 'Training', false, false),
  ('Other Employee Documents', 'Other', false, false)
on conflict (name) do nothing;

with demo(employee_number, first_name, middle_name, last_name, department_name, position_name, employment_type, employment_status, hired_on, regularizes_on, client_name, email) as (values
  ('RR-02401','Maria','Luz','Santos','Accounting','Senior Accountant','Regular','Active','2024-10-02','2025-04-02','Northstar Retail','maria.santos@rrfmg.example'),
  ('RR-02402','Juan','Miguel','Dela Cruz','Client Services','Client Support Associate','Probationary','Probationary','2026-09-25','2027-03-25','Pacific Ledger Co.','juan.delacruz@rrfmg.example'),
  ('RR-02403','Angela','Mae','Reyes','Human Resources','HR Assistant','Regular','Active','2025-11-01','2026-05-01','Internal – Tuguegarao','angela.reyes@rrfmg.example'),
  ('RR-02404','Carlo','Jose','Mendoza','Information Technology','IT Support Specialist','Regular','Active','2025-02-12','2025-08-12','Internal – Tuguegarao','carlo.mendoza@rrfmg.example'),
  ('RR-02405','Patricia','Anne','Garcia','Operations','Operations Analyst','Regular','Active','2025-08-19','2026-02-19','Northstar Retail','patricia.garcia@rrfmg.example'),
  ('RR-02406','Mark','Luis','Villanueva','Accounting','Junior Accountant','Regular','On Leave','2024-12-03','2025-06-03','Cedarline Logistics','mark.villanueva@rrfmg.example'),
  ('RR-02407','Beatriz','','Aquino','Client Services','Client Services Lead','Regular','Active','2024-08-22','2025-02-22','Summit Health Group','beatriz.aquino@rrfmg.example'),
  ('RR-02408','Rafael','','Bautista','Human Resources','HR Administrator','Contractual','Active','2025-03-14','2025-09-14','Internal – Tuguegarao','rafael.bautista@rrfmg.example'),
  ('RR-02409','Camille','Joy','Navarro','Information Technology','Systems Analyst','Regular','Active','2025-01-16','2025-07-16','Internal – Tuguegarao','camille.navarro@rrfmg.example'),
  ('RR-02410','Daniel','','Castillo','Operations','Operations Coordinator','Regular','Active','2024-07-20','2025-01-20','Cedarline Logistics','daniel.castillo@rrfmg.example'),
  ('RR-02411','Nicole','Marie','Rivera','Accounting','Accountant','Regular','Active','2023-09-10','2024-03-10','Pacific Ledger Co.','nicole.rivera@rrfmg.example'),
  ('RR-02412','Paolo','','Fernandez','Client Services','Client Support Associate','Probationary','Probationary','2026-08-20','2027-02-20','Summit Health Group','paolo.fernandez@rrfmg.example'),
  ('RR-02413','Jasmine','','Gonzales','Human Resources','HR Assistant','Probationary','Probationary','2026-06-17','2026-12-17','Internal – Tuguegarao','jasmine.gonzales@rrfmg.example'),
  ('RR-02414','Miguel','Angelo','Torres','Information Technology','IT Support Specialist','Regular','Active','2024-03-11','2024-09-11','Northstar Retail','miguel.torres@rrfmg.example'),
  ('RR-02415','Andrea','','Flores','Operations','Operations Analyst','Regular','Active','2024-12-03','2025-06-03','Cedarline Logistics','andrea.flores@rrfmg.example'),
  ('RR-02416','Gabriel','','Ramos','Accounting','Senior Accountant','Regular','Active','2023-04-04','2023-10-04','Pacific Ledger Co.','gabriel.ramos@rrfmg.example'),
  ('RR-02417','Sofia','','Aquino','Client Services','Client Support Associate','Regular','Active','2024-01-09','2024-07-09','Summit Health Group','sofia.aquino@rrfmg.example'),
  ('RR-02418','Kevin','','Perez','Human Resources','HR Assistant','Regular','Active','2024-05-18','2024-11-18','Internal – Tuguegarao','kevin.perez@rrfmg.example'),
  ('RR-02419','Trisha','','Lim','Information Technology','Systems Analyst','Probationary','Probationary','2026-07-11','2027-01-11','Internal – Tuguegarao','trisha.lim@rrfmg.example'),
  ('RR-02420','Nathan','','Cruz','Operations','Operations Coordinator','Regular','Active','2023-10-05','2024-04-05','Northstar Retail','nathan.cruz@rrfmg.example')
)
insert into public.employees (
  employee_number, first_name, middle_name, last_name, email, date_hired, regularization_date,
  department_id, position_id, employment_type_id, employment_status_id, work_location_id
)
select demo.employee_number, demo.first_name, nullif(demo.middle_name, ''), demo.last_name,
       demo.email, demo.hired_on::date, demo.regularizes_on::date,
       d.id, p.id, et.id, es.id, l.id
from demo
join public.departments d on d.name = demo.department_name
join public.positions p on p.name = demo.position_name and p.department_id = d.id
join public.employment_types et on et.name = demo.employment_type
join public.employment_statuses es on es.name = demo.employment_status
join public.locations l on l.name = 'Tuguegarao City'
on conflict (employee_number) do nothing;

insert into public.employee_client_assignments(employee_id, client_id, start_date)
select e.id, c.id, e.date_hired
from (values
  ('RR-02401','Northstar Retail'), ('RR-02402','Pacific Ledger Co.'), ('RR-02403','Internal – Tuguegarao'),
  ('RR-02404','Internal – Tuguegarao'), ('RR-02405','Northstar Retail'), ('RR-02406','Cedarline Logistics'),
  ('RR-02407','Summit Health Group'), ('RR-02408','Internal – Tuguegarao'), ('RR-02409','Internal – Tuguegarao'),
  ('RR-02410','Cedarline Logistics'), ('RR-02411','Pacific Ledger Co.'), ('RR-02412','Summit Health Group'),
  ('RR-02413','Internal – Tuguegarao'), ('RR-02414','Northstar Retail'), ('RR-02415','Cedarline Logistics'),
  ('RR-02416','Pacific Ledger Co.'), ('RR-02417','Summit Health Group'), ('RR-02418','Internal – Tuguegarao'),
  ('RR-02419','Internal – Tuguegarao'), ('RR-02420','Northstar Retail')
) as assignment(employee_number, client_name)
join public.employees e on e.employee_number = assignment.employee_number
join public.clients c on c.name = assignment.client_name
on conflict do nothing;

insert into public.employee_lifecycle_events(employee_id, event_type, effective_date, previous_data, new_data, notes)
select e.id, 'HIRE', e.date_hired, '{}'::jsonb, jsonb_build_object('position_id', e.position_id), 'Fictional demo hire record'
from public.employees e
where not exists (select 1 from public.employee_lifecycle_events x where x.employee_id = e.id and x.event_type = 'HIRE');

insert into public.employee_lifecycle_events(employee_id, event_type, effective_date, previous_data, new_data, notes)
select e.id, 'PROMOTION', date '2026-10-06', jsonb_build_object('position', 'Junior Accountant'),
       jsonb_build_object('position', 'Senior Accountant'), 'Fictional demo promotion activity'
from public.employees e where e.employee_number = 'RR-02401'
and not exists (select 1 from public.employee_lifecycle_events x where x.employee_id = e.id and x.event_type = 'PROMOTION' and x.effective_date = date '2026-10-06');

insert into public.employee_lifecycle_events(employee_id, event_type, effective_date, previous_data, new_data, notes)
select e.id, 'REGULARIZATION', date '2026-10-04', jsonb_build_object('employment_type', 'Probationary'),
       jsonb_build_object('employment_type', 'Regular'), 'Fictional demo regularization activity'
from public.employees e where e.employee_number = 'RR-02403'
and not exists (select 1 from public.employee_lifecycle_events x where x.employee_id = e.id and x.event_type = 'REGULARIZATION' and x.effective_date = date '2026-10-04');

insert into public.resources(resource_code, resource_type_id, description, location_id, status)
select case when n <= 16 then 'TG-WS-' || lpad(n::text, 2, '0')
            when n <= 22 then 'TG-LT-' || lpad((n - 16)::text, 2, '0')
            else 'TG-MON-' || lpad((n - 22)::text, 2, '0') end,
       rt.id,
       case when n <= 16 then 'Workstation ' || n when n <= 22 then 'Laptop ' || (n - 16) else 'Monitor ' || (n - 22) end,
       l.id,
       case when n <= 14 then 'ASSIGNED'::public.resource_status
            when n = 22 then 'MAINTENANCE'::public.resource_status
            else 'AVAILABLE'::public.resource_status end
from generate_series(1, 24) as n
join public.resource_types rt on rt.name = case when n <= 16 then 'Seat / Workstation' when n <= 22 then 'Computer' else 'Other Equipment' end
join public.locations l on l.name = 'Tuguegarao · Floor 2'
on conflict (resource_code) do nothing;

insert into public.resource_assignments(resource_id, employee_id, assigned_at, notes)
select r.id, e.id, now() - interval '90 days', 'Fictional demo assignment'
from generate_series(1, 14) as n
join public.resources r on r.resource_code = 'TG-WS-' || lpad(n::text, 2, '0')
join public.employees e on e.employee_number = 'RR-' || lpad((2400 + n)::text, 5, '0')
where not exists (select 1 from public.resource_assignments a where a.resource_id = r.id and a.released_at is null);
