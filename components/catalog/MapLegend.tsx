/**
 * components/catalog/MapLegend.tsx
 * 地图图例
 * EARS-1 覆盖：同步图例说明
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

const ITEMS = [
  { color: '#C8914A', label: 'A级景区' },
  { color: '#813520', label: '全国重点文物保护单位' },
  { color: '#2C4A3E', label: '博物馆' },
];

export function MapLegend() {
  return (
    <View style={styles.wrap}>
      {ITEMS.map((item) => (
        <View key={item.label} style={styles.item}>
          <View style={[styles.dot, { backgroundColor: item.color }]} />
          <Text style={styles.label}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(250,247,242,0.92)',
    borderRadius: 8,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2 },
  label: { fontSize: 11, color: '#5C5040' },
});
