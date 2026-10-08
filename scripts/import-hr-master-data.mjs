#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const inputIndex = args.indexOf('--input');
const inputPath = inputIndex >= 0 ? args[inputIndex + 1] : null;
if (!inputPath) {
  console.error('Usage: node scripts/import-hr-master-data.mjs --input normalized-master-data.json [--apply]');
  process.exit(2);
}

const key = value => String(value ?? '').trim().toLocaleLowerCase('en');
const clean = value => String(value ?? '').trim();
function uniqueRows(rows, label) {
  if (!Array.isArray(rows)) throw new Error(`${label} must be an array.`);
  const unique = new Map();
  for (const raw of rows) {
    const name = clean(typeof raw === 'string' ? raw : raw?.name ?? raw?.title);
    if (!name) continue;
    const value = typeof raw === 'string' ? { name } : { ...raw, name };
    if (!unique.has(key(name))) unique.set(key(name), value);
  }
  return [...unique.values()];
}
export function normalizeMasterData(data) {
  const departments = uniqueRows(data.departments ?? [], 'departments');
  const clients = uniqueRows(data.clients ?? [], 'clients');
  const rawPositions = uniqueRows(data.positions ?? [], 'positions');
  const positions = rawPositions.map(position => ({
    ...position,
    department: clean(position.department),
  }));
  return { departments, positions, clients };
}

const parsed = JSON.parse(await readFile(inputPath, 'utf8'));
const master = normalizeMasterData(parsed);
const summary = {
  departments: master.departments.length,
  positions: master.positions.length,
  clients: master.clients.length,
  positionsWithoutDepartment: master.positions.filter(position => !position.department).length,
};
if (!apply) {
  console.log('Dry run only. No Supabase data was changed.');
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the process environment for --apply.');
const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function load(table, columns) {
  const { data, error } = await supabase.from(table).select(columns);
  if (error) throw new Error(`Could not read ${table}: ${error.message}`);
  return data ?? [];
}
async function insertMissing(table, rows, existingRows, identify) {
  const known = new Set(existingRows.map(identify));
  const added = [];
  for (const row of rows) {
    const normalized = identify(row);
    if (known.has(normalized)) continue;
    const { data, error } = await supabase.from(table).insert(row).select('*').single();
    if (error) throw new Error(`Could not add ${table} value “${row.name}”: ${error.message}`);
    added.push(data);
    known.add(normalized);
  }
  return [...existingRows, ...added];
}

const existingDepartments = await load('departments', 'id,name,code,description,is_active');
const departmentRows = master.departments.map(row => ({ name: row.name, code: clean(row.code) || null, description: clean(row.description) || null }));
const departments = await insertMissing('departments', departmentRows, existingDepartments, row => key(row.name));
const deptByName = new Map(departments.map(row => [key(row.name), row.id]));
const positionRows = [];
for (const position of master.positions) {
  const departmentId = deptByName.get(key(position.department));
  if (!departmentId) {
    console.warn(`Skipped position “${position.name}”: department “${position.department || '(blank)'}” is not in the import or database.`);
    continue;
  }
  positionRows.push({ name: position.name, department_id: departmentId, description: clean(position.description) || null });
}
const existingPositions = await load('positions', 'id,name,department_id,description,is_active');
const positions = await insertMissing('positions', positionRows, existingPositions, row => `${row.department_id}:${key(row.name)}`);
const existingClients = await load('clients', 'id,name,code,description,is_active');
const clientRows = master.clients.map(row => ({ name: row.name, code: clean(row.code) || null, description: clean(row.description) || null }));
const clients = await insertMissing('clients', clientRows, existingClients, row => key(row.name));
console.log('Master-data import complete. Existing matching values were retained.');
console.log(JSON.stringify({ ...summary, departmentsInDatabase: departments.length, positionsInDatabase: positions.length, clientsInDatabase: clients.length }, null, 2));
