/**
 * components/heatmap/HeatmapLayer.tsx
 *
 * 热力/路况图层组件（WebView + 高德 JSAPI）
 * EARS-1：展示热门程度或路况图层并提供清晰图例
 * EARS-2：接口不可用或用户未授权定位时展示降级说明并灰化控件
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';

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
      <Text style={styles.degradedIcon}>📡</Text>
      <Text style={styles.degradedText}>{message}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
          <Text style={styles.retryText}>重试</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function buildHeatmapHtml(
  amapKey: string,
  center: { lng: number; lat: number },
  mode: HeatmapMode,
) {
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
    map.on('complete', function() {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({type:'ready'}));
      }
    });
    map.on('error', function(e) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',msg:String(e)}));
      }
    });
    // 热力图层（实际数据需服务端下发，此处展示空图层结构占位）
    // 真实场景：热力数据通过 AMap.HeatMapLayer.setDataSet 配置
  </script>
</body>
</html>`;
}

export function HeatmapLayer({ center, mode, visible, onLayerError }: HeatmapLayerProps) {
  const webRef = useRef<WebView>(null);
    const [isLoading, setIsLoading] = useState(true);
  const amapKey = process.env.EXPO_PUBLIC_AMAP_KEY ?? '';

  const html = useMemo(() => {
    if (!amapKey || !visible) {
      return '<!DOCTYPE html><html lang="zh-CN"><body style="background:#f0ebe3;display:flex;align-items:center;justify-content:center;"><div style="text-align:center;color:#9a8a78;font-size:13px;">请配置高德 KEY</div></body></html>';
    }
    return buildHeatmapHtml(amapKey, center, mode);
  }, [amapKey, visible, center, mode]);

  const onMessage = useCallback((ev: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(ev.nativeEvent.data);
      if (data?.type === 'ready') { setIsLoading(false) }
      if (data?.type === 'error') { onLayerError?.(String(data.msg)); setIsLoading(false); }
    } catch { /* ignore */ }
  }, [onLayerError]);

  const handleWebError = useCallback(() => {
    // EARS-2: WebView 加载失败时显示降级说明
    onLayerError?.("热力图层加载失败");
  }, [onLayerError]);

  if (!visible || !amapKey) {
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
  degradedIcon: { fontSize: 28 },
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
