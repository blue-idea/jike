import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  Modal,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { FEATURED_SITES } from '@/constants/MockData';
import { HeroCarousel } from '@/components/home/HeroCarousel';
import { CategoryFilter } from '@/components/home/CategoryFilter';
import { SiteCard } from '@/components/home/SiteCard';
import { NearbyCard } from '@/components/home/NearbyCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import {
  getCurrentLocationWithPermission,
  reverseGeocodeLocation,
} from '@/lib/location/locationService';
import {
  queryAmapNearbyScenic,
  type AmapNearbyScenicItem,
} from '@/lib/location/amapNearbyScenic';
import {
  normalizeCatalogLocation,
  useCatalogLocation,
} from '@/contexts/CatalogLocationContext';
import { MapPin, Mic, Sparkles } from 'lucide-react-native';
import { BrandHeader } from '@/components/ui/BrandHeader';
import { useNearbyPois } from '@/hooks/useNearbyPois';
import { navigateWithGaode, type RoutePoint } from '@/lib/route/routeService';
import { RouteWebViewFallback } from '@/components/route/RouteWebViewFallback';
import {
  bannerMetaForFeaturedSite,
  bannerMetaForNearbyPoi,
  type FeaturedSiteUnion,
} from '@/lib/ai/inlineAiGuideBannerMeta';
import { useInlineAiGuideModal } from '@/hooks/useInlineAiGuideModal';
import { checkInToPoi } from '@/lib/checkin/checkinService';
import {
  addFavorite,
  isInFavorites,
  removeFavorite,
  type FavoritePoiSnapshot,
} from '@/lib/favorites/favoritesService';
import type { PoiType } from '@/lib/poi/poiQueries';

export default function HomeScreen() {
  const { setHomeCatalogLocation } = useCatalogLocation();
  const { inlineAiGuideModal, triggerInlineAiGuide } = useInlineAiGuideModal();
  const [location, setLocation] = useState('定位中...');
  const [featuredScenic, setFeaturedScenic] = useState<AmapNearbyScenicItem[]>(
    [],
  );
  const [featuredScenicLoading, setFeaturedScenicLoading] = useState(false);
  const [featuredScenicError, setFeaturedScenicError] = useState<string | null>(
    null,
  );
  const [fallbackVisible, setFallbackVisible] = useState(false);
  const [fallbackDestination, setFallbackDestination] =
    useState<RoutePoint | null>(null);
  const [checkInBusyPoiId, setCheckInBusyPoiId] = useState<string | null>(null);
  const [checkedInPoiIds, setCheckedInPoiIds] = useState<string[]>([]);
  const [favoriteKeys, setFavoriteKeys] = useState<Set<string>>(new Set());
  const [favoriteBusyKeys, setFavoriteBusyKeys] = useState<Set<string>>(
    new Set(),
  );

  const {
    pois: nearbyPois,
    loading: nearbyLoading,
    error: nearbyError,
    locationCoords,
    locationAccuracy,
    refresh: refreshNearby,
  } = useNearbyPois({ radiusM: 10000 });

  const displayedFeaturedSites = useMemo(
    () => (featuredScenic.length > 0 ? featuredScenic : FEATURED_SITES),
    [featuredScenic],
  );

  const buildFavoriteKey = useCallback(
    (poiType: PoiType, poiId: string) => `${poiType}:${poiId}`,
    [],
  );

  const resolveFeaturedPoiType = useCallback(
    (site: FeaturedSiteUnion): PoiType => {
      if ('category' in site) {
        if (site.category === 'museum') return 'museum';
        if (site.category === 'heritage') return 'heritage';
      }
      return 'scenic';
    },
    [],
  );

  const syncFavoriteKeys = useCallback(
    async (targets: { poiType: PoiType; poiId: string }[]) => {
      if (targets.length === 0) return;

      const uniqueTargets = Array.from(
        new Set(targets.map((t) => `${t.poiType}:${t.poiId}`)),
      ).map((key) => {
        const [poiType, poiId] = key.split(':');
        return { poiType: poiType as PoiType, poiId };
      });

      const checks = await Promise.all(
        uniqueTargets.map(async (target) => ({
          key: buildFavoriteKey(target.poiType, target.poiId),
          active: await isInFavorites(target.poiId, 'favorite', target.poiType),
        })),
      );

      setFavoriteKeys((prev) => {
        const next = new Set(prev);
        for (const target of uniqueTargets) {
          next.delete(buildFavoriteKey(target.poiType, target.poiId));
        }
        for (const check of checks) {
          if (check.active) next.add(check.key);
        }
        return next;
      });
    },
    [buildFavoriteKey],
  );

  const toggleFavorite = useCallback(
    async (
      poiId: string,
      poiName: string,
      poiType: PoiType,
      snapshot?: FavoritePoiSnapshot,
    ) => {
      const key = buildFavoriteKey(poiType, poiId);
      if (favoriteBusyKeys.has(key)) return;

      setFavoriteBusyKeys((prev) => new Set(prev).add(key));
      try {
        const isActive = favoriteKeys.has(key);
        const result = isActive
          ? await removeFavorite(poiId, 'favorite', poiType)
          : await addFavorite(poiId, poiName, poiType, 'favorite', snapshot);

        if (!result.success) {
          Alert.alert('操作失败', result.error ?? '请稍后重试');
          return;
        }

        setFavoriteKeys((prev) => {
          const next = new Set(prev);
          if (isActive) next.delete(key);
          else next.add(key);
          return next;
        });
      } finally {
        setFavoriteBusyKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [buildFavoriteKey, favoriteBusyKeys, favoriteKeys],
  );

  const refreshHeaderLocation = useCallback(async () => {
    try {
      const current = await getCurrentLocationWithPermission();
      if (!current.coords) {
        if (current.status === 'denied' || current.status === 'blocked') {
          setLocation('未开启定位');
          return;
        }
        setLocation('定位失败');
        return;
      }
      if (current.source === 'amap-ip') {
        setLocation('定位精度不足');
        return;
      }

      const address = await reverseGeocodeLocation(current.coords, {
        source: current.source,
        coordSystem: current.coordSystem,
      });
      if (!address) {
        setLocation('未知位置');
        return;
      }

      const normalizedCatalogLocation = normalizeCatalogLocation(address);
      if (normalizedCatalogLocation) {
        setHomeCatalogLocation(normalizedCatalogLocation);
      }

      const city =
        address.city?.trim() || address.province?.trim() || '当前位置';
      const district = address.district?.trim();
      setLocation(district ? `${city} · ${district}` : city);
    } catch {
      setLocation('定位失败');
    }
  }, [setHomeCatalogLocation]);

  const refreshFeaturedScenic = useCallback(async () => {
    setFeaturedScenicLoading(true);
    setFeaturedScenicError(null);
    try {
      const current = await getCurrentLocationWithPermission();
      if (!current.coords) {
        const message =
          current.status === 'denied' || current.status === 'blocked'
            ? '未开启定位，已展示默认推荐'
            : (current.error ?? '定位失败，已展示默认推荐');
        setFeaturedScenic([]);
        setFeaturedScenicError(message);
        return;
      }
      if (current.source === 'amap-ip') {
        setFeaturedScenic([]);
        setFeaturedScenicError(
          '当前仅获取到城市级粗定位，已展示默认推荐。请开启高精度定位后重试。',
        );
        return;
      }

      const address = await reverseGeocodeLocation(current.coords, {
        source: current.source,
        coordSystem: current.coordSystem,
      });
      const city = address?.city?.trim() || address?.province?.trim() || '';
      if (!city) {
        setFeaturedScenic([]);
        setFeaturedScenicError('无法识别当前城市，已展示默认推荐');
        return;
      }

      const scenic = await queryAmapNearbyScenic({
        center: current.coords,
        city,
        radiusM: 10000,
        limit: 5,
      });
      setFeaturedScenic(scenic);
      if (scenic.length === 0) {
        setFeaturedScenicError('附近暂无景点，已展示默认推荐');
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '获取精选景点失败';
      setFeaturedScenic([]);
      setFeaturedScenicError(`${message}，已展示默认推荐`);
    } finally {
      setFeaturedScenicLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshHeaderLocation();
  }, [refreshHeaderLocation]);

  useEffect(() => {
    void refreshFeaturedScenic();
  }, [refreshFeaturedScenic]);

  useEffect(() => {
    void refreshNearby();
  }, [refreshNearby]);

  useEffect(() => {
    void syncFavoriteKeys(
      displayedFeaturedSites.map((site) => ({
        poiType: resolveFeaturedPoiType(site),
        poiId: site.id,
      })),
    );
  }, [displayedFeaturedSites, resolveFeaturedPoiType, syncFavoriteKeys]);

  useEffect(() => {
    void syncFavoriteKeys(
      nearbyPois.map((poi) => ({
        poiType: poi.poi_type,
        poiId: poi.id,
      })),
    );
  }, [nearbyPois, syncFavoriteKeys]);

  const handleCategorySelect = (id: string) => {
    if (id === 'heritage') {
      router.push('/heritage-directory');
      return;
    }

    if (id === 'museum') {
      router.push('/museum-directory');
      return;
    }

    if (id === 'scenic') {
      router.push('/scenic-search');
    }
  };

  const handleNavigateNearbyPoi = useCallback(
    async (poi: (typeof nearbyPois)[number]) => {
      const destination: RoutePoint = {
        id: poi.id,
        name: poi.name,
        lng: poi.lng,
        lat: poi.lat,
      };
      const strategy = await navigateWithGaode(destination, 'walk');
      if (strategy === 'webview') {
        setFallbackDestination(destination);
        setFallbackVisible(true);
      }
    },
    [],
  );

  const handleNavigateFeaturedSite = useCallback(
    async (
      site: (typeof featuredScenic)[number] | (typeof FEATURED_SITES)[number],
    ) => {
      if (!('lng' in site) || !('lat' in site)) return;
      const destination: RoutePoint = {
        id: site.id,
        name: site.name,
        lng: site.lng,
        lat: site.lat,
      };
      const strategy = await navigateWithGaode(destination, 'walk');
      if (strategy === 'webview') {
        setFallbackDestination(destination);
        setFallbackVisible(true);
      }
    },
    [],
  );

  const handleAiGuideForFeaturedSite = useCallback(
    (site: FeaturedSiteUnion) => {
      if (!site?.id || !site?.name) return;
      const banner = bannerMetaForFeaturedSite(site);
      triggerInlineAiGuide({
        id: site.id,
        name: site.name,
        poiType: 'scenic',
        image: site.image || FEATURED_SITES[0].image,
        typeLabel: 'A 级景区',
        ...banner,
      });
    },
    [triggerInlineAiGuide],
  );

  const handleAiGuideForNearbyPoi = useCallback(
    (poi: (typeof nearbyPois)[number]) => {
      if (!poi?.id || !poi?.name) return;
      const banner = bannerMetaForNearbyPoi(poi);
      triggerInlineAiGuide({
        id: poi.id,
        name: poi.name,
        poiType: poi.poi_type,
        image: poi.images?.[0] || FEATURED_SITES[0].image,
        typeLabel:
          poi.poi_type === 'scenic'
            ? 'A 级景区'
            : poi.poi_type === 'heritage'
              ? '重点文保'
              : '博物馆',
        ...banner,
      });
    },
    [triggerInlineAiGuide],
  );

  const handleCheckInNearbyPoi = useCallback(
    async (poi: (typeof nearbyPois)[number], confirmLowAccuracy = false) => {
      if (!locationCoords) {
        Alert.alert('无法打卡', '当前未获取到定位，请稍后重试。');
        return;
      }

      setCheckInBusyPoiId(poi.id);
      try {
        const result = await checkInToPoi({
          poiId: poi.id,
          poiType: poi.poi_type,
          userLocation: locationCoords,
          accuracy: locationAccuracy,
          confirmLowAccuracy,
        });

        if (!result.success) {
          if (result.requiresConfirmation && result.code === 'LOW_ACCURACY') {
            Alert.alert('定位精度不足', result.message, [
              { text: '取消', style: 'cancel' },
              {
                text: '仍要打卡',
                style: 'destructive',
                onPress: () => {
                  void handleCheckInNearbyPoi(poi, true);
                },
              },
            ]);
            return;
          }
          Alert.alert('打卡失败', result.message);
          return;
        }

        const newStampText =
          result.unlockedStamps && result.unlockedStamps.length > 0
            ? `\n新印章：${result.unlockedStamps.map((s) => s.name).join('、')}`
            : '';
        const newAchievementText =
          result.unlockedAchievements && result.unlockedAchievements.length > 0
            ? `\n新成就：${result.unlockedAchievements.map((a) => a.title).join('、')}`
            : '';

        Alert.alert(
          '打卡成功',
          `${result.message}${newStampText}${newAchievementText}`,
        );
        setCheckedInPoiIds((prev) =>
          prev.includes(poi.id) ? prev : [...prev, poi.id],
        );
      } finally {
        setCheckInBusyPoiId(null);
      }
    },
    [locationAccuracy, locationCoords],
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <SafeAreaView style={styles.safeArea}>
        <BrandHeader
          rightElement={
            <TouchableOpacity
              style={styles.locationRow}
              activeOpacity={0.75}
              onPress={refreshHeaderLocation}
            >
              <MapPin size={14} color={Colors.accent} />
              <Text
                testID="home-location-label"
                accessibilityLabel={`当前位置：${location}`}
                style={styles.location}
              >
                {location}
              </Text>
            </TouchableOpacity>
          }
        />
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <HeroCarousel />

        <View style={styles.aiPromptSection}>
          <TouchableOpacity
            onPress={() => router.push('/ai-guide-detail')}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={[Colors.primary, Colors.primaryDark]}
              style={styles.aiCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <View style={styles.aiLeft}>
                <Sparkles size={18} color={Colors.goldLight} />
                <View>
                  <Text style={styles.aiTitle}>AI文化向导</Text>
                  <Text style={styles.aiSubtitle}>
                    告诉我你的偏好，智能规划专属路线
                  </Text>
                </View>
              </View>
              <View style={styles.aiMicBtn}>
                <Mic size={16} color={Colors.primary} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <CategoryFilter onSelect={handleCategorySelect} />
        </View>

        <View style={styles.section}>
          <SectionHeader
            title="精选景点地标"
            onSeeAll={() => {
              void refreshFeaturedScenic();
            }}
          />
          {featuredScenicLoading ? (
            <Text style={styles.nearbyStateText}>正在获取高德周边景点...</Text>
          ) : null}
          {featuredScenicError ? (
            <Text style={styles.nearbyStateText}>{featuredScenicError}</Text>
          ) : null}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          >
            {displayedFeaturedSites.map((site) => (
              <SiteCard
                key={site.id}
                name={site.name}
                province={site.province}
                city={site.city}
                dynasty={'district' in site ? site.city : site.dynasty}
                type={site.type}
                image={site.image || FEATURED_SITES[0].image}
                tags={site.tags}
                rating={site.rating}
                distance={site.distance}
                isStamped={'isStamped' in site ? site.isStamped : false}
                level={site.level}
                onAiGuide={() => {
                  handleAiGuideForFeaturedSite(site);
                }}
                onNavigate={
                  'lng' in site && 'lat' in site
                    ? () => {
                        void handleNavigateFeaturedSite(site);
                      }
                    : undefined
                }
                isFavorite={favoriteKeys.has(
                  buildFavoriteKey(resolveFeaturedPoiType(site), site.id),
                )}
                onFavorite={() => {
                  void toggleFavorite(
                    site.id,
                    site.name,
                    resolveFeaturedPoiType(site),
                    {
                      poi_name: site.name,
                      province: site.province ?? null,
                      city: site.city ?? null,
                      district:
                        'district' in site ? (site.district ?? null) : null,
                      level_tag: site.level ?? null,
                      image_url: site.image ?? null,
                    },
                  );
                }}
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <SectionHeader
            title="周边文旅点位"
            onSeeAll={() => {
              void refreshNearby();
            }}
          />
          {nearbyLoading ? (
            <Text style={styles.nearbyStateText}>正在获取附近点位...</Text>
          ) : nearbyError ? (
            <Text style={styles.nearbyStateText}>{nearbyError}</Text>
          ) : nearbyPois.length === 0 ? (
            <Text style={styles.nearbyStateText}>
              附近暂无符合条件的文化地标
            </Text>
          ) : (
            nearbyPois.slice(0, 5).map((poi) => (
              <NearbyCard
                key={poi.id}
                name={poi.name}
                type={
                  poi.poi_type === 'scenic'
                    ? 'A 级景区'
                    : poi.poi_type === 'heritage'
                      ? '重点文保'
                      : '博物馆'
                }
                dynasty={poi.label ?? '文化地标'}
                distance={poi.distance_display ?? '距离未知'}
                isOpen
                image={poi.images?.[0] || FEATURED_SITES[0].image}
                isFree={poi.poi_type === 'museum'}
                onAiGuide={() => {
                  handleAiGuideForNearbyPoi(poi);
                }}
                onNavigate={() => {
                  void handleNavigateNearbyPoi(poi);
                }}
                onCheckIn={() => {
                  void handleCheckInNearbyPoi(poi);
                }}
                checkInBusy={checkInBusyPoiId === poi.id}
                isCheckedIn={checkedInPoiIds.includes(poi.id)}
                isFavorite={favoriteKeys.has(
                  buildFavoriteKey(poi.poi_type, poi.id),
                )}
                onFavorite={() => {
                  void toggleFavorite(poi.id, poi.name, poi.poi_type, {
                    poi_name: poi.name,
                    province: poi.province ?? null,
                    city: null,
                    district: null,
                    level_tag: poi.label ?? null,
                    image_url: poi.images?.[0] ?? null,
                  });
                }}
              />
            ))
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.insightCard}>
            <LinearGradient
              colors={[Colors.accentDark, Colors.accent]}
              style={styles.insightGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.insightLabel}>今日文化小知识</Text>
              <Text style={styles.insightTitle}>
                为什么唐代佛教艺术最为繁盛？
              </Text>
              <Text style={styles.insightBody}>
                唐朝是中国历史上最开放的朝代之一，玄奘西行取经、皇家崇佛与丝路交流共同推动了佛教文化的黄金时代。
              </Text>
              <TouchableOpacity
                style={styles.insightBtn}
                onPress={() => router.push('/ai-qa-chat')}
              >
                <Sparkles size={14} color={Colors.accent} />
                <Text style={styles.insightBtnText}>AI深度解析</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {inlineAiGuideModal}

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
              origin={
                locationCoords
                  ? {
                      id: 'current-location',
                      name: '我的位置',
                      lng: locationCoords.lng,
                      lat: locationCoords.lat,
                    }
                  : fallbackDestination
              }
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
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    backgroundColor: Colors.background,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(200, 145, 74, 0.1)',
  },
  location: {
    fontSize: 13,
    color: Colors.accent,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  section: {
    marginBottom: 24,
  },
  horizontalList: {
    paddingHorizontal: 20,
    gap: 12,
  },
  aiPromptSection: {
    paddingHorizontal: 20,
    marginVertical: 16,
  },
  aiCard: {
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aiLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  aiTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 2,
  },
  aiSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
  },
  aiMicBtn: {
    width: 38,
    height: 38,
    backgroundColor: Colors.white,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightCard: {
    marginHorizontal: 20,
  },
  insightGradient: {
    borderRadius: 16,
    padding: 20,
    gap: 8,
  },
  insightLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  insightTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.3,
    lineHeight: 26,
  },
  insightBody: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 20,
  },
  insightBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.white,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 4,
  },
  insightBtnText: {
    fontSize: 13,
    color: Colors.accent,
    fontWeight: '700',
  },
  nearbyStateText: {
    marginHorizontal: 20,
    marginBottom: 10,
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  fallbackWrap: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  fallbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  fallbackTitle: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '700',
  },
  fallbackCloseText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '700',
  },
});
