import type { MuseumCardItem, ScenicFeature } from '@/constants/CatalogData';

export type ScenicLocationFormState = {
  province: string;
  city: string;
  district: string;
  level: string;
  useAutoLocation: boolean;
};

export type MuseumQueryFormState = {
  province: string;
  city: string;
  district: string;
  sortBy: string;
  useAutoLocation: boolean;
};

export type HeritageQueryFormState = {
  province: string;
  city: string;
  district: string;
  era: string;
  category: string;
  batch: string;
  useAutoLocation: boolean;
};

const PLACEHOLDERS = new Set(['请选择', '璇烽€夋嫨', '???']);
const ALL_VALUES = new Set(['全部', '鍏ㄩ儴', '??']);
const ALL_LEVEL_VALUES = new Set(['全部等级', '鍏ㄩ儴绛夌骇']);

/** 区县：不限制（与“请选择”同为未筛选） */
export const ALL_DISTRICTS = '全部区县';

function isChosen(value: string) {
  return Boolean(value) && !PLACEHOLDERS.has(value);
}

export function isDistrictChosen(value: string) {
  return isChosen(value) && value !== ALL_DISTRICTS;
}

export function filterScenicFeatures(
  items: ScenicFeature[],
  f: ScenicLocationFormState,
): ScenicFeature[] {
  return items.filter((item) => {
    if (isChosen(f.province) && item.province && item.province !== f.province) {
      return false;
    }
    if (isChosen(f.city) && item.city && item.city !== f.city) {
      return false;
    }
    if (f.level && !ALL_LEVEL_VALUES.has(f.level) && item.level && item.level !== f.level) {
      return false;
    }
    return true;
  });
}

const SCENIC_LEVEL_PRIORITY: Record<string, number> = {
  '5A': 0,
  '4A': 1,
  '3A': 2,
  '2A': 3,
};

function scenicLevelPriority(level?: string): number {
  if (!level) return Number.MAX_SAFE_INTEGER;
  return SCENIC_LEVEL_PRIORITY[level] ?? Number.MAX_SAFE_INTEGER;
}

export function sortScenicFeaturesByLevel(items: ScenicFeature[]): ScenicFeature[] {
  const copy = [...items];
  copy.sort((a, b) => {
    const diff = scenicLevelPriority(a.level) - scenicLevelPriority(b.level);
    if (diff !== 0) return diff;
    return a.title.localeCompare(b.title, 'zh-Hans-CN');
  });
  return copy;
}

function museumProvinceMatches(card: MuseumCardItem, province: string) {
  if (!isChosen(province)) return true;
  return card.provinceFull === province;
}

function museumCityMatches(card: MuseumCardItem, city: string) {
  if (!isChosen(city)) return true;
  return card.cityLabel === city;
}

function museumDistrictMatches(card: MuseumCardItem, district: string) {
  if (!isDistrictChosen(district)) return true;
  return card.districtLabel === district;
}

export function filterMuseumCards(
  items: MuseumCardItem[],
  f: MuseumQueryFormState,
): MuseumCardItem[] {
  return items.filter((card) => {
    if (!museumProvinceMatches(card, f.province)) return false;
    if (!museumCityMatches(card, f.city)) return false;
    if (!museumDistrictMatches(card, f.district)) return false;
    return true;
  });
}

function parseDistanceKm(distance: string): number {
  const n = distance.replace(/,/g, '').replace(/km/gi, '').trim();
  const v = parseFloat(n);
  return Number.isFinite(v) ? v : Number.POSITIVE_INFINITY;
}

export function sortMuseumCards(
  items: MuseumCardItem[],
  sortBy: string,
): MuseumCardItem[] {
  const copy = [...items];
  if (sortBy === '名称排序' || sortBy === '鍚嶇О鎺掑簭') {
    copy.sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans-CN'));
    return copy;
  }
  copy.sort(
    (a, b) => parseDistanceKm(a.distance) - parseDistanceKm(b.distance),
  );
  return copy;
}

export function formatScenicResultHint(f: ScenicLocationFormState, count: number) {
  const loc = [
    isChosen(f.province) ? f.province : null,
    isChosen(f.city) ? f.city : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const level =
    f.level && f.level !== '全部等级' ? ` · ${f.level}` : '';
  const mode = f.useAutoLocation ? '当前位置' : '手动筛选';
  return `共 ${count} 条（${mode}${loc ? ` · ${loc}` : ''}${level}）`;
}

export function formatMuseumResultHint(f: MuseumQueryFormState, count: number) {
  const loc = [
    isChosen(f.province) ? f.province : null,
    isChosen(f.city) ? f.city : null,
    isDistrictChosen(f.district) ? f.district : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const tags = [f.sortBy].filter(Boolean).join(' · ');
  const mode = f.useAutoLocation ? '当前位置' : '手动筛选';
  return `共 ${count} 条（${mode}${loc ? ` · ${loc}` : ''}${tags ? ` · ${tags}` : ''}）`;
}

export function formatHeritageResultHint(
  f: HeritageQueryFormState,
  count: number,
) {
  const loc = [
    isChosen(f.province) ? f.province : null,
    isChosen(f.city) ? f.city : null,
    isDistrictChosen(f.district) ? f.district : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const tags = [f.era, f.category, f.batch]
    .filter((value) => Boolean(value) && !ALL_VALUES.has(value))
    .join(' · ');
  const mode = f.useAutoLocation ? '当前位置' : '手动筛选';
  return `共 ${count} 条（${mode}${loc ? ` · ${loc}` : ''}${tags ? ` · ${tags}` : ''}）`;
}
