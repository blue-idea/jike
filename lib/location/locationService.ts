/**
 * lib/location/locationService.ts
 *
 * 定位服务：获取位置、权限状态、距离计算
 * 架构：采用 Expo 新版 expo-location/next 提供商机制（Fallback: GMS -> Android原生），
 * 彻底解决中国区无 Google Play 服务的 Android 设备（如小米等）与 Pixel 设备的定位问题。
 * EARS 覆盖：
 * - REQ-002-AC-001: Android 无 GMS 自动回退 Android 原生 LocationManager 定位
 * - REQ-002-AC-002: WGS-84 国内坐标自动转换为 GCJ-02，境外保持 WGS-84
 * - REQ-002-AC-003: 硬件定位全失败时降级高德 IP 粗定位
 */
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { appendLocationDiagnostic } from './locationDiagnostics';

export type LocationProviderRef = { name: string; providers?: unknown[] };

export type ExpoLocationNextModule = {
  requestForegroundPermissionsAsync: () => Promise<{ status: string }>;
  getForegroundPermissionsAsync: () => Promise<{ status: string }>;
  getCurrentPositionAsync: (opts: { accuracy: number }) => Promise<{
    coords: { longitude: number; latitude: number; accuracy?: number | null };
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
  Accuracy?: { Balanced: number; High?: number };
  LocationProvider?: {
    Gms?: () => LocationProviderRef;
    Android?: () => LocationProviderRef;
    Fallback?: (providers: LocationProviderRef[]) => LocationProviderRef;
  };
  setLocationProvider?: (provider: LocationProviderRef) => void;
  getSelectedLocationProviderName?: () => string;
};

/**
 * 检查当前原生运行时是否可用 LocationModuleNext
 * （expo-location/next 依赖此原生模块；Expo Go 及未构建新原生模块的环境仅内置标准 ExpoLocation）
 */
function hasLocationModuleNext(): boolean {
  if (Platform.OS === 'web') return false;
  try {
    return Boolean(requireOptionalNativeModule('LocationModuleNext'));
  } catch {
    return false;
  }
}

// 动态导入 expo-location/next 或回退到 expo-location
let expoLocationModule: ExpoLocationNextModule | null = null;
async function loadLocation(): Promise<ExpoLocationNextModule | null> {
  if (expoLocationModule === null) {
    if (hasLocationModuleNext()) {
      try {
        // 优先加载支持定位提供商机制的 expo-location/next（仅在原生模块实际存在时加载）
        const mod = require('expo-location/next') as ExpoLocationNextModule;
        expoLocationModule = mod;
      } catch {
        // 异常时回退到标准模块
      }
    }

    if (!expoLocationModule) {
      try {
        const mod = require('expo-location') as ExpoLocationNextModule;
        expoLocationModule = mod;
      } catch {
        expoLocationModule = null;
      }
    }
  }
  return expoLocationModule;
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
  accuracy: number | null;
  source?: 'expo-location-next' | 'expo-location' | 'web' | 'amap-ip';
  providerName?: string;
  coordSystem?: CoordSystem;
  error?: string;
}

export interface LocationAddress {
  province: string | null;
  city: string | null;
  district: string | null;
}

export type CoordSystem = 'WGS84' | 'GCJ02';

export interface ReverseGeocodeOptions {
  source?: LocationResult['source'];
  coordSystem?: CoordSystem;
}

function logLocationInfo(event: string, detail: Record<string, unknown> = {}) {
  void appendLocationDiagnostic('info', event, detail);
  if (process.env.NODE_ENV !== 'development') return;
  console.info(`[location] ${event}`, detail);
}

function logLocationWarning(
  event: string,
  detail: Record<string, unknown> = {},
) {
  void appendLocationDiagnostic('warn', event, detail);
  if (process.env.NODE_ENV !== 'development') return;
  console.warn(`[location] ${event}`, detail);
}

function getAmapWebServiceKey(): string | null {
  const key =
    process.env.EXPO_PUBLIC_AMAP_WEB_SERVICE_KEY?.trim() ||
    process.env.EXPO_PUBLIC_AMAP_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

function parseCenterFromAmapRectangle(
  rectangle: string,
): LocationCoords | null {
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

// GCJ-02 / WGS-84 转换（中国大陆火星坐标加偏逻辑）
const GCJ_PI = Math.PI;
const GCJ_A = 6378245.0;
const GCJ_EE = 0.00669342162296594323;

export function outOfChina(lat: number, lng: number): boolean {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

function transformLat(lng: number, lat: number): number {
  let ret =
    -100.0 +
    2.0 * lng +
    3.0 * lat +
    0.2 * lat * lat +
    0.1 * lng * lat +
    0.2 * Math.sqrt(Math.abs(lng));
  ret +=
    ((20.0 * Math.sin(6.0 * lng * GCJ_PI) +
      20.0 * Math.sin(2.0 * lng * GCJ_PI)) *
      2.0) /
    3.0;
  ret +=
    ((20.0 * Math.sin(lat * GCJ_PI) +
      40.0 * Math.sin((lat / 3.0) * GCJ_PI)) *
      2.0) /
    3.0;
  ret +=
    ((160.0 * Math.sin((lat / 12.0) * GCJ_PI) +
      320 * Math.sin((lat * GCJ_PI) / 30.0)) *
      2.0) /
    3.0;
  return ret;
}

function transformLng(lng: number, lat: number): number {
  let ret =
    300.0 +
    lng +
    2.0 * lat +
    0.1 * lng * lng +
    0.1 * lng * lat +
    0.1 * Math.sqrt(Math.abs(lng));
  ret +=
    ((20.0 * Math.sin(6.0 * lng * GCJ_PI) +
      20.0 * Math.sin(2.0 * lng * GCJ_PI)) *
      2.0) /
    3.0;
  ret +=
    ((20.0 * Math.sin(lng * GCJ_PI) +
      40.0 * Math.sin((lng / 3.0) * GCJ_PI)) *
      2.0) /
    3.0;
  ret +=
    ((150.0 * Math.sin((lng / 12.0) * GCJ_PI) +
      300.0 * Math.sin((lng / 30.0) * GCJ_PI)) *
      2.0) /
    3.0;
  return ret;
}

export function wgs84ToGcj02(coords: LocationCoords): LocationCoords {
  const { lat, lng } = coords;
  if (outOfChina(lat, lng)) return coords;
  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = (lat / 180.0) * GCJ_PI;
  let magic = Math.sin(radLat);
  magic = 1 - GCJ_EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((GCJ_A * (1 - GCJ_EE)) / (magic * sqrtMagic)) * GCJ_PI);
  dLng = (dLng * 180.0) / ((GCJ_A / sqrtMagic) * Math.cos(radLat) * GCJ_PI);
  return { lat: lat + dLat, lng: lng + dLng };
}

function toAmapCoordSystem(coords: LocationCoords, coordSystem: CoordSystem): LocationCoords {
  if (coordSystem === 'GCJ02') return coords;
  return wgs84ToGcj02(coords);
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

    const result: LocationResult = {
      status: 'granted',
      coords,
      accuracy: null,
      source: 'amap-ip',
      coordSystem: 'GCJ02',
      error:
        '当前硬件定位不可用，已降级为高德 IP 定位（城市级精度）。',
    };
    logLocationInfo('amap-ip-location-success', { coords });
    return result;
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
        accuracy: null,
        error: 'Geolocation is not supported in the current environment',
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const rawCoords = {
          lng: position.coords.longitude,
          lat: position.coords.latitude,
        };
        const isChina = !outOfChina(rawCoords.lat, rawCoords.lng);
        resolve({
          status: 'granted',
          coords: isChina ? wgs84ToGcj02(rawCoords) : rawCoords,
          source: 'web',
          coordSystem: isChina ? 'GCJ02' : 'WGS84',
          accuracy:
            typeof position.coords.accuracy === 'number' &&
            Number.isFinite(position.coords.accuracy)
              ? position.coords.accuracy
              : null,
        });
      },
      (error) => {
        if (error.code === 1) {
          resolve({
            status: 'denied',
            coords: null,
            accuracy: null,
            error: 'Location permission denied',
          });
          return;
        }
        resolve({
          status: 'unavailable',
          coords: null,
          accuracy: null,
          error: error.message || 'Unable to retrieve location',
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

async function reverseGeocodeByAmap(
  coords: LocationCoords,
  coordSystem: CoordSystem = 'WGS84',
): Promise<LocationAddress | null> {
  const key = getAmapWebServiceKey();
  if (!key) return null;

  const targetCoords = toAmapCoordSystem(coords, coordSystem);
  const locationParam = `${targetCoords.lng.toFixed(6)},${targetCoords.lat.toFixed(6)}`;
  const url = `https://restapi.amap.com/v3/geocode/regeo?key=${encodeURIComponent(
    key,
  )}&location=${locationParam}&extensions=base&output=json`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const json = (await response.json()) as {
      status?: string;
      regeocode?: {
        addressComponent?: {
          province?: string;
          city?: string | [];
          district?: string;
        };
      };
    };

    if (json.status !== '1' || !json.regeocode?.addressComponent) return null;
    const comp = json.regeocode.addressComponent;
    const province =
      typeof comp.province === 'string' && comp.province.trim().length > 0
        ? comp.province.trim()
        : null;
    const city =
      typeof comp.city === 'string' && comp.city.trim().length > 0
        ? comp.city.trim()
        : null;
    const district =
      typeof comp.district === 'string' && comp.district.trim().length > 0
        ? comp.district.trim()
        : null;

    const address: LocationAddress = {
      province,
      city: city ?? province,
      district,
    };
    logLocationInfo('amap-regeo-success', {
      inputCoords: coords,
      targetCoords,
      coordSystem,
      address,
    });
    return address;
  } catch (e) {
    logLocationWarning('amap-regeo-failed', {
      error: e instanceof Error ? e.message : String(e),
      coords,
    });
    return null;
  }
}

export interface ResolveLocationOptions {
  platform?: string;
  locationModule?: ExpoLocationNextModule | null;
  mockIpFallback?: () => Promise<LocationResult | null>;
}

/**
 * 核心定位解析器（基于 expo-location/next 提供商架构，支持外部注入用于测试与诊断）
 */
export async function resolveLocationWithProvider(
  options?: ResolveLocationOptions,
): Promise<LocationResult> {
  const currentPlatform = options?.platform ?? Platform.OS;

  if (currentPlatform === 'web') {
    return getWebPosition();
  }

  const expoLocation = options?.locationModule !== undefined
    ? options.locationModule
    : await loadLocation();

  if (!expoLocation) {
    return {
      status: 'unavailable',
      coords: null,
      accuracy: null,
      error: 'expo-location is not installed',
    };
  }

  try {
    const { status } = await expoLocation.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      return {
        status: mapPermissionStatus(status),
        coords: null,
        accuracy: null,
        error: 'Location permission denied',
      };
    }

    // 在 Android 平台配置 expo-location/next 的 Fallback 提供商（Gms 优先 -> 回退 Android 原生）
    if (currentPlatform === 'android' && expoLocation.LocationProvider && expoLocation.setLocationProvider) {
      try {
        let fallbackProvider: LocationProviderRef | null = null;
        if (typeof expoLocation.LocationProvider.Fallback === 'function') {
          const providers: LocationProviderRef[] = [];
          if (typeof expoLocation.LocationProvider.Gms === 'function') {
            try {
              const gms = expoLocation.LocationProvider.Gms();
              if (gms) providers.push(gms);
            } catch {
              // 当前设备不支持 GMS 时忽略抛错
            }
          }
          if (typeof expoLocation.LocationProvider.Android === 'function') {
            try {
              const android = expoLocation.LocationProvider.Android();
              if (android) providers.push(android);
            } catch {
              // 忽略
            }
          }
          if (providers.length > 0) {
            fallbackProvider = expoLocation.LocationProvider.Fallback(providers);
          }
        } else if (typeof expoLocation.LocationProvider.Android === 'function') {
          fallbackProvider = expoLocation.LocationProvider.Android();
        }

        if (fallbackProvider) {
          expoLocation.setLocationProvider(fallbackProvider);
        }
      } catch (err) {
        logLocationWarning('set-location-provider-warning', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const accuracy = expoLocation.Accuracy?.Balanced ?? 3;
    const location = await expoLocation.getCurrentPositionAsync({ accuracy });

    if (!location?.coords) {
      return {
        status: 'unavailable',
        coords: null,
        accuracy: null,
        error: 'Unable to retrieve coordinates',
      };
    }

    let providerName: string | undefined;
    if (typeof expoLocation.getSelectedLocationProviderName === 'function') {
      try {
        providerName = expoLocation.getSelectedLocationProviderName();
      } catch {
        providerName = undefined;
      }
    }

    const rawCoords: LocationCoords = {
      lng: location.coords.longitude,
      lat: location.coords.latitude,
    };
    const isChina = !outOfChina(rawCoords.lat, rawCoords.lng);
    const finalCoords = isChina ? wgs84ToGcj02(rawCoords) : rawCoords;
    const coordSystem: CoordSystem = isChina ? 'GCJ02' : 'WGS84';

    const source = expoLocation.LocationProvider ? 'expo-location-next' : 'expo-location';

    const result: LocationResult = {
      status: 'granted',
      coords: finalCoords,
      source,
      providerName,
      coordSystem,
      accuracy:
        typeof location.coords.accuracy === 'number' &&
        Number.isFinite(location.coords.accuracy)
          ? location.coords.accuracy
          : null,
    };

    logLocationInfo('location-resolved', {
      source,
      providerName,
      coordSystem,
      rawCoords,
      finalCoords,
    });

    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to retrieve location';
    logLocationWarning('expo-location-failed', { error: message });

    // 硬件定位全部失败时，尝试降级为高德 IP 粗定位
    const ipFallback = options?.mockIpFallback ?? getApproxLocationByAmapIp;
    const approx = await ipFallback();
    if (approx) return approx;

    return {
      status: 'unavailable',
      coords: null,
      accuracy: null,
      error: message,
    };
  }
}

/**
 * 快速检查当前定位权限状态（只读，不触发系统弹窗）
 */
export async function getLocationPermissionStatus(): Promise<LocationStatus> {
  if (Platform.OS === 'web') return 'granted';
  const expoLocation = await loadLocation();
  if (!expoLocation) return 'unavailable';

  try {
    const { status } = await expoLocation.getForegroundPermissionsAsync();
    return mapPermissionStatus(status);
  } catch {
    return 'unavailable';
  }
}

/**
 * 主动请求定位权限
 */
export async function requestLocationPermission(): Promise<LocationStatus> {
  if (Platform.OS === 'web') return 'granted';
  const expoLocation = await loadLocation();
  if (!expoLocation) return 'unavailable';

  try {
    const { status } = await expoLocation.requestForegroundPermissionsAsync();
    return mapPermissionStatus(status);
  } catch {
    return 'unavailable';
  }
}

/**
 * 单次定位：使用 expo-location/next 提供商机制（优先 Gms，自动回退 Android 原生 LocationManager）
 */
export async function getCurrentLocation(): Promise<LocationResult> {
  return resolveLocationWithProvider();
}

/**
 * 稳健定位：先尝试直接获取（已授权场景），失败后触发一次权限请求并重试
 */
export async function getCurrentLocationWithPermission(): Promise<LocationResult> {
  const firstTry = await getCurrentLocation();
  if (firstTry.coords) return firstTry;

  const shouldRequestPermission =
    firstTry.status === 'denied' ||
    firstTry.status === 'idle' ||
    firstTry.status === 'unavailable';

  if (!shouldRequestPermission) return firstTry;

  const permStatus = await requestLocationPermission();
  if (permStatus !== 'granted') {
    return {
      status: permStatus,
      coords: null,
      accuracy: null,
      error: 'Location permission denied',
    };
  }

  return getCurrentLocation();
}

/** 根据经纬度反查省市区（优先高德逆地理编码，确保 GCJ-02 坐标精确匹配） */
export async function reverseGeocodeLocation(
  coords: LocationCoords,
  options: ReverseGeocodeOptions = {},
): Promise<LocationAddress | null> {
  const expoLocation = await loadLocation();
  const source = options.source;
  const coordSystem = options.coordSystem ?? 'WGS84';

  // 在中国境内优先走高德逆地理，确保坐标与高德地图数据完全对齐
  const amapFirst = await reverseGeocodeByAmap(coords, coordSystem);
  if (amapFirst) return amapFirst;

  if (source !== 'amap-ip' && expoLocation?.reverseGeocodeAsync && Platform.OS !== 'web') {
    try {
      const result = await expoLocation.reverseGeocodeAsync({
        longitude: coords.lng,
        latitude: coords.lat,
      });
      const first = result[0];
      if (first) {
        const address = {
          province: first.region?.trim() ?? null,
          city: first.city?.trim() ?? null,
          district: first.subregion?.trim() ?? first.district?.trim() ?? null,
        };
        logLocationInfo('expo-regeo-success', {
          inputCoords: coords,
          inputCoordSystem: coordSystem,
          address,
        });
        return address;
      }
    } catch {
      // 降级忽略
    }
  }
  return null;
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
  const radius = 6371000;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const deltaLat = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return radius * c;
}

/** 格式化距离为中文显示 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}米`;
  }
  return `${(meters / 1000).toFixed(1)}公里`;
}
