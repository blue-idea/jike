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

/** 高德 Web API 路径规划（驾车/公交/步行） */
export async function queryGaodeRoute(
  from: LocationCoords,
  to: LocationCoords,
  mode: RouteMode,
): Promise<RouteResult> {
  const key = process.env.EXPO_PUBLIC_AMAP_KEY;
  if (!key) throw new Error('缺少高德 API Key（EXPO_PUBLIC_AMAP_KEY）');

  const typeMap: Record<RouteMode, string> = {
    drive: '10',
    bus: '30',
    walk: '20',
  };

  const params = new URLSearchParams({
    key,
    origin: `${from.lng},${from.lat}`,
    destination: `${to.lng},${to.lat}`,
    type: typeMap[mode],
    output: 'json',
  });

  const baseUrl =
    mode === 'bus'
      ? 'https://restapi.amap.com/v3/direction/transit/integrated'
      : mode === 'drive'
      ? 'https://restapi.amap.com/v3/direction/driving'
      : 'https://restapi.amap.com/v3/direction/walking';

  const res = await fetch(`${baseUrl}?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();

  if (json.status !== '1') {
    throw new Error(json.info ?? '路径规划失败');
  }

  if (mode === 'bus') {
    const transit = json.route?.transit_container?.transit_line?.[0];
    if (!transit) throw new Error('未找到公交方案');
    return {
      total_distance: Number(transit.distance ?? 0),
      total_duration: Number(transit.duration ?? 0),
      route_id: transit.uid ?? '',
      segments: (transit.segments ?? []).map((s: Record<string, Record<string, number | string>>) => ({
        instruction: String(s.instruction ?? ''),
        distance: Number(s.walk?.distance ?? s.bus?.distance ?? 0),
        duration: Number(s.walk?.duration ?? s.bus?.duration ?? 0),
        road_name: '',
      })),
    };
  }

  // driving / walking
  const path = json.route?.paths?.path?.[0];
  if (!path) throw new Error('未找到路线');
  return {
    total_distance: Number(path.distance ?? 0),
    total_duration: Number(path.duration ?? 0),
    route_id: json.route?.road ?? '',
    segments: [],
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
  const canOpen = await Linking.canOpenURL(uri);
  if (canOpen) {
    await Linking.openURL(uri);
    return 'app';
  }
  return 'webview';
}

/** 构建高德 URI */
export function buildGaodeUri(dest: RoutePoint, mode: RouteMode): string {
  const name = encodeURIComponent(dest.name);
  const coord = encodeURIComponent(`${dest.lng},${dest.lat}`);
  if (mode === 'walk') {
    return `amap://walking?rideType=1&start=${encodeURIComponent('我的位置')}&destination=${coord}&name=${name}`;
  }
  if (mode === 'drive') {
    return `amap://navi?dest=${coord}&destName=${name}&dev=1&m=1`;
  }
  return `amap://navigation?dev=1&m=1& poiname=${name}&poitype=交通设施&dest=${coord}&destName=${name}`;
}
