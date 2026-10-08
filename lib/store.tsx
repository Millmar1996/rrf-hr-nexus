"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "./supabase/client";
import { usePathname } from "next/navigation";
import { emptyReferences, loadWorkspace, type WorkspaceData } from "./hr-data";
import type { Database } from "./supabase/database.types";
import type { Employee, LifecycleEvent, Resource } from "./types";
import { lifecycleStatusValue, statusCode } from "./hr-rules";

type Store = WorkspaceData & {
  ready: boolean;
  refresh: () => Promise<void>;
  clearError: () => void;
  saveEmployee: (employee: Omit<Employee, "id" | "createdAt" | "updatedAt"> & { id?: string }, resourceIds?: string[]) => Promise<void>;
  archiveEmployee: (id: string) => Promise<void>;
  recordEvent: (event: Omit<LifecycleEvent, "id" | "recordedAt" | "recordedBy">) => Promise<void>;
  assignResource: (resourceId: string, employeeId: string) => Promise<void>;
  updateResource: (resource: Resource) => Promise<void>;
  uploadDocument: (employeeId: string, documentTypeId: string, file: File, issueDate?: string, expiryDate?: string, notes?: string) => Promise<void>;
  verifyDocument: (id: string) => Promise<void>;
  setDocumentReviewStatus: (id: string, status: "PENDING" | "FOR_VERIFICATION") => Promise<void>;
  setDocumentApplicability: (employeeId: string, documentTypeId: string, reason: string, applicable: boolean) => Promise<void>;
  removeDocument: (id: string) => Promise<void>;
  openDocument: (path: string) => Promise<string>;
};
const blank: WorkspaceData = { employees: [], events: [], resources: [], references: emptyReferences, documents: [], documentExemptions: [], clientAssignments: [], resourceAssignments: [], audit: [], accessRequests: [], profiles: [], error: null };
const Context = createContext<Store | null>(null);

async function requireCurrentUserId() {
  const response = await fetch("/api/auth/user-id", { cache: "no-store" });
  const session = await response.json() as { user_id?: string };
  if (!response.ok || !session.user_id) throw new Error("Sign in to save HR records.");
  return session.user_id;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [data, setData] = useState<WorkspaceData>(blank);
  const [ready, setReady] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const result = await loadWorkspace(createClient());
      setData(result);
    } catch (error) {
      setData((old) => ({ ...old, error: error instanceof Error ? error.message : "Unable to load HR records." }));
    } finally { setReady(true); }
  }, []);
  useEffect(() => { if (pathname !== "/signin" && pathname !== "/signup") void refresh(); }, [pathname, refresh]);
  const run = useCallback(async (operation: () => Promise<void>) => {
    setData((old) => ({ ...old, error: null }));
    try { await operation(); await refresh(); }
    catch (error) { setData((old) => ({ ...old, error: error instanceof Error ? error.message : "The requested change could not be saved." })); throw error; }
  }, [refresh]);
  const value = useMemo<Store>(() => ({
    ...data, ready, refresh, clearError: () => setData((old) => ({ ...old, error: null })),
    saveEmployee: async (employee, resourceIds = []) => run(async () => {
      const client = createClient();
      await requireCurrentUserId();
      const department = data.references.departments.find((item) => item.name === employee.department);
      const position = data.references.positions.find((item) => item.name === employee.position && (!item.department_id || item.department_id === department?.id));
      const type = data.references.employmentTypes.find((item) => item.name === employee.type);
      const status = data.references.employmentStatuses.find((item) => item.name === employee.status);
      const clientRef = data.references.clients.find((item) => item.name === employee.client);
      const location = data.references.locations.find((item) => item.name === employee.location);
      const manager = data.employees.find((item) => item.id === employee.supervisorId) ?? data.employees.find((item) => `${[item.firstName, item.middleName, item.lastName].filter(Boolean).join(" ")} · ${item.employeeNumber}` === employee.manager || [item.firstName, item.lastName].join(" ") === employee.manager);
      if (!department || !position || !type || !status || (employee.client && !clientRef)) throw new Error("Choose valid department, position, employment, and client settings before saving.");
      if ((!department.is_active && data.employees.find((item) => item.id === employee.id)?.department !== department.name) || (!position.is_active && data.employees.find((item) => item.id === employee.id)?.position !== position.name) || (!type.is_active && data.employees.find((item) => item.id === employee.id)?.type !== type.name)) throw new Error("Inactive master values can only remain on existing employee records.");
      const rpcPayload = {
        employee_number: employee.employeeNumber.trim(), first_name: employee.firstName.trim(), middle_name: employee.middleName.trim() || null,
        last_name: employee.lastName.trim(), preferred_name: employee.preferredName.trim() || null, email: employee.email.trim() || null,
        contact_number: employee.phone.trim() || null, birthday: employee.birthday || null, date_hired: employee.hiredAt,
        regularization_date: employee.regularizationDate || null, department_id: department.id, position_id: position.id,
        employment_type_id: type.id, employment_status_id: status.id, supervisor_employee_id: manager?.id ?? null,
        work_location_id: location?.id ?? null, is_archived: false, position_label: employee.position,
        client_assignment_start_date: employee.clientAssignmentStartDate || null, client_assignment_selected: true,
      };
      const { data: savedId, error } = await client.rpc("save_employee", { p_employee_id: employee.id ?? null, p_employee: rpcPayload, p_client_id: clientRef?.id ?? null } as never);
      if (error) throw error;
      const employeeId = employee.id ?? savedId;
      if (!employeeId) throw new Error("Employee save did not return its record ID.");
      const previouslyAssigned = data.resources.some((resource) => resource.assignedTo === employeeId);
      const isEmployed = data.references.employmentStatuses.find((item) => item.name === employee.status)?.is_employed ?? false;
      if (isEmployed && (resourceIds.length > 0 || previouslyAssigned)) {
        const { error: resourceError } = await client.rpc("assign_employee_resources", { p_employee_id: employeeId, p_resource_ids: resourceIds } as never);
        if (resourceError) throw resourceError;
      }
    }),
    archiveEmployee: async (id) => run(async () => {
      const { error } = await createClient().rpc("archive_employee", { p_employee_id: id });
      if (error) throw error;
    }),
    recordEvent: async (event) => run(async () => {
      const client = createClient();
      const employee = data.employees.find((item) => item.id === event.employeeId);
      const next: Record<string, string> = { label: event.newValue };
      const type = event.type.toLowerCase();
      const previous = event.previousValue || (type.includes("promotion") || type.includes("position") ? employee?.position : type.includes("department") || type === "transfer" ? employee?.department : type.includes("client") ? employee?.client : type.includes("location") ? employee?.location : type.includes("status") || type === "regularization" ? employee?.status : "") || "";
      if (type.includes("promotion") || type.includes("position")) {
        const position = data.references.positions.find((item) => item.name === event.newValue);
        if (position) next.position_id = position.id;
      }
      if (type.includes("department") || type === "transfer") {
        const department = data.references.departments.find((item) => item.name === event.newValue);
        if (department) next.department_id = department.id;
      }
      if (type.includes("client") || type === "rehire") {
        const assignedClient = data.references.clients.find((item) => item.name === event.newValue);
        if (assignedClient) Object.assign(next, { client_id: assignedClient.id, client_name: assignedClient.name, label: assignedClient.name });
        else if (event.newValue.toLowerCase() === "unassigned") Object.assign(next, { client_name: "Unassigned", label: "Unassigned" });
      }
      if (type.includes("location")) {
        const location = data.references.locations.find((item) => item.name === event.newValue);
        if (location) next.work_location_id = location.id;
      }
      if (type.includes("status") || type === "leave started" || type === "returned from leave") {
        const status = data.references.employmentStatuses.find((item) => item.name === event.newValue);
        if (status) Object.assign(next, lifecycleStatusValue(status));
      }
      if (type === "regularization") {
        const regularStatus = data.references.employmentStatuses.find((item) => item.name.toLowerCase() === "regular" && item.is_active);
        if (!regularStatus) throw new Error("Configure an active Regular employment status before recording regularization.");
        Object.assign(next, lifecycleStatusValue(regularStatus));
      }
      if (type === "separation") {
        const separationType = data.references.separationTypes.find((item) => item.name === event.newValue);
        if (!separationType) throw new Error("Choose a separation type before recording separation.");
        Object.assign(next, { separation_type_id: separationType.id, separation_type_name: separationType.name, label: separationType.name });
      }
      const eventType: Record<string, Database["public"]["Enums"]["lifecycle_event_type"]> = {
        hire: "HIRE", onboarding: "ONBOARDING", regularization: "REGULARIZATION", promotion: "PROMOTION",
        "position change": "POSITION_CHANGE", "department transfer": "DEPARTMENT_TRANSFER", "location transfer": "LOCATION_TRANSFER",
        "client assignment": "CLIENT_ASSIGNMENT", "client reassignment": "CLIENT_REASSIGNMENT", "status change": "STATUS_CHANGE",
        "leave started": "LEAVE_START", "returned from leave": "LEAVE_RETURN", separation: "SEPARATION", rehire: "REHIRE", transfer: "TRANSFER",
      };
      const normalizedEventType = eventType[type];
      if (!normalizedEventType) throw new Error("Choose a supported lifecycle event type.");
      const previousData: Record<string, string> = { label: previous };
      if (type.includes("promotion") || type.includes("position")) {
        const value = data.references.positions.find((item) => item.name === previous);
        if (value) Object.assign(previousData, { position_id: value.id, position_name: value.name, label: value.name });
      }
      if (type.includes("department") || type === "transfer") {
        const value = data.references.departments.find((item) => item.name === previous);
        if (value) Object.assign(previousData, { department_id: value.id, department_name: value.name, label: value.name });
      }
      if (type.includes("client")) {
        const value = data.references.clients.find((item) => item.name === previous);
        if (value) Object.assign(previousData, { client_id: value.id, client_name: value.name, label: value.name });
      }
      if (type.includes("location")) {
        const value = data.references.locations.find((item) => item.name === previous);
        if (value) Object.assign(previousData, { work_location_id: value.id, location_name: value.name, label: value.name });
      }
      if (type.includes("status") || type === "regularization") {
        const value = data.references.employmentStatuses.find((item) => item.name === previous || item.name === employee?.status);
        if (value) Object.assign(previousData, { ...lifecycleStatusValue(value), status_code: statusCode(value.name) });
      }
      const { error } = await client.rpc("record_lifecycle_event", {
        p_employee_id: event.employeeId, p_event_type: normalizedEventType,
        p_effective_date: event.effectiveDate, p_previous_data: previousData, p_new_data: next, p_notes: event.notes || null,
      } as never);
      if (error) throw error;
    }),
    assignResource: async (resourceId, employeeId) => run(async () => {
      const { error } = await createClient().rpc("assign_resource", { p_resource_id: resourceId, p_employee_id: employeeId || null } as never);
      if (error) throw error;
    }),
    updateResource: async (resource) => run(async () => {
      const client = createClient();
      const type = data.references.resourceTypes.find((item) => item.name === resource.type);
      const location = data.references.locations.find((item) => item.name === resource.location);
      if (!type) throw new Error("Select a resource type from Settings.");
      const status = resource.status === "Available" ? "AVAILABLE" : resource.status === "Assigned" ? "ASSIGNED" : resource.status === "Reserved" ? "RESERVED" : resource.status === "Maintenance" ? "MAINTENANCE" : resource.status === "Retired" ? "RETIRED" : "INACTIVE";
      const resourceId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(resource.id) ? resource.id : null;
      const { error } = await client.rpc("save_resource", { p_resource_id: resourceId, p_resource_code: resource.code, p_resource_type_id: type.id, p_location_id: location?.id ?? null, p_description: null, p_status: status } as never);
      if (error) throw error;
      const { error: conditionError } = await client.rpc("set_resource_condition", { p_resource_id: resourceId ?? null, p_resource_code: resourceId ? null : resource.code, p_condition: resource.condition ?? null } as never);
      if (conditionError) throw conditionError;
    }),
    uploadDocument: async (employeeId, documentTypeId, file, issueDate, expiryDate, notes) => run(async () => {
      const client = createClient();
      const userId = await requireCurrentUserId();
      const path = `${employeeId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: uploadError } = await client.storage.from("employee-documents").upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
      if (uploadError) throw uploadError;
      const { error } = await client.from("employee_documents").insert({ employee_id: employeeId, document_type_id: documentTypeId, file_path: path, original_filename: file.name, mime_type: file.type || null, file_size: file.size, issue_date: issueDate || null, expiry_date: expiryDate || null, notes: notes || null, uploaded_by: userId, review_status: "FOR_VERIFICATION" });
      if (error) { await client.storage.from("employee-documents").remove([path]); throw error; }
    }),
    verifyDocument: async (id) => run(async () => {
      const { error } = await createClient().rpc("verify_employee_document", { p_document_id: id });
      if (error) throw error;
    }),
    setDocumentReviewStatus: async (id, status) => run(async () => {
      const { error } = await createClient().rpc("set_employee_document_review_status", { p_document_id: id, p_review_status: status });
      if (error) throw error;
    }),
    setDocumentApplicability: async (employeeId, documentTypeId, reason, applicable) => run(async () => {
      const { error } = await createClient().rpc("set_document_not_applicable", { p_employee_id: employeeId, p_document_type_id: documentTypeId, p_reason: reason || null, p_is_applicable: applicable });
      if (error) throw error;
    }),
    removeDocument: async (id) => run(async () => {
      const client = createClient();
      const document = data.documents.find((item) => item.id === id);
      if (!document) throw new Error("Document record not found.");
      const { error: removeError } = await client.storage.from("employee-documents").remove([document.file_path]);
      if (removeError) throw removeError;
      const { error } = await client.from("employee_documents").delete().eq("id", id);
      if (error) throw error;
    }),
    openDocument: async (path) => {
      const { data: result, error } = await createClient().storage.from("employee-documents").createSignedUrl(path, 60);
      if (error) throw error;
      return result.signedUrl;
    },
  }), [data, ready, refresh, run]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useStore() {
  const value = useContext(Context);
  if (!value) throw new Error("useStore must be used inside StoreProvider");
  return value;
}
