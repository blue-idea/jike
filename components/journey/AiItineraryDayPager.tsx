import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Check, Clock3, Navigation, Trash2 } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import type { AiItineraryResult, ItineraryCandidatePoi, ItineraryStop } from '@/lib/ai/aiItineraryQueries';

interface AiItineraryDayPagerProps {
  result: AiItineraryResult;
  candidateByDay: ItineraryCandidatePoi[][];
  onAddStop: (dayIndex: number, stop: ItineraryStop) => void;
  onRemoveStop: (dayIndex: number, poiId: string) => void;
  buildStopFromCandidate: (candidate: ItineraryCandidatePoi) => ItineraryStop;
}

type StopStatus = 'completed' | 'current' | 'pending';

const POI_TYPE_LABELS: Record<ItineraryStop['poi_type'], string> = {
  scenic: '景区',
  heritage: '古建',
  museum: '博物馆',
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getCurrentStopIndex(stopsCount: number): number {
  if (stopsCount <= 0) return -1;
  if (stopsCount === 1) return 0;
  return Math.min(2, stopsCount - 1);
}

function getStopStatus(stopIndex: number, currentIndex: number): StopStatus {
  if (stopIndex < currentIndex) return 'completed';
  if (stopIndex === currentIndex) return 'current';
  return 'pending';
}

function getStopStatusLabel(status: StopStatus): string {
  if (status === 'completed') return '已完成';
  if (status === 'current') return '进行中';
  return '待前往';
}

export function AiItineraryDayPager({
  result,
  candidateByDay,
  onAddStop,
  onRemoveStop,
  buildStopFromCandidate,
}: AiItineraryDayPagerProps) {
  const pagerRef = useRef<ScrollView>(null);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [pageWidth, setPageWidth] = useState(0);

  const safeDayIndex = clamp(activeDayIndex, 0, Math.max(result.days.length - 1, 0));
  const activeDay = result.days[safeDayIndex];
  const activeStopCount = activeDay?.stops.length ?? 0;

  useEffect(() => {
    if (result.days.length <= 0) {
      setActiveDayIndex(0);
      return;
    }
    setActiveDayIndex((prev) => clamp(prev, 0, result.days.length - 1));
  }, [result.days.length]);

  const dayMetaText = useMemo(() => {
    if (!activeDay) return '';
    return `第 ${activeDay.day}/${result.days.length} 天  •  ${activeStopCount} 处打卡点`;
  }, [activeDay, activeStopCount, result.days.length]);

  const handlePageLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.floor(event.nativeEvent.layout.width);
    if (nextWidth > 0 && nextWidth !== pageWidth) {
      setPageWidth(nextWidth);
    }
  };

  const jumpToDay = (dayIndex: number) => {
    if (result.days.length <= 0) return;
    const safeIndex = clamp(dayIndex, 0, result.days.length - 1);
    setActiveDayIndex(safeIndex);
    if (pageWidth > 0) {
      pagerRef.current?.scrollTo({ x: safeIndex * pageWidth, y: 0, animated: true });
    }
  };

  const handleMomentumEnd = (offsetX: number) => {
    if (pageWidth <= 0) return;
    const pageIndex = clamp(Math.round(offsetX / pageWidth), 0, Math.max(result.days.length - 1, 0));
    setActiveDayIndex((prev) => (prev === pageIndex ? prev : pageIndex));
  };

  const handleScroll = (offsetX: number) => {
    if (pageWidth <= 0) return;
    const pageIndex = clamp(Math.round(offsetX / pageWidth), 0, Math.max(result.days.length - 1, 0));
    setActiveDayIndex((prev) => (prev === pageIndex ? prev : pageIndex));
  };

  return (
    <View style={styles.container}>
      <View style={styles.headCard}>
        <View style={styles.statusPill}>
          <View style={styles.statusDot} />
          <Text style={styles.statusPillText}>进行中</Text>
        </View>
        <Text style={styles.titleText}>{result.title}</Text>
        <Text style={styles.metaText}>{dayMetaText}</Text>
      </View>

      <View style={styles.bodyCard} onLayout={handlePageLayout}>
        <ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={(event) => handleScroll(event.nativeEvent.contentOffset.x)}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(event) => handleMomentumEnd(event.nativeEvent.contentOffset.x)}
        >
          {result.days.map((day, dayIndex) => {
            const currentIndex = getCurrentStopIndex(day.stops.length);
            return (
              <View
                key={`itinerary_day_${day.day}`}
                style={[styles.dayPage, pageWidth > 0 ? { width: pageWidth } : styles.dayPageFallback]}
              >
                {day.stops.map((stop, stopIndex) => {
                  const status = getStopStatus(stopIndex, currentIndex);
                  return (
                    <View key={`${day.day}_${stop.poi_id}`} style={styles.stopRow}>
                      <View style={styles.timelineColumn}>
                        <View
                          style={[
                            styles.timelineDot,
                            status === 'completed'
                              ? styles.timelineDotCompleted
                              : status === 'current'
                                ? styles.timelineDotCurrent
                                : styles.timelineDotPending,
                          ]}
                        />
                        {stopIndex < day.stops.length - 1 ? (
                          <View
                            style={[
                              styles.timelineLine,
                              status === 'completed' ? styles.timelineLineCompleted : undefined,
                            ]}
                          />
                        ) : null}
                      </View>

                      <View
                        style={[
                          styles.stopCard,
                          status === 'current'
                            ? styles.stopCardCurrent
                            : status === 'completed'
                              ? styles.stopCardCompleted
                              : styles.stopCardPending,
                        ]}
                      >
                        <View style={styles.stopTopRow}>
                          <Text
                            style={[
                              styles.timeText,
                              status !== 'completed' ? styles.timeTextActive : undefined,
                            ]}
                          >
                            {stop.arrival_time}
                          </Text>
                          <View style={styles.topRightWrap}>
                            <Text style={styles.poiTag}>{POI_TYPE_LABELS[stop.poi_type]}</Text>
                            <TouchableOpacity
                              style={styles.removeBtn}
                              onPress={() => onRemoveStop(dayIndex, stop.poi_id)}
                            >
                              <Trash2 size={12} color="#A04636" />
                            </TouchableOpacity>
                          </View>
                        </View>

                        <Text style={styles.stopNameText}>{stop.poi_name}</Text>

                        <View style={styles.stopBottomRow}>
                          <View style={styles.stopMetaItem}>
                            <Clock3 size={12} color={Colors.textMuted} />
                            <Text style={styles.stopMetaText}>预计 {stop.stay_duration}</Text>
                          </View>
                          <View style={styles.stopMetaItem}>
                            {status === 'completed' ? (
                              <Check size={12} color={Colors.success} />
                            ) : (
                              <Navigation size={12} color={Colors.accentDark} />
                            )}
                            <Text
                              style={[
                                styles.statusText,
                                status === 'completed' ? styles.statusTextDone : undefined,
                              ]}
                            >
                              {getStopStatusLabel(status)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                })}

                <View style={styles.candidateRow}>
                  {(candidateByDay[dayIndex] ?? []).map((candidate) => (
                    <TouchableOpacity
                      key={`${day.day}_${candidate.poi_id}`}
                      style={styles.candidateChip}
                      onPress={() => onAddStop(dayIndex, buildStopFromCandidate(candidate))}
                    >
                      <Text style={styles.candidateChipText}>+ 加入 {candidate.poi_name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>

      {result.days.length > 1 ? (
        <View style={styles.pagination}>
          {result.days.map((day, index) => (
            <TouchableOpacity
              key={`dot_${day.day}`}
              onPress={() => jumpToDay(index)}
              style={[styles.paginationDot, index === safeDayIndex ? styles.paginationDotActive : undefined]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  headCard: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: Colors.primaryDark,
    gap: 8,
  },
  statusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#74D1A7',
  },
  statusPillText: {
    fontSize: 11,
    color: '#D9F0E5',
    fontWeight: '700',
  },
  titleText: {
    fontSize: 26,
    lineHeight: 31,
    color: Colors.white,
    fontWeight: '800',
  },
  metaText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.84)',
    fontWeight: '600',
  },
  bodyCard: {
    borderRadius: 14,
    padding: 10,
    backgroundColor: '#F8F5EF',
  },
  dayPage: {
    gap: 10,
  },
  dayPageFallback: {
    width: '100%',
  },
  stopRow: {
    flexDirection: 'row',
    gap: 10,
  },
  timelineColumn: {
    width: 16,
    alignItems: 'center',
    paddingTop: 14,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    borderWidth: 1.6,
    zIndex: 2,
  },
  timelineDotCompleted: {
    borderColor: '#6BB496',
    backgroundColor: '#6BB496',
  },
  timelineDotCurrent: {
    borderColor: Colors.warning,
    backgroundColor: Colors.background,
  },
  timelineDotPending: {
    borderColor: '#C9BEAE',
    backgroundColor: Colors.background,
  },
  timelineLine: {
    width: 1.5,
    flex: 1,
    marginTop: 4,
    marginBottom: -8,
    backgroundColor: '#D6CFC3',
  },
  timelineLineCompleted: {
    backgroundColor: '#9BC9B4',
  },
  stopCard: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 11,
    borderWidth: 1,
  },
  stopCardCompleted: {
    backgroundColor: '#F5F2EE',
    borderColor: '#ECE4D9',
  },
  stopCardCurrent: {
    backgroundColor: '#ECE7DE',
    borderColor: '#E0D6C4',
  },
  stopCardPending: {
    backgroundColor: '#F2ECE2',
    borderColor: '#E6DCCB',
  },
  stopTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C9BEAE',
  },
  timeTextActive: {
    color: Colors.accentDark,
  },
  topRightWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  poiTag: {
    fontSize: 10,
    color: '#C19252',
    fontWeight: '700',
  },
  removeBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F6E7E3',
  },
  stopNameText: {
    marginTop: 4,
    fontSize: 16,
    lineHeight: 22,
    color: Colors.text,
    fontWeight: '800',
  },
  stopBottomRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stopMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stopMetaText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  statusText: {
    fontSize: 12,
    color: Colors.accentDark,
    fontWeight: '700',
  },
  statusTextDone: {
    color: Colors.success,
  },
  candidateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingLeft: 26,
  },
  candidateChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#B8D1C2',
    backgroundColor: '#EAF4EE',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  candidateChipText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  paginationDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#D9CFC0',
  },
  paginationDotActive: {
    width: 18,
    backgroundColor: Colors.primary,
  },
});
