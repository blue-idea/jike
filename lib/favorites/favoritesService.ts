/**
 * lib/favorites/favoritesService.ts
 *
 * 收藏/想去/已去数据服务
 * EARS-1: 统一写入 Supabase，个人中心分类展示
 * EARS-2: 清空操作二次确认后删除并刷新列表
 */
import { supabase } from '@/lib/supabase';
import { type PoiType } from '@/lib/poi/poiQueries';

export type FavoriteType = 'favorite' | 'want_to_visit' | 'visited';

export interface FavoriteItem {
  id: string;
  user_id: string;
  poi_id: string;
  poi_name: string;
  poi_type: PoiType;
  province: string | null;
  lng: number | null;
  lat: number | null;
  created_at: string;
}

export interface FavoritesStats {
  favorite_count: number;
  want_to_visit_count: number;
  visited_count: number;
  total_interactions: number;
}

/** 获取当前登录用户 ID */
async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

/** 添加收藏/想去/已去 */
export async function addFavorite(
  poiId: string,
  poiName: string,
  poiType: PoiType,
  kind: FavoriteType,
  province?: string | null,
  lng?: number | null,
  lat?: number | null,
): Promise<{ success: boolean; error?: string }> {
  const userId = await getUserId();
  if (!userId) return { success: false, error: '请先登录' };

  const record = {
    user_id: userId,
    poi_id: poiId,
    poi_name: poiName,
    poi_type: poiType,
    province: province ?? null,
    lng: lng ?? null,
    lat: lat ?? null,
    created_at: new Date().toISOString(),
  };

  // 先检查是否已存在
  const { data: existing } = await supabase
    .from(`favorites_${kind}`)
    .select('id')
    .eq('user_id', userId)
    .eq('poi_id', poiId)
    .single();

  if (existing) {
    return { success: true }; // 已存在，不重复添加
  }

  const tableMap: Record<FavoriteType, string> = {
    favorite: 'favorites_favorite',
    want_to_visit: 'favorites_want_to_visit',
    visited: 'favorites_visited',
  };

  const { error } = await supabase.from(tableMap[kind]).insert(record);
  if (error) return { success: false, error: '添加失败，请重试' };

  return { success: true };
}

/** 移除收藏/想去/已去 */
export async function removeFavorite(
  poiId: string,
  kind: FavoriteType,
): Promise<{ success: boolean; error?: string }> {
  const userId = await getUserId();
  if (!userId) return { success: false, error: '请先登录' };

  const tableMap: Record<FavoriteType, string> = {
    favorite: 'favorites_favorite',
    want_to_visit: 'favorites_want_to_visit',
    visited: 'favorites_visited',
  };

  const { error } = await supabase
    .from(tableMap[kind])
    .delete()
    .eq('user_id', userId)
    .eq('poi_id', poiId);

  if (error) return { success: false, error: '移除失败，请重试' };
  return { success: true };
}

/** 查询某类型收藏列表 */
export async function getFavorites(
  kind: FavoriteType,
  limit = 50,
): Promise<FavoriteItem[]> {
  const userId = await getUserId();
  if (!userId) return [];

  const tableMap: Record<FavoriteType, string> = {
    favorite: 'favorites_favorite',
    want_to_visit: 'favorites_want_to_visit',
    visited: 'favorites_visited',
  };

  const { data } = await supabase
    .from(tableMap[kind])
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []) as FavoriteItem[];
}

/** 清空某类型收藏（返回是否成功） */
export async function clearFavorites(
  kind: FavoriteType,
): Promise<{ success: boolean; error?: string }> {
  const userId = await getUserId();
  if (!userId) return { success: false, error: '请先登录' };

  const tableMap: Record<FavoriteType, string> = {
    favorite: 'favorites_favorite',
    want_to_visit: 'favorites_want_to_visit',
    visited: 'favorites_visited',
  };

  const { error } = await supabase
    .from(tableMap[kind])
    .delete()
    .eq('user_id', userId);

  if (error) return { success: false, error: '清空失败，请重试' };
  return { success: true };
}

/** 获取各类型收藏数量统计 */
export async function getFavoritesStats(): Promise<FavoritesStats> {
  const userId = await getUserId();
  if (!userId) {
    return { favorite_count: 0, want_to_visit_count: 0, visited_count: 0, total_interactions: 0 };
  }

  const [fav, want, visited] = await Promise.all([
    supabase.from('favorites_favorite').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('favorites_want_to_visit').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('favorites_visited').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ]);

  const favorite_count = fav.count ?? 0;
  const want_to_visit_count = want.count ?? 0;
  const visited_count = visited.count ?? 0;

  return {
    favorite_count,
    want_to_visit_count,
    visited_count,
    total_interactions: favorite_count + want_to_visit_count + visited_count,
  };
}

/** 查询 POI 是否在某类收藏中 */
export async function isInFavorites(
  poiId: string,
  kind: FavoriteType,
): Promise<boolean> {
  const userId = await getUserId();
  if (!userId) return false;

  const tableMap: Record<FavoriteType, string> = {
    favorite: 'favorites_favorite',
    want_to_visit: 'favorites_want_to_visit',
    visited: 'favorites_visited',
  };

  const { data } = await supabase
    .from(tableMap[kind])
    .select('id')
    .eq('user_id', userId)
    .eq('poi_id', poiId)
    .single();

  return !!data;
}

/** 将 POI 从所有收藏类型中移除 */
export async function removeFromAllFavorites(
  poiId: string,
): Promise<void> {
  await Promise.all([
    removeFavorite(poiId, 'favorite'),
    removeFavorite(poiId, 'want_to_visit'),
    removeFavorite(poiId, 'visited'),
  ]);
}
