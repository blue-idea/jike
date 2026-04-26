import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView,
  TouchableOpacity, StatusBar,
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
  normalizeCatalogLocation,
  useCatalogLocation,
} from '@/contexts/CatalogLocationContext';
import { MapPin, Sparkles, Mic } from 'lucide-react-native';
import { BrandHeader } from '@/components/ui/BrandHeader';
import { useNearbyPois } from '@/hooks/useNearbyPois';

export default function HomeScreen() {
  const { setHomeCatalogLocation } = useCatalogLocation();
  const [location, setLocation] = useState('定位中...');
  const { pois: nearbyPois, loading: nearbyLoading, error: nearbyError, refresh: refreshNearby } =
    useNearbyPois({ radiusM: 10000 });

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

      const address = await reverseGeocodeLocation(current.coords);
      if (!address) {
        setLocation('未知位置');
        return;
      }

      const normalizedCatalogLocation = normalizeCatalogLocation(address);
      if (normalizedCatalogLocation) {
        setHomeCatalogLocation(normalizedCatalogLocation);
      }

      const city = address.city?.trim() || address.province?.trim() || '当前位置';
      const district = address.district?.trim();
      setLocation(district ? `${city} · ${district}` : city);
    } catch {
      setLocation('定位失败');
    }
  }, [setHomeCatalogLocation]);

  useEffect(() => {
    refreshHeaderLocation();
  }, [refreshHeaderLocation]);

  useEffect(() => {
    void refreshNearby();
  }, [refreshNearby]);

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
              <Text style={styles.location}>{location}</Text>
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
                  <Text style={styles.aiSubtitle}>告诉我你的偏好，智能规划专属路线</Text>
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
            title="精选文化地标"
            subtitle="为你推荐的文化遗产与博物馆"
            onSeeAll={() => {}}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          >
            {FEATURED_SITES.map((site) => (
              <SiteCard
                key={site.id}
                name={site.name}
                province={site.province}
                city={site.city}
                dynasty={site.dynasty}
                type={site.type}
                image={site.image}
                tags={site.tags}
                rating={site.rating}
                distance={site.distance}
                isStamped={site.isStamped}
                level={site.level}
                onPress={() => {}}
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <SectionHeader
            title="周边文旅点位"
            subtitle="定位授权用于文化地标推荐与距离计算（默认10km）"
            onSeeAll={() => {
              void refreshNearby();
            }}
          />
          {nearbyLoading ? (
            <Text style={styles.nearbyStateText}>正在获取附近点位...</Text>
          ) : nearbyError ? (
            <Text style={styles.nearbyStateText}>{nearbyError}</Text>
          ) : nearbyPois.length === 0 ? (
            <Text style={styles.nearbyStateText}>附近暂无符合条件的文化地标</Text>
          ) : (
            nearbyPois.slice(0, 6).map((poi) => (
              <NearbyCard
                key={poi.id}
                name={poi.name}
                type={
                  poi.poi_type === 'scenic'
                    ? 'A级景区'
                    : poi.poi_type === 'heritage'
                      ? '重点文保'
                      : '博物馆'
                }
                dynasty={poi.label ?? '文化地标'}
                distance={poi.distance_display ?? '距离未知'}
                isOpen
                image={poi.images?.[0] || FEATURED_SITES[0].image}
                isFree={poi.poi_type === 'museum'}
                onPress={() => {}}
                onNavigate={() => {}}
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
              <Text style={styles.insightTitle}>为什么唐代佛教艺术最为繁盛？</Text>
              <Text style={styles.insightBody}>
                唐朝是中国历史上最开放的朝代之一，玄奘西行取经、武则天崇佛等因素共同推动了佛教文化的黄金时代…
              </Text>
              <TouchableOpacity 
                style={styles.insightBtn}
                onPress={() => router.push('/ai-guide-detail')}
              >
                <Sparkles size={14} color={Colors.accent} />
                <Text style={styles.insightBtnText}>AI深度解析</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>

        <View style={{ height: 20 }} />
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
});
