/**
 * hooks/useLocationPermission.ts
 *
 * 定位权限管理 Hook
 * EARS-PERM：首次进入需定位功能时触发权限请求
 */
import { useState, useCallback } from 'react';
import { requestLocationPermission, type LocationStatus } from '@/lib/location/locationService';

export interface UseLocationPermissionReturn {
  status: LocationStatus;
  request: () => Promise<LocationStatus>;
}

export function useLocationPermission(): UseLocationPermissionReturn {
  const [status, setStatus] = useState<LocationStatus>('idle');

  const request = useCallback(async (): Promise<LocationStatus> => {
    setStatus('requesting');
    const result = await requestLocationPermission();
    setStatus(result);
    return result;
  }, []);

  return { status, request };
}
