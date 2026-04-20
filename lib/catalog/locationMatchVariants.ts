/**
 * 名录 Excel / 原始数据中的 provincial、city 常与行政区划选择器全称不一致
 * （如「内蒙古」vs「内蒙古自治区」、「鄂尔多斯」vs「鄂尔多斯市」）。
 * 生成候选字符串供 PostgREST .in() 匹配。
 */

const AUTONOMOUS_PROVINCE_ALIASES: Record<string, string[]> = {
  内蒙古自治区: ['内蒙古'],
  广西壮族自治区: ['广西'],
  宁夏回族自治区: ['宁夏'],
  新疆维吾尔自治区: ['新疆'],
  西藏自治区: ['西藏'],
};

const MUNICIPALITY_FULL = new Set(['北京市', '上海市', '天津市', '重庆市']);

/** 省份：全称 + 自治区简称 + 去「省」+ 直辖市去「市」等 */
export function provincialMatchValues(uiProvince: string): string[] {
  const s = uiProvince.trim();
  if (!s) return [];
  const out = new Set<string>([s]);

  const short = AUTONOMOUS_PROVINCE_ALIASES[s];
  if (short) short.forEach((x) => out.add(x));
  for (const [full, shorts] of Object.entries(AUTONOMOUS_PROVINCE_ALIASES)) {
    if (shorts.includes(s)) out.add(full);
  }

  if (MUNICIPALITY_FULL.has(s)) {
    out.add(s.slice(0, -1));
  }
  for (const m of MUNICIPALITY_FULL) {
    if (s === m.slice(0, -1)) out.add(m);
  }

  if (s.endsWith('省') && s.length > 1) {
    out.add(s.slice(0, -1));
  }

  return [...out];
}

/** 地级市/州/盟：全称 + 去「市」「盟」等常见后缀 */
export function cityMatchValues(uiCity: string): string[] {
  const s = uiCity.trim();
  if (!s) return [];
  const out = new Set<string>([s]);

  if (s.endsWith('市')) out.add(s.slice(0, -1));
  if (s.endsWith('盟')) out.add(s.slice(0, -1));

  return [...out];
}
