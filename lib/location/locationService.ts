/**
 * lib/location/locationService.ts
 * 定位服务（最小实现，供 routeService 使用）
 */
export interface LocationCoords {
  lng: number;
  lat: number;
}

export type LocationStatus =
  | 'idle'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'blocked'
  | 'unavailable';

export interface LocationResult {
  status: LocationStatus;
  coords: LocationCoords | null;
  error?: string;
}

export async function requestLocationPermission(): Promise<LocationStatus> {
  return 'granted';
}

export async function getCurrentLocation(): Promise<LocationResult> {
  return { status: 'granted', coords: { lng: 108.948024, lat: 34.263161 } };
}

export function calcDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}米`;
  return `${(meters / 1000).toFixed(1)}公里`;
}
