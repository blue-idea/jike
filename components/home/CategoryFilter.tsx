import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Layers, Landmark, Building2, Mountain, Hop as Home, Circle, Triangle } from 'lucide-react-native';

const CATEGORIES = [
  { id: 'all', label: '全部', Icon: Layers },
  { id: 'heritage', label: '国保单位', Icon: Landmark },
  { id: 'museum', label: '博物馆', Icon: Building2 },
  { id: 'scenic', label: '5A景区', Icon: Mountain },
  { id: 'ancient', label: '古建筑', Icon: Home },
  { id: 'grotto', label: '石窟', Icon: Circle },
  { id: 'tomb', label: '陵墓', Icon: Triangle },
];

interface CategoryFilterProps {
  onSelect?: (id: string) => void;
}

export function CategoryFilter({ onSelect }: CategoryFilterProps) {
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
      {CATEGORIES.map(({ id, label, Icon }) => {
        const isActive = active === id;
        return (
          <TouchableOpacity
            key={id}
            style={[styles.chip, isActive && styles.chipActive]}
            onPress={() => handleSelect(id)}
            activeOpacity={0.75}
          >
            <Icon
              size={14}
              color={isActive ? Colors.white : Colors.textSecondary}
              strokeWidth={isActive ? 2.5 : 1.8}
            />
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 24,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
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
