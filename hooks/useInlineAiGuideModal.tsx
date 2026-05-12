import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ChevronLeft, X } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { FEATURED_SITES } from '@/constants/MockData';
import { AiGuideNarrativeView } from '@/components/ai/AiGuideNarrativeView';
import { loadAiGuideCache, saveAiGuideCache } from '@/lib/ai/aiGuideCacheStore';
import { buildGuideSpeakableText } from '@/lib/ai/aiGuideSpeakable';
import type { AiGuideResult } from '@/lib/ai/aiGuideQueries';
import type { InlineAiGuideActiveContext, InlineAiGuidePoiInput } from '@/lib/ai/inlineAiGuideTypes';
import { useAiGuide } from '@/hooks/useAiGuide';

export function useInlineAiGuideModal(): {
  inlineAiGuideModal: React.ReactElement;
  triggerInlineAiGuide: (poi: InlineAiGuidePoiInput) => void;
} {
  const router = useRouter();
  const loginAlertShown = useRef(false);
  const [aiGuideModalVisible, setAiGuideModalVisible] = useState(false);
  const [aiGuideCache, setAiGuideCache] = useState<Record<string, AiGuideResult>>({});
  const [aiGuideCacheReady, setAiGuideCacheReady] = useState(false);
  const [activeGuideContext, setActiveGuideContext] = useState<InlineAiGuideActiveContext | null>(
    null,
  );
  const [activeGuideResult, setActiveGuideResult] = useState<AiGuideResult | null>(null);
  const [usingCachedGuide, setUsingCachedGuide] = useState(false);

  const {
    status: aiGuideStatus,
    result: aiGuideResult,
    errorMessage: aiGuideErrorMessage,
    generate: generateAiGuide,
    reset: resetAiGuide,
    needsLogin: aiGuideNeedsLogin,
  } = useAiGuide();

  useEffect(() => {
    let mounted = true;
    const hydrate = async () => {
      const cache = await loadAiGuideCache();
      if (!mounted) return;
      setAiGuideCache(cache);
      setAiGuideCacheReady(true);
    };
    void hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!aiGuideCacheReady) return;
    void saveAiGuideCache(aiGuideCache);
  }, [aiGuideCache, aiGuideCacheReady]);

  useEffect(() => {
    if (!aiGuideNeedsLogin || loginAlertShown.current) return;
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
  }, [aiGuideNeedsLogin, router]);

  useEffect(() => {
    if (aiGuideStatus !== 'success' || !aiGuideResult || !activeGuideContext) return;
    setAiGuideCache((prev) => ({
      ...prev,
      [activeGuideContext.key]: aiGuideResult,
    }));
    setActiveGuideResult(aiGuideResult);
    setUsingCachedGuide(false);
  }, [activeGuideContext, aiGuideResult, aiGuideStatus]);

  const handleCloseAiGuideModal = useCallback(() => {
    setAiGuideModalVisible(false);
    setActiveGuideContext(null);
    setActiveGuideResult(null);
    setUsingCachedGuide(false);
    resetAiGuide();
  }, [resetAiGuide]);

  const handleRetryInlineAiGuide = useCallback(() => {
    if (!activeGuideContext) return;
    setUsingCachedGuide(false);
    setActiveGuideResult(null);
    void generateAiGuide({
      poiId: activeGuideContext.id,
      poiType: activeGuideContext.poiType,
      poiName: activeGuideContext.name,
      locale: 'zh-CN',
    });
  }, [activeGuideContext, generateAiGuide]);

  const triggerInlineAiGuide = useCallback(
    (poi: InlineAiGuidePoiInput) => {
      const run = async () => {
        const key = `${poi.poiType}:${poi.id}`;
        const context: InlineAiGuideActiveContext = {
          key,
          ...poi,
        };

        setActiveGuideContext(context);
        setAiGuideModalVisible(true);

        let currentCache = aiGuideCache;
        if (!aiGuideCacheReady) {
          const hydratedCache = await loadAiGuideCache();
          currentCache = hydratedCache;
          setAiGuideCache(hydratedCache);
          setAiGuideCacheReady(true);
        }

        const cached = currentCache[key];
        if (cached) {
          setUsingCachedGuide(true);
          setActiveGuideResult(cached);
          resetAiGuide();
          return;
        }

        setUsingCachedGuide(false);
        setActiveGuideResult(null);
        resetAiGuide();
        void generateAiGuide({
          poiId: poi.id,
          poiType: poi.poiType,
          poiName: poi.name,
          locale: 'zh-CN',
        });
      };

      void run();
    },
    [aiGuideCache, aiGuideCacheReady, generateAiGuide, resetAiGuide],
  );

  const renderedGuide = activeGuideResult ?? aiGuideResult;

  const inlineAiGuideModal = (
    <Modal
      visible={aiGuideModalVisible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleCloseAiGuideModal}
    >
      <SafeAreaView style={modalStyles.inlineAiWrap}>
        <View style={modalStyles.inlineAiHeader}>
          <View style={modalStyles.inlineAiHeaderSide}>
            <TouchableOpacity
              style={modalStyles.inlineAiHeaderIconBtn}
              onPress={handleCloseAiGuideModal}
              accessibilityRole="button"
              accessibilityLabel="返回"
            >
              <ChevronLeft size={24} color={Colors.text} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>
          <Text style={modalStyles.inlineAiBrandTitle} numberOfLines={1}>
            集刻
          </Text>
          <View style={[modalStyles.inlineAiHeaderSide, modalStyles.inlineAiHeaderSideEnd]}>
            <TouchableOpacity
              style={modalStyles.inlineAiHeaderIconBtn}
              onPress={handleCloseAiGuideModal}
              accessibilityRole="button"
              accessibilityLabel="关闭"
            >
              <X size={22} color={Colors.text} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={modalStyles.inlineAiScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={modalStyles.inlineAiContent}
        >
          {renderedGuide ? (
            <AiGuideNarrativeView
              result={renderedGuide}
              speakableText={buildGuideSpeakableText(renderedGuide)}
              heroImageUri={activeGuideContext?.image ?? FEATURED_SITES[0].image}
              heroTagLeft={activeGuideContext?.heroTagLeft ?? null}
              heroTagRight={activeGuideContext?.heroTagRight ?? null}
              nameSubtitle={activeGuideContext?.nameSubtitle ?? null}
              regionLabel={activeGuideContext?.regionLabel ?? null}
              cacheHint={usingCachedGuide ? 'cached' : null}
              parentContentPaddingH={24}
              parentContentPaddingTop={14}
            />
          ) : (
            <View style={modalStyles.inlineAiHeroBleed}>
              <View style={modalStyles.inlineAiHeroCard}>
                <Image
                  source={{ uri: activeGuideContext?.image || FEATURED_SITES[0].image }}
                  style={modalStyles.inlineAiHeroImage}
                  resizeMode="cover"
                />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.68)']}
                  style={modalStyles.inlineAiHeroMask}
                />
                <View style={modalStyles.inlineAiHeroTextWrap}>
                  <Text style={modalStyles.inlineAiHeroPoiName} numberOfLines={1}>
                    {activeGuideContext?.name || '文化地标'}
                  </Text>
                  <View style={modalStyles.inlineAiHeroMetaRow}>
                    <View style={modalStyles.inlineAiTypePill}>
                      <Text style={modalStyles.inlineAiTypePillText}>
                        {activeGuideContext?.typeLabel || '导览'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          )}

          {aiGuideStatus === 'requesting' && !renderedGuide ? (
            <View style={modalStyles.inlineAiLoadingCard}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={modalStyles.inlineAiLoadingText}>正在生成讲解...</Text>
            </View>
          ) : null}

          {aiGuideErrorMessage && !renderedGuide ? (
            <View style={modalStyles.inlineAiErrorCard}>
              <Text style={modalStyles.inlineAiErrorTitle}>生成失败</Text>
              <Text style={modalStyles.inlineAiErrorText}>{aiGuideErrorMessage}</Text>
              <TouchableOpacity style={modalStyles.inlineAiRetryBtn} onPress={handleRetryInlineAiGuide}>
                <Text style={modalStyles.inlineAiRetryText}>重试</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  return { inlineAiGuideModal, triggerInlineAiGuide };
}

const modalStyles = StyleSheet.create({
  inlineAiWrap: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  inlineAiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  inlineAiHeaderSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 44,
  },
  inlineAiHeaderSideEnd: {
    justifyContent: 'flex-end',
  },
  inlineAiHeaderIconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineAiBrandTitle: {
    flexShrink: 1,
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: 0.5,
  },
  inlineAiScroll: {
    flex: 1,
  },
  inlineAiContent: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    gap: 12,
  },
  inlineAiHeroBleed: {
    marginHorizontal: -24,
    marginTop: -14,
  },
  inlineAiHeroCard: {
    height: 340,
    overflow: 'hidden',
    backgroundColor: Colors.cardMuted,
    position: 'relative',
  },
  inlineAiHeroImage: {
    width: '100%',
    height: '100%',
  },
  inlineAiHeroMask: {
    ...StyleSheet.absoluteFillObject,
  },
  inlineAiHeroTextWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    gap: 8,
  },
  inlineAiHeroPoiName: {
    fontSize: 18,
    color: Colors.white,
    fontWeight: '800',
  },
  inlineAiHeroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineAiTypePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  inlineAiTypePillText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  inlineAiLoadingCard: {
    borderRadius: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
  },
  inlineAiLoadingText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  inlineAiErrorCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D97171',
    backgroundColor: '#FFF3F3',
    padding: 12,
    gap: 8,
  },
  inlineAiErrorTitle: {
    fontSize: 14,
    color: '#A63737',
    fontWeight: '800',
  },
  inlineAiErrorText: {
    fontSize: 13,
    color: '#803434',
    lineHeight: 20,
  },
  inlineAiRetryBtn: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  inlineAiRetryText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
});
