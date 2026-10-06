"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Activity, Bell, BriefcaseBusiness, Building2, ChevronDown, CircleHelp, FileCheck2, LayoutDashboard, Menu, MonitorCog, Settings, Users, X, ChartNoAxesColumn } from "lucide-react";
import { Dashboard } from "./dashboard";
import { EmployeesPage, EmployeeFormPage, EmployeeProfilePage } from "./employees";
import { LifecyclePage, FilesPage, ResourcesPage, ReportsPage, SettingsPage } from "./modules";

const navGroups = [
  { label: "", links: [{ label: "Overview", href: "/dashboard", icon: LayoutDashboard }, { label: "Employees", href: "/employees", icon: Users }] },
  { label: "WORKFORCE", links: [{ label: "Employee lifecycle", href: "/workforce/lifecycle", icon: Activity }, { label: "Client assignments", href: "/workforce/assignments", icon: BriefcaseBusiness }] },
  { label: "RECORDS", links: [{ label: "201 files", href: "/records/201-files", icon: FileCheck2 }] },
  { label: "RESOURCES", links: [{ label: "Resource monitoring", href: "/resources", icon: MonitorCog }] },
  { label: "INSIGHTS", links: [{ label: "Reports", href: "/reports", icon: ChartNoAxesColumn }] },
  { label: "ADMINISTRATION", links: [{ label: "Settings", href: "/settings", icon: Settings }] },
];
function Sidebar({ active, onNavigate }: { active: string; onNavigate: () => void }) {
  return <aside className="sidebar">
    <Link className="brand" href="/dashboard" onClick={onNavigate}><span className="brand-mark">R</span><span><b>RRF</b> HR Nexus<small>TUGUEGARAO BRANCH</small></span></Link>
    <nav aria-label="Main navigation">{navGroups.map((group) => <div className="nav-group" key={group.label || "primary"}>{group.label && <p className="nav-label">{group.label}</p>}{group.links.map((item) => {
      const selected = active === item.href || (item.href === "/employees" && active.startsWith("/employees"));
      return <Link onClick={onNavigate} key={item.href} href={item.href} className={"nav-link" + (selected ? " selected" : "")} aria-current={selected ? "page" : undefined}><item.icon size={17} strokeWidth={1.8}/><span>{item.label}</span></Link>;
    })}</div>)}</nav>
    <div className="sidebar-bottom"><button className="nav-link help-link"><CircleHelp size={17}/><span>Help & support</span></button><div className="user-profile"><span className="avatar">LV</span><span className="user-copy"><b>Lourdes Villamor</b><small>HR Administrator</small></span><button className="icon-button tiny" aria-label="Account options"><ChevronDown size={16}/></button></div></div>
  </aside>;
}
export function AppShell() {
  const pathname = usePathname() || "/dashboard";
  const [drawer, setDrawer] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const active = pathname === "/" ? "/dashboard" : pathname;
  let page;
  if (active === "/dashboard") page = <Dashboard />;
  else if (active === "/employees") page = <EmployeesPage />;
  else if (active === "/employees/new") page = <EmployeeFormPage />;
  else if (active.endsWith("/edit") && active.startsWith("/employees/")) page = <EmployeeFormPage id={active.split("/")[2]} />;
  else if (active.startsWith("/employees/")) page = <EmployeeProfilePage id={active.split("/")[2]} />;
  else if (active === "/workforce/lifecycle") page = <LifecyclePage />;
  else if (active === "/records/201-files") page = <FilesPage />;
  else if (active === "/resources") page = <ResourcesPage />;
  else if (active === "/reports") page = <ReportsPage />;
  else if (active === "/settings") page = <SettingsPage />;
  else if (active === "/workforce/assignments") page = <LifecyclePage assignments />;
  else page = <Dashboard />;
  return <div className="app-shell">
    <div className={"mobile-scrim" + (drawer ? " open" : "")} onClick={() => setDrawer(false)} />
    <div className={"sidebar-wrap" + (drawer ? " drawer-open" : "")}><Sidebar active={active} onNavigate={() => setDrawer(false)}/></div>
    <div className="main-column">
      <header className="topbar"><button className="icon-button menu-toggle" aria-label="Open navigation" onClick={() => setDrawer(!drawer)}>{drawer ? <X size={20}/> : <Menu size={20}/>}</button><div className="breadcrumbs">RRFMG <span>/</span> <strong>{active.split("/").filter(Boolean).at(-1)?.replaceAll("-", " ") || "Dashboard"}</strong></div><div className="top-actions"><span className="branch-label"><Building2 size={14}/> Tuguegarao</span><div className="notification-wrap"><button className="icon-button notification-btn" aria-label="Notifications" aria-expanded={notifications} onClick={() => setNotifications(!notifications)}><Bell size={18}/><i /></button>{notifications && <div className="notification-pop"><b>Notifications</b><p>5 employees have incomplete 201 files.</p><p>3 regularization reviews are coming up.</p></div>}</div><span className="top-avatar">LV</span></div></header>
      <main className="page-content">{page}</main>
      <footer className="app-footer"><span>RRF HR Nexus</span><span>Stage 1 · Tuguegarao</span></footer>
    </div>
  </div>;
}
