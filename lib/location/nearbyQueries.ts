/**
 * lib/location/nearbyQueries.ts
 *
 * 附近 POI 查询（基于 Supabase catalog_poi_nearby 视图 + nearby_pois RPC）
 * EARS-1 覆盖：定位后查询附近 POI
 * EARS-2 覆盖：按距离排序
 */
import { supabase } from '@/lib/supabase';
import { calcDistance, formatDistance, type LocationCoords } from './locationService';

export type PoiType = 'scenic' | 'heritage' | 'museum';

export interface NearbyPoi {
  id: string;
  name: string;
  poi_type: PoiType;
  lng: number;
  lat: number;
  label: string | null;      // 等级/批次
  province: string | null;
  recommend: string | null;
  sort: number | null;
  images: string[] | null;
  distance_m?: number;         // 计算得出
  distance_display?: string;  // 格式化字符串
  rec_prio?: number;          // recommend 优先级
}

export interface NearbyQueryOptions {
  /** 当前参考点 */
  center: LocationCoords;
  /** 半径（米），默认 5000 */
  radiusM?: number;
  /** POI 类型过滤，undefined 表示全部类型 */
  poiType?: PoiType;
  /** 返回上限，默认 50 */
  limit?: number;
}

/** 使用 Haversine 在客户端计算距离并排序 */
function sortByDistance<T extends NearbyPoi>(items: T[], center: LocationCoords): T[] {
  return items
    .map((item) => ({
      ...item,
      distance_m: calcDistance(center.lat, center.lng, item.lat, item.lng),
    }))
    .sort((a, b) => {
      // 排序链：recommend 非空优先 -> sort 升序 -> 距离升序
      const recA = a.rec_prio ?? 1;
      const recB = b.rec_prio ?? 1;
      if (recA !== recB) return recA - recB;
      const sortA = Number.isFinite(a.sort) ? (a.sort as number) : Number.MAX_SAFE_INTEGER;
      const sortB = Number.isFinite(b.sort) ? (b.sort as number) : Number.MAX_SAFE_INTEGER;
      if (sortA !== sortB) return sortA - sortB;
      return (a.distance_m ?? 0) - (b.distance_m ?? 0);
    })
    .map((item) => ({
      ...item,
      distance_display: item.distance_m != null ? formatDistance(item.distance_m) : undefined,
    }));
}

/**
 * 查询附近 POI（仅 4A/5A 景区 + 国保 + 有坐标博物馆）
 * 使用 catalog_poi_nearby 视图，过滤 poi_type
 */
export async function queryNearbyPois(
  options: NearbyQueryOptions,
): Promise<NearbyPoi[]> {
  const { center, radiusM = 5000, poiType, limit = 50 } = options;
  let query = supabase
    .from('catalog_poi_nearby')
    .select('id,name,poi_type,lng,lat,label,province,recommend,sort,images')
    .limit(limit);

  if (poiType) {
    query = query.eq('poi_type', poiType);
  }

  const { data, error } = await query;
  if (error) throw error;
  if (!data) return [];

  // 客户端过滤半径 + 计算距离 + 排序
  const withDistance: NearbyPoi[] = data
    .map((r) => ({
      id: r.id,
      name: r.name,
      poi_type: r.poi_type as PoiType,
      lng: r.lng,
      lat: r.lat,
      label: r.label,
      province: r.province,
      recommend: r.recommend,
      sort: r.sort,
      images: r.images,
      rec_prio: r.recommend && r.recommend.trim() !== '' ? 0 : 1,
    }))
    .filter((r) => {
      const d = calcDistance(center.lat, center.lng, r.lat, r.lng);
      return d <= radiusM;
    });

  return sortByDistance(withDistance, center);
}

/**
 * 查询附近 POI（使用 RPC，带服务器端 Haversine 计算）
 * 默认半径 5km，返回按距离升序
 */
export async function queryNearbyPoisRPC(
  center: LocationCoords,
  options: { radiusM?: number; poiType?: PoiType; limit?: number } = {},
): Promise<NearbyPoi[]> {
  const { radiusM = 5000, poiType, limit = 50 } = options;
  const { data, error } = await supabase.rpc('nearby_pois', {
    ref_lng: center.lng,
    ref_lat: center.lat,
    radius_m: radiusM,
  });

  if (error) throw error;
  if (!data) return [];

  let results: NearbyPoi[] = (data as NearbyPoi[]).map((r) => ({
    id: r.id,
    name: r.name,
    poi_type: r.poi_type as PoiType,
    lng: r.lng,
    lat: r.lat,
    label: r.label ?? null,
    province: r.province ?? null,
    recommend: r.recommend ?? null,
    sort: r.sort ?? null,
    images: r.images ?? null,
    distance_m: r.distance_m ?? undefined,
    distance_display: r.distance_m != null ? formatDistance(r.distance_m) : undefined,
  }));

  if (poiType) {
    results = results.filter((r) => r.poi_type === poiType);
  }

  // 排序链：recommend 非空优先 -> sort 升序 -> 距离升序
  results.sort((a, b) => {
    const recA = a.recommend && a.recommend.trim() !== '' ? 0 : 1;
    const recB = b.recommend && b.recommend.trim() !== '' ? 0 : 1;
    if (recA !== recB) return recA - recB;
    const sortA = Number.isFinite(a.sort) ? (a.sort as number) : Number.MAX_SAFE_INTEGER;
    const sortB = Number.isFinite(b.sort) ? (b.sort as number) : Number.MAX_SAFE_INTEGER;
    if (sortA !== sortB) return sortA - sortB;
    return (a.distance_m ?? 0) - (b.distance_m ?? 0);
  });

  return results.slice(0, limit);
}
