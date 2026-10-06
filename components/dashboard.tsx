"use client";
import Link from "next/link";
import { Activity, ArrowRight, BriefcaseBusiness, Cake, CheckCircle2, ChevronRight, Clock3, FileWarning, Laptop, Plus, UserRoundPlus, Users, UserRoundCheck, Armchair, CalendarDays } from "lucide-react";
import { useStore } from "@/lib/store";
import type { LifecycleEvent } from "@/lib/types";

const month = new Date().toLocaleDateString("en-PH", { month: "long", year: "numeric" });
const dateLabel = new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
function initials(name: string) { return name.split(" ").map((part) => part[0]).slice(0, 2).join(""); }
export function Dashboard() {
  const { employees, events, resources } = useStore();
  const active = employees.filter((e) => !e.archived && e.status !== "Separated");
  const probationary = active.filter((e) => e.status === "Probationary");
  const newHires = employees.filter((e) => e.hiredAt.slice(0, 7) === new Date().toISOString().slice(0, 7)).length;
  const assigned = resources.filter((r) => r.status === "Assigned").length;
  const missing = 5;
  const dueSoon = probationary.length || 3;
  const activity = [...events].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)).slice(0, 5);
  const employeeName = (id: string) => { const e = employees.find((item) => item.id === id); return e ? e.firstName + " " + e.lastName : "Employee"; };
  const subtitle = (event: LifecycleEvent) => event.type === "Hire" ? "Joined as " + event.newValue : event.type === "Promotion" ? "Promoted from " + event.previousValue + " to " + event.newValue : event.type === "Client Reassignment" ? "Client assignment changed to " + event.newValue : event.type === "Regularization" ? "Employment status changed to regular" : event.type === "Transfer" ? "Transferred to " + event.newValue : event.notes;
  const docData = [{ label: "Complete", value: 14, tone: "green" }, { label: "Incomplete", value: 5, tone: "amber" }, { label: "Expiring soon", value: 2, tone: "blue" }, { label: "Missing critical", value: 3, tone: "red" }];
  return <div className="page-stack">
    <div className="welcome-row"><div><p className="eyebrow">{dateLabel}</p><h1>Good morning, Lourdes</h1><p className="muted">Here’s what’s happening with your workforce today.</p></div><Link className="button primary" href="/employees/new"><Plus size={16}/> Add employee</Link></div>
    <section className="metric-grid" aria-label="Workforce summary">
      {[
        { label: "Total employees", value: employees.filter((e) => !e.archived).length, detail: "Across 5 departments", icon: Users, href: "/employees", color: "navy" },
        { label: "Active employees", value: active.length, detail: "Including employees on leave", icon: UserRoundCheck, href: "/employees?status=Active", color: "green" },
        { label: "New hires this month", value: newHires, detail: month, icon: UserRoundPlus, href: "/workforce/lifecycle", color: "blue" },
        { label: "Pending regularization", value: dueSoon, detail: "Review dates approaching", icon: Clock3, href: "/workforce/lifecycle", color: "amber" },
        { label: "Incomplete 201 files", value: missing, detail: "Require HR follow-up", icon: FileWarning, href: "/records/201-files", color: "red" },
        { label: "Available workstations", value: resources.filter((r) => r.type === "Seat / Workstation" && r.status === "Available").length, detail: "Seats ready for assignment", icon: Armchair, href: "/resources", color: "slate" },
      ].map((metric) => <Link href={metric.href} className="metric-card" key={metric.label}><span className={"metric-icon " + metric.color}><metric.icon size={17}/></span><span className="metric-label">{metric.label}</span><strong className="metric-value">{metric.value}</strong><span className="metric-detail">{metric.detail}</span><ChevronRight className="metric-arrow" size={16}/></Link>)}
    </section>
    <div className="dashboard-grid">
      <section className="panel activity-panel"><div className="panel-head"><div><h2>Recent employee activity</h2><p>Lifecycle updates across your branch</p></div><Link href="/workforce/lifecycle" className="text-link">View all <ArrowRight size={14}/></Link></div>
        <div className="activity-list">{activity.map((event) => <Link href={"/employees/" + event.employeeId} className="activity-item" key={event.id}><span className="activity-avatar">{initials(employeeName(event.employeeId))}</span><span className="activity-copy"><b>{employeeName(event.employeeId)}</b><span>{subtitle(event)}</span></span><span className="activity-meta"><span className="event-tag">{event.type}</span><small>{event.effectiveDate === new Date().toISOString().slice(0, 10) ? "Today" : new Date(event.effectiveDate + "T12:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric" })}</small></span></Link>)}</div>
      </section>
      <section className="panel attention-panel"><div className="panel-head"><div><h2>Needs attention</h2><p>Items for your review</p></div><span className="attention-count">4</span></div>
        <ul className="attention-list"><li><span className="attention-dot red-dot"><FileWarning size={15}/></span><span><b>{missing} employees missing documents</b><small>201 file checklist needs updating</small></span><Link href="/records/201-files" aria-label="Review missing documents"><ChevronRight size={17}/></Link></li><li><span className="attention-dot amber-dot"><Clock3 size={15}/></span><span><b>{dueSoon} regularization reviews due</b><small>Within the next 30 days</small></span><Link href="/workforce/lifecycle" aria-label="Review regularizations"><ChevronRight size={17}/></Link></li><li><span className="attention-dot blue-dot"><Armchair size={15}/></span><span><b>{resources.filter((r) => r.status === "Available").length} available seats</b><small>Ready for a new assignment</small></span><Link href="/resources" aria-label="View resources"><ChevronRight size={17}/></Link></li><li><span className="attention-dot slate-dot"><FileWarning size={15}/></span><span><b>1 document expiring soon</b><small>Review before renewal</small></span><Link href="/records/201-files" aria-label="Review expiring documents"><ChevronRight size={17}/></Link></li></ul>
      </section>
    </div>
    <div className="dashboard-grid lower-grid">
      <section className="panel"><div className="panel-head"><div><h2>201 file status</h2><p>Branch-wide document completeness</p></div><Link href="/records/201-files" className="text-link">Open records <ArrowRight size={14}/></Link></div><div className="compliance-bar" role="img" aria-label="201 file completeness: 14 complete, 5 incomplete, 2 expiring soon, 3 missing critical documents"><span className="bar-green"/><span className="bar-amber"/><span className="bar-blue"/><span className="bar-red"/></div><div className="legend-grid">{docData.map((item) => <div className="legend-item" key={item.label}><span className={"legend-dot " + item.tone}/><span>{item.label}</span><b>{item.value}</b></div>)}</div></section>
      <section className="panel"><div className="panel-head"><div><h2>Resource status</h2><p>Workstations and assigned equipment</p></div><Link href="/resources" className="text-link">Manage <ArrowRight size={14}/></Link></div><div className="resource-summary"><div><small>Total tracked</small><b>{resources.length}</b></div><div><small>Assigned</small><b>{assigned}</b></div><div><small>Available</small><b>{resources.filter((r) => r.status === "Available").length}</b></div></div><div className="resource-note"><span className="status-pill good"><CheckCircle2 size={13}/> {resources.filter((r) => r.status === "Available").length} ready to assign</span><span className="small-muted">Across seats, computers & equipment</span></div></section>
    </div>
    <div className="dashboard-grid lower-grid">
      <section className="panel"><div className="panel-head"><div><h2>Upcoming dates</h2><p>Birthdays, anniversaries and reviews</p></div><span className="month-chip">{month}</span></div><div className="upcoming-list">{[{icon:Cake,name:"Angela Reyes",desc:"Birthday",date:"Oct 12",tone:"peach"},{icon:BriefcaseBusiness,name:"Daniel Castillo",desc:"3 year anniversary",date:"Oct 16",tone:"lavender"},{icon:CalendarDays,name:"Juan Dela Cruz",desc:"Regularization review",date:"Oct 21",tone:"mint"}].map((x)=><div className="upcoming-item" key={x.name}><span className={"upcoming-icon "+x.tone}><x.icon size={16}/></span><span className="upcoming-copy"><b>{x.name}</b><small>{x.desc}</small></span><time>{x.date}</time></div>)}</div></section>
      <section className="panel"><div className="panel-head"><div><h2>Quick actions</h2><p>Common HR tasks</p></div></div><div className="quick-grid"><Link href="/employees/new"><span><Plus size={17}/></span><b>Add employee</b><small>Create a personnel record</small></Link><Link href="/workforce/lifecycle"><span><Activity size={17}/></span><b>Record lifecycle event</b><small>Promotion, transfer or status</small></Link><Link href="/resources"><span><Laptop size={17}/></span><b>Assign resource</b><small>Allocate a seat or device</small></Link><Link href="/records/201-files"><span><FileWarning size={17}/></span><b>Review 201 files</b><small>Check missing documents</small></Link></div></section>
    </div>
  </div>;
}
