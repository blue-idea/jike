/**
 * lib/location/locationService.ts
 *
 * 定位服务：获取位置、权限状态、距离计算
 * 当 expo-location 不可用时，提供 Mock 实现用于开发预览
 * EARS-1 覆盖：获取位置后查询附近 POI
 * EARS-2 覆盖：距离排序展示
 * EARS-PERM：定位权限请求
 */

type ExpoLocationModule = {
  requestForegroundPermissionsAsync: () => Promise<{ status: 'granted' | 'denied' | 'unavailable' }>;
  getForegroundPermissionsAsync: () => Promise<{ status: string }>;
  getCurrentPositionAsync: (opts: { accuracy: number }) => Promise<{
    coords: { longitude: number; latitude: number };
  }>;
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

/** 请求定位权限（Mock：开发环境下自动 granted） */
export async function requestLocationPermission(): Promise<LocationStatus> {
  const ExpoLocation = await loadLocation();
  if (!ExpoLocation) {
    // 开发预览：模拟授权
    return 'granted';
  }
  const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'blocked';
}

/** 获取当前位置（Mock：默认返回西安钟楼坐标） */
export async function getCurrentLocation(): Promise<LocationResult> {
  const ExpoLocation = await loadLocation();
  if (!ExpoLocation) {
    // 开发预览：返回西安钟楼坐标
    return {
      status: 'granted',
      coords: { lng: 108.948024, lat: 34.263161 },
    };
  }
  try {
    const { status } = await ExpoLocation.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      const mapped: LocationStatus = status === 'denied' ? 'denied' : 'blocked';
      return { status: mapped, coords: null, error: '定位权限未授权' };
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
    return {
      status: 'unavailable',
      coords: null,
      error: e instanceof Error ? e.message : '位置获取失败',
    };
  }
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
