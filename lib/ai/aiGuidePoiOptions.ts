import { supabase } from '@/lib/supabase';
import { formatDistance, type LocationCoords } from '@/lib/location/locationService';
import { queryNearbyPoisRPC, type NearbyPoi } from '@/lib/location/nearbyQueries';
import type { PoiType } from '@/lib/ai/aiGuideQueries';

export interface AiGuidePoiOption {
  id: string;
  name: string;
  poiType: PoiType;
  subtitle: string;
}

const DEFAULT_PER_TYPE_LIMIT = 8;
const QUERY_RADIUS_M = 100_000;
const QUERY_LIMIT_PER_TYPE = 120;

function normalizeScenicLevel(label: string | null): string {
  return (label ?? '').replace(/\s+/g, '').toUpperCase();
}

function heritageBatchPriority(label: string | null): number {
  const text = (label ?? '').replace(/\s+/g, '');
  if (!text) return 3;
  if (/\u7b2c(?:\u4e00|1)\u6279/.test(text)) return 0;
  if (/\u7b2c(?:\u4e8c|2)\u6279/.test(text)) return 1;
  return 2;
}

function museumLevelPriority(level: string | null): number {
  const text = (level ?? '').replace(/\s+/g, '');
  if (!text) return 2;
  if (/(\u4e00\u7ea7|1\u7ea7|\u56fd\u5bb6\u4e00\u7ea7)/.test(text)) return 0;
  return 1;
}

function distanceOf(poi: NearbyPoi): number {
  return Number.isFinite(poi.distance_m) ? (poi.distance_m as number) : Number.MAX_SAFE_INTEGER;
}

function scenicSubtitle(poi: NearbyPoi): string {
  const distance = poi.distance_display ?? formatDistance(distanceOf(poi));
  return `${poi.province ?? '\u5f53\u524d\u4f4d\u7f6e\u5468\u8fb9'} \u00b7 5A\u666f\u533a \u00b7 ${distance}`;
}

function heritageSubtitle(poi: NearbyPoi): string {
  const distance = poi.distance_display ?? formatDistance(distanceOf(poi));
  const label = poi.label?.trim() || '\u56fd\u4fdd';
  return `${label} \u00b7 ${distance}`;
}

function museumSubtitle(poi: NearbyPoi, level: string | null): string {
  const distance = poi.distance_display ?? formatDistance(distanceOf(poi));
  const levelText = level?.trim() || '\u535a\u7269\u9986';
  return `${levelText} \u00b7 ${distance}`;
}

async function queryMuseumLevels(ids: string[]): Promise<Map<string, string | null>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase
    .from('catalog_museums')
    .select('id,level')
    .in('id', ids);

  if (error) throw error;

  const result = new Map<string, string | null>();
  for (const item of data ?? []) {
    result.set(item.id, item.level ?? null);
  }
  return result;
}

function mapToOption(poi: NearbyPoi, subtitle: string): AiGuidePoiOption {
  return {
    id: poi.id,
    name: poi.name,
    poiType: poi.poi_type,
    subtitle,
  };
}

export async function queryAiGuidePoiOptions(
  center: LocationCoords,
  perTypeLimit = DEFAULT_PER_TYPE_LIMIT,
): Promise<AiGuidePoiOption[]> {
  const [scenicRaw, heritageRaw, museumRaw] = await Promise.all([
    queryNearbyPoisRPC(center, {
      radiusM: QUERY_RADIUS_M,
      poiType: 'scenic',
      limit: QUERY_LIMIT_PER_TYPE,
    }),
    queryNearbyPoisRPC(center, {
      radiusM: QUERY_RADIUS_M,
      poiType: 'heritage',
      limit: QUERY_LIMIT_PER_TYPE,
    }),
    queryNearbyPoisRPC(center, {
      radiusM: QUERY_RADIUS_M,
      poiType: 'museum',
      limit: QUERY_LIMIT_PER_TYPE,
    }),
  ]);

  const scenic = scenicRaw
    .filter((poi) => normalizeScenicLevel(poi.label) === '5A')
    .sort((a, b) => distanceOf(a) - distanceOf(b))
    .slice(0, perTypeLimit)
    .map((poi) => mapToOption(poi, scenicSubtitle(poi)));

  const heritage = heritageRaw
    .sort((a, b) => {
      const prioDiff = heritageBatchPriority(a.label) - heritageBatchPriority(b.label);
      if (prioDiff !== 0) return prioDiff;
      return distanceOf(a) - distanceOf(b);
    })
    .slice(0, perTypeLimit)
    .map((poi) => mapToOption(poi, heritageSubtitle(poi)));

  const museumLevels = await queryMuseumLevels(museumRaw.map((poi) => poi.id));
  const museum = museumRaw
    .sort((a, b) => {
      const prioDiff =
        museumLevelPriority(museumLevels.get(a.id) ?? null) -
        museumLevelPriority(museumLevels.get(b.id) ?? null);
      if (prioDiff !== 0) return prioDiff;
      return distanceOf(a) - distanceOf(b);
    })
    .slice(0, perTypeLimit)
    .map((poi) => mapToOption(poi, museumSubtitle(poi, museumLevels.get(poi.id) ?? null)));

  return [...heritage, ...museum, ...scenic];
}
