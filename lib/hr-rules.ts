export type LifecycleValue = Record<string, unknown>;

export type LifecycleReferences = {
  statuses?: { id: string; name: string }[];
  positions?: { id: string; name: string }[];
  departments?: { id: string; name: string }[];
  clients?: { id: string; name: string }[];
  locations?: { id: string; name: string }[];
  employmentTypes?: { id: string; name: string }[];
  separationTypes?: { id: string; name: string }[];
};

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const refName = (refs: { id: string; name: string }[] | undefined, id: unknown) =>
  refs?.find((item) => item.id === id)?.name ?? "";

/** Return the human-readable value persisted with a lifecycle event. */
export function lifecycleValueLabel(value: LifecycleValue | null | undefined, refs: LifecycleReferences = {}) {
  if (!value) return "";
  const direct = [value.label, value.display_value, value.value].map(text).find(Boolean);
  if (direct) return direct;

  const pairs: [unknown, unknown, { id: string; name: string }[] | undefined][] = [
    [value.status_name ?? value.employment_status_name ?? value.employment_status, value.status_id ?? value.employment_status_id, refs.statuses],
    [value.position_name ?? value.position, value.position_id, refs.positions],
    [value.department_name ?? value.department, value.department_id, refs.departments],
    [value.client_name ?? value.client, value.client_id, refs.clients],
    [value.location_name ?? value.location, value.work_location_id ?? value.location_id, refs.locations],
    [value.employment_type_name ?? value.employment_type, value.employment_type_id, refs.employmentTypes],
    [value.separation_type_name ?? value.separation_type, value.separation_type_id, refs.separationTypes],
  ];
  for (const [label, id, list] of pairs) {
    const resolved = text(label) || refName(list, id);
    if (resolved) return resolved;
  }
  return "";
}

export function lifecycleEventValues(
  eventType: string,
  previous: LifecycleValue | null | undefined,
  next: LifecycleValue | null | undefined,
  refs: LifecycleReferences = {},
) {
  const previousLabel = lifecycleValueLabel(previous, refs);
  let nextLabel = lifecycleValueLabel(next, refs);
  if (eventType.toUpperCase() === "SEPARATION") {
    nextLabel = text(next?.status_name ?? next?.employment_status_name) || refName(refs.statuses, next?.status_id ?? next?.employment_status_id) || "Separated";
  }
  if (eventType.toUpperCase() === "REGULARIZATION" && !nextLabel) {
    nextLabel = refs.statuses?.find((item) => item.name.toLowerCase() === "regular")?.name ?? "Regular";
  }
  return { previous: previousLabel, next: nextLabel };
}

/** Resolve client movement values exclusively from the event's immutable data snapshot. */
export function clientReassignmentValues(
  previous: LifecycleValue | null | undefined,
  next: LifecycleValue | null | undefined,
  refs: LifecycleReferences = {},
) {
  const values = lifecycleEventValues("CLIENT_REASSIGNMENT", previous, next, refs);
  return { previousClient: values.previous, newClient: values.next };
}

export function lifecycleStatusValue(status: { id: string; name: string }) {
  return {
    status_id: status.id,
    employment_status_id: status.id,
    status_code: status.name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_"),
    status_name: status.name,
    label: status.name,
  };
}

/** Normalize both query and searchable fields so extra/missing spaces never break a name match. */
export function normalizeSearchText(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function matchesSearch(query: string, values: (string | null | undefined)[]) {
  const needle = normalizeSearchText(query);
  if (!needle) return true;
  const haystack = normalizeSearchText(values.filter(Boolean).join(" "));
  return haystack.includes(needle);
}

export function isRegularizationDue(status: string, regularizationDate: string, dueThrough: string) {
  return status === "Probationary" && Boolean(regularizationDate) && regularizationDate <= dueThrough;
}

export function isAvailableResource(status: string) {
  return status === "Available";
}

export function isCurrentAssignmentEmployee(employee: { archived?: boolean; status: string }, employedStatuses: { name: string; is_employed: boolean }[]) {
  return !employee.archived && (employedStatuses.find((item) => item.name === employee.status)?.is_employed ?? false);
}

/** Inactive options may remain selected only on the existing record being edited. */
export function isSelectableMasterValue(value: { name: string; is_active: boolean }, currentValue = "") {
  return value.is_active || value.name === currentValue;
}

export function statusCode(name: string) {
  return name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}
