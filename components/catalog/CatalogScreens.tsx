import React, { useCallback, useState, useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import {
  MUSEUM_CARDS,
  SCENIC_FEATURED,
  type MuseumCardItem,
  type ScenicFeature,
} from '@/constants/CatalogData';
import {
  ALL_DISTRICTS,
  formatHeritageResultHint,
  filterMuseumCards,
  filterScenicFeatures,
  formatMuseumResultHint,
  formatScenicResultHint,
  type HeritageQueryFormState,
  sortScenicFeaturesByLevel,
  type MuseumQueryFormState,
  type ScenicLocationFormState,
} from '@/lib/catalog/catalogQueryFilters';
import {
  queryHeritageFilterOptions,
  queryHeritageSites,
  queryMuseums,
  queryScenicSpots,
} from '@/lib/catalog/supabaseCatalogQueries';
import { navigateWithGaode, type RoutePoint } from '@/lib/route/routeService';
import { RouteWebViewFallback } from '@/components/route/RouteWebViewFallback';
import { getCurrentLocationWithPermission } from '@/lib/location/locationService';
import {
  GeoLocationFilter,
  HeritageFilterPanel,
  MuseumFilterPanel,
} from '@/components/catalog/GeoLocationFilter';
import { SmartImage, SmartImageBackground } from '@/components/ui/SmartImage';
import {
  useCatalogLocation,
  type CatalogLocation,
} from '@/contexts/CatalogLocationContext';
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  Navigation,
  Star,
} from 'lucide-react-native';

function TopBar({ title }: { title: string }) {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <TouchableOpacity
            style={styles.iconButton}
            activeOpacity={0.85}
            onPress={() => router.push('/discover')}
          >
            <ArrowLeft size={20} color={stylesVars.heritagePrimary} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>{title}</Text>
        </View>
        <Image
          source={{
            uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCxoru8uT5Fd4vDmpOug6incjwOlE_9tYSZdDxOA6-NnbmpYi8AuhTQaPH_mAAwwjKpHi7xe_L3GYDRdO9Ys24WrdgHYQTIWRawbI3m21r_AVve34_-PNkkH1MP7dYtg4O74OdQKWyW9ce3n1joe-8Eggy2_cRzeoWgSvo6o298d1xEHtWj5r5wMdfr5btK1Cd94ZfqMTtoZHtg0TGIom-5f10vvEhJUVkyq5usSiaPHwbuKRpVr3Jq5cN6r6GMcihs3wY1ihQ6-80',
          }}
          style={styles.avatar}
        />
      </View>
    </SafeAreaView>
  );
}

interface ScenicSearchContentProps {
  keyword?: string;
  loadMoreSignal?: number;
  externalFilters?: ScenicLocationFormState;
  onApplyQuery?: (filters: ScenicLocationFormState) => void;
}

interface HeritageDirectoryContentProps {
  loadMoreSignal?: number;
  externalFilters?: HeritageQueryFormState;
  onApplyQuery?: (filters: HeritageQueryFormState) => void;
}

interface MuseumDirectoryContentProps {
  loadMoreSignal?: number;
  externalFilters?: MuseumQueryFormState;
  onApplyQuery?: (filters: MuseumQueryFormState) => void;
}

const PAGE_SIZE = 5;
const PLACEHOLDER = '\u8bf7\u9009\u62e9';
const ALL_LEVEL = '\u5168\u90e8\u7b49\u7ea7';
const ALL = '\u5168\u90e8';

function hasValidImage(image?: string) {
  return Boolean(image && image.trim());
}

function buildScenicDefaultFilters(homeCatalogLocation: CatalogLocation | null): ScenicLocationFormState {
  return {
    province: homeCatalogLocation?.province ?? PLACEHOLDER,
    city: homeCatalogLocation?.city ?? PLACEHOLDER,
    district: ALL_DISTRICTS,
    level: ALL_LEVEL,
    useAutoLocation: Boolean(homeCatalogLocation),
  };
}

function buildScenicFilterLocation(homeCatalogLocation: CatalogLocation | null) {
  return {
    province: homeCatalogLocation?.province ?? PLACEHOLDER,
    city: homeCatalogLocation?.city ?? PLACEHOLDER,
    district: ALL_DISTRICTS,
    level: ALL_LEVEL,
  };
}

function buildCommonDirectoryDefaultFilters(homeCatalogLocation: CatalogLocation | null) {
  return {
    province: homeCatalogLocation?.province ?? PLACEHOLDER,
    city: homeCatalogLocation?.city ?? PLACEHOLDER,
    district: PLACEHOLDER,
    useAutoLocation: Boolean(homeCatalogLocation),
  };
}

function buildCommonFilterLocation(homeCatalogLocation: CatalogLocation | null) {
  return {
    province: homeCatalogLocation?.province ?? PLACEHOLDER,
    city: homeCatalogLocation?.city ?? PLACEHOLDER,
    district: PLACEHOLDER,
    level: ALL_LEVEL,
  };
}

function buildMuseumFilterLocation(homeCatalogLocation: CatalogLocation | null) {
  return {
    province: homeCatalogLocation?.province ?? PLACEHOLDER,
    city: homeCatalogLocation?.city ?? PLACEHOLDER,
    district: PLACEHOLDER,
    level: ALL,
  };
}

function buildDestinationPoint(item: {
  id: string;
  title: string;
  lng?: number;
  lat?: number;
}): RoutePoint | null {
  if (typeof item.lng !== 'number' || typeof item.lat !== 'number') {
    return null;
  }
  return {
    id: item.id,
    name: item.title,
    lng: item.lng,
    lat: item.lat,
  };
}

function useCatalogNavigationFallback() {
  const [fallbackVisible, setFallbackVisible] = useState(false);
  const [fallbackDestination, setFallbackDestination] = useState<RoutePoint | null>(null);
  const [fallbackOrigin, setFallbackOrigin] = useState<RoutePoint | null>(null);

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
        // 定位失败时兜底为目的地附近点，确保可展示降级导航页
        id: `${destination.id}-origin`,
        name: '附近位置',
        lng: destination.lng - 0.0005,
        lat: destination.lat - 0.0005,
      };
    setFallbackDestination(destination);
    setFallbackOrigin(origin);
    setFallbackVisible(true);
  }, []);

  const fallbackModal = (
    <Modal
      visible={fallbackVisible}
      animationType="slide"
      transparent={false}
      onRequestClose={() => setFallbackVisible(false)}
    >
      <SafeAreaView style={styles.scenicFallbackWrap}>
        <View style={styles.scenicFallbackHeader}>
          <Text style={styles.scenicFallbackTitle}>应用内导航降级</Text>
          <TouchableOpacity onPress={() => setFallbackVisible(false)}>
            <Text style={styles.scenicFallbackCloseText}>关闭</Text>
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
  );

  return { openFallbackForDestination, fallbackModal };
}

export function ScenicSearchContent({
  keyword = '',
  loadMoreSignal: _loadMoreSignal = 0,
  externalFilters,
  onApplyQuery: externalOnApplyQuery,
}: ScenicSearchContentProps) {
  const { homeCatalogLocation } = useCatalogLocation();
  const scenicFilterLocation = useMemo(
    () => buildScenicFilterLocation(homeCatalogLocation),
    [homeCatalogLocation],
  );
  const initialScenicFilters = useMemo(
    () => buildScenicDefaultFilters(homeCatalogLocation),
    [homeCatalogLocation],
  );
  const [scenicResults, setScenicResults] = useState<ScenicFeature[]>([]);
  const [scenicPage, setScenicPage] = useState(1);
  const [hasMoreScenic, setHasMoreScenic] = useState(true);
  const [activeScenicFilters, setActiveScenicFilters] = useState<ScenicLocationFormState>(
    initialScenicFilters,
  );
  const [resultHint, setResultHint] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { openFallbackForDestination, fallbackModal } = useCatalogNavigationFallback();
  const normalizeScenicFilters = useCallback((f: ScenicLocationFormState): ScenicLocationFormState => ({
    ...f,
    district: ALL_DISTRICTS,
  }), []);

  const loadScenicData = useCallback(async (
    rawFilters: ScenicLocationFormState,
    page: number,
    append: boolean,
  ) => {
    const f = normalizeScenicFilters(rawFilters);
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await queryScenicSpots({
        province: f.province !== '\u8bf7\u9009\u62e9' ? f.province : undefined,
        city: f.city !== '\u8bf7\u9009\u62e9' ? f.city : undefined,
        level: f.level !== '\u5168\u90e8\u7b49\u7ea7' ? f.level : undefined,
        keyword: keyword.trim() || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setHasMoreScenic(data.length === PAGE_SIZE);
      setScenicResults((prev) => {
        const next = append ? [...prev, ...data] : data;
        setResultHint(formatScenicResultHint(f, next.length));
        return next;
      });
    } catch (e) {
      console.warn('scenic query failed, fallback to mock data', e);
      const filtered = filterScenicFeatures([...SCENIC_FEATURED], {
        ...f,
        level: f.level === '\u5168\u90e8\u7b49\u7ea7' ? '' : f.level,
      });
      const next = sortScenicFeaturesByLevel(filtered);
      const startIndex = (page - 1) * PAGE_SIZE;
      const paged = next.slice(startIndex, startIndex + PAGE_SIZE);
      setHasMoreScenic(startIndex + PAGE_SIZE < next.length);
      setScenicResults((prev) => {
        const merged = append ? [...prev, ...paged] : paged;
        setResultHint(formatScenicResultHint(f, merged.length));
        return merged;
      });
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  }, [keyword, normalizeScenicFilters]);

  const onApplyScenicQuery = useCallback((f: ScenicLocationFormState) => {
    const normalized = normalizeScenicFilters(f);
    if (externalOnApplyQuery) {
      externalOnApplyQuery(normalized);
    } else {
      setActiveScenicFilters(normalized);
    }
    setScenicPage(1);
    setHasMoreScenic(true);
  }, [normalizeScenicFilters, externalOnApplyQuery]);

  useEffect(() => {
    if (externalFilters) {
      setActiveScenicFilters(externalFilters);
    }
  }, [externalFilters]);

  useEffect(() => {
    setActiveScenicFilters(initialScenicFilters);
    setScenicPage(1);
    setHasMoreScenic(true);
  }, [initialScenicFilters]);

  useEffect(() => {
    setScenicPage(1);
    setHasMoreScenic(true);
    loadScenicData(activeScenicFilters, 1, false);
  }, [activeScenicFilters, keyword, loadScenicData]);

  useEffect(() => {
    if (_loadMoreSignal <= 0) return;
    if (loading || loadingMore || !hasMoreScenic) return;
    const nextPage = scenicPage + 1;
    setScenicPage(nextPage);
    loadScenicData(activeScenicFilters, nextPage, true);
  }, [
    _loadMoreSignal,
    activeScenicFilters,
    hasMoreScenic,
    loadScenicData,
    loading,
    loadingMore,
    scenicPage,
  ]);

  const hero = scenicResults[0];
  const scenicCards = scenicResults.slice(1);
  const handleScenicNavigate = useCallback(async (item: ScenicFeature) => {
    const destination = buildDestinationPoint(item);
    if (!destination) {
      Alert.alert('暂不支持导航', '该景区缺少坐标信息');
      return;
    }

    const navResult = await navigateWithGaode(destination, 'walk');

    if (navResult === 'webview') {
      await openFallbackForDestination(destination);
    }
  }, [openFallbackForDestination]);

  return (
    <>
      {!externalFilters && (
        <View style={styles.sectionPad}>
          <GeoLocationFilter
            key={`scenic-filter-${scenicFilterLocation.province}-${scenicFilterLocation.city}-${scenicFilterLocation.district}`}
            primaryColor={stylesVars.scenicPrimary}
            defaultLocation={scenicFilterLocation}
            showDistrictFilter={false}
            onApplyQuery={onApplyScenicQuery}
          />
        </View>
      )}

      <View style={styles.sectionPad}>
        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>{'\u9644\u8fd1\u6587\u5316\u5730\u6807'}</Text>
            <Text style={styles.sectionSubtitle}>
              {'\u6309\u7701\u5e02\u4e0e\u7b49\u7ea7\u7b5b\u9009 A \u7ea7\u666f\u533a'}
            </Text>
          </View>
          <TouchableOpacity style={styles.linkBtn} activeOpacity={0.85}>
            <Text style={styles.linkBtnText}>{'\u67e5\u770b\u5168\u90e8'}</Text>
            <ArrowRight size={14} color={stylesVars.scenicPrimary} />
          </TouchableOpacity>
        </View>

        {resultHint ? (
          <Text style={styles.filterResultHint}>{resultHint}</Text>
        ) : null}

        {loading && scenicResults.length === 0 ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={stylesVars.scenicPrimary} />
            <Text style={styles.loadingText}>{'\u6b63\u5728\u52a0\u8f7d A \u7ea7\u666f\u533a...'}</Text>
          </View>
        ) : error ? (
          <View style={styles.catalogEmptyBox}>
            <Text style={styles.catalogEmptyTitle}>{'\u52a0\u8f7d\u5931\u8d25'}</Text>
            <Text style={styles.catalogEmptyHint}>{error}</Text>
          </View>
        ) : hero && hasValidImage(hero.image) ? (
          <SmartImageBackground
            source={{ uri: hero.image }}
            imageStyle={styles.heroImage}
            style={styles.heroCard}
            fallbackText={'\u666f\u533a\u56fe\u7247\u4e0d\u53ef\u7528'}
            fallbackSource={SCENIC_FALLBACK_IMAGE}
          >
            <LinearGradient
              colors={['rgba(14,71,83,0.1)', 'rgba(14,71,83,0.88)']}
              style={styles.heroOverlay}
            >
              <View style={styles.heroBadgeRow}>
                {hero.tags.map((tag) => (
                  <Text key={tag} style={styles.heroBadge}>
                    {tag}
                  </Text>
                ))}
                {hero.distance ? (
                  <Text style={styles.heroDistance}>{hero.distance}</Text>
                ) : null}
              </View>
              <View style={styles.heroMeta}>
                <Text style={styles.heroTitle}>{hero.title}</Text>
                <Text style={styles.heroSubtitle}>{hero.subtitle}</Text>
              </View>
            </LinearGradient>
          </SmartImageBackground>
        ) : hero ? (
          <View style={styles.textOnlyResultItem}>
            <Text style={styles.textOnlyResultTitle}>{hero.title}</Text>
            <Text style={styles.cardSubtitle}>{hero.subtitle}</Text>
            {hero.tags.length > 0 ? (
              <View style={styles.textOnlyTagsRow}>
                {hero.tags.map((tag) => (
                  <Text key={tag} style={styles.textOnlyTag}>
                    {tag}
                  </Text>
                ))}
              </View>
            ) : null}
            {hero.distance ? (
              <Text style={styles.museumDistance}>{hero.distance}</Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.catalogEmptyBox}>
            <Text style={styles.catalogEmptyTitle}>{'\u6682\u65e0\u7b26\u5408\u7b5b\u9009\u7684\u7ed3\u679c'}</Text>
            {resultHint ? (
              <Text style={styles.catalogEmptyHint}>{resultHint}</Text>
            ) : null}
          </View>
        )}

        {!loading && !error && scenicCards.length > 0 && (
          <View style={styles.cardGrid}>
            {scenicCards.map((item) => (
              hasValidImage(item.image) ? (
                <View key={item.id} style={styles.scenicCard}>
                  <SmartImage
                    source={{ uri: item.image }}
                    style={styles.scenicCardImage}
                    fallbackSource={SCENIC_FALLBACK_IMAGE}
                  />
                  <TouchableOpacity
                    style={styles.scenicNavIcon}
                    activeOpacity={0.85}
                    onPress={() => {
                      void handleScenicNavigate(item);
                    }}
                  >
                    <Navigation size={13} color={Colors.primary} />
                  </TouchableOpacity>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <View style={styles.tagRow}>
                      {item.tags.map((tag) => (
                        <Text key={tag} style={styles.cardTag}>
                          {tag}
                        </Text>
                      ))}
                    </View>
                    <View style={styles.cardFooter}>
                      <View style={styles.ratingRow}>
                        <Star size={13} color={Colors.accent} fill={Colors.accent} />
                        <Text style={styles.ratingText}>{item.rating ?? '-'}</Text>
                      </View>
                      <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View key={item.id} style={styles.textOnlyResultItem}>
                  <Text style={styles.textOnlyResultTitle}>{item.title}</Text>
                  <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
                  {item.tags.length > 0 ? (
                    <View style={styles.textOnlyTagsRow}>
                      {item.tags.map((tag) => (
                        <Text key={tag} style={styles.textOnlyTag}>
                          {tag}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                  {item.distance ? (
                    <Text style={styles.museumDistance}>{item.distance}</Text>
                  ) : null}
                </View>
              )
            ))}
          </View>
        )}

        {!loading && !error && hasMoreScenic ? (
          <Text style={styles.loadMoreHint}>{'\u7ee7\u7eed\u4e0b\u62c9\u52a0\u8f7d\u4e0b\u4e00\u9875\uff08\u6bcf\u9875 5 \u6761\uff09'}</Text>
        ) : null}
        {loadingMore ? (
          <Text style={styles.loadMoreHint}>{'\u6b63\u5728\u52a0\u8f7d\u66f4\u591a\u5185\u5bb9...'}</Text>
        ) : null}

      </View>
      {fallbackModal}
    </>
  );
}

export function ScenicSearchScreen() {
  return (
    <View style={styles.screen}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={stylesVars.heritageBg}
      />
      <TopBar title="A级景点搜索" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ScenicSearchContent />
      </ScrollView>
    </View>
  );
}

export function HeritageDirectoryContent({
  loadMoreSignal = 0,
  externalFilters,
  onApplyQuery: externalOnApplyQuery,
}: HeritageDirectoryContentProps = {}) {
  const { homeCatalogLocation } = useCatalogLocation();
  const heritageFilterLocation = useMemo(
    () => buildCommonFilterLocation(homeCatalogLocation),
    [homeCatalogLocation],
  );
  const initialHeritageFilters = useMemo<HeritageQueryFormState>(() => {
    const defaultLocation = buildCommonDirectoryDefaultFilters(homeCatalogLocation);
    return {
      ...defaultLocation,
      era: ALL,
      category: ALL,
      batch: ALL,
    };
  }, [homeCatalogLocation]);
  const [heritageResults, setHeritageResults] = useState<MuseumCardItem[]>(() => [
    ...MUSEUM_CARDS,
  ]);
  const [heritagePage, setHeritagePage] = useState(1);
  const [hasMoreHeritage, setHasMoreHeritage] = useState(true);
  const [activeHeritageFilters, setActiveHeritageFilters] =
    useState<HeritageQueryFormState>(initialHeritageFilters);
  const [heritageHint, setHeritageHint] = useState('');
  const [filterOptions, setFilterOptions] = useState<{
    eras: string[];
    categories: string[];
    batches: string[];
  }>({
    eras: [],
    categories: [],
    batches: [],
  });
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { openFallbackForDestination, fallbackModal } = useCatalogNavigationFallback();

  const loadHeritageData = useCallback(async (
    f: HeritageQueryFormState,
    page: number,
    append: boolean,
  ) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await queryHeritageSites({
        province: f.province !== '\u8bf7\u9009\u62e9' ? f.province : undefined,
        city: f.city !== '\u8bf7\u9009\u62e9' ? f.city : undefined,
        district: f.district !== '\u8bf7\u9009\u62e9' ? f.district : undefined,
        era: f.era !== '\u5168\u90e8' ? f.era : undefined,
        category: f.category !== '\u5168\u90e8' ? f.category : undefined,
        batch: f.batch !== '\u5168\u90e8' ? f.batch : undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setHasMoreHeritage(data.length === PAGE_SIZE);
      setHeritageResults((prev) => {
        const next = append ? [...prev, ...data] : data;
        setHeritageHint(formatHeritageResultHint(f, next.length));
        return next;
      });
    } catch (e) {
      console.warn('heritage query failed', e);
      setHasMoreHeritage(false);
      setHeritageResults((prev) => {
        const next = append ? prev : [];
        setHeritageHint(formatHeritageResultHint(f, next.length));
        return next;
      });
      setError('\u91cd\u70b9\u6587\u4fdd\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5');
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  const loadHeritageFilterOptions = useCallback(async () => {
    try {
      const options = await queryHeritageFilterOptions();
      setFilterOptions(options);
    } catch (e) {
      console.warn('heritage filter options failed', e);
      setFilterOptions({
        eras: [],
        categories: [],
        batches: [],
      });
    }
  }, []);

  const onApplyHeritageQuery = useCallback(
    (f: HeritageQueryFormState) => {
      if (externalOnApplyQuery) {
        externalOnApplyQuery(f);
      } else {
        setActiveHeritageFilters(f);
      }
      setHeritagePage(1);
      setHasMoreHeritage(true);
      loadHeritageData(f, 1, false);
    },
    [loadHeritageData, externalOnApplyQuery],
  );

  useEffect(() => {
    if (externalFilters) {
      setActiveHeritageFilters(externalFilters);
    }
  }, [externalFilters]);

  useEffect(() => {
    loadHeritageFilterOptions();
  }, [loadHeritageFilterOptions]);

  useEffect(() => {
    setActiveHeritageFilters(initialHeritageFilters);
    setHeritagePage(1);
    setHasMoreHeritage(true);
  }, [initialHeritageFilters]);

  useEffect(() => {
    setHeritagePage(1);
    setHasMoreHeritage(true);
    loadHeritageData(activeHeritageFilters, 1, false);
  }, [activeHeritageFilters, loadHeritageData]);

  useEffect(() => {
    if (loadMoreSignal <= 0) return;
    if (loading || loadingMore || !hasMoreHeritage) return;
    const nextPage = heritagePage + 1;
    setHeritagePage(nextPage);
    loadHeritageData(activeHeritageFilters, nextPage, true);
  }, [
    activeHeritageFilters,
    hasMoreHeritage,
    heritagePage,
    loadHeritageData,
    loadMoreSignal,
    loading,
    loadingMore,
  ]);

  const handleHeritageNavigate = useCallback(async (item: MuseumCardItem) => {
    const destination = buildDestinationPoint(item);
    if (!destination) {
      Alert.alert('暂不支持导航', '该文保点位缺少坐标信息');
      return;
    }
    const navResult = await navigateWithGaode(destination, 'walk');
    if (navResult === 'webview') {
      await openFallbackForDestination(destination);
    }
  }, [openFallbackForDestination]);

  return (
    <View style={styles.sectionPad}>
      {!externalFilters && (
        <HeritageFilterPanel
          key={`heritage-filter-${heritageFilterLocation.province}-${heritageFilterLocation.city}-${heritageFilterLocation.district}`}
          primaryColor={stylesVars.heritagePrimary}
          defaultLocation={heritageFilterLocation}
          filterOptions={filterOptions}
          onApplyQuery={onApplyHeritageQuery}
        />
      )}

      {heritageHint ? (
        <Text style={styles.filterResultHint}>{heritageHint}</Text>
      ) : null}

      {loading && heritageResults.length === 0 ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={stylesVars.heritagePrimary} />
          <Text style={styles.loadingText}>
            {'\u6b63\u5728\u52a0\u8f7d\u91cd\u70b9\u6587\u4fdd...'}
          </Text>
        </View>
      ) : error ? (
        <View style={styles.catalogEmptyBox}>
          <Text style={styles.catalogEmptyTitle}>
            {'\u52a0\u8f7d\u5931\u8d25'}
          </Text>
          <Text style={styles.catalogEmptyHint}>{error}</Text>
        </View>
      ) : heritageResults.length === 0 ? (
        <View style={styles.catalogEmptyBox}>
          <Text style={styles.catalogEmptyTitle}>
            {'\u6682\u65e0\u7b26\u5408\u7b5b\u9009\u7684\u91cd\u70b9\u6587\u4fdd'}
          </Text>
          {heritageHint ? (
            <Text style={styles.catalogEmptyHint}>{heritageHint}</Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.museumList}>
        {heritageResults.map((item) => (
          hasValidImage(item.image) ? (
            <TouchableOpacity
              key={item.id}
              style={styles.museumCard}
              activeOpacity={0.92}
            >
              <Image source={{ uri: item.image }} style={styles.museumImage} />
              <View style={styles.museumTagRow}>
                {item.tags.map((tag, index) => (
                  <Text
                    key={tag}
                    style={[
                      styles.museumImageTag,
                      index === 1 && styles.museumImageTagLight,
                    ]}
                  >
                    {tag}
                  </Text>
                ))}
              </View>
              <TouchableOpacity
                style={styles.scenicNavIcon}
                activeOpacity={0.85}
                onPress={() => {
                  void handleHeritageNavigate(item);
                }}
              >
                <Navigation size={13} color={Colors.primary} />
              </TouchableOpacity>
              <View style={styles.museumCardBody}>
                <View>
                  <Text style={styles.museumTitle}>{item.title}</Text>
                  <View style={styles.locationRow}>
                    <MapPin size={12} color={Colors.textMuted} />
                    <Text style={styles.locationText}>{item.location}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ) : (
            <View key={item.id} style={styles.textOnlyResultItem}>
              <View style={styles.textOnlyHeader}>
                <Text style={styles.textOnlyResultTitle}>{item.title}</Text>
                <TouchableOpacity
                  style={styles.listNavBtn}
                  activeOpacity={0.85}
                  onPress={() => {
                    void handleHeritageNavigate(item);
                  }}
                >
                  <Navigation size={13} color={Colors.primary} />
                </TouchableOpacity>
              </View>
              <View style={styles.locationRow}>
                <MapPin size={12} color={Colors.textMuted} />
                <Text style={styles.locationText}>{item.location}</Text>
              </View>
              {item.tags.length > 0 ? (
                <View style={styles.textOnlyTagsRow}>
                  {item.tags.map((tag) => (
                    <Text key={tag} style={styles.textOnlyTag}>
                      {tag}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          )
        ))}
      </View>

      {hasMoreHeritage ? (
        <Text style={styles.loadMoreHint}>继续下拉加载下一页（每页 5 条）</Text>
      ) : null}
      {loadingMore ? (
        <Text style={styles.loadMoreHint}>正在加载更多内容...</Text>
      ) : null}
      {fallbackModal}
    </View>
  );
}

export function HeritageDirectoryScreen() {
  return (
    <View style={styles.screen}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={stylesVars.heritageBg}
      />
      <TopBar title="重点文保名录" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <HeritageDirectoryContent />
      </ScrollView>
    </View>
  );
}

export function MuseumDirectoryContent({
  loadMoreSignal = 0,
  externalFilters,
  onApplyQuery: externalOnApplyQuery,
}: MuseumDirectoryContentProps = {}) {
  const { homeCatalogLocation } = useCatalogLocation();
  const museumFilterLocation = useMemo(
    () => buildMuseumFilterLocation(homeCatalogLocation),
    [homeCatalogLocation],
  );
  const initialMuseumFilters = useMemo<MuseumQueryFormState>(() => {
    const defaultLocation = buildCommonDirectoryDefaultFilters(homeCatalogLocation);
    return {
      ...defaultLocation,
      level: ALL,
    };
  }, [homeCatalogLocation]);
  const [museumResults, setMuseumResults] = useState<MuseumCardItem[]>(() => [
    ...MUSEUM_CARDS,
  ]);
  const [museumPage, setMuseumPage] = useState(1);
  const [hasMoreMuseum, setHasMoreMuseum] = useState(true);
  const [activeMuseumFilters, setActiveMuseumFilters] =
    useState<MuseumQueryFormState>(initialMuseumFilters);
  const [museumHint, setMuseumHint] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { openFallbackForDestination, fallbackModal } = useCatalogNavigationFallback();

  const loadMuseumData = useCallback(async (
    f: MuseumQueryFormState,
    page: number,
    append: boolean,
  ) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await queryMuseums({
        province: f.province !== '\u8bf7\u9009\u62e9' ? f.province : undefined,
        city: f.city !== '\u8bf7\u9009\u62e9' ? f.city : undefined,
        district: f.district !== '\u8bf7\u9009\u62e9' ? f.district : undefined,
        level: f.level !== '\u5168\u90e8' ? f.level : undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setHasMoreMuseum(data.length === PAGE_SIZE);
      setMuseumResults((prev) => {
        const next = append ? [...prev, ...data] : data;
        setMuseumHint(formatMuseumResultHint(f, next.length));
        return next;
      });
    } catch (e) {
      console.warn('museum query failed, fallback to mock data', e);
      if (!append) {
        let next = filterMuseumCards([...MUSEUM_CARDS], f);
        const paged = next.slice(0, PAGE_SIZE);
        setMuseumResults(paged);
        setMuseumHint(formatMuseumResultHint(f, paged.length));
        setHasMoreMuseum(next.length > PAGE_SIZE);
      } else {
        setHasMoreMuseum(false);
      }
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  const onApplyMuseumQuery = useCallback(
    (f: MuseumQueryFormState) => {
      if (externalOnApplyQuery) {
        externalOnApplyQuery(f);
      } else {
        setActiveMuseumFilters(f);
      }
      setMuseumPage(1);
      setHasMoreMuseum(true);
      loadMuseumData(f, 1, false);
    },
    [loadMuseumData, externalOnApplyQuery],
  );

  useEffect(() => {
    if (externalFilters) {
      setActiveMuseumFilters(externalFilters);
    }
  }, [externalFilters]);

  useEffect(() => {
    setActiveMuseumFilters(initialMuseumFilters);
    setMuseumPage(1);
    setHasMoreMuseum(true);
  }, [initialMuseumFilters]);

  useEffect(() => {
    setMuseumPage(1);
    setHasMoreMuseum(true);
    loadMuseumData(activeMuseumFilters, 1, false);
  }, [activeMuseumFilters, loadMuseumData]);

  useEffect(() => {
    if (loadMoreSignal <= 0) return;
    if (loading || loadingMore || !hasMoreMuseum) return;
    const nextPage = museumPage + 1;
    setMuseumPage(nextPage);
    loadMuseumData(activeMuseumFilters, nextPage, true);
  }, [
    activeMuseumFilters,
    hasMoreMuseum,
    loadMoreSignal,
    loading,
    loadingMore,
    loadMuseumData,
    museumPage,
  ]);

  const handleMuseumNavigate = useCallback(async (item: MuseumCardItem) => {
    const destination = buildDestinationPoint(item);
    if (!destination) {
      Alert.alert('暂不支持导航', '该博物馆缺少坐标信息');
      return;
    }
    const navResult = await navigateWithGaode(destination, 'walk');
    if (navResult === 'webview') {
      await openFallbackForDestination(destination);
    }
  }, [openFallbackForDestination]);

  return (
    <View style={styles.sectionPad}>
      {!externalFilters && (
        <MuseumFilterPanel
          key={`museum-filter-${museumFilterLocation.province}-${museumFilterLocation.city}-${museumFilterLocation.district}`}
          primaryColor={stylesVars.heritagePrimary}
          defaultLocation={museumFilterLocation}
          onApplyQuery={onApplyMuseumQuery}
        />
      )}

      {museumHint ? (
        <Text style={styles.filterResultHint}>{museumHint}</Text>
      ) : null}

      {loading && museumResults.length === 0 ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={stylesVars.heritagePrimary} />
          <Text style={styles.loadingText}>正在加载博物馆...</Text>
        </View>
      ) : error ? (
        <View style={styles.catalogEmptyBox}>
          <Text style={styles.catalogEmptyTitle}>加载失败</Text>
          <Text style={styles.catalogEmptyHint}>{error}</Text>
        </View>
      ) : museumResults.length === 0 ? (
        <View style={styles.catalogEmptyBox}>
          <Text style={styles.catalogEmptyTitle}>暂无符合筛选的博物馆</Text>
          {museumHint ? (
            <Text style={styles.catalogEmptyHint}>{museumHint}</Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.museumList}>
        {museumResults.map((item) => (
          hasValidImage(item.image) ? (
            <TouchableOpacity
              key={item.id}
              style={styles.museumCard}
              activeOpacity={0.92}
            >
              <Image source={{ uri: item.image }} style={styles.museumImage} />
              <View style={styles.museumTagRow}>
                {item.tags.map((tag, index) => (
                  <Text
                    key={tag}
                    style={[
                      styles.museumImageTag,
                      index === 1 && styles.museumImageTagLight,
                    ]}
                  >
                    {tag}
                  </Text>
                ))}
              </View>
              <TouchableOpacity
                style={styles.scenicNavIcon}
                activeOpacity={0.85}
                onPress={() => {
                  void handleMuseumNavigate(item);
                }}
              >
                <Navigation size={13} color={Colors.primary} />
              </TouchableOpacity>
              <View style={styles.museumCardBody}>
                <View>
                  <Text style={styles.museumTitle}>{item.title}</Text>
                  <View style={styles.locationRow}>
                    <MapPin size={12} color={Colors.textMuted} />
                    <Text style={styles.locationText}>{item.location}</Text>
                  </View>
                </View>
                <Text style={styles.museumDistance}>{item.distance}</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View key={item.id} style={styles.textOnlyResultItem}>
              <View style={styles.textOnlyHeader}>
                <Text style={styles.textOnlyResultTitle}>{item.title}</Text>
                <TouchableOpacity
                  style={styles.listNavBtn}
                  activeOpacity={0.85}
                  onPress={() => {
                    void handleMuseumNavigate(item);
                  }}
                >
                  <Navigation size={13} color={Colors.primary} />
                </TouchableOpacity>
              </View>
              <View style={styles.locationRow}>
                <MapPin size={12} color={Colors.textMuted} />
                <Text style={styles.locationText}>{item.location}</Text>
              </View>
              {item.tags.length > 0 ? (
                <View style={styles.textOnlyTagsRow}>
                  {item.tags.map((tag) => (
                    <Text key={tag} style={styles.textOnlyTag}>
                      {tag}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          )
        ))}
      </View>

      {hasMoreMuseum ? (
        <View style={styles.loadMoreArea}>
          <Text style={styles.loadMoreHint}>
            {'\u7ee7\u7eed\u4e0b\u62c9\u52a0\u8f7d\u4e0b\u4e00\u9875\uff08\u6bcf\u9875 5 \u6761\uff09'}
          </Text>
        </View>
      ) : null}
      {loadingMore ? (
        <View style={styles.loadMoreArea}>
          <Text style={styles.loadMoreHint}>{'\u6b63\u5728\u52a0\u8f7d\u66f4\u591a\u5185\u5bb9...'}</Text>
        </View>
      ) : null}
      {fallbackModal}
    </View>
  );
}

export function MuseumDirectoryScreen() {
  return (
    <View style={styles.screen}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={stylesVars.heritageBg}
      />
      <TopBar title="博物馆名录" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <MuseumDirectoryContent />
      </ScrollView>
    </View>
  );
}

const stylesVars = {
  heritageBg: Colors.background,
  heritagePrimary: Colors.primary,
  scenicPrimary: Colors.primary,
};
const SCENIC_FALLBACK_IMAGE = require('../../assets/images/pexels-photo-3280117.jpeg');

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: stylesVars.heritageBg,
  },
  safeArea: {
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(129,53,32,0.08)',
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F3E9',
  },
  topBarTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: stylesVars.heritagePrimary,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ECE8DE',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 36,
  },
  sectionPad: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  searchBoxLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.white,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 15,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F7F3E9',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  tabRow: {
    paddingHorizontal: 20,
    gap: 10,
    paddingTop: 18,
  },
  categoryTab: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#E9E1D6',
  },
  categoryTabActive: {
    backgroundColor: stylesVars.scenicPrimary,
  },
  categoryTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  categoryTabTextActive: {
    color: Colors.white,
  },
  filterCard: {
    marginTop: 18,
  },
  filterGrid: {
    backgroundColor: '#F5EDE1',
    borderRadius: 24,
    padding: 18,
    gap: 12,
  },
  filterBlock: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 12,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 8,
  },
  filterValue: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterValueText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '600',
  },
  filterAction: {
    alignSelf: 'flex-end',
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#814A2D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 18,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: stylesVars.scenicPrimary,
  },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  filterResultHint: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 12,
    lineHeight: 20,
  },
  catalogEmptyBox: {
    backgroundColor: 'rgba(14,71,83,0.06)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(14,71,83,0.12)',
  },
  catalogEmptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  catalogEmptyHint: {
    marginTop: 8,
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 20,
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  linkBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: stylesVars.scenicPrimary,
  },
  heroCard: {
    height: 250,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 16,
  },
  heroImage: {
    borderRadius: 24,
  },
  heroOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 18,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  heroBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,219,203,0.95)',
    color: '#341100',
    fontSize: 10,
    fontWeight: '800',
    overflow: 'hidden',
  },
  heroDistance: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.24)',
    color: Colors.white,
    fontSize: 10,
    fontWeight: '800',
    overflow: 'hidden',
  },
  heroMeta: {
    gap: 4,
  },
  heroTitle: {
    fontSize: 28,
    color: Colors.white,
    fontWeight: '800',
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.82)',
  },
  cardGrid: {
    gap: 14,
  },
  scenicCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  scenicCardImage: {
    width: '100%',
    height: 190,
  },
  scenicNavIcon: {
    position: 'absolute',
    top: 150,
    right: 14,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    padding: 14,
    gap: 10,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cardTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F0E7D8',
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    overflow: 'hidden',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  cardSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  scenicFallbackWrap: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scenicFallbackHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  scenicFallbackTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  scenicFallbackCloseText: {
    fontSize: 14,
    color: Colors.accent,
    fontWeight: '600',
  },
  editorialHeader: {
    marginBottom: 30,
  },
  editorialHeroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  editorialHeroText: {
    flex: 1,
  },
  editorialMarkVertical: {
    width: 20,
    fontSize: 10,
    lineHeight: 16,
    color: '#9E958A',
    fontWeight: '700',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  editorialTitle: {
    fontSize: 44,
    lineHeight: 52,
    fontWeight: '900',
    color: stylesVars.heritagePrimary,
    marginTop: 2,
  },
  editorialBody: {
    marginTop: 10,
    fontSize: 17,
    lineHeight: 31,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  contentSection: {
    marginBottom: 28,
  },
  dynastySectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  labelRowTight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categorySectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryLabel: {
    fontSize: 12,
    letterSpacing: 2.4,
    color: '#5C6B6D',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: stylesVars.heritagePrimary,
  },
  contentTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  dynastyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  dynastyCard: {
    width: '30.8%',
    minWidth: 83,
    height: 72,
    backgroundColor: '#F7F3E9',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(136,114,109,0.08)',
    gap: 5,
  },
  dynastyCardActive: {
    backgroundColor: '#266E7C',
    borderColor: '#266E7C',
  },
  dynastyYears: {
    fontSize: 8,
    lineHeight: 13,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  dynastyYearsActive: {
    color: '#BDE4E9',
  },
  dynastyTextBlock: {
    alignItems: 'center',
    gap: 1,
  },
  dynastyLabel: {
    fontSize: 21,
    fontWeight: '500',
    color: Colors.text,
  },
  dynastyLabelActive: {
    color: Colors.white,
  },
  dynastySubtitle: {
    fontSize: 8,
    color: '#91887C',
    fontWeight: '700',
    letterSpacing: 0.16,
    textTransform: 'uppercase',
  },
  dynastySubtitleActive: {
    color: '#BDE4E9',
  },
  heritageTypeStack: {
    gap: 12,
  },
  heritagePairRow: {
    flexDirection: 'row',
    gap: 12,
  },
  heritageTypeCard: {
    overflow: 'hidden',
    borderRadius: 20,
  },
  heritageWide: {
    height: 166,
  },
  heritageHalf: {
    flex: 1,
    height: 194,
  },
  heritageImage: {
    borderRadius: 20,
  },
  heritageOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  heritageTypeTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.white,
  },
  heritageTypeSubtitle: {
    marginTop: 2,
    fontSize: 9,
    color: 'rgba(255,255,255,0.82)',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  heritageBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#D1EAEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sliderValue: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#D1EAEE',
    borderRadius: 10,
  },
  sliderValueText: {
    fontSize: 13,
    fontWeight: '800',
    color: stylesVars.heritagePrimary,
  },
  sliderTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E6E2D8',
    overflow: 'visible',
    justifyContent: 'center',
  },
  sliderActive: {
    width: '50%',
    height: 6,
    borderRadius: 3,
    backgroundColor: stylesVars.heritagePrimary,
  },
  sliderThumb: {
    position: 'absolute',
    left: '50%',
    marginLeft: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: stylesVars.heritagePrimary,
    borderWidth: 4,
    borderColor: stylesVars.heritageBg,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  sliderLabelText: {
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  primaryCTA: {
    marginTop: 8,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: stylesVars.heritagePrimary,
    shadowColor: stylesVars.heritagePrimary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 4,
  },
  primaryCTAText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '800',
  },

  museumList: {
    gap: 16,
  },
  museumCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  museumImage: {
    width: '100%',
    height: 190,
  },
  museumTagRow: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  museumImageTag: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(14,71,83,0.92)',
    color: Colors.white,
    fontSize: 10,
    fontWeight: '800',
    overflow: 'hidden',
  },
  museumImageTagLight: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    color: stylesVars.heritagePrimary,
  },
  museumCardBody: {
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  museumTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  museumDistance: {
    fontSize: 12,
    fontWeight: '800',
    color: stylesVars.heritagePrimary,
  },
  textOnlyResultItem: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(14,71,83,0.12)',
  },
  textOnlyResultTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 6,
  },
  textOnlyHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  listNavBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textOnlyTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  textOnlyTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '700',
    color: stylesVars.heritagePrimary,
    backgroundColor: 'rgba(14,71,83,0.08)',
    overflow: 'hidden',
  },
  loadMoreArea: {
    alignItems: 'center',
    gap: 10,
    marginTop: 24,
    marginBottom: 8,
  },
  loadMoreButton: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: stylesVars.heritagePrimary,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.white,
  },
  loadMoreHint: {
    fontSize: 10,
    letterSpacing: 1,
    color: Colors.textMuted,
  },
});
