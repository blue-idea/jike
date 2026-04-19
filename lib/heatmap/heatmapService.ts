/**
 * lib/heatmap/heatmapService.ts
 *
 * 高德热力图层服务
 * EARS-1 覆盖：展示热门程度图层并提供清晰图例
 * EARS-2 覆盖：接口不可用或用户未授权定位时展示降级说明并灰化控件
 */
import { type LocationCoords } from '@/lib/location/locationService';

export type HeatmapMode = 'traffic' | 'heat';

export interface HeatmapResult {
  layer_data: number[]; // 热力强度值 0-1
  coverage: 'full' | 'partial' | 'none';
}

/** 查询热力图层数据 */
export async function queryHeatmapData(
  center: LocationCoords,
  radiusM = 5000,
): Promise<HeatmapResult> {
  const key = process.env.EXPO_PUBLIC_AMAP_KEY;
  if (!key) return { layer_data: [], coverage: 'none' };

  const params = new URLSearchParams({
    key,
    location: `${center.lng},${center.lat}`,
    radius: String(Math.round(radiusM)),
    output: 'json',
  });

  try {
    const res = await fetch(`https://restapi.amap.com/v3/traffic/heatmap?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.status !== '1') throw new Error(json.info ?? '热力数据获取失败');
    return {
      layer_data: (json.data?.heatmap ?? []) as number[],
      coverage: json.data?.coverage ?? 'partial',
    };
  } catch {
    return { layer_data: [], coverage: 'none' };
  }
}

/** 降级说明文案 */
export function getDegradedMessage(reason: 'no_key' | 'no_location' | 'network_error'): string {
  if (reason === 'no_key') return '请配置高德 KEY 以显示实时热力';
  if (reason === 'no_location') return '需要定位权限才能显示周边热力';
  return '热力数据暂时不可用，请稍后重试';
}
