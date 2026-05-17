/**
 * lib/location/locationService.ts
 *
 * 定位服务：获取位置、权限状态、距离计算
 * EARS-1 覆盖：获取位置后查询附近 POI
 * EARS-2 覆盖：距离排序展示
 * EARS-PERM：定位权限请求
 */
import { Platform } from 'react-native';
import type {
  Coordinates as GaodeCoordinates,
  PermissionStatus as GaodePermissionStatus,
  ReGeocode as GaodeReGeocode,
} from 'expo-gaode-map';
import { appendLocationDiagnostic } from './locationDiagnostics';

type ExpoLocationModule = {
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
  Accuracy: { Balanced: number };
};

type GaodeLocationModule = {
  checkLocationPermission: () => Promise<GaodePermissionStatus>;
  requestLocationPermission: () => Promise<GaodePermissionStatus>;
  getCurrentLocation: () => Promise<GaodeCoordinates | GaodeReGeocode>;
  getPrivacyStatus: () => {
    isReady: boolean;
  };
  setPrivacyConfig: (config: {
    hasShow: boolean;
    hasContainsPrivacy: boolean;
    hasAgree: boolean;
    privacyVersion?: string;
  }) => void;
  setLocatingWithReGeocode: (isReGeocode: boolean) => void;
  setGeoLanguage: (language: string) => void;
  setOnceLocation: (isOnceLocation: boolean) => void;
  setOnceLocationLatest: (onceLocationLatest: boolean) => void;
  setGpsFirst: (gpsFirst: boolean) => void;
  setWifiScan: (wifiScan: boolean) => void;
  setLocationCacheEnable: (locationCacheEnable: boolean) => void;
  setHttpTimeOut: (httpTimeOut: number) => void;
  setLocationTimeout: (timeout: number) => void;
  setReGeocodeTimeout: (timeout: number) => void;
  isNativeSDKConfigured: () => boolean;
  setLocationMode?: (mode: number) => void;
  setDesiredAccuracy?: (accuracy: number) => void;
};

// expo-location 动态导入（允许项目未安装时开发预览）
let expoLocationModule: ExpoLocationModule | null = null;
async function loadLocation(): Promise<ExpoLocationModule | null> {
  if (expoLocationModule === null) {
    try {
      const mod = require('expo-location') as ExpoLocationModule;
      expoLocationModule = mod;
    } catch {
      expoLocationModule = null;
    }
  }
  return expoLocationModule;
}

let gaodeLocationModule: GaodeLocationModule | null = null;
async function loadGaodeLocation(): Promise<GaodeLocationModule | null> {
  if (Platform.OS === 'web') return null;
  if (gaodeLocationModule === null) {
    try {
      const mod = require('expo-gaode-map') as {
        default?: GaodeLocationModule;
        ExpoGaodeMapModule?: GaodeLocationModule;
      };
      gaodeLocationModule = mod.default ?? mod.ExpoGaodeMapModule ?? null;
    } catch {
      gaodeLocationModule = null;
    }
  }
  return gaodeLocationModule;
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
  source?: 'gaode' | 'expo-location' | 'web' | 'amap-ip';
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

const GAODE_PRIVACY_VERSION = 'jike-location-v1';
const GAODE_ANDROID_HIGH_ACCURACY_MODE = 1;
const GAODE_IOS_BEST_ACCURACY = 1;

let lastGaodeAddress: {
  coords: LocationCoords;
  address: LocationAddress;
} | null = null;

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

function isNativeModuleUnavailableError(message: string): boolean {
  const text = message.toLowerCase();
  return (
    text.includes('native module') ||
    text.includes('not available') ||
    text.includes('unavailable') ||
    text.includes('expo go')
  );
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

// GCJ-02 / WGS-84 转换（中国大陆加偏逻辑）
const GCJ_PI = Math.PI;
const GCJ_A = 6378245.0;
const GCJ_EE = 0.00669342162296594323;

function outOfChina(lat: number, lng: number): boolean {
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

function resolveGaodeCoordSystem(location: GaodeCoordinates | GaodeReGeocode): CoordSystem {
  const coordType = (location as Partial<GaodeReGeocode>).coordType;
  return coordType === 'WGS84' ? 'WGS84' : 'GCJ02';
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
        '当前设备缺少 Google Play 服务，已降级为高德 IP 定位（城市级精度）。',
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
          source: 'web',
          coordSystem: 'WGS84',
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
            error: '定位权限未授权',
          });
          return;
        }
        resolve({
          status: 'unavailable',
          coords: null,
          accuracy: null,
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

function normalizeGaodePermissionStatus(
  permission: GaodePermissionStatus,
): LocationStatus {
  if (permission.granted) return 'granted';
  if (permission.isPermanentlyDenied) return 'blocked';
  if (permission.status === 'denied') return 'denied';
  return 'denied';
}

function addressFromGaodeLocation(
  location: GaodeCoordinates | GaodeReGeocode,
): LocationAddress | null {
  const reGeocode = location as Partial<GaodeReGeocode>;
  const province =
    typeof reGeocode.province === 'string' ? reGeocode.province.trim() : '';
  const city = typeof reGeocode.city === 'string' ? reGeocode.city.trim() : '';
  const district =
    typeof reGeocode.district === 'string' ? reGeocode.district.trim() : '';
  if (!province && !city && !district) return null;
  return {
    province: province || null,
    city: city || null,
    district: district || null,
  };
}

function shouldUseCachedGaodeAddress(coords: LocationCoords): boolean {
  if (!lastGaodeAddress) return false;
  return (
    calcDistance(
      coords.lat,
      coords.lng,
      lastGaodeAddress.coords.lat,
      lastGaodeAddress.coords.lng,
    ) <= 50
  );
}

async function prepareGaodeLocationModule(): Promise<GaodeLocationModule | null> {
  const gaode = await loadGaodeLocation();
  if (!gaode) return null;

  try {
    const privacyStatus = gaode.getPrivacyStatus();
    if (!privacyStatus.isReady) {
      gaode.setPrivacyConfig({
        hasShow: true,
        hasContainsPrivacy: true,
        hasAgree: true,
        privacyVersion: GAODE_PRIVACY_VERSION,
      });
    }

    if (!gaode.isNativeSDKConfigured()) {
      logLocationWarning('gaode-native-key-missing');
      return null;
    }

    gaode.setLocatingWithReGeocode(true);
    gaode.setGeoLanguage('ZH');
    gaode.setOnceLocation(true);
    gaode.setOnceLocationLatest(true);
    gaode.setGpsFirst(true);
    gaode.setWifiScan(true);
    gaode.setLocationCacheEnable(false);
    gaode.setHttpTimeOut(10000);
    gaode.setLocationTimeout(10);
    gaode.setReGeocodeTimeout(5);
    gaode.setLocationMode?.(GAODE_ANDROID_HIGH_ACCURACY_MODE);
    gaode.setDesiredAccuracy?.(GAODE_IOS_BEST_ACCURACY);
    return gaode;
  } catch (e) {
    const message = e instanceof Error ? e.message : '高德定位模块初始化失败';
    logLocationWarning('gaode-prepare-failed', { message });
    return null;
  }
}

async function requestGaodeLocationPermission(): Promise<LocationStatus | null> {
  const gaode = await prepareGaodeLocationModule();
  if (!gaode) return null;

  try {
    const permission = await gaode.requestLocationPermission();
    const status = normalizeGaodePermissionStatus(permission);
    logLocationInfo('gaode-permission-requested', {
      status,
      granted: permission.granted,
      fineLocation: permission.fineLocation,
      coarseLocation: permission.coarseLocation,
      isPermanentlyDenied: permission.isPermanentlyDenied,
    });
    return status;
  } catch (e) {
    const message = e instanceof Error ? e.message : '高德定位权限请求失败';
    logLocationWarning('gaode-permission-failed', { message });
    return isNativeModuleUnavailableError(message) ? null : 'unavailable';
  }
}

async function getCurrentLocationByGaode(): Promise<LocationResult | null> {
  const gaode = await prepareGaodeLocationModule();
  if (!gaode) return null;

  try {
    const permission = await gaode.checkLocationPermission();
    const status = normalizeGaodePermissionStatus(permission);
    if (status !== 'granted') {
      return {
        status,
        coords: null,
        accuracy: null,
        source: 'gaode',
        error: '定位权限未授权',
      };
    }

    const location = await gaode.getCurrentLocation();
    if (
      !Number.isFinite(location.longitude) ||
      !Number.isFinite(location.latitude)
    ) {
      return {
        status: 'unavailable',
        coords: null,
        accuracy: null,
        source: 'gaode',
        error: '无法获取位置',
      };
    }

    const coords = { lng: location.longitude, lat: location.latitude };
    const address = addressFromGaodeLocation(location);
    const coordSystem = resolveGaodeCoordSystem(location);
    if (address) {
      lastGaodeAddress = { coords, address };
    }

    logLocationInfo('gaode-location-success', {
      lng: coords.lng,
      lat: coords.lat,
      accuracy: location.accuracy,
      hasAddress: Boolean(address),
      coordSystem,
    });

    return {
      status: 'granted',
      coords,
      accuracy: Number.isFinite(location.accuracy) ? location.accuracy : null,
      source: 'gaode',
      coordSystem,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : '高德定位失败';
    logLocationWarning('gaode-location-failed', { message });
    return isNativeModuleUnavailableError(message)
      ? null
      : {
          status: 'unavailable',
          coords: null,
          accuracy: null,
          source: 'gaode',
          error: message,
        };
  }
}

async function reverseGeocodeByAmap(
  coords: LocationCoords,
  coordSystem: CoordSystem,
): Promise<LocationAddress | null> {
  const key = getAmapWebServiceKey();
  if (!key) return null;
  const amapCoords = toAmapCoordSystem(coords, coordSystem);

  const url =
    `https://restapi.amap.com/v3/geocode/regeo?key=${encodeURIComponent(key)}` +
    `&location=${amapCoords.lng},${amapCoords.lat}&extensions=base&batch=false`;

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
    const address = {
      province: comp.province?.trim() ?? null,
      city: cityFromAmap?.trim() ?? null,
      district: comp.district?.trim() ?? null,
    };
    logLocationInfo('amap-regeo-success', {
      inputCoords: coords,
      inputCoordSystem: coordSystem,
      amapCoords,
      address,
    });
    return address;
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

  const gaodeStatus = await requestGaodeLocationPermission();
  if (gaodeStatus) return gaodeStatus;

  const expoLocation = await loadLocation();
  if (!expoLocation) {
    return 'unavailable';
  }

  try {
    const { status } = await expoLocation.requestForegroundPermissionsAsync();
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

  const gaodeResult = await getCurrentLocationByGaode();
  if (gaodeResult?.coords) return gaodeResult;
  if (gaodeResult && gaodeResult.status !== 'unavailable') return gaodeResult;

  const expoLocation = await loadLocation();
  if (!expoLocation) {
    return {
      status: 'unavailable',
      coords: null,
      accuracy: null,
      error: 'expo-location 未安装',
    };
  }

  try {
    const { status } = await expoLocation.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      return {
        status: mapPermissionStatus(status),
        coords: null,
        accuracy: null,
        error: '定位权限未授权',
      };
    }

    const location = await expoLocation.getCurrentPositionAsync({
      accuracy: expoLocation.Accuracy.Balanced,
    });
    if (!location) {
      return {
        status: 'unavailable',
        coords: null,
        accuracy: null,
        error: '无法获取位置',
      };
    }
    return {
      status: 'granted',
      coords: { lng: location.coords.longitude, lat: location.coords.latitude },
      source: 'expo-location',
      coordSystem: 'WGS84',
      accuracy:
        typeof location.coords.accuracy === 'number' &&
        Number.isFinite(location.coords.accuracy)
          ? location.coords.accuracy
          : null,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : '位置获取失败';
    if (isGooglePlayServiceUnavailableError(message)) {
      const approx = await getApproxLocationByAmapIp();
      if (approx) return approx;
      return {
        status: 'unavailable',
        coords: null,
        accuracy: null,
        error:
          '当前设备缺少 Google Play 服务，且高德定位兜底不可用。请配置 EXPO_PUBLIC_AMAP_WEB_SERVICE_KEY（高德 Web 服务 Key）或改用手动筛选。',
      };
    }
    return {
      status: 'unavailable',
      coords: null,
      accuracy: null,
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
    firstTry.status === 'denied' ||
    firstTry.status === 'blocked' ||
    firstTry.status === 'idle';
  if (!shouldRequestPermission) return firstTry;

  const permission = await requestLocationPermission();
  if (permission !== 'granted') {
    return {
      status: permission,
      coords: null,
      accuracy: null,
      error: '定位权限未授权',
    };
  }

  return getCurrentLocation();
}

/** 根据经纬度反查省市区（优先 expo-location，失败后回退高德逆地理编码） */
export async function reverseGeocodeLocation(
  coords: LocationCoords,
  options: ReverseGeocodeOptions = {},
): Promise<LocationAddress | null> {
  const expoLocation = await loadLocation();
  const source = options.source;
  const coordSystem = options.coordSystem ?? 'WGS84';
  if (shouldUseCachedGaodeAddress(coords)) {
    logLocationInfo('reverse-geocode-hit-gaode-cache', { coords });
    return lastGaodeAddress?.address ?? null;
  }

  // 在中国场景优先走高德逆地理，避免 WGS84/GCJ02 混用导致位置漂移。
  // source=gaode/amap-ip 时，优先级更高；source=expo-location 时会先做 WGS84->GCJ02 转换后再请求高德。
  const amapFirst = await reverseGeocodeByAmap(coords, coordSystem);
  if (amapFirst) return amapFirst;

  if (source !== 'gaode' && source !== 'amap-ip' && expoLocation?.reverseGeocodeAsync && Platform.OS !== 'web') {
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
      // ignore and fallback
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
