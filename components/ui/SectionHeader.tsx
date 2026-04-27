import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';

export type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  onSeeAll?: () => void;
};

export function SectionHeader({ title, subtitle, onSeeAll }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.texts}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {onSeeAll ? (
        <TouchableOpacity onPress={onSeeAll} hitSlop={8} accessibilityRole="button">
          <Text style={styles.seeAll}>查看全部</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 12,
  },
  texts: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: 0.3,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  seeAll: {
    fontSize: 13,
    color: Colors.primaryLight,
    fontWeight: '500',
  },
});
