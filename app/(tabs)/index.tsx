import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView,
  TouchableOpacity, StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { FEATURED_SITES, NEARBY_SITES } from '@/constants/MockData';
import { HeroCarousel } from '@/components/home/HeroCarousel';
import { CategoryFilter } from '@/components/home/CategoryFilter';
import { SiteCard } from '@/components/home/SiteCard';
import { NearbyCard } from '@/components/home/NearbyCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import {
  getCurrentLocationWithPermission,
  reverseGeocodeLocation,
} from '@/lib/location/locationService';
import { Bell, MapPin, Sparkles, Mic } from 'lucide-react-native';

export default function HomeScreen() {
  const [location, setLocation] = useState('定位中...');

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

      const city = address.city?.trim() || address.province?.trim() || '当前位置';
      const district = address.district?.trim();
      setLocation(district ? `${city} · ${district}` : city);
    } catch {
      setLocation('定位失败');
    }
  }, []);

  useEffect(() => {
    refreshHeaderLocation();
  }, [refreshHeaderLocation]);

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
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={styles.locationRow}
              activeOpacity={0.75}
              onPress={refreshHeaderLocation}
            >
              <MapPin size={14} color={Colors.accent} />
              <Text style={styles.location}>{location}</Text>
            </TouchableOpacity>
            <Text style={styles.greeting}>探寻文化踪迹</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerBtn}>
              <Bell size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
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
            subtitle="500米内的博物馆与文保单位"
            onSeeAll={() => {}}
          />
          {NEARBY_SITES.map((site) => (
            <NearbyCard
              key={site.id}
              name={site.name}
              type={site.type}
              dynasty={site.dynasty}
              distance={site.distance}
              isOpen={site.isOpen}
              image={site.image}
              isFree={site.isFree}
              onPress={() => {}}
              onNavigate={() => {}}
            />
          ))}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.background,
  },
  headerLeft: {
    gap: 3,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  location: {
    fontSize: 13,
    color: Colors.accent,
    fontWeight: '500',
  },
  greeting: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  headerBtn: {
    width: 40,
    height: 40,
    backgroundColor: Colors.card,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
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
});
