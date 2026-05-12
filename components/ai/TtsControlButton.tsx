/**
 * components/ai/TtsControlButton.tsx
 *
 * TTS 播报控制按钮（EARS-1：支持播放/暂停基础控制）
 */
import React from 'react';
import { Alert, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { Pause, Play, Volume2, VolumeX } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { useTts } from '@/hooks/useTts';

interface TtsControlButtonProps {
  /** 要播报的完整文本（将各 section content 拼接） */
  fullText: string;
  size?: number;
  /** banner：主色实心圆 + 白图标，用于头图下导览胶囊 */
  variant?: 'default' | 'banner';
}

export function TtsControlButton({
  fullText,
  size = 22,
  variant = 'default',
}: TtsControlButtonProps) {
  const { state, isPlaying, isLoading, speak, pause, resume, stop } = useTts();

  const handlePress = async () => {
    try {
      if (isLoading) return;
      if (isPlaying) {
        await pause();
      } else if (state === 'paused') {
        await resume();
      } else {
        await speak(fullText);
      }
    } catch (error) {
      Alert.alert(
        '语音播报失败',
        error instanceof Error ? error.message : '请稍后重试。',
      );
      await stop();
    }
  };

  const handleLongPress = async () => {
    if (state !== 'idle') {
      await stop();
    }
  };

  const accessibilityLabel = isLoading
    ? '语音加载中'
    : isPlaying
      ? '暂停语音播报'
      : state === 'paused'
        ? '继续语音播报'
        : '开始语音播报';

  const onPrimary = variant === 'banner';

  const renderIcon = () => {
    if (isLoading) {
      return <ActivityIndicator color={onPrimary ? Colors.white : Colors.primary} size="small" />;
    }
    if (isPlaying) {
      return <Pause size={size} color={Colors.white} />;
    }
    if (state === 'paused') {
      return <Play size={size} color={onPrimary ? Colors.white : Colors.primary} />;
    }
    return <Volume2 size={size} color={onPrimary ? Colors.white : Colors.primary} />;
  };

  const activeState = isPlaying;

  return (
    <TouchableOpacity
      style={[
        styles.btn,
        onPrimary && styles.btnBanner,
        activeState && (onPrimary ? styles.btnBannerActive : styles.btnActive),
        onPrimary && state === 'paused' && !activeState && styles.btnBannerPaused,
      ]}
      onPress={() => {
        void handlePress();
      }}
      onLongPress={() => {
        void handleLongPress();
      }}
      activeOpacity={0.7}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="长按可停止并重置语音播报"
      accessibilityRole="button"
    >
      {renderIcon()}
      {activeState ? <VolumeX size={12} color={Colors.white} style={styles.cornerIcon} /> : null}
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
    position: 'relative',
  },
  btnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  btnBanner: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  btnBannerActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  btnBannerPaused: {
    opacity: 0.92,
  },
  cornerIcon: {
    position: 'absolute',
    right: -4,
    top: -3,
  },
});
