import { supabase } from '@/lib/supabase';

export type CatalogSortMode = 'recommended' | 'name';

export type ScenicCatalogFilters = {
  province?: string;
  level?: string;
  sortBy?: CatalogSortMode;
  limit?: number;
};

export type HeritageCatalogFilters = {
  province?: string;
  city?: string;
  district?: string;
  dynastyTag?: string;
  categoryTag?: string;
  sortBy?: CatalogSortMode;
  limit?: number;
};

export type MuseumCatalogFilters = {
  province?: string;
  qualityLevel?: string;
  nature?: string;
  freeOnly?: boolean;
  sortBy?: CatalogSortMode;
  limit?: number;
};

type OrderOptions = {
  ascending?: boolean;
  nullsFirst?: boolean;
};

type OrderableQuery<T> = {
  order: (column: string, options?: OrderOptions) => T;
};

function hasFilter(value: string | undefined): value is string {
  return Boolean(value && value !== '请选择' && value !== '全部等级' && value !== '无级别');
}

function applyDefaultOrdering<T extends OrderableQuery<T>>(
  query: T,
  sortBy: CatalogSortMode | undefined,
): T {
  if (sortBy === 'name') {
    return query.order('name', { ascending: true });
  }
  return query
    .order('recommend', { ascending: false, nullsFirst: false })
    .order('sort', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true });
}

export async function queryScenicCatalog(filters: ScenicCatalogFilters = {}) {
  let query = supabase
    .from('catalog_scenic_spots')
    .select('*')
    .limit(filters.limit ?? 50);

  if (hasFilter(filters.province)) query = query.eq('province', filters.province);
  if (hasFilter(filters.level)) query = query.eq('level', filters.level);

  return applyDefaultOrdering(query, filters.sortBy);
}

export async function queryHeritageCatalog(filters: HeritageCatalogFilters = {}) {
  let query = supabase
    .from('catalog_heritage_sites')
    .select('*')
    .limit(filters.limit ?? 50);

  if (hasFilter(filters.province)) query = query.eq('province', filters.province);
  if (hasFilter(filters.city)) query = query.eq('city', filters.city);
  if (hasFilter(filters.district)) query = query.eq('district', filters.district);
  if (hasFilter(filters.dynastyTag)) query = query.contains('dynasty_tag', [filters.dynastyTag]);
  if (hasFilter(filters.categoryTag)) query = query.contains('category_tag', [filters.categoryTag]);

  return applyDefaultOrdering(query, filters.sortBy);
}

export async function queryMuseumCatalog(filters: MuseumCatalogFilters = {}) {
  let query = supabase
    .from('catalog_museums')
    .select('*')
    .limit(filters.limit ?? 50);

  if (hasFilter(filters.province)) query = query.eq('province', filters.province);
  if (hasFilter(filters.qualityLevel)) {
    query = query.eq('quality_level', filters.qualityLevel);
  }
  if (hasFilter(filters.nature)) query = query.eq('museum_nature', filters.nature);
  if (filters.freeOnly) query = query.eq('free_admission', true);

  return applyDefaultOrdering(query, filters.sortBy);
}
