/**
 * hooks/useNearbyPois.ts
 *
 * 附近 POI Hook，整合定位+查询+排序
 * EARS-1：获取位置后查询附近 POI，结果集与筛选条件一致
 * EARS-2：按 distance 升序排列，标注距离单位
 */
import { useState, useCallback } from 'react';
import {
  getCurrentLocation,
  requestLocationPermission,
  type LocationCoords,
  type LocationStatus,
} from '@/lib/location/locationService';
import {
  queryNearbyPoisRPC,
  type NearbyPoi,
  type NearbyQueryOptions,
} from '@/lib/location/nearbyQueries';

export interface UseNearbyPoisOptions {
  /** 默认半径（米） */
  radiusM?: number;
  /** 是否自动加载 */
  autoLoad?: boolean;
}

export interface UseNearbyPoisReturn {
  pois: NearbyPoi[];
  loading: boolean;
  error: string | null;
  locationStatus: LocationStatus;
  locationCoords: LocationCoords | null;
  loadNearby: (options?: Partial<NearbyQueryOptions>) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useNearbyPois(
  options: UseNearbyPoisOptions = {},
): UseNearbyPoisReturn {
  const { radiusM = 5000, autoLoad = false } = options;
  const [pois, setPois] = useState<NearbyPoi[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle');
  const [locationCoords, setLocationCoords] = useState<LocationCoords | null>(null);

  const loadNearby = useCallback(
    async (overrides?: Partial<NearbyQueryOptions>) => {
      setLoading(true);
      setError(null);
      try {
        // 1. 请求定位权限
        const permStatus = await requestLocationPermission();
        setLocationStatus(permStatus);
        if (permStatus !== 'granted') {
          setError('定位权限未授权');
          setPois([]);
          return;
        }

        // 2. 获取当前位置
        const loc = await getCurrentLocation();
        if (!loc.coords) {
          setError(loc.error ?? '无法获取位置');
          setPois([]);
          return;
        }
        setLocationCoords(loc.coords);

        // 3. 查询附近 POI
        const data = await queryNearbyPoisRPC(
          { lng: loc.coords.lng, lat: loc.coords.lat },
          { radiusM: overrides?.radiusM ?? radiusM, limit: 50 },
        );
        setPois(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : '查询失败');
        setPois([]);
      } finally {
        setLoading(false);
      }
    },
    [radiusM],
  );

  const refresh = useCallback(async () => {
    await loadNearby();
  }, [loadNearby]);

  return { pois, loading, error, locationStatus, locationCoords, loadNearby, refresh };
}
