import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import {
  CULTURE_MAP_DEFAULT_CENTER,
  CULTURE_MAP_DEFAULT_STYLE,
  CULTURE_MAP_FEATURES,
  CULTURE_MAP_POIS,
  type CultureMapLayer,
} from '@/constants/cultureMapData';

export type CultureMapViewProps = {
  activeLayer: CultureMapLayer;
  /** A 级景区图层下：全部 A 级或仅 5A */
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

function buildMapHtml(amapKey: string, mapStyleUri: string) {
  const { lng: centerLng, lat: centerLat } = CULTURE_MAP_DEFAULT_CENTER;
  const poisJson = JSON.stringify(CULTURE_MAP_POIS);
  const featuresJson = JSON.stringify([...CULTURE_MAP_FEATURES]);
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
      var FEATURES = ${featuresJson};
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

      function filterPois(layer, scenicFilter) {
        return POIS.filter(function (p) {
          if (layer === 'heritage') return p.kind === 'heritage';
          if (layer === 'museum') return p.kind === 'museum';
          if (layer === 'scenic') {
            if (scenicFilter === '5A') {
              return p.kind === 'scenic' && p.scenicLevel === '5A';
            }
            return p.kind === 'scenic';
          }
          return true;
        });
      }

      function applyLayer(layer, scenicFilter) {
        if (!map) return;
        map.remove(markerList);
        markerList = [];
        var list = filterPois(layer, scenicFilter || 'all');
        list.forEach(function (p) {
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
            map.setZoomAndCenter(11, [${centerLng}, ${centerLat}]);
          }
        } catch (e) {}
      }

      window.__applyLayer = applyLayer;

      map = new AMap.Map('container', {
        zoom: 12,
        center: [${centerLng}, ${centerLat}],
        mapStyle: mapStyleUri,
        viewMode: '2D',
      });
      try {
        map.setFeatures(FEATURES);
      } catch (e) {}

      map.on('complete', function () {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
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
  <div>请配置环境变量 <b>EXPO_PUBLIC_AMAP_KEY</b> 后重新加载，即可显示高德文化地图底图与周边点位。</div>
</body></html>`;
}

export function CultureMapView({ activeLayer, scenicFilter }: CultureMapViewProps) {
  const isWeb = Platform.OS === 'web';
  const webRef = useRef<WebView>(null);
  const [mapReady, setMapReady] = useState(false);
  const amapKey = useMemo(() => getWebApiKey(), []);
  const mapStyleUri = useMemo(() => getMapStyleUri(), []);
  const filteredPois = useMemo(() => {
    return CULTURE_MAP_POIS.filter((p) => {
      if (activeLayer === 'heritage') return p.kind === 'heritage';
      if (activeLayer === 'museum') return p.kind === 'museum';
      if (activeLayer === 'scenic') {
        if (scenicFilter === '5A') return p.kind === 'scenic' && p.scenicLevel === '5A';
        return p.kind === 'scenic';
      }
      return true;
    });
  }, [activeLayer, scenicFilter]);

  const html = useMemo(
    () => (amapKey ? buildMapHtml(amapKey, mapStyleUri) : buildPlaceholderHtml()),
    [amapKey, mapStyleUri],
  );

  const injectLayer = useCallback(() => {
    const layer = JSON.stringify(activeLayer);
    const sf = JSON.stringify(scenicFilter);
    const code = `(function(){
      if (window.__applyLayer) window.__applyLayer(${layer}, ${sf});
    })();true;`;
    webRef.current?.injectJavaScript(code);
  }, [activeLayer, scenicFilter]);

  useEffect(() => {
    if (!amapKey || !mapReady) return;
    injectLayer();
  }, [amapKey, mapReady, injectLayer]);

  const onMessage = useCallback((ev: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(ev.nativeEvent.data);
      if (data?.type === 'ready') setMapReady(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setMapReady(false);
  }, [html]);

  if (isWeb) {
    return (
      <View style={styles.wrap}>
        <View style={styles.webFallback}>
          <Text style={styles.webFallbackTitle}>Web 预览模式</Text>
          <Text style={styles.webFallbackDesc}>
            当前浏览器端不支持 `react-native-webview`，已降级为点位列表预览。
          </Text>
          <Text style={styles.webFallbackMeta}>
            当前图层：{activeLayer === 'heritage' ? '文保' : activeLayer === 'museum' ? '博物馆' : scenicFilter === '5A' ? 'A级景区（仅5A）' : 'A级景区（全部）'}
          </Text>
          <View style={styles.poiList}>
            {filteredPois.map((poi) => (
              <View key={poi.id} style={styles.poiItem}>
                <Text style={styles.poiName}>{poi.name}</Text>
                <Text style={styles.poiCoord}>
                  {poi.lat.toFixed(4)}, {poi.lng.toFixed(4)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
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
        // Android 需要允许高德脚本
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
    padding: 14,
    backgroundColor: '#F7F3EC',
  },
  webFallbackTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1A1603',
  },
  webFallbackDesc: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: '#5C5040',
  },
  webFallbackMeta: {
    marginTop: 8,
    fontSize: 11,
    color: '#9A8A78',
  },
  poiList: {
    marginTop: 10,
    gap: 6,
  },
  poiItem: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  poiName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1A1603',
  },
  poiCoord: {
    marginTop: 2,
    fontSize: 10,
    color: '#9A8A78',
  },
});
