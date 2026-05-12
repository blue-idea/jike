import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, StatusBar, Image,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '@/constants/Colors';
import { FEATURED_SITES } from '@/constants/MockData';
import { SiteListCard } from '@/components/discover/SiteListCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { BrandHeader } from '@/components/ui/BrandHeader';
import {
  Heart,
  Bookmark,
  Map,
  Trash2,
  FolderOpen,
  MessageCircle,
  ChevronRight,
  LoaderCircle,
} from 'lucide-react-native';
import { CollectionMapSection } from '@/components/collection/CollectionMapSection';
import { HeatTrendEntryCard } from '@/components/heatmap/HeatTrendEntryCard';
import {
  addFavorite,
  clearFavorites,
  getFavorites,
  getFavoritesStats,
  removeFavorite,
  type FavoriteItem,
  type FavoriteType,
  type FavoritesStats,
} from '@/lib/favorites/favoritesService';

const TABS = [
  { id: 'favorite' as FavoriteType, label: '收藏', Icon: Heart },
  { id: 'want_to_go' as FavoriteType, label: '想去', Icon: Bookmark },
  { id: 'visited' as FavoriteType, label: '去过', Icon: Map },
];

const EMPTY_STATS: FavoritesStats = {
  favorite_count: 0,
  want_to_go_count: 0,
  visited_count: 0,
  total_interactions: 0,
};

const POI_TYPE_LABEL: Record<FavoriteItem['poi_type'], string> = {
  scenic: '景区',
  heritage: '文保',
  museum: '博物馆',
};

export default function CollectionScreen() {
  const [activeTab, setActiveTab] = useState<FavoriteType>('favorite');
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [stats, setStats] = useState<FavoritesStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(false);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [isMapInteracting, setIsMapInteracting] = useState(false);

  const loadActiveData = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, latestStats] = await Promise.all([
        getFavorites(activeTab, 100),
        getFavoritesStats(),
      ]);
      setItems(rows);
      setStats(latestStats);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useFocusEffect(
    useCallback(() => {
      void loadActiveData();
    }, [loadActiveData]),
  );

  const activeCount = useMemo(() => {
    if (activeTab === 'favorite') return stats.favorite_count;
    if (activeTab === 'want_to_go') return stats.want_to_go_count;
    return stats.visited_count;
  }, [activeTab, stats.favorite_count, stats.visited_count, stats.want_to_go_count]);

  const moveToKind = useCallback(
    async (item: FavoriteItem, nextKind: FavoriteType) => {
      if (item.kind === nextKind) return;
      setMutatingId(item.id);
      try {
        const result = await addFavorite(item.poi_id, item.poi_name, item.poi_type, nextKind);
        if (!result.success) {
          Alert.alert('操作失败', result.error ?? '请稍后重试');
          return;
        }
        await loadActiveData();
      } finally {
        setMutatingId(null);
      }
    },
    [loadActiveData],
  );

  const removeCurrentItem = useCallback(
    async (item: FavoriteItem) => {
      setMutatingId(item.id);
      try {
        const result = await removeFavorite(item.poi_id, item.kind, item.poi_type);
        if (!result.success) {
          Alert.alert('删除失败', result.error ?? '请稍后重试');
          return;
        }
        await loadActiveData();
      } finally {
        setMutatingId(null);
      }
    },
    [loadActiveData],
  );

  const toggleFavoriteForItem = useCallback(
    async (item: FavoriteItem) => {
      if (item.kind === 'favorite') {
        await removeCurrentItem(item);
        return;
      }
      await moveToKind(item, 'favorite');
    },
    [moveToKind, removeCurrentItem],
  );

  const confirmClear = useCallback(() => {
    if (activeCount === 0) return;
    const tabLabel = TABS.find((tab) => tab.id === activeTab)?.label ?? '当前分类';
    Alert.alert('清空确认', `确认清空「${tabLabel}」吗？此操作不可撤销。`, [
      { text: '取消', style: 'cancel' },
      {
        text: '确认清空',
        style: 'destructive',
        onPress: async () => {
          const result = await clearFavorites(activeTab);
          if (!result.success) {
            Alert.alert('清空失败', result.error ?? '请稍后重试');
            return;
          }
          await loadActiveData();
        },
      },
    ]);
  }, [activeCount, activeTab, loadActiveData]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FDF9EF" />
      <BrandHeader />

      <ScrollView
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isMapInteracting}
        disableScrollViewPanResponder={isMapInteracting}
        contentContainerStyle={styles.scrollContent}
      >
        <CollectionMapSection onMapInteractingChange={setIsMapInteracting} />
        <HeatTrendEntryCard />
        <TouchableOpacity
          style={styles.qaEntryCard}
          onPress={() => router.push('/ai-qa-chat')}
          activeOpacity={0.86}
        >
          <View style={styles.qaEntryLeft}>
            <View style={styles.qaEntryIconWrap}>
              <MessageCircle size={16} color={Colors.white} />
            </View>
            <View style={styles.qaEntryCopy}>
              <Text style={styles.qaEntryTitle}>文化知识问答</Text>
              <Text style={styles.qaEntrySubtitle}>离线输入自动保留，恢复网络后重发</Text>
            </View>
          </View>
          <ChevronRight size={18} color={Colors.primary} />
        </TouchableOpacity>
        <View style={styles.tabContainer}>
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
        </View>
        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.loadingText}>正在加载收藏数据...</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <FolderOpen size={40} color={Colors.textLight} />
            </View>
            <Text style={styles.emptyTitle}>暂无内容</Text>
            <Text style={styles.emptyDesc}>在列表或详情里标记后，会同步显示在这里</Text>
          </View>
        ) : (
          <>
            <View style={styles.countRow}>
              <Text style={styles.countText}>共 {activeCount} 处</Text>
              <TouchableOpacity style={styles.clearBtn} onPress={confirmClear}>
                <Trash2 size={14} color={Colors.textMuted} />
                <Text style={styles.clearBtnText}>清空</Text>
              </TouchableOpacity>
            </View>
            {items.map((item) => {
              const isBusy = mutatingId === item.id;
              return (
                <View key={item.id}>
                  <SiteListCard
                    name={item.poi_name}
                    category={item.poi_type}
                    level={item.level_tag ?? ''}
                    province={item.province ?? '未知省份'}
                    city={item.city ?? item.district ?? '未知地区'}
                    dynasty={item.district ?? '文化地标'}
                    type={POI_TYPE_LABEL[item.poi_type]}
                    image={item.image_url ?? FEATURED_SITES[0].image}
                    tags={[item.level_tag, item.province].filter(Boolean) as string[]}
                    isFavorite={item.kind === 'favorite'}
                    onPress={() =>
                      router.push({
                        pathname: '/poi/[id]',
                        params: { id: item.poi_id, type: item.poi_type },
                      })}
                    onFavorite={() => {
                      void toggleFavoriteForItem(item);
                    }}
                  />
                  <View style={styles.itemActionsRow}>
                    <TouchableOpacity
                      style={[styles.itemActionBtn, item.kind === 'favorite' && styles.itemActionBtnActive]}
                      onPress={() => {
                        void toggleFavoriteForItem(item);
                      }}
                      disabled={isBusy}
                    >
                      <Heart size={14} color={item.kind === 'favorite' ? Colors.white : Colors.primary} />
                      <Text style={[styles.itemActionText, item.kind === 'favorite' && styles.itemActionTextActive]}>
                        收藏
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.itemActionBtn, item.kind === 'want_to_go' && styles.itemActionBtnActive]}
                      onPress={() => {
                        void moveToKind(item, 'want_to_go');
                      }}
                      disabled={isBusy}
                    >
                      <Bookmark size={14} color={item.kind === 'want_to_go' ? Colors.white : Colors.primary} />
                      <Text style={[styles.itemActionText, item.kind === 'want_to_go' && styles.itemActionTextActive]}>
                        想去
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.itemActionBtn, item.kind === 'visited' && styles.itemActionBtnActive]}
                      onPress={() => {
                        void moveToKind(item, 'visited');
                      }}
                      disabled={isBusy}
                    >
                      <Map size={14} color={item.kind === 'visited' ? Colors.white : Colors.primary} />
                      <Text style={[styles.itemActionText, item.kind === 'visited' && styles.itemActionTextActive]}>
                        去过
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.itemDeleteBtn}
                      onPress={() => {
                        void removeCurrentItem(item);
                      }}
                      disabled={isBusy}
                    >
                      {isBusy ? (
                        <LoaderCircle size={14} color={Colors.textMuted} />
                      ) : (
                        <Trash2 size={14} color={Colors.textMuted} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
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
                onPress={() => {}}
              >
                <Heart
                  size={14}
                  color={Colors.textLight}
                  fill="transparent"
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
  tabContainer: {
    backgroundColor: Colors.background,
    paddingTop: 8,
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
  qaEntryCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.primary + '33',
    backgroundColor: Colors.card,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  qaEntryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  qaEntryIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  qaEntryCopy: {
    flex: 1,
    gap: 2,
  },
  qaEntryTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  qaEntrySubtitle: {
    color: Colors.textMuted,
    fontSize: 12,
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
  loadingState: {
    paddingVertical: 28,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  itemActionsRow: {
    marginHorizontal: 20,
    marginTop: -4,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary + '33',
    backgroundColor: Colors.card,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  itemActionBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  itemActionText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
  itemActionTextActive: {
    color: Colors.white,
  },
  itemDeleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.backgroundAlt,
    marginLeft: 'auto',
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
