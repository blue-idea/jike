/**
 * lib/catalog/supabaseCatalogQueries.ts
 * 三类名录 POI 查询（地图用 + 发现页列表）
 * EARS-1 覆盖：queryMapPois → 更新点位集合
 * EARS-2 覆盖：网络异常时抛出供 CultureMapView 捕获
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
  scenicLevel?: string; // 仅 scenic
  label?: string;       // 国保批次/博物馆等级
}

/** 发现页 A 级景区查询参数 */
export interface ScenicQueryOptions {
  province?: string;
  city?: string;
  district?: string;
  level?: string; // '全部等级' | '5A' | '4A' | '3A' | '2A' | '1A'
  keyword?: string; // 搜索关键词
  limit?: number;
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
    // 数据库列: lng_wgs84, lat_wgs84, rating, provincial
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

  // layer === 'museum'
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
  const { level, province, city, district, keyword, limit = 100 } = options;

  let q = supabase
    .from('catalog_scenic_spots')
    .select(
      'id,name,rating,provincial,city,county,full_address,lng_wgs84,lat_wgs84,images,recommend,sort',
    )
    .limit(limit);

  // 过滤等级
  if (level && level !== '全部等级') {
    q = q.eq('rating', level);
  }

  // 过滤省份（名录数据常为简称，与选择器全称不一致）
  if (province && province !== '请选择') {
    const pv = provincialMatchValues(province);
    q = pv.length === 1 ? q.eq('provincial', pv[0]) : q.in('provincial', pv);
  }

  // 过滤城市
  if (city && city !== '请选择') {
    const cv = cityMatchValues(city);
    q = cv.length === 1 ? q.eq('city', cv[0]) : q.in('city', cv);
  }

  if (isDistrictChosen(district ?? '')) {
    q = q.eq('county', district);
  }

  const { data, error } = await q;
  if (error) throw error;
  if (!data) return [];

  // 映射到前端格式
  let results: ScenicFeature[] = data.map((r) => ({
    id: r.id,
    title: r.name,
    subtitle: r.full_address || r.city || '',
    image: r.images?.[0] || '',
    tags: r.rating ? [`${r.rating}级景区`] : [],
    province: r.provincial || undefined,
    city: r.city || undefined,
    district: r.county || undefined,
    level: r.rating || undefined,
    distance: undefined,
    rating: undefined,
  }));

  // 关键词搜索（前端过滤）
  if (keyword && keyword.trim()) {
    const kw = keyword.toLowerCase();
    results = results.filter(
      (item) =>
        item.title?.toLowerCase().includes(kw) ||
        item.subtitle?.toLowerCase().includes(kw) ||
        item.tags?.some((t) => t.toLowerCase().includes(kw)),
    );
  }

  return sortScenicFeaturesByLevel(results);
}

/** 发现页重点文保查询参数 */
export interface HeritageQueryOptions {
  province?: string;
  city?: string;
  district?: string;
  era?: string;
  category?: string;
  keyword?: string;
  limit?: number;
}

/** 发现页博物馆查询参数 */
export interface MuseumQueryOptions {
  province?: string;
  city?: string;
  district?: string;
  keyword?: string;
  sortBy?: string;
  limit?: number;
}

/**
 * 查询重点文保列表（发现页用）
 * 数据库列映射: provincial→province, city→city, county→district, batch→label,
 * era→heritage_type, category→category, recommend, sort, images
 */
export async function queryHeritageSites(
  options: HeritageQueryOptions = {},
): Promise<MuseumCardItem[]> {
  const { province, city, district, era, category, keyword, limit = 100 } = options;

  let q = supabase
    .from('catalog_heritage_sites')
    .select(
      'id,name,era,category,batch,provincial,city,county,address,longitude,latitude,recommend,sort,images',
    )
    .limit(limit);

  // 过滤省份
  if (province && province !== '请选择') {
    const pv = provincialMatchValues(province);
    q = pv.length === 1 ? q.eq('provincial', pv[0]) : q.in('provincial', pv);
  }

  // 过滤城市
  if (city && city !== '请选择') {
    const cv = cityMatchValues(city);
    q = cv.length === 1 ? q.eq('city', cv[0]) : q.in('city', cv);
  }

  // 过滤区县
  if (isDistrictChosen(district ?? '')) {
    q = q.eq('county', district);
  }

  // 过滤年代（era）
  if (era && era !== '全部') {
    q = q.eq('era', era);
  }

  // 过滤类别（category）
  if (category && category !== '全部') {
    q = q.eq('category', category);
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
      r.batch ? `第${r.batch}批` : null,
    ].filter(Boolean) as string[],
    provinceFull: r.provincial || undefined,
    cityLabel: r.city || undefined,
    districtLabel: r.county || undefined,
  }));

  // 关键词搜索（前端过滤）
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
 * 数据库列映射: pname→provinceFull, cityname→cityLabel, adname→districtLabel,
 * lng/lat, quality_level→qualityLevel, nature→nature, recommend, sort, images
 */
export async function queryMuseums(
  options: MuseumQueryOptions = {},
): Promise<MuseumCardItem[]> {
  const { province, city, district, keyword, sortBy, limit = 100 } = options;

  let q = supabase
    .from('catalog_museums')
    .select(
      'id,name,address,tel,pname,cityname,adname,lng,lat,recommend,sort,images',
    )
    .limit(limit);

  // 过滤省份
  if (province && province !== '请选择') {
    const pv = provincialMatchValues(province);
    q = pv.length === 1 ? q.eq('pname', pv[0]) : q.in('pname', pv);
  }

  // 过滤城市
  if (city && city !== '请选择') {
    const cv = cityMatchValues(city);
    q = cv.length === 1 ? q.eq('cityname', cv[0]) : q.in('cityname', cv);
  }

  // 过滤区县
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
  }));

  // 关键词搜索（前端过滤）
  if (keyword && keyword.trim()) {
    const kw = keyword.toLowerCase();
    results = results.filter(
      (item) =>
        item.title?.toLowerCase().includes(kw) ||
        item.location?.toLowerCase().includes(kw) ||
        item.tags?.some((t) => t.toLowerCase().includes(kw)),
    );
  }

  // 前端排序
  if (sortBy === '名称排序') {
    results.sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans-CN'));
  }
  // 离我最近：数据库无坐标距离计算，维持原始顺序（已按 sort 排序）

  return results;
}

/** 默认中心（西安） */
export const DEFAULT_MAP_CENTER = CULTURE_MAP_DEFAULT_CENTER;
