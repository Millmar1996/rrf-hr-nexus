"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { isCurrentlyEmployedStatus } from "@/lib/hr-options";

type Category = "Departments" | "Positions" | "Employment types" | "Employment statuses" | "Clients" | "Locations" | "Document requirements" | "Resource types" | "Separation types";
type Row = { id: string; name: string; is_active: boolean; is_employed?: boolean; department_id?: string | null; description?: string | null; code?: string | null; address?: string | null; category?: string; is_required?: boolean; supports_expiry?: boolean; display_order?: number };
type Draft = { name: string; code: string; description: string; address: string; department_id: string; category: string; is_required: boolean; supports_expiry: boolean; display_order: string };
const blank: Draft = { name: "", code: "", description: "", address: "", department_id: "", category: "General", is_required: true, supports_expiry: false, display_order: "0" };

export function MasterDataSettings({ category, canManage }: { category: Category; canManage: boolean }) {
  const { references, employees, refresh } = useStore();
  const [editing, setEditing] = useState<Row | null | false>(false);
  const [draft, setDraft] = useState<Draft>(blank);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const client = useMemo(() => createClient(), []);



  const rows: Row[] = category === "Departments" ? references.departments
    : category === "Positions" ? references.positions
    : category === "Employment types" ? references.employmentTypes
    : category === "Employment statuses" ? references.employmentStatuses
    : category === "Clients" ? references.clients
    : category === "Locations" ? references.locations
    : category === "Document requirements" ? references.documentTypes
    : category === "Resource types" ? references.resourceTypes
     : references.separationTypes;
  const usage = (row: Row) => category === "Departments"
    ? `${employees.filter(e => e.department === row.name).length} employees · ${references.positions.filter(p => p.department_id === row.id && p.is_active).length} active positions`
    : category === "Positions" ? `${employees.filter(e => e.position === row.name && e.department === (references.departments.find(d => d.id === row.department_id)?.name ?? "")).length} employees · ${references.departments.find(d => d.id === row.department_id)?.name ?? "No department"}`
    : category === "Clients" ? `${employees.filter(e => e.client === row.name && !e.archived && isCurrentlyEmployedStatus(e.status, references.employmentStatuses)).length} employees`
    : category === "Employment statuses" ? (((row as Row & { is_employed?: boolean }).is_employed ?? !["Separated", "Inactive"].includes(row.name)) ? "Employed status" : "Not in active headcount")
    : category === "Document requirements" ? `${row.category ?? "General"} · ${row.is_required ? "Required" : "Optional"}${row.supports_expiry ? " · expiry tracked" : ""}`
    : row.is_active ? "Available for new records" : "Inactive · retained for history";

  function openEditor(row?: Row) {
    setEditing(row ?? null);
    setDraft(row ? {
      ...blank, name: row.name, code: row.code ?? "", description: row.description ?? "", address: row.address ?? "",
      department_id: row.department_id ?? "", category: row.category ?? "General", is_required: row.is_required ?? true,
      supports_expiry: row.supports_expiry ?? false, display_order: String(row.display_order ?? 0),
    } : blank);
    setMessage("");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const name = draft.name.trim();
    if (!name) return;
    setBusy(true); setMessage("");
    const id = editing ? editing.id : undefined;
    let error: { message: string } | null = null;
    const values = {
      name,
      ...(category === "Departments" || category === "Clients" || category === "Locations" ? { code: draft.code.trim() || null } : {}),
      ...(category === "Departments" || category === "Positions" || category === "Clients" ? { description: draft.description.trim() || null } : {}),
      ...(category === "Positions" ? { department_id: draft.department_id || null } : {}),
      ...(category === "Locations" ? { address: draft.address.trim() || null } : {}),
      ...(category === "Document requirements" ? { category: draft.category.trim() || "General", description: draft.description.trim() || null, is_required: draft.is_required, supports_expiry: draft.supports_expiry, display_order: Math.max(0, Number(draft.display_order) || 0) } : {}),
      ...(category === "Separation types" ? { description: draft.description.trim() || null } : {}),
    };
    if (category === "Departments") { const result = id ? await client.from("departments").update(values as never).eq("id", id) : await client.from("departments").insert(values as never); error = result.error; }
    else if (category === "Positions") { if (!draft.department_id) { setMessage("Choose a department for this position."); setBusy(false); return; } const result = id ? await client.from("positions").update(values as never).eq("id", id) : await client.from("positions").insert(values as never); error = result.error; }
    else if (category === "Employment types") { const result = id ? await client.from("employment_types").update({ name }).eq("id", id) : await client.from("employment_types").insert({ name }); error = result.error; }
    else if (category === "Employment statuses") { setMessage("Employment statuses are controlled values and cannot be renamed or deactivated."); setBusy(false); return; }
    else if (category === "Clients") { const result = id ? await client.from("clients").update(values as never).eq("id", id) : await client.from("clients").insert(values as never); error = result.error; }
    else if (category === "Locations") { const result = id ? await client.from("locations").update(values as never).eq("id", id) : await client.from("locations").insert(values as never); error = result.error; }
    else if (category === "Document requirements") { const result = id ? await client.from("document_types").update(values as never).eq("id", id) : await client.from("document_types").insert(values as never); error = result.error; }
    else if (category === "Resource types") { const result = id ? await client.from("resource_types").update({ name }).eq("id", id) : await client.from("resource_types").insert({ name }); error = result.error; }
    else { const result = id ? await client.from("separation_types").update(values as never).eq("id", id) : await client.from("separation_types").insert(values as never); error = result.error; }
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    setEditing(false); setMessage(id ? "Master value updated." : "Master value added.");
    await refresh();
  }

  async function deactivate(row: Row) {
    if (!window.confirm(`Deactivate “${row.name}”? Existing employee and historical records will remain intact.`)) return;
    const result = category === "Departments" ? await client.from("departments").update({ is_active: false }).eq("id", row.id)
      : category === "Positions" ? await client.from("positions").update({ is_active: false }).eq("id", row.id)
      : category === "Employment types" ? await client.from("employment_types").update({ is_active: false }).eq("id", row.id)
      : category === "Clients" ? await client.from("clients").update({ is_active: false }).eq("id", row.id)
      : category === "Locations" ? await client.from("locations").update({ is_active: false }).eq("id", row.id)
      : category === "Document requirements" ? await client.from("document_types").update({ is_active: false }).eq("id", row.id)
      : category === "Resource types" ? await client.from("resource_types").update({ is_active: false }).eq("id", row.id)
      : await client.from("separation_types").update({ is_active: false }).eq("id", row.id);
    if (result.error) setMessage(result.error.message);
    else { setMessage("Master value deactivated. Existing history is unchanged."); await refresh(); }
  }

  async function activate(row: Row) {
    const result = category === "Departments" ? await client.from("departments").update({ is_active: true }).eq("id", row.id)
      : category === "Positions" ? await client.from("positions").update({ is_active: true }).eq("id", row.id)
      : category === "Employment types" ? await client.from("employment_types").update({ is_active: true }).eq("id", row.id)
      : category === "Clients" ? await client.from("clients").update({ is_active: true }).eq("id", row.id)
      : category === "Locations" ? await client.from("locations").update({ is_active: true }).eq("id", row.id)
      : category === "Document requirements" ? await client.from("document_types").update({ is_active: true }).eq("id", row.id)
      : category === "Resource types" ? await client.from("resource_types").update({ is_active: true }).eq("id", row.id)
      : await client.from("separation_types").update({ is_active: true }).eq("id", row.id);
    if (result.error) setMessage(result.error.message);
    else { setMessage("Master value activated for new records."); await refresh(); }
  }

  const readOnlyStatuses = category === "Employment statuses";
  const label = category === "Document requirements" ? "document requirement" : category.slice(0, -1).toLowerCase();
  return <>
    <header className="settings-page-heading"><div><h2>{category}</h2><p>{category === "Employment statuses" ? "Controlled employee stages; employment type remains a separate contract classification." : "Reusable master values for employee records and reports."}</p></div>{canManage && !readOnlyStatuses && <button className="button secondary" onClick={() => openEditor()}><Plus size={15}/> Add {label}</button>}</header>
    {message && <div className="inline-success" role="status">{message}</div>}
    <div className="settings-list"><div className="settings-list-head"><span>{category === "Positions" ? "Position" : category === "Document requirements" ? "Requirement" : category === "Separation types" ? "Separation type" : "Name"}</span><span>{category === "Positions" ? "Department · employees" : "Usage / state"}</span><span>Actions</span></div>
      {readOnlyStatuses ? rows.map(row => <div key={row.id}><span><b>{row.name}</b></span><span className="settings-count">{usage(row)}</span><span className="settings-count">Controlled</span></div>) : rows.map(row => <div key={row.id}><span><b>{row.name}</b>{row.code && <small>{row.code}</small>}</span><span className="settings-count">{usage(row)}</span><span className="settings-actions"><button className="button secondary small-button" disabled={!canManage} onClick={() => openEditor(row)}>Edit</button>{row.is_active?<button className="button secondary small-button" disabled={!canManage} onClick={() => void deactivate(row)}>Deactivate</button>:<button className="button secondary small-button" disabled={!canManage} onClick={() => void activate(row)}>Activate</button>}</span></div>)}
    </div>
    {!rows.length && !readOnlyStatuses && <div className="empty-state"><b>No {label} values configured</b><span>{category === "Departments" || category === "Positions" || category === "Clients" ? "Add only values confirmed by RRFMG source records." : "Add a value to make it available in HR forms."}</span></div>}
    <p className="settings-note">Referenced values are deactivated rather than deleted so employee records and history remain intact.</p>
    {editing !== false && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setEditing(false); }}><section className="dialog wide-dialog" role="dialog" aria-modal="true" aria-labelledby="master-data-title"><button className="icon-button dialog-close" aria-label="Close dialog" onClick={() => setEditing(false)}><X size={18}/></button><h2 id="master-data-title">{editing ? "Edit" : "Add"} {label}</h2><form className="event-form" onSubmit={save}>
      <label className="field"><span>{category === "Positions" ? "Position title" : category === "Document requirements" ? "Requirement name" : "Name"} <i>*</i></span><input autoFocus required maxLength={120} value={draft.name} onChange={event => setDraft(old => ({ ...old, name: event.target.value }))}/></label>
      {(category === "Departments" || category === "Clients" || category === "Locations") && <label className="field"><span>Code <small>Optional</small></span><input maxLength={32} value={draft.code} onChange={event => setDraft(old => ({ ...old, code: event.target.value }))}/></label>}
      {category === "Positions" && <label className="field"><span>Department <i>*</i></span><select required value={draft.department_id} onChange={event => setDraft(old => ({ ...old, department_id: event.target.value }))}><option value="">Select department</option>{references.departments.filter(department => department.is_active).map(department => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>}
      {category === "Locations" && <label className="field"><span>Address <small>Optional</small></span><input maxLength={250} value={draft.address} onChange={event => setDraft(old => ({ ...old, address: event.target.value }))}/></label>}
      {(category === "Departments" || category === "Positions" || category === "Clients" || category === "Document requirements" || category === "Separation types") && <label className="field"><span>Description <small>Optional</small></span><textarea rows={3} maxLength={1000} value={draft.description} onChange={event => setDraft(old => ({ ...old, description: event.target.value }))}/></label>}
      {category === "Document requirements" && <><div className="form-fields two"><label className="field"><span>Category</span><input maxLength={80} value={draft.category} onChange={event => setDraft(old => ({ ...old, category: event.target.value }))}/></label><label className="field"><span>Display order</span><input type="number" min="0" step="1" value={draft.display_order} onChange={event => setDraft(old => ({ ...old, display_order: event.target.value }))}/></label></div><label className="check-field"><input type="checkbox" checked={draft.is_required} onChange={event => setDraft(old => ({ ...old, is_required: event.target.checked }))}/> Required for 201 compliance</label><label className="check-field"><input type="checkbox" checked={draft.supports_expiry} onChange={event => setDraft(old => ({ ...old, supports_expiry: event.target.checked }))}/> Track expiry date</label></>}
      {message && <p className="field-error" role="alert">{message}</p>}<div className="dialog-actions"><button type="button" className="button secondary" onClick={() => setEditing(false)}>Cancel</button><button className="button primary" disabled={busy}>{busy ? "Saving…" : "Save master value"}</button></div>
    </form></section></div>}
  </>;
}
