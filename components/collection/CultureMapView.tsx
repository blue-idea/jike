/**
 * components/collection/CultureMapView.tsx
 *
 * 文化地图视图（WebView + 高德 JSAPI）
 * 数据源：严格仅来自 Supabase 三类名录 POI（不得混入高德原生 POI）
 *
 * EARS-1 覆盖：切换图层 → queryMapPois 更新点位集合 → 同步图例说明
 * EARS-2 覆盖：网络异常时显示 MapErrorState + 支持重试
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { WebView } from 'react-native-webview';
import {
  CULTURE_MAP_DEFAULT_CENTER,
  CULTURE_MAP_DEFAULT_STYLE,
  CULTURE_MAP_FEATURES,
} from '@/constants/cultureMapData';
import { LayerToggle } from '@/components/catalog/LayerToggle';
import { MapLegend } from '@/components/catalog/MapLegend';
import { MapErrorState } from '@/components/catalog/MapErrorState';
import { RouteWebViewFallback } from '@/components/route/RouteWebViewFallback';
import { type CultureMapLayer, type MapPoi } from '@/lib/catalog/supabaseCatalogQueries';
import { addFavorite, isInFavorites, removeFavorite } from '@/lib/favorites/favoritesService';
import { queryNearbyPoisRPC } from '@/lib/location/nearbyQueries';
import { getCurrentLocationWithPermission, type LocationCoords } from '@/lib/location/locationService';
import { navigateWithGaode, type RoutePoint } from '@/lib/route/routeService';

export type CultureMapViewProps = {
  initialLayer?: CultureMapLayer;
  initialScenicFilter?: 'all' | '5A';
  onMapInteractingChange?: (isInteracting: boolean) => void;
};

const NEARBY_RADIUS_M = 20_000;
const MAX_NEARBY_POINTS = 220;

function toMapPoiFromMessage(payload: unknown): MapPoi | null {
  if (!payload || typeof payload !== 'object') return null;
  const raw = payload as Record<string, unknown>;
  const kind = raw.kind;
  if (kind !== 'scenic' && kind !== 'heritage' && kind !== 'museum') return null;
  const id = typeof raw.id === 'string' ? raw.id : '';
  const name = typeof raw.name === 'string' ? raw.name : '';
  const lng = typeof raw.lng === 'number' ? raw.lng : NaN;
  const lat = typeof raw.lat === 'number' ? raw.lat : NaN;
  if (!id || !name || !Number.isFinite(lng) || !Number.isFinite(lat)) return null;

  return {
    id,
    name,
    kind,
    lng,
    lat,
    scenicLevel: typeof raw.scenicLevel === 'string' ? raw.scenicLevel : undefined,
  };
}

function getWebApiKey(): string | undefined {
  const k = process.env.EXPO_PUBLIC_AMAP_KEY;
  return typeof k === 'string' && k.trim().length > 0 ? k.trim() : undefined;
}

function getMapStyleUri(): string {
  const custom = process.env.EXPO_PUBLIC_AMAP_MAP_STYLE?.trim();
  return custom && custom.length > 0 ? custom : CULTURE_MAP_DEFAULT_STYLE;
}

function buildMapHtml(
  amapKey: string,
  mapStyleUri: string,
  pois: MapPoi[],
  center: { lng: number; lat: number },
  initialLayer: CultureMapLayer,
  initialScenicFilter: 'all' | '5A',
  showUserLocation: boolean,
) {
  const poisJson = JSON.stringify(
    pois.map((p) => ({
      id: p.id,
      name: p.name,
      kind: p.kind,
      lng: p.lng,
      lat: p.lat,
      scenicLevel: p.scenicLevel ?? null,
    })),
  );
  const styleJson = JSON.stringify(mapStyleUri);
  const featuresJson = JSON.stringify(CULTURE_MAP_FEATURES);
  const initialLayerJson = JSON.stringify(initialLayer);
  const initialScenicFilterJson = JSON.stringify(initialScenicFilter);
  const showUserLocationJson = JSON.stringify(showUserLocation);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
  <style>
    html, body, #container { margin: 0; padding: 0; width: 100%; height: 100%; }
    body { background: #faf7f2; }
    .user-dot-wrap {
      position: relative;
      width: 18px;
      height: 18px;
      display: block;
    }
    .user-dot-core {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #1e84ff;
      border: 2px solid #ffffff;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
    }
    .user-label {
      max-width: 90px;
      font-size: 10px;
      line-height: 1.2;
      color: #114b8f;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      text-shadow:
        0 0 2px rgba(255, 255, 255, 0.95),
        0 0 4px rgba(255, 255, 255, 0.9);
      pointer-events: none;
    }
  </style>
  <script src="https://webapi.amap.com/maps?v=2.0&key=${amapKey}"></script>
</head>
<body>
  <div id="container"></div>
  <script>
    (function () {
      var POIS = ${poisJson};
      var mapStyleUri = ${styleJson};
      var FEATURES = ${featuresJson};
      var INITIAL_LAYER = ${initialLayerJson};
      var INITIAL_SCENIC_FILTER = ${initialScenicFilterJson};
      var SHOW_USER_LOCATION = ${showUserLocationJson};
      var map;
      var poiOverlays = [];
      var labelOverlays = [];
      var currentPois = [];
      var userMarker = null;
      var interacting = false;
      var interactionReleaseTimer = null;

      function postMessage(payload) {
        if (!window.ReactNativeWebView) return;
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }

      function emitError(message) {
        postMessage({ type: 'error', msg: message || '地图加载失败，请重试' });
      }

      function emitPoiPress(poi) {
        if (!poi || !poi.id) return;
        postMessage({
          type: 'poi_press',
          poi: {
            id: String(poi.id),
            name: String(poi.name || ''),
            kind: poi.kind,
            lng: Number(poi.lng),
            lat: Number(poi.lat),
            scenicLevel: poi.scenicLevel || null,
          },
        });
      }

      function setInteracting(next) {
        if (interacting === next) return;
        interacting = next;
        postMessage({ type: 'interaction', active: interacting });
      }

      function clearInteractionReleaseTimer() {
        if (!interactionReleaseTimer) return;
        clearTimeout(interactionReleaseTimer);
        interactionReleaseTimer = null;
      }

      function releaseInteractingDelayed(delay) {
        clearInteractionReleaseTimer();
        interactionReleaseTimer = setTimeout(function () {
          setInteracting(false);
        }, delay || 120);
      }

      function userMarkerHtml() {
        return (
          '<div class="user-dot-wrap">' +
            '<div class="user-dot-core"></div>' +
            '<div class="user-label">当前位置</div>' +
          '</div>'
        );
      }

      function escapeHtml(value) {
        if (!value) return '';
        return String(value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      function colorFor(kind) {
        if (kind === 'heritage') return '#813520';
        if (kind === 'museum') return '#2C4A3E';
        return '#C8914A';
      }

      function createPoiOverlay(p) {
        var marker = new AMap.CircleMarker({
          center: [p.lng, p.lat],
          radius: 7,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          strokeOpacity: 1,
          fillColor: colorFor(p.kind),
          fillOpacity: 1,
          zIndex: 100,
          bubble: false,
        });
        marker.on('click', function () {
          emitPoiPress(p);
        });
        return marker;
      }

      function createLabelOverlay(p) {
        var label = new AMap.Text({
          text: p.name,
          position: [p.lng, p.lat],
          offset: new AMap.Pixel(0, 0),
          style: {
            'font-size': '10px',
            'font-weight': '500',
            color: '#2e251a',
            'text-shadow': '0 0 2px rgba(255,255,255,0.95)',
            border: 'none',
            background: 'transparent',
            padding: '0',
            'white-space': 'nowrap',
            'max-width': '132px',
            overflow: 'hidden',
            'text-overflow': 'ellipsis',
          },
          zIndex: 120,
          anchor: 'center',
        });
        label.on('click', function () {
          emitPoiPress(p);
        });
        return label;
      }

      function clearLabels() {
        if (!map || !labelOverlays.length) return;
        map.remove(labelOverlays);
        labelOverlays = [];
      }

      function refreshLabels() {
        if (!map) return;
        clearLabels();
        if (!currentPois.length) return;
        labelOverlays = currentPois.map(createLabelOverlay);
        map.add(labelOverlays);
      }

      function renderPois(layer, scenicFilter) {
        if (!map) return;
        if (poiOverlays.length) {
          map.remove(poiOverlays);
          poiOverlays = [];
        }
        clearLabels();

        var filtered = POIS.filter(function (p) {
          if (layer === 'heritage') return p.kind === 'heritage';
          if (layer === 'museum') return p.kind === 'museum';
          if (layer === 'scenic') {
            if (scenicFilter === '5A') return p.kind === 'scenic' && p.scenicLevel === '5A';
            return p.kind === 'scenic';
          }
          return true;
        });
        currentPois = filtered;

        poiOverlays = filtered.map(createPoiOverlay);

        if (userMarker) {
          map.add(userMarker);
        }
        if (poiOverlays.length) {
          map.add(poiOverlays);
        }

        var fitTargets = userMarker ? poiOverlays.concat([userMarker]) : poiOverlays;
        try {
          if (!fitTargets.length) {
            map.setZoomAndCenter(11, [${center.lng}, ${center.lat}]);
          } else if (fitTargets.length === 1) {
            // 单点场景不必使用 fitView，避免缩放跳动
            map.setZoomAndCenter(16, fitTargets[0].getPosition());
          } else {
            // 多点自适应：点位越多，限制最大缩放越低，避免过近
            var maxZoom =
              fitTargets.length <= 3 ? 16 :
              fitTargets.length <= 8 ? 15 :
              fitTargets.length <= 20 ? 13 : 11;
            map.setFitView(fitTargets, false, [68, 56, 68, 56], maxZoom);
          }

          // 统一缩放边界，避免偶发过度拉近或拉远
          var currentZoom = map.getZoom();
          if (currentZoom > 17) {
            map.setZoom(17);
          } else if (currentZoom < 7) {
            map.setZoom(7);
          }
        } catch (e) {}

        refreshLabels();
      }

      window.__renderPois = renderPois;

      map = new AMap.Map('container', {
        zoom: 12,
        center: [${center.lng}, ${center.lat}],
        mapStyle: mapStyleUri,
        features: FEATURES,
        viewMode: '2D',
        showIndoorMap: false,
        zooms: [6, 18],
      });

      window.__zoomIn = function () {
        if (!map) return;
        try {
          var z = map.getZoom();
          map.setZoom(Math.min(18, z + 1));
        } catch (e) {}
      };
      window.__zoomOut = function () {
        if (!map) return;
        try {
          var z = map.getZoom();
          map.setZoom(Math.max(6, z - 1));
        } catch (e) {}
      };

      if (SHOW_USER_LOCATION) {
        userMarker = new AMap.Marker({
          position: [${center.lng}, ${center.lat}],
          title: '当前位置',
          zIndex: 130,
          offset: new AMap.Pixel(-9, -9),
          content: userMarkerHtml(),
        });
      }

      function reportOfflineIfNeeded() {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          emitError('网络异常，请检查连接后重试');
        }
      }

      map.on('complete', function () {
        renderPois(INITIAL_LAYER, INITIAL_SCENIC_FILTER);
        postMessage({ type: 'ready' });
      });

      map.on('error', function (e) {
        emitError(String(e));
      });

      map.on('zoomstart', function () {
        clearInteractionReleaseTimer();
        setInteracting(true);
      });
      map.on('movestart', function () {
        clearInteractionReleaseTimer();
        setInteracting(true);
      });
      map.on('zoomend', function () {
        releaseInteractingDelayed(120);
        reportOfflineIfNeeded();
      });
      map.on('moveend', function () {
        releaseInteractingDelayed(120);
        reportOfflineIfNeeded();
      });

      var containerEl = document.getElementById('container');
      if (containerEl) {
        containerEl.addEventListener('touchstart', function () {
          clearInteractionReleaseTimer();
          setInteracting(true);
        }, { passive: true });
        containerEl.addEventListener('touchmove', function () {
          clearInteractionReleaseTimer();
          setInteracting(true);
        }, { passive: true });
        containerEl.addEventListener('touchend', function () {
          releaseInteractingDelayed(140);
        }, { passive: true });
        containerEl.addEventListener('touchcancel', function () {
          releaseInteractingDelayed(140);
        }, { passive: true });
        containerEl.addEventListener('wheel', function () {
          clearInteractionReleaseTimer();
          setInteracting(true);
          releaseInteractingDelayed(180);
        }, { passive: true });
        containerEl.addEventListener('mousedown', function () {
          clearInteractionReleaseTimer();
          setInteracting(true);
        });
        containerEl.addEventListener('mouseup', function () {
          releaseInteractingDelayed(120);
        });
      }

      window.addEventListener('offline', function () {
        emitError('网络异常，请检查连接后重试');
      });

      window.addEventListener('error', function () {
        emitError('地图加载失败，请重试');
      });
      window.addEventListener('unhandledrejection', function () {
        emitError('地图加载失败，请重试');
      });
      window.addEventListener('blur', function () {
        releaseInteractingDelayed(80);
      });
    })();
  </script>
</body>
</html>`;
}

function buildPlaceholderHtml() {
  return `<!DOCTYPE html>
<html lang="zh-CN"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  * { box-sizing: border-box; }
  body { margin:0; min-height:100%; display:flex; align-items:center; justify-content:center;
    font-family: -apple-system,BlinkMacSystemFont,sans-serif; background:#faf7f2; color:#5c5040;
    padding: 16px; text-align: center; font-size: 13px; line-height: 1.55;
  }
</style></head><body>
  <div>请配置环境变量 <b>EXPO_PUBLIC_AMAP_KEY</b> 后重新加载。</div>
</body></html>`;
}

export function CultureMapView({
  initialLayer = 'heritage',
  initialScenicFilter = 'all',
  onMapInteractingChange,
}: CultureMapViewProps) {
  const isWeb = Platform.OS === 'web';
  const webRef = useRef<WebView>(null);
  const mapInteractingRef = useRef(false);
  const interactionReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeLayer, setActiveLayer] = useState<CultureMapLayer>(initialLayer);
  const [scenicFilter, setScenicFilter] = useState<'all' | '5A'>(initialScenicFilter);
  const [mapCenter, setMapCenter] = useState<LocationCoords>(CULTURE_MAP_DEFAULT_CENTER);
  const [hasUserLocation, setHasUserLocation] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pois, setPois] = useState<MapPoi[]>([]);
  const [reloadSeed, setReloadSeed] = useState(0);
  const [favoriteBusyPoiId, setFavoriteBusyPoiId] = useState<string | null>(null);
  const [fallbackVisible, setFallbackVisible] = useState(false);
  const [fallbackDestination, setFallbackDestination] = useState<RoutePoint | null>(null);
  const [fallbackOrigin, setFallbackOrigin] = useState<RoutePoint | null>(null);

  const amapKey = useMemo(() => getWebApiKey(), []);
  const mapStyleUri = useMemo(() => getMapStyleUri(), []);

  // EARS-1: 切换图层/筛选 → 查询 Supabase POI
  const loadPois = useCallback(
    async (layer: CultureMapLayer, sf: 'all' | '5A') => {
      setIsLoading(true);
      setLoadError(false);
      setErrorMessage(null);
      try {
        const location = await getCurrentLocationWithPermission();
        if (!location.coords) {
          throw new Error(location.error ?? '无法获取当前位置，请开启定位后重试');
        }
        setMapCenter(location.coords);
        setHasUserLocation(true);

        let nearbyPois = await queryNearbyPoisRPC(location.coords, {
          radiusM: NEARBY_RADIUS_M,
          poiType: layer,
          limit: MAX_NEARBY_POINTS,
        });

        if (layer === 'scenic' && sf === '5A') {
          nearbyPois = nearbyPois.filter((item) => item.poi_type === 'scenic' && item.label === '5A');
        }

        const mapped: MapPoi[] = nearbyPois.map((item) => ({
          id: item.id,
          name: item.name,
          kind: item.poi_type,
          lng: item.lng,
          lat: item.lat,
          scenicLevel: item.poi_type === 'scenic' ? item.label ?? undefined : undefined,
          label: item.label ?? undefined,
        }));

        setPois(mapped);
      } catch (error) {
        setLoadError(true);
        setPois([]);
        setHasUserLocation(false);
        setErrorMessage(error instanceof Error ? error.message : '地图加载失败，请重试');
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadPois(activeLayer, scenicFilter);
  }, [activeLayer, scenicFilter, loadPois]);

  const html = useMemo(() => {
    if (!amapKey) return buildPlaceholderHtml();
    return buildMapHtml(
      amapKey,
      mapStyleUri,
      pois,
      mapCenter,
      activeLayer,
      scenicFilter,
      hasUserLocation,
    );
  }, [activeLayer, amapKey, hasUserLocation, mapCenter, mapStyleUri, pois, scenicFilter]);

  const webViewKey = useMemo(
    () => `culture-map-${reloadSeed}-${activeLayer}-${scenicFilter}-${mapCenter.lng}-${mapCenter.lat}`,
    [activeLayer, mapCenter.lat, mapCenter.lng, reloadSeed, scenicFilter],
  );

  // EARS-1: 图层就绪后注入点位
  const injectPois = useCallback(() => {
    const layer = JSON.stringify(activeLayer);
    const sf = JSON.stringify(scenicFilter);
    const code = `(function(){
      if (window.__renderPois) window.__renderPois(${layer}, ${sf});
    })();true;`;
    webRef.current?.injectJavaScript(code);
  }, [activeLayer, scenicFilter]);

  useEffect(() => {
    if (!amapKey || !mapReady) return;
    injectPois();
  }, [amapKey, mapReady, pois, injectPois]);

  const clearInteractionReleaseTimer = useCallback(() => {
    if (!interactionReleaseTimerRef.current) return;
    clearTimeout(interactionReleaseTimerRef.current);
    interactionReleaseTimerRef.current = null;
  }, []);

  const emitMapInteracting = useCallback(
    (next: boolean, releaseDelay = 0) => {
      if (next) {
        clearInteractionReleaseTimer();
        if (!mapInteractingRef.current) {
          mapInteractingRef.current = true;
          onMapInteractingChange?.(true);
        }
        return;
      }

      if (releaseDelay > 0) {
        clearInteractionReleaseTimer();
        interactionReleaseTimerRef.current = setTimeout(() => {
          if (!mapInteractingRef.current) return;
          mapInteractingRef.current = false;
          onMapInteractingChange?.(false);
        }, releaseDelay);
        return;
      }

      clearInteractionReleaseTimer();
      if (!mapInteractingRef.current) return;
      mapInteractingRef.current = false;
      onMapInteractingChange?.(false);
    },
    [clearInteractionReleaseTimer, onMapInteractingChange],
  );

  const handleMapTouchCapture = useCallback(() => {
    emitMapInteracting(true);
    return false;
  }, [emitMapInteracting]);

  const handleMapTouchStart = useCallback(() => {
    emitMapInteracting(true);
  }, [emitMapInteracting]);

  const handleMapTouchEnd = useCallback(() => {
    emitMapInteracting(false, 140);
  }, [emitMapInteracting]);

  const openFallbackForDestination = useCallback(async (destination: RoutePoint) => {
    const currentLocation = await getCurrentLocationWithPermission();
    const origin: RoutePoint = currentLocation.coords
      ? {
        id: 'current-location',
        name: '我的位置',
        lng: currentLocation.coords.lng,
        lat: currentLocation.coords.lat,
      }
      : {
        id: `${destination.id}-origin`,
        name: '附近位置',
        lng: destination.lng - 0.0005,
        lat: destination.lat - 0.0005,
      };
    setFallbackDestination(destination);
    setFallbackOrigin(origin);
    setFallbackVisible(true);
  }, []);

  const handleNavigateToPoi = useCallback(
    async (poi: MapPoi) => {
      const destination: RoutePoint = {
        id: poi.id,
        name: poi.name,
        lng: poi.lng,
        lat: poi.lat,
      };
      const strategy = await navigateWithGaode(destination, 'walk');
      if (strategy === 'webview') {
        await openFallbackForDestination(destination);
      }
    },
    [openFallbackForDestination],
  );

  const handleToggleFavorite = useCallback(async (poi: MapPoi, currentlyFavorite: boolean) => {
    if (favoriteBusyPoiId === poi.id) return;
    setFavoriteBusyPoiId(poi.id);
    try {
      const result = currentlyFavorite
        ? await removeFavorite(poi.id, 'favorite', poi.kind)
        : await addFavorite(poi.id, poi.name, poi.kind, 'favorite');
      if (!result.success) {
        Alert.alert('操作失败', result.error ?? '请稍后重试');
        return;
      }
      Alert.alert(currentlyFavorite ? '已取消收藏' : '收藏成功', poi.name);
    } finally {
      setFavoriteBusyPoiId((prev) => (prev === poi.id ? null : prev));
    }
  }, [favoriteBusyPoiId]);

  const openPoiActions = useCallback(
    async (poi: MapPoi) => {
      const currentlyFavorite = await isInFavorites(poi.id, 'favorite', poi.kind);
      Alert.alert('地图点位操作', poi.name, [
        {
          text: '导航前往',
          onPress: () => {
            void handleNavigateToPoi(poi);
          },
        },
        {
          text: currentlyFavorite ? '取消收藏' : '收藏',
          onPress: () => {
            void handleToggleFavorite(poi, currentlyFavorite);
          },
        },
        {
          text: '查看详情',
          onPress: () => {
            router.push({
              pathname: '/poi/[id]',
              params: { id: poi.id, type: poi.kind },
            });
          },
        },
        { text: '取消', style: 'cancel' },
      ]);
    },
    [handleNavigateToPoi, handleToggleFavorite],
  );

  const onMessage = useCallback((ev: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(ev.nativeEvent.data);
      if (data?.type === 'ready') setMapReady(true);
      if (data?.type === 'error') {
        setLoadError(true);
        setMapReady(false);
        setErrorMessage(typeof data?.msg === 'string' && data.msg.trim() ? data.msg : '地图加载失败，请重试');
        emitMapInteracting(false);
      }
      if (data?.type === 'interaction') {
        if (Boolean(data.active)) {
          emitMapInteracting(true);
        } else {
          emitMapInteracting(false, 120);
        }
      }
      if (data?.type === 'poi_press') {
        const poi = toMapPoiFromMessage(data.poi);
        if (!poi) return;
        emitMapInteracting(false);
        void openPoiActions(poi);
      }
    } catch {
      /* ignore */
    }
  }, [emitMapInteracting, openPoiActions]);

  const onError = useCallback(() => {
    // EARS-2: WebView 加载失败 → 显示错误态
    setLoadError(true);
    setMapReady(false);
    setErrorMessage('地图加载失败，请检查网络后重试');
    emitMapInteracting(false);
  }, [emitMapInteracting]);

  const onRetry = useCallback(() => {
    setLoadError(false);
    setMapReady(false);
    setErrorMessage(null);
    setReloadSeed((prev) => prev + 1);
    emitMapInteracting(false);
    loadPois(activeLayer, scenicFilter);
  }, [activeLayer, scenicFilter, emitMapInteracting, loadPois]);

  const handleZoomIn = useCallback(() => {
    const code = `(function(){ if (window.__zoomIn) window.__zoomIn(); })();true;`;
    webRef.current?.injectJavaScript(code);
  }, []);

  const handleZoomOut = useCallback(() => {
    const code = `(function(){ if (window.__zoomOut) window.__zoomOut(); })();true;`;
    webRef.current?.injectJavaScript(code);
  }, []);

  useEffect(() => {
    return () => {
      clearInteractionReleaseTimer();
      emitMapInteracting(false);
    };
  }, [clearInteractionReleaseTimer, emitMapInteracting]);

  return (
    <View style={styles.container}>
      <LayerToggle
        activeLayer={activeLayer}
        scenicFilter={scenicFilter}
        onLayerChange={setActiveLayer}
        onScenicFilterChange={setScenicFilter}
      />
      <MapLegend activeLayer={activeLayer} scenicFilter={scenicFilter} count={pois.length} />
      <View style={styles.wrap}>
        {loadError ? (
          <MapErrorState
            onRetry={onRetry}
            title={errorMessage?.includes('定位') ? '定位失败' : '地图加载失败'}
            description={errorMessage ?? '请检查网络连接后重试'}
          />
        ) : (
          <>
            {isLoading && (
              <View style={styles.loadingOverlay} pointerEvents="none">
                <View style={styles.spinner} />
              </View>
            )}
            <View
              style={styles.webFallback}
              onStartShouldSetResponderCapture={handleMapTouchCapture}
              onMoveShouldSetResponderCapture={handleMapTouchCapture}
              onTouchStart={handleMapTouchStart}
              onTouchEnd={handleMapTouchEnd}
              onTouchCancel={handleMapTouchEnd}
            >
              <WebView
                key={webViewKey}
                ref={webRef}
                source={{ html, baseUrl: 'https://m.amap.com' }}
                style={styles.web}
                originWhitelist={['*']}
                javaScriptEnabled
                domStorageEnabled
                mixedContentMode="always"
                setBuiltInZoomControls={false}
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
                scrollEnabled={false}
                onMessage={onMessage}
                onError={onError}
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                {...(isWeb ? {} : { overScrollMode: 'never' as const })}
              />
            </View>
            <View style={styles.zoomControls} pointerEvents="box-none">
              <TouchableOpacity style={styles.zoomBtn} onPress={handleZoomIn} activeOpacity={0.85}>
                <Text style={styles.zoomText}>+</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.zoomBtn} onPress={handleZoomOut} activeOpacity={0.85}>
                <Text style={styles.zoomText}>-</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
      <Modal
        visible={fallbackVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setFallbackVisible(false)}
      >
        <SafeAreaView style={styles.fallbackWrap}>
          <View style={styles.fallbackHeader}>
            <Text style={styles.fallbackTitle}>应用内导航降级</Text>
            <TouchableOpacity onPress={() => setFallbackVisible(false)}>
              <Text style={styles.fallbackCloseText}>关闭</Text>
            </TouchableOpacity>
          </View>
          {fallbackDestination ? (
            <RouteWebViewFallback
              origin={fallbackOrigin ?? fallbackDestination}
              destination={fallbackDestination}
              mode="walk"
            />
          ) : null}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  wrap: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#E8DFD0',
    height: 360,
  },
  web: {
    height: 360,
    backgroundColor: 'transparent',
  },
  webFallback: {
    flex: 1,
    backgroundColor: '#F7F3EC',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(247,243,236,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  spinner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: '#C8914A',
    borderTopColor: 'transparent',
  },
  zoomControls: {
    position: 'absolute',
    top: 12,
    right: 12,
    gap: 8,
    zIndex: 30,
  },
  zoomBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(120,103,81,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  zoomText: {
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '700',
    color: '#2E251A',
    marginTop: -1,
  },
  fallbackWrap: {
    flex: 1,
    backgroundColor: '#F7F3EC',
  },
  fallbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(120,103,81,0.18)',
  },
  fallbackTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2E251A',
  },
  fallbackCloseText: {
    fontSize: 14,
    color: '#C8914A',
    fontWeight: '600',
  },
});
