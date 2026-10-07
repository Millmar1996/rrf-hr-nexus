import { createClient } from "@/lib/supabase/server";

export type MonthlyEmployee = {
  id: string; number: string; name: string; department: string; position: string;
  employmentType: string; status: string; hireDate: string; birthday: string | null;
  regularizationDate: string | null; client: string; location: string; archived: boolean;
};
export type MonthlyMovement = {
  id: string; employeeId: string; employeeNumber: string; employee: string;
  type: string; effectiveDate: string; department: string; position: string;
  previous: string; next: string; separationType: string;
};
export type MonthlyReport = {
  metadata: { month: number; year: number; label: string; periodStart: string; periodEnd: string; generatedAt: string; generatedBy: string; branch: string };
  workforce: { total: number; active: number; probationary: number; regular: number; onLeave: number; separated: number; hires: number; separations: number; employees: MonthlyEmployee[] };
  movements: { all: MonthlyMovement[]; hires: MonthlyMovement[]; regularizations: MonthlyMovement[]; promotions: MonthlyMovement[]; transfers: MonthlyMovement[]; departmentChanges: MonthlyMovement[]; locationTransfers: MonthlyMovement[]; clientReassignments: MonthlyMovement[]; separations: MonthlyMovement[] };
  assignments: { previousClient: string; newClient: string; employee: string; employeeNumber: string; effectiveDate: string }[];
  compliance: { required: number; compliant: number; withMissing: number; withExpiring: number; withExpired: number; completion: number; historical: boolean; rows: { employee: string; employeeNumber: string; completion: number; missing: string[]; expiring: string[]; expired: string[]; status: string }[] };
  expirations: { expired: { employee: string; employeeNumber: string; document: string; date: string }[]; upcoming: { employee: string; employeeNumber: string; document: string; date: string }[] };
  resources: { total: number; assigned: number; available: number; maintenance: number; inactive: number; workstationTotal: number; workstationOccupied: number; workstationAvailable: number; newAssignments: number; releases: number; reassignments: number; movements: { resource: string; type: string; employee: string; action: string; date: string }[]; historical: boolean };
  birthdays: { employee: string; department: string; date: string }[];
  anniversaries: { employee: string; department: string; hireDate: string; years: number }[];
  regularizationMonitoring: { completed: MonthlyMovement[]; dueNextMonth: { employee: string; department: string; hireDate: string; expectedDate: string }[]; overdue: { employee: string; department: string; hireDate: string; expectedDate: string }[] };
  comparison: { available: boolean; previousLabel: string; currentLabel: string; metrics: { label: string; previous: number; current: number; delta: number; suffix?: string }[]; note: string };
};

// Supabase joined-row shapes vary between object and array relations; narrow each
// relation at its point of use while keeping generated top-level rows typed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;
const fullName = (e: AnyRow) => [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(" ");
const titleCase = (value: string) => value.toLowerCase().split("_").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");
const json = (value: unknown): AnyRow => value && typeof value === "object" && !Array.isArray(value) ? value as AnyRow : {};
const safeError = () => new Error("Unable to generate the report. Please try again.");
const asDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
const monthLabel = (month: number, year: number) => new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: "Asia/Manila" }).format(new Date(Date.UTC(year, month - 1, 1, 12)));
const period = (month: number, year: number) => ({ start: `${year}-${String(month).padStart(2, "0")}-01`, end: `${year}-${String(month).padStart(2, "0")}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}` });
const within = (date: string, start: string, end: string) => date >= start && date <= end;
const priorMonth = (month: number, year: number) => month === 1 ? { month: 12, year: year - 1 } : { month: month - 1, year };

export async function generateMonthlyReport(month: number, year: number): Promise<MonthlyReport> {
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000 || year > 2100) throw safeError();
  try {
    const client = await createClient();
    const [auth, employeeResult, eventResult, clientAssignmentResult, documentResult, documentTypeResult, resourceResult, resourceAssignmentResult] = await Promise.all([
      client.auth.getUser(),
      client.from("employees").select("*").order("last_name"),
      client.from("employee_lifecycle_events").select("*").order("effective_date"),
      client.from("employee_client_assignments").select("id,employee_id,client_id,start_date,end_date,clients(name)").order("start_date"),
      client.from("employee_documents").select("id,employee_id,document_type_id,issue_date,expiry_date,uploaded_at,document_types(name,is_required,supports_expiry)"),
      client.from("document_types").select("id,name,is_required,is_active,supports_expiry").eq("is_active", true),
      client.from("resources").select("id,resource_code,status,resource_type_id,resource_types(name)"),
      client.from("resource_assignments").select("id,resource_id,employee_id,assigned_at,released_at").order("assigned_at"),
    ]);
    const failed = [employeeResult, eventResult, clientAssignmentResult, documentResult, documentTypeResult, resourceResult, resourceAssignmentResult].some((result) => result.error);
    if (failed || !auth.data.user) throw safeError();
    const profileResult = await client.from("profiles").select("full_name,branch").eq("id", auth.data.user.id).maybeSingle();
    if (profileResult.error) throw safeError();

    const employeesRaw = (employeeResult.data ?? []) as AnyRow[];
    const eventsRaw = (eventResult.data ?? []) as AnyRow[];
    const clientRows = (clientAssignmentResult.data ?? []) as AnyRow[];
    const employeesById = new Map(employeesRaw.map((e) => [e.id, e]));
    const clientName = (row: AnyRow) => (Array.isArray(row.clients) ? row.clients[0]?.name : row.clients?.name) ?? "";
    const assignments: AnyRow[] = clientRows.map((row: AnyRow): AnyRow => ({ ...row, client_name: clientName(row) }));
    const dateRange = period(month, year);
    const next = month === 12 ? { month: 1, year: year + 1 } : { month: month + 1, year };
    const nextRange = period(next.month, next.year);
    const prev = priorMonth(month, year);
    const prevRange = period(prev.month, prev.year);
    const nowManila = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
    const generatedAt = `${nowManila} Asia/Manila`;

    const currentEvents = eventsRaw.filter((e) => within(e.effective_date, dateRange.start, dateRange.end));
    const clientEventRows = currentEvents.filter((e) => e.event_type === "CLIENT_REASSIGNMENT");
    const assignmentsInPeriod = assignments.filter((a) => within(a.start_date, dateRange.start, dateRange.end));
    const clientReassignments = clientEventRows.map((event) => {
      const old = json(event.previous_data); const fresh = json(event.new_data); const employee = employeesById.get(event.employee_id);
      const matching = assignmentsInPeriod.find((a) => a.employee_id === event.employee_id && a.start_date === event.effective_date);
      const oldClient = String(old.client ?? old.client_name ?? "Previous client not recorded");
      const newClient = String(fresh.client ?? fresh.client_name ?? matching?.client_name ?? "New client not recorded");
      return { employee: employee ? fullName(employee) : "Archived employee", employeeNumber: employee?.employee_number ?? "", previousClient: oldClient, newClient, effectiveDate: event.effective_date };
    });
    for (const assignment of assignmentsInPeriod) {
      if (!clientReassignments.some((item) => item.employeeNumber === employeesById.get(assignment.employee_id)?.employee_number && item.effectiveDate === assignment.start_date)) {
        const prior = assignments.filter((a) => a.employee_id === assignment.employee_id && a.end_date === assignment.start_date).sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
        if (!prior) continue;
        const employee = employeesById.get(assignment.employee_id);
        clientReassignments.push({ employee: employee ? fullName(employee) : "Archived employee", employeeNumber: employee?.employee_number ?? "", previousClient: prior.client_name, newClient: assignment.client_name, effectiveDate: assignment.start_date });
      }
    }

    const movements: MonthlyMovement[] = currentEvents.map((event) => {
      const employee = employeesById.get(event.employee_id);
      const previous = json(event.previous_data); const fresh = json(event.new_data);
      const previousValue = String(previous.label ?? previous.value ?? previous.position ?? previous.department ?? previous.location ?? previous.client ?? previous.employment_status ?? previous.employment_type ?? "");
      const nextValue = String(fresh.label ?? fresh.value ?? fresh.position ?? fresh.department ?? fresh.location ?? fresh.client ?? fresh.employment_status ?? fresh.employment_type ?? "");
      return { id: event.id, employeeId: event.employee_id, employeeNumber: employee?.employee_number ?? "", employee: employee ? fullName(employee) : "Archived employee", type: titleCase(event.event_type), effectiveDate: event.effective_date, department: employee?.department_id ? "" : "", position: "", previous: previousValue, next: nextValue, separationType: String(fresh.separation_type ?? previous.separation_type ?? "") };
    }).map((movement) => {
      const employee = employeesById.get(movement.employeeId);
      return { ...movement, department: employee?.department_id ?? "", position: employee?.position_id ?? "" };
    });

    // Resolve reference labels in one pair of small queries for human-readable report rows.
    const [departmentResult, positionResult, typeResult, statusResult, locationResult] = await Promise.all([
      client.from("departments").select("id,name"), client.from("positions").select("id,name"),
      client.from("employment_types").select("id,name"), client.from("employment_statuses").select("id,name"), client.from("locations").select("id,name"),
    ]);
    if ([departmentResult, positionResult, typeResult, statusResult, locationResult].some((r) => r.error)) throw safeError();
    const names = (rows: AnyRow[] | null) => new Map((rows ?? []).map((row) => [row.id, row.name]));
    const departments = names(departmentResult.data); const positions = names(positionResult.data); const types = names(typeResult.data); const statuses = names(statusResult.data); const locations = names(locationResult.data);
    const fullEmployees: MonthlyEmployee[] = employeesRaw.map((e) => {
      const eventAssignment = assignments.filter((a) => a.employee_id === e.id && a.start_date <= dateRange.end && (!a.end_date || a.end_date > dateRange.end)).sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
      return { id: e.id, number: e.employee_number, name: fullName(e), department: departments.get(e.department_id) ?? "Unassigned", position: positions.get(e.position_id) ?? "Unassigned", employmentType: types.get(e.employment_type_id) ?? "Unknown", status: statuses.get(e.employment_status_id) ?? "Unknown", hireDate: e.date_hired, birthday: e.birthday, regularizationDate: e.regularization_date, client: eventAssignment ? eventAssignment.client_name : "Unassigned", location: locations.get(e.work_location_id) ?? "Unassigned", archived: Boolean(e.is_archived) };
    });

    const byEmployee = new Map(fullEmployees.map((e) => [e.id, e]));
    const hires = movements.filter((e) => e.type === "Hire");
    // Date hired is authoritative; lifecycle hire event is preferred when present.
    const hireIds = new Set(hires.map((e) => e.employeeId));
    for (const employee of fullEmployees) if (!hireIds.has(employee.id) && within(employee.hireDate, dateRange.start, dateRange.end)) {
      hires.push({ id: `hire-${employee.id}`, employeeId: employee.id, employeeNumber: employee.number, employee: employee.name, type: "Hire", effectiveDate: employee.hireDate, department: employee.department, position: employee.position, previous: "", next: "", separationType: "" });
    }
    const normalizeMovement = (list: MonthlyMovement[]) => list.map((item) => ({ ...item, department: byEmployee.get(item.employeeId)?.department ?? item.department, position: byEmployee.get(item.employeeId)?.position ?? item.position }));
    const normalized = normalizeMovement(movements);
    const normalizedHires = normalizeMovement(hires);
    const pick = (...types: string[]) => normalized.filter((event) => types.includes(event.type));
    const regularizations = pick("Regularization"); const promotions = pick("Promotion", "Position Change");
    const transfers = pick("Transfer", "Department Transfer", "Location Transfer");
    const departmentChanges = pick("Department Transfer"); const locationTransfers = pick("Location Transfer");
    const separations = pick("Separation");
    const monthlyMovements = { all: normalized, hires: normalizedHires, regularizations, promotions, transfers, departmentChanges, locationTransfers, clientReassignments: [], separations };

    const stateAtEnd = (employee: MonthlyEmployee) => {
      const later = eventsRaw.filter((e) => e.employee_id === employee.id && e.effective_date > dateRange.end).sort((a, b) => b.effective_date.localeCompare(a.effective_date));
      let status = employee.status; let type = employee.employmentType; let separated = status === "Separated" || employee.archived;
      for (const event of eventsRaw.filter((e) => e.employee_id === employee.id && e.effective_date <= dateRange.end).sort((a, b) => a.effective_date.localeCompare(b.effective_date))) {
        const fresh = json(event.new_data);
        if (event.event_type === "SEPARATION") { status = "Separated"; separated = true; }
        if (event.event_type === "REHIRE") { status = String(fresh.employment_status ?? "Active"); separated = false; }
        if (event.event_type === "STATUS_CHANGE") { status = String(fresh.employment_status ?? fresh.status ?? status); separated = status === "Separated"; }
        if (event.event_type === "REGULARIZATION") { type = String(fresh.employment_type ?? "Regular"); if (status === "Probationary") status = "Active"; }
      }
      for (const event of later) {
        const prior = json(event.previous_data);
        if (event.event_type === "SEPARATION") { status = String(prior.employment_status ?? "Active"); separated = false; }
        if (event.event_type === "REHIRE") { status = "Separated"; separated = true; }
        if (event.event_type === "STATUS_CHANGE") { status = String(prior.employment_status ?? prior.status ?? status); separated = status === "Separated"; }
        if (event.event_type === "REGULARIZATION") { type = String(prior.employment_type ?? "Probationary"); if (type === "Probationary") status = "Probationary"; }
      }
      return { status, type, separated };
    };
    const snapshot = fullEmployees.filter((employee) => employee.hireDate <= dateRange.end).map((employee) => ({ employee, state: stateAtEnd(employee) }));
    const workforceEmployees = snapshot.filter(({ state }) => !state.separated);
    const regular = workforceEmployees.filter(({ state }) => state.type.toLowerCase() === "regular").length;
    const probationary = workforceEmployees.filter(({ state }) => state.type.toLowerCase() === "probationary" || state.status.toLowerCase() === "probationary").length;
    const active = workforceEmployees.length;
    const onLeave = workforceEmployees.filter(({ state }) => state.status.toLowerCase() === "on leave").length;
    const separatedCount = snapshot.filter(({ state }) => state.separated).length;

    const requiredTypes = (documentTypeResult.data ?? []).filter((d) => d.is_required) as AnyRow[];
    const docs = (documentResult.data ?? []) as AnyRow[];
    const complianceRows = workforceEmployees.map(({ employee }) => {
      const missing: string[] = []; const expiring: string[] = []; const expired: string[] = [];
      for (const requirement of requiredTypes) {
        const document = docs.find((d) => d.employee_id === employee.id && d.document_type_id === requirement.id && asDate(d.uploaded_at) <= dateRange.end);
        if (!document) { missing.push(requirement.name); continue; }
        const expiryThreshold = new Date(`${dateRange.end}T12:00:00Z`); expiryThreshold.setUTCDate(expiryThreshold.getUTCDate() + 30);
        const expiringThrough = expiryThreshold.toISOString().slice(0, 10);
        if (document.expiry_date && document.expiry_date < dateRange.end) expired.push(requirement.name);
        else if (document.expiry_date && document.expiry_date <= expiringThrough) expiring.push(requirement.name);
      }
      const total = requiredTypes.length; const completion = total ? Math.round((total - missing.length - expiring.length - expired.length) / total * 100) : 100;
      const status = missing.length || expiring.length || expired.length ? "Needs Attention" : "Complete";
      return { employee: employee.name, employeeNumber: employee.number, completion, missing, expiring, expired, status };
    });
    const attention = complianceRows.filter((row) => row.status === "Needs Attention");
    const compliance = { required: workforceEmployees.length, compliant: complianceRows.filter((r) => r.status === "Complete").length, withMissing: attention.filter((r) => r.missing.length > 0).length, withExpiring: attention.filter((r) => r.expiring.length > 0).length, withExpired: attention.filter((r) => r.expired.length > 0).length, completion: complianceRows.length ? Math.round(complianceRows.reduce((sum, row) => sum + row.completion, 0) / complianceRows.length) : 100, historical: false, rows: attention };

    const documentNames = new Map(((documentTypeResult.data ?? []) as AnyRow[]).map((d) => [d.id, d.name]));
    const expiryRows = docs.flatMap((doc) => {
      const employee = byEmployee.get(doc.employee_id); if (!employee || !doc.expiry_date) return [];
      const value = { employee: employee.name, employeeNumber: employee.number, document: documentNames.get(doc.document_type_id) ?? "Document", date: doc.expiry_date };
      return [value];
    });
    const expiredDocuments = expiryRows.filter((d) => within(d.date, dateRange.start, dateRange.end));
    const upcomingDocuments = expiryRows.filter((d) => within(d.date, nextRange.start, nextRange.end));

    const rawResources = (resourceResult.data ?? []) as AnyRow[]; const resourceAssignments = (resourceAssignmentResult.data ?? []) as AnyRow[];
    const resourceMoves = resourceAssignments.flatMap((a) => {
      const employee = employeesById.get(a.employee_id); const resource = rawResources.find((r) => r.id === a.resource_id);
      const typeName = resource?.resource_types?.name ?? "Resource";
      const assignedDate = asDate(a.assigned_at);
      const items = [] as MonthlyReport["resources"]["movements"];
      if (within(assignedDate, dateRange.start, dateRange.end)) items.push({ resource: resource?.resource_code ?? "Resource", type: typeName, employee: employee ? fullName(employee) : "Archived employee", action: "Assigned", date: assignedDate });
      if (a.released_at && within(asDate(a.released_at), dateRange.start, dateRange.end)) items.push({ resource: resource?.resource_code ?? "Resource", type: typeName, employee: employee ? fullName(employee) : "Archived employee", action: "Released", date: asDate(a.released_at) });
      return items;
    });
    const resourceStatus = (r: AnyRow) => String(r.status).toUpperCase();
    const assigned = rawResources.filter((r) => resourceStatus(r) === "ASSIGNED").length; const available = rawResources.filter((r) => resourceStatus(r) === "AVAILABLE").length;
    const maintenance = rawResources.filter((r) => resourceStatus(r) === "MAINTENANCE").length; const inactive = rawResources.filter((r) => resourceStatus(r) === "INACTIVE").length;
    const workstations = rawResources.filter((r) => String(r.resource_types?.name ?? "").toLowerCase().includes("workstation") || String(r.resource_types?.name ?? "").toLowerCase().includes("seat"));
    const workstationOccupied = workstations.filter((r) => resourceStatus(r) === "ASSIGNED").length; const workstationAvailable = workstations.filter((r) => resourceStatus(r) === "AVAILABLE").length;
    const resourceReassignments = new Set(resourceAssignments.filter((a) => a.released_at && within(asDate(a.released_at), dateRange.start, dateRange.end) && resourceAssignments.some((newer) => newer.resource_id === a.resource_id && within(asDate(newer.assigned_at), dateRange.start, dateRange.end))).map((a) => a.resource_id)).size;
    const resourceData = { total: rawResources.length, assigned, available, maintenance, inactive, workstationTotal: workstations.length, workstationOccupied, workstationAvailable, newAssignments: resourceMoves.filter((m) => m.action === "Assigned").length, releases: resourceMoves.filter((m) => m.action === "Released").length, reassignments: resourceReassignments, movements: resourceMoves.sort((a, b) => a.date.localeCompare(b.date)), historical: false };

    const monthBirthdays = workforceEmployees.filter(({ employee }) => employee.birthday && employee.birthday.slice(5, 7) === String(month).padStart(2, "0")).map(({ employee }) => ({ employee: employee.name, department: employee.department, date: employee.birthday!.slice(5) })).sort((a, b) => a.date.localeCompare(b.date));
    const monthAnniversaries = workforceEmployees.filter(({ employee }) => employee.hireDate.slice(5, 7) === String(month).padStart(2, "0") && Number(employee.hireDate.slice(0, 4)) < year).map(({ employee }) => ({ employee: employee.name, department: employee.department, hireDate: employee.hireDate, years: year - Number(employee.hireDate.slice(0, 4)) })).sort((a, b) => a.hireDate.slice(5).localeCompare(b.hireDate.slice(5)));
    const dueNextMonth = workforceEmployees.flatMap(({ employee, state }) => (state.type.toLowerCase() === "probationary" || state.status.toLowerCase() === "probationary") && employee.regularizationDate && within(employee.regularizationDate, nextRange.start, nextRange.end) ? [{ employee: employee.name, department: employee.department, hireDate: employee.hireDate, expectedDate: employee.regularizationDate }] : []);
    const overdue = workforceEmployees.flatMap(({ employee, state }) => state.type.toLowerCase() === "probationary" && employee.regularizationDate && employee.regularizationDate <= dateRange.end ? [{ employee: employee.name, department: employee.department, hireDate: employee.hireDate, expectedDate: employee.regularizationDate }] : []);

    const workforceSummary = { total: snapshot.length, active, probationary, regular, onLeave, separated: separatedCount, hires: normalizedHires.length, separations: separations.length, employees: workforceEmployees.map((row) => row.employee) };
    const previousEmployees = fullEmployees.filter((employee) => employee.hireDate <= prevRange.end).map((employee) => ({ employee, state: stateAtBoundary(employee, prevRange.end, eventsRaw) })).filter(({ state }) => !state.separated);
    const prevRegular = previousEmployees.filter(({ state }) => state.type.toLowerCase() === "regular").length;
    const prevProbationary = previousEmployees.filter(({ state }) => state.type.toLowerCase() === "probationary" || state.status.toLowerCase() === "probationary").length;
    const currWorkforce = workforceEmployees;
    const priorComparisonAvailable = previousEmployees.length > 0 || workforceEmployees.length > 0;
    const comparison = { available: priorComparisonAvailable, previousLabel: monthLabel(prev.month, prev.year), currentLabel: monthLabel(month, year), metrics: priorComparisonAvailable ? [
      { label: "Headcount", previous: previousEmployees.length, current: currWorkforce.length, delta: currWorkforce.length - previousEmployees.length },
      { label: "Regular employees", previous: prevRegular, current: regular, delta: regular - prevRegular },
      { label: "Probationary", previous: prevProbationary, current: probationary, delta: probationary - prevProbationary },
    ] : [], note: "Headcount and employment type are reconstructed from hire dates and recorded lifecycle events. Resource inventory and 201 documents have no dated snapshots, so historical comparison values for those metrics are omitted." };
    const movementWithClient = { ...monthlyMovements, clientReassignments: clientReassignments.map((a, index) => ({ id: `client-${index}`, employeeId: "", employeeNumber: a.employeeNumber, employee: a.employee, type: "Client Reassignment", effectiveDate: a.effectiveDate, department: "", position: "", previous: a.previousClient, next: a.newClient, separationType: "" })) };

    return { metadata: { month, year, label: monthLabel(month, year), periodStart: dateRange.start, periodEnd: dateRange.end, generatedAt, generatedBy: profileResult.data?.full_name ?? "HR Administrator", branch: profileResult.data?.branch ?? "Tuguegarao Branch" }, workforce: workforceSummary, movements: movementWithClient, assignments: clientReassignments, compliance, expirations: { expired: expiredDocuments, upcoming: upcomingDocuments }, resources: resourceData, birthdays: monthBirthdays, anniversaries: monthAnniversaries, regularizationMonitoring: { completed: regularizations, dueNextMonth, overdue }, comparison };
  } catch {
    throw safeError();
  }
}

function stateAtBoundary(employee: MonthlyEmployee, boundary: string, events: AnyRow[]) {
  let status = employee.status; let type = employee.employmentType; let separated = status === "Separated" || employee.archived;
  for (const event of events.filter((e) => e.employee_id === employee.id && e.effective_date <= boundary).sort((a, b) => a.effective_date.localeCompare(b.effective_date))) {
    const fresh = json(event.new_data);
    if (event.event_type === "SEPARATION") { status = "Separated"; separated = true; }
    if (event.event_type === "REHIRE") { status = String(fresh.employment_status ?? "Active"); separated = false; }
    if (event.event_type === "STATUS_CHANGE") { status = String(fresh.employment_status ?? fresh.status ?? status); separated = status === "Separated"; }
    if (event.event_type === "REGULARIZATION") { type = String(fresh.employment_type ?? "Regular"); if (status === "Probationary") status = "Active"; }
  }
  for (const event of events.filter((e) => e.employee_id === employee.id && e.effective_date > boundary).sort((a, b) => b.effective_date.localeCompare(a.effective_date))) {
    const previous = json(event.previous_data);
    if (event.event_type === "SEPARATION") { status = String(previous.employment_status ?? "Active"); separated = false; }
    if (event.event_type === "REHIRE") { status = "Separated"; separated = true; }
    if (event.event_type === "STATUS_CHANGE") { status = String(previous.employment_status ?? previous.status ?? status); separated = status === "Separated"; }
    if (event.event_type === "REGULARIZATION") { type = String(previous.employment_type ?? "Probationary"); if (type === "Probationary") status = "Probationary"; }
  }
  return { status, type, separated };
}
