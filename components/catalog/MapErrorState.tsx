/**
 * components/catalog/MapErrorState.tsx
 * 地图异常状态（网络错误）
 * EARS-2 覆盖：网络异常中文提示+重试
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface MapErrorStateProps {
  onRetry: () => void;
  title?: string;
  description?: string;
  retryText?: string;
}

export function MapErrorState({
  onRetry,
  title = '网络异常',
  description = '请检查网络连接后重试',
  retryText = '重试',
}: MapErrorStateProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>📡</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.desc}>{description}</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
        <Text style={styles.retryText}>{retryText}</Text>
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
