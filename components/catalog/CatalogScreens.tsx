import React, { useCallback, useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
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
  HERITAGE_DYNASTIES,
  HERITAGE_TYPES,
  MUSEUM_CARDS,
  SCENIC_FEATURED,
  SCENIC_MAP_IMAGE,
  type MuseumCardItem,
  type ScenicFeature,
} from '@/constants/CatalogData';
import {
  filterMuseumCards,
  filterScenicFeatures,
  formatMuseumResultHint,
  formatScenicResultHint,
  sortMuseumCards,
  type MuseumQueryFormState,
  type ScenicLocationFormState,
} from '@/lib/catalog/catalogQueryFilters';
import {
  queryHeritageSites,
  queryMuseums,
  queryScenicSpots,
} from '@/lib/catalog/supabaseCatalogQueries';
import {
  GeoLocationFilter,
  MuseumFilterPanel,
} from '@/components/catalog/GeoLocationFilter';
import {
  ArrowLeft,
  ArrowRight,
  Landmark,
  MapPin,
  Star,
  Swords,
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
}

export function ScenicSearchContent({ keyword = '' }: ScenicSearchContentProps) {
  const [scenicResults, setScenicResults] = useState<ScenicFeature[]>(() => [
    ...SCENIC_FEATURED,
  ]);
  const [resultHint, setResultHint] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadScenicData = useCallback(async (f: ScenicLocationFormState) => {
    setLoading(true);
    setError(null);
    try {
      // 使用真实数据库查询
      const data = await queryScenicSpots({
        province: f.province !== '请选择' ? f.province : undefined,
        city: f.city !== '请选择' ? f.city : undefined,
        level: f.level !== '全部等级' ? f.level : undefined,
        keyword: keyword.trim() || undefined,
      });
      setScenicResults(data.length > 0 ? data : []);
      setResultHint(formatScenicResultHint(f, data.length));
    } catch (e) {
      // 数据库查询失败时回退到模拟数据
      console.warn('数据库查询失败，回退到模拟数据:', e);
      const next = filterScenicFeatures([...SCENIC_FEATURED], { ...f, level: f.level === '全部等级' ? '' : f.level });
      setScenicResults(next);
      setResultHint(formatScenicResultHint(f, next.length));
    } finally {
      setLoading(false);
    }
  }, [keyword]);

  const onApplyScenicQuery = useCallback((f: ScenicLocationFormState) => {
    loadScenicData(f);
  }, [loadScenicData]);

  // 关键词变化时重新查询
  useEffect(() => {
    if (keyword.trim()) {
      // 如果有搜索关键词，用当前筛选条件+关键词查询
      loadScenicData({
        province: '陕西省',
        city: '西安市',
        district: '碑林区',
        level: '全部等级',
        useAutoLocation: true,
      });
    }
  }, [keyword, loadScenicData]);

  const hero = scenicResults[0];
  const scenicCards = scenicResults.slice(1);

  return (
    <>
      <View style={styles.sectionPad}>
        <GeoLocationFilter
          primaryColor={stylesVars.scenicPrimary}
          onApplyQuery={onApplyScenicQuery}
          showDistrictFilter={false}
        />
      </View>

      <View style={styles.sectionPad}>
        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>附近文化地标</Text>
            <Text style={styles.sectionSubtitle}>
              沿用 Stitch 稿的景点搜索结构
            </Text>
          </View>
          <TouchableOpacity style={styles.linkBtn} activeOpacity={0.85}>
            <Text style={styles.linkBtnText}>查看全部</Text>
            <ArrowRight size={14} color={stylesVars.scenicPrimary} />
          </TouchableOpacity>
        </View>

        {resultHint ? (
          <Text style={styles.filterResultHint}>{resultHint}</Text>
        ) : null}

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={stylesVars.scenicPrimary} />
            <Text style={styles.loadingText}>正在加载A级景区...</Text>
          </View>
        ) : error ? (
          <View style={styles.catalogEmptyBox}>
            <Text style={styles.catalogEmptyTitle}>加载失败</Text>
            <Text style={styles.catalogEmptyHint}>{error}</Text>
          </View>
        ) : hero ? (
          <ImageBackground
            source={{ uri: hero.image }}
            imageStyle={styles.heroImage}
            style={styles.heroCard}
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
          </ImageBackground>
        ) : (
          <View style={styles.catalogEmptyBox}>
            <Text style={styles.catalogEmptyTitle}>暂无符合筛选的结果</Text>
            {resultHint ? (
              <Text style={styles.catalogEmptyHint}>{resultHint}</Text>
            ) : null}
          </View>
        )}

        {!loading && !error && scenicCards.length > 0 && (
          <View style={styles.cardGrid}>
            {scenicCards.map((item) => (
            <View key={item.id} style={styles.scenicCard}>
              <Image
                source={{ uri: item.image }}
                style={styles.scenicCardImage}
              />
              <View style={styles.distancePill}>
                <Text style={styles.distancePillText}>{item.distance}</Text>
              </View>
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
                    <Star
                      size={13}
                      color={Colors.accent}
                      fill={Colors.accent}
                    />
                    <Text style={styles.ratingText}>{item.rating ?? '—'}</Text>
                  </View>
                  <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
        )}

        <View style={styles.mapPromo}>
          <View style={styles.mapPromoText}>
            <Text style={styles.mapPromoTitle}>遗产地图</Text>
            <Text style={styles.mapPromoBody}>
              探索你周边的古都脉络，每个街角都可能通往一段千年故事。
            </Text>
            <TouchableOpacity style={styles.mapButton} activeOpacity={0.9}>
              <Text style={styles.mapButtonText}>探索周边</Text>
            </TouchableOpacity>
          </View>
          <Image source={{ uri: SCENIC_MAP_IMAGE }} style={styles.mapPreview} />
        </View>
      </View>
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

interface HeritageTypeItem {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  tall?: boolean;
}

export function HeritageDirectoryContent() {
  const [heritageTypes, setHeritageTypes] = useState<HeritageTypeItem[]>(() => [
    ...HERITAGE_TYPES,
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHeritageData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 使用真实数据库查询
      const data = await queryHeritageSites({});
      if (data.length > 0) {
        // 将查询结果映射为 HERITAGE_TYPES 格式（前4条）
        const mapped: HeritageTypeItem[] = data.slice(0, 4).map((r, idx) => ({
          id: r.id,
          title: r.title,
          subtitle: r.tags.join(' · ') || r.location || '',
          image: r.image || HERITAGE_TYPES[idx]?.image || '',
          tall: idx === 0 || idx === 3,
        }));
        setHeritageTypes(mapped);
      }
    } catch (e) {
      // 数据库查询失败时回退到模拟数据
      console.warn('数据库查询失败，回退到模拟数据:', e);
      setHeritageTypes([...HERITAGE_TYPES]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHeritageData();
  }, [loadHeritageData]);

  const type0 = heritageTypes[0];
  const type1 = heritageTypes[1];
  const type2 = heritageTypes[2];
  const type3 = heritageTypes[3];

  return (
    <View style={styles.sectionPad}>
      <GeoLocationFilter
        primaryColor={stylesVars.heritagePrimary}
        showLevelFilter={false}
      />

      <View style={styles.contentSection}>
        <View style={styles.dynastySectionHeader}>
          <View style={styles.labelRowTight}>
            <View style={styles.dot} />
            <Text style={styles.contentTitle}>朝代年轮</Text>
          </View>
          <Text style={styles.categoryLabel}>DYNASTY</Text>
        </View>
        <View style={styles.dynastyGrid}>
          {HERITAGE_DYNASTIES.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={[
                styles.dynastyCard,
                item.active && styles.dynastyCardActive,
              ]}
              activeOpacity={0.9}
            >
              <Text
                style={[
                  styles.dynastyYears,
                  item.active && styles.dynastyYearsActive,
                ]}
              >
                {item.years}
              </Text>
              <View style={styles.dynastyTextBlock}>
                <Text
                  style={[
                    styles.dynastyLabel,
                    item.active && styles.dynastyLabelActive,
                  ]}
                >
                  {item.label}
                </Text>
                <Text
                  style={[
                    styles.dynastySubtitle,
                    item.active && styles.dynastySubtitleActive,
                  ]}
                >
                  {`${item.label} DYNASTY`}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.contentSection}>
        <View style={styles.categorySectionHeader}>
          <View style={styles.categoryTitleRow}>
            <View style={styles.dot} />
            <Text style={styles.contentTitle}>类别志趣</Text>
          </View>
          <Text style={styles.categoryLabel}>CATEGORY</Text>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={stylesVars.heritagePrimary} />
            <Text style={styles.loadingText}>正在加载重点文保...</Text>
          </View>
        ) : error ? (
          <View style={styles.catalogEmptyBox}>
            <Text style={styles.catalogEmptyTitle}>加载失败</Text>
            <Text style={styles.catalogEmptyHint}>{error}</Text>
          </View>
        ) : (
          <View style={styles.heritageTypeStack}>
            {type0 ? (
              <ImageBackground
                source={{ uri: type0.image }}
                imageStyle={styles.heritageImage}
                style={[styles.heritageTypeCard, styles.heritageWide]}
              >
                <LinearGradient
                  colors={['rgba(0,0,0,0.14)', 'rgba(0,0,0,0.74)']}
                  style={styles.heritageOverlay}
                >
                  <Text style={styles.heritageTypeTitle}>{type0.title}</Text>
                  <Text style={styles.heritageTypeSubtitle}>{type0.subtitle}</Text>
                </LinearGradient>
                <View style={styles.heritageBadge}>
                  <Landmark
                    size={15}
                    color={stylesVars.heritagePrimary}
                    strokeWidth={2.2}
                  />
                </View>
              </ImageBackground>
            ) : null}

            <View style={styles.heritagePairRow}>
              {type1 ? (
                <ImageBackground
                  source={{ uri: type1.image }}
                  imageStyle={styles.heritageImage}
                  style={[styles.heritageTypeCard, styles.heritageHalf]}
                >
                  <LinearGradient
                    colors={['rgba(0,0,0,0.08)', 'rgba(0,0,0,0.72)']}
                    style={styles.heritageOverlay}
                  >
                    <Text style={styles.heritageTypeTitle}>{type1.title}</Text>
                    <Text style={styles.heritageTypeSubtitle}>{type1.subtitle}</Text>
                  </LinearGradient>
                </ImageBackground>
              ) : null}
              {type2 ? (
                <ImageBackground
                  source={{ uri: type2.image }}
                  imageStyle={styles.heritageImage}
                  style={[styles.heritageTypeCard, styles.heritageHalf]}
                >
                  <LinearGradient
                    colors={['rgba(0,0,0,0.08)', 'rgba(0,0,0,0.72)']}
                    style={styles.heritageOverlay}
                  >
                    <Text style={styles.heritageTypeTitle}>{type2.title}</Text>
                    <Text style={styles.heritageTypeSubtitle}>{type2.subtitle}</Text>
                  </LinearGradient>
                </ImageBackground>
              ) : null}
            </View>

            {type3 ? (
              <ImageBackground
                source={{ uri: type3.image }}
                imageStyle={styles.heritageImage}
                style={[styles.heritageTypeCard, styles.heritageWide]}
              >
                <LinearGradient
                  colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.68)']}
                  style={styles.heritageOverlay}
                >
                  <Text style={styles.heritageTypeTitle}>{type3.title}</Text>
                  <Text style={styles.heritageTypeSubtitle}>{type3.subtitle}</Text>
                </LinearGradient>
                <View style={styles.heritageBadge}>
                  <Swords
                    size={15}
                    color={stylesVars.heritagePrimary}
                    strokeWidth={2.1}
                  />
                </View>
              </ImageBackground>
            ) : null}
          </View>
        )}
      </View>

      <View style={styles.contentSection}>
        <View style={styles.sliderHeader}>
          <View style={styles.labelRow}>
            <View style={styles.dot} />
            <Text style={styles.contentTitle}>足迹范围</Text>
          </View>
          <View style={styles.sliderValue}>
            <Text style={styles.sliderValueText}>50 KM</Text>
          </View>
        </View>
        <View style={styles.sliderTrack}>
          <View style={styles.sliderActive} />
          <View style={styles.sliderThumb} />
        </View>
        <View style={styles.sliderLabels}>
          <Text style={styles.sliderLabelText}>Nearby</Text>
          <Text style={styles.sliderLabelText}>Faraway</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.primaryCTA} activeOpacity={0.92}>
        <Text style={styles.primaryCTAText}>开启寻迹之旅</Text>
      </TouchableOpacity>
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

export function MuseumDirectoryContent() {
  const [museumResults, setMuseumResults] = useState<MuseumCardItem[]>(() => [
    ...MUSEUM_CARDS,
  ]);
  const [museumHint, setMuseumHint] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMuseumData = useCallback(async (f: MuseumQueryFormState) => {
    setLoading(true);
    setError(null);
    try {
      // 使用真实数据库查询
      const data = await queryMuseums({
        province: f.province !== '请选择' ? f.province : undefined,
        city: f.city !== '请选择' ? f.city : undefined,
        district: f.district !== '请选择' ? f.district : undefined,
        sortBy: f.sortBy,
      });
      setMuseumResults(data.length > 0 ? data : []);
      setMuseumHint(formatMuseumResultHint(f, data.length));
    } catch (e) {
      // 数据库查询失败时回退到模拟数据
      console.warn('数据库查询失败，回退到模拟数据:', e);
      let next = filterMuseumCards([...MUSEUM_CARDS], f);
      next = sortMuseumCards(next, f.sortBy);
      setMuseumResults(next);
      setMuseumHint(formatMuseumResultHint(f, next.length));
    } finally {
      setLoading(false);
    }
  }, []);

  const onApplyMuseumQuery = useCallback(
    (f: MuseumQueryFormState) => {
      loadMuseumData(f);
    },
    [loadMuseumData],
  );

  // 初始化加载
  useEffect(() => {
    loadMuseumData({
      province: '请选择',
      city: '请选择',
      district: '请选择',
      sortBy: '离我最近',
      useAutoLocation: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.sectionPad}>
      <MuseumFilterPanel
        primaryColor={stylesVars.heritagePrimary}
        onApplyQuery={onApplyMuseumQuery}
      />

      {museumHint ? (
        <Text style={styles.filterResultHint}>{museumHint}</Text>
      ) : null}

      {loading ? (
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
        ))}
      </View>

      <View style={styles.loadMoreArea}>
        <TouchableOpacity style={styles.loadMoreButton} activeOpacity={0.9}>
          <Text style={styles.loadMoreText}>加载更多博物馆</Text>
        </TouchableOpacity>
        <Text style={styles.loadMoreHint}>
          已显示 {museumResults.length} 条（示例数据，点击「查询」按筛选刷新）
        </Text>
      </View>
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
  heritagePrimary: '#0E4753',
  scenicPrimary: '#0E4753',
};

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
  distancePill: {
    position: 'absolute',
    top: 150,
    right: 14,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  distancePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: stylesVars.scenicPrimary,
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
  mapPromo: {
    backgroundColor: '#F7F3E9',
    borderRadius: 24,
    padding: 16,
    marginTop: 18,
    gap: 14,
  },
  mapPromoText: {
    gap: 10,
  },
  mapPromoTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: stylesVars.scenicPrimary,
  },
  mapPromoBody: {
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textSecondary,
  },
  mapButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: stylesVars.scenicPrimary,
  },
  mapButtonText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  mapPreview: {
    width: '100%',
    height: 180,
    borderRadius: 18,
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
