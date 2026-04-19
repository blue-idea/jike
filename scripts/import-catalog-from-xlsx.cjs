/**
 * 将 docs/data 下三类名录 xlsx 导入 Supabase：catalog_scenic_spots / catalog_heritage_sites / catalog_museums。
 * 表列与 xlsx 一致（snake_case；Excel 列 `address.1` → `address_1`）。
 *
 * 用法：
 *   node scripts/import-catalog-from-xlsx.cjs               # 追加写入（可能重复）
 *   node scripts/import-catalog-from-xlsx.cjs --replace   # 先清空三张名录表再导入
 *   node scripts/import-catalog-from-xlsx.cjs --dry-run   # 仅解析 xlsx 并打印条数
 *
 * 环境：EXPO_PUBLIC_SUPABASE_URL、SUPABASE_SERVICE_ROLE_KEY（见 .env.example）
 */
const fs = require("fs");
const path = require("path");
const XLSX = require("@e965/xlsx");
const { createClient } = require("@supabase/supabase-js");

const PROJECT_ROOT = path.join(__dirname, "..");
const DOCS_DATA = path.join(PROJECT_ROOT, "docs", "data");

function loadEnvFile() {
  const envPath = path.join(PROJECT_ROOT, ".env");
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf8");
  for (let line of text.split(/\n/)) {
    line = line.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined || process.env[key] === "") {
      process.env[key] = val;
    }
  }
}

loadEnvFile();

const FILES = {
  scenic: "全国A级景区数据.xlsx",
  heritage: "全国重点文物保护单位名单_已分类最终版.xlsx",
  museum: "全国_博物馆.xlsx",
};

const CHUNK = 500;

function argFlag(name) {
  return process.argv.includes(name);
}

function trimStr(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function pick(row, ...candidates) {
  for (const key of candidates) {
    if (row[key] !== undefined && row[key] !== null && trimStr(row[key]) !== "") {
      return row[key];
    }
  }
  for (const rk of Object.keys(row)) {
    const t = rk.trim();
    for (const key of candidates) {
      if (t === key && row[rk] !== undefined && row[rk] !== null && trimStr(row[rk]) !== "") {
        return row[rk];
      }
    }
  }
  return "";
}

function parseNumber(v) {
  if (v === null || v === undefined || v === "") return null;
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

function textOrNull(v) {
  const t = trimStr(v);
  return t || null;
}

async function deleteAllCatalog(supabase) {
  const tables = ["catalog_scenic_spots", "catalog_heritage_sites", "catalog_museums"];
  for (const t of tables) {
    const { error } = await supabase.from(t).delete().not("id", "is", null);
    if (error) throw new Error(`${t} delete: ${error.message}`);
  }
}

async function insertChunks(supabase, table, rows) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from(table).insert(slice);
    if (error) {
      const hint =
        /schema cache|column/i.test(error.message)
          ? "（请先对远程库执行迁移：supabase/migrations/20260420103000_catalog_tables_xlsx_columns.sql，例如 `supabase db push`，再在控制台 Settings → API 点「Reload schema」刷新 PostgREST 缓存。）"
          : "";
      throw new Error(`${table} insert @${i}: ${error.message} ${hint}`);
    }
  }
}

function readSheetRows(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }
  const wb = XLSX.readFile(filePath);
  const name = wb.SheetNames[0];
  const sheet = wb.Sheets[name];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
}

function loadScenic() {
  const fp = path.join(DOCS_DATA, FILES.scenic);
  const json = readSheetRows(fp);
  const rows = [];
  for (const r of json) {
    const name = trimStr(pick(r, "name"));
    if (!name) continue;
    rows.push({
      name,
      rating: textOrNull(pick(r, "Rating")),
      address: textOrNull(pick(r, "address")),
      provincial: textOrNull(pick(r, "provincial")),
      city: textOrNull(pick(r, "city")),
      full_address: textOrNull(pick(r, "full_address")),
      lng_wgs84: parseNumber(pick(r, "lng_wgs84")),
      lat_wgs84: parseNumber(pick(r, "lat_wgs84")),
      recommend: textOrNull(pick(r, "recommend", "recommend ")),
      sort: parseSort(pick(r, "sort")),
      images: parseImages(pick(r, "images")),
    });
  }
  return rows;
}

function loadHeritage() {
  const fp = path.join(DOCS_DATA, FILES.heritage);
  const json = readSheetRows(fp);
  const rows = [];
  for (const r of json) {
    const name = trimStr(pick(r, "name"));
    if (!name) continue;
    rows.push({
      name,
      address: textOrNull(pick(r, "address")),
      category: textOrNull(pick(r, "category")),
      era: textOrNull(pick(r, "era")),
      batch: textOrNull(pick(r, "batch")),
      address_1: textOrNull(pick(r, "address.1")),
      provincial: textOrNull(pick(r, "provincial")),
      city: textOrNull(pick(r, "city")),
      county: textOrNull(pick(r, "county")),
      longitude: parseNumber(pick(r, "longitude")),
      latitude: parseNumber(pick(r, "latitude")),
      recommend: textOrNull(pick(r, "recommend")),
      sort: parseSort(pick(r, "sort")),
      images: parseImages(pick(r, "images")),
    });
  }
  return rows;
}

function loadMuseums() {
  const fp = path.join(DOCS_DATA, FILES.museum);
  const json = readSheetRows(fp);
  const rows = [];
  for (const r of json) {
    const name = trimStr(pick(r, "name"));
    if (!name) continue;
    rows.push({
      name,
      address: textOrNull(pick(r, "address")),
      tel: textOrNull(pick(r, "tel")),
      pname: textOrNull(pick(r, "pname")),
      cityname: textOrNull(pick(r, "cityname")),
      adname: textOrNull(pick(r, "adname")),
      lng: parseNumber(pick(r, "lng")),
      lat: parseNumber(pick(r, "lat")),
      recommend: textOrNull(pick(r, "recommend", "recommend ")),
      sort: parseSort(pick(r, "sort")),
      images: parseImages(pick(r, "images")),
    });
  }
  return rows;
}

async function main() {
  if (argFlag("--dry-run")) {
    console.log("读取 xlsx（dry-run）…");
    const scenic = loadScenic();
    const heritage = loadHeritage();
    const museum = loadMuseums();
    console.log("解析结果:", { scenic: scenic.length, heritage: heritage.length, museum: museum.length });
    process.exit(0);
  }

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("请设置环境变量 EXPO_PUBLIC_SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY 后重试。");
    process.exit(1);
  }

  const replace = argFlag("--replace");
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (replace) {
    console.log("清空名录表 catalog_scenic_spots / catalog_heritage_sites / catalog_museums …");
    await deleteAllCatalog(supabase);
  }

  console.log("读取 xlsx …");
  const scenic = loadScenic();
  const heritage = loadHeritage();
  const museum = loadMuseums();

  console.log("写入 Supabase …", { scenic: scenic.length, heritage: heritage.length, museum: museum.length });
  await insertChunks(supabase, "catalog_scenic_spots", scenic);
  await insertChunks(supabase, "catalog_heritage_sites", heritage);
  await insertChunks(supabase, "catalog_museums", museum);

  console.log("完成。", replace ? "（已 --replace 全量替换）" : "（追加写入）");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
