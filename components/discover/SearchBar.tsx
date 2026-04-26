import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Search, SlidersHorizontal, X } from 'lucide-react-native';

interface SearchBarProps {
  placeholder?: string;
  onSearch?: (text: string) => void;
  onFilter?: () => void;
}

export function SearchBar({ placeholder = '搜索景点、博物馆、文物...', onSearch, onFilter }: SearchBarProps) {
  const [value, setValue] = useState('');

  const handleChange = (text: string) => {
    setValue(text);
    onSearch?.(text);
  };

  const handleClear = () => {
    setValue('');
    onSearch?.('');
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputWrapper}>
        <Search size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          value={value}
          onChangeText={handleChange}
        />
        {value.length > 0 && (
          <TouchableOpacity onPress={handleClear}>
            <X size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity style={styles.filterBtn} onPress={onFilter}>
        <SlidersHorizontal size={18} color={Colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 11,
    paddingHorizontal: 14,
    height: 37,
    gap: 10,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  input: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
  },
  filterBtn: {
    width: 37,
    height: 37,
    backgroundColor: Colors.card,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
});
