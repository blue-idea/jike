/**
 * components/catalog/LayerToggle.tsx
 * 图层切换控件
 * EARS-1 覆盖：切换图层触发 queryMapPois 重新查询
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '@/constants/Colors';

export type CultureMapLayer = 'scenic' | 'heritage' | 'museum';

interface LayerToggleProps {
  activeLayer: CultureMapLayer;
  scenicFilter: 'all' | '5A';
  onLayerChange: (layer: CultureMapLayer) => void;
  onScenicFilterChange: (f: 'all' | '5A') => void;
}

const LAYERS: { key: CultureMapLayer; label: string }[] = [
  { key: 'scenic', label: '景区' },
  { key: 'heritage', label: '国保' },
  { key: 'museum', label: '博物馆' },
];

export function LayerToggle({
  activeLayer,
  scenicFilter,
  onLayerChange,
  onScenicFilterChange,
}: LayerToggleProps) {
  return (
    <View style={styles.wrap}>
      {/* 主图层 */}
      <View style={styles.group}>
        {LAYERS.map((l) => (
          <TouchableOpacity
            key={l.key}
            onPress={() => onLayerChange(l.key)}
            style={[styles.btn, activeLayer === l.key && styles.btnActive]}
          >
            <Text style={[styles.btnText, activeLayer === l.key && styles.btnTextActive]}>
              {l.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {/* 景区子筛选 */}
      {activeLayer === 'scenic' && (
        <View style={styles.subGroup}>
          <TouchableOpacity
            onPress={() => onScenicFilterChange('all')}
            style={[styles.subBtn, scenicFilter === 'all' && styles.subBtnActive]}
          >
            <Text style={[styles.subBtnText, scenicFilter === 'all' && styles.subBtnTextActive]}>
              全部
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onScenicFilterChange('5A')}
            style={[styles.subBtn, scenicFilter === '5A' && styles.subBtnActive]}
          >
            <Text style={[styles.subBtnText, scenicFilter === '5A' && styles.subBtnTextActive]}>
              5A
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  group: {
    flexDirection: 'row',
    backgroundColor: '#F0EBE3',
    borderRadius: 10,
    padding: 3,
  },
  btn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 8,
  },
  btnActive: { backgroundColor: Colors.white, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4 },
  btnText: { fontSize: 13, color: '#6B5E4E' },
  btnTextActive: { fontWeight: '700', color: '#1A1603' },
  subGroup: { flexDirection: 'row', gap: 6, paddingLeft: 4 },
  subBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#EDE7DB',
  },
  subBtnActive: { backgroundColor: '#C8914A' },
  subBtnText: { fontSize: 12, color: '#6B5E4E' },
  subBtnTextActive: { color: '#fff', fontWeight: '600' },
});
