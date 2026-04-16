import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { DYNASTY_FILTERS } from '@/constants/MockData';

interface DynastyFilterProps {
  onSelect?: (id: string) => void;
}

export function DynastyFilter({ onSelect }: DynastyFilterProps) {
  const [active, setActive] = useState('all');

  const handleSelect = (id: string) => {
    setActive(id);
    onSelect?.(id);
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {DYNASTY_FILTERS.map(({ id, label }) => {
        const isActive = active === id;
        return (
          <TouchableOpacity
            key={id}
            style={[styles.chip, isActive && styles.chipActive]}
            onPress={() => handleSelect(id)}
            activeOpacity={0.75}
          >
            <Text style={[styles.label, isActive && styles.labelActive]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.seal,
    borderColor: Colors.seal,
  },
  label: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  labelActive: {
    color: Colors.white,
    fontWeight: '600',
  },
});
