export type EmploymentStatus = "Active" | "Probationary" | "On Leave" | "Separated";
export type EmploymentType = "Regular" | "Probationary" | "Contractual" | "Project Based";
export type Employee = {
  id: string; employeeNumber: string; firstName: string; middleName: string; lastName: string;
  preferredName: string; email: string; phone: string; birthday: string; hiredAt: string;
  status: EmploymentStatus; type: EmploymentType; department: string; position: string;
  manager: string; client: string; location: string; regularizationDate: string;
  seat: string; device: string; archived?: boolean; createdAt: string; updatedAt: string;
};
export type LifecycleEvent = { id: string; employeeId: string; type: string; effectiveDate: string; previousValue: string; newValue: string; notes: string; recordedAt: string; recordedBy: string };
export type Resource = { id: string; code: string; type: string; assignedTo: string; location: string; status: "Available" | "Assigned" | "Maintenance" | "Inactive" };
export type AppData = { employees: Employee[]; events: LifecycleEvent[]; resources: Resource[] };
