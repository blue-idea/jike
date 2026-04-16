import React from 'react';
import {
  Image,
  ImageBackground,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
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
  MUSEUM_PROVINCES,
  SCENIC_CATEGORY_TABS,
  SCENIC_FEATURED,
  SCENIC_FILTERS,
  SCENIC_MAP_IMAGE,
} from '@/constants/CatalogData';
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Landmark,
  MapPin,
  Search,
  SlidersHorizontal,
  Star,
  Swords,
} from 'lucide-react-native';

function TopBar({ title }: { title: string }) {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <TouchableOpacity style={styles.iconButton} activeOpacity={0.85} onPress={() => router.push('/discover')}>
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

export function ScenicSearchScreen() {
  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={stylesVars.heritageBg} />
      <TopBar title="A级景点搜索" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionPad}>
          <View style={styles.searchBoxLarge}>
            <Search size={18} color={stylesVars.scenicPrimary} />
            <TextInput
              editable={false}
              placeholder="搜索古建筑、遗址、博物馆..."
              placeholderTextColor="#8C8173"
              style={styles.searchInput}
            />
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabRow}
        >
          {SCENIC_CATEGORY_TABS.map((tab, index) => {
            const active = index === 0;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.categoryTab, active && styles.categoryTabActive]}
                activeOpacity={0.85}
              >
                <Text style={[styles.categoryTabText, active && styles.categoryTabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={[styles.sectionPad, styles.filterCard]}>
          <View style={styles.filterGrid}>
            {SCENIC_FILTERS.map((filter) => (
              <View key={filter.id} style={styles.filterBlock}>
                <Text style={styles.filterLabel}>{filter.label}</Text>
                <TouchableOpacity style={styles.filterValue} activeOpacity={0.85}>
                  <Text style={styles.filterValueText}>{filter.value}</Text>
                  <ChevronDown size={16} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.filterAction} activeOpacity={0.9}>
              <SlidersHorizontal size={18} color={Colors.white} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionPad}>
          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionTitle}>附近文化地标</Text>
              <Text style={styles.sectionSubtitle}>沿用 Stitch 稿的景点搜索结构</Text>
            </View>
            <TouchableOpacity style={styles.linkBtn} activeOpacity={0.85}>
              <Text style={styles.linkBtnText}>查看全部</Text>
              <ArrowRight size={14} color={stylesVars.scenicPrimary} />
            </TouchableOpacity>
          </View>

          <ImageBackground
            source={{ uri: SCENIC_FEATURED[0].image }}
            imageStyle={styles.heroImage}
            style={styles.heroCard}
          >
            <LinearGradient
              colors={['rgba(14,71,83,0.1)', 'rgba(14,71,83,0.88)']}
              style={styles.heroOverlay}
            >
              <View style={styles.heroBadgeRow}>
                {SCENIC_FEATURED[0].tags.map((tag) => (
                  <Text key={tag} style={styles.heroBadge}>
                    {tag}
                  </Text>
                ))}
                <Text style={styles.heroDistance}>{SCENIC_FEATURED[0].distance}</Text>
              </View>
              <View style={styles.heroMeta}>
                <Text style={styles.heroTitle}>{SCENIC_FEATURED[0].title}</Text>
                <Text style={styles.heroSubtitle}>{SCENIC_FEATURED[0].subtitle}</Text>
              </View>
            </LinearGradient>
          </ImageBackground>

          <View style={styles.cardGrid}>
            {SCENIC_FEATURED.slice(1).map((item) => (
              <View key={item.id} style={styles.scenicCard}>
                <Image source={{ uri: item.image }} style={styles.scenicCardImage} />
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
                      <Star size={13} color={Colors.accent} fill={Colors.accent} />
                      <Text style={styles.ratingText}>{item.rating}</Text>
                    </View>
                    <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

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
      </ScrollView>
    </View>
  );
}

export function HeritageDirectoryScreen() {
  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={stylesVars.heritageBg} />
      <TopBar title="重点文保名录" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionPad}>
          <View style={styles.editorialHeader}>
            <View style={styles.editorialHeroRow}>
              <Text style={styles.editorialMarkVertical}>筛选中心</Text>
              <View style={styles.editorialHeroText}>
                <Text style={styles.editorialTitle}>多维探寻</Text>
                <Text style={styles.editorialBody}>
                  拨动时光的指针，在层叠的历史皱褶中，定位那一抹属于你的文明印记。
                </Text>
              </View>
            </View>
          </View>

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
                  style={[styles.dynastyCard, item.active && styles.dynastyCardActive]}
                  activeOpacity={0.9}
                >
                  <Text
                    style={[styles.dynastyYears, item.active && styles.dynastyYearsActive]}
                  >
                    {item.years}
                  </Text>
                  <View style={styles.dynastyTextBlock}>
                    <Text
                      style={[styles.dynastyLabel, item.active && styles.dynastyLabelActive]}
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

            <View style={styles.heritageTypeStack}>
              <ImageBackground
                source={{ uri: HERITAGE_TYPES[0].image }}
                imageStyle={styles.heritageImage}
                style={[styles.heritageTypeCard, styles.heritageWide]}
              >
                <LinearGradient
                  colors={['rgba(0,0,0,0.14)', 'rgba(0,0,0,0.74)']}
                  style={styles.heritageOverlay}
                >
                  <Text style={styles.heritageTypeTitle}>{HERITAGE_TYPES[0].title}</Text>
                  <Text style={styles.heritageTypeSubtitle}>{HERITAGE_TYPES[0].subtitle}</Text>
                </LinearGradient>
                <View style={styles.heritageBadge}>
                  <Landmark size={15} color={stylesVars.heritagePrimary} strokeWidth={2.2} />
                </View>
              </ImageBackground>

              <View style={styles.heritagePairRow}>
                {HERITAGE_TYPES.slice(1, 3).map((item) => (
                  <ImageBackground
                    key={item.id}
                    source={{ uri: item.image }}
                    imageStyle={styles.heritageImage}
                    style={[styles.heritageTypeCard, styles.heritageHalf]}
                  >
                    <LinearGradient
                      colors={['rgba(0,0,0,0.08)', 'rgba(0,0,0,0.72)']}
                      style={styles.heritageOverlay}
                    >
                      <Text style={styles.heritageTypeTitle}>{item.title}</Text>
                      <Text style={styles.heritageTypeSubtitle}>{item.subtitle}</Text>
                    </LinearGradient>
                  </ImageBackground>
                ))}
              </View>

              <ImageBackground
                source={{ uri: HERITAGE_TYPES[3].image }}
                imageStyle={styles.heritageImage}
                style={[styles.heritageTypeCard, styles.heritageWide]}
              >
                <LinearGradient
                  colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.68)']}
                  style={styles.heritageOverlay}
                >
                  <Text style={styles.heritageTypeTitle}>{HERITAGE_TYPES[3].title}</Text>
                  <Text style={styles.heritageTypeSubtitle}>{HERITAGE_TYPES[3].subtitle}</Text>
                </LinearGradient>
                <View style={styles.heritageBadge}>
                  <Swords size={15} color={stylesVars.heritagePrimary} strokeWidth={2.1} />
                </View>
              </ImageBackground>
            </View>
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
      </ScrollView>
    </View>
  );
}

export function MuseumDirectoryScreen() {
  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={stylesVars.heritageBg} />
      <TopBar title="博物馆名录" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionPad}>
          <View style={styles.searchBox}>
            <Search size={18} color={stylesVars.heritagePrimary} />
            <TextInput
              editable={false}
              placeholder="搜索博物馆..."
              placeholderTextColor="#8C8173"
              style={styles.searchInput}
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.provinceRow}
          >
            {MUSEUM_PROVINCES.map((province, index) => (
              <TouchableOpacity
                key={province}
                style={[styles.provinceChip, index === 0 && styles.provinceChipActive]}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.provinceChipText,
                    index === 0 && styles.provinceChipTextActive,
                  ]}
                >
                  {province}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.museumFilterGrid}>
            <View style={styles.museumFilterCard}>
              <Text style={styles.museumFilterLabel}>质量等级</Text>
              <View style={styles.tagRow}>
                {['一级', '二级', '三级', '无级别'].map((tag, index) => (
                  <Text key={tag} style={[styles.museumFilterTag, index === 0 && styles.museumFilterTagActive]}>
                    {tag}
                  </Text>
                ))}
              </View>
            </View>
            <View style={styles.museumFilterCard}>
              <Text style={styles.museumFilterLabel}>博物馆性质</Text>
              <View style={styles.tagRow}>
                {['综合', '历史', '艺术', '科技'].map((tag) => (
                  <Text key={tag} style={styles.museumFilterTag}>
                    {tag}
                  </Text>
                ))}
              </View>
            </View>
            <View style={styles.museumSwitchCard}>
              <View>
                <Text style={styles.museumFilterLabel}>开放政策</Text>
                <Text style={styles.switchText}>仅显示免费开放</Text>
              </View>
              <View style={styles.switchTrack}>
                <View style={styles.switchThumb} />
              </View>
            </View>
            <View style={styles.museumSwitchCard}>
              <View>
                <Text style={styles.museumFilterLabel}>排序方式</Text>
                <Text style={styles.switchText}>离我最近</Text>
              </View>
              <ChevronDown size={18} color={stylesVars.heritagePrimary} />
            </View>
          </View>

          <View style={styles.museumList}>
            {MUSEUM_CARDS.map((item) => (
              <TouchableOpacity key={item.id} style={styles.museumCard} activeOpacity={0.92}>
                <Image source={{ uri: item.image }} style={styles.museumImage} />
                <View style={styles.museumTagRow}>
                  {item.tags.map((tag, index) => (
                    <Text key={tag} style={[styles.museumImageTag, index === 1 && styles.museumImageTagLight]}>
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
            <Text style={styles.loadMoreHint}>已显示 5/5600+ 所博物馆</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const stylesVars = {
  heritageBg: Colors.background,
  heritagePrimary: '#813520',
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
    color: '#6E564B',
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
    gap: 12,
  },
  dynastyCard: {
    width: '30.8%',
    minWidth: 104,
    height: 132,
    backgroundColor: '#F7F3E9',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(136,114,109,0.08)',
  },
  dynastyCardActive: {
    backgroundColor: '#B25A3E',
    borderColor: '#B25A3E',
  },
  dynastyYears: {
    fontSize: 10,
    lineHeight: 16,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  dynastyYearsActive: {
    color: '#F4D5CB',
  },
  dynastyTextBlock: {
    gap: 2,
  },
  dynastyLabel: {
    fontSize: 26,
    fontWeight: '500',
    color: Colors.text,
  },
  dynastyLabelActive: {
    color: Colors.white,
  },
  dynastySubtitle: {
    fontSize: 10,
    color: '#91887C',
    fontWeight: '700',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  dynastySubtitleActive: {
    color: '#F1CEC2',
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
    backgroundColor: '#FFD8CC',
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
    backgroundColor: '#FFDBD1',
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
  provinceRow: {
    gap: 8,
    paddingVertical: 18,
  },
  provinceChip: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#E6E2D8',
  },
  provinceChipActive: {
    backgroundColor: stylesVars.heritagePrimary,
  },
  provinceChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  provinceChipTextActive: {
    color: Colors.white,
  },
  museumFilterGrid: {
    gap: 12,
    marginBottom: 22,
  },
  museumFilterCard: {
    backgroundColor: '#F7F3E9',
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  museumFilterLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: stylesVars.heritagePrimary,
    letterSpacing: 1,
  },
  museumFilterTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#E6E2D8',
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    overflow: 'hidden',
  },
  museumFilterTagActive: {
    backgroundColor: '#FFDBD1',
    color: stylesVars.heritagePrimary,
  },
  museumSwitchCard: {
    backgroundColor: '#F7F3E9',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchText: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  switchTrack: {
    width: 46,
    height: 26,
    borderRadius: 13,
    backgroundColor: stylesVars.heritagePrimary,
    justifyContent: 'center',
    paddingHorizontal: 3,
    alignItems: 'flex-end',
  },
  switchThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.white,
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
    backgroundColor: 'rgba(129,53,32,0.92)',
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
