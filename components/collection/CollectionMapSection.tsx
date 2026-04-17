import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CultureMapView } from '@/components/collection/CultureMapView';
import { Colors } from '@/constants/Colors';
import type { CultureMapLayer } from '@/constants/cultureMapData';
import { Landmark, MapPin, Building2, SlidersHorizontal } from 'lucide-react-native';

const LAYER_CHIPS: { id: CultureMapLayer; label: string; Icon: typeof Landmark }[] = [
  { id: 'heritage', label: '文保', Icon: Landmark },
  { id: 'museum', label: '博物馆', Icon: Building2 },
  { id: 'scenic', label: 'A 级景区', Icon: MapPin },
];

export function CollectionMapSection() {
  const [layer, setLayer] = useState<CultureMapLayer>('heritage');
  const [scenicFilter, setScenicFilter] = useState<'all' | '5A'>('all');

  return (
    <View style={styles.block}>
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.title}>文化地图</Text>
          <Text style={styles.subtitle}>
            高德文旅底图（可配置样式 ID）；点选图层只看周边同类型点位
          </Text>
        </View>
        <View style={styles.themeBadge}>
          <SlidersHorizontal size={14} color={Colors.primary} />
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipScroll}
      >
        {LAYER_CHIPS.map(({ id, label, Icon }) => {
          const active = layer === id;
          return (
            <TouchableOpacity
              key={id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setLayer(id)}
              activeOpacity={0.88}
            >
              <Icon size={14} color={active ? Colors.white : Colors.primary} strokeWidth={2.2} />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {layer === 'scenic' ? (
        <View style={styles.subRow}>
          <TouchableOpacity
            style={[styles.subChip, scenicFilter === 'all' && styles.subChipOn]}
            onPress={() => setScenicFilter('all')}
          >
            <Text style={[styles.subChipText, scenicFilter === 'all' && styles.subChipTextOn]}>
              全部 A 级
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.subChip, scenicFilter === '5A' && styles.subChipOn]}
            onPress={() => setScenicFilter('5A')}
          >
            <Text style={[styles.subChipText, scenicFilter === '5A' && styles.subChipTextOn]}>
              仅 5A
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <CultureMapView activeLayer={layer} scenicFilter={scenicFilter} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 17,
    maxWidth: '92%',
  },
  themeBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipScroll: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  chipTextActive: {
    color: Colors.white,
  },
  subRow: {
    flexDirection: 'row',
    gap: 8,
  },
  subChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.backgroundAlt,
  },
  subChipOn: {
    backgroundColor: Colors.accent + '22',
  },
  subChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  subChipTextOn: {
    color: Colors.accentDark,
  },
});
