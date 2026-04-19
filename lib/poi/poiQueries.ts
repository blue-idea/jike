/**
 * lib/poi/poiQueries.ts
 *
 * POI 详情查询（从 Supabase 三类名录按 id 查询完整字段）
 * EARS-1 覆盖：从列表或地图进入 POI 详情时展示结构化文化信息
 * EARS-2 覆盖：版本更新或下拉刷新时重新拉取最新内容
 */
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('缺少 Supabase 环境变量');
  return createClient(url, key);
}

export type PoiType = 'scenic' | 'heritage' | 'museum';

export interface BasePoiDetail {
  id: string;
  name: string;
  poi_type: PoiType;
  lng: number | null;
  lat: number | null;
  province: string | null;
  recommend: string | null;
  sort: number | null;
  images: string[] | null;
  source_batch: string | null;
  data_version: number | null;
  imported_at: string | null;
}

export interface ScenicPoiDetail extends BasePoiDetail {
  poi_type: 'scenic';
  level: string | null;
  address_code: string | null;
}

export interface HeritagePoiDetail extends BasePoiDetail {
  poi_type: 'heritage';
  category_code: string | null;
  address: string | null;
  heritage_type: string | null;
  era: string | null;
  batch: string | null;
  remark: string | null;
  city: string | null;
  district: string | null;
  search_name: string | null;
  dynasty_tag: string[] | null;
  category_tag: string[] | null;
}

export interface MuseumPoiDetail extends BasePoiDetail {
  poi_type: 'museum';
  quality_level: string | null;
  museum_nature: string | null;
  free_admission: boolean | null;
  city: string | null;
  district: string | null;
}

export type PoiDetail = ScenicPoiDetail | HeritagePoiDetail | MuseumPoiDetail;

/** 根据 POI 类型查询详情（按 id 精确查询单条） */
export async function queryPoiDetail(
  id: string,
  poiType: PoiType,
): Promise<PoiDetail | null> {
  const supabase = getSupabaseClient();
  const tableMap: Record<PoiType, string> = {
    scenic: 'catalog_scenic_spots',
    heritage: 'catalog_heritage_sites',
    museum: 'catalog_museums',
  };
  const table = tableMap[poiType];
  const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    throw error;
  }
  return data as PoiDetail;
}

/** 获取 POI 数据版本（用于缓存失效判定） */
export async function queryPoiVersion(
  id: string,
  poiType: PoiType,
): Promise<number | null> {
  const supabase = getSupabaseClient();
  const tableMap: Record<PoiType, string> = {
    scenic: 'catalog_scenic_spots',
    heritage: 'catalog_heritage_sites',
    museum: 'catalog_museums',
  };
  const { data, error } = await supabase
    .from(tableMap[poiType])
    .select('data_version')
    .eq('id', id)
    .single();
  if (error) return null;
  return (data as { data_version: number | null }).data_version;
}
