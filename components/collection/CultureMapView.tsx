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
import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import {
  CULTURE_MAP_DEFAULT_CENTER,
  CULTURE_MAP_DEFAULT_STYLE,
  CULTURE_MAP_FEATURES,
} from '@/constants/cultureMapData';
import { MapErrorState } from '@/components/catalog/MapErrorState';
import { queryMapPois, type CultureMapLayer, type MapPoi } from '@/lib/catalog/supabaseCatalogQueries';

export type CultureMapViewProps = {
  activeLayer: CultureMapLayer;
  scenicFilter: 'all' | '5A';
};

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

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
  <style>
    html, body, #container { margin: 0; padding: 0; width: 100%; height: 100%; }
    body { background: #faf7f2; }
  </style>
  <script src="https://webapi.amap.com/maps?v=2.0&key=${amapKey}"></script>
</head>
<body>
  <div id="container"></div>
  <script>
    (function () {
      var POIS = ${poisJson};
      var mapStyleUri = ${styleJson};
      var map;
      var markerList = [];

      function markerHtml(color) {
        return (
          '<div style="width:14px;height:14px;border-radius:50%;background:' +
          color +
          ';border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.28);"></div>'
        );
      }

      function colorFor(kind) {
        if (kind === 'heritage') return '#813520';
        if (kind === 'museum') return '#2C4A3E';
        return '#C8914A';
      }

      function renderPois(layer, scenicFilter) {
        map.remove(markerList);
        markerList = [];
        var filtered = POIS.filter(function (p) {
          if (layer === 'heritage') return p.kind === 'heritage';
          if (layer === 'museum') return p.kind === 'museum';
          if (layer === 'scenic') {
            if (scenicFilter === '5A') return p.kind === 'scenic' && p.scenicLevel === '5A';
            return p.kind === 'scenic';
          }
          return true;
        });
        filtered.forEach(function (p) {
          var m = new AMap.Marker({
            position: [p.lng, p.lat],
            title: p.name,
            offset: new AMap.Pixel(-7, -7),
            content: markerHtml(colorFor(p.kind)),
          });
          markerList.push(m);
        });
        map.add(markerList);
        try {
          if (markerList.length) {
            map.setFitView(markerList, false, [52, 52, 52, 52], 14);
          } else {
            map.setZoomAndCenter(11, [${center.lng}, ${center.lat}]);
          }
        } catch (e) {}
      }

      window.__renderPois = renderPois;

      map = new AMap.Map('container', {
        zoom: 12,
        center: [${center.lng}, ${center.lat}],
        mapStyle: mapStyleUri,
        viewMode: '2D',
      });
      try { map.setFeatures(FEATURES); } catch (e) {}

      map.on('complete', function () {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
        }
      });
      map.on('error', function (e) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', msg: String(e) }));
        }
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

export function CultureMapView({ activeLayer, scenicFilter }: CultureMapViewProps) {
  const isWeb = Platform.OS === 'web';
  const webRef = useRef<WebView>(null);
  const [mapReady, setMapReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pois, setPois] = useState<MapPoi[]>([]);

  const amapKey = useMemo(() => getWebApiKey(), []);
  const mapStyleUri = useMemo(() => getMapStyleUri(), []);

  // EARS-1: 切换图层/筛选 → 查询 Supabase POI
  const loadPois = useCallback(
    async (layer: CultureMapLayer, sf: 'all' | '5A') => {
      setIsLoading(true);
      setLoadError(false);
      try {
        const data = await queryMapPois(layer, sf === '5A' ? '5A' : 'all');
        setPois(data);
      } catch {
        setLoadError(true);
        setPois([]);
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
    return buildMapHtml(amapKey, mapStyleUri, pois, CULTURE_MAP_DEFAULT_CENTER);
  }, [amapKey, mapStyleUri, pois]);

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
    if (!amapKey || !mapReady || pois.length === 0) return;
    injectPois();
  }, [amapKey, mapReady, pois, injectPois]);

  const onMessage = useCallback((ev: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(ev.nativeEvent.data);
      if (data?.type === 'ready') setMapReady(true);
    } catch {
      /* ignore */
    }
  }, []);

  const onError = useCallback(() => {
    // EARS-2: WebView 加载失败 → 显示错误态
    setLoadError(true);
    setMapReady(false);
  }, []);

  const onRetry = useCallback(() => {
    setLoadError(false);
    loadPois(activeLayer, scenicFilter);
  }, [activeLayer, scenicFilter, loadPois]);

  // EARS-2: 网络异常态
  if (loadError) {
    return (
      <View style={styles.wrap}>
        <MapErrorState onRetry={onRetry} />
      </View>
    );
  }

  if (isWeb) {
    return (
      <View style={styles.wrap}>
        <View style={styles.webFallback}>
          <WebView
            source={{ html, baseUrl: 'https://m.amap.com' }}
            style={styles.web}
            originWhitelist={['*']}
            javaScriptEnabled
            onMessage={onMessage}
            onError={onError}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {isLoading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <View style={styles.spinner} />
        </View>
      )}
      <WebView
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
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#E8DFD0',
    height: 240,
  },
  web: {
    height: 240,
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
});
