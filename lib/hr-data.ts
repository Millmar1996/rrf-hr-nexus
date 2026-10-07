import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "./supabase/database.types";
import type { AppData, Employee, LifecycleEvent, Resource } from "./types";

type Client = SupabaseClient<Database>;
type Ref = { id: string; name: string; is_active: boolean };
export type DocumentType = Ref & { category: string; description: string | null; is_required: boolean; supports_expiry: boolean };
export type EmployeeDocument = { id: string; employee_id: string; document_type_id: string; original_filename: string; mime_type: string | null; file_size: number | null; issue_date: string | null; expiry_date: string | null; notes: string | null; uploaded_at: string; file_path: string; type_name: string };
export type ClientAssignment = { id: string; employee_id: string; client_id: string; client_name: string; start_date: string; end_date: string | null; notes: string | null };
export type ResourceAssignment = { id: string; resource_id: string; employee_id: string; assigned_at: string; released_at: string | null; notes: string | null };
export type AuditEntry = { id: string; action: string; entity_type: string; entity_id: string | null; created_at: string; old_data: Json | null; new_data: Json | null; actor_name: string };
export type AccessRequest = { user_id: string; email: string; requested_name: string; status: string; created_at: string };
export type UserProfile = { id: string; full_name: string; role: Database["public"]["Enums"]["app_role"]; branch: string; is_active: boolean };
export type WorkspaceReferences = { departments: Ref[]; positions: (Ref & { department_id: string | null })[]; employmentTypes: Ref[]; employmentStatuses: (Ref & { is_employed: boolean })[]; clients: Ref[]; locations: Ref[]; documentTypes: DocumentType[]; resourceTypes: Ref[] };
export type WorkspaceData = AppData & { references: WorkspaceReferences; documents: EmployeeDocument[]; clientAssignments: ClientAssignment[]; resourceAssignments: ResourceAssignment[]; audit: AuditEntry[]; accessRequests: AccessRequest[]; profiles: UserProfile[]; error: string | null };

const emptyReferences: WorkspaceReferences = { departments: [], positions: [], employmentTypes: [], employmentStatuses: [], clients: [], locations: [], documentTypes: [], resourceTypes: [] };
const valueName = (value: string | null | undefined) => value ?? "";
const displayEvent = (value: string) => value.toLowerCase().split("_").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");

export async function loadWorkspace(client: Client): Promise<WorkspaceData> {
  const [employeesResult, eventsResult, resourcesResult, departmentsResult, positionsResult, typesResult, statusesResult, clientsResult, locationsResult, documentTypesResult, resourceTypesResult, assignmentsResult, resourceAssignmentsResult, documentsResult, auditResult, accessRequestsResult, profilesResult] = await Promise.all([
    client.from("employees").select("*").order("last_name"),
    client.from("employee_lifecycle_events").select("*,profiles(full_name)").order("effective_date", { ascending: false }).limit(250),
    client.from("resources").select("*").order("resource_code"),
    client.from("departments").select("id,name,is_active").order("name"),
    client.from("positions").select("id,name,is_active,department_id").order("name"),
    client.from("employment_types").select("id,name,is_active").order("name"),
    client.from("employment_statuses").select("id,name,is_active,is_employed").order("name"),
    client.from("clients").select("id,name,is_active").order("name"),
    client.from("locations").select("id,name,is_active").order("name"),
    client.from("document_types").select("id,name,is_active,category,description,is_required,supports_expiry").order("name"),
    client.from("resource_types").select("id,name,is_active").order("name"),
    client.from("employee_client_assignments").select("id,employee_id,client_id,start_date,end_date,notes,clients(name)").order("start_date", { ascending: false }),
    client.from("resource_assignments").select("id,resource_id,employee_id,assigned_at,released_at,notes").order("assigned_at", { ascending: false }),
    client.from("employee_documents").select("id,employee_id,document_type_id,original_filename,mime_type,file_size,issue_date,expiry_date,notes,uploaded_at,file_path,document_types(name)").order("uploaded_at", { ascending: false }),
    client.from("audit_logs").select("id,action,entity_type,entity_id,created_at,old_data,new_data,profiles(full_name)").order("created_at", { ascending: false }).limit(50),
    client.from("access_requests").select("user_id,email,requested_name,status,created_at").order("created_at", { ascending: false }).limit(100),
    client.from("profiles").select("id,full_name,role,branch,is_active").order("full_name"),
  ]);
  const firstError = [employeesResult, eventsResult, resourcesResult, departmentsResult, positionsResult, typesResult, statusesResult, clientsResult, locationsResult, documentTypesResult, resourceTypesResult, assignmentsResult, resourceAssignmentsResult, documentsResult, auditResult, accessRequestsResult, profilesResult].find((result) => result.error)?.error;
  if (firstError) throw new Error(firstError.message);

  const departments = departmentsResult.data ?? [];
  const positions = positionsResult.data ?? [];
  const employmentTypes = typesResult.data ?? [];
  const employmentStatuses = statusesResult.data ?? [];
  const clients = clientsResult.data ?? [];
  const locations = locationsResult.data ?? [];
  const activeAssignments = (assignmentsResult.data ?? []).filter((row) => !row.end_date);
  const clientByEmployee = new Map(activeAssignments.map((row) => [row.employee_id, row.clients?.name ?? ""]));
  const resourceAssignments = resourceAssignmentsResult.data ?? [];
  const activeResourceAssignments = resourceAssignments.filter((item) => !item.released_at);
  const employeeRows = employeesResult.data ?? [];
  const employees: Employee[] = employeeRows.map((row) => {
    const department = departments.find((item) => item.id === row.department_id)?.name ?? "";
    const manager = employeeRows.find((item) => item.id === row.supervisor_employee_id);
    const assignedResources = activeResourceAssignments.filter((item) => item.employee_id === row.id).map((item) => resourcesResult.data?.find((resource) => resource.id === item.resource_id)).filter(Boolean);
    return {
      id: row.id, employeeNumber: row.employee_number, firstName: row.first_name, middleName: valueName(row.middle_name), lastName: row.last_name,
      preferredName: valueName(row.preferred_name), email: valueName(row.email), phone: valueName(row.contact_number), birthday: valueName(row.birthday),
      hiredAt: row.date_hired, status: employmentStatuses.find((item) => item.id === row.employment_status_id)?.name as Employee["status"] ?? "Active",
      type: employmentTypes.find((item) => item.id === row.employment_type_id)?.name as Employee["type"] ?? "Regular", department,
      position: positions.find((item) => item.id === row.position_id)?.name ?? "", manager: manager ? [manager.first_name, manager.last_name].join(" ") : "",
      client: clientByEmployee.get(row.id) ?? "", location: locations.find((item) => item.id === row.work_location_id)?.name ?? "",
      regularizationDate: valueName(row.regularization_date), seat: assignedResources.map((item) => item?.resource_code).filter(Boolean).join(", "), device: "",
      archived: row.is_archived, createdAt: row.created_at, updatedAt: row.updated_at,
    };
  });
  const resources: Resource[] = (resourcesResult.data ?? []).map((row) => {
    const active = activeResourceAssignments.find((item) => item.resource_id === row.id);
    return { id: row.id, code: row.resource_code, type: (resourceTypesResult.data ?? []).find((item) => item.id === row.resource_type_id)?.name ?? "Other Equipment", assignedTo: active?.employee_id ?? "", location: locations.find((item) => item.id === row.location_id)?.name ?? "", status: row.status === "AVAILABLE" ? "Available" : row.status === "ASSIGNED" ? "Assigned" : row.status === "MAINTENANCE" ? "Maintenance" : "Inactive" };
  });
  const events: LifecycleEvent[] = (eventsResult.data ?? []).map((row) => {
    const previous = row.previous_data as Record<string, unknown>;
    const next = row.new_data as Record<string, unknown>;
    return { id: row.id, employeeId: row.employee_id, type: displayEvent(row.event_type), effectiveDate: row.effective_date, previousValue: String(previous.label ?? previous.value ?? previous.position ?? previous.department ?? previous.client ?? previous.employment_status ?? ""), newValue: String(next.label ?? next.value ?? next.position ?? next.department ?? next.client ?? next.employment_status ?? ""), notes: row.notes ?? "", recordedAt: row.created_at, recordedBy: row.profiles?.full_name ?? "HR team" };
  });
  return {
    employees, events, resources, error: null, accessRequests: accessRequestsResult.data ?? [], profiles: profilesResult.data ?? [], resourceAssignments,
    references: {
      departments, positions, employmentTypes, employmentStatuses, clients, locations,
      documentTypes: documentTypesResult.data ?? [], resourceTypes: resourceTypesResult.data ?? [],
    },
    documents: (documentsResult.data ?? []).map((row) => ({ id: row.id, employee_id: row.employee_id, document_type_id: row.document_type_id, original_filename: row.original_filename, mime_type: row.mime_type, file_size: row.file_size, issue_date: row.issue_date, expiry_date: row.expiry_date, notes: row.notes, uploaded_at: row.uploaded_at, file_path: row.file_path, type_name: row.document_types?.name ?? "Document" })),
    clientAssignments: (assignmentsResult.data ?? []).map((row) => ({ id: row.id, employee_id: row.employee_id, client_id: row.client_id, client_name: row.clients?.name ?? "", start_date: row.start_date, end_date: row.end_date, notes: row.notes })),
    audit: (auditResult.data ?? []).map((row) => ({ id: row.id, action: row.action, entity_type: row.entity_type, entity_id: row.entity_id, created_at: row.created_at, old_data: row.old_data, new_data: row.new_data, actor_name: row.profiles?.full_name ?? "System" })),
  };
}

export { emptyReferences };
