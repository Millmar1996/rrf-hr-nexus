"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Activity, Armchair, ArrowRight, FileCheck2, LayoutDashboard, Plus, Search, Settings, Users, X, ChartNoAxesColumn, type LucideIcon } from "lucide-react";
import { useStore } from "@/lib/store";
import { matchesSearch } from "@/lib/hr-rules";

const actions: { label: string; detail: string; href: string; icon: LucideIcon }[] = [
  { label: "Overview", detail: "Open the workforce dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Employees", detail: "Search and manage employee records", href: "/employees", icon: Users },
  { label: "Add employee", detail: "Create a new employee record", href: "/employees/new", icon: Plus },
  { label: "Employee lifecycle", detail: "Record or review employee movements", href: "/workforce/lifecycle", icon: Activity },
  { label: "Client assignments", detail: "Review employee client allocations", href: "/workforce/assignments", icon: Users },
  { label: "201 files", detail: "Review employee document checklists", href: "/records/201-files", icon: FileCheck2 },
  { label: "Resource monitoring", detail: "Manage workstation and equipment assignments", href: "/resources", icon: Armchair },
  { label: "Reports", detail: "View workforce summaries", href: "/reports", icon: ChartNoAxesColumn },
  { label: "Monthly workforce changes", detail: "Review hires, moves, regularizations and separations", href: "/reports/workforce-changes", icon: ChartNoAxesColumn },
  { label: "Organization", detail: "Open the employee reporting structure", href: "/organization", icon: Users },
  { label: "Settings", detail: "View workspace reference data", href: "/settings", icon: Settings },
];

export function CommandMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { employees, resources, references } = useStore();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => {
    const term = query.trim();
    const routeResults = actions.filter((item) => matchesSearch(term, [item.label, item.detail])).map((item) => ({ ...item, kind: "Action" }));
    const employeeResults = employees.filter((employee) => !employee.archived && matchesSearch(term, [employee.firstName, employee.middleName, employee.lastName, employee.employeeNumber, employee.email, employee.position, employee.department, employee.client, employee.location])).slice(0, 6).map((employee) => ({ label: [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(" "), detail: employee.employeeNumber + " · " + employee.position, href: "/employees/" + employee.id, icon: Users, kind: "Employee" }));
    const resourceResults = resources.filter((resource) => matchesSearch(term, [resource.code,resource.type,resource.location])).slice(0,4).map((resource) => ({label:resource.code,detail:resource.type+" · "+resource.status,href:"/resources?search="+encodeURIComponent(resource.code),icon:Armchair,kind:"Resource"}));
    const referenceResults = [...references.departments.map(item=>({label:item.name,kind:"Department",href:"/employees?search="+encodeURIComponent(item.name)})),...references.positions.map(item=>({label:item.name,kind:"Position",href:"/employees?search="+encodeURIComponent(item.name)})),...references.clients.map(item=>({label:item.name,kind:"Client",href:"/workforce/assignments?search="+encodeURIComponent(item.name)}))].filter(item=>matchesSearch(term,[item.label])).slice(0,6).map(item=>({...item,detail:item.kind+" · open related HR records",icon:item.kind==="Client"?Users:Users}));
    return [...routeResults, ...employeeResults, ...resourceResults, ...referenceResults];
  }, [employees, resources, references, query]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  if (!open) return null;
  function close() { setQuery(""); setActiveIndex(0); onClose(); }
  function go(href: string) { router.push(href); close(); }
  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") { close(); return; }
    if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => Math.min(index + 1, results.length - 1)); }
    if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); }
    if (event.key === "Enter" && results[activeIndex]) { event.preventDefault(); go(results[activeIndex].href); }
  }

  return <div className="command-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section className="command-dialog" role="dialog" aria-modal="true" aria-label="Search employees and actions">
      <label className="command-search"><Search size={19}/><input ref={inputRef} value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }} onKeyDown={onInputKeyDown} placeholder="Search employees, records, actions…" aria-label="Search employees, records and actions"/><kbd>ESC</kbd><button className="icon-button" onClick={close} aria-label="Close search"><X size={17}/></button></label>
      <div className="command-results" role="listbox" aria-label="Search results">
        {results.map((result, index) => <button id={"command-result-" + index} role="option" aria-selected={index === activeIndex} className={"command-result" + (index === activeIndex ? " active" : "")} key={result.href} onMouseEnter={() => setActiveIndex(index)} onClick={() => go(result.href)}><span className="command-result-icon"><result.icon size={17}/></span><span><b>{result.label}</b><small>{result.detail}</small></span><span className="command-kind">{result.kind}</span><ArrowRight size={15} className="command-arrow"/></button>)}
        {!results.length && <div className="command-empty"><b>No matching employees or actions</b><span>Try an employee name, ID, or page.</span></div>}
      </div>
      <footer className="command-footer"><span><kbd>↑</kbd><kbd>↓</kbd> to navigate</span><span><kbd>↵</kbd> to open</span><span><kbd>Ctrl</kbd><kbd>K</kbd> search</span></footer>
    </section>
  </div>;
}
