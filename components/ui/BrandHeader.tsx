import React from 'react';
import { View, Image, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { BrandingOptions, CURRENT_BRANDING } from '@/constants/Branding';
import { Bell } from 'lucide-react-native';

export type BrandHeaderProps = {
  rightElement?: React.ReactNode;
  onRightPress?: () => void;
};

export function BrandHeader({
  rightElement,
  onRightPress,
}: BrandHeaderProps) {
  const insets = useSafeAreaInsets();
  const branding = BrandingOptions[CURRENT_BRANDING];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Image 
            source={branding.image} 
            style={styles.logo} 
            resizeMode="contain"
          />
        </View>
        
        <View style={styles.right}>
          {rightElement || (
            <TouchableOpacity 
              style={styles.iconBtn} 
              onPress={onRightPress}
              activeOpacity={0.7}
            >
              <Bell size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  content: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  logoContainer: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  logo: {
    height: 32,
    width: 120, // 初始宽度，保持比例
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: Colors.text,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
});
