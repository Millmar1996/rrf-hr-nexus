"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "./supabase/client";
import { emptyReferences, loadWorkspace, type WorkspaceData } from "./hr-data";
import type { Employee, LifecycleEvent, Resource } from "./types";

type Store = WorkspaceData & {
  ready: boolean;
  refresh: () => Promise<void>;
  clearError: () => void;
  saveEmployee: (employee: Omit<Employee, "id" | "createdAt" | "updatedAt"> & { id?: string }) => Promise<void>;
  archiveEmployee: (id: string) => Promise<void>;
  recordEvent: (event: Omit<LifecycleEvent, "id" | "recordedAt" | "recordedBy">) => Promise<void>;
  assignResource: (resourceId: string, employeeId: string) => Promise<void>;
  updateResource: (resource: Resource) => Promise<void>;
  uploadDocument: (employeeId: string, documentTypeId: string, file: File, issueDate?: string, expiryDate?: string, notes?: string) => Promise<void>;
  removeDocument: (id: string) => Promise<void>;
  openDocument: (path: string) => Promise<string>;
};
const blank: WorkspaceData = { employees: [], events: [], resources: [], references: emptyReferences, documents: [], clientAssignments: [], resourceAssignments: [], audit: [], accessRequests: [], profiles: [], error: null };
const Context = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
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
  useEffect(() => { void refresh(); }, [refresh]);
  const run = useCallback(async (operation: () => Promise<void>) => {
    setData((old) => ({ ...old, error: null }));
    try { await operation(); await refresh(); }
    catch (error) { setData((old) => ({ ...old, error: error instanceof Error ? error.message : "The requested change could not be saved." })); throw error; }
  }, [refresh]);
  const value = useMemo<Store>(() => ({
    ...data, ready, refresh, clearError: () => setData((old) => ({ ...old, error: null })),
    saveEmployee: async (employee) => run(async () => {
      const client = createClient();
      const { data: auth, error: authError } = await client.auth.getUser();
      if (authError || !auth.user) throw authError ?? new Error("Sign in to save employee records.");
      const department = data.references.departments.find((item) => item.name === employee.department);
      const position = data.references.positions.find((item) => item.name === employee.position && (!item.department_id || item.department_id === department?.id));
      const type = data.references.employmentTypes.find((item) => item.name === employee.type);
      const status = data.references.employmentStatuses.find((item) => item.name === employee.status);
      const clientRef = data.references.clients.find((item) => item.name === employee.client);
      const location = data.references.locations.find((item) => item.name === employee.location);
      const manager = data.employees.find((item) => [item.firstName, item.lastName].join(" ") === employee.manager);
      if (!department || !position || !type || !status || !clientRef) throw new Error("Choose valid department, position, employment, and client settings before saving.");
      const rpcPayload = {
        employee_number: employee.employeeNumber.trim(), first_name: employee.firstName.trim(), middle_name: employee.middleName.trim() || null,
        last_name: employee.lastName.trim(), preferred_name: employee.preferredName.trim() || null, email: employee.email.trim() || null,
        contact_number: employee.phone.trim() || null, birthday: employee.birthday || null, date_hired: employee.hiredAt,
        regularization_date: employee.regularizationDate || null, department_id: department.id, position_id: position.id,
        employment_type_id: type.id, employment_status_id: status.id, supervisor_employee_id: manager?.id ?? null,
        work_location_id: location?.id ?? null, is_archived: false, position_label: employee.position,
      };
      const { error } = await client.rpc("save_employee", { p_employee_id: employee.id ?? null, p_employee: rpcPayload, p_client_id: clientRef.id } as never);
      if (error) throw error;
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
        if (assignedClient) next.client_id = assignedClient.id;
      }
      if (type.includes("location")) {
        const location = data.references.locations.find((item) => item.name === event.newValue);
        if (location) next.work_location_id = location.id;
      }
      if (type.includes("status")) {
        const status = data.references.employmentStatuses.find((item) => item.name === event.newValue);
        if (status) next.employment_status_id = status.id;
      }
      const { error } = await client.rpc("record_lifecycle_event", {
        p_employee_id: event.employeeId, p_event_type: event.type.toUpperCase().replaceAll(" ", "_") as "HIRE" | "PROMOTION" | "TRANSFER" | "POSITION_CHANGE" | "DEPARTMENT_TRANSFER" | "REGULARIZATION" | "CLIENT_REASSIGNMENT" | "STATUS_CHANGE" | "LOCATION_TRANSFER" | "SEPARATION" | "REHIRE",
        p_effective_date: event.effectiveDate, p_previous_data: { label: previous }, p_new_data: next, p_notes: event.notes || null,
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
      const status = resource.status.toUpperCase() as "AVAILABLE" | "ASSIGNED" | "MAINTENANCE" | "INACTIVE";
      const resourceId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(resource.id) ? resource.id : null;
      const { error } = await client.rpc("save_resource", { p_resource_id: resourceId, p_resource_code: resource.code, p_resource_type_id: type.id, p_location_id: location?.id ?? null, p_description: null, p_status: status } as never);
      if (error) throw error;
    }),
    uploadDocument: async (employeeId, documentTypeId, file, issueDate, expiryDate, notes) => run(async () => {
      const client = createClient();
      const { data: auth } = await client.auth.getUser();
      if (!auth.user) throw new Error("Sign in to upload employee documents.");
      const path = `${employeeId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: uploadError } = await client.storage.from("employee-documents").upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
      if (uploadError) throw uploadError;
      const { error } = await client.from("employee_documents").insert({ employee_id: employeeId, document_type_id: documentTypeId, file_path: path, original_filename: file.name, mime_type: file.type || null, file_size: file.size, issue_date: issueDate || null, expiry_date: expiryDate || null, notes: notes || null, uploaded_by: auth.user.id });
      if (error) { await client.storage.from("employee-documents").remove([path]); throw error; }
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
