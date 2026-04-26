/**
 * 收藏页「文化地图」图层数据（均以西安城区一带为展示中心，便于聚合同屏演示）。
 * 线上可替换为服务端/高德周边检索结果。
 *
 * 高德自定义底图：建议在开放平台「自定义地图」中弱化道路与底色后发布样式 ID，
 * 通过环境变量 EXPO_PUBLIC_AMAP_MAP_STYLE 传入（示例：amap://styles/你的样式ID）。
 * 未配置时使用马卡龙等柔和官方主题作为文化向默认。
 */

export type CultureMapLayer = 'heritage' | 'museum' | 'scenic';

export type CultureMapPoi = {
  id: string;
  name: string;
  kind: CultureMapLayer;
  lng: number;
  lat: number;
  /** A 级景区级别，如 5A、4A；非景区类可不填 */
  scenicLevel?: string;
};

/** 地图默认中心：西安钟楼附近 */
export const CULTURE_MAP_DEFAULT_CENTER = { lng: 108.948024, lat: 34.263161 };

/**
 * 官方柔和主题，偏文化艺术品位；与 EXPO_PUBLIC_AMAP_MAP_STYLE 二选一逻辑见 CultureMapView。
 * macaron：马卡龙浅底；也可用 whitesmoke（远山黛）等。
 */
export const CULTURE_MAP_DEFAULT_STYLE = 'amap://styles/macaron';

/**
 * 若不在控制台配置样式 ID，仍可通过 features 控制底图元素。
 * 为避免与文化地标点位混淆，这里默认关闭高德原生 point 层，仅保留背景/道路/建筑。
 */
export const CULTURE_MAP_FEATURES = ['bg', 'road', 'building'] as const;

export const CULTURE_MAP_POIS: CultureMapPoi[] = [
  { id: 'h1', name: '西安城墙（永宁门）', kind: 'heritage', lng: 108.9402, lat: 34.2516 },
  { id: 'h2', name: '西安碑林', kind: 'heritage', lng: 108.9339, lat: 34.2564 },
  { id: 'h3', name: '汉长安城遗址（部分）', kind: 'heritage', lng: 108.896, lat: 34.308 },
  { id: 'm1', name: '陕西历史博物馆', kind: 'museum', lng: 108.9541, lat: 34.226 },
  { id: 'm2', name: '西安博物院（小雁塔）', kind: 'museum', lng: 108.945, lat: 34.2385 },
  { id: 'm3', name: '秦始皇帝陵博物院', kind: 'museum', lng: 109.2787, lat: 34.3853 },
  { id: 's1', name: '大雁塔·大慈恩寺', kind: 'scenic', lng: 108.9641, lat: 34.2186, scenicLevel: '5A' },
  { id: 's2', name: '大明宫国家遗址公园', kind: 'scenic', lng: 108.962, lat: 34.292, scenicLevel: '5A' },
  { id: 's3', name: '大唐芙蓉园', kind: 'scenic', lng: 108.976, lat: 34.222, scenicLevel: '5A' },
  { id: 's4', name: '某城市公园（示例 4A）', kind: 'scenic', lng: 108.928, lat: 34.275, scenicLevel: '4A' },
];
