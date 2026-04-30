import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Sparkles, RotateCcw } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { useItinerary } from '@/hooks/useItinerary';
import type { ItineraryCandidatePoi, ItineraryStop } from '@/lib/ai/aiItineraryQueries';
import { AiItineraryDayPager } from './AiItineraryDayPager';

const INTENSITY_OPTIONS: { value: 1 | 2 | 3; label: string }[] = [
  { value: 1, label: '轻松' },
  { value: 2, label: '适中' },
  { value: 3, label: '紧凑' },
];

function distanceSquare(a: { lng: number; lat: number }, b: { lng: number; lat: number }): number {
  const dLng = a.lng - b.lng;
  const dLat = a.lat - b.lat;
  return dLng * dLng + dLat * dLat;
}

function buildStopFromCandidate(candidate: ItineraryCandidatePoi): ItineraryStop {
  const duration = candidate.poi_type === 'scenic' ? 150 : candidate.poi_type === 'museum' ? 120 : 90;
  return {
    poi_id: candidate.poi_id,
    poi_name: candidate.poi_name,
    poi_type: candidate.poi_type,
    arrival_time: '09:00',
    duration_minutes: duration,
    stay_duration: duration >= 120 ? `${Math.floor(duration / 60)}小时` : `${duration}分钟`,
    notes: candidate.label ? `手动加入：${candidate.label}` : '手动加入点位',
    lng: candidate.lng,
    lat: candidate.lat,
  };
}

export function AiItineraryPlanner() {
  const router = useRouter();
  const loginAlertShown = useRef(false);
  const {
    status,
    result,
    errorMessage,
    generate,
    regenerate,
    retry,
    addStop,
    removeStop,
    reset,
    needsLogin,
  } = useItinerary();

  const [query, setQuery] = useState('我喜欢历史，不要太累，西安两天');
  const [destination, setDestination] = useState('西安');
  const [days, setDays] = useState('2');
  const [dailyHours, setDailyHours] = useState('8');
  const [intensity, setIntensity] = useState<1 | 2 | 3>(2);
  const [themeTags, setThemeTags] = useState('历史,古建');

  useEffect(() => {
    if (!needsLogin || loginAlertShown.current) return;
    loginAlertShown.current = true;
    Alert.alert('请先登录', '使用智能行程前需要先登录账号。', [
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

  const candidateByDay = useMemo(() => {
    if (!result?.candidate_pois || result.candidate_pois.length === 0) {
      return [] as ItineraryCandidatePoi[][];
    }

    const usedInPlan = new Set(result.days.flatMap((day) => day.stops.map((stop) => stop.poi_id)));
    const pool = result.candidate_pois.filter((item) => !usedInPlan.has(item.poi_id));
    const allocated = new Set<string>();

    return result.days.map((day) => {
      const anchor = day.stops[day.stops.length - 1] ?? day.stops[0];
      if (!anchor || typeof anchor.lng !== 'number' || typeof anchor.lat !== 'number') {
        const fallback = pool.filter((item) => !allocated.has(item.poi_id)).slice(0, 3);
        fallback.forEach((item) => allocated.add(item.poi_id));
        return fallback;
      }
      const anchorPoint = { lng: anchor.lng, lat: anchor.lat };

      const sorted = pool
        .filter((item) => !allocated.has(item.poi_id))
        .sort((a, b) => distanceSquare(anchorPoint, a) - distanceSquare(anchorPoint, b));
      const picked = sorted.slice(0, 3);
      picked.forEach((item) => allocated.add(item.poi_id));
      return picked;
    });
  }, [result]);

  const generatePayload = useMemo(
    () => ({
      query: query.trim(),
      destination: destination.trim() || undefined,
      days: Number.isFinite(Number(days)) ? Number(days) : undefined,
      dailyHours: Number.isFinite(Number(dailyHours)) ? Number(dailyHours) : undefined,
      intensity,
      themeTags: themeTags
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    }),
    [dailyHours, days, destination, intensity, query, themeTags],
  );

  const handleGenerate = () => {
    void generate(generatePayload);
  };

  const handleRegenerate = () => {
    void regenerate({
      query: generatePayload.query,
      destination: generatePayload.destination,
      days: generatePayload.days,
      dailyHours: generatePayload.dailyHours,
      intensity: generatePayload.intensity,
      themeTags: generatePayload.themeTags,
    });
  };

  return (
    <View style={styles.section}>
      <View style={styles.card}>
        <View style={styles.titleRow}>
          <Sparkles size={20} color={Colors.goldLight} />
          <Text style={styles.title}>AI 智能行程</Text>
        </View>
        <Text style={styles.subtitle}>输入自然语言需求，生成多日草案；支持偏好重生与手动增删后重算。</Text>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="例如：喜欢历史，不要太累，西安两天"
          placeholderTextColor={Colors.textMuted}
          style={[styles.input, styles.multiline]}
          multiline
        />

        <View style={styles.inlineRow}>
          <TextInput
            value={destination}
            onChangeText={setDestination}
            placeholder="目的地"
            placeholderTextColor={Colors.textMuted}
            style={[styles.input, styles.inlineInput]}
          />
          <TextInput
            value={days}
            onChangeText={setDays}
            placeholder="天数"
            keyboardType="number-pad"
            placeholderTextColor={Colors.textMuted}
            style={[styles.input, styles.shortInput]}
          />
          <TextInput
            value={dailyHours}
            onChangeText={setDailyHours}
            placeholder="小时/天"
            keyboardType="number-pad"
            placeholderTextColor={Colors.textMuted}
            style={[styles.input, styles.shortInput]}
          />
        </View>

        <View style={styles.intensityRow}>
          {INTENSITY_OPTIONS.map((item) => (
            <TouchableOpacity
              key={item.value}
              style={[styles.intensityBtn, intensity === item.value && styles.intensityBtnActive]}
              onPress={() => setIntensity(item.value)}
            >
              <Text style={[styles.intensityText, intensity === item.value && styles.intensityTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          value={themeTags}
          onChangeText={setThemeTags}
          placeholder="主题标签，逗号分隔（如 历史,古建）"
          placeholderTextColor={Colors.textMuted}
          style={styles.input}
        />

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleGenerate}
            disabled={status === 'generating'}
          >
            {status === 'generating' ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.primaryBtnText}>生成行程</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostBtn} onPress={handleRegenerate}>
            <RotateCcw size={14} color={Colors.primary} />
            <Text style={styles.ghostBtnText}>按偏好重生</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostBtn} onPress={retry}>
            <Text style={styles.ghostBtnText}>重试</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostBtn} onPress={reset}>
            <Text style={styles.ghostBtnText}>清空</Text>
          </TouchableOpacity>
        </View>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {result ? (
          <View style={styles.resultWrap}>
            {result.summary ? <Text style={styles.summaryText}>{result.summary}</Text> : null}
            <AiItineraryDayPager
              result={result}
              candidateByDay={candidateByDay}
              onAddStop={addStop}
              onRemoveStop={removeStop}
              buildStopFromCandidate={buildStopFromCandidate}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 10,
  },
  card: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: Colors.primaryDark,
    gap: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.white,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 19,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.14)',
    color: Colors.white,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 13,
  },
  multiline: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  inlineRow: {
    flexDirection: 'row',
    gap: 8,
  },
  inlineInput: {
    flex: 1,
  },
  shortInput: {
    width: 80,
  },
  intensityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  intensityBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  intensityBtnActive: {
    backgroundColor: Colors.accent,
  },
  intensityText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.86)',
    fontWeight: '700',
  },
  intensityTextActive: {
    color: Colors.white,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  primaryBtn: {
    minWidth: 108,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
  },
  primaryBtnText: {
    fontSize: 13,
    color: Colors.white,
    fontWeight: '800',
  },
  ghostBtn: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  ghostBtnText: {
    fontSize: 12,
    color: Colors.white,
    fontWeight: '700',
  },
  errorBox: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#FFECEC',
  },
  errorText: {
    color: '#A63737',
    fontSize: 12,
    lineHeight: 18,
  },
  resultWrap: {
    marginTop: 4,
    borderRadius: 12,
    padding: 10,
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  summaryText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
});
