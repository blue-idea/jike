/**
 * components/heatmap/HeatmapLayer.tsx
 *
 * 热力/路况图层组件（WebView + 高德 JSAPI）
 * EARS-1：展示热门程度或路况图层并提供清晰图例
 * EARS-2：接口不可用或用户未授权定位时展示降级说明并灰化控件
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { getDegradedMessage } from '@/lib/heatmap/heatmapService';

export type HeatmapMode = 'traffic' | 'heat';

interface HeatmapLayerProps {
  center: { lng: number; lat: number };
  mode: HeatmapMode;
  visible: boolean;
  onLayerError?: (msg: string) => void;
}

/** 加载态 overlay */
function LoadingOverlay() {
  return (
    <View style={styles.loadingOverlay} pointerEvents="none">
      <View style={styles.spinner} />
    </View>
  );
}

/** 降级说明（灰化控件） */
interface DegradedViewProps {
  message: string;
  onRetry?: () => void;
}
export function HeatmapDegradedView({ message, onRetry }: DegradedViewProps) {
  return (
    <View style={styles.degradedWrap}>
      <Text style={styles.degradedIcon}>图层不可用</Text>
      <Text style={styles.degradedText}>{message}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
          <Text style={styles.retryText}>重试</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function buildHeatData(center: { lng: number; lat: number }) {
  const seed: [number, number, number][] = [
    [0, 0, 100],
    [0.0065, 0.0022, 84],
    [-0.0058, 0.0034, 78],
    [0.0081, -0.0042, 71],
    [-0.0061, -0.0054, 66],
    [0.0112, 0.006, 58],
    [-0.0106, 0.0078, 52],
    [0.0041, -0.0104, 49],
    [-0.0038, -0.0115, 45],
  ];
  return seed.map(([lngOffset, latOffset, count]) => ({
    lng: Number((center.lng + lngOffset).toFixed(6)),
    lat: Number((center.lat + latOffset).toFixed(6)),
    count,
  }));
}

function buildHeatmapHtml(
  amapKey: string,
  center: { lng: number; lat: number },
  mode: HeatmapMode,
) {
  const heatData = JSON.stringify(buildHeatData(center));
  const modeJson = JSON.stringify(mode);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>html,body,#container{margin:0;padding:0;width:100%;height:100%;}body{background:#faf7f2;}</style>
  <script src="https://webapi.amap.com/maps?v=2.0&key=${amapKey}"></script>
</head>
<body>
  <div id="container"></div>
  <script>
    var map = new AMap.Map('container', {
      zoom: 13,
      center: [${center.lng}, ${center.lat}],
      mapStyle: 'amap://styles/macaron',
      viewMode: '2D',
    });
    var MODE = ${modeJson};
    var HEAT_DATA = ${heatData};
    var trafficLayer = null;
    var heatLayer = null;

    function post(payload) {
      if (!window.ReactNativeWebView) return;
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }

    function resetLayers() {
      if (trafficLayer) {
        trafficLayer.setMap(null);
        trafficLayer = null;
      }
      if (heatLayer) {
        heatLayer.setMap(null);
        heatLayer = null;
      }
    }

    function renderTrafficLayer() {
      try {
        resetLayers();
        trafficLayer = new AMap.TileLayer.Traffic({
          zIndex: 20,
          autoRefresh: true,
          interval: 180,
        });
        trafficLayer.setMap(map);
        post({ type: 'layer-ready' });
      } catch (e) {
        post({ type: 'error', msg: '路况图层加载失败' });
      }
    }

    function renderHeatLayer() {
      try {
        resetLayers();
        AMap.plugin(['AMap.HeatMap'], function () {
          try {
            heatLayer = new AMap.HeatMap(map, {
              radius: 32,
              opacity: [0, 0.82],
              gradient: {
                0.25: '#5db7ff',
                0.45: '#4cd964',
                0.7: '#ffd34d',
                1.0: '#ef4444'
              }
            });
            heatLayer.setDataSet({
              data: HEAT_DATA,
              max: 100,
            });
            post({ type: 'layer-ready' });
          } catch (innerError) {
            post({ type: 'error', msg: '热力图层渲染失败' });
          }
        });
      } catch (e) {
        post({ type: 'error', msg: '热力图层加载失败' });
      }
    }

    map.on('complete', function() {
      post({ type: 'ready' });
      if (MODE === 'traffic') {
        renderTrafficLayer();
      } else {
        renderHeatLayer();
      }
    });

    map.on('error', function(e) {
      post({ type: 'error', msg: '地图加载失败' });
    });
  </script>
</body>
</html>`;
}

export function HeatmapLayer({ center, mode, visible, onLayerError }: HeatmapLayerProps) {
  const webRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const amapKey = process.env.EXPO_PUBLIC_AMAP_KEY ?? '';

  useEffect(() => {
    setIsLoading(true);
  }, [center.lat, center.lng, mode, visible]);

  const html = useMemo(() => {
    if (!amapKey) {
      return '<!DOCTYPE html><html lang="zh-CN"><body style="background:#f0ebe3;display:flex;align-items:center;justify-content:center;"><div style="text-align:center;color:#9a8a78;font-size:13px;">请配置高德 KEY</div></body></html>';
    }
    return buildHeatmapHtml(amapKey, center, mode);
  }, [amapKey, center, mode]);

  const onMessage = useCallback((ev: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(ev.nativeEvent.data);
      if (data?.type === 'ready' || data?.type === 'layer-ready') {
        setIsLoading(false);
      }
      if (data?.type === 'error') {
        onLayerError?.(String(data.msg ?? '热力图层加载失败'));
        setIsLoading(false);
      }
    } catch { /* ignore */ }
  }, [onLayerError]);

  const handleWebError = useCallback(() => {
    // EARS-2: WebView 加载失败时显示降级说明
    onLayerError?.('热力图层加载失败');
    setIsLoading(false);
  }, [onLayerError]);

  if (!visible) {
    return null;
  }

  if (!amapKey) {
    return (
      <View style={styles.wrap}>
        <HeatmapDegradedView
          message={getDegradedMessage('no_key')}
        />
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <View style={styles.wrap}>
        <WebView
          source={{ html, baseUrl: 'https://m.amap.com' }}
          style={styles.web}
          originWhitelist={['*']}
          javaScriptEnabled
          onMessage={onMessage}
          onError={handleWebError}
        />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {isLoading && <LoadingOverlay />}
      <WebView
        ref={webRef}
        source={{ html, baseUrl: 'https://m.amap.com' }}
        style={styles.web}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        setBuiltInZoomControls={false}
        scrollEnabled={false}
        onMessage={onMessage}
        onError={handleWebError}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
      />
    </View>
  );
}



const styles = StyleSheet.create({
  wrap: { height: 220, borderRadius: 16, overflow: 'hidden', backgroundColor: '#E8DFD0' },
  web: { height: 220, backgroundColor: 'transparent' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
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
  degradedWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F0EBE3',
    gap: 8,
  },
  degradedIcon: { fontSize: 14, fontWeight: '700', color: '#7A6A58' },
  degradedText: { fontSize: 13, color: '#9A8A78', textAlign: 'center' },
  retryBtn: {
    marginTop: 12,
    backgroundColor: '#C8914A',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 10,
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
