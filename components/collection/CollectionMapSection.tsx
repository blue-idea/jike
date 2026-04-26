import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CultureMapView } from '@/components/collection/CultureMapView';
import { Colors } from '@/constants/Colors';
import { SlidersHorizontal } from 'lucide-react-native';

type CollectionMapSectionProps = {
  onMapInteractingChange?: (isInteracting: boolean) => void;
};

export function CollectionMapSection({ onMapInteractingChange }: CollectionMapSectionProps) {
  return (
    <View style={styles.block}>
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.title}>文化地图</Text>
          <Text style={styles.subtitle}>
            高德文旅底图（可配置样式 ID）；仅显示当前位置 20km 内的 Supabase 三类名录点位
          </Text>
        </View>
        <View style={styles.themeBadge}>
          <SlidersHorizontal size={14} color={Colors.primary} />
        </View>
      </View>
      <CultureMapView onMapInteractingChange={onMapInteractingChange} />
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
});
