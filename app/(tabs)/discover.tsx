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
import { GeoLocationFilter, MuseumFilterPanel, HeritageFilterPanel } from '@/components/catalog/GeoLocationFilter';
import { queryHeritageFilterOptions, type HeritageFilterOptions } from '@/lib/catalog/supabaseCatalogQueries';
import { ALL_DISTRICTS, type ScenicLocationFormState, type MuseumQueryFormState, type HeritageQueryFormState } from '@/lib/catalog/catalogQueryFilters';

const PLACEHOLDER = '请选择';
const ALL_LEVEL = '全部等级';
const ALL = '全部';
const SORT_BY_NEAREST = '离我最近';

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

  // Lifting filter states
  const [scenicFilters, setScenicFilters] = useState<ScenicLocationFormState>({
    province: homeCatalogLocation?.province ?? PLACEHOLDER,
    city: homeCatalogLocation?.city ?? PLACEHOLDER,
    district: ALL_DISTRICTS,
    level: ALL_LEVEL,
    useAutoLocation: Boolean(homeCatalogLocation),
  });

  const [museumFilters, setMuseumFilters] = useState<MuseumQueryFormState>({
    province: homeCatalogLocation?.province ?? PLACEHOLDER,
    city: homeCatalogLocation?.city ?? PLACEHOLDER,
    district: ALL_DISTRICTS,
    sortBy: SORT_BY_NEAREST,
    useAutoLocation: Boolean(homeCatalogLocation),
  });

  const [heritageFilters, setHeritageFilters] = useState<HeritageQueryFormState>({
    province: homeCatalogLocation?.province ?? PLACEHOLDER,
    city: homeCatalogLocation?.city ?? PLACEHOLDER,
    district: ALL_DISTRICTS,
    era: ALL,
    category: ALL,
    batch: ALL,
    useAutoLocation: Boolean(homeCatalogLocation),
  });

  const [heritageOptions, setHeritageOptions] = useState<HeritageFilterOptions>({
    eras: [],
    categories: [],
    batches: [],
  });

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const options = await queryHeritageFilterOptions();
        setHeritageOptions(options);
      } catch (e) {
        console.warn('Failed to fetch heritage options', e);
      }
    };
    fetchOptions();
  }, []);

  useEffect(() => {
    // Update province/city when home location changes
    if (homeCatalogLocation) {
      setScenicFilters(prev => ({ ...prev, province: homeCatalogLocation.province, city: homeCatalogLocation.city, useAutoLocation: true }));
      setMuseumFilters(prev => ({ ...prev, province: homeCatalogLocation.province, city: homeCatalogLocation.city, useAutoLocation: true }));
      setHeritageFilters(prev => ({ ...prev, province: homeCatalogLocation.province, city: homeCatalogLocation.city, useAutoLocation: true }));
    }
  }, [homeCatalogLocation]);
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
        <View style={styles.unifiedCard}>
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

          <View style={styles.searchSection}>
            <SearchBar onSearch={setQuery} hideFilterBtn />
          </View>

          <View style={styles.filterSection}>
            {activeTab === 'scenic' && (
              <GeoLocationFilter
                primaryColor={Colors.primary}
                defaultLocation={scenicFilters}
                showDistrictFilter={false}
                transparent
                onApplyQuery={setScenicFilters}
              />
            )}
            {activeTab === 'museum' && (
              <MuseumFilterPanel
                primaryColor={Colors.primary}
                defaultLocation={{ ...museumFilters, level: ALL_LEVEL }}
                transparent
                onApplyQuery={setMuseumFilters}
              />
            )}
            {activeTab === 'heritage' && (
              <HeritageFilterPanel
                primaryColor={Colors.primary}
                defaultLocation={{ ...heritageFilters, level: ALL_LEVEL }}
                filterOptions={heritageOptions}
                transparent
                onApplyQuery={setHeritageFilters}
              />
            )}
          </View>
        </View>

        <View style={styles.contentContainer}>
          {activeTab === 'heritage' && (
            <HeritageDirectoryContent
              loadMoreSignal={loadMoreSignals.heritage}
              externalFilters={heritageFilters}
            />
          )}
          {activeTab === 'scenic' && (
            <ScenicSearchContent
              keyword={query}
              loadMoreSignal={loadMoreSignals.scenic}
              externalFilters={scenicFilters}
            />
          )}
          {activeTab === 'museum' && (
            <MuseumDirectoryContent
              loadMoreSignal={loadMoreSignals.museum}
              externalFilters={museumFilters}
            />
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
  unifiedCard: {
    backgroundColor: Colors.white,
    borderRadius: 28,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 16,
    padding: 16,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  searchSection: {
    paddingVertical: 12,
  },
  tabBarContainer: {
    paddingBottom: 4,
  },
  filterSection: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.03)',
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
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#F5F2EA',
    borderRadius: 32,
    padding: 4,
    width: '100%',
    height: 48,
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
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  segmentedTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8A7D6A',
  },
  segmentedTabTextActive: {
    color: Colors.white,
    fontWeight: '700',
  },
  contentContainer: {
    flex: 1,
  },
});
