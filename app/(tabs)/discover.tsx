import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView,
  TouchableOpacity, StatusBar, ImageBackground,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { FEATURED_SITES } from '@/constants/MockData';
import { SearchBar } from '@/components/discover/SearchBar';
import { DynastyFilter } from '@/components/discover/DynastyFilter';
import { SiteListCard } from '@/components/discover/SiteListCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Map, List, Sparkles, TrendingUp } from 'lucide-react-native';

const MAP_IMAGE = 'https://images.pexels.com/photos/2846814/pexels-photo-2846814.jpeg?auto=compress&cs=tinysrgb&w=800';

const EXPLORE_TAGS = [
  { label: '世界遗产', color: Colors.seal },
  { label: '5A景区', color: Colors.accent },
  { label: '免费开放', color: Colors.jade },
  { label: '国家一级馆', color: Colors.primary },
];

export default function DiscoverScreen() {
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');

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

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.title}>发 现</Text>
          <View style={styles.viewToggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}
              onPress={() => setViewMode('list')}
            >
              <List size={16} color={viewMode === 'list' ? Colors.primary : Colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === 'map' && styles.toggleBtnActive]}
              onPress={() => setViewMode('map')}
            >
              <Map size={16} color={viewMode === 'map' ? Colors.primary : Colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
      >
        <View style={styles.searchSection}>
          <SearchBar onSearch={setQuery} />
          <View style={styles.dynastyFilterWrapper}>
            <DynastyFilter />
          </View>
        </View>

        {viewMode === 'map' ? (
          <View style={styles.mapContainer}>
            <ImageBackground source={{ uri: MAP_IMAGE }} style={styles.mapImage} resizeMode="cover">
              <LinearGradient
                colors={['transparent', 'rgba(26,22,3,0.5)']}
                style={styles.mapOverlay}
              >
                <View style={styles.mapBadge}>
                  <Sparkles size={13} color={Colors.gold} />
                  <Text style={styles.mapBadgeText}>高德文旅地图</Text>
                </View>
                <Text style={styles.mapTitle}>古风文旅地图</Text>
                <Text style={styles.mapSubtitle}>展示全国国保单位与博物馆分布</Text>
              </LinearGradient>
            </ImageBackground>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.mapTagsRow}
            >
              {EXPLORE_TAGS.map((tag) => (
                <TouchableOpacity
                  key={tag.label}
                  style={[styles.exploreTag, { borderColor: tag.color }]}
                >
                  <View style={[styles.tagDot, { backgroundColor: tag.color }]} />
                  <Text style={[styles.exploreTagText, { color: tag.color }]}>{tag.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeader
            title="热门文旅目的地"
            subtitle={`共 ${filtered.length} 处文化地标`}
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
        </View>

        <View style={styles.trendSection}>
          <View style={styles.trendHeader}>
            <TrendingUp size={16} color={Colors.seal} />
            <Text style={styles.trendTitle}>热搜文化关键词</Text>
          </View>
          <View style={styles.trendTagsGrid}>
            {['秦始皇陵', '莫高窟', '苏州园林', '乾陵', '大明宫', '云冈石窟',
              '龙门石窟', '平遥古城', '武当山', '泰山', '黄山', '西湖'].map((kw) => (
              <TouchableOpacity key={kw} style={styles.trendTag}>
                <Text style={styles.trendTagText}>{kw}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

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
  safeArea: {
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: 2,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 3,
    gap: 2,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  toggleBtn: {
    width: 36,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 9,
  },
  toggleBtnActive: {
    backgroundColor: Colors.backgroundAlt,
  },
  scroll: {
    flex: 1,
  },
  searchSection: {
    backgroundColor: Colors.background,
    paddingVertical: 12,
    gap: 10,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  dynastyFilterWrapper: {
    marginTop: 2,
  },
  section: {
    marginBottom: 20,
    paddingTop: 4,
  },
  mapContainer: {
    marginBottom: 20,
  },
  mapImage: {
    height: 200,
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  mapOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
    gap: 4,
  },
  mapBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  mapBadgeText: {
    fontSize: 11,
    color: Colors.goldLight,
    fontWeight: '600',
  },
  mapTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 1,
  },
  mapSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
  },
  mapTagsRow: {
    paddingHorizontal: 20,
    gap: 8,
  },
  exploreTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: Colors.card,
  },
  tagDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  exploreTagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  trendSection: {
    marginHorizontal: 20,
    marginBottom: 10,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  trendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  trendTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  trendTagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  trendTag: {
    backgroundColor: Colors.backgroundAlt,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  trendTagText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
});
