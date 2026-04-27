import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Flame, ChevronRight } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';

export function HeatTrendEntryCard() {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push('/heatmap-trends')}
        activeOpacity={0.88}
      >
        <View style={styles.iconWrap}>
          <Flame size={18} color={Colors.accent} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title}>热力与人流趋势</Text>
          <Text style={styles.desc}>独立查看热门程度和实时路况图层</Text>
        </View>
        <ChevronRight size={18} color={Colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginBottom: 14,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent + '18',
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  desc: {
    fontSize: 12,
    color: Colors.textMuted,
  },
});
