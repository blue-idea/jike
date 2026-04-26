/**
 * lib/route/routeService.ts
 *
 * 高德路径规划 + 多点优化
 * EARS-1 覆盖：用户添加多个 POI 并请求规划时支持步行/驾车/公交
 * EARS-2 覆盖：高德 App 未安装时 WebView + JSAPI/HTTP 降级导航
 */
import { Linking, Alert } from 'react-native';
import { type LocationCoords } from '@/lib/location/locationService';

export type RouteMode = 'walk' | 'drive' | 'bus';

export interface RoutePoint {
  id: string;
  name: string;
  lng: number;
  lat: number;
}

export interface RouteSegment {
  instruction: string;
  distance: number;    // 米
  duration: number;   // 秒
  road_name: string;
}

export interface RouteResult {
  total_distance: number;   // 米
  total_duration: number; // 秒
  route_id: string;
  segments: RouteSegment[];
}

const AMAP_WEB_APP_NAME = 'jike';

interface AmapDrivingStep {
  instruction?: string;
  distance?: string;
  duration?: string;
  road?: string;
}

interface AmapWalkingStep {
  instruction?: string;
  distance?: string;
  duration?: string;
  road?: string;
}

interface AmapTransitWalkingStep {
  instruction?: string;
  distance?: string;
  duration?: string;
}

interface AmapTransitBusline {
  name?: string;
  departure_stop?: { name?: string };
  arrival_stop?: { name?: string };
  distance?: string;
  duration?: string;
}

interface AmapTransitSegment {
  walking?: { distance?: string; duration?: string; steps?: AmapTransitWalkingStep[] };
  bus?: { buslines?: AmapTransitBusline[] };
}

interface AmapJsonResponse {
  status?: string;
  info?: string;
  route?: {
    paths?: {
      distance?: string;
      duration?: string;
      steps?: (AmapDrivingStep | AmapWalkingStep)[];
    }[];
    transits?: {
      distance?: string;
      duration?: string;
      segments?: AmapTransitSegment[];
    }[];
  };
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/** 高德 Web API 路径规划（驾车/公交/步行） */
export async function queryGaodeRoute(
  from: LocationCoords,
  to: LocationCoords,
  mode: RouteMode,
): Promise<RouteResult> {
  const key = process.env.EXPO_PUBLIC_AMAP_KEY;
  if (!key) throw new Error('缺少高德 API Key（EXPO_PUBLIC_AMAP_KEY）');

  const params = new URLSearchParams({
    key,
    origin: `${from.lng},${from.lat}`,
    destination: `${to.lng},${to.lat}`,
    output: 'json',
  });

  if (mode === 'bus') {
    params.set('city', '全国');
    params.set('cityd', '全国');
    params.set('strategy', '0');
    params.set('nightflag', '0');
  }

  const baseUrl =
    mode === 'bus'
      ? 'https://restapi.amap.com/v3/direction/transit/integrated'
      : mode === 'drive'
      ? 'https://restapi.amap.com/v3/direction/driving'
      : 'https://restapi.amap.com/v3/direction/walking';

  const res = await fetch(`${baseUrl}?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as AmapJsonResponse;

  if (json.status !== '1') {
    throw new Error(json.info ?? '路径规划失败');
  }

  if (mode === 'bus') {
    const transit = json.route?.transits?.[0];
    if (!transit) throw new Error('未找到公交方案');
    const segments: RouteSegment[] = [];
    for (const segment of transit.segments ?? []) {
      const walking = segment.walking;
      if (walking && parseNumber(walking.distance) > 0) {
        const firstStep = walking.steps?.[0];
        segments.push({
          instruction: firstStep?.instruction ?? '步行接驳',
          distance: parseNumber(walking.distance),
          duration: parseNumber(walking.duration),
          road_name: firstStep?.instruction ?? '步行',
        });
      }

      const busline = segment.bus?.buslines?.[0];
      if (busline && parseNumber(busline.distance) > 0) {
        const dep = busline.departure_stop?.name ?? '起点站';
        const arr = busline.arrival_stop?.name ?? '终点站';
        const lineName = busline.name ?? '公交';
        segments.push({
          instruction: `${lineName}（${dep} -> ${arr}）`,
          distance: parseNumber(busline.distance),
          duration: parseNumber(busline.duration),
          road_name: lineName,
        });
      }
    }

    return {
      total_distance: parseNumber(transit.distance),
      total_duration: parseNumber(transit.duration),
      route_id: `bus-${Date.now()}`,
      segments,
    };
  }

  // driving / walking
  const path = json.route?.paths?.[0];
  if (!path) throw new Error('未找到路线');
  const segments: RouteSegment[] = (path.steps ?? []).map((step) => ({
    instruction: step.instruction ?? '',
    distance: parseNumber(step.distance),
    duration: parseNumber(step.duration),
    road_name: step.road ?? '',
  }));

  return {
    total_distance: parseNumber(path.distance),
    total_duration: parseNumber(path.duration),
    route_id: `${mode}-${Date.now()}`,
    segments,
  };
}

/** 多点路径优化（贪心最近邻） */
export function optimizeRoute(points: RoutePoint[]): RoutePoint[] {
  if (points.length <= 2) return [...points];
  const result: RoutePoint[] = [];
  const remaining = new Set(points.map((_, i) => i));
  let currentIdx = 0;
  result.push(points[currentIdx]);
  remaining.delete(currentIdx);

  while (remaining.size > 0) {
    const current = result[result.length - 1];
    let nearestIdx = -1;
    let nearestDist = Infinity;
    for (const idx of remaining) {
      const p = points[idx];
      const d = simpleDistance(current.lat, current.lng, p.lat, p.lng);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = idx;
      }
    }
    if (nearestIdx >= 0) {
      result.push(points[nearestIdx]);
      remaining.delete(nearestIdx);
    }
  }
  return result;
}

function simpleDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  return dLat * dLat + dLng * dLng;
}

/** 格式化距离/时长 */
export function formatRouteInfo(result: RouteResult): { distance: string; duration: string } {
  const dist = result.total_distance;
  const dur = result.total_duration;
  const distStr = dist < 1000 ? `${Math.round(dist)}米` : `${(dist / 1000).toFixed(1)}公里`;
  const durStr = dur < 60
    ? `${Math.round(dur)}秒`
    : dur < 3600
    ? `${Math.round(dur / 60)}分钟`
    : `${Math.floor(dur / 3600)}小时${Math.round((dur % 3600) / 60)}分钟`;
  return { distance: distStr, duration: durStr };
}

/** 优先唤起高德 App，失败后返回降级策略 */
export async function navigateWithGaode(
  dest: RoutePoint,
  mode: RouteMode,
): Promise<'app' | 'webview'> {
  const uri = buildGaodeUri(dest, mode);
  try {
    const canOpen = await Linking.canOpenURL(uri);
    if (canOpen) {
      await Linking.openURL(uri);
      return 'app';
    }
  } catch {
    // ignore and fallback
  }
  return 'webview';
}

/** 构建高德 URI */
export function buildGaodeUri(dest: RoutePoint, mode: RouteMode): string {
  const name = encodeURIComponent(dest.name);
  const lng = encodeURIComponent(String(dest.lng));
  const lat = encodeURIComponent(String(dest.lat));
  if (mode === 'drive') {
    return `androidamap://navi?sourceApplication=${AMAP_WEB_APP_NAME}&lat=${lat}&lon=${lng}&dev=0&style=2&poiname=${name}`;
  }
  if (mode === 'walk') {
    return `amapuri://route/plan/?sourceApplication=${AMAP_WEB_APP_NAME}&dlat=${lat}&dlon=${lng}&dname=${name}&dev=0&t=2`;
  }
  return `amapuri://route/plan/?sourceApplication=${AMAP_WEB_APP_NAME}&dlat=${lat}&dlon=${lng}&dname=${name}&dev=0&t=1`;
}
