/**
 * 从 docs/data 下三类名录 xlsx 导入 Supabase，或仅同步 images 字段。
 *
 * 用法：
 *   node scripts/import-catalog-from-xlsx.cjs                  # 追加导入（可能重复）
 *   node scripts/import-catalog-from-xlsx.cjs --replace        # 清空三张名录表后再导入（会重建 id）
 *   node scripts/import-catalog-from-xlsx.cjs --images-only    # 仅同步 images（保留 id）
 *   node scripts/import-catalog-from-xlsx.cjs --dry-run        # 只解析 xlsx，不写库
 *   node scripts/import-catalog-from-xlsx.cjs --images-only --dry-run # 仅做 images 匹配预演
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('@e965/xlsx');
const { createClient } = require('@supabase/supabase-js');

const PROJECT_ROOT = path.join(__dirname, '..');
const DOCS_DATA = path.join(PROJECT_ROOT, 'docs', 'data');

const FILES = {
  scenic: '全国A级景区数据.xlsx',
  heritage: '全国重点文物保护单位名单_已分类最终版.xlsx',
  museum: '全国_博物馆.xlsx',
};

const CHUNK = 500;
const FETCH_PAGE = 1000;

const IMAGE_SYNC_CONFIG = [
  {
    label: 'scenic',
    table: 'catalog_scenic_spots',
    loader: loadScenic,
    keyFields: ['name', 'rating', 'address', 'provincial', 'city', 'county', 'full_address', 'lng_wgs84', 'lat_wgs84'],
  },
  {
    label: 'heritage',
    table: 'catalog_heritage_sites',
    loader: loadHeritage,
    keyFields: [
      'name',
      'address',
      'category',
      'era',
      'batch',
      'address_1',
      'provincial',
      'city',
      'county',
      'longitude',
      'latitude',
    ],
  },
  {
    label: 'museum',
    table: 'catalog_museums',
    loader: loadMuseums,
    keyFields: ['name', 'address', 'tel', 'pname', 'cityname', 'adname', 'lng', 'lat'],
  },
];

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

loadEnvFile();

function argFlag(name) {
  return process.argv.includes(name);
}

function trimStr(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function textOrNull(v) {
  const t = trimStr(v);
  return t || null;
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

function normalizeImages(v) {
  if (!Array.isArray(v)) return null;
  const next = v.map((x) => trimStr(x)).filter(Boolean);
  return next.length ? next : null;
}

function normalizeNumberForKey(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeValueForKey(v) {
  if (typeof v === 'number') return normalizeNumberForKey(v);
  if (Array.isArray(v)) return normalizeImages(v);
  return textOrNull(v);
}

function buildKey(row, fields) {
  return JSON.stringify(fields.map((f) => normalizeValueForKey(row[f])));
}

function imagesEqual(a, b) {
  const na = normalizeImages(a);
  const nb = normalizeImages(b);
  if (na === null && nb === null) return true;
  if (na === null || nb === null) return false;
  if (na.length !== nb.length) return false;
  for (let i = 0; i < na.length; i += 1) {
    if (na[i] !== nb[i]) return false;
  }
  return true;
}

async function deleteAllCatalog(supabase) {
  const tables = ['catalog_scenic_spots', 'catalog_heritage_sites', 'catalog_museums'];
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().not('id', 'is', null);
    if (error) throw new Error(`${table} delete failed: ${error.message}`);
  }
}

async function insertChunks(supabase, table, rows) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from(table).insert(slice);
    if (error) {
      throw new Error(`${table} insert @${i} failed: ${error.message}`);
    }
  }
}

async function fetchAllRows(supabase, table, columns) {
  const all = [];
  for (let from = 0; ; from += FETCH_PAGE) {
    const to = from + FETCH_PAGE - 1;
    const { data, error } = await supabase.from(table).select(columns.join(',')).range(from, to);
    if (error) {
      throw new Error(`${table} select @${from} failed: ${error.message}`);
    }
    const page = data || [];
    all.push(...page);
    if (page.length < FETCH_PAGE) break;
  }
  return all;
}

async function updateImagesById(supabase, table, updates, dryRun) {
  if (dryRun || updates.length === 0) return;
  const parallelSize = 50;
  for (let i = 0; i < updates.length; i += parallelSize) {
    const slice = updates.slice(i, i + parallelSize);
    const results = await Promise.all(
      slice.map((item) => {
        return supabase.from(table).update({ images: item.images }).eq('id', item.id).select('id');
      })
    );
    for (let j = 0; j < results.length; j += 1) {
      const error = results[j].error;
      if (error) {
        throw new Error(`${table} images update @${i + j} failed: ${error.message}`);
      }
    }
  }
}

function buildIndexByKey(rows, keyFields) {
  const index = new Map();
  for (const row of rows) {
    const key = buildKey(row, keyFields);
    const list = index.get(key) || [];
    list.push(row);
    index.set(key, list);
  }
  return index;
}

function readSheetRows(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`file not found: ${filePath}`);
  }
  const wb = XLSX.readFile(filePath);
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

function loadScenic() {
  const fp = path.join(DOCS_DATA, FILES.scenic);
  const json = readSheetRows(fp);
  const rows = [];
  for (const r of json) {
    const name = trimStr(pick(r, 'name'));
    if (!name) continue;
    rows.push({
      name,
      rating: textOrNull(pick(r, 'Rating')),
      address: textOrNull(pick(r, 'address')),
      provincial: textOrNull(pick(r, 'provincial')),
      city: textOrNull(pick(r, 'city')),
      county: textOrNull(pick(r, 'county')),
      full_address: textOrNull(pick(r, 'full_address')),
      lng_wgs84: parseNumber(pick(r, 'lng_wgs84')),
      lat_wgs84: parseNumber(pick(r, 'lat_wgs84')),
      recommend: textOrNull(pick(r, 'recommend', 'recommend ')),
      sort: parseSort(pick(r, 'sort')),
      images: parseImages(pick(r, 'images')),
    });
  }
  return rows;
}

function loadHeritage() {
  const fp = path.join(DOCS_DATA, FILES.heritage);
  const json = readSheetRows(fp);
  const rows = [];
  for (const r of json) {
    const name = trimStr(pick(r, 'name'));
    if (!name) continue;
    rows.push({
      name,
      address: textOrNull(pick(r, 'address')),
      category: textOrNull(pick(r, 'category')),
      era: textOrNull(pick(r, 'era')),
      batch: textOrNull(pick(r, 'batch')),
      address_1: textOrNull(pick(r, 'address.1')),
      provincial: textOrNull(pick(r, 'provincial')),
      city: textOrNull(pick(r, 'city')),
      county: textOrNull(pick(r, 'county')),
      longitude: parseNumber(pick(r, 'longitude')),
      latitude: parseNumber(pick(r, 'latitude')),
      recommend: textOrNull(pick(r, 'recommend')),
      sort: parseSort(pick(r, 'sort')),
      images: parseImages(pick(r, 'images')),
    });
  }
  return rows;
}

function loadMuseums() {
  const fp = path.join(DOCS_DATA, FILES.museum);
  const json = readSheetRows(fp);
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

async function syncImagesOnly(supabase, dryRun) {
  const summaries = [];
  const problems = [];

  for (const cfg of IMAGE_SYNC_CONFIG) {
    const sourceRows = cfg.loader();
    const columns = ['id', 'images', ...cfg.keyFields];
    const dbRows = await fetchAllRows(supabase, cfg.table, columns);
    const index = buildIndexByKey(dbRows, cfg.keyFields);
    const keyCursor = new Map();
    const updatesById = new Map();

    let unmatched = 0;
    let extraDbRows = 0;
    const unmatchedExamples = [];

    for (let i = 0; i < sourceRows.length; i += 1) {
      const src = sourceRows[i];
      const key = buildKey(src, cfg.keyFields);
      const matches = index.get(key) || [];
      const cursor = keyCursor.get(key) || 0;

      if (cursor >= matches.length) {
        unmatched += 1;
        if (unmatchedExamples.length < 5) {
          unmatchedExamples.push({ row: i + 1, name: src.name, key });
        }
        continue;
      }
      keyCursor.set(key, cursor + 1);
      const hit = matches[cursor];
      const nextImages = normalizeImages(src.images);
      if (!imagesEqual(hit.images, nextImages)) {
        updatesById.set(hit.id, { id: hit.id, images: nextImages });
      }
    }

    for (const [key, rows] of index.entries()) {
      const used = keyCursor.get(key) || 0;
      extraDbRows += Math.max(rows.length - used, 0);
    }

    if (unmatched > 0) {
      problems.push({
        table: cfg.table,
        unmatched,
        extraDbRows,
        unmatchedExamples,
      });
    }

    const updates = Array.from(updatesById.values());
    await updateImagesById(supabase, cfg.table, updates, dryRun);

    summaries.push({
      table: cfg.table,
      sourceRows: sourceRows.length,
      dbRows: dbRows.length,
      updates: updates.length,
      unchanged: sourceRows.length - updates.length - unmatched,
      unmatched,
      extraDbRows,
    });
  }

  if (problems.length > 0) {
    const detail = problems
      .map((p) => {
        return [
          `${p.table}: unmatched=${p.unmatched}, extraDbRows=${p.extraDbRows}`,
          `unmatched samples: ${JSON.stringify(p.unmatchedExamples)}`,
        ].join('\n');
      })
      .join('\n\n');
    throw new Error(`images-only matching failed.\n${detail}`);
  }

  return summaries;
}

async function main() {
  const dryRun = argFlag('--dry-run');
  const replace = argFlag('--replace');
  const imagesOnly = argFlag('--images-only');

  if (imagesOnly && replace) {
    throw new Error('不能同时使用 --images-only 与 --replace');
  }

  if (dryRun && !imagesOnly) {
    const scenic = loadScenic();
    const heritage = loadHeritage();
    const museum = loadMuseums();
    console.log('dry-run parsed rows:', { scenic: scenic.length, heritage: heritage.length, museum: museum.length });
    return;
  }

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('missing env: EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (imagesOnly) {
    const summaries = await syncImagesOnly(supabase, dryRun);
    if (dryRun) {
      console.log('images-only dry-run summary:', summaries);
    } else {
      console.log('images-only sync done:', summaries);
    }
    return;
  }

  if (replace) {
    await deleteAllCatalog(supabase);
  }

  const scenic = loadScenic();
  const heritage = loadHeritage();
  const museum = loadMuseums();

  await insertChunks(supabase, 'catalog_scenic_spots', scenic);
  await insertChunks(supabase, 'catalog_heritage_sites', heritage);
  await insertChunks(supabase, 'catalog_museums', museum);
  console.log('import done:', { scenic: scenic.length, heritage: heritage.length, museum: museum.length, replace });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
