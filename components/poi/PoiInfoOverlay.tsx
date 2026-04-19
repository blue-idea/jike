/**
 * components/poi/PoiInfoOverlay.tsx
 *
 * 地标点选快捷信息浮层（EARS-22）
 * 地图/列表/推荐卡片点选后弹出统一信息层，展示基础信息与距离
 * 接入「导航到」「AI 导游」「查看详情」及可选收藏/加入路线动作
 */
import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  MapPin,
  Navigation,
  Sparkles,
  Bookmark,
  BookmarkCheck,
  Route,
  ChevronRight,
  Star,
} from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { type PoiType } from '@/lib/poi/poiQueries';

export type PoiOverlayAction = 'navigate' | 'ai_guide' | 'detail' | 'favorite' | 'add_to_route';

export interface PoiOverlayData {
  id: string;
  name: string;
  poi_type: PoiType;
  province?: string | null;
  level?: string | null;         // scenic
  heritage_type?: string | null; // heritage
  quality_level?: string | null; // museum
  free_admission?: boolean | null; // museum
  distance_m?: number | null;
  image_url?: string | null;
  recommend?: string | null;
  is_favorited?: boolean;
}

interface PoiInfoOverlayProps {
  poi: PoiOverlayData;
  visible: boolean;
  onAction: (action: PoiOverlayAction) => void;
  onClose: () => void;
}

const POI_TYPE_LABELS: Record<PoiType, string> = {
  scenic: 'A级景区',
  heritage: '全国重点文物保护单位',
  museum: '博物馆',
};

function getTypeColor(poiType: PoiType): string {
  switch (poiType) {
    case 'scenic': return '#C8914A';
    case 'heritage': return '#813520';
    case 'museum': return '#2C4A3E';
  }
}

function formatDistance(meters: number | null): string {
  if (meters === null || meters === undefined) return '';
  if (meters < 1000) return `${Math.round(meters)}米`;
  return `${(meters / 1000).toFixed(1)}公里`;
}

export function PoiInfoOverlay({
  poi,
  visible,
  onAction,
  onClose,
}: PoiInfoOverlayProps) {
  if (!visible) return null;

  const heroImage = poi.image_url
    ? { uri: poi.image_url }
    : require('@/assets/images/placeholder.png');

  const distance = formatDistance(poi.distance_m ?? null);
  const typeColor = getTypeColor(poi.poi_type);

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      {/* 底部弹出卡片 */}
      <View style={styles.card} pointerEvents="auto">
        {/* Hero 图 */}
        <View style={styles.heroWrap}>
          <Image source={heroImage} style={styles.heroImage} resizeMode="cover" />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.6)']}
            style={styles.heroGradient}
          />
          {/* 距离标签 */}
          {distance && (
            <View style={styles.distanceTag}>
              <MapPin size={11} color={Colors.white} />
              <Text style={styles.distanceText}>{distance}</Text>
            </View>
          )}
          {/* 关闭按钮 */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* 基础信息 */}
        <View style={styles.infoSection}>
          <View style={styles.nameRow}>
            <Text style={styles.poiName} numberOfLines={1}>{poi.name}</Text>
            <View style={[styles.typeTag, { backgroundColor: typeColor + '22' }]}>
              <Text style={[styles.typeTagText, { color: typeColor }]}>
                {POI_TYPE_LABELS[poi.poi_type]}
              </Text>
            </View>
          </View>

          {/* 副标题信息 */}
          <View style={styles.metaRow}>
            {poi.poi_type === 'scenic' && poi.level && (
              <Text style={styles.metaText}>{poi.level}</Text>
            )}
            {poi.poi_type === 'heritage' && poi.heritage_type && (
              <Text style={styles.metaText}>{poi.heritage_type}</Text>
            )}
            {poi.poi_type === 'museum' && poi.quality_level && (
              <Text style={styles.metaText}>{poi.quality_level}</Text>
            )}
            {poi.province && (
              <Text style={styles.metaText}>{poi.province}</Text>
            )}
            {poi.poi_type === 'museum' && poi.free_admission !== null && (
              <Text style={[styles.metaText, { color: poi.free_admission ? '#8A9A7B' : '#C17F5E' }]}>
                {poi.free_admission ? '免费' : '收费'}
              </Text>
            )}
          </View>

          {/* 推荐语 */}
          {poi.recommend && (
            <View style={styles.recommendBox}>
              <Star size={12} color={Colors.accent} />
              <Text style={styles.recommendText} numberOfLines={2}>
                {poi.recommend}
              </Text>
            </View>
          )}

          {/* 动作按钮行 */}
          <View style={styles.actionRow}>
            {/* 导航 */}
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnPrimary]}
              onPress={() => onAction('navigate')}
              activeOpacity={0.8}
            >
              <Navigation size={16} color={Colors.white} />
              <Text style={styles.actionBtnPrimaryText}>导航到</Text>
            </TouchableOpacity>

            {/* AI 导游 */}
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => onAction('ai_guide')}
              activeOpacity={0.8}
            >
              <Sparkles size={16} color={Colors.primary} />
              <Text style={styles.actionBtnText}>AI 导游</Text>
            </TouchableOpacity>

            {/* 收藏 */}
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => onAction('favorite')}
              activeOpacity={0.8}
            >
              {poi.is_favorited ? (
                <BookmarkCheck size={16} color={Colors.accent} />
              ) : (
                <Bookmark size={16} color={Colors.textSecondary} />
              )}
              <Text style={[styles.actionBtnText, poi.is_favorited && { color: Colors.accent }]}>
                {poi.is_favorited ? '已收藏' : '收藏'}
              </Text>
            </TouchableOpacity>

            {/* 加入路线 */}
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => onAction('add_to_route')}
              activeOpacity={0.8}
            >
              <Route size={16} color={Colors.textSecondary} />
              <Text style={styles.actionBtnText}>加路线</Text>
            </TouchableOpacity>
          </View>

          {/* 查看详情 */}
          <TouchableOpacity
            style={styles.detailBtn}
            onPress={() => onAction('detail')}
            activeOpacity={0.8}
          >
            <Text style={styles.detailBtnText}>查看详情</Text>
            <ChevronRight size={16} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    paddingBottom: 34,
  },
  heroWrap: {
    width: '100%',
    height: 140,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E8DFD0',
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  distanceTag: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  distanceText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  infoSection: {
    padding: 16,
    gap: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  poiName: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  typeTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  typeTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metaText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  recommendBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#F7F3EC',
    padding: 10,
    borderRadius: 10,
  },
  recommendText: {
    flex: 1,
    fontSize: 12,
    color: Colors.text,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: Colors.cardMuted,
    minWidth: 0,
  },
  actionBtnPrimary: {
    backgroundColor: Colors.primary,
  },
  actionBtnPrimaryText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  detailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.primary + '12',
    marginTop: 4,
  },
  detailBtnText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});
