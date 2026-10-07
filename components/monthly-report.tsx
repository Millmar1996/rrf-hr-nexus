"use client";

import { useState, type ReactNode } from "react";
import { ArrowDownToLine, ChevronLeft, ChevronRight, FileSpreadsheet, FileText, RefreshCw } from "lucide-react";
import type { MonthlyReport } from "@/lib/monthly-report";

const MONTHS = Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat("en-PH", { month: "long", timeZone: "Asia/Manila" }).format(new Date(Date.UTC(2020, index, 1, 12))));
const today = new Date();
function fmt(value: string) { if (!value) return "—"; const date = new Date(`${value.slice(0, 10)}T12:00:00+08:00`); return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" }).format(date); }
function namePeriod(month: number, year: number) { return `${MONTHS[month - 1]} ${year}`; }
function Table({ headers, rows, empty }: { headers: string[]; rows: (string | number)[][]; empty: string }) {
  return <div className="monthly-table-scroll"><table className="data-table monthly-data-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={index}>{row.map((value, cell) => <td key={cell}>{value || "—"}</td>)}</tr>) : <tr><td className="monthly-empty-cell" colSpan={headers.length}>{empty}</td></tr>}</tbody></table></div>;
}
function Section({ id, number, title, subtitle, children }: { id: string; number: string; title: string; subtitle?: string; children: ReactNode }) {
  return <section className="monthly-section panel" id={id}><div className="monthly-section-title"><span className="report-number">{number}</span><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div></div>{children}</section>;
}

export function MonthlyHRReportPage() {
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function generate(selectedMonth = month, selectedYear = year) {
    setLoading(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/reports/monthly?month=${selectedMonth}&year=${selectedYear}`, { cache: "no-store" });
      if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("Your sign-in session may have expired. Sign in again, then reopen the report.");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to generate the report. Please try again.");
      setReport(data as MonthlyReport);
    } catch (reason) { setReport(null); setError(reason instanceof Error ? reason.message : "Unable to generate the report. Please try again."); }
    finally { setLoading(false); }
  }

  async function exportFile(kind: "excel" | "pdf") {
    if (!report || exporting) return;
    setExporting(kind); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/reports/monthly/${kind}?month=${report.metadata.month}&year=${report.metadata.year}`, { cache: "no-store" });
      const expectedType = kind === "excel" ? "spreadsheetml" : "application/pdf";
      if (!response.headers.get("content-type")?.includes(expectedType)) throw new Error("Your sign-in session may have expired. Sign in again, then export the report.");
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Unable to prepare the ${kind.toUpperCase()} report. Please try again.`); }
      const blob = await response.blob();
      if (blob.size === 0) throw new Error(`The ${kind.toUpperCase()} report was empty. Please try again.`);
      const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url;
      anchor.download = `RRF-HR-Monthly-Report-${report.metadata.year}-${String(report.metadata.month).padStart(2, "0")}.${kind === "excel" ? "xlsx" : "pdf"}`;
      anchor.click(); URL.revokeObjectURL(url); setNotice(`${kind.toUpperCase()} report downloaded.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : `Unable to prepare the ${kind.toUpperCase()} report. Please try again.`); }
    finally { setExporting(null); }
  }

  function moveMonth(direction: -1 | 1) {
    const next = new Date(Date.UTC(year, month - 1 + direction, 1));
    const nextMonth = next.getUTCMonth() + 1; const nextYear = next.getUTCFullYear(); setMonth(nextMonth); setYear(nextYear);
    if (report) void generate(nextMonth, nextYear);
  }

  const sections = report ? [
    ["summary", "Summary"], ["movements", "Workforce changes"], ["compliance", "201 compliance"], ["resources", "Resources"], ["people", "People events"],
  ] : [];
  const eventRows = (items: MonthlyReport["movements"]["all"]) => items.map((e) => [e.employee, e.previous && e.next ? `${e.previous} → ${e.next}` : e.next || e.previous || e.type, fmt(e.effectiveDate), e.department, e.position]);
  const summaryMetrics = report ? [
    ["Total employees", report.workforce.total], ["Active employees", report.workforce.active], ["Probationary", report.workforce.probationary], ["Regular", report.workforce.regular], ["On leave*", report.workforce.onLeave], ["Separated", report.workforce.separated],
  ] as [string, number][] : [];

  return <div className="page-stack monthly-report-page">
    <div className="page-title-row"><div><p className="eyebrow">INSIGHTS · REPORTING</p><h1>Monthly HR Report</h1><p className="muted">Generate a workforce summary and employee movement report for a selected month.</p></div></div>
    <section className="panel monthly-selector">
      <div className="monthly-selector-fields">
        <label className="field"><span>Month</span><select value={month} onChange={(e) => setMonth(Number(e.target.value))}>{MONTHS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</select></label>
        <label className="field"><span>Year</span><input type="number" min="2000" max="2100" value={year} onChange={(e) => setYear(Number(e.target.value))} onBlur={() => setYear((value) => Math.min(2100, Math.max(2000, value || today.getFullYear())))}/></label>
        <button className="button primary" disabled={loading || year < 2000 || year > 2100} onClick={() => void generate()}>{loading ? <><span className="loading-spinner"/> Generating…</> : <><RefreshCw size={15}/> Generate report</>}</button>
      </div>
      {report && <div className="monthly-export-actions"><button className="button secondary" disabled={Boolean(exporting)} onClick={() => void exportFile("excel")}>{exporting === "excel" ? <><span className="loading-spinner"/> Preparing Excel…</> : <><FileSpreadsheet size={15}/> Export Excel</>}</button><button className="button secondary" disabled={Boolean(exporting)} onClick={() => void exportFile("pdf")}>{exporting === "pdf" ? <><span className="loading-spinner"/> Preparing PDF…</> : <><FileText size={15}/> Export PDF</>}</button></div>}
      {error && <div className="inline-error monthly-report-message" role="alert">{error}</div>}{notice && <div className="inline-success monthly-report-message" role="status"><ArrowDownToLine size={15}/>{notice}</div>}
    </section>

    {!report && !loading && !error && <div className="empty-state monthly-empty"><FileSpreadsheet/><b>Choose a month to generate the report</b><span>Report data is generated from employee, lifecycle, client assignment, document and resource records.</span></div>}
    {loading && <div className="empty-state monthly-empty" role="status"><span className="loading-spinner"/><b>Generating {namePeriod(month, year)}</b><span>Loading current HR records and calculating the report.</span></div>}
    {report && <>
      <header className="monthly-report-header"><div><span className="monthly-brand">RRF HR Nexus</span><h2>Monthly Human Resources Report</h2><p>RRFMG — {report.metadata.branch}</p><b>Reporting Period: {fmt(report.metadata.periodStart)}–{fmt(report.metadata.periodEnd)}</b><small>Generated {report.metadata.generatedAt} · Generated by {report.metadata.generatedBy}</small></div><div className="monthly-period-controls"><button className="icon-button" aria-label="Previous month" onClick={() => moveMonth(-1)}><ChevronLeft size={17}/></button><strong>{report.metadata.label}</strong><button className="icon-button" aria-label="Next month" onClick={() => moveMonth(1)}><ChevronRight size={17}/></button></div></header>
      <nav className="monthly-toc" aria-label="Monthly report sections">{sections.map(([id, label]) => <a href={`#${id}`} key={id}>{label}</a>)}</nav>

      <Section id="summary" number="01" title={`Workforce at ${fmt(report.metadata.periodEnd)}`} subtitle="End-of-period headcount, separate from activity during the month.">
        <div className="monthly-kpi-grid">{summaryMetrics.map(([label, value]) => <div className="monthly-kpi" key={label}><span>{label}</span><b>{value}</b></div>)}</div>
        <p className="monthly-data-note">* Employees on leave are included in active headcount. Probationary and regular counts describe employment type.</p>
        <div className="monthly-activity-strip"><b>Movement during {report.metadata.label}</b><span>{report.workforce.hires} new hires</span><span>{report.workforce.separations} separations</span></div>
        <div className="monthly-comparison"><div className="monthly-section-title compact"><div><h3>Month-to-month change</h3><p>{report.comparison.previousLabel} compared with {report.comparison.currentLabel}</p></div></div>
          {report.comparison.available ? <div className="monthly-table-scroll"><Table headers={["Metric", report.comparison.previousLabel, report.comparison.currentLabel, "Change"]} rows={report.comparison.metrics.map((metric) => [metric.label, `${metric.previous}${metric.suffix ?? ""}`, `${metric.current}${metric.suffix ?? ""}`, `${metric.delta > 0 ? "+" : ""}${metric.delta}${metric.suffix ?? ""}`])} empty="Historical comparison is unavailable."/></div> : <p className="small-muted">Historical comparison unavailable.</p>}
          <p className="monthly-data-note">{report.comparison.note}</p>
        </div>
      </Section>

      <Section id="movements" number="02" title={`Workforce movements · ${report.metadata.label}`} subtitle="Counts and affected employees come from recorded lifecycle events and dated hire/assignment records.">
        <div className="monthly-movement-summary">{[["New hires", report.movements.hires.length], ["Regularizations", report.movements.regularizations.length], ["Promotions", report.movements.promotions.length], ["Department transfers", report.movements.departmentChanges.length], ["Client reassignments", report.assignments.length], ["Separations", report.movements.separations.length]].map(([label, value]) => <div key={label}><b>{value}</b><span>{label}</span></div>)}</div>
        <div className="monthly-subsection"><h3>New hires</h3><Table headers={["Employee ID", "Employee", "Position", "Department", "Employment type", "Client", "Date hired"]} rows={report.movements.hires.map((e) => { const employee = report.workforce.employees.find((item) => item.id === e.employeeId); return [e.employeeNumber, e.employee, employee?.position ?? e.position, employee?.department ?? e.department, employee?.employmentType ?? "—", employee?.client ?? "—", fmt(e.effectiveDate)]; })} empty="No new hires recorded for this period."/></div>
        <div className="monthly-subsection"><h3>Regularizations</h3><Table headers={["Employee", "Previous → new status", "Effective date", "Department", "Position"]} rows={eventRows(report.movements.regularizations)} empty="No regularizations recorded for this period."/></div>
        <div className="monthly-subsection"><h3>Promotions / Position changes</h3><Table headers={["Employee", "Previous → new position", "Effective date", "Department", "Position"]} rows={eventRows(report.movements.promotions)} empty="No promotions or position changes recorded for this period."/></div>
        <div className="monthly-subsection"><h3>Transfers / Department changes</h3><Table headers={["Employee", "Previous → new department/location", "Effective date", "Department", "Position"]} rows={eventRows(report.movements.transfers)} empty="No transfers recorded for this period."/></div>
        <div className="monthly-subsection"><h3>Client reassignments</h3><Table headers={["Employee", "Previous client", "New client", "Effective date"]} rows={report.assignments.map((e) => [e.employee, e.previousClient, e.newClient, fmt(e.effectiveDate)])} empty="No client reassignments recorded for this period."/></div>
        <div className="monthly-subsection"><h3>Separations</h3><Table headers={["Employee", "Position", "Department", "Separation type", "Effective date"]} rows={report.movements.separations.map((e) => [e.employee, e.position, e.department, e.separationType || "Not recorded", fmt(e.effectiveDate)])} empty="No separations recorded for this period."/></div>
      </Section>

      <Section id="compliance" number="03" title="201 File Compliance" subtitle="Compliance is calculated for reporting-period employees using available uploaded files and active document requirements.">
        <div className="monthly-movement-summary five">{[["Employees requiring files", report.compliance.required], ["Fully compliant", report.compliance.compliant], ["Missing", report.compliance.withMissing], ["Expiring", report.compliance.withExpiring], ["Expired", report.compliance.withExpired], ["Completion", `${report.compliance.completion}%`]].map(([label, value]) => <div key={label}><b>{value}</b><span>{label}</span></div>)}</div>
        <p className="monthly-data-note">Available document rows are used as of the report period; deleted/replaced document snapshots are not retained by the current schema.</p>
        <Table headers={["Employee", "Completion", "Missing documents", "Expiring documents", "Expired documents", "Status"]} rows={report.compliance.rows.map((e) => [e.employee, `${e.completion}%`, e.missing.length ? `${e.missing.length}: ${e.missing.join(", ")}` : "0", e.expiring.length ? `${e.expiring.length}: ${e.expiring.join(", ")}` : "0", e.expired.length ? `${e.expired.length}: ${e.expired.join(", ")}` : "0", e.status])} empty="No employees require 201 file follow-up."/>
        <div className="monthly-subsection"><h3>Expired during {report.metadata.label}</h3><Table headers={["Employee", "Document", "Expiry date"]} rows={report.expirations.expired.map((e) => [e.employee, e.document, fmt(e.date)])} empty="No documents expired during this period."/></div>
        <div className="monthly-subsection"><h3>Upcoming in {namePeriod(report.metadata.month === 12 ? 1 : report.metadata.month + 1, report.metadata.month === 12 ? report.metadata.year + 1 : report.metadata.year)}</h3><Table headers={["Employee", "Document", "Expiry date"]} rows={report.expirations.upcoming.map((e) => [e.employee, e.document, fmt(e.date)])} empty="No documents are due to expire next month."/></div>
      </Section>

      <Section id="resources" number="04" title="Resource / Workstation Summary" subtitle="Current inventory status plus assignments/release activity recorded during the selected month.">
        <div className="monthly-movement-summary five">{[["Resources", report.resources.total], ["Assigned", report.resources.assigned], ["Available", report.resources.available], ["Maintenance", report.resources.maintenance], ["Inactive", report.resources.inactive], ["Workstations", report.resources.workstationTotal], ["Occupied", report.resources.workstationOccupied], ["Available workstations", report.resources.workstationAvailable], ["Assignments", report.resources.newAssignments], ["Releases", report.resources.releases]].map(([label, value]) => <div key={label}><b>{value}</b><span>{label}</span></div>)}</div>
        <p className="monthly-data-note">Inventory counts are current because the system does not yet store dated resource inventory snapshots. Reassignments are paired release/assignment activity within the month.</p>
        <div className="monthly-subsection"><h3>Resource movements</h3><Table headers={["Resource", "Type", "Employee", "Action", "Effective date"]} rows={report.resources.movements.map((e) => [e.resource, e.type, e.employee, e.action, fmt(e.date)])} empty="No resource assignments or releases recorded for this period."/></div>
      </Section>

      <Section id="people" number="05" title="People Events" subtitle="Birthdays show month/day only. Service years are calculated at the selected reporting year.">
        <div className="monthly-subsection"><h3>Birthdays</h3><Table headers={["Employee", "Department", "Birthday"]} rows={report.birthdays.map((e) => [e.employee, e.department, e.date])} empty="No employee birthdays are recorded for this month."/></div>
        <div className="monthly-subsection"><h3>Work anniversaries</h3><Table headers={["Employee", "Department", "Hire date", "Years of service"]} rows={report.anniversaries.map((e) => [e.employee, e.department, fmt(e.hireDate), e.years])} empty="No work anniversaries fall in this month."/></div>
        <div className="monthly-subsection"><h3>Regularization monitoring</h3><p className="monthly-inline-stat">Completed this month: <b>{report.regularizationMonitoring.completed.length}</b></p><Table headers={["Status", "Employee", "Department", "Date hired", "Expected review"]} rows={[
          ...report.regularizationMonitoring.dueNextMonth.map((e) => ["Due next month", e.employee, e.department, fmt(e.hireDate), fmt(e.expectedDate)]),
          ...report.regularizationMonitoring.overdue.map((e) => ["Overdue", e.employee, e.department, fmt(e.hireDate), fmt(e.expectedDate)]),
        ]} empty="No upcoming or overdue regularization reviews."/></div>
      </Section>
    </>}
  </div>;
}
