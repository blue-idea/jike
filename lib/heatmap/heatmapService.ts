/**
 * lib/heatmap/heatmapService.ts
 *
 * 热力图层服务（纯热力模式）
 */
import { type LocationCoords } from '@/lib/location/locationService';
import { type NearbyPoi } from '@/lib/location/nearbyQueries';

export type HeatmapMode = 'traffic' | 'heat';
export type HeatmapDegradedReason = 'no_key' | 'no_location' | 'network_error';

export interface HeatmapResult {
  layer_data: number[];
  coverage: 'full' | 'partial' | 'none';
}

export interface HeatmapAvailabilityResult {
  available: boolean;
  reason: HeatmapDegradedReason | null;
}

export type PoiHeatLevel = 'high' | 'medium' | 'low';

export interface PoiTrendInfo {
  poi: NearbyPoi;
  heat_score: number;
  heat_level: PoiHeatLevel;
}

export interface PoiTrendQueryResult {
  items: PoiTrendInfo[];
  success_count: number;
  failed_count: number;
}

const HEATMAP_REQUEST_TIMEOUT_MS = 10000;
const DEFAULT_HEATMAP_RADIUS_M = 3000;

function getAmapKey(): string | null {
  const key = process.env.EXPO_PUBLIC_AMAP_WEB_SERVICE_KEY ?? process.env.EXPO_PUBLIC_AMAP_KEY;
  const normalized = key?.trim();
  return normalized ? normalized : null;
}

export function hasHeatmapKey(): boolean {
  return Boolean(getAmapKey());
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => {
    ctrl.abort();
  }, timeoutMs);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function heatLevelFromScore(score: number): PoiHeatLevel {
  if (score >= 78) return 'high';
  if (score >= 60) return 'medium';
  return 'low';
}

function computeHeatScore(poi: NearbyPoi): number {
  let score = 40;

  if (poi.poi_type === 'scenic') score += 12;
  if (poi.poi_type === 'museum') score += 8;
  if (poi.poi_type === 'heritage') score += 10;
  if (poi.recommend && poi.recommend.trim()) score += 14;

  const sortValue = Number.isFinite(poi.sort) ? (poi.sort as number) : null;
  if (sortValue !== null) {
    if (sortValue <= 10) score += 12;
    else if (sortValue <= 50) score += 7;
    else score += 3;
  }

  const distance = poi.distance_m ?? Number.MAX_SAFE_INTEGER;
  if (distance <= 2000) score += 16;
  else if (distance <= 5000) score += 11;
  else if (distance <= 10000) score += 6;
  else score += 2;

  return Math.max(1, Math.min(99, Math.round(score)));
}

/**
 * 基于附近 POI 生成热力信息列表（不依赖路况能力）
 */
export async function queryPoiTrendInfos(
  pois: NearbyPoi[],
  _options: Record<string, never> = {},
): Promise<PoiTrendQueryResult> {
  if (!hasHeatmapKey()) {
    throw new Error('no_key');
  }
  if (!pois.length) {
    return { items: [], success_count: 0, failed_count: 0 };
  }

  const items = pois
    .map((poi) => {
      const heatScore = computeHeatScore(poi);
      return {
        poi,
        heat_score: heatScore,
        heat_level: heatLevelFromScore(heatScore),
      };
    })
    .sort((a, b) => b.heat_score - a.heat_score || (a.poi.distance_m ?? 0) - (b.poi.distance_m ?? 0));

  return { items, success_count: 0, failed_count: 0 };
}

/** 查询实时图层能力可用性（高德） */
export async function probeHeatmapAvailability(
  center: LocationCoords,
  radiusM = DEFAULT_HEATMAP_RADIUS_M,
): Promise<HeatmapAvailabilityResult> {
  const key = getAmapKey();
  if (!key) {
    return { available: false, reason: 'no_key' };
  }

  const params = new URLSearchParams({
    key,
    location: `${center.lng},${center.lat}`,
    radius: String(Math.round(radiusM)),
    extensions: 'base',
    output: 'JSON',
  });

  try {
    const res = await fetchWithTimeout(
      `https://restapi.amap.com/v3/traffic/status/circle?${params}`,
      HEATMAP_REQUEST_TIMEOUT_MS,
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { status?: string };
    if (json.status !== '1') throw new Error('Gaode traffic API status != 1');
    return { available: true, reason: null };
  } catch {
    return { available: false, reason: 'network_error' };
  }
}

/** 查询热力图层数据（当前用于可用性探测占位） */
export async function queryHeatmapData(
  center: LocationCoords,
  radiusM = DEFAULT_HEATMAP_RADIUS_M,
): Promise<HeatmapResult> {
  const availability = await probeHeatmapAvailability(center, radiusM);
  if (!availability.available) {
    return { layer_data: [], coverage: 'none' };
  }
  return { layer_data: [1], coverage: 'partial' };
}

/** 降级说明文案 */
export function getDegradedMessage(reason: HeatmapDegradedReason): string {
  if (reason === 'no_key') return '请配置高德 KEY 以显示实时热力';
  if (reason === 'no_location') return '需要定位权限才能显示周边热力';
  return '热力数据暂时不可用，请稍后重试';
}
