const fs = require('fs');
const path = require('path');
const XLSX = require('@e965/xlsx');
const { createClient } = require('@supabase/supabase-js');

const PROJECT_ROOT = path.join(__dirname, '..');
const XLSX_PATH = path.join(PROJECT_ROOT, 'docs', 'data', '全国_博物馆.xlsx');
const TABLE = 'catalog_museums';
const CHUNK = 500;

function loadEnvFile() {
  const envPath = path.join(PROJECT_ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (let line of text.split(/\n/)) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = val;
    }
  }
}

function trimStr(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function textOrNull(v) {
  const t = trimStr(v);
  return t || null;
}

function parseNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseSort(v) {
  const n = parseNumber(v);
  if (n === null) return null;
  return Math.trunc(n);
}

function parseImages(v) {
  const s = trimStr(v);
  if (!s) return null;
  const parts = s
    .split(/[,，;；]/)
    .map((x) => x.trim())
    .filter(Boolean);
  return parts.length ? parts : null;
}

function pick(row, ...candidates) {
  for (const key of candidates) {
    if (row[key] !== undefined && row[key] !== null && trimStr(row[key]) !== '') {
      return row[key];
    }
  }
  for (const rk of Object.keys(row)) {
    const t = rk.trim();
    for (const key of candidates) {
      if (t === key && row[rk] !== undefined && row[rk] !== null && trimStr(row[rk]) !== '') {
        return row[rk];
      }
    }
  }
  return '';
}

function loadMuseumRows() {
  if (!fs.existsSync(XLSX_PATH)) {
    throw new Error(`file not found: ${XLSX_PATH}`);
  }
  const wb = XLSX.readFile(XLSX_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  const rows = [];
  for (const r of json) {
    const name = trimStr(pick(r, 'name'));
    if (!name) continue;
    rows.push({
      name,
      address: textOrNull(pick(r, 'address')),
      tel: textOrNull(pick(r, 'tel')),
      pname: textOrNull(pick(r, 'pname')),
      cityname: textOrNull(pick(r, 'cityname')),
      adname: textOrNull(pick(r, 'adname')),
      lng: parseNumber(pick(r, 'lng')),
      lat: parseNumber(pick(r, 'lat')),
      recommend: textOrNull(pick(r, 'recommend', 'recommend ')),
      sort: parseSort(pick(r, 'sort')),
      images: parseImages(pick(r, 'images')),
    });
  }
  return rows;
}

async function insertChunks(supabase, rows) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from(TABLE).insert(slice);
    if (error) {
      throw new Error(`${TABLE} insert @${i} failed: ${error.message}`);
    }
  }
}

async function main() {
  loadEnvFile();
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('missing env: EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const rows = loadMuseumRows();

  const { error: deleteError } = await supabase.from(TABLE).delete().not('id', 'is', null);
  if (deleteError) {
    throw new Error(`${TABLE} delete failed: ${deleteError.message}`);
  }

  await insertChunks(supabase, rows);

  const { count, error: countError } = await supabase.from(TABLE).select('*', { count: 'exact', head: true });
  if (countError) {
    throw new Error(`${TABLE} count failed: ${countError.message}`);
  }

  console.log(
    JSON.stringify({
      table: TABLE,
      replacedRows: rows.length,
      dbCountAfterInsert: count ?? null,
    })
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
