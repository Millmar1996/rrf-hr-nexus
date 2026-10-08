import assert from "node:assert/strict";
import test from "node:test";
import {
  isAvailableResource,
  isCurrentAssignmentEmployee,
  isRegularizationDue,
  isSelectableMasterValue,
  lifecycleStatusValue,
  lifecycleEventValues,
  clientReassignmentValues,
  lifecycleValueLabel,
  matchesSearch,
} from "../lib/hr-rules.ts";

test("regularization stores and formats the probationary to regular status pair", () => {
  const previous = lifecycleStatusValue({ id: "status-probation", name: "Probationary" });
  const next = lifecycleStatusValue({ id: "status-regular", name: "Regular" });
  assert.deepEqual([lifecycleValueLabel(previous), lifecycleValueLabel(next)], ["Probationary", "Regular"]);
  assert.equal(next.status_code, "REGULAR");
});

test("client reassignment resolves structured ids to labels", () => {
  const clients = [{ id: "client-a", name: "Client A" }, { id: "client-b", name: "Client B" }];
  assert.deepEqual([
    lifecycleValueLabel({ client_id: "client-a" }, { clients }),
    lifecycleValueLabel({ client_id: "client-b" }, { clients }),
  ], ["Client A", "Client B"]);
  assert.deepEqual(clientReassignmentValues(
    { client_id: "client-a", client_name: "Client A" },
    { client_id: "client-b", client_name: "Client B" },
    { clients },
  ), { previousClient: "Client A", newClient: "Client B" });
});

test("separation label remains independent from optional notes", () => {
  assert.equal(lifecycleValueLabel({ separation_type_name: "Resignation", separation_type_id: "reason-1" }), "Resignation");
  assert.deepEqual(lifecycleEventValues("SEPARATION", { label: "Probationary" }, { label: "Resignation", status_name: "Separated", separation_type_name: "Resignation" }), { previous: "Probationary", next: "Separated" });
});

test("search matches complete names despite repeated whitespace", () => {
  assert.equal(matchesSearch("QA TEST Employee", ["QA", "", "TEST", "Employee", "RR-TEST-01"]), true);
  assert.equal(matchesSearch("  qa   test employee ", ["QA", "TEST", "Employee"]), true);
});

test("regularization due filter includes overdue and next-30-day reviews only", () => {
  assert.equal(isRegularizationDue("Probationary", "2026-10-01", "2026-11-07"), true);
  assert.equal(isRegularizationDue("Probationary", "2026-11-07", "2026-11-07"), true);
  assert.equal(isRegularizationDue("Probationary", "2026-11-08", "2026-11-07"), false);
  assert.equal(isRegularizationDue("Regular", "2026-10-01", "2026-11-07"), false);
});

test("available-resource filter selects only available resources", () => {
  assert.deepEqual(["Available", "Assigned", "Maintenance"].filter(isAvailableResource), ["Available"]);
});

test("archived or non-employed employees are excluded from current allocations", () => {
  const statuses = [{ name: "Regular", is_employed: true }, { name: "Separated", is_employed: false }];
  assert.equal(isCurrentAssignmentEmployee({ status: "Regular" }, statuses), true);
  assert.equal(isCurrentAssignmentEmployee({ status: "Regular", archived: true }, statuses), false);
  assert.equal(isCurrentAssignmentEmployee({ status: "Separated" }, statuses), false);
});

test("inactive master values are hidden for new records but retained for existing records", () => {
  const inactiveClient = { name: "QA TEST Client", is_active: false };
  const inactiveEmploymentType = { name: "QA TEST Employment Type", is_active: false };
  assert.equal(isSelectableMasterValue(inactiveClient), false);
  assert.equal(isSelectableMasterValue(inactiveEmploymentType), false);
  assert.equal(isSelectableMasterValue(inactiveClient, "QA TEST Client"), true);
  assert.equal(isSelectableMasterValue(inactiveEmploymentType, "QA TEST Employment Type"), true);
});
