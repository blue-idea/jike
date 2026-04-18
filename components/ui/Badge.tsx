import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export type BadgeProps = {
  label: string;
  color: string;
};

export function Badge({ label, color }: BadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: `${color}26`, borderColor: `${color}55` }]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
