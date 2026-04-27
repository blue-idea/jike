import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Flame, Landmark, LocateFixed, MapPinned, RefreshCcw, School } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { CommonTopBar } from '@/components/ui/CommonTopBar';
import { HeatmapDegradedView } from '@/components/heatmap/HeatmapLayer';
import {
  getDegradedMessage,
  hasHeatmapKey,
  queryPoiTrendInfos,
  type HeatmapDegradedReason,
  type PoiTrendInfo,
} from '@/lib/heatmap/heatmapService';
import { queryNearbyPoisRPC, type NearbyPoi, type PoiType } from '@/lib/location/nearbyQueries';
import { getCurrentLocation, requestLocationPermission } from '@/lib/location/locationService';

type PoiFilter = 'all' | PoiType;

const FILTER_OPTIONS: { id: PoiFilter; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'scenic', label: '景区' },
  { id: 'museum', label: '博物馆' },
  { id: 'heritage', label: '文保单位' },
];

const HEAT_LEVEL_TEXT: Record<PoiTrendInfo['heat_level'], string> = {
  high: '高热',
  medium: '中热',
  low: '平稳',
};

const SCENIC_RADIUS_STEPS = [12000, 30000, 60000, 120000];
const MUSEUM_RADIUS_M = 20000;
const HERITAGE_RADIUS_M = 25000;

function mergeUniquePois(groups: NearbyPoi[][], maxCount: number): NearbyPoi[] {
  const map = new Map<string, NearbyPoi>();
  for (const group of groups) {
    for (const item of group) {
      const key = `${item.poi_type}:${item.id}`;
      if (!map.has(key)) {
        map.set(key, item);
      }
      if (map.size >= maxCount) {
        return [...map.values()];
      }
    }
  }
  return [...map.values()];
}

function poiTypeLabel(type: PoiType): string {
  if (type === 'scenic') return '景区';
  if (type === 'museum') return '博物馆';
  return '文保单位';
}

function heatBadgeColor(level: PoiTrendInfo['heat_level']): string {
  if (level === 'high') return '#B5352A';
  if (level === 'medium') return '#C8914A';
  return '#4A8C6F';
}

export default function HeatmapTrendsScreen() {
  const [poiFilter, setPoiFilter] = useState<PoiFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [degradedReason, setDegradedReason] = useState<HeatmapDegradedReason | null>(null);
  const [degradedDetail, setDegradedDetail] = useState<string | null>(null);
  const [trendItems, setTrendItems] = useState<PoiTrendInfo[]>([]);
  const [scenicRadiusUsed, setScenicRadiusUsed] = useState<number>(SCENIC_RADIUS_STEPS[0]);

  const loadBalancedNearbyPois = useCallback(async (center: { lng: number; lat: number }) => {
    let scenic: NearbyPoi[] = [];
    let radiusUsed = SCENIC_RADIUS_STEPS[0];

    for (const radius of SCENIC_RADIUS_STEPS) {
      scenic = await queryNearbyPoisRPC(center, {
        radiusM: radius,
        poiType: 'scenic',
        limit: 8,
      });
      radiusUsed = radius;
      if (scenic.length >= 3) {
        break;
      }
    }

    const [museum, heritage, mixed] = await Promise.all([
      queryNearbyPoisRPC(center, { radiusM: MUSEUM_RADIUS_M, poiType: 'museum', limit: 10 }),
      queryNearbyPoisRPC(center, { radiusM: HERITAGE_RADIUS_M, poiType: 'heritage', limit: 8 }),
      queryNearbyPoisRPC(center, { radiusM: SCENIC_RADIUS_STEPS[0], limit: 30 }),
    ]);

    setScenicRadiusUsed(radiusUsed);
    return mergeUniquePois([scenic, museum, heritage, mixed], 24);
  }, []);

  const resolveContext = useCallback(async (requestPermissionFirst: boolean) => {
    setIsLoading(true);
    setDegradedDetail(null);

    try {
      if (!hasHeatmapKey()) {
        setDegradedReason('no_key');
        setTrendItems([]);
        return;
      }

      if (requestPermissionFirst) {
        const status = await requestLocationPermission();
        if (status !== 'granted') {
          setDegradedReason('no_location');
          setTrendItems([]);
          return;
        }
      }

      const location = await getCurrentLocation();
      if (!location.coords) {
        setDegradedReason('no_location');
        setDegradedDetail(location.error ?? null);
        setTrendItems([]);
        return;
      }

      const nearbyPois = await loadBalancedNearbyPois(location.coords);
      if (!nearbyPois.length) {
        setDegradedReason(null);
        setTrendItems([]);
        return;
      }

      const trendResult = await queryPoiTrendInfos(nearbyPois);
      setTrendItems(trendResult.items);
      setDegradedReason(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message === 'no_key') {
        setDegradedReason('no_key');
      } else {
        setDegradedReason('network_error');
      }
      setDegradedDetail(message || null);
      setTrendItems([]);
      setScenicRadiusUsed(SCENIC_RADIUS_STEPS[0]);
    } finally {
      setIsLoading(false);
      setIsActionLoading(false);
    }
  }, [loadBalancedNearbyPois]);

  useEffect(() => {
    void resolveContext(false);
  }, [resolveContext]);

  const degradedMessage = degradedDetail || (degradedReason ? getDegradedMessage(degradedReason) : '');
  const controlsDisabled = isLoading || Boolean(degradedReason);

  const sortedItems = useMemo(() => {
    const filtered = trendItems.filter((item) => (poiFilter === 'all' ? true : item.poi.poi_type === poiFilter));
    return [...filtered].sort((a, b) => b.heat_score - a.heat_score || (a.poi.distance_m ?? 0) - (b.poi.distance_m ?? 0));
  }, [trendItems, poiFilter]);

  const stats = useMemo(() => {
    const scenic = trendItems.filter((item) => item.poi.poi_type === 'scenic').length;
    const museum = trendItems.filter((item) => item.poi.poi_type === 'museum').length;
    const heritage = trendItems.filter((item) => item.poi.poi_type === 'heritage').length;
    return { scenic, museum, heritage };
  }, [trendItems]);

  const handleRequestPermission = useCallback(() => {
    setIsActionLoading(true);
    void resolveContext(true);
  }, [resolveContext]);

  const handleRetry = useCallback(() => {
    setIsActionLoading(true);
    void resolveContext(false);
  }, [resolveContext]);

  const handleCategorySelect = useCallback(
    (next: PoiFilter) => {
      if (controlsDisabled) return;
      setPoiFilter(next);
    },
    [controlsDisabled],
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <CommonTopBar title="热力与人流趋势" showBack />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.introCard}>
          <Text style={styles.introTitle}>周边文旅热力信息</Text>
          <Text style={styles.introDesc}>仅展示你周边景区、博物馆与文保单位的热力结果，不展示路况信息与地图。</Text>
        </View>

        <View style={[styles.filterRow, controlsDisabled && styles.disabledBlock]}>
          {FILTER_OPTIONS.map((item) => {
            const active = poiFilter === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.filterBtn, active && styles.filterBtnActive]}
                disabled={controlsDisabled}
                onPress={() => setPoiFilter(item.id)}
              >
                <Text style={[styles.filterBtnText, active && styles.filterBtnTextActive]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {!isLoading && !degradedReason ? (
          <View style={styles.summaryCard}>
            <TouchableOpacity
              style={[styles.summaryItem, poiFilter === 'scenic' && styles.summaryItemActive]}
              onPress={() => handleCategorySelect('scenic')}
              activeOpacity={0.85}
            >
              <MapPinned size={14} color={Colors.primary} />
              <Text style={[styles.summaryText, poiFilter === 'scenic' && styles.summaryTextActive]}>景区 {stats.scenic}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.summaryItem, poiFilter === 'museum' && styles.summaryItemActive]}
              onPress={() => handleCategorySelect('museum')}
              activeOpacity={0.85}
            >
              <School size={14} color={Colors.primary} />
              <Text style={[styles.summaryText, poiFilter === 'museum' && styles.summaryTextActive]}>博物馆 {stats.museum}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.summaryItem, poiFilter === 'heritage' && styles.summaryItemActive]}
              onPress={() => handleCategorySelect('heritage')}
              activeOpacity={0.85}
            >
              <Landmark size={14} color={Colors.primary} />
              <Text style={[styles.summaryText, poiFilter === 'heritage' && styles.summaryTextActive]}>文保 {stats.heritage}</Text>
            </TouchableOpacity>
            {stats.scenic === 0 ? (
              <Text style={styles.summaryHint}>当前范围内暂无景区点位（已扩展至 {Math.round(scenicRadiusUsed / 1000)}km）。</Text>
            ) : scenicRadiusUsed > SCENIC_RADIUS_STEPS[0] ? (
              <Text style={styles.summaryHint}>景区已扩展检索至 {Math.round(scenicRadiusUsed / 1000)}km。</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.listWrap}>
          {isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={styles.loadingText}>正在汇总周边热力...</Text>
            </View>
          ) : degradedReason ? (
            <HeatmapDegradedView
              message={degradedMessage}
              onRetry={degradedReason === 'no_location' ? handleRequestPermission : handleRetry}
            />
          ) : sortedItems.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>{poiFilter === 'all' ? '附近暂无可展示点位' : '当前分类暂无内容'}</Text>
              <Text style={styles.emptyDesc}>
                {poiFilter === 'all'
                  ? '可以稍后重试，或移动到更核心区域后刷新。'
                  : '可切换其他分类，或点击“全部”查看全部点位。'}
              </Text>
            </View>
          ) : (
            <View style={styles.cardsWrap}>
              {sortedItems.map((item) => (
                <View key={item.poi.id} style={styles.poiCard}>
                  <View style={styles.poiTopRow}>
                    <Text style={styles.poiName} numberOfLines={1}>
                      {item.poi.name}
                    </Text>
                    <Text style={styles.poiType}>{poiTypeLabel(item.poi.poi_type)}</Text>
                  </View>

                  <View style={styles.badgeRow}>
                    <View style={[styles.badge, { backgroundColor: heatBadgeColor(item.heat_level) }]}>
                      <Text style={styles.badgeText}>热力 {item.heat_score} · {HEAT_LEVEL_TEXT[item.heat_level]}</Text>
                    </View>
                    <Flame size={14} color={heatBadgeColor(item.heat_level)} />
                  </View>

                  <Text style={styles.poiMeta}>
                    {item.poi.distance_display ?? '距离未知'}
                    {item.poi.label ? ` · ${item.poi.label}` : ''}
                    {item.poi.province ? ` · ${item.poi.province}` : ''}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.actionRow}>
          {degradedReason === 'no_location' ? (
            <TouchableOpacity
              style={[styles.actionBtn, isActionLoading && styles.actionBtnDisabled]}
              onPress={handleRequestPermission}
              disabled={isActionLoading}
            >
              <LocateFixed size={15} color={Colors.white} />
              <Text style={styles.actionBtnText}>{isActionLoading ? '授权中...' : '授权定位并刷新'}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, isActionLoading && styles.actionBtnDisabled]}
              onPress={handleRetry}
              disabled={isActionLoading}
            >
              <RefreshCcw size={15} color={Colors.white} />
              <Text style={styles.actionBtnText}>{isActionLoading ? '刷新中...' : '刷新周边信息'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
    gap: 12,
  },
  introCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  introTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  introDesc: {
    fontSize: 13,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  filterBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '15',
  },
  filterBtnText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  filterBtnTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.cardMuted,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexWrap: 'wrap',
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  summaryItemActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '15',
  },
  summaryText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  summaryTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  summaryHint: {
    width: '100%',
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  listWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.card,
    minHeight: 220,
  },
  loadingWrap: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  emptyWrap: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '700',
  },
  emptyDesc: {
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  cardsWrap: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 10,
  },
  poiCard: {
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 12,
    backgroundColor: Colors.card,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 7,
  },
  poiTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  poiName: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    fontWeight: '700',
  },
  poiType: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    color: Colors.white,
    fontWeight: '700',
  },
  poiMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  actionRow: {
    marginTop: 2,
  },
  actionBtn: {
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    backgroundColor: Colors.primary,
  },
  actionBtnDisabled: {
    opacity: 0.65,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
  disabledBlock: {
    opacity: 0.55,
  },
});
