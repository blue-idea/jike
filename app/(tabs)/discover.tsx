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
import { CommonTopBar } from '@/components/ui/CommonTopBar';
import { Landmark, Search, Map, ChevronDown } from 'lucide-react-native';
import { HeritageDirectoryContent, ScenicSearchContent, MuseumDirectoryContent } from '@/components/catalog/CatalogScreens';

const { width } = Dimensions.get('window');

export default function DiscoverScreen() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'heritage' | 'scenic' | 'museum'>('heritage');

  useEffect(() => {
    // Initial fetch mockup
  }, []);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
          <View style={styles.searchRow}>
            <View style={{ flex: 1 }}>
              <SearchBar onSearch={setQuery} />
            </View>
          </View>
        </View>

        <View style={styles.tabBarContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarScroll}>
            {[
              { id: 'heritage', label: '重点文保', icon: Landmark },
              { id: 'scenic', label: 'A级景区', icon: Map },
              { id: 'museum', label: '博物馆', icon: Search },
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
          {activeTab === 'heritage' && <HeritageDirectoryContent />}
          {activeTab === 'scenic' && <ScenicSearchContent />}
          {activeTab === 'museum' && <MuseumDirectoryContent />}
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
    paddingBottom: 16,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cameraEntryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    height: 46,
    marginTop: -4, // Adjust for search bar alignment
  },
  cameraEntryText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '700',
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
