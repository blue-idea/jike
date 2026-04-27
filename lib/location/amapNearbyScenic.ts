import { formatDistance, type LocationCoords } from '@/lib/location/locationService';

export interface AmapNearbyScenicItem {
  id: string;
  name: string;
  lng: number;
  lat: number;
  province: string;
  city: string;
  district: string;
  type: string;
  level: string;
  distance: string;
  image: string | null;
  tags: string[];
  rating: number;
}

interface QueryAmapNearbyScenicOptions {
  center: LocationCoords;
  city: string;
  radiusM?: number;
  limit?: number;
}

interface AmapPlacePoi {
  id?: string;
  name?: string;
  type?: string;
  pname?: string;
  cityname?: string;
  adname?: string;
  distance?: string;
  photos?: { url?: string }[];
  biz_ext?: { rating?: string };
  location?: string;
}

interface AmapPlaceResponse {
  status?: string;
  info?: string;
  pois?: AmapPlacePoi[];
}

interface AmapGeocodeResponse {
  status?: string;
  info?: string;
  geocodes?: {
    location?: string;
  }[];
}

function getAmapWebServiceKey(): string | null {
  const key =
    process.env.EXPO_PUBLIC_AMAP_WEB_SERVICE_KEY?.trim() ||
    process.env.EXPO_PUBLIC_AMAP_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

function toSafeText(text: string | null | undefined, fallback: string): string {
  const safe = text?.trim();
  return safe && safe.length > 0 ? safe : fallback;
}

function parseLevelFromType(type: string): string {
  if (type.includes('5A')) return '5A';
  if (type.includes('4A')) return '4A';
  return '景点';
}

function buildTags(type: string, district: string): string[] {
  const tags = ['周边推荐', district];
  const firstType = type.split(';')[0]?.trim();
  if (firstType) {
    tags.push(firstType);
  }
  return tags.slice(0, 3);
}

function mapPoiToScenicItem(poi: AmapPlacePoi): AmapNearbyScenicItem | null {
  if (!poi.id || !poi.name) return null;

  const province = toSafeText(poi.pname, '未知省份');
  const city = toSafeText(poi.cityname, province);
  const district = toSafeText(poi.adname, '未知区域');
  const type = toSafeText(poi.type, '景点');
  const distanceM = Number(poi.distance);
  const rating = Number(poi.biz_ext?.rating);
  const [lngStr, latStr] = (poi.location ?? '').split(',');
  const lng = Number(lngStr);
  const lat = Number(latStr);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;

  return {
    id: poi.id,
    name: poi.name,
    lng,
    lat,
    province,
    city,
    district,
    type,
    level: parseLevelFromType(type),
    distance: Number.isFinite(distanceM) ? formatDistance(distanceM) : '距离未知',
    image: poi.photos?.[0]?.url?.trim() || null,
    tags: buildTags(type, district),
    rating: Number.isFinite(rating) ? rating : 0,
  };
}

type ScenicBucket = 'scenic' | 'landmark' | 'museum';

function classifyBucket(item: AmapNearbyScenicItem): ScenicBucket {
  const text = `${item.name}|${item.type}`;
  if (text.includes('博物馆') || text.includes('博物院')) return 'museum';
  if (
    text.includes('喷泉广场') ||
    text.includes('广场') ||
    text.includes('城市公园') ||
    text.includes('公园广场')
  ) {
    return 'landmark';
  }
  return 'scenic';
}

function dedupeByName(items: AmapNearbyScenicItem[]): AmapNearbyScenicItem[] {
  const seen = new Set<string>();
  const result: AmapNearbyScenicItem[] = [];
  for (const item of items) {
    const key = item.name.trim();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function pickFirstByBucket(
  items: AmapNearbyScenicItem[],
  bucket: ScenicBucket,
  used: Set<string>,
): AmapNearbyScenicItem | null {
  for (const item of items) {
    if (used.has(item.name)) continue;
    if (classifyBucket(item) !== bucket) continue;
    used.add(item.name);
    return item;
  }
  return null;
}

function pickNext(
  items: AmapNearbyScenicItem[],
  used: Set<string>,
): AmapNearbyScenicItem | null {
  for (const item of items) {
    if (used.has(item.name)) continue;
    used.add(item.name);
    return item;
  }
  return null;
}

export async function queryAmapNearbyScenic(
  options: QueryAmapNearbyScenicOptions,
): Promise<AmapNearbyScenicItem[]> {
  const { center, city, radiusM = 10000, limit = 5 } = options;
  const key = getAmapWebServiceKey();
  if (!key) {
    throw new Error('缺少高德 Web Service Key（EXPO_PUBLIC_AMAP_WEB_SERVICE_KEY）');
  }

  const cityName = city.trim();
  if (!cityName) {
    throw new Error('缺少城市信息，无法获取城市景点排行榜');
  }

  // 1) 先解析城市中心点（全市榜单基于城市中心+权重排序，不按当前区县）
  const geoParams = new URLSearchParams({
    key,
    address: cityName,
  });
  const geoResponse = await fetch(`https://restapi.amap.com/v3/geocode/geo?${geoParams.toString()}`);
  if (!geoResponse.ok) {
    throw new Error(`高德城市地理编码失败（HTTP ${geoResponse.status}）`);
  }
  const geoJson = (await geoResponse.json()) as AmapGeocodeResponse;
  if (geoJson.status !== '1') {
    throw new Error(geoJson.info?.trim() || '高德城市地理编码失败');
  }
  const cityLocation = geoJson.geocodes?.[0]?.location?.trim();
  if (!cityLocation) {
    throw new Error('未获取到城市中心点，无法生成全市扫街榜');
  }

  // 2) 数据源A：全市必去景点（城市地标倾向）
  const aroundMustGoParams = new URLSearchParams({
    key,
    location: cityLocation,
    keywords: '必去景点',
    types: '110000',
    radius: '50000',
    sortrule: 'weight',
    offset: '30',
    page: '1',
    extensions: 'all',
  });

  const aroundMustGoResponse = await fetch(
    `https://restapi.amap.com/v3/place/around?${aroundMustGoParams.toString()}`,
  );
  if (!aroundMustGoResponse.ok) {
    throw new Error(`高德全市扫街榜检索失败（HTTP ${aroundMustGoResponse.status}）`);
  }
  const aroundMustGoJson = (await aroundMustGoResponse.json()) as AmapPlaceResponse;
  if (aroundMustGoJson.status !== '1') {
    throw new Error(aroundMustGoJson.info?.trim() || '高德全市扫街榜检索失败');
  }

  const aroundMustGoList = (aroundMustGoJson.pois ?? [])
    .map(mapPoiToScenicItem)
    .filter((item): item is AmapNearbyScenicItem => item !== null)
    .map((item) => ({
      ...item,
      rating: item.rating > 0 ? item.rating : 4.8,
    }));

  // 3) 数据源B：城市必去景点文本检索（远距离目的地倾向）
  const textMustGoParams = new URLSearchParams({
    key,
    keywords: `${cityName} 必去景点`,
    city: cityName,
    citylimit: 'false',
    offset: '30',
    page: '1',
    extensions: 'all',
  });
  const textMustGoResponse = await fetch(
    `https://restapi.amap.com/v3/place/text?${textMustGoParams.toString()}`,
  );
  if (!textMustGoResponse.ok) {
    throw new Error(`高德全市扫街榜文本检索失败（HTTP ${textMustGoResponse.status}）`);
  }
  const textMustGoJson = (await textMustGoResponse.json()) as AmapPlaceResponse;
  if (textMustGoJson.status !== '1') {
    throw new Error(textMustGoJson.info?.trim() || '高德全市扫街榜文本检索失败');
  }
  const textMustGoList = (textMustGoJson.pois ?? [])
    .map(mapPoiToScenicItem)
    .filter((item): item is AmapNearbyScenicItem => item !== null)
    .map((item) => ({
      ...item,
      rating: item.rating > 0 ? item.rating : 4.8,
    }));

  // 4) 数据源C：全市旅游景点权重（用于补充博物馆/城市地标）
  const aroundTourParams = new URLSearchParams({
    key,
    location: cityLocation,
    keywords: '旅游景点',
    radius: '200000',
    sortrule: 'weight',
    offset: '30',
    page: '1',
    extensions: 'all',
  });
  const aroundTourResponse = await fetch(
    `https://restapi.amap.com/v3/place/around?${aroundTourParams.toString()}`,
  );
  if (!aroundTourResponse.ok) {
    throw new Error(`高德旅游景点补充检索失败（HTTP ${aroundTourResponse.status}）`);
  }
  const aroundTourJson = (await aroundTourResponse.json()) as AmapPlaceResponse;
  if (aroundTourJson.status !== '1') {
    throw new Error(aroundTourJson.info?.trim() || '高德旅游景点补充检索失败');
  }
  const aroundTourList = (aroundTourJson.pois ?? [])
    .map(mapPoiToScenicItem)
    .filter((item): item is AmapNearbyScenicItem => item !== null)
    .map((item) => ({
      ...item,
      rating: item.rating > 0 ? item.rating : 4.8,
    }));

  // 5) 榜单编排策略（全市扫街榜）：景点 -> 城市地标 -> 景点 -> 博物馆 -> 景点
  const mergedPrimary = dedupeByName([...textMustGoList, ...aroundMustGoList, ...aroundTourList]);
  const used = new Set<string>();
  const ranked: AmapNearbyScenicItem[] = [];

  const scenic1 = pickFirstByBucket(mergedPrimary, 'scenic', used);
  if (scenic1) ranked.push(scenic1);
  const landmark = pickFirstByBucket(mergedPrimary, 'landmark', used);
  if (landmark) ranked.push(landmark);
  const scenic2 = pickFirstByBucket(mergedPrimary, 'scenic', used);
  if (scenic2) ranked.push(scenic2);
  const museum = pickFirstByBucket(mergedPrimary, 'museum', used);
  if (museum) ranked.push(museum);
  const scenic3 = pickFirstByBucket(mergedPrimary, 'scenic', used);
  if (scenic3) ranked.push(scenic3);

  while (ranked.length < limit) {
    const next = pickNext(mergedPrimary, used);
    if (!next) break;
    ranked.push(next);
  }

  if (ranked.length > 0) {
    return ranked.slice(0, limit).map((item, index) => ({
      ...item,
      distance: `TOP ${index + 1}`,
    }));
  }

  // 3) 榜单为空时，回退到当前位置周边检索兜底
  const params = new URLSearchParams({
    key,
    location: `${center.lng},${center.lat}`,
    types: '110000',
    radius: String(radiusM),
    sortrule: 'distance',
    offset: String(Math.max(limit, 5)),
    page: '1',
    extensions: 'all',
  });

  const response = await fetch(`https://restapi.amap.com/v3/place/around?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`高德景点检索失败（HTTP ${response.status}）`);
  }

  const json = (await response.json()) as AmapPlaceResponse;
  if (json.status !== '1') {
    throw new Error(json.info?.trim() || '高德景点检索失败');
  }

  const mapped = (json.pois ?? [])
    .map(mapPoiToScenicItem)
    .filter((item): item is AmapNearbyScenicItem => item !== null)
    .map((item) => ({
      ...item,
      rating: item.rating > 0 ? item.rating : 4.8,
    }));

  return mapped.slice(0, limit);
}
