/**
 * app/poi/[id].tsx
 *
 * POI 详情页（支持 scenic/heritage/museum 三类）
 * EARS-1：展示结构化文化信息与可扩展故事线模块
 * EARS-2：版本更新或下拉刷新时重新拉取最新内容
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, MapPin, Clock, Star } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { queryPoiDetail, queryPoiVersion, type PoiDetail, type PoiType } from '@/lib/poi/poiQueries';

const POI_TYPE_LABELS: Record<PoiType, string> = {
  scenic: 'A级景区',
  heritage: '全国重点文物保护单位',
  museum: '博物馆',
};

function ScenicDetail({ data }: { data: Extract<PoiDetail, { poi_type: 'scenic' }> }) {
  return (
    <View style={styles.section}>
      <View style={styles.tagRow}>
        {data.level && (
          <View style={[styles.tag, { backgroundColor: '#C8914A' + '22' }]}>
            <Text style={[styles.tagText, { color: '#C8914A' }]}>{data.level}</Text>
          </View>
        )}
        <View style={[styles.tag, { backgroundColor: Colors.primary + '22' }]}>
          <Text style={[styles.tagText, { color: Colors.primary }]}>A级景区</Text>
        </View>
      </View>
      {data.province && (
        <View style={styles.infoRow}>
          <MapPin size={14} color={Colors.textMuted} />
          <Text style={styles.infoText}>{data.province}</Text>
        </View>
      )}
      {data.address_code && (
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>行政区划代码：</Text>
          <Text style={styles.infoText}>{data.address_code}</Text>
        </View>
      )}
      {data.recommend && (
        <View style={styles.recommendBox}>
          <Star size={14} color={Colors.accent} />
          <Text style={styles.recommendText}>{data.recommend}</Text>
        </View>
      )}
    </View>
  );
}

function HeritageDetail({ data }: { data: Extract<PoiDetail, { poi_type: 'heritage' }> }) {
  return (
    <View style={styles.section}>
      <View style={styles.tagRow}>
        {data.batch && (
          <View style={[styles.tag, { backgroundColor: '#813520' + '22' }]}>
            <Text style={[styles.tagText, { color: '#813520' }]}>{data.batch}</Text>
          </View>
        )}
        {data.heritage_type && (
          <View style={[styles.tag, { backgroundColor: Colors.primary + '22' }]}>
            <Text style={[styles.tagText, { color: Colors.primary }]}>{data.heritage_type}</Text>
          </View>
        )}
      </View>
      {[data.province, data.city, data.district].filter(Boolean).length > 0 && (
        <View style={styles.infoRow}>
          <MapPin size={14} color={Colors.textMuted} />
          <Text style={styles.infoText}>
            {[data.province, data.city, data.district].filter(Boolean).join(' · ')}
          </Text>
        </View>
      )}
      {data.address && (
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>地址：</Text>
          <Text style={styles.infoText}>{data.address}</Text>
        </View>
      )}
      {data.era && (
        <View style={styles.infoRow}>
          <Clock size={14} color={Colors.textMuted} />
          <Text style={styles.infoText}>{data.era}</Text>
        </View>
      )}
      {data.dynasty_tag && data.dynasty_tag.length > 0 && (
        <View style={styles.tagRow}>
          {data.dynasty_tag.map((tag) => (
            <View key={tag} style={[styles.tag, { backgroundColor: '#8A9A7B22' }]}>
              <Text style={[styles.tagText, { color: '#8A9A7B' }]}>{tag}</Text>
            </View>
          ))}
        </View>
      )}
      {data.category_tag && data.category_tag.length > 0 && (
        <View style={styles.tagRow}>
          {data.category_tag.map((tag) => (
            <View key={tag} style={[styles.tag, { backgroundColor: Colors.primary + '22' }]}>
              <Text style={[styles.tagText, { color: Colors.primary }]}>{tag}</Text>
            </View>
          ))}
        </View>
      )}
      {data.recommend && (
        <View style={styles.recommendBox}>
          <Star size={14} color={Colors.accent} />
          <Text style={styles.recommendText}>{data.recommend}</Text>
        </View>
      )}
      {data.remark && (
        <View style={styles.remarkBox}>
          <Text style={styles.remarkLabel}>备注</Text>
          <Text style={styles.remarkText}>{data.remark}</Text>
        </View>
      )}
    </View>
  );
}

function MuseumDetail({ data }: { data: Extract<PoiDetail, { poi_type: 'museum' }> }) {
  return (
    <View style={styles.section}>
      <View style={styles.tagRow}>
        {data.quality_level && (
          <View style={[styles.tag, { backgroundColor: '#2C4A3E' + '22' }]}>
            <Text style={[styles.tagText, { color: '#2C4A3E' }]}>{data.quality_level}</Text>
          </View>
        )}
        {data.free_admission !== null && (
          <View style={[styles.tag, { backgroundColor: data.free_admission ? '#8A9A7B22' : '#C17F5E22' }]}>
            <Text style={[styles.tagText, { color: data.free_admission ? '#8A9A7B' : '#C17F5E' }]}>
              {data.free_admission ? '免费开放' : '收费'}
            </Text>
          </View>
        )}
      </View>
      {data.province && (
        <View style={styles.infoRow}>
          <MapPin size={14} color={Colors.textMuted} />
          <Text style={styles.infoText}>{data.province}</Text>
        </View>
      )}
      {data.museum_nature && (
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>性质：</Text>
          <Text style={styles.infoText}>{data.museum_nature}</Text>
        </View>
      )}
      {data.recommend && (
        <View style={styles.recommendBox}>
          <Star size={14} color={Colors.accent} />
          <Text style={styles.recommendText}>{data.recommend}</Text>
        </View>
      )}
    </View>
  );
}

export default function PoiDetailScreen() {
  const { id, type } = useLocalSearchParams<{ id: string; type: PoiType }>();
  const router = useRouter();
  const [detail, setDetail] = useState<PoiDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedVersion, setCachedVersion] = useState<number | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!id || !type) return;
      if (!isRefresh) setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        // EARS-2: 检查版本决定是否需要重新拉取
        const currentVersion = await queryPoiVersion(id, type);
        if (currentVersion !== null && currentVersion === cachedVersion && !isRefresh) {
          // 版本未变且非刷新，使用缓存（已加载则跳过）
          if (detail) return;
        }
        const data = await queryPoiDetail(id, type);
        if (!data) {
          setError('未找到该 POI 信息');
        } else {
          setDetail(data);
          setCachedVersion((data as { data_version?: number }).data_version ?? null);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : '加载失败');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id, type, cachedVersion, detail],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const onRefresh = useCallback(async () => {
    await load(true);
  }, [load]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  if (error || !detail) {
    return (
      <View style={styles.errorWrap}>
        <Text style={styles.errorText}>{error ?? '加载失败'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => load(false)}>
          <Text style={styles.retryText}>重试</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const heroImage = detail.images?.[0]
    ? { uri: detail.images[0] }
    : require('@/assets/images/placeholder.png');

  return (
    <View style={styles.wrap}>
      {/* 顶部导航 */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>{detail.name}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Hero 图 */}
        <Image
          source={heroImage}
          style={styles.heroImage}
          resizeMode="cover"
        />

        {/* 基础信息 */}
        <View style={styles.baseInfo}>
          <Text style={styles.poiName}>{detail.name}</Text>
          <View style={styles.typeTag}>
            <Text style={styles.typeTagText}>{POI_TYPE_LABELS[detail.poi_type]}</Text>
          </View>
        </View>

        {/* 类型特有详情 */}
        {detail.poi_type === 'scenic' && <ScenicDetail data={detail as Extract<PoiDetail, { poi_type: 'scenic' }>} />}
        {detail.poi_type === 'heritage' && <HeritageDetail data={detail as Extract<PoiDetail, { poi_type: 'heritage' }>} />}
        {detail.poi_type === 'museum' && <MuseumDetail data={detail as Extract<PoiDetail, { poi_type: 'museum' }>} />}

        {/* 版本信息（调试/运营用） */}
        {detail.source_batch && (
          <View style={styles.metaSection}>
            <Text style={styles.metaText}>数据批次：{detail.source_batch}</Text>
            {detail.data_version && <Text style={styles.metaText}>版本：v{detail.data_version}</Text>}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.background },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 12,
    backgroundColor: Colors.background,
  },
  backBtn: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  navTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  scroll: { flex: 1 },
  heroImage: { width: '100%', height: 260, backgroundColor: '#E8DFD0' },
  baseInfo: {
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  poiName: { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 10 },
  typeTag: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary + '18',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeTagText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  section: { padding: 20, gap: 12 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  tagText: { fontSize: 12, fontWeight: '700' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoLabel: { fontSize: 13, color: Colors.textMuted },
  infoText: { fontSize: 13, color: Colors.text },
  recommendBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F7F3EC',
    padding: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  recommendText: { flex: 1, fontSize: 13, color: Colors.text, lineHeight: 20 },
  remarkBox: {
    backgroundColor: '#F7F3EC',
    padding: 12,
    borderRadius: 12,
  },
  remarkLabel: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, marginBottom: 6 },
  remarkText: { fontSize: 13, color: Colors.text, lineHeight: 20 },
  metaSection: {
    padding: 16,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  metaText: { fontSize: 11, color: Colors.textMuted },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  loadingText: { marginTop: 12, fontSize: 14, color: Colors.textMuted },
  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: Colors.background },
  errorText: { fontSize: 14, color: Colors.textMuted, marginBottom: 20 },
  retryBtn: { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
