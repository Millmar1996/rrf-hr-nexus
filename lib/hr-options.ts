export const LIFECYCLE_EVENT_OPTIONS = [
  "Hire", "Onboarding", "Regularization", "Promotion", "Position Change", "Department Transfer",
  "Location Transfer", "Client Assignment", "Client Reassignment", "Status Change", "Leave Started",
  "Returned from Leave", "Separation", "Rehire",
] as const;

const LIFECYCLE_EVENT_LABELS: Record<string, (typeof LIFECYCLE_EVENT_OPTIONS)[number]> = {
  HIRE: "Hire", ONBOARDING: "Onboarding", REGULARIZATION: "Regularization", PROMOTION: "Promotion",
  POSITION_CHANGE: "Position Change", TRANSFER: "Department Transfer", DEPARTMENT_TRANSFER: "Department Transfer",
  LOCATION_TRANSFER: "Location Transfer", CLIENT_ASSIGNMENT: "Client Assignment", CLIENT_REASSIGNMENT: "Client Reassignment",
  STATUS_CHANGE: "Status Change", LEAVE_START: "Leave Started", LEAVE_RETURN: "Returned from Leave", SEPARATION: "Separation", REHIRE: "Rehire",
};
export function lifecycleEventLabel(value: string): string {
  return LIFECYCLE_EVENT_LABELS[value] ?? value.toLowerCase().split("_").map(part => part[0]?.toUpperCase() + part.slice(1)).join(" ");
}

export const RESOURCE_STATUS_OPTIONS = [
  { value: "Available", label: "Available" },
  { value: "Reserved", label: "Reserved" },
  { value: "Maintenance", label: "Under Maintenance" },
  { value: "Retired", label: "Retired" },
] as const;

export const RESOURCE_CONDITION_OPTIONS = ["Good", "Needs Attention", "Damaged"] as const;

export const isCurrentlyEmployedStatus = (status: string, statuses: { name: string; is_employed: boolean }[]) => statuses.find((item) => item.name === status)?.is_employed ?? false;
export const isRegularizationEligibleStatus = (status: string) => status === "Probationary";
