import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView,
  TouchableOpacity, StatusBar, Image,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { FEATURED_SITES } from '@/constants/MockData';
import { SiteListCard } from '@/components/discover/SiteListCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Heart, Bookmark, Map, Trash2, FolderOpen } from 'lucide-react-native';

const TABS = [
  { id: 'favorites', label: '收藏', Icon: Heart },
  { id: 'bookmarks', label: '想去', Icon: Bookmark },
  { id: 'visited', label: '去过', Icon: Map },
];

const COLLECTION_ITEMS = FEATURED_SITES.slice(0, 3);

export default function CollectionScreen() {
  const [activeTab, setActiveTab] = useState('favorites');
  const [favorites, setFavorites] = useState<Set<string>>(new Set(['fs1', 'fs2', 'fs3']));

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const items = COLLECTION_ITEMS.filter((s) => {
    if (activeTab === 'favorites') return favorites.has(s.id);
    if (activeTab === 'visited') return s.isStamped;
    return !s.isStamped && !favorites.has(s.id);
  });

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.title}>我的收藏</Text>
        </View>

        <View style={styles.tabBar}>
          {TABS.map(({ id, label, Icon }) => (
            <TouchableOpacity
              key={id}
              style={[styles.tab, activeTab === id && styles.tabActive]}
              onPress={() => setActiveTab(id)}
            >
              <Icon
                size={15}
                color={activeTab === id ? Colors.primary : Colors.textMuted}
                strokeWidth={activeTab === id ? 2.5 : 1.8}
              />
              <Text style={[styles.tabLabel, activeTab === id && styles.tabLabelActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <FolderOpen size={40} color={Colors.textLight} />
            </View>
            <Text style={styles.emptyTitle}>暂无内容</Text>
            <Text style={styles.emptyDesc}>探索发现页面，收藏你感兴趣的文化地标</Text>
          </View>
        ) : (
          <>
            <View style={styles.countRow}>
              <Text style={styles.countText}>共 {items.length} 处</Text>
              <TouchableOpacity style={styles.clearBtn}>
                <Trash2 size={14} color={Colors.textMuted} />
                <Text style={styles.clearBtnText}>清空</Text>
              </TouchableOpacity>
            </View>
            {items.map((site) => (
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
          </>
        )}

        <SectionHeader
          title="推荐收藏"
          subtitle="与你口味相似的文化地标"
          onSeeAll={() => {}}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.recommendRow}
        >
          {FEATURED_SITES.map((site) => (
            <TouchableOpacity key={site.id} style={styles.recommendCard} activeOpacity={0.88}>
              <Image source={{ uri: site.image }} style={styles.recommendImage} resizeMode="cover" />
              <View style={styles.recommendContent}>
                <Text style={styles.recommendName} numberOfLines={1}>{site.name}</Text>
                <Text style={styles.recommendMeta}>{site.dynasty} · {site.type}</Text>
              </View>
              <TouchableOpacity
                style={styles.recommendFavBtn}
                onPress={() => toggleFavorite(site.id)}
              >
                <Heart
                  size={14}
                  color={favorites.has(site.id) ? Colors.seal : Colors.textLight}
                  fill={favorites.has(site.id) ? Colors.seal : 'transparent'}
                />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </ScrollView>

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
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: 0.5,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 4,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  tabActive: {
    backgroundColor: Colors.primary + '14',
    borderColor: Colors.primary + '44',
  },
  tabLabel: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  scrollContent: {
    paddingTop: 12,
    paddingBottom: 20,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  countText: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  clearBtnText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  emptyDesc: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  recommendRow: {
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 4,
  },
  recommendCard: {
    width: 160,
    backgroundColor: Colors.card,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  recommendImage: {
    width: '100%',
    height: 100,
  },
  recommendContent: {
    padding: 10,
    gap: 3,
  },
  recommendName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  recommendMeta: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  recommendFavBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    backgroundColor: Colors.white,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
