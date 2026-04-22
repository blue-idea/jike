/**
 * lib/location/locationService.ts
 *
 * 定位服务：获取位置、权限状态、距离计算
 * EARS-1 覆盖：获取位置后查询附近 POI
 * EARS-2 覆盖：距离排序展示
 * EARS-PERM：定位权限请求
 */
import { Platform } from 'react-native';

type ExpoLocationModule = {
  requestForegroundPermissionsAsync: () => Promise<{ status: string }>;
  getForegroundPermissionsAsync: () => Promise<{ status: string }>;
  getCurrentPositionAsync: (opts: { accuracy: number }) => Promise<{
    coords: { longitude: number; latitude: number };
  }>;
  reverseGeocodeAsync?: (coords: {
    longitude: number;
    latitude: number;
  }) => Promise<
    {
      region?: string | null;
      city?: string | null;
      subregion?: string | null;
      district?: string | null;
    }[]
  >;
  Accuracy: { Balanced: number };
};

// expo-location 动态导入（允许项目未安装时开发预览）
let _ExpoLocation: ExpoLocationModule | null = null;
async function loadLocation(): Promise<ExpoLocationModule | null> {
  if (_ExpoLocation === null) {
    try {
       
      const mod = require('expo-location') as ExpoLocationModule;
      _ExpoLocation = mod;
    } catch {
      _ExpoLocation = null;
    }
  }
  return _ExpoLocation;
}

export type LocationStatus =
  | 'idle'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'blocked'
  | 'unavailable';

export interface LocationCoords {
  lng: number;
  lat: number;
}

export interface LocationResult {
  status: LocationStatus;
  coords: LocationCoords | null;
  error?: string;
}

export interface LocationAddress {
  province: string | null;
  city: string | null;
  district: string | null;
}

function getAmapWebServiceKey(): string | null {
  const key =
    process.env.EXPO_PUBLIC_AMAP_WEB_SERVICE_KEY?.trim() ||
    process.env.EXPO_PUBLIC_AMAP_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

function isGooglePlayServiceUnavailableError(message: string): boolean {
  const text = message.toLowerCase();
  return (
    text.includes('locationservices.api') ||
    text.includes('service_invalid') ||
    text.includes('google play services') ||
    text.includes('fused location provider')
  );
}

function parseCenterFromAmapRectangle(rectangle: string): LocationCoords | null {
  const [p1, p2] = rectangle.split(';');
  if (!p1 || !p2) return null;

  const [lng1Str, lat1Str] = p1.split(',');
  const [lng2Str, lat2Str] = p2.split(',');
  const lng1 = Number(lng1Str);
  const lat1 = Number(lat1Str);
  const lng2 = Number(lng2Str);
  const lat2 = Number(lat2Str);
  if (![lng1, lat1, lng2, lat2].every((n) => Number.isFinite(n))) return null;

  return {
    lng: (lng1 + lng2) / 2,
    lat: (lat1 + lat2) / 2,
  };
}

async function getApproxLocationByAmapIp(): Promise<LocationResult | null> {
  const key = getAmapWebServiceKey();
  if (!key) return null;

  const url = `https://restapi.amap.com/v3/ip?key=${encodeURIComponent(key)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const json = (await response.json()) as {
      status?: string;
      rectangle?: string;
    };
    if (json.status !== '1' || !json.rectangle) return null;

    const coords = parseCenterFromAmapRectangle(json.rectangle);
    if (!coords) return null;

    return {
      status: 'granted',
      coords,
      error: '当前设备缺少 Google Play 服务，已降级为高德 IP 定位（城市级精度）。',
    };
  } catch {
    return null;
  }
}

function mapPermissionStatus(status: string): LocationStatus {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'blocked';
}

function getWebPosition(): Promise<LocationResult> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({
        status: 'unavailable',
        coords: null,
        error: '当前环境不支持地理定位',
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          status: 'granted',
          coords: {
            lng: position.coords.longitude,
            lat: position.coords.latitude,
          },
        });
      },
      (error) => {
        if (error.code === 1) {
          resolve({ status: 'denied', coords: null, error: '定位权限未授权' });
          return;
        }
        resolve({
          status: 'unavailable',
          coords: null,
          error: error.message || '无法获取位置',
        });
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 60000,
      },
    );
  });
}

async function reverseGeocodeByAmap(coords: LocationCoords): Promise<LocationAddress | null> {
  const key = getAmapWebServiceKey();
  if (!key) return null;

  const url =
    `https://restapi.amap.com/v3/geocode/regeo?key=${encodeURIComponent(key)}` +
    `&location=${coords.lng},${coords.lat}&extensions=base&batch=false`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      status?: string;
      regeocode?: {
        addressComponent?: {
          province?: string;
          city?: string | string[];
          district?: string;
        };
      };
    };
    if (json.status !== '1') return null;
    const comp = json.regeocode?.addressComponent;
    if (!comp) return null;
    const cityFromAmap = Array.isArray(comp.city) ? comp.city[0] : comp.city;
    return {
      province: comp.province?.trim() ?? null,
      city: cityFromAmap?.trim() ?? null,
      district: comp.district?.trim() ?? null,
    };
  } catch {
    return null;
  }
}

/** 请求定位权限（Web 端将触发一次浏览器授权） */
export async function requestLocationPermission(): Promise<LocationStatus> {
  if (Platform.OS === 'web') {
    const webResult = await getWebPosition();
    return webResult.status;
  }

  const ExpoLocation = await loadLocation();
  if (!ExpoLocation) {
    return 'unavailable';
  }

  try {
    const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
    return mapPermissionStatus(status);
  } catch {
    return 'unavailable';
  }
}

/** 获取当前位置 */
export async function getCurrentLocation(): Promise<LocationResult> {
  if (Platform.OS === 'web') {
    return getWebPosition();
  }

  const ExpoLocation = await loadLocation();
  if (!ExpoLocation) {
    return { status: 'unavailable', coords: null, error: 'expo-location 未安装' };
  }

  try {
    const { status } = await ExpoLocation.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      return {
        status: mapPermissionStatus(status),
        coords: null,
        error: '定位权限未授权',
      };
    }

    const location = await ExpoLocation.getCurrentPositionAsync({
      accuracy: ExpoLocation.Accuracy.Balanced,
    });
    if (!location) {
      return { status: 'unavailable', coords: null, error: '无法获取位置' };
    }
    return {
      status: 'granted',
      coords: { lng: location.coords.longitude, lat: location.coords.latitude },
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : '位置获取失败';
    if (isGooglePlayServiceUnavailableError(message)) {
      const approx = await getApproxLocationByAmapIp();
      if (approx) return approx;
      return {
        status: 'unavailable',
        coords: null,
        error:
          '当前设备缺少 Google Play 服务，且高德定位兜底不可用。请配置 EXPO_PUBLIC_AMAP_WEB_SERVICE_KEY（高德 Web 服务 Key）或改用手动筛选。',
      };
    }
    return {
      status: 'unavailable',
      coords: null,
      error: message,
    };
  }
}

/**
 * 稳健定位：先尝试直接获取（已授权场景），失败后触发一次权限请求并重试
 */
export async function getCurrentLocationWithPermission(): Promise<LocationResult> {
  const firstTry = await getCurrentLocation();
  if (firstTry.coords) return firstTry;

  const shouldRequestPermission =
    firstTry.status === 'denied' || firstTry.status === 'blocked' || firstTry.status === 'idle';
  if (!shouldRequestPermission) return firstTry;

  const permission = await requestLocationPermission();
  if (permission !== 'granted') {
    return {
      status: permission,
      coords: null,
      error: '定位权限未授权',
    };
  }

  return getCurrentLocation();
}

/** 根据经纬度反查省市区（优先 expo-location，失败后回退高德逆地理编码） */
export async function reverseGeocodeLocation(
  coords: LocationCoords,
): Promise<LocationAddress | null> {
  const ExpoLocation = await loadLocation();
  if (ExpoLocation?.reverseGeocodeAsync && Platform.OS !== 'web') {
    try {
      const result = await ExpoLocation.reverseGeocodeAsync({
        longitude: coords.lng,
        latitude: coords.lat,
      });
      const first = result[0];
      if (first) {
        return {
          province: first.region?.trim() ?? null,
          city: first.city?.trim() ?? null,
          district: first.subregion?.trim() ?? first.district?.trim() ?? null,
        };
      }
    } catch {
      // ignore and fallback
    }
  }
  return reverseGeocodeByAmap(coords);
}

/**
 * 计算 Haversine 球面距离（米）
 */
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

/** 格式化距离为中文显示 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}米`;
  }
  return `${(meters / 1000).toFixed(1)}公里`;
}
