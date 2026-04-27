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
import { MapPin } from 'lucide-react-native';
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
          <View style={styles.segmentedControl}>
            {[
              { id: 'scenic', label: 'A级景区' },
              { id: 'museum', label: '博物馆' },
              { id: 'heritage', label: '重点文保' },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.segmentedTab,
                  activeTab === tab.id && styles.segmentedTabActive
                ]}
                onPress={() => setActiveTab(tab.id as any)}
              >
                <Text style={[
                  styles.segmentedTabText,
                  activeTab === tab.id && styles.segmentedTabTextActive
                ]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
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
    paddingBottom: 16,
    alignItems: 'center',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#EDE5D8',
    borderRadius: 32,
    padding: 4,
    width: '100%',
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedTab: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
  },
  segmentedTabActive: {
    backgroundColor: Colors.primary,
    // Add subtle shadow for active tab to make it pop like in the image
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  segmentedTabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#5C5040',
  },
  segmentedTabTextActive: {
    color: Colors.white,
    fontWeight: '700',
  },
  contentContainer: {
    flex: 1,
  },
});
