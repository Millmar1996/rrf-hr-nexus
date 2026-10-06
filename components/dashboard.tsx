"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, FileWarning, Laptop, Plus, Repeat2 } from "lucide-react";
import { useStore } from "@/lib/store";
import type { LifecycleEvent } from "@/lib/types";

function initials(name: string) { return name.split(" ").map((part) => part[0]).slice(0, 2).join(""); }
function daypart() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}
function todayLabel() { return new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" }); }
function activityDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Today · " + date.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  return date.toDateString() === yesterday.toDateString() ? "Yesterday" : date.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}
function eventCopy(event: LifecycleEvent) {
  if (event.type === "Hire") return "Joined as " + event.newValue;
  if (event.type === "Promotion") return "Promoted to " + event.newValue;
  if (event.type === "Client Reassignment") return "Assigned to " + event.newValue;
  if (event.type === "Regularization") return "Regularized from probation";
  if (event.type === "Transfer") return "Transferred to " + event.newValue;
  if (event.type === "Separation") return "Separated from RRFMG";
  return event.notes;
}

export function Dashboard() {
  const { employees, events, resources } = useStore();
  const currentEmployees = employees.filter((employee) => !employee.archived && employee.status !== "Separated");
  const reviews = currentEmployees.filter((employee) => employee.status === "Probationary").length;
  const newHires = currentEmployees.filter((employee) => employee.hiredAt.slice(0, 7) === new Date().toISOString().slice(0, 7)).length;
  const availableSeats = resources.filter((resource) => resource.type === "Seat / Workstation" && resource.status === "Available").length;
  const activity = [...events].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)).slice(0, 5);
  const employeeName = (id: string) => { const employee = employees.find((item) => item.id === id); return employee ? employee.firstName + " " + employee.lastName : "Employee"; };
  const comingUp = [
    ...currentEmployees.filter((e) => e.birthday).map((e) => { const [, m, d] = e.birthday.split("-").map(Number); let date = new Date(new Date().getFullYear(), m - 1, d, 12); if (date < new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 12)) date = new Date(date.getFullYear() + 1, m - 1, d, 12); return { employee: e, date, label: "Birthday" }; }),
    ...currentEmployees.filter((e) => e.status === "Probationary" && e.regularizationDate).map((e) => ({ employee: e, date: new Date(e.regularizationDate + "T12:00:00"), label: "Regularization review" })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 3);
  const redDate = new Date(); redDate.setDate(redDate.getDate() + 30);
  const attention = [
    { title: "Missing 201 documents", detail: "Employees to follow up", count: 5, href: "/records/201-files" },
    { title: "Regularization reviews", detail: "Due within 30 days", count: reviews, href: "/workforce/lifecycle" },
    { title: "Unassigned workstations", detail: "Employees without a seat", count: currentEmployees.filter((e) => !e.seat).length, href: "/resources" },
    { title: "Expiring documents", detail: "Review before renewal", count: 1, href: "/records/201-files" },
  ];
  const assigned = resources.filter((resource) => resource.status === "Assigned").length;
  const available = resources.filter((resource) => resource.status === "Available").length;
  const maintenance = resources.filter((resource) => resource.status === "Maintenance").length;
  const compliance = 70;

  return <div className="page-stack dashboard-page">
    <section className="dashboard-editorial">
      <div className="dashboard-welcome">
        <p className="dashboard-date">{todayLabel()} <span>·</span> Tuguegarao Branch</p>
        <p className="editorial-greeting">{daypart()},<br/><em>Millmar.</em></p>
        <p className="intro-copy">Here’s what needs your attention across the team today.</p>
        <div className="dashboard-actions">
          <Link href="/employees/new" className="button primary"><Plus size={17}/> Add employee</Link>
          <Link href="/workforce/lifecycle" className="text-action"><Repeat2 size={16}/> Record movement</Link>
          <Link href="/records/201-files" className="text-action"><FileWarning size={16}/> Review 201 files</Link>
          <Link href="/resources" className="text-action"><Laptop size={16}/> Assign resource</Link>
        </div>
      </div>
      <Link href="/workforce/lifecycle" className="feature-panel dashboard-feature">
        <span className="feature-kicker">UPCOMING · WORKFORCE</span>
        <b className="feature-number">{reviews}</b>
        <span className="feature-title">Regularization<br/>reviews are due</span>
        <span className="feature-rule"/>
        <span className="feature-footer">Review before {redDate.toLocaleDateString("en-PH", { month: "long", day: "numeric" })}<span>Review employees <ArrowUpRight size={17}/></span></span>
        <span className="feature-index" aria-hidden="true">01</span>
      </Link>
    </section>

    <section className="snapshot" aria-labelledby="snapshot-title">
      <div className="snapshot-heading"><span id="snapshot-title">WORKFORCE SNAPSHOT</span><Link href="/employees">View directory <ArrowRight size={14}/></Link></div>
      <div className="snapshot-metrics">
        <Link href="/employees" className="snapshot-metric"><b>{currentEmployees.length}</b><span>Employees</span></Link>
        <Link href="/employees" className="snapshot-metric"><b>{newHires}</b><span>New this month</span></Link>
        <Link href="/records/201-files" className="snapshot-metric"><b>5</b><span>File issues</span></Link>
        <Link href="/resources" className="snapshot-metric"><b>{availableSeats}</b><span>Seats available</span></Link>
      </div>
    </section>

    <section className="dashboard-columns">
      <section className="recent-activity" aria-labelledby="recent-title">
        <div className="editorial-section-heading"><div><p className="section-overline">LATEST WORKFORCE CHANGES</p><h2 id="recent-title">Recent activity</h2></div><Link href="/workforce/lifecycle" className="text-action">View lifecycle <ArrowRight size={15}/></Link></div>
        <div className="editorial-activity-list">{activity.length ? activity.map((event, index) => <Link href={"/employees/" + event.employeeId} className="editorial-activity-row" key={event.id}><span className={"activity-avatar avatar-tone-" + (index % 4)}>{initials(employeeName(event.employeeId))}</span><span className="activity-copy"><b>{employeeName(event.employeeId)}</b><span>{eventCopy(event)}</span><small>{activityDate(event.recordedAt)}</small></span><span className="activity-category">{event.type}</span></Link>) : <p className="activity-empty">Recent employee changes will appear here.</p>}</div>
      </section>
      <div className="dashboard-side-content">
        <section className="attention-surface" aria-labelledby="attention-title"><div className="editorial-section-heading"><div><p className="section-overline">PRIORITIES</p><h2 id="attention-title">Needs attention</h2></div><span className="attention-total">04</span></div><div className="attention-editorial-list">{attention.map((item, index) => <Link href={item.href} className="attention-editorial-row" key={item.title}><span className="attention-index">0{index + 1}</span><span><b>{item.title}</b><small>{item.count} {item.detail.toLowerCase()}</small></span><ArrowRight size={15}/></Link>)}</div></section>
        <section className="coming-up" aria-labelledby="coming-title"><div className="editorial-section-heading"><div><p className="section-overline">DATES TO KNOW</p><h2 id="coming-title">Coming up</h2></div><Link href="/workforce/lifecycle" className="text-action">All events</Link></div>{comingUp.length ? <div className="coming-list">{comingUp.map(({ employee, date, label }) => <Link href={"/employees/" + employee.id} className="coming-row" key={employee.id + label}><span className="coming-date"><small>{date.toLocaleDateString("en-PH", { month: "short" }).toUpperCase()}</small><b>{date.toLocaleDateString("en-PH", { day: "2-digit" })}</b></span><span><b>{employee.firstName} {employee.lastName}</b><small>{label}</small></span></Link>)}</div> : <p className="activity-empty">No upcoming dates on record.</p>}</section>
      </div>
    </section>

    <section className="dashboard-health-grid">
      <section className="compliance-feature"><div className="compliance-head"><div><p className="section-overline">DOCUMENT COMPLIANCE</p><h2>201 file health</h2></div><Link href="/records/201-files" className="text-action">Review files <ArrowRight size={15}/></Link></div><div className="compliance-score"><b>{compliance}%</b><span>complete</span></div><div className="document-progress" role="img" aria-label={compliance + " percent complete across employee 201 files"}><i style={{ width: compliance + "%" }}/></div><div className="compliance-breakdown"><span><i className="dot-success"/>14 Complete</span><span><i className="dot-warning"/>5 Incomplete</span><span><i className="dot-info"/>2 Expiring</span><span><i className="dot-danger"/>3 Critical</span></div></section>
      <Link href="/resources" className="feature-panel resource-feature"><span className="feature-kicker">BRANCH INVENTORY</span><span className="resource-feature-title">Resource<br/><em>availability</em></span><span className="resource-feature-count"><b>{resources.length}</b> tracked <i/> <b>{available}</b> available</span><span className="resource-feature-note">{assigned} assigned · {maintenance} in maintenance</span><span className="feature-rule"/><span className="resource-feature-link">Manage resources <ArrowUpRight size={17}/></span><span className="feature-index" aria-hidden="true">02</span></Link>
    </section>
  </div>;
}
