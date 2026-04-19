import type { MuseumCardItem, ScenicFeature } from '@/constants/CatalogData';

export type ScenicLocationFormState = {
  province: string;
  city: string;
  district: string;
  level: string;
  useAutoLocation: boolean;
};

export type MuseumQueryFormState = ScenicLocationFormState & {
  qualityLevel: string;
  nature: string;
  freeOnly: boolean;
  sortBy: string;
};

const PLACEHOLDER = '请选择';

function isChosen(value: string) {
  return value && value !== PLACEHOLDER;
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
    if (isChosen(f.district) && item.district && item.district !== f.district) {
      return false;
    }
    if (f.level && f.level !== '全部等级' && item.level && item.level !== f.level) {
      return false;
    }
    return true;
  });
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
  if (!isChosen(district)) return true;
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
    if (f.qualityLevel && card.qualityLevel && card.qualityLevel !== f.qualityLevel) {
      return false;
    }
    if (f.nature && card.nature && card.nature !== f.nature) {
      return false;
    }
    if (f.freeOnly && !card.freeEntry) {
      return false;
    }
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
  if (sortBy === '名称排序') {
    copy.sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans-CN'));
    return copy;
  }
  copy.sort(
    (a, b) => parseDistanceKm(a.distance) - parseDistanceKm(b.distance),
  );
  return copy;
}

export function formatScenicResultHint(f: ScenicLocationFormState, count: number) {
  const loc = [f.province, f.city, f.district].filter(isChosen).join(' · ');
  const level =
    f.level && f.level !== '全部等级' ? ` · ${f.level}` : '';
  const mode = f.useAutoLocation ? '当前定位' : '手动筛选';
  return `共 ${count} 条（${mode}${loc ? ` · ${loc}` : ''}${level}）`;
}

export function formatMuseumResultHint(f: MuseumQueryFormState, count: number) {
  const loc = [f.province, f.city, f.district].filter(isChosen).join(' · ');
  const tags = [
    f.qualityLevel !== '无级别' ? f.qualityLevel : null,
    f.nature,
    f.freeOnly ? '仅免费' : null,
    f.sortBy,
  ]
    .filter(Boolean)
    .join(' · ');
  const mode = f.useAutoLocation ? '当前定位' : '手动筛选';
  return `共 ${count} 条（${mode}${loc ? ` · ${loc}` : ''}${tags ? ` · ${tags}` : ''}）`;
}
