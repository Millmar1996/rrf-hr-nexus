import type { AppData, Employee, LifecycleEvent, Resource } from "./types";
const names = [
  ["Maria", "Luz", "Santos"], ["Juan", "Miguel", "Dela Cruz"], ["Angela", "Mae", "Reyes"], ["Carlo", "Jose", "Mendoza"],
  ["Patricia", "Anne", "Garcia"], ["Mark", "Luis", "Villanueva"], ["Beatriz", "", "Aquino"], ["Rafael", "", "Bautista"],
  ["Camille", "Joy", "Navarro"], ["Daniel", "", "Castillo"], ["Nicole", "Marie", "Rivera"], ["Paolo", "", "Fernandez"],
  ["Jasmine", "", "Gonzales"], ["Miguel", "Angelo", "Torres"], ["Andrea", "", "Flores"], ["Gabriel", "", "Ramos"],
  ["Sofia", "", "Aquino"], ["Kevin", "", "Perez"], ["Trisha", "", "Lim"], ["Nathan", "", "Cruz"],
];
const departments = ["Accounting", "Client Services", "Human Resources", "Information Technology", "Operations"];
const positions = ["Accountant", "Client Support Associate", "HR Assistant", "IT Support Specialist", "Operations Analyst"];
const clients = ["Northstar Retail", "Pacific Ledger Co.", "Summit Health Group", "Internal – Tuguegarao", "Cedarline Logistics"];
const now = new Date();
const past = (days: number) => new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10);
export const seedEmployees: Employee[] = names.map((n, i) => ({
  id: "emp-" + String(i + 1).padStart(3, "0"), employeeNumber: "RR-" + String(2401 + i).padStart(5, "0"),
  firstName: n[0], middleName: n[1], lastName: n[2], preferredName: "", email: n[0].toLowerCase() + "." + n[2].toLowerCase().replaceAll(" ", "") + "@rrfmg.example",
  phone: "09" + String(17342000 + i * 619).slice(0, 9), birthday: "199" + (i % 10) + "-0" + (i % 9 + 1) + "-1" + (i % 8 + 1),
  hiredAt: past(i === 0 ? 4 : i === 1 ? 12 : 70 + i * 43), status: i === 5 ? "On Leave" : [1, 12, 18].includes(i) ? "Probationary" : "Active",
  type: [1, 12, 18].includes(i) ? "Probationary" : i === 7 ? "Contractual" : "Regular",
  department: departments[i % departments.length], position: positions[i % positions.length], manager: ["Millmar", "Emmanuel Garcia", "Cynthia Ramos"][i % 3],
  client: clients[i % clients.length], location: "Tuguegarao City", regularizationDate: past(-24 + (i % 4) * 11),
  seat: i < 17 ? "TG-" + String(i + 1).padStart(2, "0") : "", device: i < 15 ? "Laptop · IT-" + String(101 + i) : "",
  createdAt: past(120 + i), updatedAt: now.toISOString(),
}));
export const seedEvents: LifecycleEvent[] = [
  { id: "evt-1", employeeId: "emp-001", type: "Promotion", effectiveDate: past(0), previousValue: "Junior Accountant", newValue: "Senior Accountant", notes: "Recognized for strong client delivery.", recordedAt: now.toISOString(), recordedBy: "Millmar" },
  { id: "evt-2", employeeId: "emp-005", type: "Client Reassignment", effectiveDate: past(1), previousValue: "Cedarline Logistics", newValue: "Northstar Retail", notes: "Coverage realignment.", recordedAt: now.toISOString(), recordedBy: "Millmar" },
  { id: "evt-3", employeeId: "emp-003", type: "Regularization", effectiveDate: past(3), previousValue: "Probationary", newValue: "Regular", notes: "Six-month review completed.", recordedAt: now.toISOString(), recordedBy: "Millmar" },
  ...seedEmployees.slice(0, 14).map((e, i) => ({ id: "evt-hire-" + i, employeeId: e.id, type: "Hire", effectiveDate: e.hiredAt, previousValue: "", newValue: e.position, notes: "New employee onboarding.", recordedAt: e.createdAt, recordedBy: "Millmar" })),
];
export const seedResources: Resource[] = Array.from({ length: 24 }, (_, i) => ({
  id: "res-" + (i + 1), code: i < 16 ? "TG-WS-" + String(i + 1).padStart(2, "0") : i < 22 ? "TG-LT-" + String(i - 15).padStart(2, "0") : "TG-MON-" + String(i - 21).padStart(2, "0"),
  type: i < 16 ? "Seat / Workstation" : i < 22 ? "Computer" : "Other Equipment",
  assignedTo: i < 14 ? seedEmployees[i].id : "", location: "Tuguegarao · Floor 2", status: i < 14 ? "Assigned" : i === 21 ? "Maintenance" : "Available",
}));
export const initialData: AppData = { employees: seedEmployees, events: seedEvents, resources: seedResources };
