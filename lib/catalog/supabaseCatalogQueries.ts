/**
 * lib/catalog/supabaseCatalogQueries.ts
 * 三类名录 POI 查询（地图用）
 * EARS-1 覆盖：queryMapPois → 更新点位集合
 * EARS-2 覆盖：网络异常时抛出供 CultureMapView 捕获
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { CULTURE_MAP_DEFAULT_CENTER } from '@/constants/cultureMapData';

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

function createClient_(): SupabaseClient {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('缺少 Supabase 环境变量');
  return createClient(url, key);
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
  const supabase = createClient_();
  const { limit = 500 } = options;

  if (layer === 'scenic') {
    let q = supabase
      .from('catalog_scenic_spots')
      .select('id,name,lng,lat,level,province')
      .not('lng', 'is', null)
      .not('lat', 'is', null);
    if (scenicFilter === '4A') q = q.eq('level', '4A');
    if (scenicFilter === '5A') q = q.eq('level', '5A');
    const { data, error } = await q.limit(limit);
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      kind: 'scenic' as CultureMapLayer,
      lng: r.lng,
      lat: r.lat,
      scenicLevel: r.level ?? undefined,
    }));
  }

  if (layer === 'heritage') {
    const { data, error } = await supabase
      .from('catalog_heritage_sites')
      .select('id,name,lng,lat,batch,province')
      .not('lng', 'is', null)
      .not('lat', 'is', null)
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      kind: 'heritage' as CultureMapLayer,
      lng: r.lng,
      lat: r.lat,
      label: r.batch ?? undefined,
    }));
  }

  // layer === 'museum'
  const { data, error } = await supabase
    .from('catalog_museums')
    .select('id,name,lng,lat,quality_level,province')
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
    label: r.quality_level ?? undefined,
  }));
}

/** 默认中心（西安） */
export const DEFAULT_MAP_CENTER = CULTURE_MAP_DEFAULT_CENTER;
