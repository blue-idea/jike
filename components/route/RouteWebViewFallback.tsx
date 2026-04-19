/**
 * components/route/RouteWebViewFallback.tsx
 *
 * 导航 WebView 降级组件（高德 App 未安装时使用）
 * EARS-2 覆盖：WebView + 高德 JSAPI/HTTP 展示导航降级路径
 */
import React, { useMemo } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { RouteMode, RoutePoint } from '@/lib/route/routeService';

interface RouteWebViewFallbackProps {
  origin: RoutePoint;
  destination: RoutePoint;
  mode: RouteMode;
}

function buildFallbackHtml(
  origin: RoutePoint,
  destination: RoutePoint,
  mode: RouteMode,
  amapKey: string,
) {
  const modeMap: Record<RouteMode, number> = { drive: 0, walk: 2, bus: 1 };
  const amapMode = modeMap[mode] ?? 2;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body, html { width:100%; height:100%; background:#faf7f2; }
    #container { width:100%; height:100%; }
    #panel { position:absolute; bottom:0; left:0; right:0; background:rgba(250,247,242,0.96);
      border-radius:20px 20px 0 0; padding:16px; display:none; max-height:40%; overflow-y:auto; }
    #panel.show { display:block; }
    .segment { padding:12px 0; border-bottom:1px solid rgba(0,0,0,0.06); font-size:13px; color:#5c5040; line-height:1.6; }
    .segment:last-child { border-bottom:none; }
    .dist { font-weight:700; color:#1a1603; }
    .error-msg { padding:24px; text-align:center; font-size:14px; color:#6b5e4e; line-height:1.6; }
    #title-bar { background:#2c5f6b; color:#fff; padding:10px 16px; font-size:15px; font-weight:700; }
  </style>
  <script src="https://webapi.amap.com/maps?v=2.0&key=${amapKey}"></script>
</head>
<body>
  <div id="title-bar">导航（应用内降级）</div>
  <div id="container"></div>
  <div id="panel"></div>
  <script>
    var origin = [${origin.lng}, ${origin.lat}];
    var dest = [${destination.lng}, ${destination.lat}];
    var mode = ${amapMode};
    var map = new AMap.Map('container', { zoom: 14, center: origin, viewMode: '2D' });
    AMap.plugin('AMap.Driving', function() {
      var driving = new AMap.Driving({ map: map, panel: 'panel', policy: 1 });
      driving.search(origin, dest, function(err, data) {
        if (err) {
          document.getElementById('panel').innerHTML =
            '<div class="error-msg">路线规划失败，请稍后重试</div>';
          document.getElementById('panel').classList.add('show');
        }
      });
    });
  </script>
</body>
</html>`;
}

export function RouteWebViewFallback({
  origin,
  destination,
  mode,
}: RouteWebViewFallbackProps) {
  const amapKey = process.env.EXPO_PUBLIC_AMAP_KEY ?? '';
  const html = useMemo(
    () =>
      amapKey
        ? buildFallbackHtml(origin, destination, mode, amapKey)
        : '<html><body style="background:#faf7f2;display:flex;align-items:center;justify-content:center;"><div style="text-align:center;color:#6b5e4e;font-size:14px;">请配置 EXPO_PUBLIC_AMAP_KEY</div></body></html>',
    [origin, destination, mode, amapKey],
  );

  return (
    <View style={styles.wrap}>
      <WebView
        source={{ html, baseUrl: 'https://m.amap.com' }}
        style={styles.web}
        originWhitelist={['*']}
        javaScriptEnabled
        mixedContentMode="always"
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
      />
    </View>
  );
}

const { height: SCREEN_H } = Dimensions.get('window');

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#E8DFD0' },
  web: { height: SCREEN_H * 0.7, backgroundColor: 'transparent' },
});
