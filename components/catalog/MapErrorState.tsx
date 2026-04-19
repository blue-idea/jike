/**
 * components/catalog/MapErrorState.tsx
 * 地图异常状态（网络错误）
 * EARS-2 覆盖：网络异常中文提示+重试
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface MapErrorStateProps {
  onRetry: () => void;
}

export function MapErrorState({ onRetry }: MapErrorStateProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>📡</Text>
      <Text style={styles.title}>网络异常</Text>
      <Text style={styles.desc}>请检查网络连接后重试</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
        <Text style={styles.retryText}>重试</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F7F3EC',
  },
  icon: { fontSize: 32, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '700', color: '#1A1603', marginBottom: 6 },
  desc: { fontSize: 13, color: '#6B5E4E', marginBottom: 20 },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#C8914A',
    borderRadius: 10,
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
