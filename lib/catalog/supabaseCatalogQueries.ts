/**
 * lib/catalog/supabaseCatalogQueries.ts
 * 三类名录 POI 查询（地图用 + 发现页列表）
 */
import { CULTURE_MAP_DEFAULT_CENTER } from '@/constants/cultureMapData';
import type { MuseumCardItem, ScenicFeature } from '@/constants/CatalogData';
import {
  isDistrictChosen,
  sortScenicFeaturesByLevel,
} from '@/lib/catalog/catalogQueryFilters';
import { cityMatchValues, provincialMatchValues } from '@/lib/catalog/locationMatchVariants';
import { supabase } from '@/lib/supabase';

export type CultureMapLayer = 'scenic' | 'heritage' | 'museum';

/** 地图 POI 返回结构（适配 CultureMapPoi） */
export interface MapPoi {
  id: string;
  name: string;
  kind: CultureMapLayer;
  lng: number;
  lat: number;
  scenicLevel?: string;
  label?: string;
}

/** 发现页 A 级景区查询参数 */
export interface ScenicQueryOptions {
  province?: string;
  city?: string;
  level?: string;
  keyword?: string;
  limit?: number;
  page?: number;
  pageSize?: number;
}

/** 发现页重点文保查询参数 */
export interface HeritageQueryOptions {
  province?: string;
  city?: string;
  district?: string;
  era?: string;
  category?: string;
  batch?: string;
  keyword?: string;
  limit?: number;
  page?: number;
  pageSize?: number;
}

/** 重点文保筛选选项 */
export interface HeritageFilterOptions {
  eras: string[];
  categories: string[];
  batches: string[];
}

/** 发现页博物馆查询参数 */
export interface MuseumQueryOptions {
  province?: string;
  city?: string;
  district?: string;
  keyword?: string;
  sortBy?: string;
  limit?: number;
  page?: number;
  pageSize?: number;
}

const PLACEHOLDER_VALUES = new Set(['请选择', '璇烽€夋嫨', '???']);
const ALL_VALUES = new Set(['全部', '鍏ㄩ儴', '??']);
const ALL_LEVEL_VALUES = new Set(['全部等级', '鍏ㄩ儴绛夌骇']);

function isPlaceholderValue(value?: string) {
  return Boolean(value) && PLACEHOLDER_VALUES.has(value as string);
}

function isAllValue(value?: string) {
  return Boolean(value) && ALL_VALUES.has(value as string);
}

function isAllLevelValue(value?: string) {
  return Boolean(value) && ALL_LEVEL_VALUES.has(value as string);
}

function escapeIlikeValue(value: string) {
  return value.replace(/[%_,]/g, ' ').trim();
}

function resolvePaging(
  page?: number,
  pageSize?: number,
  fallbackSize = 100,
) {
  const safePage = Number.isFinite(page) && (page as number) > 0 ? Math.floor(page as number) : 1;
  const safePageSize =
    Number.isFinite(pageSize) && (pageSize as number) > 0
      ? Math.floor(pageSize as number)
      : fallbackSize;
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;
  return { from, to, safePage, safePageSize };
}

/**
 * 按图层查询地图 POI（lng/lat 非空）
 * scenicFilter: 'all' | '4A' | '5A'
 */
export async function queryMapPois(
  layer: CultureMapLayer,
  scenicFilter: 'all' | '4A' | '5A' = 'all',
  options: { limit?: number } = {},
): Promise<MapPoi[]> {
  const { limit = 500 } = options;

  if (layer === 'scenic') {
    let q = supabase
      .from('catalog_scenic_spots')
      .select('id,name,lng_wgs84,lat_wgs84,rating,provincial,city,full_address,images')
      .not('lng_wgs84', 'is', null)
      .not('lat_wgs84', 'is', null);

    if (scenicFilter === '4A') q = q.eq('rating', '4A');
    if (scenicFilter === '5A') q = q.eq('rating', '5A');

    const { data, error } = await q.limit(limit);
    if (error) throw error;

    return (data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      kind: 'scenic' as CultureMapLayer,
      lng: r.lng_wgs84,
      lat: r.lat_wgs84,
      scenicLevel: r.rating ?? undefined,
      province: r.provincial,
    }));
  }

  if (layer === 'heritage') {
    const { data, error } = await supabase
      .from('catalog_heritage_sites')
      .select('id,name,longitude,latitude,batch,provincial')
      .not('longitude', 'is', null)
      .not('latitude', 'is', null)
      .limit(limit);

    if (error) throw error;

    return (data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      kind: 'heritage' as CultureMapLayer,
      lng: r.longitude,
      lat: r.latitude,
      label: r.batch ?? undefined,
    }));
  }

  const { data, error } = await supabase
    .from('catalog_museums')
    .select('id,name,lng,lat,pname')
    .not('lng', 'is', null)
    .not('lat', 'is', null)
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    kind: 'museum' as CultureMapLayer,
    lng: r.lng,
    lat: r.lat,
    label: undefined,
  }));
}

/**
 * 查询 A 级景区列表（发现页用）
 * 数据库列映射: provincial→province, rating→level, lng_wgs84→lng, lat_wgs84→lat
 */
export async function queryScenicSpots(
  options: ScenicQueryOptions = {},
): Promise<ScenicFeature[]> {
  const {
    level,
    province,
    city,
    keyword,
    limit = 100,
    page,
    pageSize,
  } = options;
  const paging = resolvePaging(page, pageSize, limit);

  let q = supabase
    .from('catalog_scenic_spots')
    .select('id,name,rating,provincial,city,county,full_address,lng_wgs84,lat_wgs84,images,recommend,sort');

  if (level && !isAllLevelValue(level)) {
    q = q.eq('rating', level);
  }

  if (province && !isPlaceholderValue(province)) {
    const pv = provincialMatchValues(province);
    q = pv.length === 1 ? q.eq('provincial', pv[0]) : q.in('provincial', pv);
  }

  if (city && !isPlaceholderValue(city)) {
    const cv = cityMatchValues(city);
    q = cv.length === 1 ? q.eq('city', cv[0]) : q.in('city', cv);
  }

  if (keyword && keyword.trim()) {
    const escapedKeyword = escapeIlikeValue(keyword);
    if (escapedKeyword) {
      q = q.or(
        `name.ilike.%${escapedKeyword}%,full_address.ilike.%${escapedKeyword}%,city.ilike.%${escapedKeyword}%,rating.ilike.%${escapedKeyword}%`,
      );
    }
  }

  q = q
    .order('rating', { ascending: false })
    .order('name', { ascending: true })
    .range(paging.from, paging.to);

  const { data, error } = await q;
  if (error) throw error;
  if (!data) return [];

  const results: ScenicFeature[] = data.map((r) => ({
    id: r.id,
    title: r.name,
    subtitle: r.full_address || r.city || '',
    image: r.images?.[0] || '',
    tags: r.rating ? [`${r.rating}级景区`] : [],
    province: r.provincial || undefined,
    city: r.city || undefined,
    district: r.county || undefined,
    level: r.rating || undefined,
    lng: typeof r.lng_wgs84 === 'number' ? r.lng_wgs84 : undefined,
    lat: typeof r.lat_wgs84 === 'number' ? r.lat_wgs84 : undefined,
    distance: undefined,
    rating: undefined,
  }));

  return sortScenicFeaturesByLevel(results);
}

function uniqueSorted(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.map((v) => String(v ?? '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
}

function batchSort(values: string[]): string[] {
  const batchNumberMap: Record<string, number> = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
  };

  const parseBatch = (value: string) => {
    const m = value.match(/^第([一二三四五六七八九十]+)批$/);
    if (!m) return Number.MAX_SAFE_INTEGER;
    const raw = m[1];
    if (raw === '十') return 10;
    if (raw.length === 1) return batchNumberMap[raw] ?? Number.MAX_SAFE_INTEGER;
    if (raw === '十一') return 11;
    if (raw === '十二') return 12;
    if (raw.startsWith('十')) {
      return 10 + (batchNumberMap[raw.slice(1)] ?? 0);
    }
    if (raw.endsWith('十')) {
      return (batchNumberMap[raw[0]] ?? 0) * 10;
    }
    if (raw.includes('十')) {
      const [tens, ones] = raw.split('十');
      return (batchNumberMap[tens] ?? 0) * 10 + (batchNumberMap[ones] ?? 0);
    }
    return Number.MAX_SAFE_INTEGER;
  };

  return [...values].sort((a, b) => {
    const da = parseBatch(a);
    const db = parseBatch(b);
    if (da !== db) return da - db;
    return a.localeCompare(b, 'zh-Hans-CN');
  });
}

/** 查询重点文保筛选项（era/category/batch） */
export async function queryHeritageFilterOptions(
  options: { limit?: number } = {},
): Promise<HeritageFilterOptions> {
  const { limit = 6000 } = options;

  const { data, error } = await supabase
    .from('catalog_heritage_sites')
    .select('era,category,batch')
    .limit(limit);

  if (error) throw error;

  const rows = data ?? [];
  const eras = uniqueSorted(rows.map((row) => row.era));
  const categories = uniqueSorted(rows.map((row) => row.category));
  const batches = batchSort(uniqueSorted(rows.map((row) => row.batch)));

  return {
    eras,
    categories,
    batches,
  };
}

/**
 * 查询重点文保列表（发现页用）
 * 数据库列映射: provincial→province, city→city, county→district, batch→label
 */
export async function queryHeritageSites(
  options: HeritageQueryOptions = {},
): Promise<MuseumCardItem[]> {
  const {
    province,
    city,
    district,
    era,
    category,
    batch,
    keyword,
    limit = 100,
    page,
    pageSize,
  } = options;
  const paging = resolvePaging(page, pageSize, limit);

  let q = supabase
    .from('catalog_heritage_sites')
    .select('id,name,era,category,batch,provincial,city,county,address,longitude,latitude,recommend,sort,images')
    .range(paging.from, paging.to);

  if (province && !isPlaceholderValue(province)) {
    const pv = provincialMatchValues(province);
    q = pv.length === 1 ? q.eq('provincial', pv[0]) : q.in('provincial', pv);
  }

  if (city && !isPlaceholderValue(city)) {
    const cv = cityMatchValues(city);
    q = cv.length === 1 ? q.eq('city', cv[0]) : q.in('city', cv);
  }

  if (isDistrictChosen(district ?? '')) {
    q = q.eq('county', district);
  }

  if (era && !isAllValue(era)) {
    q = q.eq('era', era);
  }

  if (category && !isAllValue(category)) {
    q = q.eq('category', category);
  }

  if (batch && !isAllValue(batch)) {
    q = q.eq('batch', batch);
  }

  const { data, error } = await q;
  if (error) throw error;
  if (!data) return [];

  let results: MuseumCardItem[] = data.map((r) => ({
    id: r.id,
    title: r.name,
    location: r.address || [r.provincial, r.city, r.county].filter(Boolean).join(' · ') || '',
    distance: '',
    image: r.images?.[0] || '',
    tags: [
      r.era ? `${r.era}代` : null,
      r.category || null,
      r.batch || null,
    ].filter(Boolean) as string[],
    provinceFull: r.provincial || undefined,
    cityLabel: r.city || undefined,
    districtLabel: r.county || undefined,
    lng: typeof r.longitude === 'number' ? r.longitude : undefined,
    lat: typeof r.latitude === 'number' ? r.latitude : undefined,
  }));

  if (keyword && keyword.trim()) {
    const kw = keyword.toLowerCase();
    results = results.filter(
      (item) =>
        item.title?.toLowerCase().includes(kw) ||
        item.location?.toLowerCase().includes(kw) ||
        item.tags?.some((t) => t.toLowerCase().includes(kw)),
    );
  }

  return results;
}

/**
 * 查询博物馆列表（发现页用）
 * 数据库列映射: pname→provinceFull, cityname→cityLabel, adname→districtLabel
 */
export async function queryMuseums(
  options: MuseumQueryOptions = {},
): Promise<MuseumCardItem[]> {
  const {
    province,
    city,
    district,
    keyword,
    sortBy,
    limit = 100,
    page,
    pageSize,
  } = options;
  const paging = resolvePaging(page, pageSize, limit);

  let q = supabase
    .from('catalog_museums')
    .select('id,name,address,tel,pname,cityname,adname,lng,lat,recommend,sort,images')
    .range(paging.from, paging.to);

  if (province && !isPlaceholderValue(province)) {
    const pv = provincialMatchValues(province);
    q = pv.length === 1 ? q.eq('pname', pv[0]) : q.in('pname', pv);
  }

  if (city && !isPlaceholderValue(city)) {
    const cv = cityMatchValues(city);
    q = cv.length === 1 ? q.eq('cityname', cv[0]) : q.in('cityname', cv);
  }

  if (isDistrictChosen(district ?? '')) {
    q = q.eq('adname', district);
  }

  const { data, error } = await q;
  if (error) throw error;
  if (!data) return [];

  let results: MuseumCardItem[] = data.map((r) => ({
    id: r.id,
    title: r.name,
    location: [r.pname, r.cityname, r.adname, r.address].filter(Boolean).join(' · '),
    distance: '',
    image: r.images?.[0] || '',
    tags: [],
    provinceFull: r.pname || undefined,
    cityLabel: r.cityname || undefined,
    districtLabel: r.adname || undefined,
    lng: typeof r.lng === 'number' ? r.lng : undefined,
    lat: typeof r.lat === 'number' ? r.lat : undefined,
  }));

  if (keyword && keyword.trim()) {
    const kw = keyword.toLowerCase();
    results = results.filter(
      (item) =>
        item.title?.toLowerCase().includes(kw) ||
        item.location?.toLowerCase().includes(kw) ||
        item.tags?.some((t) => t.toLowerCase().includes(kw)),
    );
  }

  if (sortBy === '名称排序' || sortBy === '鍚嶇О鎺掑簭') {
    results.sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans-CN'));
  }

  return results;
}

/** 默认中心（西安） */
export const DEFAULT_MAP_CENTER = CULTURE_MAP_DEFAULT_CENTER;
