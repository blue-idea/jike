/* global __dirname */
/**
 * 从 docs/data/全国省市区划分数据表.xls 生成 constants/chinaRegions.generated.ts
 * 解析规则：Sheet1 前半为「省/市/区县」文本列（空省继承上一省）；后半为行政区划代码列（省为 xx0000，市为 1 个前导 NBSP，区县为 3 个前导 NBSP）。
 */
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const NBSP = "\u00a0";

function clean(s) {
  return String(s ?? "")
    .replace(new RegExp(NBSP, "g"), "")
    .trim();
}

function countLeadingNbsp(s) {
  const str = String(s ?? "");
  let n = 0;
  for (let i = 0; i < str.length && str.charCodeAt(i) === 0xa0; i++) n++;
  return n;
}

const INPUT = path.join(__dirname, "..", "docs", "data", "全国省市区划分数据表.xls");
const OUTPUT = path.join(__dirname, "..", "constants", "chinaRegions.generated.ts");

function ensureDistrict(map, province, city, district) {
  const d = clean(district);
  if (!d) return;
  if (!map.has(province)) map.set(province, new Map());
  const cities = map.get(province);
  if (!cities.has(city)) cities.set(city, new Set());
  cities.get(city).add(d);
}

function mapToSortedArray(map) {
  const provinces = [...map.keys()].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  return provinces.map((pName) => {
    const cMap = map.get(pName);
    const cities = [...cMap.keys()].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
    return {
      name: pName,
      cities: cities.map((cName) => ({
        name: cName,
        districts: [...cMap.get(cName)].sort((a, b) =>
          a.localeCompare(b, "zh-Hans-CN"),
        ),
      })),
    };
  });
}

function parseSheet(rows) {
  /** @type {Map<string, Map<string, Set<string>>>} */
  const map = new Map();

  let lastProvince = "";
  let lastCity = "";

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const col1 = row[1];

    if (typeof col1 === "number") {
      const code = col1;
      const rawName = String(row[2] ?? "");
      const nb = countLeadingNbsp(rawName);
      const name = clean(rawName);

      if (code % 10000 === 0) {
        lastProvince = name;
        lastCity = "";
        continue;
      }

      if (nb === 1) {
        lastCity = name;
        continue;
      }

      if (nb >= 2 && lastProvince && name) {
        const cityKey = lastCity || lastProvince;
        ensureDistrict(map, lastProvince, cityKey, name);
      }
      continue;
    }

    const p = clean(row[0]);
    const c = clean(row[1]);
    const d = clean(row[2]);

    if (p) lastProvince = p;
    if (c) lastCity = c;
    if (lastProvince && lastCity && d) {
      ensureDistrict(map, lastProvince, lastCity, d);
    }
  }

  const orphans = [
    { province: "台湾省", city: "台湾省", district: "（区划待民政同步）" },
    { province: "香港特别行政区", city: "香港特别行政区", district: "（区划待民政同步）" },
    { province: "澳门特别行政区", city: "澳门特别行政区", district: "（区划待民政同步）" },
  ];
  for (const o of orphans) {
    if (!map.has(o.province)) {
      ensureDistrict(map, o.province, o.city, o.district);
    }
  }

  return mapToSortedArray(map);
}

function main() {
  if (!fs.existsSync(INPUT)) {
    console.error("未找到文件:", INPUT);
    console.error("请将「全国省市区划分数据表.xls」放在 docs/data/ 下后重试。");
    process.exit(1);
  }

  const wb = XLSX.readFile(INPUT);
  const sheet = wb.Sheets["Sheet1"] || wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const regions = parseSheet(rows);

  const json = JSON.stringify(regions, null, 2);
  const out = `/**
 * 由 scripts/build-china-regions-from-xls.cjs 从 docs/data/全国省市区划分数据表.xls 生成，请勿手改。
 * 更新数据：npm run data:china-regions
 * 直辖市：区县挂在与省同名的「市」下；台湾/港澳在源表无下级时补一条占位区县便于选择器不为空。
 */
export type ChinaRegionCity = { name: string; districts: string[] };
export type ChinaRegionProvince = { name: string; cities: ChinaRegionCity[] };

export const CHINA_REGIONS: ChinaRegionProvince[] = ${json};
`;

  fs.writeFileSync(OUTPUT, out, "utf8");
  console.log("Wrote", OUTPUT, "provinces:", regions.length);
}

main();
