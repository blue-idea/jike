import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, StatusBar,
  type NativeScrollEvent, type NativeSyntheticEvent,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { SearchBar } from '@/components/discover/SearchBar';
import { BrandHeader } from '@/components/ui/BrandHeader';
import { useCatalogLocation } from '@/contexts/CatalogLocationContext';
import { Landmark, Search, Map, MapPin } from 'lucide-react-native';
import { HeritageDirectoryContent, ScenicSearchContent, MuseumDirectoryContent } from '@/components/catalog/CatalogScreens';

export default function DiscoverScreen() {
  const { homeCatalogLocation } = useCatalogLocation();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'heritage' | 'scenic' | 'museum'>('scenic');
  const [reachedBottom, setReachedBottom] = useState(false);
  const [loadMoreSignals, setLoadMoreSignals] = useState({
    heritage: 0,
    scenic: 0,
    museum: 0,
  });
  const homeLocationLabel = useMemo(() => {
    if (!homeCatalogLocation) return null;
    if (!homeCatalogLocation.city) return homeCatalogLocation.province;
    return `${homeCatalogLocation.province} ${homeCatalogLocation.city}`;
  }, [homeCatalogLocation]);

  useEffect(() => {
    setReachedBottom(false);
  }, [activeTab]);

  const bumpActiveTabSignal = useCallback(() => {
    setLoadMoreSignals((prev) => ({
      ...prev,
      [activeTab]: prev[activeTab] + 1,
    }));
  }, [activeTab]);

  const onDiscoverScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
      const hasUserScrolledDown = contentOffset.y > 24;
      const isNearBottom =
        hasUserScrolledDown &&
        layoutMeasurement.height + contentOffset.y >= contentSize.height - 100;
      if (isNearBottom && !reachedBottom) {
        bumpActiveTabSignal();
      }
      setReachedBottom(isNearBottom);
    },
    [bumpActiveTabSignal, reachedBottom],
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FDF9EF" />
      <BrandHeader
        rightElement={
          homeLocationLabel ? (
            <View style={styles.navLocation}>
              <MapPin size={14} color={Colors.accent} />
              <Text style={styles.navLocationText} numberOfLines={1}>
                {homeLocationLabel}
              </Text>
            </View>
          ) : null
        }
      />

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={onDiscoverScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.searchSection}>
          <View style={styles.searchRow}>
            <View style={{ flex: 1 }}>
              <SearchBar onSearch={setQuery} />
            </View>
          </View>
        </View>

        <View style={styles.tabBarContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarScroll}>
            {[
              { id: 'scenic', label: 'A级景区', icon: Map },
              { id: 'museum', label: '博物馆', icon: Search },
              { id: 'heritage', label: '重点文保', icon: Landmark },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.id}
                style={[styles.mainTab, activeTab === tab.id && styles.mainTabActive]}
                onPress={() => setActiveTab(tab.id as any)}
              >
                <tab.icon size={16} color={activeTab === tab.id ? Colors.white : Colors.primary} />
                <Text style={[styles.mainTabText, activeTab === tab.id && styles.mainTabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.contentContainer}>
          {activeTab === 'heritage' && (
            <HeritageDirectoryContent loadMoreSignal={loadMoreSignals.heritage} />
          )}
          {activeTab === 'scenic' && (
            <ScenicSearchContent
              keyword={query}
              loadMoreSignal={loadMoreSignals.scenic}
            />
          )}
          {activeTab === 'museum' && (
            <MuseumDirectoryContent loadMoreSignal={loadMoreSignals.museum} />
          )}
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
  scroll: {
    flex: 1,
  },
  searchSection: {
    backgroundColor: Colors.background,
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(200, 145, 74, 0.1)',
    maxWidth: 160,
  },
  navLocationText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  tabBarContainer: {
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  tabBarScroll: {
    gap: 12,
  },
  mainTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  mainTabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  mainTabText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  mainTabTextActive: {
    color: Colors.white,
  },
  contentContainer: {
    flex: 1,
  },
});
