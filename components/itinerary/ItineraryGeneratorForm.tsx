/**
 * components/itinerary/ItineraryGeneratorForm.tsx
 *
 * AI 行程生成表单（EARS-1：自然语言输入 + 偏好配置）
 */
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { Sparkles } from 'lucide-react-native';

interface ItineraryGeneratorFormProps {
  onSubmit: (constraints: {
    destination?: string;
    days?: number;
    intensity?: 1 | 2 | 3;
    dailyHours?: number;
    otherPreferences?: string;
  }) => void;
  isLoading: boolean;
}

export function ItineraryGeneratorForm({
  onSubmit,
  isLoading,
}: ItineraryGeneratorFormProps) {
  const [destination, setDestination] = useState('');
  const [days, setDays] = useState('3');
  const [intensity, setIntensity] = useState<1 | 2 | 3>(2);
  const [prefs, setPrefs] = useState('');

  const handleSubmit = () => {
    onSubmit({
      destination: destination || undefined,
      days: parseInt(days, 10) || 3,
      intensity,
      dailyHours: 8,
      otherPreferences: prefs || undefined,
    });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>目的地</Text>
        <TextInput
          style={styles.input}
          placeholder="如：西安、山西、北京"
          placeholderTextColor={Colors.textMuted}
          value={destination}
          onChangeText={setDestination}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>行程天数</Text>
        <View style={styles.chipRow}>
          {['2', '3', '4', '5'].map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.chip, days === d && styles.chipActive]}
              onPress={() => setDays(d)}
            >
              <Text style={[styles.chipText, days === d && styles.chipTextActive]}>
                {d}天
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>体力强度</Text>
        <View style={styles.chipRow}>
          {[
            { v: 1, label: '轻松' },
            { v: 2, label: '适中' },
            { v: 3, label: '挑战' },
          ].map(({ v, label }) => (
            <TouchableOpacity
              key={v}
              style={[styles.chip, intensity === v && styles.chipActive]}
              onPress={() => setIntensity(v as 1 | 2 | 3)}
            >
              <Text
                style={[
                  styles.chipText,
                  intensity === v && styles.chipTextActive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>其他偏好（可选）</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="如有博物馆偏好、朝代偏好、饮食要求等，请在此说明"
          placeholderTextColor={Colors.textMuted}
          value={prefs}
          onChangeText={setPrefs}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      <TouchableOpacity
        style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={isLoading}
        activeOpacity={0.8}
      >
        <Sparkles size={18} color={Colors.white} />
        <Text style={styles.submitText}>
          {isLoading ? 'AI 生成中...' : '生成我的行程'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, gap: 20 },
  inputGroup: { gap: 8 },
  label: { fontSize: 14, fontWeight: '700', color: Colors.text },
  input: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  multiline: { height: 88, paddingTop: 12 },
  chipRow: { flexDirection: 'row', gap: 10 },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: Colors.white },
  submitBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: Colors.white, fontSize: 16, fontWeight: '800' },
});
