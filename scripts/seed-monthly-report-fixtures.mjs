import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Optional local .env.local support keeps demo credentials out of source control.
if (fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const username = process.env.HR_ADMIN_USERNAME;
const password = process.env.HR_ADMIN_PASSWORD;
if (!url || !key || !username || !password) throw new Error("Set the Supabase URL/key and HR administrator credentials before seeding the fictional monthly-report documents.");

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { error: authError } = await client.auth.signInWithPassword({ email: `${username.toLowerCase()}@rrf-hr-nexus.vercel.app`, password });
if (authError) throw new Error("Unable to authenticate the demo fixture seed account.");

const { data: employee, error: employeeError } = await client.from("employees").select("id").eq("employee_number", "RR-02421").single();
if (employeeError || !employee) throw new Error("Apply supabase/seed.sql before adding monthly-report document fixtures.");
const { data: requirements, error: requirementError } = await client.from("document_types").select("id,name").in("name", ["NBI Clearance", "Medical Certificate"]);
if (requirementError) throw requirementError;
const byName = new Map(requirements.map((item) => [item.name, item.id]));

function makeFixturePdf(label) {
  const stream = `BT /F1 12 Tf 50 790 Td (${label} - fictional monthly-report fixture) Tj ET\n`;
  const objects = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Count 1/Kids[3 0 R]>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`,
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
  ];
  let body = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(body)); body += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body);
}
const fixtures = [
  { name: "NBI Clearance", filename: "fictional-nbi-clearance.pdf", expiry: "2026-10-12" },
  { name: "Medical Certificate", filename: "fictional-medical-certificate.pdf", expiry: "2026-11-14" },
];

for (const fixture of fixtures) {
  const documentTypeId = byName.get(fixture.name);
  if (!documentTypeId) throw new Error(`Document requirement ${fixture.name} is not configured.`);
  const path = `${employee.id}/monthly-report-fixtures/${fixture.filename}`;
  const { data: exists, error: lookupError } = await client.from("employee_documents").select("id").eq("file_path", path).maybeSingle();
  if (lookupError) throw lookupError;
  if (exists) continue;
  const pdf = makeFixturePdf(fixture.name);
  const { error: uploadError } = await client.storage.from("employee-documents").upload(path, new Blob([pdf], { type: "application/pdf" }), { contentType: "application/pdf", upsert: false });
  if (uploadError) throw uploadError;
  const { error: insertError } = await client.from("employee_documents").insert({
    employee_id: employee.id, document_type_id: documentTypeId, file_path: path,
    original_filename: fixture.filename, mime_type: "application/pdf", file_size: pdf.byteLength,
    issue_date: "2026-10-01", expiry_date: fixture.expiry,
  });
  if (insertError) {
    await client.storage.from("employee-documents").remove([path]);
    throw insertError;
  }
}

await client.auth.signOut();
console.log("Added fictional private October/November document-expiry fixtures for RR-02421.");
