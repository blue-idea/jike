import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';

type CatalogAiGuideButtonProps = {
  onPress: () => void;
};

/** 样式对齐首页 `SiteCard` 精选景点的 AI 导览按钮（主色胶囊 + Sparkles +「AI导游」） */
export function CatalogAiGuideButton({ onPress }: CatalogAiGuideButtonProps) {
  return (
    <TouchableOpacity
      style={styles.aiGuideImageBtn}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="AI 导游讲解"
    >
      <Sparkles size={12} color={Colors.white} strokeWidth={2.2} />
      <Text style={styles.aiGuideImageBtnText}>AI导游</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  aiGuideImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  aiGuideImageBtnText: {
    fontSize: 10,
    color: Colors.white,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
