/**
 * components/catalog/MapLegend.tsx
 * 地图图例
 * EARS-1 覆盖：同步图例说明
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { CultureMapLayer } from '@/lib/catalog/supabaseCatalogQueries';

const ITEMS: { key: CultureMapLayer; color: string; label: string }[] = [
  { key: 'scenic', color: '#C8914A', label: 'A级景区' },
  { key: 'heritage', color: '#813520', label: '全国重点文物保护单位' },
  { key: 'museum', color: '#2C4A3E', label: '博物馆' },
];

interface MapLegendProps {
  activeLayer: CultureMapLayer;
  scenicFilter: 'all' | '5A';
  count: number;
}

export function MapLegend({ activeLayer, scenicFilter, count }: MapLegendProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {ITEMS.map((item) => {
          const isActive = item.key === activeLayer;
          const label =
            item.key === 'scenic' && scenicFilter === '5A' ? 'A级景区（仅 5A）' : item.label;
          return (
            <View key={item.key} style={[styles.item, isActive && styles.itemActive]}>
              <View style={[styles.dot, { backgroundColor: item.color }]} />
              <Text style={[styles.label, isActive && styles.labelActive]}>{label}</Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.hint}>当前显示 {count} 个点位 · 20km 范围 · 数据源仅 Supabase 三类名录</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(250,247,242,0.92)',
    borderRadius: 10,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    opacity: 0.45,
  },
  itemActive: {
    opacity: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  label: {
    fontSize: 11,
    color: '#5C5040',
  },
  labelActive: {
    fontWeight: '700',
    color: '#2E251A',
  },
  hint: {
    fontSize: 11,
    color: '#6B5E4E',
  },
});
