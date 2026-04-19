/**
 * components/ai/TtsControlButton.tsx
 *
 * TTS 播报控制按钮（EARS-1：支持播放/暂停基础控制）
 */
import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Volume2, VolumeX } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { useTts } from '@/hooks/useTts';

interface TtsControlButtonProps {
  /** 要播报的完整文本（将各 section content 拼接） */
  fullText: string;
  size?: number;
}

export function TtsControlButton({ fullText, size = 22 }: TtsControlButtonProps) {
  const { isPlaying, speak, stop } = useTts();

  const handlePress = () => {
    if (isPlaying) {
      stop();
    } else {
      void speak(fullText);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.btn, isPlaying && styles.btnActive]}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityLabel={isPlaying ? '停止语音播报' : '开始语音播报'}
      accessibilityRole="button"
    >
      {isPlaying ? (
        <VolumeX size={size} color={Colors.white} />
      ) : (
        <Volume2 size={size} color={Colors.primary} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  btnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
});
