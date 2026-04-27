import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Clock4,
  History,
  Info,
  Landmark,
  ScrollText,
  Sparkles,
  Star,
  UserCircle2,
} from 'lucide-react-native';
import { CommonTopBar } from '@/components/ui/CommonTopBar';
import { TtsControlButton } from '@/components/ai/TtsControlButton';
import { Colors } from '@/constants/Colors';
import { useAiGuide } from '@/hooks/useAiGuide';
import type { PoiType } from '@/lib/ai/aiGuideQueries';

type PoiOption = {
  id: string;
  name: string;
  poiType: PoiType;
  subtitle: string;
};

const PRESET_POIS: PoiOption[] = [
  {
    id: 'heritage_nanchan_temple',
    name: '南禅寺大殿',
    poiType: 'heritage',
    subtitle: '山西 · 唐代木构',
  },
  {
    id: 'museum_shaanxi_history',
    name: '陕西历史博物馆',
    poiType: 'museum',
    subtitle: '陕西 · 国家一级博物馆',
  },
  {
    id: 'scenic_terracotta_army',
    name: '秦始皇帝陵博物院',
    poiType: 'scenic',
    subtitle: '陕西 · 5A 景区',
  },
];

const TYPE_OPTIONS: { type: PoiType; label: string }[] = [
  { type: 'scenic', label: '景区' },
  { type: 'heritage', label: '国保' },
  { type: 'museum', label: '博物馆' },
];

const SECTION_META: Record<
  string,
  { title: string; icon: React.ComponentType<{ size?: number; color?: string }> }
> = {
  background: { title: '历史背景', icon: History },
  cultural: { title: '文化解读', icon: Landmark },
  poetry: { title: '主要看点', icon: ScrollText },
  story: { title: '人物故事', icon: UserCircle2 },
  timeline: { title: '朝代演变', icon: Clock4 },
  attraction: { title: '参观建议', icon: Star },
};

function isPoiType(value: string | undefined): value is PoiType {
  return value === 'scenic' || value === 'heritage' || value === 'museum';
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '刚刚生成';
  return date.toLocaleString('zh-CN', { hour12: false });
}

export default function AiGuideDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    poiId?: string;
    poiType?: string;
    poiName?: string;
  }>();
  const [activeType, setActiveType] = useState<PoiType>(
    isPoiType(params.poiType) ? params.poiType : 'heritage',
  );
  const loginAlertShown = useRef(false);

  const poiOptions = useMemo(() => {
    const options = [...PRESET_POIS];
    const routePoiType = isPoiType(params.poiType) ? params.poiType : null;
    if (
      routePoiType &&
      params.poiId &&
      params.poiName &&
      !options.some((item) => item.id === params.poiId)
    ) {
      options.unshift({
        id: params.poiId,
        name: params.poiName,
        poiType: routePoiType,
        subtitle: '来自当前点位选择',
      });
    }
    return options;
  }, [params.poiId, params.poiName, params.poiType]);

  const visiblePois = useMemo(
    () => poiOptions.filter((item) => item.poiType === activeType),
    [activeType, poiOptions],
  );

  const [selectedPoiId, setSelectedPoiId] = useState<string>(() => {
    if (params.poiId && isPoiType(params.poiType)) return params.poiId;
    const fallback = PRESET_POIS.find((item) => item.poiType === 'heritage');
    return fallback?.id ?? PRESET_POIS[0].id;
  });

  useEffect(() => {
    if (visiblePois.length === 0) return;
    const stillExists = visiblePois.some((item) => item.id === selectedPoiId);
    if (!stillExists) setSelectedPoiId(visiblePois[0].id);
  }, [selectedPoiId, visiblePois]);

  const selectedPoi = useMemo(
    () =>
      poiOptions.find((item) => item.id === selectedPoiId) ??
      visiblePois[0] ??
      poiOptions[0],
    [poiOptions, selectedPoiId, visiblePois],
  );

  const {
    status,
    result,
    errorMessage,
    generate,
    retry,
    reset,
    lastRequest,
    needsLogin,
    speakableText,
  } = useAiGuide();

  useEffect(() => {
    if (!needsLogin || loginAlertShown.current) return;
    loginAlertShown.current = true;
    Alert.alert('请先登录', '使用 AI 导游前需要先登录账号。', [
      {
        text: '去登录',
        onPress: () => {
          loginAlertShown.current = false;
          router.replace('/(auth)/login');
        },
      },
      {
        text: '取消',
        style: 'cancel',
        onPress: () => {
          loginAlertShown.current = false;
        },
      },
    ]);
  }, [needsLogin, router]);

  const handleGenerate = () => {
    if (!selectedPoi) return;
    void generate({
      poiId: selectedPoi.id,
      poiType: selectedPoi.poiType,
      poiName: selectedPoi.name,
      locale: 'zh-CN',
    });
  };

  const handleRetry = () => {
    if (!lastRequest) return;
    void retry();
  };

  return (
    <View style={styles.root}>
      <CommonTopBar
        rightElement={
          <TouchableOpacity style={styles.resetBtn} onPress={reset}>
            <Text style={styles.resetBtnText}>清空</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <Sparkles size={14} color={Colors.white} />
            <Text style={styles.heroBadgeText}>AI 导游</Text>
          </View>
          <Text style={styles.heroTitle}>结构化文化讲解</Text>
          <Text style={styles.heroSubtitle}>
            仅通过 Supabase Edge Functions 生成，支持超时提示、重试与语音播报。
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>选择类别</Text>
          <View style={styles.typeRow}>
            {TYPE_OPTIONS.map((item) => (
              <TouchableOpacity
                key={item.type}
                style={[
                  styles.typeChip,
                  activeType === item.type && styles.typeChipActive,
                ]}
                onPress={() => setActiveType(item.type)}
              >
                <Text
                  style={[
                    styles.typeChipText,
                    activeType === item.type && styles.typeChipTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>选择地标</Text>
          <View style={styles.poiList}>
            {visiblePois.map((poi) => {
              const selected = poi.id === selectedPoiId;
              return (
                <TouchableOpacity
                  key={poi.id}
                  style={[styles.poiCard, selected && styles.poiCardActive]}
                  onPress={() => setSelectedPoiId(poi.id)}
                >
                  <Text
                    style={[styles.poiName, selected && styles.poiNameActive]}
                    numberOfLines={1}
                  >
                    {poi.name}
                  </Text>
                  <Text
                    style={[
                      styles.poiSubtitle,
                      selected && styles.poiSubtitleActive,
                    ]}
                    numberOfLines={1}
                  >
                    {poi.subtitle}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.generateBtn, status === 'requesting' && styles.generateBtnDisabled]}
          disabled={status === 'requesting' || !selectedPoi}
          onPress={handleGenerate}
        >
          {status === 'requesting' ? (
            <View style={styles.generatingRow}>
              <ActivityIndicator color={Colors.white} />
              <Text style={styles.generateBtnText}>正在生成讲解...</Text>
            </View>
          ) : (
            <Text style={styles.generateBtnText}>生成讲解</Text>
          )}
        </TouchableOpacity>

        {lastRequest && status !== 'requesting' ? (
          <TouchableOpacity style={styles.retryGhostBtn} onPress={handleRetry}>
            <Text style={styles.retryGhostBtnText}>重试</Text>
          </TouchableOpacity>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>生成失败</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
              <Text style={styles.retryBtnText}>立即重试</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {result ? (
          <View style={styles.resultCard}>
            <View style={styles.resultHead}>
              <View style={styles.resultHeadText}>
                <Text style={styles.resultTitle}>AI 导游：{result.poi_name}</Text>
                <Text style={styles.generatedAt}>
                  生成时间：{formatDateTime(result.generated_at)}
                </Text>
              </View>
              <TtsControlButton fullText={speakableText} />
            </View>

            {result.sections.map((section, index) => {
              const meta = SECTION_META[section.type] ?? {
                title: section.title,
                icon: Info,
              };
              const Icon = meta.icon;
              return (
                <View key={`${section.type}_${index}`} style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <Icon size={18} color={Colors.primary} />
                    <Text style={styles.sectionCardTitle}>
                      {section.title || meta.title}
                    </Text>
                  </View>
                  <Text style={styles.sectionBody}>{section.content}</Text>
                </View>
              );
            })}

            <View style={styles.disclaimerCard}>
              <Info size={16} color={Colors.textMuted} />
              <Text style={styles.disclaimerText}>{result.disclaimer}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.placeholderCard}>
            <Text style={styles.placeholderTitle}>等待生成讲解</Text>
            <Text style={styles.placeholderText}>
              选择一个地标后点击“生成讲解”，将返回历史背景、文化解读、主要看点、人物故事、朝代演变与参观建议。
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 14,
  },
  resetBtn: {
    backgroundColor: Colors.cardMuted,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  resetBtnText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  heroCard: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  heroBadge: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: Colors.accent,
  },
  heroBadgeText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  heroTitle: {
    color: Colors.white,
    fontSize: 22,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 13,
    lineHeight: 20,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeChip: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.card,
    alignItems: 'center',
    paddingVertical: 10,
  },
  typeChipActive: {
    backgroundColor: Colors.primary + '14',
    borderColor: Colors.primary + '44',
  },
  typeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  typeChipTextActive: {
    color: Colors.primary,
  },
  poiList: {
    gap: 8,
  },
  poiCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.card,
    padding: 12,
    gap: 4,
  },
  poiCardActive: {
    borderColor: Colors.primary + '66',
    backgroundColor: Colors.primary + '10',
  },
  poiName: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '700',
  },
  poiNameActive: {
    color: Colors.primaryDark,
  },
  poiSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  poiSubtitleActive: {
    color: Colors.primary,
  },
  generateBtn: {
    borderRadius: 12,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateBtnDisabled: {
    opacity: 0.75,
  },
  generatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  generateBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
  errorCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D97171',
    backgroundColor: '#FFF3F3',
    padding: 12,
    gap: 8,
  },
  errorTitle: {
    fontSize: 14,
    color: '#A63737',
    fontWeight: '800',
  },
  errorText: {
    fontSize: 13,
    color: '#803434',
    lineHeight: 20,
  },
  retryBtn: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  retryBtnText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  retryGhostBtn: {
    alignSelf: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.primary + '55',
    backgroundColor: Colors.primary + '10',
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  retryGhostBtnText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  resultCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.card,
    padding: 12,
    gap: 10,
  },
  resultHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resultHeadText: {
    flex: 1,
    gap: 3,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  generatedAt: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  sectionCard: {
    borderRadius: 10,
    backgroundColor: Colors.backgroundAlt,
    padding: 10,
    gap: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionCardTitle: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '700',
  },
  sectionBody: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 21,
  },
  disclaimerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.cardMuted,
    padding: 10,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  placeholderCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.card,
    padding: 14,
    gap: 8,
  },
  placeholderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  placeholderText: {
    fontSize: 13,
    lineHeight: 20,
    color: Colors.textMuted,
  },
});
