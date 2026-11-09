/**
 * tests/location-next.test.mjs
 *
 * 验证 expo-location/next 提供商架构与中国区定位（TDD 单元测试）
 * 覆盖需求：
 * - REQ-002-AC-001: Android 无 GMS 自动回退 Android 原生 LocationManager 定位
 * - REQ-002-AC-002: WGS-84 国内坐标自动转换为 GCJ-02，境外保持 WGS-84
 * - REQ-002-AC-003: 硬件定位全失败时降级高德 IP 粗定位
 */
import assert from 'node:assert/strict';
import {
  wgs84ToGcj02,
  outOfChina,
  resolveLocationWithProvider,
} from '../lib/location/locationService.ts';

async function runTests() {
  console.log('--- 开始执行 expo-location/next 定位模块单元测试 ---');

  // 1. [REQ-002-AC-002] 坐标加偏与境内判定
  console.log('测试 1: [REQ-002-AC-002] 坐标加偏与边界判定...');
  const beijingWgs = { lng: 116.4074, lat: 39.9042 };
  assert.strictEqual(outOfChina(beijingWgs.lat, beijingWgs.lng), false, '北京坐标应当判定为境内');

  const beijingGcj = wgs84ToGcj02(beijingWgs);
  assert.notStrictEqual(beijingGcj.lng, beijingWgs.lng, '境内经度应当产生偏移');
  assert.notStrictEqual(beijingGcj.lat, beijingWgs.lat, '境内纬度应当产生偏移');
  assert.ok(Math.abs(beijingGcj.lng - 116.413) < 0.01, '加偏后的经度应符合 GCJ-02 预期');

  const tokyoWgs = { lng: 139.6917, lat: 35.6895 };
  assert.strictEqual(outOfChina(tokyoWgs.lat, tokyoWgs.lng), true, '东京坐标应当判定为境外');
  const tokyoGcj = wgs84ToGcj02(tokyoWgs);
  assert.strictEqual(tokyoGcj.lng, tokyoWgs.lng, '境外经度不应加偏');
  assert.strictEqual(tokyoGcj.lat, tokyoWgs.lat, '境外纬度不应加偏');

  // 2. [REQ-002-AC-001] Android 无 GMS 场景回退 Android 原生 LocationManager
  console.log('测试 2: [REQ-002-AC-001] Android 无 GMS 场景自动回退为原生 LocationManager...');
  // 模拟 expo-location/next 模块行为：GMS 抛出异常，但 Android() 成功返回
  const mockExpoLocationNextNoGms = {
    requestForegroundPermissionsAsync: async () => ({ status: 'granted' }),
    getForegroundPermissionsAsync: async () => ({ status: 'granted' }),
    getCurrentPositionAsync: async () => ({
      coords: { longitude: 108.940174, latitude: 34.341568, accuracy: 15 },
    }),
    LocationProvider: {
      Gms: () => {
        throw new Error('Google Play Services not available');
      },
      Android: () => ({ name: 'Android' }),
      Fallback: (providers) => ({ name: 'Fallback', providers }),
    },
    getSelectedLocationProviderName: () => 'Android',
    setLocationProvider: (_p) => {},
  };

  const resultNoGms = await resolveLocationWithProvider({
    platform: 'android',
    locationModule: mockExpoLocationNextNoGms,
  });

  assert.strictEqual(resultNoGms.status, 'granted', '无 GMS 时定位应当成功');
  assert.strictEqual(resultNoGms.source, 'expo-location-next', '定位来源应当为 expo-location-next');
  assert.strictEqual(resultNoGms.providerName, 'Android', '使用的提供商应当为 Android 原生');
  assert.strictEqual(resultNoGms.coordSystem, 'GCJ02', '境内定位结果坐标系应当转换为 GCJ-02');
  assert.ok(resultNoGms.coords, '定位坐标应当存在');
  assert.ok(resultNoGms.coords.lng > 108.9, '经度应符合预期');

  // 3. [REQ-002-AC-001] Android 有 GMS 场景（如 Pixel）使用 Gms 提供商
  console.log('测试 3: [REQ-002-AC-001] Android 有 GMS (Pixel) 使用 Gms 提供商...');
  const mockExpoLocationNextWithGms = {
    requestForegroundPermissionsAsync: async () => ({ status: 'granted' }),
    getForegroundPermissionsAsync: async () => ({ status: 'granted' }),
    getCurrentPositionAsync: async () => ({
      coords: { longitude: 116.4074, latitude: 39.9042, accuracy: 5 },
    }),
    LocationProvider: {
      Gms: () => ({ name: 'GMS' }),
      Android: () => ({ name: 'Android' }),
      Fallback: (providers) => ({ name: 'Fallback', providers }),
    },
    getSelectedLocationProviderName: () => 'GMS',
    setLocationProvider: (_p) => {},
  };

  const resultWithGms = await resolveLocationWithProvider({
    platform: 'android',
    locationModule: mockExpoLocationNextWithGms,
  });

  assert.strictEqual(resultWithGms.status, 'granted', 'Pixel 有 GMS 时定位应当成功');
  assert.strictEqual(resultWithGms.source, 'expo-location-next', '定位来源应当为 expo-location-next');
  assert.strictEqual(resultWithGms.providerName, 'GMS', '使用的提供商应当为 GMS');
  assert.strictEqual(resultWithGms.coordSystem, 'GCJ02', '境内定位坐标系应当为 GCJ-02');

  // 4. [REQ-002-AC-003] 硬件定位全部失败时降级高德 Web IP 粗定位
  console.log('测试 4: [REQ-002-AC-003] 硬件定位失败时降级高德 IP 粗定位...');
  const mockExpoLocationAllFail = {
    requestForegroundPermissionsAsync: async () => ({ status: 'granted' }),
    getForegroundPermissionsAsync: async () => ({ status: 'granted' }),
    getCurrentPositionAsync: async () => {
      throw new Error('Location provider timeout');
    },
    LocationProvider: {
      Gms: () => ({ name: 'GMS' }),
      Android: () => ({ name: 'Android' }),
      Fallback: (providers) => ({ name: 'Fallback', providers }),
    },
    getSelectedLocationProviderName: () => 'Android',
    setLocationProvider: (_p) => {},
  };

  const resultFallbackIp = await resolveLocationWithProvider({
    platform: 'android',
    locationModule: mockExpoLocationAllFail,
    mockIpFallback: async () => ({
      status: 'granted',
      coords: { lng: 108.95, lat: 34.27 },
      accuracy: null,
      source: 'amap-ip',
      coordSystem: 'GCJ02',
      error: '当前硬件定位不可用，已降级为高德 IP 定位（城市级精度）。',
    }),
  });

  assert.strictEqual(resultFallbackIp.status, 'granted', 'IP 降级状态应当为 granted');
  assert.strictEqual(resultFallbackIp.source, 'amap-ip', '降级来源应当为 amap-ip');
  assert.ok(resultFallbackIp.error?.includes('高德 IP 定位'), '应当包含精度不足提示');

  console.log('🎉 所有定位模块单元测试均按期望验证！');
}

runTests().catch((err) => {
  console.error('❌ 测试执行失败:', err);
  process.exit(1);
});

