export type EmploymentStatus = "Active" | "Probationary" | "Regular" | "On Leave" | "Separated" | "Inactive" | string;
export type EmploymentType = string;
export type Employee = {
  id: string; employeeNumber: string; firstName: string; middleName: string; lastName: string;
  preferredName: string; email: string; phone: string; birthday: string; hiredAt: string;
  status: EmploymentStatus; type: EmploymentType; department: string; position: string;
  manager: string; supervisorId?: string; client: string; clientAssignmentStartDate: string; location: string; regularizationDate: string;
  seat: string; device: string; archived?: boolean; createdAt: string; updatedAt: string;
};
export type LifecycleEvent = { id: string; employeeId: string; type: string; effectiveDate: string; previousValue: string; newValue: string; notes: string; recordedAt: string; recordedBy: string; separationType?: string };
export type Resource = { id: string; code: string; type: string; assignedTo: string; location: string; status: "Available" | "Assigned" | "Reserved" | "Maintenance" | "Retired" | "Inactive"; condition?: "Good" | "Needs Attention" | "Damaged" | string | null };
export type AppData = { employees: Employee[]; events: LifecycleEvent[]; resources: Resource[] };
