/**
 * AI 导游讲解正文：头图 banner（左下角：地域 + 点名 + 副标题 + 标签）+ 图下「AI 讲解员」胶囊 + 正文分段
 */
import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, History, Info, Megaphone } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { TtsControlButton } from '@/components/ai/TtsControlButton';
import type { AiGuideResult, GuideSection } from '@/lib/ai/aiGuideQueries';

const PAGE = {
  /** 头图下方正文的额外左右内边距（与外层 ScrollView 边距叠加） */
  contentInsetH: 10,
  heroH: 340,
  radiusM: 10,
};

const SECTION_ICONS: Record<
  string,
  React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>
> = {
  background: History,
  cultural: Megaphone,
  poetry: Info,
  story: Info,
  timeline: Info,
  attraction: Info,
};

function formatGeneratedShort(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function splitIntroFromFirstSection(sections: GuideSection[]): {
  introLead: string | null;
  introRest: string | null;
  firstSectionBodyOverride: string | null;
} {
  const first = sections[0];
  if (!first?.content?.trim()) {
    return { introLead: null, introRest: null, firstSectionBodyOverride: null };
  }
  const blocks = first.content
    .split(/\n\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (blocks.length >= 3) {
    const restInCard = blocks.slice(2).join('\n\n').trim();
    return {
      introLead: blocks[0] ?? null,
      introRest: blocks[1] ?? null,
      firstSectionBodyOverride: restInCard.length > 0 ? restInCard : null,
    };
  }
  const t = blocks[0] ?? '';
  const idx = t.indexOf('。');
  if (idx > 0 && idx < t.length - 1) {
    return {
      introLead: t.slice(0, idx + 1).trim(),
      introRest: t.slice(idx + 1).trim() || null,
      firstSectionBodyOverride: null,
    };
  }
  return { introLead: null, introRest: null, firstSectionBodyOverride: null };
}

export type AiGuideNarrativeViewProps = {
  result: AiGuideResult;
  speakableText: string;
  heroImageUri: string | null;
  /** 头图左上/左 pill，如「唐代 · 建筑」或类型说明 */
  heroTagLeft?: string | null;
  /** 头图右 pill，如「文化遗产」 */
  heroTagRight?: string | null;
  /** 地域或补充说明（可选，显示在标签行上方小字） */
  regionLabel?: string | null;
  /** 中文名下方英文副标题（头图左下角叠层内） */
  nameSubtitle?: string | null;
  cacheHint?: 'cached' | 'fresh' | null;
  /**
   * 与外层 ScrollView `paddingHorizontal` 一致时，头图左右铺满内容区（抵消内边距），
   * 正文与其它块仍沿用外层边距。
   */
  parentContentPaddingH?: number;
  /**
   * 与外层 ScrollView 内容区顶部内边距一致时，头图上沿贴齐（抵消 paddingTop / paddingVertical 上侧）。
   */
  parentContentPaddingTop?: number;
};

export function AiGuideNarrativeView({
  result,
  speakableText,
  heroImageUri,
  heroTagLeft,
  heroTagRight,
  regionLabel,
  nameSubtitle,
  cacheHint,
  parentContentPaddingH,
  parentContentPaddingTop,
}: AiGuideNarrativeViewProps) {
  const generatedShort = formatGeneratedShort(result.generated_at);

  const { introLead, introRest, firstSectionBodyOverride } = useMemo(
    () => splitIntroFromFirstSection(result.sections),
    [result.sections],
  );

  const showTags = Boolean(heroTagLeft?.trim()) || Boolean(heroTagRight?.trim());

  const heroBleedStyle =
    (parentContentPaddingH != null && parentContentPaddingH > 0) ||
    (parentContentPaddingTop != null && parentContentPaddingTop > 0)
      ? {
          ...(parentContentPaddingH != null && parentContentPaddingH > 0
            ? { marginHorizontal: -parentContentPaddingH }
            : {}),
          ...(parentContentPaddingTop != null && parentContentPaddingTop > 0
            ? { marginTop: -parentContentPaddingTop }
            : {}),
        }
      : undefined;

  return (
    <View style={styles.wrap}>
      <View style={styles.heroColumn}>
        <View style={heroBleedStyle}>
          <View style={styles.hero}>
            {heroImageUri ? (
              <Image source={{ uri: heroImageUri }} style={styles.heroImage} resizeMode="cover" />
            ) : (
              <LinearGradient
                colors={['#C5D9D0', '#E8EEE9', Colors.backgroundAlt]}
                style={styles.heroImage}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.5, y: 1 }}
              />
            )}
            <LinearGradient
              colors={['rgba(255,255,255,0)', 'rgba(247,243,236,0.55)', 'rgba(250,247,242,0.94)']}
              locations={[0, 0.45, 1]}
              style={styles.heroLightFade}
            />

            <View style={styles.heroBannerInner}>
              {regionLabel ? (
                <Text style={styles.heroRegionAbove} numberOfLines={1}>
                  {regionLabel}
                </Text>
              ) : null}
              <Text style={styles.bannerPoiCn} numberOfLines={2}>
                {result.poi_name}
              </Text>
              {nameSubtitle?.trim() ? (
                <Text style={styles.bannerPoiEn} numberOfLines={2}>
                  {nameSubtitle.trim()}
                </Text>
              ) : null}
              {showTags ? (
                <View style={styles.heroTagRow}>
                  {heroTagLeft?.trim() ? (
                    <View style={styles.heroTagMuted}>
                      <Text style={styles.heroTagMutedText} numberOfLines={1}>
                        {heroTagLeft.trim()}
                      </Text>
                    </View>
                  ) : null}
                  {heroTagRight?.trim() ? (
                    <View style={styles.heroTagAccent}>
                      <Text style={styles.heroTagAccentText} numberOfLines={1}>
                        {heroTagRight.trim()}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.aiHostBelow}>
          <View style={styles.aiHostPill}>
            <View style={styles.aiHostIconWrap}>
              <TtsControlButton variant="banner" fullText={speakableText} size={18} />
            </View>
            <View style={styles.aiHostTextCol}>
              <Text style={styles.aiHostTitle} numberOfLines={1}>
                AI 讲解员
              </Text>
              <Text style={styles.aiHostSub} numberOfLines={2}>
                点击开启深度人文导览
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.belowHero}>
        <View style={styles.titleBlock}>
          {cacheHint ? (
            <View style={styles.cacheRow}>
              <View
                style={[
                  styles.cachePill,
                  cacheHint === 'cached' ? styles.cachePillCached : styles.cachePillFresh,
                ]}
              >
                <Text
                  style={[
                    styles.cachePillText,
                    cacheHint === 'cached' ? styles.cachePillTextCached : styles.cachePillTextFresh,
                  ]}
                >
                  {cacheHint === 'cached' ? '缓存结果' : '实时生成'}
                </Text>
              </View>
            </View>
          ) : null}
          {generatedShort ? (
            <Text style={styles.generatedAt}>生成于 {generatedShort}</Text>
          ) : null}
        </View>

        {introLead ? (
          <View style={styles.intro}>
            <Text style={styles.introLead}>{introLead}</Text>
            {introRest ? <Text style={styles.introRest}>{introRest}</Text> : null}
          </View>
        ) : null}

        <View style={styles.sections}>
          {result.sections.map((section, index) => {
            const Icon = SECTION_ICONS[section.type] ?? Info;
            const isCultural = section.type === 'cultural';
            const isBackground = section.type === 'background';
            const body =
              index === 0 && firstSectionBodyOverride !== null
                ? firstSectionBodyOverride
                : section.content;

            return (
              <View
                key={`${section.type}_${index}`}
                style={[
                  styles.sectionCard,
                  isCultural && styles.sectionCardCultural,
                  isBackground && styles.sectionCardWarm,
                  !isCultural && !isBackground && styles.sectionCardNeutral,
                ]}
              >
                <View style={styles.sectionHead}>
                  <Icon
                    size={15}
                    color={isCultural ? Colors.white : Colors.accentDark}
                    strokeWidth={2}
                  />
                  <Text
                    style={[styles.sectionTitle, isCultural && styles.sectionTitleOnDark]}
                    numberOfLines={2}
                  >
                    {section.title}
                  </Text>
                </View>
                <Text style={[styles.sectionBody, isCultural && styles.sectionBodyOnDark]}>
                  {body}
                </Text>
                {isCultural ? (
                  <View style={styles.culturalFooter}>
                    <Text style={styles.culturalFooterLabel}>文化符号与空间叙事</Text>
                    <ChevronRight size={14} color="rgba(255,255,255,0.75)" />
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>{result.disclaimer}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
    paddingBottom: 8,
  },
  heroColumn: {
    width: '100%',
    gap: 10,
  },
  hero: {
    height: PAGE.heroH,
    overflow: 'hidden',
    backgroundColor: Colors.cardMuted,
    position: 'relative',
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroLightFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '58%',
  },
  heroBannerInner: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    maxWidth: '92%',
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 14,
    alignItems: 'flex-start',
    gap: 6,
  },
  heroRegionAbove: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'left',
    alignSelf: 'stretch',
  },
  heroTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 8,
  },
  heroTagMuted: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(26,22,3,0.1)',
    maxWidth: '100%',
  },
  heroTagMutedText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  heroTagAccent: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(181, 53, 42, 0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(181, 53, 42, 0.22)',
    maxWidth: '100%',
  },
  heroTagAccentText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.seal,
  },
  bannerPoiCn: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.primaryDark,
    textAlign: 'left',
    alignSelf: 'stretch',
    letterSpacing: 0.3,
    lineHeight: 30,
    textShadowColor: 'rgba(255,255,255,0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  bannerPoiEn: {
    marginTop: -2,
    fontSize: 13,
    fontStyle: 'italic',
    fontWeight: '500',
    color: Colors.textSecondary,
    textAlign: 'left',
    alignSelf: 'stretch',
    lineHeight: 18,
  },
  aiHostBelow: {
    width: '100%',
    alignItems: 'flex-start',
  },
  aiHostPill: {
    width: '50%',
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderLight,
  },
  aiHostIconWrap: {
    transform: [{ scale: 0.88 }],
  },
  aiHostTextCol: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    gap: 2,
    justifyContent: 'center',
  },
  aiHostTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  aiHostSub: {
    fontSize: 10,
    color: Colors.textMuted,
    lineHeight: 14,
  },
  belowHero: {
    paddingHorizontal: PAGE.contentInsetH,
    gap: 12,
  },
  titleBlock: {
    gap: 5,
  },
  cacheRow: {
    flexDirection: 'row',
  },
  cachePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cachePillFresh: {
    backgroundColor: Colors.primary + '10',
    borderColor: Colors.primary + '30',
  },
  cachePillCached: {
    backgroundColor: Colors.accentLight + '33',
    borderColor: Colors.accent + '44',
  },
  cachePillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cachePillTextFresh: {
    color: Colors.primary,
  },
  cachePillTextCached: {
    color: Colors.accentDark,
  },
  generatedAt: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  intro: {
    marginTop: 2,
    paddingLeft: 11,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primaryDark,
    gap: 6,
  },
  introLead: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    lineHeight: 21,
  },
  introRest: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  sections: {
    gap: 11,
    marginTop: 0,
  },
  sectionCard: {
    borderRadius: PAGE.radiusM,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 7,
  },
  sectionCardWarm: {
    backgroundColor: '#EFE8DC',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(200,145,74,0.22)',
  },
  sectionCardCultural: {
    backgroundColor: Colors.primaryDark,
    borderWidth: 0,
  },
  sectionCardNeutral: {
    backgroundColor: Colors.cardMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderLight,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primaryDark,
    lineHeight: 19,
  },
  sectionTitleOnDark: {
    color: Colors.white,
  },
  sectionBody: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  sectionBodyOnDark: {
    color: 'rgba(255,255,255,0.9)',
  },
  culturalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  culturalFooterLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.72)',
    letterSpacing: 0.5,
  },
  disclaimer: {
    marginTop: 4,
    paddingVertical: 10,
    paddingHorizontal: 11,
    borderRadius: PAGE.radiusM,
    backgroundColor: Colors.cardMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderLight,
  },
  disclaimerText: {
    fontSize: 11,
    color: Colors.textMuted,
    lineHeight: 17,
  },
});
