import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView,
  TouchableOpacity, StatusBar, ActivityIndicator, Dimensions, ImageBackground
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { FEATURED_SITES } from '@/constants/MockData';
import { SearchBar } from '@/components/discover/SearchBar';
import { SiteListCard } from '@/components/discover/SiteListCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { CommonTopBar } from '@/components/ui/CommonTopBar';
import { MapPin, RefreshCw, Flame, Navigation, Landmark, Search, Map } from 'lucide-react-native';

const { width } = Dimensions.get('window');

const DIRECTORY_CATEGORIES = [
  { id: 'heritage', title: '重点文保', subtitle: 'NATIONAL HERITAGE', icon: Landmark, image: 'https://images.pexels.com/photos/2034335/pexels-photo-2034335.jpeg?auto=compress&cs=tinysrgb&w=800', route: '/heritage-directory' },
  { id: 'scenic', title: 'A级景区', subtitle: 'SCENIC SPOTS', image: 'https://images.pexels.com/photos/3382746/pexels-photo-3382746.jpeg?auto=compress&cs=tinysrgb&w=600', route: '/scenic-search' },
  { id: 'world_heritage', title: '世界遗产', subtitle: 'WORLD HERITAGE', icon: Search, image: 'https://images.pexels.com/photos/2846814/pexels-photo-2846814.jpeg?auto=compress&cs=tinysrgb&w=800', route: '/heritage-directory' },
  { id: 'museum', title: '博物馆', subtitle: 'MUSEUMS', image: 'https://images.pexels.com/photos/208536/pexels-photo-208536.jpeg?auto=compress&cs=tinysrgb&w=600', route: '/museum-directory' },
];

export default function DiscoverScreen() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  
  // Location Simulation State
  const [isLocating, setIsLocating] = useState(false);
  const [activeNearbyTab, setActiveNearbyTab] = useState<'5A' | 'wenbao' | 'museum'>('5A');

  useEffect(() => {
    // Initial fetch mockup
    handleRelocate();
  }, []);

  const handleRelocate = () => {
    setIsLocating(true);
    setTimeout(() => {
      setIsLocating(false);
    }, 1200);
  };

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = FEATURED_SITES.filter(
    (s) =>
      query === '' ||
      s.name.includes(query) ||
      s.province.includes(query) ||
      s.dynasty.includes(query)
  );

  // Derive mocked nearby lists based on the tab
  const nearbyItems = FEATURED_SITES.filter(s => {
    if (activeNearbyTab === '5A') return s.level === '5A' || s.category === '建筑';
    if (activeNearbyTab === 'wenbao') return s.level === '国保' || s.category === '遗址';
    if (activeNearbyTab === 'museum') return s.type === 'museum' || s.name.includes('馆');
    return true;
  }).slice(0, 5); // Limit horizontal list

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FDF9EF" />
      <CommonTopBar />

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
      >
        <View style={styles.searchSection}>
          <SearchBar onSearch={setQuery} />
        </View>

        {query === '' && (
          <View style={styles.directoryGrid}>
            <TouchableOpacity 
              style={styles.gridFull}
              onPress={() => DIRECTORY_CATEGORIES[0].route && router.push(DIRECTORY_CATEGORIES[0].route as any)}
              activeOpacity={0.9}
            >
              <ImageBackground source={{ uri: DIRECTORY_CATEGORIES[0].image }} style={styles.directoryBg} imageStyle={styles.directoryImageStyle}>
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.directoryGradient}>
                  <Text style={styles.directoryTitleText}>{DIRECTORY_CATEGORIES[0].title}</Text>
                  <Text style={styles.directorySubtitleText}>{DIRECTORY_CATEGORIES[0].subtitle}</Text>
                </LinearGradient>
                <View style={[styles.iconBadge, { backgroundColor: '#fcebe3' }]}>
                  <Landmark size={14} color="#613b30" />
                </View>
              </ImageBackground>
            </TouchableOpacity>

            <View style={styles.gridRow}>
              <TouchableOpacity 
                style={styles.gridHalf}
                onPress={() => DIRECTORY_CATEGORIES[1].route && router.push(DIRECTORY_CATEGORIES[1].route as any)}
                activeOpacity={0.9}
              >
                <ImageBackground source={{ uri: DIRECTORY_CATEGORIES[1].image }} style={styles.directoryBg} imageStyle={styles.directoryImageStyle}>
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.directoryGradient}>
                    <Text style={styles.directoryTitleText}>{DIRECTORY_CATEGORIES[1].title}</Text>
                    <Text style={styles.directorySubtitleText}>{DIRECTORY_CATEGORIES[1].subtitle}</Text>
                  </LinearGradient>
                </ImageBackground>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.gridHalf}
                onPress={() => DIRECTORY_CATEGORIES[2].route && router.push(DIRECTORY_CATEGORIES[2].route as any)}
                activeOpacity={0.9}
              >
                <ImageBackground source={{ uri: DIRECTORY_CATEGORIES[2].image }} style={styles.directoryBg} imageStyle={styles.directoryImageStyle}>
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.directoryGradient}>
                    <Text style={styles.directoryTitleText}>{DIRECTORY_CATEGORIES[2].title}</Text>
                    <Text style={styles.directorySubtitleText}>{DIRECTORY_CATEGORIES[2].subtitle}</Text>
                  </LinearGradient>
                </ImageBackground>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.gridFull}
              onPress={() => DIRECTORY_CATEGORIES[3].route && router.push(DIRECTORY_CATEGORIES[3].route as any)}
              activeOpacity={0.9}
            >
              <ImageBackground source={{ uri: DIRECTORY_CATEGORIES[3].image }} style={styles.directoryBg} imageStyle={styles.directoryImageStyle}>
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.directoryGradient}>
                  <Text style={styles.directoryTitleText}>{DIRECTORY_CATEGORIES[3].title}</Text>
                  <Text style={styles.directorySubtitleText}>{DIRECTORY_CATEGORIES[3].subtitle}</Text>
                </LinearGradient>
                <View style={[styles.iconBadge, { backgroundColor: '#fcebe3' }]}>
                  <Map size={14} color="#613b30" />
                </View>
              </ImageBackground>
            </TouchableOpacity>
          </View>
        )}

        {query === '' && (
          <View style={styles.nearbySection}>
            <View style={styles.locationHeader}>
              <View style={styles.locationRow}>
                <Navigation size={18} color={Colors.primary} fill={Colors.primary + '30'} />
                {isLocating ? (
                  <View style={styles.locatingWrap}>
                    <ActivityIndicator size="small" color={Colors.primary} />
                    <Text style={styles.locationText}>高德定位中...</Text>
                  </View>
                ) : (
                  <Text style={[styles.locationText, { color: Colors.text, fontWeight: '700' }]}>
                    📍 北京市 · 东城区
                  </Text>
                )}
              </View>
              <TouchableOpacity style={styles.refreshBtn} onPress={handleRelocate} disabled={isLocating}>
                <RefreshCw size={14} color={isLocating ? Colors.textMuted : Colors.primary} style={isLocating ? undefined : styles.rotateIcon} />
                <Text style={styles.refreshText}>刷新试试</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.nearbyTabs}>
              {[
                { id: '5A', label: '5A景区' },
                { id: 'wenbao', label: '重点文保' },
                { id: 'museum', label: '周边展览' },
              ].map(tab => (
                <TouchableOpacity 
                  key={tab.id}
                  style={[styles.nearbyTab, activeNearbyTab === tab.id && styles.nearbyTabActive]}
                  onPress={() => setActiveNearbyTab(tab.id as any)}
                >
                  <Text style={[styles.nearbyTabText, activeNearbyTab === tab.id && styles.nearbyTabTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nearbyScroll}>
              {nearbyItems.map((site) => (
                <TouchableOpacity key={site.id} style={styles.nearbyCard} activeOpacity={0.9}>
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.8)']}
                    style={styles.nearbyGradient}
                  />
                  <Text style={styles.nearbyDistance}>{Math.floor(Math.random() * 15 + 1)} km</Text>
                  <View style={styles.nearbyInfo}>
                    <Text style={styles.nearbyName}>{site.name}</Text>
                    <Text style={styles.nearbyLevel}>{site.level || site.category}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.section}>
          <SectionHeader
            title={query ? "搜索结果" : "为你推荐"}
            subtitle={query ? `找到 ${filtered.length} 个结果` : "每日文化游历精选"}
          />
          {filtered.map((site) => (
            <SiteListCard
              key={site.id}
              name={site.name}
              category={site.category}
              level={site.level}
              province={site.province}
              city={site.city}
              dynasty={site.dynasty}
              type={site.type}
              image={site.image}
              tags={site.tags}
              distance={site.distance}
              rating={site.rating}
              isFavorite={favorites.has(site.id)}
              onPress={() => {}}
              onFavorite={() => toggleFavorite(site.id)}
            />
          ))}
          {filtered.length === 0 && (
             <View style={styles.emptyWrap}>
               <Text style={styles.emptyText}>暂无相关发现</Text>
             </View>
          )}
        </View>

        {!query && (
          <View style={styles.trendSection}>
            <View style={styles.trendHeader}>
              <Flame size={18} color={Colors.accent} fill={Colors.accent + '30'} />
              <Text style={styles.trendTitle}>全网热搜文化地标</Text>
            </View>
            <View style={styles.trendTagsGrid}>
              {['秦始皇陵', '莫高窟', '苏州园林', '三星堆', '大明宫', '云冈石窟',
                '龙门石窟', '平遥古城', '武当山'].map((kw) => (
                <TouchableOpacity key={kw} style={styles.trendTag}>
                  <Text style={styles.trendTagText}>{kw}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 30 }} />
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
  searchSection: {
    backgroundColor: Colors.background,
    paddingBottom: 16,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  // Directory Grid Styles
  directoryGrid: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  gridFull: {
    width: '100%',
    height: 120,
    borderRadius: 14,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  gridHalf: {
    flex: 1,
    height: 140,
    borderRadius: 14,
  },
  directoryBg: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
  },
  directoryImageStyle: {
    borderRadius: 14,
  },
  directoryGradient: {
    width: '100%',
    padding: 16,
    paddingTop: 45,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  directoryTitleText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F9F5F0',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    letterSpacing: 1,
  },
  directorySubtitleText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '700',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  iconBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Nearby Area Styles
  nearbySection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locatingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundAlt,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  refreshText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  rotateIcon: {
    transform: [{ rotate: '45deg' }],
  },
  nearbyTabs: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  nearbyTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  nearbyTabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  nearbyTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  nearbyTabTextActive: {
    color: Colors.white,
  },
  nearbyScroll: {
    gap: 12,
    paddingBottom: 8,
  },
  nearbyCard: {
    width: width * 0.4,
    height: 180,
    borderRadius: 20,
    backgroundColor: Colors.backgroundAlt,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  nearbyGradient: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.8,
  },
  nearbyDistance: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
  },
  nearbyInfo: {
    padding: 14,
  },
  nearbyName: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  nearbyLevel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '500',
  },
  // Main Section
  section: {
    paddingTop: 10,
    paddingBottom: 10,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  trendSection: {
    marginHorizontal: 20,
    marginTop: 10,
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  trendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  trendTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  trendTagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  trendTag: {
    backgroundColor: Colors.background,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  trendTagText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});
