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
  level: string;
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
const ALL_MUSEUM_LEVEL_VALUES = new Set(['全部', '鍏ㄩ儴', '??']);

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

function museumLevelMatches(card: MuseumCardItem, level: string) {
  if (!level || ALL_MUSEUM_LEVEL_VALUES.has(level)) return true;
  const normalized = (card.qualityLevel ?? '').trim() || '未定级';
  return normalized === level;
}

export function filterMuseumCards(
  items: MuseumCardItem[],
  f: MuseumQueryFormState,
): MuseumCardItem[] {
  return items.filter((card) => {
    if (!museumProvinceMatches(card, f.province)) return false;
    if (!museumCityMatches(card, f.city)) return false;
    if (!museumDistrictMatches(card, f.district)) return false;
    if (!museumLevelMatches(card, f.level)) return false;
    return true;
  });
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
  const tags = [f.level].filter((value) => Boolean(value) && !ALL_VALUES.has(value)).join(' · ');
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
