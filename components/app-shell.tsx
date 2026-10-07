"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Activity, Armchair, Bell, BriefcaseBusiness, ChartNoAxesColumn, CircleHelp, FileCheck2, LayoutDashboard, LogOut, Menu, Search, Settings, Users, X } from "lucide-react";
import { Dashboard } from "./dashboard";
import { CommandMenu } from "./command-menu";
import { AuthPage } from "./auth-pages";
import { EmployeesPage, EmployeeFormPage, EmployeeProfilePage } from "./employees";
import { LifecyclePage, FilesPage, ResourcesPage, ReportsPage, SettingsPage, WorkforceChangesPage, OrganizationPage } from "./modules";
import { useStore } from "@/lib/store";
import { clearAccessToken } from "@/lib/supabase/client";

const navGroups = [
  { label: "", links: [{ label: "Overview", href: "/dashboard", icon: LayoutDashboard }, { label: "Employees", href: "/employees", icon: Users }] },
  { label: "WORKFORCE", links: [{ label: "Employee lifecycle", href: "/workforce/lifecycle", icon: Activity }, { label: "Client assignments", href: "/workforce/assignments", icon: BriefcaseBusiness }] },
  { label: "RECORDS", links: [{ label: "201 files", href: "/records/201-files", icon: FileCheck2 }] },
  { label: "RESOURCES", links: [{ label: "Resource monitoring", href: "/resources", icon: Armchair }] },
  { label: "INSIGHTS", links: [{ label: "Reports", href: "/reports", icon: ChartNoAxesColumn }, { label: "Organization", href: "/organization", icon: Users }] },
  { label: "ADMINISTRATION", links: [{ label: "Settings", href: "/settings", icon: Settings }] },
];

type WorkspaceProfile = { full_name: string; role: string } | null;

function Sidebar({ active, onNavigate, profile }: { active: string; onNavigate: () => void; profile: WorkspaceProfile }) {
  const name = profile?.full_name || "Millmar Agustin";
  const role = profile?.role === "ADMIN" ? "HR Administrator" : profile?.role.replaceAll("_", " ") || "HR Administrator";
  return <aside className="sidebar">
    <Link className="brand" href="/dashboard" onClick={onNavigate}><span className="brand-name"><b>RRF HR</b><em>Nexus</em></span><span className="brand-branch">Tuguegarao Branch</span></Link>
    <button className="sidebar-search" onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }))}><Search size={16}/><span>Search anything</span><kbd>Ctrl K</kbd></button>
    <nav aria-label="Main navigation">{navGroups.map((group) => <div className="nav-group" key={group.label || "primary"}>{group.label && <p className="nav-label">{group.label}</p>}{group.links.map((item) => {
      const selected = active === item.href || (item.href === "/employees" && active.startsWith("/employees")) || (item.href === "/workforce/assignments" && active === "/workforce/client-assignments");
      return <Link onClick={onNavigate} key={item.href} href={item.href} className={"nav-link" + (selected ? " selected" : "")} aria-current={selected ? "page" : undefined}><item.icon size={17} strokeWidth={1.8}/><span>{item.label}</span></Link>;
    })}</div>)}</nav>
    <div className="sidebar-bottom"><Link className="nav-link help-link" href="/settings"><CircleHelp size={17}/><span>Help & support</span></Link><div className="user-profile"><span className="avatar">{name.slice(0, 1).toUpperCase()}</span><span className="user-copy"><b>{name}</b><small>{role}</small></span><form action="/auth/signout" method="post" onSubmit={() => clearAccessToken()}><button className="icon-button tiny" aria-label="Sign out" title="Sign out"><LogOut size={15}/></button></form></div></div>
  </aside>;
}

function titleFor(path: string, employeeName?: string) {
  if (path === "/dashboard") return "";
  if (path === "/employees") return "Employees";
  if (path === "/employees/new") return "Add employee";
  if (path.startsWith("/employees/") && path.endsWith("/edit")) return employeeName ? "Employees / " + employeeName + " / Edit" : "Edit employee";
  if (path.startsWith("/employees/")) return employeeName ? "Employees / " + employeeName : "Employee profile";
  const titles: Record<string, string> = { "/workforce/lifecycle": "Employee lifecycle", "/workforce/assignments": "Client assignments", "/workforce/client-assignments": "Client assignments", "/records/201-files": "201 files", "/resources": "Resource monitoring", "/reports": "Reports", "/reports/workforce-changes": "Monthly workforce changes", "/organization": "Organization structure", "/settings": "Settings" };
  return titles[path] || "RRF HR Nexus";
}

export function AppShell({ profile, notice, authConfigured }: { profile: WorkspaceProfile; notice?: string; authConfigured: boolean }) {
  const pathname = usePathname() || "/dashboard";
  const { employees, ready, error, refresh } = useStore();
  const [drawer, setDrawer] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const active = pathname === "/" ? "/dashboard" : pathname;
  const employeeId = active.startsWith("/employees/") ? active.split("/")[2] : "";
  const currentEmployee = employees.find((employee) => employee.id === employeeId);
  const employeeName = currentEmployee ? [currentEmployee.firstName, currentEmployee.middleName, currentEmployee.lastName].filter(Boolean).join(" ") : undefined;
  const pageTitle = titleFor(active, employeeName);

  useEffect(() => {
    function onShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setCommandOpen((open) => !open); }
    }
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  if (active === "/signin") return <AuthPage notice={notice} authConfigured={authConfigured}/>;

  let page;
  if (active === "/dashboard") page = <Dashboard name={profile?.full_name || "HR team"} />;
  else if (active === "/employees") page = <EmployeesPage />;
  else if (active === "/employees/new") page = <EmployeeFormPage />;
  else if (active.endsWith("/edit") && active.startsWith("/employees/")) page = <EmployeeFormPage id={employeeId} />;
  else if (active.startsWith("/employees/")) page = <EmployeeProfilePage id={employeeId} />;
  else if (active === "/workforce/lifecycle") page = <LifecyclePage />;
  else if (active === "/records/201-files") page = <FilesPage />;
  else if (active === "/resources") page = <ResourcesPage />;
  else if (active === "/reports") page = <ReportsPage />;
  else if (active === "/reports/workforce-changes") page = <WorkforceChangesPage />;
  else if (active === "/organization") page = <OrganizationPage />;
  else if (active === "/settings") page = <SettingsPage role={profile?.role} />;
  else if (active === "/workforce/assignments" || active === "/workforce/client-assignments") page = <LifecyclePage assignments />;
  else page = <Dashboard name={profile?.full_name || "HR team"} />;

  return <div className="app-shell">
    <div className={"mobile-scrim" + (drawer ? " open" : "")} onClick={() => setDrawer(false)} />
    <div className={"sidebar-wrap" + (drawer ? " drawer-open" : "")}><Sidebar active={active} onNavigate={() => setDrawer(false)} profile={profile}/></div>
    <div className="main-column">
      <header className="topbar" onKeyDown={(event) => { if (event.key === "Escape") setDrawer(false); }}>
        <button className="icon-button menu-toggle" aria-label={drawer ? "Close navigation" : "Open navigation"} onClick={() => setDrawer(!drawer)}>{drawer ? <X size={19}/> : <Menu size={19}/>}</button>
        <div className="breadcrumbs" aria-label="Current page">{pageTitle}</div>
        <button className="global-search" onClick={() => setCommandOpen(true)} aria-label="Search employees, records and actions"><Search size={17}/><span>Search employees, records, actions…</span><kbd>Ctrl K</kbd></button>
        <div className="top-actions"><span className="branch-label">Tuguegarao</span><Link className="icon-button notification-btn" href="/dashboard" aria-label="Open workforce overview"><Bell size={18}/></Link><span className="top-avatar" aria-label={profile?.full_name || "Millmar Agustin"}>{(profile?.full_name || "M").slice(0, 1).toUpperCase()}</span></div>
      </header>
      <main className="page-content">{error && <div className="inline-error" role="alert"><span>{error}</span><button className="text-link" onClick={() => void refresh()}>Retry</button></div>}{!ready ? <div className="empty-state database-state" role="status"><span className="loading-spinner"/><b>Loading HR records</b><span>Connecting to the secure workspace…</span></div> : page}</main>
      <footer className="app-footer"><span>RRF HR Nexus</span><span>Stage 1 · Tuguegarao</span></footer>
    </div>
    <CommandMenu open={commandOpen} onClose={() => setCommandOpen(false)}/>
  </div>;
}
