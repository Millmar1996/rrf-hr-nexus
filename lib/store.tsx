"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { browserDemoRepository } from "./repository";
import { initialData } from "./seed";
import type { AppData, Employee, LifecycleEvent, Resource } from "./types";

type Store = AppData & {
  ready: boolean;
  saveEmployee: (employee: Employee) => void;
  archiveEmployee: (id: string) => void;
  recordEvent: (event: Omit<LifecycleEvent, "id" | "recordedAt" | "recordedBy">) => void;
  assignResource: (resourceId: string, employeeId: string) => void;
  updateResource: (resource: Resource) => void;
};
const Context = createContext<Store | null>(null);
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(initialData);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setData(browserDemoRepository.load());
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (ready) browserDemoRepository.save(data);
  }, [data, ready]);
  const value = useMemo<Store>(() => ({
    ...data, ready,
    saveEmployee: (employee) => setData((old) => ({ ...old, employees: [employee, ...old.employees.filter((e) => e.id !== employee.id)] })),
    archiveEmployee: (id) => setData((old) => ({ ...old, employees: old.employees.map((e) => e.id === id ? { ...e, archived: true, updatedAt: new Date().toISOString() } : e) })),
    recordEvent: (event) => {
      const created: LifecycleEvent = { ...event, id: "evt-" + Date.now(), recordedAt: new Date().toISOString(), recordedBy: "Lourdes Villamor" };
      setData((old) => {
        const updates: Partial<Employee> = event.type === "Promotion" && event.newValue ? { position: event.newValue } :
          event.type === "Transfer" && event.newValue ? { department: event.newValue } :
          event.type === "Client Reassignment" && event.newValue ? { client: event.newValue } :
          event.type === "Regularization" ? { status: "Active", type: "Regular" } :
          event.type === "Separation" ? { status: "Separated" } : {};
        return { ...old, events: [created, ...old.events], employees: old.employees.map((e) => e.id === event.employeeId ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e) };
      });
    },
    assignResource: (resourceId, employeeId) => setData((old) => ({ ...old, resources: old.resources.map((r) => r.id === resourceId ? { ...r, assignedTo: employeeId, status: employeeId ? "Assigned" : "Available" } : r) })),
    updateResource: (resource) => setData((old) => ({
      ...old,
      resources: old.resources.some((r) => r.id === resource.id)
        ? old.resources.map((r) => r.id === resource.id ? resource : r)
        : [...old.resources, resource],
    })),
  }), [data, ready]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useStore() {
  const value = useContext(Context);
  if (!value) throw new Error("useStore must be used inside StoreProvider");
  return value;
}
