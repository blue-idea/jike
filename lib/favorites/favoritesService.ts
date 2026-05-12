/**
 * lib/favorites/favoritesService.ts
 *
 * 收藏 / 想去 / 已去 数据服务
 * - 统一使用 public.user_collection（kind: favorite | want_to_go | visited）
 * - 对外部 POI（非 uuid id）做稳定映射，避免 PostgREST uuid 过滤报错
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { type PoiType } from '@/lib/poi/poiQueries';

export type FavoriteType = 'favorite' | 'want_to_go' | 'visited';

export interface FavoriteItem {
  id: string;
  poi_id: string;
  poi_type: PoiType;
  kind: FavoriteType;
  created_at: string;
  poi_name: string;
  province: string | null;
  city: string | null;
  district: string | null;
  level_tag: string | null;
  image_url: string | null;
}

export interface FavoritesStats {
  favorite_count: number;
  want_to_go_count: number;
  visited_count: number;
  total_interactions: number;
}

export interface FavoritePoiSnapshot {
  poi_name?: string;
  province?: string | null;
  city?: string | null;
  district?: string | null;
  level_tag?: string | null;
  image_url?: string | null;
}

interface UserCollectionRow {
  id: string;
  poi_id: string;
  poi_type: PoiType;
  kind: FavoriteType;
  created_at: string;
}

interface PoiSummary {
  poi_name: string;
  province: string | null;
  city: string | null;
  district: string | null;
  level_tag: string | null;
  image_url: string | null;
  source_poi_id?: string;
}

const EMPTY_SUMMARY: PoiSummary = {
  poi_name: '未知地标',
  province: null,
  city: null,
  district: null,
  level_tag: null,
  image_url: null,
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EXTERNAL_POI_SUMMARY_CACHE_KEY = 'favorites:external_poi_summary:v1';

function normalizePoiId(poiId: string): string {
  return poiId.trim();
}

function isValidPoiUuid(poiId: string): boolean {
  return UUID_REGEX.test(normalizePoiId(poiId));
}

function fnv1a32(input: string, seed: number): number {
  let hash = seed >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function toHex8(value: number): string {
  return (value >>> 0).toString(16).padStart(8, '0');
}

function deterministicUuidFromText(input: string): string {
  const h1 = fnv1a32(input, 0x811c9dc5);
  const h2 = fnv1a32(input, 0x9e3779b1);
  const h3 = fnv1a32(input, 0x85ebca6b);
  const h4 = fnv1a32(input, 0xc2b2ae35);

  const chars = `${toHex8(h1)}${toHex8(h2)}${toHex8(h3)}${toHex8(h4)}`.slice(0, 32).split('');
  chars[12] = '4';
  const variant = parseInt(chars[16], 16);
  chars[16] = ((variant & 0x3) | 0x8).toString(16);
  const hex = chars.join('');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function toCollectionPoiId(poiId: string, poiType: PoiType): string {
  const normalized = normalizePoiId(poiId);
  if (isValidPoiUuid(normalized)) return normalized;
  return deterministicUuidFromText(`external:${poiType}:${normalized}`);
}

function isExternalPoiId(poiId: string): boolean {
  return !isValidPoiUuid(normalizePoiId(poiId));
}

async function readExternalSummaryCache(): Promise<Record<string, PoiSummary>> {
  try {
    const raw = await AsyncStorage.getItem(EXTERNAL_POI_SUMMARY_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, PoiSummary>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeExternalSummaryCache(cache: Record<string, PoiSummary>): Promise<void> {
  try {
    await AsyncStorage.setItem(EXTERNAL_POI_SUMMARY_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // 忽略缓存写入失败，不影响主流程
  }
}

async function cacheExternalPoiSummary(
  canonicalPoiId: string,
  originalPoiId: string,
  poiName: string,
  snapshot?: FavoritePoiSnapshot,
): Promise<void> {
  const cache = await readExternalSummaryCache();
  const existing = cache[canonicalPoiId];

  cache[canonicalPoiId] = {
    poi_name: snapshot?.poi_name ?? existing?.poi_name ?? poiName,
    province: snapshot?.province ?? existing?.province ?? null,
    city: snapshot?.city ?? existing?.city ?? null,
    district: snapshot?.district ?? existing?.district ?? null,
    level_tag: snapshot?.level_tag ?? existing?.level_tag ?? null,
    image_url: snapshot?.image_url ?? existing?.image_url ?? null,
    source_poi_id: originalPoiId,
  };

  await writeExternalSummaryCache(cache);
}

async function getExternalPoiSummaryMap(canonicalPoiIds: string[]): Promise<Map<string, PoiSummary>> {
  if (canonicalPoiIds.length === 0) return new Map();
  const cache = await readExternalSummaryCache();
  const map = new Map<string, PoiSummary>();

  for (const id of canonicalPoiIds) {
    const summary = cache[id];
    if (summary) map.set(id, summary);
  }

  return map;
}

async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

function toFavoriteItem(row: UserCollectionRow, summary: PoiSummary | undefined): FavoriteItem {
  const safeSummary = summary ?? EMPTY_SUMMARY;
  return {
    id: row.id,
    poi_id: safeSummary.source_poi_id ?? row.poi_id,
    poi_type: row.poi_type,
    kind: row.kind,
    created_at: row.created_at,
    poi_name: safeSummary.poi_name,
    province: safeSummary.province,
    city: safeSummary.city,
    district: safeSummary.district,
    level_tag: safeSummary.level_tag,
    image_url: safeSummary.image_url,
  };
}

async function loadPoiSummaryMap(rows: UserCollectionRow[]): Promise<Map<string, PoiSummary>> {
  const scenicIds = Array.from(new Set(rows.filter((r) => r.poi_type === 'scenic').map((r) => r.poi_id)));
  const heritageIds = Array.from(new Set(rows.filter((r) => r.poi_type === 'heritage').map((r) => r.poi_id)));
  const museumIds = Array.from(new Set(rows.filter((r) => r.poi_type === 'museum').map((r) => r.poi_id)));

  const summaryMap = new Map<string, PoiSummary>();

  if (scenicIds.length > 0) {
    const { data } = await supabase
      .from('catalog_scenic_spots')
      .select('id,name,provincial,city,county,rating,images')
      .in('id', scenicIds);

    for (const item of data ?? []) {
      summaryMap.set(`scenic:${item.id}`, {
        poi_name: item.name,
        province: item.provincial ?? null,
        city: item.city ?? null,
        district: item.county ?? null,
        level_tag: item.rating ?? null,
        image_url: item.images?.[0] ?? null,
      });
    }
  }

  if (heritageIds.length > 0) {
    const { data } = await supabase
      .from('catalog_heritage_sites')
      .select('id,name,provincial,city,county,batch,images')
      .in('id', heritageIds);

    for (const item of data ?? []) {
      summaryMap.set(`heritage:${item.id}`, {
        poi_name: item.name,
        province: item.provincial ?? null,
        city: item.city ?? null,
        district: item.county ?? null,
        level_tag: item.batch ?? null,
        image_url: item.images?.[0] ?? null,
      });
    }
  }

  if (museumIds.length > 0) {
    const { data } = await supabase
      .from('catalog_museums')
      .select('id,name,pname,cityname,adname,level,images')
      .in('id', museumIds);

    for (const item of data ?? []) {
      summaryMap.set(`museum:${item.id}`, {
        poi_name: item.name,
        province: item.pname ?? null,
        city: item.cityname ?? null,
        district: item.adname ?? null,
        level_tag: item.level ?? null,
        image_url: item.images?.[0] ?? null,
      });
    }
  }

  const unresolvedIds = rows
    .map((row) => row.poi_id)
    .filter((id, idx, arr) => arr.indexOf(id) === idx)
    .filter((id) => !rows.some((row) => summaryMap.has(`${row.poi_type}:${id}`) && row.poi_id === id));

  if (unresolvedIds.length > 0) {
    const externalMap = await getExternalPoiSummaryMap(unresolvedIds);
    for (const row of rows) {
      const externalSummary = externalMap.get(row.poi_id);
      if (!externalSummary) continue;
      const key = `${row.poi_type}:${row.poi_id}`;
      if (!summaryMap.has(key)) summaryMap.set(key, externalSummary);
    }
  }

  return summaryMap;
}

export async function addFavorite(
  poiId: string,
  poiName: string,
  poiType: PoiType,
  kind: FavoriteType,
  snapshot?: FavoritePoiSnapshot,
): Promise<{ success: boolean; error?: string }> {
  const normalizedPoiId = normalizePoiId(poiId);
  const canonicalPoiId = toCollectionPoiId(normalizedPoiId, poiType);

  const userId = await getUserId();
  if (!userId) return { success: false, error: '请先登录' };

  if (isExternalPoiId(normalizedPoiId)) {
    await cacheExternalPoiSummary(canonicalPoiId, normalizedPoiId, poiName, snapshot);
  }

  const { error: removeOtherKindsError } = await supabase
    .from('user_collection')
    .delete()
    .eq('user_id', userId)
    .eq('poi_id', canonicalPoiId)
    .eq('poi_type', poiType)
    .neq('kind', kind);

  if (removeOtherKindsError) {
    return { success: false, error: '更新收藏分类失败，请重试' };
  }

  const { error } = await supabase
    .from('user_collection')
    .upsert(
      {
        user_id: userId,
        poi_id: canonicalPoiId,
        poi_type: poiType,
        kind,
      },
      {
        onConflict: 'user_id,kind,poi_type,poi_id',
      },
    );

  if (error) return { success: false, error: '添加收藏失败，请重试' };
  return { success: true };
}

export async function removeFavorite(
  poiId: string,
  kind: FavoriteType,
  poiType?: PoiType,
): Promise<{ success: boolean; error?: string }> {
  const normalizedPoiId = normalizePoiId(poiId);
  const canonicalPoiId = toCollectionPoiId(normalizedPoiId, poiType ?? 'scenic');

  const userId = await getUserId();
  if (!userId) return { success: false, error: '请先登录' };

  let query = supabase
    .from('user_collection')
    .delete()
    .eq('user_id', userId)
    .eq('poi_id', canonicalPoiId)
    .eq('kind', kind);

  if (poiType) {
    query = query.eq('poi_type', poiType);
  }

  const { error } = await query;
  if (error) return { success: false, error: '移除收藏失败，请重试' };
  return { success: true };
}

export async function getFavorites(kind: FavoriteType, limit = 50): Promise<FavoriteItem[]> {
  const userId = await getUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('user_collection')
    .select('id,poi_id,poi_type,kind,created_at')
    .eq('user_id', userId)
    .eq('kind', kind)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  const rows = data as UserCollectionRow[];
  const summaryMap = await loadPoiSummaryMap(rows);
  return rows.map((row) => toFavoriteItem(row, summaryMap.get(`${row.poi_type}:${row.poi_id}`)));
}

export async function clearFavorites(kind: FavoriteType): Promise<{ success: boolean; error?: string }> {
  const userId = await getUserId();
  if (!userId) return { success: false, error: '请先登录' };

  const { error } = await supabase
    .from('user_collection')
    .delete()
    .eq('user_id', userId)
    .eq('kind', kind);

  if (error) return { success: false, error: '清空收藏失败，请重试' };
  return { success: true };
}

export async function getFavoritesStats(): Promise<FavoritesStats> {
  const userId = await getUserId();
  if (!userId) {
    return {
      favorite_count: 0,
      want_to_go_count: 0,
      visited_count: 0,
      total_interactions: 0,
    };
  }

  const { data, error } = await supabase
    .from('user_collection')
    .select('kind')
    .eq('user_id', userId);

  if (error || !data) {
    return {
      favorite_count: 0,
      want_to_go_count: 0,
      visited_count: 0,
      total_interactions: 0,
    };
  }

  let favoriteCount = 0;
  let wantToGoCount = 0;
  let visitedCount = 0;

  for (const row of data as { kind: FavoriteType }[]) {
    if (row.kind === 'favorite') favoriteCount += 1;
    if (row.kind === 'want_to_go') wantToGoCount += 1;
    if (row.kind === 'visited') visitedCount += 1;
  }

  return {
    favorite_count: favoriteCount,
    want_to_go_count: wantToGoCount,
    visited_count: visitedCount,
    total_interactions: favoriteCount + wantToGoCount + visitedCount,
  };
}

export async function isInFavorites(
  poiId: string,
  kind: FavoriteType,
  poiType?: PoiType,
): Promise<boolean> {
  const normalizedPoiId = normalizePoiId(poiId);
  const canonicalPoiId = toCollectionPoiId(normalizedPoiId, poiType ?? 'scenic');

  const userId = await getUserId();
  if (!userId) return false;

  let query = supabase
    .from('user_collection')
    .select('id')
    .eq('user_id', userId)
    .eq('poi_id', canonicalPoiId)
    .eq('kind', kind)
    .limit(1);

  if (poiType) {
    query = query.eq('poi_type', poiType);
  }

  const { data } = await query;
  return Boolean(data && data.length > 0);
}

export async function getFavoriteKind(
  poiId: string,
  poiType: PoiType,
): Promise<FavoriteType | null> {
  const normalizedPoiId = normalizePoiId(poiId);
  const canonicalPoiId = toCollectionPoiId(normalizedPoiId, poiType);

  const userId = await getUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('user_collection')
    .select('kind')
    .eq('user_id', userId)
    .eq('poi_id', canonicalPoiId)
    .eq('poi_type', poiType)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data.kind as FavoriteType;
}

export async function removeFromAllFavorites(
  poiId: string,
  poiType?: PoiType,
): Promise<void> {
  await Promise.all([
    removeFavorite(poiId, 'favorite', poiType),
    removeFavorite(poiId, 'want_to_go', poiType),
    removeFavorite(poiId, 'visited', poiType),
  ]);
}
