"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, CalendarDays, Check, ChevronDown, ChevronLeft, CircleAlert, Laptop, MoreHorizontal, Pencil, Plus, Search, UserRound, Users, X } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Employee } from "@/lib/types";

const departments = ["Accounting", "Client Services", "Human Resources", "Information Technology", "Operations"];
const clients = ["Northstar Retail", "Pacific Ledger Co.", "Summit Health Group", "Internal – Tuguegarao", "Cedarline Logistics"];
const blankEmployee: Omit<Employee, "id" | "createdAt" | "updatedAt"> = {
  employeeNumber: "", firstName: "", middleName: "", lastName: "", preferredName: "", email: "", phone: "", birthday: "",
  hiredAt: "", status: "Probationary", type: "Probationary", department: "", position: "", manager: "", client: "",
  location: "Tuguegarao City", regularizationDate: "", seat: "", device: "",
};
const fullName = (e: Employee) => [e.firstName, e.middleName, e.lastName].filter(Boolean).join(" ");
function Status({ value }: { value: string }) { return <span className={"status-pill " + (value === "Active" || value === "Regular" ? "good" : value === "Separated" ? "neutral" : "pending")}><i/>{value}</span>; }
function PageTitle({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) { return <div className="page-title-row"><div><h1>{title}</h1><p className="muted">{description}</p></div>{action}</div>; }

export function EmployeesPage() {
  const { employees, archiveEmployee } = useStore();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [department, setDepartment] = useState("All departments");
  const [type, setType] = useState("All types");
  const [client, setClient] = useState("All clients");
  const [sort, setSort] = useState<"name" | "hired">("name");
  const [menu, setMenu] = useState("");
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<Employee | null>(null);
  const rowsPerPage = 10;
  const filtered = useMemo(() => employees.filter((e) => {
    if (e.archived) return false;
    const q = search.trim().toLowerCase();
    return (!q || [fullName(e), e.employeeNumber, e.position, e.email].some((v) => v.toLowerCase().includes(q))) &&
      (status === "All statuses" || e.status === status) && (department === "All departments" || e.department === department) &&
      (type === "All types" || e.type === type) && (client === "All clients" || e.client === client);
  }).sort((a, b) => sort === "name" ? fullName(a).localeCompare(fullName(b)) : b.hiredAt.localeCompare(a.hiredAt)), [employees, search, status, department, type, client, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const rows = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  return <div className="page-stack">
    <PageTitle title="Employee directory" description="Manage employee records and view branch workforce information." action={<Link className="button primary" href="/employees/new"><Plus size={16}/> Add employee</Link>} />
    <div className="directory-stats"><span><b>{employees.filter((e) => !e.archived).length}</b> employees</span><span><b>{employees.filter((e) => !e.archived && e.status === "Active").length}</b> active</span><span><b>{employees.filter((e) => !e.archived && e.status === "Probationary").length}</b> probationary</span></div>
    <section className="panel directory-panel"><div className="directory-toolbar"><label className="search-box"><Search size={17}/><input aria-label="Search employees" placeholder="Search by name, ID, position…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}/>{search && <button aria-label="Clear search" className="plain-icon" onClick={() => setSearch("")}><X size={15}/></button>}</label><div className="filter-group"><select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}><option>All statuses</option>{["Active","Probationary","On Leave","Separated"].map((v)=><option key={v}>{v}</option>)}</select><select aria-label="Filter by department" value={department} onChange={(e) => setDepartment(e.target.value)}><option>All departments</option>{departments.map((v)=><option key={v}>{v}</option>)}</select><select aria-label="Filter by employment type" value={type} onChange={(e) => setType(e.target.value)}><option>All types</option>{["Regular","Probationary","Contractual","Project Based"].map((v)=><option key={v}>{v}</option>)}</select><select aria-label="Filter by client" value={client} onChange={(e) => setClient(e.target.value)}><option>All clients</option>{clients.map((v)=><option key={v}>{v}</option>)}</select></div></div>
      <div className="table-wrap"><table className="data-table employee-table"><thead><tr><th>Employee <button className="sort-button" onClick={() => setSort("name")} aria-label="Sort by employee name">↕</button></th><th>Position / department</th><th>Status</th><th>Type</th><th>Client assignment</th><th>Date hired <button className="sort-button" onClick={() => setSort("hired")} aria-label="Sort by hire date">↕</button></th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{rows.map((e, i)=><tr key={e.id}><td><Link href={"/employees/" + e.id} className="employee-cell"><span className={"employee-avatar av-" + (i % 5)}>{e.firstName[0]}{e.lastName[0]}</span><span><b>{fullName(e)}</b><small>{e.employeeNumber}</small></span></Link></td><td><span className="table-primary">{e.position}</span><small className="table-secondary">{e.department}</small></td><td><Status value={e.status}/></td><td><span className="table-secondary">{e.type}</span></td><td><span className="table-secondary">{e.client}</span></td><td><span className="table-secondary">{new Date(e.hiredAt + "T12:00:00").toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})}</span></td><td className="action-cell"><button className="icon-button tiny" aria-label={"Actions for " + fullName(e)} onClick={() => setMenu(menu === e.id ? "" : e.id)}><MoreHorizontal size={17}/></button>{menu === e.id && <div className="row-menu"><Link href={"/employees/" + e.id}>View profile</Link><Link href={"/employees/" + e.id + "/edit"}>Edit details</Link><button onClick={() => { setConfirm(e); setMenu(""); }}>Archive employee</button></div>}</td></tr>)}</tbody></table>{rows.length === 0 && <div className="empty-state"><Users size={23}/><b>No employees match those filters</b><span>Try a different search or clear a filter.</span><button className="text-link" onClick={() => {setSearch("");setStatus("All statuses");setDepartment("All departments");setType("All types");setClient("All clients");}}>Clear filters</button></div>}</div>
      <div className="table-footer"><span>Showing <b>{filtered.length ? (page - 1) * rowsPerPage + 1 : 0}–{Math.min(page * rowsPerPage, filtered.length)}</b> of <b>{filtered.length}</b> employees</span><div className="pagination"><button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={16}/></button><span>Page {page} of {pages}</span><button aria-label="Next page" disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronDown className="rotate-270" size={16}/></button></div></div>
    </section>
    {confirm && <div className="modal-backdrop" role="presentation" onMouseDown={(e)=>{if(e.target===e.currentTarget)setConfirm(null);}}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="archive-title" onKeyDown={(e)=>{if(e.key==="Escape")setConfirm(null);}}><button className="icon-button dialog-close" aria-label="Close" onClick={()=>setConfirm(null)}><X size={18}/></button><span className="dialog-icon warning"><CircleAlert size={20}/></span><h2 id="archive-title">Archive employee?</h2><p>{fullName(confirm)} will be hidden from the active directory. Their employment history will remain available.</p><div className="dialog-actions"><button autoFocus className="button secondary" onClick={()=>setConfirm(null)}>Cancel</button><button className="button danger" onClick={()=>{archiveEmployee(confirm.id);setConfirm(null);}}>Archive employee</button></div></section></div>}
  </div>;
}

export function EmployeeFormPage({ id }: { id?: string }) {
  const { employees, saveEmployee, recordEvent } = useStore();
  const router = useRouter();
  const existing = id ? employees.find((e) => e.id === id) : undefined;
  const [values, setValues] = useState<Omit<Employee, "id" | "createdAt" | "updatedAt">>(() => existing ? {
    employeeNumber: existing.employeeNumber, firstName: existing.firstName, middleName: existing.middleName, lastName: existing.lastName, preferredName: existing.preferredName, email: existing.email, phone: existing.phone, birthday: existing.birthday, hiredAt: existing.hiredAt, status: existing.status, type: existing.type, department: existing.department, position: existing.position, manager: existing.manager, client: existing.client, location: existing.location, regularizationDate: existing.regularizationDate, seat: existing.seat, device: existing.device,
  } : blankEmployee);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (field: keyof typeof values, value: string) => setValues((old) => ({ ...old, [field]: value }));
  const field = (key: keyof typeof values, label: string, type = "text", required = false) => <label className="field"><span>{label}{required && <i> *</i>}</span><input type={type} value={String(values[key] ?? "")} onChange={(e)=>set(key,e.target.value)} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? "err-" + key : undefined}/>{errors[key] && <small className="field-error" id={"err-" + key}>{errors[key]}</small>}</label>;
  const select = (key: keyof typeof values, label: string, options: string[], required = false) => <label className="field"><span>{label}{required && <i> *</i>}</span><select value={String(values[key] ?? "")} onChange={(e)=>set(key,e.target.value)} aria-invalid={!!errors[key]}><option value="">Select {label.toLowerCase()}</option>{options.map((o)=><option key={o}>{o}</option>)}</select>{errors[key] && <small className="field-error">{errors[key]}</small>}</label>;
  function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string,string> = {};
    for (const key of ["employeeNumber","firstName","lastName","email","hiredAt","status","type","department","position","client"] as const) if (!values[key].trim()) next[key] = "This field is required.";
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) next.email = "Enter a valid email address.";
    if (values.phone && !/^[+0-9() -]{7,20}$/.test(values.phone)) next.phone = "Enter a valid phone number.";
    if (employees.some((e) => e.employeeNumber.toLowerCase() === values.employeeNumber.toLowerCase() && e.id !== id)) next.employeeNumber = "This employee number is already in use.";
    setErrors(next);
    if (Object.keys(next).length) { document.querySelector(".field-error")?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    const stamp = new Date().toISOString();
    const employeeId = existing?.id || "emp-" + Date.now();
    saveEmployee({ ...values, id: employeeId, createdAt: existing?.createdAt || stamp, updatedAt: stamp });
    if (!existing) recordEvent({ employeeId, type: "Hire", effectiveDate: values.hiredAt, previousValue: "", newValue: values.position, notes: "Employee record created." });
    router.push(existing ? "/employees/" + existing.id : "/employees");
  }
  if (id && !existing) return <div className="not-found"><h1>Employee record not found</h1><Link href="/employees">Return to directory</Link></div>;
  return <div className="page-stack form-page"><div className="back-row"><Link href={existing ? "/employees/" + id : "/employees"}><ArrowLeft size={16}/> {existing ? "Back to employee profile" : "Back to directory"}</Link><span>Employee record</span></div><PageTitle title={existing ? "Edit employee" : "Add employee"} description={existing ? "Update personnel and employment information." : "Create a personnel record for the Tuguegarao branch."}/>
    <form className="employee-form panel" onSubmit={submit} noValidate><div className="form-section"><div className="form-section-title"><span className="section-icon"><UserRound size={17}/></span><div><h2>Personal information</h2><p>Basic identity and contact details</p></div></div><div className="form-fields three">{field("employeeNumber","Employee number","text",true)}{field("firstName","First name","text",true)}{field("middleName","Middle name")}{field("lastName","Last name","text",true)}{field("preferredName","Preferred name")}{field("birthday","Birthday","date")}{field("email","Email address","email",true)}{field("phone","Contact number","tel")}</div></div>
      <div className="form-section"><div className="form-section-title"><span className="section-icon"><BriefcaseBusiness size={17}/></span><div><h2>Employment information</h2><p>Role, reporting line and employment dates</p></div></div><div className="form-fields three">{field("hiredAt","Date hired","date",true)}{select("status","Employment status",["Active","Probationary","On Leave","Separated"],true)}{select("type","Employment type",["Regular","Probationary","Contractual","Project Based"],true)}{select("department","Department",departments,true)}{field("position","Position","text",true)}{field("manager","Supervisor / manager")}{select("client","Client assignment",clients,true)}{field("location","Work location")}{field("regularizationDate","Regularization date","date")}</div></div>
      <div className="form-section"><div className="form-section-title"><span className="section-icon"><Laptop size={17}/></span><div><h2>Resource assignment</h2><p>Optional workstation and equipment details</p></div></div><div className="form-fields three">{field("seat","Seat / workstation")}{field("device","Device / equipment")}</div></div>
      <div className="form-actions"><span><i>*</i> Required fields</span><div><Link className="button secondary" href={existing ? "/employees/" + id : "/employees"}>Cancel</Link><button className="button primary" type="submit"><Check size={16}/>{existing ? "Save changes" : "Create employee"}</button></div></div>
    </form>
  </div>;
}

export function EmployeeProfilePage({ id }: { id: string }) {
  const { employees, events, resources, archiveEmployee } = useStore();
  const [tab,setTab] = useState("Overview");
  const employee = employees.find((e)=>e.id===id && !e.archived);
  if (!employee) return <div className="not-found"><h1>Employee record not found</h1><p>This record may have been archived.</p><Link href="/employees">Return to directory</Link></div>;
  const name = [employee.firstName,employee.middleName,employee.lastName].filter(Boolean).join(" ");
  const history = events.filter((e)=>e.employeeId===id).sort((a,b)=>b.effectiveDate.localeCompare(a.effectiveDate));
  const assigned = resources.filter((r)=>r.assignedTo===id);
  return <div className="page-stack profile-page"><div className="back-row"><Link href="/employees"><ArrowLeft size={16}/> Employee directory</Link><span>{employee.employeeNumber}</span></div><section className="profile-header panel"><span className="profile-avatar">{employee.firstName[0]}{employee.lastName[0]}</span><div className="profile-heading"><h1>{name}</h1><p>{employee.position} <span>·</span> {employee.department}</p><div className="profile-meta"><span>{employee.employeeNumber}</span><Status value={employee.status}/><span className="profile-client">{employee.client}</span></div></div><div className="profile-actions"><Link className="button secondary" href={"/employees/" + id + "/edit"}><Pencil size={15}/> Edit profile</Link><button className="icon-button profile-more" title="Archive employee" onClick={()=>{if(window.confirm("Archive " + name + "? Their history will remain available."))archiveEmployee(id);}}><MoreHorizontal size={18}/></button></div></section>
    <div className="profile-tabs" role="tablist" aria-label="Employee record sections">{["Overview","Employment history","201 files","Resources","Activity"].map((t)=><button role="tab" aria-selected={tab===t} className={tab===t?"active":""} key={t} onClick={()=>setTab(t)}>{t}</button>)}</div>
    {tab==="Overview" && <div className="profile-content-grid"><section className="panel profile-section"><div className="panel-head"><div><h2>Personal information</h2><p>Employee identity and contact details</p></div><UserRound size={17}/></div><div className="detail-grid"><div><small>Full name</small><b>{name}</b></div><div><small>Preferred name</small><b>{employee.preferredName || "—"}</b></div><div><small>Date of birth</small><b>{employee.birthday ? new Date(employee.birthday+"T12:00:00").toLocaleDateString("en-PH",{month:"long",day:"numeric",year:"numeric"}) : "—"}</b></div><div><small>Email address</small><b>{employee.email}</b></div><div><small>Contact number</small><b>{employee.phone || "—"}</b></div></div></section><section className="panel profile-section"><div className="panel-head"><div><h2>Employment details</h2><p>Current appointment and branch assignment</p></div><BriefcaseBusiness size={17}/></div><div className="detail-grid"><div><small>Department</small><b>{employee.department}</b></div><div><small>Position</small><b>{employee.position}</b></div><div><small>Employment type</small><b>{employee.type}</b></div><div><small>Date hired</small><b>{new Date(employee.hiredAt+"T12:00:00").toLocaleDateString("en-PH",{month:"long",day:"numeric",year:"numeric"})}</b></div><div><small>Supervisor / manager</small><b>{employee.manager || "—"}</b></div><div><small>Client assignment</small><b>{employee.client}</b></div><div><small>Regularization date</small><b>{employee.regularizationDate ? new Date(employee.regularizationDate+"T12:00:00").toLocaleDateString("en-PH",{month:"long",day:"numeric",year:"numeric"}) : "—"}</b></div><div><small>Work location</small><b>{employee.location}</b></div></div></section><section className="panel profile-section"><div className="panel-head"><div><h2>Assigned resources</h2><p>Seat and equipment linked to this employee</p></div><Laptop size={17}/></div>{assigned.length ? <div className="resource-compact">{assigned.map((r)=><div key={r.id}><span>{r.type}</span><b>{r.code}</b><small>{r.location}</small></div>)}</div> : <div className="inline-empty">No resources assigned yet. <Link href="/resources">Manage resources</Link></div>}</section></div>}
    {tab==="Employment history" && <section className="panel profile-section"><div className="panel-head"><div><h2>Employment history</h2><p>Recorded lifecycle events and role changes</p></div><Link className="button secondary small-button" href="/workforce/lifecycle">Record event</Link></div><EventTimeline events={history} employeeName={name}/></section>}
    {tab==="201 files" && <section className="panel profile-section"><div className="panel-head"><div><h2>201 file checklist</h2><p>Document completeness for this employee</p></div><span className="status-pill pending"><i/> 2 missing</span></div><DocumentChecklist/></section>}
    {tab==="Resources" && <section className="panel profile-section"><div className="panel-head"><div><h2>Assigned resources</h2><p>Tracked seat and equipment assignments</p></div><Link className="text-link" href="/resources">Manage resources <ArrowRight size={14}/></Link></div>{assigned.length ? <div className="resource-table">{assigned.map((r)=><div key={r.id}><Laptop size={17}/><span><b>{r.code}</b><small>{r.type}</small></span><span>{r.location}</span><Status value={r.status}/></div>)}</div> : <div className="inline-empty">No resources currently assigned.</div>}</section>}
    {tab==="Activity" && <section className="panel profile-section"><div className="panel-head"><div><h2>Activity history</h2><p>HR record updates and lifecycle actions</p></div></div><EventTimeline events={history} employeeName={name}/></section>}
  </div>;
}

export function EventTimeline({events,employeeName}:{events:{id:string;type:string;effectiveDate:string;previousValue:string;newValue:string;notes:string;recordedAt:string}[];employeeName:string}) {
  if(!events.length)return <div className="empty-state compact"><CalendarDays size={22}/><b>No events recorded yet</b><span>Lifecycle updates for {employeeName} will appear here.</span></div>;
  return <div className="timeline">{events.map((event)=><div className="timeline-row" key={event.id}><span className="timeline-marker"/><div><div className="timeline-heading"><b>{event.type}</b><time>{new Date(event.effectiveDate+"T12:00:00").toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})}</time></div><p>{event.previousValue && <>{event.previousValue} <ArrowRight size={13}/> </>}{event.newValue}</p>{event.notes && <small>{event.notes}</small>}</div></div>)}</div>;
}
export function DocumentChecklist() {
  return <div className="document-list">{["Personal Information Sheet","Government IDs","Employment Contract","NBI / Clearance","Medical Requirements","Certificates","Other Employee Documents"].map((name,i)=><div key={name}><span className={"document-status " + (i<4?"doc-done":i===4?"doc-expiring":"doc-missing")}>{i<4?<Check size={13}/>:i===4?<CircleAlert size={13}/>:<X size={13}/>}</span><span><b>{name}</b><small>{i<4?"Document on file":i===4?"Expires in 18 days":"Required document missing"}</small></span><span className={"document-label " + (i<4?"text-green":i===4?"text-amber":"text-red")}>{i<4?"Complete":i===4?"Expiring soon":"Missing"}</span></div>)}</div>;
}
