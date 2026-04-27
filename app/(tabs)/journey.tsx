import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView,
  TouchableOpacity, StatusBar, ImageBackground, Modal, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { JOURNEY_TEMPLATES } from '@/constants/MockData';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { BrandHeader } from '@/components/ui/BrandHeader';
import {
  Plus, Route, Clock, MapPin, Sparkles,
  Navigation, Calendar, ChevronRight, Footprints,
} from 'lucide-react-native';
import {
  formatRouteInfo,
  navigateWithGaode,
  optimizeRoute,
  queryGaodeRoute,
  type RouteMode,
  type RoutePoint,
  type RouteResult,
} from '@/lib/route/routeService';
import { RouteWebViewFallback } from '@/components/route/RouteWebViewFallback';

const ACTIVE_JOURNEY = {
  title: '西安三日文化深度游',
  days: 3,
  currentDay: 1,
  stops: [
    { id: '1', name: '秦始皇帝陵博物院', time: '09:00', duration: '3h', type: '陵墓遗址', done: true, lng: 109.2732, lat: 34.3846 },
    { id: '2', name: '陕西历史博物馆', time: '13:30', duration: '2.5h', type: '博物馆', done: true, lng: 108.9542, lat: 34.2224 },
    { id: '3', name: '大雁塔·大唐芙蓉园', time: '16:30', duration: '2h', type: '古建筑', done: false, lng: 108.9669, lat: 34.2189 },
    { id: '4', name: '西安城墙', time: '19:00', duration: '1.5h', type: '古建筑', done: false, lng: 108.9398, lat: 34.2654 },
  ],
};

const MODES = [
  { id: 'all', label: '全部' },
  { id: 'active', label: '进行中' },
  { id: 'planned', label: '已规划' },
  { id: 'done', label: '已完成' },
];

const ROUTE_MODES: { id: RouteMode; label: string }[] = [
  { id: 'walk', label: '步行' },
  { id: 'drive', label: '驾车' },
  { id: 'bus', label: '公交' },
];

export default function JourneyScreen() {
  const [activeMode, setActiveMode] = useState('all');
  const [routeMode, setRouteMode] = useState<RouteMode>('walk');
  const [routePoints, setRoutePoints] = useState(ACTIVE_JOURNEY.stops);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [fallbackVisible, setFallbackVisible] = useState(false);
  const [fallbackDestination, setFallbackDestination] = useState<RoutePoint | null>(null);

  const toRoutePoints = (points = routePoints): RoutePoint[] =>
    points.map((point) => ({
      id: point.id,
      name: point.name,
      lng: point.lng,
      lat: point.lat,
    }));

  const recalculateRoute = async (points = routePoints) => {
    const candidates = toRoutePoints(points);
    if (candidates.length < 2) {
      setRouteError('至少需要两个点位才能规划路线');
      setRouteResult(null);
      return;
    }

    setRouteLoading(true);
    setRouteError(null);
    try {
      let totalDistance = 0;
      let totalDuration = 0;
      const merged: RouteResult['segments'] = [];

      for (let index = 0; index < candidates.length - 1; index += 1) {
        const from = candidates[index];
        const to = candidates[index + 1];
        const segment = await queryGaodeRoute(
          { lng: from.lng, lat: from.lat },
          { lng: to.lng, lat: to.lat },
          routeMode,
        );
        totalDistance += segment.total_distance;
        totalDuration += segment.total_duration;
        merged.push(...segment.segments);
      }

      setRouteResult({
        route_id: `journey-${Date.now()}`,
        total_distance: totalDistance,
        total_duration: totalDuration,
        segments: merged,
      });
    } catch (error) {
      setRouteResult(null);
      setRouteError(error instanceof Error ? error.message : '路线规划失败，请稍后重试');
    } finally {
      setRouteLoading(false);
    }
  };

  const handleOptimize = async () => {
    const candidates = toRoutePoints();
    if (candidates.length < 2) {
      setRouteError('至少需要两个点位才能优化路线');
      return;
    }

    const optimized = optimizeRoute(candidates);
    const filtered: typeof routePoints = [];
    for (const point of optimized) {
      const original = routePoints.find((item) => item.id === point.id);
      if (original) {
        filtered.push(original);
      } else {
        console.warn('[Journey] optimizeRoute returned an unexpected point ID:', point.id, point.name);
      }
    }

    if (filtered.length < 2) {
      setRouteError('优化后路线点位不足，无法重新规划');
      return;
    }

    setRoutePoints(filtered);
    await recalculateRoute(filtered);
  };

  const handleNavigate = async (point: RoutePoint) => {
    const strategy = await navigateWithGaode(point, routeMode);
    if (strategy === 'webview') {
      setFallbackDestination(point);
      setFallbackVisible(true);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FDF9EF" />
      <BrandHeader 
        rightElement={
          <TouchableOpacity style={styles.createBtn} activeOpacity={0.8}>
            <Plus size={16} color={Colors.white} />
            <Text style={styles.createBtnText}>新建</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.activeJourney}>
          <View style={styles.journeyHeader}>
            <View style={styles.activeBadge}>
              <View style={styles.activeDot} />
              <Text style={styles.activeBadgeText}>进行中</Text>
            </View>
            <Text style={styles.journeyTitle}>{ACTIVE_JOURNEY.title}</Text>
            <View style={styles.journeyMeta}>
              <View style={styles.metaItem}>
                <Calendar size={13} color={Colors.textMuted} />
                <Text style={styles.metaText}>第 {ACTIVE_JOURNEY.currentDay} / {ACTIVE_JOURNEY.days} 天</Text>
              </View>
              <View style={styles.metaItem}>
                <Route size={13} color={Colors.textMuted} />
                <Text style={styles.metaText}>{routePoints.length} 处打卡点</Text>
              </View>
            </View>
          </View>

          <View style={styles.timeline}>
            {routePoints.map((stop, index) => (
              <View key={stop.id} style={styles.timelineItem}>
                <View style={styles.timelineLeft}>
                  <View style={[
                    styles.timelineDot,
                    stop.done ? styles.timelineDotDone : styles.timelineDotPending,
                  ]} />
                  {index < routePoints.length - 1 && (
                    <View style={[
                      styles.timelineLine,
                      stop.done && styles.timelineLineDone,
                    ]} />
                  )}
                </View>
                <View style={[styles.stopCard, stop.done && styles.stopCardDone]}>
                  <View style={styles.stopHeader}>
                    <View style={styles.stopInfo}>
                      <Text style={[styles.stopTime, stop.done && styles.stopTimeDone]}>{stop.time}</Text>
                      <Text style={[styles.stopName, stop.done && styles.stopNameDone]}
                        numberOfLines={1}>{stop.name}</Text>
                    </View>
                    <View style={styles.stopRight}>
                      <View style={[styles.typeBadge, { backgroundColor: Colors.accent + '18' }]}>
                        <Text style={[styles.typeText, { color: Colors.accent }]}>{stop.type}</Text>
                      </View>
                      {!stop.done && (
                        <TouchableOpacity
                          style={styles.navBtn}
                          onPress={() => {
                            void handleNavigate({
                              id: stop.id,
                              name: stop.name,
                              lng: stop.lng,
                              lat: stop.lat,
                            });
                          }}
                        >
                          <Navigation size={14} color={Colors.primary} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  <View style={styles.stopFooter}>
                    <Clock size={11} color={stop.done ? Colors.textLight : Colors.textMuted} />
                    <Text style={[styles.duration, stop.done && styles.durationDone]}>预计 {stop.duration}</Text>
                    {stop.done && <Text style={styles.doneLabel}>已完成</Text>}
                  </View>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.routeActionRow}>
            {ROUTE_MODES.map((mode) => (
              <TouchableOpacity
                key={mode.id}
                style={[styles.routeModeBtn, routeMode === mode.id && styles.routeModeBtnActive]}
                onPress={() => {
                  setRouteMode(mode.id);
                  void recalculateRoute();
                }}
              >
                <Text style={[styles.routeModeBtnText, routeMode === mode.id && styles.routeModeBtnTextActive]}>
                  {mode.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.routeActionRow}>
            <TouchableOpacity
              style={styles.routeCalcBtn}
              onPress={() => {
                void recalculateRoute();
              }}
            >
              <Route size={14} color={Colors.primary} />
              <Text style={styles.routeCalcBtnText}>重新算路</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.routeOptimizeBtn}
              onPress={() => {
                void handleOptimize();
              }}
            >
              <Sparkles size={14} color={Colors.white} />
              <Text style={styles.routeOptimizeBtnText}>多点优化</Text>
            </TouchableOpacity>
          </View>
          {routeLoading && (
            <View style={styles.routeSummaryBox}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={styles.routeSummaryText}>正在规划路线...</Text>
            </View>
          )}
          {!routeLoading && routeResult && (
            <View style={styles.routeSummaryBox}>
              <Text style={styles.routeSummaryTitle}>路线概览</Text>
              <Text style={styles.routeSummaryText}>
                总距离 {formatRouteInfo(routeResult).distance} · 预计耗时 {formatRouteInfo(routeResult).duration}
              </Text>
            </View>
          )}
          {!routeLoading && routeError && (
            <View style={styles.routeSummaryBox}>
              <Text style={styles.routeErrorText}>{routeError}</Text>
            </View>
          )}
        </View>


        <View style={styles.modeFilterRow}>
          {MODES.map((mode) => (
            <TouchableOpacity
              key={mode.id}
              style={[styles.modeBtn, activeMode === mode.id && styles.modeBtnActive]}
              onPress={() => setActiveMode(mode.id)}
            >
              <Text style={[styles.modeBtnText, activeMode === mode.id && styles.modeBtnTextActive]}>
                {mode.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <SectionHeader title="路线模板" subtitle="精选主题文化行程" onSeeAll={() => {}} />

        {JOURNEY_TEMPLATES.map((tpl) => (
          <TouchableOpacity key={tpl.id} style={styles.templateCard} activeOpacity={0.88}>
            <ImageBackground
              source={{ uri: tpl.image }}
              style={styles.templateImage}
              imageStyle={styles.templateImageStyle}
              resizeMode="cover"
            >
              <LinearGradient
                colors={['transparent', 'rgba(26,22,3,0.8)']}
                style={styles.templateGradient}
              >
                <View style={styles.templateContent}>
                  <View style={styles.templateTop}>
                    <View style={styles.themePill}>
                      <Text style={styles.themePillText}>{tpl.theme}</Text>
                    </View>
                  </View>
                  <View style={styles.templateBottom}>
                    <Text style={styles.templateTitle}>{tpl.title}</Text>
                    <View style={styles.templateMeta}>
                      <View style={styles.tplMetaItem}>
                        <Calendar size={12} color="rgba(255,255,255,0.7)" />
                        <Text style={styles.tplMetaText}>{tpl.days} 天</Text>
                      </View>
                      <View style={styles.tplMetaItem}>
                        <MapPin size={12} color="rgba(255,255,255,0.7)" />
                        <Text style={styles.tplMetaText}>{tpl.siteCount} 处</Text>
                      </View>
                    </View>
                    <View style={styles.tplTagsRow}>
                      {tpl.tags.map((tag) => (
                        <View key={tag} style={styles.tplTag}>
                          <Text style={styles.tplTagText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                    <TouchableOpacity style={styles.useTemplateBtn}>
                      <Text style={styles.useTemplateBtnText}>使用此模板</Text>
                      <ChevronRight size={14} color={Colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
              </LinearGradient>
            </ImageBackground>
          </TouchableOpacity>
        ))}

        <View style={styles.aiPlanSection}>
          <LinearGradient
            colors={[Colors.primary, Colors.jade]}
            style={styles.aiPlanCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.aiPlanTop}>
              <Sparkles size={22} color={Colors.goldLight} />
              <Text style={styles.aiPlanTitle}>AI智能路线规划</Text>
            </View>
            <Text style={styles.aiPlanDesc}>
              告诉AI你的时间、兴趣和偏好，自动生成专属文化路线
            </Text>
            <View style={styles.aiPlanTags}>
              {['"我喜欢唐代 + 2天 + 不走太累"', '"北京历史一日游"'].map((hint) => (
                <View key={hint} style={styles.aiHintPill}>
                  <Text style={styles.aiHintText}>{hint}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity style={styles.aiPlanBtn}>
              <Footprints size={15} color={Colors.primary} />
              <Text style={styles.aiPlanBtnText}>开始AI规划</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>

      <Modal
        visible={fallbackVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setFallbackVisible(false)}
      >
        <SafeAreaView style={styles.fallbackWrap}>
          <View style={styles.fallbackHeader}>
            <Text style={styles.fallbackTitle}>应用内导航降级</Text>
            <TouchableOpacity onPress={() => setFallbackVisible(false)}>
              <Text style={styles.fallbackCloseText}>关闭</Text>
            </TouchableOpacity>
          </View>
          {fallbackDestination ? (
            <RouteWebViewFallback
              origin={toRoutePoints()[0] ?? fallbackDestination}
              destination={fallbackDestination}
              mode={routeMode}
            />
          ) : null}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
  },
  createBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  activeJourney: {
    margin: 20,
    backgroundColor: Colors.card,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 6,
  },
  journeyHeader: {
    padding: 18,
    backgroundColor: Colors.primaryDark,
    gap: 6,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.jadeLight,
  },
  activeBadgeText: {
    fontSize: 11,
    color: Colors.jadeLight,
    fontWeight: '700',
  },
  journeyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.3,
  },
  journeyMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  timeline: {
    padding: 16,
    paddingTop: 12,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  timelineLeft: {
    alignItems: 'center',
    width: 20,
    marginRight: 10,
    marginTop: 14,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    zIndex: 1,
  },
  timelineDotDone: {
    backgroundColor: Colors.jade,
    borderColor: Colors.jade,
  },
  timelineDotPending: {
    backgroundColor: Colors.white,
    borderColor: Colors.accent,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.borderLight,
    marginTop: 2,
    marginBottom: 2,
  },
  timelineLineDone: {
    backgroundColor: Colors.jade + '66',
  },
  stopCard: {
    flex: 1,
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  stopCardDone: {
    opacity: 0.6,
  },
  stopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  stopInfo: {
    flex: 1,
    gap: 2,
  },
  stopTime: {
    fontSize: 11,
    color: Colors.accent,
    fontWeight: '700',
  },
  stopTimeDone: {
    color: Colors.textMuted,
  },
  stopName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: 0.3,
  },
  stopNameDone: {
    color: Colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  stopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  navBtn: {
    width: 28,
    height: 28,
    backgroundColor: Colors.primary + '18',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
  },
  duration: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  durationDone: {
    color: Colors.textLight,
  },
  doneLabel: {
    fontSize: 11,
    color: Colors.jade,
    fontWeight: '600',
    marginLeft: 4,
  },
  routeActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  routeModeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.cardMuted,
  },
  routeModeBtnActive: {
    backgroundColor: Colors.primary,
  },
  routeModeBtnText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  routeModeBtnTextActive: {
    color: Colors.white,
  },
  routeCalcBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: Colors.primary + '14',
  },
  routeCalcBtnText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '700',
  },
  routeOptimizeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: Colors.accent,
  },
  routeOptimizeBtnText: {
    fontSize: 12,
    color: Colors.white,
    fontWeight: '700',
  },
  routeSummaryBox: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.backgroundAlt,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  routeSummaryTitle: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '700',
  },
  routeSummaryText: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  routeErrorText: {
    fontSize: 12,
    color: '#B5352A',
    lineHeight: 18,
  },
  fallbackWrap: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  fallbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  fallbackTitle: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '700',
  },
  fallbackCloseText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '700',
  },
  modeFilterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },
  modeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modeBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  modeBtnText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  modeBtnTextActive: {
    color: Colors.white,
    fontWeight: '600',
  },
  templateCard: {
    marginHorizontal: 20,
    marginBottom: 14,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  templateImage: {
    height: 200,
  },
  templateImageStyle: {
    borderRadius: 16,
  },
  templateGradient: {
    flex: 1,
  },
  templateContent: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 16,
  },
  templateTop: {
    alignItems: 'flex-start',
  },
  themePill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  themePillText: {
    fontSize: 11,
    color: Colors.white,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  templateBottom: {
    gap: 6,
  },
  templateTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.5,
  },
  templateMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  tplMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tplMetaText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
  },
  tplTagsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  tplTag: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tplTagText: {
    fontSize: 11,
    color: Colors.white,
    fontWeight: '500',
  },
  useTemplateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.white,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  useTemplateBtnText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '700',
  },
  aiPlanSection: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 10,
  },
  aiPlanCard: {
    borderRadius: 18,
    padding: 20,
    gap: 12,
  },
  aiPlanTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  aiPlanTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.5,
  },
  aiPlanDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
  },
  aiPlanTags: {
    gap: 8,
  },
  aiHintPill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  aiHintText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    fontStyle: 'italic',
  },
  aiPlanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.white,
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    marginTop: 4,
  },
  aiPlanBtnText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '700',
  },
});
