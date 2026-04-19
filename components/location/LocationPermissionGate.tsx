/**
 * components/location/LocationPermissionGate.tsx
 *
 * 定位权限请求说明组件（首次请求前展示）
 * EARS-PERM 覆盖：展示用途说明后触发权限请求
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';

interface LocationPermissionGateProps {
  onRequestPermission: () => void;
  isRequesting?: boolean;
}

export function LocationPermissionGate({
  onRequestPermission,
  isRequesting = false,
}: LocationPermissionGateProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <MapPin size={32} color={Colors.primary} />
      </View>
      <Text style={styles.title}>需要定位权限</Text>
      <Text style={styles.desc}>
        集刻需要获取你的位置，用于推荐附近的文化景点、计算距离和规划路线。
      </Text>
      <TouchableOpacity
        style={[styles.btn, isRequesting && styles.btnDisabled]}
        onPress={onRequestPermission}
        disabled={isRequesting}
        activeOpacity={0.85}
      >
        <Text style={styles.btnText}>
          {isRequesting ? '请求中...' : '允许定位'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#F7F3EC',
    borderRadius: 20,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 8,
  },
  desc: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  btn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
